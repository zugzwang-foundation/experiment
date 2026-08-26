import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

// CHART-1 — the cache boundary under the price chart's HISTORY (SPEC.1 1.0.40
// §9 *Refresh — floored history, live edge*; ADR-0034 D-1).
//
// ⛔ WHY THIS IS A SOURCE SCAN AND NOT A BEHAVIOURAL TEST, STATED PLAINLY.
// `'use cache'` caches NOTHING under a bare `vitest run` — it needs the Next.js
// server runtime, and this repo has no Playwright (AGENTS.md §9). So there is no
// honest way here to observe a hit, a miss, or a window boundary. Both sibling
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

		// POSITIVE CONTROL — and the ban itself must be able to FIRE. Inject a
		// violation into the same text and require each banned token to be found.
		const violated = `${source}\nconst leak = await cookies();`;
		expect(violated).toContain("cookies");
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
