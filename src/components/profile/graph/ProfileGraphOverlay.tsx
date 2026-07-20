"use client";

import { useEffect, useState } from "react";

import type { ProfileGraphSeries } from "@/server/profile/graph-series";

import { GRAPH_COPY } from "../copy";
import { MarketFilter } from "./MarketFilter";
import { ProfileChart } from "./ProfileChart";

/** The fullscreen expanded graph — a STATE TOGGLE (not a route, per §1d/W2.6):
 * hosts the market filter + the expanded chart. Closes on the X button, ESC,
 * or a backdrop click; a click on the panel itself never closes (the backdrop
 * is a SIBLING below the z-10 panel, so a panel click can't reach it). Filter
 * selection is local, defaulting to "cumulative"; the body scroll is locked
 * while open. */
export function ProfileGraphOverlay({
	series,
	onClose,
}: {
	series: ProfileGraphSeries;
	onClose: () => void;
}): React.JSX.Element {
	const [selection, setSelection] = useState("cumulative");

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

	const cumulative = selection === "cumulative";

	return (
		<div
			data-testid="profile-graph-overlay"
			role="dialog"
			aria-modal="true"
			// The legend (cumulative view) names the dialog; per-market has no
			// legend, and its control name is a web-owned OQ-7 gap (surfaced for
			// Gate C — "graph-overlay labels beyond the axis endpoints").
			aria-labelledby={cumulative ? "profile-graph-legend" : undefined}
			className="fixed inset-0 z-50 flex items-center justify-center"
		>
			{/* Backdrop — a click here closes; the panel below is a higher-z sibling. */}
			<button
				type="button"
				data-testid="graph-backdrop"
				aria-label={GRAPH_COPY.aria.close}
				onClick={onClose}
				className="absolute inset-0 bg-[var(--overlay)]"
			/>
			<div className="relative z-10 flex w-[min(92vw,880px)] flex-col gap-3 rounded-[var(--r)] bg-n0 p-4">
				<div className="flex items-center justify-between">
					<MarketFilter
						series={series}
						value={selection}
						onChange={setSelection}
					/>
					<button
						type="button"
						data-testid="graph-close"
						aria-label={GRAPH_COPY.aria.close}
						onClick={onClose}
						className="rounded-[var(--r-chip)] px-2 py-1 text-n5 hover:text-ink"
					>
						✕
					</button>
				</div>
				{/* Legend — the two cumulative lines (cumulative view only); also the
				    dialog's accessible name via aria-labelledby. */}
				{cumulative && (
					<ul id="profile-graph-legend" className="flex gap-4 text-xs text-n5">
						<li className="flex items-center gap-1.5">
							<span
								aria-hidden="true"
								className="inline-block h-0.5 w-4 bg-[var(--graph-no)]"
							/>
							{GRAPH_COPY.legend.networth}
						</li>
						<li className="flex items-center gap-1.5">
							<span
								aria-hidden="true"
								className="inline-block h-0 w-4 border-t border-dashed border-[var(--graph-yes)]"
							/>
							{GRAPH_COPY.legend.freedharma}
						</li>
					</ul>
				)}
				<div className="aspect-[2/1] w-full">
					<ProfileChart series={series} selection={selection} mode="expanded" />
				</div>
			</div>
		</div>
	);
}
