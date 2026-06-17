import { v7 as uuidv7 } from "uuid";
import { z } from "zod";
import { db } from "@/db";
import { buildBetMetadata, runBetEndpoint } from "@/server/bets/endpoint";
import {
	CommentRequiresBetError,
	CommentTooLongError,
	CommentTrackABlockedError,
	CommentTrackBUnderReviewError,
	InvalidRequestBodyError,
} from "@/server/bets/errors";
import { assertStakeFloor } from "@/server/bets/floors";
import { place } from "@/server/bets/place";
import { runBetTransaction } from "@/server/bets/transaction";
import { resolveImageAttachment } from "@/server/comments/image-attach";
import { validateReplyParent } from "@/server/comments/reply-validate";
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
	// Optional in the schema so the EMPTY/ABSENT case maps to the NAMED
	// `comment_requires_bet` (DEBATE.1), not the generic parse-failure code.
	body: z.string().optional(),
	// DEBATE.2: un-fenced (ENGINE.8 hardcoded null). A reply rides a Support/
	// Counter bet on its parent (ADR-0017).
	parentCommentId: z.string().uuid().nullable().optional(),
	// DEBATE.2 F-COMMENT-3: the out-of-band R2 upload to attach to this comment.
	imageUploadsId: z.string().uuid().optional(),
});

export async function POST(request: Request): Promise<Response> {
	return runBetEndpoint(request, async (ctx) => {
		// 5. Body validate (zod). An absent/empty comment body is not a valid atomic
		// bet+comment pair → the NAMED `comment_requires_bet` (DEBATE.1 frontstop),
		// NOT the generic `error_invalid_request_body`.
		const parsed = placeBodySchema.safeParse(ctx.rawBody);
		if (!parsed.success) {
			throw new InvalidRequestBodyError();
		}
		const { marketId, side, stake } = parsed.data;
		const body = parsed.data.body ?? "";
		const parentCommentId = parsed.data.parentCommentId ?? null;
		const { imageUploadsId } = parsed.data;
		if (body.length === 0) {
			throw new CommentRequiresBetError();
		}
		if (!new CpmmDecimal(stake).greaterThan(0)) {
			throw new InvalidRequestBodyError("stake must be > 0");
		}
		if (body.length > COMMENT_MAX_LENGTH) {
			throw new CommentTooLongError();
		}

		// 5b. Reply validation (DEBATE.2) — pre-tx, reads the immutable append-only
		// `comments` table. Throws parent_comment_not_found (404) /
		// reply_depth_exceeded (400). A reply IS a Support/Counter bet (ADR-0017);
		// the write still flows through the single place() W-1 tx below.
		if (parentCommentId !== null) {
			await validateReplyParent(db, { parentCommentId, marketId });
		}

		// 5c. Image resolve + ownership (DEBATE.2 F-COMMENT-3) — pre-tx. The resolved
		// r2 key is routed into the ALREADY-image-capable moderation seam below
		// (route-wire only — the classifier is SCAFFOLD.15/16, consequences DEBATE.7).
		let imageR2Key: string | undefined;
		let resolvedImage: { uploadId: string; r2ObjectKey: string } | null = null;
		if (imageUploadsId !== undefined) {
			resolvedImage = await resolveImageAttachment(db, {
				userId: ctx.userId,
				imageUploadsId,
			});
			imageR2Key = resolvedImage.r2ObjectKey;
		}

		// 5d. Stake floor — reply floor when a parent is set, post floor otherwise.
		assertStakeFloor({ parentCommentId, stake });

		// 6. Pre-commit moderation — OUTSIDE the tx (ADR-0014). Both Track A and
		// Track B abort the bet — the tx never opens (F-MOD-4 / R2), for replies too.
		const verdict = await precommitModerate({
			text: body,
			imageR2Key,
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

		// Retry-purity: ALL event_ids + metadata generated ONCE here, closed over
		// the callback (the wrapper re-runs the callback per attempt — never these).
		// creditEventId is minted unconditionally (USED only when the accrual pays —
		// ENGINE.12 P1). The image-committed event_id is minted only when an image
		// is attached, but STILL at handler entry so a retry re-uses it (the
		// `image_upload.committed` dedupe). flow discriminates post vs reply.
		const betEventId = uuidv7();
		const commentEventId = uuidv7();
		const creditEventId = uuidv7();
		const flow = parentCommentId !== null ? "F-COMMENT-2" : "F-BET-1";
		const image =
			resolvedImage === null
				? null
				: { ...resolvedImage, committedEventId: uuidv7() };
		const metadata = buildBetMetadata({
			requestId: ctx.requestId,
			flowId: flow,
			userId: ctx.userId,
			idempotencyKey: ctx.idempotencyKey,
			ip: ctx.ip,
			userAgent: ctx.userAgent,
		});

		// 7. Transaction — the per-flow spine inside the W-1 wrapper.
		const result = await runBetTransaction({ marketId, flow }, (txCtx) =>
			place(txCtx, {
				userId: ctx.userId,
				marketId,
				side,
				stake,
				body,
				parentCommentId,
				idempotencyKey: ctx.idempotencyKey,
				betEventId,
				commentEventId,
				creditEventId,
				image,
				metadata,
			}),
		);

		return { status: 200, body: { ok: true, data: result } };
	});
}
