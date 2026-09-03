import { describe, expect, it } from "vitest";
import { CEILINGS, parseEntries, type Tier } from "./_journey-entries";

/**
 * NO JOURNEY ENTRY EXCEEDS ITS TIER'S WORD CEILING.
 *
 * Landmark 200, Chapter 90, Groundwork 40 — ceilings, no floors (style spec
 * §3). The failure mode this catches is INFLATION, which is the one drift
 * produces first: an entry written at 85 words for a commit that deserved 40
 * reads as though the commit mattered more than it did, and a document written
 * to convey weight will manufacture weight if nothing stops it.
 *
 * ⚠ THE CEILING CANNOT BE CHECKED WITHOUT A TIER, WHICH IS WHY THE MARKER IS
 * ASSERTED FIRST AND SEPARATELY. Before this landed, a Landmark and a
 * Groundwork entry were indistinguishable by reading — no marker, no class, no
 * ordering, no formatting difference. A ceiling guard over unmarked entries has
 * two options and both are wrong: skip them, and it passes over the whole
 * corpus while looking green; guess a tier, and it enforces a ceiling nobody
 * chose. So an entry with no marker is a failure of THIS test, not a skip.
 *
 * ⚠ TABLE ROWS ARE NOT PROSE. The visual is Landmark furniture listed
 * separately from prose in §4, and counting it changes the answer: with table
 * rows included, `Let The Money In` measures 206 against a 200 ceiling. That
 * is the table being counted, not an entry being long.
 *
 * ⚠ ONE PUBLISHED ENTRY ALREADY EXCEEDS ITS CEILING AND IS PINNED, NOT
 * EXEMPTED. `Backwards In Public` is 207 words against 200. It is one of 340
 * published records and rewording it is forbidden, so the overage is recorded
 * at its exact measured value. An exemption would go quiet forever; a pin still
 * has a tripwire on it — if that entry moves in EITHER direction, this reds.
 */

/**
 * Entries known to exceed their ceiling before this guard existed, pinned to
 * the exact word count measured at the commit that added this file.
 *
 * This map may shrink. It must never grow: a new entry over its ceiling is the
 * defect, and adding it here is how the guard gets talked out of firing.
 */
const PINNED_OVERAGES: Record<string, number> = {
	"Backwards In Public": 207,
};

describe("journey entries — word ceilings", () => {
	const entries = parseEntries();

	it("parses a corpus at all (control for every assertion below)", () => {
		expect(entries.length).toBeGreaterThan(300);
		expect(entries.some((e) => e.words > 0)).toBe(true);
	});

	it("every entry carries a tier marker", () => {
		const unmarked = entries
			.filter((e) => e.tier === null)
			.map((e) => `${e.file}:${e.line} ${e.title}`);
		expect(
			unmarked,
			`entries with no <!-- TIER: … --> marker, so no ceiling applies to them:\n${unmarked.join("\n")}`,
		).toEqual([]);
	});

	it("every marked entry is within its tier's ceiling", () => {
		const over: string[] = [];
		for (const e of entries) {
			if (e.tier === null || e.tier === "UNKNOWN") continue;
			const ceiling = CEILINGS[e.tier as Exclude<Tier, "UNKNOWN">];
			const pinned = PINNED_OVERAGES[e.title];
			if (pinned !== undefined) continue;
			if (e.words > ceiling) {
				over.push(
					`${e.file}:${e.line} ${e.title} — ${e.tier} is ${e.words} words, ceiling ${ceiling}`,
				);
			}
		}
		expect(
			over,
			`entries over their tier ceiling:\n${over.join("\n")}`,
		).toEqual([]);
	});

	it("every pinned overage still measures exactly what it was pinned at", () => {
		for (const [title, expected] of Object.entries(PINNED_OVERAGES)) {
			const found = entries.filter((e) => e.title === title);
			expect(found.length, `pinned entry ${title} not found`).toBe(1);
			expect(
				found[0].words,
				`${title} was pinned at ${expected} words because it is a published record that cannot be reworded; it now measures ${found[0].words}`,
			).toBe(expected);
		}
	});
});
