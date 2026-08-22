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
 * the comment id to match against the already-loaded argument list. No title, no
 * body, no teaser crosses this boundary, so the panel cannot render anything the
 * list itself has not already masked.
 */
export type ProfileSelection = {
	marketId: string;
	/** `markets.title` — the panel header when a tile is picked (mockup `:650`). */
	marketTitle: string;
	/**
	 * The selected ARGUMENT's comment id, matched against `ProfileArgumentItem.id`.
	 * NULL when that argument is `content_removed`: the removed cell variant
	 * carries `{ removed: true, marketSlug }` and nothing else, so there is no id
	 * to match — which is the union doing its job. The panel renders the removed
	 * stub for that case rather than guessing.
	 */
	commentId: string | null;
};

/**
 * ⚠⚠ POSREV-1 — **THE UNIT OF SELECTION IS THE ARGUMENT, NOT THE MARKET.**
 *
 * These helpers used to answer "which market ROW is first at mount", because the
 * table had one row per market and the panel showed that row's episode-opening
 * argument. RF-3 makes the table one tile per ARGUMENT under a market header, so
 * the question is now "which TILE is first" — and the answer is a different one
 * whenever a participant holds more than one argument in the same market. Under
 * the old derivation the panel showed the market's episode opener no matter
 * which of its arguments the reader had picked.
 *
 * ⚠⚠ PROFILE REFINEMENT · R3, THE SSR HALF — the initial selection is derived
 * ONCE here so the table and the arena cannot disagree about it.
 *
 * ⛔ WHY THAT EXISTS AT ALL: R3 SHIPPED WITH A MEASURED FLASH. The fallback to
 * the first visible tile lives in `PositionsTable`'s render and is reported
 * UPWARD by an effect — and an effect does not run on the server. So the SSR
 * paint carried `selection === null`, and the served HTML contained
 * `argument-list` with the header word `Arguments`: a rail of stubs on first
 * paint, switching to the replica only after hydration. That is precisely the
 * defect R3 removes, one frame long. VERIFIED by reading the served markup.
 *
 * ⇒ SO THE ARENA SEEDS ITS `useState` WITH THIS, and the first render — server
 * and client alike — already holds a selection.
 *
 * ⛔ IT IS A SHARED PURE FUNCTION RATHER THAN A SECOND COPY OF THE FILTER LOGIC.
 * "Which tile is first at mount" depends on the market preselect
 * (`?market=<slug>`) and on the tab default, which is itself DERIVED. Two copies
 * would drift, and the drift would be invisible: the table would highlight one
 * tile while the panel showed another.
 */

/** The minimum a row must expose for these helpers — structural, so the render
 * tests can pass literals without building a whole DTO. */
type SelectableLot = {
	lotId: string;
	survivingShares: string;
	argument: { removed: boolean; commentId?: string };
};
type SelectableRow = {
	marketId: string;
	marketSlug: string;
	marketTitle: string;
	/**
	 * `positions.quantity` — needed here ONLY for the whole-holding fallback: a
	 * held position with no `lots` rows still contributes one Open tile, and a tab
	 * derivation blind to that would send someone with a lots↔positions drift to
	 * the Closed tab and show them nothing.
	 */
	quantity: string;
	/** The holding's episode-opening argument — the fallback tile's cell. */
	argument: { removed: boolean; commentId?: string };
	lots: SelectableLot[];
};

/**
 * POSREV-1 RF-13 — **the tab is HOLDING status, not market status.** An argument
 * with surviving shares is Open; one with none is Closed. ⛔ The predicate is
 * `surviving_shares > 0`, EXACTLY — never zero BASIS. `lots_sold_zeroes_basis`
 * is deliberately ONE-DIRECTIONAL (`db/schema/lots.ts:186-189`): shares
 * imply basis, but not the converse, because an 18-dp quantization can in
 * principle round a basis to zero while dust shares remain. Reading zero basis
 * as "sold" would retire a lot that is still sellable, and the holder would
 * watch it leave the tab that has the Sell control in it.
 */
export function isOpenLot(lot: { survivingShares: string }): boolean {
	return isPositiveAmount(lot.survivingShares);
}

/**
 * A canonical NUMERIC(38,18) string is positive iff it contains a non-zero
 * digit. ⚠ NOT `Number(v) > 0` — that is a float on money — and NOT a string
 * comparison, which orders `"0.5"` below `"0.10"`. This works because the
 * canonical 18-dp form is the ONLY spelling these columns ever hold: a full sale
 * writes `CANONICAL_ZERO` rather than dividing down to it, so "zero" is always
 * exactly eighteen zeros after the point and any `1`–`9` anywhere means positive.
 */
function isPositiveAmount(value: string): boolean {
	return /[1-9]/.test(value);
}

/**
 * ⚠⚠ **THE WHOLE-HOLDING FALLBACK, SHARED BETWEEN THE SEED AND THE RENDER.**
 *
 * A holding with no `lots` rows has no argument to make a tile out of — and
 * dropping it would take a position someone still HOLDS off their own table,
 * along with its Sell. That is the veto `planLotSale` refuses ("an attribution
 * layer must never be able to veto the authority it describes"), and a profile
 * that renders nothing commits it just as surely as an endpoint that throws.
 *
 * So such a row contributes exactly ONE tile, to the **Open tab only**, carrying
 * the holding's own episode-opening argument. Closed means "you exited this
 * argument", and there is no argument here to have exited.
 *
 * ⛔ IT LIVES HERE RATHER THAN IN THE TABLE because the SEED needs it too: a tab
 * derivation blind to the fallback answers `Closed` for a drifted holding and
 * lands the reader on an empty tab — which is how a rendering fallback becomes
 * invisible. One definition, so the tab, the seed and the tiles agree.
 */
export function usesWholeHoldingFallback(row: {
	quantity: string;
	lots: readonly unknown[];
}): boolean {
	return row.lots.length === 0 && isPositiveAmount(row.quantity);
}

/** Does this row contribute at least one tile to `status`? */
export function rowHasTileIn(
	row: SelectableRow,
	status: "Open" | "Closed",
): boolean {
	if (status === "Closed") {
		return row.lots.some((l) => !isOpenLot(l));
	}
	return row.lots.some(isOpenLot) || usesWholeHoldingFallback(row);
}

/**
 * The tab the table starts on. Scoped to the INITIAL MARKET, not to all rows: a
 * `?market=<slug>` deep link to a market whose arguments are all closed would
 * otherwise land on a blank table.
 *
 * ⚠ DERIVED, NEVER FIXED — POLISH.5 Gate C S-1's reasoning survives RF-13's
 * redefinition intact. A fixed `Open` is permanently empty for anyone whose
 * arguments are all exited, and the case is no longer rare: exiting is now a
 * per-argument action, so a participant who trims their position accumulates
 * closed arguments from their first sell onward.
 */
export function initialStatusFilter(
	rows: readonly SelectableRow[],
	initialMarketId: string,
): "Open" | "Closed" {
	const scoped =
		initialMarketId === "all"
			? rows
			: rows.filter((r) => r.marketId === initialMarketId);
	return scoped.some((r) => rowHasTileIn(r, "Open")) ? "Open" : "Closed";
}

/** The market id the table starts filtered to — the `?market=<slug>` preselect,
 * or `"all"` when the slug is absent or matches no row. */
export function initialMarketIdOf(
	rows: readonly { marketId: string; marketSlug: string }[],
	initialMarketSlug: string | undefined,
): string {
	return (
		rows.find((r) => r.marketSlug === initialMarketSlug)?.marketId ?? "all"
	);
}

/**
 * The selection the arena starts with: the FIRST TILE visible at mount, or
 * `null` when nothing is (an empty holding set, or a preselect whose market has
 * no argument in the derived tab). ⚠ `null` here is the honest empty — the
 * panel's existing empty state renders and nothing is invented.
 */
export function initialProfileSelection(
	rows: readonly SelectableRow[],
	initialMarketSlug: string | undefined,
): ProfileSelection | null {
	const marketId = initialMarketIdOf(rows, initialMarketSlug);
	const status = initialStatusFilter(rows, marketId);
	for (const row of rows) {
		if (marketId !== "all" && row.marketId !== marketId) {
			continue;
		}
		const lot = row.lots.find((l) =>
			status === "Open" ? isOpenLot(l) : !isOpenLot(l),
		);
		// The fallback's tile carries the HOLDING's own argument, not a lot's — the
		// same cell the table renders for it, so the highlighted tile and the panel
		// still show one thing.
		const argument =
			lot?.argument ??
			(status === "Open" && usesWholeHoldingFallback(row)
				? row.argument
				: undefined);
		if (argument === undefined) {
			continue;
		}
		return {
			marketId: row.marketId,
			marketTitle: row.marketTitle,
			// The removed cell variant carries no id — the same rule the type records.
			commentId: argument.removed ? null : (argument.commentId ?? null),
		};
	}
	return null;
}
