"use client";

import { type ReactNode, useEffect, useId, useRef } from "react";

/**
 * The phone's one overlay primitive — the bottom sheet that stands in for the
 * desktop's opposite composer slot, and carries the details and parent-post
 * screens as well.
 *
 * ⛔⛔ IT REFUSES TO CLOSE WHILE `busy`, AND THAT IS A MONEY RULE WEARING A UI
 * COSTUME. `DebateView` records why (`:157-160`): while a composer request is in
 * flight, every host path that would unmount it no-ops, because a mid-request
 * unmount followed by a re-open mints a FRESH idempotency key over a bet that
 * may already be committing — i.e. it converts a retry into a second charge. The
 * desktop enforces that by making its entry toggles no-op; a sheet has three
 * more doors than a slot does (`×`, Escape, the backdrop), so all three are shut
 * by the same flag rather than by remembering to guard each one.
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
 * discipline, implemented here in about twenty lines.
 */
export function PhoneSheet({
	open,
	title,
	busy,
	fullHeight,
	titleHidden,
	onClose,
	children,
}: {
	open: boolean;
	title: string;
	/** A composer request is in flight — every door is shut until it lands. */
	busy: boolean;
	/** RF-6's composer sheet is full-height; RF-7's details sheet is ~96vh. */
	fullHeight: boolean;
	/**
	 * ⚠ THE TITLE IS HIDDEN, NEVER DROPPED, when the content carries its own
	 * heading. `BetComposer` and `AuthGateSlot` both open with their own — so the
	 * sheet printed `Place your Đ BET` directly above `Place your Đ BET`, and
	 * `Sign in to bet YES` above itself. Deleting the string instead would take
	 * the dialog's ACCESSIBLE NAME with it, which is the one a screen reader
	 * announces on open and the one thing here that is not decoration. `sr-only`
	 * keeps the name and drops the duplicate words.
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
				closeRef.current();
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
	}, [open]);

	if (!open) {
		return null;
	}

	return (
		<div
			data-testid="phone-sheet"
			role="dialog"
			aria-modal="true"
			// ⚠ NAMED BY THE HEADING, NOT BY BOTH. It carried `aria-label` AND an
			// `sr-only` <h2> with the same text, so AT announced the name on open
			// and again on traversal. `aria-labelledby` is one name from one node,
			// and it keeps working when the heading is visible.
			aria-labelledby={headingId}
			className="fixed inset-0 z-50 flex flex-col justify-end"
		>
			{/* ⚠ THE BACKDROP IS OUT OF THE TAB ORDER AND UNNAMED, and that is the
			    correction rather than the original design. It shipped as a labelled,
			    tab-reachable `Close` — a SECOND control with the identical accessible
			    name, sitting immediately beside the `×` in the traversal. Two
			    adjacent controls called "Close" is worse than one, and the keyboard
			    path this was meant to provide is what Escape already is. It stays a
			    `<button>` because it is still a pointer control and a `div` with a
			    click handler is not one. */}
			<button
				type="button"
				tabIndex={-1}
				aria-hidden="true"
				data-testid="phone-sheet-backdrop"
				onClick={() => {
					if (!busy) {
						onClose();
					}
				}}
				className="absolute inset-0 bg-(--overlay)"
			/>
			<div
				ref={panelRef}
				// ⚠ `-1`, so the panel can receive focus programmatically without
				// joining the tab order — the fallback target when the sheet has no
				// focusable child yet.
				tabIndex={-1}
				className={`relative flex w-full flex-col bg-ground outline-none ${
					fullHeight ? "h-full" : "max-h-[96dvh]"
				}`}
			>
				{/* The drag handle is VISUAL ONLY and says so: there is no drag
				    gesture behind it. It is the shape a phone reader reads as
				    "this is a sheet", and inventing a drag-to-dismiss to justify it
				    would be a gesture handler written for a decoration. */}
				<div className="flex shrink-0 justify-center pt-2" aria-hidden="true">
					<span className="h-1 w-9 rounded-full bg-n3" />
				</div>
				{/* ⚠ `justify-end` WHEN THE TITLE IS HIDDEN. `sr-only` is
				    `position:absolute`, so a hidden `<h2>` leaves the flow entirely and
				    `justify-between` then has ONE in-flow child — which it parks at the
				    START, putting the close control on the wrong side of the sheet.
				    Measured, not predicted. */}
				<div
					className={`flex shrink-0 items-center gap-2 px-3 py-2 ${
						titleHidden === true ? "justify-end" : "justify-between"
					}`}
				>
					<h2
						id={headingId}
						className={
							titleHidden === true
								? "sr-only"
								: "text-sm font-semibold text-ink"
						}
					>
						{title}
					</h2>
					<button
						type="button"
						data-testid="phone-sheet-close"
						aria-label="Close"
						disabled={busy}
						onClick={onClose}
						className="-mr-1.5 flex size-11 items-center justify-center rounded-(--r-chip) text-lg text-n4 transition-all hover:text-ink focus-visible:shadow-(--state-focus-ring) disabled:pointer-events-none disabled:opacity-(--state-disabled-opacity)"
					>
						×
					</button>
				</div>
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
