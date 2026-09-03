// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";

import { GLOSSARY, HEADER_GLOSSARY } from "@/lib/copy/glossary";

/**
 * INFO-1 — the copy-register guard. Of the five explanatory `title` strings
 * shipped before this task, zero were asserted by any test; any could be
 * deleted outright and CI would stay green. This file is why that gap closes:
 * it pins shape (length, dash character, no terminal period) on every string
 * in the register, so a future edit that widens a gloss past an unstyled
 * render, or reintroduces a plain hyphen where the house style is an em dash,
 * fails here instead of shipping silently.
 */

// glossary.ts's own docblock budgets "≤ ~75 characters so it survives an
// unstyled render" — 80 tracks that with a few characters of "~" slack
// rather than the 90 this guard shipped with, which was loose enough to
// admit a violation of the stated rule (longest current string is 72).
const MAX_LEN = 80;

/** A spaced ASCII hyphen (` - `) is the defect this guards against — the house
 * separator is U+2014 (—), never a hyphen standing in for one. Compound-word
 * hyphens (`auto-assigned`) are unaffected: they never carry surrounding
 * spaces. */
const SPACED_HYPHEN = / - /;

/**
 * AIMODE-1 — the register's one ratified over-length string, exempted BY NAME.
 *
 * `downloadMd` is 89 characters against the 80 below. The floor is deliberately
 * NOT raised to admit it: `MAX_LEN` covers ~25 strings, and loosening it for
 * all of them to fit one would retire glossary.ts's stated "≤ ~75 characters so
 * it survives an unstyled render" rule product-wide as a side effect of a copy
 * change to a single gloss. The reason for the floor still holds everywhere it
 * held yesterday.
 *
 * ⚠ THE EXEMPT BUDGET IS PINNED EXACTLY, NOT LOOSENED, and that is the whole
 * design of it. A `<=` here would let this one string grow without limit the
 * moment it was exempted — which is precisely the failure an exemption invites:
 * the guard stops guarding the key most likely to drift, while still reporting
 * green for the other twenty-five. Editing the copy therefore edits this number
 * in the same commit. The friction is intentional and is the point.
 *
 * Only the LENGTH is exempt. The em dash, terminal-period and spaced-hyphen
 * rules below still apply to it unchanged.
 */
const EXACT_LEN_EXEMPT: Readonly<
	Partial<Record<keyof typeof GLOSSARY | keyof typeof HEADER_GLOSSARY, number>>
> = {
	downloadMd: 89,
};

/**
 * AIMODE-1 — the founder-ratified TEXT, pinned as text.
 *
 * ⚠ The exemption above guards the wrong axis on its own, and that is worth
 * saying plainly rather than leaving implied: it pins a LENGTH, and what was
 * ratified was a STRING. Any 89-character rewrite of this public campaign copy
 * would satisfy it. `glossary.ts` opens with "Do not edit a string here without
 * a founder ruling", so the guard that actually matches the requirement is an
 * equality on the string itself; the length exemption's remaining job is
 * narrower — it is only what lets the shape loop admit a gloss this long.
 */
const RATIFIED_TEXT: Readonly<Partial<Record<keyof typeof GLOSSARY, string>>> =
	{
		downloadMd:
			"AI mode — download this entire market debate as a Markdown file and paste it into any LLM",
	};

const ALL_ENTRIES = [
	...Object.entries(GLOSSARY),
	...Object.entries(HEADER_GLOSSARY),
] as [string, string][];

/**
 * String-keyed VIEWS over the two typed literals above.
 *
 * ⚠ The literals are keyed to `keyof typeof GLOSSARY` on purpose — a typo'd key
 * there is a compile error rather than a silent no-op that quietly exempts
 * nothing (O-1: structural beats procedural). But `assertWellFormed` receives an
 * arbitrary `string`, including the `_fixture_*` keys its own positive control
 * invents, so it cannot index a keyed record. A `Map` gives the loose read
 * without an `as` cast reaching back across that boundary.
 */
const LEN_BUDGET = new Map<string, number | undefined>(
	Object.entries(EXACT_LEN_EXEMPT),
);
const REGISTER = new Map<string, string>(ALL_ENTRIES);

function assertWellFormed(key: string, value: string): void {
	expect(value.length, `${key}: empty`).toBeGreaterThan(0);
	const exactLen = LEN_BUDGET.get(key);
	if (exactLen === undefined) {
		expect(
			value.length,
			`${key}: exceeds ${MAX_LEN} chars`,
		).toBeLessThanOrEqual(MAX_LEN);
	} else {
		expect(
			value.length,
			`${key}: ratified over-length gloss — its budget is pinned exactly, so update EXACT_LEN_EXEMPT in the same commit as the copy`,
		).toBe(exactLen);
	}
	expect(value, `${key}: ends with a terminal period`).not.toMatch(/\.$/);
	expect(
		value,
		`${key}: uses a spaced hyphen instead of an em dash`,
	).not.toMatch(SPACED_HYPHEN);
}

describe("INFO-1 — glossary copy register", () => {
	it("every GLOSSARY and HEADER_GLOSSARY string is well-formed", () => {
		// Guard the guard: a register that shrank to nothing would make every
		// check below vacuously true.
		expect(ALL_ENTRIES.length).toBeGreaterThan(20);
		for (const [key, value] of ALL_ENTRIES) {
			assertWellFormed(key, value);
		}
	});

	it("positive control: the well-formed check actually rejects a malformed string", () => {
		// A search that finds nothing proves nothing on its own (OVN-V1). Prove
		// the assertion machinery can fail before trusting that it passed above.
		expect(() => assertWellFormed("_fixture_empty", "")).toThrow();
		expect(() =>
			assertWellFormed("_fixture_long", "x".repeat(MAX_LEN + 1)),
		).toThrow();
		expect(() =>
			assertWellFormed("_fixture_period", "Term — a gloss with a period."),
		).toThrow();
		expect(() =>
			assertWellFormed("_fixture_hyphen", "Term - a gloss using a hyphen"),
		).toThrow();
	});

	it("the register does use U+2014 em dash — the character the hyphen check assumes exists", () => {
		// Positive control on the character itself: most strings follow the
		// `Term — gloss` house pattern. A handful of action-oriented strings
		// (priceYes/priceNo, HEADER_GLOSSARY.github) deliberately don't — this
		// just proves the em dash appears for real, not that every string uses it.
		const withEmDash = ALL_ENTRIES.filter(([, v]) => v.includes("—"));
		expect(withEmDash.length).toBeGreaterThan(ALL_ENTRIES.length / 2);
	});

	it("the length exemption is narrow, live, and still genuinely needed", () => {
		// An exemption that outlives its reason is worse than no exemption: it
		// reads as coverage while silently excusing a key nothing is checking.
		// These three assertions are what make it expire on its own.
		const keys = Object.keys(EXACT_LEN_EXEMPT);

		// 1 — it stays NARROW. Growing the list is a decision, and it reddens here
		//     rather than passing quietly as one more entry in an object literal.
		expect(keys).toEqual(["downloadMd"]);

		for (const key of keys) {
			const entry = ALL_ENTRIES.find(([k]) => k === key);
			// 2 — it stays LIVE. An exemption for a key deleted from the register
			//     is dead weight pointing at nothing.
			expect(
				entry,
				`${key}: exempted but absent from the register`,
			).toBeDefined();
			// 3 — it stays NEEDED. If the copy is ever shortened back under the
			//     floor, this fails and the exemption gets deleted instead of
			//     quietly licensing a future over-length rewrite of the same key.
			expect(
				entry?.[1].length,
				`${key}: no longer exceeds ${MAX_LEN} — delete its exemption`,
			).toBeGreaterThan(MAX_LEN);
		}
	});

	it("the ratified copy is pinned as TEXT, not merely as a length", () => {
		const pins = Object.entries(RATIFIED_TEXT);
		// Guard the guard — an empty pin set would make the loop vacuous.
		expect(pins.length).toBeGreaterThan(0);

		for (const [key, text] of pins) {
			// The requirement was a string. Assert the string.
			expect(
				REGISTER.get(key),
				`${key}: ratified copy changed — this needs a founder ruling, not an edit`,
			).toBe(text);

			// …and keep the two guards honest about each other. A ratified-text key
			// that is also length-exempt must agree with its own budget, so the
			// string and the number can never drift apart while both look green.
			const budget = LEN_BUDGET.get(key);
			if (budget !== undefined) {
				expect(text?.length, `${key}: text and length budget disagree`).toBe(
					budget,
				);
			}
		}
	});

	it("positive control: the exact-length pin rejects a drifted exempt string", () => {
		// The exempt branch has its own machinery, so it gets its own proof that
		// it can fail — the same rule the malformed-string control above follows.
		expect(() =>
			assertWellFormed("downloadMd", "AI mode — a gloss of the wrong length"),
		).toThrow();
	});

	it("GLOSSARY.sold is the register's one founder-flagged invented string", () => {
		// Not in a `pgEnum`, not in the `Marker` union — typed by hand at four
		// render sites today. Pinned here so its provenance stays visible next to
		// the string itself, not only in a report nobody re-reads.
		expect(GLOSSARY.sold).toContain("Sold");
	});
});
