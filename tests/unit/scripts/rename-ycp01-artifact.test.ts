import { describe, expect, it } from "vitest";

import {
	countPaperClub,
	renameArtifactNoun,
} from "../../../scripts/rename-ycp01-artifact";

/**
 * G6 — the artifact-noun transform never corrupts "Paper Club" (or
 * "ycpaperclub", or the slug — neither of which this pure function ever
 * sees, since it operates on title/description text only). Pure-function
 * tests, zero DB/IO — `scripts/rename-ycp01-artifact.ts` guards its own
 * `main()` behind an entrypoint check so importing these two exports here
 * never opens a connection.
 */
describe("rename-ycp01-artifact — G6, Paper Club is never touched", () => {
	it("rename::the-real-YCP-01-title-renames-cleanly", () => {
		const title =
			"YCombinator · Will YC reply to Zugzwang's paper by 5 Nov 2026?";
		const expected =
			"YCombinator · Will YC reply to Zugzwang's pitch by 5 Nov 2026?";
		expect(renameArtifactNoun(title)).toBe(expected);
	});

	it("rename::the-real-YCP-01-description-renames-the-three-artifact-occurrences-only", () => {
		const description =
			"Will @ycombinator reply to or quote-post any post in the Zugzwang thread submitting its research paper to YC Paper Club, on X, between 15 September and 5 November 2026?\n\nResolves YES if a post by @ycombinator is a reply to any post in the Zugzwang Paper Club thread, or a quote-post of one. What the post says is never read: approval, rejection and dismissal all resolve YES identically.\n\nResolves NO in every other case, and this market is deliberately narrow. A standalone post naming Zugzwang resolves NO. A Paper Club recap or announcement naming Zugzwang resolves NO. The paper being selected, scheduled or presented resolves NO absent a qualifying post — the outcome the submission wants is not the criterion. So do likes, any other account, and silence.\n\nDeadline 5 November 2026, 23:45 UTC.";
		const result = renameArtifactNoun(description);

		// ⛔ POSITIVE CONTROL FIRST — prove the pattern finds real matches before
		// trusting the "unchanged" assertions below (OVN-V1).
		expect(result).not.toBe(description);

		expect(result).toContain("submitting its research pitch to YC Paper Club");
		expect(result).toContain("The pitch being selected");
		// All three "Paper Club" occurrences survive byte-for-byte.
		expect(result).toContain("YC Paper Club,");
		expect(result).toContain("Zugzwang Paper Club thread");
		expect(result).toContain("A Paper Club recap");
		// No bare "paper" survives outside of "Paper Club".
		expect(result).not.toMatch(/\bpaper\b(?!\s+club)/i);
		expect(countPaperClub(result)).toBe(countPaperClub(description));
		expect(countPaperClub(description)).toBe(3);
	});

	it("rename::synthetic-Paper-Club-in-every-case-combination-is-preserved", () => {
		for (const variant of [
			"paper club",
			"Paper club",
			"paper Club",
			"PAPER CLUB",
			"Paper Club",
		]) {
			expect(renameArtifactNoun(`a ${variant} meets here`)).toBe(
				`a ${variant} meets here`,
			);
		}
	});

	it("rename::bare-paper-at-the-very-start-or-end-of-a-string-still-renames", () => {
		expect(renameArtifactNoun("paper at the start")).toBe("pitch at the start");
		expect(renameArtifactNoun("ends with a paper")).toBe("ends with a pitch");
		expect(renameArtifactNoun("paper")).toBe("pitch");
	});

	it("rename::ycpaperclub-has-no-word-boundary-so-the-regex-itself-skips-it", () => {
		// "paper" inside the concatenated token "ycpaperclub" has no \b on
		// either side (both neighbours are \w characters) — the regex is immune
		// here by construction, independent of how the function is called.
		expect(renameArtifactNoun("see ycpaperclub for details")).toBe(
			"see ycpaperclub for details",
		);
	});

	it("rename::the-slug-is-NOT-regex-immune-hyphens-are-word-boundaries — safety is SCOPE, not the pattern", () => {
		// ⛔⛔ CAUGHT BY THIS TEST, NOT ASSUMED: a hyphen is not a `\w` character,
		// so `\bpaper\b` DOES match inside "yc-paper-club-response" (there's a
		// boundary at both "-p" and "r-"). An earlier version of this test and
		// the script's own docblock both claimed the slug was "immune by
		// construction" the same way "ycpaperclub" is — that claim is false for
		// hyphen-joined text. What actually keeps the slug safe is SCOPE: this
		// function is only ever called on `title` and `description`
		// (`scripts/rename-ycp01-artifact.ts`'s `main()`), never on `slug` — the
		// UPDATE statement's WHERE clause reads the slug, its SET clause never
		// writes it.
		expect(renameArtifactNoun("slug: yc-paper-club-response")).toBe(
			"slug: yc-pitch-club-response",
		);
	});

	it("rename::case-is-preserved-on-the-renamed-word", () => {
		expect(renameArtifactNoun("Paper was submitted")).toBe(
			"Pitch was submitted",
		);
		expect(renameArtifactNoun("the paper was submitted")).toBe(
			"the pitch was submitted",
		);
	});

	it("countPaperClub::counts-case-insensitively-and-exactly", () => {
		expect(countPaperClub("Paper Club paper club PAPER CLUB")).toBe(3);
		expect(countPaperClub("no match here")).toBe(0);
		expect(countPaperClub("")).toBe(0);
	});
});
