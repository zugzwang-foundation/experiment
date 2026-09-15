"use client";

import { useRouter } from "next/navigation";
import {
	type RefObject,
	useCallback,
	useEffect,
	useRef,
	useState,
	useTransition,
} from "react";

import { isPageScrollLocked } from "../scroll-lock";

/**
 * ⛔⛔ MOBILE-2k · F-1 — THE FEED'S REPLACEMENT FOR PULL-TO-REFRESH, AND THAT IS
 * THE WHOLE REASON IT EXISTS RATHER THAN A CONVENIENCE.
 *
 * MOBILE-2d made this tier a bounded app shell: the tier root is
 * `h-[calc(100dvh-60px-2px)] overflow-hidden` and the DOCUMENT no longer
 * scrolls below 640px. A browser fires pull-to-refresh from an overscroll at the
 * top of the DOCUMENT — so the gesture every phone reader already knows silently
 * stopped existing on `/m/[slug]` the moment the shell became bounded. Nothing
 * reported it, because a gesture that does nothing is indistinguishable from a
 * page that has nothing new. This pill is that gesture, given a control.
 *
 * ⛔ IT CARRIES NO TOUCH OR POINTER HANDLER, AND THAT IS A WALL RATHER THAN A
 * STYLE. `phone-gesture-wall.test.ts` holds the phone tier's listeners as a
 * CLOSED allowlist for the reason the lane has a P0 in its history: momentum,
 * rubber-band, axis lock and snapping here are the BROWSER's, and gesture JS is
 * where they get broken. What this component registers is ONE `scroll` listener,
 * PASSIVE, on the feed region — a READ of where the reader already is. It
 * prevents nothing, moves nothing, and cannot take a scroll away from anything.
 * Adding its row to that allowlist is a decision, and it is recorded in
 * ADR-0051 A7 D-1.
 *
 * ⚠ AND IT IS THE FEED VIEW ONLY. On the thread arm (`?post=`) there is no pill:
 * a thread is short, its own back affordance is the title strip, and a refetch
 * there would be a refresh of a screen the reader navigated INTO. The gate is
 * the mount — `PhoneDebateView` renders this only while `focused === null` — so
 * there is no arm test inside the component to get backwards.
 */

/**
 * ⚠ TWO STRINGS, TWO STATES, AND NEITHER IS A VERB THE READER DID NOT ASK FOR.
 * `↑ Top` names the destination; `Refreshing…` names what is happening after
 * they asked. A single label that said `Refresh` would be a promise about the
 * scroll it also performs, and a spinner would be a second vocabulary on a
 * surface that has none.
 */
const LABEL_IDLE = "↑ Top";
const LABEL_BUSY = "Refreshing…";

/**
 * ⛔⛔ `CLOSE_MS` IS `PhoneSheet`'s, AND IT IS DUPLICATED HERE RATHER THAN
 * IMPORTED — WHICH IS THE OPPOSITE OF WHAT IT LOOKS LIKE.
 *
 * `PhoneSheet`'s own `CLOSE_MS` declares the same 200 and explains why it cannot
 * be a token: there is no motion token in this repository (`--dur-hover` is a
 * compound hover value), and the founder's 2026-09-12 Q4 ruling makes the close
 * brisker at 200.
 * ⚠ `PhoneSheet` attributes the 260 to `design-canon.md §5:109`, and that
 * attribution is INHERITED HERE RATHER THAN ENDORSED: §5:109 is real and does say
 * `.26 s`, but it ratifies it for the DESKTOP market-detail carousel's card
 * advance, not for phone sheet or pill motion. So the number's provenance on this
 * tier is `PhoneSheet`'s precedent — one surface's motion matching its own
 * neighbour — and not a canon clause about this surface. `@code-reviewer` named
 * it; recorded rather than propagated, because a second file asserting a
 * misattribution is how a misattribution becomes a fact.
 * ⚠ CITED BY SYMBOL (`CLOSE_MS`), never by line — `O-8`. This block named
 * `PhoneSheet.tsx:118`, which was right on the day and is a fence that goes stale
 * from the very edit it guards. The OPEN duration can only ever be a Tailwind class, because
 * Tailwind's scanner needs a LITERAL to emit `duration-[260ms]` at all —
 * interpolating a constant produces a utility that silently does not exist
 * (AGENTS.md §9's stale-utility trap).
 *
 * ⇒ So the pair is: 260 lives in the class and nowhere else; 200 lives in a
 * class AND in a constant, because JavaScript has to know how long to keep the
 * element mounted. Importing `PhoneSheet`'s private constant would make this
 * file depend on a sheet it has nothing to do with, to share a number that is
 * already written twice inside that file for reasons that apply here verbatim.
 * `phone-top-pill-motion.test.tsx` pins this constant against `PhoneSheet`'s by
 * reading both files, exactly as `phone-sheet-motion.test.tsx` pins that file's pair
 * — a comment asking the next reader to keep two numbers in step is not a
 * mechanism.
 */
const EXIT_MS = 200;

/**
 * How long the tap waits for the smooth scroll to land before refetching anyway.
 *
 * ⛔ THE TIMEOUT REFETCHES; IT DOES NOT ABANDON. The reader asked for "top, and
 * fresh". If the region has not reached 0 within a second — a very long
 * interruption, a finger that fought the animation, an engine that parked it —
 * dropping the refresh silently is the worse of the two failures: they get a
 * scroll that did not finish AND stale content, with nothing to tell them the
 * second half never happened. So the refetch fires on arrival OR on the
 * deadline, and EXACTLY ONCE either way, which is the property the guard pins.
 */
const ARRIVAL_DEADLINE_MS = 1000;

/** `scrollTop` is fractional on some engines; 0 is a range, not a value. */
const AT_TOP_PX = 1;

export function PhoneTopPill({
	regionRef,
	locked,
	busy,
}: {
	/**
	 * The tier's ONE vertical scroller — `PhoneDebateView`'s
	 * `phone-scroll-region`. ⛔ NOT `window`, and not by accident: the document
	 * does not scroll on this tier, so `window.scrollTo` is a no-op that reads as
	 * an action, and `phone-scroll-model.test.ts` rejects one outright.
	 */
	regionRef: RefObject<HTMLDivElement | null>;
	/**
	 * A sheet is up and holds the scroll lock. ⚠ REACTIVE, which is why it is a
	 * prop and not a call to `isPageScrollLocked()`: the refcount in
	 * `scroll-lock.ts` is a module-level integer, so a component reading it in
	 * render would never re-render when it moved. The host owns the sheet state;
	 * the host tells the pill.
	 */
	locked: boolean;
	/**
	 * A bet or sell is in flight in the composer.
	 *
	 * ⛔⛔ THE MONEY GUARD, AND THE FLAG IS GENUINELY REACHABLE — which is worth
	 * saying because the brief for this round allowed for it not being.
	 * `BetComposer` already publishes `onBusyChange`, `PhoneDebateView` already
	 * holds it as `composerBusy` for the seven host transitions that must not
	 * remount a composer mid-request, and this is the eighth consumer of the same
	 * fact.
	 *
	 * ⛔⛔ THE REAL GUARANTEE IS TOPOLOGICAL, NOT THE COMPOSER'S `key`, AND THIS
	 * DOCBLOCK ARGUED FROM THE WEAKER ONE. It said the `key` carries `kind`,
	 * `parentCommentId` and `side`, none of which a refresh changes — true, and
	 * beside the point: `PhoneDebateView` branches `viewer === null ?
	 * <AuthGateSlot/> : <BetComposer/>`, and `viewer` is SERVER data. A refresh
	 * that returns `viewer: null` — a session expiring mid-request — unmounts the
	 * composer, fires `onBusyChange(false)`, and leaves an in-flight `fetch` with
	 * no `AbortController`. That is the double-charge shape exactly, and the `key`
	 * argument does not see it.
	 * ⇒ What makes the pill safe is that **on THIS TIER the composer is mounted iff
	 * a sheet is open**, and `locked` is `sheet !== null` — so no interval exists in
	 * which a phone composer is mounted and `lockedRef.current` is `false`. The ref
	 * is written during the very render that creates the composer element, and this
	 * component sits EARLIER in tree order than the sheet, so the write happens
	 * before the composer exists at all, let alone before it can call `fetch`. No
	 * lane, microtask or frame gets between them. Found by `@code-reviewer`, which
	 * supplied the better argument; confirmed by `@security-auditor`, which tried to
	 * construct the interval six ways and could not.
	 *
	 * ⚠⚠ AND THE CLAIM IS ABOUT FIRING, NOT LANDING — a distinction this block first
	 * elided by saying "the pill cannot reach that path at all". Every refusal is
	 * evaluated when `router.refresh()` is CALLED. Nothing watches the ~700ms between
	 * that call and the payload arriving, so a reader can tap the pill with no sheet
	 * open, then open a composer and submit inside their own round trip, and the
	 * refresh lands under an in-flight bet. It survives because a landed refresh
	 * preserves client state — but if that render returns `viewer: null` the host
	 * flips to `AuthGateSlot`, the composer unmounts, and the un-aborted request
	 * still commits. `@security-auditor` (MEDIUM). ⇒ Closing it means gating a
	 * LANDING refresh the way `DebatePoll` is gated, or giving the composer an
	 * `AbortController`; both are larger than this control and are docketed at
	 * `docs/parked.md` 2k-7. ⚠ It is also NOT this round's creation: `DebatePoll`
	 * has the same landing window on a 30-second cadence (2k-8).
	 *
	 * ⚠ NOR IS `locked` A SUPERSET OF "A COMPOSER EXISTS ON THE PAGE". `DebateView`
	 * mounts a SECOND, independent `BetComposer` with its own `composerBusy`, and
	 * both trees are always mounted — only `display: none` separates them. So
	 * crossing 640px mid-flight (a rotation, a resize) can put this pill on screen
	 * with both flags `false` while the DESKTOP composer's request is live. No
	 * remount follows, so no charge follows, and the thing covering that case is the
	 * tier gate rather than either flag. ⛔ Which is why `busy` is NOT to be deleted
	 * as redundant: it is the only flag that would ever see a non-phone composer, and
	 * an earlier draft of this block called it redundant without that qualification —
	 * an open invitation to remove it. `@security-auditor` (LOW).
	 * ⚠ AND `busyRef` IS THE ONE FLAG WITH NO LIVE BACKSTOP. `lockedRef` is
	 * shadowed in the same condition by `isPageScrollLocked()`, which reads a module
	 * refcount and cannot be stale; `busyRef` has nothing beside it. If anyone later
	 * drives `onBusyChange` through a transition, a render-phase write becomes
	 * readable from a render React may discard — on the money guard.
	 */
	busy: boolean;
}) {
	const router = useRouter();

	/**
	 * ⚠ THE TRANSITION IS THE SETTLE SIGNAL. `router.refresh()` returns `void`, so
	 * there is no promise to await — but driven inside `startTransition` its
	 * `isPending` is true for exactly as long as the RSC payload is in flight.
	 * That is what lets the label go back and the pill leave when the refresh
	 * lands, rather than after a guessed delay.
	 * ⛔ AND THAT IS MEASURED, NOT ASSUMED — `@security-auditor` listed it as the one
	 * thing it could not establish by reading, and it is worth writing down because
	 * the whole control rests on it. With the RSC response held open for 700ms in a
	 * real browser, the `Refreshing…` label rendered across **46 consecutive animation
	 * frames** (≈770ms) and the pill left on the frame the payload landed. `isPending`
	 * spans the round trip. ⚠ The dependency runs the reassuring way: if it did NOT,
	 * the latch would clear early and the guards would get WEAKER, not stronger — so
	 * this is a fact the control needs rather than one it merely prefers.
	 */
	const [refreshing, startRefresh] = useTransition();

	/** Whether the rules below want the pill on screen. */
	const [shown, setShown] = useState(false);
	/**
	 * ⚠ MOUNTED THROUGH THE EXIT, which `shown` alone cannot express: an element
	 * removed on the frame it stops being wanted has no exit animation, and the
	 * brief's 6px lift would never be seen. `PhoneSheet` carries the same latch
	 * for the same reason.
	 */
	const [leaving, setLeaving] = useState(false);

	const lastScrollTop = useRef(0);
	const rafRef = useRef<number | null>(null);
	/**
	 * ⛔ ONE REFETCH PER TAP — AND THE REASON WRITTEN HERE FIRST WAS IMPOSSIBLE,
	 * WHICH IS WORTH RECORDING RATHER THAN QUIETLY REPHRASING.
	 *
	 * It said: "the arrival poll and the deadline are two paths to the same call,
	 * and a frame in which both are true would fire twice." They are not two paths.
	 * `tick` is ONE `if (arrived || expired) { refetchOnce(); return; }` — one
	 * branch, one call, and a `return` — so that frame cannot exist, and no
	 * single-tap test can redden this latch. `@test-writer` measured exactly that
	 * and said so.
	 *
	 * ⇒ What it actually guards is a poll that outlives the refresh it started: a
	 * frame callback queued before a refetch settled, still holding a live
	 * `regionRef`, reaching `refetchOnce` after the transition has cleared and
	 * `evaluate` has resumed. It is also what keeps a FUTURE third arrival signal —
	 * a `scrollend` listener, say, added beside the poll as the obvious improvement
	 * — from turning one intent into two payload fetches. A latch whose stated job
	 * is unreachable is a latch the next reader deletes; this one earns its place on
	 * the second ground, not the first.
	 * ⚠ `refreshing` cannot be that latch either way: React sets it on the
	 * transition, one tick later than the call.
	 * ⚠ AND ITS RESET HAS ONE EDGE AND NO TIMEOUT. It is lowered only on
	 * `refreshing` going true→false. A `router.refresh()` transition that never
	 * settles therefore leaves the latch armed AND `evaluate` standing down on
	 * `refreshingRef`, so the pill does not merely stop refetching — it stays ON
	 * SCREEN reading `Refreshing…` indefinitely, with `onTap` refusing on
	 * `refreshing`. The direction is right (it fails CLOSED, refetching nothing) and
	 * the bound is missing. Not reachable through any tested path; said here rather
	 * than discovered later. `@code-reviewer` found the latch half and
	 * `@security-auditor` the on-screen half.
	 */
	const firedForThisTap = useRef(false);
	/**
	 * ⚠ `refreshing` MIRRORED INTO A REF so `evaluate` can read it without taking
	 * it as a dependency. The listener is attached in an effect keyed on
	 * `evaluate`; a dependency on a value that flips twice per tap would detach and
	 * re-attach the scroll listener in the middle of the scroll it is watching.
	 */
	const refreshingRef = useRef(false);
	refreshingRef.current = refreshing;
	/**
	 * ⚠ `locked` AND `busy` MIRRORED FOR THE SAME REASON, and used at a moment the
	 * props themselves cannot reach: inside a `requestAnimationFrame` callback that
	 * was queued up to a second ago and closed over the values of that frame. The
	 * refs are what let it read NOW.
	 */
	const lockedRef = useRef(locked);
	lockedRef.current = locked;
	const busyRef = useRef(busy);
	busyRef.current = busy;

	/**
	 * ⛔⛔ THE VISIBILITY RULE, IN ONE PLACE, DRIVEN BY POSITION AND DIRECTION.
	 *
	 * · above ONE viewport AND moving UP  → show. The reader has gone far enough
	 *   that the top is no longer on screen, and is heading back toward it.
	 * · moving DOWN                       → hide. They are reading.
	 * · below HALF a viewport              → hide, whatever the direction.
	 *
	 * ⚠ THE TWO THRESHOLDS ARE DIFFERENT ON PURPOSE, AND THE GAP IS THE WHOLE
	 * MECHANISM. Show at `> 1 × viewport`, hide at `< 0.5 × viewport`: between
	 * them nothing changes, so a reader hovering at the boundary cannot make the
	 * pill blink. One shared threshold would flicker on every pixel of jitter,
	 * which on a momentum scroller is every frame.
	 */
	const evaluate = useCallback(() => {
		const region = regionRef.current;
		if (region === null) {
			return;
		}
		const top = region.scrollTop;
		const previous = lastScrollTop.current;
		lastScrollTop.current = top;
		/**
		 * ⛔⛔ THE RULE STANDS DOWN WHILE THE PILL'S OWN TAP IS RUNNING, AND THIS
		 * WAS A MEASURED DEFECT RATHER THAN A PRECAUTION.
		 *
		 * The tap smooth-scrolls the region to 0 — which fires scroll events, which
		 * reach this function, which sees the position fall below half a viewport
		 * and hides the pill. So the pill left the screen DURING its own scroll,
		 * before the refetch it had started even began. Measured on the shipped
		 * build with a 700ms-delayed RSC response: the `Refreshing…` label appeared
		 * for **one frame out of ~96**, so in practice a reader never saw that
		 * anything had been refreshed at all — the control did its work and then
		 * vanished as if nothing had happened.
		 *
		 * ⇒ While the arrival poll is running (`rafRef`) or the refetch is in flight
		 * (`refreshingRef`), position and direction are MINE rather than the
		 * reader's, and the rule has no business reading them. Both windows close on
		 * their own — the poll ends at its deadline, the transition settles — and the
		 * `refreshing` effect calls this function again the moment the second one
		 * does, so the pill leaves exactly when the refresh lands and not before.
		 *
		 * ⚠ `lastScrollTop` IS STILL UPDATED ABOVE, DELIBERATELY. Skipping it would
		 * leave the reference at wherever the reader was before the tap, and the
		 * first real scroll after the refresh would compute its direction against a
		 * position that is a whole screen away — reading as a huge upward movement
		 * and showing the pill at the top of the feed.
		 */
		if (rafRef.current !== null || refreshingRef.current) {
			return;
		}
		const viewport = region.clientHeight;
		if (top < viewport * 0.5) {
			setShown(false);
			return;
		}
		if (top > previous) {
			setShown(false);
			return;
		}
		if (top < previous && top > viewport) {
			setShown(true);
		}
	}, [regionRef]);

	/**
	 * ⛔ ONE PASSIVE `scroll` LISTENER ON THE REGION. `{ passive: true }` is
	 * declared even though a `scroll` event is not cancelable and a
	 * `preventDefault` inside one would do nothing: the option is what makes
	 * "this handler cannot take scrolling away" a STRUCTURAL fact a scan can read,
	 * rather than a property of the handler's current body. `phone-gesture-wall`'s
	 * passive census was widened to cover `scroll` in the same commit for exactly
	 * that reason.
	 */
	useEffect(() => {
		const region = regionRef.current;
		if (region === null) {
			return;
		}
		// ⚠ SEEDED FROM THE ELEMENT, NOT FROM 0. The region can already be scrolled
		// on mount — a back navigation restores its position — and a first event
		// compared against 0 reads as downward movement from the top, which is a
		// direction the reader never travelled.
		lastScrollTop.current = region.scrollTop;
		region.addEventListener("scroll", evaluate, { passive: true });
		return () => region.removeEventListener("scroll", evaluate);
	}, [regionRef, evaluate]);

	/**
	 * ⚠ RE-EVALUATED ON UNLOCK, AND THE SEED IS THE POINT. While a sheet is up
	 * `scroll-lock.ts` holds the region at `overflow: hidden`, so no scroll event
	 * fires and `lastScrollTop` is whatever it was before the sheet opened — which
	 * the lock's own restore may have moved since. Re-seeding on unlock makes the
	 * next event's DIRECTION honest, and `evaluate` then applies the position
	 * floor. It cannot spontaneously show the pill: showing requires upward
	 * movement, and one call with a freshly-seeded reference has none.
	 */
	useEffect(() => {
		if (locked) {
			return;
		}
		evaluate();
	}, [locked, evaluate]);

	/**
	 * ⚠ THE REFRESH SETTLING IS WHAT TAKES THE PILL AWAY, and it needs no rule of
	 * its own: the scroll landed at 0, so the position floor already says hide.
	 * This is the one place that has to ASK, because `evaluate` runs on scroll
	 * events and a refresh produces none.
	 */
	const wasRefreshing = useRef(false);
	useEffect(() => {
		if (wasRefreshing.current && !refreshing) {
			firedForThisTap.current = false;
			evaluate();
		}
		wasRefreshing.current = refreshing;
	}, [refreshing, evaluate]);

	/**
	 * ⛔ THE EXIT LATCH — ONE EFFECT KEYED ON `shown` ALONE, AND THE SHAPE IS
	 * DELIBERATE. It was two effects (one to raise `leaving`, one to lower it on a
	 * timer) and the second had to READ `leaving` to know whether a timer was
	 * owed — which `useExhaustiveDependencies` correctly objects to, because a
	 * dependency on the state a timer resolves is a timer that restarts itself.
	 * ⇒ The "was it on screen" fact lives in a ref instead, so the effect reads
	 * only its dependency and the latch cannot re-arm from its own resolution. A
	 * `biome-ignore` would have silenced the rule while leaving the shape the rule
	 * was pointing at.
	 */
	const everShown = useRef(false);
	useEffect(() => {
		if (shown) {
			everShown.current = true;
			setLeaving(false);
			return;
		}
		if (!everShown.current) {
			return;
		}
		everShown.current = false;
		setLeaving(true);
		const t = window.setTimeout(() => setLeaving(false), EXIT_MS);
		return () => window.clearTimeout(t);
	}, [shown]);

	const cancelPoll = useCallback(() => {
		if (rafRef.current !== null) {
			cancelAnimationFrame(rafRef.current);
			rafRef.current = null;
		}
	}, []);

	/**
	 * ⛔ AN IN-FLIGHT TAP IS ABANDONED THE MOMENT A SHEET OPENS OR THE COMPOSER GOES
	 * BUSY. The reader has moved on to something else; the scroll they asked for is
	 * no longer the thing they are doing, and a refresh that arrives under a sheet
	 * they have since opened is a surprise at best. See `refetchOnce` for the
	 * measurement — the poll survives `locked` because returning `null` from render
	 * does not unmount a component, so without this the frame callback simply keeps
	 * counting down behind the sheet.
	 */
	useEffect(() => {
		if (locked || busy) {
			cancelPoll();
		}
	}, [locked, busy, cancelPoll]);

	/** Cancel any in-flight arrival poll on unmount. */
	useEffect(() => cancelPoll, [cancelPoll]);

	/**
	 * ⛔⛔ THE REFUSALS ARE RE-CHECKED HERE, AT FIRE TIME, AND NOT ONLY AT TAP TIME
	 * — WHICH IS A DEFECT `@test-writer` FOUND AND MEASURED.
	 *
	 * `onTap` refuses under `refreshing`, `busy`, `locked` and
	 * `isPageScrollLocked()`. But a tap does not refetch: it starts a scroll and an
	 * arrival poll that fires **up to a second later**, and the first cut consulted
	 * nothing at that point. So the world had a full second to change underneath
	 * it, and the render gate does not stop it — `locked` makes this component
	 * return `null`, which does NOT unmount it, so the poll survives the sheet
	 * opening with its closure intact.
	 *
	 * ⚠ IT IS ONE TAP AWAY, NOT A CONTRIVANCE. Tap the pill; the feed begins its
	 * smooth scroll; tap the market title or the bet bar — well inside a second, on
	 * a surface where that is an ordinary thing to do — and a `router.refresh()`
	 * lands underneath an open sheet. Measured at `94fac4ba`:
	 * `router.refresh()` calls past the deadline with `locked` true: **1**. With
	 * `busy` true: **1**. The second is the one that matters, because `busy` is the
	 * flag this file's own docblock calls the money guard, and a refresh under an
	 * in-flight bet is the shape the seven host transitions in `PhoneDebateView`
	 * exist to prevent.
	 *
	 * ⇒ Two changes, and both are needed. The poll is CANCELLED the moment either
	 * flag rises (the effect below), so an abandoned tap stops costing frames; and
	 * the refusals are re-read through refs HERE, so a callback already queued for
	 * this frame still cannot fire. The first is the mechanism and the second is
	 * what makes it hold against a frame that was in flight when the flag changed.
	 *
	 * ⚠ AN ABANDONED TAP LEAVES THE LATCH DOWN, deliberately: nothing fired, so a
	 * later tap is a new intent and must work. Setting `firedForThisTap` on refusal
	 * would silently disarm the control until the next refresh settled.
	 */
	const refetchOnce = useCallback(() => {
		if (firedForThisTap.current) {
			return;
		}
		if (lockedRef.current || busyRef.current || isPageScrollLocked()) {
			return;
		}
		firedForThisTap.current = true;
		startRefresh(() => {
			router.refresh();
		});
	}, [router]);

	const onTap = useCallback(() => {
		const region = regionRef.current;
		if (region === null) {
			return;
		}
		/**
		 * ⛔⛔ FOUR REFUSALS, AND THE ORDER IS THE CHEAPEST-FIRST READING OF THE
		 * SAME RULE: do not refetch under anything that could be mid-write, and do
		 * not refetch twice for one intent.
		 *
		 * · `refreshing` — a second tap during a refresh is a no-op. Without it a
		 *   reader tapping twice gets two payload fetches for one intent.
		 * · `busy` — a bet or sell is in flight. See the prop's own docblock.
		 * · `locked` / `isPageScrollLocked()` — a sheet is up. The pill is not on
		 *   screen while it is, so this is unreachable by pointer today; it is here
		 *   because the render gate and the lock are two different facts, and the
		 *   day they disagree this is the one that is still correct.
		 */
		if (refreshing || busy || locked || isPageScrollLocked()) {
			return;
		}
		/**
		 * ⛔ THE CANCEL COMES FIRST, AND IT USED TO SIT BELOW THE AT-TOP BRANCH —
		 * WHICH LEFT AN ARMED POLL ALIVE ON THE ONE PATH THAT RETURNS EARLY.
		 * `@security-auditor` found it: a second tap landing after the region has
		 * reached the top but before the previous `tick` has run took the at-top
		 * branch, refetched, and returned — past the cancel — leaving the earlier
		 * frame callback scheduled. The only brake was `firedForThisTap`, and that
		 * latch is lowered when the refresh settles, so a payload that settles inside
		 * one frame would let the stale `tick` fire a SECOND RSC fetch for one intent.
		 * Cost only — the stale call still re-reads all three money refusals — but a
		 * second payload per intent is the exact property this control promises not to
		 * have. Cancelling before either branch makes the promise structural.
		 */
		if (rafRef.current !== null) {
			cancelAnimationFrame(rafRef.current);
			rafRef.current = null;
		}
		if (region.scrollTop <= AT_TOP_PX) {
			// Already at the top — there is no scroll to wait for, only the refresh.
			refetchOnce();
			return;
		}
		const reduced =
			window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
		/**
		 * ⛔ THE REGION, BY NAME. `scrollTo` on the element the host handed us —
		 * never `window`, never `scrollIntoView` on a card. Both of those are
		 * rejected by `phone-scroll-model.test.ts` because the document does not
		 * scroll here, so either one is a no-op that reads as an action.
		 * ⚠ `behavior: "auto"` under reduced motion is the ruled instant scroll, and
		 * `(prefers-reduced-motion: reduce)` is the only `matchMedia` query this tier
		 * is allowed (`phone-market-detail.test.ts`).
		 * ⛔ OPTIONALLY CALLED, AND THIS LINE ONCE CLAIMED PARITY IT DID NOT HAVE. It
		 * said "the same `matchMedia` read `ComposerSlot` and `PhoneSheet` already
		 * make" while calling `window.matchMedia(…)` bare — and both siblings guard
		 * it: `ComposerSlot.tsx:64` uses `window.matchMedia?.(…)` and
		 * `PhoneSheet.tsx:304` a `typeof … === "function"` test. The read sits inside
		 * `onTap`, so an absent `matchMedia` throws ON THE TAP. Nil risk in any target
		 * browser — but jsdom ships none at all, which is why every test of this tap
		 * needs a stub the two siblings would not have required, and a false parity
		 * claim is exactly the kind of reassurance that stops the next reader
		 * checking. Caught by `@code-reviewer`.
		 */
		region.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
		/**
		 * ⛔⛔ ARRIVAL IS POLLED ON `requestAnimationFrame`, NOT AWAITED ON
		 * `scrollend`. `scrollend` is the obvious answer and it is not portable:
		 * Safari's support is uneven, and a refresh that silently never fires on
		 * one engine is the worst shape this control could take — the reader taps,
		 * the feed goes to the top, and nothing is new, forever, with no error
		 * anywhere. A frame poll answers the same question everywhere, and the
		 * deadline above bounds it.
		 */
		const startedAt = performance.now();
		/**
		 * ⛔⛔ `rafRef` IS HELD NON-NULL ACROSS `refetchOnce`, AND NULLED ONLY AFTER
		 * IT — WHICH IS NOT TIDINESS. It was cleared at the TOP of this callback, and
		 * `@security-auditor` found what that opened on the DEADLINE path: there the
		 * region is still animating when the deadline fires, so `rafRef` was already
		 * `null` while `refreshing` had not yet been committed by React — and
		 * `evaluate` stands down on exactly those two terms. A `scroll` event in the
		 * next frame (the rendering steps run scroll BEFORE rAF) therefore reached the
		 * rule with both false and hid the pill mid-refresh. That is the same defect
		 * `94fac4ba` was written to close, on the one branch it did not cover.
		 * ⇒ Holding the handle until after the call leaves no frame in which neither
		 * term is true: the two windows now abut inside one synchronous block, with no
		 * yield to the event loop between them.
		 */
		const tick = () => {
			const node = regionRef.current;
			if (node === null) {
				rafRef.current = null;
				return;
			}
			if (
				node.scrollTop <= AT_TOP_PX ||
				performance.now() - startedAt >= ARRIVAL_DEADLINE_MS
			) {
				refetchOnce();
				rafRef.current = null;
				return;
			}
			rafRef.current = requestAnimationFrame(tick);
		};
		rafRef.current = requestAnimationFrame(tick);
	}, [regionRef, refreshing, busy, locked, refetchOnce]);

	/**
	 * ⛔ THE LOCK HIDES IT UNCONDITIONALLY AND WITHOUT AN EXIT. A sheet is a
	 * full-viewport layer; nobody can see the pill leave, so animating it out
	 * would be 200ms of work behind a backdrop. Returning `null` also guarantees
	 * the control is not merely invisible but ABSENT — no tab stop behind a modal,
	 * which is the half of a hidden control that keyboard users actually hit.
	 */
	if (locked || (!shown && !leaving)) {
		return null;
	}

	return (
		/**
		 * ⛔⛔ POSITIONED AGAINST THE HEADER BLOCK, NOT AGAINST THE TIER ROOT — and
		 * `top-full` is why the 12px is structural rather than a magic number.
		 *
		 * "12px under the YES/NO tabs" is a distance from the BOTTOM of a box whose
		 * height nothing can know: the title strip wraps to one, two or three lines
		 * depending on the market question. `top-full` is 100% of the containing
		 * block, i.e. exactly that bottom edge, whatever it turns out to be; `mt-3`
		 * is the 12px. An absolute `top-[N]` against the tier root would have to
		 * name a number that is wrong for every question but one.
		 *
		 * ⛔ AND THE Z-ORDER IS INHERITED RATHER THAN DECLARED. The header block
		 * carries `z-30` and is a flex item, so it is a stacking context: this pill
		 * paints above the feed region (a later sibling at `z-auto`) because its
		 * PARENT does, and below `PhoneSheet` (`fixed z-50`) for the same reason. A
		 * `z-*` token here would resolve inside its parent's context and say
		 * nothing about either relationship — the mount site is the mechanism.
		 * `phone-top-pill.test.tsx` asserts the pair rather than a token.
		 */
		<button
			type="button"
			data-testid="phone-top-pill"
			data-phase={leaving ? "leaving" : "open"}
			// ⚠ NAMED BY THE DESTINATION IN BOTH STATES. `aria-live` is deliberately
			// absent: the label change is the consequence of the reader's own tap, and
			// announcing it is the kind of politeness that interrupts.
			aria-label={refreshing ? LABEL_BUSY : LABEL_IDLE}
			// ⚠ `aria-busy` RATHER THAN `aria-live`, and the distinction is the whole
			// reason there is an attribute here at all. A live region ANNOUNCES, which
			// interrupts a reader for a consequence of their own tap; `aria-busy` is a
			// STATE on the control they just pressed, read when they return to it. The
			// button deliberately stays enabled — `onTap` no-ops while refreshing — so
			// without this a screen-reader user gets no signal that the tap was
			// accepted at all. `@code-reviewer` (LOW).
			aria-busy={refreshing}
			onClick={onTap}
			/**
			 * ⛔⛔ 36px PAINTED, 44px TAPPABLE, AND THE EXTENSION IS A
			 * PSEUDO-ELEMENT. `h-9` is the visual; `after:-top-1` / `after:-bottom-1`
			 * add 4px each side — 36 + 4 + 4 = 44 — at the HIT-TESTING layer, so
			 * nothing listens and nothing is prevented. Growing the box to 44 would
			 * have made a pill that reads as a button bar; `round5::the-pill-is-32px`
			 * already established this shape two components over, for the same
			 * reason.
			 * ⛔ NO `after:pointer-events-none`. It paints the identical rectangle
			 * and takes no taps, which collapses the target back to 36px with every
			 * token assertion still green — measured on the Support/Counter pill
			 * before its guard existed.
			 *
			 * ⚠ 13px WITH ITS LEADING STATED. An arbitrary `text-[13px]` inherits
			 * whatever line-height was in scope — `text-xs`'s 16px here — and
			 * `leading-normal` is CSS `1.5`, not the `normal` KEYWORD's ~1.2
			 * (AGENTS.md §8). The figure is stated so the pill's height is `h-9` and
			 * not `h-9`-plus-whatever-the-cascade-had.
			 *
			 * ⚠ NO SHADOW, NO BLUR, NO COLOUR. `bg-card` is `--color-n0` (#212121),
			 * the hairline is the shared `--hairline`, the text is `--color-ink`.
			 * This product is black, white and hairlines; a floating control is
			 * exactly where a backdrop-blur would arrive if nobody said not to.
			 */
			className={`absolute top-full left-1/2 mt-3 flex h-9 -translate-x-1/2 items-center justify-center rounded-full bg-card px-4 text-[13px] leading-[1.2] text-ink shadow-none [border:var(--hairline)] after:absolute after:inset-x-0 after:-top-1 after:-bottom-1 after:content-[''] ${
				leaving
					? "pointer-events-none animate-out fade-out-0 slide-out-to-top-[6px] duration-[200ms] ease-in motion-reduce:slide-out-to-top-0"
					: "animate-in fade-in-0 slide-in-from-top-[6px] duration-[260ms] ease-out motion-reduce:slide-in-from-top-0"
			}`}
		>
			{refreshing ? LABEL_BUSY : LABEL_IDLE}
		</button>
	);
}
