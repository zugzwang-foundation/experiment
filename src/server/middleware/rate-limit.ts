import { captureException } from "@sentry/nextjs";
import { Ratelimit } from "@upstash/ratelimit";

import {
	ADMIN_LOGIN_ATTEMPTS_PER_IP_PER_HOUR,
	BET_ATTEMPTS_PER_IP_PER_MIN,
	IMAGE_PUT_URL_REQUESTS_PER_IP_PER_MIN,
	OTP_REQUESTS_PER_EMAIL_PER_HOUR,
	OTP_REQUESTS_PER_IP_BURST_PER_MIN,
	RATE_LIMIT_BURST_PER_MIN,
	RATE_LIMIT_PER_MARKET_PER_DAY,
} from "@/server/config/limits";
import { redis } from "@/server/upstash/redis";

/*
 * Per-surface sliding-window rate-limit middleware per SPEC.2 §11
 * ¶"Per-surface rate-limit table" + ADR-0015 D6 (sliding-window via
 * `@upstash/ratelimit` v2.0.8 `Ratelimit.slidingWindow(maxRequests, window)`).
 *
 * Seven Ratelimit instances, one per surface row in §11. Each instance is
 * constructed once at module-load with a distinct `prefix` (load-bearing
 * for the disjointness invariant per SPEC.2 §11 ¶"Distinction from §10";
 * also disjoint from `cache.ts`'s `idem:*` key space). Identifier-extraction
 * helpers produce bare values; `@upstash/ratelimit` prepends the configured
 * prefix internally to form the actual Redis key.
 *
 * The `dynamicLimits` flag added to `@upstash/ratelimit` in Jan 2026
 * (per ADR-0015 D6 closing paragraph) is explicitly NOT adopted in v1 —
 * documented here so a future reader doesn't add `dynamicLimits: true`
 * thinking it's an oversight.
 *
 * Failure-mode posture: fail-OPEN per ADR-0006 §"Failure-mode profile" +
 * SPEC.2 §11. Any exception in `checkRateLimit` is caught, the request is
 * admitted (`{ allowed: true, remaining: -1, reset: 0 }`), and Sentry's
 * `captureException` is invoked with tag `upstash_unavailable_rate_limit`
 * (verbatim per SPEC.2 §17.3 alarm-6a).
 */

export const otpRequestPerEmail = new Ratelimit({
	redis,
	limiter: Ratelimit.slidingWindow(OTP_REQUESTS_PER_EMAIL_PER_HOUR, "1 h"),
	prefix: "otp-email",
	analytics: false,
});

export const otpRequestPerIpBurst = new Ratelimit({
	redis,
	limiter: Ratelimit.slidingWindow(OTP_REQUESTS_PER_IP_BURST_PER_MIN, "1 m"),
	prefix: "otp-ip",
	analytics: false,
});

export const adminLoginPerIp = new Ratelimit({
	redis,
	limiter: Ratelimit.slidingWindow(ADMIN_LOGIN_ATTEMPTS_PER_IP_PER_HOUR, "1 h"),
	prefix: "admin-login-ip",
	analytics: false,
});

export const writeBudgetPerMarket = new Ratelimit({
	redis,
	limiter: Ratelimit.slidingWindow(RATE_LIMIT_PER_MARKET_PER_DAY, "24 h"),
	prefix: "write-budget",
	analytics: false,
});

export const writeBurstPerUser = new Ratelimit({
	redis,
	limiter: Ratelimit.slidingWindow(RATE_LIMIT_BURST_PER_MIN, "1 m"),
	prefix: "write-burst",
	analytics: false,
});

export const betPerIp = new Ratelimit({
	redis,
	limiter: Ratelimit.slidingWindow(BET_ATTEMPTS_PER_IP_PER_MIN, "1 m"),
	prefix: "bet-ip",
	analytics: false,
});

export const imagePutUrlPerIp = new Ratelimit({
	redis,
	limiter: Ratelimit.slidingWindow(
		IMAGE_PUT_URL_REQUESTS_PER_IP_PER_MIN,
		"1 m",
	),
	prefix: "image-put-ip",
	analytics: false,
});

/**
 * String-literal union of valid surface keys consumed by `checkRateLimit`.
 * Each value maps 1:1 to one of the seven Ratelimit instances declared
 * above, which in turn map 1:1 to SPEC.2 §11's per-surface table.
 */
export type RateLimitSurface =
	| "otpRequestPerEmail"
	| "otpRequestPerIpBurst"
	| "adminLoginPerIp"
	| "writeBudgetPerMarket"
	| "writeBurstPerUser"
	| "betPerIp"
	| "imagePutUrlPerIp";

const SURFACE_INSTANCES: Record<RateLimitSurface, Ratelimit> = {
	otpRequestPerEmail,
	otpRequestPerIpBurst,
	adminLoginPerIp,
	writeBudgetPerMarket,
	writeBurstPerUser,
	betPerIp,
	imagePutUrlPerIp,
};

/**
 * Shape returned by `checkRateLimit`. Discriminated on `allowed`. On the
 * fail-open path (`{ allowed: true, remaining: -1, reset: 0 }`), the
 * sentinel `-1` for `remaining` and `0` for `reset` distinguish admitted-
 * via-fail-open from admitted-with-quota; consumers that surface
 * `X-RateLimit-*` headers can branch on the sentinel.
 */
export type RateLimitDecision =
	| { allowed: true; remaining: number; reset: number }
	| { allowed: false; retryAfter: number };

/**
 * Identifier-extraction helpers. The `@upstash/ratelimit` library prepends
 * the configured `prefix` itself (via `${prefix}:${identifier}`), so these
 * helpers return bare values, not prefixed Redis keys. Naming mirrors
 * SPEC.2 §11's per-surface table identifier column for greppability.
 */
export const ipIdentifier = (ip: string): string => ip;
export const otpEmailIdentifier = (email: string): string => email;
export const writeBudgetIdentifier = (
	userId: string,
	marketId: string,
): string => `user:${userId}:market:${marketId}`;
export const writeBurstIdentifier = (userId: string): string =>
	`user:${userId}`;

/**
 * Surface-keyed dispatcher per SPEC.2 §11 ¶"In-handler call sequence"
 * step 4. Caller passes a surface key + the bare identifier; this routes
 * to the matching Ratelimit instance and maps `success` → `allowed`,
 * computing `retryAfter = Math.ceil((reset - Date.now()) / 1000)` when
 * throttled.
 *
 * Fail-open posture: any exception is caught, request is admitted, stub
 * Sentry tag emitted. The asymmetry vs. `cache.ts`'s fail-CLOSED is the
 * load-bearing posture decision per ADR-0006 §"Failure-mode profile" — a
 * brief abuse-cap gap is accepted as the cost of not user-blocking on a
 * vendor outage; corrupting the ledger is not.
 */
export async function checkRateLimit(
	surface: RateLimitSurface,
	identifier: string,
): Promise<RateLimitDecision> {
	const instance = SURFACE_INSTANCES[surface];
	try {
		const result = await instance.limit(identifier);
		if (result.success) {
			return {
				allowed: true,
				remaining: result.remaining,
				reset: result.reset,
			};
		}
		const retryAfter = Math.max(
			0,
			Math.ceil((result.reset - Date.now()) / 1000),
		);
		return { allowed: false, retryAfter };
	} catch (err) {
		// Tag `upstash_unavailable_rate_limit` per SPEC.2 §17.3 alarm-6a.
		captureException(err, {
			tags: { kind: "upstash_unavailable_rate_limit" },
		});
		return { allowed: true, remaining: -1, reset: 0 };
	}
}
