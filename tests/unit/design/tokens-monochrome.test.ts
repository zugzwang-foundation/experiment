import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Static regression guard for the branded dark token layer — the BRIDGE swap
// (values-log v0_3 §3 mirrored into the frozen contract slots; ratified
// 2026-07-14). Reads globals.css as text — no IO/DB — and asserts the landed
// system is present, hex-authoritative, and achromatic. The thesis-load-bearing
// facts: the side poles are bound to the SIDE (YES = black #181818, NO =
// near-white #fafafa), never the Support/Counter relation; the neutral ramp is
// pure grey (R == G == B — zero cast); --color-ground is the page ground,
// outside the census; the two graph series lines are unmistakably different
// (the B1 exit criterion); --destructive stays neutralized to the ramp; and
// the retired placeholder strings never return. If a later edit reintroduces
// chroma (a tinted grey, a colour pole) or a placeholder, this fails.

const GLOBALS_CSS = readFileSync(
	join(process.cwd(), "src/app/globals.css"),
	"utf8",
);

// The full census the swap must declare, with exact hex values (BRIDGE plan
// old→new table — transcribed from values-log v0_3 §3, "Hex is authoritative";
// never derived from the retired light ramp, which ran the other way). Case
// note: the dump writes hex uppercase; Biome's CSS formatter normalizes hex to
// lowercase repo-wide (format error otherwise), so the landed — and pinned —
// form is lowercase. Same colors: CSS hex is case-insensitive. Black pole
// (yes) == the ground value; white pole (no) == ink.
const EXPECTED_TOKENS: ReadonlyArray<readonly [string, string]> = [
	["--color-n0", "#212121"],
	["--color-n1", "#2a2a2a"],
	["--color-n2", "#404040"],
	["--color-n3", "#545454"],
	["--color-n4", "#747474"],
	["--color-n5", "#989898"],
	["--color-n6", "#bdbdbd"],
	["--color-n7", "#e4e4e4"],
	["--color-ink", "#fafafa"],
	["--color-yes", "#181818"],
	["--color-no", "#fafafa"],
];

describe("globals.css — BRIDGE branded dark token layer", () => {
	it("declares every neutral-ramp + side-pole token with its exact hex value", () => {
		for (const [token, value] of EXPECTED_TOKENS) {
			expect(GLOBALS_CSS).toContain(`${token}: ${value};`);
		}
	});

	it("binds the side poles to the SIDE: YES = black (#181818), NO = white (#fafafa)", () => {
		// The binding is untouched by the BRIDGE re-value (R-1): poles name the
		// side, not the Support/Counter relation.
		expect(GLOBALS_CSS).toContain("--color-yes: #181818;");
		expect(GLOBALS_CSS).toContain("--color-no: #fafafa;");
		// The disambiguation comment is present verbatim: the pole names the
		// SIDE, and explicitly is NOT the Support/Counter relation.
		expect(GLOBALS_CSS).toContain("NOT Support (design-language §1.3/§2.1)");
	});

	it("keeps every census grey + pole achromatic (R == G == B)", () => {
		const re = /^\s*--color-(?:n[0-7]|ink|yes|no):\s*#([0-9A-Fa-f]{6});/gm;
		const hexes = [...GLOBALS_CSS.matchAll(re)].map((m) => m[1]);
		// All 11 census tokens matched as top-level hex declarations (the closed
		// alternation keeps --color-ground outside the count — WI-2), and every
		// captured value is a pure grey.
		expect(hexes).toHaveLength(EXPECTED_TOKENS.length);
		for (const hex of hexes) {
			const norm = hex.toUpperCase();
			expect(norm.slice(0, 2)).toBe(norm.slice(2, 4));
			expect(norm.slice(2, 4)).toBe(norm.slice(4, 6));
		}
	});

	it("pins the page-ground primitive, outside the census (WI-2)", () => {
		expect(GLOBALS_CSS).toContain("--color-ground: #181818;");
	});

	it("pins the two graph series lines as unmistakably different (B1 exit)", () => {
		expect(GLOBALS_CSS).toContain("--graph-yes: #737373;");
		expect(GLOBALS_CSS).toContain("--graph-no: #fafafa;");
	});

	it("keeps --destructive neutralized to the ramp (WI-11)", () => {
		expect(GLOBALS_CSS).toContain("--destructive: var(--color-n6);");
	});

	it("drops the deferred --color-brand placeholder", () => {
		expect(GLOBALS_CSS).not.toContain("--color-brand");
	});

	it("removes the pre-DESIGN.7 'do not consume' placeholder header", () => {
		expect(GLOBALS_CSS).not.toMatch(/do not consume/i);
		expect(GLOBALS_CSS).not.toMatch(/DESIGN\.7 back-applies/i);
	});
});
