"use client";

import { useEffect, useRef, useState } from "react";

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
	/**
	 * `C-CHART-2` clause 1 (CHART-2) — whether the hero chart's terminal dots
	 * pulse. Always `true` on this surface, and carried as a FIELD rather than
	 * assumed inside `HeroPanels` so the licence stays where it can be read: the
	 * `status = 'Open'` filter that makes it true lives in
	 * `getCachedDiscoveryMarketIds`, and `page.tsx` is where the two are written
	 * next to each other and pinned together.
	 */
	isOpen: boolean;
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
	// ⛔ CS14 §1 — THE CAROUSEL PROPER: hero + rail, and DELIBERATELY NOT the
	// grid below it. This ref is the arrow keys' entire scope boundary; see the
	// key effect for why the region had to become explicit.
	const controlsRef = useRef<HTMLDivElement>(null);
	// CS14 §2 — the hero market panel's own `<Link>`, so an arrow rotation can
	// hand focus to the market it just revealed.
	const heroLinkRef = useRef<HTMLAnchorElement>(null);

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
	// ⛔⛔ CS14 §1 — SCOPE IS WHERE FOCUS IS, AND THE TWO AXES ARE SPLIT.
	//
	// CS13 hung a React handler on the section and let the keydown's own bubble
	// path answer "is focus inside the carousel". That path CANNOT express this
	// ruling, for one structural reason: `DiscoveryGrid` renders INSIDE the same
	// section, so a focused grid card was inside the scope and rotated the hero.
	// Measured on staging before this change — grid card focused, real
	// ArrowRight: "Claude · Will an official " → "Bitcoin · Will BTC ever go".
	// The founder ruled a grid card must NOT rotate, so the region became
	// explicit (`controlsRef` — hero + rail, grid EXCLUDED) and is tested
	// against `document.activeElement` rather than against the event's path.
	//
	// ⚠ A REF, NOT A `closest()` STRING. The ref IS the node, so it cannot drift
	// from the DOM it describes the way a selector can (O-1: structural beats
	// procedural). This keeps CS13's actual property — the scope is a real
	// element, not a description of one — while moving the boundary.
	//
	// THE TWO AXES ARE NOT SYMMETRIC, AND THE ASYMMETRY IS THE POINT:
	//
	//   Left / Right answer when focus is inside the carousel OR when NOTHING
	//     has claimed focus. This is the ENTRY GESTURE — on a cold page load
	//     `activeElement` is `<body>`, so the arrows work without the viewer
	//     first having to find and click a control. It costs nothing: the
	//     surface has no horizontal overflow, so no scroll is being taken.
	//
	//   ⛔⛔ Up / Down answer ONLY when focus is inside the carousel. THESE ARE
	//     THE PAGE'S SCROLL KEYS. Answering them from body-focus would mean a
	//     reader who lands on Discovery and presses Down to scroll gets a market
	//     rotation instead, with nothing on screen explaining why. They are
	//     never bound at document level.
	//
	// Focus on ANY element outside the region — a grid card, a header control, a
	// text field — answers nothing on either axis.
	//
	// ⚠ DIVERGES FROM THE MOCKUP, DELIBERATELY. `:477-479` binds all four keys
	// to the document unconditionally. Reported to the founder rather than
	// amended — the mockup and design-canon are read-only to this lane.
	useEffect(() => {
		if (n <= 1) {
			return;
		}
		const onKey = (e: globalThis.KeyboardEvent) => {
			// Up/Left step BACK, Down/Right step FORWARD. Up-and-Left agreeing is
			// what makes the pair predictable in a horizontal strip that is also a
			// vertical list of one market at a time.
			const back = e.key === "ArrowLeft" || e.key === "ArrowUp";
			const forward = e.key === "ArrowRight" || e.key === "ArrowDown";
			if (!back && !forward) {
				return;
			}
			const el = document.activeElement as HTMLElement | null;
			// Never steal the arrows from a field the viewer is typing in — a
			// caret moving inside it must not also rotate the hero.
			const tag = el?.tagName;
			if (tag === "INPUT" || tag === "TEXTAREA" || el?.isContentEditable) {
				return;
			}
			const inside = el !== null && controlsRef.current?.contains(el) === true;
			// "Nothing has claimed focus" — a cold load parks `activeElement` on
			// `<body>`; `null` is the same state, defensively.
			const unclaimed = el === null || el === document.body;
			const horizontal = e.key === "ArrowLeft" || e.key === "ArrowRight";
			if (!inside && !(horizontal && unclaimed)) {
				return;
			}
			// preventDefault ONLY on the branch that actually consumes the key.
			// Every early return above leaves the page's own scrolling alone,
			// which is the whole reason the guards come first.
			e.preventDefault();
			setActive((i) => (i + (back ? -1 : 1) + n) % n);
			// ⛔ CS14 §2 — HAND FOCUS TO THE MARKET THE ROTATION JUST REVEALED.
			// Enter then opens THAT market, natively, because the panel is a real
			// <Link> — no Enter handler exists anywhere on this section and none
			// is to be added. Before this, focus stayed on the `‹ ›` button that
			// caused the rotation, so Enter re-activated the button and advanced
			// again; the button was behaving correctly and focus simply had
			// nowhere better to be.
			//
			// ⚠ Only ARROW rotations move focus. The 10s auto-advance must not —
			// stealing focus from a reader on a timer is its own defect, and the
			// timer lives in a separate effect precisely so it cannot.
			//
			// ⚠ `preventScroll` because a focus move that scrolls the page on
			// every arrow press is also its own defect. The <a> node survives the
			// re-render (same element, same position — React updates its href in
			// place), so focusing it here rather than in an effect is safe and
			// keeps "arrow-driven" distinguishable from "timer-driven".
			heroLinkRef.current?.focus({ preventScroll: true });
		};
		document.addEventListener("keydown", onKey);
		return () => document.removeEventListener("keydown", onKey);
		// `setActive`'s functional form means the countdown-resetting `active`
		// is NOT a dependency here — the listener is attached once per market
		// count rather than re-attached on every rotation.
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
		// ⛔ CS14 §1 — THE KEY HANDLER NO LONGER HANGS HERE. It is a document
		// listener scoped by `controlsRef` (see the effect above), because this
		// element contains the GRID as well as the carousel, and the two now
		// need different answers to the same keypress.
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
		>
			{/* ⛔ CS14 §1 — THE SCOPE REGION, AND IT GENERATES NO BOX.
			    `display:contents` (Tailwind's `contents`) keeps this div a real
			    node in the DOM TREE — which is all `contains()` and event
			    bubbling need — while generating no layout box of its own, so
			    its children stay direct flex items of the `<section>` and the
			    hero's `flex-1` and the rail's `flex-none` resolve exactly as
			    they did before. The grid stays OUTSIDE it. Drawing that
			    boundary is the only reason this element exists; it introduces
			    no size, no spacing and no paint. */}
			<div
				ref={controlsRef}
				data-testid="carousel-controls"
				className="contents"
			>
				<HeroPanels
					card={view.card}
					series={view.series}
					topPosts={view.topPosts}
					linkRef={heroLinkRef}
					isOpen={view.isOpen}
				/>

				{/* HTML-FINISH row 8 — the rail is FIXED height and takes no share of
				    the slack: the mockup's `.sliderwrap` is `flex:0 0 18px` (`:139`).
				    The 18px was already shipped; `flex-none` is what makes it refuse
				    to grow now that there is slack to be had. */}
				{/* MOBILE-1 Phase A — hides WITH the hero below 640px, never
				    independently of it. This rail's whole job is navigating
				    `HeroPanels`, which the founder ruled hidden at phone width
				    (its own comment carries the ruling and why it answers the
				    @code-reviewer objection rather than waiving it); a rail left
				    behind would be eight dots and two arrows steering a panel
				    that is not on screen. Above 640px both render exactly as
				    before — the two are pinned together in
				    discovery-mobile-reflow.test.ts so neither can hide alone. */}
				<div
					data-testid="carousel-rail"
					className="mt-[9px] mb-2 flex h-[18px] flex-none items-center justify-center gap-[7px] max-mobile:hidden"
				>
					{/* ⛔ CS14 §3 — THESE TWO CARRY THE RATIFIED FOCUS IDIOM NOW, AND
					    WHAT THEY HAD BEFORE WAS NOT `:focus`. Measured on staging at
					    `0f04272`, real mouse click on `›`: `:focus` true,
					    `:focus-visible` FALSE, computed `outline-style: none` and
					    `box-shadow: none` — nothing painted on a click, then or now.
					    The bright ring arrives one keystroke LATER: press an arrow
					    afterwards and Chrome's focus-visible modality flips on the
					    ALREADY-focused button, painting its UA `outline: auto` ring.
					    These were the only focusables in the participant tree with no
					    focus class at all, so they fell through to that UA default
					    instead of `--state-focus-ring`.
					    ⛔ THE INDICATOR IS NOT REMOVED — A11Y.0's floor is visible
					    focus, and these buttons may be the only keyboard path through
					    the hero. `outline-none` +
					    `focus-visible:shadow-(--state-focus-ring)` is the exact pair
					    already on 19 other focusables, `ScrollRail`'s chevrons
					    included — same role, same `text-n4`/`hover:text-ink`, and
					    likewise unrounded. No new colour and no new token. */}
					{n > 1 && (
						<button
							type="button"
							aria-label="Previous market"
							onClick={() => setActive((i) => (i - 1 + n) % n)}
							className="px-[9px] font-mono text-base text-n4 outline-none hover:text-ink focus-visible:shadow-(--state-focus-ring)"
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
							className="px-[9px] font-mono text-base text-n4 outline-none hover:text-ink focus-visible:shadow-(--state-focus-ring)"
						>
							›
						</button>
					)}
				</div>
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
