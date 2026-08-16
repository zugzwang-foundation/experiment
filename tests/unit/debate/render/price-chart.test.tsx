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
			<MarketPriceChartCard series={SERIES} onExpand={vi.fn()} />,
		);

		// Non-vacuity: the chart rendered (its svg + both lines are present).
		const svg = screen.getByTestId("market-price-chart");
		expect(svg).toBeTruthy();
		expect(screen.getByTestId("line-yes")).toBeTruthy();
		expect(screen.getByTestId("line-no")).toBeTruthy();

		// TWO interior ticks and THREE date labels — the ruled composition.
		const ticks = ["axis-x-tick-first", "axis-x-tick-second"];
		const labels = [
			"axis-x-label-first",
			"axis-x-label-second",
			"axis-x-label-end",
		];
		for (const id of [...ticks, ...labels]) {
			const el = container.querySelector(`[data-testid="${id}"]`);
			expect(el, `collapsed axis is missing ${id}`).not.toBeNull();
			// ⛔ THE CONTAINMENT ASSERTION — see the docblock. A `.xtick` div beside
			// the chart, d5's own structure, would satisfy a presence check and fail
			// this one.
			expect(
				svg.contains(el),
				`${id} must be INSIDE the <svg>, not a DOM sibling of the chart`,
			).toBe(true);
		}

		// EXACTLY two and three — a third tick or a fourth label is a different
		// composition from the one §9 ruled, and "at least one" would not see it.
		expect(byPrefix(container, "axis-x-tick-")).toHaveLength(2);
		expect(byPrefix(container, "axis-x-label-")).toHaveLength(3);
	});

	it("collapsed-axis-labels-are-REAL-series-timestamps", () => {
		// ⛔ SPEC.1 1.0.32's own constraint, asserted rather than trusted: the axis
		// "introduces no new data … every timestamp it renders is already carried
		// on `PricePoint.at`". The tempting implementation puts ticks at fixed
		// 33.3%/66.6% fractions and labels them with an INTERPOLATED instant
		// (`start + (end − start)/3`) — which for this fixture would print a
		// Sep 16 and a Sep 18 that appear nowhere in the series. Every rendered day
		// must be one of the three the series actually carries.
		const { container } = render(
			<MarketPriceChartCard series={SERIES} onExpand={vi.fn()} />,
		);
		const realDays = new Set(["Sep 15", "Sep 17", "Sep 20"]);
		const rendered = byPrefix(container, "axis-x-label-").map(
			(el) => el.textContent ?? "",
		);
		expect(rendered).toHaveLength(3);
		for (const day of rendered) {
			expect(realDays.has(day), `${day} is not a PricePoint.at day`).toBe(true);
		}
		// The end label is the LAST point, always — it is the domain's right edge.
		expect(
			container.querySelector('[data-testid="axis-x-label-end"]')?.textContent,
		).toBe("Sep 20");
	});

	it("collapsed-renders-NO-axis-on-a-degenerate-domain", () => {
		// The unbet market: one seed point, so `buildLine` draws a flat line by
		// duplicating one value at both edges and every point shares x = 0. Ticks
		// would stack on the left edge and all three labels would print the same
		// day three times. §9's amendment says so in terms.
		const { container } = render(
			<MarketPriceChartCard series={SINGLE} onExpand={vi.fn()} />,
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
			<MarketPriceChartCard series={SERIES} onExpand={vi.fn()} />,
		);
		expect(byPrefix(container, "graph-node-")).toHaveLength(0);

		// Positive control — nodes CAN render (expanded mode), so their absence
		// above is meaningful, not vacuous.
		cleanup();
		render(<MarketPriceChart series={SERIES} nodes={NODES} mode="expanded" />);
		expect(byPrefix(document.body, "graph-node-").length).toBeGreaterThan(0);
	});

	it("expanded-axis-is-UNTOUCHED-by-the-collapsed-amendment", () => {
		// 1.0.32's "UNCHANGED" clause, pinned. The expanded overlay keeps its two
		// ENDPOINT labels and gains none of the collapsed axis's ticks — the
		// amendment was scoped to one mode and a shared helper leaking across would
		// be invisible without this row.
		const { container } = render(
			<MarketPriceChart series={SERIES} mode="expanded" />,
		);
		expect(screen.getByTestId("axis-x-start")).toBeTruthy();
		expect(screen.getByTestId("axis-x-end")).toBeTruthy();
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
		render(<MarketPriceChart series={SERIES} nodes={NODES} mode="expanded" />);

		// One graph-node-<id> element per node in EXPANDED mode.
		expect(byPrefix(document.body, "graph-node-")).toHaveLength(NODES.length);
		for (const node of NODES) {
			expect(screen.getByTestId(`graph-node-${node.id}`)).toBeTruthy();
		}

		// COLLAPSED renders ZERO nodes EVEN WITH nodes provided — expanded-only.
		cleanup();
		render(<MarketPriceChart series={SERIES} nodes={NODES} mode="collapsed" />);
		expect(byPrefix(document.body, "graph-node-")).toHaveLength(0);

		// The collapsed CARD likewise shows no nodes (it renders the chart collapsed).
		cleanup();
		render(<MarketPriceChartCard series={SERIES} onExpand={vi.fn()} />);
		expect(byPrefix(document.body, "graph-node-")).toHaveLength(0);
	});

	// ── 6. Node side → token binding (INV-3, no pole inversion). A YES node fills
	//       `--graph-yes` + data-side "YES"; a NO node fills `--graph-no` +
	//       data-side "NO". Bound by the semantic token NAME, never inverted and
	//       never the `--color-*` slot (design decision #7). ─────────────────────
	it("node-tokens-bind-by-side-inv3", () => {
		render(<MarketPriceChart series={SERIES} nodes={NODES} mode="expanded" />);

		const [yesNode, noNode] = NODES; // NODES[0] = YES, NODES[1] = NO.

		const yesEl = screen.getByTestId(`graph-node-${yesNode.id}`);
		expect(yesEl.getAttribute("data-side")).toBe("YES");
		expect(yesEl.getAttribute("fill")).toBe("var(--graph-yes)");

		const noEl = screen.getByTestId(`graph-node-${noNode.id}`);
		expect(noEl.getAttribute("data-side")).toBe("NO");
		expect(noEl.getAttribute("fill")).toBe("var(--graph-no)");
	});
});
