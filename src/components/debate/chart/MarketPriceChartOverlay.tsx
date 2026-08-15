"use client";

import { useEffect } from "react";

import type { ChartNode } from "@/server/debate-view/price-chart";
import type { PricePoint } from "@/server/discovery/price-series";

import { formatPercentUnpaired } from "../format";
import { fmtUtcDay } from "./geometry";
import { MarketPriceChart } from "./MarketPriceChart";

/** The expanded price chart — a STATE TOGGLE (not a route; the §23 overlay
 * pattern): the same two lines plus the time axis and the per-(UTC day, side)
 * post nodes (Slice 2). Closes on the X button, ESC, or a backdrop click; the
 * panel is a higher-z sibling so a panel click never closes. Body scroll is
 * locked while open. */
export function MarketPriceChartOverlay({
	series,
	nodes,
	onClose,
}: {
	series: PricePoint[];
	nodes: ChartNode[];
	onClose: () => void;
}): React.JSX.Element {
	const opening = series[0];
	const current = series[series.length - 1];
	// pctround-allow: genuinely single-side — the OPENING YES price, one point in
	// TIME, not one half of a live pair (SPEC.1 §10.8 escape hatch). Same grounds
	// as the collapsed card's two, which this readout must agree with.
	const openingPct = formatPercentUnpaired(opening.yes);
	// pctround-allow: genuinely single-side — the CURRENT YES price, the other
	// point in TIME. Shares the card's formatter core, so the collapsed and
	// expanded readouts can never disagree on the same market.
	const currentPct = formatPercentUnpaired(current.yes);

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				onClose();
			}
		};
		document.addEventListener("keydown", onKey);
		const previousOverflow = document.body.style.overflow;
		document.body.style.overflow = "hidden";
		return () => {
			document.removeEventListener("keydown", onKey);
			document.body.style.overflow = previousOverflow;
		};
	}, [onClose]);

	return (
		<div
			data-testid="market-price-chart-overlay"
			role="dialog"
			aria-modal="true"
			aria-label="Market price history"
			className="fixed inset-0 z-50 flex items-center justify-center"
		>
			{/* Backdrop — a click here closes; the panel below is a higher-z sibling. */}
			<button
				type="button"
				data-testid="market-price-chart-backdrop"
				aria-label="Close price chart"
				onClick={onClose}
				className="absolute inset-0 bg-[var(--overlay)]"
			/>
			<div className="relative z-10 flex w-[min(92vw,880px)] flex-col gap-3 rounded-[var(--r)] bg-n0 p-4">
				<div className="flex items-center justify-between">
					{/* Legend — colour paired with the YES/NO label (design-language
					    §3.2 / §8 a11y; INV-3 side binding, token-bound). */}
					<ul className="flex gap-4 text-xs text-n5">
						<li className="flex items-center gap-1.5">
							<span
								aria-hidden="true"
								className="inline-block h-0.5 w-4 bg-[var(--graph-yes)]"
							/>
							YES
						</li>
						<li className="flex items-center gap-1.5">
							<span
								aria-hidden="true"
								className="inline-block h-0.5 w-4 bg-[var(--graph-no)]"
							/>
							NO
						</li>
					</ul>
					<button
						type="button"
						data-testid="market-price-chart-close"
						aria-label="Close price chart"
						onClick={onClose}
						className="rounded-[var(--r-chip)] px-2 py-1 text-n5 hover:text-ink"
					>
						✕
					</button>
				</div>
				<div className="aspect-[2/1] w-full">
					<MarketPriceChart series={series} nodes={nodes} mode="expanded" />
				</div>
				{/* Row 8 · PD-3-04 · class F, TIER 1. SPEC.1 §9 · Accessibility requires
				    "an accessible text summary naming the opening price, the current
				    price, and the domain endpoints". The overlay carried NONE: its only
				    text was its own aria-label plus two close labels, and
				    `MarketPriceChart`'s SVG is `aria-hidden` in BOTH modes — so a
				    screen-reader user got a dialog with a name and no content.
				    ⚠ WHY THE GAP EXISTED: `UI.19.md` scoped the F-DEBATE-5 summary to
				    the COLLAPSED CARD BY NAME and specified the overlay only as
				    "mirroring `ProfileGraphOverlay`", which has no summary either.
				    TIER 3 NEVER SUPERSEDES TIER 1.
				    Keyed distinctly from the card's `market-price-chart-summary` so a
				    query can never match the wrong one.
				    ⛔ `PD-3-04` ONLY — D6 does not widen to chart GEOMETRY, which defers
				    with the media panel (HEADER-3ZONE). No geometry changes here. */}
				<span
					data-testid="market-price-chart-overlay-summary"
					className="sr-only"
				>
					Price history: opening {openingPct}, current {currentPct},{" "}
					{fmtUtcDay(opening.at)} to {fmtUtcDay(current.at)}.
				</span>
			</div>
		</div>
	);
}
