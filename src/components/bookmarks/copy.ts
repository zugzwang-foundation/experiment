// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * HTML-FINISH · BOOKMARKS R2 — the surface's copy, in ONE module.
 *
 * ⛔ NOTHING HERE IS AUTHORED. Every string names its source and was hexdumped
 * against it (CLAUDE.md §3: CC never invents product copy):
 *
 *   `Bookmarks`        ⑵ canon §6 **Bookmark** line — "list `Bookmarks` · chip
 *                        `Your bookmarks` · visitor mode, never Sell". Bytes
 *                        `42 6f 6f 6b 6d 61 72 6b 73`; identical to the mockup's
 *                        bookmark-mode assignment at `:767` and to the literal
 *                        `page.tsx` has shipped since UI-A6.
 *   `Your bookmarks`   ⑵ same canon line. Bytes
 *                        `59 6f 75 72 20 62 6f 6f 6b 6d 61 72 6b 73`; identical
 *                        to the mockup at `:768` and to the shipped literal.
 *   `Select market ▾`  ⑵ canon §6 **Profile** line, which writes the bookmark
 *                        rename inside itself — "list `Positions`
 *                        (→ `Bookmarks`) · filters `Select market ▾`" — so the
 *                        filter copy travels with the surface. Hexdumped against
 *                        BOTH canon and `profile/PositionsTable.tsx`: byte-
 *                        identical, caret `e2 96 be` (U+25BE).
 *   `All markets`      ⑶ the mockup (`:42`, `:50`, `:66`, `:147`) and the
 *                        shipped `PositionsTable.tsx` popover, agreeing.
 *   empty msg + sub    ⑴ the shipped `BOOKMARKS_EMPTY_COPY` (POLISH.6 / OD-1),
 *                        moved here byte-unchanged and re-exported under its old
 *                        name so no consumer or test has to move with it.
 *
 * ⚠ ONE MOCKUP LABEL DELIBERATELY NOT ADOPTED. The mockup relabels the filter
 * button to `All markets ▾` once a market is chosen (`:42-43`). Canon §6 pins
 * `Select market ▾` and the shipped build agrees, so the static label stays and
 * the mockup's relabel is recorded as a divergence rather than taken — tier-2
 * canon outranks the prototype on copy.
 *
 * ⛔ TWO STRINGS THE MOCKUP HAS THAT ARE NOT CARRIED, each for a stated reason:
 *  · `Select a position to read its argument.` + `Sell lives here too — the
 *    footer slides into the sell action.` (`:480`) — the replica's no-selection
 *    state. Its SECOND sentence is false on this route: ADR-0032 D-5 rules
 *    "there is never a Sell mount". And the state itself is UNREACHABLE here —
 *    the market options are derived from the items, so no filter choice can
 *    strand the list, and a selection exists whenever an item does. Rather than
 *    ship a sentence-split for a state that cannot occur, the right panel simply
 *    does not render when there is nothing to select.
 *  · `Market title` (`:477`) — the right panel's no-selection placeholder. Dummy
 *    copy; the panel's title is the selected item's real `marketTitle` instead.
 */

export const BOOKMARKS_COPY = {
	/** The left panel's title — canon §6's `list \`Bookmarks\``. */
	listTitle: "Bookmarks",
	/** The view chip — canon §6's `chip \`Your bookmarks\``. */
	viewChip: "Your bookmarks",
	/** The market filter's static label. */
	marketFilter: "Select market ▾",
	/** The popover's reset option. */
	allMarkets: "All markets",
	empty: {
		msg: "No bookmarks yet.",
		sub: "Saved arguments will appear here.",
	},
} as const;
