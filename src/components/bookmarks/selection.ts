/**
 * HTML-FINISH · BOOKMARKS round 3 · C6 — the shape the table hands to the
 * replica panel, mirroring `profile/selection.ts`.
 *
 * ⚠ IT CARRIES NO ARGUMENT CONTENT — only the two keys the panel needs: the
 * market QUESTION for its header (`markets.title`, market metadata, so no
 * masking obligation attaches — SC-1 governs `comments.body` and its
 * derivations) and the bookmarked comment's id to match against the list the
 * panel already holds. No title, no body, no teaser crosses this boundary, so
 * the panel cannot render anything the list has not already masked.
 *
 * ⚠ ONE FIELD FEWER THAN PROFILE'S. `ProfileSelection` carries a nullable
 * `commentId` because a positions row's opener can be `content_removed` and
 * then has no id at all. Here the id is never absent: a bookmark IS a pointer
 * at one comment, and `BookmarkItem.id` is that comment on BOTH union arms —
 * including the removed one.
 */
export type BookmarkSelection = {
	/** `BookmarkItem.id` — the bookmarked comment. Present on every variant. */
	commentId: string;
	/** `markets.title` — the panel header while a row is picked. */
	marketTitle: string;
};

/**
 * ⚠⚠ PROFILE REFINEMENT · R3 (SSR half) — the selection the arena starts with.
 *
 * ⛔ WHY IT EXISTS: the same measured flash Profile had. The first-visible-row
 * fallback lives in `BookmarksTable`'s render and is reported upward by an EFFECT,
 * and effects do not run on the server — so a `null` seed paints the empty replica
 * panel and the header word `Arguments`, switching only after hydration. R3 rules
 * the rail must show an argument on load, and one frame of not doing so is still
 * not doing so.
 *
 * ⚠ SIMPLER THAN PROFILE'S BY EXACTLY ONE THING, and the asymmetry is real rather
 * than an oversight: this route has NO status filter (C4 — `BookmarkItem` carries
 * no `statusLabel`, so there is nothing to partition on) and no `?market=`
 * preselect, so "the first visible row at mount" is just the first item. Profile
 * needs a shared helper because its answer is derived from two filters; here the
 * answer is the head of the list, and a helper still earns its place by keeping the
 * arena from restating even that.
 */
export function initialBookmarkSelection(
	items: ReadonlyArray<{ id: string; marketTitle: string }>,
): BookmarkSelection | null {
	const first = items[0];
	if (first === undefined) {
		return null;
	}
	return { commentId: first.id, marketTitle: first.marketTitle };
}
