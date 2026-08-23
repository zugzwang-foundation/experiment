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
 * ⛔⛔ DEMO PLACEHOLDER — FOUNDER RULING 2026-08-23. DELETE THIS, DO NOT MAINTAIN IT.
 *
 * WHAT IT IS. A hardcoded sample price line, drawn only when the real series is
 * EMPTY and only outside production. It exists so the 340px rail reads as a chart
 * slot awaiting data instead of a blank bordered box during demo prep.
 *
 * ⛔⛔ THE UNDERLYING FAULT IS THE EMPTY SERIES, NOT THIS COMPONENT. Measured on
 * staging 2026-08-23: `market-price-chart` is absent from the DOM on EVERY market,
 * seeded and unseeded alike — `github-zugzwang-repo-stars` (Đ300, 6 posts) renders
 * no chart for the same reason `bitcoin-price-50k` (Đ0) does. The price series is
 * derived from event-sourced data and staging's fixtures are raw-INSERT, so it
 * reads empty everywhere. ⚠ Nothing was deleted: the five chart files are intact
 * on `main` and no chart commit has landed in 30 days. UNWIRE-1 (`ff1c0f9`) removed
 * the PROFILE Dharma graph and touched no market chart file.
 *
 * ⇒ REMOVED WHEN THE REAL PRICE SERIES POPULATES. This is not a fallback to keep,
 * an empty state to design against, or a component to extend. The day a market on
 * a non-prod environment has price history, this branch stops rendering and the
 * whole function below should be deleted with it.
 *
 * ⛔ IT NEVER TOUCHES REAL DATA. It is reachable only from `series.length === 0`;
 * it does not override, merge with, or fall back over a real series.
 *
 * ⚠ DETERMINISTIC BY CONSTRUCTION. Every coordinate is a literal. No
 * `Math.random()`, no `Date.now()`, no client-only value — so it renders
 * identically on every load and cannot hydration-mismatch.
 *
 * ⛔ MONOCHROME, AND DELIBERATELY NOT THE SIDE POLES. The real chart strokes
 * `var(--graph-yes)` / `var(--graph-no)`, which encode bet SIDE (INV-3). A sample
 * line is not a side, so it takes a neutral ramp step (`--color-n5`) with an
 * `--color-n2` fill. ⚠ That is also why this file does not join
 * `side-pole-binding.test.ts`'s permitted inventory — it uses no pole token.
 */
function PlaceholderPriceChart(): React.JSX.Element {
	return (
		<div
			data-testid="market-price-chart-placeholder"
			// ⚠ BOX MATCHED TO `MarketPriceChartCard` so the swap is invisible as
			// layout: same `flex min-h-0 w-full flex-1 flex-col`, same
			// `rounded-[var(--r)]`, same `bg-n0`, same `p-3`. The real card is a
			// <button>; this is a <div> because it is non-interactive.
			className="flex min-h-0 w-full flex-1 flex-col rounded-[var(--r)] bg-n0 p-3"
		>
			{/* The `.overline` recipe, byte-carried from `MarketHeader`'s RESOLUTION
			    label — same role (a quiet label above a block), so the same recipe
			    rather than a fourth variant. This text carries the meaning; the SVG
			    below is `aria-hidden`. */}
			<span className="text-[9.5px] font-extrabold tracking-[.14em] text-n4 uppercase">
				Sample · no price history yet
			</span>
			{/* `min-h-0 w-full flex-1` — the card's own inner wrapper, so the SVG gets
			    the same definite height to fill. */}
			<div className="mt-1.5 min-h-0 w-full flex-1">
				<svg
					viewBox="0 0 640 320"
					preserveAspectRatio="none"
					aria-hidden="true"
					className="h-full w-full"
				>
					<polygon
						points="0,160 53,154 107,163 160,150 213,157 267,144 320,154 373,166 427,160 480,150 533,157 587,163 640,160 640,320 0,320"
						fill="var(--color-n2)"
						fillOpacity="0.5"
					/>
					<polyline
						points="0,160 53,154 107,163 160,150 213,157 267,144 320,154 373,166 427,160 480,150 533,157 587,163 640,160"
						fill="none"
						stroke="var(--color-n5)"
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
