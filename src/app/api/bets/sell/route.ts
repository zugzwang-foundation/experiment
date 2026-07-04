import { v7 as uuidv7 } from "uuid";
import { z } from "zod";
import { db } from "@/db";
import { buildBetMetadata, runBetEndpoint } from "@/server/bets/endpoint";
import { InvalidRequestBodyError } from "@/server/bets/errors";
import {
	isDurableIdempotencyConflict,
	loadDurableReplay,
} from "@/server/bets/replay";
import { sell } from "@/server/bets/sell";
import { runBetTransaction } from "@/server/bets/transaction";
import { CpmmDecimal } from "@/server/cpmm/decimal";
import { numericString } from "@/server/events/schemas";
import { IDEMPOTENCY_ERROR_CODES } from "@/server/idempotency/types";

// POST /api/bets/sell — F-BET-3 (comment-free sell). Runs the §3.1 stack via
// `runBetEndpoint`, MINUS moderation (sell carries no comment → skips step 6),
// then the `sell` unwind inside `runBetTransaction` (step 7).

const sellBodySchema = z.object({
	marketId: z.string().uuid(),
	shares: numericString,
});

export async function POST(request: Request): Promise<Response> {
	return runBetEndpoint(request, async (ctx) => {
		// 5. Body validate. Sell carries NO comment → NO moderation (skips step 6).
		const parsed = sellBodySchema.safeParse(ctx.rawBody);
		if (!parsed.success) {
			throw new InvalidRequestBodyError();
		}
		const { marketId, shares } = parsed.data;
		if (!new CpmmDecimal(shares).greaterThan(0)) {
			throw new InvalidRequestBodyError("shares must be > 0");
		}

		// Retry-purity: the single event_id + the synthetic sale id + metadata,
		// ONCE here, closed over the callback.
		const sellEventId = uuidv7();
		const syntheticBetId = uuidv7();
		const metadata = buildBetMetadata({
			requestId: ctx.requestId,
			flowId: "F-BET-3",
			userId: ctx.userId,
			idempotencyKey: ctx.idempotencyKey,
			ip: ctx.ip,
			userAgent: ctx.userAgent,
		});

		// 7. Transaction — the comment-free unwind inside the W-1 wrapper.
		// AUDIT-FIX-B3 A9: the sell writes no bets row, so `bet_receipts_idempotency_
		// key_uq` is its ONLY durable dedupe. On a Redis-lost replay that reached the
		// tx, the receipt 23505s → rollback (no double proceeds) → read the committed
		// receipt and answer the ORIGINAL 200 (match) or 409 reused (mismatch,
		// noCache). Receipt absent despite the 23505 (impossible live) → rethrow.
		try {
			const result = await runBetTransaction(
				{ marketId, flow: "F-BET-3" },
				(txCtx) =>
					sell(txCtx, {
						userId: ctx.userId,
						marketId,
						shares,
						sellEventId,
						syntheticBetId,
						idempotencyKey: ctx.idempotencyKey,
						bodyFingerprint: ctx.bodyFingerprint,
						metadata,
					}),
			);
			return { status: 200, body: { ok: true, data: result } };
		} catch (err) {
			if (isDurableIdempotencyConflict(err)) {
				const replay = await loadDurableReplay(db, {
					idempotencyKey: ctx.idempotencyKey,
					bodyFingerprint: ctx.bodyFingerprint,
				});
				if (replay?.kind === "replay") {
					return { status: 200, body: { ok: true, data: replay.result } };
				}
				if (replay?.kind === "mismatch") {
					return {
						status: 409,
						body: {
							ok: false,
							error: {
								code: IDEMPOTENCY_ERROR_CODES.KEY_REUSED,
								message: "Idempotency-Key reused with a different body",
							},
						},
						noCache: true,
					};
				}
			}
			throw err;
		}
	});
}
