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

	it("clamps both labels inside the plot at the extremes", () => {
		// 92/8 — labels near the ceiling and the floor. They must not clip.
		const { container } = renderChart(pct(0.92), "collapsed");
		for (const id of ["terminal-label-yes", "terminal-label-no"]) {
			const y = numAttr(container.querySelector(`[data-testid="${id}"]`), "y");
			expect(y).toBeGreaterThanOrEqual(0);
			expect(y).toBeLessThanOrEqual(VIEWBOX_H);
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
