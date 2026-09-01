// @vitest-environment jsdom

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { gridlinesFor, VIEWBOX_H } from "@/components/debate/chart/geometry";
import { MarketPriceChart } from "@/components/debate/chart/MarketPriceChart";
import type { PricePoint } from "@/server/discovery/price-series";

// CHART-7 · RF-1 — `debate-view::price-chart-marks-render-left`
//                  `debate-view::price-chart-mark-aligns-to-gridline`
//
// ⛔ WHAT IS PROVABLE HERE AND WHAT IS NOT, SAID FIRST. jsdom performs no layout,
// so "the mark's centre lands on its gridline within 1px" — a claim about RENDERED
// pixels — cannot be measured in this runner at all, and a test that pretends
// otherwise reads two zeroes and passes. The rendered half is measured in the
// CHART-7 contact sheet, in a real browser, at three widths per mode. What this
// file pins is the STRUCTURAL chain the rendered claim is built from, and it pins
// it against **two independent DOM sources** rather than one:
//
//   · the gridline's `y1`, an SVG attribute written by `gridlinesFor` → `yPctPx`;
//   · the mark's inline `top`, a CSS string written by `labelTopPct` → `markTop`.
//
// ⚠ THAT INDEPENDENCE IS THE POINT, AND THE BRIEF NAMES THE FAILURE IT AVOIDS:
// *"the alignment guard passes trivially if both positions come from one code
// path."* Calling `labelTopPct(gridlinesFor(mode)[i].y)` on both sides of an
// assertion proves only that a pure function is deterministic. So the expected
// value below is recomputed from the ATTRIBUTE THE SVG ACTUALLY CARRIES, read out
// of the rendered markup, and compared to the string the marks column actually
// carries. Delete the `data-pct` pairing and the two stop being connected.

const SERIES: PricePoint[] = [
	{ at: "2026-09-15T00:00:00.000Z", yes: "0.500000000000000000" },
	{ at: "2026-09-20T00:00:00.000Z", yes: "0.650000000000000000" },
];

const MODES = ["collapsed", "expanded", "hero"] as const;
type Mode = (typeof MODES)[number];

const PARSED = new Map<Mode, HTMLElement>();
function render(mode: Mode): HTMLElement {
	const cached = PARSED.get(mode);
	if (cached !== undefined) return cached;
	const html = renderToStaticMarkup(
		<MarketPriceChart series={SERIES} mode={mode} isOpen={true} />,
	);
	const body = new DOMParser().parseFromString(html, "text/html").body;
	PARSED.set(mode, body);
	return body;
}

function q(root: HTMLElement, testid: string): Element {
	const el = root.querySelector(`[data-testid="${testid}"]`);
	if (el === null)
		throw new Error(`[data-testid="${testid}"] absent — stale guard`);
	return el;
}

/** A class TOKEN, never a substring — `-` is a word boundary, so a substring
 * match for `pl-` would also fire on nothing here today and on `xpl-…` tomorrow. */
function tokens(el: Element): string[] {
	return (el.getAttribute("class") ?? "").split(/\s+/).filter(Boolean);
}

describe("debate-view::price-chart-marks-render-left — RF-1", () => {
	for (const mode of MODES) {
		it(`${mode}: the marks column is the row's LEADING cell, never its trailing one`, () => {
			const root = render(mode);
			const frame = q(root, "market-price-chart-frame");
			const inFlow = [...frame.children].map(
				(c) => c.getAttribute("data-testid") ?? "",
			);
			// ⛔ THE ASSERTION IS THE ORDER, BECAUSE THE ORDER IS THE SIDE. A flex row
			// says which side a cell sits on by nothing except its position among its
			// siblings — there is no `left`/`right` to read. So the guard that rejects
			// "a mark rendered in the right gutter" is an index comparison, and it is
			// exact rather than heuristic.
			expect(inFlow).toContain("chart-y-marks");
			expect(inFlow.indexOf("chart-y-marks")).toBeLessThan(
				inFlow.indexOf("market-price-chart-plot"),
			);
			// ⚠ POSITIVE CONTROL ON THE INDEX COMPARISON. `indexOf` returns −1 for an
			// absent testid, and −1 is less than every real index — so if the marks
			// column ever disappeared, the assertion above would PASS on the strength
			// of its own absence. This is the assertion that cannot be satisfied that
			// way.
			expect(inFlow.indexOf("market-price-chart-plot")).toBeGreaterThanOrEqual(
				1,
			);
		});

		it(`${mode}: the column's air faces the PLOT — pr, never pl`, () => {
			// ⚠ A TWO-CHARACTER DIFF THAT LOOKS LIKE NOTHING. The 6px is the gap
			// between the numerals and the gridlines they label. With the column on
			// the left, `pl-[6px]` puts that gap on the OUTSIDE — against the card's
			// own padding — and presses the numerals against the plot. The render is
			// wrong, nothing errors, and no other assertion in the repository can see
			// it.
			const col = q(render(mode), "chart-y-marks");
			const t = tokens(col);
			expect(t).toContain("pr-[6px]");
			expect(t).not.toContain("pl-[6px]");

			// ⛔⛔ AND THE MARK'S OWN OFFSET, WHICH IS THE HALF THAT CERTIFIED THE
			// DEFECT WHEN IT WAS MISSING. A mark is `absolute`, and `right` resolves
			// against the ancestor's PADDING BOX — whose right edge is the OUTER edge
			// of the padding. So `right: 0` lands the numeral flush with the column's
			// border edge and the padding sits behind it: measured in a real browser,
			// **0.00px of air**, against 6.00px before the column moved. The old
			// arrangement worked because the padding side and the alignment side were
			// OPPOSITE; making them the same side cancelled them.
			// ⇒ The air is the PAIR. Asserting the padding alone is what let this
			// through, so the pair is asserted.
			for (const mk of col.querySelectorAll("[data-pct]")) {
				expect(
					tokens(mk),
					`y-mark-${mk.getAttribute("data-pct")} is flush against the plot — the padding is behind it, not in front of it`,
				).toContain("right-[6px]");
			}
			// Right-aligned within its column, so the numerals form a clean edge
			// against the plot rather than a ragged one.
			expect(t).toContain("text-right");
		});
	}
});

describe("debate-view::price-chart-mark-aligns-to-gridline — RF-1", () => {
	for (const mode of MODES) {
		it(`${mode}: every mark's top is recomputed from its own gridline's rendered y1`, () => {
			const root = render(mode);
			const marksCol = q(root, "chart-y-marks");
			const grid = gridlinesFor(mode);
			expect(grid.length).toBeGreaterThan(0);

			for (const g of grid) {
				// Source A — the SVG attribute the browser will actually draw the rule at.
				const line = root.querySelector(
					`[data-testid="chart-gridlines"] line[data-pct="${g.pct}"]`,
				);
				if (line === null) throw new Error(`no gridline for ${g.pct}%`);
				const y1 = Number(line.getAttribute("y1"));
				expect(Number.isFinite(y1)).toBe(true);

				// Source B — the CSS string the mark is positioned with.
				const mark = marksCol.querySelector(`[data-testid="y-mark-${g.pct}"]`);
				if (mark === null) throw new Error(`no mark for ${g.pct}%`);
				const top = mark.getAttribute("style") ?? "";
				const pct = top.match(/(-?[\d.]+)%/);
				if (pct === null)
					throw new Error(`mark ${g.pct}% carries no % term: ${top}`);

				// The two must describe ONE position. Four decimal places is
				// `labelTopPct`'s own precision, so the tolerance is its rounding and
				// nothing looser.
				expect(Number(pct[1])).toBeCloseTo((y1 / VIEWBOX_H) * 100, 3);
			}
		});

		it(`${mode}: the boundary marks are held at the clamp, and only the boundary marks`, () => {
			// ⛔ RF-1 SAYS "WITHIN 1PX" AND THE TWO END MARKS ARE 5.00 PX OFF — MEASURED,
			// ON THE UNCHANGED TREE, BEFORE THIS TASK EDITED ANYTHING. That is not a
			// defect and it is not new: `markTop`'s edge clamp holds a mark whose centre
			// sits exactly on the plot's boundary half a box inside it, because the
			// column does not clip and an unclamped `0` would hang below the plot into
			// the date row. CHART-5's cited measurement (`mark50 ↔ line50 Δ = 0px`) is
			// an INTERIOR mark, and interior marks are exact.
			//
			// ⇒ The ruling is guarded as two claims instead of one loose one: interior
			// marks land on their line, boundary marks land on the clamp. Asserting a
			// blanket 1 px here would mean either a red suite or a tolerance widened
			// until it stopped meaning anything.
			const root = render(mode);
			const marksCol = q(root, "chart-y-marks");
			for (const g of gridlinesFor(mode)) {
				const mark = marksCol.querySelector(`[data-testid="y-mark-${g.pct}"]`);
				const top = mark?.getAttribute("style") ?? "";
				// Every mark carries the SAME clamp — the floor is a property of the
				// type, not of which mark it is. Only `0` and `100` ever reach it.
				expect(top).toMatch(/clamp\(\s*5px\s*,/);
				expect(top).toMatch(/calc\(100% - 5px\)/);
			}
			// ⚠ AND THE FLOOR IS HALF THE MARKS' OWN TYPE, NOT THE END LABEL'S. Both
			// are 10 today and they describe different things; `markTop`'s docblock
			// records the near-miss where it read the wrong one. If the marks' size
			// moves and this floor does not, the boundary marks silently leave their
			// clamp.
			expect(tokens(marksCol)).toContain("text-[10px]");
		});

		it(`${mode}: every mark is CENTRED on its top, not hung below it`, () => {
			// ⛔⛔ THE HALF OF RF-1's RULING THE ALIGNMENT CASE ABOVE CANNOT SEE, AND
			// A MUTATION PROVED IT. `top` places an element's TOP EDGE; what turns
			// that coordinate into "the mark's centre sits on its gridline" is
			// `-translate-y-1/2` beside it. Deleting that class from every mark drops
			// all eleven numbers half a box below the rules they label, on all three
			// modes — and it was GREEN across the whole chart suite, because the
			// percentage the alignment case reads is still exactly right. The
			// coordinate was never the claim; the coordinate PLUS the transform is.
			//
			// ⚠ THE END LABELS HAVE CARRIED THIS GUARD SINCE CHART-2
			// (`terminal-markers.test.tsx`, `label-anchor.test.tsx`) FOR THE SAME
			// REASON. RF-1 gave the marks column the same geometry on every mode and
			// it did not inherit the guard — which is what makes this an omission
			// rather than a new rule.
			const marksCol = q(render(mode), "chart-y-marks");
			const marks = [...marksCol.querySelectorAll("[data-pct]")];
			// Positive control on the loop itself: −1 and 0 are both "no violation".
			expect(marks.length).toBe(gridlinesFor(mode).length);
			for (const mk of marks) {
				expect(
					tokens(mk),
					`y-mark-${mk.getAttribute("data-pct")} hangs below its gridline`,
				).toContain("-translate-y-1/2");
			}
		});
	}
});
