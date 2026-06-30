import { describe, expect, it, vi } from "vitest";

// Per SCAFFOLD.8 plan §4.5 Test 2 — rate-limit ctor prefix audit.
//
// `rate-limit.ts` constructs eight `Ratelimit` instances at module-load
// (seven SCAFFOLD.8 surfaces + the MEDIA.1 `adminMediaPutUrlPerIp` arm).
// After the C4 refactor each `prefix:` literal flows through
// `getRedisKey()`, which prepends `process.env.ZUGZWANG_ENV` as the
// leftmost segment. This test mocks the `Ratelimit` ctor, dynamically
// imports rate-limit, and asserts every captured ctor carries the env
// prefix. Test 1 (tests/unit/upstash-keys.test.ts) covers the helper
// in isolation; this test is the cross-module verification that the
// helper is actually consumed at the seven sites SPEC.2 §11 §"Per-
// surface rate-limit table" cares about.
//
// Mocks at three boundaries:
//   - `@upstash/ratelimit` — capture ctor opts via `vi.hoisted` (vi.mock
//     factories are hoisted above imports; module-scope vars are out of
//     scope inside them, so the captured state lives in vi.hoisted).
//   - `@/server/upstash/redis` — defence in depth alongside the
//     `tests/_setup/env.ts` defaults; prevents any accidental
//     `Redis.fromEnv()` module-load throw.
//   - `@sentry/nextjs` — rate-limit.ts imports `captureException` at
//     line 1; the mock avoids any Sentry-init side effects in the test
//     process.

const hoisted = vi.hoisted(() => ({
	ctors: [] as Array<{ prefix: string }>,
}));

vi.mock("@upstash/ratelimit", () => {
	const Ratelimit = vi.fn((opts: { prefix: string }) => {
		hoisted.ctors.push(opts);
		return { limit: vi.fn() };
	});
	Object.assign(Ratelimit, {
		slidingWindow: vi.fn(() => "sliding-window-mock"),
	});
	return { Ratelimit };
});

vi.mock("@/server/upstash/redis", () => ({ redis: {} }));

vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

describe("Ratelimit prefixes", () => {
	it("constructs all 8 surfaces with env-prefixed prefix at module-load", async () => {
		process.env.ZUGZWANG_ENV = "prod";
		await import("@/server/middleware/rate-limit");
		expect(hoisted.ctors).toHaveLength(8);
		for (const c of hoisted.ctors) {
			expect(c.prefix).toMatch(/^prod:ratelimit:/);
		}
		// MEDIA.1: the admin market-media signed-PUT cap is its own surface with
		// a distinct prefix (the §11 disjointness invariant).
		expect(hoisted.ctors.map((c) => c.prefix)).toContain(
			"prod:ratelimit:admin-media-put-ip",
		);
	});
});
