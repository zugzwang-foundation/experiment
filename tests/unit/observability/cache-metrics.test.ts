import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// RELAY C2 — cache hit/miss instrumentation (src/server/observability/cache-metrics.ts).
// The vendor boundary (`@/server/upstash/redis`'s shared singleton) is mocked,
// not the wrapper — same shape as safe-capture.test.ts's sibling suite. Also
// mocks `./safe-capture` so a Redis rejection's fail-open path is observable
// without touching the real Sentry SDK. `getRedisKey` runs UNMOCKED (pure,
// env-only) so the exact key string is asserted against the real convention.
//
// ⛔⛔ AND `next/server`'s `after` IS MOCKED, WHICH IS THE POINT OF HALF THIS
// FILE (CACHE-KEY-1). These counters used to be `await`ed Upstash round trips
// on the RENDER PATH — nine of them per Discovery render at
// `DISCOVERY_GRID_SIZE = 8`, one per debate-view poll tick per open tab,
// measured at ~135 ms each against a surface whose whole p50 is 0.692 s. They
// were FAIL-OPEN but they were not NON-BLOCKING, and those are different
// properties: an instrument that costs more than the effect it measures reports
// its own latency rather than the system's. Every write now runs after the
// response via `after()`, so this mock both keeps the suite off the network and
// is the thing that makes the deferral observable at all.

const {
	mockIncr,
	mockIncrBy,
	mockSet,
	mockSafeCaptureException,
	mockAfter,
	scheduled,
} = vi.hoisted(() => ({
	mockIncr: vi.fn(),
	mockIncrBy: vi.fn(),
	mockSet: vi.fn(),
	mockSafeCaptureException: vi.fn(),
	mockAfter: vi.fn(),
	scheduled: [] as (() => Promise<void>)[],
}));
vi.mock("@/server/upstash/redis", () => ({
	redis: { incr: mockIncr, incrby: mockIncrBy, set: mockSet },
}));
vi.mock("@/server/observability/safe-capture", () => ({
	safeCaptureException: mockSafeCaptureException,
}));
vi.mock("next/server", () => ({ after: mockAfter }));

import {
	CACHE_ATTEMPT_SAMPLE_RATE,
	recordCacheAttempt,
	recordCacheMiss,
	recordInvalidation,
	recordReserveWalkDerivation,
} from "@/server/observability/cache-metrics";

/** Run whatever `after()` was handed, the way the runtime would once the
 * response is out. Nothing in this module is awaitable by its caller, so this
 * is the only place a test can join the work.
 *
 * ⚠ THE TASK IS STORED, NOT STARTED, and that fidelity is load-bearing. A mock
 * that invoked the callback on the spot would run it synchronously up to its
 * first `await`, so `redis.incr` WOULD be reached during the render — and the
 * "nothing touches Redis before the response is out" assertion below would fail
 * against a correct implementation. `after()` defers; so does this. */
const flush = () => Promise.all(scheduled.splice(0).map((task) => task()));

describe("cache-metrics — fail-open, and deferred off the render path", () => {
	beforeEach(() => {
		mockIncr.mockReset().mockResolvedValue(1);
		mockIncrBy.mockReset().mockResolvedValue(1);
		// POLL-IDLE 1c — the attempt counter is sampled. Pinned to "sampled in"
		// by default so the key/fail-open rows below stay deterministic; the
		// sampling rows set it explicitly.
		vi.spyOn(Math, "random").mockReturnValue(0);
		mockSet.mockReset().mockResolvedValue("OK");
		mockSafeCaptureException.mockReset();
		scheduled.length = 0;
		mockAfter.mockReset().mockImplementation((task: () => Promise<void>) => {
			scheduled.push(task);
		});
	});
	afterEach(() => {
		vi.clearAllMocks();
		vi.restoreAllMocks();
	});

	it("cache-metrics::counters-return-void-so-a-caller-cannot-await-one", () => {
		// ⛔ THE STRUCTURAL HALF (**O-1**), and the reason the old signatures were
		// the defect rather than the call sites. `Promise<void>` made `await` the
		// natural thing to type in front of these and nothing objected — so seven
		// call sites did, and every one of them put a network hop in a render. A
		// `void` return makes that a type error. This asserts the runtime half of
		// the same claim, since `tsc` is what holds the type half.
		expect(recordCacheAttempt("market-data", "m-1")).toBeUndefined();
		expect(recordCacheMiss("market-data", "m-1")).toBeUndefined();
		expect(recordReserveWalkDerivation("m-1")).toBeUndefined();
		expect(recordInvalidation("market:m-1")).toBeUndefined();
	});

	it("cache-metrics::nothing-touches-redis-before-the-response-is-out", () => {
		// The whole finding in one assertion: the call returns, `after()` has been
		// handed a task, and Redis has NOT been reached yet.
		recordCacheAttempt("market-data", "m-1");
		expect(mockAfter).toHaveBeenCalledTimes(1);
		expect(mockIncr).not.toHaveBeenCalled();
		expect(mockIncrBy).not.toHaveBeenCalled();
		// …and the sampling coin is not flipped during render either.
		expect(Math.random).not.toHaveBeenCalled();
	});

	it("cache-metrics::attempt-increments-the-attempts-key-scoped-by-market", async () => {
		recordCacheAttempt("market-data", "m-123");
		await flush();
		expect(mockIncrBy).toHaveBeenCalledTimes(1);
		expect(mockIncrBy).toHaveBeenCalledWith(
			"prod:cache-metric:market-data:attempts:m-123",
			CACHE_ATTEMPT_SAMPLE_RATE,
		);
		expect(mockIncr).not.toHaveBeenCalled();
	});

	it("cache-metrics::attempt-with-null-market-falls-back-to-global", async () => {
		recordCacheAttempt("discovery-list", null);
		await flush();
		expect(mockIncrBy).toHaveBeenCalledWith(
			"prod:cache-metric:discovery-list:attempts:global",
			CACHE_ATTEMPT_SAMPLE_RATE,
		);
	});

	it("cache-metrics::miss-increments-the-misses-key-not-the-attempts-key", async () => {
		recordCacheMiss("debate-view", "m-456");
		await flush();
		expect(mockIncr).toHaveBeenCalledWith(
			"prod:cache-metric:debate-view:misses:m-456",
		);
	});

	it("cache-metrics::reserve-walk-derivation-uses-its-own-fixed-block-name", async () => {
		recordReserveWalkDerivation("m-789");
		await flush();
		expect(mockIncr).toHaveBeenCalledWith(
			"prod:cache-metric:reserve-walk:misses:m-789",
		);
	});

	it("cache-metrics::attempt-sampled-out-writes-nothing", async () => {
		vi.mocked(Math.random).mockReturnValue(1 / CACHE_ATTEMPT_SAMPLE_RATE);
		recordCacheAttempt("market-data", "m-1");
		await flush();
		expect(mockIncrBy).not.toHaveBeenCalled();
		expect(mockIncr).not.toHaveBeenCalled();
	});

	it("cache-metrics::attempt-sampling-is-an-unbiased-estimate-of-every-render", async () => {
		// A deterministic sweep of the coin across [0, 1): exactly one render in
		// CACHE_ATTEMPT_SAMPLE_RATE writes, and that write carries the rate — so
		// the stored total equals the number of renders, and misses/attempts
		// reads the same as it did unsampled.
		const renders = CACHE_ATTEMPT_SAMPLE_RATE * 20;
		let i = 0;
		vi.mocked(Math.random).mockImplementation(() => (i++ % renders) / renders);
		for (let r = 0; r < renders; r++) {
			recordCacheAttempt("debate-view", "m-1");
		}
		await flush();
		expect(mockIncrBy).toHaveBeenCalledTimes(
			renders / CACHE_ATTEMPT_SAMPLE_RATE,
		);
		const total = mockIncrBy.mock.calls.reduce((sum, [, by]) => sum + by, 0);
		expect(total).toBe(renders);
	});

	it("cache-metrics::miss-counters-are-never-sampled", async () => {
		vi.mocked(Math.random).mockReturnValue(0.99);
		recordCacheMiss("debate-view", "m-1");
		recordReserveWalkDerivation("m-1");
		await flush();
		expect(mockIncr).toHaveBeenCalledTimes(2);
	});

	it("cache-metrics::invalidation-sets-a-stringified-timestamp-keyed-by-tag", async () => {
		vi.setSystemTime(new Date("2026-09-09T00:00:00.000Z"));
		recordInvalidation("market:m-1");
		await flush();
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
		mockIncrBy.mockRejectedValue(new Error("redis down"));
		recordCacheAttempt("market-data", "m-1");
		await expect(flush()).resolves.toBeDefined();
		expect(mockSafeCaptureException).toHaveBeenCalledTimes(1);
		expect(mockSafeCaptureException).toHaveBeenCalledWith(expect.any(Error), {
			tags: { kind: "cache-metrics-incr" },
		});
	});

	it("cache-metrics::redis-set-rejection-is-swallowed-never-propagates", async () => {
		mockSet.mockRejectedValue(new Error("redis down"));
		recordInvalidation("discovery");
		await expect(flush()).resolves.toBeDefined();
		expect(mockSafeCaptureException).toHaveBeenCalledTimes(1);
		expect(mockSafeCaptureException).toHaveBeenCalledWith(expect.any(Error), {
			tags: { kind: "cache-metrics-invalidation" },
		});
	});

	it("cache-metrics::an-after-that-throws-falls-back-and-still-counts", async () => {
		// ⛔ NOT DEFENSIVE PADDING — A REACHABLE PATH. `after()` throws when there
		// is no request scope, and BOTH miss counters live inside `'use cache'`
		// bodies, which genuinely run without one during a background
		// revalidation. Without the fallback a cached derivation would throw on a
		// diagnostic write; with it, the count is attempted immediately instead.
		mockAfter.mockImplementation(() => {
			throw new Error("`after` was called outside a request scope");
		});
		expect(() => recordCacheMiss("debate-view", "m-2")).not.toThrow();
		// Fire-and-forget — joined here by yielding, not by awaiting the call.
		await new Promise((r) => setTimeout(r, 0));
		expect(mockIncr).toHaveBeenCalledWith(
			"prod:cache-metric:debate-view:misses:m-2",
		);
	});
});
