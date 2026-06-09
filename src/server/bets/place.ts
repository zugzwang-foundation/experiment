import "server-only";

import { eq } from "drizzle-orm";

import type { DbTransaction } from "@/db";
import { bets, comments, pools } from "@/db/schema";
import { computeBuy, type Side } from "@/server/cpmm/calculate";
import { CpmmDecimal } from "@/server/cpmm/decimal";
import { appendLedgerRow, readBalance } from "@/server/dharma/persist";
import { insertEvent } from "@/server/events/insert";
import { upsertPositionDelta } from "@/server/positions/persist";
import { getHeldPosition } from "@/server/positions/read";

import type { BetEventMetadata } from "./endpoint";
import { InsufficientDharmaError, OppositeSideHeldError } from "./errors";
import type { LockedPool } from "./transaction";

export interface PlaceParams {
	userId: string;
	marketId: string;
	side: "YES" | "NO";
	stake: string;
	body: string;
	/** null for a top-level post (ENGINE.8); a validated id for a reply (DEBATE.2). */
	parentCommentId: string | null;
	idempotencyKey: string;
	/** Generated at handler entry, closed over (retry-purity) — NEVER regenerated here. */
	betEventId: string;
	commentEventId: string;
	metadata: BetEventMetadata;
}

export interface PlaceResult {
	betId: string;
	commentId: string;
	side: "YES" | "NO";
	sharesBought: string;
	newPrice: string;
}

/**
 * The PARAMETERIZED comment-bearing-bet write (F-BET-1 entry / F-BET-2
 * subsequent). Runs inside the W-1 SERIALIZABLE wrapper's locked snapshot — the
 * caller (`runBetTransaction`) supplies `{ tx, pool }`. Built ONCE here and
 * reused by DEBATE.2 (which passes a validated `parentCommentId` + the reply
 * floor); ENGINE.8 always passes `parentCommentId: null` (the post branch).
 *
 * Write order [R1]: positions → comments → bets → dharma_ledger(bet_id=bet.id) →
 * events(bet.placed + comment.placed) → pools. comments + bets move AHEAD of
 * dharma_ledger so the `bet_stake` debit can link `bet_id` (the FK is
 * satisfiable). The two `event_id`s + `metadata` are caller-generated at handler
 * entry and closed over — the wrapper re-runs this callback per attempt, so
 * regenerating them here would drift `created_at` and defeat the
 * `ON CONFLICT (event_id, created_at)` dedupe.
 */
export async function place(
	ctx: { tx: DbTransaction; pool: LockedPool },
	params: PlaceParams,
): Promise<PlaceResult> {
	const { tx, pool } = ctx;
	const { userId, marketId, side, stake, body, parentCommentId } = params;

	// READS in the locked snapshot.
	const held = await getHeldPosition(tx, { userId, marketId });
	if (held !== null && held.side !== side) {
		// F-BET-10 — opposite side held; reject before any write.
		throw new OppositeSideHeldError({
			currentSide: held.side,
			shares: held.quantity,
		});
	}
	const balance = await readBalance(tx, userId);
	if (new CpmmDecimal(balance).lessThan(stake)) {
		// F-BET-4 friendly pre-check; DharmaOverdraftError + CHECK are the backstop.
		throw new InsufficientDharmaError({ balance, required: stake });
	}
	const cpmmSide: Side = side === "YES" ? "yes" : "no";
	const buy = computeBuy({
		reserves: { yes: pool.yesReserves, no: pool.noReserves },
		side: cpmmSide,
		stake,
	});

	// WRITES: positions → comments → bets → dharma_ledger → events → pools.
	await upsertPositionDelta(tx, {
		userId,
		marketId,
		side,
		shareDelta: buy.shares,
	});

	const [comment] = await tx
		.insert(comments)
		.values({
			userId,
			marketId,
			parentCommentId,
			body,
			sideAtPostTime: side, // INV-3 — frozen at post time
			stakeAtPostTime: stake, // vestigial NOT-NULL column (ADR-0009); satisfied
			betId: null, // Bucket-A circular pair; stays null in v1
		})
		.returning({ id: comments.id });
	if (comment === undefined) {
		throw new Error("place: comments INSERT … RETURNING produced no row");
	}

	const [bet] = await tx
		.insert(bets)
		.values({
			userId,
			marketId,
			side,
			stake,
			shareQuantity: buy.shares,
			priceAtBet: buy.pEff,
			commentId: comment.id, // INV-1 schema half (comment-before-bet, FK)
			idempotencyKey: params.idempotencyKey,
		})
		.returning({ id: bets.id });
	if (bet === undefined) {
		throw new Error("place: bets INSERT … RETURNING produced no row");
	}

	await appendLedgerRow(tx, {
		userId,
		amount: new CpmmDecimal(stake).negated().toFixed(18), // bet_stake debit
		entryType: "bet_stake",
		betId: bet.id, // bets-before-dharma_ledger [R1]
		previousBalance: balance,
	});

	await insertEvent(tx, {
		eventId: params.betEventId,
		eventType: "bet.placed",
		aggregateType: "bet",
		aggregateId: bet.id,
		payload: {
			betId: bet.id,
			marketId,
			userId,
			side,
			stake,
			shares: buy.shares,
			price: buy.pEff,
			commentId: comment.id,
			parentCommentId,
		},
		metadata: params.metadata,
	});
	await insertEvent(tx, {
		eventId: params.commentEventId,
		eventType: "comment.placed",
		aggregateType: "comment",
		aggregateId: comment.id,
		payload: {
			commentId: comment.id,
			betId: bet.id,
			userId,
			marketId,
			side,
			parentCommentId,
			bodyLength: body.length,
			uploadId: null,
		},
		metadata: params.metadata,
	});

	await tx
		.update(pools)
		.set({ yesReserves: buy.reserves.yes, noReserves: buy.reserves.no })
		.where(eq(pools.id, pool.id));

	return {
		betId: bet.id,
		commentId: comment.id,
		side,
		sharesBought: buy.shares,
		newPrice: buy.p1,
	};
}
