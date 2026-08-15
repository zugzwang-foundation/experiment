// SPDX-License-Identifier: AGPL-3.0-or-later

import { Badge } from "@/components/ui/badge";

/**
 * HTML-FINISH · BOOKMARKS — THE ARENA PANEL. The `/bookmarks` list becomes a
 * bordered, rounded panel with a header bar and a panel-scoped body, matching
 * the two halves the Profile surface ships on this branch.
 *
 * ⛔ THE FRAME IS COPIED FROM THE BUILD, NOT FROM THE MOCKUP. Every class below
 * is byte-carried from `profile/ArgumentList.tsx`'s `ArgumentsPanel`
 * (`:271-298`), which is itself the byte-for-byte twin of
 * `profile/PositionsTable.tsx`'s `PositionsPanel` (`:525-569`) — see the latter
 * for the per-token trace of each value back to its shipped source
 * (`HeroPanels.tsx`, `DebateColumn.tsx`, this surface's own Card padding).
 * Nothing here is measured off `surface_profile_v1_0.html`, which is a
 * light-mode fixed-desktop prototype (DESIGN.B1).
 *
 *   section  flex min-h-0 flex-col overflow-hidden rounded-[var(--r)] bg-n0
 *            [border:var(--hairline)]        ← ArgumentList.tsx:280
 *   head     flex flex-wrap items-center gap-2 p-3
 *            [border-bottom:var(--hairline)] ← ArgumentList.tsx:284
 *   title    text-xs font-medium text-ink    ← ArgumentList.tsx:286
 *   body     flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3
 *                                            ← ArgumentList.tsx:292
 *
 * ⚠⚠ THIS IS ONE PANEL, NOT TWO, AND THAT IS A MEASUREMENT, NOT A SHORTCUT.
 * Profile's arena has two halves because the surface loads TWO collections —
 * `loadProfilePositions` and `loadProfileArguments`. `/bookmarks` loads ONE:
 * `loadBookmarks` returns a single `BookmarkItem[]`, and no second collection
 * is derivable from it without inventing one (splitting by `item.kind` is a
 * region no authority asks for). A second bordered panel here would be an
 * empty shape held open, which is precisely the fabrication this round forbids.
 * The absent half is RECORDED in the close-out, not approximated.
 *
 * ⚠ THE HEADER BAR IS THE SURFACE'S EXISTING HEADER ROW, RELOCATED — not a new
 * one. `page.tsx` already rendered `[<h1>Bookmarks</h1>][Badge "Your
 * bookmarks"]` inside `flex flex-wrap items-center gap-2`, which is the panel
 * head's own class string minus the bar treatment; this adds `p-3` +
 * `[border-bottom:var(--hairline)]` and moves the pair inside the panel.
 * ⛔ IT IS A MOVE BECAUSE A COPY WOULD BE A DEFECT: leaving the `<h1>` above
 * the panel AND titling the panel head would print `Bookmarks` twice.
 *
 * ⛔ THE `<h1>` STAYS AN `<h1>` while taking the panel-title CLASSES. Profile's
 * panel title is a `<span>` because that page carries no page-level heading at
 * all; this surface has had one since UI-A6 and demoting it would delete the
 * document's only heading for a visual gain of zero. Canon §10 `C-STATES-1`'s
 * DOC-1 rider is the governing precedent: a ratified shared TREATMENT never
 * ratifies a shared FILE SHAPE, and the element choice is named there as one of
 * the eleven divergences that are CORRECT.
 *
 * ⛔ NO FILTERS IN THE BAR. Profile's left bar carries a market popover and an
 * Open/Closed segmented pair. The status filter is DATA-BLOCKED here —
 * `BookmarkItem` carries no `statusLabel`, `marketStatus` or `settled` — and
 * the market filter, whose fields (`marketSlug`/`marketTitle`) DO carry, is a
 * behaviour this surface has never had; it is recorded as a widening rather
 * than authored in passing.
 *
 * ⚠ THE BODY'S SCROLL IS WIRED AND, AS OF R1, BOUND. `flex-1 min-h-0
 * overflow-y-auto` is the byte-carried topology; a panel-scoped scroll also
 * needs a DEFINITE height from an ancestor, and until the founder ruling of
 * 2026-08-15 this surface's PageContainer call site could not take one — it was
 * pinned class-set-exact as site 2 of `tests/unit/shell/page-container.test.ts`,
 * a file that sat outside the round's write allow-list. The ruling extended the
 * allow-list by that file; the container now carries `wide` + `flex-1 min-h-0
 * flex-col` and the chain starts there. Asserted node by node in
 * `tests/unit/design/bookmarks-height-chain.test.ts`.
 *
 * ⚠ WHAT THAT DOES AND DOES NOT BUY, measured rather than assumed. The panel now
 * FILLS the arena instead of sitting at content height. Whether the body's
 * `overflow-y-auto` actually engages depends on `<main>`, whose height is
 * `max(floor, content)` under RULED A1 — the same asymmetry
 * `profile-height-chain.test.ts` records under control for the profile. The
 * per-viewport measurement is in the close-out; do not infer it from this line.
 *
 * ⛔ EVERY MENTION OF THAT PRIMITIVE ABOVE IS UNBRACKETED, AND THAT IS LOAD-
 * BEARING. The guard just named locates call sites by regex over the raw file
 * TEXT across `src/app` AND `src/components`, so a doc comment quoting a full
 * opening tag is parsed AS a call site — this file then reads as an undeclared
 * tenth site and the guard goes RED on correct code. `bookmarks/error.tsx`
 * records the same rule for the same reason; the guard's own docblock files it
 * as @security-auditor POLISH.3 S-L3. Prose naming a JSX tag is not a tag.
 */
export function BookmarksPanel({
	children,
}: {
	children: React.ReactNode;
}): React.JSX.Element {
	return (
		<section
			data-testid="bookmarks-panel"
			aria-label="Bookmarks"
			className="flex min-h-0 flex-col overflow-hidden rounded-[var(--r)] bg-n0 [border:var(--hairline)]"
		>
			<div
				data-testid="bookmarks-panel-head"
				className="flex flex-wrap items-center gap-2 p-3 [border-bottom:var(--hairline)]"
			>
				{/* ⛔ BOTH STRINGS ARE CARRIED, NEITHER AUTHORED. Each is byte-identical
				    to the mockup's BOOKMARK-MODE assignment — `:767`
				    `textContent='Bookmarks'` and `:768` `textContent='Your bookmarks'`
				    — hexdumped in both places: `42 6f 6f 6b 6d 61 72 6b 73` and
				    `59 6f 75 72 20 62 6f 6f 6b 6d 61 72 6b 73`, plain ASCII, no curly
				    forms in either. They are ALSO the literals `page.tsx` has shipped
				    since UI-A6, unchanged here — the two sources agree byte for byte,
				    so nothing moves. */}
				<h1 className="text-xs font-medium text-ink">Bookmarks</h1>
				<Badge variant="outline">Your bookmarks</Badge>
			</div>
			<div
				data-testid="bookmarks-panel-body"
				className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3"
			>
				{children}
			</div>
		</section>
	);
}
