import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// AUDIT-FIX-B2 (Test/detector strategy iii) — closes the AUDIT-FIX-B1 loop
// end-to-end: detector (0011/0015 check_nightly_drift) → cron_alarms →
// drainCronAlarms → Sentry emit + processed_at stamp, proven on a seeded
// A2-shaped fork. A pre-existing (or non-app-originated) A2 money-mint fork in
// dharma_ledger is caught out-of-band by check_nightly_drift() (derivation
// D2-A → a cron_alarms row), which drainCronAlarms() then carries to Sentry
// (emit → flush → stamp; B1 delivery-level at-least-once).
//
// EXPECTED-GREEN, NOT a RED driver: the detector (0015) and the drain are
// already live; this file is NEW coverage. The A2 fix (seq total-order) stops
// PRODUCTION of new forks — this loop is the residual safety net for pre-fix /
// non-app corruption.
//
// NEW standalone file (not an extension of nightly-drift-resolution or
// alarms-drain): the @sentry/nextjs vi.mock is module-scoped, so the drain
// half must own its file. Sentry mock preamble modeled on
// alarms-drain.integration.test.ts:19-67; ledger seed helpers modeled on
// nightly-drift-resolution.integration.test.ts:31-78.
//
// beforeEach/afterEach clear state via the truncateTables fixture (the A20
// teardown-adoption sweep — dharma_ledger is 0021-guarded; cron_alarms is
// unguarded but rides the same list).

const { mockCaptureMessage, mockFlush } = vi.hoisted(() => ({
	mockCaptureMessage: vi.fn(),
	mockFlush: vi.fn(),
}));
vi.mock("@sentry/nextjs", () => ({
	captureMessage: mockCaptureMessage,
	captureException: vi.fn(),
	addBreadcrumb: vi.fn(),
	flush: mockFlush,
}));

import { users } from "@/db/schema";
import { drainCronAlarms } from "@/server/observability/drain-cron-alarms";
import { testClient, testDb } from "../db/_fixtures/db";
import { truncateTables } from "../db/_fixtures/truncate";

async function seedUser(emailTag: string): Promise<string> {
	const [user] = await testDb
		.insert(users)
		.values({
			name: "Drift User",
			email: `${emailTag}@example.com`,
			pseudonym: emailTag,
		})
		.returning({ id: users.id });
	return user?.id ?? "";
}

/**
 * Direct ledger INSERT (fixture bypass — SPEC.2 §6.6): explicit column list +
 * ::dharma_entry_type cast + distinct created_at per row. bet_id stays NULL
 * (legal for fixture bet_stake rows; the drift checks never read it). The
 * checks are order-free, so created_at only keeps the history realistic.
 */
async function insertRow(
	userId: string,
	entryType: string,
	amount: string,
	balanceAfter: string,
	minuteOffset: number,
): Promise<void> {
	await testClient.unsafe(
		`INSERT INTO dharma_ledger (user_id, entry_type, amount, balance_after, created_at)
		 VALUES ($1, $2::dharma_entry_type, $3, $4, $5)`,
		[
			userId,
			entryType,
			amount,
			balanceAfter,
			new Date(
				Date.parse("2026-09-15T06:00:00Z") + minuteOffset * 60_000,
			).toISOString(),
		],
	);
}

async function insertHistory(
	userId: string,
	rows: readonly [entryType: string, amount: string, balanceAfter: string][],
): Promise<void> {
	for (const [i, [entryType, amount, balanceAfter]] of rows.entries()) {
		await insertRow(userId, entryType, amount, balanceAfter, i);
	}
}

/** Derivations of the dharma_chain_drift alarms raised for one user. */
async function derivationsFor(userId: string): Promise<string[]> {
	const rows = await testClient.unsafe(
		`SELECT payload->>'derivation' AS derivation
		 FROM cron_alarms
		 WHERE alarm_id = 'dharma_chain_drift' AND payload->>'user_id' = $1
		 ORDER BY derivation`,
		[userId],
	);
	return rows.map((r) => String(r.derivation));
}

describe("dharma-chain-drift-drain — B1 detector→drain→Sentry loop (real Postgres)", () => {
	beforeEach(async () => {
		mockCaptureMessage.mockReset();
		mockCaptureMessage.mockImplementation(() => "event-id");
		mockFlush.mockReset();
		mockFlush.mockResolvedValue(true);
		await truncateTables(testClient, ["cron_alarms", "dharma_ledger", "users"]);
	});
	afterEach(async () => {
		await truncateTables(testClient, ["cron_alarms", "dharma_ledger", "users"]);
		vi.clearAllMocks();
	});

	it("dharma-chain-drift-drain::seeded-D2A-fork-alarms-then-drains-to-sentry", async () => {
		// Seed the D2-A-visible A2 fork: [+10 → 10], [-3 → 7], [FORK -5 → 5]. The
		// fork row's implied_prev = 5 - (-5) = 10 = the STALE base (it forked off
		// the grant's balance 10, not the chain-true 7). Walked: produced
		// balances {10,7,5} vs implied_prev {0,10,10} → TWO net-+1 sinks (7 and
		// 5) → D2-A fires. D2-B stays silent (Z - L = 1: the link-set is
		// satisfied).
		const userId = await seedUser("chain-drift-drain");
		await insertHistory(userId, [
			["initial_grant", "10", "10"],
			["bet_stake", "-3", "7"],
			["bet_stake", "-5", "5"],
		]);

		await testClient.unsafe(`SELECT check_nightly_drift()`);

		// Exactly ONE alarm for this user, derivation D2-A (D2-B silent).
		expect(await derivationsFor(userId)).toEqual(["D2-A"]);

		// The drain carries it to Sentry: emit → flush(true) → stamp.
		const result = await drainCronAlarms();

		expect(mockCaptureMessage).toHaveBeenCalledWith(
			"dharma_chain_drift",
			expect.objectContaining({
				level: "error",
				tags: { alarm_id: "dharma_chain_drift" },
			}),
		);
		expect(result.stamped).toBeGreaterThanOrEqual(1);

		// The alarm row is retired: processed_at stamped when read back.
		const rows = await testClient.unsafe(
			`SELECT processed_at FROM cron_alarms
			 WHERE alarm_id = 'dharma_chain_drift' AND payload->>'user_id' = $1`,
			[userId],
		);
		expect(rows.length).toBe(1);
		expect(rows[0]?.processed_at).not.toBeNull();
	});
});
