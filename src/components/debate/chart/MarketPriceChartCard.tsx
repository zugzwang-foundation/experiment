"use client";

import type { PricePoint } from "@/server/discovery/price-series";

import { fmtPct, fmtUtcDay } from "./geometry";
import { MarketPriceChart } from "./MarketPriceChart";

/** The collapsed in-header price chart — the whole card is the expand control
 * (mirroring the §23 profile card), holding the two lines only (no axis, no
 * nodes) plus the accessible summary. */
export function MarketPriceChartCard({
	series,
	onExpand,
}: {
	series: PricePoint[];
	onExpand: () => void;
}): React.JSX.Element {
	const opening = series[0];
	const current = series[series.length - 1];

	return (
		<button
			type="button"
			data-testid="market-price-chart-card"
			onClick={onExpand}
			className="block w-full rounded-[var(--r)] bg-n0 p-3 text-left"
		>
			<div className="aspect-[2/1] w-full">
				<MarketPriceChart series={series} mode="collapsed" />
			</div>
			{/* The ONE non-decorative element (SPEC.1 §9 Accessibility): the SVG is
			    aria-hidden, so this sr-only summary carries the readout — opening %,
			    current %, and the two domain endpoints — and is the button's
			    accessible name (no aria-label overrides it). Unlike the fully
			    aria-hidden §22 sparkline. */}
			<span data-testid="market-price-chart-summary" className="sr-only">
				Price history: opening {fmtPct(opening.yes)}, current{" "}
				{fmtPct(current.yes)}, {fmtUtcDay(opening.at)} to{" "}
				{fmtUtcDay(current.at)}.
			</span>
		</button>
	);
}
