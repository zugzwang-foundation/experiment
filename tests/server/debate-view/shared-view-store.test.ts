import { beforeEach, describe, expect, it, vi } from "vitest";

// CACHE-COALESCE-1 — the fleet-wide single-flight around the debate view.
//
// `'use cache'` dedupes renders inside ONE Vercel instance. Measured on
// production at 5,000 readers: ~3,800 debate-view renders/min against a 15 s
// window that should cost 4/min/market — instances × markets × 4/min — and a
// burst cold-starts every instance at once (load-test issues I-07/I-17/I-18).
// This store puts one shared entry per market in Upstash and a lock in front
// of the render, so a stale window costs ONE render across the fleet and the
// rest serve the stale copy.
//
// Redis is a faithful in-memory fake (SET NX/PX, GET, MGET, DEL, the
// compare-and-delete EVAL, expiry by an injected clock); the lock semantics
// under test are real, the transport is not. Time and sleeping are injected so
// every case is deterministic, including the SC-1 races.

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
		failReads: false,
		reset() {
			store.clear();
			this.calls = [];
			this.failReads = false;
		},
		async get(key: string): Promise<string | null> {
			this.calls.push(["get", key]);
			if (this.failReads) throw new Error("upstash down");
			return live(key)?.value ?? null;
		},
		async mget(...keys: string[]): Promise<Array<string | null>> {
			this.calls.push(["mget", ...keys]);
			if (this.failReads) throw new Error("upstash down");
			return keys.map((k) => live(k)?.value ?? null);
		},
		async set(
			key: string,
			value: string,
			opts?: { nx?: boolean; px?: number; ex?: number },
		): Promise<"OK" | null> {
			this.calls.push(["set", key, opts]);
			if (opts?.nx && live(key)) return null;
			const ttl = opts?.px ?? (opts?.ex ? opts.ex * 1000 : null);
			store.set(key, {
				value,
				expiresAt: ttl === null ? null : clock.now + ttl,
			});
			return "OK";
		},
		async del(key: string): Promise<number> {
			this.calls.push(["del", key]);
			return store.delete(key) ? 1 : 0;
		},
		/** Only the compare-and-delete release script is modelled. */
		async eval(
			_script: string,
			keys: string[],
			args: string[],
		): Promise<number> {
			this.calls.push(["eval", keys[0]]);
			const k = keys[0] as string;
			if (live(k)?.value === args[0]) return store.delete(k) ? 1 : 0;
			return 0;
		},
		peek(key: string) {
			return live(key)?.value ?? null;
		},
	};
	return { fakeRedis, clock };
});

vi.mock("@/server/upstash/redis", () => ({ redis: fakeRedis }));
vi.mock("@/server/observability/cache-metrics", () => ({
	recordCacheMiss: vi.fn(),
}));

import { markMarketTextRemoved } from "@/server/cache/shared-block-store";
import {
	SHARED_VIEW_EXPIRE_SEC,
	SHARED_VIEW_LOCK_MS,
	SHARED_VIEW_MAX_BYTES,
	SHARED_VIEW_MIN_WINDOW_MS,
	SHARED_VIEW_WAIT_MS,
} from "@/server/config/limits";
import type { DebateViewModel } from "@/server/debate-view/load-debate-view";
import {
	coalesceDebateView,
	readSharedView,
	sharedViewKey,
	sharedViewLockKey,
	sharedViewOversizeKey,
	sharedViewRemovedKey,
	writeSharedView,
} from "@/server/debate-view/shared-view-store";
import type { MarketSummary } from "@/server/markets/get-by-slug";

const MARKET_ID = "01a0a0ba-c700-77bf-8395-7f6bd429e53f";
const market = {
	id: MARKET_ID,
	slug: "bitcoin-price-50k",
	title: "t",
	description: "d",
	status: "Open",
	mediaVideoUrl: null,
} as unknown as MarketSummary;
const SUMMARY = JSON.stringify(market);

/** A model stub; only identity matters to the store, never the shape. */
function modelWith(tag: string): DebateViewModel {
	return {
		tag,
		posts: [{ id: `p-${tag}`, body: `body ${tag}` }],
	} as unknown as DebateViewModel;
}

/** Sleep that advances the fake clock instead of waiting. */
const sleep = async (ms: number) => {
	clock.now += ms;
};
/** The store's clock is the same fake, so freshness is deterministic. */
const now = () => clock.now;

async function seed(tag: string, ageMs: number, summary = SUMMARY) {
	await writeSharedView(MARKET_ID, {
		model: modelWith(tag),
		renderedAt: clock.now - ageMs,
		summary,
	});
	fakeRedis.calls = [];
}

beforeEach(() => {
	fakeRedis.reset();
	clock.now = 1_700_000_000_000;
	process.env.ZUGZWANG_ENV = "staging";
});

describe("keys", () => {
	it("are env-prefixed and disjoint", () => {
		expect(sharedViewKey(MARKET_ID)).toBe(
			`staging:cache:debate-view:${MARKET_ID}`,
		);
		expect(sharedViewLockKey(MARKET_ID)).toBe(
			`staging:cache:debate-view:lock:${MARKET_ID}`,
		);
		expect(sharedViewRemovedKey(MARKET_ID)).toBe(
			`staging:cache:debate-view:removed:${MARKET_ID}`,
		);
		expect(sharedViewOversizeKey(MARKET_ID)).toBe(
			`staging:cache:debate-view:oversize:${MARKET_ID}`,
		);
	});
});

describe("write / read / removal", () => {
	it("round-trips an entry with a TTL of SHARED_VIEW_EXPIRE_SEC", async () => {
		expect(
			await writeSharedView(MARKET_ID, {
				model: modelWith("a"),
				renderedAt: clock.now,
				summary: SUMMARY,
			}),
		).toBe(true);
		const setCall = fakeRedis.calls.find(
			(c) => c[0] === "set" && c[1] === sharedViewKey(MARKET_ID),
		);
		expect(setCall?.[2]).toEqual({ px: SHARED_VIEW_EXPIRE_SEC * 1000 });
		const entry = await readSharedView(MARKET_ID);
		expect(entry?.renderedAt).toBe(clock.now);
		expect(entry?.summary).toBe(SUMMARY);
		expect(entry?.model).toEqual(modelWith("a"));
	});

	it("returns null for a missing, expired or corrupt entry", async () => {
		expect(await readSharedView(MARKET_ID)).toBeNull();
		await seed("a", 0);
		clock.now += SHARED_VIEW_EXPIRE_SEC * 1000 + 1;
		expect(await readSharedView(MARKET_ID)).toBeNull();
		await fakeRedis.set(sharedViewKey(MARKET_ID), "{not json");
		expect(await readSharedView(MARKET_ID)).toBeNull();
	});

	// SC-1 — masking is a property of every body read. Three races, each
	// asserting the BODY's absence from what any reader can now get.
	it("removal makes a removed body unreachable (rule 1: marker + delete)", async () => {
		await seed("removed-me", 0);
		expect(JSON.stringify(await readSharedView(MARKET_ID))).toContain(
			"body removed-me",
		);
		await markMarketTextRemoved(MARKET_ID);
		expect(JSON.stringify(await readSharedView(MARKET_ID))).not.toContain(
			"body removed-me",
		);
		expect(fakeRedis.peek(sharedViewKey(MARKET_ID))).toBeNull();
		expect(fakeRedis.peek(sharedViewRemovedKey(MARKET_ID))).not.toBeNull();
	});

	it("an entry that survived the delete is still ignored if older than the marker (rule 2)", async () => {
		await markMarketTextRemoved(MARKET_ID);
		const removedAt = Number(fakeRedis.peek(sharedViewRemovedKey(MARKET_ID)));
		// Simulate the entry landing back (or surviving) with a pre-removal stamp.
		await fakeRedis.set(
			sharedViewKey(MARKET_ID),
			JSON.stringify({
				model: modelWith("ghost"),
				renderedAt: removedAt - 1,
				summary: SUMMARY,
			}),
		);
		expect(JSON.stringify(await readSharedView(MARKET_ID))).not.toContain(
			"body ghost",
		);
	});

	it("a render that started before the removal cannot write its body (rule 3)", async () => {
		await markMarketTextRemoved(MARKET_ID);
		const removedAt = Number(fakeRedis.peek(sharedViewRemovedKey(MARKET_ID)));
		const written = await writeSharedView(
			MARKET_ID,
			{
				model: modelWith("in-flight"),
				renderedAt: removedAt + 500,
				summary: SUMMARY,
			},
			removedAt - 500,
		);
		expect(written).toBe(false);
		expect(
			JSON.stringify(fakeRedis.peek(sharedViewKey(MARKET_ID))),
		).not.toContain("body in-flight");
		// A render that started AFTER the removal is the fresh truth and lands.
		const later = await writeSharedView(
			MARKET_ID,
			{
				model: modelWith("after"),
				renderedAt: removedAt + 1000,
				summary: SUMMARY,
			},
			removedAt + 1,
		);
		expect(later).toBe(true);
	});

	it("an oversize entry is not written and raises the oversize flag instead", async () => {
		const big = {
			model: {
				posts: [{ body: "x".repeat(SHARED_VIEW_MAX_BYTES) }],
			} as unknown as DebateViewModel,
			renderedAt: clock.now,
			summary: SUMMARY,
		};
		expect(await writeSharedView(MARKET_ID, big)).toBe(false);
		expect(fakeRedis.peek(sharedViewKey(MARKET_ID))).toBeNull();
		expect(fakeRedis.peek(sharedViewOversizeKey(MARKET_ID))).toBe("1");
	});
});

describe("coalesceDebateView", () => {
	it("serves a fresh entry without rendering or locking", async () => {
		await seed("fresh", SHARED_VIEW_MIN_WINDOW_MS - 1000);
		const render = vi.fn(async () => modelWith("new"));
		const out = await coalesceDebateView({ market, render, sleep, now });
		expect(out).toEqual(modelWith("fresh"));
		expect(render).not.toHaveBeenCalled();
		expect(fakeRedis.calls.some((c) => c[0] === "set")).toBe(false);
	});

	it("renders once, rewrites the entry and releases ITS OWN lock when the window has passed", async () => {
		await seed("old", SHARED_VIEW_MIN_WINDOW_MS + 1);
		const render = vi.fn(async () => modelWith("new"));
		const out = await coalesceDebateView({ market, render, sleep, now });
		expect(out).toEqual(modelWith("new"));
		expect(render).toHaveBeenCalledTimes(1);
		const entry = await readSharedView(MARKET_ID);
		expect(entry?.model).toEqual(modelWith("new"));
		expect(entry?.renderedAt).toBe(clock.now);
		const lockSet = fakeRedis.calls.find(
			(c) => c[0] === "set" && c[1] === sharedViewLockKey(MARKET_ID),
		);
		expect(lockSet?.[2]).toEqual({ nx: true, px: SHARED_VIEW_LOCK_MS });
		expect(fakeRedis.calls.some((c) => c[0] === "eval")).toBe(true);
		expect(fakeRedis.peek(sharedViewLockKey(MARKET_ID))).toBeNull();
	});

	it("does not delete a successor's lock after overrunning its own", async () => {
		await seed("old", SHARED_VIEW_MIN_WINDOW_MS + 1);
		const render = vi.fn(async () => {
			// Our lock expires mid-render and another instance takes it.
			clock.now += SHARED_VIEW_LOCK_MS + 1;
			await fakeRedis.set(sharedViewLockKey(MARKET_ID), "successor", {
				nx: true,
				px: SHARED_VIEW_LOCK_MS,
			});
			return modelWith("slow");
		});
		await coalesceDebateView({ market, render, sleep, now });
		expect(fakeRedis.peek(sharedViewLockKey(MARKET_ID))).toBe("successor");
	});

	it("serves the stale entry when another instance holds the lock", async () => {
		await seed("stale", SHARED_VIEW_MIN_WINDOW_MS + 1);
		await fakeRedis.set(sharedViewLockKey(MARKET_ID), "other", {
			nx: true,
			px: SHARED_VIEW_LOCK_MS,
		});
		const render = vi.fn(async () => modelWith("new"));
		const out = await coalesceDebateView({ market, render, sleep, now });
		expect(out).toEqual(modelWith("stale"));
		expect(render).not.toHaveBeenCalled();
	});

	it("never serves a stale entry of another market summary, even under a held lock", async () => {
		await seed("open", SHARED_VIEW_MIN_WINDOW_MS + 1);
		await fakeRedis.set(sharedViewLockKey(MARKET_ID), "other", {
			nx: true,
			px: SHARED_VIEW_LOCK_MS,
		});
		const closed = { ...market, status: "Closed" } as MarketSummary;
		const render = vi.fn(async () => modelWith("closed"));
		const out = await coalesceDebateView({
			market: closed,
			render,
			sleep,
			now,
		});
		expect(out).toEqual(modelWith("closed"));
		expect(render).toHaveBeenCalledTimes(1);
	});

	it("treats a summary change (status, title) as stale and re-renders", async () => {
		await seed("open", 0);
		const closed = { ...market, status: "Closed" } as MarketSummary;
		const render = vi.fn(async () => modelWith("closed"));
		const out = await coalesceDebateView({
			market: closed,
			render,
			sleep,
			now,
		});
		expect(out).toEqual(modelWith("closed"));
		expect(render).toHaveBeenCalledTimes(1);
		expect((await readSharedView(MARKET_ID))?.summary).toBe(
			JSON.stringify(closed),
		);
	});

	it("waits for the lock holder's entry when there is nothing to serve", async () => {
		await fakeRedis.set(sharedViewLockKey(MARKET_ID), "other", {
			nx: true,
			px: SHARED_VIEW_LOCK_MS,
		});
		const render = vi.fn(async () => modelWith("mine"));
		let elapsed = 0;
		const sleepAndArrive = async (ms: number) => {
			await sleep(ms);
			elapsed += ms;
			if (elapsed >= 300 && (await readSharedView(MARKET_ID)) === null) {
				await writeSharedView(MARKET_ID, {
					model: modelWith("holder"),
					renderedAt: clock.now,
					summary: SUMMARY,
				});
			}
		};
		const out = await coalesceDebateView({
			market,
			render,
			sleep: sleepAndArrive,
			now,
		});
		expect(out).toEqual(modelWith("holder"));
		expect(render).not.toHaveBeenCalled();
	});

	it("bounds the wait by WALL CLOCK, so a slow Redis cannot stretch it", async () => {
		await fakeRedis.set(sharedViewLockKey(MARKET_ID), "other", {
			nx: true,
			px: SHARED_VIEW_LOCK_MS,
		});
		// Every poll "takes" 700 ms of clock on top of the sleep.
		const originalMget = fakeRedis.mget.bind(fakeRedis);
		fakeRedis.mget = (async (...keys: string[]) => {
			clock.now += 700;
			return originalMget(...keys);
		}) as typeof fakeRedis.mget;
		const render = vi.fn(async () => modelWith("mine"));
		const start = clock.now;
		const out = await coalesceDebateView({ market, render, sleep, now });
		fakeRedis.mget = originalMget;
		expect(out).toEqual(modelWith("mine"));
		expect(render).toHaveBeenCalledTimes(1);
		// The initial read costs one slow mget (700), then the deadline runs
		// from there and overshoots by at most ONE poll (100 sleep + 700 mget).
		// A sleep-counted bound would have run 20 polls × 800 ms = 16 s here.
		expect(clock.now - start).toBeLessThanOrEqual(
			700 + SHARED_VIEW_WAIT_MS + 800,
		);
	});

	it("renders locally when the wait runs out with nothing to serve (fail open)", async () => {
		await fakeRedis.set(sharedViewLockKey(MARKET_ID), "other", {
			nx: true,
			px: SHARED_VIEW_LOCK_MS,
		});
		const render = vi.fn(async () => modelWith("mine"));
		const start = clock.now;
		const out = await coalesceDebateView({ market, render, sleep, now });
		expect(out).toEqual(modelWith("mine"));
		expect(render).toHaveBeenCalledTimes(1);
		expect(clock.now - start).toBeGreaterThanOrEqual(SHARED_VIEW_WAIT_MS);
	});

	it("collapses N concurrent cold callers into ONE render", async () => {
		let renders = 0;
		const render = vi.fn(async () => {
			renders += 1;
			await sleep(50);
			return modelWith("shared");
		});
		const outs = await Promise.all(
			Array.from({ length: 20 }, () =>
				coalesceDebateView({ market, render, sleep, now }),
			),
		);
		expect(renders).toBe(1);
		for (const o of outs) expect(o).toEqual(modelWith("shared"));
	});

	it("renders locally at once, without locking or waiting, while the oversize flag is up", async () => {
		await fakeRedis.set(sharedViewOversizeKey(MARKET_ID), "1", { px: 60_000 });
		fakeRedis.calls = [];
		const render = vi.fn(async () => modelWith("local"));
		const start = clock.now;
		const out = await coalesceDebateView({ market, render, sleep, now });
		expect(out).toEqual(modelWith("local"));
		expect(render).toHaveBeenCalledTimes(1);
		expect(clock.now).toBe(start);
		expect(fakeRedis.calls.some((c) => c[0] === "set")).toBe(false);
	});

	it("fails open when Redis is unreachable: renders locally, never throws", async () => {
		fakeRedis.failReads = true;
		const render = vi.fn(async () => modelWith("local"));
		await expect(
			coalesceDebateView({ market, render, sleep, now }),
		).resolves.toEqual(modelWith("local"));
		expect(render).toHaveBeenCalledTimes(1);
	});

	it("fails open when the key cannot even be computed (bad ZUGZWANG_ENV)", async () => {
		process.env.ZUGZWANG_ENV = "nonsense";
		const render = vi.fn(async () => modelWith("local"));
		await expect(
			coalesceDebateView({ market, render, sleep, now }),
		).resolves.toEqual(modelWith("local"));
	});

	it("still returns the render when the entry write fails", async () => {
		const render = vi.fn(async () => modelWith("r"));
		const original = fakeRedis.set.bind(fakeRedis);
		fakeRedis.set = (async (key: string, value: string, opts?: unknown) => {
			if (key === sharedViewKey(MARKET_ID)) throw new Error("write failed");
			return original(key, value, opts as never);
		}) as typeof fakeRedis.set;
		await expect(
			coalesceDebateView({ market, render, sleep, now }),
		).resolves.toEqual(modelWith("r"));
		fakeRedis.set = original;
	});
});
