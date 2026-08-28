import { describe, expect, it } from "vitest";

import { buildDataset } from "@/server/export/dataset/build";
import {
	CONTENT_REMOVED_REASON,
	maskRemovedComment,
	removedCommentIds,
} from "@/server/export/dataset/removed";
import { fixtureSource } from "@/server/export/dataset/source";
import { stripTable } from "@/server/export/dataset/strip";

import {
	DIRTY_TABLE_ROWS,
	REMOVED_COMMENT_BODY,
	REMOVED_COMMENT_ID,
} from "../../../_fixtures/dataset/dirty-source";

/**
 * DATASET.1 — reactive-removal masking on the dataset arm.
 *
 * Minted from `@test-writer`'s C-1: the dataset's `comments` read intersected
 * no removed set, so a moderator-removed body would ship verbatim into a
 * CC-BY-4.0 archive — alongside a `mod_actions` table that labels precisely
 * which bodies were removed.
 *
 * ⚠ **Every assertion here is on the BODY STRING's absence from the emitted
 * bytes, never on the row's absence** — CLAUDE.md §5.14 SC-1's second
 * obligation, verbatim: *"its test MUST assert the BODY's absence, not the
 * row's (`expect(JSON.stringify(rows)).not.toContain(theBody)`, not only
 * `expect(ids).not.toContain(theRow)`)"*. A row-level assertion would pass
 * against a pipeline that kept the row and published the body, which is the
 * exact shape of the defect.
 */

const source = fixtureSource("fixture", DIRTY_TABLE_ROWS as never);
const build = () => buildDataset({ source, releaseDate: "2026-11-06" });

describe("removed masking · the fixture can express the scenario", () => {
	it("POSITIVE CONTROL — the SOURCE carries a removed comment and its body", () => {
		// Without this the whole file is vacuous: an absence proved over data
		// that never held the thing is not a proof. This is brief §3's
		// argument applied to the scenario C-1 named as unrepresentable.
		const comment = DIRTY_TABLE_ROWS.comments.find(
			(c) => c.id === REMOVED_COMMENT_ID,
		);
		expect(comment).toBeDefined();
		expect(comment?.body).toBe(REMOVED_COMMENT_BODY);

		const action = DIRTY_TABLE_ROWS.mod_actions.find(
			(m) => m.target_comment_id === REMOVED_COMMENT_ID,
		);
		expect(action?.reason).toBe(CONTENT_REMOVED_REASON);
	});

	it("derives the removed set from the same predicate loadRemovedSet uses", () => {
		const ids = removedCommentIds(DIRTY_TABLE_ROWS.mod_actions);
		expect(ids.has(REMOVED_COMMENT_ID)).toBe(true);
		// …and does NOT sweep in gate-block actions, which are a different
		// reason entirely and remove nothing.
		expect(ids.size).toBe(1);
	});

	it("POSITIVE CONTROL — a track_b_blocked action does NOT mark anything removed", () => {
		const ids = removedCommentIds([
			{
				reason: "track_b_blocked",
				target_comment_id: "0192f3a4-0000-7000-8000-00000000cm99",
			},
		]);
		expect(ids.size).toBe(0);
	});
});

describe("removed masking · THE BODY does not reach any written file", () => {
	it("the removed body is absent from comments.csv", () => {
		return build().then((r) => {
			const comments = r.artifacts.find((a) => a.filename === "comments.csv");
			expect(comments).toBeDefined();
			// The BODY, not the row.
			expect(comments?.text).not.toContain(REMOVED_COMMENT_BODY);
			expect(comments?.text).not.toContain("REMOVED-BODY-CANARY");
		});
	});

	it("the removed body is absent from EVERY emitted artifact", () => {
		// Not just the table it lives in. A body can reach another file by a
		// teaser, a snippet, or a payload — the review-feed leak that minted
		// SC-1 was a second read path in the same file.
		return build().then((r) => {
			const all = r.artifacts.map((a) => a.text).join("\n");
			expect(all).not.toContain("REMOVED-BODY-CANARY");
		});
	});

	it("the ROW survives, and that is deliberate", () => {
		// §19.4's H2-erasure precedent: erased rows "ship in the same shape",
		// row preserved, sensitive fields withheld. Dropping the row would
		// corrupt every join that references this comment — its bets, its
		// dharma_ledger entries, its reply thread — and silently change the
		// participant and stake totals researchers compute.
		return build().then((r) => {
			const comments = r.artifacts.find((a) => a.filename === "comments.csv");
			expect(comments?.text).toContain(REMOVED_COMMENT_ID);
			expect(comments?.rowCount).toBe(2);
		});
	});

	it("the non-removed comment's body is UNTOUCHED", () => {
		// The control that proves the mask is targeted rather than blanket.
		// A pipeline that dropped every body would pass all the assertions
		// above while destroying the dataset's thesis-core signal.
		return build().then((r) => {
			const comments = r.artifacts.find((a) => a.filename === "comments.csv");
			expect(comments?.text).toContain(
				"The tunnelling is complete and trial runs began in August.",
			);
		});
	});

	it("mod_actions still records THAT a removal happened", () => {
		// Removal is itself research signal. What a reader loses is what the
		// comment said — not the fact that it was removed, when, or by whom.
		return build().then((r) => {
			const mod = r.artifacts.find((a) => a.filename === "mod_actions.csv");
			expect(mod?.text).toContain(CONTENT_REMOVED_REASON);
			expect(mod?.text).toContain(REMOVED_COMMENT_ID);
		});
	});

	it("the removed comment's image FK is withheld too", () => {
		// Leaving it would let a reader join straight to image_uploads and
		// recover the removed content by a different route — the same leak
		// wearing a join.
		const [masked] = stripTable("comments", [DIRTY_TABLE_ROWS.comments[0]], {
			removedCommentIds: new Set([REMOVED_COMMENT_ID]),
		});
		expect(masked).not.toHaveProperty("body");
		expect(masked).not.toHaveProperty("image_uploads_id");
		// Structural columns survive.
		expect(masked).toHaveProperty("id");
		expect(masked).toHaveProperty("side_at_post_time");
	});

	it("the manifest tells the reader masking happened", () => {
		// An archive that silently withholds is worse than one that says so:
		// a researcher computing over `body` needs to know some are absent by
		// policy rather than by accident.
		return build().then((r) => {
			expect(r.manifest.notes.join(" ")).toContain("reactively removed");
		});
	});
});

describe("removed masking · THE WRONG ANSWER, constructed", () => {
	it("without the removed set, the body DOES ship — the defect, reproduced", () => {
		// The mutation, written as a test rather than performed by hand: this
		// is `stripTable` called exactly as the pipeline called it before the
		// fix, and it demonstrates the leak rather than asserting it is gone.
		const unmasked = stripTable("comments", DIRTY_TABLE_ROWS.comments);
		expect(JSON.stringify(unmasked)).toContain("REMOVED-BODY-CANARY");

		// …and with the set threaded through, it does not.
		const masked = stripTable("comments", DIRTY_TABLE_ROWS.comments, {
			removedCommentIds: removedCommentIds(DIRTY_TABLE_ROWS.mod_actions),
		});
		expect(JSON.stringify(masked)).not.toContain("REMOVED-BODY-CANARY");
	});

	it("maskRemovedComment removes the keys rather than nulling them", () => {
		const out = maskRemovedComment({ id: "x", body: "secret", side: "YES" });
		expect("body" in out).toBe(false);
		expect(out.id).toBe("x");
		expect(out.side).toBe("YES");
	});
});
