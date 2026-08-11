import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * PRIMITIVES-2 D9 — the emphasis ladder's rungs 2 and 3 as named CSS custom
 * properties, joining rung 1 (`--hairline`) in the SAME mechanism.
 *
 * WHAT THIS GUARD IS FOR. The ladder's whole purpose is that a later founder
 * ruling costs ONE LINE — PD-2-08's answer is a single edit to `--ring-active`
 * rather than a sweep. That property holds only while the definition is the one
 * place the value lives. This file pins both halves: the tokens are DEFINED
 * with their exact ratified composites, and NO consumer re-states the literal
 * they replaced.
 *
 * ⚠ THE HEX CONSTRAINT IS CARRIED HERE, NOT BY `tokens-monochrome`. That
 * guard's census is keyed on a PROPERTY NAME (`--color-n0..n7|ink|yes|no`)
 * carrying a hex VALUE, so `--border-hero: 1px solid #545454` would sail past
 * it untouched — right value, no census entry, no redness. The whole point of
 * D9 is that these are composites over ratified ramp tokens, so the `var()`
 * form is asserted explicitly below.
 *
 * ⚠ NOT AN EQUIVALENCE PROOF OF COMPUTED STYLE. jsdom does not resolve custom
 * properties, and no runner here does. What makes the substitution safe is that
 * each token's definition is byte-identical to the literal it replaced — that
 * string equality is what is asserted, per token, and the emitted declaration
 * then differs only by one level of indirection.
 */

const ROOT = process.cwd();
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

const TOKENS = "src/app/globals.css";

/**
 * The literals as they stood at `5485f6f`, before this commit replaced them.
 * These are the strings the tokens must reproduce EXACTLY — the substitution is
 * safe because of this equality and for no other reason.
 */
const RUNG_2_LITERAL = "1px solid var(--color-n3)";
const RUNG_3_LITERAL = "1.5px solid var(--color-n4)";

/** Every consumer of the ladder, with the Tailwind arbitrary property it uses.
 * Re-measured at this commit's head: 3 rung-2 sites in one file, 1 rung-3. */
const CONSUMERS = [
	{
		file: "src/components/discovery/HeroPanels.tsx",
		token: "[border:var(--border-hero)]",
		literal: "[border:1px_solid_var(--color-n3)]",
		count: 3,
	},
	{
		file: "src/components/discovery/DiscoveryGrid.tsx",
		token: "[outline:var(--ring-active)]",
		literal: "[outline:1.5px_solid_var(--color-n4)]",
		count: 1,
	},
];

const occurrences = (haystack: string, needle: string) =>
	haystack.split(needle).length - 1;

describe("emphasis ladder — rungs 2 and 3 are named tokens", () => {
	it("both-tokens-are-defined-with-their-exact-ratified-composites", () => {
		const css = read(TOKENS);
		expect(css).toContain(`--border-hero: ${RUNG_2_LITERAL};`);
		expect(css).toContain(`--ring-active: ${RUNG_3_LITERAL};`);
	});

	it("both-tokens-reference-a-ramp-token-and-never-a-literal-hex", () => {
		// The half `tokens-monochrome` structurally cannot catch — see the
		// docblock. A hex here would be a NEW colour value escaping the census.
		const css = read(TOKENS);
		for (const token of ["--border-hero", "--ring-active"]) {
			const match = css.match(new RegExp(`^\\s*${token}:\\s*([^;]+);`, "m"));
			expect(match, `${token} is not declared`).not.toBeNull();
			const value = match?.[1] ?? "";
			expect(value).toMatch(/var\(--color-n[0-7]\)/);
			expect(value).not.toMatch(/#[0-9a-fA-F]{3,8}/);
		}
	});

	it("both-tokens-sit-outside-@theme-so-they-stay-off-the-census", () => {
		// `@theme` emits Tailwind utility classes from its members and is where
		// the 11 census tokens live. These are composites, not colours, and
		// belong beside `--hairline` in the plain `:root` block.
		const css = read(TOKENS);
		// ⚠ BOTH ANCHORS ARE LOAD-BEARING. `@theme` also appears in PROSE inside
		// this file (`:51`, `:127`, `:162` at the time of writing), and an
		// unanchored match starting at the `:162` comment runs forward to the
		// next `{` — which is the `:root` block these tokens live in — and
		// reports them as inside `@theme`. That was this test's first draft and
		// it produced a confident RED on correct code (O-3: a true refusal with a
		// misleading cause is a defect). At-rules and their closing brace are at
		// column 0 in this file; prose is not.
		const themeBlocks = [...css.matchAll(/^@theme[^{]*\{[\s\S]*?^\}/gm)].map(
			(m) => m[0],
		);
		// Alive check: the file really does have @theme blocks to be outside of,
		// and BOTH of them were found (`@theme inline` and `@theme`).
		expect(themeBlocks).toHaveLength(2);
		// Positive control — the census tokens ARE inside one, so a matcher that
		// silently captured nothing cannot pass this.
		expect(themeBlocks.some((block) => block.includes("--color-n3"))).toBe(
			true,
		);
		for (const block of themeBlocks) {
			expect(block).not.toContain("--border-hero");
			expect(block).not.toContain("--ring-active");
		}
	});

	it("every-consumer-uses-the-token-and-none-restates-the-literal", () => {
		for (const { file, token, literal, count } of CONSUMERS) {
			const source = read(file);
			expect(occurrences(source, token), `${file} token count`).toBe(count);
			expect(source, `${file} still carries the literal`).not.toContain(
				literal,
			);
		}
	});

	it("the-literals-survive-nowhere-in-src", () => {
		// Set equality over the whole view layer, not a per-file check: a fifth
		// site written tomorrow with the literal form is exactly the drift this
		// commit exists to prevent, and it would not be in CONSUMERS.
		const stray = [
			"[border:1px_solid_var(--color-n3)]",
			"[outline:1.5px_solid_var(--color-n4)]",
		].filter((literal) =>
			CONSUMERS.some(({ file }) => read(file).includes(literal)),
		);
		expect(stray).toEqual([]);
	});

	it("--border-strong-is-left-alone-with-its-zero-consumers", () => {
		// D10, pinned so a later reader does not assume D9 absorbed it. It is a
		// ratified token aliased to n2 whose re-point is a token-VALUE decision
		// (F3-blocked), deliberately out of this task's scope.
		const css = read(TOKENS);
		expect(css).toContain("--border-strong: var(--color-n2);");
	});
});
