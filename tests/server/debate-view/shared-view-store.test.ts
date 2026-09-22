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
// Redis is a faithful in-memory fake (SET NX/PX, GET, DEL, expiry by an
// injected clock); the lock semantics under test are real, the transport is
// not. Time and sleeping are injected so every case is deterministic.

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
		peek(key: string) {
			return live(key)?.value ?? null;
		},
	};
	return { fakeRedis, clock };
});

vi.mock("@/server/upstash/redis", () => ({ redis: fakeRedis }));

import {
	SHARED_VIEW_EXPIRE_SEC,
	SHARED_VIEW_LOCK_MS,
	SHARED_VIEW_MIN_WINDOW_MS,
	SHARED_VIEW_WAIT_MS,
} from "@/server/config/limits";
import type { DebateViewModel } from "@/server/debate-view/load-debate-view";
import {
	coalesceDebateView,
	deleteSharedView,
	readSharedView,
	sharedViewKey,
	sharedViewLockKey,
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

beforeEach(() => {
	fakeRedis.reset();
	clock.now = 1_700_000_000_000;
	process.env.ZUGZWANG_ENV = "staging";
});

describe("keys", () => {
	it("are env-prefixed and disjoint for entry and lock", () => {
		expect(sharedViewKey(MARKET_ID)).toBe(
			`staging:cache:debate-view:${MARKET_ID}`,
		);
		expect(sharedViewLockKey(MARKET_ID)).toBe(
			`staging:cache:debate-view:lock:${MARKET_ID}`,
		);
	});
});

describe("write / read / delete", () => {
	it("round-trips an entry with a TTL of SHARED_VIEW_EXPIRE_SEC", async () => {
		await writeSharedView(MARKET_ID, {
			model: modelWith("a"),
			renderedAt: clock.now,
			status: "Open",
		});
		const setCall = fakeRedis.calls.find((c) => c[0] === "set");
		expect(setCall?.[2]).toEqual({ px: SHARED_VIEW_EXPIRE_SEC * 1000 });
		const entry = await readSharedView(MARKET_ID);
		expect(entry?.renderedAt).toBe(clock.now);
		expect(entry?.status).toBe("Open");
		expect(entry?.model).toEqual(modelWith("a"));
	});

	it("returns null for a missing, expired or corrupt entry", async () => {
		expect(await readSharedView(MARKET_ID)).toBeNull();
		await writeSharedView(MARKET_ID, {
			model: modelWith("a"),
			renderedAt: clock.now,
			status: "Open",
		});
		clock.now += SHARED_VIEW_EXPIRE_SEC * 1000 + 1;
		expect(await readSharedView(MARKET_ID)).toBeNull();
		await fakeRedis.set(sharedViewKey(MARKET_ID), "{not json");
		expect(await readSharedView(MARKET_ID)).toBeNull();
	});

	// SC-1 — masking is a property of every body read. After a removal the
	// shared entry must not be able to serve the body: assert the BODY's
	// absence from what any reader can now get, not merely a row's.
	it("delete makes a removed body unreachable through the store", async () => {
		await writeSharedView(MARKET_ID, {
			model: modelWith("removed-me"),
			renderedAt: clock.now,
			status: "Open",
		});
		expect(JSON.stringify(await readSharedView(MARKET_ID))).toContain(
			"body removed-me",
		);
		await deleteSharedView(MARKET_ID);
		expect(JSON.stringify(await readSharedView(MARKET_ID))).not.toContain(
			"body removed-me",
		);
		expect(fakeRedis.peek(sharedViewKey(MARKET_ID))).toBeNull();
	});
});

describe("coalesceDebateView", () => {
	it("serves a fresh entry without rendering or locking", async () => {
		await writeSharedView(MARKET_ID, {
			model: modelWith("fresh"),
			renderedAt: clock.now - SHARED_VIEW_MIN_WINDOW_MS + 1000,
			status: "Open",
		});
		fakeRedis.calls = []; // the setup write above is not under test
		const render = vi.fn(async () => modelWith("new"));
		const out = await coalesceDebateView({ market, render, sleep, now });
		expect(out).toEqual(modelWith("fresh"));
		expect(render).not.toHaveBeenCalled();
		expect(fakeRedis.calls.some((c) => c[0] === "set")).toBe(false);
	});

	it("renders once and rewrites the entry when the window has passed and the lock is free", async () => {
		await writeSharedView(MARKET_ID, {
			model: modelWith("old"),
			renderedAt: clock.now - SHARED_VIEW_MIN_WINDOW_MS - 1,
			status: "Open",
		});
		const render = vi.fn(async () => modelWith("new"));
		const out = await coalesceDebateView({ market, render, sleep, now });
		expect(out).toEqual(modelWith("new"));
		expect(render).toHaveBeenCalledTimes(1);
		const entry = await readSharedView(MARKET_ID);
		expect(entry?.model).toEqual(modelWith("new"));
		expect(entry?.renderedAt).toBe(clock.now);
		// The lock was taken with NX + PX and released after the write.
		const lockSet = fakeRedis.calls.find(
			(c) => c[0] === "set" && c[1] === sharedViewLockKey(MARKET_ID),
		);
		expect(lockSet?.[2]).toEqual({ nx: true, px: SHARED_VIEW_LOCK_MS });
		expect(fakeRedis.peek(sharedViewLockKey(MARKET_ID))).toBeNull();
	});

	it("serves the stale entry when another instance holds the lock", async () => {
		await writeSharedView(MARKET_ID, {
			model: modelWith("stale"),
			renderedAt: clock.now - SHARED_VIEW_MIN_WINDOW_MS - 1,
			status: "Open",
		});
		await fakeRedis.set(sharedViewLockKey(MARKET_ID), "other", {
			nx: true,
			px: SHARED_VIEW_LOCK_MS,
		});
		const render = vi.fn(async () => modelWith("new"));
		const out = await coalesceDebateView({ market, render, sleep, now });
		expect(out).toEqual(modelWith("stale"));
		expect(render).not.toHaveBeenCalled();
	});

	it("waits for the lock holder's entry when there is nothing to serve", async () => {
		await fakeRedis.set(sharedViewLockKey(MARKET_ID), "other", {
			nx: true,
			px: SHARED_VIEW_LOCK_MS,
		});
		const render = vi.fn(async () => modelWith("mine"));
		// The holder writes the entry 300 ms into our wait.
		let elapsed = 0;
		const sleepAndArrive = async (ms: number) => {
			await sleep(ms);
			elapsed += ms;
			if (elapsed >= 300 && (await readSharedView(MARKET_ID)) === null) {
				await writeSharedView(MARKET_ID, {
					model: modelWith("holder"),
					renderedAt: clock.now,
					status: "Open",
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

	it("treats an entry from another market status as stale", async () => {
		await writeSharedView(MARKET_ID, {
			model: modelWith("open"),
			renderedAt: clock.now,
			status: "Open",
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
		expect((await readSharedView(MARKET_ID))?.status).toBe("Closed");
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

	it("fails open when Redis is unreachable: renders locally, never throws", async () => {
		fakeRedis.failReads = true;
		const render = vi.fn(async () => modelWith("local"));
		await expect(
			coalesceDebateView({ market, render, sleep, now }),
		).resolves.toEqual(modelWith("local"));
		expect(render).toHaveBeenCalledTimes(1);
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
