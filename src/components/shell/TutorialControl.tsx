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
 * writes a "seen" marker; every open starts at step 0. The button and the
 * overlay share one `useState` in this file, mirroring `RulesControl` →
 * `OnboardingDeck`'s shape, but the overlay itself is bespoke: it highlights
 * real, live controls in place (blurred surround + a ring, never an opaque
 * modal), so a Radix `Dialog` is the wrong primitive here.
 *
 * The target element under the spotlight is never covered by anything —
 * only `pointer-events-none` decoration surrounds it — so steps that need
 * the user to actually click the real control (a market card, Buy, a
 * Support/Counter pill, a position's Sell button) keep working with the
 * overlay open.
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

function measure(
	selector: string,
): { placement: Placement; el: HTMLElement } | null {
	let el: Element | null = null;
	try {
		el = document.querySelector(selector);
	} catch {
		return null;
	}
	if (!(el instanceof HTMLElement)) {
		return null;
	}
	const r = el.getBoundingClientRect();
	if (r.width === 0 && r.height === 0) {
		return null;
	}
	return {
		placement: { top: r.top, left: r.left, width: r.width, height: r.height },
		el,
	};
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
	const [placement, setPlacement] = useState<Placement | null>(null);
	const [timedOut, setTimedOut] = useState(false);
	const [chapterPhase, setChapterPhase] = useState<"in" | "out" | null>(null);
	const searchStartedAt = useRef(0);
	const reducedMotion = useReducedMotion();
	const router = useRouter();
	/** The current step's own target `href`, live while it's `captureHrefFor`. */
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

	// Escape closes the tour from anywhere. Bound only while open, and
	// cleared the same way it's set — the same cleanup discipline
	// `composer-open-store.ts` documents: a listener left attached after
	// close is a flag stuck on, silently.
	useEffect(() => {
		if (!open) {
			return;
		}
		function onKey(e: KeyboardEvent) {
			if (e.key === "Escape") {
				close();
			}
		}
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [open, close]);

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

	// Find and track the current step's target. Re-runs on every step
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
		setPlacement(null);
		setTimedOut(false);
		capturedHrefRef.current = null;
		searchStartedAt.current = Date.now();

		function tick() {
			const found = measure(step.selector);
			if (found) {
				setPlacement(found.placement);
				setTimedOut(false);
				if (step.captureHrefFor) {
					const href = found.el.getAttribute("href");
					if (href) {
						capturedHrefRef.current = href;
						if (step.captureHrefFor === "profile") {
							profileHrefRef.current = href;
						}
					}
				}
				return;
			}
			setPlacement(null);
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
	}, [open, step.selector, step.captureHrefFor]);

	function start() {
		profileHrefRef.current = null;
		setStepIndex(0);
		setOpen(true);
	}

	/**
	 * The tour drives its own page transitions rather than waiting for the
	 * viewer to find the next control themselves — Next is what "slides"
	 * them from Discovery to a market and, later, to their own profile,
	 * using the real Next.js router against the real href of whatever the
	 * spotlight is already highlighting.
	 */
	function next() {
		if (step.captureHrefFor === "market" && capturedHrefRef.current) {
			router.push(capturedHrefRef.current);
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
							placement={placement}
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
	placement,
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
	placement: Placement | null;
	showSpotlight: boolean;
	reducedMotion: boolean;
	isFirst: boolean;
	isLast: boolean;
	onBack: () => void;
	onNext: () => void;
	onSkip: () => void;
}) {
	const hasTarget = showSpotlight && placement !== null;
	const box =
		hasTarget && placement
			? {
					top: placement.top - SPOTLIGHT_PADDING,
					left: placement.left - SPOTLIGHT_PADDING,
					width: placement.width + SPOTLIGHT_PADDING * 2,
					height: placement.height + SPOTLIGHT_PADDING * 2,
				}
			: null;

	return (
		<div
			role="dialog"
			aria-modal="true"
			aria-label="Product tutorial"
			className="fixed inset-0 z-50"
		>
			{box ? (
				<>
					<div
						className="fixed inset-x-0 top-0 bg-black/60 backdrop-blur-sm"
						style={{ height: Math.max(0, box.top) }}
					/>
					<div
						className="fixed inset-x-0 bottom-0 bg-black/60 backdrop-blur-sm"
						style={{ top: box.top + box.height }}
					/>
					<div
						className="fixed bg-black/60 backdrop-blur-sm"
						style={{
							top: box.top,
							height: box.height,
							left: 0,
							width: Math.max(0, box.left),
						}}
					/>
					<div
						className="fixed bg-black/60 backdrop-blur-sm"
						style={{
							top: box.top,
							height: box.height,
							left: box.left + box.width,
							right: 0,
						}}
					/>
					<div
						aria-hidden="true"
						className="pointer-events-none fixed rounded-lg border-2 border-n7 shadow-[0_0_0_4px_rgba(228,228,228,0.15)]"
						style={{
							top: box.top,
							left: box.left,
							width: box.width,
							height: box.height,
						}}
					/>
					{!reducedMotion ? <GestureMark gesture={gesture} box={box} /> : null}
					<TutorialHand box={box} reducedMotion={reducedMotion} />
				</>
			) : (
				<div className="fixed inset-0 bg-black/70 backdrop-blur-sm" />
			)}
			<HintCard
				box={box}
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
 * The hand-drawn-feeling scribble matched to the step's own gesture, drawn
 * in a normalized 0–100 box and stretched onto the real target rect — a
 * "tap" circles the whole control, "point-hold" underlines it, "swipe"
 * shows a pair of sliding chevrons. All three use `pathLength="1"` so the
 * draw-in animation's `stroke-dashoffset` never needs the target's real
 * geometry measured in JS.
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
			) : null}
			{gesture === "point-hold" ? (
				<path
					className="zzt-draw"
					pathLength={1}
					d="M4 92 Q25 100 50 92 T96 92"
					fill="none"
					stroke="currentColor"
					strokeWidth={2.5}
					strokeLinecap="round"
				/>
			) : null}
			{gesture === "swipe" ? (
				<g
					fill="none"
					stroke="currentColor"
					strokeWidth={3}
					strokeLinecap="round"
				>
					<path
						className="zzt-swipe-left"
						d="M42 50 H20 M20 50 L28 42 M20 50 L28 58"
					/>
					<path
						className="zzt-swipe-right"
						d="M58 50 H80 M80 50 L72 42 M80 50 L72 58"
					/>
				</g>
			) : null}
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
	const CARD_HEIGHT_ESTIMATE = 210;
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
					Not on screen right now — Next still works.
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
							className="inline-flex h-[30px] items-center rounded-(--r) px-3 text-[12px] font-semibold [border:var(--hairline)] hover:[border:1px_solid_var(--ring)]"
						>
							Back
						</button>
					) : null}
					<button
						type="button"
						onClick={onNext}
						className="inline-flex h-[30px] items-center rounded-(--r) bg-(--btn-fill) px-3 text-[12px] font-semibold text-ink [border:var(--hairline)] hover:[border:1px_solid_var(--ring)]"
					>
						{isLast ? "Done" : "Next"}
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

@keyframes zzt-swipe-l { 0%, 100% { transform: translateX(0); opacity: .35; } 50% { transform: translateX(-8px); opacity: 1; } }
@keyframes zzt-swipe-r { 0%, 100% { transform: translateX(0); opacity: .35; } 50% { transform: translateX(8px); opacity: 1; } }
.zzt-swipe-left { animation: zzt-swipe-l 1400ms ease-in-out infinite; }
.zzt-swipe-right { animation: zzt-swipe-r 1400ms ease-in-out infinite; }

@media (prefers-reduced-motion: reduce) {
  .zzt-wipe-in, .zzt-wipe-out, .zzt-slam, .zzt-trail, .zzt-word, .zzt-draw, .zzt-swipe-left, .zzt-swipe-right {
    animation: none !important;
  }
}
`;
