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
