import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

// CHART-1 AUDIT — the live right edge, at the two places it is actually
// composed (SPEC.1 1.0.40 §9 *X domain* / *Refresh — floored history, live
// edge*).
//
// ⛔ WHAT THIS CLOSES, AND WHY THE PURE-FUNCTION SUITE DOES NOT CLOSE IT.
// `tests/unit/discovery/live-tail.test.ts` interrogates `withLiveTail` with
// `spotYes`, `nowIso` and `isOpen` held still by the test. That proves the RULE.
// It cannot prove that either page HANDS IT THE RIGHT THREE THINGS, and every
// one of the three has a wrong answer that renders a plausible chart:
//
//   - `spotYes` fed from anything other than the live read that also fills the
//     price bar → the chart disagrees with the bar a few pixels beneath it,
//     which is the objection §9 raised against flooring the history at all and
//     the property `withLiveTail` exists to answer. Feeding it `pricing.no`
//     inverts the poles — a defect this repo has shipped on live participant
//     surfaces twice. Feeding it the series' own last point makes the pin a
//     no-op that still type-checks.
//   - `isOpen` hard-coded `true` on `/m/[slug]` → a Closed, Resolved or Voided
//     market's domain keeps advancing to "now" forever, drawing a flat line into
//     the future out of a market that has terminated (**INV-4**). `/m/[slug]` is
//     the ONLY call site where that branch is reachable, so nothing else in the
//     repository would notice.
//   - `nowIso` read anywhere behind a cache boundary → frozen at derivation
//     time and served for a whole window.
//
// Before this file, `spotYes`, `isOpen` and `nowIso` appeared in exactly one
// test file in the repository — the pure-function suite — and in no assertion
// about either page.
//
// Source scan, the repo's established shape for a boundary that cannot be
// exercised under `vitest` (`cached-view-contract.test.ts`, `poll-contract.test
// .ts`): these are RSC page bodies reached through `'use cache'` callers that
// throw outside the Next.js server runtime.
//
// SPEC.1 §17 rows proved here (the composition half of each):
//   debate-view::price-chart-domain-runs-to-now-when-open
//   debate-view::price-chart-domain-frozen-when-not-open   (INV-4)
//   debate-view::price-chart-tail-pinned-to-live-price

const ROOT = process.cwd();

/** Source with COMMENTS REMOVED — load-bearing, not tidiness, and for the same
 * reason `cached-view-contract.test.ts` spells out at length: both pages
 * document these exact hazards in prose ("`isOpen` is READ FROM
 * `market.status`, never assumed"), so a raw scan reads the explanation as the
 * violation. The `([^:])//` form is the one that survives a `://`. */
function code(relative: string): string {
	return readFileSync(join(ROOT, relative), "utf8")
		.replace(/\/\*[\s\S]*?\*\//g, "")
		.replace(/^\s*\/\/.*$/gm, "")
		.replace(/([^:])\/\/.*$/gm, "$1");
}

/** The argument text of the first `withLiveTail(` call, paren-matched. Returns
 * what is INSIDE the outer parens, so the object literal's own nesting is kept
 * and a second call elsewhere in the file cannot be confused for this one. */
function liveTailArgs(source: string): string {
	const open = source.indexOf("withLiveTail(");
	if (open === -1) {
		throw new Error("no withLiveTail( call — this guard is stale");
	}
	const start = open + "withLiveTail(".length;
	let depth = 1;
	for (let i = start; i < source.length; i++) {
		if ("([{".includes(source[i])) {
			depth++;
		} else if (")]}".includes(source[i])) {
			depth--;
			if (depth === 0) {
				return source.slice(start, i);
			}
		}
	}
	throw new Error("unbalanced parens reading withLiveTail(");
}

/** The `export async function NAME(...) { … }` body, brace-matched.
 *
 * ⛔ NOT A CONVENIENCE — a whole-file scan for the licence below PASSES FOR THE
 * WRONG REASON. `list.ts` carries `eq(markets.status, "Open")` TWICE (once in
 * `listOpenMarkets`, once in `getCachedDiscoveryMarketIds`), so a
 * `getCachedDiscoveryMarketIds[\s\S]*?eq(...)` pattern keeps matching the OTHER
 * one after the one under test has been widened. Measured: the first draft of
 * this file did exactly that and survived its own revert-to-red. Scope the read
 * to the function, or do not make the claim. */
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

const DISCOVERY = "src/app/(public)/page.tsx";
const DETAIL = "src/app/(public)/m/[slug]/page.tsx";
const LIST = "src/server/discovery/list.ts";

/** The one predicate both pages must satisfy, applied to the `withLiveTail`
 * argument text. Expressed as a function so the POSITIVE CONTROLS below can run
 * the very same check against a mutated copy of the very same text, rather than
 * against a string a test author invented. */
function spotIsTheLiveYesPrice(args: string): boolean {
	return /spotYes:\s*priced\??\.pricing\.yes(\s*\?\?\s*null)?\s*,/.test(args);
}

describe("debate-view::price-chart-tail-pinned-to-live-price — the edge is the page's own live read", () => {
	for (const [surface, rel] of [
		["Discovery", DISCOVERY],
		["/m/[slug]", DETAIL],
	] as const) {
		it(`${surface} pins the terminal to the SAME live price it renders in the bar`, () => {
			const src = code(rel);
			const args = liveTailArgs(src);

			// GUARD IS ALIVE — every negative below is worthless against a file
			// that no longer composes a tail at all.
			expect(src).toContain("withLiveTail(");
			expect(src).toContain("getMarketPricingAndReserves(db,");

			// The requirement: the terminal's price is `priced.pricing.yes` —
			// the same `priced` binding that fills the card / the page's
			// `pricing`, read ONCE, live, before the cached call.
			expect(spotIsTheLiveYesPrice(args)).toBe(true);

			// …and the three wrong answers, each of which renders a chart.
			// The opposite pole.
			expect(args).not.toMatch(/spotYes:[^,]*\.no\b/);
			// A second read of its own — the whole "zero additional queries"
			// claim, which is the only reason a floored history was acceptable.
			expect(args).not.toContain("await");
			// The series' own terminal, which makes the pin a self-referential
			// no-op: the chart would agree with itself and with nothing else.
			expect(args).not.toMatch(/spotYes:[^,]*\bseries\b/);
			expect(args).not.toMatch(/spotYes:[^,]*\.at\(/);

			// POSITIVE CONTROL — the predicate must be able to FAIL, and on this
			// exact text rather than a hand-built one. Invert the pole in the
			// measured argument list and require the check to go false.
			const inverted = args.replace("pricing.yes", "pricing.no");
			expect(inverted).not.toBe(args);
			expect(spotIsTheLiveYesPrice(inverted)).toBe(false);
			expect(inverted).toMatch(/spotYes:[^,]*\.no\b/);
		});

		it(`${surface} reads the clock at RENDER, never behind the cache`, () => {
			const src = code(rel);
			// A clock read inside `getCachedReserveWalk` would freeze for the
			// whole window and silently put an Open market's "now" edge up to
			// `MARKET_SERIES_MIN_WINDOW_MS` in the past. The cached module's own
			// ban is in `cached-series-contract.test.ts`; this is the other half
			// — the read has to happen SOMEWHERE, and this is where.
			expect(src).toContain("new Date().toISOString()");
			expect(liveTailArgs(src)).toMatch(/nowIso/);
		});
	}
});

describe("debate-view::price-chart-domain-frozen-when-not-open — INV-4, at the only call site that can break it", () => {
	it("/m/[slug] derives isOpen from market.status and never assumes it", () => {
		const args = liveTailArgs(code(DETAIL));

		// The requirement — a real status comparison, not a constant.
		expect(args).toMatch(/isOpen:\s*market\.status === "Open"\s*,/);
		// ⛔ AND THE LITERAL IS BANNED HERE SPECIFICALLY. A resolved market whose
		// chart keeps running to today is a rendered claim that something happened
		// after the market terminated.
		expect(args).not.toMatch(/isOpen:\s*(true|false)\s*,/);

		// POSITIVE CONTROL — the ban must be able to fire on this exact text.
		const assumed = args.replace(
			/isOpen:\s*market\.status === "Open"/,
			"isOpen: true",
		);
		expect(assumed).not.toBe(args);
		expect(assumed).toMatch(/isOpen:\s*(true|false)\s*,/);
		expect(assumed).not.toMatch(/isOpen:\s*market\.status/);
	});

	it("Discovery's isOpen literal is licensed by the Open filter, and the two are pinned together", () => {
		// Discovery may hard-code `true` — but ONLY because every market it lists
		// is `Open` by construction. That licence is a fact about ANOTHER
		// function, so the literal and the filter are asserted in one breath: if
		// `getCachedDiscoveryMarketIds` ever widens its `where`, this reddens on
		// the second line and names the reason, instead of Discovery quietly
		// growing a Closed market whose chart runs to now.
		expect(liveTailArgs(code(DISCOVERY))).toMatch(/isOpen:\s*true\s*,/);

		const ids = functionBlock(code(LIST), "getCachedDiscoveryMarketIds");
		expect(ids).toContain('eq(markets.status, "Open")');

		// POSITIVE CONTROL — the licence check must be able to fail, and the
		// scoping is what makes that possible: `list.ts` carries the same filter
		// in a second function, so an unscoped scan would keep matching that one.
		const widened = ids.replace(
			'eq(markets.status, "Open")',
			'inArray(markets.status, ["Open", "Closed"])',
		);
		expect(widened).not.toBe(ids);
		expect(widened).not.toContain('eq(markets.status, "Open")');
	});
});
