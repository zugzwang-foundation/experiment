import { describe, expect, it } from "vitest";
import { parseEntries } from "./_journey-entries";

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
 * ⚠ ONE DUPLICATE IS DELIBERATE AND IS PINNED AT ITS EXACT COUNT.
 * `Voice, Not Balance` is printed twice, byte-identical, because it is ONE
 * entry covering TWO commits and the document keeps one heading per commit so
 * the positional count stays honest. Pinning it at exactly two is what makes
 * this guard survive that fact without being blinded by it: a third copy, or a
 * second title going double, still reds.
 */

/** Titles known to repeat on purpose, pinned to how many times. */
const PINNED_DUPLICATES: Record<string, number> = {
	"Voice, Not Balance": 2,
};

describe("journey entries — title collision", () => {
	const entries = parseEntries();

	it("reads titles at all, and the duplicate detector can fire (control)", () => {
		expect(entries.length).toBeGreaterThan(300);
		const doubled = [...entries, entries[0]];
		const counts = new Map<string, number>();
		for (const e of doubled)
			counts.set(e.title, (counts.get(e.title) ?? 0) + 1);
		expect(counts.get(entries[0].title)).toBeGreaterThan(1);
	});

	it("no title appears more than once, except where pinned", () => {
		const counts = new Map<string, number>();
		for (const e of entries)
			counts.set(e.title, (counts.get(e.title) ?? 0) + 1);

		const collisions: string[] = [];
		for (const [title, count] of counts) {
			const allowed = PINNED_DUPLICATES[title] ?? 1;
			if (count !== allowed) {
				const where = entries
					.filter((e) => e.title === title)
					.map((e) => `${e.file}:${e.line}`)
					.join(", ");
				collisions.push(
					`"${title}" appears ${count}× (allowed ${allowed}) at ${where}`,
				);
			}
		}
		expect(
			collisions,
			`duplicate entry titles:\n${collisions.join("\n")}`,
		).toEqual([]);
	});

	it("every pinned duplicate is still exactly as pinned", () => {
		for (const [title, expected] of Object.entries(PINNED_DUPLICATES)) {
			const found = entries.filter((e) => e.title === title);
			expect(
				found.length,
				`"${title}" is pinned as a deliberate ${expected}× duplicate and now appears ${found.length}×`,
			).toBe(expected);
			const bodies = new Set(found.map((e) => e.visible.join("\n")));
			expect(
				bodies.size,
				`"${title}" repeats because it is ONE entry covering two commits; the copies have diverged`,
			).toBe(1);
		}
	});
});
