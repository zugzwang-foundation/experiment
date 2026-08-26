// @vitest-environment jsdom

import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
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

/** Half the rendered height of one end label, in viewBox user units — the
 * labels carry `text-[10px]` and are centred by `dominantBaseline="middle"`, so
 * the box the `y` attribute sits in the middle of spans `y ± 5`. Pinned against
 * the component's own class by the last case in this describe block, so it can
 * never drift from the type actually rendered. */
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
	return render(<MarketPriceChart series={seriesEndingAt(yes)} mode={mode} />);
}

function numAttr(el: Element | null, name: string): number {
	return Number(el?.getAttribute(name));
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

			const gap = Math.abs(numAttr(yesLabel, "y") - numAttr(noLabel, "y"));

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

		expect(numAttr(yesLabel, "y")).toBe(yYesPx(pct(0.65)));
		expect(numAttr(noLabel, "y")).toBe(yNoPx(pct(0.65)));
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
		expect(numAttr(yesLabel, "y")).not.toBe(yYesPx(pct(0.5)));
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
				<MarketPriceChart series={seriesEndingAt(s)} mode="collapsed" />,
			);
			const y = {
				yes: numAttr(
					container.querySelector('[data-testid="terminal-label-yes"]'),
					"y",
				),
				no: numAttr(
					container.querySelector('[data-testid="terminal-label-no"]'),
					"y",
				),
			};
			const rawGap = Math.abs(yYesPx(s) - yNoPx(s));

			if (rawGap >= TERMINAL_LABEL_MIN_GAP) {
				untouched++;
				expect(y.yes).toBe(yYesPx(s));
				expect(y.no).toBe(yNoPx(s));
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
			const y = numAttr(container.querySelector(`[data-testid="${id}"]`), "y");
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
			const y = numAttr(container.querySelector(`[data-testid="${id}"]`), "y");
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
			const y = numAttr(container.querySelector(`[data-testid="${id}"]`), "y");
			expect(y - LABEL_HALF_BOX).toBeGreaterThanOrEqual(0);
			expect(y + LABEL_HALF_BOX).toBeLessThanOrEqual(VIEWBOX_H);
		}
	});

	it("the half-box constant is the type the component actually renders", () => {
		// `LABEL_HALF_BOX` is not a magic number — it is half the `text-[10px]`
		// the labels carry, centred by `dominantBaseline="middle"`. Read off the
		// element so a type-size change reddens here rather than silently making
		// the three box assertions above measure the wrong rectangle.
		const { container } = renderChart(pct(0.65), "collapsed");
		for (const id of ["terminal-label-yes", "terminal-label-no"]) {
			const el = container.querySelector(`[data-testid="${id}"]`);
			expect(el?.getAttribute("class") ?? "").toContain(
				`text-[${LABEL_HALF_BOX * 2}px]`,
			);
			expect(el?.getAttribute("dominant-baseline")).toBe("middle");
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

			const pairs = [
				["terminal-label-yes", "--graph-yes", "--graph-no"],
				["terminal-label-no", "--graph-no", "--graph-yes"],
				["terminal-dot-yes", "--graph-yes", "--graph-no"],
				["terminal-dot-no", "--graph-no", "--graph-yes"],
			] as const;

			for (const [id, own, opposite] of pairs) {
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

	it("puts the labels in the gutter, right of the plot, and never inside it", () => {
		// C-CHART-2 clause 3 — the gutter is taken from the viewBox, so the plot
		// keeps its 2:1 aspect and every plotted x is unchanged. If a later change
		// narrows the plot to make room instead, this reddens.
		const { container } = renderChart(pct(0.65), "collapsed");
		const svg = container.querySelector('[data-testid="market-price-chart"]');
		const [, , w, h] = (svg?.getAttribute("viewBox") ?? "")
			.split(" ")
			.map(Number);

		expect(h).toBe(VIEWBOX_H);
		expect(w).toBeGreaterThan(VIEWBOX_W);

		for (const id of ["terminal-label-yes", "terminal-label-no"]) {
			const x = numAttr(container.querySelector(`[data-testid="${id}"]`), "x");
			expect(x).toBeGreaterThan(VIEWBOX_W);
			expect(x).toBeLessThan(w);
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
