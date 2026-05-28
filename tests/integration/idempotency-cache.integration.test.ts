import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Per SCAFFOLD.4 plan §7.1 + §7 ¶"Mocking discipline" — substrate-only
// state-machine tests for `idempotencyLookupOrReserve`. Upstash REST
// client is mocked via `vi.mock('@upstash/redis')`; no real Redis hit.
// The bet-flow integration tests in ENGINE.7+ will exercise the real
// cache against a hermetic Redis or per-test-prefixed Upstash endpoint —
// out of scope here.
//
// State machine (per plan §F2 cache.ts pseudocode + Q4 resolution +
// SCAFFOLD.8 LD-10 env-prefix):
//   redisKey = getRedisKey("idem", key)  // e.g. `prod:idem:${key}`
//   SET NX EX 30 → if 'OK' → kind:'miss' + release callback
//                  else GET existing
//                       if null → race-retry (recurse once)
//                       if startsWith('PENDING:') → kind:'pending'
//                                                   (matching OR mismatched fp,
//                                                   per Q4 in-flight shape)
//                       else parse as CompletedResponse
//                            if fp matches → kind:'hit'
//                            else → kind:'mismatch'
//   any throw in the try block → kind:'unavailable' (fail-CLOSED per
//                                ADR-0006 §"Failure-mode profile")
//
// Tag string `upstash_unavailable_idempotency` matches SPEC.2 §17.3 col 4
// byte-for-byte (Sentry alarm-6b discriminator routed through
// `captureException(err, { tags: { kind: 'upstash_unavailable_idempotency' } })`).

// --- Upstash Redis mock ----------------------------------------------------
//
// Cache.ts gets its Redis handle from the singleton wrapper at
// `@/server/upstash/redis` (per Q3 resolution). We mock the WRAPPER directly
// — that's the only call site cache.ts touches, and mocking the wrapper is
// the cleanest way to control SET / GET / DEL responses per test.
//
// The mocked client exposes the three methods cache.ts uses (`set`, `get`,
// `del`) as `vi.fn()`s; each test re-wires them with `mockResolvedValueOnce`
// or similar to script the SET-NX win/loss + GET hit/miss + Upstash-throw
// state-machine arms.

// vi.mock() is hoisted to the top of the file. Variables referenced inside
// the factory MUST come from vi.hoisted() (also hoisted) — top-level `const`
// is not yet initialized when the factory runs. Per vitest docs:
// https://vitest.dev/api/vi.html#vi-hoisted
const { mockRedis } = vi.hoisted(() => ({
	mockRedis: {
		set: vi.fn(),
		get: vi.fn(),
		del: vi.fn(),
	},
}));

vi.mock("@/server/upstash/redis", () => ({
	redis: mockRedis,
}));

// --- @sentry/nextjs mock --------------------------------------------------
//
// SCAFFOLD.5 routed the fail-closed observability emission to Sentry's
// `captureException` with a tag. Mock the SDK at the wrapper boundary so the
// test asserts on the captured (err, options) tuple without touching the real
// Sentry transport.

const { mockCaptureException } = vi.hoisted(() => ({
	mockCaptureException: vi.fn(),
}));

vi.mock("@sentry/nextjs", () => ({
	captureException: mockCaptureException,
}));

// `types.ts` constants are NOT mocked — tests read them at runtime so a
// HARDEN.6 retune (e.g. PENDING_TTL_SECONDS bump) doesn't silently break
// the assertion. Plan §6 edge-case enumeration explicitly calls this out.
import {
	computeBodyFingerprint,
	idempotencyLookupOrReserve,
} from "@/server/idempotency/cache";
import {
	COMPLETED_TTL_SECONDS,
	IDEMPOTENCY_ERROR_CODES,
	IDEMPOTENCY_KEY_REGEX,
	PENDING_SENTINEL_PREFIX,
	PENDING_TTL_SECONDS,
} from "@/server/idempotency/types";
import { getRedisKey } from "@/server/upstash/keys";

beforeEach(() => {
	mockRedis.set.mockReset();
	mockRedis.get.mockReset();
	mockRedis.del.mockReset();
	mockCaptureException.mockClear();
});

afterEach(() => {
	// clearAllMocks (NOT restoreAllMocks) — restoreAllMocks would tear down
	// the @/server/upstash/redis + @sentry/nextjs vi.mock factories that
	// other tests in this file rely on. clearAll keeps the factories
	// attached and just resets call history.
	vi.clearAllMocks();
});

describe("idempotency cache state machine", () => {
	// === §7.1 row 1 =========================================================

	it("idempotency::cache-hit-returns-cached-response", async () => {
		// Cache holds a completed payload whose fp matches the call. State
		// machine: SET NX → race-loss → GET returns the JSON → fp matches →
		// kind: 'hit'. INV-1 indirect: the ENGINE.7 bet wrapper relies on
		// this short-circuit; a wrong arm here would re-execute a bet.
		const key = "test-key-1";
		const fingerprint = "fp-cached";
		const cachedResponse = {
			status: 200,
			body: { ok: true, betId: "bet-123" },
			bodyFingerprint: fingerprint,
		};

		mockRedis.set.mockResolvedValueOnce(null); // SET NX loses (key exists)
		mockRedis.get.mockResolvedValueOnce(JSON.stringify(cachedResponse));

		const result = await idempotencyLookupOrReserve(key, fingerprint);

		expect(result.kind).toBe("hit");
		if (result.kind === "hit") {
			expect(result.cachedResponse).toEqual(cachedResponse);
		}
		// SET NX was the only write attempt; no further set fires on a hit.
		expect(mockRedis.set).toHaveBeenCalledTimes(1);
		expect(mockRedis.get).toHaveBeenCalledWith(getRedisKey("idem", key));
		expect(mockRedis.del).not.toHaveBeenCalled();
	});

	// === §7.1 row 2 =========================================================

	it("idempotency::cache-miss-executes-fresh", async () => {
		// SET NX wins ('OK'). State machine returns kind:'miss' + release
		// callback. Release with a non-null response promotes the sentinel
		// to a completed payload via `SET … EX 86400` (no NX flag, since the
		// pending sentinel currently holds the key).
		const key = "test-key-2";
		const fingerprint = "fp-fresh";
		const completed = {
			status: 200,
			body: { ok: true, betId: "bet-fresh" },
			bodyFingerprint: fingerprint,
		};

		mockRedis.set.mockResolvedValueOnce("OK"); // SET NX wins
		mockRedis.set.mockResolvedValueOnce("OK"); // release-promotion SET

		const result = await idempotencyLookupOrReserve(key, fingerprint);

		expect(result.kind).toBe("miss");
		if (result.kind !== "miss") return;

		// SET NX was issued with the pending sentinel + 30s TTL.
		expect(mockRedis.set).toHaveBeenNthCalledWith(
			1,
			getRedisKey("idem", key),
			`${PENDING_SENTINEL_PREFIX}${fingerprint}`,
			{ nx: true, ex: PENDING_TTL_SECONDS },
		);
		// Release writes the completed payload with 24h TTL, no NX (the key
		// already holds the pending sentinel; this OVERWRITES it).
		await result.release(completed);
		expect(mockRedis.set).toHaveBeenNthCalledWith(
			2,
			getRedisKey("idem", key),
			JSON.stringify(completed),
			{ ex: COMPLETED_TTL_SECONDS },
		);
	});

	// === §7.1 row 3 =========================================================

	it("idempotency::body-mismatch-returns-409", async () => {
		// Completed entry holds fingerprint A; call with fingerprint B
		// returns kind:'mismatch'. INV-1 / INV-2 indirect: prevents the
		// "key reused with mutated body" attack from silently executing
		// a fresh bet under a stale key.
		const key = "test-key-3";
		const fingerprintCached = "fp-A";
		const fingerprintCall = "fp-B";
		const cachedResponse = {
			status: 200,
			body: { ok: true, betId: "bet-old" },
			bodyFingerprint: fingerprintCached,
		};

		mockRedis.set.mockResolvedValueOnce(null);
		mockRedis.get.mockResolvedValueOnce(JSON.stringify(cachedResponse));

		const result = await idempotencyLookupOrReserve(key, fingerprintCall);

		expect(result.kind).toBe("mismatch");
		if (result.kind === "mismatch") {
			expect(result.cachedFingerprint).toBe(fingerprintCached);
		}
		// Caller maps to 409 error_idempotency_key_reused; constant is the
		// contract surface tested for verbatim correctness here too.
		expect(IDEMPOTENCY_ERROR_CODES.KEY_REUSED).toBe(
			"error_idempotency_key_reused",
		);
	});

	// === §7.1 row 4 =========================================================

	it("idempotency::in-flight-collision-returns-409-retry-after-2", async () => {
		// Pending sentinel with fingerprint A held; call with fingerprint A
		// returns kind:'pending' + heldFingerprint A. Caller maps to 409
		// error_idempotency_in_flight + Retry-After: 2.
		const key = "test-key-4";
		const fingerprint = "fp-pending";
		const sentinel = `${PENDING_SENTINEL_PREFIX}${fingerprint}`;

		mockRedis.set.mockResolvedValueOnce(null);
		mockRedis.get.mockResolvedValueOnce(sentinel);

		const result = await idempotencyLookupOrReserve(key, fingerprint);

		expect(result.kind).toBe("pending");
		if (result.kind === "pending") {
			expect(result.heldFingerprint).toBe(fingerprint);
		}
		expect(IDEMPOTENCY_ERROR_CODES.IN_FLIGHT).toBe(
			"error_idempotency_in_flight",
		);
	});

	// === §7.1 row 5 (extension — Q4 ratification) ===========================

	it("idempotency::in-flight-mismatch-still-409-on-pending-sentinel", async () => {
		// Pending sentinel holds fingerprint A; CALL with fingerprint B.
		// Per Q4 (Web Claude sign-off 2026-05-15): body-mismatch on a
		// still-pending sentinel returns the in-flight shape (kind:'pending'),
		// NOT the completed-mismatch shape. Surfaced as INV-1 indirectly:
		// surfacing two different errors mid-flight would confuse client
		// retry policy and the in-flight request may yet complete with a
		// body that matches the eventual retry.
		const key = "test-key-5";
		const fingerprintHeld = "fp-A";
		const fingerprintCall = "fp-B";
		const sentinel = `${PENDING_SENTINEL_PREFIX}${fingerprintHeld}`;

		mockRedis.set.mockResolvedValueOnce(null);
		mockRedis.get.mockResolvedValueOnce(sentinel);

		const result = await idempotencyLookupOrReserve(key, fingerprintCall);

		// Critical: NOT 'mismatch'. Pending arm returns 'pending' with the
		// held fingerprint, regardless of caller fingerprint.
		expect(result.kind).toBe("pending");
		if (result.kind === "pending") {
			expect(result.heldFingerprint).toBe(fingerprintHeld);
		}
	});

	// === §7.1 row 6 =========================================================

	it("idempotency::pending-sentinel-ttl-30s", async () => {
		// Per plan §7 ¶"For TTL tests" — assert on the `ex` ARGUMENT passed
		// to redis.set, not on clock manipulation. PENDING_TTL_SECONDS is
		// imported live so a HARDEN.6 retune doesn't silently break the
		// assertion.
		const key = "test-key-6";
		const fingerprint = "fp-ttl-pending";

		mockRedis.set.mockResolvedValueOnce("OK");

		await idempotencyLookupOrReserve(key, fingerprint);

		expect(mockRedis.set).toHaveBeenCalledWith(
			getRedisKey("idem", key),
			`${PENDING_SENTINEL_PREFIX}${fingerprint}`,
			expect.objectContaining({ ex: PENDING_TTL_SECONDS }),
		);
		// Sanity floor: the constant is exactly 30 per plan §F1 (HARDEN.6
		// is documented NOT to tune this — it's an ADR-0015 D1 ratified
		// number). If a future PR moves this to 60, the test surfaces it.
		expect(PENDING_TTL_SECONDS).toBe(30);
	});

	// === §7.1 row 7 =========================================================

	it("idempotency::completed-response-ttl-24h", async () => {
		// After release(response), the completed payload SET carries
		// COMPLETED_TTL_SECONDS (86400). Same approach as TTL-30s: assert
		// on the `ex` ARG, not on clock advancement.
		const key = "test-key-7";
		const fingerprint = "fp-ttl-complete";
		const completed = {
			status: 200,
			body: { ok: true },
			bodyFingerprint: fingerprint,
		};

		mockRedis.set.mockResolvedValueOnce("OK"); // SET NX wins
		mockRedis.set.mockResolvedValueOnce("OK"); // release SET

		const result = await idempotencyLookupOrReserve(key, fingerprint);
		expect(result.kind).toBe("miss");
		if (result.kind !== "miss") return;

		await result.release(completed);

		expect(mockRedis.set).toHaveBeenNthCalledWith(
			2,
			getRedisKey("idem", key),
			JSON.stringify(completed),
			expect.objectContaining({ ex: COMPLETED_TTL_SECONDS }),
		);
		expect(COMPLETED_TTL_SECONDS).toBe(86400);
	});

	// === §7.1 row 8 =========================================================

	it("idempotency::cached-response-includes-error-envelopes", async () => {
		// Per SPEC.2 §11 ¶"Cached error responses include 429s" — a 429
		// response is a first-class cache entry; subsequent GET with same
		// key + same fingerprint replays the 429 verbatim. Proves
		// `release` doesn't filter on response status.
		const key = "test-key-8";
		const fingerprint = "fp-429";
		const errorResponse = {
			status: 429,
			body: {
				ok: false,
				error: { code: "error_rate_limit_exceeded" },
			},
			bodyFingerprint: fingerprint,
		};

		// First call: miss + release writes the 429.
		mockRedis.set.mockResolvedValueOnce("OK"); // SET NX wins
		mockRedis.set.mockResolvedValueOnce("OK"); // release SET
		const first = await idempotencyLookupOrReserve(key, fingerprint);
		expect(first.kind).toBe("miss");
		if (first.kind !== "miss") return;
		await first.release(errorResponse);

		// Verify release wrote the 429 envelope (not "filtered out" because
		// status !== 2xx). Body is JSON.stringify(errorResponse) verbatim.
		expect(mockRedis.set).toHaveBeenNthCalledWith(
			2,
			getRedisKey("idem", key),
			JSON.stringify(errorResponse),
			expect.objectContaining({ ex: COMPLETED_TTL_SECONDS }),
		);

		// Second call: SET NX loses, GET returns the cached 429 envelope.
		mockRedis.set.mockResolvedValueOnce(null);
		mockRedis.get.mockResolvedValueOnce(JSON.stringify(errorResponse));
		const second = await idempotencyLookupOrReserve(key, fingerprint);

		expect(second.kind).toBe("hit");
		if (second.kind === "hit") {
			expect(second.cachedResponse.status).toBe(429);
			expect(second.cachedResponse).toEqual(errorResponse);
		}
	});

	// === §7.1 row 9 =========================================================

	it("idempotency::fails-closed-on-upstash-unreachable-503", async () => {
		// Upstash mock rejects (network error); state machine catches +
		// returns kind:'unavailable'. Caller maps to HTTP 503
		// error_idempotency_unavailable + Retry-After: 5 (per ADR-0015).
		// Per ADR-0006 §"Failure-mode profile": idempotency fails CLOSED.
		// Tag `upstash_unavailable_idempotency` is the SPEC.2 §17.3 alarm-6b
		// discriminator routed through Sentry.captureException.
		const key = "test-key-9";
		const fingerprint = "fp-unavailable";
		const networkError = new Error("ECONNREFUSED");

		mockRedis.set.mockRejectedValueOnce(networkError);

		const result = await idempotencyLookupOrReserve(key, fingerprint);

		expect(result.kind).toBe("unavailable");
		if (result.kind === "unavailable") {
			expect(result.error).toBe(networkError);
		}
		expect(mockCaptureException).toHaveBeenCalledWith(networkError, {
			tags: { kind: "upstash_unavailable_idempotency" },
		});
		// Constant assertion — the catalogued error code consumers map to.
		expect(IDEMPOTENCY_ERROR_CODES.UNAVAILABLE).toBe(
			"error_idempotency_unavailable",
		);
	});

	// === §7.1 row 10 (extension) ============================================

	it("idempotency::release-on-crash-deletes-pending-sentinel", async () => {
		// Caller invokes release(null) in `finally` after handler crash.
		// State machine: pending sentinel is DELed (not promoted to a
		// completed payload). Plan §5 failure mode #3 — handler-crash
		// recovery path before TTL safety net (30s) kicks in.
		const key = "test-key-10";
		const fingerprint = "fp-crash";

		mockRedis.set.mockResolvedValueOnce("OK"); // SET NX wins
		mockRedis.del.mockResolvedValueOnce(1);

		const result = await idempotencyLookupOrReserve(key, fingerprint);
		expect(result.kind).toBe("miss");
		if (result.kind !== "miss") return;

		await result.release(null);

		// DEL was issued on the pending sentinel; no second SET fired.
		expect(mockRedis.del).toHaveBeenCalledWith(getRedisKey("idem", key));
		expect(mockRedis.set).toHaveBeenCalledTimes(1); // only the SET NX
	});

	// === §7.1 row 11 (extension) ============================================

	it("idempotency::release-returns-promise", async () => {
		// release MUST return a Promise the caller can `await`. A
		// synchronous-or-undefined return would surface as a "cannot read
		// .then of undefined" at the consumer's `finally { await release() }`.
		const key = "test-key-11";
		const fingerprint = "fp-async";
		const completed = {
			status: 200,
			body: { ok: true },
			bodyFingerprint: fingerprint,
		};

		mockRedis.set.mockResolvedValueOnce("OK"); // SET NX
		mockRedis.set.mockResolvedValueOnce("OK"); // release-promotion SET

		const result = await idempotencyLookupOrReserve(key, fingerprint);
		expect(result.kind).toBe("miss");
		if (result.kind !== "miss") return;

		const releasePromise = result.release(completed);
		// Must be then-able. If release returned undefined or a non-promise
		// value, this would throw synchronously.
		expect(releasePromise).toBeInstanceOf(Promise);
		await expect(releasePromise).resolves.toBeUndefined();
	});

	// === §7.1 row 12 (extension at types.ts boundary) =======================

	it("idempotency::regex-key-validation", async () => {
		// IDEMPOTENCY_KEY_REGEX from types.ts. Surface validates header
		// shape BEFORE calling idempotencyLookupOrReserve, so this is a
		// pure regex shape test — no Redis mock needed. Plan §6 enumerates
		// the boundary explicitly: "rejects empty string, 256+ chars,
		// special chars (`{`, `}`, `:`, spaces); accepts 1–255 chars of
		// `[A-Za-z0-9_-]`."
		// Accept cases.
		expect(IDEMPOTENCY_KEY_REGEX.test("a")).toBe(true);
		expect(IDEMPOTENCY_KEY_REGEX.test("A1_-z")).toBe(true);
		expect(IDEMPOTENCY_KEY_REGEX.test("abc-123_DEF")).toBe(true);
		expect(IDEMPOTENCY_KEY_REGEX.test("a".repeat(255))).toBe(true);

		// Reject cases.
		expect(IDEMPOTENCY_KEY_REGEX.test("")).toBe(false); // empty
		expect(IDEMPOTENCY_KEY_REGEX.test("a".repeat(256))).toBe(false); // 256
		expect(IDEMPOTENCY_KEY_REGEX.test("has space")).toBe(false);
		expect(IDEMPOTENCY_KEY_REGEX.test("brace{")).toBe(false);
		expect(IDEMPOTENCY_KEY_REGEX.test("brace}")).toBe(false);
		expect(IDEMPOTENCY_KEY_REGEX.test("colon:val")).toBe(false);
		expect(IDEMPOTENCY_KEY_REGEX.test("slash/x")).toBe(false);

		// Sanity: also ensure computeBodyFingerprint exists as the partner
		// import (state-machine entry point relies on it as the caller's
		// fingerprint source). Plan §F2 declares the function.
		expect(typeof computeBodyFingerprint).toBe("function");
	});
});
