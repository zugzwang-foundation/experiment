// @vitest-environment jsdom

import { render } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
	gridlinesFor,
	labelTopPct,
	SVG_W,
	VIEWBOX_H,
	VIEWBOX_W,
} from "@/components/debate/chart/geometry";
import { MarketPriceChart } from "@/components/debate/chart/MarketPriceChart";
import { PriceBar } from "@/components/debate/PriceBar";
import type { PricePoint } from "@/server/discovery/price-series";

// CHART-5 — the Y scale (`C-CHART-1` clause 1 and `C-CHART-2` clause 2, both as
// amended at CHART-5).
//
// ⛔ WHAT THIS FILE CAN AND CANNOT SEE. jsdom performs no layout, so every
// rendered-pixel claim — where the collision boundary actually falls, whether a
// mark's box clears the plot edge — is measured in the CHART-5 contact sheet and
// NOT here. What this file pins is the structural half: which elements exist per
// mode, in what order, bound to which token, carrying which arithmetic. That
// split is `alignment-chain.test.tsx`'s and is followed deliberately rather than
// reinvented.

// The three type values the end label's box is composed from. Mirrored from
// `MarketPriceChart.tsx` deliberately rather than exported: a guard that imported
// the constants it checks would agree with the component by construction, which
// is the "comparing a value to itself" failure this file exists to avoid. If
// these drift from the component the composed assertions below go red, which is
// the intended signal.
const LABEL_NAME_PX = 10;
const LABEL_VALUE_PX = 16;
const LABEL_STACK_GAP_PX = 2;

const D = (n: number) => n.toFixed(18);

/** A series walking from 50 % to `end` across the window, `n` points. */
function series(end: number, n = 8): PricePoint[] {
	return Array.from({ length: n }, (_, i) => ({
		at: new Date(Date.UTC(2026, 7, 22 + i)).toISOString(),
		yes: D(0.5 + (end - 0.5) * (i / Math.max(1, n - 1))),
	}));
}

function markup(mode: "collapsed" | "expanded" | "hero", end = 0.65): string {
	return renderToStaticMarkup(
		<MarketPriceChart series={series(end)} mode={mode} isOpen={true} />,
	);
}

describe("C-CHART-1 clause 1 (CHART-5) — the gridline set is a pure function of the MODE", () => {
	it("collapsed gets the quarters, expanded gets every ten, the hero gets none", () => {
		expect(gridlinesFor("collapsed").map((g) => g.pct)).toEqual([
			25, 50, 75, 100,
		]);
		expect(gridlinesFor("expanded").map((g) => g.pct)).toEqual([
			0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100,
		]);
		expect(gridlinesFor("hero")).toEqual([]);
	});

	it("the y of each line is its percent on the fixed 0–100 % scale, top-down", () => {
		// 100 % is the TOP of the plot (y = 0) and 0 % the bottom (y = VIEWBOX_H).
		// A guard that only counted lines would pass against a scale drawn upside
		// down, which is a chart that reads every market backwards.
		const g = gridlinesFor("expanded");
		expect(g[0]).toEqual({ pct: 0, y: VIEWBOX_H });
		expect(g[g.length - 1]).toEqual({ pct: 100, y: 0 });
		expect(g.find((x) => x.pct === 50)?.y).toBe(VIEWBOX_H / 2);
		// …and no coordinate carries binary-float dust into the markup.
		for (const line of g) {
			expect(String(line.y)).not.toMatch(/\d{6,}/);
		}
	});

	it("the SAME ARRAY IDENTITY comes back every call — computed once, never per render", () => {
		// ⛔ THE "NEVER PER-POINT, NEVER PER-RENDER" CLAUSE, ASSERTED RATHER THAN
		// ASSUMED. A `gridlinesFor` that rebuilt its array would satisfy every
		// other test in this file and quietly do work proportional to renders.
		// Referential equality is the only thing that can tell the difference.
		expect(gridlinesFor("expanded")).toBe(gridlinesFor("expanded"));
		expect(gridlinesFor("collapsed")).toBe(gridlinesFor("collapsed"));
	});

	it("the set does not move when the DATA moves", () => {
		// The whole clause: a gridline marks a position on a fixed scale, so two
		// markets at opposite extremes must produce byte-identical grid markup.
		const grid = (m: string) => {
			const st = m.indexOf('<g data-testid="chart-gridlines"');
			return st < 0 ? "" : m.slice(st, m.indexOf("</g>", st) + 4);
		};
		const a = grid(markup("expanded", 0.01));
		const b = grid(markup("expanded", 0.99));
		// NON-VACUITY: with the group absent both slices are `""` and `"" === ""`
		// passes. The equality below proves nothing without this line.
		expect(a.length).toBeGreaterThan(0);
		expect(a).toBe(b);
	});

	it("renders exactly the mode's set, and the hero renders no group at all", () => {
		const collapsed = markup("collapsed");
		const expanded = markup("expanded");
		const hero = markup("hero");

		const pcts = (m: string) =>
			[...m.matchAll(/<line data-pct="(\d+)"/g)].map((x) => Number(x[1]));
		expect(pcts(collapsed)).toEqual([25, 50, 75, 100]);
		expect(pcts(expanded)).toEqual([
			0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100,
		]);

		// MUST REJECT: any gridline on the hero — its box is ~96px and eleven
		// lines in it reduce to hatching.
		expect(hero).not.toContain('data-testid="chart-gridlines"');
		expect(pcts(hero)).toEqual([]);
		// POSITIVE CONTROL — the same matcher finds lines when they exist, so the
		// empty result above is "absent", not "my pattern is wrong".
		expect(pcts(collapsed).length).toBe(4);
	});

	it("is drawn BEHIND the series — the group precedes both polylines", () => {
		// Gridlines painted over a polyline read as the polyline being dashed.
		const m = markup("expanded");
		const g = m.indexOf('data-testid="chart-gridlines"');
		expect(g).toBeGreaterThan(-1);
		expect(g).toBeLessThan(m.indexOf('data-testid="line-no"'));
		expect(g).toBeLessThan(m.indexOf('data-testid="line-yes"'));
	});

	it("spans the PLOT, not the viewBox — the dot allowance is not grid", () => {
		// The viewBox is `SVG_W` wide (plot + terminal allowance). A gridline that
		// ran to SVG_W would underline the dot allowance, which is not plot.
		const m = markup("expanded");
		expect(m).toContain(`x2="${VIEWBOX_W}"`);
		// Derived, not literal: `TERMINAL_DOT_ALLOWANCE` is computed from the pulse
		// peak, so a hard-coded `VIEWBOX_W + 9` would silently stop naming the
		// viewBox the moment that peak moved (`O-8`, one unit over).
		expect(m).not.toContain(`x2="${SVG_W}"`);
	});
});

describe("CHART-5 — no new token, and no raw hex", () => {
	it("the grid binds to an EXISTING neutral ramp step by name", () => {
		const m = markup("expanded");
		const gStart = m.indexOf('<g data-testid="chart-gridlines"');
		// ⚠ BOUNDED AT ITS OWN `</g>`. The first draft of this sliced to the end of
		// the document, swallowed both polylines, and reddened on THEIR
		// `--graph-*` strokes — a guard that reported the right verdict about the
		// wrong markup.
		const group = m.slice(gStart, m.indexOf("</g>", gStart) + 4);
		const head = group.slice(0, group.indexOf(">") + 1);

		// ⛔ ASSERTED ON THE TOKEN REFERENCE, WHICH IS WHAT SHIPS. The 11-token
		// census (`tokens-monochrome.test.ts`) is a CORRECTNESS guard, not a style
		// one: minting `--color-grid` would red it. `--color-n2` is the step the
		// x-axis ticks already use, so the two axes read as one grid.
		expect(head).toContain('stroke="var(--color-n2)"');
		// MUST REJECT: a raw hex, or a side pole. `--color-yes` is aliased to the
		// page ground in this repo, so a value-copy would render the mark
		// invisible AND invert the poles (INV-3).
		expect(group).not.toMatch(/#[0-9a-fA-F]{3,8}/);
		expect(group).not.toContain("--color-yes");
		expect(group).not.toContain("--color-no");
		expect(group).not.toContain("--graph-");

		// POSITIVE CONTROL — the hex matcher finds a hex when one is present.
		expect('stroke="#404040"').toMatch(/#[0-9a-fA-F]{3,8}/);
	});

	it("the numeric marks carry no raw hex either", () => {
		const m = markup("expanded");
		const col = m.slice(
			m.indexOf('data-testid="chart-y-marks"'),
			m.indexOf('data-testid="terminal-label-gutter"'),
		);
		expect(col.length).toBeGreaterThan(0);
		expect(col).not.toMatch(/#[0-9a-fA-F]{3,8}/);
	});
});

describe("C-CHART-1 clause 1 (CHART-5) — numeric marks are EXPANDED-ONLY", () => {
	it("eleven marks on the overlay, none on the card, none on the hero", () => {
		const expanded = markup("expanded");
		const marks = (m: string) =>
			[...m.matchAll(/data-testid="y-mark-(\d+)"/g)].map((x) => Number(x[1]));

		expect(marks(expanded)).toEqual([
			0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100,
		]);

		// MUST REJECT: numbers on the collapsed card. It DOES carry gridlines and
		// deliberately carries no figures — its box is 164px and already holds
		// three date labels along the bottom. Deriving marks from the gridline set
		// alone would have given it four numbers nobody ruled for.
		expect(markup("collapsed")).not.toContain('data-testid="chart-y-marks"');
		expect(marks(markup("collapsed"))).toEqual([]);
		expect(markup("hero")).not.toContain('data-testid="chart-y-marks"');
	});

	it("the marks column is SIZED, never pinned — the CHART-2 mechanism, reused", () => {
		const { container } = render(
			<MarketPriceChart series={series(0.65)} mode="expanded" isOpen={true} />,
		);
		const col = container.querySelector('[data-testid="chart-y-marks"]');
		expect(col).not.toBeNull();
		// MUST REJECT: a hand-measured `w-[22px]`, which is the defect CHART-2
		// deleted for the label gutter, reintroduced one column over.
		expect(col?.getAttribute("class") ?? "").not.toMatch(/(^|\s)w-\[/);
		expect((col as HTMLElement | null)?.style.width ?? "").toBe("");
		// …and the in-flow sizer that replaces it is present and INVISIBLE rather
		// than `hidden` — `hidden` removes the box and collapses the column.
		const sizer = col?.querySelector(':scope > span[aria-hidden="true"]');
		const sc = sizer?.getAttribute("class") ?? "";
		expect(sc.split(/\s+/)).toContain("invisible");
		expect(sc.split(/\s+/)).not.toContain("hidden");
		expect(sizer?.textContent).toBe("100");
	});

	it("does not disturb the label gutter's own contract", () => {
		// ⛔ THIS IS THE REGRESSION THAT ACTUALLY HAPPENED AT CHART-5, PINNED. The
		// first implementation put the marks INSIDE the label gutter, which forced
		// it from `relative` to `flex` and pushed its width-sizer one level down —
		// breaking `alignment-chain.test.tsx`'s clause-2-link-4 and clause-3
		// guards. Those guards were right and the structure was wrong. The marks
		// are a sibling column now, and this asserts the gutter stayed as it was.
		const { container } = render(
			<MarketPriceChart series={series(0.65)} mode="expanded" isOpen={true} />,
		);
		const gutter = container.querySelector(
			'[data-testid="terminal-label-gutter"]',
		);
		expect((gutter?.getAttribute("class") ?? "").split(/\s+/)).toContain(
			"relative",
		);
		// The sizer is still the gutter's DIRECT in-flow child and still leads with
		// the name; since the MED-7 fix it also carries the widest value beneath,
		// so this asserts the structure rather than the flattened string — which is
		// what `textContent` equality was really standing in for.
		const sizer = gutter?.querySelector(':scope > span[aria-hidden="true"]');
		expect(sizer).not.toBeNull();
		const blocks = [...(sizer?.querySelectorAll(":scope > span") ?? [])].map(
			(x) => x.textContent,
		);
		expect(blocks).toEqual(["YES", "100%"]);
		// …and on a one-line mode it is the name alone.
		const { container: c2 } = render(
			<MarketPriceChart series={series(0.65)} mode="collapsed" isOpen={true} />,
		);
		expect(
			[
				...(c2
					.querySelector(
						'[data-testid="terminal-label-gutter"] > span[aria-hidden="true"]',
					)
					?.querySelectorAll(":scope > span") ?? []),
			].map((x) => x.textContent),
		).toEqual(["YES"]);
	});
});

describe("C-CHART-2 clause 2 (CHART-5) — the end value can never disagree with PriceBar", () => {
	// ⛔ THE TIE IS THE CASE THAT DISCRIMINATES, and without it this guard is
	// decoration. `0.525` is an exact `.xx5`: under §10.8's PAIRED rule it renders
	// 53 % / 47 %, and under independent per-side half-up rounding it renders
	// 53 % / 48 % — a pair summing to 101 %. Any fixture away from a tie passes
	// under both rules and proves nothing about which one shipped.
	// ⛔ LITERAL 18-dp STRINGS, NEVER `toFixed` OF A JS FLOAT — and this correction
	// is the difference between a discriminating control and a decorative one.
	// `(0.525).toFixed(18)` is `"0.525000000000000022"` and its complement is
	// `"0.474999999999999978"`, whose third decimal is a **4**. The float
	// round-trip DESTROYS the exact `.xx5`, so the fixture could not produce the
	// 101 % pair it was written to catch: measured, a chart deriving NO by exact
	// decimal complement plus independent half-up rounding stayed GREEN against
	// it, and only reddened against the literal below. Caught by `@test-writer`.
	// The same literal form is already used at `price-percent-pair.test.tsx:29`.
	const cases: { label: string; yes: string; no: string }[] = [
		{
			label: "tie — the exact .xx5, where independent rounding prints 101 %",
			yes: "0.525000000000000000",
			no: "0.475000000000000000",
		},
		{
			label: "ordinary",
			yes: "0.650000000000000000",
			no: "0.350000000000000000",
		},
		{
			label: "extreme",
			yes: "0.990000000000000000",
			no: "0.010000000000000000",
		},
		{ label: "even", yes: "0.500000000000000000", no: "0.500000000000000000" },
	];

	for (const c of cases) {
		it(`${c.label}: the overlay's value equals the bar's, both READ FROM THE DOM`, () => {
			const pricing = { yes: c.yes, no: c.no };

			// ⚠ TWO SEPARATE RENDERS, TWO SEPARATE DOM READS. Comparing a value to
			// itself — asserting the chart's number against `formatPricePercent`
			// called again in the test — would pass against a chart that renders
			// nothing at all. Both sides here are `textContent` off a rendered tree.
			// ⚠ `pick` IS REQUIRED FOR THE TESTIDS TO EXIST. `PriceLabel` only
			// carries `data-testid="price-label-*"` in its interactive branch; the
			// plain-text branch Discovery uses has none. Without this the queries
			// return null, every value reads `undefined`, and a careless guard
			// would compare `undefined` to `undefined` and PASS. This is the
			// market-detail configuration, which is the surface that shows both.
			const bar = render(
				<PriceBar
					pricing={pricing}
					size="detail"
					pick={{
						heldSide: null,
						marketOpen: true,
						suspended: false,
						onPick: () => {},
					}}
				/>,
			);
			// ⚠ THE BAR'S LABEL READS "YES 53%" — the side NAME is part of its text,
			// so the percent is extracted rather than compared whole. Extraction is
			// narrow on purpose (`\d{1,3}%`) and the non-vacuity check below proves
			// it actually found something; a looser `includes` would let a bar
			// rendering nothing satisfy a chart rendering nothing.
			const pct = (el: Element | null): string | undefined =>
				el?.textContent?.match(/\d{1,3}%/)?.[0];
			const barYes = pct(
				bar.container.querySelector('[data-testid="price-label-YES"]'),
			);
			const barNo = pct(
				bar.container.querySelector('[data-testid="price-label-NO"]'),
			);

			const chart = render(
				<MarketPriceChart
					series={[{ at: "2026-08-25T00:00:00.000Z", yes: c.yes }]}
					mode="expanded"
					isOpen={true}
				/>,
			);
			const chartYes = chart.container
				.querySelector('[data-testid="terminal-value-yes"]')
				?.textContent?.trim();
			const chartNo = chart.container
				.querySelector('[data-testid="terminal-value-no"]')
				?.textContent?.trim();

			// Non-vacuity: all four actually rendered something percent-shaped.
			for (const v of [barYes, barNo, chartYes, chartNo]) {
				expect(v).toMatch(/^\d{1,3}%$/);
			}
			expect(chartYes).toBe(barYes);
			expect(chartNo).toBe(barNo);
			// And the pair sums to exactly 100 — the property independent rounding
			// breaks and the reason the paired formatter exists.
			expect(
				Number(chartYes?.replace("%", "")) + Number(chartNo?.replace("%", "")),
			).toBe(100);
		});
	}

	it("the value is EXPANDED-ONLY — the card and hero keep the name alone", () => {
		for (const mode of ["collapsed", "hero"] as const) {
			const m = markup(mode);
			expect(m).not.toContain('data-testid="terminal-value-yes"');
			expect(m).not.toContain('data-testid="terminal-value-no"');
			// …but the NAME is still there, so the absence above is the value's,
			// not the whole label's.
			expect(m).toContain('data-testid="terminal-label-yes"');
		}
		expect(markup("expanded")).toContain('data-testid="terminal-value-yes"');
	});
});

describe("C-CHART-2 clause 4 (CHART-5) — one collision rule, two measured inputs", () => {
	it("the overlay's floor is the TALLER two-line box; the others are unchanged", () => {
		// The half-box is composed from the type the label is actually made of:
		// one line → 10/2 = 5; two lines → (10 + 2 + 16)/2 = 14. Asserted through
		// the CSS the component emits, because that string IS the rule at runtime.
		// ⛔ READ OFF THE MARKUP, NOT OFF THE DOM, AND THIS IS A TRAP THAT COST THIS
		// FILE A ROUND OF FALSE REDS. jsdom's CSS parser does not understand
		// `clamp()` / `min()` / `max()`, so assigning one through React's style
		// object is silently DROPPED — `getAttribute("style")` comes back EMPTY.
		// An assertion written that way cannot distinguish "the rule is missing"
		// from "the runner cannot represent it", and the inverse form
		// (`not.toContain`) would PASS against a component that emits no style at
		// all. `renderToStaticMarkup` serialises the string React actually ships.
		// ⛔ THE `style` ATTRIBUTE ALONE, AND BOTH LABELS. The first version sliced
		// the whole opening tag and asserted `toContain("5px")` — which the class
		// `left-[5px]` satisfies, so a label with NO vertical positioning at all
		// passed. And it read only `terminal-label-yes`, which at a 0.5 fixture is
		// always the UPPER one, so `lowerTop` was never observed: giving the lower
		// label the one-line floor while the upper kept 14 stayed green, an
		// asymmetric rule that overlaps exactly at the midline where every market
		// rests. Both caught by `@test-writer`.
		const topsOf = (mode: "collapsed" | "expanded" | "hero") => {
			const m = markup(mode, 0.5);
			return (["yes", "no"] as const).map((side) => {
				const re = new RegExp(
					`terminal-label-${side}"[^>]*style="top:([^"]*)"`,
				);
				const hit = m.match(re);
				expect(hit, `${mode}/${side} has no top style`).not.toBeNull();
				return hit?.[1] ?? "";
			});
		};

		// Composed, never a literal — see the sibling test for why.
		const expandedHalf =
			(LABEL_NAME_PX + LABEL_STACK_GAP_PX + LABEL_VALUE_PX) / 2;
		for (const top of topsOf("expanded")) {
			expect(top).toContain(`clamp(${expandedHalf}px,`);
			expect(top).toContain(`calc(100% - ${expandedHalf}px)`);
		}
		// MUST REJECT: the overlay's wider threshold leaking onto a one-line label.
		for (const mode of ["collapsed", "hero"] as const) {
			for (const top of topsOf(mode)) {
				expect(top).toContain(`clamp(${LABEL_NAME_PX / 2}px,`);
				expect(top).not.toContain(`${expandedHalf}px`);
			}
		}
	});

	it("clause 4's own plot-space arithmetic is untouched", () => {
		// The CSS floor is layered ON TOP of `terminalLabelYs`, never replacing it.
		// `data-plot-y` is that function's raw output, and it must be identical on
		// every mode for the same price — the mode changes the CSS floor only.
		const plotY = (mode: "collapsed" | "expanded" | "hero") => {
			const { container } = render(
				<MarketPriceChart series={series(0.5)} mode={mode} isOpen={true} />,
			);
			return [
				container
					.querySelector('[data-testid="terminal-label-yes"]')
					?.getAttribute("data-plot-y"),
				container
					.querySelector('[data-testid="terminal-label-no"]')
					?.getAttribute("data-plot-y"),
			];
		};
		expect(plotY("expanded")).toEqual(plotY("collapsed"));
		expect(plotY("expanded")).toEqual(plotY("hero"));
	});

	it("marks get the EDGE clamp and no collision term", () => {
		// Gridline marks are evenly spaced and can never converge, so a `min`/`max`
		// pivot on 50 % would be a second collision rule — which this task is
		// forbidden to write. What they DO need is the edge floor: the 0 and 100
		// marks sit exactly on the plot's boundaries, and the gutter does not clip.
		// Markup, not DOM — see the jsdom `clamp()` note above.
		const m = markup("expanded");
		const at = m.indexOf('data-testid="y-mark-100"');
		const style = m.slice(at, m.indexOf(">", at));
		expect(style).toContain("clamp(");
		expect(style).not.toContain("min(");
		expect(style).not.toContain("max(");
		// POSITIVE CONTROL — the END LABEL, which DOES carry the collision term.
		// Without this, "no min/max here" is equally consistent with "no style
		// survived the render at all".
		const lat = m.indexOf('data-testid="terminal-label-yes"');
		expect(m.slice(lat, m.indexOf(">", lat))).toMatch(/min\(|max\(/);
	});
});

describe("CHART-5 — a mark is BOUND to its gridline, and the column obeys the alignment contract", () => {
	it("every numeric mark's top IS its own gridline's y", () => {
		// ⛔ THE GUARD THIS FILE WAS MISSING, AND ITS ABSENCE LET THE SCALE RENDER
		// UPSIDE DOWN. Pinning the mark SET, the mark STYLE SHAPE and the gridline
		// Y VALUES separately never says that mark N and gridline N describe the
		// same height — so `markTop(g.pct)` in place of `markTop(labelTopPct(g.y))`
		// put 100 at the bottom and 0 at the top with the whole suite green. That
		// is the sibling failure this file already names for the LINES ("a chart
		// that reads every market backwards"), left open for the NUMBERS, which are
		// the half a reader actually takes a value from. Caught by `@test-writer`.
		const m = markup("expanded");
		for (const g of gridlinesFor("expanded")) {
			const at = m.indexOf(`data-testid="y-mark-${g.pct}"`);
			expect(at, `y-mark-${g.pct} missing`).toBeGreaterThan(-1);
			const top = m.slice(at, m.indexOf(">", at));
			// The clamp's MIDDLE term is the gridline's own y as a percentage.
			expect(top).toContain(`, ${labelTopPct(g.y)}%,`);
		}
		// …and the scale runs top-down, which is the direction that can invert.
		const top100 = m.slice(
			m.indexOf('data-testid="y-mark-100"'),
			m.indexOf(">", m.indexOf('data-testid="y-mark-100"')),
		);
		const top0 = m.slice(
			m.indexOf('data-testid="y-mark-0"'),
			m.indexOf(">", m.indexOf('data-testid="y-mark-0"')),
		);
		expect(top100).toContain(", 0%,");
		expect(top0).toContain(", 100%,");
	});

	it("the marks' edge floor is the ONE-LINE half box, by value", () => {
		// Only the WORD `clamp(` was asserted before, so a wrong half-box passed —
		// and a wrong half-box is precisely what that clamp exists to prevent: the
		// 0 and 100 marks sit on the plot's boundaries and the gutter does not clip.
		const m = markup("expanded");
		const at = m.indexOf('data-testid="y-mark-100"');
		const style = m.slice(at, m.indexOf(">", at));
		expect(style).toContain(`clamp(${LABEL_NAME_PX / 2}px,`);
		expect(style).toContain(`calc(100% - ${LABEL_NAME_PX / 2}px)`);
	});

	it("the marks column inherits the alignment contract — positioned, absolute, no vertical box model", () => {
		// ⛔ A NEW FLEX CELL BESIDE THE PLOT INHERITS EVERY LINK OF `C-CHART-2`
		// clause 2's chain, and none of them was extended to it when the column
		// landed. Each mutation below shipped GREEN across the whole unit tree:
		// dropping `relative` (the percentage then resolves against a positioned
		// ancestor somewhere up the page shell — the exact defect
		// `alignment-chain.test.tsx` was minted for), dropping `absolute` from the
		// spans (top becomes inert and eleven numbers stack in flow), and adding
		// vertical padding (the column stops being exactly the plot's height, so
		// its percentages and the gridlines' resolve against different boxes).
		const { container } = render(
			<MarketPriceChart series={series(0.65)} mode="expanded" isOpen={true} />,
		);
		const col = container.querySelector('[data-testid="chart-y-marks"]');
		expect(col).not.toBeNull();
		const cls = (col?.getAttribute("class") ?? "").split(/\s+/);
		expect(cls).toContain("relative");
		// No vertical padding / margin / border — anything that would make the
		// column a different height from the plot it annotates.
		for (const t of cls) {
			expect(t).not.toMatch(/^(p|m)(y|t|b)-/);
			expect(t).not.toMatch(/^border(-(y|t|b))?(-|$)/);
		}
		// Every mark is absolutely positioned.
		const marks = [...(col?.querySelectorAll("[data-pct]") ?? [])];
		expect(marks.length).toBe(11);
		for (const mk of marks) {
			expect((mk.getAttribute("class") ?? "").split(/\s+/)).toContain(
				"absolute",
			);
		}
		// PINNED WIDTH, in the corrected form: the first version banned
		// `/(^|\s)w-\[/`, which cannot see `min-w-[`, `max-w-[` or `md:w-[`.
		// `alignment-chain.test.tsx` matches a class TOKEN against
		// `/^(min-|max-)?w-/` and that is the form used here.
		for (const t of cls) {
			expect(t).not.toMatch(/^(min-|max-)?w-/);
		}
		// POSITIVE CONTROL — the same token matcher DOES fire on a pinned width.
		expect("w-[22px]").toMatch(/^(min-|max-)?w-/);
		expect("min-w-[22px]").toMatch(/^(min-|max-)?w-/);
	});

	it("the marks are hidden from the accessible tree", () => {
		// ⛔ THE REGRESSION CHART-2 ALREADY SHIPPED ONCE, ONE COLUMN OVER. When the
		// sibling gutter lacked this attribute the card announced "NO YES Price
		// history: opening 50 %, current 65 %, …" — two orphan words in front of
		// the sentence that IS the readout. These are eleven more orphan strings,
		// outside the `aria-hidden` svg, in front of the same summary. The chart's
		// only sanctioned accessible channel is `ChartSummary`.
		const { container } = render(
			<MarketPriceChart series={series(0.65)} mode="expanded" isOpen={true} />,
		);
		expect(
			container
				.querySelector('[data-testid="chart-y-marks"]')
				?.getAttribute("aria-hidden"),
		).toBe("true");
	});

	it("the gutter sizer measures the WIDEST label, value line included", () => {
		// ⛔ A MEASURED PRODUCT DEFECT, NOT A STYLE NIT. The sizer carried the name
		// alone on the reasoning that `YES` at 10px bold outruns four tabular
		// digits at 16px. Measured in the contact sheet, in the shipped face: the
		// gutter came out 27.15px and the rendered `99%` 33.56px — overflowing its
		// own gutter by 11.41px, with `100%` at 42.47px. The sizer now carries the
		// value line too, so the browser measures the real worst case.
		const m = markup("expanded");
		const gutAt = m.indexOf('data-testid="terminal-label-gutter"');
		const gut = m.slice(gutAt, m.indexOf("terminal-label-no", gutAt));
		expect(gut).toContain("100%");
		expect(gut).toContain(`font-size:${LABEL_VALUE_PX}px`);
		// MUST REJECT: a hand-measured width standing in for the measurement.
		expect(gut).not.toMatch(/(^|\s)(min-|max-)?w-\[/);
		// The collapsed card has no value line, so its sizer must NOT carry one.
		const cm = markup("collapsed");
		const cAt = cm.indexOf('data-testid="terminal-label-gutter"');
		expect(cm.slice(cAt, cm.indexOf("terminal-label-no", cAt))).not.toContain(
			"100%",
		);
	});
});

describe("CHART-5 — RF-4 payload budget", () => {
	it("the Y scale adds well under 1.5 KB to the page, and zero client JS", () => {
		// ⚠ THE COLLAPSED CHART IS WHAT SHIPS PER PAGE. The expanded overlay is a
		// client-rendered dialog whose markup is not in the document until it is
		// opened — measured on staging, the market page server-renders exactly one
		// `market-price-chart` svg — so the per-page cost of this task is the
		// collapsed card's grid and nothing else.
		const m = markup("collapsed");
		const start = m.indexOf('<g data-testid="chart-gridlines"');
		const grid = m.slice(start, m.indexOf("</g>", start) + 4);
		expect(start).toBeGreaterThan(-1);
		expect(Buffer.byteLength(grid, "utf8")).toBeLessThan(1500);

		// Zero client JS: the scale is markup. No handler, no script, no hydration
		// hook reaches it.
		expect(grid).not.toMatch(/on[A-Z]/);
		expect(grid).not.toContain("<script");

		// ⚠ THE OVERLAY IS MEASURED AND PINNED SEPARATELY, AT ITS OWN CEILING, AND
		// SAYING SO IS THE POINT. Grid + marks on the expanded overlay measure
		// ~2.5 KB — ABOVE the 1.5 KB figure — and that is not a budget breach,
		// because the budget is stated per PAGE and this markup is never in a
		// page: the overlay is a client-rendered dialog that does not exist in the
		// document until it is opened. Measured on staging, `/m/[slug]` server-
		// renders exactly ONE `market-price-chart` svg, the collapsed one.
		// ⛔ IT IS STILL BOUNDED, because "not charged to the page" is a reason to
		// pick a different ceiling, not a reason to have none — an unbounded
		// element count here is exactly the per-point computation RF-4 exists to
		// catch, and it would still cost the reader who opens the overlay.
		const e = markup("expanded");
		const eStart = e.indexOf('<g data-testid="chart-gridlines"');
		const eGrid = e.slice(eStart, e.indexOf("</g>", eStart) + 4);
		const marks = e.slice(
			e.indexOf('<div data-testid="chart-y-marks"'),
			e.indexOf('<div data-testid="terminal-label-gutter"'),
		);
		const overlayBytes =
			Buffer.byteLength(eGrid, "utf8") + Buffer.byteLength(marks, "utf8");
		expect(overlayBytes).toBeLessThan(3000);
		// Non-vacuity: it is genuinely bigger than the card's, so a ceiling that
		// happened to be slack on the card is not what is passing here.
		expect(overlayBytes).toBeGreaterThan(Buffer.byteLength(grid, "utf8"));
	});
});
