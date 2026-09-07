import { and, eq, inArray } from "drizzle-orm";
import { v7 as uuidv7 } from "uuid";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@sentry/nextjs", () => ({
	captureMessage: vi.fn(),
	addBreadcrumb: vi.fn(),
	captureException: vi.fn(),
}));

import {
	comments,
	dharmaLedger,
	events,
	markets,
	payoutEvents,
	pools,
	positions,
	resolutionEvents,
	users,
} from "@/db/schema";
import { place } from "@/server/bets/place";
import { runBetTransaction } from "@/server/bets/transaction";
import { CpmmDecimal } from "@/server/cpmm/decimal";
import { ResolutionStateError } from "@/server/resolution/errors";
import { settleMarket } from "@/server/resolution/settle";

import { testClient, testDb } from "../../db/_fixtures/db";
import { attachGenesisEvent } from "../../db/_fixtures/genesis";
import { truncateTables } from "../../db/_fixtures/truncate";

// ENGINE.9 §5.6 tests-first (S2, plan §Test plan) —
// `resolution-settles-and-locks` + the settle suite (F-RESOLVE-1, W-3b).
// Greenfield value imports from `@/server/resolution/{settle,errors}` RED at
// collection until ENGINE.9 lands. DB-BACKED (local Postgres :54322).
//
// Fixtures ride the SHIPPED bet path (runBetTransaction + place — true CPMM
// rows) so the conservation identities close exactly against real rows. The
// Daily Credit is suppressed by seeding `last_allowance_accrued_at = now()`
// (already-paid day → accrual is a pure read), keeping the ledger arithmetic
// hand-derivable. All values verified against `cpmm/calculate.ts` exactly:
//
//   Market (symmetric seed 100, k = 10⁴):
//     A buys YES 100 → 150 shares;       reserves ( 50, 200)
//     B buys NO   50 → 150 shares;       reserves (100, 100)
//     A buys YES 100 → 150 shares;       reserves ( 50, 200)
//   Positions: A 300 YES, B 150 NO. Stakes: A 200, B 50.
//   (♦) pairs = 100 + 250 = 350 = Y + H_yes = 50 + 300 = N + H_no = 200 + 150 ✓
//   Settle YES (R-9.2 gross + R-9.8 basis):
//     payouts: A per-bet 150 + 150 (Σ = position 300); B one 0-amount row.
//     unwind  = winning-side reserve Y = 50.
//     (i): 100 + 250 − 0 − 300 − 50 = 0 ✓
//   Ledger: A 1000 −100 −100 = 800; +150 → 950; +150 → 1100. B 950 (no row).

const SEED = "100.000000000000000000";
const REASON = "Criterion met: documented evidence attached.";

// LIQ-1 Phase 1 · T8b — D-14's own open (ADR-0047 §B / plan §2).
const ASYM_YES = "90000.000000000000000000";
const ASYM_NO = "10000.000000000000000000";
const ASYM_PRICE_YES = "0.100000000000000000";
const ASYM_BACKING = "90000.000000000000000000";
const ASYM_D_YES = "0.000000000000000000";
const ASYM_D_NO = "80000.000000000000000000";
const ASYM_OPENED_AT = new Date("2026-09-01T00:00:00.000Z");

function adminMetadata(flowId: string) {
	return {
		request_id: "test-resolution-settle",
		flow_id: flowId,
		user_id: null,
		actor_id: "admin-singleton",
		idempotency_key: null,
		ip: "test",
		user_agent: "vitest",
	};
}

function betMetadata(userId: string) {
	return {
		request_id: "test-resolution-fixture",
		flow_id: "F-BET-1",
		user_id: userId,
		actor_id: userId,
		idempotency_key: null,
		ip: "test",
		user_agent: "vitest",
	};
}

async function seedUser(emailTag: string, grant: string): Promise<string> {
	const [user] = await testDb
		.insert(users)
		.values({
			name: "Settle User",
			email: `${emailTag}@example.com`,
			pseudonym: emailTag,
			tosAcceptedAt: new Date("2026-01-01T00:00:00Z"),
			// Daily Credit already paid today → place()'s accrual is a pure
			// read (keeps fixture ledger arithmetic exact).
			lastAllowanceAccruedAt: new Date(),
		})
		.returning({ id: users.id });
	const userId = user?.id ?? "";
	const { appendLedgerRow } = await import("@/server/dharma/persist");
	await testDb.transaction((tx) =>
		appendLedgerRow(tx, { userId, amount: grant, entryType: "initial_grant" }),
	);
	return userId;
}

async function seedOpenMarketWithPool(slug: string): Promise<string> {
	const [market] = await testDb
		.insert(markets)
		.values({
			slug,
			title: "Settle Market",
			status: "Open",
			resolutionDeadline: new Date("2026-11-01T00:00:00Z"),
		})
		.returning({ id: markets.id });
	const marketId = market?.id ?? "";
	await testDb.insert(pools).values({
		marketId,
		yesReserves: SEED,
		noReserves: SEED,
	});
	// The genesis event a directly-inserted pool would otherwise lack.
	// `settleMarket`/`voidMarket` read the ADR-0047 discard terms from it
	// and fail closed without it — a fixture with no `market.opened` is a
	// state `openMarket` cannot produce (I-GENESIS-001).
	await attachGenesisEvent({ marketId: marketId, seedAmount: SEED });
	return marketId;
}

/** Shipped-path buy: runBetTransaction + place (the W-1 spine). */
async function placeBet(args: {
	userId: string;
	marketId: string;
	side: "YES" | "NO";
	stake: string;
}): Promise<string> {
	const result = await runBetTransaction(
		{ marketId: args.marketId, flow: "F-BET-1" },
		(ctx) =>
			place(ctx, {
				userId: args.userId,
				marketId: args.marketId,
				side: args.side,
				stake: args.stake,
				body: `fixture argument ${uuidv7()}`,
				parentCommentId: null,
				idempotencyKey: uuidv7(),
				bodyFingerprint: uuidv7(),
				betEventId: uuidv7(),
				commentEventId: uuidv7(),
				creditEventId: uuidv7(),
				metadata: betMetadata(args.userId),
			}),
	);
	return result.betId;
}

/**
 * LIQ-1 Phase 1 · T8b — an Open market opened ASYMMETRICALLY, with the
 * `market.opened` row that carries its discards. The event goes in through the
 * DRIZZLE builder, not `insertEvent`: the payload union is T2's subject
 * (`tests/server/events/insert.test.ts`), and routing this fixture through the
 * validator would red the test below for T2's reason instead of T8's.
 */
async function seedAsymmetricOpenMarket(slug: string): Promise<string> {
	const [market] = await testDb
		.insert(markets)
		.values({
			slug,
			title: "Settle Market",
			status: "Open",
			resolutionDeadline: new Date("2026-11-01T00:00:00Z"),
		})
		.returning({ id: markets.id });
	const marketId = market?.id ?? "";
	await testDb.insert(pools).values({
		marketId,
		yesReserves: ASYM_YES,
		noReserves: ASYM_NO,
	});
	// Through the shared fixture, not a fourth hand-rolled copy of the
	// payload — the helper exists so the shape has ONE maintenance site.
	await attachGenesisEvent({
		marketId,
		createdAt: ASYM_OPENED_AT,
		reserves: {
			yes: ASYM_YES,
			no: ASYM_NO,
			openingPriceYes: ASYM_PRICE_YES,
			backingMinted: ASYM_BACKING,
			discardedYes: ASYM_D_YES,
			discardedNo: ASYM_D_NO,
		},
	});
	return marketId;
}

async function setStatus(marketId: string, status: string): Promise<void> {
	await testClient.unsafe(`UPDATE markets SET status = $1 WHERE id = $2`, [
		status,
		marketId,
	]);
}

/** The S2 canonical market: A (winner, 2 YES bets) + B (loser, 1 NO bet). */
async function seedSettleScenario(slug: string): Promise<{
	marketId: string;
	userA: string;
	userB: string;
	betsA: [string, string];
	betB: string;
}> {
	const userA = await seedUser(`settle-a-${slug}`, "1000");
	const userB = await seedUser(`settle-b-${slug}`, "1000");
	const marketId = await seedOpenMarketWithPool(slug);
	const betA1 = await placeBet({
		userId: userA,
		marketId,
		side: "YES",
		stake: "100",
	});
	const betB = await placeBet({
		userId: userB,
		marketId,
		side: "NO",
		stake: "50",
	});
	const betA2 = await placeBet({
		userId: userA,
		marketId,
		side: "YES",
		stake: "100",
	});
	await setStatus(marketId, "Resolving");
	const betsA = [betA1, betA2].sort() as [string, string];
	return { marketId, userA, userB, betsA, betB };
}

describe("ENGINE.9 F-RESOLVE-1 — settleMarket (W-3b)", () => {
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

	it("resolution::resolution-settles-and-locks", async () => {
		const { marketId } = await seedSettleScenario("settle-main");
		const settleEventId = uuidv7();

		const result = await settleMarket({
			marketId,
			winningSide: "YES",
			reason: REASON,
			settleEventId,
			metadata: adminMetadata("F-RESOLVE-1"),
		});

		// Response: totalPaidOut = Σ winning-side positions = 300; unwind =
		// the winning-side reserve = 50 — which IS the identity-(i) residual:
		// seed + Σstakes − Σproceeds − Σpayouts = 100 + 250 − 0 − 300 = 50.
		expect(result.winningSide).toBe("YES");
		expect(result.resolutionEventId).toBeDefined();
		expect(new CpmmDecimal(result.totalPaidOut).equals("300")).toBe(true);
		expect(new CpmmDecimal(result.poolUnwindAmount).equals("50")).toBe(true);

		// resolution_events: exactly one row — kind resolve, outcome YES,
		// corrects NULL, reason persisted (R-9.1 NOT NULL).
		const resolutionRows = await testDb
			.select()
			.from(resolutionEvents)
			.where(eq(resolutionEvents.marketId, marketId));
		expect(resolutionRows.length).toBe(1);
		expect(resolutionRows[0]?.eventKind).toBe("resolve");
		expect(resolutionRows[0]?.outcome).toBe("YES");
		expect(resolutionRows[0]?.correctsEventId).toBeNull();
		expect(resolutionRows[0]?.reason).toBe(REASON);

		// markets: Resolved + resolved_at + resolution_outcome.
		const [marketRow] = await testDb
			.select({
				status: markets.status,
				resolvedAt: markets.resolvedAt,
				resolutionOutcome: markets.resolutionOutcome,
			})
			.from(markets)
			.where(eq(markets.id, marketId));
		expect(marketRow?.status).toBe("Resolved");
		expect(marketRow?.resolvedAt).not.toBeNull();
		expect(marketRow?.resolutionOutcome).toBe("YES");

		// Terminal emit: ONE market.resolved row with the R-9.5e
		// poolUnwindAmount payload field; admin actor.
		const eventRows = await testDb
			.select({ payload: events.payload, metadata: events.metadata })
			.from(events)
			.where(eq(events.eventType, "market.resolved"));
		expect(eventRows.length).toBe(1);
		const payload = eventRows[0]?.payload as Record<string, unknown>;
		expect(payload.marketId).toBe(marketId);
		expect(payload.winningSide).toBe("YES");
		expect(payload.resolutionNote).toBe(REASON);
		expect(new CpmmDecimal(String(payload.poolUnwindAmount)).equals("50")).toBe(
			true,
		);
		const metadata = eventRows[0]?.metadata as { actor_id?: unknown };
		expect(metadata.actor_id).toBe("admin-singleton");
	});

	it("resolution::winners-gross-per-bet-rows-with-chained-ledger", async () => {
		const { marketId, userA, betsA } = await seedSettleScenario("settle-win");

		await settleMarket({
			marketId,
			winningSide: "YES",
			reason: REASON,
			settleEventId: uuidv7(),
			metadata: adminMetadata("F-RESOLVE-1"),
		});

		// payout_events: one bet_payout row PER BET for A, gross per-bet
		// amounts 150 + 150 (R-9.2 + R-9.8 — Σ equals the position truth).
		const payoutA = await testDb
			.select({
				betId: payoutEvents.betId,
				payoutType: payoutEvents.payoutType,
				amount: payoutEvents.amount,
			})
			.from(payoutEvents)
			.where(eq(payoutEvents.userId, userA));
		expect(payoutA.length).toBe(2);
		for (const row of payoutA) {
			expect(row.payoutType).toBe("bet_payout");
			expect(row.amount).toBe("150.000000000000000000");
		}
		expect(payoutA.map((r) => r.betId).sort()).toEqual([...betsA]);

		// Ledger: one POSITIVE bet_payout row per non-zero bet, chained via
		// previousBalance (the persist.ts >1-row contract): A enters settle at
		// 800; rows land at 950 then 1100, ordered by bet id.
		const ledgerA = await testDb
			.select({
				betId: dharmaLedger.betId,
				amount: dharmaLedger.amount,
				balanceAfter: dharmaLedger.balanceAfter,
			})
			.from(dharmaLedger)
			.where(
				and(
					eq(dharmaLedger.userId, userA),
					eq(dharmaLedger.entryType, "bet_payout"),
				),
			);
		expect(ledgerA.length).toBe(2);
		const byBet = new Map(ledgerA.map((r) => [r.betId, r]));
		const first = byBet.get(betsA[0]);
		const second = byBet.get(betsA[1]);
		expect(first?.amount).toBe("150.000000000000000000");
		expect(first?.balanceAfter).toBe("950.000000000000000000");
		expect(second?.amount).toBe("150.000000000000000000");
		expect(second?.balanceAfter).toBe("1100.000000000000000000");
	});

	it("resolution::losers-get-zero-amount-payout-row-and-no-ledger-row", async () => {
		const { marketId, userB, betB } = await seedSettleScenario("settle-lose");

		await settleMarket({
			marketId,
			winningSide: "YES",
			reason: REASON,
			settleEventId: uuidv7(),
			metadata: adminMetadata("F-RESOLVE-1"),
		});

		// R-9.2: the settlement is RECORDED (one payout_events row, amount 0)
		// but NO dharma_ledger row — the −S form is struck (stake was already
		// debited at bet time; −S at resolution would double-debit).
		const payoutB = await testDb
			.select({
				betId: payoutEvents.betId,
				payoutType: payoutEvents.payoutType,
				amount: payoutEvents.amount,
			})
			.from(payoutEvents)
			.where(eq(payoutEvents.userId, userB));
		expect(payoutB.length).toBe(1);
		expect(payoutB[0]?.betId).toBe(betB);
		expect(payoutB[0]?.payoutType).toBe("bet_payout");
		expect(payoutB[0]?.amount).toBe("0.000000000000000000");

		const ledgerB = await testDb
			.select({ entryType: dharmaLedger.entryType })
			.from(dharmaLedger)
			.where(
				and(
					eq(dharmaLedger.userId, userB),
					eq(dharmaLedger.entryType, "bet_payout"),
				),
			);
		expect(ledgerB.length).toBe(0);
	});

	it("resolution::positions-pools-comments-untouched-and-no-pool-tag-ledger-rows", async () => {
		const { marketId, userA, userB } = await seedSettleScenario("settle-locks");

		// Snapshot the never-touched surfaces BEFORE settle.
		const positionsBefore = await testDb
			.select({
				id: positions.id,
				side: positions.side,
				quantity: positions.quantity,
			})
			.from(positions)
			.where(eq(positions.marketId, marketId));
		const commentsBefore = await testDb
			.select({
				id: comments.id,
				sideAtPostTime: comments.sideAtPostTime,
				body: comments.body,
			})
			.from(comments)
			.where(eq(comments.marketId, marketId));

		await settleMarket({
			marketId,
			winningSide: "YES",
			reason: REASON,
			settleEventId: uuidv7(),
			metadata: adminMetadata("F-RESOLVE-1"),
		});

		// Positions are NEVER touched (drift-D1 derived constraint): A still
		// holds 300 YES, B 150 NO — historical records.
		const positionsAfter = await testDb
			.select({
				id: positions.id,
				side: positions.side,
				quantity: positions.quantity,
			})
			.from(positions)
			.where(eq(positions.marketId, marketId));
		expect(positionsAfter).toEqual(positionsBefore);
		const quantities = new Map(positionsAfter.map((p) => [p.side, p.quantity]));
		expect(quantities.get("YES")).toBe("300.000000000000000000");
		expect(quantities.get("NO")).toBe("150.000000000000000000");

		// The pools row is NOT written: the untouched winning-side reserve IS
		// the audit source for the recorded unwind (R-9.5).
		const [poolRow] = await testDb
			.select({
				yesReserves: pools.yesReserves,
				noReserves: pools.noReserves,
			})
			.from(pools)
			.where(eq(pools.marketId, marketId));
		expect(poolRow?.yesReserves).toBe("50.000000000000000000");
		expect(poolRow?.noReserves).toBe("200.000000000000000000");

		// Comments are NOT touched — locking is emergent (S2 finding 8).
		const commentsAfter = await testDb
			.select({
				id: comments.id,
				sideAtPostTime: comments.sideAtPostTime,
				body: comments.body,
			})
			.from(comments)
			.where(eq(comments.marketId, marketId));
		expect(commentsAfter).toEqual(commentsBefore);

		// R-9.5/R-2: the unwind NEVER lands in the user-only ledger — zero
		// pool_seed/pool_unwind rows, for anyone.
		const poolTagRows = await testDb
			.select({ id: dharmaLedger.id })
			.from(dharmaLedger)
			.where(inArray(dharmaLedger.entryType, ["pool_seed", "pool_unwind"]));
		expect(poolTagRows.length).toBe(0);

		// No per-payout generic events either (SPEC.2 §3.6): the only events
		// for these users' settlement are the terminal market.resolved.
		const dharmaEvents = await testDb
			.select({ eventType: events.eventType })
			.from(events)
			.where(inArray(events.aggregateId, [userA, userB]));
		expect(
			dharmaEvents.filter((e) => e.eventType.startsWith("dharma.")).length,
		).toBe(0);
	});

	it("resolution::empty-market-settle-unwinds-the-seed", async () => {
		// No bets at all: zero payout rows, totalPaidOut 0, unwind == seed —
		// the admin's seed exits circulation whole.
		const marketId = await seedOpenMarketWithPool("settle-empty");
		await setStatus(marketId, "Resolving");

		const result = await settleMarket({
			marketId,
			winningSide: "NO",
			reason: REASON,
			settleEventId: uuidv7(),
			metadata: adminMetadata("F-RESOLVE-1"),
		});

		expect(new CpmmDecimal(result.totalPaidOut).equals("0")).toBe(true);
		expect(new CpmmDecimal(result.poolUnwindAmount).equals("100")).toBe(true);

		const payoutRows = await testDb
			.select({ id: payoutEvents.id })
			.from(payoutEvents)
			.where(eq(payoutEvents.marketId, marketId));
		expect(payoutRows.length).toBe(0);

		const [marketRow] = await testDb
			.select({ status: markets.status })
			.from(markets)
			.where(eq(markets.id, marketId));
		expect(marketRow?.status).toBe("Resolved");
	});

	it("resolution::asymmetric-no-outcome-residual-is-N-plus-D-no", async () => {
		// LIQ-1 Phase 1 · T8b — ADR-0047 §Acceptance row "Settle, NO outcome":
		// residual = `N + D_no`, and `totalPaidOut + residual` = deposited.
		// Plan §9 R5.
		//
		// ⚠ WHY THE **NO** OUTCOME, AND WHY THE YES OUTCOME IS UNCHANGED.
		// At a 10% open the LARGE reserve is on YES, so YES is the long side and
		// `D_yes = 0`. `settle.ts:189` takes the bare winning-side reserve, and
		// for a YES outcome that IS `Y + D_yes` — the number does not move, and
		// every existing YES-outcome test in this file stays green with no edit.
		// NO is the ONLY branch where it moves, and it moves by exactly
		// `D_no = 80,000`. That is why the acceptance table names the NO branch
		// and why this is the only new case here.
		//
		// ⛔ RED-FIRST ON A NUMBER, NOT A THROW — and that is the danger the
		// test is written for. Today `settleMarket` returns cleanly with a
		// residual short by 80,000: nothing errors, the market resolves, and the
		// books simply do not close. Plan §9 R5: "Not a throw — a wrong number
		// that reconciles nothing."
		const userC = await seedUser("settle-asym-c", "1000");
		const userD = await seedUser("settle-asym-d", "1000");
		const marketId = await seedAsymmetricOpenMarket("settle-asym-no");
		await placeBet({ userId: userC, marketId, side: "NO", stake: "100" });
		await placeBet({ userId: userD, marketId, side: "YES", stake: "50" });
		await setStatus(marketId, "Resolving");

		const result = await settleMarket({
			marketId,
			winningSide: "NO",
			reason: REASON,
			settleEventId: uuidv7(),
			metadata: adminMetadata("F-RESOLVE-1"),
		});

		// The pool is never written by settle, so this is the same row the
		// transaction read under the lock.
		const [poolRow] = await testDb
			.select({
				yesReserves: pools.yesReserves,
				noReserves: pools.noReserves,
			})
			.from(pools)
			.where(eq(pools.marketId, marketId));
		const positionRows = await testDb
			.select({ side: positions.side, quantity: positions.quantity })
			.from(positions)
			.where(eq(positions.marketId, marketId));
		const held = new Map(positionRows.map((p) => [p.side, p.quantity]));

		// (a) The residual is the winning reserve PLUS the winning side's
		//     cumulative discard. Derived from the live row, not restated.
		const expectedResidual = new CpmmDecimal(poolRow?.noReserves ?? "0")
			.plus(ASYM_D_NO)
			.toFixed(18);
		expect(new CpmmDecimal(result.poolUnwindAmount).toFixed(18)).toBe(
			expectedResidual,
		);
		// …and it is NOT the bare reserve, stated explicitly so the failure names
		// itself if the discard term is dropped again.
		expect(new CpmmDecimal(result.poolUnwindAmount).toFixed(18)).not.toBe(
			new CpmmDecimal(poolRow?.noReserves ?? "0").toFixed(18),
		);

		// (b) Gross winner payouts = the whole NO position (no sells ⇒ f = 1).
		expect(new CpmmDecimal(result.totalPaidOut).toFixed(18)).toBe(
			new CpmmDecimal(held.get("NO") ?? "0").toFixed(18),
		);

		// (c) THE CONSERVATION LINE: totalPaidOut + residual == total Đ
		//     deposited == backing 90,000 + Σ stakes 150. Every Đ that entered
		//     the market either went to a winner or exited circulation.
		const deposited = new CpmmDecimal(ASYM_BACKING).plus("150").toFixed(18);
		expect(
			new CpmmDecimal(result.totalPaidOut)
				.plus(result.poolUnwindAmount)
				.toFixed(18),
		).toBe(deposited);

		// (d) The same number rides the terminal emit (R-9.5e) — a return value
		//     that is right while the append-only row is wrong would be worse
		//     than both being wrong.
		const eventRows = await testDb
			.select({ payload: events.payload })
			.from(events)
			.where(eq(events.eventType, "market.resolved"));
		expect(eventRows.length).toBe(1);
		const payload = eventRows[0]?.payload as Record<string, unknown>;
		expect(new CpmmDecimal(String(payload.poolUnwindAmount)).toFixed(18)).toBe(
			expectedResidual,
		);

		// (e) And the backing identity itself still closes on the losing side —
		//     Y + H_yes + D_yes == deposited — so (c) is not an accident of the
		//     NO side's arithmetic alone.
		expect(
			new CpmmDecimal(poolRow?.yesReserves ?? "0")
				.plus(held.get("YES") ?? "0")
				.plus(ASYM_D_YES)
				.toFixed(18),
		).toBe(deposited);
	});

	for (const status of ["Open", "Closed", "Resolved"] as const) {
		it(`resolution::settle-rejected-on-${status.toLowerCase()}`, async () => {
			const marketId = await seedOpenMarketWithPool(
				`settle-neg-${status.toLowerCase()}`,
			);
			await setStatus(marketId, status);

			const caught = await settleMarket({
				marketId,
				winningSide: "YES",
				reason: REASON,
				settleEventId: uuidv7(),
				metadata: adminMetadata("F-RESOLVE-1"),
			}).catch((e: unknown) => e);

			expect(caught).toBeInstanceOf(ResolutionStateError);

			// Nothing written.
			const resolutionRows = await testDb
				.select({ id: resolutionEvents.id })
				.from(resolutionEvents)
				.where(eq(resolutionEvents.marketId, marketId));
			expect(resolutionRows.length).toBe(0);
			const [marketRow] = await testDb
				.select({ status: markets.status })
				.from(markets)
				.where(eq(markets.id, marketId));
			expect(marketRow?.status).toBe(status);
		});
	}

	it("resolution::stranded-resolving-reinvoke-succeeds", async () => {
		// Stranded-Resolving recovery = invoke settle (plan W-3a: a market
		// left in Resolving — e.g. an aborted settle tx — settles cleanly on
		// re-invoke; double-trigger is the path that fails).
		const { marketId, userA } = await seedSettleScenario("settle-stranded");

		// (The scenario helper already left the market Resolving with no
		// resolution writes — exactly the stranded shape.)
		const result = await settleMarket({
			marketId,
			winningSide: "YES",
			reason: REASON,
			settleEventId: uuidv7(),
			metadata: adminMetadata("F-RESOLVE-1"),
		});
		expect(new CpmmDecimal(result.totalPaidOut).equals("300")).toBe(true);

		const ledgerA = await testDb
			.select({ id: dharmaLedger.id })
			.from(dharmaLedger)
			.where(
				and(
					eq(dharmaLedger.userId, userA),
					eq(dharmaLedger.entryType, "bet_payout"),
				),
			);
		expect(ledgerA.length).toBe(2);
	});

	it("resolution::all-bets-have-exactly-one-payout-row", async () => {
		// §3.6 uniformity: ONE payout_events row per bet in the market —
		// winners, losers, everyone (3 bets ⇒ 3 rows; zero legs legal).
		const { marketId, betsA, betB } = await seedSettleScenario("settle-rows");

		await settleMarket({
			marketId,
			winningSide: "YES",
			reason: REASON,
			settleEventId: uuidv7(),
			metadata: adminMetadata("F-RESOLVE-1"),
		});

		const payoutRows = await testDb
			.select({ betId: payoutEvents.betId })
			.from(payoutEvents)
			.where(eq(payoutEvents.marketId, marketId));
		expect(payoutRows.map((r) => r.betId).sort()).toEqual(
			[...betsA, betB].sort(),
		);
	});
});
