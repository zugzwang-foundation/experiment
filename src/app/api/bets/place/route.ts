import { v7 as uuidv7 } from "uuid";
import { z } from "zod";
import { db } from "@/db";
import { buildBetMetadata, runBetEndpoint } from "@/server/bets/endpoint";
import {
	CommentRequiresBetError,
	CommentTooLongError,
	CommentTrackABlockedError,
	CommentTrackBBlockedError,
	FriendlyFireRequiresReplyError,
	FriendlyFireRequiresSupportError,
	InvalidRequestBodyError,
} from "@/server/bets/errors";
import { assertStakeFloor, clampStakeToMax } from "@/server/bets/floors";
import { place } from "@/server/bets/place";
import type { DurableReplay } from "@/server/bets/replay";
import {
	isDurableIdempotencyConflict,
	loadDurableReplay,
} from "@/server/bets/replay";
import { runBetTransaction } from "@/server/bets/transaction";
import { resolveImageAttachment } from "@/server/comments/image-attach";
import { validateReplyParent } from "@/server/comments/reply-validate";
import { COMMENT_MAX_LENGTH } from "@/server/config/limits";
import { CpmmDecimal } from "@/server/cpmm/decimal";
import { numericString } from "@/server/events/schemas";
import { IDEMPOTENCY_ERROR_CODES } from "@/server/idempotency/types";
import { recordGateBlock } from "@/server/moderation/consequences";
import { precommitModerate } from "@/server/moderation/precommit";
import { safeCaptureException } from "@/server/observability/safe-capture";
import { verifyUploadedObject } from "@/server/storage/verify-object";

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
	// FF-1 / ADR-0058 F-COMMENT-2: the friendly-fire toggle. Optional so an
	// absent key means `false` (the client omits it when the switch is off);
	// legal ONLY on a Support reply — rejected below on a post and on a Counter,
	// before moderation and before the tx opens.
	friendlyFire: z.boolean().optional(),
});

export async function POST(request: Request): Promise<Response> {
	return runBetEndpoint(request, async (ctx) => {
		// 5. Body validate (zod). An absent, empty, or whitespace-only comment body
		// is not a valid atomic bet+comment pair → the NAMED `comment_requires_bet`
		// (DEBATE.1 frontstop), NOT the generic `error_invalid_request_body`.
		const parsed = placeBodySchema.safeParse(ctx.rawBody);
		if (!parsed.success) {
			throw new InvalidRequestBodyError();
		}
		const { marketId, side, stake } = parsed.data;
		const body = parsed.data.body ?? "";
		const parentCommentId = parsed.data.parentCommentId ?? null;
		const { imageUploadsId } = parsed.data;
		const friendlyFire = parsed.data.friendlyFire ?? false;
		// Emptiness gate on the TRIMMED text (AUDIT.1 A24 ruling / SPEC.1 F-BET-1
		// rider): a whitespace-only body is an absent argument. Trim is JS
		// `String.prototype.trim()` (Unicode WhiteSpace + LineTerminator). The trim
		// result gates emptiness ONLY — moderation (step 6) and the W-1 tx (step 7)
		// receive the raw `body` byte-identical (stored ≡ moderated); the upper
		// bound below stays on the raw text.
		if (body.trim().length === 0) {
			throw new CommentRequiresBetError();
		}
		if (!new CpmmDecimal(stake).greaterThan(0)) {
			throw new InvalidRequestBodyError("stake must be > 0");
		}
		if (body.length > COMMENT_MAX_LENGTH) {
			throw new CommentTooLongError();
		}

		// 5a'. FF-1 / ADR-0058 — the friendly-fire FRONTSTOP, half one: the toggle
		// on a top-level post has nothing to contest. Thrown here, ahead of every
		// read and of moderation, so a rejected flag spends no vendor call and no
		// Redis reservation; the `comments` CHECK is the storage backstop and
		// place()'s in-tx guard the belt.
		if (friendlyFire && parentCommentId === null) {
			throw new FriendlyFireRequiresReplyError();
		}

		// 5b. Reply validation (DEBATE.2) — pre-tx, reads the immutable append-only
		// `comments` table. Throws parent_comment_not_found (404) /
		// reply_depth_exceeded (400). A reply IS a Support/Counter bet (ADR-0017);
		// the write still flows through the single place() W-1 tx below.
		//
		// FF-1 / ADR-0058 — half two of the frontstop rides the SAME read: the
		// validated parent's frozen side is what the toggle is measured against.
		// `friendlyFire` is legal only when the side being bought EQUALS it (a
		// Support reply — including an entry reply that chooses that side, D-51
		// R2). A Counter already contests by side and cannot also back it.
		if (parentCommentId !== null) {
			const parent = await validateReplyParent(db, {
				parentCommentId,
				marketId,
			});
			if (friendlyFire && parent.sideAtPostTime !== side) {
				throw new FriendlyFireRequiresSupportError();
			}
		}

		// 5c. Image resolve + ownership (DEBATE.2 F-COMMENT-3) — pre-tx. The resolved
		// r2 key is routed into the ALREADY-image-capable moderation seam below
		// (route-wire only — the classifier is SCAFFOLD.15/16, consequences DEBATE.7).
		//
		// 5c'. Verify the uploaded object BEFORE moderation (AUDIT-FIX-A1, pre-tx,
		// FAIL-CLOSED, HTTP outside the tx per CLAUDE.md §3). One HeadObject: (A10)
		// reject a real-byte oversize / 0-byte object; reject a missing object or
		// unavailable R2; capture the ETag + REAL size for the append-only
		// image_upload.committed audit record. Any throw blocks the request and the
		// W-1 bet tx NEVER opens — toWireError maps ImageOversizeError→400,
		// StorageObjectMissingError→400 (ADR-0028), StorageUnavailableError→503. The write-once
		// arming at sign time (If-None-Match) is the swap guarantee; the ETag here is
		// a forensic fingerprint only, never a security control.
		let imageR2Key: string | undefined;
		let resolvedImage: {
			uploadId: string;
			r2ObjectKey: string;
			etag: string | null;
			byteSizeActual: number;
		} | null = null;
		if (imageUploadsId !== undefined) {
			const resolved = await resolveImageAttachment(db, {
				userId: ctx.userId,
				imageUploadsId,
			});
			const verified = await verifyUploadedObject(resolved.r2ObjectKey);
			resolvedImage = {
				uploadId: resolved.uploadId,
				r2ObjectKey: resolved.r2ObjectKey,
				etag: verified.etag ?? null,
				byteSizeActual: verified.byteSize,
			};
			imageR2Key = resolvedImage.r2ObjectKey;
		}

		// 5d. BET_MAX_STAKE clamp (SPEC.1 §16.1 / F-BET-9, buy/add only) THEN the
		// stake floor on the CLAMPED value — so a misconfigured max < floor rejects
		// loudly (below_*_floor) instead of executing below floor. The clamped
		// stake is uniformly the stake for everything downstream (balance check,
		// CPMM computation, bets.stake, ledger debit, events, receipt); the body
		// fingerprint was computed at handler entry over the RAW submitted body.
		const effectiveStake = clampStakeToMax(stake);
		assertStakeFloor({ parentCommentId, stake: effectiveStake });

		// 6. Pre-commit moderation — OUTSIDE the tx (ADR-0014). Both Track A and
		// Track B abort the bet — the tx never opens (F-MOD-4 / R2), for replies too.
		const verdict = await precommitModerate({
			text: body,
			imageR2Key,
			idempotencyKey: ctx.idempotencyKey,
			userId: ctx.userId,
			marketId,
		});
		// 6b. Gate-block consequences (DEBATE.7 / ADR-0021). On track_a / track_b,
		// run the standalone-tx writer (mod_actions audit row + track_a auto-ban +
		// image-block flip + CSAM seam) BEFORE throwing. The reservation is already
		// released (precommit's finally) and the OpenAI hop is done, so this is a
		// pure-DB tx with no HTTP in flight (the golden rule). INV-1 holds: the
		// bet+comment tx never opens. Both Track-B dispositions throw the SAME error
		// — the carve-out distinction lives ONLY in mod_actions.reason (SPEC.1 §983).
		if (verdict.outcome === "track_a" || verdict.outcome === "track_b") {
			await recordGateBlock({
				outcome: verdict.outcome,
				categories: verdict.categories,
				categoryScores: verdict.categoryScores,
				userId: ctx.userId,
				marketId,
				blockedText: body,
				imageR2Key,
				imageUploadId: resolvedImage?.uploadId,
			});
			if (verdict.outcome === "track_a") {
				throw new CommentTrackABlockedError();
			}
			throw new CommentTrackBBlockedError();
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

		// 7. Transaction — the per-flow spine inside the W-1 wrapper. AUDIT-FIX-B3 A9:
		// on a Redis-lost concurrent-replay race the durable pre-check missed, the
		// `bets_idempotency_key_idx` (or `bet_receipts_idempotency_key_uq`) 23505s →
		// read the committed receipt and answer the ORIGINAL 200 (fingerprint match)
		// or a 409 reused (mismatch → noCache, poison guard). Receipt absent despite
		// the 23505 (impossible live — both writes land in one tx, zero users
		// pre-launch) → rethrow (honest 500 + the B1 capture).
		try {
			const result = await runBetTransaction({ marketId, flow }, (txCtx) =>
				place(txCtx, {
					userId: ctx.userId,
					marketId,
					side,
					stake: effectiveStake,
					body,
					parentCommentId,
					friendlyFire,
					idempotencyKey: ctx.idempotencyKey,
					bodyFingerprint: ctx.bodyFingerprint,
					betEventId,
					commentEventId,
					creditEventId,
					image,
					metadata,
				}),
			);
			return { status: 200, body: { ok: true, data: result } };
		} catch (err) {
			if (isDurableIdempotencyConflict(err)) {
				const replay = await loadDurableReplay(db, {
					userId: ctx.userId,
					idempotencyKey: ctx.idempotencyKey,
					bodyFingerprint: ctx.bodyFingerprint,
				});
				// Normalize `null` (no receipt for this user) into a discriminable
				// member so the switch below can be exhaustiveness-checked — a
				// `DurableReplay` arm added later without updating this switch is a
				// compile error, not a silent 409 (code-review LOW / CLAUDE.md O-1:
				// structural beats procedural).
				const outcome: DurableReplay | { kind: "not_found" } = replay ?? {
					kind: "not_found",
				};
				switch (outcome.kind) {
					case "replay":
						return { status: 200, body: { ok: true, data: outcome.result } };
					case "unavailable":
						// ADR-0044 HIGH-1: a transient DB error during the durable check
						// (fail-OPEN inside loadDurableReplay) must NOT be reported as
						// "this key belongs to someone else" — rethrow the ORIGINAL
						// 23505 into the normal uncached-500 path. A retry under the
						// same key re-attempts the check once the outage clears;
						// endpoint.ts's outer catch already captures + alarms
						// `error_internal`.
						throw err;
					case "mismatch":
					case "not_found": {
						// ADR-0044 (S-7 G2): `not_found` — the 23505 fired on a receipt
						// that does not belong to this user, now that
						// loadDurableReplay is user-scoped. This is the one condition
						// ADR-0044 exists to handle (a genuine cross-user collision,
						// or rarely on staging a pre-migration-0022 committed bet
						// with no receipt) and must never be silent (ADR-0044 HIGH-2
						// / CLAUDE.md O-3): alarm it distinctly from the far more
						// common same-user fingerprint `mismatch`.
						if (outcome.kind === "not_found") {
							safeCaptureException(err, {
								tags: { kind: "durable_idempotency_cross_user_collision" },
							});
						}
						// Both mean "you may not replay this key" and get the same
						// uncached 409 (poison guard — caching it would let a
						// legitimate retry read a stale reused-key error for 24h).
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
					default: {
						const _exhaustive: never = outcome;
						throw err;
					}
				}
			}
			throw err;
		}
	});
}
