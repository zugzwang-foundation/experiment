import type { KeyOutcome } from "./idempotency";

/**
 * UI.A3 slice 1 — the wire-code → W2.11 state map + the key-outcome
 * classifier (plan §4 table + §3.2 cache-semantics classes,
 * F-1/F-2-corrected). The client consumes the `toWireError` inventory
 * exactly as minted (SG-5: no new codes, unknown → generic, never a crash);
 * the unit suite pins completeness against the REAL server formatter.
 */

export type ComposerStateName =
	| "p2_terminal_suspended"
	| "p3_revise_blocked"
	| "p3_gate_down"
	| "p3_wait_in_flight"
	| "p3_transient_retry"
	| "p4_rate_limited"
	| "p3_protective_landing"
	| "p3_market_race"
	| "p6_concluded"
	| "auth_gate"
	| "route_onboarding"
	| "p3_image"
	| "p3_generic";

export type ComposerErrorState = {
	state: ComposerStateName;
	retryAfterSeconds?: number;
};

/** The §4 table verbatim (plan §4 "wire-code → W2.11 state map"). */
const STATE_BY_CODE: Readonly<Record<string, ComposerStateName>> = {
	comment_track_a_blocked: "p2_terminal_suspended",
	banned_user: "p2_terminal_suspended",
	comment_track_b_blocked: "p3_revise_blocked",
	error_moderation_unavailable: "p3_gate_down",
	error_moderation_in_flight: "p3_wait_in_flight",
	error_idempotency_in_flight: "p3_wait_in_flight",
	error_bet_serialization_exhausted: "p3_transient_retry",
	error_position_conflict: "p3_transient_retry",
	error_storage_unavailable: "p3_transient_retry",
	error_idempotency_unavailable: "p3_transient_retry",
	error_rate_limit_exceeded: "p4_rate_limited",
	// F-2: the PROTECTIVE landing (edit-after-invisible-commit) — never the
	// client-bug generic; key_required/key_invalid STAY generic below.
	error_idempotency_key_reused: "p3_protective_landing",
	error_market_closed_at: "p3_market_race",
	market_resolving: "p3_market_race",
	error_market_not_open: "p3_market_race",
	error_experiment_concluded: "p6_concluded",
	error_session_required: "auth_gate",
	error_onboarding_required: "route_onboarding",
	error_image_oversize: "p3_image",
	error_storage_object_missing: "p3_image",
	insufficient_dharma: "p3_generic",
	below_post_floor: "p3_generic",
	below_reply_floor: "p3_generic",
	comment_too_long: "p3_generic",
	insufficient_shares: "p3_generic",
	position_not_held: "p3_generic",
	opposite_side_held: "p3_generic",
	comment_requires_bet: "p3_generic",
	reply_depth_exceeded: "p3_generic",
	parent_comment_not_found: "p3_generic",
	error_idempotency_key_required: "p3_generic",
	error_idempotency_key_invalid: "p3_generic",
	error_invalid_json: "p3_generic",
	error_invalid_request_body: "p3_generic",
	error_origin_not_allowed: "p3_generic",
	error_internal: "p3_generic",
};

/** Map a wire error code onto its named W2.11 state; unknown → generic. */
export function mapWireError(args: {
	code: string;
	retryAfterSeconds?: number;
}): ComposerErrorState {
	const state = STATE_BY_CODE[args.code] ?? "p3_generic";
	const mapped: ComposerErrorState = { state };
	if (args.retryAfterSeconds !== undefined) {
		mapped.retryAfterSeconds = args.retryAfterSeconds;
	}
	return mapped;
}

/**
 * The never-cached family (§3.2): 503 any flavor, the in-flight 409s, and
 * the uncached 500 fallthrough — the key is HELD across these; a manual
 * retry is the legitimate replay path (ADR-0031).
 */
const TRANSIENT_CODES: ReadonlySet<string> = new Set([
	"error_bet_serialization_exhausted",
	"error_position_conflict",
	"error_storage_unavailable",
	"error_idempotency_unavailable",
	"error_moderation_unavailable",
	"error_moderation_in_flight",
	"error_idempotency_in_flight",
	"error_internal",
]);

/**
 * Classify a request outcome into the key lifecycle's cache-semantics
 * classes (plan §3.2): the 24h-cached 429 re-keys (F-1); the reused-409 is
 * the F-2 protective signal; every other error code is the cached-terminal
 * 4xx family (unknown codes included — the conservative read: assume
 * cached, rotate on the next edit).
 */
export function keyOutcomeFor(
	args:
		| { kind: "success" }
		| { kind: "network" }
		| { kind: "error"; code: string },
): KeyOutcome {
	if (args.kind === "success") {
		return "success";
	}
	if (args.kind === "network") {
		return "transient";
	}
	if (args.code === "error_rate_limit_exceeded") {
		return "rate_limited";
	}
	if (args.code === "error_idempotency_key_reused") {
		return "key_reused";
	}
	if (TRANSIENT_CODES.has(args.code)) {
		return "transient";
	}
	return "terminal";
}
