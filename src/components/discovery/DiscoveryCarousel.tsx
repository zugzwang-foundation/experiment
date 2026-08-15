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

	// V37 — ArrowLeft / ArrowRight step the carousel (canon §5: "`‹ ›` /
	// Left-Right advance immediately and reset the timer"; the mockup binds the
	// same two keys at :477-479). This is CANON, not an a11y-deferred nicety,
	// which is why it lands here rather than waiting on R16.
	//
	// The reset half is free: `setActive` changes `active`, and the countdown
	// effect above is keyed on `active`, so re-arming is structural rather than
	// a second timer call that could drift from it.
	//
	// Bound to the DOCUMENT, matching the mockup, because the carousel has no
	// single focusable host — the dots are spans and the arrows disappear at
	// n <= 1. `preventDefault` stops the page scrolling under the key.
	useEffect(() => {
		if (n <= 1) {
			return;
		}
		const onKey = (e: KeyboardEvent) => {
			if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") {
				return;
			}
			// Never steal the arrows from a field the viewer is typing in.
			const el = e.target as HTMLElement | null;
			const tag = el?.tagName;
			if (tag === "INPUT" || tag === "TEXTAREA" || el?.isContentEditable) {
				return;
			}
			e.preventDefault();
			setActive((i) => (i + (e.key === "ArrowLeft" ? -1 : 1) + n) % n);
		};
		document.addEventListener("keydown", onKey);
		return () => document.removeEventListener("keydown", onKey);
	}, [n]);

	if (n === 0) {
		return null;
	}
	const view = markets[active];

	return (
		// V4 — the mockup's rhythm is hero → 9px → an 18px dot rail → 8px →
		// grid (`.sliderwrap{margin:9px 0 8px}`, :138-139), not a uniform stack
		// gap. The rail owns its own margins so the two gaps can differ.
		//
		// HTML-FINISH row 8 — `flex-1` so this column takes the height the page
		// now hands down and distributes it among hero / rail / grid below.
		<div data-testid="discovery-carousel" className="flex flex-1 flex-col">
			<HeroPanels
				card={view.card}
				series={view.series}
				topPosts={view.topPosts}
			/>

			{/* HTML-FINISH row 8 — the rail is FIXED height and takes no share of
			    the slack: the mockup's `.sliderwrap` is `flex:0 0 18px` (`:139`).
			    The 18px was already shipped; `flex-none` is what makes it refuse
			    to grow now that there is slack to be had. */}
			<div className="mt-[9px] mb-2 flex h-[18px] flex-none items-center justify-center gap-[7px]">
				{n > 1 && (
					<button
						type="button"
						aria-label="Previous market"
						onClick={() => setActive((i) => (i - 1 + n) % n)}
						className="px-[9px] font-mono text-base text-n4 hover:text-ink"
					>
						‹
					</button>
				)}
				{markets.map((m, i) => {
					const on = i === active;
					return (
						<span
							key={m.card.id}
							data-testid="carousel-dot"
							{...(on ? { "data-active": "true" } : {})}
							// V33 — the two dot states are different SHAPES, not one
							// shape in two fills: a 6px ring-outlined circle at rest
							// (`.sdot`), a 22px filled pill when active (`.sdot.on`,
							// :142-143). Every dot was previously the active pill, so
							// the rail read as eight identical bars and the active
							// position was carried by the fill overlay alone.
							className={
								on
									? "relative h-1.5 w-[22px] overflow-hidden rounded-[var(--r-dot)] bg-n2"
									: "h-1.5 w-1.5 rounded-full [border:var(--hairline)]"
							}
						>
							{on && <DotFill key={`fill-${active}`} />}
						</span>
					);
				})}
				{n > 1 && (
					<button
						type="button"
						aria-label="Next market"
						onClick={() => setActive((i) => (i + 1) % n)}
						className="px-[9px] font-mono text-base text-n4 hover:text-ink"
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
