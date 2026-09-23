import { beforeEach, describe, expect, it, vi } from "vitest";

// CACHE-COALESCE-3 — the version poll's token comes from the fleet-wide store.
//
// R-18 measured 1,000 `/m/[slug]/version` 500s in thirteen seconds, every one
// `(EMAXCONN) max client connections reached, limit: 200` from the pooler:
// the route opened a Postgres connection on every edge miss, and its own
// Vercel function's instances took pooler slots from the page. This module
// makes a version poll touch Postgres only when it is the one caller
// fleet-wide re-deriving a market's token for the window.
//
// Redis is a faithful in-memory fake; the database is two injected functions,
// so every case counts exactly how often the database would have been asked.

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
		down: false,
		reset() {
			store.clear();
			this.down = false;
		},
		async get(key: string) {
			if (this.down) throw new Error("upstash down");
			return live(key)?.value ?? null;
		},
		async mget(...keys: string[]) {
			if (this.down) throw new Error("upstash down");
			return keys.map((k) => live(k)?.value ?? null);
		},
		async set(
			key: string,
			value: string,
			opts?: { nx?: boolean; px?: number },
		): Promise<"OK" | null> {
			if (this.down) throw new Error("upstash down");
			if (opts?.nx && live(key)) return null;
			store.set(key, {
				value,
				expiresAt: opts?.px ? clock.now + opts.px : null,
			});
			return "OK";
		},
		async del(key: string) {
			return store.delete(key) ? 1 : 0;
		},
		async eval(_s: string, keys: string[], a: string[]) {
			const k = keys[0] as string;
			if (live(k)?.value === a[0]) return store.delete(k) ? 1 : 0;
			return 0;
		},
		keys() {
			return [...store.keys()].filter((k) => live(k) !== null);
		},
	};
	return { fakeRedis, clock };
});

vi.mock("@/server/upstash/redis", () => ({ redis: fakeRedis }));
vi.mock("@/server/observability/cache-metrics", () => ({
	recordCacheAttempt: vi.fn(),
	recordCacheMiss: vi.fn(),
}));
vi.mock("@/server/observability/safe-capture", () => ({
	safeCaptureException: vi.fn(),
}));
vi.mock("@/db", () => ({ db: {} }));

import { VERSION_MIN_WINDOW_MS } from "@/server/config/limits";
import {
	getVersionToken,
	hashVersion,
	type VersionInputs,
} from "@/server/markets/version-token";

const MARKET_ID = "01a0a0ba-c700-77bf-8395-7f6bd429e53f";
const SLUG = "bitcoin-price-50k";

/** The route's pre-patch hash, verbatim: the token must keep meaning the same thing. */
function legacyHash(input: string): string {
	let hash = 0x811c9dc5;
	for (let i = 0; i < input.length; i++) {
		hash ^= input.charCodeAt(i);
		hash = Math.imul(hash, 0x01000193) >>> 0;
	}
	return hash.toString(36);
}

const sleep = async (ms: number) => {
	clock.now += ms;
};
const now = () => clock.now;
const opts = { now, sleep };

const OPEN: VersionInputs = {
	status: "Open",
	yes: "100.000000000000000000",
	no: "90.000000000000000000",
	moderations: "0",
};

function deps(inputs: VersionInputs | null = OPEN) {
	return {
		findMarketId: vi.fn(async (slug: string) =>
			slug === SLUG ? MARKET_ID : null,
		),
		readInputs: vi.fn(async (_id: string) => inputs),
	};
}

beforeEach(() => {
	fakeRedis.reset();
	clock.now = 1_700_000_000_000;
	process.env.ZUGZWANG_ENV = "staging";
});

describe("hashVersion", () => {
	it("is the pre-patch token for the same inputs", () => {
		expect(hashVersion(OPEN)).toBe(
			legacyHash("Open:100.000000000000000000:90.000000000000000000:0"),
		);
	});

	it("keeps the pre-patch defaults for a market with no pool row", () => {
		expect(
			hashVersion({ status: "Open", yes: null, no: null, moderations: null }),
		).toBe(legacyHash("Open:0:0:0"));
	});

	it("moves on each input the poll exists to notice", () => {
		const base = hashVersion(OPEN);
		expect(hashVersion({ ...OPEN, status: "Closed" })).not.toBe(base);
		expect(hashVersion({ ...OPEN, yes: "99.0" })).not.toBe(base);
		expect(hashVersion({ ...OPEN, moderations: "1" })).not.toBe(base);
	});
});

describe("getVersionToken", () => {
	it("answers the token and asks the database once per window", async () => {
		const d = deps();
		expect(await getVersionToken(SLUG, d, opts)).toEqual({
			kind: "token",
			token: hashVersion(OPEN),
		});
		await getVersionToken(SLUG, d, opts);
		await getVersionToken(SLUG, d, opts);
		expect(d.findMarketId).toHaveBeenCalledTimes(1);
		expect(d.readInputs).toHaveBeenCalledTimes(1);
	});

	it("re-derives after the window, but resolves the slug only once", async () => {
		const d = deps();
		await getVersionToken(SLUG, d, opts);
		clock.now += VERSION_MIN_WINDOW_MS + 1;
		await getVersionToken(SLUG, d, opts);
		expect(d.readInputs).toHaveBeenCalledTimes(2);
		expect(d.findMarketId).toHaveBeenCalledTimes(1);
	});

	it("a change in the inputs reaches the token on the next window", async () => {
		const d = deps();
		const first = await getVersionToken(SLUG, d, opts);
		d.readInputs.mockResolvedValue({ ...OPEN, moderations: "1" });
		clock.now += VERSION_MIN_WINDOW_MS + 1;
		expect(await getVersionToken(SLUG, d, opts)).not.toEqual(first);
	});

	it("once any token exists, 20 concurrent callers past the window cost one database read", async () => {
		const d = deps();
		await getVersionToken(SLUG, d, opts);
		clock.now += VERSION_MIN_WINDOW_MS + 1;
		d.readInputs.mockImplementation(async () => {
			await sleep(50);
			return OPEN;
		});
		const outs = await Promise.all(
			Array.from({ length: 20 }, () => getVersionToken(SLUG, d, opts)),
		);
		// One re-derivation; every other caller is served the entry already there.
		expect(d.readInputs).toHaveBeenCalledTimes(2);
		expect(d.findMarketId).toHaveBeenCalledTimes(1);
		for (const o of outs) {
			expect(o).toEqual({ kind: "token", token: hashVersion(OPEN) });
		}
	});

	it("an unknown slug answers at once: no wait on a holder that can never write (Gate C H-1)", async () => {
		const d = deps();
		d.findMarketId.mockImplementation(async () => {
			await sleep(50);
			return null;
		});
		const start = clock.now;
		const outs = await Promise.all(
			Array.from({ length: 10 }, () =>
				getVersionToken("no-such-market", d, opts),
			),
		);
		for (const o of outs) expect(o).toEqual({ kind: "not-found" });
		// Ten 50 ms lookups run concurrently on a shared fake clock; a waiter
		// would add SHARED_VIEW_WAIT_MS (2,000 ms) on top.
		expect(clock.now - start).toBeLessThan(1000);
	});

	it("a database outage answers at once too, rather than after a 2 s wait per block", async () => {
		const d = deps();
		d.readInputs.mockImplementation(async () => {
			await sleep(50);
			throw new Error("EMAXCONN");
		});
		const start = clock.now;
		const outs = await Promise.all(
			Array.from({ length: 10 }, () => getVersionToken(SLUG, d, opts)),
		);
		for (const o of outs) expect(o.kind).toBe("unavailable");
		expect(clock.now - start).toBeLessThan(1000);
	});

	it("an unknown slug is not-found and writes nothing, so a request cannot mint entries", async () => {
		const d = deps();
		expect(await getVersionToken("no-such-market", d, opts)).toEqual({
			kind: "not-found",
		});
		expect(fakeRedis.keys().filter((k) => !k.includes(":lock:"))).toEqual([]);
	});

	it("a DB error with an earlier token serves that token (fail open)", async () => {
		const d = deps();
		const first = await getVersionToken(SLUG, d, opts);
		clock.now += VERSION_MIN_WINDOW_MS + 1;
		d.readInputs.mockRejectedValue(new Error("EMAXCONN"));
		expect(await getVersionToken(SLUG, d, opts)).toEqual({
			kind: "unavailable",
			lastToken: first.kind === "token" ? first.token : "",
		});
	});

	it("a DB error with no earlier token is unavailable with nothing to serve", async () => {
		const d = deps();
		d.readInputs.mockRejectedValue(new Error("EMAXCONN"));
		expect(await getVersionToken(SLUG, d, opts)).toEqual({
			kind: "unavailable",
			lastToken: null,
		});
	});

	it("a DB error on the slug lookup itself is unavailable, not not-found", async () => {
		const d = deps();
		d.findMarketId.mockRejectedValue(new Error("EMAXCONN"));
		expect(await getVersionToken(SLUG, d, opts)).toEqual({
			kind: "unavailable",
			lastToken: null,
		});
	});

	it("Redis down: the token is derived directly, exactly as before the patch", async () => {
		fakeRedis.down = true;
		const d = deps();
		expect(await getVersionToken(SLUG, d, opts)).toEqual({
			kind: "token",
			token: hashVersion(OPEN),
		});
	});
});
