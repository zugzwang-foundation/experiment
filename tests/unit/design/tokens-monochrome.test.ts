import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Static regression guard for the SHELL/UI.0 monochrome token mint (plan §9.1).
// Reads globals.css as text — no IO/DB — and asserts the locked v1.0 system is
// present and achromatic. The thesis-load-bearing facts: the side poles are
// bound to the SIDE (YES = ink/black, NO = n0/white), the neutral ramp is pure
// grey (chroma 0 — design-language §1.9 "true-neutral greys, zero warm cast"),
// the deferred `--color-brand` placeholder is gone, and the "do not consume"
// header that forbade consumption pre-DESIGN.7 is removed. If a later edit
// reintroduces chroma (a warm-tinted grey, a colour pole) or the placeholder,
// this fails.

const GLOBALS_CSS = readFileSync(
	join(process.cwd(), "src/app/globals.css"),
	"utf8",
);

// The full design-token set the mint must declare, with exact OKLCH values
// (plan §4 mapping; n4 = 0.708 per the plan's OKLCH column / Tailwind neutral-400
// / the existing shadcn --ring). Black pole (yes) == ink; white pole (no) == n0.
const EXPECTED_TOKENS: ReadonlyArray<readonly [string, string]> = [
	["--color-n0", "oklch(1 0 0)"],
	["--color-n1", "oklch(0.971 0 0)"],
	["--color-n2", "oklch(0.922 0 0)"],
	["--color-n3", "oklch(0.871 0 0)"],
	["--color-n4", "oklch(0.708 0 0)"],
	["--color-n5", "oklch(0.556 0 0)"],
	["--color-n6", "oklch(0.371 0 0)"],
	["--color-n7", "oklch(0.205 0 0)"],
	["--color-ink", "oklch(0.145 0 0)"],
	["--color-yes", "oklch(0.145 0 0)"],
	["--color-no", "oklch(1 0 0)"],
];

describe("globals.css — SHELL/UI.0 monochrome token mint", () => {
	it("declares every neutral-ramp + side-pole token with its exact OKLCH value", () => {
		for (const [token, value] of EXPECTED_TOKENS) {
			expect(GLOBALS_CSS).toContain(`${token}: ${value};`);
		}
	});

	it("binds the side poles to the SIDE: YES = ink (black), NO = n0 (white)", () => {
		// The inversion-correction (REQUIRED FIX 1): poles name the side, not the
		// Support/Counter relation. YES === ink value; NO === n0 value.
		expect(GLOBALS_CSS).toContain("--color-yes: oklch(0.145 0 0);");
		expect(GLOBALS_CSS).toContain("--color-no: oklch(1 0 0);");
		// The REQUIRED FIX 1 disambiguation comment is present verbatim: the pole
		// names the SIDE, and explicitly is NOT the Support/Counter relation.
		expect(GLOBALS_CSS).toContain("NOT Support (design-language §1.3/§2.1)");
	});

	it("keeps every design-token grey + pole achromatic (chroma 0)", () => {
		const re =
			/--color-(?:n[0-7]|ink|yes|no):\s*oklch\(\s*[\d.]+\s+([\d.]+)\s+[\d.]+\s*\)/g;
		const chromas = [...GLOBALS_CSS.matchAll(re)].map((m) => m[1]);
		// All 11 design tokens matched, and every chroma is exactly 0.
		expect(chromas).toHaveLength(EXPECTED_TOKENS.length);
		for (const c of chromas) {
			expect(c).toBe("0");
		}
	});

	it("drops the deferred --color-brand placeholder", () => {
		expect(GLOBALS_CSS).not.toContain("--color-brand");
	});

	it("removes the pre-DESIGN.7 'do not consume' placeholder header", () => {
		expect(GLOBALS_CSS).not.toMatch(/do not consume/i);
		expect(GLOBALS_CSS).not.toMatch(/DESIGN\.7 back-applies/i);
	});
});
