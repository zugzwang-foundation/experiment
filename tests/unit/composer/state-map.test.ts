import { describe, expect, it } from "vitest";
import {
	type ComposerStateName,
	keyOutcomeFor,
	mapWireError,
} from "@/components/debate/composer/state-map";
import {
	ImageOversizeError,
	ModerationInFlightError,
	ModerationUnavailableError,
	StorageObjectMissingError,
	StorageUnavailableError,
} from "@/lib/errors";
import {
	BannedUserError,
	BelowPostFloorError,
	BelowReplyFloorError,
	BetSerializationExhaustedError,
	CommentRequiresBetError,
	CommentTooLongError,
	CommentTrackABlockedError,
	CommentTrackBBlockedError,
	InsufficientDharmaError,
	InsufficientSharesError,
	InvalidRequestBodyError,
	MarketNotOpenError,
	OppositeSideHeldError,
	ParentCommentNotFoundError,
	PositionNotHeldError,
	ReplyDepthExceededError,
	toWireError,
} from "@/server/bets/errors";
import {
	IDEMPOTENCY_ERROR_CODES,
	RATE_LIMIT_ERROR_CODE,
} from "@/server/idempotency/types";
import {
	PositionOversellError,
	PositionSingleSideError,
} from "@/server/positions/errors";

// UI.A3 §5.6 tests-first — the wire-code → W2.11 state map + the key-outcome
// classifier (plan §4 table + §3.2 cache-semantics classes; F-1/F-2-corrected).
// PURE / DB-INDEPENDENT: REDs NOW on the unresolvable greenfield import
// (`state-map`) and GREENs when the module lands. Server modules ARE imported
// (server-only is shimmed in vitest) — the completeness pin below runs the
// REAL `toWireError` over an instance of every throwable so the client map can
// never silently miss a code the server can emit (the §5.10 audit law "state
// map completeness vs errors.ts").
//
// Plan-§1 rows asserted / supported here:
//   - I-IDEM-ONCE (F-1/F-2) — keyOutcomeFor classifies every code into the
//     cache-semantics classes that drive the key lifecycle: the never-cached
//     family (5xx / in-flight 409s / error_internal) → "transient" (key
//     HELD); the 24h-cached 429 → "rate_limited" (F-1 re-key); the reused-409
//     → "key_reused" (F-2 protective landing); everything else (cached 4xx)
//     → "terminal".
//   - Moderation narrative (§1) — Track A → P2 terminal; Track B → P3
//     revise; gate-down 503 → P3 manual retry; in-flight 409 → wait state.
//   - SG-5 — an UNKNOWN code renders the generic P3 state, never a crash.
//
// PINNED PUBLIC-API CONTRACT (the implementer matches these names exactly):
//   type ComposerStateName =
//     | "p2_terminal_suspended" | "p3_revise_blocked" | "p3_gate_down"
//     | "p3_wait_in_flight" | "p3_transient_retry" | "p4_rate_limited"
//     | "p3_protective_landing" | "p3_market_race" | "p6_concluded"
//     | "auth_gate" | "route_onboarding" | "p3_image" | "p3_generic"
//   type ComposerErrorState = { state: ComposerStateName;
//     retryAfterSeconds?: number }
//   mapWireError(args: { code: string; retryAfterSeconds?: number }):
//     ComposerErrorState — the FULL §4 table; retryAfterSeconds passes
//     through where given; unknown codes → "p3_generic".
//   keyOutcomeFor(args: { kind: "success" } | { kind: "network" }
//     | { kind: "error"; code: string }):
//     "success" | "transient" | "rate_limited" | "terminal" | "key_reused"

const STATE_NAMES: readonly ComposerStateName[] = [
	"p2_terminal_suspended",
	"p3_revise_blocked",
	"p3_gate_down",
	"p3_wait_in_flight",
	"p3_transient_retry",
	"p4_rate_limited",
	"p3_protective_landing",
	"p3_market_race",
	"p6_concluded",
	"auth_gate",
	"route_onboarding",
	"p3_image",
	"p3_generic",
];

// THE §4 TABLE, verbatim (plan §4 "wire-code → W2.11 state map").
const SECTION_4_TABLE: ReadonlyArray<[string, ComposerStateName]> = [
	["comment_track_a_blocked", "p2_terminal_suspended"],
	["banned_user", "p2_terminal_suspended"],
	["comment_track_b_blocked", "p3_revise_blocked"],
	["error_moderation_unavailable", "p3_gate_down"],
	["error_moderation_in_flight", "p3_wait_in_flight"],
	["error_idempotency_in_flight", "p3_wait_in_flight"],
	["error_bet_serialization_exhausted", "p3_transient_retry"],
	["error_position_conflict", "p3_transient_retry"],
	["error_storage_unavailable", "p3_transient_retry"],
	["error_idempotency_unavailable", "p3_transient_retry"],
	["error_rate_limit_exceeded", "p4_rate_limited"],
	["error_idempotency_key_reused", "p3_protective_landing"],
	["error_market_closed_at", "p3_market_race"],
	["market_resolving", "p3_market_race"],
	["error_market_not_open", "p3_market_race"],
	["error_experiment_concluded", "p6_concluded"],
	["error_session_required", "auth_gate"],
	["error_onboarding_required", "route_onboarding"],
	["error_image_oversize", "p3_image"],
	["error_storage_object_missing", "p3_image"],
	["insufficient_dharma", "p3_generic"],
	["below_post_floor", "p3_generic"],
	["below_reply_floor", "p3_generic"],
	["comment_too_long", "p3_generic"],
	["insufficient_shares", "p3_generic"],
	["position_not_held", "p3_generic"],
	["opposite_side_held", "p3_generic"],
	["comment_requires_bet", "p3_generic"],
	["reply_depth_exceeded", "p3_generic"],
	["parent_comment_not_found", "p3_generic"],
	["error_idempotency_key_required", "p3_generic"],
	["error_idempotency_key_invalid", "p3_generic"],
	["error_invalid_json", "p3_generic"],
	["error_invalid_request_body", "p3_generic"],
	["error_origin_not_allowed", "p3_generic"],
	["error_internal", "p3_generic"],
];

/** The codes for which "p3_generic" is the CORRECT (not fallback-bug) state. */
const GENERIC_ALLOWLIST = new Set(
	SECTION_4_TABLE.filter(([, state]) => state === "p3_generic").map(
		([code]) => code,
	),
);

describe("mapWireError — the full §4 table", () => {
	for (const [code, state] of SECTION_4_TABLE) {
		it(`state-map::${code}->${state}`, () => {
			expect(mapWireError({ code }).state).toBe(state);
		});
	}

	it("state-map::unknown-code-renders-generic-never-crashes (SG-5)", () => {
		expect(() => mapWireError({ code: "some_future_code" })).not.toThrow();
		expect(mapWireError({ code: "some_future_code" }).state).toBe("p3_generic");
	});

	it("state-map::retry-after-passes-through-where-given", () => {
		expect(
			mapWireError({
				code: "error_rate_limit_exceeded",
				retryAfterSeconds: 30,
			}),
		).toEqual({ state: "p4_rate_limited", retryAfterSeconds: 30 });
		expect(
			mapWireError({
				code: "error_moderation_unavailable",
				retryAfterSeconds: 5,
			}),
		).toEqual({ state: "p3_gate_down", retryAfterSeconds: 5 });
		expect(
			mapWireError({
				code: "error_moderation_in_flight",
				retryAfterSeconds: 2,
			}),
		).toEqual({ state: "p3_wait_in_flight", retryAfterSeconds: 2 });
	});

	it("state-map::retry-after-absent-when-not-given", () => {
		expect(
			mapWireError({ code: "error_rate_limit_exceeded" }).retryAfterSeconds,
		).toBeUndefined();
	});
});

describe("mapWireError — completeness vs the REAL toWireError inventory", () => {
	// One instance of EVERY throwable the write path can surface, run through
	// the real `toWireError` (src/server/bets/errors.ts:330-411). Constructor
	// argument shapes read from errors.ts / lib/errors.ts / positions/errors.ts
	// this session. NOTE: `BetFlow` is the F-* flow union ("F-BET-1" | … |
	// "F-COMMENT-3"), not "place"/"sell" — "F-BET-1" IS the place flow.
	const THROWABLES: ReadonlyArray<{
		name: string;
		err: unknown;
		wireCode: string;
		state: ComposerStateName;
	}> = [
		{
			name: "BetSerializationExhaustedError",
			err: new BetSerializationExhaustedError({
				sqlstate: "40001",
				flow: "F-BET-1",
			}),
			wireCode: "error_bet_serialization_exhausted",
			state: "p3_transient_retry",
		},
		{
			name: "MarketNotOpenError(Closed)",
			err: new MarketNotOpenError("Closed"),
			wireCode: "error_market_closed_at",
			state: "p3_market_race",
		},
		{
			name: "MarketNotOpenError(Resolving)",
			err: new MarketNotOpenError("Resolving"),
			wireCode: "market_resolving",
			state: "p3_market_race",
		},
		{
			name: "MarketNotOpenError(Draft)",
			err: new MarketNotOpenError("Draft"),
			wireCode: "error_market_not_open",
			state: "p3_market_race",
		},
		{
			name: "MarketNotOpenError(Resolved)",
			err: new MarketNotOpenError("Resolved"),
			wireCode: "error_market_not_open",
			state: "p3_market_race",
		},
		{
			name: "MarketNotOpenError(Voided)",
			err: new MarketNotOpenError("Voided"),
			wireCode: "error_market_not_open",
			state: "p3_market_race",
		},
		{
			name: "MarketNotOpenError(Frozen)",
			err: new MarketNotOpenError("Frozen"),
			wireCode: "error_market_not_open",
			state: "p3_market_race",
		},
		{
			name: "ModerationInFlightError",
			err: new ModerationInFlightError(),
			wireCode: "error_moderation_in_flight",
			state: "p3_wait_in_flight",
		},
		{
			name: "ModerationUnavailableError",
			err: new ModerationUnavailableError(new Error("vendor down")),
			wireCode: "error_moderation_unavailable",
			state: "p3_gate_down",
		},
		{
			name: "ImageOversizeError",
			err: new ImageOversizeError(9_000_000, 8_388_608),
			wireCode: "error_image_oversize",
			state: "p3_image",
		},
		{
			name: "StorageObjectMissingError",
			err: new StorageObjectMissingError("u/user/upload.jpg"),
			wireCode: "error_storage_object_missing",
			state: "p3_image",
		},
		{
			name: "StorageUnavailableError",
			err: new StorageUnavailableError(new Error("r2 down")),
			wireCode: "error_storage_unavailable",
			state: "p3_transient_retry",
		},
		{
			name: "PositionOversellError",
			err: new PositionOversellError("quantity would go negative"),
			wireCode: "insufficient_shares",
			state: "p3_generic",
		},
		{
			name: "PositionSingleSideError",
			err: new PositionSingleSideError("second held side"),
			wireCode: "error_position_conflict",
			state: "p3_transient_retry",
		},
		{
			name: "InsufficientDharmaError",
			err: new InsufficientDharmaError({ balance: "0", required: "10" }),
			wireCode: "insufficient_dharma",
			state: "p3_generic",
		},
		{
			name: "InsufficientSharesError",
			err: new InsufficientSharesError({ held: "0", requested: "1" }),
			wireCode: "insufficient_shares",
			state: "p3_generic",
		},
		{
			name: "BelowPostFloorError",
			err: new BelowPostFloorError(),
			wireCode: "below_post_floor",
			state: "p3_generic",
		},
		{
			name: "BelowReplyFloorError",
			err: new BelowReplyFloorError(),
			wireCode: "below_reply_floor",
			state: "p3_generic",
		},
		{
			name: "OppositeSideHeldError",
			err: new OppositeSideHeldError({ currentSide: "YES", shares: "1" }),
			wireCode: "opposite_side_held",
			state: "p3_generic",
		},
		{
			name: "PositionNotHeldError",
			err: new PositionNotHeldError(),
			wireCode: "position_not_held",
			state: "p3_generic",
		},
		{
			name: "BannedUserError",
			err: new BannedUserError(),
			wireCode: "banned_user",
			state: "p2_terminal_suspended",
		},
		{
			name: "CommentTooLongError",
			err: new CommentTooLongError(),
			wireCode: "comment_too_long",
			state: "p3_generic",
		},
		{
			name: "CommentTrackABlockedError",
			err: new CommentTrackABlockedError(),
			wireCode: "comment_track_a_blocked",
			state: "p2_terminal_suspended",
		},
		{
			name: "CommentTrackBBlockedError",
			err: new CommentTrackBBlockedError(),
			wireCode: "comment_track_b_blocked",
			state: "p3_revise_blocked",
		},
		{
			name: "CommentRequiresBetError",
			err: new CommentRequiresBetError(),
			wireCode: "comment_requires_bet",
			state: "p3_generic",
		},
		{
			name: "ReplyDepthExceededError",
			err: new ReplyDepthExceededError(),
			wireCode: "reply_depth_exceeded",
			state: "p3_generic",
		},
		{
			name: "ParentCommentNotFoundError",
			err: new ParentCommentNotFoundError(),
			wireCode: "parent_comment_not_found",
			state: "p3_generic",
		},
		{
			name: "InvalidRequestBodyError",
			err: new InvalidRequestBodyError(),
			wireCode: "error_invalid_request_body",
			state: "p3_generic",
		},
		{
			name: "Error (unrecognized)",
			err: new Error("x"),
			wireCode: "error_internal",
			state: "p3_generic",
		},
	];

	for (const { name, err, wireCode, state } of THROWABLES) {
		it(`state-map::throwable-${name}-maps-to-a-named-state`, () => {
			const wire = toWireError(err);
			// The real formatter emits the expected code…
			expect(wire.body.error.code).toBe(wireCode);
			// …and the client map lands it on a DEFINED named state.
			const mapped = mapWireError({
				code: wire.body.error.code,
				retryAfterSeconds: wire.body.error.retry_after,
			});
			expect(STATE_NAMES).toContain(mapped.state);
			expect(mapped.state).toBe(state);
			// p3_generic is legal ONLY for the §4 generic-listed codes — a
			// specifically-named code falling through to generic is the
			// completeness bug this pin exists to catch.
			if (mapped.state === "p3_generic") {
				expect(GENERIC_ALLOWLIST.has(wireCode)).toBe(true);
			}
		});
	}
});

describe("mapWireError — endpoint-prefix codes (@/server/idempotency/types)", () => {
	it("state-map::every-idempotency-code-lands-on-a-named-state", () => {
		for (const code of Object.values(IDEMPOTENCY_ERROR_CODES)) {
			expect(STATE_NAMES).toContain(mapWireError({ code }).state);
		}
	});

	it("state-map::idempotency-code-pins", () => {
		expect(
			mapWireError({ code: IDEMPOTENCY_ERROR_CODES.KEY_REUSED }).state,
		).toBe("p3_protective_landing");
		expect(
			mapWireError({ code: IDEMPOTENCY_ERROR_CODES.IN_FLIGHT }).state,
		).toBe("p3_wait_in_flight");
		expect(
			mapWireError({ code: IDEMPOTENCY_ERROR_CODES.UNAVAILABLE }).state,
		).toBe("p3_transient_retry");
		// F-2: key_required / key_invalid STAY client-bug generic — only the
		// reused-409 is the protective landing.
		expect(
			mapWireError({ code: IDEMPOTENCY_ERROR_CODES.KEY_REQUIRED }).state,
		).toBe("p3_generic");
		expect(
			mapWireError({ code: IDEMPOTENCY_ERROR_CODES.KEY_INVALID }).state,
		).toBe("p3_generic");
	});

	it("state-map::rate-limit-code-pin", () => {
		expect(mapWireError({ code: RATE_LIMIT_ERROR_CODE }).state).toBe(
			"p4_rate_limited",
		);
	});
});

describe("keyOutcomeFor — the §3.2 cache-semantics classes", () => {
	// The never-cached family (5xx any flavor + the in-flight 409s +
	// error_internal): key HELD — a manual retry is the legitimate replay.
	const TRANSIENT_FAMILY = [
		"error_bet_serialization_exhausted",
		"error_position_conflict",
		"error_storage_unavailable",
		"error_idempotency_unavailable",
		"error_moderation_unavailable",
		"error_moderation_in_flight",
		"error_idempotency_in_flight",
		"error_internal",
	] as const;

	it("state-map::success-and-network-classes", () => {
		expect(keyOutcomeFor({ kind: "success" })).toBe("success");
		expect(keyOutcomeFor({ kind: "network" })).toBe("transient");
	});

	it("state-map::never-cached-family-is-transient (held key)", () => {
		for (const code of TRANSIENT_FAMILY) {
			expect(keyOutcomeFor({ kind: "error", code })).toBe("transient");
		}
	});

	it("state-map::429-is-rate-limited (F-1 — cached 24h, re-key)", () => {
		expect(
			keyOutcomeFor({ kind: "error", code: "error_rate_limit_exceeded" }),
		).toBe("rate_limited");
	});

	it("state-map::reused-409-is-key-reused (F-2)", () => {
		expect(
			keyOutcomeFor({ kind: "error", code: "error_idempotency_key_reused" }),
		).toBe("key_reused");
	});

	it("state-map::every-other-code-is-terminal (cached 4xx family)", () => {
		const special = new Set<string>([
			...TRANSIENT_FAMILY,
			"error_rate_limit_exceeded",
			"error_idempotency_key_reused",
		]);
		const terminalCodes = SECTION_4_TABLE.map(([code]) => code).filter(
			(code) => !special.has(code),
		);
		expect(terminalCodes.length).toBeGreaterThan(0);
		for (const code of terminalCodes) {
			expect(keyOutcomeFor({ kind: "error", code })).toBe("terminal");
		}
	});

	it("state-map::unknown-codes-are-terminal", () => {
		expect(keyOutcomeFor({ kind: "error", code: "some_future_code" })).toBe(
			"terminal",
		);
	});
});
