// @vitest-environment jsdom

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
	labelLeftPct,
	SVG_W,
	TERMINAL_PULSE_MAX_R,
	VIEWBOX_W,
	xPx,
} from "@/components/debate/chart/geometry";
import { MarketPriceChart } from "@/components/debate/chart/MarketPriceChart";
import {
	MARKET_CHART_WINDOW_END,
	MARKET_CHART_WINDOW_START,
} from "@/server/config/limits";
import type { PricePoint } from "@/server/discovery/price-series";

// CHART-6 — the label travels with its dot (`C-CHART-2` clause 2 as amended,
// founder-ruled 2026-09-01).
//
// SPEC.1 §17 rows proved here:
//   debate-view::price-chart-label-anchored-to-terminal-dot
//   debate-view::price-chart-label-flips-at-right-edge
//
// ⛔⛔ THE DEFECT THIS FILE EXISTS FOR, AND WHY NOTHING CAUGHT IT FOR THREE TASKS.
// The label's x was a CONSTANT — `left: 5px` inside a gutter pinned to the plot's
// right edge. The dot's x is DERIVED — `xPx` of the series' last point. Those two
// were the SAME NUMBER for as long as the chart's domain was the series' own
// span, because then the line always ended at the right edge. CHART-3 fixed the
// axis to the experiment window and separated them, and every guard in the
// repository stayed green, because not one of them compared a LAYOUT position to
// a DATA position. Measured on staging: 515 px between a hero label and its dot,
// on a 597 px plot.
//
// ⇒ **A coordinate that is right only when two independent quantities happen to
// be equal is wrong, and it is invisible until they diverge.**
//
// ⛔ SO THE SWEEP IS THE POINT OF THIS FILE, NOT A THOROUGHNESS FLOURISH. A guard
// written against a series that ends at the axis end passes against the DEFECT —
// that is precisely the state the whole product was in. Every case below runs the
// series end across the window, and the ~10 % case is the one that would have
// caught it on the day it shipped.
//
// ⛔ BOTH SIDES ARE DERIVED FROM THE SERIES, NEVER FROM EACH OTHER. The expected x
// is recomputed here from the fixture's own instant and the shipped window
// constants; the dot's `cx` and the label's `left` are then each compared against
// THAT. Comparing the two rendered values to one another would pass trivially,
// since after this change they both come from one `terminalX` — the trap the
// CHART-6 brief names in terms.
//
// There is no jest-dom here (AGENTS.md §9); every assertion is plain DOM or a
// read of the shipped markup. jsdom performs no layout, so the RENDERED
// consequence is measured in the CHART-6 contact sheet, in a real browser, at
// these same three positions.

const START_MS = Date.parse(MARKET_CHART_WINDOW_START);
const END_MS = Date.parse(MARKET_CHART_WINDOW_END);

/** A two-point series whose LAST point sits at fraction `f` of the window. */
function seriesEndingAtFraction(f: number, yes = "0.650000000000000000") {
	const at = new Date(START_MS + (END_MS - START_MS) * f).toISOString();
	return [
		{ at: MARKET_CHART_WINDOW_START, yes: "0.500000000000000000" },
		{ at, yes },
	] satisfies PricePoint[];
}

function markup(
	series: PricePoint[],
	mode: "collapsed" | "expanded" | "hero",
): HTMLElement {
	const html = renderToStaticMarkup(
		<MarketPriceChart series={series} mode={mode} isOpen={true} />,
	);
	return new DOMParser().parseFromString(html, "text/html").body;
}

/** The `left` declaration React shipped, read out of the style attribute
 * wherever it sits — never assumed to be first. */
function leftOf(container: HTMLElement, side: "yes" | "no"): string {
	const el = container.querySelector(`[data-testid="terminal-label-${side}"]`);
	return el?.getAttribute("style")?.match(/left:([^;]*)/)?.[1] ?? "";
}

/** The anchor percentage inside that `left` — the first `%` term, which is the
 * dot's own position before the gap is added. */
function anchorPctOf(left: string): number {
	return Number.parseFloat(left.match(/([\d.]+)%/)?.[1] ?? "");
}

const MODES = ["collapsed", "expanded", "hero"] as const;

/** The sweep. ~10 % is the case the shipped defect fails; ~50 % is the ordinary
 * mid-experiment market; ~95 % is where the flip must fire. */
const POSITIONS = [
	{ name: "~10 % of the window", f: 0.1, flips: false },
	{ name: "~50 % of the window", f: 0.5, flips: false },
	{ name: "~95 % of the window", f: 0.95, flips: true },
] as const;

describe("debate-view::price-chart-label-anchored-to-terminal-dot", () => {
	for (const mode of MODES) {
		for (const pos of POSITIONS) {
			it(`${mode}, series ending ${pos.name}: the label's anchor IS the dot's x`, () => {
				const series = seriesEndingAtFraction(pos.f);
				const container = markup(series, mode);

				// ⛔ THE INDEPENDENT DERIVATION. Computed from the fixture's instant and
				// the shipped constants — not read from either rendered element — so
				// the two assertions below are two readings against one truth rather
				// than a comparison of the component with itself.
				const expectedX = xPx(series[1].at, START_MS, END_MS);
				// Non-vacuity: the fixture really does end where it claims, and well
				// inside the plot rather than off it.
				expect(expectedX).toBeGreaterThan(0);
				expect(expectedX).toBeLessThanOrEqual(VIEWBOX_W);

				for (const side of ["yes", "no"] as const) {
					const dot = container.querySelector(
						`[data-testid="terminal-dot-${side}"]`,
					);
					expect(dot, `${mode}/${side} has no terminal dot`).not.toBeNull();
					expect(Number(dot?.getAttribute("cx"))).toBeCloseTo(expectedX, 6);

					const left = leftOf(container, side);
					expect(left, `${mode}/${side} has no left`).not.toBe("");
					expect(anchorPctOf(left)).toBeCloseTo((expectedX / SVG_W) * 100, 3);
				}
			});
		}
	}

	it("REDS against the pre-CHART-6 binding — the control that proves the sweep can fire", () => {
		// ⛔ OVN-V2, IN THE FILE. The shipped label used to anchor at the plot's right
		// edge regardless of the series, which as a percentage is a constant 100 %.
		// If the sweep above could not tell that apart from a tracking anchor it
		// would have been green throughout the defect's whole life — so the
		// discrimination is asserted rather than assumed.
		const anchors = POSITIONS.map((pos) =>
			anchorPctOf(
				leftOf(markup(seriesEndingAtFraction(pos.f), "collapsed"), "yes"),
			),
		);
		// Three different series ends produce three different anchors…
		expect(new Set(anchors).size).toBe(3);
		// …none of which is the old constant.
		for (const a of anchors) {
			expect(a).toBeLessThan(99);
		}
		// …and they are ORDERED, so the anchor tracks the data rather than merely
		// varying with it.
		expect(anchors[0]).toBeLessThan(anchors[1]);
		expect(anchors[1]).toBeLessThan(anchors[2]);
	});

	it("clears the pulse ring's MAXIMUM extent, by construction rather than by a pixel", () => {
		// ⛔ THE GAP IS THE RING'S OWN RADIUS, CONVERTED — `C-CHART-2` clause 2 as
		// amended. The ring reaches `TERMINAL_DOT_R × TERMINAL_PULSE_PEAK_SCALE` =
		// 7.2 user units at peak (`globals.css` `scale(2.4)`, pinned against the
		// constant by `terminal-pulse.test.tsx`). Expressing the gap in the SAME
		// percentage currency as the position is what makes the clearance exact on
		// every surface: both are fractions of the same box, so they scale together.
		//
		// ⚠ A CSS-PIXEL GAP WOULD CLEAR THE RING ON AT MOST ONE MODE. Measured
		// 2026-09-01, the ring renders 3.20 px wide on the collapsed card, 6.63 on
		// the hero and 8.60 on the expanded overlay — the plot's scale factor differs
		// by 2.7× across them.
		const ringPct = labelLeftPct(TERMINAL_PULSE_MAX_R);
		expect(ringPct).toBeGreaterThan(0);

		for (const mode of MODES) {
			const container = markup(seriesEndingAtFraction(0.5), mode);
			const left = leftOf(container, "yes");
			const cx = Number(
				container
					.querySelector('[data-testid="terminal-dot-yes"]')
					?.getAttribute("cx"),
			);
			// The declaration carries the dot's anchor PLUS the ring's own radius…
			expect(anchorPctOf(left)).toBeCloseTo((cx / SVG_W) * 100, 3);
			expect(left).toContain(`+ ${ringPct}%`);
			// …and the ring term is not a literal that happens to match: it is the
			// constant, so growing the pulse moves the gap with it.
			// ⚠ FOUR PLACES, WHICH IS `labelLeftPct`'S OWN PRECISION AND NOT A
			// LOOSENING TO MAKE A TEST PASS. The function quantises to 1e-4 % on
			// purpose (its docblock says why), so `7.2 / 649 × 100` = 1.10939907…
			// ships as `1.1094`. Asserting six places would be asserting that the
			// rounding this module deliberately performs did not happen — a guard
			// against the design rather than against a defect.
			expect(ringPct).toBeCloseTo((TERMINAL_PULSE_MAX_R / SVG_W) * 100, 4);
		}
	});
});

describe("debate-view::price-chart-label-flips-at-right-edge", () => {
	for (const mode of MODES) {
		for (const pos of POSITIONS) {
			it(`${mode}, series ending ${pos.name}: flip=${pos.flips}`, () => {
				const container = markup(seriesEndingAtFraction(pos.f), mode);
				const layer = container.querySelector(
					'[data-testid="terminal-label-layer"]',
				);
				expect(layer).not.toBeNull();
				expect(layer?.getAttribute("data-flip")).toBe(String(pos.flips));

				for (const side of ["yes", "no"] as const) {
					const el = container.querySelector(
						`[data-testid="terminal-label-${side}"]`,
					);
					const classes = (el?.getAttribute("class") ?? "").split(/\s+/);
					const left = leftOf(container, side);

					if (pos.flips) {
						// ⛔ THE TRANSLATE IS HALF THE MECHANISM AND NEITHER HALF WORKS
						// ALONE. `left` places the label's LEFT edge; on the flipped side
						// what must sit clear of the ring is its RIGHT edge, and
						// `-translate-x-full` is the only width-free way to say that — a
						// percentage the browser resolves against the label's own box,
						// which is the one width nobody here knows. A flip that moved
						// `left` without the translate would put the label ON its dot.
						expect(classes).toContain("-translate-x-full");
						expect(left).toContain("-");
						expect(left).not.toMatch(/\+\s/);
					} else {
						expect(classes).not.toContain("-translate-x-full");
						expect(left).toMatch(/\+\s/);
					}
					// The vertical centring survives the flip in both arms — the two
					// translates compose, which is what keeps clause 4's whole vertical
					// rule untouched by this change.
					expect(classes).toContain("-translate-y-1/2");
				}
			});
		}
	}

	it("does not flip on a market that has barely traded, and does on one at the axis end", () => {
		// The two ends of the rule, stated as one case so the boundary is visible.
		// MUST REJECT: a build that flips everything (the label would sit left of
		// every dot, which is the mirror of the defect) or nothing (it would overflow
		// the plot on any market near the end — the normal case in November).
		const at = (f: number) =>
			markup(seriesEndingAtFraction(f), "collapsed")
				.querySelector('[data-testid="terminal-label-layer"]')
				?.getAttribute("data-flip");

		expect(at(0.0001)).toBe("false");
		expect(at(0.5)).toBe("false");
		expect(at(1)).toBe("true");

		// …and the flip is monotone in x: once it fires it stays fired, so there is
		// no band in which the label oscillates as a market trades.
		const flips = Array.from({ length: 21 }, (_, i) => at(i / 20) === "true");
		const firstTrue = flips.indexOf(true);
		expect(firstTrue).toBeGreaterThan(0);
		expect(flips.slice(firstTrue).every(Boolean)).toBe(true);
		expect(flips.slice(0, firstTrue).some(Boolean)).toBe(false);
	});

	it("reserves enough room that the widest measured label cannot cross the plot's edge", () => {
		// ⛔ THE ONE MEASURED NUMBER IN THE MECHANISM, PINNED AGAINST THE
		// MEASUREMENT. `LABEL_FLIP_RESERVE_PCT` is 12 because the worst measured
		// `labelWidth / plotWidth` across four viewports is 10.46 % — the hero at
		// 1024 with the two-line label. The collapsed card is 9.40 % and is
		// viewport-independent (its rail is a pinned `w-[340px]`); the expanded
		// overlay is 6.29 % in a fixed-width dialog.
		//
		// ⚠ WHAT THIS CAN AND CANNOT PROVE. jsdom lays out no text, so no assertion
		// here can measure a glyph advance — the rendered check is in the contact
		// sheet, in the shipped face, at the three sweep positions. What IS provable
		// here is the arithmetic the reserve exists to guarantee: past the flip
		// point, a label of the worst measured width still fits to the LEFT of its
		// dot; before it, one still fits to the RIGHT. A reserve that failed either
		// would put the label off the canvas on some market.
		const WORST_MEASURED_FRACTION = 0.1046;
		const ringPct = labelLeftPct(TERMINAL_PULSE_MAX_R);

		const flipsAt = (f: number) =>
			markup(seriesEndingAtFraction(f), "hero")
				.querySelector('[data-testid="terminal-label-layer"]')
				?.getAttribute("data-flip") === "true";

		// Walk the window and check both arms at every step.
		for (let i = 0; i <= 100; i++) {
			const f = i / 100;
			const anchor =
				(xPx(
					new Date(START_MS + (END_MS - START_MS) * f).toISOString(),
					START_MS,
					END_MS,
				) /
					SVG_W) *
				100;
			if (flipsAt(f)) {
				// Flipped: the label runs LEFT from the anchor and must not fall off
				// the left edge.
				expect(
					anchor - ringPct - WORST_MEASURED_FRACTION * 100,
					`flipped label at f=${f} would cross the LEFT edge`,
				).toBeGreaterThan(-1);
			} else {
				// Not flipped: it runs RIGHT and must not cross the right edge.
				expect(
					anchor + ringPct + WORST_MEASURED_FRACTION * 100,
					`un-flipped label at f=${f} would cross the RIGHT edge`,
				).toBeLessThanOrEqual(100);
			}
		}
	});
});
