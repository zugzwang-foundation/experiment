// @vitest-environment jsdom

import { cleanup, render } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";
import {
	SVG_W,
	TERMINAL_DOT_R,
	TERMINAL_LABEL_MIN_GAP,
	VIEWBOX_H,
	VIEWBOX_W,
	yNoPx,
	yYesPx,
} from "@/components/debate/chart/geometry";
import { MarketPriceChart } from "@/components/debate/chart/MarketPriceChart";
import type { PricePoint } from "@/server/discovery/price-series";

// CHART-1 — the line ends (design-canon §10 `C-CHART-2`, founder-ruled
// 2026-08-27).
//
// SPEC.1 §17 row proved here:
//   debate-view::price-chart-terminal-labels-never-overlap
//
// ⛔ THE COLLISION IS THE DEFAULT STATE OF EVERY MARKET, NOT AN EDGE CASE, and
// the arithmetic is why this file leads with it. YES and NO mirror about 50 %,
// so the gap between the two end labels is `VIEWBOX_H · |2·YES − 1|` —
// proportional to how far the market is from even. Every market opens at
// exactly even and all eight seeded markets sit within a couple of points of it
// today. A build that handled 65/35 and not 51/49 would be a build whose NORMAL
// rendering is broken and whose tests are all green.
//
// There is NO jest-dom here (AGENTS.md §9) — every assertion below is plain
// DOM.

afterEach(cleanup);

const OPENED = "2026-09-15T00:00:00.000Z";
const LATER = "2026-09-20T00:00:00.000Z";

/** Half the height of one end label, in PLOT USER UNITS — the labels carry
 * `text-[10px]` with `leading-none` and are centred on their position by
 * `-translate-y-1/2`, so the box spans `y ± 5`. Pinned against the component's
 * own classes by the last case in this describe block, so it can never drift
 * from the type actually rendered.
 * ⛔⛔ THIS BLOCK CLAIMED THE OPPOSITE OF THE TRUTH AND IS CORRECTED HERE AT THE
 * CHART-2 TEST AUDIT — the assertions below are untouched, only the reasoning
 * about them. It read: "SINCE CHART-2 THIS IS A DELIBERATE OVER-ESTIMATE IN THE
 * CLAMP'S FAVOUR … a plot unit is smaller than a CSS pixel on the collapsed card
 * (scaleY 0.428), so 10 units is ~4.3px of real box. Asserting the clamp against
 * the larger figure keeps the guard STRICTER than the thing it guards."
 *
 * ⛔ IT IS LOOSER, NOT STRICTER, AND BY A FACTOR OF ABOUT 2.3. The paragraph
 * converted the GUARD's bound into CSS pixels (10 plot units × 0.428 = 4.3px)
 * and then compared it against the BOX as though the box were also 10 plot
 * units. It is not: since CHART-2 the label is HTML, so its box is **10 CSS px**
 * — which on the collapsed card is **10 / 0.42822 = 23.35 PLOT units**, not 10.
 * One quantity, converted on one side of the comparison only. The honest
 * statement is that `LABEL_HALF_BOX = 5` is HALF THE BOX IN THE OLD UNITS, and
 * the clamp it checks (`clampLabelY`, floor 6 plot units) is likewise a
 * plot-unit constant sized for a label that was 10 plot units tall.
 *
 * ⚠ WHAT THAT MEANT FOR THE TWO BOX CASES BELOW: on the EXPANDED overlay
 * (scaleY 1.325) and the Discovery hero (0.92422) the constants still hold in
 * CSS px; on the COLLAPSED card (scaleY 0.42822) they did not — the clamp floor
 * of 6 plot units is 2.57 CSS px from the top edge for a 5 CSS px half-box, so
 * at YES = 99 % the label's upper half sat ~2.4px ABOVE the plot, and between
 * YES ≈ 46.35 % and 53.65 % the two boxes overlapped. The cases below cannot see
 * either, because every number in them is a plot unit and in plot units nothing
 * moved — the same shape as the CHART-1 regression this task exists to fix, one
 * constant over.
 *
 * ✅ FIXED IN THE SAME CASCADE THAT FOUND IT, and the fix is NOT a bigger
 * constant. `terminalLabelYs` is untouched — clause 4's arithmetic is a scope
 * fence — and the pixel guarantee was added to the OUTPUT MAPPING instead, which
 * is the half the brief put in scope: the label's CSS `top` is now
 * `clamp(5px, min(P%, calc(50% ∓ 5px)), calc(100% − 5px))`, so the browser's own
 * layout pass floors the separation and the edges in REAL PIXELS on every
 * surface. Raising `TERMINAL_LABEL_MIN_GAP` to ~24 units was the obvious
 * alternative and was rejected: it would over-separate the two larger surfaces
 * threefold and would be this very defect one level up — a single number chosen
 * against one surface's scale.
 *
 * ⛔ SO THIS CONSTANT AND THE CASES BELOW ARE NOW A PLOT-SPACE GUARD ON A
 * PLOT-SPACE RULE, which is exactly what they should be. They assert clause 4
 * still does its own job; the CSS-pixel floor on top of it is asserted by "the
 * alignment is WIDTH-INDEPENDENT by construction" (which reads the shipped
 * `style` attribute) and measured in the contact sheet. */
const LABEL_HALF_BOX = 5;

/** A two-point series ending at `yes`. Two points so the domain is real; the
 * terminal markers read the LAST point only. */
function seriesEndingAt(yes: string): PricePoint[] {
	return [
		{ at: OPENED, yes: "0.500000000000000000" },
		{ at: LATER, yes },
	];
}

/** 18-dp canonical string for a percentage, so fixtures read as prices. */
function pct(p: number): string {
	return p.toFixed(18);
}

function renderChart(yes: string, mode: "collapsed" | "expanded" | "hero") {
	return render(
		<MarketPriceChart series={seriesEndingAt(yes)} mode={mode} isOpen={true} />,
	);
}

function numAttr(el: Element | null, name: string): number {
	return Number(el?.getAttribute(name));
}

/**
 * A label's vertical position, read back off the RENDERED element and expressed
 * in PLOT USER UNITS so every assertion in this file keeps the units it was
 * written in.
 *
 * ⛔ THE LABELS LEFT THE `<svg>` AT CHART-2 (`C-CHART-2` clause 2) and this
 * helper is what let the collision cases below survive that move unchanged.
 * They used to carry a `y` attribute in plot units; they now carry
 * `style="top: N%"` in the HTML gutter, where N is that same plot y as a
 * fraction of `VIEWBOX_H`. Multiplying back recovers the identical quantity, so
 * the clause-4 rules — the 12-unit minimum gap, the symmetric push, the clamp,
 * the tie-break — are still asserted against the numbers `terminalLabelYs`
 * actually produced, at the same tolerances, in the same units.
 *
 * ⚠ THIS IS A READ, NOT A RE-DERIVATION. It reads what the component emitted; it
 * does not recompute where the label ought to be.
 *
 * ⛔ IT READS `data-plot-y`, NOT `style.top`, SINCE THE CHART-2 CASCADE FIX. The
 * CSS `top` is now a `clamp(… min(…) …)` expression that reconciles clause 4's
 * plot-space answer with a CSS-PIXEL floor — because the label's box is 10 CSS
 * px while clause 4's threshold is 12 PLOT units, and on the collapsed card
 * those are 10 px and 5.14 px respectively. Parsing a number back out of that
 * expression would be reverse-engineering a layout string, and it would silently
 * read the wrong term the first time the expression's shape changed. The
 * component therefore states clause 4's own output directly, and this reads it.
 * The CSS-pixel behaviour the expression produces cannot be observed in jsdom at
 * all and is measured in the contact sheet.
 */
function labelPlotY(el: Element | null): number {
	return Number(el?.getAttribute("data-plot-y"));
}

describe("debate-view::price-chart-terminal-labels-never-overlap", () => {
	// The three prices the founder will actually be looking at. 0.50 is a market
	// with no bets; 0.49 and 0.51 are a market one argument old.
	for (const p of [0.5, 0.49, 0.51]) {
		it(`keeps the two labels legible at YES = ${(p * 100).toFixed(0)}%`, () => {
			const { container } = renderChart(pct(p), "collapsed");

			const yesLabel = container.querySelector(
				'[data-testid="terminal-label-yes"]',
			);
			const noLabel = container.querySelector(
				'[data-testid="terminal-label-no"]',
			);
			expect(yesLabel).not.toBeNull();
			expect(noLabel).not.toBeNull();

			const gap = Math.abs(labelPlotY(yesLabel) - labelPlotY(noLabel));

			// ⛔ POSITIVE CONTROL, AND IT IS THE WHOLE REASON THIS TEST IS
			// TRUSTWORTHY. Assert FIRST that the undisplaced positions really do
			// collide at this price — otherwise "the labels don't overlap" would
			// pass on a market where they never could, and the guard would be
			// certifying a rule it never exercised.
			const rawGap = Math.abs(yYesPx(pct(p)) - yNoPx(pct(p)));
			expect(rawGap).toBeLessThan(TERMINAL_LABEL_MIN_GAP);

			// The rule did its work.
			expect(gap).toBeGreaterThanOrEqual(TERMINAL_LABEL_MIN_GAP);
		});
	}

	it("leaves the labels alone when they do not collide", () => {
		// 65/35 — the ordinary case. A displacement here would be the rule
		// firing when it should not, which no "never overlap" assertion can see.
		const { container } = renderChart(pct(0.65), "collapsed");
		const yesLabel = container.querySelector(
			'[data-testid="terminal-label-yes"]',
		);
		const noLabel = container.querySelector(
			'[data-testid="terminal-label-no"]',
		);

		// ⚠ `toBeCloseTo`, NOT `toBe`, AND THE TOLERANCE IS THE CONVERSION'S NOT
		// THE RULE'S. `labelTopPct` expresses a plot y as a percentage of 320, so
		// the round trip back through `labelPlotY` carries ~1e-4 units of float
		// dust. Three decimal places is ~0.001 plot units — about 4e-4 CSS px on
		// the collapsed card, i.e. three orders of magnitude inside the 1px
		// alignment contract. Anything looser would start absorbing real
		// displacement, which is the thing this case exists to detect.
		expect(labelPlotY(yesLabel)).toBeCloseTo(yYesPx(pct(0.65)), 3);
		expect(labelPlotY(noLabel)).toBeCloseTo(yNoPx(pct(0.65)), 3);
	});

	it("moves the LABELS and never the DOTS", () => {
		// C-CHART-2 clause 4. A displaced label is still unambiguous — it is
		// token-coloured and adjacent to its own dot. A displaced DOT would be a
		// false statement about a price, on the surface where stake is committed.
		const { container } = renderChart(pct(0.5), "collapsed");

		const yesDot = container.querySelector('[data-testid="terminal-dot-yes"]');
		const noDot = container.querySelector('[data-testid="terminal-dot-no"]');

		expect(numAttr(yesDot, "cy")).toBe(yYesPx(pct(0.5)));
		expect(numAttr(noDot, "cy")).toBe(yNoPx(pct(0.5)));
		// Both at the true midline, coincident, exactly as the lines are.
		expect(numAttr(yesDot, "cy")).toBe(numAttr(noDot, "cy"));

		// …while the labels DID move. Without this the assertion above would also
		// pass on a build that displaced nothing at all.
		const yesLabel = container.querySelector(
			'[data-testid="terminal-label-yes"]',
		);
		expect(labelPlotY(yesLabel)).not.toBe(yYesPx(pct(0.5)));
	});

	it("each dot sits on the END OF ITS OWN LINE — the geometry half of INV-3", () => {
		// ⛔ THE COLOUR HALF IS NOT THE WHOLE OF IT, and `price-chart.test.tsx`
		// already learned that on the LINES: `line-tokens-bind-by-side-inv3` pins
		// the strokes AND then pins the geometry, because a `yYesPx`/`yNoPx` swap
		// in the two `<polyline>` calls keeps every stroke correct while inverting
		// the lines themselves. CHART-1's terminal dots are a NEW pair of elements
		// carrying the same swap risk and, until this case, only the colour half:
		// `binds YES→--graph-yes …` reads `fill` and never `cy`, and `moves the
		// LABELS and never the DOTS` reads `cy` only at 50 %, WHERE THE TWO
		// COORDINATES ARE EQUAL and a swap is therefore invisible. A swapped pair
		// paints the YES-token dot on the end of the NO-token line — a pole
		// inversion at the exact pixel the eye goes to.
		//
		// Asserted against the LINES rather than by recomputing `yYesPx`: the
		// component and a re-derivation share the helper, so a swap of the two
		// helpers at both call sites would agree with itself. The polyline's own
		// last point cannot.
		const { container } = renderChart(pct(0.65), "collapsed");

		const lastY = (testid: string): number => {
			const pts = (
				container
					.querySelector(`[data-testid="${testid}"]`)
					?.getAttribute("points") ?? ""
			)
				.split(" ")
				.filter((p) => p.length > 0);
			return Number(pts[pts.length - 1].split(",")[1]);
		};

		const yesDotY = numAttr(
			container.querySelector('[data-testid="terminal-dot-yes"]'),
			"cy",
		);
		const noDotY = numAttr(
			container.querySelector('[data-testid="terminal-dot-no"]'),
			"cy",
		);

		expect(yesDotY).toBe(lastY("line-yes"));
		expect(noDotY).toBe(lastY("line-no"));

		// POSITIVE CONTROL — the two coordinates must actually DIFFER at this
		// price, or the equalities above would hold under a swap as well. This is
		// exactly the condition 50 % fails to meet.
		expect(yesDotY).not.toBe(noDotY);
		// …and the semantic form: YES winning means the YES dot sits HIGHER.
		expect(yesDotY).toBeLessThan(noDotY);
	});

	it("holds the non-overlap rule across the WHOLE near-even band, not at three points", () => {
		// ⛔ THE BAND IS THE PRODUCT'S RESTING STATE. The gap between the two end
		// labels is `VIEWBOX_H · |2·YES − 1|`, so against `TERMINAL_LABEL_MIN_GAP`
		// the collision runs from 48.125 % to 51.875 % — every market at open, and
		// all eight seeded markets today. Three sample prices prove the rule fires;
		// they do not prove it fires EVERYWHERE it must, and the boundary (where an
		// off-by-one in the push arithmetic would live) is exactly where three
		// round numbers are not.
		//
		// One invariant, asserted at every tenth of a point across 48–52 %:
		// EITHER the raw positions were already legible and nothing moved, OR the
		// rule separated them to at least the minimum. Both halves matter — a build
		// that displaced labels which did not need it would satisfy "never overlap"
		// and still be wrong.
		let collided = 0;
		let untouched = 0;
		for (let bp = 4800; bp <= 5200; bp++) {
			const p = bp / 10000;
			const s = pct(p);
			const { container } = render(
				<MarketPriceChart
					series={seriesEndingAt(s)}
					mode="collapsed"
					isOpen={true}
				/>,
			);
			const y = {
				yes: labelPlotY(
					container.querySelector('[data-testid="terminal-label-yes"]'),
				),
				no: labelPlotY(
					container.querySelector('[data-testid="terminal-label-no"]'),
				),
			};
			const rawGap = Math.abs(yYesPx(s) - yNoPx(s));

			if (rawGap >= TERMINAL_LABEL_MIN_GAP) {
				untouched++;
				// ⚠ `toBeCloseTo` for the CONVERSION's float dust, not the rule's —
				// see the identical note in "leaves the labels alone". 1e-3 plot
				// units is ~4e-4 CSS px; the displacement this branch must not see
				// is 8 units.
				expect(y.yes).toBeCloseTo(yYesPx(s), 3);
				expect(y.no).toBeCloseTo(yNoPx(s), 3);
			} else {
				collided++;
				expect(Math.abs(y.yes - y.no)).toBeGreaterThanOrEqual(
					TERMINAL_LABEL_MIN_GAP,
				);
			}
			cleanup();
		}

		// POSITIVE CONTROL — the sweep must have exercised BOTH branches. A band
		// that happened to sit entirely on one side of the threshold would make the
		// loop above a very expensive way to assert nothing.
		expect(collided).toBeGreaterThan(0);
		expect(untouched).toBeGreaterThan(0);
	});

	it("keeps a DISPLACED label's box inside the plot", () => {
		// The collision branch — the only path `clampLabelY` currently sits on.
		// At 50/50 the push is 8 units off a midline at 160, so this is really a
		// bound on the push's magnitude: the rule may separate the pair, but never
		// by throwing a label out of the box on the way.
		const { container } = renderChart(pct(0.5), "collapsed");
		for (const id of ["terminal-label-yes", "terminal-label-no"]) {
			const y = labelPlotY(container.querySelector(`[data-testid="${id}"]`));
			expect(y - LABEL_HALF_BOX).toBeGreaterThanOrEqual(0);
			expect(y + LABEL_HALF_BOX).toBeLessThanOrEqual(VIEWBOX_H);
		}
	});

	it("keeps an UNDISPLACED label's box inside the plot at an extreme price", () => {
		// ⛔⛔ THIS IS THE ASSERTION THE PREVIOUS VERSION OF THIS CASE COULD NOT
		// MAKE, AND IT IS EXPECTED TO BE RED. It read:
		//
		//     renderChart(pct(0.92)) → expect(y >= 0 && y <= VIEWBOX_H)
		//
		// At 92 % the labels sit at 25.6 and 294.4 — nowhere near either edge —
		// and the bound was the viewBox itself rather than the label's BOX. So it
		// passed on any build whatsoever, including one with `clampLabelY` deleted
		// outright: no price, and no code change, could make it fail. It was named
		// for the clamp and never reached it, because `terminalLabelYs` returns
		// EARLY when the two labels do not collide and that early return is not
		// clamped.
		//
		// The property being asserted is `clampLabelY`'s own docblock, verbatim:
		// "Keep a label's centre far enough inside the plot that its 10px box
		// cannot clip on either edge (C-CHART-2 clause 3, 'clamped inside the
		// box')." Measured, the box clips above YES ≈ 98.44 % and below ≈ 1.56 %
		// — 99 % puts the YES label's centre at y = 3.2 and its cap line at about
		// −1.8, outside an `<svg>` that clips by default. A binary market a week
		// from resolution lives there.
		const { container } = renderChart(pct(0.99), "collapsed");
		for (const id of ["terminal-label-yes", "terminal-label-no"]) {
			const y = labelPlotY(container.querySelector(`[data-testid="${id}"]`));
			expect(y - LABEL_HALF_BOX).toBeGreaterThanOrEqual(0);
			expect(y + LABEL_HALF_BOX).toBeLessThanOrEqual(VIEWBOX_H);
		}
	});

	it("POSITIVE CONTROL — the box assertion passes on an ordinary price", () => {
		// Without this, the red above could be read as a broken assertion rather
		// than a real clip. 65/35 puts the labels at 112 and 208, both a long way
		// from either edge, and the identical check is green.
		const { container } = renderChart(pct(0.65), "collapsed");
		for (const id of ["terminal-label-yes", "terminal-label-no"]) {
			const y = labelPlotY(container.querySelector(`[data-testid="${id}"]`));
			expect(y - LABEL_HALF_BOX).toBeGreaterThanOrEqual(0);
			expect(y + LABEL_HALF_BOX).toBeLessThanOrEqual(VIEWBOX_H);
		}
	});

	it("the half-box constant is the type the component actually renders", () => {
		// `LABEL_HALF_BOX` is not a magic number — it is half the `text-[10px]`
		// the labels carry. Read off the rendered tree so a type-size change
		// reddens here rather than silently making the box assertions above
		// measure the wrong rectangle.
		const { container } = renderChart(pct(0.65), "collapsed");
		const gutter = container.querySelector(
			'[data-testid="terminal-label-gutter"]',
		);
		const gutterCls = gutter?.getAttribute("class") ?? "";
		expect(gutterCls).toContain(`text-[${LABEL_HALF_BOX * 2}px]`);

		// ⛔ `leading-none` IS ASSERTED, NOT ASSUMED, AND IT IS LOAD-BEARING TWICE
		// OVER. A Tailwind arbitrary `text-[10px]` does NOT reset the paired
		// line-height — it inherits whatever step was in scope, so the box would
		// be 16px tall around 10px type. That would (a) make this file's ±5
		// half-box wrong, and (b) make `-translate-y-1/2` centre the wrong box,
		// breaking the alignment contract by 3px while every number in the source
		// still read "10". Stating the leading beside an arbitrary size is the
		// rule; this asserts the rule was followed.
		expect(gutterCls).toContain("leading-none");

		for (const id of ["terminal-label-yes", "terminal-label-no"]) {
			const el = container.querySelector(`[data-testid="${id}"]`);
			// Centred ON its position rather than hanging below it.
			expect(el?.getAttribute("class") ?? "").toContain("-translate-y-1/2");
		}
	});

	it("draws coincident lines coincident — no offset is invented", () => {
		// C-CHART-2 clause 5, ruled deliberately against the tidier alternative.
		// On a market with no bets both lines ARE the same line; separating them
		// by a half pixel to look nicer would be a false statement about the data.
		const { container } = renderChart(pct(0.5), "collapsed");
		const yesLine = container.querySelector('[data-testid="line-yes"]');
		const noLine = container.querySelector('[data-testid="line-no"]');
		expect(yesLine?.getAttribute("points")).toBe(
			noLine?.getAttribute("points"),
		);
	});
});

describe("C-CHART-2 — the end label is bound to its own line's token", () => {
	// ⚠ V-4: this reads the RENDERED attribute off the element, not the source
	// file. jsdom does not resolve a CSS custom property, so what is proven is
	// that the component emits the correct TOKEN NAME on the correct element —
	// which is the binding C-CHART-2 and INV-3 actually rule on. Resolving the
	// value is the token census's job
	// (`tests/unit/design/tokens-monochrome.test.ts`), and it is a separate
	// guard on purpose: this one would still catch a swap even if the two tokens
	// ever held the same value.
	for (const mode of ["collapsed", "expanded", "hero"] as const) {
		it(`binds YES→--graph-yes and NO→--graph-no in ${mode} mode`, () => {
			const { container } = renderChart(pct(0.65), mode);

			// ⚠ TWO CARRIERS SINCE CHART-2, BECAUSE THE TWO MARKS NOW LIVE IN
			// DIFFERENT DOCUMENTS. The dots are SVG and carry `fill="var(--…)"`;
			// the labels are HTML in the gutter and carry the token in a Tailwind
			// arbitrary-colour class. Different attribute, identical binding — and
			// asserting both in one case is deliberate, because the failure this
			// guards is a SWAP, and a swap can be introduced on either carrier
			// alone.
			const svgPairs = [
				["terminal-dot-yes", "--graph-yes", "--graph-no"],
				["terminal-dot-no", "--graph-no", "--graph-yes"],
			] as const;
			for (const [id, own, opposite] of svgPairs) {
				const el = container.querySelector(`[data-testid="${id}"]`);
				expect(el).not.toBeNull();
				const fill = el?.getAttribute("fill") ?? "";
				expect(fill).toBe(`var(${own})`);
				// The inversion this repo has already shipped twice on live
				// participant surfaces.
				expect(fill).not.toContain(opposite);
				// And never the neutral the legend used, nor the `--color-*` slot
				// whose value-copy would invert the poles AND paint YES on the ground.
				expect(fill).not.toContain("n5");
				expect(fill).not.toContain("--color-");
			}

			const htmlPairs = [
				["terminal-label-yes", "--graph-yes", "--graph-no"],
				["terminal-label-no", "--graph-no", "--graph-yes"],
			] as const;
			for (const [id, own, opposite] of htmlPairs) {
				const el = container.querySelector(`[data-testid="${id}"]`);
				expect(el).not.toBeNull();
				const cls = el?.getAttribute("class") ?? "";
				expect(cls).toContain(`text-[color:var(${own})]`);
				expect(cls).not.toContain(opposite);
				expect(cls).not.toContain("text-n5");
				expect(cls).not.toContain("--color-");
			}
		});
	}

	it("renders the markers on every surface, the hero included", () => {
		for (const mode of ["collapsed", "expanded", "hero"] as const) {
			const { container } = renderChart(pct(0.6), mode);
			for (const id of [
				"terminal-dot-yes",
				"terminal-dot-no",
				"terminal-label-yes",
				"terminal-label-no",
			]) {
				expect(container.querySelector(`[data-testid="${id}"]`)).not.toBeNull();
			}
			cleanup();
		}
	});

	it("puts the labels OUTSIDE the svg, in an HTML gutter — C-CHART-2 clause 2", () => {
		// ⛔ THE ASSERTION THAT WOULD HAVE MADE CHART-2 UNNECESSARY IF IT HAD
		// EXISTED. The whole defect was 10px type living inside a box that
		// `preserveAspectRatio="none"` stretches by a different factor on every
		// surface. Nothing can be inside that box and be 10px everywhere, so the
		// guard is structural: the label elements must not be descendants of the
		// `<svg>` at all. A future "tidy-up" that moves them back reddens here
		// before anyone has to re-measure a font.
		const { container } = renderChart(pct(0.65), "collapsed");
		const svg = container.querySelector('[data-testid="market-price-chart"]');
		const gutter = container.querySelector(
			'[data-testid="terminal-label-gutter"]',
		);
		expect(svg).not.toBeNull();
		expect(gutter).not.toBeNull();

		for (const id of ["terminal-label-yes", "terminal-label-no"]) {
			const el = container.querySelector(`[data-testid="${id}"]`);
			expect(el).not.toBeNull();
			// Not in the stretched space…
			expect(svg?.contains(el as Node)).toBe(false);
			// …and in the gutter that sits beside it.
			expect(gutter?.contains(el as Node)).toBe(true);
			// An HTML element, not an SVG one — `<text>` inside a foreignObject
			// would satisfy "not a descendant of svg" on a careless selector.
			expect(el?.namespaceURI).toBe("http://www.w3.org/1999/xhtml");
		}

		// POSITIVE CONTROL — the same `contains` check finds a node that IS inside
		// the svg, so `false` above means "outside", not "broken query".
		const dot = container.querySelector('[data-testid="terminal-dot-yes"]');
		expect(svg?.contains(dot as Node)).toBe(true);
	});

	it("the viewBox reserves a DOT ALLOWANCE only — the label gutter is gone from it", () => {
		// C-CHART-2 clause 3 as amended at CHART-2. The viewBox is still WIDER
		// than the plot, because the terminal circle is centred at `cx =
		// VIEWBOX_W` and would otherwise half-clip — but only by the dot's own
		// radius plus a hair, not by 38 units of room for text.
		const { container } = renderChart(pct(0.65), "collapsed");
		const svg = container.querySelector('[data-testid="market-price-chart"]');
		const [, , w, h] = (svg?.getAttribute("viewBox") ?? "")
			.split(" ")
			.map(Number);

		expect(h).toBe(VIEWBOX_H);
		expect(w).toBe(SVG_W);
		// Wide enough that the dot cannot clip…
		expect(w).toBeGreaterThanOrEqual(VIEWBOX_W + TERMINAL_DOT_R);
		// …and no wider than the dot needs. 38 units of label gutter would fail
		// this, which is the regression it exists to catch.
		expect(w - VIEWBOX_W).toBeLessThanOrEqual(TERMINAL_DOT_R + 2);
	});

	for (const mode of ["collapsed", "expanded", "hero"] as const) {
		it(`${mode}: a label's centre lands on its dot's cy — the alignment contract`, () => {
			// ⛔ THE TASK'S CENTRAL RISK. The dot is placed in the SVG's stretched
			// user space; the label is placed in CSS space beside it. Those are two
			// different coordinate systems, and "a value computed in one and
			// consumed in another" is precisely how CHART-1's regression happened.
			// If the bridge is wrong the label drifts off its dot — and it drifts by
			// a different amount on every surface, so it would look fine wherever it
			// was checked and wrong everywhere else.
			//
			// ⚠ 65 % IS CHOSEN, NOT ARBITRARY. `terminalLabelYs` returns the dot's
			// own y only when the two labels do NOT collide; inside the 48–52 % band
			// it deliberately pushes them apart (clause 4), where label ≠ dot is the
			// CORRECT answer. Asserting alignment there would assert the opposite of
			// the rule. At 65 % the raw gap is 96 units, eight times the minimum, so
			// the labels are untouched and the bridge is the only thing under test.
			// The positive control below proves that precondition rather than
			// assuming it.
			const { container } = renderChart(pct(0.65), mode);

			const rawGap = Math.abs(yYesPx(pct(0.65)) - yNoPx(pct(0.65)));
			expect(rawGap).toBeGreaterThan(TERMINAL_LABEL_MIN_GAP);

			for (const side of ["yes", "no"] as const) {
				const dotCy = numAttr(
					container.querySelector(`[data-testid="terminal-dot-${side}"]`),
					"cy",
				);
				const labelY = labelPlotY(
					container.querySelector(`[data-testid="terminal-label-${side}"]`),
				);
				// Agreement in PLOT UNITS is strictly stronger than the 1px contract:
				// one plot unit is 0.43 CSS px on the collapsed card and 1.33 on the
				// expanded overlay, so 0.001 units is under a thousandth of a pixel
				// on every surface.
				expect(labelY).toBeCloseTo(dotCy, 3);
			}
		});
	}

	it("the alignment is WIDTH-INDEPENDENT by construction, not by coincidence", () => {
		// ⛔ WHY THERE IS NO WIDTH SWEEP IN THIS FILE, stated rather than left as a
		// gap. jsdom performs no layout, so no assertion here can render at three
		// widths and measure three boxes — the numbers would all be zero. What CAN
		// be proven here is the stronger, structural claim underneath the sweep:
		// the label's position is expressed as a PERCENTAGE of the plot's height,
		// and the dot's `cy` is the same fraction of the same viewBox height, so
		// the two track each other at every box size there is. A pixel offset
		// would have needed the box's height and could only have been right at one.
		//
		// The rendered measurement across five widths — 1024/1280/1440/1600/1920,
		// the sweep that showed the hero's uniformity was a coincidence — is taken
		// in the CHART-2 contact sheet, in a real browser, and reported there.
		const { container } = renderChart(pct(0.65), "collapsed");
		for (const side of ["yes", "no"] as const) {
			const dotCy = numAttr(
				container.querySelector(`[data-testid="terminal-dot-${side}"]`),
				"cy",
			);
			// ⛔ READ OFF THE SHIPPED MARKUP, NOT `element.style.top`, AND THE REASON
			// IS A jsdom LIMITATION THAT WOULD OTHERWISE READ AS A PRODUCT DEFECT.
			// jsdom's CSSOM (cssstyle) does not parse nested CSS math, so assigning
			// `clamp(5px, min(…), calc(…))` through `node.style.top` is REJECTED and
			// the property comes back as the empty string. Browsers accept it — and
			// so does the server render, which is what actually ships. Asserting the
			// live CSSOM here would have concluded the position was missing when it
			// is present in the HTML and honoured in Chrome (verified in the CHART-2
			// contact sheet).
			const top =
				renderToStaticMarkup(
					<MarketPriceChart
						series={seriesEndingAt(pct(0.65))}
						mode="collapsed"
						isOpen={true}
					/>,
				).match(
					new RegExp(`terminal-label-${side}[^>]*style="top:([^"]*)"`),
				)?.[1] ?? "";

			// The position is expressed in PERCENT, which is what makes it
			// box-agnostic. A pixel offset would have needed the box's height —
			// unknown at render on a server-rendered tree — and could only have been
			// right at one size.
			expect(top).toMatch(/\d+(\.\d+)?%/);

			// ⛔ AND IT IS FLOORED IN CSS PIXELS, WHICH PERCENT ALONE CANNOT DO.
			// Clause 4's threshold is 12 PLOT units; the label's box is 10 CSS px;
			// on this card a plot unit is 0.428 px, so the plot-space rule delivers
			// 5.14 px of separation between two 10 px boxes and they overlap. The
			// `min`/`max` term against the midline is the floor that fixes it, and
			// the outer `clamp` is the same fix for the top and bottom edges. Both
			// are asserted here because a "tidy-up" back to a bare `N%` would
			// reintroduce a defect nothing else in jsdom can see.
			expect(top).toMatch(/clamp\(/);
			expect(top).toMatch(/(min|max)\(/);
			expect(top).toContain("50%");

			// …and the percentage term is still the SAME fraction the dot sits at,
			// so the floor is a floor and not a second opinion about where the
			// label belongs.
			const firstPct = Number.parseFloat(
				(top ?? "").match(/(\d+(?:\.\d+)?)%/)?.[1] ?? "",
			);
			expect(firstPct).toBeCloseTo((dotCy / VIEWBOX_H) * 100, 3);
		}
	});

	it("the legend C-CHART-1 clause 3 ratified is gone, not restyled", () => {
		// The supersession, asserted rather than assumed. A "tidy-up" that puts a
		// key back above the plot reintroduces the second answer to a question the
		// end labels already answer at the point of use.
		const { container } = renderChart(pct(0.65), "expanded");
		expect(container.querySelector("ul")).toBeNull();
		// POSITIVE CONTROL — the query style finds real elements in this tree, so
		// the null above means "absent", not "wrong selector".
		expect(container.querySelector("svg")).not.toBeNull();
	});
});
