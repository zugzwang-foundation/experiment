import { and, eq } from "drizzle-orm";
import { v7 as uuidv7 } from "uuid";
import { afterEach, describe, expect, it } from "vitest";

import {
	betReceipts,
	lots,
	markets,
	pools,
	positions,
	users,
} from "@/db/schema";
import {
	InsufficientSharesError,
	LotNotFoundError,
} from "@/server/bets/errors";
import { place } from "@/server/bets/place";
import { sell } from "@/server/bets/sell";
import { runBetTransaction } from "@/server/bets/transaction";

import { testClient, testDb } from "../../db/_fixtures/db";
import { truncateTables } from "../../db/_fixtures/truncate";

/**
 * LOTS-1 Slice 5 — the SELL (ADR-0039 D-3 / R3, R6, R9). DB-BACKED.
 * Tests-first per CLAUDE.md §5.6 — this is the `src/server/bets/` critical path.
 *
 * Before this slice a real sell reduced `positions` and left `lots` untouched,
 * so **every engine sell broke R2**. The first test here is that fact, stated
 * as the thing that must now hold.
 */

const SEED = "1000.000000000000000000";
const units = (v: string): bigint => BigInt(v.replace(".", ""));

const TABLES = [
	"lots",
	"bets",
	"comments",
	"positions",
	"dharma_ledger",
	"events",
	"bet_receipts",
	"pools",
	"markets",
	"users",
];

function meta(userId: string, flowId: string) {
	return {
		request_id: "test-lots-sell",
		flow_id: flowId,
		user_id: userId,
		actor_id: userId,
		idempotency_key: null,
		ip: "test",
		user_agent: "vitest",
	};
}

async function seedUser(tag: string, grant: string): Promise<string> {
	const [user] = await testDb
		.insert(users)
		.values({
			name: "Lot Sell User",
			email: `${tag}@example.com`,
			pseudonym: tag,
			tosAcceptedAt: new Date("2026-01-01T00:00:00Z"),
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
			title: "Lot Sell Market",
			status: "Open",
			resolutionDeadline: new Date("2026-11-01T00:00:00Z"),
		})
		.returning({ id: markets.id });
	const marketId = market?.id ?? "";
	await testDb
		.insert(pools)
		.values({ marketId, yesReserves: SEED, noReserves: SEED });
	return marketId;
}

async function placeBet(args: {
	userId: string;
	marketId: string;
	side: "YES" | "NO";
	stake: string;
}): Promise<string> {
	const r = await runBetTransaction(
		{ marketId: args.marketId, flow: "F-BET-1" },
		(ctx) =>
			place(ctx, {
				userId: args.userId,
				marketId: args.marketId,
				side: args.side,
				stake: args.stake,
				body: `lot sell argument ${uuidv7()}`,
				parentCommentId: null,
				idempotencyKey: uuidv7(),
				bodyFingerprint: uuidv7(),
				betEventId: uuidv7(),
				commentEventId: uuidv7(),
				creditEventId: uuidv7(),
				metadata: meta(args.userId, "F-BET-1"),
			}),
	);
	return r.betId;
}

async function doSell(args: {
	userId: string;
	marketId: string;
	shares: string;
	lotId?: string;
}) {
	return runBetTransaction(
		{ marketId: args.marketId, flow: "F-BET-3" },
		(ctx) =>
			sell(ctx, {
				userId: args.userId,
				marketId: args.marketId,
				shares: args.shares,
				lotId: args.lotId ?? null,
				sellEventId: uuidv7(),
				syntheticBetId: uuidv7(),
				idempotencyKey: uuidv7(),
				bodyFingerprint: uuidv7(),
				metadata: meta(args.userId, "F-BET-3"),
			}),
	);
}

async function lotRows(userId: string) {
	return testDb
		.select()
		.from(lots)
		.where(eq(lots.userId, userId))
		.orderBy(lots.createdAt);
}

async function positionQty(userId: string, marketId: string): Promise<bigint> {
	const rows = await testDb
		.select({ quantity: positions.quantity })
		.from(positions)
		.where(and(eq(positions.userId, userId), eq(positions.marketId, marketId)));
	return units(rows[0]?.quantity ?? "0.000000000000000000");
}

async function lotShareSum(userId: string): Promise<bigint> {
	const rows = await lotRows(userId);
	return rows.reduce((acc, r) => acc + units(r.survivingShares), BigInt(0));
}

describe("LOTS-1 Slice 5 — per-lot sell + atomic multi-lot sell (ADR-0039 D-3)", () => {
	afterEach(async () => {
		await truncateTables(testClient, TABLES);
	});

	it("a POSITION-level partial sell keeps Σ lot shares == positions.quantity (R2)", async () => {
		// THE REGRESSION THIS SLICE EXISTS FOR. Before it, sell() moved
		// `positions` and left `lots` alone, so this equality broke on the first
		// sell any participant ever made.
		const userId = await seedUser("lotsell1", "5000");
		const marketId = await seedOpenMarketWithPool("lot-sell-1");
		await placeBet({ userId, marketId, side: "YES", stake: "100" });
		await placeBet({ userId, marketId, side: "YES", stake: "300" });

		const before = await positionQty(userId, marketId);
		const toSell = before / BigInt(4);
		const toSellStr = `${toSell / BigInt(10) ** BigInt(18)}.${(toSell % BigInt(10) ** BigInt(18)).toString().padStart(18, "0")}`;
		await doSell({ userId, marketId, shares: toSellStr });

		expect(await lotShareSum(userId)).toBe(await positionQty(userId, marketId));
	});

	it("a POSITION-level partial sell reduces EVERY lot pro-rata, none to zero", async () => {
		const userId = await seedUser("lotsell2", "5000");
		const marketId = await seedOpenMarketWithPool("lot-sell-2");
		await placeBet({ userId, marketId, side: "YES", stake: "100" });
		await placeBet({ userId, marketId, side: "YES", stake: "300" });

		const before = await lotRows(userId);
		const half = await positionQty(userId, marketId);
		const halfStr = `${half / BigInt(2) / BigInt(10) ** BigInt(18)}.${((half / BigInt(2)) % BigInt(10) ** BigInt(18)).toString().padStart(18, "0")}`;
		await doSell({ userId, marketId, shares: halfStr });

		const after = await lotRows(userId);
		expect(after).toHaveLength(2);
		for (const [i, row] of after.entries()) {
			const wasShares = units(
				(before[i] as { survivingShares: string }).survivingShares,
			);
			const wasBasis = units(
				(before[i] as { survivingBasis: string }).survivingBasis,
			);
			// Both reduced, neither zeroed — R6: a partially-sold lot is NOT Sold.
			expect(units(row.survivingShares) < wasShares).toBe(true);
			expect(units(row.survivingShares) > BigInt(0)).toBe(true);
			expect(units(row.survivingBasis) < wasBasis).toBe(true);
			expect(units(row.survivingBasis) > BigInt(0)).toBe(true);
		}
	});

	it("SELL-ALL Sells every lot and zeroes Đa, in one transaction (R3/R6/R10)", async () => {
		const userId = await seedUser("lotsell3", "5000");
		const marketId = await seedOpenMarketWithPool("lot-sell-3");
		await placeBet({ userId, marketId, side: "YES", stake: "40" });
		await placeBet({ userId, marketId, side: "YES", stake: "50" });
		await placeBet({ userId, marketId, side: "YES", stake: "500" });

		const qty = await positionQty(userId, marketId);
		const qtyStr = `${qty / BigInt(10) ** BigInt(18)}.${(qty % BigInt(10) ** BigInt(18)).toString().padStart(18, "0")}`;
		await doSell({ userId, marketId, shares: qtyStr });

		const after = await lotRows(userId);
		expect(after).toHaveLength(3);
		for (const row of after) {
			expect(row.survivingShares).toBe("0.000000000000000000");
			expect(row.survivingBasis).toBe("0.000000000000000000");
		}
		expect(await positionQty(userId, marketId)).toBe(BigInt(0));
	});

	it("a PER-LOT sell reduces ONLY the named lot (R3)", async () => {
		// The whole point of the feature: exiting one argument must leave the
		// others exactly as they were.
		const userId = await seedUser("lotsell4", "5000");
		const marketId = await seedOpenMarketWithPool("lot-sell-4");
		const betA = await placeBet({
			userId,
			marketId,
			side: "YES",
			stake: "100",
		});
		await placeBet({ userId, marketId, side: "YES", stake: "300" });

		const before = await lotRows(userId);
		const lotA = before.find((r) => r.betId === betA);
		const lotB = before.find((r) => r.betId !== betA);

		await doSell({
			userId,
			marketId,
			shares: lotA?.survivingShares ?? "0",
			lotId: lotA?.id,
		});

		const after = await lotRows(userId);
		const afterA = after.find((r) => r.id === lotA?.id);
		const afterB = after.find((r) => r.id === lotB?.id);

		// A is Sold — exactly zero on both columns.
		expect(afterA?.survivingShares).toBe("0.000000000000000000");
		expect(afterA?.survivingBasis).toBe("0.000000000000000000");
		// B is untouched, byte-for-byte.
		expect(afterB?.survivingShares).toBe(lotB?.survivingShares);
		expect(afterB?.survivingBasis).toBe(lotB?.survivingBasis);
		// And R2 still holds.
		expect(await lotShareSum(userId)).toBe(await positionQty(userId, marketId));
	});

	it("a PER-LOT partial sell leaves the lot reduced and UNTAGGED (R6)", async () => {
		const userId = await seedUser("lotsell5", "5000");
		const marketId = await seedOpenMarketWithPool("lot-sell-5");
		const betA = await placeBet({
			userId,
			marketId,
			side: "YES",
			stake: "100",
		});
		await placeBet({ userId, marketId, side: "YES", stake: "300" });

		const before = await lotRows(userId);
		const lotA = before.find((r) => r.betId === betA);
		const halfOfA = units(lotA?.survivingShares ?? "0") / BigInt(2);
		const halfStr = `${halfOfA / BigInt(10) ** BigInt(18)}.${(halfOfA % BigInt(10) ** BigInt(18)).toString().padStart(18, "0")}`;

		await doSell({ userId, marketId, shares: halfStr, lotId: lotA?.id });

		const afterA = (await lotRows(userId)).find((r) => r.id === lotA?.id);
		expect(units(afterA?.survivingShares ?? "0") > BigInt(0)).toBe(true);
		expect(units(afterA?.survivingBasis ?? "0") > BigInt(0)).toBe(true);
		expect(await lotShareSum(userId)).toBe(await positionQty(userId, marketId));
	});

	it("PER-LOT OVERSELL PRE-CHECK: the ceiling is the LOT, not the position", async () => {
		// The position holds plenty; the named lot does not. Without a per-lot
		// pre-check this would pass the position-level check, then either
		// oversell the lot or trip a 23514 as a 500.
		const userId = await seedUser("lotsell6", "5000");
		const marketId = await seedOpenMarketWithPool("lot-sell-6");
		const betA = await placeBet({
			userId,
			marketId,
			side: "YES",
			stake: "100",
		});
		await placeBet({ userId, marketId, side: "YES", stake: "3000" });

		const lotA = (await lotRows(userId)).find((r) => r.betId === betA);
		const overA = units(lotA?.survivingShares ?? "0") + BigInt(1);
		const overStr = `${overA / BigInt(10) ** BigInt(18)}.${(overA % BigInt(10) ** BigInt(18)).toString().padStart(18, "0")}`;

		await expect(
			doSell({ userId, marketId, shares: overStr, lotId: lotA?.id }),
		).rejects.toBeInstanceOf(InsufficientSharesError);

		// Nothing moved.
		const after = (await lotRows(userId)).find((r) => r.id === lotA?.id);
		expect(after?.survivingShares).toBe(lotA?.survivingShares);
	});

	it("refuses a lotId belonging to ANOTHER user (404, not someone else's lot)", async () => {
		const owner = await seedUser("lotsell7a", "5000");
		const stranger = await seedUser("lotsell7b", "5000");
		const marketId = await seedOpenMarketWithPool("lot-sell-7");
		const ownerBet = await placeBet({
			userId: owner,
			marketId,
			side: "YES",
			stake: "100",
		});
		await placeBet({ userId: stranger, marketId, side: "YES", stake: "100" });

		const ownerLot = (await lotRows(owner)).find((r) => r.betId === ownerBet);

		await expect(
			doSell({
				userId: stranger,
				marketId,
				shares: "1.000000000000000000",
				lotId: ownerLot?.id,
			}),
		).rejects.toBeInstanceOf(LotNotFoundError);
	});

	it("refuses a PER-LOT sell from an already-Sold lot — Sold is permanent (R9)", async () => {
		const userId = await seedUser("lotsell8", "5000");
		const marketId = await seedOpenMarketWithPool("lot-sell-8");
		const betA = await placeBet({
			userId,
			marketId,
			side: "YES",
			stake: "100",
		});
		await placeBet({ userId, marketId, side: "YES", stake: "300" });

		const lotA = (await lotRows(userId)).find((r) => r.betId === betA);
		await doSell({
			userId,
			marketId,
			shares: lotA?.survivingShares ?? "0",
			lotId: lotA?.id,
		});

		await expect(
			doSell({
				userId,
				marketId,
				shares: "1.000000000000000000",
				lotId: lotA?.id,
			}),
		).rejects.toBeInstanceOf(InsufficientSharesError);
	});

	it("leaves the bet_receipts shape unchanged (the kickoff's explicit constraint)", async () => {
		const userId = await seedUser("lotsell9", "5000");
		const marketId = await seedOpenMarketWithPool("lot-sell-9");
		const betA = await placeBet({
			userId,
			marketId,
			side: "YES",
			stake: "100",
		});
		const lotA = (await lotRows(userId)).find((r) => r.betId === betA);

		const result = await doSell({
			userId,
			marketId,
			shares: lotA?.survivingShares ?? "0",
			lotId: lotA?.id,
		});

		expect(Object.keys(result).sort()).toEqual(
			["dharmaReturned", "newPrice", "sharesSold"].sort(),
		);

		const [receipt] = await testDb
			.select()
			.from(betReceipts)
			.where(eq(betReceipts.flow, "sell"));
		expect(receipt?.flow).toBe("sell");
		expect(Object.keys(receipt?.result as object).sort()).toEqual(
			["dharmaReturned", "newPrice", "sharesSold"].sort(),
		);
	});

	it("rolls lots back with the position when the transaction aborts", async () => {
		const userId = await seedUser("lotsell10", "5000");
		const marketId = await seedOpenMarketWithPool("lot-sell-10");
		await placeBet({ userId, marketId, side: "YES", stake: "100" });

		const before = await lotRows(userId);
		const qty = await positionQty(userId, marketId);
		const half = qty / BigInt(2);
		const halfStr = `${half / BigInt(10) ** BigInt(18)}.${(half % BigInt(10) ** BigInt(18)).toString().padStart(18, "0")}`;

		await expect(
			runBetTransaction({ marketId, flow: "F-BET-3" }, async (ctx) => {
				await sell(ctx, {
					userId,
					marketId,
					shares: halfStr,
					lotId: null,
					sellEventId: uuidv7(),
					syntheticBetId: uuidv7(),
					idempotencyKey: uuidv7(),
					bodyFingerprint: uuidv7(),
					metadata: meta(userId, "F-BET-3"),
				});
				throw new Error("forced abort after the sell spine");
			}),
		).rejects.toThrow("forced abort after the sell spine");

		const after = await lotRows(userId);
		expect(after[0]?.survivingShares).toBe(before[0]?.survivingShares);
		expect(after[0]?.survivingBasis).toBe(before[0]?.survivingBasis);
	});
});

describe("LOTS-1 Slice 5 — attribution never vetoes the authority (R2)", () => {
	afterEach(async () => {
		await truncateTables(testClient, TABLES);
	});

	it("a POSITION-level sell still works when the holding has NO lots", async () => {
		// ⚠ THE SAFETY PROPERTY, not a convenience. R2 makes `positions` the
		// aggregate authority and lots "attribution beneath" it. If a missing or
		// drifted lot could refuse this sell, a bookkeeping disagreement would
		// TRAP A PARTICIPANT'S DHARMA in a position they hold and cannot exit.
		//
		// The position is seeded directly — no bet, so no lot can exist — which is
		// also exactly the shape several shipped sell suites use to test unrelated
		// mechanics. Four of them went red before this was corrected.
		const userId = await seedUser("lotsell11", "5000");
		const marketId = await seedOpenMarketWithPool("lot-sell-11");
		await testDb.insert(positions).values({
			userId,
			marketId,
			side: "YES",
			quantity: "50.000000000000000000",
		});

		const result = await doSell({
			userId,
			marketId,
			shares: "20.000000000000000000",
		});

		expect(result.sharesSold).toBe("20.000000000000000000");
		expect(await positionQty(userId, marketId)).toBe(
			units("30.000000000000000000"),
		);
		expect(await lotRows(userId)).toHaveLength(0);
	});

	it("a PER-LOT sell still refuses an unknown lot — there the lot IS the request", async () => {
		const userId = await seedUser("lotsell12", "5000");
		const marketId = await seedOpenMarketWithPool("lot-sell-12");
		await testDb.insert(positions).values({
			userId,
			marketId,
			side: "YES",
			quantity: "50.000000000000000000",
		});

		await expect(
			doSell({
				userId,
				marketId,
				shares: "1.000000000000000000",
				lotId: "01a01181-0000-7000-8000-000000000000",
			}),
		).rejects.toBeInstanceOf(LotNotFoundError);
	});
});
