import "server-only";

import { and, eq } from "drizzle-orm";

import type { DbClient, DbTransaction } from "@/db";
import { events } from "@/db/schema";
import { CpmmDecimal, toFixed18 } from "@/server/cpmm/decimal";
import { eventPayloadSchemas } from "@/server/events/schemas";

/**
 * ADR-0047 §E — the backing identity's discard term, and the ONE place the
 * `market.opened` payload union is discriminated.
 *
 *     Y + H_yes + D_yes  ==  N + H_no + D_no  ==  total Đ deposited
 *
 * This file lives under `markets/` because `markets/open.ts` is the only writer
 * of `market.opened` in the repository, so the reader of that payload belongs in
 * the same directory as its writer — one directory owning both ends of the
 * event, rather than a reader stranded in a consumer's tree.
 * `resolution/{settle,void}.ts` already import from `@/server/markets`, so the
 * two critical-path consumers add no new dependency edge.
 *
 * ⛔ NO CONSUMER MAY DISCRIMINATE THE PAYLOAD UNION ITSELF. `price-series.ts`,
 * `void.ts`, `settle.ts` and every conservation caller read through
 * `readOpenedReserves`. The whole point of a union is that exactly one place
 * knows there are two shapes; a second place that learns it is a second place
 * that can drift from the first, silently, on a money path.
 */

/** The opening state of a pool, normalised across both payload variants. */
export type OpenedReserves = {
	/** Y₀ — the yes reserve written at open. */
	yes: string;
	/** N₀ — the no reserve written at open. */
	no: string;
	/** D_yes at open — shares minted on the yes side and discarded. */
	dYes: string;
	/** D_no at open. */
	dNo: string;
	/** p_yes at open. */
	openingPriceYes: string;
};

const ZERO = toFixed18(new CpmmDecimal(0));
const HALF = toFixed18(new CpmmDecimal("0.5"));

/**
 * Read a `market.opened` payload into the opening state, whichever shape it is.
 *
 * A LEGACY payload (`{ marketId, seedAmount }`) is a SYMMETRIC seed: both
 * reserves are `seedAmount`, the opening price is exactly ½, and both discards
 * are zero. That is not a stub or a best guess — a symmetric seed mints
 * `max(C, C) = C` pairs and puts all of both sides in the pool, so it genuinely
 * discards nothing. Every historical row on staging and in every fixture is
 * this shape, which is why the union keeps its legacy arm rather than migrating
 * the rows.
 *
 * Parses with the shipped schema and THROWS on a malformed payload, preserving
 * the posture `price-series.ts` has had since UI-A5 — a payload that cannot be
 * read is a corrupt audit trail, not a chart to draw approximately.
 */
export function readOpenedReserves(payload: unknown): OpenedReserves {
	const parsed = eventPayloadSchemas["market.opened"].parse(payload);
	if ("seedAmount" in parsed) {
		const seed = toFixed18(new CpmmDecimal(parsed.seedAmount));
		return {
			yes: seed,
			no: seed,
			dYes: ZERO,
			dNo: ZERO,
			openingPriceYes: HALF,
		};
	}
	return {
		yes: parsed.yesReserves,
		no: parsed.noReserves,
		dYes: parsed.discardedYes,
		dNo: parsed.discardedNo,
		openingPriceYes: parsed.openingPriceYes,
	};
}

/**
 * The Đ deposited at open — the per-side total of the backing identity.
 * `yes + dYes`, which equals `no + dNo` by construction (both are
 * `max(yes, no)`, the pairs the open minted). Conservation callers start from
 * THIS, never from a payload's `seedAmount`: on a legacy row the two agree, and
 * on an asymmetric row `seedAmount` does not exist.
 */
export function openingBacking(r: OpenedReserves): string {
	return toFixed18(new CpmmDecimal(r.yes).plus(r.dYes));
}

/**
 * Cumulative discards per side for one market, summed from its events.
 *
 * Takes an explicit client rather than importing `db`, because `void.ts` and
 * `settle.ts` both call this INSIDE their W-3 transaction while holding the
 * pool lock — a second connection there would read outside the lock and could
 * see a different world than the one being settled.
 *
 * Written as a SUM over rows rather than a read of one row. Today there is
 * exactly one source (`market.opened`, and `I-GENESIS-001` says every Open
 * market has it), so the sum is over a single row; ADR-0047 Phase 2 adds
 * `pool.liquidity_added` to the same walk and no call site changes. An absent
 * row returns (0,0) — a market with no open has no discards, which is the same
 * answer for a Draft market and for a defensive miss.
 */
export async function loadMarketDiscards(
	client: DbClient | DbTransaction,
	marketId: string,
): Promise<{ yes: string; no: string }> {
	const rows = await client
		.select({ payload: events.payload })
		.from(events)
		.where(
			and(
				eq(events.aggregateType, "market"),
				eq(events.aggregateId, marketId),
				eq(events.eventType, "market.opened"),
			),
		);

	let yes = new CpmmDecimal(0);
	let no = new CpmmDecimal(0);
	for (const row of rows) {
		const opened = readOpenedReserves(row.payload);
		yes = yes.plus(opened.dYes);
		no = no.plus(opened.dNo);
	}
	return { yes: toFixed18(yes), no: toFixed18(no) };
}
