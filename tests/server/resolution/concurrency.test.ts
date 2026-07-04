import { and, eq } from "drizzle-orm";
import { v7 as uuidv7 } from "uuid";
import { afterEach, describe, expect, it, vi } from "vitest";

const { mockCaptureMessage, mockAddBreadcrumb, mockCaptureException } =
	vi.hoisted(() => ({
		mockCaptureMessage: vi.fn(),
		mockAddBreadcrumb: vi.fn(),
		mockCaptureException: vi.fn(),
	}));

vi.mock("@sentry/nextjs", () => ({
	captureMessage: mockCaptureMessage,
	addBreadcrumb: mockAddBreadcrumb,
	captureException: mockCaptureException,
}));

import {
	bets,
	dharmaLedger,
	markets,
	payoutEvents,
	pools,
	users,
} from "@/db/schema";
import { place } from "@/server/bets/place";
import { runBetTransaction } from "@/server/bets/transaction";
import { CpmmDecimal } from "@/server/cpmm/decimal";
import {
	ResolutionSerializationExhaustedError,
	ResolutionStateError,
} from "@/server/resolution/errors";
import { settleMarket } from "@/server/resolution/settle";
import { runResolutionTransaction } from "@/server/resolution/transaction";
import { voidMarket } from "@/server/resolution/void";

import { testClient, testDb } from "../../db/_fixtures/db";
import { truncateTables } from "../../db/_fixtures/truncate";

// ENGINE.9 §5.6 tests-first (S6, plan §Test plan) — the W-3 vs W-1 fences.
// Greenfield value imports from `@/server/resolution/{transaction,settle,
// void,errors}` RED at collection until ENGINE.9 lands. DB-BACKED.
//
// Concurrency harness (the ENGINE.7 concurrency.test.ts precedent): vitest
// runs fileParallelism:false, so every concurrent scenario is built WITHIN a
// single test via in-flight promises. The wrapper's `@/db` pool (max:10)
// gives genuine multi-connection concurrency.
//
// Fences under test (plan §Wrapper a/b):
//   - W-3 locks markets FIRST then pools, consuming the slot W-1 reserved
//     (W-1 never locks markets) — no opposite-order pair exists, so
//     cross-wrapper contention is retryable 40001, never 40P01;
//   - void-on-Open races live bets: the pool lock is the fence — every
//     refunded-bet set is exactly the committed set under the lock; a bet
//     can NEVER commit unrefunded after void commits;
//   - clean concurrent settle×2 on ONE market: the markets lock + state gate
//     serialize them — exactly one wins, the loser sees
//     ResolutionStateError; the OQ-7 terminal-once index NEVER surfaces a
//     23505 (belt-vs-bugs stays silent);
//   - exhaustion mints ResolutionSerializationExhaustedError carrying
//     { sqlstate, flow } + the alarm captureMessage.

const SEED = "100.000000000000000000";
const REASON = "Concurrency fixture reason.";

function adminMetadata(flowId: string) {
	return {
		request_id: "test-resolution-concurrency",
		flow_id: flowId,
		user_id: null,
		actor_id: "admin-singleton",
		idempotency_key: null,
		ip: "test",
		user_agent: "vitest",
	};
}

function userMetadata(userId: string) {
	return {
		request_id: "test-concurrency-fixture",
		flow_id: "F-BET-1",
		user_id: userId,
		actor_id: userId,
		idempotency_key: null,
		ip: "test",
		user_agent: "vitest",
	};
}

async function seedUser(emailTag: string): Promise<string> {
	const [user] = await testDb
		.insert(users)
		.values({
			name: "Concurrency User",
			email: `${emailTag}@example.com`,
			pseudonym: emailTag,
			tosAcceptedAt: new Date("2026-01-01T00:00:00Z"),
			lastAllowanceAccruedAt: new Date(), // suppress the Daily Credit
		})
		.returning({ id: users.id });
	const userId = user?.id ?? "";
	const { appendLedgerRow } = await import("@/server/dharma/persist");
	await testDb.transaction((tx) =>
		appendLedgerRow(tx, { userId, amount: "1000", entryType: "initial_grant" }),
	);
	return userId;
}

async function seedMarketWithPool(
	slug: string,
	status: "Open" | "Closed" | "Resolving",
): Promise<string> {
	const [market] = await testDb
		.insert(markets)
		.values({
			slug,
			title: "Concurrency Market",
			status,
			resolutionDeadline: new Date("2026-11-01T00:00:00Z"),
		})
		.returning({ id: markets.id });
	const marketId = market?.id ?? "";
	await testDb.insert(pools).values({
		marketId,
		yesReserves: SEED,
		noReserves: SEED,
	});
	return marketId;
}

function placeBet(args: {
	userId: string;
	marketId: string;
	side: "YES" | "NO";
	stake: string;
}): Promise<string> {
	return runBetTransaction(
		{ marketId: args.marketId, flow: "F-BET-1" },
		(ctx) =>
			place(ctx, {
				userId: args.userId,
				marketId: args.marketId,
				side: args.side,
				stake: args.stake,
				body: `concurrency argument ${uuidv7()}`,
				parentCommentId: null,
				idempotencyKey: uuidv7(),
				betEventId: uuidv7(),
				commentEventId: uuidv7(),
				creditEventId: uuidv7(),
				metadata: userMetadata(args.userId),
			}),
	).then((r) => r.betId);
}

async function setResolving(marketId: string): Promise<void> {
	await testClient.unsafe(
		`UPDATE markets SET status = 'Resolving' WHERE id = $1`,
		[marketId],
	);
}

/** SQLSTATE off an error (`.cause.code` first — the W-1 extraction shape). */
function sqlstateOf(err: unknown): string | null {
	const e = err as { code?: unknown; cause?: { code?: unknown } };
	const code = e.cause?.code ?? e.code;
	return typeof code === "string" ? code : null;
}

describe("ENGINE.9 W-3 — resolution concurrency fences", () => {
	afterEach(async () => {
		await truncateTables(testClient, [
			"events",
			"payout_events",
			"resolution_events",
			"dharma_ledger",
			"bets",
			"comments",
			"positions",
			"pools",
			"markets",
			"users",
		]);
		vi.clearAllMocks();
	});

	it("resolution-concurrency::void-on-open-vs-concurrent-place-never-strands-a-bet", async () => {
		// The §Wrapper (b) fence: void on an OPEN market races a live
		// place(). Legal outcomes are EXACTLY two: (1) the bet committed
		// first → it is INSIDE void's refunded set; (2) void committed
		// first → the bet is rejected (gate after retry). An unrefunded
		// committed bet is the broken-fence state and must be impossible.
		const userV = await seedUser("conc-void-bettor");
		const marketId = await seedMarketWithPool("conc-void-race", "Open");

		const [placeOutcome, voidOutcome] = await Promise.allSettled([
			placeBet({ userId: userV, marketId, side: "YES", stake: "10" }),
			voidMarket({
				marketId,
				reason: REASON,
				voidEventId: uuidv7(),
				metadata: adminMetadata("F-RESOLVE-3"),
			}),
		]);

		// The void itself always lands (Open is its legal entry; the race
		// only reorders it against the bet).
		expect(voidOutcome.status).toBe("fulfilled");

		// Market is terminally Voided.
		const [marketRow] = await testDb
			.select({ status: markets.status })
			.from(markets)
			.where(eq(markets.id, marketId));
		expect(marketRow?.status).toBe("Voided");

		const betRows = await testDb
			.select({ id: bets.id, stake: bets.stake })
			.from(bets)
			.where(eq(bets.marketId, marketId));
		const refundRows = await testDb
			.select({ betId: payoutEvents.betId, amount: payoutEvents.amount })
			.from(payoutEvents)
			.where(
				and(
					eq(payoutEvents.marketId, marketId),
					eq(payoutEvents.payoutType, "void_refund"),
				),
			);

		if (placeOutcome.status === "fulfilled") {
			// Outcome (1): committed → refunded INSIDE void's set, full
			// stake (no sells, f = 1) — both the payout record and the
			// ledger credit exist.
			expect(betRows.length).toBe(1);
			expect(refundRows.length).toBe(1);
			expect(refundRows[0]?.betId).toBe(placeOutcome.value);
			expect(refundRows[0]?.amount).toBe("10.000000000000000000");
			const refundLedger = await testDb
				.select({ id: dharmaLedger.id })
				.from(dharmaLedger)
				.where(
					and(
						eq(dharmaLedger.userId, userV),
						eq(dharmaLedger.entryType, "void_refund"),
					),
				);
			expect(refundLedger.length).toBe(1);
		} else {
			// Outcome (2): rejected after retry — ZERO committed bets, zero
			// refund rows; the user's stake was never taken (no bet_stake
			// debit for this market's bet — the only ledger row is the
			// grant).
			expect(betRows.length).toBe(0);
			expect(refundRows.length).toBe(0);
			const ledgerRows = await testDb
				.select({ entryType: dharmaLedger.entryType })
				.from(dharmaLedger)
				.where(eq(dharmaLedger.userId, userV));
			expect(ledgerRows.map((r) => r.entryType)).toEqual(["initial_grant"]);
		}
	});

	it("resolution-concurrency::cross-market-same-user-settles-both-commit", async () => {
		// ADR-0013 §5.12 P1 shape: two W-3 settles on DIFFERENT markets hold
		// different markets/pools locks but collide on the SAME user's
		// dharma_ledger append (SSI rw-antidependency) → one side retries on
		// 40001 (consistent lock order ⇒ NEVER 40P01) and BOTH commit.
		const userU = await seedUser("conc-cross-user");
		const marketA = await seedMarketWithPool("conc-cross-a", "Open");
		const marketB = await seedMarketWithPool("conc-cross-b", "Open");
		await placeBet({
			userId: userU,
			marketId: marketA,
			side: "YES",
			stake: "100",
		});
		await placeBet({
			userId: userU,
			marketId: marketB,
			side: "YES",
			stake: "100",
		});
		await setResolving(marketA);
		await setResolving(marketB);

		const outcomes = await Promise.allSettled([
			settleMarket({
				marketId: marketA,
				winningSide: "YES",
				reason: REASON,
				settleEventId: uuidv7(),
				metadata: adminMetadata("F-RESOLVE-1"),
			}),
			settleMarket({
				marketId: marketB,
				winningSide: "YES",
				reason: REASON,
				settleEventId: uuidv7(),
				metadata: adminMetadata("F-RESOLVE-1"),
			}),
		]);

		// BOTH commit — the contention is retryable, never terminal.
		expect(outcomes.map((o) => o.status)).toEqual(["fulfilled", "fulfilled"]);

		for (const marketId of [marketA, marketB]) {
			const [row] = await testDb
				.select({ status: markets.status })
				.from(markets)
				.where(eq(markets.id, marketId));
			expect(row?.status).toBe("Resolved");
		}

		// U's payout chain is intact: two bet_payout rows (one per market,
		// 150 each — the single-bet fresh-pool buy) and the terminal balance
		// closes exactly: 1000 − 200 + 300 = 1100. A lost/duplicated retry
		// would break either the count or the sum.
		const payoutLedger = await testDb
			.select({
				amount: dharmaLedger.amount,
				balanceAfter: dharmaLedger.balanceAfter,
			})
			.from(dharmaLedger)
			.where(
				and(
					eq(dharmaLedger.userId, userU),
					eq(dharmaLedger.entryType, "bet_payout"),
				),
			);
		expect(payoutLedger.length).toBe(2);
		for (const row of payoutLedger) {
			expect(row.amount).toBe("150.000000000000000000");
		}
		const finalBalance = payoutLedger
			.map((r) => new CpmmDecimal(r.balanceAfter))
			.reduce((a, b) => (a.greaterThan(b) ? a : b))
			.toFixed(18);
		expect(finalBalance).toBe("1100.000000000000000000");
	});

	it("resolution-concurrency::settle-x2-one-market-exactly-one-wins-no-23505", async () => {
		// Clean double-settle on ONE market: the markets lock serializes
		// them; the second re-reads Resolved and fails the STATE GATE.
		// The OQ-7 terminal-once index is belt-vs-bugs ONLY — a surfaced
		// 23505 here means the gate is broken.
		const userW = await seedUser("conc-double-user");
		const marketId = await seedMarketWithPool("conc-double", "Open");
		await placeBet({ userId: userW, marketId, side: "YES", stake: "100" });
		await setResolving(marketId);

		const settleArgs = () => ({
			marketId,
			winningSide: "YES" as const,
			reason: REASON,
			settleEventId: uuidv7(),
			metadata: adminMetadata("F-RESOLVE-1"),
		});
		const outcomes = await Promise.allSettled([
			settleMarket(settleArgs()),
			settleMarket(settleArgs()),
		]);

		const fulfilled = outcomes.filter((o) => o.status === "fulfilled");
		const rejected = outcomes.filter((o) => o.status === "rejected");
		expect(fulfilled.length).toBe(1);
		expect(rejected.length).toBe(1);

		// The loser surfaces the PRODUCT error (state gate; possibly after a
		// 40001 retry) — never a unique_violation from the belt.
		const reason = (rejected[0] as PromiseRejectedResult).reason;
		expect(reason).toBeInstanceOf(ResolutionStateError);
		expect(sqlstateOf(reason)).not.toBe("23505");

		// Exactly ONE terminal row; ONE payout row; ONE ledger payout —
		// no double-settlement artifacts.
		const resolutionRows = await testClient.unsafe(
			`SELECT id FROM resolution_events WHERE market_id = $1`,
			[marketId],
		);
		expect(resolutionRows.length).toBe(1);
		const payoutRows = await testDb
			.select({ id: payoutEvents.id })
			.from(payoutEvents)
			.where(eq(payoutEvents.marketId, marketId));
		expect(payoutRows.length).toBe(1);
		const ledgerRows = await testDb
			.select({ id: dharmaLedger.id })
			.from(dharmaLedger)
			.where(
				and(
					eq(dharmaLedger.userId, userW),
					eq(dharmaLedger.entryType, "bet_payout"),
				),
			);
		expect(ledgerRows.length).toBe(1);
	});

	it("resolution-concurrency::exhaustion-mints-typed-error-with-flow-tag", async () => {
		// The retry spine's terminal path (C-3 mirror of W-1): 40001 on
		// EVERY attempt → after the budget the wrapper throws
		// ResolutionSerializationExhaustedError carrying { sqlstate, flow }
		// and fires the resolution_serialization_exhausted alarm ONCE.
		const marketId = await seedMarketWithPool("conc-exhaust", "Resolving");

		let attempts = 0;
		const caught = await runResolutionTransaction(
			{
				marketId,
				flow: "F-RESOLVE-1",
				expectedStatus: ["Resolving"],
				lockPool: true,
				statementTimeoutMs: 5_000,
			},
			async () => {
				attempts += 1;
				throw Object.assign(new Error("serialization_failure"), {
					code: "40001",
				});
			},
		).catch((e: unknown) => e);

		// Budget = 4 attempts (1 + 3 retries — the W-1 mirror).
		expect(attempts).toBe(4);
		expect(caught).toBeInstanceOf(ResolutionSerializationExhaustedError);
		const err = caught as ResolutionSerializationExhaustedError;
		expect(err.sqlstate).toBe("40001");
		expect(err.flow).toBe("F-RESOLVE-1");

		expect(mockCaptureMessage).toHaveBeenCalledTimes(1);
		expect(mockCaptureMessage.mock.calls[0]?.[0]).toBe(
			"resolution_serialization_exhausted",
		);
	});
});
