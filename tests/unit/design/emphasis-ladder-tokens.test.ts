import { readdirSync, readFileSync } from "node:fs";
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
		// ⚠ RE-POINTED AT HTML-FINISH row 4, and it is a CENSUS UPDATE, NOT A
		// WEAKENING. Row 4 removed the `grid-ring` wrapper `<div>` that used to
		// carry the active outline and moved the ring onto the tile's own root,
		// so the token string left `DiscoveryGrid.tsx` and arrived in
		// `MarketCard.tsx`. This block is built to be re-measured — see the
		// "Re-measured at this commit's head" note above it — and every
		// assertion over it is untouched: still an EXACT count of 1, still
		// `not.toContain` the literal, and the whole-tree
		// `the-literals-survive-nowhere-in-src` scan below is unchanged and
		// still reaches the new file. Leaving the old name here would have
		// reddened the guard for a bookkeeping reason while the invariant it
		// exists for held perfectly.
		file: "src/components/discovery/MarketCard.tsx",
		token: "[outline:var(--ring-active)]",
		literal: "[outline:1.5px_solid_var(--color-n4)]",
		count: 1,
	},
];

const occurrences = (haystack: string, needle: string) =>
	haystack.split(needle).length - 1;

/** The two literal forms the tokens replaced, as they appear in a className. */
const LADDER_LITERALS = CONSUMERS.map(({ literal }) => literal);

/**
 * Every `.ts`/`.tsx` under `src/` — the shape already used by
 * `side-pole-binding.test.ts:219` and `side-badge.test.tsx`. The whole-tree
 * scan is what makes the two assertions below catch a literal written into a
 * file that is NOT in `CONSUMERS`, which is the drift these guards exist for.
 */
const viewLayerFiles = readdirSync(join(ROOT, "src"), {
	recursive: true,
	withFileTypes: true,
})
	.filter(
		(entry) =>
			entry.isFile() &&
			(entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")),
	)
	.map((entry) => join(entry.parentPath, entry.name).replace(`${ROOT}/`, ""));

describe("emphasis ladder — rungs 2 and 3 are named tokens", () => {
	it("tree-scan-is-alive", () => {
		// N1 — a glob that silently matched nothing passes both whole-tree
		// assertions vacuously, which is the exact failure H-1 was. 262 files
		// under `src/` at C0 with `(admin)` EXCLUDED; this scan includes admin,
		// so the floor is conservative and cannot trip on its own diff.
		expect(viewLayerFiles.length).toBeGreaterThanOrEqual(262);
		// Positive control: the scan really can see a ladder consumer.
		expect(viewLayerFiles).toContain(
			"src/components/discovery/DiscoveryGrid.tsx",
		);
	});

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
		// ⚠ THIS SCANS THE TREE, AND THE FIRST VERSION DID NOT. It filtered the
		// two literals against CONSUMERS' own two files — so the one scenario its
		// comment named, "a fifth site written tomorrow with the literal form",
		// was structurally invisible to it, and it could only fail where the test
		// directly above already fails. A duplicate wearing the label of the
		// guard that was not there: §8.3 N8, a promised assertion delivered
		// vacuously, which reads as discharged and is worse than an absent one.
		// Caught by @code-reviewer (H-1) on this branch, not by its own mutations
		// — J and K each wrote into a file already in CONSUMERS, so neither
		// exercised the direction that was missing.
		const stray = viewLayerFiles.flatMap((file) => {
			const source = read(file);
			return LADDER_LITERALS.filter((literal) => source.includes(literal)).map(
				(literal) => `${file} :: ${literal}`,
			);
		});
		expect(stray).toEqual([]);
	});

	it("--border-strong-has-no-consumer-and-keeps-its-alias", () => {
		// D10, pinned so a later reader does not assume D9 absorbed it. It is a
		// ratified token aliased to n2 whose re-point is a token-VALUE decision
		// (F3-blocked), deliberately out of this task's scope.
		expect(read(TOKENS)).toContain("--border-strong: var(--color-n2);");
		// ⚠ THE SECOND HALF IS THE ONE THE DOCKET ROW CITES. `docs/parked.md`'s
		// BORDER-STRONG-ORPHAN row names this test as the evidence that the token
		// still has NO CONSUMER — which the definition assertion alone does not
		// show. Without this, a PR that wires a consumer leaves the guard green
		// while the docket keeps claiming the token is orphaned. (@code-reviewer
		// M-1.) `DiscoveryGrid.tsx:37` mentions it in PROSE explaining why it was
		// not used, so the match is on the `var()` CONSUMPTION form only.
		const consumers = viewLayerFiles.filter((file) =>
			read(file).includes("var(--border-strong)"),
		);
		expect(consumers).toEqual([]);
	});
});
