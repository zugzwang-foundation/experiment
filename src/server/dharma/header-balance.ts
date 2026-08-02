// SPDX-License-Identifier: AGPL-3.0-or-later

import "server-only";

import { desc, eq, sql } from "drizzle-orm";

import type { DbClient } from "@/db";
import { dharmaLedger, users } from "@/db/schema";
import { CpmmDecimal, toFixed18 } from "@/server/cpmm/decimal";
import { computeSpendableToday } from "@/server/debate-view/viewer-context";

/**
 * The header Đ figure: SPENDABLE TODAY for one user, or `null` when they have
 * no `dharma_ledger` row yet. Display-grade read — no write, no engine contact,
 * no transaction.
 *
 * SPENDABLE, NOT RAW BALANCE, and the harm forces it. `computeSpendableToday`
 * adds `DAILY_CREDIT_DHARMA` on a day the user has not yet been paid, because
 * the place path pays the day's credit BEFORE the affordability check. With the
 * Đ 50 reply floor, a participant holding Đ 45 raw who has not bet today can
 * spend Đ 55 — they are NOT dead-ended, and a raw-balance header would tell
 * them they are. A header that UNDERSTATES capacity causes inaction; worse, it
 * creates the inversion where the composer accepts a bet larger than the header
 * implies.
 *
 * ACCEPTED CROSS-SURFACE PROPERTY: the profile `Wallet value` tile renders the
 * RAW ledger balance, so the same user at the same instant sees Đ N on their
 * profile and Đ N+10 in the header on any unclaimed day. Both are true and they
 * measure different things — ledger state versus committable capacity, the same
 * relation as a bank balance versus available credit. The distinct labels carry
 * the distinction; no reconciliation is attempted here.
 *
 * TWO STATEMENTS, NOT A TRANSACTION. `readBalance` (`persist.ts:49`) takes a
 * `DbTransaction` deliberately — `persist.ts:53` notes it is a "compile-error to
 * pass top-level `db`", guarding read-then-append atomicity. Widening it to
 * `DbClient` would erode that compile-time guard for every caller, and wrapping
 * this in `client.transaction(...)` would spend a BEGIN/COMMIT on every request
 * of every layout-bearing route to read one indexed row. So the six-line select
 * is REPLICATED at the exact `tiles.ts:48–53` shape, whose own comment states
 * the same rationale: "`readBalance` authority, replicated to stay a pure
 * non-transactional read here." The invariant ADR-0029 protects is the
 * `ORDER BY seq DESC LIMIT 1` total order, not function identity. T5a pins the
 * replica against `loadProfileTiles` — the only layer where that drift can
 * appear.
 *
 * The `.mapWith(users.lastAllowanceAccruedAt)` on the `now()` fragment is
 * LOAD-BEARING and copied verbatim from `viewer-context.ts:118–124`: a bare
 * `sql` fragment has no runtime `Date` decoder, so the value would arrive as a
 * wire string and the day comparison would silently misbehave. `tsc` cannot
 * catch it.
 *
 * `computeSpendableToday` is IMPORTED, never re-implemented — it and
 * `accrueDailyCredit` share `utcDayOf`, which is what keeps the preview and the
 * real accrual from drifting apart.
 */
export async function getHeaderBalance(
	client: DbClient,
	userId: string,
): Promise<string | null> {
	// The ADR-0029 total-order read (`tiles.ts:48–53` shape).
	const balanceRows = await client
		.select({ balanceAfter: dharmaLedger.balanceAfter })
		.from(dharmaLedger)
		.where(eq(dharmaLedger.userId, userId))
		.orderBy(desc(dharmaLedger.seq))
		.limit(1);

	const latest = balanceRows[0];
	if (latest === undefined) {
		// No ledger row yet (pre-grant / mid-signup). The cluster renders nothing
		// rather than a misleading Đ 0 — an absent figure reads as "not yet",
		// a zero reads as "you are broke".
		return null;
	}

	// The cursor + the DB clock in ONE statement (`viewer-context.ts:118–124`).
	const cursorRows = await client
		.select({
			cursor: users.lastAllowanceAccruedAt,
			dbNow: sql`now()`.mapWith(users.lastAllowanceAccruedAt),
		})
		.from(users)
		.where(eq(users.id, userId));

	const cursorRow = cursorRows[0];
	if (cursorRow === undefined) {
		// Unreachable via the layouts (the user id is session-vouched, and a
		// ledger row implies the `users` row by FK). Unlike
		// `loadViewerMarketContext`, which throws here, this is chrome on all
		// seven participant routes — degrading to "render nothing" is strictly
		// better than 500-ing every page.
		return null;
	}

	// Re-normalize to the 18-dp canonical form, matching `tiles.ts` byte for
	// byte so T5a's parity assertion is meaningful.
	return computeSpendableToday({
		balance: toFixed18(new CpmmDecimal(latest.balanceAfter)),
		cursor: cursorRow.cursor,
		now: cursorRow.dbNow,
	});
}
