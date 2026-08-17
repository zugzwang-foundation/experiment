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

/**
 * ⚠⚠ PROFILE REFINEMENT · R3, THE SSR HALF — the initial selection, derived ONCE
 * here so the table and the arena cannot disagree about it.
 *
 * ⛔ WHY THIS EXISTS AT ALL: R3 SHIPPED WITH A MEASURED FLASH. The fallback to the
 * first visible row lives in `PositionsTable`'s render and is reported UPWARD by an
 * effect — and an effect does not run on the server. So the SSR paint carried
 * `selection === null`, and the served HTML contained `argument-list` with the
 * header word `Arguments`: a rail of stubs on first paint, switching to the replica
 * only after hydration. That is precisely the defect R3 removes, one frame long.
 * VERIFIED by reading the served markup, not inferred — `argument-list` present,
 * `argument-replica` absent, title `Arguments`.
 *
 * ⇒ SO THE ARENA SEEDS ITS `useState` WITH THIS, and the first render — server and
 * client alike — already holds a selection.
 *
 * ⛔ IT IS A SHARED PURE FUNCTION RATHER THAN A SECOND COPY OF THE FILTER LOGIC,
 * and that is the whole reason it is here instead of inline in the arena. The
 * first VISIBLE row is not the first row: it depends on the market preselect
 * (`?market=<slug>`) and on the status default, which is itself DERIVED (Gate C
 * S-1 — scoped to the initial market, `Open` if any scoped row is open, else
 * `Closed`, because a fixed `Open` is permanently empty after the freeze). Two
 * copies of that would drift, and the drift would be invisible: the table would
 * highlight one row while the panel showed another.
 * ⇒ `PositionsTable` consumes the SAME helpers for its own state initialisers, so
 * there is exactly one definition of "which rows are visible at mount" and one of
 * "which is first".
 */
export function initialStatusFilter(
	rows: ReadonlyArray<{
		marketId: string;
		statusLabel: "Open" | "Closed";
	}>,
	initialMarketId: string,
): "Open" | "Closed" {
	const scoped =
		initialMarketId === "all"
			? rows
			: rows.filter((r) => r.marketId === initialMarketId);
	return scoped.some((r) => r.statusLabel === "Open") ? "Open" : "Closed";
}

/** The market id the table starts filtered to — the `?market=<slug>` preselect,
 * or `"all"` when the slug is absent or matches no held row. */
export function initialMarketIdOf(
	rows: ReadonlyArray<{ marketId: string; marketSlug: string }>,
	initialMarketSlug: string | undefined,
): string {
	return (
		rows.find((r) => r.marketSlug === initialMarketSlug)?.marketId ?? "all"
	);
}

/**
 * The selection the arena starts with: the FIRST row visible at mount, or `null`
 * when nothing is (an empty holding set, or a preselect whose market holds no row
 * in the derived status). ⚠ `null` here is the honest empty — the panel's existing
 * empty state renders and nothing is invented.
 */
export function initialProfileSelection(
	rows: ReadonlyArray<{
		marketId: string;
		marketSlug: string;
		marketTitle: string;
		statusLabel: "Open" | "Closed";
		argument: { removed: boolean; commentId?: string };
	}>,
	initialMarketSlug: string | undefined,
): ProfileSelection | null {
	const marketId = initialMarketIdOf(rows, initialMarketSlug);
	const status = initialStatusFilter(rows, marketId);
	const first = rows.find(
		(r) =>
			(marketId === "all" || r.marketId === marketId) &&
			r.statusLabel === status,
	);
	if (first === undefined) {
		return null;
	}
	return {
		marketId: first.marketId,
		marketTitle: first.marketTitle,
		// The removed cell variant carries no id — the same rule the type records.
		commentId: first.argument.removed
			? null
			: (first.argument.commentId ?? null),
	};
}
