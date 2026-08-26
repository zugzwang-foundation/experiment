import { describe, expect, it } from "vitest";

import {
	deriveReplySide,
	replyComposerColumn,
} from "@/components/debate/composer/gating";
import type { Side } from "@/components/debate/types";

/**
 * RPLY-1 · R1 · G1 — THE FOUR-ROW COLUMN MATRIX.
 *
 * ⚠⚠ WHAT WAS ACTUALLY WRONG, because the fix looks like a one-token edit and
 * is not. `DebateView`'s post arm read
 * `const composerColumn = opposite(selectedPost.sideAtPostTime)`. The RELATION
 * was not an input to that expression at all — so Support and Counter could not
 * produce different columns, no matter what the reader clicked. Support
 * coincided with the correct answer by ARITHMETIC ACCIDENT: a Support bet
 * inherits its parent's side, so opposite-the-parent and opposite-the-bet are
 * the same pole. Counter did not: a Counter on a YES parent bets NO and the
 * composer opened inside the NO column — on top of the side being bet.
 *
 * ⛔ THE RULE WAS FAILING ITS OWN STATED REASON. design-canon §3.3 gives the
 * slot rule as "the bet's side stays visible", and the bet's side was precisely
 * what the composer covered on every Counter. So this is not a preference — it
 * is the post arm catching up to a rule the market arm already keeps.
 *
 * ⛔⛔ WHY THIS FILE ASSERTS THE COLUMN AND NEVER THE BADGE. A matrix test can
 * pass while reading the wrong thing: the badge renders `resultingSide`, which
 * was ALREADY correct before the fix, so a test that checked the badge would
 * have been green against the defect and green after it — proving nothing. The
 * subject here is `replyComposerColumn`, whose entire output IS the column.
 * ⚠ Its positive control is the row-by-row `deriveReplySide` assertion below:
 * if the two ever disagreed about what a relation bets, the column would be
 * "opposite" the wrong thing and this file would still be checking it against
 * itself. Asserting the bet side per row is what stops that.
 *
 * ⚠ NOT A SOURCE SCAN. `side-identity.test.tsx` pins the call site textually
 * (and pins the superseded form GONE); this file pins the BEHAVIOUR, because a
 * string match cannot tell you that the four rows are the RIGHT four rows.
 */

/**
 * The matrix, written out rather than computed. ⛔ Deriving the expected column
 * from `deriveReplySide` here would re-implement the very rule under test and
 * pass against any self-consistent inversion — the numbers have to be stated.
 */
const MATRIX: Array<{
	parentSide: Side;
	relation: "support" | "counter";
	betSide: Side;
	column: Side;
}> = [
	{ parentSide: "YES", relation: "support", betSide: "YES", column: "NO" },
	{ parentSide: "YES", relation: "counter", betSide: "NO", column: "YES" },
	{ parentSide: "NO", relation: "support", betSide: "NO", column: "YES" },
	{ parentSide: "NO", relation: "counter", betSide: "YES", column: "NO" },
];

describe("R1 — the reply composer hosts in the column opposite the BET", () => {
	for (const row of MATRIX) {
		it(`reply-column::${row.parentSide}-parent-${row.relation}-bets-${row.betSide}-and-hosts-in-${row.column}`, () => {
			// The bet side first — the control that keeps the column assertion from
			// being a tautology (see the docblock).
			expect(
				deriveReplySide({
					parentSide: row.parentSide,
					relation: row.relation,
				}),
			).toBe(row.betSide);

			// ⛔ THE ASSERTION THIS FILE EXISTS FOR.
			expect(
				replyComposerColumn({
					parentSide: row.parentSide,
					relation: row.relation,
				}),
			).toBe(row.column);

			// …and the composer never opens on the side it is betting. Stated as its
			// own assertion because it is the PROPERTY; the four rows above are
			// merely the four ways to reach it.
			expect(
				replyComposerColumn({
					parentSide: row.parentSide,
					relation: row.relation,
				}),
			).not.toBe(row.betSide);
		});
	}

	it("reply-column::the-column-is-a-function-of-the-RELATION-not-only-the-parent", () => {
		// ⛔⛔ THE DEFECT, STATED DIRECTLY. Under `opposite(parentSide)` both
		// relations on one parent produced the SAME column, and that identity is
		// the whole bug. This is the assertion that reddens on a revert, and it
		// does so for BOTH parent sides — a one-sided version would have passed
		// against the old code on the YES half by the same accident that made
		// Support look correct.
		for (const parentSide of ["YES", "NO"] as const) {
			expect(replyComposerColumn({ parentSide, relation: "support" })).not.toBe(
				replyComposerColumn({ parentSide, relation: "counter" }),
			);
		}
	});

	it("reply-column::the-two-relations-on-one-parent-cover-BOTH-columns", () => {
		// The mirror of the row above: not merely different, but exhaustive. A
		// column rule that returned the same pole for three of the four inputs
		// would satisfy "different" on one parent and still be wrong.
		for (const parentSide of ["YES", "NO"] as const) {
			const columns = (["support", "counter"] as const).map((relation) =>
				replyComposerColumn({ parentSide, relation }),
			);
			expect([...columns].sort()).toEqual(["NO", "YES"]);
		}
	});
});
