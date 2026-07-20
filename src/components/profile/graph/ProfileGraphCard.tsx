"use client";

import type { ProfileGraphSeries } from "@/server/profile/graph-series";

import { GRAPH_COPY, PROFILE_COPY } from "../copy";
import { ProfileChart } from "./ProfileChart";

/** The collapsed placeholder card — the net-worth line + a 2-label endpoint
 * axis, NODE-FREE (nodes are expanded-views-only, N-4). The whole card is the
 * expand control. When there is nothing to plot (no net-worth samples and no
 * positions), it renders the empty state instead. */
export function ProfileGraphCard({
	series,
	onExpand,
}: {
	series: ProfileGraphSeries;
	onExpand: () => void;
}): React.JSX.Element {
	const empty = series.netWorth.length === 0 && series.perMarket.length === 0;

	return (
		<button
			type="button"
			data-testid="profile-graph-card"
			aria-label={GRAPH_COPY.aria.expand}
			onClick={onExpand}
			className="block w-full rounded-[var(--r)] bg-n0 p-4 text-left"
		>
			{empty ? (
				<p data-testid="graph-empty" className="text-sm text-n5">
					{PROFILE_COPY.graph.empty}
				</p>
			) : (
				<div className="aspect-[2/1] w-full">
					<ProfileChart
						series={series}
						selection="cumulative"
						mode="placeholder"
					/>
				</div>
			)}
		</button>
	);
}
