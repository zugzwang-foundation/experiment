"use client";

import type { PricePoint } from "@/server/discovery/price-series";

import { formatPercentUnpaired } from "../format";
import { fmtUtcDay } from "./geometry";
import { MarketPriceChart } from "./MarketPriceChart";

/** The collapsed in-header price chart — the whole card is the expand control
 * (mirroring the §23 profile card), holding the two lines, the SPEC.1 1.0.32
 * time axis (two interior ticks, three date labels — no nodes) and the
 * accessible summary.
 *
 * ⚠ THIS DOCBLOCK USED TO SAY "the two lines only (no axis, no nodes)". The axis
 * half was reversed by SPEC.1 1.0.32 (HTML-FINISH · MARKET DETAIL round 2 · R8);
 * corrected here in the same commit rather than left contradicting the component
 * one import away.
 *
 * ⛔ THE `sr-only` SUMMARY IS NOT DUPLICATED BY THE AXIS AND IS NOT REDUNDANT.
 * The SVG stays `aria-hidden`, so the axis is VISUAL ONLY — the summary below is
 * still the sole accessible channel, and it already carries both domain
 * endpoints. The axis adds no new data (§9: it "introduces no new data and no
 * new read"), so there is nothing new for the summary to announce. */
export function MarketPriceChartCard({
	series,
	onExpand,
}: {
	series: PricePoint[];
	onExpand: () => void;
}): React.JSX.Element {
	const opening = series[0];
	const current = series[series.length - 1];
	// pctround-allow: genuinely single-side — the OPENING YES price, one point
	// in TIME, not one half of a pair (SPEC.1 §10.8 escape hatch).
	const openingPct = formatPercentUnpaired(opening.yes);
	// pctround-allow: genuinely single-side — the CURRENT YES price, the other
	// point in TIME. Shares `PriceBar`'s formatter core, so this readout and the
	// bar a few pixels below can never disagree on the same price.
	const currentPct = formatPercentUnpaired(current.yes);

	return (
		<button
			type="button"
			data-testid="market-price-chart-card"
			onClick={onExpand}
			className="flex h-full w-full flex-col rounded-[var(--r)] bg-n0 p-3 text-left"
		>
			{/* ⚠⚠ FILLS ITS SLOT — `.graph{flex:1 1 auto;min-height:0}` (`d5:493`).
			    It was `aspect-[2/1] w-full`, which is WIDTH-driven and therefore
			    ignores the rail it sits in: measured on staging at 1440×777 the card
			    rendered 182px tall inside a 146px rail, so the price bar below it
			    was pushed clean outside the headzone band. On a fixed-height page
			    that is not a cosmetic overlap — it is content leaving its box.
			    ⚠ Sole consumer is `MarketPriceChartHost`, itself used only by
			    `MarketHeader`, so filling cannot regress another surface. */}
			<div className="min-h-0 w-full flex-1">
				<MarketPriceChart series={series} mode="collapsed" />
			</div>
			{/* The ONE non-decorative element (SPEC.1 §9 Accessibility): the SVG is
			    aria-hidden, so this sr-only summary carries the readout — opening %,
			    current %, and the two domain endpoints — and is the button's
			    accessible name (no aria-label overrides it). Unlike the fully
			    aria-hidden §22 sparkline. */}
			<span data-testid="market-price-chart-summary" className="sr-only">
				Price history: opening {openingPct}, current {currentPct},{" "}
				{fmtUtcDay(opening.at)} to {fmtUtcDay(current.at)}.
			</span>
		</button>
	);
}
