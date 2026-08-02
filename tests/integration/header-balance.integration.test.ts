import { eq, sql } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { DbClient } from "@/db";
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
 *
 * T9 pins the FAIL-SAFE (@code-reviewer HIGH-1). This read runs in
 * `(public)/layout.tsx`, so an unhandled throw takes down every participant
 * route — a same-segment `error.tsx` cannot catch its own layout's throw, so it
 * lands on `global-error.tsx`. The two `return null`s in the module cover only
 * missing rows; the DB call itself is the likelier failure. Both statements are
 * covered, because a `try` around only the first would still let the second one
 * through — that is exactly what the second case proves.
 */

// The fail-safe reports through `safeCaptureException`; mocked so the test can
// assert it FIRED. A catch that silently fails to report is the worst of the
// three outcomes and would otherwise be indistinguishable from one that works.
// The spy lives in `vi.hoisted` because `vi.mock` factories are hoisted above
// imports and module-scope consts are in TDZ inside them (the
// `tests/unit/rate-limit-prefix.test.ts:17-19` note).
const { captureSpy } = vi.hoisted(() => ({
	captureSpy: vi.fn(() => true),
}));

vi.mock("@/server/observability/safe-capture", () => ({
	safeCaptureException: captureSpy,
}));

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

	it("reads-the-latest-row-by-seq-not-by-created-at", async () => {
		// The ADR-0029 total order, and the fixture is built so the two candidate
		// orderings DISAGREE. Rows appended in three separate statements get
		// strictly increasing `created_at`, so `seq DESC` and `created_at DESC`
		// pick the same row and the guard cannot fail — which is what made an
		// earlier version of this test vacuous. Here the chain-LATER rows are
		// backdated, so:
		//     seq DESC        → the newest chain row  → "20…"  (correct)
		//     created_at DESC → the initial_grant     → "10…"  (the drift)
		// Swap `header-balance.ts`'s `desc(dharmaLedger.seq)` for
		// `desc(dharmaLedger.createdAt)` and this test fails. That is the whole
		// point: it is the only thing standing between the replicated select and
		// silent ADR-0029/AUDIT-FIX-B2 drift.
		//
		// `created_at` is set from a SQL EXPRESSION, never a JS `Date`. postgres-js
		// floors a bound `timestamptz` parameter, so a `Date` here would collapse
		// the sub-second offsets, let the two orderings agree again, and silently
		// restore the dead guard. Do not "simplify" this back to `new Date(...)`.
		const userId = await seedUser({
			emailTag: "hb-order",
			pseudonym: "HBOrder",
			balance: "10.000000000000000000",
		});
		const backdated: [string, string][] = [
			["30.000000000000000000", "2 hours"],
			["20.000000000000000000", "1 hour"],
		];
		for (const [balanceAfter, ago] of backdated) {
			await testDb.insert(dharmaLedger).values({
				userId,
				entryType: "bet_stake",
				amount: "0.000000000000000000",
				balanceAfter,
				createdAt: sql`now() - ${sql.raw(`interval '${ago}'`)}`,
			});
		}
		await setCursor(userId, sql`now()`);

		const header = await getHeaderBalance(testDb, userId);
		const tiles = await loadProfileTiles(testDb, { userId, positions: [] });

		// seq DESC wins: the chain-latest row, despite being the OLDEST by clock.
		expect(header).toBe("20.000000000000000000");
		// `loadProfileTiles` orders by seq too, so parity holds under the same
		// disagreement — pinning both replicas of the ADR-0029 read at once.
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

const BOOM = "simulated postgres failure";

/**
 * A client whose `nth` `.select()` throws and whose other calls return a
 * working ledger chain. No DB — the point is the throw, and routing the good
 * call through `testDb` would make WHICH statement failed depend on fixture
 * state rather than on the parameter.
 */
function clientFailingOnSelect(nth: number): DbClient {
	let calls = 0;
	return {
		select() {
			calls += 1;
			if (calls === nth) {
				throw new Error(BOOM);
			}
			return {
				from: () => ({
					where: () => ({
						orderBy: () => ({
							limit: async () => [{ balanceAfter: "45.000000000000000000" }],
						}),
					}),
				}),
			};
		},
	} as unknown as DbClient;
}

describe("T9 — the fail-safe (@code-reviewer HIGH-1)", () => {
	afterEach(() => captureSpy.mockClear());

	it("returns-null-instead-of-throwing-when-the-ledger-read-fails", async () => {
		// Without the catch this REJECTS, and in `(public)/layout.tsx` a rejection
		// here replaces every participant route with `global-error.tsx`.
		await expect(
			getHeaderBalance(clientFailingOnSelect(1), "any-user-id"),
		).resolves.toBeNull();
	});

	it("also-catches-a-failure-in-the-SECOND-statement", async () => {
		// The load-bearing half: a `try` around only the first statement would
		// pass the test above and still take the app down here.
		await expect(
			getHeaderBalance(clientFailingOnSelect(2), "any-user-id"),
		).resolves.toBeNull();
	});

	it("reports-the-failure-rather-than-swallowing-it", async () => {
		await getHeaderBalance(clientFailingOnSelect(1), "any-user-id");

		expect(captureSpy).toHaveBeenCalledTimes(1);
		const [err, ctx] = captureSpy.mock.calls[0] as unknown as [
			Error,
			{ tags: { kind: string } },
		];
		expect(err.message).toBe(BOOM);
		expect(ctx.tags.kind).toBe("header_balance_read_failed");
	});

	it("does-not-report-on-the-ordinary-no-ledger-row-path", async () => {
		// T6's `null` is a legitimate state, not a failure. If the two null paths
		// were ever collapsed into the catch, every pre-grant page load would
		// emit a Sentry event.
		const userId = await seedUser({
			emailTag: "hb-quiet",
			pseudonym: "HBQuiet",
		});

		expect(await getHeaderBalance(testDb, userId)).toBeNull();
		expect(captureSpy).not.toHaveBeenCalled();
	});
});
