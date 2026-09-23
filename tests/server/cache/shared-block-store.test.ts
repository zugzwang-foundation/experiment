import { beforeEach, describe, expect, it, vi } from "vitest";

// CACHE-COALESCE-2 — the fleet-wide single-flight, generalised from the debate
// view to any per-market cached block. The debate-view mechanism is covered
// exhaustively by `tests/server/debate-view/shared-view-store.test.ts`, which
// now runs THROUGH this store; these cases cover what generalising adds —
// that two blocks on one market are independent in entries, locks and
// removal markers, that the window is the block's own, and that the
// debate-view block's keys are byte-identical to the ones #570 shipped, so a
// deploy does not orphan the entries already in Upstash.

const { fakeRedis, clock } = vi.hoisted(() => {
	const clock = { now: 1_700_000_000_000 };
	const store = new Map<string, { value: string; expiresAt: number | null }>();
	const live = (k: string) => {
		const e = store.get(k);
		if (!e) return null;
		if (e.expiresAt !== null && e.expiresAt <= clock.now) {
			store.delete(k);
			return null;
		}
		return e;
	};
	const fakeRedis = {
		calls: [] as Array<[string, ...unknown[]]>,
		/** Keys whose SET rejects — a per-key Redis timeout. */
		failSetOn: new Set<string>(),
		reset() {
			store.clear();
			this.calls = [];
			this.failSetOn.clear();
		},
		async get(key: string): Promise<string | null> {
			this.calls.push(["get", key]);
			return live(key)?.value ?? null;
		},
		async mget(...keys: string[]): Promise<Array<string | null>> {
			this.calls.push(["mget", ...keys]);
			return keys.map((k) => live(k)?.value ?? null);
		},
		async set(
			key: string,
			value: string,
			opts?: { nx?: boolean; px?: number },
		): Promise<"OK" | null> {
			this.calls.push(["set", key, opts]);
			if (this.failSetOn.has(key)) throw new Error(`timeout on ${key}`);
			if (opts?.nx && live(key)) return null;
			store.set(key, {
				value,
				expiresAt: opts?.px ? clock.now + opts.px : null,
			});
			return "OK";
		},
		async del(key: string): Promise<number> {
			this.calls.push(["del", key]);
			return store.delete(key) ? 1 : 0;
		},
		async eval(
			_script: string,
			keys: string[],
			args: string[],
		): Promise<number> {
			const k = keys[0] as string;
			if (live(k)?.value === args[0]) return store.delete(k) ? 1 : 0;
			return 0;
		},
		peek(key: string) {
			return live(key)?.value ?? null;
		},
		keys() {
			return [...store.keys()].filter((k) => live(k) !== null);
		},
	};
	return { fakeRedis, clock };
});

vi.mock("@/server/upstash/redis", () => ({ redis: fakeRedis }));
vi.mock("@/server/observability/cache-metrics", () => ({
	recordCacheMiss: vi.fn(),
}));

import {
	coalesceSharedBlock,
	markMarketTextRemoved,
	markSharedBlockRemoved,
	readSharedBlock,
	type SharedBlock,
	sharedBlockKey,
	sharedBlockLockKey,
	sharedBlockOversizeKey,
	sharedBlockRemovedKey,
	writeSharedBlock,
} from "@/server/cache/shared-block-store";
import {
	SHARED_VIEW_EXPIRE_SEC,
	SHARED_VIEW_LOCK_MS,
	SHARED_VIEW_MAX_BYTES,
	SHARED_VIEW_WAIT_MS,
} from "@/server/config/limits";

const MARKET_ID = "01a0a0ba-c700-77bf-8395-7f6bd429e53f";
const sleep = async (ms: number) => {
	clock.now += ms;
};
const now = () => clock.now;

function args<T>(block: SharedBlock, windowMs: number, value: T) {
	return {
		block,
		marketId: MARKET_ID,
		windowMs,
		expireMs: 60_000,
		render: vi.fn(async () => value),
		sleep,
		now,
	};
}

beforeEach(() => {
	fakeRedis.reset();
	clock.now = 1_700_000_000_000;
	process.env.ZUGZWANG_ENV = "staging";
});

describe("keys", () => {
	it("the debate-view block's keys are exactly the #570 keys", () => {
		expect(sharedBlockKey("debate-view", MARKET_ID)).toBe(
			`staging:cache:debate-view:${MARKET_ID}`,
		);
		expect(sharedBlockLockKey("debate-view", MARKET_ID)).toBe(
			`staging:cache:debate-view:lock:${MARKET_ID}`,
		);
		expect(sharedBlockRemovedKey("debate-view", MARKET_ID)).toBe(
			`staging:cache:debate-view:removed:${MARKET_ID}`,
		);
		expect(sharedBlockOversizeKey("debate-view", MARKET_ID)).toBe(
			`staging:cache:debate-view:oversize:${MARKET_ID}`,
		);
	});

	it("two blocks on one market never share a key", () => {
		const a = [
			sharedBlockKey("reserve-walk", MARKET_ID),
			sharedBlockLockKey("reserve-walk", MARKET_ID),
			sharedBlockRemovedKey("reserve-walk", MARKET_ID),
			sharedBlockOversizeKey("reserve-walk", MARKET_ID),
		];
		const b = [
			sharedBlockKey("market-data", MARKET_ID),
			sharedBlockLockKey("market-data", MARKET_ID),
			sharedBlockRemovedKey("market-data", MARKET_ID),
			sharedBlockOversizeKey("market-data", MARKET_ID),
		];
		expect(new Set([...a, ...b]).size).toBe(8);
	});
});

describe("block isolation", () => {
	it("an entry written for one block is invisible to another", async () => {
		await writeSharedBlock(
			"reserve-walk",
			MARKET_ID,
			{ model: [1, 2, 3], renderedAt: clock.now, summary: "" },
			60_000,
		);
		expect(await readSharedBlock("reserve-walk", MARKET_ID)).not.toBeNull();
		expect(await readSharedBlock("market-data", MARKET_ID)).toBeNull();
	});

	it("a lock held on one block does not stall a render of another", async () => {
		await fakeRedis.set(sharedBlockLockKey("reserve-walk", MARKET_ID), "x", {
			nx: true,
			px: SHARED_VIEW_LOCK_MS,
		});
		const a = args("market-data", 15_000, { totals: 1 });
		const start = clock.now;
		expect(await coalesceSharedBlock(a)).toEqual({ totals: 1 });
		expect(a.render).toHaveBeenCalledTimes(1);
		// No wait was paid: the other block's lock is not this block's lock.
		expect(clock.now).toBe(start);
	});

	it("removal marks ONE block; the sibling block keeps serving", async () => {
		await writeSharedBlock(
			"market-data",
			MARKET_ID,
			{
				model: { hero: "body removed-me" },
				renderedAt: clock.now,
				summary: "",
			},
			60_000,
		);
		await writeSharedBlock(
			"reserve-walk",
			MARKET_ID,
			{ model: [1], renderedAt: clock.now, summary: "" },
			60_000,
		);
		await markSharedBlockRemoved("market-data", MARKET_ID);
		expect(
			JSON.stringify(await readSharedBlock("market-data", MARKET_ID)),
		).not.toContain("body removed-me");
		expect((await readSharedBlock("reserve-walk", MARKET_ID))?.model).toEqual([
			1,
		]);
		expect(
			fakeRedis.peek(sharedBlockRemovedKey("reserve-walk", MARKET_ID)),
		).toBeNull();
	});
});

describe("the window is the block's own", () => {
	it("a 60 s block serves an entry a 15 s block would have re-rendered", async () => {
		const age = 30_000;
		for (const block of ["reserve-walk", "market-data"] as const) {
			await writeSharedBlock(
				block,
				MARKET_ID,
				{ model: `old-${block}`, renderedAt: clock.now - age, summary: "" },
				60_000,
			);
		}
		const walk = args("reserve-walk", 60_000, "new-walk");
		const data = args("market-data", 15_000, "new-data");
		expect(await coalesceSharedBlock(walk)).toBe("old-reserve-walk");
		expect(walk.render).not.toHaveBeenCalled();
		expect(await coalesceSharedBlock(data)).toBe("new-data");
		expect(data.render).toHaveBeenCalledTimes(1);
	});

	it("summary defaults to empty, so an id-only block never mismatches itself", async () => {
		const a = args("reserve-walk", 60_000, [9]);
		expect(await coalesceSharedBlock(a)).toEqual([9]);
		const entry = await readSharedBlock("reserve-walk", MARKET_ID);
		expect(entry?.summary).toBe("");
		const b = args("reserve-walk", 60_000, [10]);
		expect(await coalesceSharedBlock(b)).toEqual([9]);
		expect(b.render).not.toHaveBeenCalled();
	});

	it("the entry TTL is the block's expireMs", async () => {
		const a = { ...args("reserve-walk", 60_000, [1]), expireMs: 3_600_000 };
		await coalesceSharedBlock(a);
		const setCall = fakeRedis.calls.find(
			(c) =>
				c[0] === "set" && c[1] === sharedBlockKey("reserve-walk", MARKET_ID),
		);
		expect(setCall?.[2]).toEqual({ px: 3_600_000 });
	});
});

describe("single-flight per block", () => {
	it("20 concurrent cold callers on two blocks cost exactly one render EACH", async () => {
		let walks = 0;
		let datas = 0;
		const calls = Array.from({ length: 20 }, (_, i) =>
			i % 2 === 0
				? coalesceSharedBlock({
						...args("reserve-walk", 60_000, null),
						render: async () => {
							walks += 1;
							await sleep(50);
							return "walk";
						},
					})
				: coalesceSharedBlock({
						...args("market-data", 15_000, null),
						render: async () => {
							datas += 1;
							await sleep(50);
							return "data";
						},
					}),
		);
		const outs = await Promise.all(calls);
		expect(walks).toBe(1);
		expect(datas).toBe(1);
		expect(outs.filter((o) => o === "walk")).toHaveLength(10);
		expect(outs.filter((o) => o === "data")).toHaveLength(10);
	});
});

describe("Gate C — the shapes the first cut got wrong", () => {
	it("removal attempts EVERY text-carrying block even when the first one's Redis call throws", async () => {
		for (const block of ["debate-view", "market-data"] as const) {
			await writeSharedBlock(
				block,
				MARKET_ID,
				{
					model: { text: `body in ${block}` },
					renderedAt: clock.now,
					summary: "",
				},
				60_000,
			);
		}
		// The debate-view marker SET times out …
		fakeRedis.failSetOn.add(sharedBlockRemovedKey("debate-view", MARKET_ID));
		await expect(markMarketTextRemoved(MARKET_ID)).rejects.toThrow("timeout");
		// … and the market-data block is still stamped and emptied.
		expect(fakeRedis.peek(sharedBlockKey("market-data", MARKET_ID))).toBeNull();
		expect(
			fakeRedis.peek(sharedBlockRemovedKey("market-data", MARKET_ID)),
		).not.toBeNull();
		expect(
			JSON.stringify(await readSharedBlock("market-data", MARKET_ID)),
		).not.toContain("body in market-data");
	});

	it("waitMs: 0 renders locally at once when the lock is lost and there is nothing to serve", async () => {
		await fakeRedis.set(sharedBlockLockKey("market-data", MARKET_ID), "x", {
			nx: true,
			px: SHARED_VIEW_LOCK_MS,
		});
		const a = { ...args("market-data", 15_000, "local"), waitMs: 0 };
		const start = clock.now;
		expect(await coalesceSharedBlock(a)).toBe("local");
		expect(a.render).toHaveBeenCalledTimes(1);
		expect(clock.now).toBe(start);
		// The default still waits — the debate page's single block keeps it.
		const b = args("debate-view", 15_000, "waited");
		await fakeRedis.set(sharedBlockLockKey("debate-view", MARKET_ID), "x", {
			nx: true,
			px: SHARED_VIEW_LOCK_MS,
		});
		expect(await coalesceSharedBlock(b)).toBe("waited");
		expect(clock.now - start).toBeGreaterThanOrEqual(SHARED_VIEW_WAIT_MS);
	});

	it("a non-uuid market id never reaches Redis: the key throws and the block renders locally", async () => {
		const a = {
			...args("market-data", 15_000, "local"),
			marketId: "../../etc",
		};
		expect(await coalesceSharedBlock(a)).toBe("local");
		expect(a.render).toHaveBeenCalledTimes(1);
		expect(fakeRedis.calls).toHaveLength(0);
		expect(() => sharedBlockKey("market-data", "not-a-uuid")).toThrow();
	});

	it("the oversize flag lasts SHARED_VIEW_EXPIRE_SEC for every block, not the block's own expire", async () => {
		const big = {
			model: ["x".repeat(SHARED_VIEW_MAX_BYTES)],
			renderedAt: clock.now,
			summary: "",
		};
		expect(
			await writeSharedBlock("reserve-walk", MARKET_ID, big, 3_600_000),
		).toBe(false);
		const flag = fakeRedis.calls.find(
			(c) =>
				c[0] === "set" &&
				c[1] === sharedBlockOversizeKey("reserve-walk", MARKET_ID),
		);
		expect(flag?.[2]).toEqual({ px: SHARED_VIEW_EXPIRE_SEC * 1000 });
	});
});

describe("CACHE-COALESCE-3 — the slug-keyed block", () => {
	it("keys market-id on a real slug, the same shape as the other blocks", () => {
		expect(sharedBlockKey("market-id", "bitcoin-price-50k")).toBe(
			"staging:cache:market-id:bitcoin-price-50k",
		);
		expect(sharedBlockLockKey("market-id", "yc-w27-acceptance")).toBe(
			"staging:cache:market-id:lock:yc-w27-acceptance",
		);
	});

	it("rejects anything a request could put in a slug that is not a slug", () => {
		for (const bad of [
			"../x",
			"Bitcoin",
			"a--b",
			"-a",
			"a b",
			"a:b",
			"x".repeat(81),
			"",
		]) {
			expect(() => sharedBlockKey("market-id", bad), bad).toThrow();
		}
	});

	it("keeps the UUID guard on every id-keyed block, so a slug is not a market id", () => {
		expect(() =>
			sharedBlockKey("version-token", "bitcoin-price-50k"),
		).toThrow();
		expect(() => sharedBlockKey("debate-view", "bitcoin-price-50k")).toThrow();
		expect(sharedBlockKey("version-token", MARKET_ID)).toBe(
			`staging:cache:version-token:${MARKET_ID}`,
		);
	});

	it("a malformed slug never reaches Redis: the block renders locally (fail open)", async () => {
		const a = { ...args("market-id", 60_000, "local"), marketId: "../etc" };
		expect(await coalesceSharedBlock(a)).toBe("local");
		expect(fakeRedis.calls).toHaveLength(0);
	});
});
