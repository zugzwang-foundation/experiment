"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";

/**
 * UI-QUICK change set 3 §C — THE COMPOSER'S SLIDE IN AND OUT, and the focus move
 * that should always have come with it.
 *
 * ⚠⚠ 260ms IS CANON, NOT A PREFERENCE, AND IT IS DELIBERATELY NOT
 * `dialog.tsx`'s. `design-canon.md` §5:100 ratifies ".26 s" for this surface's
 * content advance; `ui/dialog.tsx:61` ships `duration-200` for the pop-ups. Two
 * numbers, two mechanisms, and inheriting the dialog's would have silently
 * replaced a ratified value with a shadcn default. No motion TOKEN exists to
 * carry it — `design-language.md` §2.3 leaves `motion.duration.*` blank ("— CD")
 * — so the literal is declared once, here, rather than at two call sites.
 *
 * ⛔⛔ THE BORDER NEVER MOVES (§5:100 — "the border never moves"). This wrapper
 * carries NO border and NO background: `DebateColumn`'s hairline and the
 * `column-scroll` box are the static frame, and only this node's inner subtree
 * translates inside them. ⇒ Nothing that draws an edge is ever transformed.
 *
 * ⛔ TRANSFORM AND OPACITY ONLY. The column is `flex-1 min-h-0 overflow-y-auto`;
 * animating height or width would relayout the scroller on every frame and jank
 * the whole arena. `slide-*` and `fade-*` compile to `translate` and `opacity`,
 * both compositor-only.
 *
 * ⚠⚠ WHY THE EXIT NEEDS THIS COMPONENT AT ALL. React unmounts synchronously —
 * the moment `openSide` goes null the composer's subtree is gone, so there is
 * nothing left to animate out. The outgoing element is therefore held for one
 * duration in `held`, rendered at the SAME tree position and of the SAME type,
 * which is what stops React from remounting it. ⛔ Swapping in a different
 * wrapper element during exit would unmount and REMOUNT the live composer — the
 * opposite of the intent, and briefly a second live instance.
 *
 * ⛔⛔ THE CORPSE IS INERT, AND HERE IS EXACTLY WHAT THAT BUYS AND WHAT IT DOES
 * NOT. During exit the wrapper carries `inert` + `aria-hidden`, so the subtree
 * leaves the accessibility tree, cannot be focused, cannot be clicked, and can
 * fire no handler from any user action. What `inert` does NOT do is unmount
 * React state or cancel work already scheduled inside the child. That residue is
 * closed off separately and structurally: `skipExit` below unmounts IMMEDIATELY
 * whenever a submit is in flight, so the only path that could schedule work
 * during an exit is the one path that never gets an exit. ⇒ Stated rather than
 * implied, because "inert" alone would have been an overclaim.
 *
 * ⛔ A LIVE MONEY PATH IS NEVER HELD MOUNTED FOR A TRANSITION. `busy` is
 * `BetComposer`'s own in-flight guard, threaded straight through. When it is
 * true the animation is abandoned, not shortened.
 *
 * ⚠ `prefers-reduced-motion` IS HONOURED IN JS, NOT ONLY IN CSS, and it has to
 * be. `motion-reduce:animate-none` would suppress the visual motion but leave
 * the 260ms hold in place — a corpse sitting motionless in the slot for a
 * quarter-second, which is a stall rather than the instant swap the setting
 * asks for. The media query is read here so the exit hold is skipped outright.
 */
const EXIT_MS = 260;

/** Focusable descendants, in tab order, excluding anything already disabled. */
const FOCUSABLE =
	'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

function prefersReducedMotion() {
	return (
		typeof window !== "undefined" &&
		window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true
	);
}

export function ComposerSlot({
	open,
	busy,
	composer,
	scroller,
}: {
	/** The slot hosts the composer. Derived by the caller from `openSide`/`openReply`. */
	open: boolean;
	/** `BetComposer`'s in-flight guard. True ⇒ skip the exit and unmount now. */
	busy: boolean;
	/** Rendered while open. `null` when closed — the last one is held for the exit. */
	composer: ReactNode;
	/** The post/reply scroller this slot replaces. */
	scroller: ReactNode;
}) {
	const [mounted, setMounted] = useState(open);
	const [state, setState] = useState<"open" | "closed">(
		open ? "open" : "closed",
	);
	const wrap = useRef<HTMLDivElement>(null);
	/** The last non-null composer element, so the exit has something to render. */
	const held = useRef<ReactNode>(null);
	/** Whatever had focus when the slot opened — where focus goes back on close. */
	const opener = useRef<HTMLElement | null>(null);

	if (open && composer !== null) {
		held.current = composer;
	}

	useEffect(() => {
		if (open) {
			setMounted(true);
			setState("open");
			return;
		}
		if (!mounted) {
			return;
		}
		// ⛔ Two independent reasons to abandon the exit rather than shorten it.
		if (busy || prefersReducedMotion()) {
			setState("closed");
			setMounted(false);
			return;
		}
		setState("closed");
		const t = setTimeout(() => setMounted(false), EXIT_MS);
		return () => clearTimeout(t);
	}, [open, busy, mounted]);

	/**
	 * ⚠⚠ THE FOCUS GAP, AND IT WAS A REAL ONE: opening the composer moved focus
	 * NOWHERE, so a keyboard reader pressed BUY and stayed on BUY while a form
	 * appeared somewhere off-screen. On open, focus goes to the first interactive
	 * element inside — or to the container itself, which carries `tabIndex={-1}`
	 * precisely so there is always somewhere to land when the slot has no controls
	 * yet (the signed-out `AuthGateSlot` arm).
	 *
	 * ⛔ NO FOCUS TRAP, AND THAT IS THE RULING. This is an inline sub-view, not a
	 * dialog: the rest of the surface stays legitimately reachable, and trapping
	 * here would strand a reader inside a panel they can simply Tab out of by
	 * design. The dialog primitive's trap is NOT borrowed.
	 */
	// ⚠ Deps are `[open]` ALONE, deliberately: this must fire on the open EDGE.
	// Widening them to include the refs would re-run mid-session and steal focus
	// back to the first control while the reader is typing.
	useEffect(() => {
		if (!open) {
			return;
		}
		const active = document.activeElement;
		opener.current = active instanceof HTMLElement ? active : null;
		const node = wrap.current;
		if (!node) {
			return;
		}
		const first = node.querySelector<HTMLElement>(FOCUSABLE);
		(first ?? node).focus();
	}, [open]);

	// Focus RESTORE, split from the move above so it fires on the close edge and
	// cannot re-run while the slot is open. Guarded on `isConnected`: the opener
	// may itself have been unmounted (a relation flip re-renders the split bar),
	// and focusing a detached node silently sends focus to <body>.
	const wasOpen = useRef(open);
	useEffect(() => {
		if (wasOpen.current && !open) {
			const back = opener.current;
			if (back?.isConnected) {
				back.focus();
			}
			opener.current = null;
		}
		wasOpen.current = open;
	}, [open]);

	if (!mounted) {
		return <>{scroller}</>;
	}

	const exiting = state === "closed";
	return (
		<div
			ref={wrap}
			data-state={state}
			data-testid="composer-slot"
			tabIndex={-1}
			// ⛔ The corpse cannot be reached, announced, or clicked. See the
			// docblock for what this does and does not guarantee.
			inert={exiting ? true : undefined}
			aria-hidden={exiting ? true : undefined}
			// ⚠ `±14px` and `260ms` are canon §5:100's own figures, taken as
			// arbitrary values because the scale steps do not carry them:
			// `slide-in-from-bottom-14` is 14 × 0.25rem = 56px, four times the
			// ratified distance.
			className="flex min-h-0 flex-1 flex-col duration-[260ms] data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-bottom-[14px] data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-bottom-[14px] motion-reduce:animate-none motion-reduce:duration-0"
		>
			{open ? composer : held.current}
		</div>
	);
}
