import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

// CACHE-COALESCE-2 — the two Discovery blocks are wired through the
// fleet-wide single-flight, and the wiring is what these scans pin.
//
// Why a source scan and not a call: both call sites are `'use cache'`
// functions, whose cache semantics exist only inside the Next runtime; a
// vitest call would exercise a plain function and prove nothing about the
// segment. The MECHANISM is proven behaviourally in
// `tests/server/cache/shared-block-store.test.ts`; what a unit test cannot
// reach is whether the expensive derivation sits INSIDE the render callback
// (one per fleet-window) or beside it (one per instance-window, the R-16
// state). That is a fact about the source, so it is read from the source —
// with the comments stripped, because a docblock naming the function is
// exactly what a scan of the wrong text would match.

const ROOT = join(__dirname, "..", "..", "..");
const readRaw = (rel: string) => readFileSync(join(ROOT, rel), "utf8");
function codeOnly(source: string): string {
	return source
		.replace(/\/\*[\s\S]*?\*\//g, "")
		.replace(/^\s*\/\/.*$/gm, "")
		.replace(/([^:])\/\/.*$/gm, "$1");
}
const read = (rel: string) => codeOnly(readRaw(rel));

/** The body of the named async function (exported or not), brace-balanced. */
function bodyOf(source: string, fnName: string): string {
	const at = source.indexOf(`async function ${fnName}(`);
	expect(at, `${fnName} not found`).toBeGreaterThanOrEqual(0);
	const open = source.indexOf("{", source.indexOf(")", at));
	let depth = 0;
	for (let i = open; i < source.length; i += 1) {
		if (source[i] === "{") depth += 1;
		else if (source[i] === "}") {
			depth -= 1;
			if (depth === 0) return source.slice(open, i + 1);
		}
	}
	throw new Error(`unbalanced body for ${fnName}`);
}

/**
 * The render callback passed to the coalescer: from `render:` through the
 * arrow, then either the balanced `{ … }` block or the bare expression up to
 * the first `,` / `}` at depth 0. The arrow's own `()` is skipped so a
 * parameter list is never mistaken for the body.
 */
function renderCallbackOf(body: string): string {
	const at = body.indexOf("render:");
	expect(at, "no render: callback").toBeGreaterThanOrEqual(0);
	const arrow = body.indexOf("=>", at);
	expect(arrow, "render: is not an arrow function").toBeGreaterThan(at);
	let i = arrow + 2;
	while (i < body.length && /\s/.test(body[i] as string)) i += 1;
	const isBlock = body[i] === "{";
	let depth = 0;
	for (; i < body.length; i += 1) {
		const ch = body[i];
		if (ch === "{" || ch === "(") depth += 1;
		else if (ch === "}" || ch === ")") {
			if (depth === 0) return body.slice(at, i);
			depth -= 1;
			if (depth === 0 && isBlock) return body.slice(at, i + 1);
		} else if (ch === "," && depth === 0) {
			return body.slice(at, i);
		}
	}
	return body.slice(at);
}

const SERIES = "src/server/discovery/cached-series.ts";
const LIST = "src/server/discovery/list.ts";
const ACT = "src/server/admin/moderation/act.ts";
const BLOCK_STORE = "src/server/cache/shared-block-store.ts";

describe("the comment stripper", () => {
	it("removes comments and keeps code (positive control)", () => {
		const s = codeOnly(
			"// coalesceSharedBlock\n/* coalesceSharedBlock */\nconst x = coalesceSharedBlock(a); // coalesceSharedBlock\n",
		);
		expect(s.match(/coalesceSharedBlock/g)).toHaveLength(1);
	});
});

describe("getCachedReserveWalk — the price walk is a fleet-wide single-flight", () => {
	const body = bodyOf(read(SERIES), "getCachedReserveWalk");

	it("coalesces under the reserve-walk block with the series window", () => {
		expect(body).toContain("coalesceSharedBlock");
		expect(body).toContain('block: "reserve-walk"');
		expect(body).toContain("windowMs: MARKET_SERIES_MIN_WINDOW_MS");
	});

	it("replays events ONLY inside the render callback", () => {
		const cb = renderCallbackOf(body);
		expect(cb).toContain("replayReserveSeries(");
		const outside = body.replace(cb, "");
		expect(outside).not.toContain("replayReserveSeries(");
	});

	it("the derivation counter moves with the replay, so it still means 'DB paid'", () => {
		const cb = renderCallbackOf(body);
		expect(cb).toContain("recordReserveWalkDerivation(");
		expect(body.replace(cb, "")).not.toContain("recordReserveWalkDerivation(");
	});

	it("keeps 'use cache' as the per-instance L1 in front", () => {
		expect(body).toContain('"use cache"');
		expect(body).toMatch(/cacheLife\(/);
		expect(body).toMatch(/cacheTag\(`market:\$\{marketId\}`\)/);
	});
});

describe("getCachedMarketDiscoveryData — the market block is a fleet-wide single-flight", () => {
	const body = bodyOf(read(LIST), "getCachedMarketDiscoveryData");

	it("coalesces under the market-data block with the shared-view window", () => {
		expect(body).toContain("coalesceSharedBlock");
		expect(body).toContain('block: "market-data"');
		expect(body).toContain("windowMs: SHARED_VIEW_MIN_WINDOW_MS");
	});

	it("every database read sits behind the render callback, none beside it", () => {
		const cb = renderCallbackOf(body);
		expect(cb).toContain("deriveMarketDiscoveryData(marketId)");
		const derive = bodyOf(read(LIST), "deriveMarketDiscoveryData");
		for (const call of [
			"getMarketTotals(",
			"getDefaultMarketMediaUrl(",
			"selectHeroTopPosts(",
			"getCachedReserveWalk(",
		]) {
			expect(derive, call).toContain(call);
			expect(body, `${call} in the cached body`).not.toContain(call);
		}
		// The derivation is reachable from the cached function only — a second
		// caller would be a second per-instance path around the single-flight.
		const list = read(LIST);
		expect(list.split("deriveMarketDiscoveryData(").length - 1).toBe(2);
		expect(list).not.toMatch(
			/export\s+async\s+function\s+deriveMarketDiscoveryData/,
		);
	});

	it("still never reads reserves (the CACHE-KEY-1 property survives the wrap)", () => {
		expect(body).not.toContain("getMarketPricingAndReserves");
		expect(body).not.toContain("reserves");
	});
});

describe("SC-1 — removal reaches the market block, which carries hero text", () => {
	it("moderateComment's remove marks every text-carrying block, and the list is debate-view + market-data", () => {
		const act = read(ACT);
		const store = read(BLOCK_STORE);
		expect(act).toContain("markMarketTextRemoved(comment.marketId)");
		// The list the fan-out iterates, read out of the store's source.
		const at = store.indexOf("TEXT_CARRYING_BLOCKS");
		expect(at).toBeGreaterThanOrEqual(0);
		const list = store.slice(at, store.indexOf("];", at));
		expect(list).toContain('"debate-view"');
		expect(list).toContain('"market-data"');
		// And NOT the walk: a reserve series holds no body to mask.
		expect(list).not.toContain('"reserve-walk"');
	});

	it("the removal is stamped BEFORE the L1 tag fires", () => {
		const act = read(ACT);
		const mark = act.indexOf("markMarketTextRemoved(comment.marketId)");
		const tag = act.indexOf("updateTag(`market:${comment.marketId}`)");
		expect(mark).toBeGreaterThanOrEqual(0);
		expect(tag).toBeGreaterThan(mark);
	});
});

describe("the L2 is invisible to Next's tags — so every market-tag fire is inventoried", () => {
	/**
	 * `updateTag` / `revalidateTag` bust the per-instance L1 only; the shared
	 * entries under it are cleared by `markMarketTextRemoved`, and by nothing
	 * else. A new site that fired `market:<id>` without also marking the
	 * blocks would refill L1 from a stale L2 — silently. This pins the set of
	 * files that fire or declare the tag, so a fifth one is a decision.
	 */
	it("exactly these files carry a `market:` tag, and the one that FIRES it also marks the store", () => {
		// A filesystem walk rather than `git grep`: the shell that `execSync`
		// picks differs by platform, and a quoting difference would turn this
		// into a silent empty inventory (O-13).
		const TAG = /(cacheTag|updateTag|revalidateTag)\(`market:/;
		const files: string[] = [];
		const walk = (dir: string) => {
			for (const e of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
				const rel = `${dir}/${e.name}`;
				if (e.isDirectory()) walk(rel);
				else if (/\.tsx?$/.test(e.name) && TAG.test(readRaw(rel))) {
					files.push(rel);
				}
			}
		};
		walk("src");
		files.sort();
		expect(files).toEqual(
			[
				"src/server/admin/moderation/act.ts",
				"src/server/debate-view/cached-view.ts",
				"src/server/discovery/cached-series.ts",
				"src/server/discovery/list.ts",
			].sort(),
		);
		for (const f of files) {
			const src = read(f);
			const fires = /(updateTag|revalidateTag)\(`market:/.test(src);
			if (fires) expect(src, f).toContain("markMarketTextRemoved(");
		}
	});
});
