import type { SourceRow } from "./strip";

/**
 * DATASET.1 — reactive-removal masking for the dataset arm.
 *
 * ## The defect this closes
 *
 * Removal in this system is **read-side masking**. `moderateComment("remove")`
 * appends ONE `mod_actions` row with `reason = 'content_removed'` and makes
 * **zero writes to `comments`** (`src/server/admin/moderation/act.ts` — the
 * comment is Bucket-A append-only, so it cannot be edited). Every live read
 * therefore has to intersect the removed set itself, which is what
 * `loadRemovedSet` exists for and what Discovery and the review feed both use.
 *
 * The dataset's `comments` read did not. Appendix B.6 marks `comments.body`
 * `SHIP`, and §19 predates ADR-0021's reactive-moderation model, so nothing in
 * the release contract mentions removal at all. Built literally, the archive
 * would publish every removed body verbatim — and because `mod_actions` also
 * ships with `reason` and `target_comment_id` both `SHIP` (B.10), **it would
 * publish a labelled index of exactly which bodies had been removed**.
 *
 * The two arms of the same tarball would then disagree with each other: the
 * `debates/*.md` files inherit masking through `loadDebateView` (ADR-0025), so
 * one archive would withhold a body in `debates/` and publish it in
 * `comments.csv`.
 *
 * This is CLAUDE.md §5.14 **SC-1** exactly — *"masking is a property of every
 * code path that reads `comments.body`, not of rows"* — firing on a new read.
 *
 * ## Why this withholds rather than ships, absent a ruling
 *
 * ⚠ **This is a deliberate divergence from Appendix B.6's bare `SHIP`, and it
 * needs a web-authored ruling.** The reasoning is asymmetry, not preference:
 *
 *   · Ship-then-rule is **unrecoverable**. The artifact is CC-BY-4.0 and
 *     cannot be un-downloaded; a body published on 6 November is public
 *     forever, whatever anyone rules on 7 November.
 *   · Withhold-then-rule is **cheap**. §19.1 explicitly contemplates a v2
 *     *"for bug-fixes against the same source state"*, and reversing this is
 *     deleting one predicate.
 *
 * CLAUDE.md §3 also states moderation is never weakened, bypassed, or made
 * optional. Republishing content an admin removed is the strongest available
 * form of un-removing it, and an unattended run is the last thing that should
 * decide to do that quietly.
 *
 * ## The shape it ships in, and why that shape
 *
 * The row is **preserved** with the body **withheld** — not dropped. That is
 * §19.4's own H2-erasure precedent, applied by analogy: erased users *"ship in
 * the same shape as not-erased rows"* with the sensitive columns NULL and the
 * row intact, because dropping rows breaks the audit trail and the join graph.
 * A removed comment's `bets` row, `dharma_ledger` entries and reply thread all
 * still reference it; deleting it would corrupt every one of those joins and
 * silently change the participant and stake totals researchers compute.
 *
 * The removal is *itself* research signal — `mod_actions` shipping means a
 * reader can see that a comment was removed, when, and under what reason.
 * What they cannot see is what it said, which is the point of removing it.
 */

/** `mod_actions.reason` value that denotes a reactive content removal. */
export const CONTENT_REMOVED_REASON = "content_removed";

/**
 * Columns withheld from a removed comment.
 *
 * `body` is the argument text. `image_uploads_id` goes with it because a
 * removed comment's attached image is part of the removed content — leaving
 * the FK would let a reader join straight to the `image_uploads` row and
 * recover what was removed by a different route, which is the same leak
 * wearing a join.
 */
export const WITHHELD_ON_REMOVAL = ["body", "image_uploads_id"] as const;

/**
 * Build the removed-comment id set from the source `mod_actions` rows.
 *
 * ⚠ Derived from the SAME predicate as `loadRemovedSet`
 * (`mod_actions.reason = 'content_removed'`) rather than re-implemented from a
 * second idea of what removal means. `review-feed.ts` records why: a second
 * definition of the removed set is how one surface masks and another does not.
 *
 * The pipeline already reads `mod_actions` as a shipped table, so this costs
 * no extra query — the set is derived from rows already in hand.
 */
export function removedCommentIds(
	modActionRows: readonly SourceRow[],
): ReadonlySet<string> {
	const ids = new Set<string>();
	for (const row of modActionRows) {
		if (row.reason !== CONTENT_REMOVED_REASON) continue;
		const target = row.target_comment_id;
		if (typeof target === "string" && target !== "") ids.add(target);
	}
	return ids;
}

/**
 * Withhold the removed columns from one comment row.
 *
 * ⚠ The keys are **removed**, not nulled, matching every other strip in this
 * pipeline. A surviving `body: null` in a CSV is an empty field, which is
 * indistinguishable from a genuinely empty body — whereas an absent column is
 * uniform across the file and says the same thing for every row. Uniformity
 * matters more here than it looks: the column set is per-file, so `body` is
 * either in the header for all rows or none.
 *
 * Because the column set is fixed per file, a removed row's `body` cell is
 * emitted EMPTY rather than the column disappearing — and that is why
 * `mod_actions` shipping alongside is what tells a reader the difference
 * between "removed" and "blank".
 */
export function maskRemovedComment(row: SourceRow): SourceRow {
	const out: SourceRow = {};
	for (const [k, v] of Object.entries(row)) {
		if ((WITHHELD_ON_REMOVAL as readonly string[]).includes(k)) continue;
		out[k] = v;
	}
	return out;
}
