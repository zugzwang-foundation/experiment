"use client";

import { type ReactNode, useEffect, useRef } from "react";

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
 * ⚠ NOT `ui/dialog.tsx`. The shadcn dialog is a Radix portal with its own focus
 * trap, overlay animation and `asChild` seams — which is right for the desktop's
 * modals and is more machinery than a full-height sheet needs, and the `asChild`
 * boundary in particular is the one documented in AGENTS.md §5 as silently
 * deleting a deferred child. This is a `fixed` panel with `role="dialog"` and
 * `aria-modal`, which is the whole of what the sheet is.
 */
export function PhoneSheet({
	open,
	title,
	busy,
	fullHeight,
	onClose,
	children,
}: {
	open: boolean;
	title: string;
	/** A composer request is in flight — every door is shut until it lands. */
	busy: boolean;
	/** RF-6's composer sheet is full-height; RF-7's details sheet is ~96vh. */
	fullHeight: boolean;
	onClose: () => void;
	children: ReactNode;
}) {
	const closeRef = useRef(onClose);
	closeRef.current = onClose;
	const busyRef = useRef(busy);
	busyRef.current = busy;

	useEffect(() => {
		if (!open) {
			return;
		}
		const onKey = (event: KeyboardEvent) => {
			if (event.key === "Escape" && !busyRef.current) {
				closeRef.current();
			}
		};
		document.addEventListener("keydown", onKey);
		const previous = document.body.style.overflow;
		document.body.style.overflow = "hidden";
		return () => {
			document.removeEventListener("keydown", onKey);
			document.body.style.overflow = previous;
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
			aria-label={title}
			className="fixed inset-0 z-50 flex flex-col justify-end"
		>
			{/* The backdrop is a BUTTON rather than a div with a click handler: it is
			    a control (it dismisses), and a control that only a mouse can reach is
			    not one. Escape above is its keyboard equivalent; this one is labelled
			    so a screen reader can find it too. */}
			<button
				type="button"
				aria-label="Close"
				data-testid="phone-sheet-backdrop"
				onClick={() => {
					if (!busy) {
						onClose();
					}
				}}
				className="absolute inset-0 bg-(--overlay)"
			/>
			<div
				className={`relative flex w-full flex-col bg-ground ${
					fullHeight ? "h-full" : "max-h-[96vh]"
				}`}
			>
				{/* The drag handle is VISUAL ONLY and says so: there is no drag
				    gesture behind it. It is the shape a phone reader reads as
				    "this is a sheet", and inventing a drag-to-dismiss to justify it
				    would be a gesture handler written for a decoration. */}
				<div className="flex shrink-0 justify-center pt-2" aria-hidden="true">
					<span className="h-1 w-9 rounded-full bg-n3" />
				</div>
				<div className="flex shrink-0 items-center justify-between gap-2 px-3 py-2">
					<h2 className="text-sm font-semibold text-ink">{title}</h2>
					<button
						type="button"
						data-testid="phone-sheet-close"
						aria-label="Close"
						disabled={busy}
						onClick={onClose}
						className="rounded-(--r-chip) px-1 text-sm text-n4 transition-all hover:text-ink focus-visible:shadow-(--state-focus-ring) disabled:pointer-events-none disabled:opacity-(--state-disabled-opacity)"
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
