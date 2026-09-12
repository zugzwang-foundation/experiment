"use client";

import {
	type ReactNode,
	type PointerEvent as ReactPointerEvent,
	useCallback,
	useEffect,
	useId,
	useRef,
	useState,
} from "react";

/**
 * The phone's one overlay primitive — the bottom sheet that stands in for the
 * desktop's opposite composer slot, and carries the details and parent-post
 * screens as well.
 *
 * ⛔⛔ IT IS AN OVERLAY ON THE MARKET, NEVER A PAGE (ADR-0050 A2, D-3) — AND THE
 * VERSION THAT WAS A PAGE IS WHAT MADE THE PHONE LOOK DEAD.
 *
 * It used to take a `fullHeight` prop, and `PhoneDebateView` passed
 * `viewer !== null` — so the sheet was `h-full` for exactly the readers who can
 * bet. Measured on a Pixel-class Chromium with real synthesized touch:
 *
 *   panel rect        {x:0, y:0, w:393, h:727}   ← the entire viewport
 *   backdrop rect     {x:0, y:0, w:393, h:727}   ← the same rect, BEHIND the panel
 *   exposedBackdrop   null                        ← not one reachable pixel
 *
 * A phone reader dismisses a sheet by tapping beside it. There was nothing
 * beside it. So the tap did nothing, the sheet stayed, and because the sheet is
 * `fixed inset-0` over a `body{overflow:hidden}` page, the reader then found
 * that **vertical scrolling and the YES/NO tabs had both stopped working** — two
 * symptoms of one modal that they had no way to know was still up. That is the
 * whole of MOBILE-2c's P0, and the details sheet never showed it because
 * `max-h-[96dvh]` leaves its own backdrop exposed.
 *
 * ⚠ NOT AN ANDROID DEFECT. It reproduces identically on WebKit iPhone 13, on
 * Chromium at 360, 393 and 430, and in the thread arm. Android is where it was
 * noticed, not where it lived.
 *
 * ⇒ There is one shell and no height prop: content-height, bottom-anchored,
 * `max-h-[92dvh]`, and therefore always something beside it to tap.
 * `phone-sheet-dismissal.test.tsx` asserts the backdrop is HIT-TESTABLE above
 * the panel rather than merely present, because "the backdrop exists" was true
 * the whole time this was broken.
 *
 * ⛔⛔ IT REFUSES TO CLOSE WHILE `busy`, AND THAT IS A MONEY RULE WEARING A UI
 * COSTUME. `DebateView` records why (`:157-160`): while a composer request is in
 * flight, every host path that would unmount it no-ops, because a mid-request
 * unmount followed by a re-open mints a FRESH idempotency key over a bet that
 * may already be committing — i.e. it converts a retry into a second charge. The
 * desktop enforces that by making its entry toggles no-op; a sheet has three
 * more doors than a slot does (`×`, Escape, the backdrop) and now a fourth (the
 * handle swipe), so all four are shut by the same flag rather than by
 * remembering to guard each one.
 *
 * ⚠ ESCAPE IS A DOCUMENT LISTENER, NOT `onKeyDown` ON THE PANEL. Focus may be
 * inside `BetComposer`'s textarea, which stops propagation of nothing but
 * receives the event first; a panel-scoped handler fires only while the panel
 * itself is focused, which is almost never.
 *
 * ⚠ BODY SCROLL IS LOCKED WHILE OPEN and restored to whatever it was, not to
 * `""`. A page that sets its own `overflow` would otherwise be silently reset by
 * the first sheet a reader opens.
 *
 * ⛔⛔ `aria-modal` IS A CLAIM; CONTAINMENT IS THE MECHANISM — and the first cut
 * made the claim without the mechanism. It declared `role="dialog"
 * aria-modal="true"` and performed NO focus management at all: focus was not
 * moved in, not contained, not restored, and the background was neither `inert`
 * nor `aria-hidden`. `aria-modal` constrains a screen reader's virtual cursor
 * and has no effect whatever on Tab, so a keyboard or AT user was told the
 * background was inert and could then tab straight into it.
 *
 * ⚠ THAT WAS NOT ONLY AN A11Y DEFECT, WHICH IS WHY IT IS FIXED HERE RATHER THAN
 * DOCKETED. The busy argument below rests on this sheet actually being modal:
 * on the thread arm the OTHER relation button sat one Tab from the submit, so a
 * keyboard user could remount the composer mid-request and mint a fresh
 * idempotency key over a committing bet. The host now guards that path too
 * (`PhoneDebateView`'s `guard`), so the two fixes are belt and braces — but a
 * dialog that lets Tab out is a defect on its own terms. Found by both
 * reviewers.
 *
 * ⚠ STILL NOT `ui/dialog.tsx`. The shadcn dialog is a Radix portal with overlay
 * animation and `asChild` seams; ⛔ and the portal is the specific reason, not
 * the machinery: Radix renders to `document.body`, OUTSIDE the 640px tier gate
 * this whole subtree depends on. The gate is a property of DOM POSITION, and a
 * portal leaves the DOM position. What is borrowed from it is the focus
 * discipline, implemented here in about twenty lines — and now its animation
 * vocabulary too, which is `tw-animate-css` and is already in the build.
 */

/**
 * ⚠ 260ms IS CANON AND 200ms IS RULED — and neither is a token, because there
 * is no motion token in this repository to be. `design-canon.md §5:109`
 * ratifies `.26 s` for this surface's own motion, and `ComposerSlot.tsx:55`
 * already declares the same literal as `EXIT_MS = 260` for a composer
 * appearing. The only duration custom property that exists is
 * `--dur-hover: 0.12s ease` (`globals.css:261`), which is a compound hover
 * value and not a slide. The faster close is the founder's 2026-09-12 Q4
 * ruling: a sheet should leave more briskly than it arrives.
 *
 * ⚠ ONLY THE CLOSE IS A CONSTANT, AND THE ASYMMETRY IS FORCED. `CLOSE_MS` is
 * read by JavaScript — it is how long `onClose` is deferred — so it has to be a
 * value. The OPEN duration is only ever a Tailwind class, and Tailwind's
 * scanner needs a LITERAL in the source to emit `duration-[260ms]` at all;
 * interpolating a constant into the class string produces a utility that
 * silently does not exist, which is AGENTS.md §9's stale-utility trap in its
 * purest form. So 260 lives in the class and nowhere else, and there is nothing
 * for it to fall out of sync with.
 *
 * ⛔ `CLOSE_MS` HAS THE OPPOSITE PROBLEM: it appears twice — here, and as
 * `duration-[200ms]` on the panel below. `phone-sheet-motion.test.tsx` pins the
 * two together by reading this file, because a close that animates for 200ms
 * and unmounts after 260 is a flicker nobody would think to look for, and a
 * comment asking the next reader to keep two numbers in step is not a mechanism.
 */
const CLOSE_MS = 200;

/**
 * Swipe-down-to-dismiss (R-4). Either bound closes: a long enough drag, or a
 * short flick fast enough to mean it. ⚠ The velocity arm is what makes the
 * gesture feel like a phone rather than like a slider — without it a reader who
 * flicks 40px in 60ms gets a snap-back, which reads as the sheet refusing.
 */
const SWIPE_CLOSE_PX = 80;
const SWIPE_CLOSE_VELOCITY = 0.5; // px per ms

export function PhoneSheet({
	open,
	title,
	busy,
	titleHidden,
	onClose,
	children,
}: {
	open: boolean;
	title: string;
	/** A composer request is in flight — every door is shut until it lands. */
	busy: boolean;
	/**
	 * ⚠ THE TITLE IS HIDDEN, NEVER DROPPED, when the content carries its own
	 * heading. `BetComposer` and `AuthGateSlot` both open with their own — so the
	 * sheet printed `Place your Đ BET` directly above `Place your Đ BET`, and
	 * `Sign in to bet YES` above itself. Deleting the string instead would take
	 * the dialog's ACCESSIBLE NAME with it, which is the one a screen reader
	 * announces on open and the one thing here that is not decoration. `sr-only`
	 * keeps the name and drops the duplicate words.
	 *
	 * ⛔ IT NOW ALSO DECIDES WHETHER THIS FRAME DRAWS A `×` (R-8). The two are
	 * the same question asked once: content that brings its own heading brings
	 * its own close control with it, and the sheet was drawing a second one 51px
	 * above `BetComposer`'s — two adjacent controls with the identical accessible
	 * name `Close`. The read-only sheets (`details`, `parent`) carry no header of
	 * their own, so for them this frame IS the header and keeps the one `×`.
	 */
	titleHidden?: boolean;
	onClose: () => void;
	children: ReactNode;
}) {
	// A stable id per mounted sheet — `useId` rather than a literal, because two
	// sheets can be in the tree at once (the details host stays mounted once
	// opened) and two nodes sharing an id make `aria-labelledby` ambiguous.
	const headingId = useId();
	const closeRef = useRef(onClose);
	closeRef.current = onClose;
	const busyRef = useRef(busy);
	busyRef.current = busy;

	const panelRef = useRef<HTMLDivElement>(null);

	/**
	 * ⛔⛔ THE CLOSE IS ANIMATED BY DEFERRING `onClose`, NOT BY HOLDING A CORPSE.
	 *
	 * This component returns `null` when `!open` and `PhoneDebateView`
	 * additionally stops rendering the composer element altogether, so there are
	 * two synchronous unmount paths and neither leaves a window to animate in.
	 * `ComposerSlot` solves the same problem by keeping the outgoing element
	 * mounted for `EXIT_MS` — but that would keep `BetComposer` alive after the
	 * reader has dismissed it, on the surface that takes money, and the whole
	 * `busy` argument above is about not having a live composer the host has
	 * stopped believing in.
	 *
	 * ⇒ Every door sets `leaving`, the panel slides down, and `onClose()` is
	 * called when the animation ends. The parent is not told until then, so the
	 * element stays mounted for the whole slide while holding nothing. The
	 * trade-off is real and is the right one: a close is ~200ms later than the
	 * tap, which is what an animated close means.
	 */
	const [leaving, setLeaving] = useState(false);
	const leaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	/**
	 * ⛔⛔ THE IDEMPOTENCY LATCH IS `leaving` ITSELF, AND IT USED TO BE A SEPARATE
	 * `closedRef` THAT NOTHING EVER RESET — which reintroduced this task's own P0
	 * on a different route. `@security-auditor` found it and the path needs no
	 * race:
	 *
	 * Two of the three `PhoneSheet` mount sites OUTLIVE an open/close cycle —
	 * `detailsMounted` only ever becomes `true`, and `focused !== null` is stable
	 * for the whole thread arm — so `if (!open) return null` hides those
	 * instances WITHOUT unmounting them. React keeps the state. So: open the
	 * details sheet, dismiss it (the gesture this whole task exists to make
	 * work), and the instance is left with `leaving: true` and the latch set.
	 * Open it again and it renders ALREADY LEAVING: the root carries
	 * `pointer-events-none`, the panel carries `animate-out`, `tw-animate-css`
	 * leaves fill-mode at `none` so the panel snaps back fully visible — and
	 * every door is gone. Backdrop, `×` and handle are un-hit-testable; Escape
	 * reaches `beginClose` and returns on the latch. **A visible modal that will
	 * not close, over a page whose scroll is locked.** Reload only.
	 *
	 * ⚠ AND THE `prefers-reduced-motion` ARM WAS STRICTLY WORSE, because it set
	 * the latch and never set `leaving`: the second open looked and behaved
	 * completely normal, with no animation and full pointer events, and no door
	 * worked. Nothing on screen would have told the reader why.
	 *
	 * ⇒ Idempotency is now derived from `leaving`, which is per-CLOSE rather than
	 * per-instance, mirrored into a ref so `beginClose` can stay a stable
	 * callback. The reduced-motion arm needs no latch at all: it calls `onClose`
	 * synchronously, `open` goes false in the same commit, and this component
	 * returns `null` — there is no second door left to push.
	 */
	const leavingRef = useRef(false);
	leavingRef.current = leaving;

	/**
	 * ⛔ A NEW OPEN IS A NEW SHEET, even when React has kept the instance.
	 * Adjusted during render rather than in an effect, deliberately: an effect
	 * runs AFTER the commit, so the first painted frame of the second open would
	 * be the stale leaving frame — a flash of a sheet sliding out at the moment
	 * the reader asked for one to slide in.
	 */
	const prevOpenRef = useRef(open);
	if (prevOpenRef.current !== open) {
		prevOpenRef.current = open;
		// ⚠ CLEARED IN BOTH DIRECTIONS. `open → false` by a path that is not this
		// component's own door (the host closing the sheet, a navigation, the arm
		// changing) used to leave the timer armed, and it then fired against
		// whatever sheet had been opened in the meantime — closing a composer the
		// reader had just opened.
		if (leaveTimerRef.current !== null) {
			clearTimeout(leaveTimerRef.current);
			leaveTimerRef.current = null;
		}
		if (open && leaving) {
			setLeaving(false);
		}
	}

	/** Live drag offset in px while a finger is on the handle, else null. */
	const [dragY, setDragY] = useState<number | null>(null);
	const dragStateRef = useRef<{ id: number; y0: number; t0: number } | null>(
		null,
	);

	/**
	 * ⚠ REDUCED MOTION IS HONOURED IN JS, NOT ONLY IN CSS, for the reason
	 * `ComposerSlot.tsx:49-53` gives: `motion-reduce:animate-none` suppresses the
	 * visual motion and leaves the DELAY, so a reader who asked for no motion
	 * would get a sheet that sits there for 200ms doing nothing before closing.
	 */
	const beginClose = useCallback(() => {
		if (busyRef.current || leavingRef.current) {
			return;
		}
		// ⚠ READ AT CALL TIME, INSIDE THE CALLBACK, not hoisted to a helper above
		// it. A helper would be a dependency this `useCallback` has to declare,
		// and re-creating `beginClose` on every render re-arms the Escape listener
		// in the effect below for no reason. Reading the media query here also
		// honours a reader who changes the OS setting mid-session, which is the
		// same argument `PhoneFeedTrack` makes for reading it at call time.
		const reduced =
			typeof window !== "undefined" &&
			typeof window.matchMedia === "function" &&
			window.matchMedia("(prefers-reduced-motion: reduce)").matches;
		if (reduced) {
			closeRef.current();
			return;
		}
		setLeaving(true);
		if (leaveTimerRef.current !== null) {
			clearTimeout(leaveTimerRef.current);
		}
		leaveTimerRef.current = setTimeout(() => {
			leaveTimerRef.current = null;
			// ⛔⛔ RE-CHECKED, NOT TAKEN FROM THE CALL. `busy` is read when a door is
			// pushed and the close lands 200ms later, so a request that goes in
			// flight INSIDE that window would otherwise be answered by a close the
			// reader asked for before it existed — and the sheet's refusal to close
			// while busy is a money rule, not a motion one (see the header).
			// ⚠ The host's own `guard` also blocks it, and `@security-auditor`
			// confirmed the double charge is unreachable for that reason. This is
			// the sheet holding its own half rather than borrowing the host's: a
			// future call site passing a non-guarded `onClose` would otherwise turn
			// this timer into a money door with no second line.
			// ⇒ Abort AND release, so the sheet is dismissable again the moment the
			// flight lands. Committing here and leaving `leaving` set is what left a
			// composer visible, locked and un-tappable when a submit ERRORED.
			if (busyRef.current) {
				setLeaving(false);
				return;
			}
			closeRef.current();
		}, CLOSE_MS);
	}, []);

	useEffect(
		() => () => {
			if (leaveTimerRef.current !== null) {
				clearTimeout(leaveTimerRef.current);
				leaveTimerRef.current = null;
			}
		},
		[],
	);

	/**
	 * ⛔⛔ POINTER EVENTS WITH CAPTURE, AND NOT ONE `preventDefault` ON A TOUCH
	 * EVENT ANYWHERE. A `touchmove` handler that calls `preventDefault` takes
	 * scrolling away from whatever is under the finger, which is MOBILE-2c's P0
	 * arriving again under a new name — so `phone-touch-handlers.test.ts` scans
	 * this directory and forbids it outright.
	 *
	 * ⇒ The browser is told what this element is for, declaratively, with
	 * `touch-action: none` on THE HANDLE ONLY. ⚠ **That region is the full width
	 * of the sheet's top edge and about 16px tall** (`pt-2 pb-1` around a 4px
	 * bar) — this said "a ~36×20px strip", which is the visible `<span>` rather
	 * than the box that takes the touch, and the size was the load-bearing half
	 * of the claim that it is not a scroller. Corrected by `@code-reviewer`. The
	 * claim itself survives on the right ground: a 16px strip at the top edge of
	 * a sheet holds no scrollable content, the sheet body beside it keeps
	 * `overflow-y-auto`, and the page behind is unreachable while a modal is up.
	 * `setPointerCapture` then keeps the drag alive when the finger leaves the
	 * strip, which is most of a real swipe.
	 */
	const onHandleDown = (event: ReactPointerEvent<HTMLDivElement>) => {
		if (busy) {
			return;
		}
		// ⚠ KEYED BY POINTER, AND A SECOND FINGER IS IGNORED RATHER THAN
		// OVERWRITING THE FIRST. Re-seeding `{y0, t0}` from a second pointer means
		// lifting the FIRST one measures its travel against the second's origin
		// with a `t0` a millisecond old — and `travelled / max(1, elapsed)` then
		// clears the 0.5 px/ms arm on the handle's own height. A two-finger tap
		// dismissed the sheet. `@security-auditor` (LOW).
		if (dragStateRef.current !== null) {
			return;
		}
		dragStateRef.current = {
			id: event.pointerId,
			y0: event.clientY,
			t0: event.timeStamp,
		};
		setDragY(0);
		event.currentTarget.setPointerCapture?.(event.pointerId);
	};

	const onHandleMove = (event: ReactPointerEvent<HTMLDivElement>) => {
		const state = dragStateRef.current;
		if (state === null || state.id !== event.pointerId) {
			return;
		}
		// ⚠ DOWNWARD ONLY. An upward drag must not lift the sheet past its own
		// top edge — there is nothing above it to reveal, and a sheet that can be
		// dragged up is a sheet that can be dragged off the screen.
		setDragY(Math.max(0, event.clientY - state.y0));
	};

	const onHandleUp = (event: ReactPointerEvent<HTMLDivElement>) => {
		const state = dragStateRef.current;
		if (state === null || state.id !== event.pointerId) {
			return;
		}
		dragStateRef.current = null;
		// ⚠ `?.` GUARDS AN ABSENT METHOD, NOT A THROW. This handler doubles as
		// `onPointerCancel`, and the spec has `releasePointerCapture` raise
		// `NotFoundError` for a pointer that is no longer active — which is
		// precisely what a cancel means. Cheaper to catch than to reason about
		// per-engine. (`@code-reviewer`, LOW.)
		try {
			event.currentTarget.releasePointerCapture?.(event.pointerId);
		} catch {
			// the pointer is already gone; nothing to release
		}
		const travelled = Math.max(0, event.clientY - state.y0);
		const elapsed = Math.max(1, event.timeStamp - state.t0);
		const velocity = travelled / elapsed;
		setDragY(null);
		if (travelled >= SWIPE_CLOSE_PX || velocity >= SWIPE_CLOSE_VELOCITY) {
			beginClose();
		}
	};

	useEffect(() => {
		if (!open) {
			return;
		}
		const panel = panelRef.current;
		// ⚠ RESTORED TO THE OPENER, not to `document.body`. The strip and the bar
		// are the two openers, and losing focus to the top of the document on
		// close is how a keyboard reader ends up re-traversing the whole page.
		const opener =
			document.activeElement instanceof HTMLElement
				? document.activeElement
				: null;

		/**
		 * ⚠⚠ NO `offsetParent` VISIBILITY FILTER, AND THAT IS NOT A SIMPLIFICATION.
		 * The obvious one — `el.offsetParent !== null` — performs LAYOUT, which
		 * jsdom does not do: every candidate filters out, the trap silently
		 * degrades to "focus the panel", and the guard that was written to prove
		 * containment instead proves the fallback. Measured on the first run.
		 * ⇒ The exclusion that actually matters is expressible without layout:
		 * `tabindex="-1"` is what `ImageAttach`'s hidden file input carries, and it
		 * is the only focusable-by-selector node in this subtree that must not
		 * receive focus.
		 */
		const focusables = () =>
			panel === null
				? []
				: [
						...panel.querySelectorAll<HTMLElement>(
							"a[href],button:not([disabled]),input:not([disabled]),textarea:not([disabled]),select:not([disabled]),[tabindex]",
						),
					].filter((el) => el.getAttribute("tabindex") !== "-1");

		// Move focus IN. The panel itself is the fallback target, which is why it
		// carries `tabIndex={-1}` — a sheet whose body is still loading has no
		// focusable child yet, and focus must not stay outside it.
		const first = focusables()[0];
		(first ?? panel)?.focus({ preventScroll: true });

		const onKey = (event: KeyboardEvent) => {
			if (event.key === "Escape" && !busyRef.current) {
				beginClose();
				return;
			}
			if (event.key !== "Tab" || panel === null) {
				return;
			}
			// CONTAINMENT. The list is recomputed per keystroke rather than cached:
			// the composer's own controls appear and disappear with its phase, and
			// a stale list traps focus on a control that is no longer there.
			const list = focusables();
			if (list.length === 0) {
				event.preventDefault();
				panel.focus({ preventScroll: true });
				return;
			}
			const firstEl = list[0];
			const lastEl = list[list.length - 1];
			const active = document.activeElement;
			if (event.shiftKey && (active === firstEl || active === panel)) {
				event.preventDefault();
				lastEl?.focus();
			} else if (!event.shiftKey && active === lastEl) {
				event.preventDefault();
				firstEl?.focus();
			} else if (active !== null && !panel.contains(active)) {
				// Focus escaped some other way (a programmatic move, a click that
				// landed outside). Pull it back rather than letting Tab continue
				// from wherever it is.
				event.preventDefault();
				firstEl?.focus();
			}
		};

		document.addEventListener("keydown", onKey);
		const previous = document.body.style.overflow;
		document.body.style.overflow = "hidden";
		return () => {
			document.removeEventListener("keydown", onKey);
			document.body.style.overflow = previous;
			opener?.focus({ preventScroll: true });
		};
	}, [open, beginClose]);

	if (!open) {
		return null;
	}

	const dragging = dragY !== null;
	/**
	 * ⚠ THE TRANSFORM GOES ON THE PANEL, NEVER ON THE ROOT. The root is the
	 * `position: fixed` layer, and a transformed ancestor becomes the containing
	 * block for every fixed descendant inside it — so animating the root would
	 * silently re-anchor anything fixed in the composer to the sheet instead of
	 * to the viewport.
	 */
	const panelMotion = dragging
		? "" // a finger is driving; an animation would fight it
		: leaving
			? "animate-out slide-out-to-bottom-full duration-[200ms] ease-in motion-reduce:animate-none motion-reduce:duration-0"
			: "animate-in slide-in-from-bottom-full duration-[260ms] ease-out motion-reduce:animate-none motion-reduce:duration-0";
	const backdropMotion = leaving
		? "animate-out fade-out-0 duration-[200ms] ease-in motion-reduce:animate-none motion-reduce:duration-0"
		: "animate-in fade-in-0 duration-[260ms] ease-out motion-reduce:animate-none motion-reduce:duration-0";

	return (
		<div
			data-testid="phone-sheet"
			data-phase={leaving ? "leaving" : "open"}
			role="dialog"
			aria-modal="true"
			// ⚠ NAMED BY THE HEADING, NOT BY BOTH. It carried `aria-label` AND an
			// `sr-only` <h2> with the same text, so AT announced the name on open
			// and again on traversal. `aria-labelledby` is one name from one node,
			// and it keeps working when the heading is visible.
			aria-labelledby={headingId}
			// ⚠ A LEAVING SHEET STOPS TAKING INPUT. Without this a second tap during
			// the 200ms slide lands on a backdrop that is still there, and
			// `beginClose` would be asked to close a sheet that is already closing —
			// the `leaving` gate makes that idempotent, and this makes it
			// unreachable by pointer. ⚠ It does NOT gate the keyboard, which is why
			// the gate is the mechanism and this is the belt.
			className={`fixed inset-0 z-50 flex flex-col justify-end ${
				leaving ? "pointer-events-none" : ""
			}`}
		>
			{/* ⚠ THE BACKDROP IS OUT OF THE TAB ORDER AND UNNAMED, and that is the
			    correction rather than the original design. It shipped as a labelled,
			    tab-reachable `Close` — a SECOND control with the identical accessible
			    name, sitting immediately beside the `×` in the traversal. Two
			    adjacent controls called "Close" is worse than one, and the keyboard
			    path this was meant to provide is what Escape already is. It stays a
			    `<button>` because it is still a pointer control and a `div` with a
			    click handler is not one.

			    ⛔ IT IS ALSO THE ONE CONTROL THIS TASK'S P0 WAS ABOUT. It was always
			    here and was never reachable, because the panel above it was the
			    height of the viewport. `--overlay` is already `rgb(10 10 10 / 0.6)`
			    (`globals.css:232`), so the ruled 60% dim needed no new token. */}
			<button
				type="button"
				tabIndex={-1}
				aria-hidden="true"
				data-testid="phone-sheet-backdrop"
				onClick={beginClose}
				className={`absolute inset-0 bg-(--overlay) ${backdropMotion}`}
			/>
			<div
				ref={panelRef}
				// ⚠ `-1`, so the panel can receive focus programmatically without
				// joining the tab order — the fallback target when the sheet has no
				// focusable child yet.
				tabIndex={-1}
				data-testid="phone-sheet-panel"
				// ⛔ CONTENT-HEIGHT, WITH A CEILING — and no `fullHeight` branch to
				// defeat it. `max-h-[92dvh]` is the ruled ceiling (ADR-0050 A2), and
				// the body below carries `overflow-y-auto`, so a composer taller than
				// the ceiling scrolls INSIDE the sheet.
				//
				// ⚠⚠ AND WHAT KEEPS `PLACE Đ BET` REACHABLE WITH THE KEYBOARD UP IS
				// THAT SCROLLER, NOT THIS UNIT. This comment used to say "`dvh` and
				// not `vh` … the keyboard changes the viewport and `vh` does not
				// notice", and `@code-reviewer` measured that the mechanism does not
				// exist: there is no `interactive-widget` key anywhere in this app's
				// viewport meta (`grep -rn 'interactive-widget' src/` → nothing), so
				// the default `resizes-visual` applies — the keyboard shrinks the
				// VISUAL viewport and leaves the LAYOUT viewport, and therefore every
				// `vh`/`svh`/`dvh` unit, untouched. `dvh` tracks retractable browser
				// chrome, which is a different thing and is why the tier uses it.
				// ⇒ The unit is still right for its own reason. The keyboard claim
				// belongs to the body's `overflow-y-auto` alone, and **a real
				// on-screen keyboard has not been measured** — a resized desktop
				// window has none, so the run reports that as owed rather than as
				// verified. R-6 moved the submit to `order-4`, the bottom of the
				// sheet, which is the worst place for a keyboard overlay and is the
				// reason this paragraph is not being left to read as a guarantee.
				//
				// ⚠ `rounded-t-4xl` = `--radius-4xl` = 26px, the largest radius in the
				// `@theme` scale (`globals.css:47`) and the largest that is actually
				// used in the tree. The brief's 16px fallback applies only if the
				// scale has no token ≥12px; it has four.
				style={
					dragY === null ? undefined : { transform: `translateY(${dragY}px)` }
				}
				className={`relative flex max-h-[92dvh] w-full flex-col rounded-t-4xl bg-ground outline-none ${panelMotion}`}
			>
				{/* ⛔ THE HANDLE IS NO LONGER A DECORATION, and its docblock used to say
				    so proudly: "there is no drag gesture behind it … inventing a
				    drag-to-dismiss to justify it would be a gesture handler written for
				    a decoration." That was the right call while the sheet had a
				    reachable backdrop and the wrong one once it did not — the shape a
				    reader reads as "this is a sheet" is also the shape they reach for
				    first, and on this surface it was the only affordance that looked
				    like a way out. It now is one. */}
				<div
					data-testid="phone-sheet-handle"
					onPointerDown={onHandleDown}
					onPointerMove={onHandleMove}
					onPointerUp={onHandleUp}
					onPointerCancel={onHandleUp}
					className="flex shrink-0 cursor-grab justify-center pt-2 pb-1 [touch-action:none]"
				>
					<span aria-hidden="true" className="h-1 w-9 rounded-full bg-n3" />
				</div>
				{titleHidden === true ? (
					// ⚠ THE NAME WITHOUT THE ROW. `sr-only` is `position:absolute`, so
					// this contributes no layout — which is the point: a header row
					// holding only a hidden heading is an empty band, and R-5 forbids one.
					<h2 id={headingId} className="sr-only">
						{title}
					</h2>
				) : (
					<div className="flex shrink-0 items-center justify-between gap-2 px-3 py-2">
						<h2 id={headingId} className="text-sm font-semibold text-ink">
							{title}
						</h2>
						<button
							type="button"
							data-testid="phone-sheet-close"
							aria-label="Close"
							disabled={busy}
							onClick={beginClose}
							className="-mr-1.5 flex size-11 items-center justify-center rounded-(--r-chip) text-lg text-n4 transition-all hover:text-ink focus-visible:shadow-(--state-focus-ring) disabled:pointer-events-none disabled:opacity-(--state-disabled-opacity)"
						>
							×
						</button>
					</div>
				)}
				<div
					data-testid="phone-sheet-body"
					className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-[calc(12px+env(safe-area-inset-bottom))]"
				>
					{children}
				</div>
			</div>
		</div>
	);
}
