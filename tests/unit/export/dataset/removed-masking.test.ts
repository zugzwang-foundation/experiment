import { gunzipSync } from "node:zlib";

import { describe, expect, it } from "vitest";

import { buildDataset, harvestSecrets } from "@/server/export/dataset/build";
import {
	buildPseudonymMap,
	pseudonymizeTable,
} from "@/server/export/dataset/pseudonymize";
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

	it("H · a removed body HAS a value class now — the pin, INVERTED", () => {
		// ⚠⚠ **This was a tripwire and it has fired.** Its DATASET.2 form
		// asserted the ABSENCE of a class, and said so explicitly: *"pinned as
		// the absence of a class rather than the presence of a leak, so this
		// goes RED the day someone adds one — which is the signal wanted."*
		// Ruling H added one at DATASET.3. This is the inversion it demanded.
		//
		// What it was about: `EgressSecrets` carries a value class for every
		// other STRIP-class column, three of them added by `@code-reviewer`
		// H-4 after exactly this observation — that the layer's strongest
		// assertion, *"this exact string, known to be in the source, is absent
		// from the artifact"*, had never been pointed at them. A reactively-
		// removed `comments.body` sat in that position: withheld by ONE
		// predicate inside `stripRow`, with nothing behind it. A second read
		// path emitting the body — a teaser column, a payload field, a debate
		// document built from the unmasked model — would have published it
		// with every guard reporting clean.
		//
		// That is CLAUDE.md §5.14 SC-1's own argument: masking is a property of
		// every code path that reads `comments.body`, and a guarantee living in
		// one predicate is a guarantee about one call site.

		// The canary IS in the source…
		expect(
			DIRTY_TABLE_ROWS.comments.some((c) => c.body === REMOVED_COMMENT_BODY),
		).toBe(true);

		// …and it is now harvested, into its own class and no other. Pinning
		// the CLASS rather than "some class covers it" matters: a body landing
		// in `blockedTexts` would look like coverage and would carry the wrong
		// tier and the wrong reason.
		const secrets = harvestSecrets(DIRTY_TABLE_ROWS as never);
		expect(secrets.removedBodies.has(REMOVED_COMMENT_BODY)).toBe(true);
		for (const [name, values] of Object.entries(secrets)) {
			if (name === "removedBodies" || name === "participantSourced") continue;
			expect(
				(values as ReadonlySet<string>).has(REMOVED_COMMENT_BODY),
				`${name} also covers the removed body — one class, one reason`,
			).toBe(false);
		}

		// Consequence, made concrete and INVERTED: the row that used to pass
		// every guard now halts the build.
		expect(() =>
			assertTableClean(
				"events",
				[{ event_id: "probe", body: REMOVED_COMMENT_BODY }],
				secrets,
			),
		).toThrow(/no-removed-body/);
	});

	it("H · the canary fails if stripRow's masking predicate is DELETED", () => {
		// ⚠ Ruling H's literal requirement: *"the canary must fail if
		// `stripRow`'s predicate is deleted."* Written as code rather than
		// argued, by reproducing the unmasked strip and running the real guard
		// over its output.
		const secrets = harvestSecrets(DIRTY_TABLE_ROWS as never);

		// The defect, constructed: the comments table transformed with an
		// EMPTY removed set — which is exactly what deleting the predicate,
		// or forgetting the argument, produces.
		// ⚠ **BOTH passes.** My first version ran only the strip and got two
		// `no-raw-user-id` violations, which looked like an H defect and was
		// not — `user_id` is rewritten by the PSEUDONYMIZE pass. DATASET.2
		// recorded this exact error one file over: *"running half the pipeline
		// and asserting the whole contract is its own error"*, and I made it
		// again. The honest end-to-end is the one the build runs.
		const map = buildPseudonymMap(DIRTY_TABLE_ROWS.users);
		const unmasked = pseudonymizeTable(
			"comments",
			stripTable("comments", DIRTY_TABLE_ROWS.comments, {
				removedCommentIds: new Set<string>(),
			}),
			map,
		);
		expect(
			JSON.stringify(unmasked),
			"control: the unmasked transform really does carry the body",
		).toContain(REMOVED_COMMENT_BODY);

		expect(() => assertTableClean("comments", unmasked, secrets)).toThrow(
			/no-removed-body/,
		);

		// …and the correctly-masked transform passes, so the guard is not
		// simply throwing on every comments table.
		const removedIds = new Set(
			DIRTY_TABLE_ROWS.mod_actions
				.filter((m) => m.reason === "content_removed")
				.map((m) => String(m.target_comment_id)),
		);
		const masked = pseudonymizeTable(
			"comments",
			stripTable("comments", DIRTY_TABLE_ROWS.comments, {
				removedCommentIds: removedIds,
			}),
			map,
		);
		expect(() => assertTableClean("comments", masked, secrets)).not.toThrow();
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
