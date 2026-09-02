import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

// CHART-1 — the cache boundary under the price chart's HISTORY (SPEC.1 1.0.45
// §9 *Refresh — floored history, live edge*; ADR-0034 D-1).
//
// ⛔ WHY THIS IS A SOURCE SCAN AND NOT A BEHAVIOURAL TEST, STATED PLAINLY —
// AND THE FIRST DRAFT OF THIS PARAGRAPH UNDERSTATED IT. It said `'use cache'`
// "caches nothing" under a bare `vitest run`. MEASURED, at the CHART-1 audit:
// calling `getCachedReserveWalk()` outside the Next.js server runtime does not
// return an uncached value — it THROWS,
//
//     `cacheLife()` is only available with the `cacheComponents` config.
//
// which is a stronger constraint and changes what is even conceivable here. The
// function body never executes, so it has ZERO runtime coverage anywhere in this
// repo; a spy over the derivation would observe the throw rather than a hit; and
// stubbing `next/cache` to get past it yields a cache that caches nothing, whose
// only honest assertion would be "two calls, two derivations" — the exact
// inverse of the property. This repo has no Playwright (AGENTS.md §9), so there
// is no honest way here to observe a hit, a miss, or a window boundary. Both sibling
// budget suites say the same about their own cached blocks and take the same
// route. What CAN be proven from source is the property that actually matters
// and that a behavioural test would NOT have caught anyway: that nothing
// viewer-scoped can reach the key or the value.
//
// ⚠ SO READ THE COVERAGE HONESTLY. This file does not prove the window
// coalesces. It proves the boundary is shaped so that IF it coalesces, it
// cannot leak. Those are different claims and only the second one is testable
// here.
//
// SPEC.1 §17 row proved here:
//   debate-view::price-chart-series-memo-holds-no-viewer-state

const ROOT = process.cwd();
const MODULE = "src/server/discovery/cached-series.ts";

function read(relative: string): string {
	return readFileSync(join(ROOT, relative), "utf8");
}

/** Source with comments removed — the `poll-contract.test.ts` convention.
 *
 * ⛔ LOAD-BEARING, NOT TIDINESS. The negatives below ban the words `session`,
 * `cookies`, `headers` and `userId` from this module. Its docblock NAMES every
 * one of them to explain why none is reachable — which is precisely the
 * documentation a reviewer wants written. A guard that reddens on its own
 * explanation gets suppressed, so it is applied to what the compiler sees. */
function code(relative: string): string {
	return read(relative)
		.replace(/\/\*[\s\S]*?\*\//g, "")
		.replace(/^\s*\/\/.*$/gm, "")
		.replace(/\/\/[^"'`\n]*$/gm, "");
}

describe("debate-view::price-chart-series-memo-holds-no-viewer-state", () => {
	it("takes exactly one parameter, and it is a market id", () => {
		// The strongest form of the guarantee, and the reason this function is a
		// SIBLING of the two cached blocks rather than a line inside one of them.
		// `getCachedDebateView` takes a whole `market` object and
		// `getCachedMarketDiscoveryData` takes `reserves`; each has to argue that
		// what it is handed carries nothing viewer-scoped. This one cannot be
		// handed anything else — there is no parameter to smuggle a session
		// through, so the property holds by construction and not by review.
		const signature =
			code(MODULE).match(
				/export async function getCachedReserveWalk\([\s\S]*?\)\s*:\s*Promise<WireReservePoint\[\]>/,
			)?.[0] ?? "";
		expect(signature).not.toBe("");
		expect(signature).toMatch(/\(\s*marketId:\s*string,?\s*\)/);
	});

	it("reads no viewer-scoped source anywhere in the module", () => {
		const source = code(MODULE);
		for (const banned of [
			"cookies",
			"headers",
			"getSession",
			"auth.api",
			"userId",
			"user_id",
			"loadViewerMarketContext",
			"getRequestSession",
		]) {
			expect(source).not.toContain(banned);
		}

		// POSITIVE CONTROL — the scan must be able to FIND something. A `not
		// .toContain` sweep over an empty or mis-read string passes perfectly
		// while proving nothing, so assert that the same text still contains the
		// declarations this module is actually made of.
		expect(source).toContain("getCachedReserveWalk");
		expect(source).toContain("cacheTag");

		// POSITIVE CONTROL — the ban must be able to FIRE, proven against a file
		// that really does read a viewer-scoped source rather than against a string
		// this test just concatenated. ⚠ The first draft did the latter — it
		// appended `await cookies()` to `source` and asserted the result contained
		// "cookies", which is a tautology over the test's own edit and proves
		// nothing about the scan. Caught at the CHART-1 audit. `viewer-context.ts`
		// is viewer-scoped BY DESIGN, so the same `code()` pipeline finding a
		// banned token there is what makes the sweep above meaningful.
		const viewerScoped = code("src/server/debate-view/viewer-context.ts");
		expect(viewerScoped).toMatch(/userId|user_id/);
	});

	it("keys the cache on the market id alone — never on reserves", () => {
		// ⛔ THE POINT OF THE WHOLE MECHANISM. A `'use cache'` key is the
		// serialized argument list. The two blocks that wrap these surfaces key on
		// `reserves`, which every bet moves — so every bet forces every reader to
		// re-derive. Keying on identity is what lets the window coalesce fifty
		// bets into one derivation. If `reserves` ever appears in this signature,
		// the window silently stops working while every other test stays green.
		const source = code(MODULE);
		expect(source).not.toMatch(/getCachedReserveWalk\([^)]*reserves/);
		expect(source).not.toContain("getMarketPricingAndReserves");
	});

	it("binds its window to the constant rather than a literal", () => {
		// SPEC.1 §16.1 requires `MARKET_SERIES_MIN_WINDOW_MS` be read from the
		// constant at every call site so the HARDEN.6 tune stays a one-line
		// change. A hard-coded `60` here would satisfy every behavioural check and
		// silently decouple the code from the spec's pinned value.
		const source = code(MODULE);
		expect(source).toContain("MARKET_SERIES_MIN_WINDOW_MS");
		expect(source).toContain('"use cache"');
		expect(source).toMatch(/cacheLife\(/);
		expect(source).toMatch(/cacheTag\(/);
		// No bare seconds literal standing in for the window.
		expect(source).not.toMatch(/cacheLife\(\s*\{[^}]*:\s*60\s*[,}]/);
	});

	it("reads no clock — the live edge is composed outside this boundary", () => {
		// ⚠ THE SUBTLEST WAY THIS COULD GO WRONG. A `Date.now()` inside a cached
		// function is evaluated once, at derivation, and then served for the whole
		// window — so an `Open` market's "now" edge would sit up to
		// `MARKET_SERIES_MIN_WINDOW_MS` in the past, and nothing would look
		// broken. The domain's live end and the terminal's live price are both
		// `withLiveTail`'s job, at the two pages that already read the pool live.
		const source = code(MODULE);
		expect(source).not.toContain("Date.now");
		expect(source).not.toContain("new Date");
		expect(source).not.toContain("withLiveTail");
	});

	it("the bet path fires no invalidation that would defeat the window", () => {
		// ⚠ AN ASSERTION ABOUT SOMEBODY ELSE'S FILE, ON PURPOSE. The window
		// coalesces only because placing or selling a bet busts nothing. If a
		// future change adds a `revalidateTag`/`updateTag` to the bet path, this
		// series reverts to per-bet recomputation — the chart stays CORRECT, so no
		// behavioural test anywhere would notice, and the entire cost argument for
		// CHART-1 would be gone silently. This is the tripwire for that.
		for (const file of [
			"src/server/bets/place.ts",
			"src/server/bets/sell.ts",
		]) {
			const source = code(file);
			expect(source).not.toContain("revalidateTag");
			expect(source).not.toContain("updateTag");
		}

		// POSITIVE CONTROL — the pattern finds real invalidation elsewhere, so a
		// clean sweep above means "absent", not "my regex is wrong".
		expect(code("src/server/markets/open.ts")).toContain("revalidateTag");
	});
});

// ── CHART-1 AUDIT — the boundary is only a mechanism if somebody stands on it ─
//
// ⛔ WHY THIS BLOCK EXISTS, AND WHAT IT CLOSES. Every assertion above this line
// reads ONE file — `cached-series.ts` — plus the two bet handlers. So the whole
// suite above passes, byte for byte, on a repo where NOTHING CALLS
// `getCachedReserveWalk` at all. Reverting `getCachedMarketDiscoveryData` to
// `loadPriceSeries(db, marketId)`, or dropping the `walk` argument in
// `getCachedDebateView`, leaves the chart rendering CORRECTLY — the derivation
// is deterministic and the live tail is composed elsewhere — while the window
// silently stops coalescing. That is guard 7's own named failure mode ("the
// window silently stops working while every other test stays green"), and
// neither round-trip budget suite catches it either: both REPLICATE the read
// composition inline against a counting client rather than invoking the real
// cached callers, so both keep measuring the number they were written to
// measure however the call sites drift.
//
// ⚠ THIS IS STILL NOT A WINDOW TEST, AND NO WINDOW TEST IS REACHABLE HERE.
// `getCachedReserveWalk` cannot even be INVOKED under a bare `vitest run`:
// `cacheLife()` throws "`cacheLife()` is only available with the
// `cacheComponents` config" (measured 2026-08-27). So the directive is not
// merely inert — the function body never executes in this harness, a spy over
// the derivation would observe the throw rather than a hit, and stubbing
// `next/cache` to get past it would produce a cache that caches nothing, whose
// only honest assertion is "two calls, two derivations" — the exact inverse of
// the property. What IS reachable is proving the walk is on the path at all.
//
// SPEC.1 §17 row proved here:
//   debate-view::price-chart-history-floored-to-min-window (the wiring half)

/** The `export async function NAME(...) { … }` body, brace-matched — the
 * `round-trip-budget.test.ts` helper, run over COMMENT-STRIPPED source so a
 * brace inside a docblock cannot unbalance the match and so a prose mention of
 * a banned call is not read as the call. */
function functionBlock(source: string, name: string): string {
	const sigStart = source.indexOf(`export async function ${name}(`);
	if (sigStart === -1) {
		throw new Error(`function ${name} not found — this guard is stale`);
	}
	const bodyStart = source.indexOf("{", source.indexOf(")", sigStart));
	let depth = 0;
	for (let i = bodyStart; i < source.length; i++) {
		if (source[i] === "{") {
			depth++;
		} else if (source[i] === "}") {
			depth--;
			if (depth === 0) {
				return source.slice(bodyStart, i + 1);
			}
		}
	}
	throw new Error(`unbalanced braces reading ${name}`);
}

describe("debate-view::price-chart-history-floored-to-min-window — the cached walk is the path both surfaces take", () => {
	it("Discovery's cached block derives its series from the cached walk, never a bare replay", () => {
		const block = functionBlock(
			code("src/server/discovery/list.ts"),
			"getCachedMarketDiscoveryData",
		);

		// The requirement.
		expect(block).toContain("getCachedReserveWalk(marketId)");
		// …and the two ways back to per-bet recomputation, both of which render
		// an identical chart and would go unnoticed by every other suite.
		expect(block).not.toContain("loadPriceSeries(");
		expect(block).not.toContain("replayReserveSeries(");

		// POSITIVE CONTROL — the bans must be able to FIRE against this exact
		// text, not against a hand-built string. Reinstate the pre-CHART-1 call
		// in the block that was measured above and require each ban to catch it.
		const reverted = block.replace(
			/mapWalkToSeries\([\s\S]*?\);/,
			"await loadPriceSeries(db, marketId);",
		);
		expect(reverted).not.toBe(block);
		expect(reverted).toContain("loadPriceSeries(");
		expect(reverted).not.toContain("getCachedReserveWalk(marketId)");
	});

	it("/m/[slug]'s cached block resolves the walk and hands it to loadDebateView", () => {
		const block = functionBlock(
			code("src/server/debate-view/cached-view.ts"),
			"getCachedDebateView",
		);

		// The walk is resolved from the market-id-keyed cache…
		expect(block).toMatch(
			/const walk = await getCachedReserveWalk\(\s*market\.id\s*\)/,
		);
		// …and actually THREADED. `loadDebateView`'s `walk` is optional and
		// defaults to its own three-statement replay, so dropping the argument is
		// a silent revert: same chart, same 12 statements, no cache seam, and
		// `poll-contract.test.ts`'s signature assertion still green because the
		// PARAMETER would still be declared.
		expect(block).toMatch(/loadDebateView\(db,\s*\{\s*market,\s*walk\s*\}\)/);

		// POSITIVE CONTROL — drop the argument and the requirement fails.
		const dropped = block.replace("{ market, walk }", "{ market }");
		expect(dropped).not.toBe(block);
		expect(dropped).not.toMatch(
			/loadDebateView\(db,\s*\{\s*market,\s*walk\s*\}\)/,
		);
	});

	it("the .md export route reaches NEITHER cache (ADR-0025, plan §3.4)", () => {
		// Plan §3.4: the export "is not touched and passes nothing". ADR-0025
		// forbids a cache on the export because a cache is a window in which
		// just-removed content keeps serving — and that argument does not care
		// which cache. `cached-view-contract.test.ts` bans the debate wrapper
		// here; CHART-1 minted a second boundary the same ban has to cover.
		const src = code("src/app/(public)/m/[slug]/export/route.ts");
		expect(src).not.toContain("getCachedReserveWalk");
		expect(src).not.toContain("getCachedDebateView");
		// POSITIVE CONTROL — the route really does reach the uncached loader, so
		// the two absences above mean "absent", not "wrong file".
		expect(src).toContain("loadDebateView(db, { market })");
	});
});
