"use client";

import { useEffect, useState } from "react";

import type { HeroTopPosts } from "@/server/discovery/hero";
import type { DiscoveryCard } from "@/server/discovery/list";
import type { PricePoint } from "@/server/discovery/price-series";

import { DiscoveryGrid } from "./DiscoveryGrid";
import { HeroPanels } from "./HeroPanels";

/** The canon-§5 auto-advance cadence — 10s per position. */
const ADVANCE_MS = 10_000;

/**
 * One market's full Discovery view-model — the card DTO + its price series +
 * its hero top posts, ALL loaded up-front by the page RSC (≤ 8 markets; the
 * carousel does NO re-fetch — §22 "client-side motion, not a data refresh").
 * Type-only server imports (erased — the types.ts idiom).
 */
export type DiscoveryMarketView = {
	card: DiscoveryCard;
	series: PricePoint[];
	topPosts: HeroTopPosts;
};

/**
 * The ONE client-motion piece (design-canon §5, plan §4): a single shared
 * index 0..n−1 drives the hero, the grid ring, and the active dot in sync.
 * 10s auto-advance with a straight n-position wrap; the countdown re-arms on
 * ANY index change (timer or manual — the effect is keyed on the index);
 * `‹`/`›` advance immediately (which itself resets the countdown). Exactly
 * one open market ⇒ static: no timer, no arrows, one dot (§22 F-DISC-2 /
 * the `hero-single-market-static` client half). `:has()` is banned (canon
 * §3.10) — active states are JS-toggled data attributes. Pick/select is
 * view-only (canon §12): rotation renders already-loaded data, nothing else.
 */
export function DiscoveryCarousel({
	markets,
}: {
	markets: DiscoveryMarketView[];
}) {
	const [active, setActive] = useState(0);
	const n = markets.length;

	useEffect(() => {
		if (n <= 1) {
			return;
		}
		// A fresh 10s countdown per index value — firing or clicking re-arms
		// (canon §5 "restarts on any change"): the countdown belongs to the
		// CURRENT index, so `active` is a real dependency.
		const timer = setTimeout(() => {
			setActive((active + 1) % n);
		}, ADVANCE_MS);
		return () => clearTimeout(timer);
	}, [n, active]);

	if (n === 0) {
		return null;
	}
	const view = markets[active];

	return (
		<div data-testid="discovery-carousel" className="flex flex-col gap-5">
			<HeroPanels
				card={view.card}
				series={view.series}
				topPosts={view.topPosts}
			/>

			<div className="flex items-center justify-center gap-2">
				{n > 1 && (
					<button
						type="button"
						aria-label="Previous market"
						onClick={() => setActive((i) => (i - 1 + n) % n)}
						className="px-2 font-mono text-lg text-muted-foreground hover:text-ink"
					>
						‹
					</button>
				)}
				{markets.map((m, i) => (
					<span
						key={m.card.id}
						data-testid="carousel-dot"
						{...(i === active ? { "data-active": "true" } : {})}
						className="relative h-1.5 w-6 overflow-hidden rounded-[var(--r-dot)] bg-n2"
					>
						{i === active && <DotFill key={`fill-${active}`} />}
					</span>
				))}
				{n > 1 && (
					<button
						type="button"
						aria-label="Next market"
						onClick={() => setActive((i) => (i + 1) % n)}
						className="px-2 font-mono text-lg text-muted-foreground hover:text-ink"
					>
						›
					</button>
				)}
			</div>

			<DiscoveryGrid markets={markets} activeIndex={active} />
		</div>
	);
}

/**
 * The active dot's L→R 10s countdown fill (canon §5). A fresh mount per
 * index change (keyed by the parent) starts at scaleX(0) and transitions to
 * full width over the ADVANCE_MS window — origin-left makes the fill run
 * L→R. Transition-based (no new @keyframes — globals.css is out of this
 * slice's fence); the arm flips one frame after mount so the transition has
 * a start state.
 */
function DotFill() {
	const [armed, setArmed] = useState(false);
	useEffect(() => {
		const raf = requestAnimationFrame(() => setArmed(true));
		return () => cancelAnimationFrame(raf);
	}, []);
	return (
		<span
			data-testid="dot-fill"
			aria-hidden="true"
			className="absolute inset-0 origin-left bg-ink transition-transform ease-linear"
			// Bound to ADVANCE_MS so the fill can never desync from the actual
			// advance cadence (code-review LOW).
			style={{
				transform: armed ? "scaleX(1)" : "scaleX(0)",
				transitionDuration: `${ADVANCE_MS}ms`,
			}}
		/>
	);
}
