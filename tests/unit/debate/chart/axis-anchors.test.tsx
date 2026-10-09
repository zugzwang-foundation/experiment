// @vitest-environment jsdom

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
	axisAnchorsFor,
	fmtUtcDay,
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

// CHART-7 · RF-4 — `debate-view::price-chart-axis-uses-calendar-anchors`
//
// ⛔ THE BRIEF NAMES TWO WRONG ANSWERS AND ONE WAY OF WRITING THE GUARD THAT
// CANNOT SEE EITHER. It must reject *"an axis label computed from the window's
// endpoints rather than the anchor list"* and *"an anchor outside the window being
// drawn"*, and it must *"assert against the REAL constants, not a fixture's"*.
//
// ⚠ AND THOSE TWO REQUIREMENTS PULL AGAINST EACH OTHER, WHICH IS THE INTERESTING
// PART. On PRODUCTION the window is `Sep 15 → Nov 5` and the anchors are
// `Sep 15 · Oct 1 · Nov 5` — so the first and last anchors ARE the window's
// endpoints, and against the real constants a window-derived axis and an
// anchor-derived one print the same two labels. The only label that can tell them
// apart is the INTERIOR one, which no window endpoint can produce. On staging the
// window opens 17 August and all three anchors are interior, so there the two
// rules diverge everywhere — but this suite runs `ZUGZWANG_ENV=prod`
// (tests/_setup/env.ts), which is the harder of the two and the one worth writing
// against.
//
// ⛔ AND THE OUT-OF-WINDOW BRANCH IS UNREACHABLE FROM EITHER SHIPPED
// CONFIGURATION. Both windows contain all three anchors, so a guard that only
// renders the component can never execute the filter — it would assert a rule
// nobody has run. That is why `axisAnchorsFor` takes the list and the window as
// PARAMETERS: the real anchors are driven through a synthetic window here, and the
// component's binding of the real list is asserted separately.

// ⚠⚠ SINCE 2026-10-06 THE PRODUCTION WINDOW STARTS 2026-10-05 (founder ruling:
// production renders like staging, #650). The paragraphs above describe the
// `Sep 15 → Nov 5` window. Now anchor 0 (`Sep 15`) lies BEFORE the window on
// both environments, so the out-of-window filter is LIVE in production, the
// shipped charts draw two anchors (`Oct 5 · Nov 5`), and both of those are
// window endpoints — against the real constants nothing can tell an anchor-
// derived axis from a window-derived one. The interior-anchor rule is therefore
// asserted through `axisAnchorsFor` on WIDE, a synthetic window containing all
// three anchors, and the component's binding of the real list is still asserted
// at the render below.

const SERIES: PricePoint[] = [
	{ at: "2026-10-07T00:00:00.000Z", yes: "0.500000000000000000" },
	{ at: "2026-10-12T00:00:00.000Z", yes: "0.620000000000000000" },
];

const START = Date.parse(MARKET_CHART_WINDOW_START);
const END = Date.parse(MARKET_CHART_WINDOW_END);
const DAY = 86_400_000;
/** A synthetic window that contains every shipped anchor, a day either side. */
const WIDE_START = Date.parse(MARKET_CHART_AXIS_ANCHORS[0]) - DAY;
const WIDE_END = Date.parse(MARKET_CHART_AXIS_ANCHORS[2]) + DAY;
/** The anchors inside the REAL window — what the shipped component draws. */
const IN_WINDOW = MARKET_CHART_AXIS_ANCHORS.filter((a) => {
	const t = Date.parse(a);
	return t >= START && t <= END;
}).map(fmtUtcDay);

function labels(mode: "collapsed" | "expanded" | "hero"): string[] {
	const html = renderToStaticMarkup(
		<MarketPriceChart series={SERIES} mode={mode} isOpen={true} />,
	);
	const body = new DOMParser().parseFromString(html, "text/html").body;
	return [...body.querySelectorAll('[data-testid^="axis-x-anchor-"]')].map(
		(el) => el.textContent ?? "",
	);
}

describe("debate-view::price-chart-axis-uses-calendar-anchors — the drawn set", () => {
	it("the collapsed card draws the FIRST and LAST in-window anchors; the wider modes draw every in-window one", () => {
		const all = MARKET_CHART_AXIS_ANCHORS.map(fmtUtcDay);
		expect(all).toHaveLength(3);
		expect(IN_WINDOW).toEqual([all[1], all[2]]);

		expect(labels("collapsed")).toEqual([IN_WINDOW[0], IN_WINDOW.at(-1)]);
		expect(labels("expanded")).toEqual(IN_WINDOW);
		// ⛔ THE HERO GAINED AN AXIS AT CHART-7 AND IT HAD NONE BEFORE. RF-4's table
		// names `expanded` AND `hero`; the canon text it ratifies reads "plus `Oct 1`
		// on the wider modes". Pinned here because it is the single most reversible
		// reading in this task — one arm of one predicate — and a founder who meant
		// otherwise should find it named rather than buried.
		expect(labels("hero")).toEqual(IN_WINDOW);
		// ...and with all three inside a window, the wider modes draw all three
		// while the card keeps two: the rule, on the window where it can show.
		const wide = (mode: "collapsed" | "expanded") =>
			axisAnchorsFor(MARKET_CHART_AXIS_ANCHORS, mode, WIDE_START, WIDE_END).map(
				(a) => a.i,
			);
		expect(wide("expanded")).toEqual([0, 1, 2]);
		expect(wide("collapsed")).toEqual([0, 2]);
	});

	it("MUST REJECT a label computed from the window's endpoints", () => {
		// ⛔ THE INTERIOR ANCHOR IS THE WHOLE ASSERTION UNDER THE PRODUCTION WINDOW.
		// `Sep 15` and `Nov 5` are BOTH the anchors and the window's ends there, so
		// they cannot discriminate; `Oct 1` is an anchor and is not an endpoint, so a
		// window-derived axis cannot produce it at any count.
		// Asserted on WIDE: under the real window the interior anchor IS the
		// window start (2026-10-05), so it cannot discriminate there (see header).
		const drawnWide = axisAnchorsFor(
			MARKET_CHART_AXIS_ANCHORS,
			"expanded",
			WIDE_START,
			WIDE_END,
		).map((a) => a.i);
		expect(drawnWide).toContain(1);
		const interior = Date.parse(MARKET_CHART_AXIS_ANCHORS[1]);
		expect(interior).toBeGreaterThan(WIDE_START);
		expect(interior).toBeLessThan(WIDE_END);

		// …and the superseded rule's own answers are absent. The thirds of the window
		// are what the collapsed card printed until CHART-7; derived here from the
		// real constants so this reddens under either environment.
		const third = (f: number) =>
			fmtUtcDay(new Date(START + (END - START) * f).toISOString());
		for (const gone of [third(1 / 3), third(2 / 3)]) {
			// Only meaningful if the superseded answer differs from a live one — under
			// some window it might not, and then this line proves nothing rather than
			// proving something false.
			if (!MARKET_CHART_AXIS_ANCHORS.map(fmtUtcDay).includes(gone)) {
				expect(labels("collapsed")).not.toContain(gone);
				expect(labels("expanded")).not.toContain(gone);
			}
		}
	});

	it("MUST REJECT the superseded testids, which asserted a POSITION rather than a date", () => {
		const html = renderToStaticMarkup(
			<MarketPriceChart series={SERIES} mode="expanded" isOpen={true} />,
		);
		const body = new DOMParser().parseFromString(html, "text/html").body;
		for (const stale of [
			"axis-x-start",
			"axis-x-end",
			"axis-x-label-first",
			"axis-x-label-second",
			"axis-x-label-end",
		]) {
			expect(
				body.querySelector(`[data-testid="${stale}"]`),
				`${stale} names a position in the plot, which a calendar axis makes environment-dependent`,
			).toBeNull();
		}
		// POSITIVE CONTROL — the same query style finds the labels that DO ship, so
		// the five nulls above mean "absent" rather than "wrong selector".
		expect(
			body.querySelectorAll('[data-testid^="axis-x-anchor-"]').length,
		).toBe(IN_WINDOW.length);
	});
});

describe("debate-view::price-chart-axis-uses-calendar-anchors — the window filter", () => {
	// ⚠ THE REAL ANCHOR LIST, DRIVEN THROUGH SYNTHETIC WINDOWS. The list is the
	// shipped constant in every case below — what varies is the window, which is the
	// only variable that can make the filter do anything.

	it("the shipped window drops the first anchor — the filter is LIVE in production since 2026-10-06", () => {
		// Stated as a measurement. Until 2026-10-06 the production window
		// contained all three anchors and this filter never ran there; with the
		// window starting 2026-10-05 (like staging), `Sep 15` is before it.
		expect(
			axisAnchorsFor(MARKET_CHART_AXIS_ANCHORS, "expanded", START, END).map(
				(a) => a.i,
			),
		).toEqual([1, 2]);
		expect(xPx(MARKET_CHART_AXIS_ANCHORS[0], START, END)).toBeLessThan(0);
	});

	it("MUST REJECT an anchor before the window start", () => {
		// A window opening the day after the first anchor.
		const late = Date.parse(MARKET_CHART_AXIS_ANCHORS[0]) + DAY;
		const drawn = axisAnchorsFor(
			MARKET_CHART_AXIS_ANCHORS,
			"expanded",
			late,
			END,
		);
		expect(drawn.map((a) => a.i)).toEqual([1, 2]);

		// ⛔ WHY IT MATTERS, NOT JUST THAT IT HAPPENS. `xPx` is unclamped in both
		// directions by design, so the dropped anchor would have rendered at a
		// NEGATIVE x — and the date labels are HTML since CHART-7, which does not
		// clip. Measured here rather than asserted: the anchor really is off the
		// canvas to the left.
		expect(xPx(MARKET_CHART_AXIS_ANCHORS[0], late, END)).toBeLessThan(0);
	});

	it("MUST REJECT an anchor after the window end", () => {
		const early = Date.parse(MARKET_CHART_AXIS_ANCHORS[2]) - DAY;
		const drawn = axisAnchorsFor(
			MARKET_CHART_AXIS_ANCHORS,
			"expanded",
			WIDE_START,
			early,
		);
		expect(drawn.map((a) => a.i)).toEqual([0, 1]);
		expect(
			xPx(MARKET_CHART_AXIS_ANCHORS[2], WIDE_START, early),
		).toBeGreaterThan(VIEWBOX_W);
	});

	it("the collapsed card takes the first and last of what SURVIVES, never of the raw list", () => {
		// ⛔ THE FAILURE THIS REJECTS IS ONE END LABELLED TWICE. Read off the raw
		// list, a window that excluded the last anchor would give the card
		// `[anchors[0], anchors[2]]` with the second one undrawn — or, worse, the
		// same anchor at both ends. Here the window excludes the LAST, so the card
		// must fall back to the interior one.
		const early = Date.parse(MARKET_CHART_AXIS_ANCHORS[2]) - DAY;
		const drawn = axisAnchorsFor(
			MARKET_CHART_AXIS_ANCHORS,
			"collapsed",
			WIDE_START,
			early,
		);
		expect(drawn.map((a) => a.i)).toEqual([0, 1]);
		expect(new Set(drawn.map((a) => a.i)).size).toBe(drawn.length);
	});

	it("a window containing ONE anchor draws one, and a window containing none draws none", () => {
		const only = Date.parse(MARKET_CHART_AXIS_ANCHORS[1]);
		expect(
			axisAnchorsFor(
				MARKET_CHART_AXIS_ANCHORS,
				"collapsed",
				only - 1,
				only + 1,
			).map((a) => a.i),
		).toEqual([1]);
		// A window entirely before the experiment. The chart still renders its lines;
		// what must not happen is a label at a coordinate outside the plot.
		expect(
			axisAnchorsFor(
				MARKET_CHART_AXIS_ANCHORS,
				"expanded",
				Date.parse("2026-01-01T00:00:00Z"),
				Date.parse("2026-02-01T00:00:00Z"),
			),
		).toEqual([]);
	});
});

describe("debate-view::price-chart-axis-uses-calendar-anchors — the component binds the REAL list", () => {
	it("every rendered label is an anchor's own UTC day, and the index in its testid is that anchor's", () => {
		// ⛔ THE PARAMETERISATION THAT MAKES THE FILTER TESTABLE IS ALSO A HOLE, AND
		// THIS IS WHAT CLOSES IT. `axisAnchorsFor` accepts any list, so the component
		// could pass a fixture and every case above would still pass while the
		// product labelled dates nobody ruled. The binding is asserted at the render:
		// each testid's index must select the anchor whose day the element prints.
		const html = renderToStaticMarkup(
			<MarketPriceChart series={SERIES} mode="expanded" isOpen={true} />,
		);
		const body = new DOMParser().parseFromString(html, "text/html").body;
		const els = [...body.querySelectorAll('[data-testid^="axis-x-anchor-"]')];
		expect(els).toHaveLength(IN_WINDOW.length);
		expect(els.length).toBeGreaterThanOrEqual(2);
		for (const el of els) {
			const i = Number(
				(el.getAttribute("data-testid") ?? "").replace("axis-x-anchor-", ""),
			);
			expect(Number.isInteger(i)).toBe(true);
			expect(MARKET_CHART_AXIS_ANCHORS[i]).toBeDefined();
			expect(el.textContent).toBe(fmtUtcDay(MARKET_CHART_AXIS_ANCHORS[i]));
			// …and it is positioned at that anchor's own x on the real window.
			expect(Number(el.getAttribute("data-plot-x"))).toBeCloseTo(
				xPx(MARKET_CHART_AXIS_ANCHORS[i], START, END),
				4,
			);
		}
	});
});
