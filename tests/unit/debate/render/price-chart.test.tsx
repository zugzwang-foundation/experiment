// @vitest-environment jsdom

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

import { VIEWBOX_W } from "@/components/debate/chart/geometry";
import { MarketPriceChart } from "@/components/debate/chart/MarketPriceChart";
import { MarketPriceChartCard } from "@/components/debate/chart/MarketPriceChartCard";
import { MarketHeader } from "@/components/debate/MarketHeader";
import type { DebateMarketHeader } from "@/components/debate/types";

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

// The unbet market: one seed point → the chart renders a full-width flat line.
const SINGLE: PricePoint[] = [
	{ at: "2026-09-15T00:00:00.000Z", yes: "0.500000000000000000" },
];

// YES winning at every point (yes > 0.5) — the INV-3 GEOMETRY guard: the YES
// line must sit ABOVE the NO line (a smaller SVG y) at the same x.
const YES_WINNING: PricePoint[] = [
	{ at: "2026-09-15T00:00:00.000Z", yes: "0.700000000000000000" },
	{ at: "2026-09-20T00:00:00.000Z", yes: "0.800000000000000000" },
];

const MARKET: DebateMarketHeader = {
	id: "0190c0de-1111-7000-8000-000000000001",
	slug: "chart-header-market",
	title: "Chart Market Question",
	description: "Resolution criterion text.",
	status: "Open",
	pricing: { yes: "0.500000000000000000", no: "0.500000000000000000" },
	unitToWin: { yes: "1.960000000000000000", no: "1.960000000000000000" },
	totals: {
		dharmaStaked: "150.000000000000000000",
		postCount: 3,
		replyCount: 5,
	},
};

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
	it("collapsed-renders-no-axis", () => {
		render(<MarketPriceChartCard series={SERIES} onExpand={vi.fn()} />);

		// Non-vacuity: the chart rendered (its svg + both lines are present).
		expect(screen.getByTestId("market-price-chart")).toBeTruthy();
		expect(screen.getByTestId("line-yes")).toBeTruthy();
		expect(screen.getByTestId("line-no")).toBeTruthy();

		// Collapsed carries NO time axis and NO post nodes (Slice 1).
		expect(screen.queryByTestId("axis-x-start")).toBeNull();
		expect(screen.queryByTestId("axis-x-end")).toBeNull();
		expect(byPrefix(document.body, "graph-node-")).toHaveLength(0);

		// Positive control — the axis CAN render (expanded mode), so its absence
		// above is meaningful, not vacuous.
		cleanup();
		render(<MarketPriceChart series={SERIES} mode="expanded" />);
		expect(screen.getByTestId("axis-x-start")).toBeTruthy();
		expect(screen.getByTestId("axis-x-end")).toBeTruthy();
	});

	// ── 1b. INV-3 side binding — the YES line strokes `--graph-yes`, the NO line
	//        `--graph-no`, bound by TOKEN NAME (never the slot value; the repo
	//        aliases YES→ink / NO→n0, so a value-copy OR a yFn/stroke swap would
	//        invert the poles yet pass typecheck, Biome, the token guards, and
	//        every other test). Guards the headline invariant against a silent
	//        pole-swap (@code-reviewer MEDIUM, slice 1). ─────────────────────────
	it("line-tokens-bind-by-side-inv3", () => {
		render(<MarketPriceChart series={SERIES} mode="collapsed" />);
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
		render(<MarketPriceChart series={YES_WINNING} mode="collapsed" />);
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
		render(<MarketPriceChartCard series={SUMMARY_SERIES} onExpand={vi.fn()} />);

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

	// ── 3. Single-point (unbet) → a full-width flat line at the opening price ───
	it("flat-line-when-single-point", () => {
		render(<MarketPriceChartCard series={SINGLE} onExpand={vi.fn()} />);

		const pts = parsePoints(
			screen.getByTestId("line-yes").getAttribute("points") ?? "",
		);
		// Both endpoints present (the "duplicate at both ends" flat-line trick).
		expect(pts.length).toBeGreaterThanOrEqual(2);
		const first = pts[0];
		const last = pts[pts.length - 1];
		// Full width — spans the domain from x = 0 to x = VIEWBOX_W.
		expect(first[0]).toBeCloseTo(0, 3);
		expect(last[0]).toBeCloseTo(VIEWBOX_W, 3);
		// Flat — every point sits at the SAME y (the opening price), no slope.
		for (const [, y] of pts) {
			expect(y).toBeCloseTo(first[1], 3);
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
		render(<MarketHeader market={MARKET} priceChart={{ series: SERIES }} />);
		expect(screen.getByTestId("market-price-chart-card")).toBeTruthy();
	});
});
