"use client";

import { useEffect } from "react";

import type { ChartNode } from "@/server/debate-view/price-chart";
import type { PricePoint } from "@/server/discovery/price-series";

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
			</div>
		</div>
	);
}
