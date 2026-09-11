import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// RELAY C2 — positive controls for the four counter helpers. Substrate-only:
// `@/server/upstash/redis` + `@sentry/nextjs` mocked, no live Redis. Each test
// demonstrates the condition under which its counter MOVES (per the Day-1
// pack's own C2 requirement #6 — "an uncalibrated counter reading zero is
// indistinguishable from a broken one"), plus the fail-open posture on a
// Redis error.
//
// ⚠ What this file does NOT and cannot prove: that `recordCacheMiss` only
// ever runs on a real Next.js Cache Components MISS in production. That fact
// follows from WHERE the call is placed (inside the `'use cache'` function
// body, before `return` — see `discovery/list.ts`, `discovery/cached-series.ts`,
// `debate-view/cached-view.ts`) and from the traced `use-cache-wrapper.js`
// behavior documented in `cache-metrics.ts`'s own docblock, not from anything
// a unit test can exercise — there is no code path on a hit to assert against.
// This file proves each function's own behavior is correct; the call-site
// placement is a grep-verifiable fact, not a runtime one.

const { mockRedis, mockCaptureException } = vi.hoisted(() => ({
	mockRedis: { incr: vi.fn(), set: vi.fn() },
	mockCaptureException: vi.fn(),
}));

vi.mock("@/server/upstash/redis", () => ({
	redis: mockRedis,
}));

vi.mock("@sentry/nextjs", () => ({
	captureException: mockCaptureException,
	captureMessage: vi.fn(),
	flush: vi.fn(async () => true),
}));

import {
	recordCacheAttempt,
	recordCacheMiss,
	recordInvalidation,
	recordReserveWalkDerivation,
} from "@/server/observability/cache-metrics";

const ORIGINAL_ENV = process.env.ZUGZWANG_ENV;

beforeEach(() => {
	process.env.ZUGZWANG_ENV = "preview";
	mockRedis.incr.mockReset();
	mockRedis.set.mockReset();
	mockCaptureException.mockReset();
	mockRedis.incr.mockResolvedValue(1);
	mockRedis.set.mockResolvedValue("OK");
});

afterEach(() => {
	process.env.ZUGZWANG_ENV = ORIGINAL_ENV;
});

describe("RELAY C2 — cache-metrics counters", () => {
	it("recordCacheAttempt increments the env-namespaced attempts key, market-scoped", async () => {
		await recordCacheAttempt("discovery-list", "m-1");
		expect(mockRedis.incr).toHaveBeenCalledWith(
			"preview:cache-metric:discovery-list:attempts:m-1",
		);
	});

	it("recordCacheAttempt falls back to the 'global' segment when marketId is null", async () => {
		await recordCacheAttempt("discovery-list", null);
		expect(mockRedis.incr).toHaveBeenCalledWith(
			"preview:cache-metric:discovery-list:attempts:global",
		);
	});

	it("recordCacheAttempt fires on EVERY call — two calls, two increments", async () => {
		await recordCacheAttempt("debate-view", "m-1");
		await recordCacheAttempt("debate-view", "m-1");
		expect(mockRedis.incr).toHaveBeenCalledTimes(2);
	});

	it("recordCacheMiss increments the misses key for its block/market", async () => {
		await recordCacheMiss("market-data", "m-2");
		expect(mockRedis.incr).toHaveBeenCalledWith(
			"preview:cache-metric:market-data:misses:m-2",
		);
	});

	it("attempts and misses land on DISTINCT keys for the same block/market — hit rate is computable as 1 - misses/attempts", async () => {
		await recordCacheAttempt("debate-view", "m-3");
		await recordCacheMiss("debate-view", "m-3");
		const keys = mockRedis.incr.mock.calls.map((c) => c[0]);
		expect(keys).toEqual([
			"preview:cache-metric:debate-view:attempts:m-3",
			"preview:cache-metric:debate-view:misses:m-3",
		]);
		expect(new Set(keys).size).toBe(2);
	});

	it("recordReserveWalkDerivation increments a derivations key keyed on marketId alone", async () => {
		await recordReserveWalkDerivation("m-4");
		expect(mockRedis.incr).toHaveBeenCalledWith(
			"preview:cache-metric:reserve-walk:derivations:m-4",
		);
	});

	it("recordReserveWalkDerivation coalesces to one counter surface for repeated calls on the same market — fifty calls is fifty increments of ONE key, not fifty keys", async () => {
		for (let i = 0; i < 50; i++) {
			await recordReserveWalkDerivation("m-hot");
		}
		expect(mockRedis.incr).toHaveBeenCalledTimes(50);
		const keys = new Set(mockRedis.incr.mock.calls.map((c) => c[0]));
		expect(keys).toEqual(
			new Set(["preview:cache-metric:reserve-walk:derivations:m-hot"]),
		);
	});

	it("recordInvalidation writes a timestamp to the invalidation key for its tag", async () => {
		const before = Date.now();
		await recordInvalidation("discovery");
		const after = Date.now();
		expect(mockRedis.set).toHaveBeenCalledTimes(1);
		const [key, value] = mockRedis.set.mock.calls[0] as [string, number];
		expect(key).toBe(
			"preview:cache-metric:invalidation:invalidated-at:discovery",
		);
		expect(value).toBeGreaterThanOrEqual(before);
		expect(value).toBeLessThanOrEqual(after);
	});

	it("recordInvalidation namespaces by tag — a market tag and the discovery tag never collide", async () => {
		await recordInvalidation("discovery");
		await recordInvalidation("market:m-5");
		const keys = mockRedis.set.mock.calls.map((c) => c[0]);
		expect(keys).toEqual([
			"preview:cache-metric:invalidation:invalidated-at:discovery",
			"preview:cache-metric:invalidation:invalidated-at:market:m-5",
		]);
	});

	it("recordCacheAttempt fails OPEN on a Redis error — resolves, never throws, and captures the exception", async () => {
		mockRedis.incr.mockRejectedValueOnce(new Error("ECONNRESET"));
		await expect(
			recordCacheAttempt("discovery-list", null),
		).resolves.toBeUndefined();
		expect(mockCaptureException).toHaveBeenCalledTimes(1);
		const [, ctx] = mockCaptureException.mock.calls[0] as [
			unknown,
			{ tags: { kind: string } },
		];
		expect(ctx.tags.kind).toBe("cache_metric_write_failed");
	});

	it("recordCacheMiss fails OPEN on a Redis error", async () => {
		mockRedis.incr.mockRejectedValueOnce(new Error("ECONNRESET"));
		await expect(
			recordCacheMiss("debate-view", "m-1"),
		).resolves.toBeUndefined();
		expect(mockCaptureException).toHaveBeenCalledTimes(1);
	});

	it("recordReserveWalkDerivation fails OPEN on a Redis error", async () => {
		mockRedis.incr.mockRejectedValueOnce(new Error("ECONNRESET"));
		await expect(recordReserveWalkDerivation("m-1")).resolves.toBeUndefined();
		expect(mockCaptureException).toHaveBeenCalledTimes(1);
	});

	it("recordInvalidation fails OPEN on a Redis error", async () => {
		mockRedis.set.mockRejectedValueOnce(new Error("ECONNRESET"));
		await expect(recordInvalidation("discovery")).resolves.toBeUndefined();
		expect(mockCaptureException).toHaveBeenCalledTimes(1);
		const [, ctx] = mockCaptureException.mock.calls[0] as [
			unknown,
			{ tags: { kind: string } },
		];
		expect(ctx.tags.kind).toBe("cache_metric_write_failed");
	});

	it("throws on an invalid ZUGZWANG_ENV — never writes an unnamespaced metric key", async () => {
		process.env.ZUGZWANG_ENV = "unknown";
		await expect(recordCacheAttempt("discovery-list", null)).rejects.toThrow(
			/ZUGZWANG_ENV/,
		);
		expect(mockRedis.incr).not.toHaveBeenCalled();
	});
});
