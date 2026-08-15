/**
 * ROUND 4 item 7 — the shape the positions table hands to the argument panel.
 *
 * It lives in its own module rather than on either component because both need
 * it and neither owns it: `PositionsTable` produces it, `ArgumentList` consumes
 * it, and importing one from the other would point the dependency the wrong way
 * for a value that belongs to neither.
 *
 * ⚠ IT CARRIES NO ARGUMENT CONTENT — only the two keys the panel needs: the
 * market QUESTION for its header (`markets.title`, market metadata, no masking
 * obligation attaches — SC-1 governs `comments.body` and its derivations) and
 * the opener's comment id to match against the already-loaded argument list. No
 * title, no body, no teaser crosses this boundary, so the panel cannot render
 * anything the list itself has not already masked.
 */
export type ProfileSelection = {
	marketId: string;
	/** `markets.title` — the panel header when a row is picked (mockup `:650`). */
	marketTitle: string;
	/**
	 * The episode-opening comment's id, matched against `ProfileArgumentItem.id`.
	 * NULL when that opener is `content_removed`: the removed cell variant
	 * carries `{ removed: true, marketSlug }` and nothing else, so there is no id
	 * to match — which is the union doing its job. The panel renders the removed
	 * stub for that case rather than guessing at a row.
	 */
	commentId: string | null;
};
