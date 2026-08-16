"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import { useEffect, useState } from "react";

/**
 * How many steps the countdown fill is drawn in. NOT a duration and not a
 * mockup value — a render granularity. The rail re-renders this many times per
 * cycle (and nothing else does: the fill state is LOCAL to this component, so a
 * tick never re-renders the card beside it). Between ticks a CSS transition of
 * exactly one tick's length carries the bar, so the motion reads as continuous
 * while the state machine stays coarse enough to drive with fake timers.
 */
const FILL_STEPS = 60;

/**
 * HTML-FINISH · MARKET DETAIL rows 18 + 19 — the vertical scroller rail: d5's
 * `.pscroll` for posts (`:887`) and `.rps` for replies (`:917`), which are the
 * same control at two mount points. Up button · progress track · down button,
 * stacked.
 *
 * ⛔ ROW 29 IS EXPRESSLY NOT A REGRESSION OF THE PAGED LIST. The rail replaces
 * the horizontal prev/next STRIP, not the paging MODEL: one card at a time,
 * client-side, exactly as `PostScroller`/`ReplyScroller` already worked. Row 29
 * is kickoff-ruled to no separate code precisely because it IS this rail.
 *
 * ⚠⚠ ROUND 2 · R3 — THE FILL IS A COUNTDOWN, NOT A READ-THROUGH PROPORTION, AND
 * THAT REVERSAL IS THE WHOLE ROW. It used to be `(index + 1) / total`: on the
 * common two-post side it sat at a dead 50% and never moved, which is what read
 * as broken on staging. MEASURED there before the change — both columns, both
 * rails: track 96px, fill `50%`, readout `1 / 2`, `Previous` disabled and `Next`
 * live; clicking `Next` advanced the card and moved the fill to 100%. ⇒ NOTHING
 * WAS BROKEN. What was missing is what the bar was FOR. d5's `.psfill` is
 * `height:0` growing to `100%` over the cadence and then advancing the card
 * (`d5:894`, `:1725-1742`) — the founder's D8 reversal says it in one line: the
 * loader IS the countdown to the auto-advance, and nothing to count means
 * nothing to see.
 *
 * ⇒ `progressKey` restarts the countdown (by REMOUNTING `CountdownFill`, see
 * below); `durationMs === null` means PAUSED and empties the bar, which is d5's
 * `stopFill` (`:1731`) and its `.slot.picked .psload{display:none}` (`:897`)
 * collapsed into one state: a picked or frozen column shows an empty track
 * rather than a bar that lies about a timer which is not running.
 *
 * ⛔ TOPOLOGY ONLY — d5's rail is `position:absolute;top:50%;
 * transform:translateY(-50%)` with `right:2px` / `left:2px`, a `92px` track,
 * `5px` wide, `gap:9px`, and a 20s cadence. NONE of those lengths or durations
 * is carried. What is carried is the SHAPE: a vertical stack, buttons at both
 * ends, a proportional fill between them. The rail sits in normal flow beside
 * the card rather than absolutely over the slot, so it needs no offsets at all
 * and cannot overlap the content at a viewport the mockup never declared. The
 * cadence's source is `scrollers.tsx` — a build constant, never d5's 20s.
 *
 * ⚠ THE FILL IS `w-[3px] rounded-[1px] bg-ink` — BYTE-CARRIED from
 * `shell/RadioSlot.tsx`'s shipped vertical-bar primitive, which is already on
 * `main`. Nothing new is minted for it.
 *
 * ⚠ THE TRACK/FILL PAIR IS PORTED INDEX-WISE, NOT BY TOKEN NAME. d5 is
 * light-theme, where its `--n2` track is a LIGHT grey under a dark `--ink`
 * fill; this build's ramp is inverted, so the same NAMES here give a dark track
 * under a bright fill — which is the correct reading of the mockup's intent
 * (low-contrast track, high-contrast fill) rather than a coincidence. This is
 * the same index-wise reasoning AGENTS.md §8 applies to `.blab`'s `--ink`.
 *
 * ⚠⚠ THE POSITION READOUT SURVIVES AS `sr-only`, AND THAT IS NOT DECORATION.
 * The strip this replaces rendered a visible `1 / 3` with `aria-live="polite"`,
 * so a screen-reader user heard their position change on every page. d5's rail
 * is a PURELY VISUAL fill and announces nothing — porting it literally would
 * silently delete that announcement, turning a fidelity row into an
 * accessibility regression. The count is kept, still `aria-live`, and only its
 * visual form is replaced by the fill. ⛔ R3 makes this MORE load-bearing: with
 * auto-advance the card now changes with no user action at all, so the readout
 * is the only channel that tells a screen-reader user it moved.
 *
 * ⚠⚠ THE ARROWS NO LONGER DISABLE AT THE ENDS, AND THE LIST WRAPS. This reverses
 * shipped behaviour, so the measurement that grounds it is recorded rather than
 * asserted. On staging, before R3: `Previous` was `disabled: true` at index 0 and
 * `Next` became `disabled: true` after one click on a 2-post side. ⇒ THE ARROWS
 * WERE NEVER BROKEN — they were correctly end-clamped, which is the answer to the
 * round-2 question and is reported as such.
 * ⛔ BUT END-CLAMPING AND AUTO-ADVANCE CANNOT BOTH BE RIGHT. Auto-advance must
 * wrap or it stops at the last card and the loader counts down to nothing; and
 * once it wraps, a greyed-out `Next` sits beside a card that is about to advance
 * past that very end by itself. d5 has no disabled state at all and wraps by
 * modulo (`d5:1713`), which is the coherent pair. ⇒ Both arrows stay live and
 * `scrollers.tsx` wraps.
 * ⚠ THE ACCESSIBILITY COST IS ZERO RATHER THAN ABSORBED: the `disabled` state
 * announced "you are at the end", and with wrap there IS no end. Position is
 * still announced, every time, by the `aria-live` readout below.
 */
export function ScrollRail({
	index,
	total,
	noun,
	onPrev,
	onNext,
	durationMs,
	progressKey,
}: {
	/** 0-based position of the visible card. */
	index: number;
	total: number;
	/** "post" | "reply" — the byte-carried button labels this rail announces. */
	noun: string;
	onPrev: () => void;
	onNext: () => void;
	/**
	 * The auto-advance cadence in ms, or `null` when this column is PAUSED —
	 * picked by the reader, or frozen because a composer or a pop-up is open. A
	 * paused rail empties its track rather than freezing a partial bar, so the
	 * bar never depicts a countdown that is not counting.
	 */
	durationMs: number | null;
	/** Bumped by the owner on every advance; restarts the countdown. */
	progressKey: number;
}) {
	return (
		<div
			data-testid="scroll-rail"
			className="flex shrink-0 flex-col items-center gap-2 self-stretch"
		>
			<button
				type="button"
				onClick={onPrev}
				aria-label={`Previous ${noun}`}
				className="shrink-0 text-n4 outline-none hover:text-ink focus-visible:shadow-(--state-focus-ring) [&_svg]:size-3.5"
			>
				<ChevronUp />
			</button>

			{/* `.psload` / `.psfill` — the track and its countdown fill. Decorative:
			    the `sr-only` readout below is the accessible channel. */}
			<span
				data-testid="scroll-rail-track"
				aria-hidden="true"
				className="w-[3px] flex-1 overflow-hidden rounded-[1px] bg-n2"
			>
				{/* ⛔ `key={progressKey}` IS THE RESTART, and it replaces an effect that
				    listed `progressKey` as a dependency without reading it — an extra
				    dependency, which `useExhaustiveDependencies` correctly rejects.
				    Remounting on a new cycle re-runs the countdown from zero with the
				    deps honest, and it is safe HERE specifically because the fill is a
				    decorative, non-focusable leaf: remounting the whole rail instead
				    would drop keyboard focus from an arrow the reader is holding. */}
				<CountdownFill key={progressKey} durationMs={durationMs} />
			</span>

			<button
				type="button"
				onClick={onNext}
				aria-label={`Next ${noun}`}
				className="shrink-0 text-n4 outline-none hover:text-ink focus-visible:shadow-(--state-focus-ring) [&_svg]:size-3.5"
			>
				<ChevronDown />
			</button>

			<span className="sr-only" aria-live="polite">
				{index + 1} / {total}
			</span>
		</div>
	);
}

/**
 * The countdown bar itself — d5's `.psfill` (`:894`), `height:0` growing to
 * `100%` across one cadence.
 *
 * ⚠ LOCAL STATE, DELIBERATELY. The countdown ticks `FILL_STEPS` times per cycle;
 * owning it here means those renders touch a 3px span and nothing else. In the
 * rail it would re-render both arrows and the readout; in the scroller it would
 * re-render the whole card — image, argument, footer — several times a second.
 *
 * ⚠ REMOUNTED PER CYCLE by the `key` at the call site, so this component has no
 * notion of "restart" at all: a new cycle is a new instance starting at zero.
 */
function CountdownFill({ durationMs }: { durationMs: number | null }) {
	const [step, setStep] = useState(0);
	useEffect(() => {
		if (durationMs === null) {
			return;
		}
		const id = setInterval(() => {
			setStep((s) => (s >= FILL_STEPS ? s : s + 1));
		}, durationMs / FILL_STEPS);
		return () => clearInterval(id);
	}, [durationMs]);

	return (
		<span
			data-testid="scroll-rail-fill"
			className="block w-[3px] rounded-[1px] bg-ink"
			// ⚠ The transition is exactly ONE TICK long, so the coarse state machine
			// above renders as d5's continuous linear sweep. `linear` is the mockup's
			// own easing and is a CURVE, not a value.
			style={{
				height: durationMs === null ? "0%" : `${(step / FILL_STEPS) * 100}%`,
				transitionProperty: "height",
				transitionDuration:
					durationMs === null ? "0ms" : `${durationMs / FILL_STEPS}ms`,
				transitionTimingFunction: "linear",
			}}
		/>
	);
}
