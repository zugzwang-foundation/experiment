// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// UI.19 Slice 1 tests-first (plan §Slice 1 render tests) — the RED driver for the
// collapsed market-detail price-chart components (SPEC.1 1.0.22 §9 / F-DEBATE-5),
// mirroring the profile card→overlay render pattern (tests/unit/profile/render/
// graph.test.tsx).
//
// RED target: NEITHER `@/components/debate/chart/MarketPriceChart`,
// `@/components/debate/chart/MarketPriceChartCard`, NOR the `VIEWBOX_W` export on
// `@/components/debate/chart/geometry` exists yet, so this file fails at
// COLLECTION until Slice 1's implement phase lands them. `@/components/debate/
// MarketHeader` exists but does NOT yet accept a `priceChart` prop nor mount a
// chart — its RED here rides the same collection failure (CLAUDE.md §5.6).
//
// Contract this file PINS (data-testid keys, mirroring ProfileChart's):
//   MarketPriceChart({ series, mode: "collapsed" | "expanded" })
//     → <svg data-testid="market-price-chart" aria-hidden="true"> with
//       <polyline data-testid="line-yes"> + <polyline data-testid="line-no">;
//       axis <text data-testid="axis-x-start"|"axis-x-end"> in EXPANDED only;
//       NO nodes in Slice 1.
//   MarketPriceChartCard({ series, onExpand })
//     → <button data-testid="market-price-chart-card"> wrapping the aria-hidden
//       chart svg + a NON-aria-hidden `sr-only` data-testid="market-price-chart-
//       summary" naming opening %, current %, and the two domain endpoints.
//   MarketHeader({ market, priceChart }) — renders the chart host above PriceBar
//       ONLY when `priceChart` is non-null (web Gate-C error-state).
//
// Render tests key on data-testid + structural attributes, NEVER on copy strings
// (plan §6 / OQ-7). Prices cross as decimal STRINGS (CLAUDE.md §2).

import { VIEWBOX_W, xPx } from "@/components/debate/chart/geometry";
import { MarketPriceChart } from "@/components/debate/chart/MarketPriceChart";
import { MarketPriceChartCard } from "@/components/debate/chart/MarketPriceChartCard";
import { MarketHeader } from "@/components/debate/MarketHeader";
import type { DebateMarketHeader } from "@/components/debate/types";
import {
	MARKET_CHART_AXIS_ANCHORS,
	MARKET_CHART_WINDOW_END,
	MARKET_CHART_WINDOW_START,
} from "@/server/config/limits";
// UI.19 Slice 2 additive: the expanded-mode post-node type. TYPE-ONLY (erased) —
// does not exist on the slice-1 price-chart module yet, so it drives no runtime
// import; the RED below is the node MARKS not rendering (assertion), the RIGHT
// reason (CLAUDE.md §5.6).
import type { ChartNode } from "@/server/debate-view/price-chart";

type PricePoint = { at: string; yes: string };

afterEach(cleanup);

// A three-point YES/NO series across a 5-day window.
const SERIES: PricePoint[] = [
	{ at: "2026-09-15T00:00:00.000Z", yes: "0.500000000000000000" },
	{ at: "2026-09-17T00:00:00.000Z", yes: "0.640000000000000000" },
	{ at: "2026-09-20T00:00:00.000Z", yes: "0.800000000000000000" },
];

// Opening 50 % (2026-09-15) → current 80 % (2026-09-20) — the sr-only summary
// must name both plus the two endpoint dates.
const SUMMARY_SERIES: PricePoint[] = [
	{ at: "2026-09-15T00:00:00.000Z", yes: "0.500000000000000000" },
	{ at: "2026-09-20T00:00:00.000Z", yes: "0.800000000000000000" },
];

// The unbet market: one seed point → the chart renders a flat line at the
// opening price. Its instant IS `MARKET_CHART_WINDOW_START`, so it maps to
// x = 0.
const SINGLE: PricePoint[] = [
	{ at: "2026-09-15T00:00:00.000Z", yes: "0.500000000000000000" },
];

/**
 * ⛔ THE SAME UNBET MARKET, BUT SEEDED STRICTLY INSIDE THE WINDOW, AND IT EXISTS
 * BECAUSE `SINGLE` CANNOT DISCRIMINATE THE D9 RULING. `SINGLE`'s only point sits
 * exactly on `MARKET_CHART_WINDOW_START`, so `xPx` returns 0 for it — and a
 * guard asserting "the flat line stops at the point's own x, not at the window
 * end" written against `SINGLE` would compare 0 against 0 and pass whether the
 * fix is present or reverted. That is the shape of a control that cannot fire.
 *
 * This point is 2026-10-01, sixteen days into a ~52-day production window, so
 * its x is strictly between 0 and `VIEWBOX_W` and the two answers — "ends at its
 * own instant" and "ends at the axis end" — are different numbers. It is the
 * same reason `INTERIOR` exists for the axis-label guards, one ruling later.
 */
const SINGLE_INTERIOR: PricePoint[] = [
	{ at: "2026-10-01T00:00:00.000Z", yes: "0.500000000000000000" },
];

/**
 * ⚠ A SERIES WHOSE ENDPOINTS ARE STRICTLY INSIDE THE WINDOW AT BOTH ENDS, AND
 * IT EXISTS BECAUSE `SERIES` CANNOT DISCRIMINATE. `SERIES` opens on
 * 2026-09-15, which IS `MARKET_CHART_WINDOW_START` under the production
 * window — so a "the label names the window" assertion written against it
 * reads "Sep 15" under the correct rule AND under the reverted one, and pins
 * one endpoint instead of two. Every instant here differs from both window
 * endpoints, so both labels discriminate.
 */
const INTERIOR: PricePoint[] = [
	{ at: "2026-10-01T00:00:00.000Z", yes: "0.200000000000000000" },
	{ at: "2026-10-04T00:00:00.000Z", yes: "0.300000000000000000" },
	{ at: "2026-10-11T00:00:00.000Z", yes: "0.250000000000000000" },
];

// YES winning at every point (yes > 0.5) — the INV-3 GEOMETRY guard: the YES
// line must sit ABOVE the NO line (a smaller SVG y) at the same x.
const YES_WINNING: PricePoint[] = [
	{ at: "2026-09-15T00:00:00.000Z", yes: "0.700000000000000000" },
	{ at: "2026-09-20T00:00:00.000Z", yes: "0.800000000000000000" },
];

// ⚠ BLOCK-1 — `slug` must be one of the eight known live markets or
// `ResolverCards` throws (G1). This file doesn't test ResolverCards'
// content, so the specific slug doesn't matter beyond being valid.
const MARKET: DebateMarketHeader = {
	id: "0190c0de-1111-7000-8000-000000000001",
	slug: "bitcoin-price-50k",
	title: "Chart Market Question",
	description: "Resolution criterion text.",
	status: "Open",
	mediaVideoUrl: null,
	mediaImageUrl: null,
	pricing: { yes: "0.500000000000000000", no: "0.500000000000000000" },
	unitToWin: { yes: "1.960000000000000000", no: "1.960000000000000000" },
	totals: {
		dharmaStaked: "150.000000000000000000",
		postCount: 3,
		replyCount: 5,
	},
};

// UI.19 Slice 2 — two expanded-mode post nodes, one per side. Each renders as an
// SVG element `data-testid="graph-node-<id>"` carrying `data-side` and a
// side-bound `--graph-yes`/`--graph-no` fill (INV-3 node binding, decision #7 —
// never the `--color-yes`/`--color-no` slot the profile chart uses, which would
// make a YES node invisible against the ground). NODES[0] = YES, NODES[1] = NO.
const NODES: ChartNode[] = [
	{
		id: "0190c0de-2222-7000-8000-0000000000a1",
		side: "YES",
		at: "2026-09-17T00:00:00.000Z",
		yYes: "0.640000000000000000",
	},
	{
		id: "0190c0de-2222-7000-8000-0000000000b2",
		side: "NO",
		at: "2026-09-19T00:00:00.000Z",
		yYes: "0.300000000000000000",
	},
];

/** Every element under `root` whose data-testid starts with `prefix`. */
function byPrefix(root: ParentNode, prefix: string): Element[] {
	return Array.from(root.querySelectorAll(`[data-testid^="${prefix}"]`));
}

/** Parse an SVG `points` attribute ("x,y x,y …") into [x, y] number pairs. */
function parsePoints(attr: string): [number, number][] {
	return attr
		.trim()
		.split(/\s+/)
		.filter((s) => s.length > 0)
		.map((pair) => {
			const [x, y] = pair.split(",");
			return [Number(x), Number(y)] as [number, number];
		});
}

describe("UI.19 §9 — market price-chart render (collapsed card, no nodes)", () => {
	// ── 1. Collapsed = two lines, NO axis, NO nodes (F-DEBATE-5 acceptance) ─────
	/**
	 * ⚠⚠ THIS ROW WAS `collapsed-renders-no-axis` AND IT IS REVERSED BY SPEC.1
	 * 1.0.32 (HTML-FINISH · MARKET DETAIL round 2 · R8, founder-ruled 2026-08-16).
	 * The superseded body asserted `queryByTestId("axis-x-start") === null` and
	 * `…("axis-x-end") === null`, with the expanded render as its positive
	 * control. The collapsed chart is now the market's primary price surface in
	 * the header rail, and a price series without a time axis is not readable.
	 *
	 * ⛔⛔ AND IT IS STRENGTHENED, NOT MERELY INVERTED — this is the whole point,
	 * and the reason round 1 reported the row instead of shipping it.
	 *
	 * THE HOLE: d5 draws its `.xtick` / `.xlab` as absolutely-positioned DIVS
	 * *over* the graph (`d5:496-499`), OUTSIDE the `<svg>`. The old guard asserted
	 * the ABSENCE of two testids; a faithful port of d5's structure would have
	 * carried different testids on DOM siblings of the chart and sailed past it
	 * GREEN while the property the assertion NAMED — "collapsed has no axis" — was
	 * false on screen. Satisfying the letter of a guard while breaking the
	 * property it names is the "fix the guard, not the code" inversion in
	 * disguise, and an inverted-but-otherwise-identical assertion would inherit
	 * the identical hole in the other direction: an axis built as sibling divs
	 * would pass a bare `getByTestId` too, because `screen` queries the whole
	 * document body.
	 *
	 * ⇒ SO CONTAINMENT IS ASSERTED, NOT JUST PRESENCE. Every tick and label must
	 * be a DESCENDANT OF THE `<svg>`, which is what makes this guard actually
	 * about the chart rather than about the page.
	 */
	it("collapsed-renders-the-time-axis", () => {
		const { container } = render(
			<MarketPriceChartCard series={SERIES} onExpand={vi.fn()} isOpen={true} />,
		);

		// Non-vacuity: the chart rendered (its svg + both lines are present).
		const svg = screen.getByTestId("market-price-chart");
		expect(svg).toBeTruthy();
		expect(screen.getByTestId("line-yes")).toBeTruthy();
		expect(screen.getByTestId("line-no")).toBeTruthy();

		// ⛔ THE COMPOSITION IS THE ANCHOR SET SINCE CHART-7 (RF-4), NOT A COUNT.
		// It was "two interior ticks and three date labels", where the labels came
		// from thirds of the window and the end. The card now labels the FIRST and
		// LAST calendar anchors — `Sep 15` and `Nov 5` — and draws a tick only where
		// an anchor falls strictly INSIDE the plot.
		//
		// ⚠ SO THE TICK COUNT IS ENVIRONMENT-DEPENDENT, AND DERIVING IT IS THE POINT.
		// Under the production window the card's two anchors ARE the plot's edges, so
		// there is no interior anchor and no tick; under staging, whose window opens
		// on 17 August, `Sep 15` sits a fifth of the way in and gets one. Writing
		// either count as a literal would pin one environment and red in the other —
		// the coupling `atWindowFraction` below was introduced to remove. The suite
		// runs `ZUGZWANG_ENV=prod` (tests/_setup/env.ts), so it exercises the
		// no-interior-tick arm; the contact sheet renders the staging one.
		const drawn = MARKET_CHART_AXIS_ANCHORS.map((iso, i) => ({
			iso,
			i,
		})).filter(({ iso }) => {
			const t = Date.parse(iso);
			return (
				t >= Date.parse(MARKET_CHART_WINDOW_START) &&
				t <= Date.parse(MARKET_CHART_WINDOW_END)
			);
		});
		expect(
			drawn.length,
			"no anchor is inside the window — fixture is broken",
		).toBeGreaterThanOrEqual(2);
		const cardAnchors = [drawn[0], drawn[drawn.length - 1]];
		const labels = cardAnchors.map(({ i }) => `axis-x-anchor-${i}`);
		const ticks = cardAnchors
			.filter(({ iso }) => {
				const x = xPx(
					iso,
					Date.parse(MARKET_CHART_WINDOW_START),
					Date.parse(MARKET_CHART_WINDOW_END),
				);
				return x > 0 && x < VIEWBOX_W;
			})
			.map(({ i }) => `axis-x-tick-${i}`);

		// ⛔ THE TICKS ARE STILL INSIDE THE `<svg>`, AND THAT HALF IS UNCHANGED. A
		// tick is a rule at an x in the plot's own domain, so it belongs in the space
		// that owns that domain — and d5's own structure, a `.xtick` div beside the
		// chart, would satisfy a presence check while failing this one.
		for (const id of ticks) {
			const el = container.querySelector(`[data-testid="${id}"]`);
			expect(el, `collapsed axis is missing ${id}`).not.toBeNull();
			expect(
				svg.contains(el),
				`${id} must be INSIDE the <svg>, not a DOM sibling of the chart`,
			).toBe(true);
		}

		// ⛔ THE LABELS LEFT THE `<svg>` AT CHART-7 AND THE CONTAINMENT ASSERTION
		// MOVED WITH THEM RATHER THAN BEING DROPPED. They are HTML now, because a
		// declared type size inside a viewBox stretched non-uniformly per surface
		// rendered a 7.70px box on this card and a 16.00px box on the overlay — the
		// same argument that sent `YES`/`NO` out at CHART-2, applied to the last text
		// that had not taken it.
		//
		// ⚠ WHAT THE ORIGINAL ASSERTION WAS PROTECTING IS NOT THE `<svg>` — IT IS
		// SCOPE. Its docblock says so: porting d5's absolutely-positioned divs
		// literally would have slipped past `collapsed-renders-no-axis`, because that
		// guard asserts the absence of testids INSIDE this component and a DOM
		// SIBLING of the chart carries none of them. So the property that has to
		// survive is that the labels are returned from the component's own tree —
		// `PROFILE OVERLAP R2`'s answer, which this component already uses for the
		// end labels. Asserted against the chart FRAME, which is the component's
		// root, rather than against the `<svg>`, which is now only part of it.
		const frame = screen.getByTestId("market-price-chart-frame");
		for (const id of labels) {
			const el = container.querySelector(`[data-testid="${id}"]`);
			expect(el, `collapsed axis is missing ${id}`).not.toBeNull();
			expect(
				frame.contains(el),
				`${id} must be inside the chart component's own tree, not a DOM sibling of it`,
			).toBe(true);
			expect(
				svg.contains(el),
				`${id} is HTML since CHART-7 and must NOT be inside the <svg>`,
			).toBe(false);
		}

		// EXACTLY the drawn set — an extra tick or a third label is a different
		// composition from the one RF-4 ruled, and "at least one" would not see it.
		expect(byPrefix(container, "axis-x-tick-")).toHaveLength(ticks.length);
		expect(byPrefix(container, "axis-x-anchor-")).toHaveLength(2);
		// ⛔ AND THE SUPERSEDED NAMES ARE GONE, NOT MERELY UNUSED. `axis-x-label-*`
		// and `axis-x-start`/`-end` asserted a POSITION IN THE PLOT, which a calendar
		// axis makes environment-dependent: `Sep 15` is the left edge on production
		// and a fifth of the way in on staging. A stale id left rendering beside the
		// new one is two axes disagreeing about which is the axis.
		expect(byPrefix(container, "axis-x-label-")).toHaveLength(0);
		expect(container.querySelector('[data-testid="axis-x-start"]')).toBeNull();
	});

	// ── CHART-3 · the axis is the fixed experiment window ──────────────────────
	//
	// SPEC.1 §17 rows proved below:
	//   debate-view::price-chart-axis-spans-fixed-window
	//   debate-view::price-chart-series-never-drawn-beyond-now
	//
	// ⛔ THIS BLOCK REPLACES `collapsed-axis-labels-are-REAL-series-timestamps`,
	// which asserted the behaviour SPEC.1 1.0.48 §9 reverses. That guard pinned
	// 1.0.32's constraint — the axis "introduces no new data … every timestamp it
	// renders is already carried on `PricePoint.at`" — and it was right while the
	// domain was the market's own lifetime, because then an interpolated label
	// WAS a claim about the market's history. Against a constant window it is a
	// calendar date, and anchoring to series points would give two markets on one
	// window two different axes, defeating the ruling. The guard is REPLACED
	// rather than deleted, and its §17 row with it, so the reversal is recorded
	// where a reader looking for the old rule will find it.

	/** The UTC calendar day an instant prints as, in the shipped `fmtUtcDay`
	 * form ("Sep 15"). One helper, so every derivation below reads the same
	 * clock and none of them can drift from another. */
	function utcDay(at: string | number): string {
		return new Date(at).toLocaleDateString("en-US", {
			month: "short",
			day: "numeric",
			timeZone: "UTC",
		});
	}

	/** The three days the fixed axis must print, derived from the constants the
	 * component reads — so this file cannot drift from them — while the constant
	 * VALUES are pinned separately, with literals, in
	 * `tests/unit/config/chart-window.test.ts`. Deriving here and pinning there
	 * is the split that keeps this test about the RULE and that one about the
	 * NUMBERS; deriving in both would pin nothing. */
	function expectedAxisDays(): {
		first: string;
		second: string;
		end: string;
	} {
		const startMs = Date.parse(MARKET_CHART_WINDOW_START);
		const endMs = Date.parse(MARKET_CHART_WINDOW_END);
		return {
			first: utcDay(startMs + (endMs - startMs) / 3),
			second: utcDay(startMs + ((endMs - startMs) * 2) / 3),
			end: utcDay(endMs),
		};
	}

	/**
	 * An instant at fraction `f` of the RESOLVED window.
	 *
	 * ⛔ WHY THE FIXTURES BELOW ARE DERIVED RATHER THAN WRITTEN AS DATES. Until
	 * CHART-3 the domain came from the series, so a fixture's absolute dates were
	 * irrelevant and every chart guard was environment-independent. The fixed
	 * window ends that: a fixture written in September sits inside the production
	 * window and OUTSIDE the staging one, and the two windows do not overlap at
	 * all (staging ends Sep 10, production opens Sep 15).
	 *
	 * ⚠ Measured: with hard-coded September dates, `ZUGZWANG_ENV=preview` reddened
	 * FOUR of these guards — and AGENTS.md §2 tells a developer to run exactly
	 * `ZUGZWANG_ENV=preview just verify`. The repo's own `??=` env-leak, reaching
	 * the chart guards for the first time. They fail loudly rather than silently,
	 * which is the right direction, but the repair a hurried reader reaches for is
	 * to loosen the assertion — and these are the guards that pin the whole
	 * change. Deriving from the window removes the coupling instead of documenting
	 * it. Found by `@security-auditor` at the CHART-3 cascade.
	 */
	function atWindowFraction(f: number): string {
		const startMs = Date.parse(MARKET_CHART_WINDOW_START);
		const endMs = Date.parse(MARKET_CHART_WINDOW_END);
		return new Date(startMs + (endMs - startMs) * f).toISOString();
	}

	/** A three-point series occupying `[from, to]` of the resolved window. */
	function seriesAcross(from: number, to: number): PricePoint[] {
		return [
			{ at: atWindowFraction(from), yes: "0.500000000000000000" },
			{ at: atWindowFraction((from + to) / 2), yes: "0.640000000000000000" },
			{ at: atWindowFraction(to), yes: "0.800000000000000000" },
		];
	}

	it("collapsed-axis-uses-CALENDAR-ANCHORS-not-window-endpoints", () => {
		// `debate-view::price-chart-axis-uses-calendar-anchors` — RF-4, founder
		// ruling D20(b)/D21(b).
		//
		// ⛔ THIS REPLACES `collapsed-axis-labels-are-the-FIXED-WINDOW-not-the-series`,
		// which asserted the behaviour RF-4 reverses. That guard was right for
		// CHART-3: it rejected labels derived from the SERIES, and the window was the
		// only other source there was. RF-4 adds a third — the calendar — and the
		// window becomes the wrong answer for the same reason the series was. Two
		// environments configure different windows, so a window-derived axis makes
		// the same market read as two different pictures; the anchors are experiment
		// dates and do not move.
		const { container } = render(
			<MarketPriceChartCard series={SERIES} onExpand={vi.fn()} isOpen={true} />,
		);
		const rendered = byPrefix(container, "axis-x-anchor-").map(
			(el) => el.textContent ?? "",
		);

		expect(rendered).toHaveLength(2);
		expect(rendered).toEqual([
			utcDay(MARKET_CHART_AXIS_ANCHORS[0]),
			utcDay(MARKET_CHART_AXIS_ANCHORS[2]),
		]);

		// ⛔ THE THREE REJECTIONS, EACH STATED POSITIVELY SO NONE CAN PASS VACUOUSLY.
		//
		// (a) NOT the series. The fixture's own days are Sep 17 and Sep 20.
		expect(rendered).not.toContain("Sep 17");
		expect(rendered).not.toContain("Sep 20");
		// (b) NOT the window's thirds — the rule this replaces. Derived from the
		//     real constants so it reddens whichever window is configured.
		const want = expectedAxisDays();
		expect(rendered).not.toContain(want.first);
		expect(rendered).not.toContain(want.second);
		// (c) NOT the interior anchor. The card takes the first and last only; a
		//     card that drew all three is the plausible over-application.
		expect(rendered).not.toContain(utcDay(MARKET_CHART_AXIS_ANCHORS[1]));
	});

	it("collapsed-axis-is-IDENTICAL-across-two-different-markets", () => {
		// ⭐ THE PROPERTY THE FIXED WINDOW EXISTS TO BUY, and the one no
		// single-render assertion can see: canon `C-CHART-1` clause 1 (amended
		// CHART-3) rules that tick placement is computed "against a constant span
		// rather than a per-market one, which makes every market's axis identical
		// and two charts directly comparable." Two series that share no timestamp
		// must produce byte-identical axis labels AND byte-identical tick x's.
		// Both derived from the window, and they share no instant: one occupies
		// its opening tenth, the other its middle. Env-robust by construction.
		const EARLY = seriesAcross(0.02, 0.1);
		const OTHER = seriesAcross(0.4, 0.62);
		const read = (series: PricePoint[]) => {
			const { container } = render(
				<MarketPriceChartCard
					series={series}
					onExpand={vi.fn()}
					isOpen={true}
				/>,
			);
			const pts = parsePoints(
				container
					.querySelector('[data-testid="line-yes"]')
					?.getAttribute("points") ?? "",
			);
			const out = {
				labels: byPrefix(container, "axis-x-anchor-").map(
					(el) => el.textContent ?? "",
				),
				tickXs: byPrefix(container, "axis-x-tick-").map((el) =>
					el.getAttribute("x1"),
				),
				// ⛔ THE LINE'S OWN EXTENT, READ OFF THE RENDER. See the block below
				// for why the fixture comparison this replaced could not do the job.
				lineXs: pts.map(([x]) => x),
			};
			cleanup();
			return out;
		};

		const a = read(EARLY);
		const b = read(OTHER);

		// Non-vacuity: the axis rendered at all, on both.
		// ⚠ THE COUNTS FOLLOW RF-4 — two labels, and a tick only where an anchor is
		// strictly interior (none under the production window this suite runs). The
		// tick assertion is therefore a SHAPE assertion rather than a count: whatever
		// the environment draws, the two markets must draw the same thing.
		expect(a.labels).toHaveLength(2);
		expect(a.tickXs.every((x) => x !== null)).toBe(true);

		expect(b.labels).toEqual(a.labels);
		expect(b.tickXs).toEqual(a.tickXs);

		// ⛔⛔ AND THE OTHER HALF OF THE RULING, WHICH USED TO BE A COMMENT.
		// "The axis is fixed; the line is not" is ONE sentence with TWO clauses,
		// and only the first was measured here. The line that stood in this place
		// read `expect(SERIES[0].at).not.toBe(OTHER[0].at)` under a comment
		// claiming it was "the control that proves the two renders really were
		// different: the LINES must differ" — but it compares two FIXTURE
		// CONSTANTS and never touches the render. It is green whatever the
		// component does, including a component that ignores `series` outright,
		// and it would have been green against the exact over-application this
		// task's ruling forbids: fixing the LINE to the window as well as the
		// axis, which draws every market's line across the full width and makes
		// the two charts genuinely identical — the failure the surrounding test
		// is named for, passing under a control written to exclude it.
		//
		// ⇒ MEASURED, AND STATED AS A DIFFERENCE. A market occupying the window's
		// opening tenth and one occupying its middle must end their lines at
		// DIFFERENT x, on the identical axis proved above.
		expect(a.lineXs.length).toBeGreaterThan(1);
		expect(b.lineXs.length).toBeGreaterThan(1);
		const lastOf = (xs: number[]) => xs[xs.length - 1];
		expect(lastOf(a.lineXs)).not.toBe(lastOf(b.lineXs));
		// Neither reaches the axis end — that is the tail-stretch §9 forbids, and
		// asserting it here means "they differ" cannot be satisfied by one of them
		// being stretched while the other is not.
		expect(lastOf(a.lineXs)).toBeLessThan(VIEWBOX_W);
		expect(lastOf(b.lineXs)).toBeLessThan(VIEWBOX_W);
		// Quantitatively, each stops where its OWN last instant falls on the
		// SHARED window — derived from the constants, so this survives an env
		// change rather than encoding one environment's numbers.
		const startMs = Date.parse(MARKET_CHART_WINDOW_START);
		const endMs = Date.parse(MARKET_CHART_WINDOW_END);
		const xOf = (at: string) =>
			((Date.parse(at) - startMs) / (endMs - startMs)) * VIEWBOX_W;
		expect(lastOf(a.lineXs)).toBeCloseTo(xOf(EARLY[EARLY.length - 1].at), 1);
		expect(lastOf(b.lineXs)).toBeCloseTo(xOf(OTHER[OTHER.length - 1].at), 1);
	});

	it("price-chart-series-never-drawn-beyond-now", () => {
		// ⛔ THE MOST IMPORTANT CORRECTNESS GUARD IN THE AXIS CHANGE. The axis is
		// fixed; the line is not. A series covering the window's opening tenth
		// must stop a tenth of the way along and must NOT be stretched to the axis
		// end, because a flat tail to `MARKET_CHART_WINDOW_END` asserts a price at
		// an instant that has not happened.
		const EARLY = seriesAcross(0.0, 0.1);
		const { container } = render(
			<MarketPriceChart series={EARLY} mode="expanded" isOpen={true} />,
		);
		const xs = (
			container
				.querySelector('[data-testid="line-yes"]')
				?.getAttribute("points") ?? ""
		)
			.split(" ")
			.filter((p) => p.length > 0)
			.map((p) => Number(p.split(",")[0]));

		// Non-vacuity: three points were read, and they advance.
		expect(xs).toHaveLength(3);
		expect(xs[0]).toBeLessThan(xs[1]);
		expect(xs[1]).toBeLessThan(xs[2]);

		// The assertion: the last drawn x is strictly inside the axis. Under the
		// superseded lifetime domain it was exactly `VIEWBOX_W`, so this reddens
		// against the old behaviour rather than passing either way.
		expect(xs[2]).toBeLessThan(VIEWBOX_W);

		// And quantitatively: the terminal x is the last instant's own fraction of
		// the window, derived from the constants rather than from one
		// environment's dates.
		expect(xs[2]).toBeCloseTo(0.1 * VIEWBOX_W, 1);
	});

	it("expanded-axis-ENDPOINT-LABELS-name-the-WINDOW-not-the-series", () => {
		// ⛔ THE HALF OF THE AXIS CHANGE THAT SHIPPED WITH NO GUARD AT ALL. The
		// component states the rule in terms — "⛔ THESE NAME THE AXIS, NOT THE
		// SERIES, AND THAT CHANGED AT CHART-3" — and reverting those two
		// expressions to `fmtUtcDay(series[0].at)` / `fmtUtcDay(series[last].at)`
		// leaves EVERY test in this repository green. `axis-x-start` and
		// `axis-x-end` are named in exactly one assertion on disk
		// (`expanded-axis-is-UNTOUCHED-by-the-collapsed-amendment`), which reads
		// their PRESENCE and never their TEXT.
		//
		// ⛔ AND THE FAILURE IT LETS THROUGH IS THE ONE §9 CARES ABOUT MOST. Under
		// a fixed axis a market that opened three days ago plots its first point a
		// twentieth of the way along; a label reading that market's own first date
		// pinned to `x = 0` places its first bet at the window's start — a false
		// statement about when the market began trading, printed in the one place
		// a reader goes to find out. It is not a cosmetic drift: label and
		// position would disagree by weeks.
		// ⛔ A LOCAL FIXTURE, AND THE REASON IS A COLLISION THIS RUN ACTUALLY HIT.
		// The shared `INTERIOR` fixture opens on `2026-10-01T00:00:00.000Z` — which
		// IS `MARKET_CHART_AXIS_ANCHORS[1]`. Against it, "the axis must not print a
		// day the SERIES carries" and "the axis must print `Oct 1`" are contradictory,
		// so the rejection below could not be written at all: an anchor rule and a
		// series rule produce the same label and the guard distinguishes nothing.
		// ⚠ CAUGHT BY THIS CASE'S OWN FIXTURE-INTEGRITY CONTROL, which CHART-3 added
		// for exactly this — *"if a future edit moved either constant onto a fixture
		// instant, this reddens rather than silently hollowing out the guard"*. It was
		// written about the window constants; the anchors walked into it instead.
		const OFF_ANCHOR: PricePoint[] = [
			{ at: "2026-10-07T00:00:00.000Z", yes: "0.200000000000000000" },
			{ at: "2026-10-12T00:00:00.000Z", yes: "0.300000000000000000" },
			{ at: "2026-10-19T00:00:00.000Z", yes: "0.250000000000000000" },
		];
		const { container } = render(
			<MarketPriceChart series={OFF_ANCHOR} mode="expanded" isOpen={true} />,
		);

		// ⛔ AND CHART-7 REPLACES THE SOURCE AGAIN (RF-4). The rule this case was
		// written for — "these name the axis, not the series" — is intact and
		// sharpened: they name the CALENDAR, not the axis's own ends. The overlay
		// carries all THREE anchors, `Oct 1` included.
		const rendered = byPrefix(container, "axis-x-anchor-").map(
			(el) => el.textContent ?? "",
		);
		// Non-vacuity: the labels rendered, so the text assertions are about content
		// rather than about `undefined`.
		expect(rendered, "expanded anchors missing").toHaveLength(3);
		expect(rendered).toEqual(MARKET_CHART_AXIS_ANCHORS.map(utcDay));

		// MUST REJECT: the window's own ends, which is what this labelled until now
		// and what a partial revert would restore. On production the two coincide
		// with anchors 0 and 2 — so the assertion that can actually see the
		// difference is the INTERIOR one, which no window endpoint can produce.
		expect(rendered).toContain(utcDay(MARKET_CHART_AXIS_ANCHORS[1]));
		expect(
			container.querySelector('[data-testid="axis-x-start"]'),
			"the window-endpoint testids are retired, not merely unused",
		).toBeNull();

		// ⛔ THE FIXTURE-INTEGRITY CONTROL, CARRIED AND WIDENED. Without it the
		// rejection below can be satisfied by the WRONG rule: `SERIES` opens exactly
		// on `MARKET_CHART_WINDOW_START`, so against that fixture "Sep 15" is both
		// answers at once. It used to check the two WINDOW constants; it now checks
		// all three ANCHORS, because those are what the axis prints. If a future edit
		// moves an anchor onto a fixture instant, this reddens here rather than
		// silently hollowing out the guard above — which is precisely what it just
		// did for `INTERIOR`.
		const seriesDays = OFF_ANCHOR.map((p) => utcDay(p.at));
		for (const anchor of MARKET_CHART_AXIS_ANCHORS) {
			expect(
				seriesDays,
				`the fixture carries ${utcDay(anchor)}, which is an anchor — this guard cannot tell the two rules apart`,
			).not.toContain(utcDay(anchor));
		}

		// THE REJECTION: no label may print a day the SERIES carries.
		for (const day of rendered) {
			expect(seriesDays).not.toContain(day);
		}
	});

	it("a-point-BEYOND-the-window-end-is-CLIPPED-not-CLAMPED", () => {
		// ⛔ A RULED DECISION WITH NOTHING BEHIND IT. CHART-3 chose "do not clamp
		// `xPx`; let the SVG viewBox clip" over "clamp x into [0, VIEWBOX_W]",
		// because clamping draws the live price AT THE WRONG INSTANT — the
		// failure this codebase rejects twice in writing (`price-series.ts`
		// `withLiveTail`, `price-chart.ts` `deriveMarketPriceChart`: "a price at
		// the wrong time is a false statement about the market, not a stale one").
		//
		// ⛔ AND IT IS REACHABLE, NOT THEORETICAL. Staging's window ends
		// 2026-09-10 while `withLiveTail` keeps appending a point at `now`, so
		// every staging chart runs past its axis after that date and the obvious
		// "fix" for the line that appears to stop dead at the right edge is
		// exactly the clamp. `tests/unit/debate/chart/geometry.test.ts` exercises
		// `xPx` only INSIDE its domain — start, quarter, mid, end — so a
		// `Math.min(VIEWBOX_W, …)` added to it passes every test in the repo.
		const startMs = Date.parse(MARKET_CHART_WINDOW_START);
		const endMs = Date.parse(MARKET_CHART_WINDOW_END);
		const inside = new Date(startMs + (endMs - startMs) / 10).toISOString();
		const beyond = new Date(endMs + 5 * 86_400_000).toISOString();

		const { container } = render(
			<MarketPriceChart
				series={[
					{ at: inside, yes: "0.500000000000000000" },
					{ at: beyond, yes: "0.600000000000000000" },
				]}
				mode="expanded"
				isOpen={true}
			/>,
		);
		const xs = parsePoints(
			container
				.querySelector('[data-testid="line-yes"]')
				?.getAttribute("points") ?? "",
		).map(([x]) => x);

		// POSITIVE CONTROL — the in-window point maps STRICTLY INSIDE the plot, so
		// the assertion below means "this instant is off the canvas", not "the
		// mapping is broken for everything".
		expect(xs).toHaveLength(2);
		expect(xs[0]).toBeGreaterThan(0);
		expect(xs[0]).toBeLessThan(VIEWBOX_W);
		expect(xs[0]).toBeCloseTo(VIEWBOX_W / 10, 1);

		// THE ASSERTION: past the window end, x keeps going. A clamp makes this
		// exactly `VIEWBOX_W`.
		expect(xs[1]).toBeGreaterThan(VIEWBOX_W);
		expect(xs[1]).toBeCloseTo(
			((Date.parse(beyond) - startMs) / (endMs - startMs)) * VIEWBOX_W,
			1,
		);

		// ⛔ AND THE TERMINAL MARK FOLLOWS THE LINE OFF-CANVAS, which is the other
		// place a clamp would be reached for. A dot pinned back to the right edge
		// while its line is clipped beyond it is the CHART-3 dangling-dot defect
		// in reverse: the mark would sit at an instant the line never reaches.
		for (const id of ["terminal-dot-yes", "terminal-dot-no"]) {
			const el = container.querySelector(`[data-testid="${id}"]`);
			expect(el, `${id} missing`).not.toBeNull();
			expect(Number(el?.getAttribute("cx")), `${id} cx`).toBe(xs[1]);
		}
	});

	it("a-point-BEFORE-the-window-start-is-CLIPPED-not-CLAMPED", () => {
		// ⭐ THE MIRROR OF THE RIGHT-EDGE GUARD, AND THE ONE THAT WAS MISSING.
		// Every artefact in this change — the component comment, the `xPx`
		// docblock, the constants, the §17 row, the beyond-the-end guard — reasoned
		// about instants PAST the window end. Nothing reasoned about instants
		// BEFORE its start, and that is the edge that is STRUCTURAL rather than
		// hypothetical: `MARKET_CHART_WINDOW_START` is the experiment's OPENING
		// instant, and a market must reach `Open` BEFORE that for anyone to bet at
		// launch. So `market.opened` — the genesis point §9 calls "the opening
		// price" — maps to a NEGATIVE x on every production market.
		//
		// ⛔ THE CONSEQUENCE OF LEAVING IT UNGUARDED IS EXACT: adding
		// `Math.max(0, …)` to `xPx` passed the entire suite. A one-sided guard
		// against a two-sided rule is not a guard against the rule. The clamp is
		// wrong in this direction for the same reason it is wrong in the other —
		// it would draw the market's opening price at the window's start, an
		// instant at which that market did not yet exist.
		// Found by `@security-auditor` at the CHART-3 cascade.
		const PRE_LAUNCH: PricePoint[] = [
			{ at: atWindowFraction(-0.004), yes: "0.500000000000000000" },
			{ at: atWindowFraction(-0.001), yes: "0.520000000000000000" },
			{ at: atWindowFraction(0.08), yes: "0.700000000000000000" },
		];
		const { container } = render(
			<MarketPriceChart series={PRE_LAUNCH} mode="expanded" isOpen={true} />,
		);
		const xs = (
			container
				.querySelector('[data-testid="line-yes"]')
				?.getAttribute("points") ?? ""
		)
			.split(" ")
			.filter((p) => p.length > 0)
			.map((p) => Number(p.split(",")[0]));

		// Non-vacuity: three points were read and they advance left to right.
		expect(xs).toHaveLength(3);
		expect(xs[0]).toBeLessThan(xs[1]);
		expect(xs[1]).toBeLessThan(xs[2]);

		// THE ASSERTION. Both pre-window points are drawn at negative x — clipped
		// by the viewBox, never folded onto the left edge. `Math.max(0, …)` in
		// `xPx` reddens here and nowhere else in the suite.
		expect(xs[0]).toBeLessThan(0);
		expect(xs[1]).toBeLessThan(0);
		// …and the in-window point is still placed normally, so the guard is about
		// the clamp rather than about the whole mapping being broken.
		expect(xs[2]).toBeGreaterThan(0);
		expect(xs[2]).toBeLessThan(VIEWBOX_W);
	});

	it("terminal-dots-sit-at-the-LINE-end-not-the-AXIS-end", () => {
		// ⛔ THE DEFECT THIS RUN INTRODUCED AND THEN FOUND, PINNED SO IT CANNOT
		// COME BACK. `TerminalMarkers` hard-coded `cx = VIEWBOX_W`. That was
		// CORRECT while the domain ended at the last point — the line's end WAS
		// the right edge, so the two numbers were the same and the constant could
		// not be wrong. The fixed axis separates them, and nothing in the suite
		// noticed: every existing chart guard passed with two dots and a live
		// pulse hanging in empty space at the far right of every market, attached
		// to no line. A hard-coded coordinate that used to be right by coincidence
		// is invisible exactly until the coincidence ends.
		const { container } = render(
			<MarketPriceChart
				series={seriesAcross(0.05, 0.3)}
				mode="collapsed"
				isOpen={true}
			/>,
		);

		const lastLineX = (() => {
			const pts = (
				container
					.querySelector('[data-testid="line-yes"]')
					?.getAttribute("points") ?? ""
			)
				.split(" ")
				.filter((p) => p.length > 0);
			return Number(pts[pts.length - 1].split(",")[0]);
		})();

		// Non-vacuity: the line really stops short of the axis, so "dot at the
		// line end" and "dot at the axis end" are DIFFERENT answers here. Without
		// this the assertion below could pass against the old constant.
		expect(lastLineX).toBeGreaterThan(0);
		expect(lastLineX).toBeLessThan(VIEWBOX_W);

		for (const id of [
			"terminal-dot-yes",
			"terminal-dot-no",
			"terminal-pulse-yes",
			"terminal-pulse-no",
		]) {
			const el = container.querySelector(`[data-testid="${id}"]`);
			expect(el, `${id} missing`).not.toBeNull();
			expect(Number(el?.getAttribute("cx")), `${id} cx`).toBe(lastLineX);
		}
	});

	it("a-SPARSE-series-never-reaches-the-window-end", () => {
		// ⛔ THE D9 GUARD (CHART-4). The ruling arrived the way the CHART-3 version
		// of this test said it might: it pinned the full-width flat line, recorded
		// that `@code-reviewer` had established the behaviour was owed a founder
		// ruling, and closed with "**If that ruling comes back the other way, this
		// test is expected to change with it.**" It came back the other way, and
		// this is that change.
		//
		// THE DEFECT: the ONLY reachable route to a single-point series is a
		// NON-`Open` market with zero bets (an `Open` one always gains
		// `withLiveTail`'s point at `now`). `buildLine` drew that as a line from
		// x = 0 to x = VIEWBOX_W — so a market that closed on Oct 1 painted a price
		// all the way out to Nov 5, five weeks past the instant it froze. That is a
		// false statement on a frozen surface, it runs at **INV-4**, and it is the
		// thing `price-chart-series-never-drawn-beyond-now` forbids two tests up.
		//
		// ⚠ THE FIXTURE IS `SINGLE_INTERIOR`, NOT `SINGLE`, AND THAT IS THE WHOLE
		// DIFFERENCE BETWEEN A GUARD AND A DECORATION. `SINGLE`'s point sits on
		// `MARKET_CHART_WINDOW_START`, so its `xPx` is 0 and "stops at its own
		// instant" and "stops at the axis end" would be 0 vs 640 — but the FIRST
		// endpoint is also 0, so a reverted fix still puts a 0 in the string and a
		// carelessly-written assertion passes. See `SINGLE_INTERIOR`'s docblock.
		const { container } = render(
			<MarketPriceChart
				series={SINGLE_INTERIOR}
				mode="collapsed"
				isOpen={true}
			/>,
		);
		const pts = parsePoints(
			container
				.querySelector('[data-testid="line-yes"]')
				?.getAttribute("points") ?? "",
		);
		const expectedEnd = xPx(
			SINGLE_INTERIOR[0].at,
			Date.parse(MARKET_CHART_WINDOW_START),
			Date.parse(MARKET_CHART_WINDOW_END),
		);

		// NON-VACUITY, and it is what makes the assertion below able to fail: the
		// point's own x must be a genuinely different number from both the left
		// edge and the axis end. If this ever stops holding, the fixture has
		// drifted onto a window endpoint and the guard has quietly stopped testing.
		expect(pts.length).toBe(2);
		expect(expectedEnd).toBeGreaterThan(0);
		expect(expectedEnd).toBeLessThan(VIEWBOX_W);

		// THE ASSERTION — the line stops at the market's own last event.
		expect(pts[1][0]).toBe(expectedEnd);
		expect(pts[1][0]).not.toBe(VIEWBOX_W);

		// And the terminal dot follows it. `buildLine` and `terminalX` answer one
		// question, so a fix to only one of them leaves the dot hanging in empty
		// space — the identical defect `terminal-dots-sit-at-the-LINE-end` exists
		// to catch, mirrored onto the shape nobody looks at.
		expect(
			Number(
				container
					.querySelector('[data-testid="terminal-dot-yes"]')
					?.getAttribute("cx"),
			),
		).toBe(expectedEnd);
	});

	it("collapsed-renders-NO-axis-on-a-degenerate-domain", () => {
		// The unbet market: one seed point, so `buildLine` draws a flat line by
		// duplicating one value at both edges and every point shares x = 0. Ticks
		// would stack on the left edge and all three labels would print the same
		// day three times. §9's amendment says so in terms.
		const { container } = render(
			<MarketPriceChartCard series={SINGLE} onExpand={vi.fn()} isOpen={true} />,
		);
		// Non-vacuity: the chart itself still rendered, lines and all.
		expect(screen.getByTestId("market-price-chart")).toBeTruthy();
		expect(screen.getByTestId("line-yes")).toBeTruthy();
		expect(byPrefix(container, "axis-x-tick-")).toHaveLength(0);
		expect(byPrefix(container, "axis-x-label-")).toHaveLength(0);
	});

	it("collapsed-renders-no-nodes", () => {
		// ⛔ THE SURVIVING HALF OF THE OLD ROW, SPLIT OUT AND KEPT. 1.0.32 reversed
		// the axis pin and left the NODES pin untouched, and the two were welded
		// into one assertion — where reversing either would have silently carried
		// the other out with it. §17 now carries them as two rows for the same
		// reason.
		const { container } = render(
			<MarketPriceChartCard series={SERIES} onExpand={vi.fn()} isOpen={true} />,
		);
		expect(byPrefix(container, "graph-node-")).toHaveLength(0);

		// Positive control — nodes CAN render (expanded mode), so their absence
		// above is meaningful, not vacuous.
		cleanup();
		render(
			<MarketPriceChart
				series={SERIES}
				nodes={NODES}
				mode="expanded"
				isOpen={true}
			/>,
		);
		expect(byPrefix(document.body, "graph-node-").length).toBeGreaterThan(0);
	});

	it("expanded-axis-carries-LABELS-BUT-NO-TICKS", () => {
		// 1.0.32's "UNCHANGED" clause, re-seated on what CHART-7 leaves of it. The
		// overlay's LABELS changed source twice — series → window (CHART-3) →
		// calendar anchors (CHART-7) — but the half this case exists for did not: it
		// gains none of the collapsed card's dashed rules. Interior ticks on the
		// overlay are canon-owned and unbuilt (`C-CHART-1` clause 1), and a shared
		// helper leaking one across would be invisible without this row.
		//
		// ⚠ THAT LEAK IS NEWLY REACHABLE, WHICH IS WHY THE CASE MATTERS MORE THAN IT
		// DID. Before CHART-7 the two modes' axes were separate code; they now share
		// `drawnAnchors` and `drawsTimeAxis`, so one edit reaches both.
		const { container } = render(
			<MarketPriceChart series={SERIES} mode="expanded" isOpen={true} />,
		);
		expect(byPrefix(container, "axis-x-anchor-")).toHaveLength(3);
		expect(byPrefix(container, "axis-x-tick-")).toHaveLength(0);
		expect(byPrefix(container, "axis-x-label-")).toHaveLength(0);
	});

	// ── 1b. INV-3 side binding — the YES line strokes `--graph-yes`, the NO line
	//        `--graph-no`, bound by TOKEN NAME (never the slot value; the repo
	//        aliases YES→ink / NO→n0, so a value-copy OR a yFn/stroke swap would
	//        invert the poles yet pass typecheck, Biome, the token guards, and
	//        every other test). Guards the headline invariant against a silent
	//        pole-swap (@code-reviewer MEDIUM, slice 1). ─────────────────────────
	it("line-tokens-bind-by-side-inv3", () => {
		render(<MarketPriceChart series={SERIES} mode="collapsed" isOpen={true} />);
		expect(screen.getByTestId("line-yes").getAttribute("stroke")).toBe(
			"var(--graph-yes)",
		);
		expect(screen.getByTestId("line-no").getAttribute("stroke")).toBe(
			"var(--graph-no)",
		);

		// GEOMETRY half of INV-3 (added slice 2, STEP 2). The stroke assertions
		// above bind COLOUR to side, but a yYesPx/yNoPx swap in the two <polyline>
		// calls (MarketPriceChart.tsx) would keep the strokes correct while
		// inverting the LINES themselves — passing every existing assertion and the
		// token guards. Pin it SEMANTICALLY: with YES winning (yes > 0.5 at every
		// point), the YES line must sit HIGHER on screen — a SMALLER SVG y — than
		// the NO line at the SAME x. "When YES is winning, the YES line is higher."
		cleanup();
		render(
			<MarketPriceChart series={YES_WINNING} mode="collapsed" isOpen={true} />,
		);
		const yesPts = parsePoints(
			screen.getByTestId("line-yes").getAttribute("points") ?? "",
		);
		const noPts = parsePoints(
			screen.getByTestId("line-no").getAttribute("points") ?? "",
		);
		expect(yesPts).toHaveLength(noPts.length);
		expect(yesPts.length).toBeGreaterThan(0);
		for (let i = 0; i < yesPts.length; i++) {
			expect(yesPts[i][0]).toBeCloseTo(noPts[i][0], 3); // same x
			expect(yesPts[i][1]).toBeLessThan(noPts[i][1]); // YES higher (smaller y)
		}
	});

	// ── 2. Accessible text summary — sr-only, names opening/current/endpoints;
	//       the SVG itself stays aria-hidden (SPEC.1 §9 Accessibility) ───────────
	it("accessible-summary-present", () => {
		render(
			<MarketPriceChartCard
				series={SUMMARY_SERIES}
				onExpand={vi.fn()}
				isOpen={true}
			/>,
		);

		const summary = screen.getByTestId("market-price-chart-summary");
		// The summary is the ONE non-decorative element — screen-reader visible.
		expect(summary.getAttribute("aria-hidden")).not.toBe("true");
		expect(summary.className).toContain("sr-only");

		const text = summary.textContent ?? "";
		expect(text).toContain("50%"); // opening price (2026-09-15, yes 0.5)
		expect(text).toContain("80%"); // current price (2026-09-20, yes 0.8)
		expect(text).toContain("Sep 15"); // domain start endpoint
		expect(text).toContain("Sep 20"); // domain end endpoint

		// The chart svg is decorative — hidden from the a11y tree (only the
		// summary carries the readout, unlike the fully-aria-hidden §22 sparkline).
		expect(
			screen.getByTestId("market-price-chart").getAttribute("aria-hidden"),
		).toBe("true");
	});

	// ── 3. Single-point (unbet) → a flat line at the opening price ──────────────
	it("flat-line-when-single-point", () => {
		// ⚠ THIS TEST KEEPS ITS NAME AND LOSES ITS FULL-WIDTH ASSERTION (CHART-4
		// D9). What it exists to pin is that a one-point series still renders a
		// LINE and that the line is FLAT — "there is no empty state", SPEC.1 §9 —
		// and both of those survive the ruling untouched. The right EDGE is the
		// part D9 moved, and it is asserted by
		// `a-SPARSE-series-never-reaches-the-window-end` rather than here, on the
		// interior fixture that can actually discriminate it: `SINGLE` sits on the
		// window start, so this test could only ever have compared 0 with 0.
		render(
			<MarketPriceChartCard series={SINGLE} onExpand={vi.fn()} isOpen={true} />,
		);

		const pts = parsePoints(
			screen.getByTestId("line-yes").getAttribute("points") ?? "",
		);
		// Both endpoints present (the "duplicate at both ends" flat-line trick).
		expect(pts.length).toBeGreaterThanOrEqual(2);
		const first = pts[0];
		// Flat — every point sits at the SAME y (the opening price), no slope.
		for (const [, y] of pts) {
			expect(y).toBeCloseTo(first[1], 3);
		}
		// Bounded by the axis in both directions — the line is drawn, and it is
		// drawn on the canvas. It no longer spans the whole of it.
		for (const [x] of pts) {
			expect(x).toBeGreaterThanOrEqual(0);
			expect(x).toBeLessThanOrEqual(VIEWBOX_W);
		}
	});

	// ── 4. Error state — priceChart null → header intact, NO chart (web Gate-C).
	it("header-renders-without-chart-when-priceChart-null", () => {
		render(<MarketHeader market={MARKET} priceChart={null} />);

		// The header renders unaffected: title, PriceBar, and the totals strip.
		expect(
			screen.getByRole("heading", { name: "Chart Market Question" }),
		).toBeTruthy();
		expect(screen.getByRole("img", { name: /YES/ })).toBeTruthy(); // PriceBar
		expect(screen.getByText(/3 posts/)).toBeTruthy();
		expect(screen.getByText(/5 replies/)).toBeTruthy();

		// …but NO chart is mounted when the series read failed (priceChart null).
		expect(screen.queryByTestId("market-price-chart")).toBeNull();
		expect(screen.queryByTestId("market-price-chart-card")).toBeNull();

		// Positive control — a non-null priceChart DOES mount the collapsed card,
		// so the null-case absence above is meaningful.
		cleanup();
		render(
			<MarketHeader
				market={MARKET}
				priceChart={{ series: SERIES, nodes: [] }}
			/>,
		);
		expect(screen.getByTestId("market-price-chart-card")).toBeTruthy();
	});

	// ── 5. Slice 2 — EXPANDED renders one node mark per node; COLLAPSED renders
	//       NONE (nodes are expanded-only; SPEC.1 §9 "Post nodes (expanded mode
	//       only)"). The existing collapsed test at (1) already pins zero nodes in
	//       the card; this adds the positive control that they DO render expanded. ─
	it("expanded-renders-nodes", () => {
		render(
			<MarketPriceChart
				series={SERIES}
				nodes={NODES}
				mode="expanded"
				isOpen={true}
			/>,
		);

		// One graph-node-<id> element per node in EXPANDED mode.
		expect(byPrefix(document.body, "graph-node-")).toHaveLength(NODES.length);
		for (const node of NODES) {
			expect(screen.getByTestId(`graph-node-${node.id}`)).toBeTruthy();
		}

		// COLLAPSED renders ZERO nodes EVEN WITH nodes provided — expanded-only.
		cleanup();
		render(
			<MarketPriceChart
				series={SERIES}
				nodes={NODES}
				mode="collapsed"
				isOpen={true}
			/>,
		);
		expect(byPrefix(document.body, "graph-node-")).toHaveLength(0);

		// The collapsed CARD likewise shows no nodes (it renders the chart collapsed).
		cleanup();
		render(
			<MarketPriceChartCard series={SERIES} onExpand={vi.fn()} isOpen={true} />,
		);
		expect(byPrefix(document.body, "graph-node-")).toHaveLength(0);
	});

	// ── 6. Node side → token binding (INV-3, no pole inversion). A YES node fills
	//       `--graph-yes` + data-side "YES"; a NO node fills `--graph-no` +
	//       data-side "NO". Bound by the semantic token NAME, never inverted and
	//       never the `--color-*` slot (design decision #7). ─────────────────────
	it("node-tokens-bind-by-side-inv3", () => {
		render(
			<MarketPriceChart
				series={SERIES}
				nodes={NODES}
				mode="expanded"
				isOpen={true}
			/>,
		);

		const [yesNode, noNode] = NODES; // NODES[0] = YES, NODES[1] = NO.

		const yesEl = screen.getByTestId(`graph-node-${yesNode.id}`);
		expect(yesEl.getAttribute("data-side")).toBe("YES");
		expect(yesEl.getAttribute("fill")).toBe("var(--graph-yes)");

		const noEl = screen.getByTestId(`graph-node-${noNode.id}`);
		expect(noEl.getAttribute("data-side")).toBe("NO");
		expect(noEl.getAttribute("fill")).toBe("var(--graph-no)");
	});
});

/**
 * RESO-1 · R-6 — DISCHARGED BY CHART-1, NOT DROPPED. The guards that stood here
 * are removed, and this note is what replaces them.
 *
 * ⚠⚠ R-6 ASKED FOR "YES and NO tagged inline on the chart lines … text tags
 * adjacent to each line's terminal point … neutral ramp only … not styled as
 * YES/NO chips." RESO-1 built that as `LineTags` — two `<text>` nodes at
 * `x = VIEWBOX_W`, filled `var(--graph-yes)` / `var(--graph-no)`, with a
 * separation rule for the 50/50 case — and this block guarded it.
 *
 * ⇒ CHART-1 (#425) LANDED ON `main` WHILE RESO-1 WAS IN FLIGHT AND SHIPS THE
 * SAME ROW, BETTER. `TerminalMarkers` in `MarketPriceChart.tsx` draws a DOT at
 * each line's true terminal y plus that line's name beside it, on the same
 * `--graph-*` family, with the collision-displacement rule factored into
 * `terminalLabelYs` in `geometry.ts` — and it cites ratified canon
 * (`C-CHART-2` clauses 1, 2, 4) where RESO-1's version was one session's reading
 * of a register line. It is guarded by `tests/unit/debate/render/terminal-markers.test.tsx`.
 *
 * ⛔ KEEPING BOTH WOULD HAVE RENDERED "YES" TWICE ON THE SAME LINE END. The
 * merge conflict in `MarketPriceChart.tsx` was therefore resolved by taking
 * `main`'s file WHOLESALE — RESO-1 contributes nothing to that component now —
 * and these guards go with the code they guarded. Removing a guard whose subject
 * no longer exists is not weakening the suite; leaving it would have been a
 * tripwire naming testids nothing emits.
 *
 * ⚠ THE ONE THING RESO-1's VERSION HAD THAT IS WORTH NAMING, so it is not lost:
 * it asserted the tags carry the GRAPH family and NOT the INV-3 poles, in both
 * spellings (`var(--color-yes)` and the `fill-yes`/`text-yes` utilities). If
 * `terminal-markers.test.tsx` does not pin that negative, it is worth adding
 * there — the reason is `--color-yes` IS the page ground, so a pole-bound label
 * is invisible as well as semantically wrong.
 */

/**
 * RESO-1 · R-5 — THE CHART GROWS INTO THE VACATED SPACE, AND NO CHART CODE
 * CHANGED. Pinned rather than edited, per the brief: "if the ruled outcome
 * already holds, pin it with a guard and report that no change was needed."
 *
 * ⚠ WHY A SOURCE SCAN. jsdom performs no layout — it resolves no flex, no
 * percentage height, no Tailwind utility — so a render test structurally cannot
 * observe a component growing. What IS checkable here is the DECLARATION that
 * makes it grow, which is the thing a future edit would break.
 */
describe("RESO-1 — R-5, the chart fills whatever the rail leaves it", () => {
	it("the-collapsed-card-declares-flex-1-min-h-0-so-it-ABSORBS-the-freed-space", () => {
		const source = readFileSync(
			join(
				process.cwd(),
				"src/components/debate/chart/MarketPriceChartCard.tsx",
			),
			"utf8",
		);

		// ⛔⛔ THE NEGATIVES BELOW SCAN `className` VALUES, NEVER THE RAW FILE, AND
		// THAT IS A CORRECTION MADE IN PLACE. The first version of this test asserted
		// `expect(source).not.toContain("aspect-[2/1]")` and went RED — not because
		// the class was on an element, but because the component's own docblock
		// RECORDS that it used to be ("It was `aspect-[2/1] w-full`, which is
		// WIDTH-driven"). The guard caught the comment explaining the absence, which
		// is a failure mode this repo has now hit six times. A source-scan negative
		// must match SYNTAX — here, a class token inside a class attribute — never a
		// bare word that prose can contain.
		const classAttrs = [...source.matchAll(/className="([^"]*)"/g)].map(
			(m) => m[1] ?? "",
		);
		expect(classAttrs.length).toBeGreaterThan(0); // the scan found something
		const tokens = new Set(
			classAttrs.flatMap((c) => c.split(/\s+/)).filter(Boolean),
		);

		// `flex-1` is what takes the leftover; `min-h-0` is what lets it shrink
		// below its content instead of pushing the band taller. Drop either and
		// the growth silently stops being growth.
		expect(source).toContain("flex min-h-0 w-full flex-1 flex-col");
		expect(tokens.has("flex-1")).toBe(true);
		expect(tokens.has("min-h-0")).toBe(true);

		// ⛔ A FIXED OR WIDTH-DRIVEN HEIGHT WOULD DEFEAT IT ENTIRELY, and this card
		// shipped one once: `aspect-[2/1] w-full` ignores the rail it sits in and
		// measured 182px inside a 146px column, pushing the price bar clean out of
		// the band.
		expect(tokens.has("aspect-[2/1]")).toBe(false);
		expect(tokens.has("h-full")).toBe(false);
		expect([...tokens].filter((t) => /^h-\[/.test(t))).toEqual([]);
	});
});
