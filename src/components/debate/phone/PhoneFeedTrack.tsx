"use client";

import { type ReactNode, useCallback, useEffect, useRef } from "react";

/**
 * RF-3 — the horizontal scroll-snap track the two side feeds live in.
 *
 * ⛔⛔ NO GESTURE JS. The swipe is `scroll-snap-type: x mandatory` plus
 * `overflow-x-auto`, i.e. the browser's own scrolling, and the only JavaScript
 * here READS it. A hand-written pointer/drag handler would have to reimplement
 * momentum, rubber-banding, cancellation, and the platform's own accessibility
 * behaviour, and would get all four subtly wrong on the one device class this
 * tier exists for.
 *
 * ⇒ The two directions are asymmetric on purpose: tapping a tab WRITES the
 * scroll position (`scrollTo`), and an `IntersectionObserver` READS it back to
 * set the active tab. Nothing else observes the track, so a swipe and a tap
 * converge on the same state by the same path.
 *
 * ⚠ `prefers-reduced-motion` SWITCHES `behavior`, AND IT IS READ THROUGH THE
 * SAME `matchMedia` PATTERN THE COMPOSER ALREADY USES (`ComposerSlot.tsx`).
 * `behavior: "smooth"` on a `scrollTo` is an animation like any other; a reader
 * who has asked the platform for no motion has asked for this one too. It is
 * read at CALL TIME rather than cached in state, so a reader who changes the OS
 * setting mid-session is honoured without a re-render, and there is no stored
 * copy of a value that can go stale.
 *
 * ⚠ `touch-action: pan-x pan-y` — both axes, deliberately. Restricting to
 * `pan-x` would hand horizontal panning to the browser and TAKE VERTICAL AWAY,
 * which on a feed of posts means the page cannot be read.
 *
 * ⛔⛔ `threshold` DECIDES WHEN THE CALLBACK FIRES; IT DOES NOT DECIDE WHAT AN
 * ENTRY REPORTS — and this docblock said the opposite, which made the ratio test
 * below look redundant when it is the whole predicate. `entry.isIntersecting` is
 * true for ANY ratio above zero. The two panes are exactly root-width, so their
 * ratios are complementary and BOTH cross 0.6 in the same frame, arriving in one
 * batch with `isIntersecting: true` on each — and a loop with no tie-break then
 * takes whichever the batch happened to put last. That is guard 9's stated wrong
 * answer ("a bar that does not follow the active pane") reached by an ordinary
 * swipe, with the bet bar naming a side the reader is not looking at. Caught by
 * `@code-reviewer`.
 * ⇒ The ratio is read EXPLICITLY, and the batch is reduced to its single
 * largest rather than iterated — so a frame carrying both panes resolves to one
 * answer rather than to an ordering accident.
 *
 * ⛔ AND THE OBSERVER RE-ARMS WHEN THE PANES CHANGE IDENTITY. The deps were `[]`
 * while the pane KEYS change with the arm (`YES`/`NO` ⇄ `support`/`counter`), so
 * after one navigation into a post and back, React had replaced both nodes and
 * the observer was still watching two detached ones — permanently, because this
 * component sits at a fixed JSX position with no `key` and never remounts.
 * Swiping then stopped updating the tab for the rest of the session. Found
 * independently by both reviewers.
 *
 * ⛔⛔ MOBILE-2b D-1 — THE WRITE PATH AND THE READ PATH RAN INTO EACH OTHER, AND
 * THE TAB WAS DEAD. Everything above describes two directions converging on one
 * state. They did not converge; they fought, and the write path always lost.
 *
 * `active` is set by the tab, which runs `scrollTo({behavior: "smooth"})` — and
 * smooth scrolling is PROGRESSIVE. One frame in, the track has moved ~6px of
 * 390 and the pane the reader is LEAVING is still ~98% visible, so the observer
 * fires, reports that pane, and the host sets `active` back to it. That re-runs
 * this effect, which scrolls back to 0 and cancels the animation in flight.
 * Net effect: the feed twitches six pixels and settles exactly where it was, on
 * every tap, forever. No error, no log, and a control that looks alive.
 *
 * ⚠ THE READER LOSES HALF THE DEBATE. The tabs are the only affordance that
 * reaches the other side. Measured on both engines with the one control that
 * isolates it: at `prefers-reduced-motion: reduce` — the single branch that
 * makes the scroll INSTANT rather than progressive — the tap works perfectly,
 * on WebKit and Chromium alike. Everyone else gets nothing.
 *
 * ⇒ A programmatic scroll DECLARES ITS DESTINATION, and the observer is muted
 * until the track arrives there. The reader's own swipe is unaffected, because
 * a swipe sets no destination. Three things release the latch, and each is
 * there for a failure this fix could otherwise cause:
 *   · the destination arriving — the ordinary case;
 *   · the reader touching the track — they have overruled us mid-animation, and
 *     their gesture must not be ignored for the rest of the session;
 *   · a timeout — a scroll that never lands (an interrupted animation that
 *     reports nothing) must not leave the track deaf forever.
 * Muting-without-release would trade a dead tab for a dead swipe, which is the
 * same defect wearing the other direction.
 */
/**
 * The pane element's `id`, shared with `PhoneSideTabs`' `aria-controls`. Exported
 * so the two files cannot drift into two spellings of one contract.
 */
export const PANE_ID = (key: string) => `phone-pane-${key}`;

/**
 * How long a programmatic slide is allowed to take before the observer is
 * un-muted regardless (D-1). It is a BACKSTOP, not the mechanism: the ordinary
 * release is the destination arriving, and the reader touching the track
 * releases immediately. Long enough that a 390px smooth scroll on a slow phone
 * lands first; short enough that a scroll which never reports cannot leave the
 * tab unable to follow a swipe for any length of time a reader would notice.
 */
const SCROLL_SETTLE_MS = 700;

export function PhoneFeedTrack({
	panes,
	active,
	onActiveChange,
}: {
	panes: { key: string; content: ReactNode }[];
	active: string;
	onActiveChange: (key: string) => void;
}) {
	const trackRef = useRef<HTMLDivElement>(null);
	// ⚠ ONE STABLE CALLBACK REF, not a value captured in the effect's closure:
	// the observer is armed once and must keep calling the CURRENT handler, not
	// the one that existed when it was armed.
	const onActiveChangeRef = useRef(onActiveChange);
	onActiveChangeRef.current = onActiveChange;

	/**
	 * The destination of a programmatic scroll that has not landed yet, or null.
	 * While it is set, the observer's reports are the track's own mid-animation
	 * positions rather than the reader's intent, and are ignored — see D-1 in the
	 * docblock. The timer is the backstop release and is cleared with it, so at
	 * most one is ever outstanding.
	 */
	const headingForRef = useRef<string | null>(null);
	const releaseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const release = useCallback(() => {
		headingForRef.current = null;
		if (releaseTimerRef.current !== null) {
			clearTimeout(releaseTimerRef.current);
			releaseTimerRef.current = null;
		}
	}, []);

	// Tapping a tab scrolls its pane into view. ⚠ It does NOT also set the active
	// key: the observer does that when the pane arrives, so a tap and a swipe end
	// at the same state through the same path, and a scroll that is interrupted
	// never leaves the tab claiming a pane the reader is not looking at.
	const scrollToPane = useCallback(
		(key: string) => {
			const track = trackRef.current;
			if (track === null) {
				return;
			}
			const pane = track.querySelector<HTMLElement>(`[data-pane="${key}"]`);
			if (pane === null) {
				return;
			}
			const left = pane.offsetLeft - track.offsetLeft;
			// ⚠ ALREADY THERE ⇒ NO LATCH. `scrollTo` to the current position moves
			// nothing and therefore reports nothing, so latching here would mute the
			// observer until the timeout for no reason. This is the common case: the
			// observer confirms a pane, the host re-renders, and this effect runs
			// again against a track that has already arrived.
			// ⚠ ...UNLESS A SLIDE IS ALREADY HEADING SOMEWHERE ELSE. Two taps inside
			// one frame land here with the track still at the first destination's
			// start: short-circuiting then releases the mute while the FIRST
			// smooth scroll is still travelling, and the reader ends up on the tab
			// they did not pick. D-1 in miniature, one layer down; found by
			// `@security-auditor`. Re-issuing the scroll cancels the one in flight.
			const heading = headingForRef.current;
			if (
				Math.abs(track.scrollLeft - left) <= 1 &&
				(heading === null || heading === key)
			) {
				release();
				return;
			}
			const reduced =
				typeof window !== "undefined" &&
				typeof window.matchMedia === "function" &&
				window.matchMedia("(prefers-reduced-motion: reduce)").matches;
			release();
			headingForRef.current = key;
			releaseTimerRef.current = setTimeout(release, SCROLL_SETTLE_MS);
			track.scrollTo({
				left,
				behavior: reduced ? "auto" : "smooth",
			});
		},
		[release],
	);

	useEffect(() => {
		scrollToPane(active);
	}, [active, scrollToPane]);

	// The reader's own touch overrules an animation in flight, so it must also
	// end the mute — otherwise a swipe started mid-slide would be discarded.
	useEffect(() => {
		const track = trackRef.current;
		if (track === null) {
			return;
		}
		// ⛔ ON MOVEMENT, NOT ON TOUCH — and releasing on `pointerdown` put D-1's
		// symptom straight back under a sequence readers perform constantly.
		// `@code-reviewer` found it: tap NO, then within the ~300ms slide touch
		// the feed (to scroll it, or on empty ground, or on a card). A `down`
		// listener releases the mute mid-slide; the very next observer batch is
		// the OLD pane crossing 0.6 downward while the new one sits at 0.4 and is
		// filtered out — so the batch resolves to the pane being left, the host
		// believes it, and the reader who tapped NO ends up on YES.
		//
		// A finger that has not MOVED has not overruled anything. Movement is the
		// signal that the reader is driving, and the 700ms backstop already
		// covers the only case `down` was there for — a slide that never lands.
		track.addEventListener("pointermove", release, { passive: true });
		track.addEventListener("touchmove", release, { passive: true });
		return () => {
			track.removeEventListener("pointermove", release);
			track.removeEventListener("touchmove", release);
		};
	}, [release]);

	useEffect(() => release, [release]);

	// ⚠ THE ARM'S IDENTITY, AS A DEPENDENCY. Not `panes` itself — the array is a
	// fresh literal on every render, so it would re-arm the observer on every
	// keystroke in a sheet. The KEYS are what change when the arm does.
	const paneKeys = panes.map((pane) => pane.key).join("|");

	useEffect(() => {
		const track = trackRef.current;
		// jsdom ships no IntersectionObserver; the guard keeps the render path
		// usable under the component harness, where the observer is not the thing
		// under test.
		if (track === null || typeof IntersectionObserver === "undefined") {
			return;
		}
		const observer = new IntersectionObserver(
			(entries) => {
				// THE LARGEST RATIO IN THIS BATCH, not the last intersecting entry.
				let best: IntersectionObserverEntry | null = null;
				for (const entry of entries) {
					if (entry.intersectionRatio < 0.6) {
						continue;
					}
					if (
						best === null ||
						entry.intersectionRatio > best.intersectionRatio
					) {
						best = entry;
					}
				}
				const key =
					best === null ? undefined : (best.target as HTMLElement).dataset.pane;
				if (key === undefined) {
					return;
				}
				// D-1 — a programmatic scroll is in flight. Everything this observer
				// can see until it lands is the animation passing through, not a
				// reader changing their mind; the ONE report worth acting on is the
				// destination arriving, which is also what ends the mute.
				const heading = headingForRef.current;
				if (heading !== null) {
					if (key === heading) {
						release();
					}
					return;
				}
				onActiveChangeRef.current(key);
			},
			{ root: track, threshold: [0, 0.6, 1] },
		);
		// ⚠ OBSERVED BY THE DECLARED KEYS, not by whatever `[data-pane]` currently
		// matches — which is also what makes `paneKeys` a REAL dependency rather
		// than a re-arm trigger the linter has to be told to ignore. The two read
		// the same source, so the effect cannot observe a pane the props do not
		// declare, and it re-runs exactly when that set changes.
		for (const key of paneKeys.split("|")) {
			const pane = track.querySelector(`[data-pane="${key}"]`);
			if (pane !== null) {
				observer.observe(pane);
			}
		}
		return () => observer.disconnect();
	}, [paneKeys, release]);

	return (
		<div
			ref={trackRef}
			data-testid="phone-feed-track"
			// ⛔⛔ THIS TRACK IS CONTENT-HEIGHT AND IS **NOT** THE VERTICAL
			// SCROLLER'S PARENT — THE VERTICAL SCROLLER IS ITS ANCESTOR, AND THE
			// ORDER OF THOSE TWO IS THE MOST EXPENSIVE THING MOBILE-2d MEASURED.
			//
			// A bounded shell can put the vertical scroller in two places: INSIDE
			// this track (one scroller per pane, independent positions per side) or
			// ABOVE it (one scroller for the whole feed, the way the document used
			// to be). The first is the obvious design and it is the one that breaks:
			// with a vertical scroller nested inside the snap track, **a sideways
			// swipe that follows a vertical scroll moved nothing at all in 15 of 40
			// trials** — sampled every frame, not one pixel, not for one frame, so
			// it is a routing decision rather than a snap that returned. Measured
			// across four input paths (10/24/36 hand-dispatched touch moves and
			// Chrome's own `Input.synthesizeScrollGesture`), all four the same.
			// With the scroller ABOVE this element: **40 of 40**, on the same
			// machine, in the same session, with a no-prior-scroll control at 10/10
			// in both.
			//
			// ⇒ `overflow-y` lives on `PhoneDebateView`'s scroll region. This
			// element scrolls on ONE axis and has no height of its own to give.
			// ⚠ THE PRICE, STATED: both sides share one vertical position, and the
			// shorter side is padded out to the taller one's height. That is
			// exactly what the document-scroll model did before, so it is not a
			// regression — but it is a real property and it is not free.
			// ⛔ `overscroll-x-contain` — a swipe past the first or last pane stops
			// there instead of chaining out. What it chains INTO on a phone is the
			// browser's own horizontal overscroll navigation, so without it a
			// reader swiping for the other side at the first pane can leave the
			// page. The tier carries its own Back affordance in the title strip,
			// which is why taking this one away is affordable.
			// ⚠ `x` ONLY. This box does not scroll vertically, and a y-axis
			// containment on it would be the same mistake MOBILE-2d spent a commit
			// removing from the pane: a declaration on an axis the box cannot move
			// in.
			className="flex w-full min-w-0 snap-x snap-mandatory overflow-x-auto overflow-y-hidden overscroll-x-contain [touch-action:pan-x_pan-y] [scrollbar-width:none]"
		>
			{panes.map((pane) => (
				// ⚠ `role="tabpanel"` + `id` + `aria-labelledby` — the other half of
				// `PhoneSideTabs`' `aria-controls`. A tablist whose tabs control
				// nothing is a claim with no referent; these two files hold one
				// contract between them and `PANE_ID` is where its shape lives.
				<div
					key={pane.key}
					id={PANE_ID(pane.key)}
					role="tabpanel"
					aria-labelledby={`phone-tab-${pane.key}`}
					// ⚠ NO `tabIndex={0}`. The APG gives a tabpanel one only when it
					// holds nothing focusable — these hold post cards, their Support and
					// Counter triggers and their `Know more`, so a stop here would be a
					// stop on the way to a control rather than a way to reach content.
					// ⛔ A PURE SNAP ITEM. No `overflow`, no `overscroll-behavior`,
					// no `touch-action`, no height — every one of those was tried
					// here during MOBILE-2d and every one of them is recorded above
					// on the track as part of the same measurement. The vertical
					// scrolling this pane appears to need belongs to an ancestor;
					// putting it here is what made the sideways swipe unreliable.
					// ⚠ Two declarations are reliably FATAL on this element and are
					// named so nobody adds them back: `overscroll-behavior-x`
					// anything but `auto` (0 of 8), and `touch-action: pan-y` (0 of
					// 8) — both stop a horizontal gesture that begins on a card from
					// ever reaching the track, because `touch-action` is intersected
					// down the ancestor chain and containment on the inline axis
					// forbids the chain.
					data-pane={pane.key}
					data-testid={`phone-pane-${pane.key}`}
					className="w-full shrink-0 snap-start snap-always outline-none"
				>
					{pane.content}
				</div>
			))}
		</div>
	);
}
