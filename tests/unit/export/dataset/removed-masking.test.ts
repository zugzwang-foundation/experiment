import { gunzipSync } from "node:zlib";

import { describe, expect, it } from "vitest";

import { buildDataset, harvestSecrets } from "@/server/export/dataset/build";
import {
	CONTENT_REMOVED_REASON,
	maskRemovedComment,
	removedCommentIds,
} from "@/server/export/dataset/removed";
import { fixtureSource } from "@/server/export/dataset/source";
import { stripTable } from "@/server/export/dataset/strip";
import { assertTableClean } from "@/server/export/egress";

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

	it("…and absent from the TARBALL, which is what 'every artifact' has to mean", () => {
		// ⚠ **The test above does not cover what its name says.** `r.artifacts`
		// is the CSV list ONLY; `opts.extraEntries` — the `debates/*.md` class —
		// enters the tarball without ever appearing in it. So the assertion
		// reads as an archive-wide claim and is a per-table one, and the very
		// artifact class most likely to carry a body verbatim is the class it
		// cannot see.
		//
		// Scanning the decompressed archive makes the claim structural: an entry
		// cannot get into the tarball without passing under this assertion,
		// whatever list it arrived on.
		const debate = [
			"# Will the Mumbai Metro Line 3 open by 5 Nov 2026?",
			"",
			"**BasaltHeron117** · NO",
			"",
			"> [removed by moderation]",
			"",
		].join("\n");

		return buildDataset({
			source,
			releaseDate: "2026-11-06",
			extraEntries: [
				{ name: "debates/mumbai-metro-line-3.md", content: debate },
			],
		}).then((r) => {
			const archive = gunzipSync(r.tarball).toString("utf8");
			// Control: the archive really does contain the files.
			expect(archive).toContain("comments.csv");
			expect(archive).toContain("debates/mumbai-metro-line-3.md");
			expect(archive).toContain("The tunnelling is complete");
			// The canary is in none of them.
			expect(archive).not.toContain("REMOVED-BODY-CANARY");
		});
	});

	it("⛔ KNOWN OPEN — a removed body has no VALUE class, so only ONE mechanism holds R1", () => {
		// ⚠⚠ **A tripwire, not a passing guard.**
		//
		// `EgressSecrets` carries ten value classes, and three of them
		// (`display-name`, `avatar-url`, `blocked-text`) exist precisely because
		// `@code-reviewer` H-4 found STRIP columns with no VALUE class — the
		// layer's strongest assertion, *"this exact string, known to be in the
		// source, is absent from the artifact"*, had never been pointed at them.
		//
		// A reactively-removed `comments.body` is in exactly that position now.
		// It is WITHHELD by ruling R1, the removed set is derivable at harvest
		// time from rows the pipeline already reads (`mod_actions` ∩ `comments`),
		// and no class covers it. So R1 rests on ONE mechanism — the predicate
		// inside `stripRow` — with no value-level backstop behind it. A second
		// read path that emitted the body (a teaser column, a payload field, a
		// debate document built from the unmasked model) would publish it and
		// every guard would report clean.
		//
		// That is CLAUDE.md §5.14 SC-1's own argument: masking is a property of
		// every code path that reads `comments.body`, and a guarantee that lives
		// in one predicate is a guarantee about one call site.
		//
		// Not closable in the test layer — adding a class means adding a field to
		// `EgressSecrets` and a harvest step in `build.ts`.
		// The canary IS in the source…
		expect(
			DIRTY_TABLE_ROWS.comments.some((c) => c.body === REMOVED_COMMENT_BODY),
		).toBe(true);

		// …and no harvested value class contains it. Pinned as the ABSENCE of a
		// class rather than the presence of a leak, so this goes RED the day
		// someone adds one — which is the signal wanted.
		const secrets = harvestSecrets(DIRTY_TABLE_ROWS as never);
		for (const [name, values] of Object.entries(secrets)) {
			expect(
				(values as ReadonlySet<string>).has(REMOVED_COMMENT_BODY),
				`${name} unexpectedly covers a removed body — invert this test`,
			).toBe(false);
		}

		// Consequence, made concrete: a row carrying the withheld body under any
		// key at all passes every guard the layer has.
		const guarded = assertTableClean(
			"events",
			[{ event_id: "probe", teaser: REMOVED_COMMENT_BODY }],
			secrets,
		);
		expect(guarded.advisories).toEqual([]);
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

	it("the body COLUMN survives; the removed row's CELL is empty", () => {
		// ⚠ `removed.ts` states this shape explicitly — *"a removed row's `body`
		// cell is emitted EMPTY rather than the column disappearing"*, because
		// the column set is per-file and uniformity is what stops the absence
		// itself from being a signal — and nothing asserted it.
		//
		// The distinction matters: masking by DELETING the column would satisfy
		// every "the canary is not in the bytes" assertion above while destroying
		// `comments.body` for the whole corpus, which is the dataset's
		// thesis-core signal.
		return build().then((r) => {
			const comments = r.artifacts.find((a) => a.filename === "comments.csv");
			expect(comments?.columns).toContain("body");

			const [header, ...dataLines] = (comments?.text ?? "").split("\n");
			const cols = (header ?? "").split(",");
			const idAt = cols.indexOf("id");
			const bodyAt = cols.indexOf("body");
			expect(idAt).toBeGreaterThanOrEqual(0);
			expect(bodyAt).toBeGreaterThanOrEqual(0);

			// The removed row's line: id first field, body field empty.
			const removedLine = dataLines.find((l) =>
				l.startsWith(`${REMOVED_COMMENT_ID},`),
			);
			expect(removedLine).toBeDefined();
			expect((removedLine ?? "").split(",")[bodyAt]).toBe("");

			// ⚠ CONTROL on the field arithmetic. Without it, `bodyAt` could point
			// at any always-empty column and the assertion above would hold for a
			// reason that has nothing to do with masking. The kept row's body sits
			// at the SAME index and is non-empty.
			const keptLine = dataLines.find(
				(l) => l.length > 0 && !l.startsWith(`${REMOVED_COMMENT_ID},`),
			);
			expect(keptLine).toBeDefined();
			expect((keptLine ?? "").split(",")[bodyAt]).toContain("The tunnelling");
		});
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
		// ⚠ An EMPTY set, passed EXPLICITLY. This argument used to be optional
		// and defaulted to no masking, so this line could be written by
		// accident anywhere and publish every removed body silently
		// (`@security-auditor` M-9). It is now required — so demonstrating the
		// leak takes a deliberate statement, which is exactly the difference
		// between a guard and a default.
		const unmasked = stripTable("comments", DIRTY_TABLE_ROWS.comments, {
			removedCommentIds: new Set(),
		});
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
