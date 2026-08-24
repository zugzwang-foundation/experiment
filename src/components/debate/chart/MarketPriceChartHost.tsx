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
export function MarketPriceChartHost({
	series,
	nodes,
}: {
	series: PricePoint[];
	nodes: ChartNode[];
}): React.JSX.Element | null {
	const [open, setOpen] = useState(false);

	// Defensive (unreachable — an opened market always seeds ≥1 point): an empty
	// series omits the chart rather than rendering an empty frame.
	if (series.length === 0) {
		// ⛔ PRODUCTION IS BYTE-IDENTICAL TO BEFORE. The placeholder is non-prod
		// only, so an empty series in prod still returns `null` exactly as it did.
		// ⚠ `process.env.ZUGZWANG_ENV` IS READABLE HERE DESPITE `"use client"` —
		// `next.config.ts:29` inlines it into the browser bundle (`ZUGZWANG_ENV:
		// process.env.ZUGZWANG_ENV ?? "unknown"`). Server and client therefore read
		// the SAME build-time constant, so this branch cannot hydration-mismatch.
		if (process.env.ZUGZWANG_ENV === "prod") {
			return null;
		}
		return <PlaceholderPriceChart />;
	}

	return (
		<>
			<MarketPriceChartCard series={series} onExpand={() => setOpen(true)} />
			{open && (
				<MarketPriceChartOverlay
					series={series}
					nodes={nodes}
					onClose={() => setOpen(false)}
				/>
			)}
		</>
	);
}

/**
 * ⛔⛔ DEMO REPLICA — FOUNDER RULING 2026-08-23/24. DELETE THIS, DO NOT MAINTAIN IT.
 *
 * WHAT IT IS. A hardcoded stand-in for `MarketPriceChart`, drawn only when the
 * real series is EMPTY and only outside production.
 *
 * ⛔⛔ IT STANDS IN FOR A CHART THAT CANNOT DRAW YET, AND THE REASON IS DATA.
 * `replayReserveSeries` seeds its CPMM walk from the `market.opened` event, and
 * there are ZERO of those in the entire staging database (measured 2026-08-24)
 * while all 8 markets sit Open with pools — every one was opened by raw INSERT
 * rather than through `openMarket()`. So the walk returns `[]` before reading a
 * single bet event, and it does that even on a market carrying 10 `bet.placed`
 * and 3 `bet.sold`. ⚠ The price BAR moves on those markets because it reads the
 * live `pools` row; the chart does not because it reads the event log. Two
 * sources, one of them unusable.
 * ⇒ DELETED WHEN STAGING IS RE-SEEDED THROUGH `openMarket()`. That re-seed is
 * deferred by founder ruling (R8), which is the only reason this exists.
 *
 * ⛔ THE LABEL IS GONE, founder ruling — no `Sample`, no replacement text, no
 * tooltip, no aria substitute. ⚠ THAT RAISES THE STAKES ON THE ENV GATE: with
 * nothing on screen saying "fabricated", the gate in `MarketPriceChartHost` is
 * the ONLY thing keeping invented data off production. It is exercised and
 * pinned in `tests/unit/debate/render/chart-placeholder-gate.test.tsx`.
 *
 * ⛔ IT NEVER TOUCHES REAL DATA. Reachable only from `series.length === 0`; it
 * does not override, merge with, or fall back over a real series.
 *
 * ⚠ DETERMINISTIC BY CONSTRUCTION. Every coordinate is a literal. No
 * `Math.random()`, no `Date.now()`, no client-only value — identical on every
 * load, and it cannot hydration-mismatch.
 *
 * ⛔⛔ THE TOKENS ARE THE REAL CHART'S, INCLUDING THE SIDE POLES — and that
 * REVERSES the previous placeholder, which used neutral ramp steps on the
 * ground that "a sample line is not a side". Founder ruling: mirror the real
 * component exactly, do not invent a treatment. So `line-no` strokes
 * `var(--graph-no)` and `line-yes` strokes `var(--graph-yes)`, both at 1.75,
 * NO into the buffer first so YES paints over it — the real component's own
 * order. ⚠ These are the GRAPH family, not `--color-yes`/`--color-no`:
 * `--color-yes` IS the page ground (#181818), so a value-copy would be
 * invisible AND invert the poles. `MarketPriceChart` states this in terms.
 * ⚠ `side-pole-binding.test.ts` does not gain an entry, because its offender
 * predicate keys on a SIDE COMPARISON (`x === "YES"`) reaching a pole token,
 * and there is no comparison here at all — the two lines are unconditional.
 *
 * ⚠ THE TIME AXIS IS DELIBERATELY HALF-CARRIED. The dashed thirds gridlines are
 * taken (pure geometry, `--color-n2`, `5 4` dash — the real `CollapsedAxis`'s
 * own recipe); the THREE DATE LABELS are NOT. A fabricated price shape says
 * "a chart belongs here"; fabricated dates would assert a specific market
 * lifetime that does not exist. Shape is replicated, claims are not.
 */
function PlaceholderPriceChart(): React.JSX.Element {
	return (
		<div
			data-testid="market-price-chart-placeholder"
			// Box matched to `MarketPriceChartCard` so the swap is invisible as
			// layout: same flex column, same `rounded-[var(--r)]`, same `bg-n0`,
			// same `p-3`. That card is a <button>; this is a <div>, non-interactive.
			className="flex min-h-0 w-full flex-1 flex-col rounded-[var(--r)] bg-n0 p-3"
		>
			<div className="min-h-0 w-full flex-1">
				<svg
					viewBox="0 0 640 320"
					preserveAspectRatio="none"
					aria-hidden="true"
					className="h-full w-full"
				>
					{/* Drawn FIRST so the lines paint over it — the real component's
					    layer order (gridlines behind data). */}
					<line
						x1="213"
						x2="213"
						y1="0"
						y2="320"
						stroke="var(--color-n2)"
						strokeWidth="1"
						strokeDasharray="5 4"
						vectorEffect="non-scaling-stroke"
					/>
					<line
						x1="427"
						x2="427"
						y1="0"
						y2="320"
						stroke="var(--color-n2)"
						strokeWidth="1"
						strokeDasharray="5 4"
						vectorEffect="non-scaling-stroke"
					/>
					{/* Two complementary lines mirrored about 50% — y_yes + y_no = 320 at
					    every x, exactly as the real chart's `yYesPx`/`yNoPx` guarantee.
					    A market drifting 50% → ~64% YES, gently, no spikes. */}
					<polyline
						points="0,160 71,163 142,170 213,166 284,179 356,187 427,184 498,195 569,206 640,203"
						fill="none"
						stroke="var(--graph-no)"
						strokeWidth="1.75"
						strokeLinejoin="round"
						strokeLinecap="round"
						vectorEffect="non-scaling-stroke"
					/>
					<polyline
						points="0,160 71,157 142,150 213,154 284,141 356,133 427,136 498,125 569,114 640,117"
						fill="none"
						stroke="var(--graph-yes)"
						strokeWidth="1.75"
						strokeLinejoin="round"
						strokeLinecap="round"
						vectorEffect="non-scaling-stroke"
					/>
				</svg>
			</div>
		</div>
	);
}
