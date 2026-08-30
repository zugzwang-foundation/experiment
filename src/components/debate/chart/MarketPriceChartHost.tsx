"use client";

import { useState } from "react";

import type { ChartNode } from "@/server/debate-view/price-chart";
import type { PricePoint } from "@/server/discovery/price-series";

import { MarketPriceChartCard } from "./MarketPriceChartCard";
import { MarketPriceChartOverlay } from "./MarketPriceChartOverlay";

/** The market-detail price-chart host (the §23 profile-graph host pattern) — the
 * collapsed card with a STATE-TOGGLE expanded overlay (not a route). The overlay
 * is absent from the DOM until the card is clicked. `nodes` ride to the EXPANDED
 * overlay only — the collapsed Card never receives them (nodes are expanded-only,
 * SPEC.1 §9). */
/**
 * ⛔⛔ THE ONE PLACE THAT DECIDES WHETHER THERE IS A CHART TO DRAW — exported so
 * a CALLER can ask the same question before deciding whether to draw a COLUMN
 * around it.
 *
 * ⚠ THIS EXISTS BECAUSE THE DUPLICATE COST US A LIVE DEFECT. RESO-1 · R-4 made
 * `MarketHeader`'s rail conditional so that moving the price bar out could not
 * leave an empty 340px column. It first asked `priceChart != null` — a PROXY for
 * this condition rather than this condition — and `deriveMarketPriceChart`
 * returns a NON-NULL `{ series: [], nodes: [] }` for a market with no price
 * history (`server/debate-view/price-chart.ts:71-74`). So the caller drew the
 * column and this component rendered `null` inside it. Two components deciding
 * the same question by different tests is what produced the gap; a proxy for a
 * condition will always eventually diverge from it, so the fix is to publish the
 * condition rather than to restate it more carefully.
 * ⇒ ⛔ IF A SECOND "nothing to draw" CASE IS EVER ADDED, ADD IT HERE. That is the
 * whole point of the export: a new null path inside the component body would
 * silently re-open the empty-column defect for every caller.
 */
export function hasRenderableSeries(series: PricePoint[]): boolean {
	return series.length > 0;
}

export function MarketPriceChartHost({
	series,
	nodes,
	isOpen,
}: {
	series: PricePoint[];
	nodes: ChartNode[];
	/**
	 * `C-CHART-2` clause 1 — whether the terminal dots pulse. READ from
	 * `market.status` by `MarketHeader`, never inferred here: a quiet `Open`
	 * market and a `Closed` one are indistinguishable from the series alone, and
	 * pulsing a frozen market asserts it is live (**INV-4**). `/m/[slug]` is the
	 * one surface where the non-`Open` branch is reachable — Discovery lists only
	 * `Open` markets — which is the same asymmetry `withLiveTail` carries.
	 */
	isOpen: boolean;
}): React.JSX.Element | null {
	const [open, setOpen] = useState(false);

	// An empty series omits the chart rather than rendering an empty frame.
	// ⚠ THIS COMMENT USED TO CALL THE BRANCH "Defensive (unreachable — an opened
	// market always seeds ≥1 point)". IT IS NOT UNREACHABLE AND IT IS NOT RARE:
	// measured at RESO-1 recon, `market-price-chart-card` rendered on ZERO of the
	// eight staging markets, because those fixtures are raw-INSERT rather than
	// event-backed and the reserve walk comes back empty. Corrected in place —
	// a branch documented as unreachable is one nobody thinks about, and this is
	// the branch the empty-rail defect ran through.
	if (!hasRenderableSeries(series)) {
		return null;
	}

	return (
		<>
			<MarketPriceChartCard
				series={series}
				isOpen={isOpen}
				onExpand={() => setOpen(true)}
			/>
			{open && (
				<MarketPriceChartOverlay
					series={series}
					nodes={nodes}
					isOpen={isOpen}
					onClose={() => setOpen(false)}
				/>
			)}
		</>
	);
}
