import "server-only";

import { eq } from "drizzle-orm";

import type { DbTransaction } from "@/db";
import { betReceipts, pools } from "@/db/schema";
import { computeSell, type Side } from "@/server/cpmm/calculate";
import { CpmmDecimal } from "@/server/cpmm/decimal";
import { appendLedgerRow } from "@/server/dharma/persist";
import { insertEvent } from "@/server/events/insert";
import { upsertPositionDelta } from "@/server/positions/persist";
import { getHeldPosition } from "@/server/positions/read";

import type { BetEventMetadata } from "./endpoint";
import { InsufficientSharesError, PositionNotHeldError } from "./errors";
import type { LockedPool } from "./transaction";

export interface SellParams {
	userId: string;
	marketId: string;
	shares: string;
	/** Generated at handler entry, closed over (retry-purity). */
	sellEventId: string;
	/** A fresh UUIDv7 — the synthetic sale id for `bet.sold.payload.betId` (no bets row). */
	syntheticBetId: string;
	/** AUDIT-FIX-B3 A9 — the durable receipt key + body fingerprint (sell writes no bets row, so this is its ONLY durable dedupe). */
	idempotencyKey: string;
	bodyFingerprint: string;
	metadata: BetEventMetadata;
}

export interface SellResult {
	sharesSold: string;
	dharmaReturned: string;
	newPrice: string;
}

/**
 * The comment-free sell (F-BET-3) — a position unwind, not an argument. Writes
 * NO `comments` and NO `bets` row (`bets.comment_id` NOT NULL forbids a
 * comment-free bet). Write order [R4]: positions → dharma_ledger(bet_id=null,
 * `bet_stake` POSITIVE) → events(bet.sold, aggregate "market", synthetic
 * `payload.betId`) → pools. The single `event_id` + the synthetic sale id +
 * `metadata` are caller-generated at handler entry and closed over
 * (retry-purity). Prior comments are never touched (INV-3 preservation).
 */
export async function sell(
	ctx: { tx: DbTransaction; pool: LockedPool },
	params: SellParams,
): Promise<SellResult> {
	const { tx, pool } = ctx;
	const { userId, marketId, shares } = params;

	const held = await getHeldPosition(tx, { userId, marketId });
	if (held === null) {
		throw new PositionNotHeldError();
	}
	// AUDIT-FIX-B3 A3 — the product oversell pre-check. In-snapshot (race-
	// consistent): a concurrent shrink surfaces as SSI 40001 → retry re-runs this →
	// clean 400. `shares == held.quantity` stays legal (sell-to-zero; the compute +
	// applyPositionDelta allow `== 0`). Without this the ceiling falls to
	// applyPositionDelta's PositionOversellError (`extends Error`) → toWireError
	// fall-through → an uncached 500 for ordinary user input (A3).
	if (new CpmmDecimal(shares).greaterThan(held.quantity)) {
		throw new InsufficientSharesError({
			held: held.quantity,
			requested: shares,
		});
	}
	const side = held.side;
	const cpmmSide: Side = side === "YES" ? "yes" : "no";
	const sold = computeSell({
		reserves: { yes: pool.yesReserves, no: pool.noReserves },
		side: cpmmSide,
		shares,
	});

	// WRITES: positions → dharma_ledger → events → pools (no comment/bet rows).
	await upsertPositionDelta(tx, {
		userId,
		marketId,
		side,
		shareDelta: new CpmmDecimal(shares).negated().toFixed(18),
	});

	await appendLedgerRow(tx, {
		userId,
		amount: sold.proceeds, // bet_stake POSITIVE credit [R4]
		entryType: "bet_stake",
		betId: null, // no bets row to link [R4]
	});

	await insertEvent(tx, {
		eventId: params.sellEventId,
		eventType: "bet.sold",
		aggregateType: "market", // market-scoped [R4]
		aggregateId: marketId,
		payload: {
			betId: params.syntheticBetId, // synthetic sale id, not FK-bound [R4]
			marketId,
			userId,
			side,
			sharesSold: shares,
			proceeds: sold.proceeds,
			price: sold.pEff,
		},
		metadata: params.metadata,
	});

	await tx
		.update(pools)
		.set({ yesReserves: sold.reserves.yes, noReserves: sold.reserves.no })
		.where(eq(pools.id, pool.id));

	const result: SellResult = {
		sharesSold: shares,
		dharmaReturned: sold.proceeds,
		newPrice: sold.p1,
	};

	// AUDIT-FIX-B3 A9 — the durable idempotency receipt, the LAST write inside the
	// W-1 tx (after pools; insert-only — the FK KEY SHARE locks on users/markets are
	// already held by the earlier spine inserts, so no NEW lock, no lock-order edge
	// vs the ADR-0013 spine). Its unique `idempotency_key` 23505s any Redis-lost replay (rollback =
	// no double proceeds); the stored `result` (decimal STRINGS → byte-stable jsonb
	// round-trip) answers the replay 200. `newPrice`/p1 lives in no other row.
	await tx.insert(betReceipts).values({
		idempotencyKey: params.idempotencyKey,
		bodyFingerprint: params.bodyFingerprint,
		userId,
		marketId,
		flow: "sell",
		result,
	});

	return result;
}
