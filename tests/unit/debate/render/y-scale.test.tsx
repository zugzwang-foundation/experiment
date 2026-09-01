// @vitest-environment jsdom

import { render } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
	gridlinesFor,
	hasEndValue,
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
/** ⚠ THE GAP CHANGED AXIS AND NAME AT CHART-7 (RF-2). It was `LABEL_STACK_GAP_PX
 * = 2`, a `margin-top` under a value stacked beneath its name; the founder ruled
 * the two onto ONE line, so it is a `margin-left` beside the value and its
 * measured basis is Geist's own space advance at 16 px (4.39, floored). It no
 * longer enters the box's HEIGHT — that is what narrows the collision band. */
const LABEL_INLINE_GAP_PX = 4;
/** The numeric marks' OWN type size — `YMarks` declares `text-[10px]` for itself.
 * ⚠ MIRRORED SEPARATELY FROM `LABEL_NAME_PX` EVEN THOUGH BOTH ARE 10, because
 * `markTop`'s docblock exists precisely to stop the marks' edge clamp reading the
 * end label's type: change the label to 12px — a one-token edit `labelHalfBoxPx`
 * is built to absorb — and a guard that mirrored the label's constant would follow
 * it and stop describing the marks. The guard reproduced that conflation until
 * `@test-writer` filed it (L-3). */
const MARK_TYPE_PX = 10;

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
	it("collapsed gets the quarters; expanded AND the hero get every ten", () => {
		// ⛔ THE HERO USED TO GET NONE, AND THIS CASE PINNED IT. CHART-5 gave it the
		// empty set on the stated ground that its box is "roughly 96px tall".
		// Measured on the shipped build at 1440 (CHART-6): the hero's chart box is
		// **418.75 px** and the expanded overlay's is **382.25** — the hero is the
		// TALLER of the two. 96 is `min-h-24`, the layout FLOOR `HeroPanels` sets
		// before `flex-1` grows it; the figure was a mis-read of the CSS, not a
		// measurement. Founder-ruled at CHART-6: the hero carries what the overlay
		// carries.
		// ⚠ `0` JOINED THE COLLAPSED SET AT CHART-7 (RF-3, founder ruling). With
		// both extremes labelled the five lines read as a frame; four starting at 25
		// read as rules someone drew. It also makes moot the never-ruled question
		// the CHART-5 sheet rendered both ways — whether the `100` line is redundant
		// against the card's border — because paired with a `0` it is the top of a
		// scale rather than a stray edge.
		expect(gridlinesFor("collapsed").map((g) => g.pct)).toEqual([
			0, 25, 50, 75, 100,
		]);
		const TEN_STEP = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
		expect(gridlinesFor("expanded").map((g) => g.pct)).toEqual(TEN_STEP);
		expect(gridlinesFor("hero").map((g) => g.pct)).toEqual(TEN_STEP);
	});

	it("`hasEndValue` and `gridlinesFor` cannot come to disagree", () => {
		// ⛔ TWO INDEPENDENT DECLARATIONS OF ONE RULING, TIED TOGETHER HERE RATHER
		// THAN BY ONE CALLING THE OTHER. `gridlinesFor` keeps an exhaustive `switch`
		// because that is what turns a fourth surface into a COMPILE error rather
		// than a chart silently shipping with no scale; `hasEndValue` is a
		// predicate two other call sites read. Neither can be expressed in terms
		// of the other without losing what it is for — so the agreement is asserted.
		//
		// ⚠ WHAT THIS PAIR MEANS CHANGED AT CHART-7 AND THE ASSERTION IS RE-SEATED
		// RATHER THAN DELETED. The predicate used to govern the marks column too, so
		// "eleven gridlines ⇔ the full treatment" was the whole ruling. RF-1/RF-3 put
		// the marks on EVERY mode, so what the two now have to agree about is
		// narrower and still real: the ten-step set and the value line ride the same
		// surfaces, and a mode that gained one without the other would either overlap
		// its own labels or carry a value nobody sized a box for.
		for (const mode of ["collapsed", "expanded", "hero"] as const) {
			expect(
				gridlinesFor(mode).length === 11,
				`${mode}: gridline set and hasEndValue disagree`,
			).toBe(hasEndValue(mode));
		}
		// Non-vacuity: the predicate really does discriminate, so the loop above is
		// not three trivially-true comparisons.
		expect(
			new Set(
				["collapsed", "expanded", "hero"].map((m) => hasEndValue(m as never)),
			).size,
		).toBe(2);

		// ⛔ THE DIRECTION OF THE NEGATION, WHICH THE DOCBLOCK CALLS LOAD-BEARING AND
		// NOTHING GUARDED (`@test-writer`, M-2). `hasEndValue` is written as "not
		// collapsed" rather than "expanded or hero" so that a FOURTH surface joins
		// the full treatment by default and is excluded deliberately. Rewritten as a
		// list — `mode === "expanded" || mode === "hero"` — every assertion above
		// stays green, because the loop only ever visits the three modes that exist,
		// and a new mode would then ship with no scale at all: silently, on a chart
		// whose whole point is that the scale is a function of the mode. That is the
		// exact failure `gridlinesFor`'s exhaustive switch turns into a COMPILE error,
		// and the predicate must not be the soft spot beside it.
		expect(
			hasEndValue("a-fourth-surface" as never),
			"hasEndValue must be written as a negation of `collapsed`, so an unrecognised mode gets the value line rather than none",
		).toBe(true);
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
		// ⚠ THE HERO WAS MISSING FROM THIS LIST — it is the mode CHART-6 added, and
		// `case "hero": return [...GRIDLINES_TEN_STEP]` would rebuild an array per
		// call while every other assertion in this file stayed green (`@test-writer`,
		// L-1).
		expect(gridlinesFor("hero")).toBe(gridlinesFor("hero"));
		// …and the hero and the overlay are ONE array, not two equal ones. The
		// geometry docblock's reason for a single constant is that "two names for one
		// array would be two places for them to drift apart" — `toEqual` cannot see
		// the difference, and identity is the only thing that can.
		expect(gridlinesFor("hero")).toBe(gridlinesFor("expanded"));
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

	it("renders exactly the mode's set, on all three surfaces", () => {
		const collapsed = markup("collapsed");
		const expanded = markup("expanded");
		const hero = markup("hero");

		const pcts = (m: string) =>
			[...m.matchAll(/<line data-pct="(\d+)"/g)].map((x) => Number(x[1]));
		const TEN_STEP = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
		const QUARTERS = [0, 25, 50, 75, 100];
		expect(pcts(collapsed)).toEqual(QUARTERS);
		expect(pcts(expanded)).toEqual(TEN_STEP);

		// ⛔ THE HERO NOW CARRIES THE SAME ELEVEN, and the MUST-REJECT inverted with
		// the ruling: this used to assert the hero had no group at all. What it must
		// reject NOW is the hero taking the COLLAPSED card's quarters — the plausible
		// wrong answer, since "give the hero a scale" reads as "give it any scale",
		// and four lines on a 418 px panel beside eleven on a 382 px overlay would
		// make the same market two different pictures on two surfaces.
		expect(hero).toContain('data-testid="chart-gridlines"');
		expect(pcts(hero)).toEqual(TEN_STEP);
		expect(pcts(hero)).not.toEqual(QUARTERS);

		// POSITIVE CONTROL — the same matcher tells the two sets apart, so the
		// equalities above are readings rather than one pattern matching everything.
		expect(pcts(collapsed).length).toBe(5);
		expect(pcts(hero).length).toBe(11);
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

	it("every gridline carries non-scaling-stroke ON THE LINE, not on the group", () => {
		// ⛔ THE GUARD THE REPOSITORY DID NOT HAVE, AND A REAL DEFECT SHIPPED THROUGH
		// ITS ABSENCE. `vector-effect` is NOT an inherited property and does not
		// apply to container elements, so declaring it on the `<g>` is silently
		// discarded while `stroke`, `stroke-width` and `stroke-dasharray` beside it
		// inherit and work — a group that looks correctly configured and draws at
		// the wrong weight. A horizontal rule's stroke is vertical, so `scaleY
		// 0.4282` on the collapsed card rendered these at ≈0.43 CSS px next to an
		// x-axis tick at a true 1px. Nothing in `tests/` asserted `vector-effect`
		// anywhere before this: deleting it from both polylines was green too.
		// Caught by `@code-reviewer` at the CHART-5 cascade.
		for (const mode of ["collapsed", "expanded"] as const) {
			const m = markup(mode);
			const gStart = m.indexOf('<g data-testid="chart-gridlines"');
			const group = m.slice(gStart, m.indexOf("</g>", gStart) + 4);
			const head = group.slice(0, group.indexOf(">") + 1);
			// MUST REJECT: the attribute on the container, where it is inert.
			expect(head).not.toContain("vector-effect");
			const lines = group.match(/<line[^>]*>/g) ?? [];
			expect(lines.length).toBe(gridlinesFor(mode).length);
			for (const ln of lines) {
				expect(ln).toContain('vector-effect="non-scaling-stroke"');
			}
		}
		// POSITIVE CONTROL — the same matcher finds the attribute on the series
		// polylines, which have carried it correctly since CHART-1.
		expect(markup("expanded")).toMatch(
			/<polyline[^>]*data-testid="line-yes"[^>]*vector-effect="non-scaling-stroke"|<polyline[^>]*vector-effect="non-scaling-stroke"[^>]*data-testid="line-yes"/,
		);
	});

	it("the numeric marks carry no raw hex either", () => {
		// ⚠ THE SLICE USED THE LABEL LAYER AS ITS END BOUND AND THAT ORDER REVERSED
		// AT CHART-6. The labels moved INSIDE the plot box, so they now precede the
		// marks column in the markup rather than following it — the old bounds
		// produced an EMPTY slice, and `not.toMatch` on an empty string passes.
		// ⛔ AND THE FIRST REPLACEMENT WAS THE SAME MISTAKE INVERTED: it sliced to the
		// END OF THE DOCUMENT, which equals the column only because `chart-y-marks`
		// happens to be last in the frame today — while the comment three lines above
		// claimed a bound the code did not have (`@test-writer`, M-4). It is bounded
		// by its own closing tag now, and the count below proves the bound landed.
		const m = markup("expanded");
		const at = m.indexOf('data-testid="chart-y-marks"');
		expect(at).toBeGreaterThan(-1);
		const lastMark = m.lastIndexOf('data-testid="y-mark-');
		const end = m.indexOf("</div>", lastMark);
		expect(end).toBeGreaterThan(at);
		const col = m.slice(at, end + 6);
		// Non-vacuity: the slice really contains the eleven marks, so the hex ban
		// below is read against the column and not against whatever survived.
		expect([...col.matchAll(/data-testid="y-mark-\d+"/g)].length).toBe(11);
		expect(col).not.toMatch(/#[0-9a-fA-F]{3,8}/);
	});
});

describe("discovery::hero-chart-carries-y-scale — C-CHART-1 clause 1 (CHART-6), marks on every FULL-SCALE mode", () => {
	it("eleven marks on the overlay AND the hero, none on the card", () => {
		const marks = (m: string) =>
			[...m.matchAll(/data-testid="y-mark-(\d+)"/g)].map((x) => Number(x[1]));
		const TEN_STEP = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

		expect(marks(markup("expanded"))).toEqual(TEN_STEP);
		// CHART-6, founder ruling: the hero gets what the overlay has. Its box is
		// 418.75 px — measured, and taller than the overlay's 382.25.
		expect(markup("hero")).toContain('data-testid="chart-y-marks"');
		expect(marks(markup("hero"))).toEqual(TEN_STEP);

		// ⛔ REVERSED AT CHART-7 (RF-3, founder ruling): THE COLLAPSED CARD NOW
		// CARRIES MARKS. This case used to assert the opposite — *"MUST REJECT:
		// numbers on the collapsed card … which is why the predicate is
		// `hasFullYScale` and not `grid.length > 0`"* — on the ground that its box is
		// short and already holds a date row. The founder ruled the other way: the
		// card gets a full left scale, and the numbers are what make the gridlines
		// read as a scale rather than as stray rules.
		//
		// ⚠ THE SET IS STILL PER-MODE AND THAT IS THE HALF THAT SURVIVED. The card
		// takes the quarters, not the ten-step — eleven numbers down a 193.8 px box
		// would be 18 px apart and read as hatching. So the predicate the marks
		// column reads really is `grid.length > 0` now, and `gridlinesFor` is what
		// keeps the two sets apart.
		expect(markup("collapsed")).toContain('data-testid="chart-y-marks"');
		expect(marks(markup("collapsed"))).toEqual([0, 25, 50, 75, 100]);
	});

	it("the marks column is SIZED, never pinned — the CHART-2 mechanism, reused", () => {
		const { container } = render(
			<MarketPriceChart series={series(0.65)} mode="expanded" isOpen={true} />,
		);
		const col = container.querySelector('[data-testid="chart-y-marks"]');
		expect(col).not.toBeNull();
		// MUST REJECT: a hand-measured `w-[22px]`, which is the defect CHART-2
		// deleted for the label gutter, reintroduced one column over.
		// ⚠ THE CORRECTED TOKEN FORM, not `/(^|\s)w-\[/` — that copy could not see
		// `min-w-[`, `max-w-[` or a `md:w-[` variant, and a second, weaker spelling of
		// one ban on one element is a place for the two to disagree (`@test-writer`,
		// L-2).
		expect(col?.getAttribute("class") ?? "").not.toMatch(
			/(^|\s)(min-|max-)?w-/,
		);
		expect((col as HTMLElement | null)?.style.width ?? "").toBe("");
		// …and the in-flow sizer that replaces it is present and INVISIBLE rather
		// than `hidden` — `hidden` removes the box and collapses the column.
		const sizer = col?.querySelector(':scope > span[aria-hidden="true"]');
		const sc = sizer?.getAttribute("class") ?? "";
		expect(sc.split(/\s+/)).toContain("invisible");
		expect(sc.split(/\s+/)).not.toContain("hidden");
		expect(sizer?.textContent).toBe("100");
	});

	it("does not disturb the label layer's own contract", () => {
		// ⛔ THIS IS THE REGRESSION THAT ACTUALLY HAPPENED AT CHART-5, PINNED. The
		// first implementation put the marks INSIDE the label gutter, which forced
		// it from `relative` to `flex` and pushed its width-sizer one level down —
		// breaking `alignment-chain.test.tsx`'s clause-2-link-4 and clause-3
		// guards. Those guards were right and the structure was wrong.
		//
		// ⚠ REWRITTEN AT CHART-6, BECAUSE THE THING IT PROTECTED MOVED RATHER THAN
		// WENT AWAY. There is no gutter now — the labels are an overlay on the plot
		// (`C-CHART-2` clause 2 as amended) — so "the gutter stayed `relative` with
		// its sizer in flow" is a sentence about a box that no longer exists, and
		// retargeting it to the new element would have asserted nothing. The
		// property that survives is the one CHART-5 actually needed: **the marks are
		// a SIBLING of the plot and the labels live INSIDE it, so neither can force
		// the other's layout.** That is now a stronger separation than it was, and
		// it is what the next attempt to merge the two columns must break.
		const { container } = render(
			<MarketPriceChart series={series(0.65)} mode="expanded" isOpen={true} />,
		);
		const plot = container.querySelector(
			'[data-testid="market-price-chart-plot"]',
		);
		const layer = container.querySelector(
			'[data-testid="terminal-label-layer"]',
		);
		const marks = container.querySelector('[data-testid="chart-y-marks"]');
		expect(plot).not.toBeNull();
		expect(layer).not.toBeNull();
		expect(marks).not.toBeNull();

		// The labels are inside the plot — that is what makes their `left` a
		// percentage of the box the viewBox is stretched onto.
		expect(plot?.contains(layer as Node)).toBe(true);
		// …and the marks are NOT, so the marks column cannot take width from the
		// plot's percentage basis, nor the labels from the marks' flow.
		expect(plot?.contains(marks as Node)).toBe(false);
		expect(layer?.contains(marks as Node)).toBe(false);
		expect(marks?.contains(layer as Node)).toBe(false);

		// POSITIVE CONTROL — `contains` really discriminates in this tree, so the
		// three `false`s above are readings rather than a method that always says no.
		expect(plot?.contains(plot as Node)).toBe(true);
		expect(
			plot?.contains(
				container.querySelector('[data-testid="terminal-label-yes"]') as Node,
			),
		).toBe(true);
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

	it("the value rides the FULL-SCALE modes — the collapsed card keeps the name alone", () => {
		// ⚠ THE HERO MOVED SIDES AT CHART-6. RF-4 gives it "what expanded has" as one
		// bundle — gridlines, marks, and the percentage beneath the name — so a hero
		// with the scale and without the value would be half a ruling. Its box is
		// 418.75 px measured, which is where the room for a second line comes from.
		const m = markup("collapsed");
		expect(m).not.toContain('data-testid="terminal-value-yes"');
		expect(m).not.toContain('data-testid="terminal-value-no"');
		// …but the NAME is still there, so the absence above is the value's, not the
		// whole label's.
		expect(m).toContain('data-testid="terminal-label-yes"');

		for (const mode of ["expanded", "hero"] as const) {
			expect(markup(mode)).toContain('data-testid="terminal-value-yes"');
			expect(markup(mode)).toContain('data-testid="terminal-value-no"');
		}
	});
});

describe("C-CHART-2 clause 4 (CHART-5) — one collision rule, two measured inputs", () => {
	it("the value-bearing floor is the TALLER of the two type sizes; the others are unchanged", () => {
		// The half-box is composed from the type the label is actually made of:
		// name alone → 10/2 = 5; name AND value → max(10, 16)/2 = 8. Asserted
		// through the CSS the component emits, because that string IS the rule at
		// runtime.
		// ⛔ IT WAS `(10 + 2 + 16)/2 = 14` UNTIL CHART-7, AND THE CHANGE IS RF-2's
		// WHOLE MECHANICAL CONSEQUENCE. While the value sat BENEATH the name the box
		// was the sum of both lines plus the air between them. Side by side they
		// share one line box, the horizontal gap contributes nothing to its height,
		// and the box is the taller of the two. Clause 4's rule is untouched; the
		// number handed to it halved, so the collision band narrows.
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
				// ⚠ `top` IS NO LONGER THE ATTRIBUTE'S FIRST DECLARATION — CHART-6 added
				// the label's `left`, which React serialises first because it is
				// declared first. A regex anchored on `style="top:` reads that as a
				// MISSING style, i.e. a false red on a correct render.
				const re = new RegExp(
					`terminal-label-${side}"[^>]*style="[^"]*top:([^";]*)`,
				);
				const hit = m.match(re);
				expect(hit, `${mode}/${side} has no top style`).not.toBeNull();
				return hit?.[1] ?? "";
			});
		};

		// ⛔ THE EXPECTED FLOOR IS PARSED OUT OF THE RENDERED MARKUP, NOT MIRRORED
		// FROM THE COMPONENT'S CONSTANTS — and the first attempt at this fix DID
		// mirror them, which cannot tell a composed threshold from a literal `14`:
		// with the type unchanged both emit the identical string, and the mutation
		// proving that came back GREEN. What composition actually protects against
		// is DRIFT — the value line growing while the threshold stays put — so the
		// three type values are read from the label's own markup and the floor is
		// computed from those. Grow `LABEL_VALUE_PX` against a literal floor and
		// this reds.
		const em = markup("expanded", 0.5);
		const num = (re: RegExp, what: string) => {
			const hit = em.match(re);
			expect(hit, `could not read ${what} from the markup`).not.toBeNull();
			return Number(hit?.[1]);
		};
		const nameSize = num(
			/terminal-label-layer"[^>]*class="[^"]*text-\[(\d+)px\]/,
			"the name's type size",
		);
		const valueSize = num(
			// ⚠ MATCHED WHEREVER IT SITS, not anchored to `font-size` being first — the
			// same positional assumption this branch fixed for `top`, and the same
			// failure mode: a false RED the next time a style prop is added above it.
			/terminal-value-yes"[^>]*style="[^"]*font-size:(\d+)px/,
			"the value's type size",
		);
		// ⛔ THE GAP IS READ AS A MARGIN-LEFT AND ITS VERTICAL TWIN IS BANNED, WHICH
		// IS WHERE THIS CASE ALSO BECOMES RF-2's GUARD. A value re-stacked beneath
		// its name would emit `margin-top` again, and the box would grow back to 28
		// while this floor stayed at 8 — the two labels then sit 16 px apart around
		// 28 px boxes and OVERLAP across the band where every market rests. That is
		// the exact failure CHART-6 shipped in the other direction, so it is
		// asserted rather than assumed.
		const inlineGap = num(
			/terminal-value-yes"[^>]*margin-left:(\d+)px/,
			"the inline gap",
		);
		expect(inlineGap).toBeGreaterThan(0);
		expect(em).not.toMatch(/terminal-value-yes"[^>]*margin-top:/);
		// ⚠ THE GAP IS DELIBERATELY NOT IN THE HEIGHT. It is read above so that a
		// change to it reddens the read rather than passing unnoticed, and then it
		// is excluded from the composition on purpose — one line box, so only the
		// taller of the two type sizes can set the height.
		const expandedHalf = Math.max(nameSize, valueSize) / 2;
		for (const top of topsOf("expanded")) {
			expect(top).toContain(`clamp(${expandedHalf}px,`);
			// ⚠ THE BOTTOM BOUND CARRIES A SECOND TERM SINCE CHART-7 (RF-5) — the
			// X-axis date row, which the lower label may not enter. `C-CHART-2` clause
			// 3: one clamp, one more measured input, never a second rule. The band's
			// own composition is asserted in `label-anchor.test.tsx`; here it is enough
			// that the half-box term is still the one this case is about.
			expect(top).toMatch(
				new RegExp(`calc\\(100% - ${expandedHalf}px( - \\d+px)?\\)`),
			);
		}
		// ⛔ THE HERO TAKES THE TALLER FLOOR TOO, AND THAT PAIRING IS THE POINT
		// RATHER THAN A CONSEQUENCE. Its label gained the value at CHART-6; a mode
		// that gained the value while keeping the 5px floor would push its two
		// labels only 10px apart around a 16px box, so they would OVERLAP across the
		// near-even band — where every market rests. That is why the component reads
		// one `hasEndValue` for the value and the floor rather than two `mode ===`
		// tests that can be updated one at a time.
		for (const top of topsOf("hero")) {
			expect(top).toContain(`clamp(${expandedHalf}px,`);
			expect(top).toMatch(
				new RegExp(`calc\\(100% - ${expandedHalf}px( - \\d+px)?\\)`),
			);
		}
		// MUST REJECT: the wider threshold leaking onto the one-line collapsed card.
		for (const top of topsOf("collapsed")) {
			expect(top).toContain(`clamp(${LABEL_NAME_PX / 2}px,`);
			expect(top).not.toContain(`${expandedHalf}px`);
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

	it("the marks' edge floor is half the MARKS' OWN type, by value", () => {
		// Only the WORD `clamp(` was asserted before, so a wrong half-box passed —
		// and a wrong half-box is precisely what that clamp exists to prevent: the
		// 0 and 100 marks sit on the plot's boundaries and the column does not clip.
		//
		// ⛔ AGAINST `MARK_TYPE_PX`, NOT `LABEL_NAME_PX`, AND THE SWAP IS THE POINT
		// (`@test-writer`, L-3). This asserted the END LABEL's constant — which is
		// the exact conflation `markTop`'s docblock was written to end, reproduced
		// inside the guard for it. Both are 10 today, so the assertion passed for a
		// reason that has nothing to do with the marks: change the end label to 12px
		// and this guard would follow the label and stop describing the column,
		// silently, while the `0` and `100` marks drifted a pixel off their own
		// gridlines in a column that does not clip.
		const m = markup("expanded");
		const at = m.indexOf('data-testid="y-mark-100"');
		const style = m.slice(at, m.indexOf(">", at));
		expect(style).toContain(`clamp(${MARK_TYPE_PX / 2}px,`);
		expect(style).toContain(`calc(100% - ${MARK_TYPE_PX / 2}px)`);
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

	it("the value line can never be clipped, because nothing constrains the label's width", () => {
		// ⛔ THE DEFECT THIS REPLACES WAS REAL AND IS WORTH KEEPING IN VIEW. CHART-5's
		// sizer carried the name alone, on the reasoning that `YES` at 10px bold
		// outruns four tabular digits at 16px. Measured in the shipped face that is
		// false: the gutter came out 27.15 px and the rendered `99%` 33.56 px —
		// overflowing its own gutter by 11.41 px, with `100%` at 42.47 px. The fix
		// was a sizer carrying the widest label that can occur.
		//
		// ⚠ CHART-6 REMOVES THE CONSTRAINT INSTEAD OF MEASURING IT. There is no
		// gutter to overflow: the labels are absolutely positioned over the plot and
		// carry `whitespace-nowrap`, so each takes exactly its own width wherever it
		// lands. A sizer measuring a box nobody has would be theatre — so the
		// assertion becomes the two properties that make the clip UNREACHABLE, which
		// is strictly what the sizer was buying.
		const { container } = render(
			<MarketPriceChart series={series(0.65)} mode="expanded" isOpen={true} />,
		);
		for (const side of ["yes", "no"] as const) {
			const el = container.querySelector(
				`[data-testid="terminal-label-${side}"]`,
			) as HTMLElement | null;
			expect(el).not.toBeNull();
			const cls = (el?.getAttribute("class") ?? "").split(/\s+/);
			// It sizes to its own content…
			expect(cls).toContain("whitespace-nowrap");
			// …and nothing pins that content into a box. MUST REJECT: a hand-measured
			// width standing in for the measurement — the CHART-1 `26` in a new unit.
			expect(el?.getAttribute("class") ?? "").not.toMatch(
				/(^|\s)(min-|max-)?w-[[\d]/,
			);
			expect(el?.style.width ?? "").toBe("");
			expect(el?.style.maxWidth ?? "").toBe("");
		}
		// The value is still there, at its own type size and its own inline gap, so
		// this case is about an unclipped label rather than an absent one.
		// ⚠ THE GAP MOVED AXIS AT CHART-7 AND THE ASSERTION MOVED WITH IT. It was a
		// `margin-top` under a stacked value and is a `margin-left` beside an inline
		// one. The reason for pinning it is unchanged and now cuts the other way:
		// `labelHalfBoxPx` composes the collision floor from the type sizes ALONE,
		// so a gap that reverted to `margin-top` would grow the label's real box
		// from 16 px back to 28 while the floor stayed at 8 — silently, in the band
		// where every market rests.
		const m = markup("expanded");
		expect(m).toContain(`font-size:${LABEL_VALUE_PX}px`);
		expect(m).toContain(`margin-left:${LABEL_INLINE_GAP_PX}px`);
		expect(m).not.toMatch(/terminal-value-(yes|no)"[^>]*margin-top:/);
		expect(m).toContain('data-testid="terminal-value-yes"');

		// POSITIVE CONTROL — the width ban fires on the forms it is written against
		// and on none of the label's shipped classes.
		for (const offender of ["w-[42px]", "min-w-[26px]", "max-w-[50px]"]) {
			expect(offender).toMatch(/(^|\s)(min-|max-)?w-[[\d]/);
		}
		for (const innocent of ["whitespace-nowrap", "-translate-x-full"]) {
			expect(innocent).not.toMatch(/(^|\s)(min-|max-)?w-[[\d]/);
		}
	});
});

describe("C-CHART-2 clause 4 (CHART-6) — the CSS floor holds across the whole near-even band", () => {
	it("separates the two labels by a full box on EVERY mode, at every tenth of a point", () => {
		// ⛔ WHY A SECOND SWEEP WHEN `terminal-markers.test.tsx` ALREADY HAS ONE.
		// That one sweeps PLOT SPACE and proves clause 4's own arithmetic — the
		// 12-unit minimum, the symmetric push, the clamp — which CHART-6 did not
		// touch and which is a scope fence. It runs on `collapsed` alone, and
		// rightly: clause 4 takes no mode.
		//
		// ⚠ WHAT CHART-6 MOVED IS THE OTHER FLOOR, THE ONE IN CSS PIXELS, AND ONLY
		// ON ONE SURFACE. `labelHalfBoxPx` went 5 → 14 for the hero, because its
		// label grew a value line. In the near-even band the CSS floor DOMINATES
		// clause 4 — it forces the two centres `2 × half` apart regardless of what
		// plot space says — so on the hero the separation the reader actually sees
		// changed from 10 px to 28 px, and nothing swept that.
		//
		// ⛔ AND CHART-7 MOVED IT BACK DOWN, ON BOTH VALUE-BEARING SURFACES. RF-2
		// puts name and value on ONE line, so the box is `max(10, 16) = 16` rather
		// than `10 + 2 + 16 = 28`, and the floor is 8 rather than 14. **The rule is
		// untouched and its input halved** — which is the same sentence CHART-5
		// wrote going the other way.
		//
		// ⛔ THE FAILURE IT MUST REJECT is unchanged in shape and only in sign: a
		// surface whose label box and whose floor disagree. A value re-stacked
		// beneath its name against an 8 px floor gives two 28 px boxes 16 px apart —
		// overlapping by 12 px, across the band where every market rests — and it
		// ships green against every plot-space assertion in the repository, because
		// in plot space nothing moved. That is the exact shape CHART-2's cascade
		// caught once and CHART-6's caught again.
		const HALF = { collapsed: 5, expanded: 8, hero: 8 } as const;

		for (const mode of ["collapsed", "expanded", "hero"] as const) {
			const half = HALF[mode];
			let seen = 0;
			// A tenth of a point across the band, both sides of even.
			for (let bp = 4800; bp <= 5200; bp += 1) {
				const m = markup(mode, bp / 10000);
				const tops = (["yes", "no"] as const).map((side) => {
					const hit = m.match(
						new RegExp(`terminal-label-${side}"[^>]*style="[^"]*top:([^";]*)`),
					);
					expect(hit, `${mode}@${bp}: no top for ${side}`).not.toBeNull();
					return hit?.[1] ?? "";
				});
				// One label is floored above the midline and the other below, by the
				// SAME half-box — which is what makes the gap a full box rather than a
				// half one.
				const upper = tops.filter((t) => t.includes(`calc(50% - ${half}px)`));
				const lower = tops.filter((t) => t.includes(`calc(50% + ${half}px)`));
				expect(upper.length, `${mode}@${bp}: upper floor missing`).toBe(1);
				expect(lower.length, `${mode}@${bp}: lower floor missing`).toBe(1);
				// …and neither carries the OTHER mode's half-box, which is the
				// one-mode-updated failure this case exists for.
				for (const t of tops) {
					expect(t).toContain(`clamp(${half}px,`);
				}
				seen++;
			}
			// Non-vacuity: the loop really ran the band rather than skipping it.
			expect(seen).toBe(401);
		}

		// POSITIVE CONTROL — the two half-boxes are genuinely different, so the
		// per-mode assertions above are not three copies of one comparison.
		expect(new Set(Object.values(HALF)).size).toBe(2);
	});
});

describe("CHART-5/6 — RF-4 payload budget", () => {
	/** The Y scale's markup for a mode: the gridline group plus the marks column,
	 * each bounded by its OWN element.
	 *
	 * ⛔⛔ THIS HELPER EXISTS BECAUSE THE CASE BELOW WAS PASSING WHILE MEASURING
	 * NOTHING, AND IT IS THE SAME DEFECT CLASS THE WHOLE TASK IS ABOUT. The marks
	 * column used to be sliced from `chart-y-marks` to `terminal-label-layer` — an
	 * end bound belonging to a DIFFERENT component. CHART-6 moved the labels INSIDE
	 * the plot, so the layer now precedes the marks in the markup, the slice
	 * inverted, and `String.slice(3681, 2635)` returns `""`. Zero bytes, added to a
	 * real grid measurement, compared against a ceiling: **green, forever, measuring
	 * half of what it names.** Measured — the slice really was length 0.
	 *
	 * ⇒ **A slice whose end bound is another component's testid goes wrong the
	 * moment either one moves, and it goes wrong SILENTLY because an empty string
	 * satisfies every size assertion.** Each region is now bounded by its own
	 * element and each carries a non-vacuity floor. */
	function yScaleBytes(mode: "collapsed" | "expanded" | "hero"): number {
		const m = markup(mode);
		const gStart = m.indexOf('<g data-testid="chart-gridlines"');
		expect(gStart, `${mode}: no gridline group`).toBeGreaterThan(-1);
		const grid = m.slice(gStart, m.indexOf("</g>", gStart) + 4);
		expect(grid.length, `${mode}: gridline slice is empty`).toBeGreaterThan(
			100,
		);

		const kStart = m.indexOf('<div data-testid="chart-y-marks"');
		let marks = "";
		if (kStart > -1) {
			// Bounded by its own closing structure: the last mark it renders.
			const lastMark = m.lastIndexOf('data-testid="y-mark-');
			const end = m.indexOf("</div>", lastMark);
			expect(end, `${mode}: marks column has no end`).toBeGreaterThan(kStart);
			marks = m.slice(kStart, end + 6);
			expect(marks.length, `${mode}: marks slice is empty`).toBeGreaterThan(
				100,
			);
			// ⚠ PER-MODE SINCE CHART-7, AND PINNED AS LITERALS RATHER THAN DERIVED
			// FROM `gridlinesFor`. This is the non-vacuity floor on the SLICE — it
			// proves the byte region really contains the column — so reading its
			// expectation out of the module under test would make it agree with
			// whatever that module currently does, which is the one thing a floor
			// must not do. The collapsed card carries the quarters; the two wider
			// modes carry the ten-step.
			expect(
				[...marks.matchAll(/data-testid="y-mark-\d+"/g)].length,
				`${mode}: marks slice does not contain the marks`,
			).toBe(mode === "collapsed" ? 5 : 11);
		}
		return Buffer.byteLength(grid, "utf8") + Buffer.byteLength(marks, "utf8");
	}

	it("the Y scale is bounded on every surface, and costs zero client JS", () => {
		// ⚠ EXACTLY ONE CHART SHIPS PER PAGE, AND WHICH ONE DIFFERS BY PAGE.
		// Measured against the deployed build on 2026-09-01 by counting
		// `data-testid="market-price-chart"` in the raw server HTML: `/m/[slug]`
		// ships ONE, in `collapsed` mode; Discovery `/` ships ONE, in `hero` mode.
		// The expanded overlay is a client-rendered dialog and is in no document
		// until it is opened.
		//
		// ⛔ SO CHART-6 MOVED WHICH SURFACE CARRIES DISCOVERY'S COST. Until this task
		// the hero had no Y scale at all and the "per page" cost was the collapsed
		// card's grid alone — which is what this case measured, and it would have
		// gone on measuring only that while the hero gained eleven gridlines, eleven
		// marks and a value line.
		const collapsed = yScaleBytes("collapsed");
		const hero = yScaleBytes("hero");
		const expanded = yScaleBytes("expanded");

		// ⛔⛔ THE CEILINGS ARE RE-SEATED AT CHART-7 AND THE HONEST NUMBER IS OVER
		// THE BRIEF'S BUDGET. RF-1 and RF-3 give the collapsed card a marks column it
		// never had and a fifth gridline, so this region grows by design; the
		// question is by how much, and the answer is bigger than the task's stated
		// allowance.
		//
		// **Measured, whole-chart markup, per page, this branch against `47c3f86`:**
		//     `/m/[slug]` (collapsed)  3452 → 4609 B   **+1157 B**
		//     `/`         (hero)       5412 → 6354 B   **+942 B**
		//     (expanded overlay        5657 → 6386 B   +729 B — in no document until
		//      it is opened, so it is charged to no page)
		//
		// ⚠ THE CHART-7 BRIEF BUDGETS **600 B per page**. Both shipped surfaces
		// exceed it. That is reported rather than engineered around: the overrun IS
		// the founder's ruling — a full left scale on a card that had none — and
		// trimming it would mean removing something ruled. CHART-6 recorded the same
		// trade in the other direction ("the hero's markup roughly doubles. That is
		// what a Y scale weighs"). **A founder call, not a test to loosen quietly.**
		//
		// The per-region ceilings below are set from the measured values with ~15 %
		// headroom, so they still catch an unbounded element count — which is what
		// RF-4's budget rule was for — without pretending the page total is inside
		// its allowance.
		// `/m/[slug]`: the card's FIVE lines and its five marks.
		expect(collapsed).toBeLessThan(1750);
		// `/`: the hero's eleven lines plus its marks column. Deliberately a
		// SEPARATE, LARGER ceiling rather than a shared one — it is a different
		// page, and folding two pages into one number is how a real growth on one
		// hides inside the other's slack.
		expect(hero).toBeLessThan(4000);
		// The overlay is not charged to any page, but "not charged" is a reason to
		// pick a different ceiling, not a reason to have none: an unbounded element
		// count here is the per-point computation RF-4 exists to catch, and it
		// still costs the reader who opens it.
		expect(expanded).toBeLessThan(4000);

		// Non-vacuity, and the ordering that proves the three are distinct
		// measurements rather than one ceiling that happens to be slack for all.
		expect(hero).toBeGreaterThan(collapsed);
		expect(expanded).toBeGreaterThan(collapsed);

		// Zero client JS on every surface: the scale is markup. No handler, no
		// script, no hydration hook reaches it.
		for (const mode of ["collapsed", "expanded", "hero"] as const) {
			const m = markup(mode);
			const gStart = m.indexOf('<g data-testid="chart-gridlines"');
			const grid = m.slice(gStart, m.indexOf("</g>", gStart) + 4);
			expect(grid).not.toMatch(/on[A-Z]/);
			expect(grid).not.toContain("<script");
		}
	});
});
