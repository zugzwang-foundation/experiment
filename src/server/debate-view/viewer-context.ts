import "server-only";

import { eq, sql } from "drizzle-orm";

import type { DbClient } from "@/db";
import { pools, users } from "@/db/schema";
import { DAILY_CREDIT_DHARMA } from "@/server/config/limits";
import { computeSell } from "@/server/cpmm/calculate";
import { CpmmDecimal } from "@/server/cpmm/decimal";
import { utcDayOf } from "@/server/dharma/accrual";
import { readBalance } from "@/server/dharma/persist";
import { getHeldPosition } from "@/server/positions/read";

/**
 * UI.A2 §3.3 — the viewer-session context: a composed server read, NOT an
 * endpoint (ADR-0019 Architecture 2). Invoked by the `/m/[slug]` page RSC
 * BESIDE `loadDebateView` — the masking gate stays viewer-independent
 * (SG-3); this module is the separate, session-scoped read. The DTO field
 * set is RATIFIED (OQ-3): NO `staked` field — the Đa staked-basis is a
 * founder ruling owed before A3 renders it.
 *
 * READ-ONLY BY LAW (the plan-§1 INV-2 "read-that-writes" narrative): no
 * ledger append, no accrual write, no cursor write, no events row — ever.
 * `spendableToday` is arithmetic over the cursor, NEVER a call into
 * `accrueDailyCredit` (the tempting reuse would turn every page load by an
 * unpaid-today user into a Daily-Credit mint without a commented bet —
 * attendance becoming issuance, ADR-0018's rejected Option 4). The parity
 * integration test (`viewer-context.integration.test.ts`) binds this
 * preview to `accrueDailyCredit`'s own paid/unpaid behavior via the SHARED
 * `utcDayOf` import, so the two cannot drift apart silently.
 */
export type ViewerMarketContext = {
	position: {
		side: "YES" | "NO";
		quantity: string;
		/**
		 * Đb — the sell-all execution value NOW: `computeSell(quantity).proceeds`,
		 * impact-inclusive per cpmm §6.3 (what a seller actually receives). RULED
		 * (FI-2): a CHOICE vs the rejected mark-to-p1 spot mark. Inheritance law:
		 * A5 Profile's "Current" column + "Positions value" tile INHERIT this
		 * basis — one holding never shows two different current values.
		 */
		currentValue: string;
	} | null;
	/** `readBalance` — the latest ledger `balance_after` (seq-ordered, ADR-0029). */
	balance: string;
	/** balance + (unpaid-today ? DAILY_CREDIT_DHARMA : 0) — READ-ONLY preview. */
	spendableToday: string;
};

/**
 * The pure Daily-Credit preview. Unpaid ⇔ `cursor === null ||
 * utcDayOf(cursor) !== utcDayOf(now)` — the SHARED `utcDayOf` from
 * `accrual.ts`, never re-derived day math. Exists because the place path
 * pays the day's credit BEFORE the F-BET-4 balance check (`place.ts` R4) —
 * a composer gating affordability on raw `balance` would wrongly block a
 * stake the endpoint accepts. Unpaid → exact 18-dp decimal add (CLAUDE.md
 * §2 — never a JS float); paid → the balance string passes through
 * byte-identical.
 */
export function computeSpendableToday(args: {
	balance: string;
	cursor: Date | null;
	now: Date;
}): string {
	const unpaid =
		args.cursor === null || utcDayOf(args.cursor) !== utcDayOf(args.now);
	return unpaid
		? new CpmmDecimal(args.balance).plus(DAILY_CREDIT_DHARMA).toFixed(18)
		: args.balance;
}

/**
 * Compose the viewer's market context in ONE read-only transaction (a
 * consistent snapshot across position / balance / cursor; SELECTs only —
 * zero writes). Reads: `getHeldPosition` (inherits the ≤1-held single-side
 * assert), `readBalance`, the `users` cursor + the tx clock in one
 * statement (the `accrual.ts` single-clock pattern — `.mapWith` is
 * load-bearing, a bare sql fragment has no runtime Date decoder), and the
 * pool row ONLY when a position is held (a null position needs no pool
 * read beyond the header's).
 */
export async function loadViewerMarketContext(
	client: DbClient,
	args: { userId: string; marketId: string },
): Promise<ViewerMarketContext> {
	return client.transaction(async (tx) => {
		const held = await getHeldPosition(tx, args);
		const balance = await readBalance(tx, args.userId);

		const rows = await tx
			.select({
				cursor: users.lastAllowanceAccruedAt,
				txNow: sql`now()`.mapWith(users.lastAllowanceAccruedAt),
			})
			.from(users)
			.where(eq(users.id, args.userId));
		const row = rows[0];
		if (row === undefined) {
			// Caller bug — the page only calls this with a session-vouched user id.
			throw new Error(
				`loadViewerMarketContext: no users row for ${args.userId}`,
			);
		}
		const spendableToday = computeSpendableToday({
			balance,
			cursor: row.cursor,
			now: row.txNow,
		});

		let position: ViewerMarketContext["position"] = null;
		if (held !== null) {
			const poolRows = await tx
				.select({
					yesReserves: pools.yesReserves,
					noReserves: pools.noReserves,
				})
				.from(pools)
				.where(eq(pools.marketId, args.marketId))
				.limit(1);
			const pool = poolRows[0];
			if (pool === undefined) {
				// Structurally impossible: positions only mint inside the pool-locked
				// W-1 tx (markets seed at open, ENGINE.14) — an internal-invariant
				// guard, mirroring place()'s RETURNING-empty guards. No new wire code.
				throw new Error(
					`loadViewerMarketContext: no pool row for market ${args.marketId} with a held position`,
				);
			}
			const sell = computeSell({
				reserves: { yes: pool.yesReserves, no: pool.noReserves },
				side: held.side === "YES" ? "yes" : "no",
				shares: held.quantity,
			});
			position = {
				side: held.side,
				quantity: held.quantity,
				currentValue: sell.proceeds,
			};
		}

		return { position, balance, spendableToday };
	});
}
