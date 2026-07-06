import { beforeEach, describe, expect, it, vi } from "vitest";

// AUDIT-FIX-B7a / A14 — bound the Upstash transport. The vendored
// `@upstash/redis` default (retries ?? 5 → 6 fetch attempts, exponential
// backoff ≈4.3s of sleep, and NO timeout of any kind — a hung socket rides
// undici defaults up to the platform function timeout) silently contradicts
// ADR-0015's no-auto-retry posture on every call from the shared singleton
// (idempotency, rate-limit, moderation reserve/release).
//
// `src/server/upstash/redis.ts` must pin the `Redis.fromEnv` config: a single
// FLAT transport-level retry (REDIS_MAX_RETRIES=1 / REDIS_RETRY_BACKOFF_MS=200)
// under a per-command abort ceiling
// (`signal: () => AbortSignal.timeout(REDIS_COMMAND_TIMEOUT_MS=2000)`).
//
// The `signal` FUNCTION form is load-bearing (ADR-0015 Patch, 2026-07-06):
// with a STATIC AbortSignal the 1.38 vendor fabricates a 200 response with body
// {result:"Aborted"} on abort (garbage into SETNX results); the function form
// rethrows the abort into the existing fail-open/fail-closed catch arms. The
// signal is minted once per command execution and covers the vendor's whole
// internal retry loop — a hard 2.0s per-command ceiling regardless of retry
// count.
//
// Approach: mock `@upstash/redis` so `Redis.fromEnv` is a spy capturing its
// config arg; `vi.resetModules()` + a dynamic import of the singleton makes the
// module-load construction deterministic. The `@/server/config/limits` constant
// import is the intended RED — REDIS_MAX_RETRIES / REDIS_RETRY_BACKOFF_MS /
// REDIS_COMMAND_TIMEOUT_MS do not exist until the impl lands.

import {
	REDIS_COMMAND_TIMEOUT_MS,
	REDIS_MAX_RETRIES,
	REDIS_RETRY_BACKOFF_MS,
} from "@/server/config/limits";

// The subset of the Upstash `Redis.fromEnv` config this test pins.
type CapturedRedisConfig = {
	automaticDeserialization?: boolean;
	retry?: { retries?: number; backoff?: (retryCount: number) => number };
	signal?: () => unknown;
};

const { fromEnvSpy } = vi.hoisted(() => ({
	fromEnvSpy: vi.fn((_config?: CapturedRedisConfig): unknown => ({})),
}));

vi.mock("@upstash/redis", () => ({
	Redis: { fromEnv: fromEnvSpy },
}));

// Re-evaluate the singleton under a cleared module registry and return the
// config `Redis.fromEnv` was constructed with (module-load capture).
async function loadRedisConfig(): Promise<CapturedRedisConfig> {
	vi.resetModules();
	fromEnvSpy.mockClear();
	await import("@/server/upstash/redis");
	expect(fromEnvSpy).toHaveBeenCalledTimes(1);
	const captured = fromEnvSpy.mock.calls[0]?.[0];
	if (captured === undefined) {
		throw new Error("Redis.fromEnv was called without a config argument");
	}
	return captured;
}

describe("AUDIT-FIX-B7a A14 — upstash redis transport config", () => {
	let config: CapturedRedisConfig;

	beforeEach(async () => {
		config = await loadRedisConfig();
	});

	it("redis-config::pins-automatic-deserialization-off (regression — cache state machine)", () => {
		// Load-bearing for the idempotency cache state machine: cache.ts does a
		// raw-string startsWith(PENDING_SENTINEL_PREFIX) BEFORE JSON.parse; auto-
		// deserialization would parse a stored payload into an object and the
		// sentinel-string check would throw on `.startsWith`.
		expect(config.automaticDeserialization).toBe(false);
	});

	it("redis-config::caps-transport-retries-at-one", () => {
		expect(REDIS_MAX_RETRIES).toBe(1);
		expect(config.retry?.retries).toBe(REDIS_MAX_RETRIES);
	});

	it("redis-config::flat-backoff-same-delay-at-every-retry-count", () => {
		expect(REDIS_RETRY_BACKOFF_MS).toBe(200);
		const backoff = config.retry?.backoff;
		expect(typeof backoff).toBe("function");
		if (typeof backoff !== "function") {
			throw new Error("retry.backoff is not a function");
		}
		// FLAT, not exponential — identical delay at retryCount 0, 1, 5.
		expect(backoff(0)).toBe(REDIS_RETRY_BACKOFF_MS);
		expect(backoff(1)).toBe(REDIS_RETRY_BACKOFF_MS);
		expect(backoff(5)).toBe(REDIS_RETRY_BACKOFF_MS);
	});

	it("redis-config::signal-is-function-form-not-static-signal (fabricated-200 hazard)", () => {
		// The FUNCTION form is mandatory: a static AbortSignal makes the vendor
		// fabricate a 200 {result:"Aborted"} on abort. Assert it is a function AND
		// NOT an AbortSignal instance.
		expect(typeof config.signal).toBe("function");
		expect(config.signal).not.toBeInstanceOf(AbortSignal);
	});

	it("redis-config::signal-mints-fresh-abortsignal-per-invocation", () => {
		const signal = config.signal;
		if (typeof signal !== "function") {
			throw new Error("signal is not a function");
		}
		const first = signal();
		const second = signal();
		expect(first).toBeInstanceOf(AbortSignal);
		expect(second).toBeInstanceOf(AbortSignal);
		// Fresh per invocation — the per-command ceiling is minted anew each call
		// (a shared static signal would leak an abort across commands).
		expect(first).not.toBe(second);
	});

	it("redis-config::signal-arms-abortsignal-timeout-with-command-ceiling", () => {
		expect(REDIS_COMMAND_TIMEOUT_MS).toBe(2000);
		const signal = config.signal;
		if (typeof signal !== "function") {
			throw new Error("signal is not a function");
		}
		const timeoutSpy = vi.spyOn(AbortSignal, "timeout");
		try {
			signal();
			expect(timeoutSpy).toHaveBeenCalledWith(REDIS_COMMAND_TIMEOUT_MS);
		} finally {
			timeoutSpy.mockRestore();
		}
	});
});
