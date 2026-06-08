import "server-only";

import { and, eq, sql } from "drizzle-orm";

import type { DbClient, DbTransaction } from "@/db";
import { positions } from "@/db/schema";

import { PositionSingleSideError } from "./errors";

/** A bound read client — top-level `db` OR the caller's transaction. */
type PositionReader = DbClient | DbTransaction;

/**
 * The user's currently HELD position in a market (`quantity > 0`), or `null`.
 * Asserts `≤ 1` held row — defense-in-depth; the structural guarantee is
 * `positions_one_held_side_idx` (R-5). If that index is somehow absent and two
 * held rows exist, throws `PositionSingleSideError` (mirrors D3 — re-verifies a
 * structural guarantee at read time). The `quantity > 0` predicate matches the
 * partial-index predicate exactly.
 */
export async function getHeldPosition(
	client: PositionReader,
	args: { userId: string; marketId: string },
): Promise<{ side: "YES" | "NO"; quantity: string } | null> {
	const rows = await client
		.select({ side: positions.side, quantity: positions.quantity })
		.from(positions)
		.where(
			and(
				eq(positions.userId, args.userId),
				eq(positions.marketId, args.marketId),
				sql`${positions.quantity} > 0`,
			),
		);

	if (rows.length > 1) {
		throw new PositionSingleSideError(
			`>1 held position for (user=${args.userId}, market=${args.marketId}) — single-side structural guard absent`,
		);
	}
	const row = rows[0];
	return row ? { side: row.side, quantity: row.quantity } : null;
}

/** F-BET-1 entry pre-condition: no held position on either side. */
export async function canEnter(
	client: PositionReader,
	args: { userId: string; marketId: string },
): Promise<boolean> {
	return (await getHeldPosition(client, args)) === null;
}

/**
 * The current held side, or `null` — F-BET-2 (same-side add) / F-BET-10
 * (opposite-side rejected) / F-COMMENT-5 (no-stake-no-voice) / `computeMarker`
 * input.
 */
export async function heldSideOrNull(
	client: PositionReader,
	args: { userId: string; marketId: string },
): Promise<"YES" | "NO" | null> {
	return (await getHeldPosition(client, args))?.side ?? null;
}
