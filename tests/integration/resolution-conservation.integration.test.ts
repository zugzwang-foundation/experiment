import { eq, inArray } from "drizzle-orm";
import { v7 as uuidv7 } from "uuid";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@sentry/nextjs", () => ({
	captureMessage: vi.fn(),
	addBreadcrumb: vi.fn(),
	captureException: vi.fn(),
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
import { sell } from "@/server/bets/sell";
import { runBetTransaction } from "@/server/bets/transaction";
import { CpmmDecimal } from "@/server/cpmm/decimal";
import {
	checkCorrectedMarketConservation,
	checkMarketConservation,
} from "@/server/dharma/conservation";
import type { DharmaEntryType } from "@/server/dharma/tags";
import { FLOW_TAGS } from "@/server/dharma/tags";
import { correctResolution } from "@/server/resolution/correct";
import { settleMarket } from "@/server/resolution/settle";
import { voidMarket } from "@/server/resolution/void";

import { testClient, testDb } from "../db/_fixtures/db";
import { truncateTables } from "../db/_fixtures/truncate";

// ENGINE.9 §5.6 tests-first (I1, plan §Test plan) — the three conservation
// identities (i)/(ii)/(iii) close on REAL DB fixtures via the shipped (★)
// checker and the new sibling. Greenfield value imports
// (`@/server/resolution/*`, `checkCorrectedMarketConservation`) RED at
// collection until ENGINE.9 lands. DB-BACKED (local Postgres :54322).
//
// Gathering is ARGUMENT-FED from the fixture's KNOWN rows (plan §Conservation
// — the production gathering query is a carry-forward, out of scope here):
// bet-tied flows key on betId ∈ the market's bets; the ONE bet_id-NULL flow
// row a fixture mints (the sell-proceeds bet_stake credit, `sell.ts:75`) is
// gathered fixture-known by user. `uncollectable` rows are EXCLUDED from
// flows and passed as the explicit total (R-9.6 — the sibling THROWS on an
// absorbed row).
//
// Identities (plan §Conservation, re-derived for the seed-100 fixtures):
//  (i)   settle:  Σ FLOW == seed − unwind                       (★ unchanged)
//  (ii)  correct: Σ FLOW == (seed − unwind) − reverseRec + applyRec + U
//  (iii) void:    Σ FLOW == seed − unwind                       (★ unchanged)

const SEED = "100.000000000000000000";
const REASON = "Conservation fixture reason.";
const FLOW_SET = new Set<DharmaEntryType>(FLOW_TAGS);

function adminMetadata(flowId: string) {
	return {
		request_id: "test-resolution-conservation",
		flow_id: flowId,
		user_id: null,
		actor_id: "admin-singleton",
		idempotency_key: null,
		ip: "test",
		user_agent: "vitest",
	};
}

function userMetadata(userId: string, flowId: string) {
	return {
		request_id: "test-conservation-fixture",
		flow_id: flowId,
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
			name: "Conservation User",
			email: `${emailTag}@example.com`,
			pseudonym: emailTag,
			tosAcceptedAt: new Date("2026-01-01T00:00:00Z"),
			lastAllowanceAccruedAt: new Date(), // suppress the Daily Credit
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
			title: "Conservation Market",
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
				body: `conservation argument ${uuidv7()}`,
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

async function setResolving(marketId: string): Promise<void> {
	await testClient.unsafe(
		`UPDATE markets SET status = 'Resolving' WHERE id = $1`,
		[marketId],
	);
}

/** Argument-fed gathering: the market's bet-tied FLOW rows (betId-keyed). */
async function gatherBetTiedFlows(
	marketId: string,
): Promise<{ amount: string; entryType: DharmaEntryType }[]> {
	const betRows = await testDb
		.select({ id: bets.id })
		.from(bets)
		.where(eq(bets.marketId, marketId));
	const betIds = betRows.map((b) => b.id);
	if (betIds.length === 0) return [];
	const rows = await testDb
		.select({ amount: dharmaLedger.amount, entryType: dharmaLedger.entryType })
		.from(dharmaLedger)
		.where(inArray(dharmaLedger.betId, betIds));
	return rows.filter((r) => FLOW_SET.has(r.entryType));
}

describe("ENGINE.9 — resolution conservation identities (i)/(ii)/(iii)", () => {
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

	it("resolution-conservation::identity-i-settle-closes-via-shipped-checker", async () => {
		// S2 shape: A YES 100 + YES 100 (winner), B NO 50 (loser).
		// Σ FLOW = −250 + 300 = 50 == seed − unwind = 100 − 50. (★) closes
		// with the SHIPPED checker — no variant needed for resolve.
		const userA = await seedUser("cons-i-a", "1000");
		const userB = await seedUser("cons-i-b", "1000");
		const marketId = await seedOpenMarketWithPool("cons-settle");
		await placeBet({ userId: userA, marketId, side: "YES", stake: "100" });
		await placeBet({ userId: userB, marketId, side: "NO", stake: "50" });
		await placeBet({ userId: userA, marketId, side: "YES", stake: "100" });
		await setResolving(marketId);

		const result = await settleMarket({
			marketId,
			winningSide: "YES",
			reason: REASON,
			settleEventId: uuidv7(),
			metadata: adminMetadata("F-RESOLVE-1"),
		});

		const ledgerFlows = await gatherBetTiedFlows(marketId);
		const netAdminPoolInjection = new CpmmDecimal(SEED)
			.minus(result.poolUnwindAmount)
			.toFixed(18);
		expect(netAdminPoolInjection).toBe("50.000000000000000000");
		expect(
			checkMarketConservation({ ledgerFlows, netAdminPoolInjection }),
		).toEqual({ ok: true });
	});

	it("resolution-conservation::identity-ii-correction-closes-via-sibling", async () => {
		// S4 shape: R rich (1000), P poor (100 — floored at zero), L on NO.
		// After correct YES→NO: Σ FLOW = −250 + 300 − 190 + 150 = 10;
		// RHS = (100 − 50) − 300 + 150 + 110 = 10. The uncollectable U = 110
		// is the EXPLICIT operand — never an absorbed flow row.
		const userR = await seedUser("cons-ii-r", "1000");
		const userP = await seedUser("cons-ii-p", "100");
		const userL = await seedUser("cons-ii-l", "1000");
		const marketId = await seedOpenMarketWithPool("cons-correct");
		await placeBet({ userId: userR, marketId, side: "YES", stake: "100" });
		await placeBet({ userId: userL, marketId, side: "NO", stake: "50" });
		await placeBet({ userId: userP, marketId, side: "YES", stake: "100" });
		await setResolving(marketId);
		const settled = await settleMarket({
			marketId,
			winningSide: "YES",
			reason: REASON,
			settleEventId: uuidv7(),
			metadata: adminMetadata("F-RESOLVE-1"),
		});
		// P spends down to 40 on a SECOND market (its flows must NOT leak
		// into this market's gathering — betId-keyed exclusion).
		const market2 = await seedOpenMarketWithPool("cons-correct-m2");
		await placeBet({
			userId: userP,
			marketId: market2,
			side: "YES",
			stake: "110",
		});

		const corrected = await correctResolution({
			marketId,
			correctedSide: "NO",
			reason: REASON,
			correctEventId: uuidv7(),
			metadata: adminMetadata("F-RESOLVE-2"),
		});

		// Recorded operands, from the correction's payout_events legs.
		const legs = await testDb
			.select({
				payoutType: payoutEvents.payoutType,
				amount: payoutEvents.amount,
			})
			.from(payoutEvents)
			.where(eq(payoutEvents.resolutionEventId, corrected.correctionEventId));
		let reverseRecordedTotal = new CpmmDecimal(0);
		let applyRecordedTotal = new CpmmDecimal(0);
		for (const leg of legs) {
			if (leg.payoutType === "correction_reverse") {
				reverseRecordedTotal = reverseRecordedTotal.plus(
					new CpmmDecimal(leg.amount).abs(),
				);
			}
			if (leg.payoutType === "correction_apply") {
				applyRecordedTotal = applyRecordedTotal.plus(leg.amount);
			}
		}
		expect(reverseRecordedTotal.toFixed(18)).toBe("300.000000000000000000");
		expect(applyRecordedTotal.toFixed(18)).toBe("150.000000000000000000");

		// U from the uncollectable ledger rows (excluded from flows).
		const uncollectableRows = await testDb
			.select({ amount: dharmaLedger.amount })
			.from(dharmaLedger)
			.where(eq(dharmaLedger.entryType, "uncollectable"));
		const uncollectableTotal = uncollectableRows
			.reduce(
				(acc, r) => acc.plus(new CpmmDecimal(r.amount).abs()),
				new CpmmDecimal(0),
			)
			.toFixed(18);
		expect(uncollectableTotal).toBe("110.000000000000000000");

		const ledgerFlows = await gatherBetTiedFlows(marketId);
		const netAdminPoolInjection = new CpmmDecimal(SEED)
			.minus(settled.poolUnwindAmount)
			.toFixed(18);
		expect(
			checkCorrectedMarketConservation({
				ledgerFlows,
				netAdminPoolInjection,
				reverseRecordedTotal: reverseRecordedTotal.toFixed(18),
				applyRecordedTotal: applyRecordedTotal.toFixed(18),
				uncollectableTotal,
			}),
		).toEqual({ ok: true });
	});

	it("resolution-conservation::identity-iii-void-no-sells-closes-exactly", async () => {
		// No-sells void: Σ refunds == Σ stakes EXACTLY and unwind == seed —
		// Σ FLOW = −150 + 150 = 0 == seed − unwind = 0. (★) closes unchanged.
		const userH = await seedUser("cons-iii-h", "1000");
		const userI = await seedUser("cons-iii-i", "1000");
		const marketId = await seedOpenMarketWithPool("cons-void-nosells");
		await placeBet({ userId: userH, marketId, side: "YES", stake: "100" });
		await placeBet({ userId: userI, marketId, side: "NO", stake: "50" });

		const result = await voidMarket({
			marketId,
			reason: REASON,
			voidEventId: uuidv7(),
			metadata: adminMetadata("F-RESOLVE-3"),
		});

		// The two acceptance pins (plan §Conservation (iii) no-sells case).
		expect(new CpmmDecimal(result.poolUnwindAmount).equals(SEED)).toBe(true);
		const refundLedger = await testDb
			.select({ amount: dharmaLedger.amount })
			.from(dharmaLedger)
			.where(eq(dharmaLedger.entryType, "void_refund"));
		const refundSum = refundLedger.reduce(
			(acc, r) => acc.plus(r.amount),
			new CpmmDecimal(0),
		);
		expect(refundSum.toFixed(18)).toBe("150.000000000000000000");

		const ledgerFlows = await gatherBetTiedFlows(marketId);
		expect(
			checkMarketConservation({
				ledgerFlows,
				netAdminPoolInjection: new CpmmDecimal(SEED)
					.minus(result.poolUnwindAmount)
					.toFixed(18),
			}),
		).toEqual({ ok: true });
	});

	it("resolution-conservation::identity-iii-void-after-sells-closes-exactly", async () => {
		// After-sells void (the J fixture): buy 100 → buy 50 → sell 60
		// (proceeds 50, a bet_id-NULL bet_stake credit — gathered
		// fixture-known). Σ FLOW = −150 + 50 + 107.142857142857142857
		// = 7.142857142857142857 == 100 − 92.857142857142857143.
		const userJ = await seedUser("cons-iii-j", "1000");
		const marketId = await seedOpenMarketWithPool("cons-void-sells");
		await placeBet({ userId: userJ, marketId, side: "YES", stake: "100" });
		await placeBet({ userId: userJ, marketId, side: "YES", stake: "50" });
		await runBetTransaction({ marketId, flow: "F-BET-3" }, (ctx) =>
			sell(ctx, {
				userId: userJ,
				marketId,
				shares: "60",
				sellEventId: uuidv7(),
				syntheticBetId: uuidv7(),
				idempotencyKey: uuidv7(),
				bodyFingerprint: uuidv7(),
				metadata: userMetadata(userJ, "F-BET-3"),
			}),
		);

		const result = await voidMarket({
			marketId,
			reason: REASON,
			voidEventId: uuidv7(),
			metadata: adminMetadata("F-RESOLVE-3"),
		});
		expect(result.poolUnwindAmount).toBe("92.857142857142857143");

		// Bet-tied flows + the fixture's ONE bet_id-NULL sale-proceeds row
		// (carry-forward 1: per-market gathering cannot key on bet_id alone;
		// argument-fed here by fixture knowledge).
		const betTied = await gatherBetTiedFlows(marketId);
		const saleRows = await testDb
			.select({
				amount: dharmaLedger.amount,
				entryType: dharmaLedger.entryType,
			})
			.from(dharmaLedger)
			.where(eq(dharmaLedger.userId, userJ));
		const saleProceeds = saleRows.filter(
			(r) => r.entryType === "bet_stake" && !r.amount.startsWith("-"),
		);
		expect(saleProceeds.length).toBe(1);
		expect(saleProceeds[0]?.amount).toBe("50.000000000000000000");

		expect(
			checkMarketConservation({
				ledgerFlows: [...betTied, ...saleProceeds],
				netAdminPoolInjection: new CpmmDecimal(SEED)
					.minus(result.poolUnwindAmount)
					.toFixed(18),
			}),
		).toEqual({ ok: true });
	});
});
