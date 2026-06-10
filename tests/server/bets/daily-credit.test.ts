import { and, eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ENGINE.12 T1–T5 — Daily Credit accrual, lazy, paid INSIDE the commented-bet
// tx (@docs/plans/ENGINE.12.md §"Test plan"; ADR-0018 :85 + SPEC.1 §10.4).
// Real route + real `place()` + real `runBetTransaction` against test
// Postgres :54322; externals mocked (the events-idempotency harness pattern).
//
// Contracts under test (binding, R3/R4/P1/P5):
//   T1  first commented bet of a UTC day pays the credit: ledger row
//       (entry_type=daily_allowance, bet_id NULL, amount +DAILY_CREDIT_DHARMA),
//       balances CHAIN credit→debit, cursor users.last_allowance_accrued_at
//       set to tx time, ONE dharma.credited event (aggregate dharma_account/
//       userId, payload.creditedForDate = the tx's UTC day).
//   T2  second bet same UTC day pays nothing (cursor path) — exactly ONE
//       daily_allowance row.
//   T3  THE RACE: two concurrent first-bets, DIFFERENT markets, SAME user —
//       both bets COMMIT; exactly ONE daily_allowance row TOTAL and exactly
//       ONE dharma.credited event TOTAL across BOTH places (the loser's
//       attempt rolls back; its rerun sees the cursor and skips — D-N1).
//   T4  the day's credit funds the day's first bet (post-credit pre-check):
//       balance < BET_MIN_STAKE_POST ≤ balance + credit → the bet SUCCEEDS.
//   T5  rollback purity: a post-accrual in-tx fault rolls back credit +
//       cursor + bet + comment TOGETHER — ADR-0018's "paid only on placing a
//       commented bet" enforced by atomicity, not by a check.
//
// Invariants exercised: I-DAILY-ONCE-001 (primary cursor-conflict mechanism —
// the storage-backstop twin is tests/invariants/I-DAILY-ONCE-001.*.spec.ts),
// INV-1 (credit rides the same SERIALIZABLE commented-bet tx), INV-2 (credit
// strictly positive; issuance is system→user faucet, no counterparty debit).
//
// CI-RED (DB/route-backed): local Postgres :54322 DOWN is infra-red; the
// assertion/import RED driver is the greenfield `DAILY_CREDIT_DHARMA` import
// (limits.ts does not export it yet) + the absent accrual writes.
//
// HARNESS REALIZATION (mirrors concurrency.test.ts):
//   - T3's rendezvous barrier partial-mocks `getHeldPosition` (the callback's
//     FIRST read) with a delegating wrapper that holds BOTH in-flight
//     callbacks until both have entered, then releases them together — both
//     decision reads then race ahead of either commit, forcing the users-row
//     write-write conflict (40001 → wrapper retry → rerun skips). Same
//     latch/barrier idiom as concurrency.test.ts; retried attempts pass
//     through (the barrier disarms after the second arrival).
//   - T5 reuses the events-idempotency `positionFault` vehicle (the partial
//     mock of `upsertPositionDelta`) — the SOLE fault harness — but throws a
//     TERMINAL error (no SQLSTATE → not retried) instead of a synthetic
//     40001. positions is the first spine write AFTER the accrual unit (R4
//     order: reads → accrual → positions → …), so the fault is post-accrual.
//
// Money/share values are decimal STRINGS; arithmetic via CpmmDecimal — never
// JS floats (CLAUDE.md §2).

const { mockGetSession, mockAddBreadcrumb, positionFault, raceBarrier } =
	vi.hoisted(() => ({
		mockGetSession: vi.fn(),
		mockAddBreadcrumb: vi.fn(),
		// remaining > 0 → throw; sqlstate null = TERMINAL (not retried, T5).
		positionFault: { remaining: 0, sqlstate: null as string | null },
		// T3 rendezvous: armed → first arrival waits for the second, then both
		// release together and the barrier disarms (reruns pass through).
		raceBarrier: {
			armed: false,
			arrivals: 0,
			waiters: [] as Array<() => void>,
		},
	}));

vi.mock("@sentry/nextjs", () => ({
	captureMessage: vi.fn(),
	addBreadcrumb: mockAddBreadcrumb,
	captureException: vi.fn(),
}));
vi.mock("@/server/auth", () => ({
	auth: { api: { getSession: mockGetSession } },
}));
vi.mock("@/server/middleware/origin-allowlist", () => ({
	checkOrigin: () => true,
}));
vi.mock("@/server/middleware/rate-limit", () => ({
	checkRateLimit: vi.fn(async () => ({
		allowed: true,
		remaining: 99,
		reset: 0,
	})),
	ipIdentifier: (ip: string) => ip,
}));
vi.mock("@/server/idempotency/cache", () => ({
	computeBodyFingerprint: vi.fn(async () => "fp"),
	idempotencyLookupOrReserve: vi.fn(async () => ({
		kind: "miss",
		release: vi.fn(async () => {}),
	})),
}));
vi.mock("@/server/moderation/precommit", () => ({
	precommitModerate: vi.fn(async () => ({ outcome: "pass", categories: [] })),
}));

// The injected-fault vehicle (events-idempotency precedent): wrap the FIRST
// spine write so it can throw before delegating. T5 throws a TERMINAL error
// (no SQLSTATE) so the wrapper does NOT retry — the whole tx rolls back.
vi.mock("@/server/positions/persist", async (importOriginal) => {
	const actual =
		await importOriginal<typeof import("@/server/positions/persist")>();
	return {
		...actual,
		upsertPositionDelta: vi.fn(
			async (...args: Parameters<typeof actual.upsertPositionDelta>) => {
				if (positionFault.remaining > 0) {
					positionFault.remaining -= 1;
					if (positionFault.sqlstate !== null) {
						throw Object.assign(new Error("serialization_failure"), {
							code: positionFault.sqlstate,
						});
					}
					throw new Error("injected post-accrual fault (T5)");
				}
				return actual.upsertPositionDelta(...args);
			},
		),
	};
});

// The T3 rendezvous barrier: a delegating wrapper around the callback's FIRST
// read. NOT a fault — a concurrency latch (concurrency.test.ts idiom).
vi.mock("@/server/positions/read", async (importOriginal) => {
	const actual =
		await importOriginal<typeof import("@/server/positions/read")>();
	return {
		...actual,
		getHeldPosition: vi.fn(
			async (...args: Parameters<typeof actual.getHeldPosition>) => {
				if (raceBarrier.armed) {
					raceBarrier.arrivals += 1;
					if (raceBarrier.arrivals >= 2) {
						// Second arrival: release everyone, disarm (reruns pass through).
						raceBarrier.armed = false;
						for (const release of raceBarrier.waiters) release();
						raceBarrier.waiters = [];
					} else {
						await new Promise<void>((resolve) => {
							raceBarrier.waiters.push(resolve);
						});
					}
				}
				return actual.getHeldPosition(...args);
			},
		),
	};
});

import { POST as placePOST } from "@/app/api/bets/place/route";
import {
	bets,
	comments,
	dharmaLedger,
	events,
	markets,
	pools,
	positions,
	users,
} from "@/db/schema";
// GREENFIELD IMPORT (the RED driver): DAILY_CREDIT_DHARMA lands with
// ENGINE.12 (P3). Imported — never a literal "10" — so these tests track the
// HARDEN.5 number-tuning pass.
import {
	BET_MIN_STAKE_POST,
	DAILY_CREDIT_DHARMA,
} from "@/server/config/limits";
import { CpmmDecimal } from "@/server/cpmm/decimal";
import { getHeldPosition } from "@/server/positions/read";

import { testClient, testDb } from "../../db/_fixtures/db";

const SEED_RESERVES = "100.000000000000000000";
const GRANT = "1000";

function req(body: unknown, idempotencyKey: string) {
	return new Request("https://prd.example.com/api/bets/place", {
		method: "POST",
		headers: {
			"content-type": "application/json",
			origin: "https://prd.example.com",
			"Idempotency-Key": idempotencyKey,
			"x-forwarded-for": "203.0.113.25",
		},
		body: JSON.stringify(body),
	});
}

async function seedUser(emailTag: string, pseudonym: string): Promise<string> {
	const [user] = await testDb
		.insert(users)
		.values({
			name: "Daily-Credit User",
			email: `${emailTag}@example.com`,
			pseudonym,
			tosAcceptedAt: new Date("2026-01-01T00:00:00Z"),
		})
		.returning({ id: users.id });
	return user?.id ?? "";
}

async function seedOpenMarketWithPool(slug: string): Promise<string> {
	const [market] = await testDb
		.insert(markets)
		.values({
			slug,
			title: "Daily-Credit Market",
			status: "Open",
			resolutionDeadline: new Date("2027-01-01T00:00:00Z"),
		})
		.returning({ id: markets.id });
	const marketId = market?.id ?? "";
	await testDb.insert(pools).values({
		marketId,
		yesReserves: SEED_RESERVES,
		noReserves: SEED_RESERVES,
	});
	return marketId;
}

async function seedDharmaGrant(userId: string, amount: string): Promise<void> {
	const { appendLedgerRow } = await import("@/server/dharma/persist");
	await testDb.transaction((tx) =>
		appendLedgerRow(tx, { userId, amount, entryType: "initial_grant" }),
	);
}

/** UTC calendar day of a DB-sourced timestamp (both operands DB-sourced — the single-clock rule holds). */
function utcDay(d: Date): string {
	return d.toISOString().slice(0, 10);
}

async function readLedger(userId: string) {
	return testDb
		.select({
			entryType: dharmaLedger.entryType,
			amount: dharmaLedger.amount,
			balanceAfter: dharmaLedger.balanceAfter,
			betId: dharmaLedger.betId,
			createdAt: dharmaLedger.createdAt,
		})
		.from(dharmaLedger)
		.where(eq(dharmaLedger.userId, userId));
}

async function readCursor(userId: string): Promise<Date | null> {
	const rows = await testDb
		.select({ lastAllowanceAccruedAt: users.lastAllowanceAccruedAt })
		.from(users)
		.where(eq(users.id, userId));
	return rows[0]?.lastAllowanceAccruedAt ?? null;
}

async function readCreditEvents() {
	return testDb
		.select({
			eventId: events.eventId,
			aggregateType: events.aggregateType,
			aggregateId: events.aggregateId,
			payload: events.payload,
			createdAt: events.createdAt,
		})
		.from(events)
		.where(eq(events.eventType, "dharma.credited"));
}

describe("ENGINE.12 Daily Credit — lazy accrual inside the commented-bet tx", () => {
	beforeEach(() => {
		positionFault.remaining = 0;
		positionFault.sqlstate = null;
		raceBarrier.armed = false;
		raceBarrier.arrivals = 0;
		raceBarrier.waiters = [];
		vi.clearAllMocks();
	});
	afterEach(async () => {
		await testClient.unsafe(
			`TRUNCATE events, dharma_ledger, bets, comments, positions, pools, markets, users CASCADE`,
		);
	});

	it("bet-place::first-commented-bet-of-day-pays-daily-credit [T1]", async () => {
		const userId = await seedUser("dc-first", "dc-first");
		const marketId = await seedOpenMarketWithPool("dc-first-market");
		await seedDharmaGrant(userId, GRANT);
		mockGetSession.mockResolvedValue({ user: { id: userId } });

		const res = await placePOST(
			req(
				{ marketId, side: "YES", stake: "10", body: "first bet of the day" },
				"dc-first-key",
			),
		);
		expect(res.status).toBe(200);

		// Ledger: grant + daily_allowance credit + bet_stake debit — 3 rows.
		const ledgerRows = await readLedger(userId);
		expect(ledgerRows.length).toBe(3);

		// Credit row: entry_type daily_allowance, bet_id NULL (P2 — issuance row,
		// excluded from the FLOW_TAGS gathering), amount = +DAILY_CREDIT_DHARMA.
		const creditRow = ledgerRows.find((r) => r.entryType === "daily_allowance");
		expect(creditRow).toBeDefined();
		expect(creditRow?.betId).toBeNull();
		expect(creditRow?.amount).toBe(
			new CpmmDecimal(DAILY_CREDIT_DHARMA).toFixed(18),
		);
		expect(creditRow?.balanceAfter).toBe(
			new CpmmDecimal(GRANT).plus(DAILY_CREDIT_DHARMA).toFixed(18),
		);

		// Debit row exists AND CHAINS off the credit (persist.ts:58-62 — the
		// REQUIRED same-user multi-row chaining): the debit's implied
		// previous_balance (balance_after − amount; amount is negative) equals
		// the credit's balance_after EXACTLY.
		const stakeRow = ledgerRows.find((r) => r.entryType === "bet_stake");
		expect(stakeRow).toBeDefined();
		expect(stakeRow?.balanceAfter).toBe(
			new CpmmDecimal(GRANT).plus(DAILY_CREDIT_DHARMA).minus("10").toFixed(18),
		);
		expect(
			new CpmmDecimal(stakeRow?.balanceAfter ?? "0")
				.minus(stakeRow?.amount ?? "0")
				.toFixed(18),
		).toBe(creditRow?.balanceAfter);

		// Cursor set to the tx clock: R3's single-day-authority pin — the cursor
		// (SET now()) and the credit row's created_at (DEFAULT now()) derive from
		// the SAME tx-frozen now(), so they are EQUAL, and share the UTC day.
		const cursor = await readCursor(userId);
		expect(cursor).not.toBeNull();
		expect(cursor?.getTime()).toBe(creditRow?.createdAt.getTime());
		expect(utcDay(cursor ?? new Date(0))).toBe(
			utcDay(creditRow?.createdAt ?? new Date(0)),
		);

		// Exactly ONE dharma.credited event — aggregate dharma_account / userId
		// (ENGINE.0 plan :73); payload per schemas.ts:239-245.
		const creditEvents = await readCreditEvents();
		expect(creditEvents.length).toBe(1);
		expect(creditEvents[0]?.aggregateType).toBe("dharma_account");
		expect(creditEvents[0]?.aggregateId).toBe(userId);
		// `as` at the trust boundary (DB jsonb) — shape pinned by the registered
		// payload schema (schemas.ts:239-245).
		const payload = creditEvents[0]?.payload as {
			userId?: string;
			amount?: string;
			creditedForDate?: string;
		};
		expect(payload.userId).toBe(userId);
		// Value equality, format-agnostic (the payload may carry the raw
		// constant or its 18-dp canonical form).
		expect(
			new CpmmDecimal(payload.amount ?? "0").equals(DAILY_CREDIT_DHARMA),
		).toBe(true);
		// creditedForDate = the COMMITTING tx's UTC day (R3 clock note) — the
		// cursor is that same tx clock.
		expect(payload.creditedForDate).toBe(utcDay(cursor ?? new Date(0)));

		// The bet-flow events still ride alongside (per-place counts stable).
		const betEvents = await testDb
			.select({ eventType: events.eventType })
			.from(events)
			.where(eq(events.eventType, "bet.placed"));
		const commentEvents = await testDb
			.select({ eventType: events.eventType })
			.from(events)
			.where(eq(events.eventType, "comment.placed"));
		expect(betEvents.length).toBe(1);
		expect(commentEvents.length).toBe(1);
	});

	it("bet-place::second-bet-same-utc-day-pays-nothing [T2]", async () => {
		const userId = await seedUser("dc-second", "dc-second");
		const marketId = await seedOpenMarketWithPool("dc-second-market");
		await seedDharmaGrant(userId, GRANT);
		mockGetSession.mockResolvedValue({ user: { id: userId } });

		const first = await placePOST(
			req(
				{ marketId, side: "YES", stake: "10", body: "first bet pays" },
				"dc-second-key-1",
			),
		);
		expect(first.status).toBe(200);
		const second = await placePOST(
			req(
				{ marketId, side: "YES", stake: "10", body: "second bet skips" },
				"dc-second-key-2",
			),
		);
		expect(second.status).toBe(200);

		// Exactly ONE daily_allowance row — the cursor path skipped the second.
		const ledgerRows = await readLedger(userId);
		const creditRows = ledgerRows.filter(
			(r) => r.entryType === "daily_allowance",
		);
		expect(creditRows.length).toBe(1);
		// grant + credit + two debits.
		expect(ledgerRows.length).toBe(4);

		// Both debits chained correctly: balances after stake 1 and stake 2.
		const stakeBalances = ledgerRows
			.filter((r) => r.entryType === "bet_stake")
			.map((r) => r.balanceAfter);
		expect(stakeBalances).toContain(
			new CpmmDecimal(GRANT).plus(DAILY_CREDIT_DHARMA).minus("10").toFixed(18),
		);
		expect(stakeBalances).toContain(
			new CpmmDecimal(GRANT).plus(DAILY_CREDIT_DHARMA).minus("20").toFixed(18),
		);

		// Exactly ONE dharma.credited event.
		expect((await readCreditEvents()).length).toBe(1);

		// Cursor still the FIRST tx's accrual instant (same UTC day as the
		// credit row — the already-paid day is a PURE READ, no users write).
		const cursor = await readCursor(userId);
		expect(cursor).not.toBeNull();
		expect(cursor?.getTime()).toBe(creditRows[0]?.createdAt.getTime());
	});

	it("bet-place::concurrent-first-bets-pay-exactly-once [T3 — THE RACE]", async () => {
		const userId = await seedUser("dc-race", "dc-race");
		const marketA = await seedOpenMarketWithPool("dc-race-market-a");
		const marketB = await seedOpenMarketWithPool("dc-race-market-b");
		await seedDharmaGrant(userId, GRANT);
		mockGetSession.mockResolvedValue({ user: { id: userId } });

		// Arm the rendezvous: both callbacks rendezvous at their FIRST read, so
		// both decision reads run ahead of either commit — the loser's cursor
		// UPDATE then hits the users-row write-write conflict (deterministically
		// 40001 per D-N1 cursor-first ordering) → wrapper retry → rerun sees the
		// cursor → skips; the bet still commits.
		raceBarrier.armed = true;

		const [resA, resB] = await Promise.all([
			placePOST(
				req(
					{
						marketId: marketA,
						side: "YES",
						stake: "10",
						body: "racing bet on market A",
					},
					"dc-race-key-a",
				),
			),
			placePOST(
				req(
					{
						marketId: marketB,
						side: "YES",
						stake: "10",
						body: "racing bet on market B",
					},
					"dc-race-key-b",
				),
			),
		]);

		// BOTH bets COMMITTED (the credit race must never fail a bet).
		expect(resA.status).toBe(200);
		expect(resB.status).toBe(200);
		const betRowsA = await testDb
			.select({ id: bets.id })
			.from(bets)
			.where(eq(bets.marketId, marketA));
		const betRowsB = await testDb
			.select({ id: bets.id })
			.from(bets)
			.where(eq(bets.marketId, marketB));
		expect(betRowsA.length).toBe(1);
		expect(betRowsB.length).toBe(1);

		// THE BINDING PIN (web CP review / F2): exactly ONE daily_allowance row
		// TOTAL and exactly ONE dharma.credited event TOTAL across BOTH places —
		// NOT one per place (the loser's writes never commit).
		const ledgerRows = await readLedger(userId);
		const creditRows = ledgerRows.filter(
			(r) => r.entryType === "daily_allowance",
		);
		expect(creditRows.length).toBe(1);
		expect((await readCreditEvents()).length).toBe(1);

		// Both stake debits committed and chained: ONE place paid (credit then
		// debit), the OTHER debited off the post-credit running balance.
		const stakeBalances = ledgerRows
			.filter((r) => r.entryType === "bet_stake")
			.map((r) => r.balanceAfter);
		expect(stakeBalances.length).toBe(2);
		expect(stakeBalances).toContain(
			new CpmmDecimal(GRANT).plus(DAILY_CREDIT_DHARMA).minus("10").toFixed(18),
		);
		expect(stakeBalances).toContain(
			new CpmmDecimal(GRANT).plus(DAILY_CREDIT_DHARMA).minus("20").toFixed(18),
		);

		// Per-place event counts stable: one bet.placed + one comment.placed per
		// committed place — no leaked duplicates from the rolled-back attempt.
		const betPlaced = await testDb
			.select({ aggregateId: events.aggregateId })
			.from(events)
			.where(eq(events.eventType, "bet.placed"));
		const commentPlaced = await testDb
			.select({ aggregateId: events.aggregateId })
			.from(events)
			.where(eq(events.eventType, "comment.placed"));
		expect(betPlaced.length).toBe(2);
		expect(commentPlaced.length).toBe(2);
		expect(new Set(betPlaced.map((e) => e.aggregateId))).toEqual(
			new Set([betRowsA[0]?.id, betRowsB[0]?.id]),
		);

		// ≥1 retry breadcrumb — DETECTOR-TOLERANT (plan F2): the wrapper emits a
		// `bet.transaction.retry` breadcrumb per retry (transaction.ts:153-158);
		// the loser's full-callback rerun is also visible as a 3rd
		// getHeldPosition invocation (2 first attempts + ≥1 rerun). Either
		// detector proves the race actually retried.
		const retryBreadcrumbs = mockAddBreadcrumb.mock.calls.filter(
			(call) =>
				(call[0] as { category?: string } | undefined)?.category ===
				"bet.transaction.retry",
		).length;
		const heldPositionCalls = vi.mocked(getHeldPosition).mock.calls.length;
		expect(retryBreadcrumbs >= 1 || heldPositionCalls >= 3).toBe(true);

		// Cursor set exactly once, to the winning tx's clock.
		const cursor = await readCursor(userId);
		expect(cursor).not.toBeNull();
		expect(cursor?.getTime()).toBe(creditRows[0]?.createdAt.getTime());
	});

	it("bet-place::credit-funds-the-post-floor [T4]", async () => {
		// ADR-0018 "one extra post-floor unit of voice per active day": seed a
		// balance strictly BELOW the post floor but within one credit of it —
		// the post-credit pre-check (R4) must let the day's first bet through.
		// Derived from the live constants so HARDEN.5 retunes keep the fixture
		// honest (asserted below).
		const floor = new CpmmDecimal(BET_MIN_STAKE_POST);
		const credit = new CpmmDecimal(DAILY_CREDIT_DHARMA);
		const overlap = credit.greaterThan(floor) ? floor : credit;
		const seedBalance = floor.minus(overlap).plus("0.5").toFixed(18);
		// Fixture preconditions: balance < floor ≤ balance + credit.
		expect(new CpmmDecimal(seedBalance).lessThan(floor)).toBe(true);
		expect(
			new CpmmDecimal(seedBalance).plus(credit).greaterThanOrEqualTo(floor),
		).toBe(true);

		const userId = await seedUser("dc-floor", "dc-floor");
		const marketId = await seedOpenMarketWithPool("dc-floor-market");
		await seedDharmaGrant(userId, seedBalance);
		mockGetSession.mockResolvedValue({ user: { id: userId } });

		const res = await placePOST(
			req(
				{
					marketId,
					side: "YES",
					stake: BET_MIN_STAKE_POST,
					body: "the daily credit funds this floor bet",
				},
				"dc-floor-key",
			),
		);
		// Pre-credit this is insufficient_dharma; post-credit it SUCCEEDS.
		expect(res.status).toBe(200);

		const ledgerRows = await readLedger(userId);
		const creditRow = ledgerRows.find((r) => r.entryType === "daily_allowance");
		expect(creditRow).toBeDefined();
		const stakeRow = ledgerRows.find((r) => r.entryType === "bet_stake");
		expect(stakeRow?.balanceAfter).toBe(
			new CpmmDecimal(seedBalance)
				.plus(DAILY_CREDIT_DHARMA)
				.minus(BET_MIN_STAKE_POST)
				.toFixed(18),
		);

		const positionRows = await testDb
			.select({ side: positions.side })
			.from(positions)
			.where(
				and(eq(positions.userId, userId), eq(positions.marketId, marketId)),
			);
		expect(positionRows.length).toBe(1);
	});

	it("bet-place::post-accrual-fault-rolls-back-credit-and-cursor [T5]", async () => {
		// F1 rollback purity, via the EXISTING injected-fault vehicle ONLY: a
		// TERMINAL (no-SQLSTATE) throw at the positions write — which runs AFTER
		// the accrual unit (R4 order) — must roll back the WHOLE tx: credit row,
		// cursor, event, bet, comment, position, pool delta. ADR-0018's "paid
		// only on placing a commented bet" is delivered by atomicity. (A crafted
		// overdraft is impossible here: the post-credit pre-check guarantees
		// stake ≤ balance, so the debit's CHECK is unreachable — the pre-check
		// is load-bearing.)
		const userId = await seedUser("dc-fault", "dc-fault");
		const marketId = await seedOpenMarketWithPool("dc-fault-market");
		await seedDharmaGrant(userId, GRANT);
		mockGetSession.mockResolvedValue({ user: { id: userId } });

		// Terminal on EVERY attempt (sqlstate null → not retried; the budget
		// guard is belt-and-braces).
		positionFault.remaining = 99;

		const res = await placePOST(
			req(
				{ marketId, side: "YES", stake: "10", body: "this tx will fault" },
				"dc-fault-key",
			),
		);
		// An uncaught in-tx fault surfaces as a 5xx (toWireError fallback) and
		// is NOT cached (release(null)) — the wire detail is ENGINE.8's; the
		// load-bearing assertion here is the DB post-state.
		expect(res.status).toBeGreaterThanOrEqual(500);
		// The fault actually fired (guards a silently no-op'd vehicle).
		const { upsertPositionDelta } = await import("@/server/positions/persist");
		expect(vi.mocked(upsertPositionDelta).mock.calls.length).toBeGreaterThan(0);

		// NO credit row persisted; ledger holds ONLY the seed grant.
		const ledgerRows = await readLedger(userId);
		expect(ledgerRows.length).toBe(1);
		expect(ledgerRows[0]?.entryType).toBe("initial_grant");

		// Cursor UNTOUCHED — still NULL (never paid).
		expect(await readCursor(userId)).toBeNull();

		// No dharma.credited event; no bet/comment/position; pool unchanged.
		expect((await readCreditEvents()).length).toBe(0);
		const betRows = await testDb
			.select({ id: bets.id })
			.from(bets)
			.where(eq(bets.marketId, marketId));
		expect(betRows.length).toBe(0);
		const commentRows = await testDb
			.select({ id: comments.id })
			.from(comments)
			.where(eq(comments.marketId, marketId));
		expect(commentRows.length).toBe(0);
		const positionRows = await testDb
			.select({ id: positions.id })
			.from(positions)
			.where(eq(positions.marketId, marketId));
		expect(positionRows.length).toBe(0);
		const [poolRow] = await testDb
			.select({ yesReserves: pools.yesReserves })
			.from(pools)
			.where(eq(pools.marketId, marketId));
		expect(poolRow?.yesReserves).toBe(SEED_RESERVES);
	});
});
