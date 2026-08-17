"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";

/**
 * PROFILE REFINEMENT · R4 — THE `+` AFFORDANCE ON AN ARGUMENT-LIST CARD, and the
 * teaser it expands.
 *
 * ⛔ THIS REVERSES AM-1 / D13, AND THAT IS THE FOUNDER'S CALL, NOT AN OVERSIGHT.
 * `ArgumentList`'s teaser carried a standing rule: the clamp is CSS-only and NO
 * `title` attribute may reveal the rest, because "a native tooltip revealing the
 * whole paragraph is a SECOND read affordance beside the title `<Link>`, which is
 * what D13 rules out". R4 asks for exactly such a second affordance. The two are
 * not the same object, and the distinction is why this one is buildable where the
 * tooltip was not: a tooltip is an accidental, unlabelled, un-keyboardable reveal
 * that fires on hover and cannot be dismissed; this is an explicit control with an
 * accessible name, an `aria-expanded` state, and a click to close. D13's objection
 * was to the mechanism, and the mockup has always carried the control — see below.
 * ⚠ THE `title`-ATTRIBUTE BAN IS UNTOUCHED and still holds: nothing here adds one.
 *
 * ⛔ AN INLINE EXPAND, NOT THE MOCKUP'S MODAL — a reported divergence with a
 * measured reason. The mockup's `.rtitle .plus` (`:346`) calls `openPop()` (`:657`)
 * and opens `.pmwrap`/`.pmcard` (`:398-417`), whose body is the full argument. The
 * shipped equivalent is `debate/dialogs.tsx`'s `PostPopup`, and it takes a
 * `PresentPost` — a debate-view DTO carrying an aggregate, a reply set and an
 * image. `ProfileArgumentItem` has none of those, so reusing it would mean
 * CONSTRUCTING a `PresentPost` out of fields this surface does not hold, i.e.
 * fabricating data to satisfy a type. ⇒ The full body is revealed in place
 * instead, which is what the pop-up existed to reach ("the body is rendered IN
 * FULL … which is what the pop-up existed to reach" — `ArgumentList`'s own note
 * about the replica card).
 *
 * ⚠ THE CONTROL'S SHAPE IS THE SHIPPED ONE, BYTE-FOR-BYTE — `PostCard.tsx:205-212`:
 * `variant="ghost"`, `size="xs"`, the `+` glyph, `text-n5 hover:text-ink`,
 * absolutely positioned bottom-right of a `relative` parent, and
 * `aria-label="Show more"` which that file records as BYTE-CARRIED from the
 * mockup's own control (`d5:1077`). ⛔ So no glyph, no label and no class is
 * authored here; the one thing this adds is `aria-expanded`, because an inline
 * expand has a state a modal trigger does not.
 * ⛔ AND NO SECOND LABEL IS INVENTED FOR THE OPEN STATE. `aria-expanded` carries
 * it — the same choice `BookmarkToggle` makes with `aria-pressed` rather than
 * swapping copy. A "Show less" string would be authored copy on a surface where
 * copy is founder-owned.
 *
 * ⚠ SC-1 — this component is mounted ONLY on the present branch. The removed
 * variants of `ProfileArgumentItem` carry no `teaser` and no `body` field at all,
 * so passing one here is a COMPILE error rather than a discipline, and no masked
 * body can reach this render.
 */
export function ArgumentBody({
	id,
	teaser,
	body,
}: {
	id: string;
	teaser: string;
	body: string;
}): React.JSX.Element {
	const [open, setOpen] = useState(false);

	return (
		// `relative` + `pr-6` is the mockup's `.rtitle{position:relative;
		// padding-right:22px}` (`:343-344`) — the reserved gutter the control sits
		// in, so it never overlaps the last line of text.
		<div className="relative pr-6">
			{open ? (
				// ⚠ `whitespace-pre-line` is the shipped full-body treatment
				// (`PostFocusHeader.tsx:84-90`, reused by this file's replica card), so
				// an argument reads identically here and on `/m/[slug]`.
				<p
					data-testid={`argument-body-${id}`}
					className="text-xs whitespace-pre-line text-n5"
				>
					{body}
				</p>
			) : (
				// ⛔ THE TESTID AND CLASSES OF THE COLLAPSED PARAGRAPH ARE UNCHANGED from
				// the teaser this replaces — `argument-teaser-*` with `line-clamp-2
				// text-xs text-n5` — so every existing reader keeps its handle and the
				// collapsed card is byte-identical to what shipped.
				<p
					data-testid={`argument-teaser-${id}`}
					className="line-clamp-2 text-xs text-n5"
				>
					{teaser}
				</p>
			)}
			<Button
				variant="ghost"
				size="xs"
				aria-label="Show more"
				aria-expanded={open}
				onClick={() => setOpen((v) => !v)}
				className="absolute right-0 bottom-0 text-n5 hover:text-ink"
			>
				+
			</Button>
		</div>
	);
}
