import { eq, sql } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";

import { dharmaLedger, users } from "@/db/schema";
import { DAILY_CREDIT_DHARMA } from "@/server/config/limits";
import { CpmmDecimal, toFixed18 } from "@/server/cpmm/decimal";
import { computeSpendableToday } from "@/server/debate-view/viewer-context";
import { getHeaderBalance } from "@/server/dharma/header-balance";
import { loadProfileTiles } from "@/server/profile/tiles";

import { testClient, testDb } from "../db/_fixtures/db";
import { truncateTables } from "../db/_fixtures/truncate";

/**
 * T5a / T5b / T6 (SHELL-COMPLETE §7) — the header Đ read.
 *
 * T5a pins the DUPLICATED ledger select. `header-balance.ts` replicates the
 * `tiles.ts:48–53` shape rather than calling `readBalance` (which takes a
 * `DbTransaction` deliberately — widening it to `DbClient` would erode the
 * `persist.ts:53` compile-time guard for every caller) or paying a
 * BEGIN/COMMIT on every layout render. The invariant ADR-0029 protects is the
 * `ORDER BY seq DESC LIMIT 1` total order, and the replicated select is the
 * ONLY layer where drift from it can appear — so it is pinned against
 * `loadProfileTiles`, byte for byte.
 *
 * T5b pins the COMPOSITION against the imported `computeSpendableToday` across
 * all three cursor states. It also exercises the `.mapWith()` on the `now()`
 * fragment: a bare `sql` fragment has no runtime `Date` decoder, so without it
 * the clock arrives as a wire string and the UTC-day comparison misbehaves —
 * `tsc` cannot catch that, only a real-DB run can.
 *
 * T6 pins the null path: no `dharma_ledger` row → `null`.
 */

const TABLES = ["dharma_ledger", "users"] as const;

afterEach(async () => {
	await truncateTables(testClient, [...TABLES]);
});

async function seedUser(args: {
	emailTag: string;
	pseudonym: string;
	balance?: string;
}): Promise<string> {
	const [user] = await testDb
		.insert(users)
		.values({
			name: "Header Balance User",
			email: `${args.emailTag}@example.com`,
			pseudonym: args.pseudonym,
		})
		.returning({ id: users.id });
	const userId = user?.id ?? "";

	if (args.balance !== undefined) {
		await testDb.insert(dharmaLedger).values({
			userId,
			entryType: "initial_grant",
			amount: args.balance,
			balanceAfter: args.balance,
		});
	}
	return userId;
}

/** Set the accrual cursor from the DB's OWN clock — never the JS clock, so the
 *  "today" case cannot race a midnight-UTC boundary. */
async function setCursor(userId: string, expr: ReturnType<typeof sql>) {
	await testDb
		.update(users)
		.set({ lastAllowanceAccruedAt: expr })
		.where(eq(users.id, userId));
}

describe("T5a — ledger sub-read parity with loadProfileTiles", () => {
	it("matches-the-profile-wallet-value-byte-for-byte", async () => {
		const userId = await seedUser({
			emailTag: "hb-parity",
			pseudonym: "HBParity",
			balance: "45.500000000000000000",
		});
		// Cursor = TODAY, so `computeSpendableToday` passes the balance through
		// unchanged and `getHeaderBalance` reduces to exactly the raw sub-read.
		// That is what lets the public one-export API pin the replicated select.
		await setCursor(userId, sql`now()`);

		const header = await getHeaderBalance(testDb, userId);
		const tiles = await loadProfileTiles(testDb, { userId, positions: [] });

		expect(header).toBe(tiles.walletValue);
		expect(header).toBe("45.500000000000000000");
	});

	it("reads-the-latest-row-by-seq-not-by-insert-luck", async () => {
		// The ADR-0029 total order. Three appends; the LAST by seq wins.
		const userId = await seedUser({
			emailTag: "hb-order",
			pseudonym: "HBOrder",
			balance: "10.000000000000000000",
		});
		for (const balance of ["30.000000000000000000", "20.000000000000000000"]) {
			await testDb.insert(dharmaLedger).values({
				userId,
				entryType: "bet_stake",
				amount: "0.000000000000000000",
				balanceAfter: balance,
			});
		}
		await setCursor(userId, sql`now()`);

		const header = await getHeaderBalance(testDb, userId);
		const tiles = await loadProfileTiles(testDb, { userId, positions: [] });

		expect(header).toBe("20.000000000000000000");
		expect(header).toBe(tiles.walletValue);
	});
});

describe("T5b — composition equals computeSpendableToday", () => {
	const RAW = "45.000000000000000000";

	it("null-cursor-adds-the-daily-credit", async () => {
		const userId = await seedUser({
			emailTag: "hb-null",
			pseudonym: "HBNull",
			balance: RAW,
		});
		// `users.last_allowance_accrued_at` is nullable with no default, so a
		// fresh user is always unpaid.
		const header = await getHeaderBalance(testDb, userId);

		expect(header).toBe(
			computeSpendableToday({ balance: RAW, cursor: null, now: new Date() }),
		);
		expect(header).toBe(
			toFixed18(new CpmmDecimal(RAW).plus(DAILY_CREDIT_DHARMA)),
		);
	});

	it("prior-utc-day-cursor-adds-the-daily-credit", async () => {
		const userId = await seedUser({
			emailTag: "hb-prior",
			pseudonym: "HBPrior",
			balance: RAW,
		});
		await setCursor(userId, sql`now() - interval '2 days'`);

		const header = await getHeaderBalance(testDb, userId);

		expect(header).toBe(
			toFixed18(new CpmmDecimal(RAW).plus(DAILY_CREDIT_DHARMA)),
		);
	});

	it("cursor-today-passes-the-balance-through", async () => {
		const userId = await seedUser({
			emailTag: "hb-today",
			pseudonym: "HBToday",
			balance: RAW,
		});
		await setCursor(userId, sql`now()`);

		const header = await getHeaderBalance(testDb, userId);

		expect(header).toBe(RAW);
	});

	it("decodes-the-db-clock-as-a-date-not-a-wire-string", async () => {
		// The `.mapWith()` guard (risk 7). If the `now()` fragment lost its
		// decoder, `utcDayOf(now)` would receive a string and the paid/unpaid
		// split would stop tracking the real UTC day. A cursor set to the DB's
		// own "now" MUST read as paid; one two days back MUST read as unpaid.
		// These two cases can only both hold if the clock decoded correctly.
		const paid = await seedUser({
			emailTag: "hb-clock-paid",
			pseudonym: "HBClockPaid",
			balance: RAW,
		});
		await setCursor(paid, sql`now()`);

		const unpaid = await seedUser({
			emailTag: "hb-clock-unpaid",
			pseudonym: "HBClockUnpaid",
			balance: RAW,
		});
		await setCursor(unpaid, sql`now() - interval '2 days'`);

		expect(await getHeaderBalance(testDb, paid)).toBe(RAW);
		expect(await getHeaderBalance(testDb, unpaid)).not.toBe(RAW);
	});
});

describe("T6 — the null path", () => {
	it("returns-null-when-the-user-has-no-ledger-row", async () => {
		const userId = await seedUser({
			emailTag: "hb-none",
			pseudonym: "HBNone",
		});

		expect(await getHeaderBalance(testDb, userId)).toBeNull();
	});
});
