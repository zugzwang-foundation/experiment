// @vitest-environment jsdom

import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { MarketPriceChartOverlay } from "@/components/debate/chart/MarketPriceChartOverlay";
import type { ChartNode } from "@/server/debate-view/price-chart";
import type { PricePoint } from "@/server/discovery/price-series";

/**
 * POLISH.3 PR 2 · C1 — the chart-overlay accessibility guard (plan §7; §6 row
 * 8, class **F tier 1**).
 *
 * Row 8 (`PD-3-04`, C12) — SPEC.1 §9 · Accessibility requires "an accessible
 * text summary naming the opening price, the current price, and the domain
 * endpoints". The expanded overlay carries NONE: its only text is
 * `aria-label="Market price history"` plus two × `aria-label="Close price
 * chart"`, and `MarketPriceChart`'s SVG is `aria-hidden` in BOTH modes — so a
 * screen-reader user gets a dialog with a name and no content.
 *
 * ⚠ WHY THE GAP EXISTS, RECORDED SO IT IS NOT REDISCOVERED. `docs/plans/UI.19.md`
 * scoped the F-DEBATE-5 summary to the COLLAPSED CARD BY NAME — "a sibling
 * `sr-only` element in the collapsed card states opening price, current price,
 * and the two domain endpoints" — and specified the overlay only as "mirroring
 * `ProfileGraphOverlay`", which has no summary either. **Tier 3 never
 * supersedes tier 1.**
 *
 * ⚠ The collapsed card already ships the shape this row wants:
 * `MarketPriceChartCard.tsx` renders `data-testid="market-price-chart-summary"`
 * as an `sr-only` span. The overlay gets its own, distinctly keyed so a future
 * query cannot silently match the card's while both are on the page.
 *
 * ⛔ `PD-3-04` ONLY — D6 does not widen to chart GEOMETRY, which defers with
 * the media panel (`HEADER-3ZONE`). No geometry assertion here.
 * ⚠ NOT the A11Y.0 overlay-FOCUS row either — that one is cross-surface and
 * covers focus move/trap/restore plus duplicate accessible names.
 *
 * No jest-dom in this repo (AGENTS.md §9) — plain DOM only.
 */

afterEach(cleanup);

/** Two points, distinct prices, distinct UTC days — so opening ≠ current and
 * the two domain endpoints are distinguishable in the rendered summary. */
const SERIES: PricePoint[] = [
	{ at: "2026-09-15T00:00:00.000Z", yes: "0.400000000000000000" },
	{ at: "2026-09-18T00:00:00.000Z", yes: "0.730000000000000000" },
];

const NODES: ChartNode[] = [];

const noop = () => {};

function renderOverlay() {
	return render(
		<MarketPriceChartOverlay series={SERIES} nodes={NODES} onClose={noop} />,
	);
}

describe("POLISH.3 PR 2 — PD-3-04, the expanded chart's accessible summary", () => {
	it("chart-overlay-a11y::the-overlay-carries-an-accessible-summary", () => {
		// Presence. Today the component has zero `sr-only` content.
		const { container } = renderOverlay();

		expect(
			container.querySelector(
				'[data-testid="market-price-chart-overlay-summary"]',
			),
		).not.toBeNull();
	});

	it("chart-overlay-a11y::the-summary-is-screen-reader-only", () => {
		// It is an ACCESSIBLE summary, not a visible caption — the overlay's
		// visual design is not this row's subject and must not change.
		const { container } = renderOverlay();

		const summary = container.querySelector(
			'[data-testid="market-price-chart-overlay-summary"]',
		);

		expect(summary?.getAttribute("class")).toContain("sr-only");
	});

	it("chart-overlay-a11y::the-summary-names-opening-current-and-both-endpoints", () => {
		// The SPEC.1 §9 content obligation, asserted item by item. A summary
		// that named only the current price would satisfy "a summary exists"
		// and still fail the requirement.
		const { container } = renderOverlay();

		const summary = container.querySelector(
			'[data-testid="market-price-chart-overlay-summary"]',
		);
		const html = summary?.innerHTML ?? "";

		// Opening price and current price — the two named figures.
		// `formatPercentUnpaired` is the shipped formatter (single HISTORICAL
		// value, one point in TIME — SPEC.1 §10.8's escape hatch, not one half
		// of a live pair).
		expect(html).toContain("40%");
		expect(html).toContain("73%");
		// The two domain endpoints, in the collapsed card's own `fmtUtcDay`
		// shape ("Sep 15"), so the two readouts cannot disagree on one market.
		expect(html).toContain("Sep 15");
		expect(html).toContain("Sep 18");
	});
});
