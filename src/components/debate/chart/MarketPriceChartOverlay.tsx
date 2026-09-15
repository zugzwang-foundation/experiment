"use client";

import { useEffect, useRef } from "react";

import type { PricePoint } from "@/server/discovery/price-series";
import { lockPageScroll } from "../scroll-lock";
import { ChartSummary } from "./ChartSummary";
import { MarketPriceChart } from "./MarketPriceChart";

/** The expanded price chart — a STATE TOGGLE (not a route; the §23 overlay
 * pattern): the same two lines plus the time axis and the per-(UTC day, side)
 * post nodes (Slice 2). Closes on the X button, ESC, or a backdrop click; the
 * panel is a higher-z sibling so a panel click never closes. Body scroll is
 * locked while open. */
export function MarketPriceChartOverlay({
	series,
	isOpen,
	onClose,
}: {
	series: PricePoint[];
	/** `C-CHART-2` clause 1 — whether the market is `Open`, i.e. whether the
	 * terminal dots pulse. Threaded straight through; this component neither
	 * derives nor gates it, for the reason `MarketHeader` gives about `pick`. */
	isOpen: boolean;
	onClose: () => void;
}): React.JSX.Element {
	const rootRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				onClose();
			}
		};
		document.addEventListener("keydown", onKey);
		return () => {
			document.removeEventListener("keydown", onKey);
		};
	}, [onClose]);

	/**
	 * ⛔⛔ THE LOCK IS ITS OWN EFFECT WITH EMPTY DEPS, AND THAT IS NOT TIDINESS.
	 * The keydown effect above depends on `onClose`, which `MarketPriceChartHost`
	 * passes as a fresh arrow on every render — and this component re-renders on
	 * every `DebatePoll` tick, every 30 s, because the poll is deliberately NOT
	 * suspended for a read-only sheet. Sharing one effect meant taking and
	 * releasing the lock, with a DOM walk and a forced `scrollTop` write each
	 * time, on a timer. `@code-reviewer` found it. Empty deps tie the lock to the
	 * overlay's mount, which is what "while the overlay is open" means.
	 *
	 * ⚠ THIS SITE NEEDS A LOCK FOR A REASON `PhoneSheet` DOES NOT: the overlay
	 * opens from INSIDE the phone details sheet, so on a phone it is a second
	 * modal over a tier whose `document.body` does not scroll at all, and a
	 * body-level lock there locks nothing. The module refcounts, so this lock and
	 * the sheet's cannot leave the page stuck in whichever order they release.
	 * ⚠ `rootRef` is passed for the same reason `PhoneSheet` passes its own: this
	 * panel's own content is the thing that must keep scrolling.
	 * ⚠ THE DESKTOP PATH IS UNCHANGED IN EFFECT, and now structurally so: the
	 * module scopes its walk to the phone tier, which is `display: none` at
	 * >= 640px, so above the breakpoint this reduces to exactly the
	 * `document.body` lock it replaced — no desktop container is captured and no
	 * desktop `scrollTop` is written.
	 */
	useEffect(() => lockPageScroll(rootRef.current), []);

	return (
		<div
			ref={rootRef}
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
				    because a sibling column sits beside it. `w-full` and nothing
				    else; the plot derives its own height from `SVG_W / VIEWBOX_H`.
				    ⚠ THE SIBLING IS THE NUMERIC MARKS, NOT A LABEL GUTTER, SINCE
				    CHART-6. This read "the labels now sit in a CSS gutter beside it"
				    and "sizing this div by an aspect would size plot + gutter
				    together" — the labels are an overlay INSIDE the plot now and the
				    gutter is deleted, so the ruling survives on the marks column
				    instead. Caught by `@code-reviewer` at the CHART-6 cascade.
				    ⛔ AND THERE ARE **TWO** SIBLINGS SINCE CHART-7, ON OPPOSITE SIDES,
				    WHICH MAKES THE RULING MORE TRUE RATHER THAN LESS. The marks column
				    moved LEFT (RF-1) and a right RESERVE for the traveling end labels
				    took its place (RF-5). Measured on this branch's own build: the two
				    together take **108.88px** of this div — 24.00 for the marks and
				    84.88 for the reserve — where the sentence above said 24. An aspect
				    declared here would now mis-shape the plot by four times as much.
				    ⚠ AND THE HEIGHT MOVED BACK DOWN. CHART-6 returned the gutter's
				    48.73px to the plot and took the chart box from 382.25 to 406.91;
				    the reserve takes 84.88px of width back out, and under a locked
				    aspect that is height — **measured 365.06**, below where CHART-6
				    found it and below where CHART-5 left it. The panel-overflow
				    threshold this paragraph tracks therefore moves in the SAFE
				    direction; the figures above are the CHART-6 ones and are kept as
				    the record of that pass rather than overwritten, because they were
				    true when measured.
				    ⚠ Replacing the literal with `aspect-[649/320]` was considered and
				    rejected by ruling: it is the same defect with a newer number.
				    `C-CHART-1` clause 4 now states a relationship, and
				    `container-viewbox-lock.test.tsx` asserts it. */}
				<div className="w-full">
					<MarketPriceChart series={series} mode="expanded" isOpen={isOpen} />
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
