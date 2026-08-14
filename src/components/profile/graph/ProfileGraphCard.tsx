"use client";

import { EmptyBlock } from "@/components/ui/empty-block";
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
			{/* Item 8 (P5-D11) — the third empty adopts W2.11 P1 at ONE message
			    tier (D3(a)). P1 renders NO interactive element, which is what
			    lets it nest here at all: this whole card is a `<button>`, and a
			    `<button>` cannot nest in a `<button>`. That is the structural
			    reason `empty-block` takes no action prop. */}
			{empty ? (
				<EmptyBlock
					message={PROFILE_COPY.graph.empty}
					messageTestId="graph-empty"
				/>
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
