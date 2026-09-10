import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// RELAY C2 — cache hit/miss instrumentation (src/server/observability/cache-metrics.ts).
// The vendor boundary (`@/server/upstash/redis`'s shared singleton) is mocked,
// not the wrapper — same shape as safe-capture.test.ts's sibling suite. Also
// mocks `./safe-capture` so a Redis rejection's fail-open path is observable
// without touching the real Sentry SDK. `getRedisKey` runs UNMOCKED (pure,
// env-only) so the exact key string is asserted against the real convention.

const { mockIncr, mockSet, mockSafeCaptureException } = vi.hoisted(() => ({
	mockIncr: vi.fn(),
	mockSet: vi.fn(),
	mockSafeCaptureException: vi.fn(),
}));
vi.mock("@/server/upstash/redis", () => ({
	redis: { incr: mockIncr, set: mockSet },
}));
vi.mock("@/server/observability/safe-capture", () => ({
	safeCaptureException: mockSafeCaptureException,
}));

import {
	recordCacheAttempt,
	recordCacheMiss,
	recordInvalidation,
	recordReserveWalkDerivation,
} from "@/server/observability/cache-metrics";

describe("cache-metrics — fail-open hit/miss counters", () => {
	beforeEach(() => {
		mockIncr.mockReset().mockResolvedValue(1);
		mockSet.mockReset().mockResolvedValue("OK");
		mockSafeCaptureException.mockReset();
	});
	afterEach(() => {
		vi.clearAllMocks();
	});

	it("cache-metrics::attempt-increments-the-attempts-key-scoped-by-market", async () => {
		await recordCacheAttempt("market-data", "m-123");
		expect(mockIncr).toHaveBeenCalledTimes(1);
		expect(mockIncr).toHaveBeenCalledWith(
			"prod:cache-metric:market-data:attempts:m-123",
		);
	});

	it("cache-metrics::attempt-with-null-market-falls-back-to-global", async () => {
		await recordCacheAttempt("discovery-list", null);
		expect(mockIncr).toHaveBeenCalledWith(
			"prod:cache-metric:discovery-list:attempts:global",
		);
	});

	it("cache-metrics::miss-increments-the-misses-key-not-the-attempts-key", async () => {
		await recordCacheMiss("debate-view", "m-456");
		expect(mockIncr).toHaveBeenCalledWith(
			"prod:cache-metric:debate-view:misses:m-456",
		);
	});

	it("cache-metrics::reserve-walk-derivation-uses-its-own-fixed-block-name", async () => {
		await recordReserveWalkDerivation("m-789");
		expect(mockIncr).toHaveBeenCalledWith(
			"prod:cache-metric:reserve-walk:misses:m-789",
		);
	});

	it("cache-metrics::invalidation-sets-a-stringified-timestamp-keyed-by-tag", async () => {
		vi.setSystemTime(new Date("2026-09-09T00:00:00.000Z"));
		await recordInvalidation("market:m-1");
		expect(mockSet).toHaveBeenCalledTimes(1);
		const [key, value] = mockSet.mock.calls[0];
		expect(key).toBe("prod:cache-metric:invalidations:market:m-1");
		// automaticDeserialization: false on the shared singleton — must be a
		// string, never a number, or the sentinel-vs-payload discrimination
		// pattern this Redis client is built around would break for any other
		// caller relying on the same guarantee.
		expect(typeof value).toBe("string");
		vi.useRealTimers();
	});

	it("cache-metrics::redis-incr-rejection-is-swallowed-never-propagates", async () => {
		mockIncr.mockRejectedValue(new Error("redis down"));
		await expect(
			recordCacheAttempt("market-data", "m-1"),
		).resolves.toBeUndefined();
		expect(mockSafeCaptureException).toHaveBeenCalledTimes(1);
		expect(mockSafeCaptureException).toHaveBeenCalledWith(expect.any(Error), {
			tags: { kind: "cache-metrics-incr" },
		});
	});

	it("cache-metrics::redis-set-rejection-is-swallowed-never-propagates", async () => {
		mockSet.mockRejectedValue(new Error("redis down"));
		await expect(recordInvalidation("discovery")).resolves.toBeUndefined();
		expect(mockSafeCaptureException).toHaveBeenCalledTimes(1);
		expect(mockSafeCaptureException).toHaveBeenCalledWith(expect.any(Error), {
			tags: { kind: "cache-metrics-invalidation" },
		});
	});
});
