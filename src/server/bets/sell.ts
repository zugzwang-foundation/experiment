import "server-only";

import { eq } from "drizzle-orm";

import type { DbTransaction } from "@/db";
import { pools } from "@/db/schema";
import { computeSell, type Side } from "@/server/cpmm/calculate";
import { CpmmDecimal } from "@/server/cpmm/decimal";
import { appendLedgerRow } from "@/server/dharma/persist";
import { insertEvent } from "@/server/events/insert";
import { upsertPositionDelta } from "@/server/positions/persist";
import { getHeldPosition } from "@/server/positions/read";

import type { BetEventMetadata } from "./endpoint";
import { PositionNotHeldError } from "./errors";
import type { LockedPool } from "./transaction";

export interface SellParams {
	userId: string;
	marketId: string;
	shares: string;
	/** Generated at handler entry, closed over (retry-purity). */
	sellEventId: string;
	/** A fresh UUIDv7 — the synthetic sale id for `bet.sold.payload.betId` (no bets row). */
	syntheticBetId: string;
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

	return {
		sharesSold: shares,
		dharmaReturned: sold.proceeds,
		newPrice: sold.p1,
	};
}
