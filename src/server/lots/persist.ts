import "server-only";

import type { DbTransaction } from "@/db";
import { lots } from "@/db/schema";

import { mintLot } from "./compute";

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
