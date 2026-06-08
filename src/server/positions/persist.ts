import "server-only";

import { and, eq, sql } from "drizzle-orm";

import type { DbTransaction } from "@/db";
import { positions } from "@/db/schema";

import { applyPositionDelta } from "./compute";
import { PositionSingleSideError } from "./errors";

const CANONICAL_ZERO = "0.000000000000000000";

/**
 * Upsert a signed share delta into the caller's `(user, market, side)` position
 * — INSIDE the caller's W-1 transaction (ADR-0013; compile-error to pass
 * top-level `db`, the `dharma/persist.ts` precedent). The SINGLE gate every
 * `positions` write passes through (binds E.7/8; resolution never writes
 * positions — R-4). The caller owns serialization: the W-1 pool-row
 * `FOR NO KEY UPDATE` already serializes per `(user, market)`, so no
 * `FOR NO KEY UPDATE` is taken here.
 *
 * Reads ONLY the current `(user, market, side)` quantity — SKIPPED when
 * `previousQuantity` is supplied (the dharma A3 chaining shape, for >1 mutation
 * on one `(user, market, side)` in one tx; `now()` is tx-frozen so a re-read
 * would mis-order). Computes via `applyPositionDelta` (oversell-guarded —
 * `PositionOversellError` mirrors the storage CHECK), then UPSERTs on the built
 * `positions_user_market_side_idx`, setting `updated_at = now()` explicitly
 * (Drizzle 0.45 won't auto-bump on UPDATE).
 *
 * No opposite-side read (the hot path stays one read): a flip-order violation
 * surfaces as the `positions_one_held_side_idx` 23505, caught here and
 * re-thrown as `PositionSingleSideError`. The friendly F-BET-10
 * `opposite_side_held` 400 is the handler-layer read predicate's job
 * (`heldSideOrNull`, E.7/8).
 */
export async function upsertPositionDelta(
	tx: DbTransaction,
	args: {
		userId: string;
		marketId: string;
		side: "YES" | "NO";
		shareDelta: string;
		previousQuantity?: string;
	},
): Promise<{ side: "YES" | "NO"; quantity: string }> {
	const previousQuantity =
		args.previousQuantity ?? (await readQuantity(tx, args));

	const quantity = applyPositionDelta({
		previousQuantity,
		shareDelta: args.shareDelta,
	});

	try {
		const rows = await tx
			.insert(positions)
			.values({
				userId: args.userId,
				marketId: args.marketId,
				side: args.side,
				quantity,
			})
			.onConflictDoUpdate({
				target: [positions.userId, positions.marketId, positions.side],
				set: { quantity, updatedAt: sql`now()` },
			})
			.returning({ side: positions.side, quantity: positions.quantity });

		const row = rows[0];
		if (row === undefined) {
			throw new Error(
				"upsertPositionDelta: UPSERT … RETURNING produced no row",
			);
		}
		return { side: row.side, quantity: row.quantity };
	} catch (e) {
		if (isSingleSideViolation(e)) {
			throw new PositionSingleSideError(
				`single-side violation: a held opposite side already exists for (user=${args.userId}, market=${args.marketId})`,
			);
		}
		throw e;
	}
}

/** The current `(user, market, side)` quantity, or canonical zero (new row). */
async function readQuantity(
	tx: DbTransaction,
	args: { userId: string; marketId: string; side: "YES" | "NO" },
): Promise<string> {
	const rows = await tx
		.select({ quantity: positions.quantity })
		.from(positions)
		.where(
			and(
				eq(positions.userId, args.userId),
				eq(positions.marketId, args.marketId),
				eq(positions.side, args.side),
			),
		)
		.limit(1);
	return rows[0]?.quantity ?? CANONICAL_ZERO;
}

/**
 * Postgres unique-violation on the single-side partial index. Reads the
 * driver error shape at the trust boundary (the `auth/admin/login.ts:86`
 * precedent for SQLSTATE inspection).
 */
function isSingleSideViolation(e: unknown): boolean {
	const err = e as { code?: unknown; constraint_name?: unknown };
	return (
		err.code === "23505" &&
		err.constraint_name === "positions_one_held_side_idx"
	);
}
