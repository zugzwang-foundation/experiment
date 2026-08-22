import { and, eq, gt } from "drizzle-orm";

import { lots } from "@/db/schema";
import { allocateProRata, mintLot, sellFromLot } from "@/server/lots/compute";

import type { testDb as TestDb } from "./db";

/**
 * LOTS-1 — lot fixtures for suites that hand-insert `bets` rows instead of
 * driving `place()` (ADR-0039 D-2).
 *
 * A hand-seeded bet with no lot is not a smaller version of a real bet — it is
 * a bet whose Đa is zero, because Đa is now Σ `lots.surviving_basis`. So every
 * fixture that inserts a `bets` row and then asserts anything about a staked
 * figure has to mint the lot the engine would have minted.
 *
 * ⚠ **These helpers route through the SHIPPED pure core** (`mintLot`,
 * `sellFromLot`) rather than writing literal column values. That is the whole
 * point of them: a fixture that computes its own surviving basis is a second
 * implementation of the thing under test, and it will agree with the engine
 * right up until the moment it matters. Here the fixture and production compute
 * the same numbers because they run the same function.
 */

type Db = typeof TestDb;

/** Mint the lot `place()` would have minted for a hand-inserted bet. */
export async function seedLotForBet(
	db: Db,
	args: {
		betId: string;
		userId: string;
		marketId: string;
		side: "YES" | "NO";
		shares: string;
		stake: string;
	},
): Promise<void> {
	const minted = mintLot({ shares: args.shares, stake: args.stake });
	await db.insert(lots).values({
		betId: args.betId,
		userId: args.userId,
		marketId: args.marketId,
		side: args.side,
		originalShares: minted.originalShares,
		originalBasis: minted.originalBasis,
		survivingShares: minted.survivingShares,
		survivingBasis: minted.survivingBasis,
	});
}

/**
 * Apply to a HOLDING exactly what a position-level sell of `sharesSold` does:
 * allocate across its surviving lots pro-rata and reduce each (ADR-0039 D-3
 * shape 2). For fixtures that simulate a sell by hand — a `bet.sold` event plus
 * a `positions` update — instead of driving the engine.
 *
 * ⚠ **Call this from the fixture's `seedSell`, not from individual tests.**
 * Wiring it at the seam means every simulated sell in a suite reduces its lots,
 * including the ones whose assertions do not currently read Đa. A fixture that
 * seeds a sell without it leaves lots intact while `positions.quantity` drops —
 * which is precisely the drift `I-LOT-SUM-001` forbids, sitting in the test
 * corpus waiting for a later assertion to trip over it.
 *
 * A no-op when the holding has no surviving lots, so a suite that never mints
 * one is unaffected.
 */
export async function seedLotPositionSale(
	db: Db,
	args: { userId: string; marketId: string; sharesSold: string },
): Promise<void> {
	const rows = await db
		.select({
			betId: lots.betId,
			originalShares: lots.originalShares,
			originalBasis: lots.originalBasis,
			survivingShares: lots.survivingShares,
			survivingBasis: lots.survivingBasis,
		})
		.from(lots)
		.where(
			and(
				eq(lots.userId, args.userId),
				eq(lots.marketId, args.marketId),
				gt(lots.survivingShares, "0.000000000000000000"),
			),
		);
	if (rows.length === 0) {
		return;
	}

	const allocation = allocateProRata({
		lots: rows,
		sharesToSell: args.sharesSold,
	});

	for (const [i, row] of rows.entries()) {
		const sharesToSell = allocation[i] as string;
		if (sharesToSell === "0.000000000000000000") {
			continue;
		}
		const after = sellFromLot({ lot: row, sharesToSell });
		await db
			.update(lots)
			.set({
				survivingShares: after.survivingShares,
				survivingBasis: after.survivingBasis,
			})
			.where(eq(lots.betId, row.betId));
	}
}

/**
 * Sell `sharesToSell` out of ONE lot, named by its bet id — the per-lot path
 * (ADR-0039 D-3 shape 1), for fixtures that need one argument reduced while its
 * siblings stay exactly as they were.
 *
 * Routes through the shipped `sellFromLot`, so a fixture cannot drift from the
 * engine's reduction rule.
 */
export async function seedLotSaleForBetId(
	db: Db,
	args: { betId: string; sharesToSell: string },
): Promise<void> {
	const [row] = await db
		.select({
			originalShares: lots.originalShares,
			originalBasis: lots.originalBasis,
			survivingShares: lots.survivingShares,
			survivingBasis: lots.survivingBasis,
		})
		.from(lots)
		.where(eq(lots.betId, args.betId));
	if (row === undefined) {
		throw new Error(`seedLotSaleForBetId: no lot for bet ${args.betId}`);
	}
	const after = sellFromLot({ lot: row, sharesToSell: args.sharesToSell });
	await db
		.update(lots)
		.set({
			survivingShares: after.survivingShares,
			survivingBasis: after.survivingBasis,
		})
		.where(eq(lots.betId, args.betId));
}
