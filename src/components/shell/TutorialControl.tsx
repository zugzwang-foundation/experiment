"use client";

import { Pointer } from "lucide-react";
import { useRouter } from "next/navigation";
import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { cn } from "@/lib/utils";

import { HEADER_PILL_BUTTON } from "./header-control";
import {
	chapterNumberFor,
	isFirstStepOfChapter,
	TUTORIAL_CHAPTERS,
	TUTORIAL_STEPS,
	type TutorialGesture,
} from "./tutorial-steps";

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
 * live.
 *
 * The chapter-card wipe, the gesture scribbles and the word-by-word text
 * reveal below all need `@keyframes` Tailwind has no utility for — the same
 * situation `src/components/art/warli/` is in, and this file follows its
 * precedent exactly: a component-scoped `<style>` tag, names prefixed
 * (`zzt-`) to stay collision-free, used nowhere else in this component's
 * own styling. `prefers-reduced-motion` is honoured in JS, not only CSS —
 * `PhoneSheet`'s reasoning applies here too: a CSS-only mute would suppress
 * the motion and still leave every delay it was gating, so the reduced-
 * motion branch below skips the chapter-card timers entirely rather than
 * just playing them invisibly.
 */

const FIND_TIMEOUT_MS = 10_000;
const POLL_MS = 250;
const SPOTLIGHT_PADDING = 8;
const CHAPTER_HOLD_MS = 1300;
const CHAPTER_WIPE_MS = 420;

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
 */
function measure(
	selector: string,
	selectorSecondary?: string,
): { placements: Placement[]; primaryEl: HTMLElement } | null {
	const primaryEl = queryEl(selector);
	if (!primaryEl) {
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
	const [chapterPhase, setChapterPhase] = useState<"in" | "out" | null>(null);
	const searchStartedAt = useRef(0);
	const reducedMotion = useReducedMotion();
	const router = useRouter();
	/** The current step's own target `href`, live while it's nav-relevant. */
	const capturedHrefRef = useRef<string | null>(null);
	/** Banked from the "Get oriented" identity-chip step, spent once — on
	 *  entering "Your profile". Cleared on close so a re-run captures fresh. */
	const profileHrefRef = useRef<string | null>(null);

	const step = TUTORIAL_STEPS[stepIndex];
	const isFirst = stepIndex === 0;
	const isLast = stepIndex === TUTORIAL_STEPS.length - 1;
	const showingChapterCard = chapterPhase !== null;

	const close = useCallback(() => {
		setOpen(false);
	}, []);

	// The chapter title card, shown once per chapter change. Reduced-motion
	// skips the delay entirely rather than playing it invisibly — the
	// timers themselves are the thing being opted out of, not just the
	// animation classes.
	useEffect(() => {
		if (!open) {
			setChapterPhase(null);
			return;
		}
		if (reducedMotion || !isFirstStepOfChapter(stepIndex)) {
			setChapterPhase(null);
			return;
		}
		setChapterPhase("in");
		const toOut = window.setTimeout(
			() => setChapterPhase("out"),
			CHAPTER_HOLD_MS,
		);
		const toClear = window.setTimeout(
			() => setChapterPhase(null),
			CHAPTER_HOLD_MS + CHAPTER_WIPE_MS,
		);
		return () => {
			window.clearTimeout(toOut);
			window.clearTimeout(toClear);
		};
	}, [open, stepIndex, reducedMotion]);

	// Find and track the current step's target(s). Re-runs on every step
	// change; polls rather than using a MutationObserver because the
	// targets this points at come and go across real navigations and a
	// composer opening, not from a subtree this component owns. Runs
	// independently of the chapter card above — finding the target costs
	// nothing while that card is covering the screen, and it means the
	// spotlight is ready the instant the card wipes away.
	useEffect(() => {
		if (!open) {
			return;
		}
		setPlacements(null);
		setTimedOut(false);
		capturedHrefRef.current = null;
		searchStartedAt.current = Date.now();

		// Look-ahead: if THIS step's target has gone missing, check whether a
		// step just ahead is already on screen instead — the viewer took the
		// real action themselves (tapped the real Bet button, the real
		// Support/Counter pill) rather than waiting on the tour's own Next.
		// Following them there is what keeps the blurred backdrop matching
		// whatever page/state is actually live, instead of sitting on a stale
		// target until the viewer notices and clicks through manually. Capped
		// at two steps so an unrelated coincidental match elsewhere can't
		// vault the tour forward by more than one real user action's worth.
		function findAhead(): number | null {
			for (let lookAhead = 1; lookAhead <= 2; lookAhead++) {
				const aheadIndex = stepIndex + lookAhead;
				if (aheadIndex >= TUTORIAL_STEPS.length) {
					break;
				}
				const aheadStep = TUTORIAL_STEPS[aheadIndex];
				if (measure(aheadStep.selector, aheadStep.selectorSecondary)) {
					return aheadIndex;
				}
			}
			return null;
		}

		function tick() {
			const found = measure(step.selector, step.selectorSecondary);
			if (found) {
				setPlacements(found.placements);
				setTimedOut(false);
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
			const aheadIndex = findAhead();
			if (aheadIndex !== null) {
				setStepIndex(aheadIndex);
				return;
			}
			setPlacements(null);
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
	}, [open, step.selector, step.selectorSecondary, step.advance, stepIndex]);

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
		setStepIndex(0);
		setOpen(true);
		if (window.location.pathname !== "/") {
			router.push("/");
		}
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
		if (step.advance === "navigate-now" && capturedHrefRef.current) {
			router.push(capturedHrefRef.current);
		}
		if (step.advance === "click") {
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
		if (
			isFirstStepOfChapter(nextIndex) &&
			TUTORIAL_STEPS[nextIndex].chapter === "Your profile" &&
			profileHrefRef.current
		) {
			router.push(profileHrefRef.current);
		}
		setStepIndex(nextIndex);
	}

	function back() {
		setStepIndex((i) => Math.max(i - 1, 0));
	}

	// Escape always closes; ArrowRight/ArrowLeft drive Next/Back while the
	// tour is open, matching the reference mockup's keyboard support. Bound
	// only while open and re-bound each render (next/back close over
	// step-dependent state, so there is no stable version to memoize) — the
	// same cleanup discipline `composer-open-store.ts` documents applies:
	// nothing here is left attached past close. Suppressed entirely while
	// the chapter card is showing, so an arrow press doesn't fire Next twice
	// in a row through a card the viewer hasn't actually read yet.
	useEffect(() => {
		if (!open || showingChapterCard) {
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
					{showingChapterCard ? (
						<ChapterCard
							phase={chapterPhase as "in" | "out"}
							chapterNumber={chapterNumberFor(stepIndex)}
							chapterCount={TUTORIAL_CHAPTERS.length}
							name={step.chapter}
						/>
					) : (
						<TutorialOverlay
							stepNumber={stepIndex + 1}
							stepCount={TUTORIAL_STEPS.length}
							chapter={step.chapter}
							text={step.text}
							gesture={step.gesture}
							placements={placements}
							showSpotlight={!timedOut}
							reducedMotion={reducedMotion}
							isFirst={isFirst}
							isLast={isLast}
							onBack={back}
							onNext={next}
							onSkip={close}
						/>
					)}
				</>
			) : null}
		</>
	);
}

function ChapterCard({
	phase,
	chapterNumber,
	chapterCount,
	name,
}: {
	phase: "in" | "out";
	chapterNumber: number;
	chapterCount: number;
	name: string;
}) {
	return (
		<div
			role="status"
			aria-live="polite"
			className={cn(
				"fixed inset-0 z-50 grid place-content-center gap-2 bg-ground px-[9%] text-ink",
				phase === "in" ? "zzt-wipe-in" : "zzt-wipe-out",
			)}
		>
			<div className="flex items-baseline gap-3">
				<b className="zzt-slam text-[clamp(56px,12vw,120px)] leading-[0.85] font-extrabold tracking-tight">
					{chapterNumber}
				</b>
				<span className="font-mono text-[13px] text-muted-foreground">
					/ {chapterCount}
				</span>
			</div>
			<div className="zzt-trail text-[clamp(20px,4vw,32px)] font-bold tracking-tight">
				{name}
			</div>
		</div>
	);
}

function TutorialOverlay({
	stepNumber,
	stepCount,
	chapter,
	text,
	gesture,
	placements,
	showSpotlight,
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
	gesture: TutorialGesture;
	placements: Placement[] | null;
	showSpotlight: boolean;
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
					{!reducedMotion
						? boxes.map((box) => (
								<GestureMark
									key={`${box.top}-${box.left}`}
									gesture={gesture}
									box={box}
								/>
							))
						: null}
					<TutorialHand
						box={boxes[boxes.length - 1]}
						reducedMotion={reducedMotion}
					/>
				</>
			) : (
				<div className="fixed inset-0 bg-black/70 backdrop-blur-sm" />
			)}
			<HintCard
				box={unionBox}
				stepNumber={stepNumber}
				stepCount={stepCount}
				chapter={chapter}
				text={text}
				notFoundHint={!hasTarget}
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
	const panelClass = "fixed bg-black/60 backdrop-blur-sm";
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
 * The hand-drawn-feeling scribble matched to the step's own gesture, drawn
 * in a normalized 0–100 box and stretched onto the real target rect — "tap"
 * circles the whole control, "point-hold" underlines it. `pathLength="1"`
 * means the draw-in animation's `stroke-dashoffset` never needs the
 * target's real geometry measured in JS.
 */
function GestureMark({
	gesture,
	box,
}: {
	gesture: TutorialGesture;
	box: Placement;
}) {
	const margin = 14;
	const style: CSSProperties = {
		top: box.top - margin,
		left: box.left - margin,
		width: box.width + margin * 2,
		height: box.height + margin * 2,
	};
	return (
		<svg
			aria-hidden="true"
			className="pointer-events-none fixed z-10 overflow-visible text-n7"
			style={style}
			viewBox="0 0 100 100"
			preserveAspectRatio="none"
		>
			{gesture === "tap" ? (
				<path
					className="zzt-draw"
					pathLength={1}
					d="M50 8 C73 8 90 26 90 50 C90 74 73 92 50 92 C27 92 10 74 10 50 C10 26 27 8 50 8"
					fill="none"
					stroke="currentColor"
					strokeWidth={2.5}
					strokeLinecap="round"
				/>
			) : (
				<path
					className="zzt-draw"
					pathLength={1}
					d="M4 92 Q25 100 50 92 T96 92"
					fill="none"
					stroke="currentColor"
					strokeWidth={2.5}
					strokeLinecap="round"
				/>
			)}
		</svg>
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
	reducedMotion: boolean;
	isFirst: boolean;
	isLast: boolean;
	onBack: () => void;
	onNext: () => void;
	onSkip: () => void;
}) {
	const CARD_WIDTH = 340;
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
			{notFoundHint ? (
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
@keyframes zzt-wipe-in { from { clip-path: inset(0 100% 0 0); } to { clip-path: inset(0 0 0 0); } }
@keyframes zzt-wipe-out { from { clip-path: inset(0 0 0 0); } to { clip-path: inset(0 0 0 100%); } }
.zzt-wipe-in { animation: zzt-wipe-in 420ms cubic-bezier(.7,0,.2,1) both; }
.zzt-wipe-out { animation: zzt-wipe-out 420ms cubic-bezier(.7,0,.2,1) both; }

@keyframes zzt-slam {
  0% { opacity: 0; transform: translateY(-30%) scaleY(1.25); filter: blur(8px); }
  60% { opacity: 1; transform: translateY(2%) scaleY(.98); filter: blur(0); }
  100% { transform: none; }
}
.zzt-slam { animation: zzt-slam 620ms cubic-bezier(.16,1,.3,1) 140ms both; }

@keyframes zzt-trail {
  from { opacity: 0; transform: translateY(10px); filter: blur(4px); }
  to { opacity: 1; transform: none; filter: none; }
}
.zzt-trail { animation: zzt-trail 550ms cubic-bezier(.16,1,.3,1) 260ms both; }

@keyframes zzt-word-in {
  from { opacity: 0; transform: translateY(6px); filter: blur(3px); }
  to { opacity: 1; transform: none; filter: none; }
}
.zzt-word { display: inline-block; white-space: pre; animation: zzt-word-in 420ms cubic-bezier(.16,1,.3,1) both; }

@keyframes zzt-draw {
  0% { stroke-dashoffset: 1; opacity: 0; }
  15% { opacity: 1; }
  55% { stroke-dashoffset: 0; opacity: 1; }
  80% { opacity: 1; }
  100% { stroke-dashoffset: 0; opacity: 0; }
}
.zzt-draw { stroke-dasharray: 1; animation: zzt-draw 1800ms ease-in-out infinite; }

@media (prefers-reduced-motion: reduce) {
  .zzt-wipe-in, .zzt-wipe-out, .zzt-slam, .zzt-trail, .zzt-word, .zzt-draw {
    animation: none !important;
  }
}
`;
