import "server-only";

import {
	ImageOversizeError,
	ModerationInFlightError,
	ModerationUnavailableError,
	StorageObjectMissingError,
	StorageUnavailableError,
} from "@/lib/errors";
import type { MarketStatus } from "@/server/markets/transitions";
// AUDIT-FIX-B3 A3 — the two positions sentinels the sell path can surface to the
// user (`extends Error`, NOT `BetProductError`). `toWireError` maps both
// explicitly. One-directional edge (bets → positions); positions never imports
// bets, so no runtime cycle.
import {
	PositionOversellError,
	PositionSingleSideError,
} from "@/server/positions/errors";

import type { BetFlow } from "./transaction";

/**
 * The W-1 bet-transaction wrapper's two module-local error classes (mirrors
 * `cpmm/errors.ts` / `dharma/errors.ts` / `markets/errors.ts` — `extends Error`
 * with an explicit `this.name` so `instanceof` AND `.name` survive native
 * subclassing under the ES2017 target). UNLIKE those modules' caller-bug
 * sentinels, these are SPEC.1 §15 PRODUCT errors carrying an observed-state
 * discriminant (plan §"Errors" S5). The status → §15 code map + the response
 * envelope wiring are ENGINE.8's; ENGINE.7 only mints + throws these.
 *
 * `BetFlow` is imported type-only (erased) — the sole runtime edge is
 * `transaction.ts → errors.ts`, so no runtime import cycle exists.
 */

/**
 * The full-jitter retry budget (1 initial attempt + 3 retries) was exhausted —
 * every attempt hit a retryable serialization failure (SQLSTATE 40001 / 40P01).
 * Alarm 3 (SPEC.2 §17.2 row 3): the wrapper has already fired
 * `captureMessage('bet_serialization_exhausted')` before throwing this. Carries
 * the LAST observed SQLSTATE + the originating flow — the Sentry-tag surface +
 * ENGINE.8's §15 envelope inputs.
 *
 * The §15 envelope is class-level + FIXED (plan §"Errors" S2): HTTP 503,
 * `Retry-After: 1`, code `error_bet_serialization_exhausted`, error_type
 * `unavailable` (the §15.2 canonical enum value — NOT the §9 prose's
 * `temporary_unavailable`). ENGINE.8 reads these statics to build the response.
 */
export class BetSerializationExhaustedError extends Error {
	static readonly httpStatus = 503;
	static readonly retryAfterSeconds = 1;
	static readonly code = "error_bet_serialization_exhausted";
	static readonly errorType = "unavailable";

	readonly sqlstate: string;
	readonly flow: BetFlow;

	constructor(args: { sqlstate: string; flow: BetFlow }) {
		super(
			`bet transaction exhausted the serialization retry budget (last SQLSTATE ${args.sqlstate}, flow ${args.flow})`,
		);
		this.name = "BetSerializationExhaustedError";
		this.sqlstate = args.sqlstate;
		this.flow = args.flow;
	}
}

/**
 * The coarse market-state gate observed a non-Open market. A PRODUCT error that
 * is NOT retried — it carries no SQLSTATE, so the wrapper's retry filter
 * rethrows it immediately (plan §"Coarse market-state gate"). Carries the EXACT
 * observed `status` so ENGINE.8 maps it to the right §15 code (Closed →
 * `market_closed_at`, Resolving → `in_flight_timeout` coarse reject-all,
 * Draft/Resolved/Voided/Frozen → `market_not_open`). The wrapper does NOT pick
 * the code — that status → §15 map is ENGINE.8's.
 */
export class MarketNotOpenError extends Error {
	readonly status: MarketStatus;

	constructor(status: MarketStatus) {
		super(`market is not Open for betting (status ${status})`);
		this.name = "MarketNotOpenError";
		this.status = status;
	}
}

/**
 * ENGINE.8 §4.4 layer (Q4). The bet PRODUCT errors (SPEC.1 §7 / §15) + the thin
 * `toWireError` formatter mapping every thrown error onto the §4.4 wire envelope
 * `{ ok:false, error:{ code, message, retry_after? } }`. The six-field §15.1
 * catalogue metadata (`error_type` / `retry_semantics` / `field_errors`) +
 * `docs/specs/error-codes.md` + the §15.5 lint stay forward (CF3).
 *
 * Each product class mirrors the ENGINE.7 static-fields pattern — `extends Error`
 * (via `BetProductError`) + static `httpStatus` / `code` + an explicit
 * `this.name` so `instanceof` AND `.name` survive native subclassing under the
 * ES2017 target. `toWireError` reads the statics off `err.constructor`.
 */
export abstract class BetProductError extends Error {}

/** F-BET-4 → 400. The friendly in-snapshot `readBalance` pre-check; the authoritative INV-2 backstop is `DharmaOverdraftError` + `CHECK (balance_after >= 0)`. */
export class InsufficientDharmaError extends BetProductError {
	static readonly httpStatus = 400;
	static readonly code = "insufficient_dharma";
	readonly balance: string;
	readonly required: string;
	constructor(args: { balance: string; required: string }) {
		super(
			`insufficient dharma: balance ${args.balance} < required ${args.required}`,
		);
		this.name = "InsufficientDharmaError";
		this.balance = args.balance;
		this.required = args.required;
	}
}

/**
 * F-BET-3 → 400 (AUDIT-FIX-B3 A3). The friendly in-snapshot sell pre-check:
 * `shares > held.quantity`. Name/code mirror F-BET-4's `InsufficientDharmaError`;
 * the authoritative backstop is `PositionOversellError` + the storage
 * `CHECK (positions_quantity_non_negative)`. In-snapshot, so a concurrent shrink
 * surfaces as SSI 40001 → retry re-runs the pre-check → clean 400.
 */
export class InsufficientSharesError extends BetProductError {
	static readonly httpStatus = 400;
	static readonly code = "insufficient_shares";
	readonly held: string;
	readonly requested: string;
	constructor(args: { held: string; requested: string }) {
		super(
			`insufficient shares: held ${args.held} < requested ${args.requested}`,
		);
		this.name = "InsufficientSharesError";
		this.held = args.held;
		this.requested = args.requested;
	}
}

/** ADR-0018 post floor → 400 (the place route's branch). */
export class BelowPostFloorError extends BetProductError {
	static readonly httpStatus = 400;
	static readonly code = "below_post_floor";
	constructor() {
		super("stake is below the post floor (BET_MIN_STAKE_POST)");
		this.name = "BelowPostFloorError";
	}
}

/** ADR-0018 reply floor → 400 (exercised by DEBATE.2; minted here). */
export class BelowReplyFloorError extends BetProductError {
	static readonly httpStatus = 400;
	static readonly code = "below_reply_floor";
	constructor() {
		super("stake is below the reply floor (BET_MIN_STAKE_REPLY)");
		this.name = "BelowReplyFloorError";
	}
}

/** F-BET-10 → 400. The held-side read predicate rejected an opposite-side entry. */
export class OppositeSideHeldError extends BetProductError {
	static readonly httpStatus = 400;
	static readonly code = "opposite_side_held";
	readonly currentSide: "YES" | "NO";
	readonly shares: string;
	constructor(args: { currentSide: "YES" | "NO"; shares: string }) {
		super(
			`opposite side held: current ${args.currentSide} (${args.shares} shares)`,
		);
		this.name = "OppositeSideHeldError";
		this.currentSide = args.currentSide;
		this.shares = args.shares;
	}
}

/** F-BET-3 → 400. A sell against a market the user holds no position in. */
export class PositionNotHeldError extends BetProductError {
	static readonly httpStatus = 400;
	static readonly code = "position_not_held";
	constructor() {
		super("no position held in this market");
		this.name = "PositionNotHeldError";
	}
}

/** F-BET-7 → 403. `users.banned_at IS NOT NULL` (the auth+ban gate). */
export class BannedUserError extends BetProductError {
	static readonly httpStatus = 403;
	static readonly code = "banned_user";
	constructor() {
		super("user is banned");
		this.name = "BannedUserError";
	}
}

/** F-COMMENT (length) → 400. Body length exceeds `COMMENT_MAX_LENGTH`. */
export class CommentTooLongError extends BetProductError {
	static readonly httpStatus = 400;
	static readonly code = "comment_too_long";
	constructor() {
		super("comment body exceeds COMMENT_MAX_LENGTH");
		this.name = "CommentTooLongError";
	}
}

/** Moderation Track A verdict → 400 (R2 — F-COMMENT-1; both tracks abort per F-MOD-4). */
export class CommentTrackABlockedError extends BetProductError {
	static readonly httpStatus = 400;
	static readonly code = "comment_track_a_blocked";
	constructor() {
		super("comment blocked by moderation (track A)");
		this.name = "CommentTrackABlockedError";
	}
}

/**
 * Moderation Track B verdict → 400 (DEBATE.7 / ADR-0021 — supersedes the old 423
 * `comment_track_b_under_review` now that the held queue is removed; aligns to
 * SPEC.1 §8 F-BET-1/F-COMMENT-1). BOTH the ordinary Track-B block AND the
 * text-only `sexual/minors` carve-out throw THIS — the carve-out distinction
 * lives ONLY in `mod_actions.reason`, never in the user response (the category is
 * never revealed to the author, SPEC.1 §983).
 */
export class CommentTrackBBlockedError extends BetProductError {
	static readonly httpStatus = 400;
	static readonly code = "comment_track_b_blocked";
	constructor() {
		super("comment blocked by moderation (track B); revise and resubmit");
		this.name = "CommentTrackBBlockedError";
	}
}

/**
 * DEBATE.1 / SPEC.1 §8 F-COMMENT-5 → 400. A place request that is not a complete
 * atomic bet+comment pair — the comment body is absent/empty (no comment without
 * a stake; no stake without a comment, INV-1). The comment-only direction is
 * structurally impossible (there is no comment endpoint), so the live trigger is
 * the missing-body branch. The `error-codes.md` catalogue stays forward (Finding
 * B / SPEC.2 §15.4); this is minted as a stable string here per the ENGINE.8
 * precedent.
 */
export class CommentRequiresBetError extends BetProductError {
	static readonly httpStatus = 400;
	static readonly code = "comment_requires_bet";
	constructor() {
		super("a comment requires a bet (no comment without a stake)");
		this.name = "CommentRequiresBetError";
	}
}

/**
 * DEBATE.2 / SPEC.1 §8 F-COMMENT-2 → 400. The parent comment is itself a reply
 * (`parent_comment_id` non-null) — flat replies only (`REPLY_DEPTH_MAX = 1`,
 * ADR-0017). A reply cannot be replied to.
 */
export class ReplyDepthExceededError extends BetProductError {
	static readonly httpStatus = 400;
	static readonly code = "reply_depth_exceeded";
	constructor() {
		super(
			"reply depth exceeded (REPLY_DEPTH_MAX = 1; cannot reply to a reply)",
		);
		this.name = "ReplyDepthExceededError";
	}
}

/**
 * DEBATE.2 / SPEC.1 §8 F-COMMENT-2 → 404. The parent comment is absent OR in a
 * different market than the reply targets (a reply must reference an existing
 * comment in the same market).
 */
export class ParentCommentNotFoundError extends BetProductError {
	static readonly httpStatus = 404;
	static readonly code = "parent_comment_not_found";
	constructor() {
		super("parent comment not found");
		this.name = "ParentCommentNotFoundError";
	}
}

/** Malformed request body (bad shape / non-positive stake|shares) → 400. */
export class InvalidRequestBodyError extends BetProductError {
	static readonly httpStatus = 400;
	static readonly code = "error_invalid_request_body";
	constructor(message = "invalid request body") {
		super(message);
		this.name = "InvalidRequestBodyError";
	}
}

/** The §4.4 wire envelope + the HTTP status, plus the optional HTTP `Retry-After` header value (distinct from the body `retry_after`, which is present only for 429/503 per §4.4). */
export interface WireError {
	status: number;
	body: {
		ok: false;
		error: { code: string; message: string; retry_after?: number };
	};
	retryAfterHeader?: number;
}

function buildWire(
	status: number,
	code: string,
	message: string,
	opts?: { retryAfterBody?: number; retryAfterHeader?: number },
): WireError {
	const error: { code: string; message: string; retry_after?: number } = {
		code,
		message,
	};
	if (opts?.retryAfterBody !== undefined) {
		error.retry_after = opts.retryAfterBody;
	}
	const retryAfterHeader = opts?.retryAfterHeader ?? opts?.retryAfterBody;
	const wire: WireError = { status, body: { ok: false, error } };
	if (retryAfterHeader !== undefined) {
		wire.retryAfterHeader = retryAfterHeader;
	}
	return wire;
}

/**
 * Map any thrown error onto the §4.4 wire envelope + HTTP status. The body
 * `retry_after` field is present IFF the status is 429 / 503 (§4.4 verbatim);
 * the 409 in-flight cases carry a `Retry-After` HTTP header (`retryAfterHeader`)
 * but no body field. The two ENGINE.7 wrapper classes + the two moderation
 * classes + the three AUDIT-FIX-A1 storage/image classes (`@/lib/errors`) are
 * mapped explicitly; the bet product classes read their `static httpStatus` /
 * `code`. An unrecognized error → 500 `error_internal` (the caller releases the
 * idempotency sentinel as a crash).
 */
export function toWireError(err: unknown): WireError {
	if (err instanceof BetSerializationExhaustedError) {
		return buildWire(
			BetSerializationExhaustedError.httpStatus,
			BetSerializationExhaustedError.code,
			err.message,
			{ retryAfterBody: BetSerializationExhaustedError.retryAfterSeconds },
		);
	}
	if (err instanceof MarketNotOpenError) {
		if (err.status === "Closed") {
			return buildWire(400, "error_market_closed_at", err.message);
		}
		if (err.status === "Resolving") {
			return buildWire(409, "market_resolving", err.message);
		}
		return buildWire(400, "error_market_not_open", err.message);
	}
	if (err instanceof ModerationInFlightError) {
		return buildWire(409, "error_moderation_in_flight", err.message, {
			retryAfterHeader: 2,
		});
	}
	if (err instanceof ModerationUnavailableError) {
		return buildWire(503, "error_moderation_unavailable", err.message, {
			retryAfterBody: 5,
		});
	}
	// AUDIT-FIX-A1 — the pre-moderation `verifyUploadedObject` HeadObject (image
	// path) fails closed; map its `@/lib/errors` DomainError classes onto the §4.4
	// wire envelope (they are NOT BetProductError, so without these they fall
	// through to 500 error_internal). ImageOversize (A10, real-byte cap) + object
	// missing are terminal 4xx (cached per §11); storage-unavailable is a 503
	// (status ≥ 500 ⇒ runBetEndpoint does NOT cache it → a retry re-attempts).
	if (err instanceof ImageOversizeError) {
		return buildWire(400, "error_image_oversize", err.message);
	}
	if (err instanceof StorageObjectMissingError) {
		// ADR-0028 RULING (§9 #4): missing object → 400 (validation_error), NOT 409.
		// The client referenced an upload it never completed (or a stale/foreign id)
		// — a bad request, symmetric with error_image_oversize → 400; 409 in this
		// codebase denotes a clash with existing/in-flight state, which an absent
		// object is not.
		return buildWire(400, "error_storage_object_missing", err.message);
	}
	if (err instanceof StorageUnavailableError) {
		return buildWire(503, "error_storage_unavailable", err.message, {
			retryAfterBody: 5,
		});
	}
	// AUDIT-FIX-B3 A3 — the two positions sentinels (`extends Error`, NOT
	// BetProductError, so without these they fall through to 500 error_internal for
	// ordinary user input). Mapped BEFORE the BetProductError block.
	if (err instanceof PositionOversellError) {
		// The storage-layer oversell backstop (unreachable-except-bug post the
		// sell() pre-check). Map to the SAME 400 insufficient_shares as the friendly
		// pre-check (#8) so a backstop trip is user-legible, not an opaque 500. The
		// endpoint additionally fires the `position_oversell_backstop` alarm.
		return buildWire(
			InsufficientSharesError.httpStatus,
			InsufficientSharesError.code,
			err.message,
		);
	}
	if (err instanceof PositionSingleSideError) {
		// The single-side race-loser: a concurrent flip-order write lost the
		// positions_one_held_side_idx unique. 503 (uncached by the `<500` rule) so
		// the retry re-resolves deterministically to `opposite_side_held` 400 — NOT a
		// cached 409 (which would poison the key). Body + header carry retry_after 1.
		return buildWire(503, "error_position_conflict", err.message, {
			retryAfterBody: 1,
		});
	}
	if (err instanceof BetProductError) {
		const ctor = err.constructor as unknown as {
			httpStatus: number;
			code: string;
		};
		return buildWire(ctor.httpStatus, ctor.code, err.message);
	}
	return buildWire(500, "error_internal", "internal error");
}
