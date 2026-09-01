// @vitest-environment jsdom

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
	fmtUtcDay,
	SVG_W,
	VIEWBOX_W,
	xPx,
} from "@/components/debate/chart/geometry";
import { MarketPriceChart } from "@/components/debate/chart/MarketPriceChart";
import {
	MARKET_CHART_AXIS_ANCHORS,
	MARKET_CHART_WINDOW_END,
	MARKET_CHART_WINDOW_START,
} from "@/server/config/limits";
import type { PricePoint } from "@/server/discovery/price-series";

// CHART-7 · RF-3/RF-4/RF-5 — the X-axis date ROW, as opposed to the anchor SET.
//
// ⛔⛔ WHY THIS FILE EXISTS BESIDE `axis-anchors.test.tsx`, WHICH ALREADY COVERS
// RF-4. That file asserts WHICH anchors are drawn and WHAT each one says, and it
// pins each element's position by reading `data-plot-x`. **`data-plot-x` does not
// position anything.** It is a diagnostic attribute the component writes for
// tests; the shipped position is the inline `left`, and the shipped meaning of
// that `left` is decided by a `-translate-x-*` class beside it. Both were
// unasserted, and three separate mutations proving it went GREEN across the whole
// chart suite (223 tests):
//
//   · `left` divided by `VIEWBOX_W` (640) instead of `SVG_W` (649) — every date
//     lands 1.4 % of the plot right of the tick it names. This is CHART-6's own
//     founding defect, one element over, and `labelLeftPct`'s docblock names the
//     divisor as "the one thing to get right here";
//   · every label anchored `middle`, including the two at the plot's edges — under
//     the production window `Sep 15` sits at x = 0 and `Nov 5` at x = VIEWBOX_W, so
//     half of each hangs outside a row that is HTML and therefore does not clip;
//   · `leading-none` dropped from the row — `AXIS_DATE_BAND_PX` is composed as
//     `AXIS_DATE_PX + AXIS_DATE_BOTTOM_PX` and is only the row's real height while
//     its line-height is 1 (AGENTS.md §8: an arbitrary/inline type size does NOT
//     reset the paired line-height). Evaluated as CSS, the lower end label's
//     clearance over this row is **exactly 0.00 px** at every mode and every plot
//     height — so a row one line-height taller does not narrow a margin, it
//     re-opens the overlap RF-5 was written to close.
//
// ⇒ **A guard that reads the attribute a component emits FOR the guard has not
// read the render.** Every assertion here is against a property the browser
// consumes.

const SERIES: PricePoint[] = [
	{ at: "2026-10-07T00:00:00.000Z", yes: "0.500000000000000000" },
	{ at: "2026-10-12T00:00:00.000Z", yes: "0.620000000000000000" },
];

const START = Date.parse(MARKET_CHART_WINDOW_START);
const END = Date.parse(MARKET_CHART_WINDOW_END);
const MODES = ["collapsed", "expanded", "hero"] as const;

function markup(mode: (typeof MODES)[number], series = SERIES): string {
	return renderToStaticMarkup(
		<MarketPriceChart series={series} mode={mode} isOpen={true} />,
	);
}

function dom(html: string): HTMLElement {
	return new DOMParser().parseFromString(html, "text/html").body;
}

function anchorEls(root: HTMLElement): Element[] {
	return [...root.querySelectorAll('[data-testid^="axis-x-anchor-"]')];
}

/** The anchor's index in the shipped list, read back off its own testid. */
function indexOf(el: Element): number {
	return Number(
		(el.getAttribute("data-testid") ?? "").replace("axis-x-anchor-", ""),
	);
}

/** The `left` declaration React shipped, read wherever it sits in the style
 * attribute — never assumed to be first. */
function leftPctOf(el: Element): number {
	const left = el.getAttribute("style")?.match(/left:\s*([\d.]+)%/)?.[1] ?? "";
	expect(left, `no left% on ${el.getAttribute("data-testid")}`).not.toBe("");
	return Number(left);
}

function tokens(el: Element): string[] {
	return (el.getAttribute("class") ?? "").split(/\s+/).filter(Boolean);
}

describe("debate-view::price-chart-axis-date-sits-on-its-own-tick — RF-3/RF-4", () => {
	for (const mode of MODES) {
		it(`${mode}: each date's LEFT is its anchor's x over SVG_W — the shipped position, not data-plot-x`, () => {
			const root = dom(markup(mode));
			const els = anchorEls(root);
			expect(els.length, `${mode}: no date row`).toBeGreaterThan(0);

			let discriminating = 0;
			for (const el of els) {
				const i = indexOf(el);
				expect(MARKET_CHART_AXIS_ANCHORS[i]).toBeDefined();

				// ⛔ DERIVED FROM THE ANCHOR AND THE SHIPPED WINDOW, NOT READ BACK OUT
				// OF THE ELEMENT. `data-plot-x` descends from the same expression the
				// component positions with only if the component positions with it —
				// which is the thing in question. `label-anchor.test.tsx` does exactly
				// this for the END labels; the date row never got it.
				const x = xPx(MARKET_CHART_AXIS_ANCHORS[i], START, END);
				expect(leftPctOf(el)).toBeCloseTo((x / SVG_W) * 100, 3);

				// …and `data-plot-x` must agree with it, so the diagnostic attribute
				// cannot drift away from the thing it is read as a proxy for.
				expect(Number(el.getAttribute("data-plot-x"))).toBeCloseTo(x, 4);

				// Non-vacuity on the DIVISOR specifically: at x = 0 the two candidate
				// divisors give the same answer, so only a non-zero x discriminates.
				if (x > 0) discriminating++;
			}
			expect(
				discriminating,
				`${mode}: every drawn anchor sits at x = 0, so nothing here can see the divisor`,
			).toBeGreaterThan(0);
		});

		it(`${mode}: the hang is a pure function of the x — edge anchors never straddle the plot`, () => {
			// ⛔ THE FAILURE IS HALF A LABEL OUTSIDE A LAYER THAT DOES NOT CLIP. A date
			// at the plot's left edge must hang RIGHT of its x; one at the right edge
			// must hang LEFT; everything between is centred on the tick it names. The
			// component's own docblock calls this "the form that survives RF-4" and
			// nothing asserted it.
			//
			// ⚠ UNDER THE PRODUCTION WINDOW ALL THREE ARMS RUN IN ONE RENDER, because
			// the first and last anchors ARE the window's endpoints there. That is the
			// same coincidence `axis-anchors.test.tsx` warns makes the anchor SET hard
			// to discriminate — here it is what makes the hang easy to.
			const root = dom(markup(mode));
			const seen = new Set<string>();
			for (const el of anchorEls(root)) {
				const x = xPx(MARKET_CHART_AXIS_ANCHORS[indexOf(el)], START, END);
				const t = tokens(el);
				const hang =
					x <= 0
						? "start"
						: x >= VIEWBOX_W
							? "end"
							: ("middle" as "start" | "middle" | "end");
				seen.add(hang);
				if (hang === "start") {
					expect(t, `x=${x} must hang right`).not.toContain(
						"-translate-x-full",
					);
					expect(t, `x=${x} must hang right`).not.toContain("-translate-x-1/2");
				} else if (hang === "end") {
					expect(t, `x=${x} must hang left`).toContain("-translate-x-full");
					expect(t).not.toContain("-translate-x-1/2");
				} else {
					expect(t, `x=${x} must be centred`).toContain("-translate-x-1/2");
					expect(t).not.toContain("-translate-x-full");
				}
			}
			// Non-vacuity: this mode's drawn set really did exercise more than one arm.
			// The collapsed card draws two anchors, the wider modes three.
			expect(seen.size).toBeGreaterThanOrEqual(2);
		});

		it(`${mode}: the row declares \`leading-none\`, which is what makes its band term true`, () => {
			// ⛔ `AXIS_DATE_BAND_PX` = `AXIS_DATE_PX + AXIS_DATE_BOTTOM_PX`, and
			// `lowerTop` subtracts it so the lower end label stops exactly at the row's
			// top edge. Evaluated as CSS at every shipped plot height, that clearance
			// is **0.00 px** — the label's bottom edge lands ON the row, by
			// construction. So the band is only correct while the row's rendered box
			// IS `AXIS_DATE_PX`, and an inline `font-size` does not reset the inherited
			// line-height (AGENTS.md §8). Without `leading-none` the row is taller than
			// the band reserves and the CHART-6 overlap RF-5 closed re-opens, with no
			// margin to absorb it.
			const root = dom(markup(mode));
			const row = root.querySelector('[data-testid="axis-date-row"]');
			expect(row, `${mode}: no date row`).not.toBeNull();
			expect(tokens(row as Element)).toContain("leading-none");
			// POSITIVE CONTROL — the same read finds the END labels' own
			// `leading-none`, so "contains it" here is a real read and not a matcher
			// that would find the token anywhere.
			const layer = root.querySelector('[data-testid="terminal-label-layer"]');
			expect(tokens(layer as Element)).toContain("leading-none");
		});
	}

	it("the dates are LARGER than the numeric marks — RF-3's ruling, not just its move", () => {
		// ⛔ RF-3 IS TWO CLAIMS AND ONLY ONE WAS GUARDED. The move out of the stretched
		// viewBox is structural and is pinned in three files; the SIZE — "the dates are
		// too small; increase them, and check the result against the marks' 10 px so
		// the two scales do not fight" — is a bare number in the component and nothing
		// read it. Reverting `AXIS_DATE_PX` to 8, i.e. SMALLER than the marks it was
		// ruled against, is green across the whole chart suite.
		//
		// ⚠ BOTH SIDES ARE READ FROM THE SAME MARKUP rather than mirrored as literals,
		// so this asserts the RELATION the ruling states and not two numbers that
		// happen to be today's.
		const m = markup("expanded");
		const rowPx = Number(
			m.match(/axis-date-row"[^>]*style="[^"]*font-size:(\d+)px/)?.[1],
		);
		const markPx = Number(
			m.match(/chart-y-marks"[^>]*class="[^"]*text-\[(\d+)px\]/)?.[1],
		);
		expect(rowPx, "the date row declares no size").toBeGreaterThan(0);
		expect(markPx, "the marks column declares no size").toBeGreaterThan(0);
		expect(
			rowPx,
			`the axis (${rowPx}px) must read as a step above the marks (${markPx}px)`,
		).toBeGreaterThan(markPx);
	});

	it("the reserve budgets the air AND the ring, not just the label", () => {
		// ⛔ THE RESERVE'S PADDING IS THE OTHER TWO OF ITS THREE MEASURED INPUTS, AND
		// NOTHING READ IT. `LabelReserve` holds `labelWidth + LABEL_AIR_PX +
		// RESERVE_RING_PX`; a label anchored at the dot's maximum in-window x starts
		// `LABEL_AIR_PX` past the plot's own edge, so with the padding zeroed the
		// widest label overhangs the frame by ~4 px on every surface. Zeroing it is
		// green across the whole chart suite.
		//
		// ⚠ ASSERTED AS A FLOOR AGAINST THE AIR THE LABELS THEMSELVES USE, read out of
		// a shipped `left`, rather than as a literal — the two are the same 5 px by
		// construction (`labelLeftCss` and the reserve both spend `LABEL_AIR_PX`) and
		// pinning a number here would be a second declaration of it.
		for (const mode of MODES) {
			const root = dom(markup(mode));
			const reserve = root.querySelector('[data-testid="chart-label-reserve"]');
			expect(reserve, `${mode}: no reserve`).not.toBeNull();
			const pad = Number(
				(reserve as Element)
					.getAttribute("style")
					?.match(/padding-left:\s*([\d.]+)px/)?.[1],
			);
			const air = Number(
				root
					.querySelector('[data-testid="terminal-label-yes"]')
					?.getAttribute("style")
					?.match(/\+\s*([\d.]+)px/)?.[1],
			);
			expect(
				air,
				`${mode}: could not read the label's own air`,
			).toBeGreaterThan(0);
			expect(
				pad,
				`${mode}: the reserve must hold at least the label's own air plus the ring`,
			).toBeGreaterThan(air);
		}
	});
});

describe("debate-view::price-chart-axis-uses-calendar-anchors — the component's own WINDOW", () => {
	// ⛔⛔ THE HOLE THE PARAMETERISATION LEFT OPEN, ONE ARGUMENT ACROSS FROM THE ONE
	// THAT WAS CLOSED. `axisAnchorsFor` takes BOTH the anchor list and the window as
	// parameters; `axis-anchors.test.tsx` closes the LIST by reading each rendered
	// testid's index back into the real array, and drives the FILTER through
	// synthetic windows by calling the pure function directly. Nothing connects the
	// component's own `startMs`/`endMs` to the filter — so replacing the call site's
	// window with `(-Infinity, +Infinity)` deletes the out-of-window branch from the
	// product while every parameterised case still passes. Measured: GREEN, 210/210.
	//
	// ⚠ AND THE WINDOW IS THE ARGUMENT THAT CAN ACTUALLY MOVE. The anchor list takes
	// no environment branch (`limits.ts` says so in terms); the window is resolved
	// from `ZUGZWANG_ENV` at module load. So the branch nobody can reach today is
	// exactly the branch a third environment reaches first, with an anchor mapping to
	// a negative x in an HTML row that does not clip.
	//
	// ⇒ Driven through the COMPONENT by narrowing the shipped window at its source,
	// which is the only way to observe the binding rather than the function.

	async function labelsUnderWindow(
		narrowStart?: (anchors: readonly string[]) => string,
	): Promise<{ ids: number[]; days: string[] }> {
		vi.resetModules();
		if (narrowStart !== undefined) {
			vi.doMock("@/server/config/limits", async (importOriginal) => {
				const actual =
					await importOriginal<typeof import("@/server/config/limits")>();
				return {
					...actual,
					MARKET_CHART_WINDOW_START: narrowStart(
						actual.MARKET_CHART_AXIS_ANCHORS,
					),
				};
			});
		}
		const mod = await import("@/components/debate/chart/MarketPriceChart");
		const root = dom(
			renderToStaticMarkup(
				<mod.MarketPriceChart series={SERIES} mode="expanded" isOpen={true} />,
			),
		);
		const els = anchorEls(root);
		return {
			ids: els.map(indexOf),
			days: els.map((el) => el.textContent ?? ""),
		};
	}

	it("POSITIVE CONTROL — under the real window the component draws every anchor", async () => {
		vi.doUnmock("@/server/config/limits");
		const { ids } = await labelsUnderWindow();
		expect(ids).toEqual([0, 1, 2]);
	});

	it("MUST REJECT an anchor the component's OWN window excludes", async () => {
		const { ids, days } = await labelsUnderWindow((anchors) =>
			new Date(Date.parse(anchors[0]) + 86_400_000).toISOString(),
		);
		// The first anchor is now a day before the window opens, so it is not drawn.
		expect(ids).toEqual([1, 2]);
		expect(days).not.toContain(fmtUtcDay(MARKET_CHART_AXIS_ANCHORS[0]));
		vi.doUnmock("@/server/config/limits");
		vi.resetModules();
	});
});
