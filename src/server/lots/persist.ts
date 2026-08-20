import "server-only";

import { and, asc, eq, gt, sql } from "drizzle-orm";

import type { DbTransaction } from "@/db";
import { lots } from "@/db/schema";
import {
	InsufficientSharesError,
	LotNotFoundError,
} from "@/server/bets/errors";
import { CpmmDecimal } from "@/server/cpmm/decimal";

import {
	allocateProRata,
	CANONICAL_ZERO,
	mintLot,
	sellFromLot,
} from "./compute";

/**
 * LOTS-1 — the lot MINT (ADR-0039 D-2 / R1).
 *
 * The SINGLE site where a `lots` row is created, and it takes a transaction
 * rather than the top-level `db` handle so passing the wrong one is a compile
 * error (the `positions/persist.ts` and `dharma/persist.ts` precedent). That
 * matters more here than it usually does: a lot minted outside the W-1
 * transaction would survive a rollback and leave an orphan pointing at a bet
 * that never committed — which the `lots_bet_id_bets_id_fk` FK would reject at
 * insert time, but only by accident of ordering rather than by design.
 *
 * There is no second mint site and there must not be one. A lot exists if and
 * only if a bet exists (`lots_bet_id_uq` + the FK), and bets are minted in
 * exactly one place — so R1's one-to-one is closed at the schema, and this
 * function is the only thing that has to be right for it to stay closed.
 *
 * ⚠ **No `onConflictDoUpdate`, deliberately.** A duplicate mint for one bet is
 * not a race to absorb — it is a caller bug, and the 23505 on `lots_bet_id_uq`
 * aborts the whole SERIALIZABLE transaction, which is exactly the outcome
 * wanted: the bet does not commit either. Swallowing the conflict would let a
 * second lot silently replace the first and change a participant's basis.
 */
export async function mintLotForBet(
	tx: DbTransaction,
	args: {
		betId: string;
		userId: string;
		marketId: string;
		side: "YES" | "NO";
		/** `bets.share_quantity` — what this argument's stake actually bought. */
		shares: string;
		/** `bets.stake` — the ADR-0018-floored stake behind this argument. */
		stake: string;
	},
): Promise<void> {
	// Canonicalize + validate through the pure core, so the row that reaches
	// storage has already satisfied the CHECK constraints it is about to meet.
	// A `LotInputError` here is a caller bug surfacing before the write, not
	// after it.
	const minted = mintLot({ shares: args.shares, stake: args.stake });

	await tx.insert(lots).values({
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
 * One lot's share of a sale — what `planLotSale` decided and `applyLotSale`
 * will write.
 */
export type PlannedLotSale = {
	lotId: string;
	sharesToSell: string;
	survivingShares: string;
	survivingBasis: string;
};

/**
 * PLAN a sale against a holding's lots — the PRE-CHECK half (ADR-0039 D-3).
 *
 * Reads and validates; writes nothing. Split from `applyLotSale` so a per-lot
 * oversell is refused BEFORE any row moves, which is what makes it a clean 400
 * rather than a rollback that happens to produce the right outcome. (The
 * transaction would have unwound either way — but "the pre-check ran" and "the
 * abort cleaned up" are different guarantees, and only the first tells a
 * participant what they did wrong.)
 *
 * **Two shapes, per R3:**
 *
 * - `lotId` given — a PER-LOT sell. Exactly one lot is reduced. The ceiling is
 *   THAT lot's surviving shares, never the position's: a holding can have
 *   plenty left while the named argument has nothing, and without this check
 *   that case would sail past the position-level pre-check and land on a
 *   `lots_surviving_shares_non_negative` 23514 — a 500 for ordinary input.
 * - `lotId` null — the POSITION-level sell. Every surviving lot is reduced
 *   pro-rata by `allocateProRata`, which allocates the total EXACTLY so
 *   `Σ surviving lot shares` still equals `positions.quantity` afterwards (R2).
 *   `shares == positions.quantity` is the R3 "sell all" case and falls out:
 *   every lot takes the full-sale branch and every lot ends Sold.
 *
 * Lots are ordered by `(created_at, id)` — deterministic, and the order matters
 * because `allocateProRata`'s largest-remainder tiebreak is positional.
 *
 * No row lock is taken. The W-1 wrapper already holds `FOR NO KEY UPDATE` on
 * the pool row, which serializes every write for this `(user, market)` — the
 * same reasoning `upsertPositionDelta` records for skipping its own lock.
 */
export async function planLotSale(
	tx: DbTransaction,
	args: {
		userId: string;
		marketId: string;
		side: "YES" | "NO";
		sharesToSell: string;
		lotId: string | null;
	},
): Promise<PlannedLotSale[]> {
	if (args.lotId !== null) {
		const [row] = await tx
			.select({
				id: lots.id,
				originalShares: lots.originalShares,
				originalBasis: lots.originalBasis,
				survivingShares: lots.survivingShares,
				survivingBasis: lots.survivingBasis,
			})
			.from(lots)
			.where(
				and(
					eq(lots.id, args.lotId),
					eq(lots.userId, args.userId),
					eq(lots.marketId, args.marketId),
				),
			)
			.limit(1);
		// Scoped by user AND market, so another participant's lot id is "not
		// found" rather than "forbidden" — the id itself stays unconfirmable.
		if (row === undefined) {
			throw new LotNotFoundError();
		}
		// THE PER-LOT OVERSELL PRE-CHECK. Also the Sold-lot refusal (R9): a Sold
		// lot has zero surviving shares, so every positive request exceeds it.
		if (new CpmmDecimal(args.sharesToSell).greaterThan(row.survivingShares)) {
			throw new InsufficientSharesError({
				held: row.survivingShares,
				requested: args.sharesToSell,
			});
		}
		const after = sellFromLot({ lot: row, sharesToSell: args.sharesToSell });
		return [
			{
				lotId: row.id,
				sharesToSell: args.sharesToSell,
				survivingShares: after.survivingShares,
				survivingBasis: after.survivingBasis,
			},
		];
	}

	const rows = await tx
		.select({
			id: lots.id,
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
				eq(lots.side, args.side),
				gt(lots.survivingShares, CANONICAL_ZERO),
			),
		)
		.orderBy(asc(lots.createdAt), asc(lots.id));

	if (rows.length === 0) {
		// NO LOTS, AND THE SELL PROCEEDS ANYWAY. This is deliberate, and it is the
		// one place where getting the direction wrong would be dangerous.
		//
		// R2: "`positions` SURVIVES as aggregate authority … Lots are attribution
		// BENEATH." An attribution layer must never be able to veto the authority
		// it describes. If this threw, then any drift between `lots` and
		// `positions` — a bug, a half-applied migration, a hand-seeded row —
		// would LOCK A PARTICIPANT OUT OF EXITING A POSITION THEY HOLD, trapping
		// their Dharma behind a bookkeeping disagreement. That is a far worse
		// failure than incomplete attribution, and it is the failure the naive
		// reading produces.
		//
		// So: nothing to attribute, nothing to reduce, sell continues. The drift
		// itself is not swallowed — `I-LOT-SUM-001` asserts the equality against
		// live data, which is where a real divergence should surface.
		//
		// ⚠ The PER-LOT path above still refuses, and must: there the lot IS the
		// subject of the request, so a bad or empty id is a wrong request rather
		// than missing bookkeeping.
		return [];
	}

	const allocation = allocateProRata({
		lots: rows,
		sharesToSell: args.sharesToSell,
	});

	const planned: PlannedLotSale[] = [];
	for (const [i, row] of rows.entries()) {
		const sharesToSell = allocation[i] as string;
		if (sharesToSell === CANONICAL_ZERO) {
			continue;
		}
		const after = sellFromLot({ lot: row, sharesToSell });
		planned.push({
			lotId: row.id,
			sharesToSell,
			survivingShares: after.survivingShares,
			survivingBasis: after.survivingBasis,
		});
	}
	return planned;
}

/**
 * APPLY a planned sale — the WRITE half. One UPDATE per reduced lot, inside the
 * caller's W-1 transaction, so the whole multi-lot sale commits or unwinds
 * together (R3: "ONE atomic multi-lot sell in a single DB transaction").
 */
export async function applyLotSale(
	tx: DbTransaction,
	planned: readonly PlannedLotSale[],
): Promise<void> {
	for (const p of planned) {
		await tx
			.update(lots)
			.set({
				survivingShares: p.survivingShares,
				survivingBasis: p.survivingBasis,
				updatedAt: sql`now()`,
			})
			.where(eq(lots.id, p.lotId));
	}
}
