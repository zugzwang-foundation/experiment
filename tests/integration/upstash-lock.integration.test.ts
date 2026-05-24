import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Per SCAFFOLD.15 plan §5.4 — substrate tests for the distributed-lock
// helper (`acquireLock` / `releaseLock`). Used by the orphan-sweep cron
// handler today; reusable by future cron jobs.
//
// State machine:
//   - acquireLock(key, ttlSeconds):
//       token = crypto.randomUUID()
//       redis.set(key, token, { nx: true, ex: ttlSeconds })
//       returns { token } on "OK", null on contention.
//       Fail-CLOSED on Upstash unreachable (rethrow — caller decides
//       posture). Per ADR-0006 §"Failure-mode profile".
//
//   - releaseLock(key, token):
//       Lua via redis.eval — compares stored token to caller's token;
//       DELs only if match (prevents a stuck-lock-from-prior-run releasing
//       the current run). Returns true on match+del, false otherwise.
//       Fail-CLOSED on Upstash unreachable.
//
// Mocks:
//   - `@/server/upstash/redis` { redis: { set, get, del, eval } } — script
//     the SET-NX response + EVAL return scalar. No real Upstash.

const { mockRedis } = vi.hoisted(() => ({
	mockRedis: {
		set: vi.fn(),
		get: vi.fn(),
		del: vi.fn(),
		eval: vi.fn(),
	},
}));

vi.mock("@/server/upstash/redis", () => ({
	redis: mockRedis,
}));

import { acquireLock, releaseLock } from "@/server/upstash/lock";

beforeEach(() => {
	mockRedis.set.mockReset();
	mockRedis.get.mockReset();
	mockRedis.del.mockReset();
	mockRedis.eval.mockReset();
});

afterEach(() => {
	vi.clearAllMocks();
});

describe("acquireLock / releaseLock (SCAFFOLD.15 §5.4)", () => {
	// === acquireLock happy path + contention ==================================

	it("upstash-lock::acquire-returns-token-on-success", async () => {
		// SET NX returns "OK" → impl returns { token }. Token is a UUID-shape
		// string (we don't pin the exact value — crypto.randomUUID() is
		// the seam and tests must not couple to it).
		mockRedis.set.mockResolvedValueOnce("OK");

		const result = await acquireLock("cron-lock:test", 600);

		expect(result).not.toBeNull();
		expect(result?.token).toBeDefined();
		expect(typeof result?.token).toBe("string");
		// UUIDv4 shape (or any RFC 4122 variant): 8-4-4-4-12 hex.
		expect(result?.token).toMatch(
			/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
		);
	});

	it("upstash-lock::acquire-calls-set-with-nx-and-ex-ttl", async () => {
		// SET NX EX shape: redis.set(key, token, { nx: true, ex: ttl }).
		// Asserts the exact options object so a future bug that drops `nx`
		// (and therefore overwrites a held lock) surfaces.
		mockRedis.set.mockResolvedValueOnce("OK");

		await acquireLock("cron-lock:orphan", 600);

		expect(mockRedis.set).toHaveBeenCalledTimes(1);
		const [key, token, opts] = mockRedis.set.mock.calls[0] ?? [];
		expect(key).toBe("cron-lock:orphan");
		// Token argument matches the returned token (Redis stores what the
		// caller will later compare during release).
		expect(typeof token).toBe("string");
		expect(opts).toMatchObject({ nx: true, ex: 600 });
	});

	it("upstash-lock::acquire-returns-null-on-contention", async () => {
		// SET NX returns null (key exists) → contention; impl returns null.
		// Caller (orphan-sweep) interprets as "another fire holds the lock,
		// abort cleanly".
		mockRedis.set.mockResolvedValueOnce(null);

		const result = await acquireLock("cron-lock:contended", 600);

		expect(result).toBeNull();
	});

	it("upstash-lock::acquire-generates-fresh-token-per-call", async () => {
		// Two acquires (after a release) MUST produce distinct tokens.
		// If the impl re-used a token, a stale-release from acquire-1
		// could release acquire-2 (the bug the Lua matched-release exists
		// to prevent). This test asserts token distinctness at the source.
		mockRedis.set.mockResolvedValueOnce("OK");
		mockRedis.set.mockResolvedValueOnce("OK");

		const a = await acquireLock("cron-lock:k1", 600);
		const b = await acquireLock("cron-lock:k2", 600);

		expect(a?.token).toBeDefined();
		expect(b?.token).toBeDefined();
		expect(a?.token).not.toBe(b?.token);
	});

	// === acquireLock fail-CLOSED ==============================================

	it("upstash-lock::acquire-rethrows-on-upstash-unreachable", async () => {
		// Network error during SET — impl rethrows (fail-CLOSED). The cron
		// handler's outer try/finally catches and reports to Vercel; an
		// AppRouter consumer can map to 503.
		const networkError = new Error("ECONNREFUSED to Upstash");
		mockRedis.set.mockRejectedValueOnce(networkError);

		await expect(acquireLock("cron-lock:err", 600)).rejects.toBe(networkError);
	});

	// === releaseLock happy path + mismatch ====================================

	it("upstash-lock::release-with-matching-token-returns-true", async () => {
		// Lua EVAL returns 1 (matched and DELed) → impl returns true.
		// Token is the one the caller saved from acquire.
		mockRedis.eval.mockResolvedValueOnce(1);

		const result = await releaseLock("cron-lock:k", "token-matched");

		expect(result).toBe(true);
	});

	it("upstash-lock::release-with-mismatched-token-returns-false", async () => {
		// Lua EVAL returns 0 (no match; nothing DELed). Impl returns false.
		// Mirrors the "stuck lock from prior run expired; we held a stale
		// token; release MUST be a no-op" case — the fresh acquire's lock
		// stays intact.
		mockRedis.eval.mockResolvedValueOnce(0);

		const result = await releaseLock("cron-lock:k", "token-stale");

		expect(result).toBe(false);
	});

	it("upstash-lock::release-calls-eval-with-keys-and-argv", async () => {
		// Verify the eval is invoked with the Lua script signature pattern
		// used by `@upstash/redis`: eval(script, [keys], [argv]). The
		// script body itself is the canonical CHECK-AND-DELETE per ADR /
		// plan §5.4. We assert on key + arg passthrough; script text shape
		// stays internal (the impl owns the literal).
		mockRedis.eval.mockResolvedValueOnce(1);

		await releaseLock("cron-lock:eval-args", "token-abc");

		expect(mockRedis.eval).toHaveBeenCalledTimes(1);
		const [, keysArg, argvArg] = mockRedis.eval.mock.calls[0] ?? [];
		// keys array: first element is the lock key (KEYS[1]).
		expect(Array.isArray(keysArg)).toBe(true);
		expect((keysArg as string[])[0]).toBe("cron-lock:eval-args");
		// argv array: first element is the token to compare against
		// (ARGV[1]).
		expect(Array.isArray(argvArg)).toBe(true);
		expect((argvArg as string[])[0]).toBe("token-abc");
	});

	// === releaseLock fail-CLOSED ==============================================

	it("upstash-lock::release-rethrows-on-upstash-unreachable", async () => {
		// EVAL throws — release fails CLOSED. The lock is left to expire
		// via the EX TTL set at acquire time; the caller's `finally` MUST
		// surface the throw so a partial run is not silently considered
		// "released".
		const networkError = new Error("ECONNREFUSED to Upstash");
		mockRedis.eval.mockRejectedValueOnce(networkError);

		await expect(releaseLock("cron-lock:err", "token-anything")).rejects.toBe(
			networkError,
		);
	});

	// === Round-trip composition ==============================================

	it("upstash-lock::acquire-then-release-uses-same-token", async () => {
		// End-to-end: token returned from acquire is the SAME token redis.set
		// stored (KEYS shape) AND the same token release passes as ARGV[1].
		// Proves the caller's contract: hold the acquire return value, pass
		// .token verbatim into releaseLock.
		mockRedis.set.mockResolvedValueOnce("OK");
		mockRedis.eval.mockResolvedValueOnce(1);

		const lock = await acquireLock("cron-lock:roundtrip", 600);
		expect(lock).not.toBeNull();
		if (lock === null) return;

		const tokenStoredAtAcquire = mockRedis.set.mock.calls[0]?.[1] as string;
		expect(tokenStoredAtAcquire).toBe(lock.token);

		await releaseLock("cron-lock:roundtrip", lock.token);

		const tokenSentAtRelease = (
			mockRedis.eval.mock.calls[0]?.[2] as string[]
		)[0];
		expect(tokenSentAtRelease).toBe(lock.token);
		// Final consistency: acquire's stored token === release's compared token.
		expect(tokenStoredAtAcquire).toBe(tokenSentAtRelease);
	});
});
