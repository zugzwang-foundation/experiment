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

/** The ring's clearance and the air, as the component spells them into `left`.
 * ⚠ `RING_PCT` is DERIVED through the shipped `labelLeftPct`, so it pins the
 * divisor (`SVG_W`, not `VIEWBOX_W`) as well as the value; `AIR_PX` is the 5 px
 * the gutter shipped with since CHART-2 and is mirrored rather than imported,
 * because a guard that imports the constant it checks agrees by construction. */
const RING_PCT = labelLeftPct(TERMINAL_PULSE_MAX_R);
const AIR_PX = 5;

const MODES = ["collapsed", "expanded", "hero"] as const;

/** The sweep. ~10 % is the case the pre-CHART-6 defect fails; ~50 % is the
 * ordinary mid-experiment market.
 *
 * ⛔⛔ THE FLIP POINT MOVED OFF THE WINDOW ENTIRELY AT CHART-7 (RF-5), AND THE
 * SWEEP IS RE-SEATED RATHER THAN RELAXED. `~95 %` used to flip and no longer does,
 * because there is now a real RIGHT RESERVE beside the plot sized from the widest
 * label the chart can produce plus the ring plus the gap. The label no longer has
 * to fit inside the PLOT, so an in-window series never flips: the dot's maximum x
 * is 98.61 % of the plot and the ring's clearance is 1.11 %, which puts the
 * label's left edge at 99.72 % — inside — with its body landing in the reserve.
 *
 * ⛔ SO THE FLIPPED ARM WOULD HAVE LOST ITS ONLY EXERCISE, AND THAT IS THE DANGER
 * WORTH NAMING. The flipped arm's term-by-term assertions exist because
 * `@test-writer` found at CHART-6 that dropping the ring's clearance from that
 * branch was green across 118 tests — its whole contract was "the string contains
 * a minus". If every position stopped flipping, those assertions would range over
 * nothing and the mutation would go green again, silently. **The last row is a
 * series running PAST the window end**, which is the case the reserve structurally
 * cannot cover and the one `limits.ts` records happening on staging for two weeks:
 * `xPx` is unclamped, so the dot leaves the canvas and its label flips. */
const POSITIONS = [
	{ name: "~10 % of the window", f: 0.1, flips: false },
	{ name: "~50 % of the window", f: 0.5, flips: false },
	// ⛔ THE UPPER BOUND ON THE RESERVE, AND IT WAS MISSING (`@test-writer`, M-3).
	// Swept against every shipped assertion, `LABEL_FLIP_RESERVE_PCT` could be
	// anything in **[11, 49]** and stay green — so `= 40` was green, and at 40 every
	// label flips from ~59 % of the window onward and lies back over the series it
	// just drew, on all three surfaces. It is 0 now and the cap still earns its
	// keep: it is what stops a future reserve being "fixed" by flipping everything.
	{ name: "~80 % of the window", f: 0.8, flips: false },
	{ name: "~95 % of the window", f: 0.95, flips: false },
	{ name: "hard against the window end", f: 1, flips: false },
	{ name: "PAST the window end (staging's live case)", f: 1.05, flips: true },
] as const;

/** The sweep positions whose series end INSIDE the plot.
 * ⚠ THE ANCHOR SWEEP CANNOT TAKE THE OUT-OF-WINDOW POSITION, AND THE REASON IS ITS
 * OWN NON-VACUITY CHECK RATHER THAN SQUEAMISHNESS. That sweep asserts the fixture
 * ends `0 < x ≤ VIEWBOX_W` before comparing anything, because a fixture that fell
 * off the canvas would make "the label sits on its dot" a claim about two things
 * nobody can see. A series past the window end is exactly that case — `xPx` is
 * unclamped, so it lands at 672 — and it belongs to the FLIP sweep, whose whole
 * subject it is. Two sweeps, two subjects, one list. */
const IN_WINDOW_POSITIONS = POSITIONS.filter((p) => p.f <= 1);

describe("debate-view::price-chart-label-anchored-to-terminal-dot", () => {
	for (const mode of MODES) {
		for (const pos of IN_WINDOW_POSITIONS) {
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
		const anchors = IN_WINDOW_POSITIONS.map((pos) =>
			anchorPctOf(
				leftOf(markup(seriesEndingAtFraction(pos.f), "collapsed"), "yes"),
			),
		);
		// Every series end produces a DIFFERENT anchor — derived from the list rather
		// than a literal, so adding a sweep position does not silently loosen this.
		expect(new Set(anchors).size).toBe(IN_WINDOW_POSITIONS.length);
		// …none of which is the old constant. ⚠ THE CEILING IS THE PLOT'S OWN SHARE
		// OF THE VIEWBOX, not a round 99: an in-window series anchors at most at
		// `VIEWBOX_W / SVG_W` = 98.61 %, and the superseded binding sat at a constant
		// 100. Written as the derived bound so the discrimination is exactly as tight
		// as the geometry allows.
		// ⚠ THE TOLERANCE IS `labelLeftPct`'s OWN ROUNDING AND NOTHING LOOSER. It
		// quantises to four decimal places, so the SHIPPED anchor at the window end
		// is 98.6133 against an exact 98.613251… — larger by 5e-5. An assertion
		// written without it reds on a correct render, which is the worst kind of
		// guard: one that punishes precision.
		const CEILING = (VIEWBOX_W / SVG_W) * 100;
		for (const a of anchors) {
			expect(a).toBeLessThanOrEqual(CEILING + 1e-4);
			expect(a).toBeLessThan(99);
		}
		// …and they are ORDERED, so the anchor tracks the data rather than merely
		// varying with it.
		for (let i = 1; i < anchors.length; i++) {
			expect(anchors[i - 1]).toBeLessThan(anchors[i]);
		}
	});

	it("the anchor is the SAME on all three modes — it is a property of the data, not the surface", () => {
		// ⚠ WHAT THE PER-MODE LOOP ABOVE ACTUALLY BUYS, STATED RATHER THAN IMPLIED
		// (`@test-writer`, L-5). `xPct`, `flip` and `left` are computed before any
		// mode is consulted, so nine cases exercise one code path — the sibling file
		// calls that shape "theatre" and it is a fair charge. What the loop DOES
		// catch is a mode-dependent anchor being introduced, and this asserts that
		// directly: one series end, one x, whatever surface renders it.
		//
		// ⛔ MUST REJECT: `left: mode === "collapsed" ? … : …`. A per-surface
		// correction to a coordinate is exactly what `C-CHART-2` clause 2 rules out,
		// and it is how the pre-CHART-2 label came to render at 4.28 px on one
		// surface and 19 px on another.
		for (const pos of POSITIONS) {
			const lefts = MODES.map((m) =>
				leftOf(markup(seriesEndingAtFraction(pos.f), m), "yes"),
			);
			expect(
				new Set(lefts).size,
				`${pos.name}: the anchor varies by mode`,
			).toBe(1);
		}
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

		const fixture = seriesEndingAtFraction(0.5);
		// ⚠ DERIVED FROM THE SERIES, NOT FROM THE RENDERED DOT — this line read the
		// dot's own `cx` back out of the markup and compared it to the label, which
		// is exactly the self-comparison this file's header forbids and which
		// `@test-writer` filed as M-1. The expectation now comes from the fixture's
		// instant and the shipped window, so the two readings below are two
		// measurements against one truth.
		const expectedX = xPx(fixture[1].at, START_MS, END_MS);
		for (const mode of MODES) {
			const container = markup(fixture, mode);
			const left = leftOf(container, "yes");
			// The declaration carries the dot's anchor PLUS the ring's own radius…
			expect(anchorPctOf(left)).toBeCloseTo((expectedX / SVG_W) * 100, 3);
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

					// ⛔⛔ BOTH ARMS ARE ASSERTED TERM BY TERM, AND THE FLIPPED ONE WAS
					// NOT UNTIL `@test-writer` CAUGHT IT (C-1). Its whole contract was
					// `toContain("-")` — satisfied by ANY string containing a minus —
					// so dropping the ring's clearance from the flipped arm
					// (`calc(X% - 5px)` instead of `calc(X% - 1.1094% - 5px)`) was
					// GREEN across all 118 tests in this set.
					//
					// ⛔ THAT IS THE ARM THAT MATTERS. The flip fires from ~88 % of the
					// window onward — every market in its final days, and every staging
					// market whose live tail is near the end. On the flipped side the
					// label's RIGHT edge is what must clear the ring, and the ring
					// renders 8.60 px on the expanded overlay: the mutation puts the
					// label 5 px from the dot's centre, i.e. 3.6 px INSIDE the ring's
					// peak. The one assertion that pinned the ring term ran on a
					// `f = 0.5` fixture, which never flips — so the clearance was proven
					// on the un-flipped branch and nowhere else.
					//
					// ⚠ THE AIR TERM IS PINNED TOO, for the same reason: nothing
					// asserted the 5px, on either arm.
					if (pos.flips) {
						// `-translate-x-full` is half the mechanism and neither half works
						// alone. `left` places the label's LEFT edge; on the flipped side
						// what must sit clear of the ring is its RIGHT edge, and the
						// translate is the only width-free way to say that — a percentage
						// the browser resolves against the label's own box, which is the
						// one width nobody here knows. A flip that moved `left` without
						// the translate would put the label ON its dot.
						expect(classes).toContain("-translate-x-full");
						expect(left).toContain(`- ${RING_PCT}%`);
						expect(left).toContain(`- ${AIR_PX}px`);
						expect(left).not.toMatch(/\+\s/);
					} else {
						expect(classes).not.toContain("-translate-x-full");
						expect(left).toContain(`+ ${RING_PCT}%`);
						expect(left).toContain(`+ ${AIR_PX}px`);
					}
					// The vertical centring survives the flip in both arms — the two
					// translates compose, which is what keeps clause 4's whole vertical
					// rule untouched by this change.
					expect(classes).toContain("-translate-y-1/2");
				}
			});
		}
	}

	it("no in-window market flips, and one past the window end does", () => {
		// The two ends of the rule, stated as one case so the boundary is visible.
		// ⛔ MUST REJECT, BOTH WAYS: a build that flips everything (the label sits
		// left of every dot and lies back over the series it just drew) and one that
		// flips nothing (past the window end the dot is off the canvas, and an
		// un-flipped label runs further off it).
		const at = (f: number) =>
			markup(seriesEndingAtFraction(f), "collapsed")
				.querySelector('[data-testid="terminal-label-layer"]')
				?.getAttribute("data-flip");

		expect(at(0.0001)).toBe("false");
		expect(at(0.5)).toBe("false");
		// ⚠ THE BOUNDARY IS NOW THE WINDOW ITSELF, WHICH IS THE WHOLE OF RF-5. Before
		// the right reserve this read `expect(at(1)).toBe("true")` — the label had to
		// flip on any market trading to the deadline, i.e. on every market in
		// November. That was the fallback carrying the normal case.
		expect(at(1)).toBe("false");
		expect(at(1.05)).toBe("true");

		// …and the flip is monotone in x: once it fires it stays fired, so there is
		// no band in which the label oscillates as a market trades. Swept across the
		// window AND past it, because the transition now lives outside the window.
		const flips = Array.from({ length: 25 }, (_, i) => at(i / 20) === "true");
		const firstTrue = flips.indexOf(true);
		expect(firstTrue).toBeGreaterThan(0);
		expect(flips.slice(firstTrue).every(Boolean)).toBe(true);
		expect(flips.slice(0, firstTrue).some(Boolean)).toBe(false);
		// Non-vacuity: the transition really is OUTSIDE the window, not merely late
		// inside it. `firstTrue` indexes `i/20`, so a value above 20 is past f = 1.
		expect(firstTrue).toBeGreaterThan(20);
	});

	it("an in-window label's LEFT EDGE never leaves the plot — which is what the reserve then holds", () => {
		// ⛔ WHAT REPLACED THE `LABEL_FLIP_RESERVE_PCT = 14` GUARD, AND WHY THE CLAIM
		// CHANGED SHAPE. That case pinned a threshold against a measured
		// `labelWidth / plotWidth`: the widest value (`100%`, 42.47 px in the shipped
		// face) against the hero's plot at its measured FLOOR (472.49 px), plus the
		// air the threshold could not express, giving 10.05 % — cleared by 14.
		//
		// ⚠ RF-5 REMOVES THE QUANTITY THAT GUARD WAS ABOUT. With a real reserve beside
		// the plot, a label does not have to fit INSIDE the plot, so "how much of the
		// plot does a label need" is no longer the question. The question is whether
		// the label's ANCHOR stays inside the plot — because everything past the
		// anchor lands in the reserve, which is sized from the label itself.
		//
		// ⛔ AND THAT IS PROVABLE HERE, WHERE THE WIDTH CLAIM WAS NOT. Both terms are
		// pure functions of the shipped constants: the dot's maximum in-window x is
		// `VIEWBOX_W / SVG_W` and the ring's clearance is `labelLeftPct(
		// TERMINAL_PULSE_MAX_R)`. jsdom lays out no text, so the WIDTH half stays a
		// rendered claim and is measured in the contact sheet; this is the half that
		// is arithmetic, and it is the half the flip threshold now rests on.
		const maxAnchorPct = (VIEWBOX_W / SVG_W) * 100;
		expect(maxAnchorPct).toBeCloseTo(98.6133, 3);
		expect(maxAnchorPct + RING_PCT).toBeLessThan(100);

		// …and that is exactly the comparison `shouldFlip` makes, so no in-window
		// series can flip. Swept through the render rather than asserted from the
		// arithmetic, so the two are shown to agree.
		for (let i = 0; i <= 100; i++) {
			const f = i / 100;
			const flipped =
				markup(seriesEndingAtFraction(f), "hero")
					.querySelector('[data-testid="terminal-label-layer"]')
					?.getAttribute("data-flip") === "true";
			expect(flipped, `in-window series at f=${f} must not flip`).toBe(false);
		}

		// ⛔ THE CAP FROM THE OTHER DIRECTION, KEPT. `LABEL_FLIP_RESERVE_PCT` is 0
		// today; the ban that matters is on it drifting UP into "everything flips",
		// which is how an under-sized reserve gets "fixed". Read out of the rendered
		// behaviour rather than from the constant: a market at 80 % of the window has
		// ample room and must not flip, which caps the threshold at ~20.
		expect(
			markup(seriesEndingAtFraction(0.8), "hero")
				.querySelector('[data-testid="terminal-label-layer"]')
				?.getAttribute("data-flip"),
		).toBe("false");
	});
});

describe("debate-view::price-chart-label-clears-date-row — RF-5, the right reserve", () => {
	for (const mode of MODES) {
		it(`${mode}: the reserve is the row's TRAILING cell, shrink-0, and pins no width`, () => {
			const container = markup(seriesEndingAtFraction(0.6), mode);
			const frame = container.querySelector(
				'[data-testid="market-price-chart-frame"]',
			);
			const inFlow = [...(frame?.children ?? [])].map(
				(c) => c.getAttribute("data-testid") ?? "",
			);
			// Marks left, plot, reserve right — the whole of RF-1 and RF-5 in one row.
			expect(inFlow).toEqual([
				"chart-y-marks",
				"market-price-chart-plot",
				"chart-label-reserve",
			]);

			const reserve = container.querySelector(
				'[data-testid="chart-label-reserve"]',
			);
			const cls = (reserve?.getAttribute("class") ?? "").split(/\s+/);
			// ⛔ IT MUST NOT GROW. A reserve that took `flex-1` would eat the plot on
			// every surface; `shrink-0` is what makes it exactly as wide as the label
			// it holds and no wider.
			expect(cls).toContain("shrink-0");
			expect(cls).not.toContain("flex-1");
			// ⛔ AND NO PINNED WIDTH — the CHART-1 `26` in a new place. The width comes
			// from the browser laying out the sizer, which is the point of the sizer.
			expect(reserve?.getAttribute("class") ?? "").not.toMatch(
				/(^|\s)(min-|max-)?w-/,
			);
			expect((reserve as HTMLElement | null)?.style.width ?? "").toBe("");
			// ⛔ `invisible`, NEVER `hidden`. `visibility: hidden` keeps the box —
			// which IS the mechanism; `display:none` removes it and the reserve
			// silently collapses to its padding.
			expect(cls).toContain("invisible");
			expect(cls).not.toContain("hidden");
			// It is a blank strip: never announced, never clickable.
			expect(reserve?.getAttribute("aria-hidden")).toBe("true");
			expect(cls).toContain("pointer-events-none");
		});
	}

	it("the reserve is sized by the WIDEST label the chart can produce", () => {
		// ⛔ `YES 100%` ON THE VALUE-BEARING MODES, `YES` ON THE CARD — and the string
		// comes from the shipped formatter at an extreme price rather than from a
		// literal, so the sizer cannot come to disagree with what a label can print.
		// Measured in the shipped face: `YES 100%` is 69.88 px and `NO 100%` is
		// 64.84 px, so YES is correctly the one to size from.
		const textOf = (mode: "collapsed" | "expanded" | "hero") =>
			markup(seriesEndingAtFraction(0.6), mode).querySelector(
				'[data-testid="chart-label-reserve"]',
			)?.textContent ?? "";
		expect(textOf("expanded")).toBe("YES100%");
		expect(textOf("hero")).toBe("YES100%");
		expect(textOf("collapsed")).toBe("YES");

		// ⛔ AND THE SIZER CARRIES NO VALUE TESTID. Two elements answering to
		// `terminal-value-yes` would make every guard that reads "the value" pick
		// whichever came first in the markup — and the reserve comes last, so the
		// bug would be intermittent by markup order rather than absent.
		const container = markup(seriesEndingAtFraction(0.6), "expanded");
		expect(
			container.querySelectorAll('[data-testid="terminal-value-yes"]'),
		).toHaveLength(1);
		expect(
			container
				.querySelector('[data-testid="chart-label-reserve"]')
				?.querySelector('[data-testid^="terminal-"]'),
		).toBeNull();
	});

	it("the lower label's clamp carries the plot's edges ONLY — CHART-8 removed the band", () => {
		// ⛔ THE CASE THIS REPLACES ASSERTED THE OPPOSITE, AND IT WAS RIGHT WHEN IT
		// WAS WRITTEN. RF-5 gave `lowerTop` a third term — `- AXIS_DATE_BAND_PX` —
		// because the X-axis dates sat INSIDE the plot, on its floor, so at the
		// window end with an extreme price the lower end label came to rest on top of
		// its own date label: measured at CHART-6 at 19.99 × 16.00 px on the overlay
		// and 4.54 × 7.70 px on the card. CHART-8 moves the date row out of the plot
		// to a strip beneath the baseline, so the two no longer share a rectangle and
		// there is no overlap left for a clamp term to prevent.
		//
		// ⇒ The rule `C-CHART-2` clause 3 states is DISCHARGED, not repealed: "one
		// clamp, one more measured input, never a second rule" was correct, and what
		// changed is that the input is zero for every render. This case pins that the
		// term is GONE rather than zeroed, because a `- 0px` left in the string is a
		// collision surface the file would still be claiming to have.
		const BAND_TERM = /calc\(100% - [\d.]+px - [\d.]+px\)/;
		const ceilOf = (t: string) => t.match(/calc\(100% - ([\d.]+)px\)/)?.[1];

		for (const mode of MODES) {
			const container = markup(
				seriesEndingAtFraction(1, "0.960000000000000000"),
				mode,
			);
			// The row IS drawn here — the case only means something where the band
			// used to be non-zero.
			expect(
				container.querySelector('[data-testid="axis-date-row"]'),
				`${mode}: no date row, so this case proves nothing`,
			).not.toBeNull();

			const tops = [
				...container.querySelectorAll('[data-testid^="terminal-label-"]'),
			].map((el) => el.getAttribute("style")?.match(/top:([^;]*)/)?.[1] ?? "");
			const lower = tops.find((t) => t.includes("max(")) ?? "";
			const upper = tops.find((t) => t.includes("min(")) ?? "";
			expect(lower, `${mode}: no lower label`).not.toBe("");
			expect(upper, `${mode}: no upper label`).not.toBe("");

			expect(lower, `${mode}: the band term is back`).not.toMatch(BAND_TERM);
			// The positive half: both labels now stop at the same distance from their
			// own plot edge. Read from the two strings, never mirrored as a literal.
			expect(ceilOf(lower), `${mode}: no plot-edge ceiling`).toBeDefined();
			expect(ceilOf(lower)).toBe(ceilOf(upper));

			// POSITIVE CONTROL — the matcher fires on THIS run's own string with the
			// removed term spliced back in, so the absence above is a reading.
			const reintroduced = lower.replace(
				/calc\(100% - ([\d.]+)px\)/,
				"calc(100% - $1px - 16px)",
			);
			expect(reintroduced).not.toBe(lower);
			expect(reintroduced).toMatch(BAND_TERM);
		}
	});

	it("the date row hangs BELOW the plot, and the frame leaves it exactly its own height", () => {
		// ⛔⛔ THE STRUCTURAL HALF OF CHART-8, AND THE HALF A UNIT TEST CAN ACTUALLY
		// SEE. jsdom performs no layout, so "the label's top edge is at or below the
		// 0 gridline" is a browser measurement and lives in the run report. What is
		// checkable here is the mechanism that makes it true, and it is two claims:
		// the row is anchored to the plot's BOTTOM EDGE rather than filling the plot,
		// and the frame reserves exactly the strip's own height beneath it.
		//
		// ⚠ THE SECOND CLAIM IS THE ONE WITH TEETH. `top-full` alone would hang the
		// dates outside the frame — over the card's padding, and outside the hero's
		// bordered box — which looks like an overflow bug rather than an axis. The
		// room and the strip are the SAME composed constant, so a change to the date
		// type or its offset moves both; asserting them as two numbers read from two
		// elements is what proves they have not drifted apart.
		for (const mode of MODES) {
			const container = markup(seriesEndingAtFraction(0.6), mode);
			const row = container.querySelector('[data-testid="axis-date-row"]');
			expect(row, `${mode}: no date row`).not.toBeNull();
			const cls = (row?.getAttribute("class") ?? "").split(/\s+/);

			// ⛔ `top-full` PUTS THE STRIP'S TOP EDGE ON THE PLOT'S BOTTOM EDGE, which
			// is where `y = VIEWBOX_H` renders and therefore where the 0 gridline is.
			expect(
				cls,
				`${mode}: the row is not anchored to the plot's floor`,
			).toContain("top-full");
			// ⛔ AND `inset-0` IS THE THING IT MUST NOT BE — that was the shipped
			// arrangement, and it is what put the dates inside the drawing area.
			expect(cls, `${mode}: the row still fills the plot`).not.toContain(
				"inset-0",
			);
			// …while the HORIZONTAL binding stays the plot's own width, which is what
			// keeps `labelLeftPct` meaning the same thing it means for the dots.
			expect(cls).toContain("inset-x-0");

			const style = row?.getAttribute("style") ?? "";
			const stripPx = Number(style.match(/height:\s*(\d+)px/)?.[1]);
			const typePx = Number(style.match(/font-size:\s*(\d+)px/)?.[1]);
			expect(stripPx, `${mode}: the strip declares no height`).toBeGreaterThan(
				0,
			);
			expect(typePx, `${mode}: the row declares no type size`).toBeGreaterThan(
				0,
			);

			const frame = container.querySelector(
				'[data-testid="market-price-chart-frame"]',
			);
			const roomPx = Number(
				(frame?.getAttribute("style") ?? "").match(
					/padding-bottom:\s*(\d+)px/,
				)?.[1],
			);
			expect(
				roomPx,
				`${mode}: the frame leaves no room beneath the plot`,
			).toBeGreaterThan(0);
			// THE identity: the room and the strip are one constant, not two.
			expect(roomPx).toBe(stripPx);
			// …and the strip is the type plus the air over it, so a label's box
			// cannot exceed the room the frame made.
			const airPx = Number(
				container
					.querySelector('[data-testid^="axis-x-anchor-"]')
					?.getAttribute("style")
					?.match(/top:\s*(\d+)px/)?.[1],
			);
			expect(airPx, `${mode}: no offset on the date label`).toBeGreaterThan(0);
			expect(typePx + airPx).toBe(stripPx);
		}
	});

	it("reserves NO room on a render that draws no date row", () => {
		// ⚠ THE ARM THAT MAKES THE RESERVATION HONEST, CARRIED OVER FROM THE BAND IT
		// USED TO GUARD. Room left beneath a row that is not there shortens the plot
		// for a reason no reader can see — the same objection the zeroed band term
		// answered, one element over. The collapsed card draws no axis below two
		// points, its shipped gate since HTML-FINISH R8, so that is the case to check.
		const container = markup(
			[{ at: MARKET_CHART_WINDOW_START, yes: "0.960000000000000000" }],
			"collapsed",
		);
		expect(container.querySelector('[data-testid="axis-date-row"]')).toBeNull();
		const frame = container.querySelector(
			'[data-testid="market-price-chart-frame"]',
		);
		expect(frame).not.toBeNull();
		expect(frame?.getAttribute("style") ?? "").not.toMatch(/padding-bottom/);
	});
});
