"use client";

import { EmptyBlock } from "@/components/ui/empty-block";
import type { ProfileGraphSeries } from "@/server/profile/graph-series";

import { GRAPH_COPY, PROFILE_COPY } from "../copy";
import { ProfileChart } from "./ProfileChart";

/** The collapsed placeholder card — the net-worth line + a 2-label endpoint
 * axis, NODE-FREE (nodes are expanded-views-only, N-4). The whole card is the
 * expand control. When there is nothing to plot (no net-worth samples and no
 * positions), it renders the empty state instead.
 *
 * ⚠⚠ ROUND 5 item B — THE CARD FILLS ITS CELL; IT NO LONGER SETS IT. Two
 * sizing tokens changed, and NOTHING else in this file — the fence the founder
 * opened it under is "only the sizing that makes the card's HEIGHT derive from
 * its WIDTH":
 *
 *   `block w-full`          → `block min-h-0 w-full`
 *   `aspect-[2/1] w-full`   → `h-full w-full`
 *
 * WHY BOTH, AND WHY ONLY THESE TWO. This card is a direct grid item of the
 * profile headzone, so `align-self:stretch` already gave it the row's height —
 * but a grid item's AUTOMATIC MINIMUM SIZE is its content, so it refused to
 * shrink below the aspect box and the row grew to fit it instead. `min-h-0`
 * removes that floor, which is what lets the declared band height actually
 * bind; `h-full` then makes the chart box the card's content box rather than a
 * ratio on its own width. Measured at 1024 / 1440 / 1920 with the band declared
 * at 256: card 256, cell 256, **spill 0**, and `scrollHeight === clientHeight`.
 *
 * ⛔ THREE ROUNDS OF `HTML-FINISH` ROW 16 / EYE-PASS ITEM 3 FAILED ON EXACTLY
 * THIS LINE. `aspect-[2/1] w-full` made the card's height `(colWidth − 32)/2 +
 * 32`, so the graph — not the identity card — set the band, and every attempt
 * to declare a band height spilled the chart over the arena (measured at round
 * 4: 140px at 1440). The chart itself needed no change: `ProfileChart` is an
 * `<svg viewBox … preserveAspectRatio="none" class="h-full w-full">`, so it
 * scales to whatever box it is given.
 *
 * ⛔ NOTHING ELSE IN THIS FILE IS TOUCHED — not `series`, not `onExpand`, not
 * the empty branch, not `ProfileChart`'s props (`selection="cumulative"`,
 * `mode="placeholder"`), not `geometry.ts`, `ProfileChart.tsx`,
 * `MarketFilter.tsx` or the overlay. NO symbol is renamed or removed:
 * POLISH.5 PR C is fenced to symbols in this directory and is UNSTARTED.
 *
 * ⚠ ONE COSMETIC CONSEQUENCE, NAMED NOT HIDDEN: the EMPTY branch is deliberately
 * left alone (it is not part of the height-from-width mechanism), so on a
 * profile with nothing to plot the 148px `EmptyBlock` now sits at the TOP of a
 * 256px card instead of being the card's whole height. Centring it is a
 * one-token change to a branch outside this fence and is not taken here. */
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
			className="block min-h-0 w-full rounded-[var(--r)] bg-n0 p-4 text-left"
		>
			{/* Item 8 (P5-D11) — the third empty adopts W2.11 P1 at ONE message
			    tier (D3(a)). P1 renders NO interactive element, which is what
			    lets it nest here at all: this whole card is a `<button>`, and a
			    `<button>` cannot nest in a `<button>`. That is the structural
			    reason `empty-block` takes no action prop. */}
			{empty ? (
				/* ⚠ Gate C G-2 — `messageAs="p"` HERE AND ONLY HERE. This card's
				   root is the expand `<button>`, so P1's default `<h2>` would be
				   announced as a heading inside a control: noise, not semantics.
				   The other two P1 sites keep the default. */
				<EmptyBlock
					message={PROFILE_COPY.graph.empty}
					messageTestId="graph-empty"
					messageAs="p"
				/>
			) : (
				<div className="h-full w-full">
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
