"use client";

import { useEffect } from "react";

import type { ChartNode } from "@/server/debate-view/price-chart";
import type { PricePoint } from "@/server/discovery/price-series";

import { ChartSummary } from "./ChartSummary";
import { MarketPriceChart } from "./MarketPriceChart";

/** The expanded price chart — a STATE TOGGLE (not a route; the §23 overlay
 * pattern): the same two lines plus the time axis and the per-(UTC day, side)
 * post nodes (Slice 2). Closes on the X button, ESC, or a backdrop click; the
 * panel is a higher-z sibling so a panel click never closes. Body scroll is
 * locked while open. */
export function MarketPriceChartOverlay({
	series,
	nodes,
	isOpen,
	onClose,
}: {
	series: PricePoint[];
	nodes: ChartNode[];
	/** `C-CHART-2` clause 1 — whether the market is `Open`, i.e. whether the
	 * terminal dots pulse. Threaded straight through; this component neither
	 * derives nor gates it, for the reason `MarketHeader` gives about `pick`. */
	isOpen: boolean;
	onClose: () => void;
}): React.JSX.Element {
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
				{/* ⛔ THE LEGEND IS GONE — `C-CHART-2` clause 2 SUPERSEDES `C-CHART-1`
				    clause 3, and it is REMOVED rather than restyled. It was a
				    two-item YES/NO key above the plot, and C-CHART-1 recorded at its
				    own ratification that it "appears in no document at any tier" and
				    had shipped unbaselined. Each line now ends in its own name, in
				    its own token, at the point of use — the same information, bound
				    to the thing it names, needing no key to resolve it. A legend
				    exists to answer "which line is which"; an element that answers
				    that question at the line makes the legend a second answer to a
				    question nobody is asking any more.
				    ⚠ The row survives as the close control's own row — it is the
				    overlay's only header affordance now, so `justify-end` replaces
				    `justify-between`, which would have left the ✕ floating mid-row
				    with nothing opposite it. */}
				<div className="flex items-center justify-end">
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
				{/* ⛔ THIS DIV NO LONGER DECLARES AN ASPECT, AND THAT IS THE CHART-2
				    REGRESSION FIX. It was `aspect-[2/1] w-full` — a literal tuned to
				    a `0 0 640 320` viewBox, giving exactly uniform scaling. CHART-1
				    widened the viewBox to 678×320 for the label gutter and left this
				    class alone, so the expanded overlay — the one mode that had been
				    undistorted — fell to an anisotropy of 0.94395, and no guard in
				    the repo could see it because every guard asserts in user units.
				    ⛔ THE LOCK MOVED INTO `MarketPriceChart`, WHERE IT BELONGS: the
				    box that must match the viewBox is the box the viewBox is mapped
				    into, which is the plot — and the plot is no longer this div,
				    because the labels now sit in a CSS gutter beside it. Sizing this
				    div by an aspect would size plot + gutter together and mis-shape
				    the plot by the gutter's width. `w-full` and nothing else; the
				    plot derives its own height from `SVG_W / VIEWBOX_H`.
				    ⚠ Replacing the literal with `aspect-[644/320]` was considered and
				    rejected by ruling: it is the same defect with a newer number.
				    `C-CHART-1` clause 4 now states a relationship, and
				    `container-viewbox-lock.test.tsx` asserts it. */}
				<div className="w-full">
					<MarketPriceChart
						series={series}
						nodes={nodes}
						mode="expanded"
						isOpen={isOpen}
					/>
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
				<ChartSummary
					series={series}
					testId="market-price-chart-overlay-summary"
				/>
			</div>
		</div>
	);
}
