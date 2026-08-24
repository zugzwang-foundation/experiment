"use client";

import type { ReactNode } from "react";

import { COMPOSER_COPY, POSTED_COPY } from "./copy";

/**
 * FEED-1 — THE SLOT AFTER A SUCCESSFUL BET.
 *
 * ⚠⚠ WHAT IT IS FOR. Placing a bet used to close the composer and drop the
 * author back into a ranked column, where the argument they had just written
 * was somewhere among everyone else's — so the one moment they most want to see
 * their own work is the moment it disappears. This keeps the slot and shows it
 * to them. The column is untouched: the post appears in its TRUE ranked
 * position, and nobody else's view changes.
 *
 * ⛔ IT HOLDS A CARD, IT DOES NOT DRAW ONE. `children` is the same `PostCard` /
 * `ReplyCard` the column itself renders, built from the real refreshed model.
 * This component owns the chrome and nothing else — the moment it started
 * formatting a post it would become a second renderer of the same thing, free
 * to drift from the first.
 *
 * ⚠⚠ THE ENTRANCE LIVES HERE AND NOT ON `ComposerSlot`'s WRAPPER, and that is a
 * measured decision rather than a stylistic one. Every `animate-in` variant in
 * `tw-animate-css` compiles to the SAME `animation-name: enter`, so labelling
 * the wrapper `data-[state=confirmed]:animate-in` would have changed the
 * selector while leaving the animation name identical on an element that is not
 * being re-created — and CSS restarts an animation only when the name changes
 * or the element is replaced. It would have typechecked and never once played.
 * This node is genuinely newly mounted, so its entrance cannot fail to fire.
 * ⚠ `260ms` and `14px` are canon §5:100's own figures, taken as arbitrary
 * values for the same reason `ComposerSlot` takes them: the scale steps do not
 * carry them. Reduced motion is honoured the same way the slot honours it.
 *
 * ⛔⛔ THE `×` IS NEVER DISABLED, AND THAT IS THE RULE, NOT AN OVERSIGHT. The
 * composer's × carries `disabled={inFlight}` because closing mid-request would
 * orphan a possibly-committing bet. Here the bet has ALREADY returned 200 —
 * there is nothing outstanding to protect, and a confirmation the author cannot
 * dismiss is a trap. Every path out of this state must terminate.
 *
 * ⚠ NO SIDE CHIP. The composer carries one because its form shows the side
 * nowhere else; the card inside this one already renders the author's side on
 * its own head. A second chip would be authoring design the register does not
 * ask for — `Posted` and the existing `×` are the whole of it (`copy.ts`).
 */
export function PostedConfirmation({
	onDismiss,
	children,
}: {
	/** Dismiss: releases the slot, the freeze and the poll, all existing paths. */
	onDismiss: () => void;
	/** The real card — `PostCard` for a post, `ReplyCard` for a reply. */
	children: ReactNode;
}) {
	return (
		// ⚠ The frame is byte-carried from `BetComposer`'s own `<section>`, so the
		// swap does not move the box the author is already looking at — the same
		// reason `ComposerSlot`'s wrapper draws no edge of its own.
		// ⚠ `min-h-0 flex-1` is ADDED to it: this one holds a card, and `PostCard`'s
		// image cell resolves its height from an unbroken `min-h-0 flex-1` chain
		// above it. Break this link and the image silently reverts to intrinsic
		// size — the defect PostCard's own docblock records, one level up.
		<section
			data-testid="posted-confirmation"
			aria-label={POSTED_COPY.header}
			className="flex min-h-0 flex-1 flex-col gap-3 rounded-(--r) p-3.5 shadow-(--elev-1) duration-[260ms] [border:var(--hairline)] animate-in fade-in-0 slide-in-from-bottom-[14px] motion-reduce:animate-none motion-reduce:duration-0"
		>
			{/* The composer's own header row — `items-center` so the × shares a
			    centre line with the label (change set 11 §4), and the same `-my-3`
			    that keeps a real 44 × 44 target from dictating a 44px row. */}
			<div className="flex items-center gap-2">
				<span className="text-sm font-semibold text-ink">
					{POSTED_COPY.header}
				</span>
				<button
					type="button"
					onClick={onDismiss}
					aria-label="Close"
					data-testid="posted-dismiss"
					// ⚠ Byte-carried from the composer's ×, minus its `disabled:*`
					// pair — there is no disabled state here, so those classes would
					// be dead. The glyph, the 44px target and the −12px overhang are
					// unchanged, because this is the same control doing the same job.
					className="-my-3 ml-auto flex size-11 items-center justify-center rounded-(--r-chip) text-xl text-n4 transition-all hover:text-ink focus-visible:shadow-(--state-focus-ring)"
				>
					{COMPOSER_COPY.close}
				</button>
			</div>
			{children}
		</section>
	);
}
