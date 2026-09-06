import "server-only";

import { and, asc, eq } from "drizzle-orm";

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
 * Parses with the shipped schema and THROWS on a malformed payload. That was
 * `price-series.ts`'s posture already, but inheriting a CHART's posture is not
 * an argument for a settlement's, so here is the argument (`@code-reviewer`
 * MEDIUM-4): `settleMarket` and `voidMarket` now call this inside their
 * transaction, so an unreadable genesis row makes a market unsettleable rather
 * than merely unchartable. That is deliberate and it is the right way round.
 * The alternative — default `D` to zero and settle anyway — writes a knowably
 * wrong `poolUnwindAmount` onto a terminal, append-only row that INV-4 forbids
 * anyone from correcting. An unsettleable market is a problem someone can fix;
 * a wrong terminal payout is not.
 *
 * ⚠ It is a NEW money-path posture: before this branch neither resolution
 * function read any event payload, and a corrupt genesis row cost a chart. The
 * exposure is narrow — prod has no markets, and plan §7's `staging:rebuild`
 * replaces all twelve staging rows with engine-emitted ones — but it is real
 * until that reseed runs.
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
 * The fail-closed read, and the ONLY one `settleMarket` / `voidMarket` may use.
 *
 * ⛔ AN ABSENT GENESIS ROW IS CORRUPTION HERE, NOT A ZERO. `loadMarketDiscards`
 * answers (0,0) when a market has no `market.opened`, which is right for a Draft
 * market and right for the scale harnesses, whose synthetic pools emit no such
 * event. It is WRONG for settlement: `settleMarket` only matches `Resolving`,
 * which implies the market was `Open`, which by `I-GENESIS-001` implies the row
 * exists. So for these two callers, absent means the audit trail lost a row.
 *
 * Answering (0,0) there would make `settleMarket` write `poolUnwindAmount = w`
 * to a terminal, append-only row — under-reporting a D-14 NO outcome by 80,000 Đ
 * with no throw and no alarm. That is the same defect `loadMarketDiscards`'s own
 * capped read was written to prevent, reached through the opposite door: too few
 * rows rather than too many. `voidMarket` would survive it — its cross-assert
 * catches the gap — but settle has nothing behind it, which is exactly why the
 * two must not share the tolerant read.
 *
 * Consistent with `readOpenedReserves`, which throws on a payload it cannot
 * parse: an unsettleable market is a problem someone can fix, and a wrong
 * terminal payout is not.
 *
 * Takes an explicit client rather than importing `db`, because `void.ts` and
 * `settle.ts` both call this INSIDE their W-3 transaction while holding the
 * pool lock — a second connection there would read outside the lock and could
 * see a different world than the one being settled.
 */
export async function requireMarketDiscards(
	client: DbClient | DbTransaction,
	marketId: string,
): Promise<{ yes: string; no: string }> {
	const genesis = await readGenesisRow(client, marketId);
	if (genesis === undefined) {
		throw new Error(
			`requireMarketDiscards: market ${marketId} has no market.opened event — refusing to settle against an incomplete audit trail (I-GENESIS-001)`,
		);
	}
	const opened = readOpenedReserves(genesis);
	return {
		yes: toFixed18(new CpmmDecimal(opened.dYes)),
		no: toFixed18(new CpmmDecimal(opened.dNo)),
	};
}

/**
 * The shared genesis read. Byte-for-byte the one in `replayReserveSeries`
 * (discovery/price-series.ts): same three predicates, same ASC order, same
 * LIMIT 1. If these two ever drift, the chart and the payout describe different
 * markets — which is the failure the cap exists to prevent, not merely a tidy
 * duplication.
 */
async function readGenesisRow(
	client: DbClient | DbTransaction,
	marketId: string,
): Promise<unknown> {
	const rows = await client
		.select({ payload: events.payload })
		.from(events)
		.where(
			and(
				eq(events.aggregateType, "market"),
				eq(events.aggregateId, marketId),
				eq(events.eventType, "market.opened"),
			),
		)
		// `event_id` is the tiebreak, not decoration: `created_at` is millisecond
		// precision and a backfill can write several rows inside one millisecond,
		// so ASC on the timestamp alone is not a total order. UUIDv7 is
		// time-ordered, which makes the pair deterministic. `replayReserveSeries`
		// carries the same tiebreak on its bet walk for the same reason.
		.orderBy(asc(events.createdAt), asc(events.eventId))
		.limit(1);

	return rows[0]?.payload;
}
