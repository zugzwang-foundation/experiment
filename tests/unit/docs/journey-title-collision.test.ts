import { describe, expect, it } from "vitest";
import {
	actFiles,
	EXPECTED_ACT_FILES,
	headingCountAcrossDir,
	normaliseTitle,
	parseEntries,
} from "./_journey-entries";

/**
 * EVERY JOURNEY ENTRY TITLE IS UNIQUE.
 *
 * The document lands in two places from one text: read front to back in
 * `docs/journey/`, and read alone — cold, no neighbours — as a git note on the
 * commit it describes. The second surface is what makes a duplicate title
 * unrecoverable rather than merely untidy. In sequence you can tell two
 * identically-named entries apart by what is around them; in a note there is
 * nothing around them, and a reader who lands on the second one has no way to
 * know it is not the first.
 *
 * ⚠ THE COLLISION SURFACE IS EVERY TITLE, NOT EVERY LANDMARK. It is tempting
 * to check only the entries that carry weight. A Groundwork title collides just
 * as hard, and there are far more of them.
 *
 * ⚠ TITLES ARE COMPARED NORMALISED — case-folded, punctuation stripped. On the
 * surface that makes a collision unrecoverable, `Green And Gone` and
 * `green and gone` are the same title, and a byte comparison lets the second
 * one through. Verified against the corpus: normalising introduces no new
 * collision beyond the one deliberate duplicate below.
 *
 * ⚠ ONE DUPLICATE IS DELIBERATE AND IS PINNED AT ITS EXACT COUNT.
 * `Voice, Not Balance` is printed twice, byte-identical, because it is ONE
 * entry covering TWO commits and the document keeps one heading per commit so
 * the positional count stays honest. Pinning it at exactly two is what makes
 * this guard survive that fact without being blinded by it: a third copy, or a
 * second title going double, still reds. **The identity check includes the mono
 * line**, because that is the line somebody would edit first if they ever gave
 * the second copy its own commit subject — and a divergence check that skipped
 * it would call two different entries identical.
 */

/** Titles known to repeat on purpose, pinned to how many times. */
const PINNED_DUPLICATES: Record<string, number> = {
	"Voice, Not Balance": 2,
};

describe("journey entries — title collision", () => {
	const entries = parseEntries();

	it("every act file is parsed, and the duplicate detector can fire (control)", () => {
		// ⚠ THIS CONTROL CANNOT SEE TITLES DISAPPEAR, AND ITS NAME USED TO SAY IT
		// COULD — it read "every title is reachable". The two sides of the
		// comparison below are counted from THE SAME FILES, so deleting entries
		// moves both together: fifteen were cut from one act and this test stayed
		// green. What it does prove is FILE SELECTION — a file that stops matching
		// `NN-*.md` leaves `parseEntries()` but not the directory walk, and the two
		// numbers separate. Titles disappearing is proved by the per-act pins in
		// `journey-word-ceilings.test.ts`, which is where that assertion belongs;
		// this name now claims only what this test measures.
		expect(actFiles()).toEqual([...EXPECTED_ACT_FILES]);
		expect(
			entries.length,
			`the parser sees ${entries.length} entries but ${headingCountAcrossDir()} '### ' headings exist in docs/journey/ — a file has stopped matching the act-file pattern, or a non-act .md has appeared`,
		).toBe(headingCountAcrossDir());
		const counts = new Map<string, number>();
		for (const e of [...entries, entries[0]]) {
			const k = normaliseTitle(e.title);
			counts.set(k, (counts.get(k) ?? 0) + 1);
		}
		expect(
			counts.get(normaliseTitle(entries[0].title)),
			"the duplicate detector cannot fire",
		).toBeGreaterThan(1);
	});

	it("no title appears more than once, except where pinned", () => {
		const counts = new Map<string, number>();
		for (const e of entries) {
			const k = normaliseTitle(e.title);
			counts.set(k, (counts.get(k) ?? 0) + 1);
		}

		const allowed = new Map(
			Object.entries(PINNED_DUPLICATES).map(([t, n]) => [normaliseTitle(t), n]),
		);
		const collisions: string[] = [];
		for (const [key, count] of counts) {
			if (count !== (allowed.get(key) ?? 1)) {
				const where = entries
					.filter((e) => normaliseTitle(e.title) === key)
					.map((e) => `${e.file}:${e.line} "${e.title}"`)
					.join(", ");
				collisions.push(
					`"${key}" appears ${count}× (allowed ${allowed.get(key) ?? 1}) at ${where}`,
				);
			}
		}
		expect(
			collisions,
			`duplicate entry titles:\n${collisions.join("\n")}`,
		).toEqual([]);
	});

	it("the pin map has not grown, and every pinned duplicate is still exactly as pinned", () => {
		expect(
			Object.keys(PINNED_DUPLICATES).sort(),
			"a new row here forgives a collision nobody argued for",
		).toEqual(["Voice, Not Balance"]);

		for (const [title, expected] of Object.entries(PINNED_DUPLICATES)) {
			const found = entries.filter(
				(e) => normaliseTitle(e.title) === normaliseTitle(title),
			);
			expect(
				found.length,
				`"${title}" is pinned as a deliberate ${expected}× duplicate and now appears ${found.length}×`,
			).toBe(expected);
			// mono line included: it is the line most likely to be given its own
			// commit subject later, and skipping it would call two different
			// entries identical.
			const bodies = new Set(
				found.map((e) => [e.title, e.mono, ...e.visible].join("\n")),
			);
			expect(
				bodies.size,
				`"${title}" repeats because it is ONE entry covering two commits; the copies have diverged`,
			).toBe(1);
		}
	});
});
