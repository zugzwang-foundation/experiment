"use client";

import { type KeyboardEvent, useEffect, useState } from "react";

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

	// V37 — the arrow keys step the carousel (canon §5: "`‹ ›` / Left-Right
	// advance immediately and reset the timer"; the mockup binds the same keys
	// at :477-479). This is CANON, not an a11y-deferred nicety, which is why it
	// landed here rather than waiting on R16.
	//
	// The reset half is free: `setActive` changes `active`, and the countdown
	// effect above is keyed on `active`, so re-arming is structural rather than
	// a second timer call that could drift from it.
	//
	// ⛔⛔ CS13 §5 — SCOPED TO THE CAROUSEL, AND NO LONGER BOUND TO THE DOCUMENT.
	// The original comment justified the document binding with "the carousel has
	// no single focusable host". That was true, and the fix is to GIVE it one
	// (see `tabIndex` on the root below) rather than to keep listening globally.
	// A document listener owns the arrow keys for the WHOLE PAGE: it moved the
	// hero out from under a viewer who was arrowing through the market grid far
	// below it, and its `preventDefault` suppressed the page's own scroll on
	// every arrow press anywhere. Now the handler hangs off the carousel and
	// fires only while focus is inside it — so `‹ ›` reach it, the grid and the
	// rest of the page keep their arrows, and the scroll suppression applies
	// only where a key was actually consumed.
	//
	// ⚠ DIVERGES FROM THE MOCKUP, DELIBERATELY. `:477-479` binds to the
	// document. Reported to the founder rather than amended — the mockup and
	// design-canon are read-only to this lane.
	//
	// ⚠ THIS IS A REACT HANDLER, NOT A LISTENER, AND THE SCOPING IS THE REASON.
	// A keydown bubbles from whatever is focused up through the carousel, so
	// "focus is inside the carousel" is answered by the event's own path rather
	// than by a `closest()` test that could drift from the DOM it describes
	// (O-1: structural beats procedural).
	const onKey = (e: KeyboardEvent<HTMLElement>) => {
		if (n <= 1) {
			return;
		}
		// Up/Left step BACK, Down/Right step FORWARD. Up-and-Left agreeing is
		// what makes the pair predictable in a horizontal strip that is also a
		// vertical list of one market at a time.
		const step =
			e.key === "ArrowLeft" || e.key === "ArrowUp"
				? -1
				: e.key === "ArrowRight" || e.key === "ArrowDown"
					? 1
					: 0;
		if (step === 0) {
			return;
		}
		// Never steal the arrows from a field the viewer is typing in. Kept from
		// the document-bound original: the scope is narrower now, but a field
		// could still be placed inside the carousel later, and a caret moving
		// inside it must not also rotate the hero.
		const el = e.target as HTMLElement | null;
		const tag = el?.tagName;
		if (tag === "INPUT" || tag === "TEXTAREA" || el?.isContentEditable) {
			return;
		}
		e.preventDefault();
		setActive((i) => (i + step + n) % n);
	};

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
		// ⛔ CS13 §5 — THE KEY HANDLER HANGS HERE, AND THAT IS THE WHOLE SCOPE
		// MECHANISM. Everything the arrows should work from is inside this
		// element: the hero market panel, both hero post panels and their author
		// links, the `‹ ›` buttons, and every card in the grid below. A keydown
		// from any of them bubbles to this handler; a keydown from the header,
		// the footer or anywhere else on the page never reaches it.
		// ⚠ NO `tabIndex` IS ADDED, ON PURPOSE. The ARIA carousel pattern makes
		// the SLIDES and CONTROLS focusable, not the region — and all of them
		// already are, because they are real links and buttons. Adding a
		// tabIndex here would insert a second, contentless tab stop in front of
		// them and buy nothing the real controls do not already provide.
		// ⚠ `<section>` + an accessible name, not a `<div>`: this is a labelled
		// region, and the native element carries that without a `role`
		// (biome's `useSemanticElements` — the same correction CS12 took).
		<section
			aria-label="Markets"
			aria-roledescription="carousel"
			data-testid="discovery-carousel"
			className="flex flex-1 flex-col"
			onKeyDown={onKey}
		>
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
		</section>
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
