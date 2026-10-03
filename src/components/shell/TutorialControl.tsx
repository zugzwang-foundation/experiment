"use client";

import { Pointer } from "lucide-react";
import { useRouter } from "next/navigation";
import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { cn } from "@/lib/utils";

import { HEADER_PILL_BUTTON } from "./header-control";
import { isFirstStepOfChapter, TUTORIAL_STEPS } from "./tutorial-steps";

/**
 * The header's "Tutorial" control and the spotlight overlay it opens.
 *
 * Manual-trigger only — nothing here auto-shows on first visit and nothing
 * writes a "seen" marker; every open starts at step 0, and `start()` also
 * forces navigation to Discovery first, whatever page the header button was
 * clicked from — a fixed starting point rather than resuming wherever the
 * viewer happened to be. The button and the overlay share one `useState` in
 * this file, mirroring `RulesControl` → `OnboardingDeck`'s shape, but the
 * overlay itself is bespoke: it highlights real, live controls in place
 * (blurred surround + a ring, never an opaque modal), so a Radix `Dialog` is
 * the wrong primitive here.
 *
 * The target element under the spotlight is never covered by anything —
 * only `pointer-events-none` decoration surrounds it — so a viewer can
 * always tap the real control underneath, and Next also drives Bet YES/NO,
 * Support and Counter itself now (`isClickable` below). The earlier design
 * left those three un-automated outright, reasoning that whether one is
 * `disabled` depends on the viewer's own open positions and a blind click
 * could silently do nothing — true, but the fix for a blind click is to stop
 * clicking blind, not to stop clicking. `isClickable` checks `disabled` /
 * `aria-disabled` immediately before dispatching, so a click is only ever
 * sent to a control that will actually do something; a genuinely disabled
 * one is left alone and the tour still advances. Position Sell stays a real,
 * viewer-only tap — see `tutorial-steps.ts`'s `advance` docs.
 *
 * The finder effect below also looks one to two steps AHEAD whenever the
 * current step's own target goes missing: if the viewer taps the real
 * control themselves before Next gets to it, or a click's effect (the
 * composer opening, the reply box appearing) hasn't painted yet on the very
 * next poll, the step just ahead is what's actually on screen, and the tour
 * follows them there rather than sitting on a stale target. This is what
 * keeps the blurred backdrop matching whatever page or state is actually
 * live. It only runs at the FRONTIER this run has actually reached
 * (`maxReachedIndexRef`), never while reviewing an earlier step via Back —
 * otherwise a step whose target only exists with some transient state (a
 * composer left open) reads as "missing" the moment Back lands on it, and
 * look-ahead would re-match the step just LEFT and silently snap Back right
 * back to where it started.
 *
 * Two more things keep the overlay from ever showing a hollow "nothing to
 * point at" card for state that was simply never going to resolve — both
 * live in `tick()`'s own not-found branch, not in `back()` itself: a
 * one-shot DOM check made synchronously inside a click handler can race an
 * in-flight navigation and catch the page mid-transition, which is exactly
 * what reading it back polling-driven instead avoids. While reviewing
 * below the frontier, once a step's target has had a full grace window to
 * appear and still hasn't, the tour keeps walking back on its own — a
 * composer the viewer had open doesn't survive the page remount a return
 * from "Your profile" causes, and no amount of further waiting fixes that,
 * so it lands on something real instead of parking on each dead step in
 * turn. And that same grace window (`navGrace`) suppresses the "not found"
 * wording right after a page jump this component drove itself — the step
 * index now advances the instant Next is pressed, but the destination page
 * still takes a beat to actually load, so without the window every
 * navigation flashed the message for one frame before the real target
 * caught up.
 *
 * The word-by-word text reveal below needs `@keyframes` Tailwind has no
 * utility for — the same situation `src/components/art/warli/` is in, and
 * this file follows its precedent exactly: a component-scoped `<style>`
 * tag, names prefixed (`zzt-`) to stay collision-free, used nowhere else in
 * this component's own styling. `prefers-reduced-motion` is honoured in
 * JS, not only CSS — `PhoneSheet`'s reasoning applies here too.
 */

const FIND_TIMEOUT_MS = 10_000;
const POLL_MS = 250;
const SPOTLIGHT_PADDING = 6;
/** Cadence of the auto-scroll on feed steps. */
const AUTO_SCROLL_MS = 1400;
/**
 * How long after a tour-driven `router.push` the "not found" wording stays
 * suppressed. Not a pause on the navigation itself — the step index still
 * advances instantly — just a grace window for the destination page to
 * actually finish loading before the finder's own "nothing to point at"
 * message is allowed to show.
 */
const NAV_GRACE_MS = 900;

type Placement = { top: number; left: number; width: number; height: number };

function queryEl(selector: string): HTMLElement | null {
	try {
		const el = document.querySelector(selector);
		return el instanceof HTMLElement ? el : null;
	} catch {
		return null;
	}
}

function rectOf(el: HTMLElement): DOMRect | null {
	const r = el.getBoundingClientRect();
	return r.width === 0 && r.height === 0 ? null : r;
}

/**
 * The FIRST clickable match for a selector, or `null` if every match is
 * disabled — deliberately never falls back to a disabled element, since the
 * caller (`next()`) clicks whatever this returns. `data-tutorial="buy-
 * button"` renders once per column (YES and NO both mount their own
 * `SlotHeader`), so a viewer already holding one side has the OTHER
 * column's Buy `disabled` while their own stays clickable; a bare
 * `querySelector` can land on the wrong one and read as "did nothing".
 */
function firstClickable(selector: string): HTMLElement | null {
	try {
		for (const candidate of document.querySelectorAll(selector)) {
			if (candidate instanceof HTMLElement && isClickable(candidate)) {
				return candidate;
			}
		}
	} catch {
		return null;
	}
	return null;
}

/**
 * Whether a real click on this control would actually do anything.
 * `SlotHeader`'s Bet toggle and `TriggerPill`'s Support/Counter pills all go
 * `disabled` (native `disabled` or `aria-disabled`) depending on the
 * viewer's own open positions — the exact reason a click here was never
 * dispatched blind. Checking this first is what makes a click SAFE to
 * dispatch: it can no longer silently no-op, so the tour can drive it.
 */
function isClickable(el: HTMLElement): boolean {
	if (el instanceof HTMLButtonElement && el.disabled) {
		return false;
	}
	return el.getAttribute("aria-disabled") !== "true";
}

function rectToPlacement(r: DOMRect): Placement {
	return { top: r.top, left: r.left, width: r.width, height: r.height };
}

/**
 * Finds the step's target(s) and returns each as its OWN box. When
 * `selectorSecondary` is given (Support + Counter, explained as a pair) the
 * two real elements stay two separate boxes rather than one merged rect —
 * a single box spanning both ends up spotlighting the split bar and the
 * staked figure sitting BETWEEN them too, which this step never explains.
 * The primary element is still the one `advance` reads a `href` from, when
 * a step needs that.
 *
 * `requiresSelector`, when given, must ALSO resolve to something or the
 * whole step counts as not-found — even though `selector` itself matched.
 * This is for a container that renders regardless of whether it has real
 * content (the positions panel keeps its own section, with "No positions
 * yet" drawn inside, rather than disappearing): without this check, an
 * empty panel would highlight as if it had something to show.
 */
function measure(
	selector: string,
	selectorSecondary?: string,
	requiresSelector?: string,
): { placements: Placement[]; primaryEl: HTMLElement } | null {
	const primaryEl = queryEl(selector);
	if (!primaryEl) {
		return null;
	}
	if (requiresSelector && !queryEl(requiresSelector)) {
		return null;
	}
	const primaryRect = rectOf(primaryEl);
	if (!primaryRect) {
		return null;
	}
	const placements = [rectToPlacement(primaryRect)];

	if (selectorSecondary) {
		const secondaryEl = queryEl(selectorSecondary);
		const secondaryRect = secondaryEl ? rectOf(secondaryEl) : null;
		if (secondaryRect) {
			placements.push(rectToPlacement(secondaryRect));
		}
	}

	return { placements, primaryEl };
}

function useReducedMotion(): boolean {
	const [reduced, setReduced] = useState(false);
	useEffect(() => {
		const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
		setReduced(mq.matches);
		function onChange(e: MediaQueryListEvent) {
			setReduced(e.matches);
		}
		mq.addEventListener("change", onChange);
		return () => mq.removeEventListener("change", onChange);
	}, []);
	return reduced;
}

export function TutorialControl({
	mobileResponsive = false,
}: {
	mobileResponsive?: boolean;
}) {
	const [open, setOpen] = useState(false);
	const [stepIndex, setStepIndex] = useState(0);
	const [placements, setPlacements] = useState<Placement[] | null>(null);
	const [timedOut, setTimedOut] = useState(false);
	/** True for `NAV_GRACE_MS` after this component's own `router.push`,
	 *  suppressing the "nothing to point at" wording while the destination
	 *  page is still loading. See the file docblock. */
	const [navGrace, setNavGrace] = useState(false);
	const lastNavAtRef = useRef(0);
	const searchStartedAt = useRef(0);
	/**
	 * The furthest step index this run has reached under its own forward
	 * progress (Next, or the finder's look-ahead catching a real user
	 * action). Back lowers `stepIndex` below this without ever lowering the
	 * mark itself — `tick()` below reads the gap to tell "reviewing an
	 * earlier step on purpose" apart from "sitting at the frontier waiting
	 * for the real page to catch up", which is the only thing look-ahead
	 * should ever fire during. See `tick()`'s own comment for why this
	 * matters.
	 */
	const maxReachedIndexRef = useRef(0);
	const reducedMotion = useReducedMotion();
	const router = useRouter();
	/** The current step's own target `href`, live while it's nav-relevant. */
	const capturedHrefRef = useRef<string | null>(null);
	/** Banked from the "Get oriented" identity-chip step, spent once — on
	 *  entering "Your profile". Cleared on close so a re-run captures fresh. */
	const profileHrefRef = useRef<string | null>(null);
	/**
	 * The market page's own URL, captured the instant `next()` spends
	 * `profileHrefRef` to push into "Your profile" — the one piece of state
	 * `back()` needs to reverse that specific navigation later. Discovery
	 * needs no equivalent ref: `start()` always lands there first, so it's
	 * always just `"/"`.
	 */
	const marketHrefRef = useRef<string | null>(null);
	/**
	 * The market page's URL (with its querystring) captured the instant
	 * before `next()` dispatches the real Support/Counter click — entering
	 * post-focus pushes a `?post=` history entry (RPLY-1 R2), a real
	 * navigation exactly like the other two even though nothing here
	 * triggered it directly. Read by `back()` leaving "reply-target-post".
	 */
	const preFocusHrefRef = useRef<string | null>(null);

	const step = TUTORIAL_STEPS[stepIndex];
	const isFirst = stepIndex === 0;
	const isLast = stepIndex === TUTORIAL_STEPS.length - 1;

	const close = useCallback(() => {
		setOpen(false);
	}, []);

	/** Call right alongside any `router.push` this component drives itself. */
	function markNavigated() {
		lastNavAtRef.current = Date.now();
		setNavGrace(true);
	}

	// Find and track the current step's target(s). Re-runs on every step
	// change; polls rather than using a MutationObserver because the
	// targets this points at come and go across real navigations and a
	// composer opening, not from a subtree this component owns.
	useEffect(() => {
		if (!open) {
			return;
		}
		setPlacements(null);
		setTimedOut(false);
		capturedHrefRef.current = null;
		searchStartedAt.current = Date.now();
		if (stepIndex > maxReachedIndexRef.current) {
			maxReachedIndexRef.current = stepIndex;
		}
		// True only while sitting at the frontier this run has actually
		// reached — false while reviewing an earlier step via Back. Safe to
		// capture once here rather than inside `tick()`: neither operand can
		// change for the rest of this effect's lifetime, since any change to
		// `stepIndex` tears this effect down and starts a fresh one.
		const atFrontier = stepIndex === maxReachedIndexRef.current;

		// Look-ahead: if THIS step's target has gone missing, check whether a
		// step just ahead is already on screen instead — the viewer took the
		// real action themselves (tapped the real Bet button, the real
		// Support/Counter pill) rather than waiting on the tour's own Next.
		// Following them there is what keeps the blurred backdrop matching
		// whatever page/state is actually live, instead of sitting on a stale
		// target until the viewer notices and clicks through manually. Capped
		// at two steps so an unrelated coincidental match elsewhere can't
		// vault the tour forward by more than one real user action's worth.
		//
		// Gated on `atFrontier`: this used to run unconditionally, which made
		// it fire just as eagerly after an intentional Back press as after a
		// genuine forward jump — reported live, leaving "Your profile" drops
		// the reply composer's own open/closed state on the page remount, so
		// stepping back into "friendly-fire" or "reply-composer-ack" finds
		// neither target, look-ahead "helpfully" re-matches the step just
		// LEFT (whose target, the post-focus arena, is still genuinely on
		// screen), and Back gets silently overridden back to where it started
		// — every press. Look-ahead's whole job is catching the viewer ahead
		// of the tour's own Next; it was never meant to second-guess a Back
		// the viewer just pressed on purpose, so it now only runs at the
		// frontier this run has actually reached under its own forward
		// progress.
		function findAhead(): number | null {
			for (let lookAhead = 1; lookAhead <= 2; lookAhead++) {
				const aheadIndex = stepIndex + lookAhead;
				if (aheadIndex >= TUTORIAL_STEPS.length) {
					break;
				}
				const aheadStep = TUTORIAL_STEPS[aheadIndex];
				if (
					measure(
						aheadStep.selector,
						aheadStep.selectorSecondary,
						aheadStep.requiresSelector,
					)
				) {
					return aheadIndex;
				}
			}
			return null;
		}

		function tick() {
			const found = measure(
				step.selector,
				step.selectorSecondary,
				step.requiresSelector,
			);
			if (found) {
				setPlacements(found.placements);
				setTimedOut(false);
				setNavGrace((g) => (g ? false : g));
				if (
					step.advance === "navigate-now" ||
					step.advance === "bank-profile"
				) {
					const href = found.primaryEl.getAttribute("href");
					if (href) {
						capturedHrefRef.current = href;
						if (step.advance === "bank-profile") {
							profileHrefRef.current = href;
						}
					}
				}
				return;
			}
			if (atFrontier) {
				const aheadIndex = findAhead();
				if (aheadIndex !== null) {
					setStepIndex(aheadIndex);
					return;
				}
			} else if (
				stepIndex > 0 &&
				Date.now() - lastNavAtRef.current > NAV_GRACE_MS
			) {
				// Reviewing a step below the frontier, and its target has
				// now had a full grace window to appear and still hasn't —
				// a composer the viewer had open doesn't survive the page
				// remount a return from "Your profile" causes, and no
				// further waiting fixes that. Keep walking back exactly as
				// another Back press would, polling-driven rather than a
				// one-shot DOM check at click time (which can race an
				// in-flight navigation and read stale content — reported
				// live: Back from "existing replies" landing on
				// "reply-composer-ack" instead of skipping past it, because
				// a synchronous check made at the click itself caught the
				// page mid-transition). This keeps re-checking every poll
				// until it lands on something real or reaches index 0.
				setStepIndex((i) => Math.max(i - 1, 0));
				return;
			}
			setPlacements(null);
			if (Date.now() - lastNavAtRef.current > NAV_GRACE_MS) {
				setNavGrace((g) => (g ? false : g));
			}
			if (Date.now() - searchStartedAt.current > FIND_TIMEOUT_MS) {
				setTimedOut(true);
			}
		}

		tick();
		const interval = window.setInterval(tick, POLL_MS);
		window.addEventListener("scroll", tick, true);
		window.addEventListener("resize", tick);
		return () => {
			window.clearInterval(interval);
			window.removeEventListener("scroll", tick, true);
			window.removeEventListener("resize", tick);
		};
	}, [
		open,
		step.selector,
		step.selectorSecondary,
		step.requiresSelector,
		step.advance,
		stepIndex,
	]);

	// Feed steps: click the feed's own Next arrow on a timer so the cards
	// scroll one after another, like someone reading. Starts only once the
	// spotlight has found its target.
	const autoScrollSelector = step.autoScrollSelector;
	const hasPlacements = placements !== null;
	useEffect(() => {
		if (!open || !autoScrollSelector || !hasPlacements || reducedMotion) {
			return;
		}
		const id = window.setInterval(() => {
			const btn = queryEl(autoScrollSelector);
			if (btn && isClickable(btn)) {
				btn.click();
			}
		}, AUTO_SCROLL_MS);
		return () => window.clearInterval(id);
	}, [open, autoScrollSelector, hasPlacements, reducedMotion]);

	/**
	 * The tour always starts from Discovery, whatever page the header button
	 * was clicked from — a fixed, well-known starting point rather than
	 * playing out whatever happens to be on screen. `start()` still resets
	 * and opens immediately so the overlay appears without delay; the finder
	 * effect above simply won't find step 0's Discovery-only targets until
	 * the navigation lands, which is exactly what its own poll-and-wait
	 * already handles.
	 */
	function start() {
		profileHrefRef.current = null;
		maxReachedIndexRef.current = 0;
		setStepIndex(0);
		setOpen(true);
		if (window.location.pathname !== "/") {
			markNavigated();
			router.push("/");
		}
	}

	/** Pushes and advances together, immediately — no artificial pause. */
	function navigateAndAdvance(href: string, nextIndex: number) {
		markNavigated();
		router.push(href);
		setStepIndex(nextIndex);
	}

	/**
	 * The tour drives its own page transitions rather than waiting for the
	 * viewer to find the next control themselves — Next is what "slides"
	 * them from Discovery to a market and, later, to their own profile,
	 * using the real Next.js router against the real href of whatever the
	 * spotlight is already highlighting. A `"click"` step dispatches a real
	 * click too, INCLUDING on Bet/Support/Counter now — the thing that made
	 * those unsafe to automate was never "it's a bet", it was that a click on
	 * a `disabled` one silently does nothing, and `isClickable` closes that
	 * gap directly rather than by avoiding the click altogether. `clickSelector`
	 * is tried first; if it's missing or disabled, `selectorSecondary` (the
	 * paired Counter pill) is tried next, so a viewer holding the opposite
	 * side still gets driven through whichever one is actually open to them.
	 */
	function next() {
		if (step.advance === "click") {
			// Captured before the click fires, not after — a real Support/
			// Counter click pushes the `?post=` entry synchronously, so "after"
			// would already be the destination.
			if (step.id === "support-counter-pair") {
				preFocusHrefRef.current =
					window.location.pathname + window.location.search;
			}
			const clickSelector = step.clickSelector ?? step.selector;
			let target: HTMLElement | null;
			if (step.selectorSecondary) {
				// A PAIRED step (Support/Counter): resolve within the exact pair
				// `measure()` is spotlighting, never a page-wide scan — every post
				// on screen carries its own Support/Counter, so scanning the whole
				// page for "any clickable one" could click a pill on a completely
				// different post than the one actually highlighted, which is worse
				// than not clicking at all. At most one of the two is ever disabled
				// here (I-SINGLE-SIDE-001: a viewer holds at most one side, and
				// Support/Counter resolve to opposite sides) — both disabled only
				// on the viewer's own post, where neither should click.
				const primary = queryEl(clickSelector);
				const secondary = queryEl(step.selectorSecondary);
				target =
					primary && isClickable(primary)
						? primary
						: secondary && isClickable(secondary)
							? secondary
							: null;
			} else {
				// An UNPAIRED step (Buy): the same control can render once per
				// column with no shared container to scope a fallback against, so
				// scanning every match for the first clickable one is the only way
				// to reach the viewer's own open side when the other column's is
				// disabled.
				target = firstClickable(clickSelector);
			}
			target?.click();
		}
		if (isLast) {
			close();
			return;
		}
		const nextIndex = Math.min(stepIndex + 1, TUTORIAL_STEPS.length - 1);
		const enteringProfile =
			isFirstStepOfChapter(nextIndex) &&
			TUTORIAL_STEPS[nextIndex].chapter === "Your profile";

		// Both of these are real page navigations, not just a step change —
		// pushed and advanced together, immediately. Not needed for
		// `advance: "click"` above, which never leaves the current page.
		if (step.advance === "navigate-now" && capturedHrefRef.current) {
			navigateAndAdvance(capturedHrefRef.current, nextIndex);
			return;
		}
		if (enteringProfile) {
			// Re-read live rather than trusting only the href banked back at
			// "identity-chip" (`profileHrefRef`): `IdentityCluster` is part of
			// `GlobalHeader`, mounted on every page this tour ever reaches, so
			// a fresh query here is just as cheap and isn't at the mercy of
			// whatever kept that early bank from landing. Reported live: the
			// banked ref came up empty often enough that Next silently fell
			// through to a step-index bump with NO navigation, stranding the
			// viewer on whatever page they were already on while the hint
			// card jumped straight to "Your profile" — the live query is the
			// fix, the stale ref is kept only as a last-resort fallback.
			const profileHref =
				queryEl('[data-testid="identity-chip-link"]')?.getAttribute("href") ??
				profileHrefRef.current;
			if (profileHref) {
				marketHrefRef.current =
					window.location.pathname + window.location.search;
				navigateAndAdvance(profileHref, nextIndex);
				return;
			}
		}
		setStepIndex(nextIndex);
	}

	/**
	 * Leaving a step that was ITSELF only reachable by a page navigation
	 * (Discovery -> a market, the banked profile href, or the `?post=` entry
	 * a real Support/Counter click pushes) means Back has to undo that
	 * navigation too, not just move the step index — otherwise it leaves the
	 * step index pointing at a step whose target only exists on the page the
	 * viewer just left. `router.back()` was tried first and doesn't hold up:
	 * it depends on the exact shape of the browser's own history stack,
	 * which this tour doesn't fully control (another `router.push`/`replace`
	 * elsewhere in the app, a manual navigation, reordered entries). Pushing
	 * a KNOWN origin instead removes that dependency entirely — Discovery is
	 * always `"/"` (`start()`'s own guarantee), and the other two origins
	 * are captured into their own refs at the exact moment `next()` leaves
	 * them, so there is never any ambiguity about where "back" means.
	 */
	function back() {
		if (step.enteredViaNavigation) {
			const origin =
				step.chapter === "Your profile"
					? marketHrefRef.current
					: step.chapter === "Support & Counter"
						? preFocusHrefRef.current
						: "/";
			if (origin) {
				markNavigated();
				router.push(origin);
			}
		}
		// Always a single, plain step back — a functional update, so a
		// click handler fired from a stale render can't under- or
		// over-shoot. Walking past any FURTHER dead step (composer-local
		// state that didn't survive getting here) is the finder effect's
		// job, not this click's: a DOM check made synchronously here can
		// race an in-flight navigation and read stale content, where the
		// same check made from the poll a moment later reliably doesn't.
		// See `tick()`'s `atFrontier` branch.
		setStepIndex((i) => Math.max(i - 1, 0));
	}

	// Escape always closes; ArrowRight/ArrowLeft drive Next/Back while the
	// tour is open, matching the reference mockup's keyboard support. Bound
	// only while open and re-bound each render (next/back close over
	// step-dependent state, so there is no stable version to memoize) — the
	// same cleanup discipline `composer-open-store.ts` documents applies:
	// nothing here is left attached past close.
	useEffect(() => {
		if (!open) {
			return;
		}
		function onKey(e: KeyboardEvent) {
			if (e.key === "Escape") {
				close();
			} else if (e.key === "ArrowRight") {
				e.preventDefault();
				next();
			} else if (e.key === "ArrowLeft" && !isFirst) {
				e.preventDefault();
				back();
			}
		}
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	});

	return (
		<>
			<button
				type="button"
				onClick={start}
				title="Take a guided tour of how markets and bets work here"
				className={cn(
					HEADER_PILL_BUTTON,
					mobileResponsive && "max-mobile:hidden",
				)}
			>
				Tutorial
			</button>
			{open ? (
				<>
					<style>{TUTORIAL_KEYFRAMES}</style>
					<TutorialOverlay
						stepNumber={stepIndex + 1}
						stepCount={TUTORIAL_STEPS.length}
						chapter={step.chapter}
						text={step.text}
						referenceImage={step.referenceImage}
						placements={placements}
						showSpotlight={!timedOut}
						suppressNotFound={navGrace}
						reducedMotion={reducedMotion}
						isFirst={isFirst}
						isLast={isLast}
						onBack={back}
						onNext={next}
						onSkip={close}
					/>
				</>
			) : null}
		</>
	);
}

function TutorialOverlay({
	stepNumber,
	stepCount,
	chapter,
	text,
	referenceImage,
	placements,
	showSpotlight,
	suppressNotFound,
	reducedMotion,
	isFirst,
	isLast,
	onBack,
	onNext,
	onSkip,
}: {
	stepNumber: number;
	stepCount: number;
	chapter: string;
	text: string;
	referenceImage?: string;
	placements: Placement[] | null;
	showSpotlight: boolean;
	/** True briefly right after this component's own navigation — see
	 *  `NAV_GRACE_MS`. Keeps "not found" wording off screen while the
	 *  destination page is still loading. */
	suppressNotFound: boolean;
	reducedMotion: boolean;
	isFirst: boolean;
	isLast: boolean;
	onBack: () => void;
	onNext: () => void;
	onSkip: () => void;
}) {
	const hasTarget =
		showSpotlight && placements !== null && placements.length > 0;
	const boxes: Placement[] | null =
		hasTarget && placements
			? placements.map((p) => ({
					top: p.top - SPOTLIGHT_PADDING,
					left: p.left - SPOTLIGHT_PADDING,
					width: p.width + SPOTLIGHT_PADDING * 2,
					height: p.height + SPOTLIGHT_PADDING * 2,
				}))
			: null;
	// A box across every real box, used ONLY to float the hint card near the
	// group — never drawn as a highlight. That distinction is the whole
	// fix: Support and Counter each keep their own tight ring, so the split
	// bar and the staked figure sitting between them stay dimmed instead of
	// getting swept into one merged spotlight.
	const unionBox: Placement | null = boxes?.length
		? boxes.reduce((acc, b) => {
				const left = Math.min(acc.left, b.left);
				const top = Math.min(acc.top, b.top);
				const right = Math.max(acc.left + acc.width, b.left + b.width);
				const bottom = Math.max(acc.top + acc.height, b.top + b.height);
				return { left, top, width: right - left, height: bottom - top };
			})
		: null;

	return (
		<div
			role="dialog"
			aria-modal="true"
			aria-label="Product tutorial"
			className="fixed inset-0 z-50"
		>
			{boxes ? (
				<>
					<DimPanels boxes={boxes} />
					{boxes.map((box) => (
						<div
							key={`${box.top}-${box.left}`}
							aria-hidden="true"
							className="pointer-events-none fixed rounded-lg border-2 border-n7 shadow-[0_0_0_4px_rgba(228,228,228,0.15)]"
							style={{
								top: box.top,
								left: box.left,
								width: box.width,
								height: box.height,
							}}
						/>
					))}
					<TutorialHand
						box={boxes[boxes.length - 1]}
						reducedMotion={reducedMotion}
					/>
				</>
			) : (
				<div className="fixed inset-0 bg-black/70 backdrop-blur-[2px]" />
			)}
			<HintCard
				box={unionBox}
				stepNumber={stepNumber}
				stepCount={stepCount}
				chapter={chapter}
				text={text}
				notFoundHint={!hasTarget && !suppressNotFound}
				referenceImage={referenceImage}
				reducedMotion={reducedMotion}
				isFirst={isFirst}
				isLast={isLast}
				onBack={onBack}
				onNext={onNext}
				onSkip={onSkip}
			/>
		</div>
	);
}

/**
 * The dim + blur backdrop, with every real target rect cut clean out of it —
 * the same four-panel-around-one-box technique the single-target case
 * already used, generalized to a ROW of N boxes: top and bottom panels span
 * the full width above/below the whole row, and a panel sits left of the
 * first box, right of the last, and in each gap BETWEEN consecutive boxes.
 * None of these panels ever overlaps a box's own x-range, so nothing
 * highlighted gets dimmed regardless of how many boxes there are. Assumes
 * the boxes sit roughly in one horizontal row — true of every current use
 * (Support/Counter, side by side on a post) and of the single-box case,
 * where there are simply no gap panels to draw.
 */
function DimPanels({ boxes }: { boxes: Placement[] }) {
	const sorted = [...boxes].sort((a, b) => a.left - b.left);
	const overallTop = Math.min(...sorted.map((b) => b.top));
	const overallBottom = Math.max(...sorted.map((b) => b.top + b.height));
	const first = sorted[0];
	const last = sorted[sorted.length - 1];
	const panelClass = "fixed bg-black/60 backdrop-blur-[2px]";
	return (
		<>
			<div
				className={cn(panelClass, "inset-x-0 top-0")}
				style={{ height: Math.max(0, overallTop) }}
			/>
			<div
				className={cn(panelClass, "inset-x-0 bottom-0")}
				style={{ top: overallBottom }}
			/>
			<div
				className={panelClass}
				style={{
					top: overallTop,
					height: overallBottom - overallTop,
					left: 0,
					width: Math.max(0, first.left),
				}}
			/>
			<div
				className={panelClass}
				style={{
					top: overallTop,
					height: overallBottom - overallTop,
					left: last.left + last.width,
					right: 0,
				}}
			/>
			{sorted.slice(0, -1).map((box, i) => {
				const next = sorted[i + 1];
				const gapLeft = box.left + box.width;
				const gapWidth = next.left - gapLeft;
				if (gapWidth <= 0) {
					return null;
				}
				return (
					<div
						key={`${box.top}-${box.left}`}
						className={panelClass}
						style={{
							top: overallTop,
							height: overallBottom - overallTop,
							left: gapLeft,
							width: gapWidth,
						}}
					/>
				);
			})}
		</>
	);
}

/**
 * The moving pointer — glides to each highlighted control and rests on it
 * with a repeating tap ripple, so the tour reads as something actively
 * showing you where to look rather than a static ring. Anchored at the
 * spotlight box's bottom-right corner, like a fingertip about to tap it;
 * `transition-transform` animates the glide whenever `box` changes between
 * steps, since it's the same DOM node re-rendered at a new position rather
 * than a new element each time.
 */
function TutorialHand({
	box,
	reducedMotion,
}: {
	box: Placement;
	reducedMotion: boolean;
}) {
	const x = box.left + box.width - 10;
	const y = box.top + box.height - 10;
	return (
		<div
			aria-hidden="true"
			className={cn(
				"pointer-events-none fixed top-0 left-0 z-10 ease-out",
				!reducedMotion && "transition-transform duration-500",
			)}
			style={{ transform: `translate(${x}px, ${y}px)` }}
		>
			<span
				className={cn(
					"absolute inset-0 block size-8 rounded-full bg-n7/60",
					!reducedMotion && "animate-ping",
				)}
			/>
			<Pointer
				className="relative size-8 -translate-x-0.5 -translate-y-0.5 rotate-[-15deg] text-n7 drop-shadow-[0_2px_4px_rgba(0,0,0,0.7)]"
				strokeWidth={2.25}
			/>
		</div>
	);
}

function HintCard({
	box,
	stepNumber,
	stepCount,
	chapter,
	text,
	notFoundHint,
	referenceImage,
	reducedMotion,
	isFirst,
	isLast,
	onBack,
	onNext,
	onSkip,
}: {
	box: Placement | null;
	stepNumber: number;
	stepCount: number;
	chapter: string;
	text: string;
	notFoundHint: boolean;
	referenceImage?: string;
	reducedMotion: boolean;
	isFirst: boolean;
	isLast: boolean;
	onBack: () => void;
	onNext: () => void;
	onSkip: () => void;
}) {
	// Wider when showing a reference screenshot — 340px would shrink a full
	// profile screenshot to an illegible thumbnail. `box` is always null
	// alongside `notFoundHint` (see `TutorialOverlay`: `unionBox` only
	// exists when a target was found), so the wider card only ever applies
	// in the centered, no-target layout below — never fights for space
	// against a real spotlight box.
	const showingReference = notFoundHint && !!referenceImage;
	const CARD_WIDTH =
		showingReference && typeof window !== "undefined"
			? Math.min(640, window.innerWidth - 32)
			: showingReference
				? 640
				: 340;
	const CARD_HEIGHT_ESTIMATE = 230;
	const MARGIN = 16;

	let style: CSSProperties;
	if (!box || typeof window === "undefined") {
		style = {
			top: "50%",
			left: "50%",
			transform: "translate(-50%, -50%)",
			width: CARD_WIDTH,
		};
	} else {
		const vw = window.innerWidth;
		const vh = window.innerHeight;
		const spaceBelow = vh - (box.top + box.height);
		const placeBelow = spaceBelow > CARD_HEIGHT_ESTIMATE + MARGIN;
		const top = placeBelow
			? box.top + box.height + MARGIN
			: Math.max(MARGIN, box.top - CARD_HEIGHT_ESTIMATE - MARGIN);
		const left = Math.min(
			Math.max(MARGIN, box.left + box.width / 2 - CARD_WIDTH / 2),
			vw - CARD_WIDTH - MARGIN,
		);
		style = { top, left, width: CARD_WIDTH };
	}

	return (
		<div
			className="fixed z-20 rounded-lg border border-n2 bg-n0 p-4 text-ink shadow-(--elev-2)"
			style={style}
		>
			<div className="mb-2 flex items-center justify-between gap-3">
				<span className="text-[11px] font-bold tracking-[0.08em] text-muted-foreground uppercase">
					{chapter}
				</span>
				<span className="text-[11px] text-muted-foreground">
					{stepNumber} / {stepCount}
				</span>
			</div>
			<AnimatedText text={text} reducedMotion={reducedMotion} />
			{showingReference ? (
				<div className="mt-2">
					{/* biome-ignore lint/performance/noImgElement: a static local asset in a client component with no next/image boundary nearby — not worth the config for one illustrative screenshot */}
					<img
						src={referenceImage}
						alt="An example profile, populated with positions and arguments"
						className="w-full rounded-(--r) border border-n2"
					/>
					<p className="mt-2 text-[11px] leading-snug text-muted-foreground italic">
						Yours is empty for now — here's what it fills in with. Top left:
						your pseudonym and avatar. The four tiles beside it: wallet value,
						open positions' worth, profit or loss, and how many arguments you've
						posted. Below: every market you've bet on, each row's own Sell
						button — and on the right, the reply thread under whichever position
						you've selected.
					</p>
				</div>
			) : notFoundHint ? (
				<p className="mt-2 text-[11px] text-muted-foreground italic">
					Nothing here yet to point at — this part of the tour needs existing
					posts or bets, which a brand-new market may not have. Next still
					works.
				</p>
			) : null}
			<div className="mt-4 flex items-center justify-between gap-2">
				<button
					type="button"
					onClick={onSkip}
					className="text-[12px] text-muted-foreground hover:text-ink"
				>
					Skip tutorial
				</button>
				<div className="flex items-center gap-2">
					{!isFirst ? (
						<button
							type="button"
							onClick={onBack}
							className="inline-flex h-[30px] items-center gap-1 rounded-(--r) px-3 text-[12px] font-semibold [border:var(--hairline)] hover:[border:1px_solid_var(--ring)]"
						>
							Back
							<span aria-hidden="true" className="text-muted-foreground">
								←
							</span>
						</button>
					) : null}
					<button
						type="button"
						onClick={onNext}
						className="inline-flex h-[30px] items-center gap-1 rounded-(--r) bg-(--btn-fill) px-3 text-[12px] font-semibold text-ink [border:var(--hairline)] hover:[border:1px_solid_var(--ring)]"
					>
						{isLast ? "Done" : "Next"}
						{!isLast ? (
							<span aria-hidden="true" className="opacity-70">
								→
							</span>
						) : null}
					</button>
				</div>
			</div>
		</div>
	);
}

/** Word-by-word reveal, skipped in favor of the whole sentence at once under reduced motion. */
function AnimatedText({
	text,
	reducedMotion,
}: {
	text: string;
	reducedMotion: boolean;
}) {
	const words = useMemo(() => text.split(/(\s+)/), [text]);
	if (reducedMotion) {
		return <p className="text-[14px] leading-snug">{text}</p>;
	}
	return (
		<p className="text-[14px] leading-snug">
			{words.map((w, i) => (
				<span
					// biome-ignore lint/suspicious/noArrayIndexKey: the word list is derived fresh per render and never reordered
					key={i}
					className="zzt-word"
					style={{ animationDelay: `${Math.floor(i / 2) * 22 + 60}ms` }}
				>
					{w}
				</span>
			))}
		</p>
	);
}

const TUTORIAL_KEYFRAMES = `
@keyframes zzt-word-in {
  from { opacity: 0; transform: translateY(6px); filter: blur(3px); }
  to { opacity: 1; transform: none; filter: none; }
}
.zzt-word { display: inline-block; white-space: pre; animation: zzt-word-in 420ms cubic-bezier(.16,1,.3,1) both; }

@media (prefers-reduced-motion: reduce) {
  .zzt-word {
    animation: none !important;
  }
}
`;
