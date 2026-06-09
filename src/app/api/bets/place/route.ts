import { v7 as uuidv7 } from "uuid";
import { z } from "zod";
import { buildBetMetadata, runBetEndpoint } from "@/server/bets/endpoint";
import {
	CommentTooLongError,
	CommentTrackABlockedError,
	CommentTrackBUnderReviewError,
	InvalidRequestBodyError,
} from "@/server/bets/errors";
import { assertStakeFloor } from "@/server/bets/floors";
import { place } from "@/server/bets/place";
import { runBetTransaction } from "@/server/bets/transaction";
import { COMMENT_MAX_LENGTH } from "@/server/config/limits";
import { CpmmDecimal } from "@/server/cpmm/decimal";
import { numericString } from "@/server/events/schemas";
import { precommitModerate } from "@/server/moderation/precommit";

// POST /api/bets/place — F-BET-1 (entry) / F-BET-2 (subsequent), comment-bearing.
// Runs the full §3.1 stack via `runBetEndpoint` (origin → auth+ban → idem →
// rate-limit), then the flow-specific tail: body validate (step 5) → pre-commit
// moderation OUTSIDE the tx (step 6, ADR-0014) → the parameterized `place` write
// inside `runBetTransaction` (step 7). ENGINE.8 exercises the POST floor only
// (`parentCommentId: null`); DEBATE.2 reuses `place` with a validated parent.

const placeBodySchema = z.object({
	marketId: z.string().uuid(),
	side: z.enum(["YES", "NO"]),
	stake: numericString,
	body: z.string().min(1),
});

export async function POST(request: Request): Promise<Response> {
	return runBetEndpoint(request, async (ctx) => {
		// 5. Body validate (zod) + comment length + post floor.
		const parsed = placeBodySchema.safeParse(ctx.rawBody);
		if (!parsed.success) {
			throw new InvalidRequestBodyError();
		}
		const { marketId, side, stake, body } = parsed.data;
		if (!new CpmmDecimal(stake).greaterThan(0)) {
			throw new InvalidRequestBodyError("stake must be > 0");
		}
		if (body.length > COMMENT_MAX_LENGTH) {
			throw new CommentTooLongError();
		}
		// ENGINE.8 post-bets only → parentCommentId null → POST floor branch.
		assertStakeFloor({ parentCommentId: null, stake });

		// 6. Pre-commit moderation — OUTSIDE the tx (ADR-0014). Both Track A and
		// Track B abort the entry (F-MOD-4 / R2).
		const verdict = await precommitModerate({
			text: body,
			idempotencyKey: ctx.idempotencyKey,
			userId: ctx.userId,
			marketId,
		});
		if (verdict.outcome === "track_a") {
			throw new CommentTrackABlockedError();
		}
		if (verdict.outcome === "track_b") {
			throw new CommentTrackBUnderReviewError();
		}

		// Retry-purity: BOTH event_ids + metadata ONCE here, closed over the
		// callback (the wrapper re-runs the callback per attempt — never these).
		const betEventId = uuidv7();
		const commentEventId = uuidv7();
		const metadata = buildBetMetadata({
			requestId: ctx.requestId,
			flowId: "F-BET-1",
			userId: ctx.userId,
			idempotencyKey: ctx.idempotencyKey,
			ip: ctx.ip,
			userAgent: ctx.userAgent,
		});

		// 7. Transaction — the per-flow spine inside the W-1 wrapper.
		const result = await runBetTransaction(
			{ marketId, flow: "F-BET-1" },
			(txCtx) =>
				place(txCtx, {
					userId: ctx.userId,
					marketId,
					side,
					stake,
					body,
					parentCommentId: null,
					idempotencyKey: ctx.idempotencyKey,
					betEventId,
					commentEventId,
					metadata,
				}),
		);

		return { status: 200, body: { ok: true, data: result } };
	});
}
