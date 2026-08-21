import "server-only";

import { and, asc, eq, gt, inArray } from "drizzle-orm";

import type { DbClient, DbTransaction } from "@/db";
import { lots } from "@/db/schema";

import { CANONICAL_ZERO, sumLots } from "./compute";

/**
 * LOTS-1 — **Đa, read from lots** (ADR-0039 D-4).
 *
 *   Đa(user, market) = Σ `lots.surviving_basis` over that holding's SURVIVING lots
 *
 * This replaces the `episodes.ts` walk as the BASIS authority at both of its
 * readers. `computeEpisodes` is not deleted and does not become dead: it keeps
 * the two jobs only it can do — the graph's SideEpisode gap law
 * (`profile/graph-series.ts`, which calls it and never reads `stakedBasis`) and
 * the `openingTradeId` the N-1a argument cell resolves. It is simply no longer
 * on the basis path. (Measured, not assumed — see the LOTS-1 report §S4b.)
 *
 * ⚠ **This is a redefinition, not a refactor.** The two definitions agree for
 * the position-level sell path (by construction — see `allocateProRata`) and
 * for any holding whose lots were all bought at the same price. They diverge
 * the moment a PER-LOT sell targets lots of unequal price, which is the entire
 * point of the feature. ADR-0039 D-4 carries the worked example.
 *
 * **Only surviving lots are summed** (`surviving_shares > 0`, the
 * `lots_surviving_idx` partial index). A Sold lot contributes canonical zero to
 * the basis anyway — `lots_sold_zeroes_basis` guarantees it — so the predicate
 * is an index choice rather than a correctness one; but it also means a
 * fully-exited holding yields NO entry rather than a zero one, which matches
 * both consumers: `loadProfilePositions` filters its domain to `quantity > 0`,
 * and `computeBookmarkFigures` returns 0/0 when the author does not hold.
 *
 * **At most one side can survive per (user, market)**, so grouping by the pair
 * is sound: `positions_one_held_side_idx` permits only one held side, and a
 * flip requires a full exit first — which Sells every lot on the side left
 * behind. The side is therefore not part of the key here, exactly as
 * `loadProfilePositions`' own `heldByMarket` map is keyed on market alone.
 */

/** `${userId}::${marketId}` — the aggregate key. */
export type LotBasisKey = string;

export function lotBasisKey(userId: string, marketId: string): LotBasisKey {
	return `${userId}::${marketId}`;
}

export type LotBasisEntry = {
	/** Đa — Σ surviving basis. */
	survivingBasis: string;
	/** The R2 left-hand side: Σ surviving shares, which must equal `positions.quantity`. */
	survivingShares: string;
};

/**
 * Load Đa for every (user, market) pair in the cross product of `userIds` ×
 * `marketIds` that has at least one surviving lot.
 *
 * Cross-product rather than an exact pair list because both call sites already
 * hold their ids as two flat arrays, and the extra rows are bounded by what a
 * page renders (one user × a few markets for the profile; a page of bookmark
 * authors × their markets for /bookmarks). `lots_user_market_side_idx` leads on
 * `user_id`, so the scan is bounded by the users, not by the table.
 *
 * Returns an EMPTY map for empty inputs — `inArray` with an empty array is a
 * SQL error in some drivers and an always-false predicate in others, and
 * neither is worth finding out at runtime on a page with no positions.
 */
export async function loadLotBasis(
	client: DbClient | DbTransaction,
	args: { userIds: readonly string[]; marketIds: readonly string[] },
): Promise<Map<LotBasisKey, LotBasisEntry>> {
	const byKey = new Map<LotBasisKey, LotBasisEntry>();
	if (args.userIds.length === 0 || args.marketIds.length === 0) {
		return byKey;
	}

	const rows = await client
		.select({
			userId: lots.userId,
			marketId: lots.marketId,
			survivingShares: lots.survivingShares,
			survivingBasis: lots.survivingBasis,
		})
		.from(lots)
		.where(
			and(
				inArray(lots.userId, [...args.userIds]),
				inArray(lots.marketId, [...args.marketIds]),
				gt(lots.survivingShares, CANONICAL_ZERO),
			),
		);

	const grouped = new Map<LotBasisKey, LotBasisEntry[]>();
	for (const r of rows) {
		const key = lotBasisKey(r.userId, r.marketId);
		const list = grouped.get(key) ?? [];
		list.push({
			survivingShares: r.survivingShares,
			survivingBasis: r.survivingBasis,
		});
		grouped.set(key, list);
	}

	// Summed through the SAME tested arithmetic the pure core uses — exact
	// integer addition in 1e-18 units, not a SQL `SUM()` whose decoder shape
	// would be a second thing to get right (`.mapWith` / wire-string drift).
	for (const [key, entries] of grouped) {
		byKey.set(key, sumLots(entries));
	}
	return byKey;
}

/** Đa for one (user, market), or canonical zero when nothing survives. */
export function lotBasisOf(
	byKey: Map<LotBasisKey, LotBasisEntry>,
	userId: string,
	marketId: string,
): string {
	return (
		byKey.get(lotBasisKey(userId, marketId))?.survivingBasis ?? CANONICAL_ZERO
	);
}

/** One lot as the profile decomposition needs it — before masking is applied. */
export type LotDecompositionRow = {
	lotId: string;
	betId: string;
	marketId: string;
	originalBasis: string;
	survivingBasis: string;
	survivingShares: string;
	createdAt: Date;
};

/**
 * Load EVERY lot for `userId` across `marketIds` — surviving **and** Sold.
 *
 * Distinct from `loadLotBasis`, which sums only what survives. The
 * decomposition needs the Sold ones too, because R9 makes Sold permanent and
 * R6 gives it a tag: an argument someone staked on and then exited is part of
 * their record, not an absence. Hiding it would turn the surface back into the
 * aggregate-only view this whole feature exists to replace.
 *
 * Ordered by `(created_at, id)` — the order the arguments were actually made,
 * which is the only ordering a reader can check against their own memory.
 */
export async function loadLotDecomposition(
	client: DbClient | DbTransaction,
	args: { userId: string; marketIds: readonly string[] },
): Promise<Map<string, LotDecompositionRow[]>> {
	const byMarket = new Map<string, LotDecompositionRow[]>();
	if (args.marketIds.length === 0) {
		return byMarket;
	}
	const rows = await client
		.select({
			lotId: lots.id,
			betId: lots.betId,
			marketId: lots.marketId,
			originalBasis: lots.originalBasis,
			survivingBasis: lots.survivingBasis,
			survivingShares: lots.survivingShares,
			createdAt: lots.createdAt,
		})
		.from(lots)
		.where(
			and(
				eq(lots.userId, args.userId),
				inArray(lots.marketId, [...args.marketIds]),
			),
		)
		.orderBy(asc(lots.createdAt), asc(lots.id));

	for (const r of rows) {
		const list = byMarket.get(r.marketId) ?? [];
		list.push(r);
		byMarket.set(r.marketId, list);
	}
	return byMarket;
}
