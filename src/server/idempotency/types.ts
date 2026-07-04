// Per SPEC.2 §11 ¶"Single source of truth" + ADR-0015. Owns the constants
// (header name, validation regex, two TTLs, pending-sentinel prefix) and
// the six error-envelope codes consumed by `cache.ts` + every state-
// mutating endpoint that runs the §11 in-handler stack. Pure-data module
// — no IO, no Redis, no Upstash imports. The state-machine logic lives in
// `cache.ts`; this file is its contract surface.

/** HTTP header consumed by every state-mutating endpoint per SPEC.2 §11 ¶"Idempotency contract". */
export const IDEMPOTENCY_HEADER_NAME = "Idempotency-Key";

/**
 * Validates the raw header value before passing to `idempotencyLookupOrReserve`.
 * Per SPEC.2 §11: `^[A-Za-z0-9_-]{1,255}$`. Rejects empty strings, 256+
 * chars, special chars (`{`, `}`, `:`, spaces). Caller maps malformed
 * values to HTTP 400 `error_idempotency_key_invalid`.
 */
export const IDEMPOTENCY_KEY_REGEX = /^[A-Za-z0-9_-]{1,255}$/;

/**
 * Pending-sentinel TTL in seconds. Sized for SPEC.2 §10 / ADR-0014's
 * 10-second moderation reservation worst case + SPEC.2 §9 / ADR-0013's
 * bet-transaction worst case (~600ms upper) + slack. Per ADR-0015 D1
 * this is a ratified value, NOT a HARDEN.5 tuning knob.
 */
export const PENDING_TTL_SECONDS = 30;

/**
 * Completed-response cache TTL in seconds (24 hours). Matches Stripe's
 * published Idempotency-Key contract per ADR-0015 D1. Ratified value;
 * NOT tuned by HARDEN.5.
 */
export const COMPLETED_TTL_SECONDS = 86400;

/**
 * Distinguishes a pending sentinel value from a completed-response JSON
 * body in a single Redis key. The sentinel value is
 * `${PREFIX}${bodyFingerprint}:${token}` (AUDIT-FIX-B3 A4 — the owner token
 * is a `randomUUID`, the `upstash/lock.ts` precedent) so the in-flight
 * collision check can detect body-mismatch on a still-pending key (per
 * SPEC.2 §11 ¶"Single-key-encoding-both-states pattern" + Q4 ratification
 * 2026-05-15: pending body-mismatch returns the in-flight shape, NOT the
 * completed-mismatch shape). The `cache.ts` pending-arm parse recovers the
 * fingerprint as the segment between the prefix and the LAST colon; the
 * ownership-checked release compares the whole value before acting, so a
 * >30s straggler can neither delete nor clobber a successor's key.
 */
export const PENDING_SENTINEL_PREFIX = "PENDING:";

/**
 * Error-envelope codes minted by ADR-0015 (per SPEC.2 §15.4 row 5 + §11).
 * Consumer wraps these in the six-field envelope at the HTTP / Server-
 * Action boundary per SPEC.2 §15.1; SCAFFOLD.4 only owns the catalogued
 * code strings.
 */
export const IDEMPOTENCY_ERROR_CODES = {
	KEY_REQUIRED: "error_idempotency_key_required",
	KEY_INVALID: "error_idempotency_key_invalid",
	KEY_REUSED: "error_idempotency_key_reused",
	IN_FLIGHT: "error_idempotency_in_flight",
	UNAVAILABLE: "error_idempotency_unavailable",
} as const;

/** HTTP 429 envelope code emitted by `rate-limit.ts` per ADR-0015 + SPEC.2 §15.4. */
export const RATE_LIMIT_ERROR_CODE = "error_rate_limit_exceeded" as const;

/**
 * Cache-replayable response payload. The `body` field is the deserialized
 * response body (so `release` can write a 429 envelope as a first-class
 * cache entry per SPEC.2 §11 ¶"Cached error responses include 429s").
 * `bodyFingerprint` is the RFC 8785 SHA-256 hex of the original REQUEST
 * body — used to disambiguate cache-hit vs body-mismatch on cross-endpoint
 * key reuse per ADR-0015 D5.
 */
export type CompletedResponse = {
	status: number;
	body: unknown;
	bodyFingerprint: string;
};

/**
 * Five-arm tagged union returned by `idempotencyLookupOrReserve`. Caller
 * MUST exhaustively discriminate on `kind` (TypeScript `strict` + `no-
 * UncheckedIndexedAccess` enforce this).
 *
 * - `hit` — cached completed payload exists with matching fingerprint;
 *   replay verbatim.
 * - `mismatch` — cached completed payload exists with different
 *   fingerprint; map to HTTP 409 `error_idempotency_key_reused`.
 * - `pending` — pending sentinel held (matching OR mismatched
 *   fingerprint, per Q4 ratification); map to HTTP 409
 *   `error_idempotency_in_flight + Retry-After: 2`.
 * - `miss` — fresh execution path; caller MUST call `release(response)`
 *   on success/terminal-error or `release(null)` on handler crash to
 *   either promote the sentinel to a completed payload or DEL it.
 * - `unavailable` — Upstash REST endpoint unreachable; caller maps to
 *   HTTP 503 `error_idempotency_unavailable + Retry-After: 5` (fail-
 *   CLOSED per ADR-0006 §"Failure-mode profile" + SPEC.2 §11).
 */
export type IdempotencyResult =
	| { kind: "hit"; cachedResponse: CompletedResponse }
	| { kind: "mismatch"; cachedFingerprint: string }
	| { kind: "pending"; heldFingerprint: string }
	| {
			kind: "miss";
			release: (response: CompletedResponse | null) => Promise<void>;
	  }
	| { kind: "unavailable"; error: unknown };
