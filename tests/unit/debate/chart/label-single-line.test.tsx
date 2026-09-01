// @vitest-environment jsdom

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MarketPriceChart } from "@/components/debate/chart/MarketPriceChart";
import type { PricePoint } from "@/server/discovery/price-series";

// CHART-7 · RF-2 — `debate-view::price-chart-label-is-single-line`
//
// ⛔ WHAT "ONE LINE" MEANS IN A RUNNER THAT PERFORMS NO LAYOUT. jsdom computes no
// line boxes, so "the two render side by side" cannot be observed here and is
// measured in the contact sheet. What IS observable, and is what actually decides
// it, is the display model: two INLINE spans share a line box; a `block` child
// starts a new one. So the guard is written against the mechanism rather than
// against its appearance — which is also the form that keeps working if the type
// sizes change.
//
// ⚠ AND THE NEGATIVE HAS TO NAME THE CLASS TOKEN, NEVER THE SUBSTRING. `block`
// appears inside `inline-block`, and `inline-block` would be a CORRECT spelling
// of one line. A substring ban would reject the fix.

const SERIES: PricePoint[] = [
	{ at: "2026-09-15T00:00:00.000Z", yes: "0.500000000000000000" },
	{ at: "2026-09-20T00:00:00.000Z", yes: "0.520000000000000000" },
];

const VALUE_MODES = ["expanded", "hero"] as const;

function dom(mode: "collapsed" | "expanded" | "hero"): HTMLElement {
	const html = renderToStaticMarkup(
		<MarketPriceChart series={SERIES} mode={mode} isOpen={true} />,
	);
	return new DOMParser().parseFromString(html, "text/html").body;
}

/** Every span inside one end label, the label itself excluded. */
function parts(root: HTMLElement, side: "yes" | "no"): Element[] {
	const label = root.querySelector(`[data-testid="terminal-label-${side}"]`);
	if (label === null) throw new Error(`no ${side} label — stale guard`);
	return [...label.querySelectorAll("span")];
}

/** Class TOKENS that would start a new line box. `inline-block` is deliberately
 * NOT here: it is a legitimate spelling of "on this line". */
const BREAKS_THE_LINE = new Set([
	"block",
	"flex",
	"grid",
	"table",
	"list-item",
]);

describe("debate-view::price-chart-label-is-single-line — RF-2", () => {
	for (const mode of VALUE_MODES) {
		it(`${mode}: name and value share one line box — no child starts a new one`, () => {
			const root = dom(mode);
			for (const side of ["yes", "no"] as const) {
				const spans = parts(root, side);
				// Positive control FIRST: the label really does carry two parts on this
				// mode, so the ban below is ranging over something. A label that lost
				// its value entirely would otherwise satisfy every negative here.
				expect(
					spans.length,
					`${mode}/${side}: expected a name and a value`,
				).toBe(2);
				for (const s of spans) {
					const t = (s.getAttribute("class") ?? "")
						.split(/\s+/)
						.filter(Boolean);
					for (const token of t) {
						expect(
							BREAKS_THE_LINE.has(token),
							`${mode}/${side}: \`${token}\` starts a new line box — the label would stack again`,
						).toBe(false);
					}
				}
			}
		});

		it(`${mode}: the air between them is HORIZONTAL — margin-left, never margin-top`, () => {
			// ⛔ THIS IS THE ASSERTION THAT SURVIVES A PARTIAL REVERT. Dropping `block`
			// but leaving the `margin-top` gives two inline spans on one line with the
			// value nudged down by 2px — one line, subtly misaligned, and the display
			// ban above stays green. The gap's axis is the other half of the ruling.
			const root = dom(mode);
			for (const side of ["yes", "no"] as const) {
				const value = root.querySelector(
					`[data-testid="terminal-value-${side}"]`,
				);
				const style = value?.getAttribute("style") ?? "";
				expect(style, `${mode}/${side}: value has no style`).not.toBe("");
				expect(style).toMatch(/margin-left:\s*\d/);
				expect(style).not.toMatch(/margin-top:/);
			}
		});
	}

	it("the collapsed card still carries the NAME ALONE — RF-2 changed the shape, not the gating", () => {
		// ⚠ RF-3 gives the collapsed card a full left scale; it does NOT give it the
		// value. Read together, the two refinements could be taken to mean every
		// mode now shows a percentage — this pins the reading the run took, so a
		// later change of mind is a deliberate edit rather than a drift.
		const root = dom("collapsed");
		for (const side of ["yes", "no"] as const) {
			expect(parts(root, side).length).toBe(1);
			expect(
				root.querySelector(`[data-testid="terminal-value-${side}"]`),
			).toBeNull();
		}
		// POSITIVE CONTROL — the same query style finds the value on a mode that has
		// one, so the nulls above mean "absent" and not "wrong selector".
		expect(
			dom("expanded").querySelector('[data-testid="terminal-value-yes"]'),
		).not.toBeNull();
	});

	it("the ban distinguishes `block` from `inline-block` — the control on the control", () => {
		// A substring ban would reject `inline-block`, which is a correct one-line
		// spelling. Asserted directly so the token form cannot quietly become a
		// substring form in a later tidy-up.
		expect(BREAKS_THE_LINE.has("block")).toBe(true);
		expect(BREAKS_THE_LINE.has("inline-block")).toBe(false);
		expect("inline-block".includes("block")).toBe(true);
	});
});
