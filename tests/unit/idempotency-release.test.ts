import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// AUDIT-FIX-B3 A4 — the never-throws, ownership-checked, alarmed release (plan
// §3.5). The reservation sentinel value gains an owner token
// (`PENDING:{fingerprint}:{token}`, token = randomUUID per lock.ts), and the
// `release` closure becomes an ownership-checked `redis.eval` (Lua compare-and-DEL
// / compare-and-SET — the `upstash/lock.ts:24-30` precedent) that NEVER throws: on
// any Redis error it routes through `safeCaptureException(err, { tags: { kind:
// "upstash_unavailable_idempotency", site: "release" } })` and returns.
//
// So the release-mechanism assertions target `redis.eval`, NOT `redis.set` /
// `redis.del`. The mocked redis therefore needs an `eval` vi.fn.
//
// Load-bearing contract (all RED against current code — release uses raw set/del,
// no token, no eval):
//   - release(null) + release(completed) RESOLVE (never reject) when eval throws,
//     and fire the completion-write alarm (kind upstash_unavailable_idempotency);
//   - release(null) is a compare-and-DELETE via eval (NOT redis.del);
//   - release(completed) is a compare-and-SET via eval carrying EX 86400
//     (COMPLETED_TTL_SECONDS), NOT a bare redis.set;
//   - the reservation sentinel value carries the owner token;
//   - the eval is passed the release's OWN sentinel value (ownership: a straggler
//     cannot clobber a successor's key).
//
// Substrate-only: `@/server/upstash/redis` + `@sentry/nextjs` mocked; cache.ts runs
// for real. No real Redis / Postgres. Money values cross as decimal STRINGS.

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

const { mockCaptureException } = vi.hoisted(() => ({
	mockCaptureException: vi.fn(),
}));

vi.mock("@sentry/nextjs", () => ({
	captureException: mockCaptureException,
	captureMessage: vi.fn(),
	flush: vi.fn(async () => true),
}));

import { idempotencyLookupOrReserve } from "@/server/idempotency/cache";
import {
	COMPLETED_TTL_SECONDS,
	PENDING_SENTINEL_PREFIX,
} from "@/server/idempotency/types";
import { getRedisKey } from "@/server/upstash/keys";

const COMPLETED = {
	status: 200,
	body: { ok: true, data: { dharmaReturned: "12.500000000000000000" } },
	bodyFingerprint: "fp-release",
};

beforeEach(() => {
	mockRedis.set.mockReset();
	mockRedis.get.mockReset();
	mockRedis.del.mockReset();
	mockRedis.eval.mockReset();
	mockCaptureException.mockClear();
});

afterEach(() => {
	vi.clearAllMocks();
});

/** Reserve a fresh key (SET NX wins → miss) and return its release + sentinel. */
async function reserve(key: string, fingerprint: string) {
	mockRedis.set.mockResolvedValueOnce("OK");
	const result = await idempotencyLookupOrReserve(key, fingerprint);
	if (result.kind !== "miss") {
		throw new Error(`expected miss, got ${result.kind}`);
	}
	const sentinelValue = mockRedis.set.mock.calls[0]?.[1] as string;
	return { release: result.release, sentinelValue };
}

describe("idempotency release — guarded, ownership-checked, alarmed (A4)", () => {
	it("idempotency-release::release-null-resolves-and-alarms-when-eval-throws", async () => {
		const { release } = await reserve("rel-null-throw", "fp-a");
		mockRedis.eval.mockRejectedValueOnce(new Error("ECONNREFUSED"));

		// NEVER throws — the finally that awaits this must not be able to supersede
		// the committed response.
		await expect(release(null)).resolves.toBeUndefined();

		expect(mockCaptureException).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({
				tags: expect.objectContaining({
					kind: "upstash_unavailable_idempotency",
				}),
			}),
		);
	});

	it("idempotency-release::promote-resolves-and-alarms-when-eval-throws", async () => {
		const { release } = await reserve("rel-promote-throw", "fp-release");
		mockRedis.eval.mockRejectedValueOnce(new Error("ECONNREFUSED"));

		await expect(release(COMPLETED)).resolves.toBeUndefined();

		expect(mockCaptureException).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({
				tags: expect.objectContaining({
					kind: "upstash_unavailable_idempotency",
				}),
			}),
		);
	});

	it("idempotency-release::release-null-uses-eval-compare-and-delete-not-del", async () => {
		const { release, sentinelValue } = await reserve("rel-null-del", "fp-b");
		mockRedis.eval.mockResolvedValueOnce(1);

		await release(null);

		// The delete goes through the ownership-checked eval, NOT a bare DEL.
		expect(mockRedis.eval).toHaveBeenCalledTimes(1);
		expect(mockRedis.del).not.toHaveBeenCalled();
		// SET was only the reservation SET NX (no second write).
		expect(mockRedis.set).toHaveBeenCalledTimes(1);

		// The eval keys the reservation key and compares against our OWN sentinel.
		const [, keys, argv] = mockRedis.eval.mock.calls[0] as [
			string,
			string[],
			unknown[],
		];
		expect(keys).toEqual([getRedisKey("idem", "rel-null-del")]);
		expect(argv).toContain(sentinelValue);
	});

	it("idempotency-release::promote-uses-eval-compare-and-set-with-ex-86400", async () => {
		const { release, sentinelValue } = await reserve(
			"rel-promote",
			"fp-release",
		);
		mockRedis.eval.mockResolvedValueOnce(1);

		await release(COMPLETED);

		// The promote is a compare-and-SET via eval, NOT a bare redis.set.
		expect(mockRedis.eval).toHaveBeenCalledTimes(1);
		expect(mockRedis.set).toHaveBeenCalledTimes(1); // only the reservation SET NX

		const [script, keys, argv] = mockRedis.eval.mock.calls[0] as [
			string,
			string[],
			unknown[],
		];
		expect(keys).toEqual([getRedisKey("idem", "rel-promote")]);
		// Ownership: our own sentinel value is the compare operand.
		expect(argv).toContain(sentinelValue);
		// The completed payload is written verbatim (JSON.stringify).
		expect(argv).toContain(JSON.stringify(COMPLETED));
		// The 24h completed-cache TTL rides the promote (in the ARGV or baked into
		// the Lua) — tolerant of the exact wiring, strict on the value.
		const ttl = String(COMPLETED_TTL_SECONDS);
		const ttlPresent =
			argv.map((a) => String(a)).includes(ttl) || String(script).includes(ttl);
		expect(ttlPresent).toBe(true);
		expect(COMPLETED_TTL_SECONDS).toBe(86400);
	});

	it("idempotency-release::sentinel-value-carries-owner-token", async () => {
		const fingerprint = "fp-token";
		const { sentinelValue } = await reserve("rel-token", fingerprint);

		// PENDING:{fingerprint}:{uuid-token} — the token is a real randomUUID (only
		// redis/sentry are mocked; cache.ts + node:crypto run for real).
		expect(sentinelValue).toMatch(
			new RegExp(`^${PENDING_SENTINEL_PREFIX}${fingerprint}:[0-9a-f-]{36}$`),
		);
	});

	it("idempotency-release::eval-noop-return-does-not-fall-back-to-raw-set-or-del", async () => {
		// A FOREIGN sentinel value makes the Lua compare fail → eval returns 0 (a
		// no-op: our sentinel expired and someone else re-reserved). The release must
		// resolve cleanly WITHOUT falling back to an unguarded set/del (that fallback
		// is exactly the clobber A4 removes).
		const { release } = await reserve("rel-foreign", "fp-c");
		mockRedis.eval.mockResolvedValueOnce(0);

		await expect(release(COMPLETED)).resolves.toBeUndefined();

		expect(mockRedis.eval).toHaveBeenCalledTimes(1);
		expect(mockRedis.del).not.toHaveBeenCalled();
		expect(mockRedis.set).toHaveBeenCalledTimes(1); // reservation SET NX only
	});
});
