// @vitest-environment jsdom

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MarketPriceChart } from "@/components/debate/chart/MarketPriceChart";
import { MARKET_CHART_WINDOW_START } from "@/server/config/limits";
import type { PricePoint } from "@/server/discovery/price-series";

// CHART-7 · RF-2/RF-5 — `debate-view::price-chart-terminal-labels-never-overlap`,
// the half of it that lives in CSS pixels.
//
// ⛔⛔ WHY A THIRD SWEEP, WHEN TWO ALREADY RUN THE SAME BAND. Neither of them can
// see an overlap, and one of them cannot see the PRICE at all:
//
//   · `terminal-markers.test.tsx` sweeps 48–52 % and asserts clause 4's own rule
//     in PLOT UNITS. That rule is a scope fence and is genuinely proven — but the
//     component's own docblocks say twice over that plot units are NOT what keeps
//     the two labels apart on screen. In plot units nothing moved at CHART-5,
//     CHART-6 or CHART-7, and the labels overlapped by ~3 px through two of them.
//   · `y-scale.test.tsx` sweeps the same 401 prices in CSS and asserts that one
//     label carries `calc(50% - Hpx)` and the other `calc(50% + Hpx)`. **Those
//     terms are in the emitted string at EVERY price** — `upperTop`/`lowerTop`
//     always spell them — so the assertion does not vary with the loop variable.
//     Measured: the identical three assertions pass at YES = 5 %, 30 % and 95 %.
//     The sweep pins the half-box, which is real and valuable; its RANGE is
//     decoration.
//
// ⇒ So nothing in the repository answers "can the two labels overlap, and at what
// price". This file answers it by EVALUATING the two shipped `top` expressions the
// way a browser would, at the plot heights the product actually renders at.
//
// ⚠ THE METHOD IS VALIDATED AGAINST THE BROWSER, WHICH IS THE ONLY REASON TO TRUST
// IT. jsdom's CSSOM cannot represent `clamp()`/`min()`/`max()` at all — that is why
// every other case here reads the markup as a string. Evaluated with the tiny
// parser below, the band in which the CSS floor is what holds the pair apart comes
// out as **hero 48.09–51.91 %** and **expanded 47.91–52.09 %** at the CHART-7
// ground pass's measured boxes; the same run measured in a real browser reported
// **48.1–51.9** and **47.9–52.1**. Same numbers, no browser.
//
// ⛔ AND THE ANSWER IT GIVES IS "NO OVERLAP, WITH ZERO MARGIN". On every
// value-bearing surface the minimum separation is **exactly** the box height —
// `2 × half` = 16 px around two 16 px boxes. The labels touch and do not cross.
// That is a correct render and a razor-thin one, and the point of pinning it is
// that the next change to either type size, or to the date-row band, moves it in
// one direction only.

/** Evaluate the subset of CSS math this component emits — `clamp`, `min`, `max`,
 * `calc`, `%`, `px`, `+`, `-` — against a plot height, in the same order a browser
 * resolves it. Anything outside that subset THROWS rather than returning a number:
 * a silent 0 here would make every assertion below pass on an expression nobody
 * parsed, which is the failure this whole file is about. */
function evalCss(expr: string, H: number): number {
	const s = expr.trim();
	let i = 0;
	const ws = () => {
		while (i < s.length && s[i] === " ") i++;
	};
	const args = (): number[] => {
		i++; // "("
		const out: number[] = [];
		for (;;) {
			out.push(sum());
			ws();
			if (s[i] === ",") {
				i++;
				continue;
			}
			if (s[i] === ")") {
				i++;
				return out;
			}
			throw new Error(`unexpected '${s[i]}' at ${i} in ${expr}`);
		}
	};
	const primary = (): number => {
		ws();
		if (s.startsWith("clamp(", i)) {
			i += 5;
			const a = args();
			if (a.length !== 3) throw new Error("clamp arity");
			return Math.max(a[0], Math.min(a[1], a[2]));
		}
		if (s.startsWith("min(", i)) {
			i += 3;
			return Math.min(...args());
		}
		if (s.startsWith("max(", i)) {
			i += 3;
			return Math.max(...args());
		}
		if (s.startsWith("calc(", i)) {
			i += 4;
			const a = args();
			if (a.length !== 1) throw new Error("calc arity");
			return a[0];
		}
		const m = /^(-?\d+(?:\.\d+)?)(%|px)/.exec(s.slice(i));
		if (m === null) throw new Error(`no length at ${i} in ${expr}`);
		i += m[0].length;
		return m[2] === "%" ? (Number(m[1]) / 100) * H : Number(m[1]);
	};
	function sum(): number {
		let v = primary();
		for (;;) {
			ws();
			if (s[i] === "+") {
				i++;
				v += primary();
				continue;
			}
			if (s[i] === "-") {
				i++;
				v -= primary();
				continue;
			}
			return v;
		}
	}
	const v = sum();
	ws();
	if (i !== s.length) throw new Error(`trailing "${s.slice(i)}" in ${expr}`);
	return v;
}

const MODES = ["collapsed", "expanded", "hero"] as const;

/** The plot boxes the product renders at, from the CHART-7 ground pass — plus the
 * hero's LAYOUT FLOOR (`min-h-24` = 96 px, `HeroPanels`), which is the shortest
 * plot any surface can reach and therefore the case a bound has to cover. */
const HEIGHTS = [96, 193.8, 382.25, 407.3, 418.75, 900];

function markup(mode: (typeof MODES)[number], yes: number): string {
	const series: PricePoint[] = [
		{ at: MARKET_CHART_WINDOW_START, yes: "0.500000000000000000" },
		{ at: "2026-10-07T00:00:00.000Z", yes: yes.toFixed(18) },
	];
	return renderToStaticMarkup(
		<MarketPriceChart series={series} mode={mode} isOpen={true} />,
	);
}

function topOf(m: string, side: "yes" | "no"): string {
	const hit = m.match(
		new RegExp(`terminal-label-${side}"[^>]*style="[^"]*top:([^";]*)`),
	);
	expect(hit, `no top for ${side}`).not.toBeNull();
	return hit?.[1] ?? "";
}

/** The label's rendered box height, composed from the type the label is made of —
 * read from the markup on both sides, never mirrored. `leading-none` makes the
 * line box the taller of the two inline boxes exactly (both share one baseline and
 * one line-height FACTOR), which is the assumption `labelHalfBoxPx` encodes and
 * `terminal-markers.test.tsx` pins the class for. */
function boxPxOf(m: string): number {
	const name = Number(
		m.match(/terminal-label-layer"[^>]*class="[^"]*text-\[(\d+)px\]/)?.[1],
	);
	expect(name, "the label layer declares no type size").toBeGreaterThan(0);
	const value = Number(
		m.match(/terminal-value-yes"[^>]*style="[^"]*font-size:(\d+)px/)?.[1] ?? 0,
	);
	// ⛔ THE ASSUMPTION, ASSERTED WHERE IT IS SPENT. `Math.max` is the box only
	// while the two parts share ONE line box; a value re-stacked beneath its name
	// emits `margin-top` again and the real box becomes `name + gap + value`, at
	// which point every separation below is measured against a rectangle that is
	// not the one on screen. `label-single-line.test.tsx` owns the ruling; this is
	// the load-bearing half of it repeated at the one place a wrong answer here
	// would be invisible.
	expect(m).not.toMatch(/terminal-value-yes"[^>]*margin-top:/);
	return Math.max(name, value);
}

describe("debate-view::price-chart-terminal-labels-never-overlap — the CSS-pixel half", () => {
	it("the evaluator agrees with CSS, and can return a FAILING number", () => {
		// ⛔ THE CONTROL ON THE INSTRUMENT, AND IT COMES FIRST. Every assertion below
		// is only as good as this parser; one that returned a constant would certify
		// the component against itself. Hand-computed, against a 200 px plot:
		expect(
			evalCss("clamp(8px, min(4%, calc(50% - 8px)), calc(100% - 8px))", 200),
		).toBe(8);
		expect(
			evalCss("clamp(8px, min(40%, calc(50% - 8px)), calc(100% - 8px))", 200),
		).toBe(80);
		expect(
			evalCss("clamp(8px, min(49%, calc(50% - 8px)), calc(100% - 8px))", 200),
		).toBe(92);
		expect(
			evalCss(
				"clamp(8px, max(51%, calc(50% + 8px)), calc(100% - 8px - 16px))",
				200,
			),
		).toBe(108);
		// …the bottom bound really binds, band term included.
		expect(
			evalCss(
				"clamp(8px, max(99%, calc(50% + 8px)), calc(100% - 8px - 16px))",
				200,
			),
		).toBe(176);
		// …and it THROWS on anything it does not understand rather than guessing.
		expect(() => evalCss("var(--nope)", 200)).toThrow();
		expect(() => evalCss("clamp(8px, 4%)", 200)).toThrow();
	});

	for (const mode of MODES) {
		it(`${mode}: the two labels never overlap, at any price or any shipped plot height`, () => {
			// ⛔ ONE ASSERTION, PRICE-DEPENDENT AND HEIGHT-DEPENDENT, WHICH IS WHAT THE
			// OTHER TWO SWEEPS ARE NOT. Swept 44–56 % — wider than the band on every
			// surface, so the loop crosses BOTH edges of it rather than sitting inside.
			let worst = Number.POSITIVE_INFINITY;
			let floored = 0;
			let box = 0;
			for (let bp = 4400; bp <= 5600; bp += 5) {
				const m = markup(mode, bp / 10000);
				box = boxPxOf(m);
				const yesTop = topOf(m, "yes");
				const noTop = topOf(m, "no");
				for (const H of HEIGHTS) {
					const sep = Math.abs(evalCss(yesTop, H) - evalCss(noTop, H));
					expect(
						sep,
						`${mode} @ YES ${bp / 100}% on a ${H}px plot: ${sep}px between two ${box}px boxes`,
					).toBeGreaterThanOrEqual(box);
					if (sep < worst) worst = sep;
					// Is the 50 %-pivot floor what is holding them apart here? Compare
					// against the same expression with that term removed.
					const strip = (x: string) =>
						x
							.replace(/min\(([^,]*),\s*calc\(50% - [\d.]+px\)\)/, "$1")
							.replace(/max\(([^,]*),\s*calc\(50% \+ [\d.]+px\)\)/, "$1");
					if (
						Math.abs(evalCss(strip(yesTop), H) - evalCss(strip(noTop), H)) <
						sep - 1e-9
					) {
						floored++;
					}
				}
			}
			// ⛔ NON-VACUITY, AND IT IS THE ASSERTION THAT MAKES THE SWEEP WORTH ITS
			// RUNTIME. The floor must actually ENGAGE somewhere in this range — a sweep
			// that only ever ran where clause 4's own separation already sufficed would
			// be proving the CSS floor by never using it, which is precisely the charge
			// against the sweep this file was added beside.
			expect(floored, `${mode}: the CSS floor never engaged`).toBeGreaterThan(
				0,
			);
			// …and where it does engage the separation is EXACTLY the box: the labels
			// touch and never cross. Pinned so the margin cannot silently go negative.
			expect(worst).toBeCloseTo(box, 6);
		});
	}

	it("the date-row band cannot invert the lower clamp on the shortest plot the product renders", () => {
		// ⛔ A BOUND RF-5 INTRODUCED AND NOTHING STATES. `lowerTop`'s upper limit is
		// `100% - half - band` while `upperTop`'s is `100% - half`, so on a SHORT plot
		// the lower label's ceiling drops below the `50% + half` pivot and the pair
		// collapses. Measured with the evaluator: at half = 8 and band = 16 the two
		// labels overlap by 2 px at a 60 px plot and by 7 px at 50 px, and the
		// threshold is `H >= 4·half + 2·band` = **64 px**. Before RF-5 (band = 0) the
		// same threshold was 32 px.
		//
		// ⚠ NOT LIVE — the hero's `min-h-24` floor is 96 px and the overlay's aspect
		// lock keeps it far above — which is exactly why it is worth pinning: the
		// margin is a layout constant in another file, and nothing connects the two.
		const m = markup("expanded", 0.5);
		const half = Number(
			topOf(m, "yes").match(/clamp\((\d+(?:\.\d+)?)px,/)?.[1],
		);
		const band = Number(
			topOf(m, "no").match(/calc\(100% - [\d.]+px - (\d+)px\)/)?.[1],
		);
		expect(half, "no half-box in the clamp").toBeGreaterThan(0);
		expect(band, "no date-row band in the lower clamp").toBeGreaterThan(0);
		expect(
			Math.min(...HEIGHTS),
			`the shortest plot must clear 4·half + 2·band = ${4 * half + 2 * band}px`,
		).toBeGreaterThanOrEqual(4 * half + 2 * band);
	});
});
