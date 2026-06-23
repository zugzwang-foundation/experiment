import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Per SCAFFOLD.4 plan §7.3 + §7 ¶"Mocking discipline" — substrate-only
// rate-limit middleware tests. `@upstash/ratelimit` is mocked via
// `vi.mock`; no real Redis hit, no real timer math.
//
// Mock model:
//   - `Ratelimit` is a class. Constructor records the {prefix, limiter}
//     options and returns an instance with a `.limit(identifier)` method
//     that the test can override per-instance via `mockLimit.mockResolvedValueOnce`.
//   - `Ratelimit.slidingWindow(maxRequests, duration)` is a static method
//     returning an opaque sentinel ({ kind: 'sliding-window', maxRequests, duration }).
//     The middleware passes the result to the constructor; we don't run real
//     window math.
//
// Per plan §7.1 row 5 + §F3 fail-OPEN posture: any Ratelimit.limit()
// rejection causes `checkRateLimit` to RETURN { allowed: true, remaining: -1,
// reset: 0 } and emit
// `captureException(err, { tags: { kind: 'upstash_unavailable_rate_limit' } })`.
// Asymmetric to cache.ts's fail-CLOSED — the inversion is the load-bearing
// posture decision (per ADR-0006 §"Failure-mode profile").
//
// Tag string `upstash_unavailable_rate_limit` matches SPEC.2 §17.3 col 4
// byte-for-byte (Sentry alarm-6a discriminator).

// --- @upstash/ratelimit mock ----------------------------------------------
//
// Each Ratelimit instance is constructed ONCE at rate-limit.ts module load.
// Post-SCAFFOLD.8 LD-10, the captured `prefix` carries the env prefix
// (e.g., `prod:ratelimit:otp-email`). The test keys `ratelimitInstances`
// by the BARE surface name (last `:`-delimited segment) so per-test
// scripts remain readable (`ratelimitInstances["otp-email"]` rather than
// the full env-prefixed string). The mock retains the full captured
// prefix on each instance for the disjointness + shape assertions
// below.

// vi.mock() is hoisted; factory variables MUST come from vi.hoisted() too.
// Per vitest docs: https://vitest.dev/api/vi.html#vi-hoisted
const { ratelimitInstances } = vi.hoisted(() => ({
	ratelimitInstances: {} as Record<
		string,
		{ prefix: string; limit: ReturnType<typeof import("vitest").vi.fn> }
	>,
}));

vi.mock("@upstash/ratelimit", async () => {
	const { vi: viInner } = await import("vitest");
	class Ratelimit {
		prefix: string;
		limit: ReturnType<typeof viInner.fn>;

		constructor(opts: { prefix?: string; redis: unknown; limiter: unknown }) {
			this.prefix = opts.prefix ?? "default";
			this.limit = viInner.fn();
			// Key by the bare surface name (post-SCAFFOLD.8 LD-10 the full
			// prefix is `{env}:ratelimit:{surface}` — the last segment is the
			// surface). Falls back to the full string if no `:` is present.
			const segments = this.prefix.split(":");
			const surface = segments[segments.length - 1] ?? this.prefix;
			ratelimitInstances[surface] = {
				prefix: this.prefix,
				limit: this.limit,
			};
		}

		static slidingWindow(maxRequests: number, duration: string) {
			return { kind: "sliding-window", maxRequests, duration };
		}
	}
	return { Ratelimit };
});

// Cache.ts is also imported transitively (the rate-limit module shares the
// Upstash redis singleton wrapper), so mock the wrapper too — same pattern as
// the cache state-machine tests.
vi.mock("@/server/upstash/redis", () => ({
	redis: { set: vi.fn(), get: vi.fn(), del: vi.fn() },
}));

// --- @sentry/nextjs mock --------------------------------------------------
//
// SCAFFOLD.5 routed the fail-open observability emission to Sentry's
// `captureException` with a tag. Mock the SDK at the wrapper boundary so the
// test asserts on the captured (err, options) tuple without touching the real
// Sentry transport.

const { mockCaptureException } = vi.hoisted(() => ({
	mockCaptureException: vi.fn(),
}));

vi.mock("@sentry/nextjs", () => ({
	captureException: mockCaptureException,
}));

// Live imports — limits.ts constants are read at runtime so HARDEN.6 retunes
// don't silently break the assertions (plan §6 edge-case enumeration).
import {
	ADMIN_LOGIN_ATTEMPTS_PER_IP_PER_HOUR,
	BET_ATTEMPTS_PER_IP_PER_MIN,
	IMAGE_PUT_URL_REQUESTS_PER_IP_PER_MIN,
	OTP_REQUESTS_PER_EMAIL_PER_HOUR,
	OTP_REQUESTS_PER_IP_BURST_PER_MIN,
	RATE_LIMIT_BURST_PER_MIN,
	RATE_LIMIT_PER_MARKET_PER_DAY,
} from "@/server/config/limits";
import {
	betPerIp,
	checkRateLimit,
	imagePutUrlPerIp,
	ipIdentifier,
	otpEmailIdentifier,
	otpRequestPerEmail,
	otpRequestPerIpBurst,
	writeBudgetIdentifier,
	writeBudgetPerMarket,
	writeBurstIdentifier,
	writeBurstPerUser,
} from "@/server/middleware/rate-limit";
import { getRedisKey } from "@/server/upstash/keys";

beforeEach(() => {
	for (const inst of Object.values(ratelimitInstances)) {
		inst.limit.mockReset();
	}
	mockCaptureException.mockClear();
});

afterEach(() => {
	// clearAllMocks (NOT restoreAllMocks) — restoreAllMocks would tear down
	// the @upstash/ratelimit + @sentry/nextjs vi.mock factories that other
	// tests in this file rely on. clearAll keeps the factories attached and
	// just resets call history.
	vi.clearAllMocks();
});

describe("rate-limit middleware", () => {
	// === §7.3 row 1 =========================================================

	it("rate-limit::write-budget-and-burst-admit-independently", async () => {
		// Two parallel checkRateLimit() calls on the write-budget (per
		// user+market) and write-burst (per user) surfaces; both must allow
		// for a write to admit. Asserts the substrate exposes BOTH surfaces,
		// they admit independently — no AND combinator in the middleware,
		// consumers compose the AND at their boundary (see the row-7 test) —
		// and each helper emits its documented scoped identifier
		// (user:{id}:market:{id} / user:{id}).
		const userId = "user-123";
		const marketId = "market-abc";

		// Both surfaces script "allow" (success: true); reset is now+60s.
		const futureReset = Date.now() + 60_000;
		ratelimitInstances["write-budget"]?.limit.mockResolvedValue({
			success: true,
			remaining: 49,
			reset: futureReset,
		});
		ratelimitInstances["write-burst"]?.limit.mockResolvedValue({
			success: true,
			remaining: 4,
			reset: futureReset,
		});

		const [budgetResult, burstResult] = await Promise.all([
			checkRateLimit(
				"writeBudgetPerMarket",
				writeBudgetIdentifier(userId, marketId),
			),
			checkRateLimit("writeBurstPerUser", writeBurstIdentifier(userId)),
		]);

		expect(budgetResult.allowed).toBe(true);
		expect(burstResult.allowed).toBe(true);
		// Identifier helpers produce the documented bare-value shape (the
		// library prepends the configured prefix).
		expect(ratelimitInstances["write-budget"]?.limit).toHaveBeenCalledWith(
			`user:${userId}:market:${marketId}`,
		);
		expect(ratelimitInstances["write-burst"]?.limit).toHaveBeenCalledWith(
			`user:${userId}`,
		);
	});

	// === §7.3 row 2 =========================================================

	it("rate-limit::otp-per-ip-burst-throttles", async () => {
		// Surface otpRequestPerIpBurst; identifier 'otp-ip:1.2.3.4' (bare
		// IP after helper). After OTP_REQUESTS_PER_IP_BURST_PER_MIN
		// requests, library returns success:false. Substrate maps to
		// { allowed: false, retryAfter }.
		const limitFn = ratelimitInstances["otp-ip"]?.limit;
		expect(limitFn).toBeDefined();
		// Conservative future-reset to make retryAfter math non-zero.
		const reset = Date.now() + 30_000;
		limitFn?.mockResolvedValueOnce({
			success: false,
			remaining: 0,
			reset,
		});

		const result = await checkRateLimit(
			"otpRequestPerIpBurst",
			ipIdentifier("1.2.3.4"),
		);

		expect(result.allowed).toBe(false);
		if (result.allowed === false) {
			// retryAfter is ceil((reset - now) / 1000); allow ±2s slack to
			// avoid clock-edge flakes.
			expect(result.retryAfter).toBeGreaterThanOrEqual(28);
			expect(result.retryAfter).toBeLessThanOrEqual(31);
		}
		// Sanity: limits.ts holds the placeholder value HARDEN.6 will tune.
		expect(OTP_REQUESTS_PER_IP_BURST_PER_MIN).toBeGreaterThan(0);
	});

	// === §7.3 row 3 =========================================================

	it("rate-limit::bet-per-ip-burst-throttles", async () => {
		// Surface betPerIp; identifier bare-IP. After
		// BET_ATTEMPTS_PER_IP_PER_MIN requests, success:false.
		const limitFn = ratelimitInstances["bet-ip"]?.limit;
		expect(limitFn).toBeDefined();
		limitFn?.mockResolvedValueOnce({
			success: false,
			remaining: 0,
			reset: Date.now() + 60_000,
		});

		const result = await checkRateLimit("betPerIp", ipIdentifier("5.6.7.8"));

		expect(result.allowed).toBe(false);
		expect(BET_ATTEMPTS_PER_IP_PER_MIN).toBeGreaterThan(0);
	});

	// === §7.3 row 4 =========================================================

	it("rate-limit::image-put-url-per-ip-burst-throttles", async () => {
		// Surface imagePutUrlPerIp; identifier bare-IP. After
		// IMAGE_PUT_URL_REQUESTS_PER_IP_PER_MIN requests, success:false.
		const limitFn = ratelimitInstances["image-put-ip"]?.limit;
		expect(limitFn).toBeDefined();
		limitFn?.mockResolvedValueOnce({
			success: false,
			remaining: 0,
			reset: Date.now() + 60_000,
		});

		const result = await checkRateLimit(
			"imagePutUrlPerIp",
			ipIdentifier("9.9.9.9"),
		);

		expect(result.allowed).toBe(false);
		expect(IMAGE_PUT_URL_REQUESTS_PER_IP_PER_MIN).toBeGreaterThan(0);
	});

	// === §7.3 row 5 =========================================================

	it("rate-limit::fails-open-on-upstash-unreachable", async () => {
		// Library throws (network error); checkRateLimit catches + returns
		// { allowed: true, remaining: -1, reset: 0 }. Per ADR-0006 §
		// "Failure-mode profile": rate-limit fails OPEN. Asymmetric to
		// cache.ts (fails closed). Tag is the SPEC.2 §17.3 alarm-6a
		// discriminator routed through Sentry.captureException.
		const networkError = new Error("ECONNREFUSED");
		ratelimitInstances["bet-ip"]?.limit.mockRejectedValueOnce(networkError);

		const result = await checkRateLimit("betPerIp", ipIdentifier("10.0.0.1"));

		expect(result.allowed).toBe(true);
		if (result.allowed === true) {
			expect(result.remaining).toBe(-1);
			expect(result.reset).toBe(0);
		}
		expect(mockCaptureException).toHaveBeenCalledWith(networkError, {
			tags: { kind: "upstash_unavailable_rate_limit" },
		});
	});

	// === §7.3 row 6 (extension) =============================================

	it("rate-limit::otp-email-vs-otp-ip-disjoint-keys", async () => {
		// Same email used across two IPs. Identifier helpers produce
		// distinct bare-values; library config carries distinct PREFIXES
		// (post-SCAFFOLD.8 LD-10: `{env}:ratelimit:otp-email` vs
		// `{env}:ratelimit:otp-ip`). The combined Redis key shape is
		// `<prefix>:<identifier>` so the two surfaces accumulate
		// independently and remain env-scoped.
		const email = "abuse@example.com";
		const ip1 = "1.1.1.1";
		const ip2 = "2.2.2.2";

		// Sanity: identifier helpers are pure (just identity for these
		// surfaces); the prefix is what splits the key space.
		expect(otpEmailIdentifier(email)).toBe(email);
		expect(ipIdentifier(ip1)).toBe(ip1);
		expect(ipIdentifier(ip2)).toBe(ip2);

		// The 7 constructions populated distinct env-prefixed prefixes
		// per the C4 getRedisKey contract.
		expect(ratelimitInstances["otp-email"]?.prefix).toBe(
			getRedisKey("ratelimit", "otp-email"),
		);
		expect(ratelimitInstances["otp-ip"]?.prefix).toBe(
			getRedisKey("ratelimit", "otp-ip"),
		);
		expect(ratelimitInstances["otp-email"]?.prefix).not.toBe(
			ratelimitInstances["otp-ip"]?.prefix,
		);

		// Functional check: scripted limit for otp-email allows but
		// otp-ip throttles — proves the dispatcher routes to the matching
		// instance (no cross-leak).
		ratelimitInstances["otp-email"]?.limit.mockResolvedValueOnce({
			success: true,
			remaining: 4,
			reset: Date.now() + 3_600_000,
		});
		ratelimitInstances["otp-ip"]?.limit.mockResolvedValueOnce({
			success: false,
			remaining: 0,
			reset: Date.now() + 60_000,
		});

		const emailResult = await checkRateLimit(
			"otpRequestPerEmail",
			otpEmailIdentifier(email),
		);
		const ipResult = await checkRateLimit(
			"otpRequestPerIpBurst",
			ipIdentifier(ip1),
		);

		expect(emailResult.allowed).toBe(true);
		expect(ipResult.allowed).toBe(false);
		// Constants exist (sanity floor).
		expect(OTP_REQUESTS_PER_EMAIL_PER_HOUR).toBeGreaterThan(0);
		expect(ADMIN_LOGIN_ATTEMPTS_PER_IP_PER_HOUR).toBeGreaterThan(0);
	});

	// === §7.3 row 7 (extension) =============================================

	it("rate-limit::write-budget-and-burst-must-both-allow", async () => {
		// Substrate exposes both surfaces; consumer composes the AND.
		// One returns success:true, the other success:false → combined
		// admit decision is FALSE. Reverse holds (both must succeed).
		const userId = "user-burst";
		const marketId = "market-burst";

		// Case 1: budget allows, burst denies → consumer must NOT admit.
		ratelimitInstances["write-budget"]?.limit.mockResolvedValueOnce({
			success: true,
			remaining: 49,
			reset: Date.now() + 86_400_000,
		});
		ratelimitInstances["write-burst"]?.limit.mockResolvedValueOnce({
			success: false,
			remaining: 0,
			reset: Date.now() + 60_000,
		});
		const [a1, a2] = await Promise.all([
			checkRateLimit(
				"writeBudgetPerMarket",
				writeBudgetIdentifier(userId, marketId),
			),
			checkRateLimit("writeBurstPerUser", writeBurstIdentifier(userId)),
		]);
		expect(a1.allowed && a2.allowed).toBe(false);

		// Case 2: budget denies, burst allows → consumer must NOT admit.
		ratelimitInstances["write-budget"]?.limit.mockResolvedValueOnce({
			success: false,
			remaining: 0,
			reset: Date.now() + 86_400_000,
		});
		ratelimitInstances["write-burst"]?.limit.mockResolvedValueOnce({
			success: true,
			remaining: 4,
			reset: Date.now() + 60_000,
		});
		const [b1, b2] = await Promise.all([
			checkRateLimit(
				"writeBudgetPerMarket",
				writeBudgetIdentifier(userId, marketId),
			),
			checkRateLimit("writeBurstPerUser", writeBurstIdentifier(userId)),
		]);
		expect(b1.allowed && b2.allowed).toBe(false);

		// Case 3: BOTH allow → consumer admits.
		ratelimitInstances["write-budget"]?.limit.mockResolvedValueOnce({
			success: true,
			remaining: 49,
			reset: Date.now() + 86_400_000,
		});
		ratelimitInstances["write-burst"]?.limit.mockResolvedValueOnce({
			success: true,
			remaining: 4,
			reset: Date.now() + 60_000,
		});
		const [c1, c2] = await Promise.all([
			checkRateLimit(
				"writeBudgetPerMarket",
				writeBudgetIdentifier(userId, marketId),
			),
			checkRateLimit("writeBurstPerUser", writeBurstIdentifier(userId)),
		]);
		expect(c1.allowed && c2.allowed).toBe(true);

		// Constants exist for both surfaces.
		expect(RATE_LIMIT_PER_MARKET_PER_DAY).toBeGreaterThan(0);
		expect(RATE_LIMIT_BURST_PER_MIN).toBeGreaterThan(0);
	});

	// === §7.3 row 8 (extension) =============================================

	it("rate-limit::idempotency-and-rate-limit-key-prefixes-disjoint", async () => {
		// Per SPEC.2 §11 ¶"Distinction from §10" — idempotency-cache keys
		// MUST NOT overlap with any rate-limit surface prefix. INV-1
		// indirect: a prefix collision would let a rate-limit GET / SET
		// stomp on an idempotency cache entry, surfacing as a corrupted
		// cache hit (false 'hit' arm fires for a request that should have
		// been a fresh execution).
		//
		// Post-SCAFFOLD.8 LD-10, the disjointness invariant lives at the
		// SECOND segment of each key: `{env}:ratelimit:*` is disjoint
		// from `{env}:idem:*`, `{env}:mod-reserve:*`, and
		// `{env}:cron-lock:*`. The leftmost segment (env) is shared.
		const idemPrefix = getRedisKey("idem", "_probe")
			.split(":")
			.slice(0, 2)
			.join(":");
		const ratelimitSurfaces = [
			"otp-email",
			"otp-ip",
			"admin-login-ip",
			"write-budget",
			"write-burst",
			"bet-ip",
			"image-put-ip",
		];

		// Every rate-limit surface registered with the env-prefixed shape.
		for (const surface of ratelimitSurfaces) {
			expect(ratelimitInstances[surface]).toBeDefined();
			expect(ratelimitInstances[surface]?.prefix).toBe(
				getRedisKey("ratelimit", surface),
			);
			// Disjoint at the second segment: each rate-limit prefix
			// begins with `{env}:ratelimit:`, never with `{env}:idem`.
			expect(
				ratelimitInstances[surface]?.prefix.startsWith(`${idemPrefix}`),
			).toBe(false);
		}

		// Surface-instance exports are wired (sanity that the mock
		// recorded all 7 — code-reviewer pre-PR audit row 1 verifies
		// this invariant from the source side; the test mirrors it from
		// the consumer side).
		expect(otpRequestPerEmail).toBeDefined();
		expect(otpRequestPerIpBurst).toBeDefined();
		expect(writeBudgetPerMarket).toBeDefined();
		expect(writeBurstPerUser).toBeDefined();
		expect(betPerIp).toBeDefined();
		expect(imagePutUrlPerIp).toBeDefined();
	});
});
