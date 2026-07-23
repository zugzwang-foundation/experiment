"use client";

import { useState } from "react";

import type { PricePoint } from "@/server/discovery/price-series";

import { MarketPriceChartCard } from "./MarketPriceChartCard";
import { MarketPriceChartOverlay } from "./MarketPriceChartOverlay";

/** The market-detail price-chart host (the §23 profile-graph host pattern) — the
 * collapsed card with a STATE-TOGGLE expanded overlay (not a route). The overlay
 * is absent from the DOM until the card is clicked. */
export function MarketPriceChartHost({
	series,
}: {
	series: PricePoint[];
}): React.JSX.Element | null {
	const [open, setOpen] = useState(false);

	// Defensive (unreachable — an opened market always seeds ≥1 point): an empty
	// series omits the chart rather than rendering an empty frame.
	if (series.length === 0) {
		return null;
	}

	return (
		<>
			<MarketPriceChartCard series={series} onExpand={() => setOpen(true)} />
			{open && (
				<MarketPriceChartOverlay
					series={series}
					onClose={() => setOpen(false)}
				/>
			)}
		</>
	);
}
