"use client";

import type { ProfileGraphSeries } from "@/server/profile/graph-series";

import { GRAPH_COPY } from "../copy";

/** The expanded-view market filter: "Cumulative" (default, first) + one option
 * per DISTINCT market the user staked in (a market with several SideEpisodes
 * still contributes ONE option). A market with two segments contributes one. */
export function MarketFilter({
	series,
	value,
	onChange,
}: {
	series: ProfileGraphSeries;
	value: string;
	onChange: (v: string) => void;
}): React.JSX.Element {
	const options = new Map<string, string>();
	for (const seg of series.perMarket) {
		if (!options.has(seg.marketId)) {
			options.set(seg.marketId, seg.marketSlug);
		}
	}

	return (
		<select
			// The control name ("filter by market") is a web-owned OQ-7 gap
			// (graph-overlay labels beyond the axis endpoints) — surfaced for Gate
			// C; the visible option text carries the meaning in the interim.
			data-testid="market-filter"
			value={value}
			onChange={(e) => onChange(e.target.value)}
			className="rounded-[var(--r-chip)] bg-n1 px-2 py-1 text-sm text-ink"
		>
			<option data-testid="market-filter-option-cumulative" value="cumulative">
				{GRAPH_COPY.filter.cumulative}
			</option>
			{[...options.entries()].map(([marketId, slug]) => (
				<option
					key={marketId}
					data-testid={`market-filter-option-${marketId}`}
					value={marketId}
				>
					{slug}
				</option>
			))}
		</select>
	);
}
