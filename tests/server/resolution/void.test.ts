import { and, eq, inArray } from "drizzle-orm";
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
	events,
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
import { ResolutionStateError } from "@/server/resolution/errors";
import { voidMarket } from "@/server/resolution/void";

import { testClient, testDb } from "../../db/_fixtures/db";
import { truncateTables } from "../../db/_fixtures/truncate";

// ENGINE.9 §5.6 tests-first (S5, plan §Test plan) —
// `full-refund-and-pool-unwind` + the void suite (F-RESOLVE-3, W-3d).
// Greenfield value imports from `@/server/resolution/{void,errors}` RED at
// collection until ENGINE.9 lands. DB-BACKED (local Postgres :54322).
//
// W-3d contract: gate Open|Closed (R-9.3 — void is a PRE-resolution exit;
// no Resolving→Voided edge); refund basis f × stake per bet (R-9.8 — sale
// proceeds STAND); unwind = cash − Σ refunds with cash = Y + H_yes
// (= N + H_no, cross-asserted — (♦)); positions/pools/comments untouched.
//
// Fixture economics (verified against cpmm/calculate.ts exactly):
//   No-sells market: H buys YES 100 → 150 sh (50, 200);
//                    I buys NO   50 → 150 sh (100, 100).
//     f = 1 everywhere ⇒ Σ void_refund == Σ stakes == 150 EXACTLY and
//     unwind == seed == 100 EXACTLY (the §Conservation (iii) no-sells pins).
//   After-sells market J: buy YES 100 → 150 sh (50, 200);
//                         buy YES  50 →  60 sh (40, 250);
//                         sell 60 → proceeds 50 (50, 200).
//     position 150, Σ stakes 150, Σ shares 210 ⇒
//     T = floor18(150 × 150/210) = 107.142857142857142857, split per-bet by
//     stake weights (100, 50) with the last-row remainder by bet id;
//     cash = 50 + 150 = 200 ⇒ unwind = 92.857142857142857143.

const SEED = "100.000000000000000000";
const VOID_REASON = "Question became unresolvable.";

function adminMetadata() {
	return {
		request_id: "test-resolution-void",
		flow_id: "F-RESOLVE-3",
		user_id: null,
		actor_id: "admin-singleton",
		idempotency_key: null,
		ip: "test",
		user_agent: "vitest",
	};
}

function userMetadata(userId: string, flowId: string) {
	return {
		request_id: "test-void-fixture",
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
			name: "Void User",
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
			title: "Void Market",
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
				body: `void argument ${uuidv7()}`,
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

async function setStatus(marketId: string, status: string): Promise<void> {
	await testClient.unsafe(`UPDATE markets SET status = $1 WHERE id = $2`, [
		status,
		marketId,
	]);
}

describe("ENGINE.9 F-RESOLVE-3 — voidMarket (W-3d)", () => {
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

	it("resolution-void::full-refund-and-pool-unwind", async () => {
		const userH = await seedUser("void-h");
		const userI = await seedUser("void-i");
		const marketId = await seedOpenMarketWithPool("void-nosells");
		const betH = await placeBet({
			userId: userH,
			marketId,
			side: "YES",
			stake: "100",
		});
		const betI = await placeBet({
			userId: userI,
			marketId,
			side: "NO",
			stake: "50",
		});

		const inputVoidEventId = uuidv7();
		const result = await voidMarket({
			marketId,
			reason: VOID_REASON,
			voidEventId: inputVoidEventId,
			metadata: adminMetadata(),
		});

		// The §Conservation (iii) no-sells acceptance pins, BOTH exact:
		// Σ refunds == Σ stakes AND unwind == seed — the admin's seed comes
		// back out whole and exits circulation.
		expect(new CpmmDecimal(result.poolUnwindAmount).equals("100")).toBe(true);
		expect(result.betsRefunded).toBe(2);

		const refundRows = await testDb
			.select({
				betId: payoutEvents.betId,
				payoutType: payoutEvents.payoutType,
				amount: payoutEvents.amount,
			})
			.from(payoutEvents)
			.where(eq(payoutEvents.marketId, marketId));
		expect(refundRows.length).toBe(2);
		const amountByBet = new Map(refundRows.map((r) => [r.betId, r.amount]));
		expect(refundRows.every((r) => r.payoutType === "void_refund")).toBe(true);
		expect(amountByBet.get(betH)).toBe("100.000000000000000000");
		expect(amountByBet.get(betI)).toBe("50.000000000000000000");

		// Ledger: full f = 1 refunds restore both users to their grants.
		const refundLedger = await testDb
			.select({
				userId: dharmaLedger.userId,
				betId: dharmaLedger.betId,
				amount: dharmaLedger.amount,
				balanceAfter: dharmaLedger.balanceAfter,
			})
			.from(dharmaLedger)
			.where(eq(dharmaLedger.entryType, "void_refund"));
		expect(refundLedger.length).toBe(2);
		const ledgerByUser = new Map(refundLedger.map((r) => [r.userId, r]));
		expect(ledgerByUser.get(userH)?.amount).toBe("100.000000000000000000");
		expect(ledgerByUser.get(userH)?.balanceAfter).toBe(
			"1000.000000000000000000",
		);
		expect(ledgerByUser.get(userH)?.betId).toBe(betH);
		expect(ledgerByUser.get(userI)?.amount).toBe("50.000000000000000000");
		expect(ledgerByUser.get(userI)?.balanceAfter).toBe(
			"1000.000000000000000000",
		);
		expect(ledgerByUser.get(userI)?.betId).toBe(betI);

		// resolution_events: one terminal `void` row, outcome VOID, reason
		// persisted (R-9.1), corrects NULL.
		const resolutionRows = await testClient.unsafe(
			`SELECT id, event_kind, outcome, corrects_event_id, reason
			 FROM resolution_events WHERE market_id = $1`,
			[marketId],
		);
		expect(resolutionRows.length).toBe(1);
		expect(resolutionRows[0]?.event_kind).toBe("void");
		expect(resolutionRows[0]?.outcome).toBe("VOID");
		expect(resolutionRows[0]?.corrects_event_id).toBeNull();
		expect(resolutionRows[0]?.reason).toBe(VOID_REASON);

		// MEDIUM-1 ruling (a): the response names the resolution_events row
		// id — load-bearing semantics, NOT the caller-minted events-table id.
		expect(result.voidResolutionEventId).toBe(resolutionRows[0]?.id);
		expect(result.voidResolutionEventId).not.toBe(inputVoidEventId);

		// markets: Voided + VOID outcome.
		const [marketRow] = await testDb
			.select({
				status: markets.status,
				resolutionOutcome: markets.resolutionOutcome,
			})
			.from(markets)
			.where(eq(markets.id, marketId));
		expect(marketRow?.status).toBe("Voided");
		expect(marketRow?.resolutionOutcome).toBe("VOID");

		// Terminal emit: market.voided with the R-9.5e poolUnwindAmount.
		const voidedEvents = await testDb
			.select({ payload: events.payload, metadata: events.metadata })
			.from(events)
			.where(eq(events.eventType, "market.voided"));
		expect(voidedEvents.length).toBe(1);
		const payload = voidedEvents[0]?.payload as Record<string, unknown>;
		expect(payload.marketId).toBe(marketId);
		expect(payload.voidReason).toBe(VOID_REASON);
		expect(
			new CpmmDecimal(String(payload.poolUnwindAmount)).equals("100"),
		).toBe(true);
		const metadata = voidedEvents[0]?.metadata as { actor_id?: unknown };
		expect(metadata.actor_id).toBe("admin-singleton");

		// Never-touched surfaces: positions stand (historical records); the
		// pools row is not written; no pool-tag ledger rows (R-9.5/R-2).
		const positionRows = await testDb
			.select({ side: positions.side, quantity: positions.quantity })
			.from(positions)
			.where(eq(positions.marketId, marketId));
		const bySide = new Map(positionRows.map((p) => [p.side, p.quantity]));
		expect(bySide.get("YES")).toBe("150.000000000000000000");
		expect(bySide.get("NO")).toBe("150.000000000000000000");
		const [poolRow] = await testDb
			.select({
				yesReserves: pools.yesReserves,
				noReserves: pools.noReserves,
			})
			.from(pools)
			.where(eq(pools.marketId, marketId));
		expect(poolRow?.yesReserves).toBe("100.000000000000000000");
		expect(poolRow?.noReserves).toBe("100.000000000000000000");
		const poolTagRows = await testDb
			.select({ id: dharmaLedger.id })
			.from(dharmaLedger)
			.where(inArray(dharmaLedger.entryType, ["pool_seed", "pool_unwind"]));
		expect(poolTagRows.length).toBe(0);
	});

	it("resolution-void::after-sells-refunds-f-times-stake-proceeds-stand", async () => {
		const userJ = await seedUser("void-j");
		const marketId = await seedOpenMarketWithPool("void-aftersells");
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
			reason: VOID_REASON,
			voidEventId: uuidv7(),
			metadata: adminMetadata(),
		});

		// unwind = cash − Σ refunds = 200 − 107.142857142857142857 (the
		// cross-assert Y + H_yes == N + H_no held inside the tx — a mismatch
		// would have thrown, not returned).
		expect(result.poolUnwindAmount).toBe("92.857142857142857143");

		// Per-bet refunds: f × stake via the prorate contract over stake
		// weights (100, 50), total T = 107.142857142857142857 — NOT the full
		// stakes (sale proceeds stand; full-stake refund would over-refund
		// the seller by the 50 already credited).
		const betRows = (
			await testDb
				.select({ id: bets.id, stake: bets.stake })
				.from(bets)
				.where(eq(bets.marketId, marketId))
		).sort((a, b) => (a.id < b.id ? -1 : 1));
		const T = "107.142857142857142857";
		const expectedFirst = floor18(
			new CpmmDecimal(T).times(betRows[0]?.stake ?? "0").dividedBy("150"),
		);
		const expectedLast = new CpmmDecimal(T).minus(expectedFirst).toFixed(18);

		const refundRows = await testDb
			.select({ betId: payoutEvents.betId, amount: payoutEvents.amount })
			.from(payoutEvents)
			.where(eq(payoutEvents.marketId, marketId));
		expect(refundRows.length).toBe(2);
		const amountByBet = new Map(refundRows.map((r) => [r.betId, r.amount]));
		expect(amountByBet.get(betRows[0]?.id ?? "")).toBe(expectedFirst);
		expect(amountByBet.get(betRows[1]?.id ?? "")).toBe(expectedLast);
		const sum = refundRows.reduce(
			(acc, r) => acc.plus(r.amount),
			new CpmmDecimal(0),
		);
		expect(sum.toFixed(18)).toBe(T);

		// Ledger closes exactly: 1000 − 150 + 50 (proceeds stand) + T.
		const balanceRows = await testDb
			.select({ balanceAfter: dharmaLedger.balanceAfter })
			.from(dharmaLedger)
			.where(
				and(
					eq(dharmaLedger.userId, userJ),
					eq(dharmaLedger.entryType, "void_refund"),
				),
			);
		expect(balanceRows.length).toBe(2);
		// The chain's terminal balance (decimal max — string sort would
		// mis-order "1007…" vs "971…").
		const finalBalance = balanceRows
			.map((r) => new CpmmDecimal(r.balanceAfter))
			.reduce((a, b) => (a.greaterThan(b) ? a : b))
			.toFixed(18);
		expect(finalBalance).toBe("1007.142857142857142857");
	});

	it("resolution-void::void-from-open-and-from-closed", async () => {
		// R-9.3: void is the pre-resolution exit — BOTH pre-resolution states
		// are legal entry points.
		const openMarket = await seedOpenMarketWithPool("void-from-open");
		const closedMarket = await seedOpenMarketWithPool("void-from-closed");
		await setStatus(closedMarket, "Closed");

		for (const marketId of [openMarket, closedMarket]) {
			await voidMarket({
				marketId,
				reason: VOID_REASON,
				voidEventId: uuidv7(),
				metadata: adminMetadata(),
			});
			const [row] = await testDb
				.select({ status: markets.status })
				.from(markets)
				.where(eq(markets.id, marketId));
			expect(row?.status).toBe("Voided");
		}
	});

	for (const status of ["Resolving", "Resolved", "Voided", "Frozen"] as const) {
		it(`resolution-void::rejected-on-${status.toLowerCase()}`, async () => {
			// R-9.3: NO Resolving→Voided edge ("all shall be resolved" — once
			// the trigger fires, settle is the only exit); terminal states
			// reject trivially.
			const marketId = await seedOpenMarketWithPool(
				`void-neg-${status.toLowerCase()}`,
			);
			await setStatus(marketId, status);

			const caught = await voidMarket({
				marketId,
				reason: VOID_REASON,
				voidEventId: uuidv7(),
				metadata: adminMetadata(),
			}).catch((e: unknown) => e);
			expect(caught).toBeInstanceOf(ResolutionStateError);

			// Nothing written.
			const [marketRow] = await testDb
				.select({ status: markets.status })
				.from(markets)
				.where(eq(markets.id, marketId));
			expect(marketRow?.status).toBe(status);
			const resolutionRows = await testClient.unsafe(
				`SELECT id FROM resolution_events WHERE market_id = $1`,
				[marketId],
			);
			expect(resolutionRows.length).toBe(0);
		});
	}
});
