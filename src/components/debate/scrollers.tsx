"use client";

import { useEffect, useRef, useState } from "react";

import type { BookmarkAffordance } from "@/components/bookmarks/BookmarkToggle";
import { POLL_INTERVAL_MS_DEBATE_VIEW } from "@/server/config/limits";

import { PostCard } from "./PostCard";
import { EmptySideCTA } from "./placeholders";
import { ReplyCard } from "./ReplyCard";
import { ScrollRail } from "./ScrollRail";
import type {
	DebatePost,
	DebateReply,
	PresentPost,
	PresentReply,
	Side,
} from "./types";

/**
 * HTML-FINISH · MARKET DETAIL round 2 · R3 — THE AUTO-ADVANCE CADENCE.
 *
 * ⛔⛔ THE NUMBER IS NOT d5's, AND THAT IS THE ONE RULE THAT SURVIVES EVERYTHING.
 * d5 advances every 20s (`:1738`) and offsets the second side by 10s (`:1742`).
 * "Duration" is named in the kickoff's value list, so 20000 may not be carried,
 * and inventing a fresh number would be authoring a value by another route.
 *
 * ⇒ IT IS `POLL_INTERVAL_MS_DEBATE_VIEW`, a cadence already on `main` and
 * already imported into a client component by `DebatePoll`. The reuse is
 * ARGUED, not merely convenient: that constant is how often this surface's data
 * is refreshed, so advancing at the same cadence shows each card for exactly one
 * data-refresh window. Advancing faster would page through cards the server has
 * not revisited; advancing slower would leave a card on screen across two
 * refreshes of the very figures it displays.
 *
 * ⚠ THE COUPLING IS REAL AND IS DECLARED: retuning the poll retunes the
 * carousel. That is the correct direction of travel for the reason above, but a
 * future task that wants them independent should mint its own constant in
 * `@/server/config/limits` rather than hard-code one here.
 */
const ADVANCE_MS = POLL_INTERVAL_MS_DEBATE_VIEW;

/**
 * The second column starts HALF A CADENCE AHEAD, so the two sides advance
 * one-after-another instead of flipping together — d5's own reason, at `:1724`:
 * "the two sides are offset 10s so posts advance one-after-another".
 *
 * ⛔ A DERIVATION, NOT A VALUE. d5's 10s is half of its 20s; this is half of
 * whatever `ADVANCE_MS` is. Nothing is read off the mockup but the RATIO, which
 * is composition.
 */
const STAGGER_MS = ADVANCE_MS / 2;

/**
 * One column's paging state — the index, the wrap, and the auto-advance timer.
 *
 * ⛔ IT WRAPS. `(i + 1) % total` is d5's `show()` (`:1713`,
 * `i=(i%len+len)%len`), and auto-advance REQUIRES it: a clamped list stops at
 * the last card while the loader keeps counting down to nothing. The shipped
 * `Math.min`/`Math.max` clamp and the rail's disabled-at-the-ends state went
 * together with it — see `ScrollRail`'s docblock for the measurement that
 * grounds dropping both.
 *
 * ⚠ `paused` COVERS TWO DIFFERENT THINGS ON PURPOSE. A column is paused when the
 * reader PICKED it (d5's `picked`, `:1750`) or when the whole surface is FROZEN
 * (d5's `locked`, `:1762-1771` — a composer or a pop-up is open). The rail
 * cannot tell them apart and does not need to: both mean "no timer is running",
 * and both must empty the bar rather than freeze a partial one.
 *
 * ⚠ THE STAGGER APPLIES ONCE, TO THE FIRST CYCLE ONLY, which is exactly d5's
 * `startSide(side, delay, from)` shape: the offset is an initial delay, after
 * which both sides run at the full cadence and stay half a cycle apart.
 *
 * ⚠⚠ MEASURED, NOT ASSUMED: the F-DEBATE-4 poll does NOT reset this. On live
 * staging with the poll genuinely running (10 RSC responses across ~38 s, ≥2
 * interval ticks), the paged card and its `n / total` readout did not move —
 * `router.refresh()` RECONCILES rather than remounts, so this hook's state
 * survives every refresh. ⚠ The first attempt at that measurement was VACUOUS
 * and is reported as such in the run log: `document.hidden` was true, so the
 * poll was suspended and nothing fired.
 */
function usePagedColumn(total: number, paused: boolean, stagger: boolean) {
	const [index, setIndex] = useState(0);
	// Bumped on EVERY index change, whoever caused it — the timer, an arrow, or
	// the clamp below. The rail remounts its countdown bar off this, so the bar
	// restarts whenever the card does, exactly as d5's `startFill(f, 0)` does at
	// each advance (`:1737`).
	const [progressKey, setProgressKey] = useState(0);
	// The stagger is a first-cycle-only delay. A ref, not state: consuming it must
	// not itself trigger a render.
	const staggered = useRef(false);

	const step = (delta: number) => {
		setIndex((i) => (total === 0 ? 0 : (i + delta + total) % total));
		setProgressKey((k) => k + 1);
	};

	// A column whose list SHRANK (a post removed between polls) must not point
	// past the end. Runs before the timer effect reads `index`.
	useEffect(() => {
		if (total > 0 && index > total - 1) {
			setIndex(0);
			setProgressKey((k) => k + 1);
		}
	}, [total, index]);

	// ⚠ A DELAYED TIMEOUT THAT HANDS OFF TO A SELF-RUNNING INTERVAL, rather than a
	// timeout that re-arms itself through React on every tick. The re-arming shape
	// works, but it makes `progressKey` a dependency of this effect while nothing
	// in the body reads it — which is an extra dependency, and Biome's
	// `useExhaustiveDependencies` is right to reject it. The interval keeps the
	// deps honest AND drops one full React effect cycle per advance.
	//
	// ⚠ ONE PROPERTY WAS LOST AND IT DOES NOT MATTER: a re-arming timeout also
	// restarted the cadence when the reader pressed an arrow. It no longer does —
	// but pressing an arrow also PICKS the column (`auto.onPick()`), which flips
	// `paused` and tears this effect down entirely. There is no state in which a
	// pre-empted timer survives to advance past the card the reader just chose.
	useEffect(() => {
		if (paused || total <= 1) {
			return;
		}
		const delay = stagger && !staggered.current ? STAGGER_MS : ADVANCE_MS;
		staggered.current = true;
		const advance = () => {
			setIndex((i) => (i + 1) % total);
			setProgressKey((k) => k + 1);
		};
		let interval: ReturnType<typeof setInterval> | undefined;
		const first = setTimeout(() => {
			advance();
			interval = setInterval(advance, ADVANCE_MS);
		}, delay);
		return () => {
			clearTimeout(first);
			if (interval !== undefined) {
				clearInterval(interval);
			}
		};
	}, [paused, total, stagger]);

	return {
		index: total === 0 ? 0 : Math.min(index, total - 1),
		progressKey,
		step,
	};
}

/**
 * Hands this column's `step` up to whoever owns the keyboard (`DebateView`), so
 * ↑/↓ can page the column the reader chose — d5's `step(side, ±1)`
 * (`:1792-1793`).
 *
 * ⛔ THE LIVE `step` GOES THROUGH A REF, NOT THROUGH THE DEPENDENCY LIST.
 * `usePagedColumn` returns a NEW `step` closure every render, so listing it
 * would unregister and re-register on every single render — including the ones
 * the countdown causes. The published callback is stable and reads the current
 * closure at CALL time, which is also what keeps it from stepping off a stale
 * `total` after a poll changes the list length.
 *
 * ⚠ Registering `null` on unmount is not tidiness: a column replaced by an open
 * composer, or swapped out by the market↔post toggle, must not still be
 * reachable from a key press.
 */
function useRegisterStep(
	step: (delta: number) => void,
	register: ((step: ((delta: number) => void) | null) => void) | undefined,
) {
	const live = useRef(step);
	live.current = step;
	useEffect(() => {
		if (register === undefined) {
			return;
		}
		register((delta) => live.current(delta));
		return () => register(null);
	}, [register]);
}

/** Shared props for both scrollers' R3 wiring. */
type ColumnAuto = {
	/** This column is the one the reader picked — its timer stops (d5 `picked`). */
	picked: boolean;
	/** The whole surface is frozen: a composer or a pop-up is open (d5 `locked`). */
	frozen: boolean;
	/** Pressing an arrow picks this column, exactly as d5's `.psbtn` does. */
	onPick: () => void;
	/** This column starts half a cadence ahead, so the two do not flip together. */
	stagger: boolean;
	/**
	 * ⚠⚠ PUBLISHES THIS COLUMN'S STEPPER SO ↑/↓ CAN REACH IT. d5's `onKey` calls
	 * `step(side, ±1)` directly because its state is module-scoped; here the state
	 * is per-scroller and the key handler is two levels up, so the stepper is
	 * handed up on mount and cleared on unmount. Without this, ↑/↓ have nothing to
	 * call — which is exactly what the founder measured as "cards do not step".
	 */
	registerStep: (step: ((delta: number) => void) | null) => void;
};

/**
 * The market-view post-scroller (§4) — pages a single side's posts (Top order,
 * already filtered) one card at a time. Empty side → the empty-side CTA. D11:
 * all posts are loaded; this pages through them client-side.
 *
 * ✅ ROUND 2 · R3 — it now advances on its own; see `usePagedColumn`.
 */
export function PostScroller({
	posts,
	side,
	bookmarks,
	onEnter,
	onOpenPopup,
	onOpenImage,
	onReplyToPost,
	heldSide,
	marketOpen,
	suspended,
	auto,
}: {
	posts: DebatePost[];
	side: Side;
	/** BOOKMARK-ADD-WIRE — pass-through to the paged `PostCard`. */
	bookmarks: BookmarkAffordance;
	onEnter: (id: string) => void;
	onOpenPopup: (post: PresentPost) => void;
	onOpenImage: (url: string) => void;
	/** HTML-FINISH · MARKET DETAIL row 22 — pass-through to the card's pills. */
	onReplyToPost: (id: string, relation: "support" | "counter") => void;
	heldSide: Side | null;
	marketOpen: boolean;
	suspended: boolean;
	/**
	 * HTML-FINISH · MARKET DETAIL round 2 · R3. OMIT to page manually with no
	 * timer at all — which is what every test and any future consumer without the
	 * surface-level picked/frozen state gets, so the auto-advance can never start
	 * running somewhere nobody can stop it.
	 */
	auto?: ColumnAuto;
}) {
	const { index, progressKey, step } = usePagedColumn(
		posts.length,
		auto === undefined || auto.picked || auto.frozen,
		auto?.stagger ?? false,
	);
	// ⚠⚠ THE RAILS FACE EACH OTHER ACROSS THE CENTRE GUTTER. d5 pins the LEFT
	// column's rail to its RIGHT edge and the RIGHT column's to its LEFT
	// (`.slot.l .pscroll{right:2px}` / `.slot.r .pscroll{left:2px}`, `d5:888-889`).
	// The build put BOTH after the card, so the NO column's rail sat against the
	// far page edge — measured on staging at `5349ae9`, its `Next post` button
	// was at x=1223 in a 1254px viewport and y=627 in a 609px one, i.e. jammed
	// into the corner and below the fold. That is a material part of "cards do not
	// step": the control was there, and it was not reachable.
	const railFirst = side === "NO";
	useRegisterStep(step, auto?.registerStep);
	if (posts.length === 0) {
		return <EmptySideCTA side={side} />;
	}
	const post = posts[index];
	return (
		// HTML-FINISH · MARKET DETAIL row 18 — d5's `.pscroll` is a VERTICAL rail
		// BESIDE the card (`:887`), replacing the horizontal prev/next strip that
		// sat under it. `items-stretch` is what lets the rail's track fill the
		// card's height rather than needing d5's fixed `92px`.
		//
		// ⚠⚠ `flex-1 min-h-0` IS NEW AND IT IS LOAD-BEARING: it is what gives
		// `PostCard`'s `.argimg` cell a height to take a share of. Without it this
		// wrapper is content-sized and the image reverts to intrinsic size — the
		// founder's measured "~¼ size" defect, one link up the chain.
		<div
			className={`flex min-h-0 flex-1 items-stretch gap-2 ${
				railFirst ? "flex-row-reverse" : ""
			}`}
		>
			<div className="flex min-w-0 flex-1 flex-col gap-2">
				<PostCard
					post={post}
					bookmarks={bookmarks}
					onEnter={onEnter}
					onOpenPopup={onOpenPopup}
					onOpenImage={onOpenImage}
					onReplyToPost={onReplyToPost}
					heldSide={heldSide}
					marketOpen={marketOpen}
					suspended={suspended}
				/>
			</div>
			{posts.length > 1 ? (
				<ScrollRail
					index={index}
					total={posts.length}
					noun="post"
					// d5's `.psbtn` handler is `pickSide(side); step(side, ±1)` (`:1780`,
					// `:1781`) — touching an arrow takes the column off the timer, so the
					// reader is never fighting an advance they did not ask for.
					onPrev={() => {
						auto?.onPick();
						step(-1);
					}}
					onNext={() => {
						auto?.onPick();
						step(1);
					}}
					durationMs={
						auto === undefined || auto.picked || auto.frozen ? null : ADVANCE_MS
					}
					progressKey={progressKey}
				/>
			) : null}
		</div>
	);
}

/**
 * The post-view reply-scroller (§4) — pages the focused post's replies for one
 * side (placed by their own frozen side, D3) one card at a time. Empty side →
 * the empty-side CTA.
 *
 * ✅ ROUND 2 · R3 — the same auto-advance as the market arm. d5 runs a SECOND,
 * structurally identical timer over the reply columns (`:1816-1901`), and the
 * founder's ruling is "both arms".
 */
export function ReplyScroller({
	replies,
	side,
	bookmarks,
	onOpenImage,
	onOpenPopup,
	auto,
}: {
	replies: DebateReply[];
	side: Side;
	/** BOOKMARK-ADD-WIRE — pass-through to the paged `ReplyCard`. */
	bookmarks: BookmarkAffordance;
	/** HTML-FINISH · MARKET DETAIL row 26 — pass-through to the reply's image. */
	onOpenImage: (url: string) => void;
	/** HTML-FINISH · MARKET DETAIL row 27 — pass-through to the reply's `+`. */
	onOpenPopup: (reply: PresentReply) => void;
	/** Round 2 · R3 — omit to page manually with no timer. */
	auto?: ColumnAuto;
}) {
	const { index, progressKey, step } = usePagedColumn(
		replies.length,
		auto === undefined || auto.picked || auto.frozen,
		auto?.stagger ?? false,
	);
	// `.rps` mirrors `.pscroll` exactly — `.slot.l .rps{right:2px}` /
	// `.slot.r .rps{left:2px}` (`d5:920-921`). Same rail, same gutter, same reason.
	const railFirst = side === "NO";
	useRegisterStep(step, auto?.registerStep);
	if (replies.length === 0) {
		return <EmptySideCTA side={side} />;
	}
	const reply = replies[index];
	return (
		// Row 19 — `.rps` (`:917`) is the same rail at the reply mount point.
		<div
			className={`flex min-h-0 flex-1 items-stretch gap-2 ${
				railFirst ? "flex-row-reverse" : ""
			}`}
		>
			<div className="flex min-w-0 flex-1 flex-col gap-2">
				<ReplyCard
					reply={reply}
					bookmarks={bookmarks}
					onOpenImage={onOpenImage}
					onOpenPopup={onOpenPopup}
				/>
			</div>
			{replies.length > 1 ? (
				<ScrollRail
					index={index}
					total={replies.length}
					noun="reply"
					onPrev={() => {
						auto?.onPick();
						step(-1);
					}}
					onNext={() => {
						auto?.onPick();
						step(1);
					}}
					durationMs={
						auto === undefined || auto.picked || auto.frozen ? null : ADVANCE_MS
					}
					progressKey={progressKey}
				/>
			) : null}
		</div>
	);
}
