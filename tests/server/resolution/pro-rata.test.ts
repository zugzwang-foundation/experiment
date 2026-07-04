import { and, eq } from "drizzle-orm";
import { v7 as uuidv7 } from "uuid";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@sentry/nextjs", () => ({
	captureMessage: vi.fn(),
	addBreadcrumb: vi.fn(),
	captureException: vi.fn(),
}));

import {
	bets,
	comments,
	dharmaLedger,
	markets,
	payoutEvents,
	pools,
	positions,
	users,
} from "@/db/schema";
import { place } from "@/server/bets/place";
import { sell } from "@/server/bets/sell";
import { runBetTransaction } from "@/server/bets/transaction";
import { CpmmDecimal, floor18 } from "@/server/cpmm/decimal";
import { settleMarket } from "@/server/resolution/settle";

import { testClient, testDb } from "../../db/_fixtures/db";
import { truncateTables } from "../../db/_fixtures/truncate";

// ENGINE.9 §5.6 tests-first (S3, plan §Test plan) — the R-9.8 settlement
// basis after sells (DB-backed). Greenfield value import from
// `@/server/resolution/settle` REDs at collection until ENGINE.9 lands.
//
// R-9.8: sells decrement positions only (no sale-to-bet attribution); at
// settlement the surviving fraction f = positions.quantity / Σ same-side
// share_quantity applies UNIFORMLY per bet — payout_i = floor18(Q × w_i / Σw)
// for rows 1..n−1 ordered by bet id, the last row takes the exact remainder.
// A fully-sold bet (f = 0) settles with a 0-amount payout_events row and NO
// ledger row; sale proceeds stand.
//
// Fixture economics (verified against cpmm/calculate.ts exactly):
//   Market D (partial sell, f = 5/7): seed 100;
//     buy YES 100 → 150 sh, ( 50, 200)
//     buy YES  50 →  60 sh, ( 40, 250)
//     sell 60 YES → proceeds 50 (disc 62500 = 250²), ( 50, 200)
//   position 150 of Σw 210 ⇒ f = 5/7; payout split over (150, 60):
//     floor18(150·150/210) = 107.142857142857142857
//     floor18(150· 60/210) =  42.857142857142857142 (+1e-18 to the LAST row)
//   Ledger D: 1000 −100 −50 +50 = 900 → +payouts = 1050 exactly.
//   Market G (sold-out, switched sides): seed 100;
//     buy YES 100 → 150 sh, (50, 200); sell 150 → proceeds 100, (100, 100);
//     buy NO 100 → 150 sh, (200, 50). Settle YES: H_yes = 0 — both bets
//     settle at 0; unwind = Y = 200.

const SEED = "100.000000000000000000";
const REASON = "Criterion met: pro-rata fixture.";

// Pinned lexicographically-ordered bet ids for the remainder-determinism
// fixture (plan fixture discipline: explicit fixed UUIDs, never DB-default
// uuidv7, where last-row-remainder ordering matters).
const BET_LO = "00000000-0000-7000-8000-00000000000a";
const BET_HI = "00000000-0000-7000-8000-00000000000b";

function adminMetadata() {
	return {
		request_id: "test-resolution-pro-rata",
		flow_id: "F-RESOLVE-1",
		user_id: null,
		actor_id: "admin-singleton",
		idempotency_key: null,
		ip: "test",
		user_agent: "vitest",
	};
}

function userMetadata(userId: string, flowId: string) {
	return {
		request_id: "test-pro-rata-fixture",
		flow_id: flowId,
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
			name: "Pro-Rata User",
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

async function seedOpenMarketWithPool(slug: string): Promise<string> {
	const [market] = await testDb
		.insert(markets)
		.values({
			slug,
			title: "Pro-Rata Market",
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
	return marketId;
}

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
				body: `pro-rata argument ${uuidv7()}`,
				parentCommentId: null,
				idempotencyKey: uuidv7(),
				bodyFingerprint: uuidv7(),
				betEventId: uuidv7(),
				commentEventId: uuidv7(),
				creditEventId: uuidv7(),
				metadata: userMetadata(args.userId, "F-BET-1"),
			}),
	);
	return result.betId;
}

async function sellShares(args: {
	userId: string;
	marketId: string;
	shares: string;
}): Promise<void> {
	await runBetTransaction({ marketId: args.marketId, flow: "F-BET-3" }, (ctx) =>
		sell(ctx, {
			userId: args.userId,
			marketId: args.marketId,
			shares: args.shares,
			sellEventId: uuidv7(),
			syntheticBetId: uuidv7(),
			idempotencyKey: uuidv7(),
			bodyFingerprint: uuidv7(),
			metadata: userMetadata(args.userId, "F-BET-3"),
		}),
	);
}

async function setResolving(marketId: string): Promise<void> {
	await testClient.unsafe(
		`UPDATE markets SET status = 'Resolving' WHERE id = $1`,
		[marketId],
	);
}

describe("ENGINE.9 R-9.8 — pro-rata settlement basis after sells", () => {
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

	it("resolution-pro-rata::partial-sell-prorates-per-bet-exactly", async () => {
		const userD = await seedUser("prorata-d");
		const marketId = await seedOpenMarketWithPool("prorata-partial");
		await placeBet({ userId: userD, marketId, side: "YES", stake: "100" });
		await placeBet({ userId: userD, marketId, side: "YES", stake: "50" });
		await sellShares({ userId: userD, marketId, shares: "60" });
		await setResolving(marketId);

		const result = await settleMarket({
			marketId,
			winningSide: "YES",
			reason: REASON,
			settleEventId: uuidv7(),
			metadata: adminMetadata(),
		});

		// Position truth after the sell: 210 − 60 = 150 — totalPaidOut is the
		// position-level quantity, NEVER Σ share_quantity (which is 210).
		expect(new CpmmDecimal(result.totalPaidOut).equals("150")).toBe(true);

		// Per-bet amounts: the R-9.8 contract applied to the REAL rows —
		// rows 1..n−1 floor18(Q × wᵢ/Σw), last row the exact remainder,
		// ordered by bet id.
		const betRows = (
			await testDb
				.select({ id: bets.id, shareQuantity: bets.shareQuantity })
				.from(bets)
				.where(eq(bets.marketId, marketId))
		).sort((a, b) => (a.id < b.id ? -1 : 1));
		expect(betRows.length).toBe(2);
		const w0 = betRows[0]?.shareQuantity ?? "0";
		const expectedFirst = floor18(
			new CpmmDecimal("150").times(w0).dividedBy("210"),
		);
		const expectedLast = new CpmmDecimal("150")
			.minus(expectedFirst)
			.toFixed(18);

		const payoutRows = await testDb
			.select({ betId: payoutEvents.betId, amount: payoutEvents.amount })
			.from(payoutEvents)
			.where(eq(payoutEvents.marketId, marketId));
		expect(payoutRows.length).toBe(2);
		const amountByBet = new Map(payoutRows.map((r) => [r.betId, r.amount]));
		expect(amountByBet.get(betRows[0]?.id ?? "")).toBe(expectedFirst);
		expect(amountByBet.get(betRows[1]?.id ?? "")).toBe(expectedLast);

		// The per-bet amounts sum EXACTLY to the position quantity.
		const sum = payoutRows.reduce(
			(acc, r) => acc.plus(r.amount),
			new CpmmDecimal(0),
		);
		expect(sum.toFixed(18)).toBe("150.000000000000000000");

		// Ledger: chained per-bet rows; final balance closes exactly —
		// 1000 − 100 − 50 + 50 (proceeds stand) + 150 = 1050.
		const ledgerPayouts = await testDb
			.select({
				betId: dharmaLedger.betId,
				amount: dharmaLedger.amount,
				balanceAfter: dharmaLedger.balanceAfter,
			})
			.from(dharmaLedger)
			.where(
				and(
					eq(dharmaLedger.userId, userD),
					eq(dharmaLedger.entryType, "bet_payout"),
				),
			);
		expect(ledgerPayouts.length).toBe(2);
		const ledgerByBet = new Map(ledgerPayouts.map((r) => [r.betId, r]));
		expect(ledgerByBet.get(betRows[0]?.id ?? "")?.balanceAfter).toBe(
			new CpmmDecimal("900").plus(expectedFirst).toFixed(18),
		);
		expect(ledgerByBet.get(betRows[1]?.id ?? "")?.balanceAfter).toBe(
			"1050.000000000000000000",
		);
	});

	it("resolution-pro-rata::fully-sold-winning-bet-zero-row-no-ledger", async () => {
		// Sold-out-then-switched-sides: G's YES bet is fully sold (f = 0) AND
		// G now holds NO. Settle YES: BOTH bets settle at 0 — the YES bet by
		// the f = 0 corollary, the NO bet as a loser. Zero ledger rows.
		const userG = await seedUser("prorata-g");
		const marketId = await seedOpenMarketWithPool("prorata-soldout");
		const betYes = await placeBet({
			userId: userG,
			marketId,
			side: "YES",
			stake: "100",
		});
		await sellShares({ userId: userG, marketId, shares: "150" });
		const betNo = await placeBet({
			userId: userG,
			marketId,
			side: "NO",
			stake: "100",
		});
		await setResolving(marketId);

		const result = await settleMarket({
			marketId,
			winningSide: "YES",
			reason: REASON,
			settleEventId: uuidv7(),
			metadata: adminMetadata(),
		});

		expect(new CpmmDecimal(result.totalPaidOut).equals("0")).toBe(true);
		// Unwind = the YES reserve after G's round-trip = 200 (derivation in
		// the file header); the Dharma G paid in net stays out of circulation.
		expect(new CpmmDecimal(result.poolUnwindAmount).equals("200")).toBe(true);

		const payoutRows = await testDb
			.select({ betId: payoutEvents.betId, amount: payoutEvents.amount })
			.from(payoutEvents)
			.where(eq(payoutEvents.marketId, marketId));
		expect(payoutRows.length).toBe(2);
		for (const row of payoutRows) {
			expect(row.amount).toBe("0.000000000000000000");
		}
		expect(payoutRows.map((r) => r.betId).sort()).toEqual(
			[betYes, betNo].sort(),
		);

		// SPEC.2 §3.6: one dharma_ledger row per NON-ZERO settlement — zero
		// settlements write none.
		const ledgerRows = await testDb
			.select({ id: dharmaLedger.id })
			.from(dharmaLedger)
			.where(
				and(
					eq(dharmaLedger.userId, userG),
					eq(dharmaLedger.entryType, "bet_payout"),
				),
			);
		expect(ledgerRows.length).toBe(0);

		// INV-3 preservation: both comments keep their post-time sides.
		const commentRows = await testDb
			.select({ sideAtPostTime: comments.sideAtPostTime })
			.from(comments)
			.where(eq(comments.marketId, marketId));
		expect(commentRows.map((c) => c.sideAtPostTime).sort()).toEqual([
			"NO",
			"YES",
		]);
	});

	it("resolution-pro-rata::remainder-lands-on-max-uuid-bet-deterministically", async () => {
		// Direct-insert fixture with PINNED, lexicographically-ordered bet
		// ids (the one place id order is load-bearing): weights (1, 2), total
		// position 1 — exact shares 1/3 and 2/3 both floor, the 1e-18
		// remainder lands on BET_HI (the max id), never BET_LO.
		const userF = await seedUser("prorata-f");
		const marketId = await seedOpenMarketWithPool("prorata-remainder");

		const commentIds: string[] = [];
		for (const side of ["YES", "YES"] as const) {
			const [c] = await testDb
				.insert(comments)
				.values({
					userId: userF,
					marketId,
					body: "remainder fixture",
					sideAtPostTime: side,
					betId: null,
				})
				.returning({ id: comments.id });
			commentIds.push(c?.id ?? "");
		}
		await testDb.insert(bets).values([
			{
				id: BET_LO,
				userId: userF,
				marketId,
				side: "YES",
				stake: "1",
				shareQuantity: "1.000000000000000000",
				priceAtBet: "0.5",
				commentId: commentIds[0] ?? "",
			},
			{
				id: BET_HI,
				userId: userF,
				marketId,
				side: "YES",
				stake: "2",
				shareQuantity: "2.000000000000000000",
				priceAtBet: "0.5",
				commentId: commentIds[1] ?? "",
			},
		]);
		await testDb.insert(positions).values({
			userId: userF,
			marketId,
			side: "YES",
			quantity: "1.000000000000000000",
		});
		await setResolving(marketId);

		await settleMarket({
			marketId,
			winningSide: "YES",
			reason: REASON,
			settleEventId: uuidv7(),
			metadata: adminMetadata(),
		});

		const payoutRows = await testDb
			.select({ betId: payoutEvents.betId, amount: payoutEvents.amount })
			.from(payoutEvents)
			.where(eq(payoutEvents.marketId, marketId));
		const amountByBet = new Map(payoutRows.map((r) => [r.betId, r.amount]));
		expect(amountByBet.get(BET_LO)).toBe("0.333333333333333333");
		expect(amountByBet.get(BET_HI)).toBe("0.666666666666666667");

		// Chained ledger rows in bet-id order: 0 → 0.333… → 1.000… exactly.
		const ledgerRows = await testDb
			.select({
				betId: dharmaLedger.betId,
				balanceAfter: dharmaLedger.balanceAfter,
			})
			.from(dharmaLedger)
			.where(
				and(
					eq(dharmaLedger.userId, userF),
					eq(dharmaLedger.entryType, "bet_payout"),
				),
			);
		const ledgerByBet = new Map(
			ledgerRows.map((r) => [r.betId, r.balanceAfter]),
		);
		expect(ledgerByBet.get(BET_LO)).toBe("1000.333333333333333333");
		expect(ledgerByBet.get(BET_HI)).toBe("1001.000000000000000000");
	});
});
