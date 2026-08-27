import { getTableName } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DbClient } from "@/db";
import { payoutEvents, pools, positions } from "@/db/schema";
import { HEADER_PORTFOLIO_CACHE_TTL_SECONDS } from "@/server/config/limits";
import { computeSell } from "@/server/cpmm/calculate";
import { CpmmDecimal, toFixed18 } from "@/server/cpmm/decimal";
import { getHeaderPortfolioCached } from "@/server/dharma/header-portfolio";
import { getRedisKey } from "@/server/upstash/keys";

/**
 * HEADER-PORTFOLIO-CACHE — the Redis cache-aside in front of
 * `getHeaderPortfolio`.
 *
 * Every "same" assertion here is paired with a "different" one (the R2-MEMO
 * shape, `read-url-memo.test.ts`): a cache that merely EXISTS could still pass
 * "a hit returns a value" while silently serving one user's Đ figure to
 * another, or persisting a failure as if it were a real Đ 0. The suite tests
 * that the cache discriminates by user and by success/failure, not merely
 * that it returns something.
 *
 * `getHeaderPortfolio` itself is untouched by this task (see the plan) and is
 * already fully locked by `header-portfolio.test.ts` — this file exercises
 * only the NEW wrapper's cache/fail-open behaviour, reusing that file's
 * `recordingClient` idiom so a cache MISS still proves the real read fired.
 */

const { mockRedis } = vi.hoisted(() => ({
	mockRedis: { get: vi.fn(), set: vi.fn() },
}));

vi.mock("@/server/upstash/redis", () => ({
	redis: mockRedis,
}));

const { captureSpy } = vi.hoisted(() => ({
	captureSpy: vi.fn(() => true),
}));

vi.mock("@/server/observability/safe-capture", () => ({
	safeCaptureException: captureSpy,
}));

// ───────────────────────────── the recorder (mirrors header-portfolio.test.ts) ─────────────────────────────

type FixtureRows = Record<string, ReadonlyArray<Record<string, string>>>;

function recordingClient(rows: FixtureRows): {
	client: DbClient;
	selectCalls: number;
} {
	let selectCalls = 0;
	const client = {
		transaction: vi.fn(),
		select() {
			selectCalls += 1;
			return {
				from(table: { _: { name: string } } | unknown) {
					return {
						where() {
							return Promise.resolve(rows[getTableName(table as never)] ?? []);
						},
					};
				},
			};
		},
	} as unknown as DbClient;
	return {
		client,
		get selectCalls() {
			return selectCalls;
		},
	};
}

function throwingClient(): DbClient {
	return {
		transaction: vi.fn(),
		select() {
			throw new Error("simulated postgres failure");
		},
	} as unknown as DbClient;
}

const USER_A = "viewer-a";
const USER_B = "viewer-b";
const M_OPEN = "market-open";
const CANONICAL_ZERO = toFixed18(new CpmmDecimal(0));

const HOLDING: FixtureRows = {
	[getTableName(positions)]: [
		{ marketId: M_OPEN, side: "YES", quantity: "30.000000000000000000" },
	],
	[getTableName(payoutEvents)]: [],
	[getTableName(pools)]: [
		{
			marketId: M_OPEN,
			yesReserves: "120.000000000000000000",
			noReserves: "80.000000000000000000",
		},
	],
};

const EXPECTED_VALUE = toFixed18(
	new CpmmDecimal(
		computeSell({
			reserves: { yes: "120.000000000000000000", no: "80.000000000000000000" },
			side: "yes",
			shares: "30.000000000000000000",
		}).proceeds,
	),
);

beforeEach(() => {
	mockRedis.get.mockReset();
	mockRedis.set.mockReset();
	captureSpy.mockClear();
});

describe("cache miss — computes live and stores the result", () => {
	it("returns the computed value and issues the real DB read", async () => {
		mockRedis.get.mockResolvedValue(null);
		mockRedis.set.mockResolvedValue("OK");
		const rec = recordingClient(HOLDING);

		const result = await getHeaderPortfolioCached(rec.client, USER_A);

		expect(result).toBe(EXPECTED_VALUE);
		expect(rec.selectCalls).toBe(3);
	});

	it("stores the value under the env-scoped per-user key with the configured TTL", async () => {
		mockRedis.get.mockResolvedValue(null);
		mockRedis.set.mockResolvedValue("OK");
		const rec = recordingClient(HOLDING);

		await getHeaderPortfolioCached(rec.client, USER_A);

		expect(mockRedis.set).toHaveBeenCalledWith(
			getRedisKey("cache", "header-portfolio", USER_A),
			EXPECTED_VALUE,
			{ ex: HEADER_PORTFOLIO_CACHE_TTL_SECONDS },
		);
	});
});

describe("cache hit — never touches the DB", () => {
	it("returns the cached value without issuing any statement", async () => {
		mockRedis.get.mockResolvedValue(EXPECTED_VALUE);
		// A client that throws the instant it's touched — a hit that fell through
		// to a live read would fail this test loudly, not silently.
		const client = throwingClient();

		const result = await getHeaderPortfolioCached(client, USER_A);

		expect(result).toBe(EXPECTED_VALUE);
		expect(mockRedis.set).not.toHaveBeenCalled();
	});

	it("discriminates by user — A's cached hit is never served to B", async () => {
		// A cache keyed on anything less than the full userId would pass "a hit
		// returns a value" and still leak one participant's Đ figure to another.
		mockRedis.get.mockImplementation(async (key: string) => {
			return key === getRedisKey("cache", "header-portfolio", USER_A)
				? EXPECTED_VALUE
				: null;
		});
		mockRedis.set.mockResolvedValue("OK");
		const rec = recordingClient(HOLDING);

		const hitForA = await getHeaderPortfolioCached(rec.client, USER_A);
		const missForB = await getHeaderPortfolioCached(rec.client, USER_B);

		expect(hitForA).toBe(EXPECTED_VALUE);
		// B misses and falls through to a real (correctly-attributed) read.
		expect(missForB).toBe(EXPECTED_VALUE);
		expect(rec.selectCalls).toBe(3); // only B's miss touched the DB
	});
});

describe("never caches a failure", () => {
	it("returns null on a read failure and does not call redis.set", async () => {
		mockRedis.get.mockResolvedValue(null);

		const result = await getHeaderPortfolioCached(throwingClient(), USER_A);

		expect(result).toBeNull();
		expect(mockRedis.set).not.toHaveBeenCalled();
	});

	it("does not cache the ordinary zero-holdings result as a failure, and DOES cache it", async () => {
		// The contrast case: Đ 0 is a real, cacheable value (R9 — zero is a value,
		// absence/failure is `null`), so it must be treated the OPPOSITE of the
		// failure case above.
		mockRedis.get.mockResolvedValue(null);
		mockRedis.set.mockResolvedValue("OK");
		const rec = recordingClient({ [getTableName(positions)]: [] });

		const result = await getHeaderPortfolioCached(rec.client, USER_A);

		expect(result).toBe(CANONICAL_ZERO);
		expect(mockRedis.set).toHaveBeenCalledWith(
			getRedisKey("cache", "header-portfolio", USER_A),
			CANONICAL_ZERO,
			{ ex: HEADER_PORTFOLIO_CACHE_TTL_SECONDS },
		);
	});
});

describe("fails open on Redis errors — never breaks the header", () => {
	it("falls through to a live read when redis.get throws, and reports it", async () => {
		mockRedis.get.mockRejectedValue(new Error("redis unavailable"));
		mockRedis.set.mockResolvedValue("OK");
		const rec = recordingClient(HOLDING);

		const result = await getHeaderPortfolioCached(rec.client, USER_A);

		expect(result).toBe(EXPECTED_VALUE);
		expect(rec.selectCalls).toBe(3);
		expect(captureSpy).toHaveBeenCalledWith(
			expect.any(Error),
			expect.objectContaining({
				tags: expect.objectContaining({
					kind: "header_portfolio_cache_read_failed",
				}),
			}),
		);
	});

	it("still returns the live value when redis.set throws, and reports it", async () => {
		mockRedis.get.mockResolvedValue(null);
		mockRedis.set.mockRejectedValue(new Error("redis unavailable"));
		const rec = recordingClient(HOLDING);

		const result = await getHeaderPortfolioCached(rec.client, USER_A);

		expect(result).toBe(EXPECTED_VALUE);
		expect(captureSpy).toHaveBeenCalledWith(
			expect.any(Error),
			expect.objectContaining({
				tags: expect.objectContaining({
					kind: "header_portfolio_cache_write_failed",
				}),
			}),
		);
	});
});
