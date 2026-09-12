import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
	ACCENT,
	PALETTE,
	PALETTE_TOKENS,
} from "@/server/debate-export/image/palette";

/**
 * POST-IMAGE-EXPORT — the JPEG export paints from literal hex because Satori
 * cannot resolve `var()`. This guard is what makes that restatement safe: it
 * reads every token the palette names out of `globals.css` and asserts the
 * literal equals it, so a token change on the page reddens the export's
 * palette instead of leaving two colours where there should be one.
 *
 * Looked up by NAME, not by position, so the census rules on `globals.css`
 * keep governing what a token IS; this file only asserts the copy is exact.
 */
const GLOBALS_CSS = readFileSync(
	join(process.cwd(), "src", "app", "globals.css"),
	"utf8",
);

function tokenValue(name: string): string {
	const re = new RegExp(`^\\s*${name}:\\s*(#[0-9a-fA-F]{6})\\s*;`, "m");
	const m = GLOBALS_CSS.match(re);
	if (m === null) {
		throw new Error(`globals.css carries no hex definition for ${name}`);
	}
	return m[1].toLowerCase();
}

describe("image export palette ↔ globals.css parity", () => {
	it("names a token for every palette entry", () => {
		expect(Object.keys(PALETTE_TOKENS).sort()).toEqual(
			Object.keys(PALETTE).sort(),
		);
	});

	for (const [key, token] of Object.entries(PALETTE_TOKENS)) {
		it(`PALETTE.${key} equals ${token}`, () => {
			expect(PALETTE[key as keyof typeof PALETTE]).toBe(tokenValue(token));
		});
	}
});

/**
 * `ACCENT` is the one set of colours in this repository that is DELIBERATELY
 * not a token — see `palette.ts`. It therefore cannot be checked for parity
 * with anything, which is exactly why it needs a guard of its own: an
 * unpinned off-system palette is how a three-colour exception becomes a
 * second, undocumented design system.
 *
 * Two things are asserted, and neither is about what the values SHOULD be.
 * First, the set is exactly these three keys — a fourth accent is a decision
 * somebody has to make on purpose, and this is what makes them make it here.
 * Second, none of the three appears in `globals.css`, which is the property
 * that keeps the exception one-directional: the export may reach for a colour
 * the page does not have, and a colour reaching the page from this file is a
 * different and much larger change than the one this module was allowed.
 */
describe("image export accent — off-system, and pinned because it is", () => {
	it("carries exactly the ratified accent keys", () => {
		// ⚠ `category` JOINED AT REVISION 7 (the topic chip, slate blue). This
		// list is a LEDGER, not a formality: every addition to it is a colour that
		// exists outside the token census, so it should cost somebody a deliberate
		// edit here and a sentence in `palette.ts` saying why.
		expect(Object.keys(ACCENT).sort()).toEqual([
			"category",
			"categoryInk",
			"chipAge",
			"chipNo",
			"chipStake",
			"chipYes",
			"flavour",
			"green",
			"red",
		]);
	});

	for (const [key, hex] of Object.entries(ACCENT)) {
		it(`ACCENT.${key} is chromatic and absent from globals.css`, () => {
			// Chromatic by the census's own rule, inverted: the monochrome census
			// is R == G == B, so an accent that satisfied it would be a neutral
			// wearing an accent's name.
			const [r, g, b] = [1, 3, 5].map((i) => hex.slice(i, i + 2));
			expect(r === g && g === b).toBe(false);
			expect(GLOBALS_CSS.toLowerCase()).not.toContain(hex.toLowerCase());
		});
	}
});
