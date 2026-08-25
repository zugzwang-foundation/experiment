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

const MAX_LEN = 90;

/** A spaced ASCII hyphen (` - `) is the defect this guards against — the house
 * separator is U+2014 (—), never a hyphen standing in for one. Compound-word
 * hyphens (`auto-assigned`) are unaffected: they never carry surrounding
 * spaces. */
const SPACED_HYPHEN = / - /;

function assertWellFormed(key: string, value: string): void {
	expect(value.length, `${key}: empty`).toBeGreaterThan(0);
	expect(value.length, `${key}: exceeds ${MAX_LEN} chars`).toBeLessThanOrEqual(
		MAX_LEN,
	);
	expect(value, `${key}: ends with a terminal period`).not.toMatch(/\.$/);
	expect(
		value,
		`${key}: uses a spaced hyphen instead of an em dash`,
	).not.toMatch(SPACED_HYPHEN);
}

const ALL_ENTRIES = [
	...Object.entries(GLOSSARY),
	...Object.entries(HEADER_GLOSSARY),
] as [string, string][];

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

	it("GLOSSARY.sold is the register's one founder-flagged invented string", () => {
		// Not in a `pgEnum`, not in the `Marker` union — typed by hand at four
		// render sites today. Pinned here so its provenance stays visible next to
		// the string itself, not only in a report nobody re-reads.
		expect(GLOSSARY.sold).toContain("Sold");
	});
});
