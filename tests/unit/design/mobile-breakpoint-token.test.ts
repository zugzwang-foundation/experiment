import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * MOBILE-1 · Phase A — THE BREAKPOINT IS MINTED BY NAME, IN `@theme`, OR IT IS
 * NOT MINTED AT ALL.
 *
 * WHAT THIS GUARD IS FOR. `--breakpoint-mobile` is the first NAMED
 * breakpoint minted in this codebase (MOBILE-1 §4) — not the first responsive
 * class in use: `sm:`/`md:`/`lg:` (Tailwind's own unoverridden defaults) were
 * already load-bearing at ~40 sites before this task, including two files
 * this diff otherwise touches (`HeroPanels.tsx`'s `md:grid-cols-…`,
 * `HeadZone.tsx`'s `lg:flex-row`) — ADR-0045's "no responsive infrastructure
 * exists anywhere" framing describes the ABSENCE OF A MOBILE BREAKPOINT
 * specifically, not the absence of any breakpoint. What's new here is a
 * variant MINTED BY NAME for phone width, per ADR-0045's own requirement
 * ("breakpoints are minted here or not at all") rather than reused from
 * `sm`. Tailwind v4 generates the `mobile:` (≥820px) and `max-mobile:`
 * (<820px) variants from a named `--breakpoint-*` theme value — so every
 * `max-mobile:*` token the rest of Phase A appends depends on this ONE
 * declaration existing, and on it living somewhere Tailwind actually reads.
 *
 * ⛔ THE FAILURE MODE IS SILENT AND IT IS ONE-SIDED. An unrecognised variant
 * compiles to NOTHING — no error, no warning, no build failure. Every
 * `max-mobile:hidden` in the tree would simply never match, and the surfaces
 * would render at phone width exactly as they do today. Desktop, being the
 * unprefixed base state everywhere (the plan's §4 discipline), would look
 * perfect. So the whole of Phase A can be "green" on a missing token and the
 * only symptom is on a device CI never opens.
 *
 * ⚠ `@theme`, NOT `@theme inline`. The inline block is shadcn's var()-indirection
 * layer — every member is `--color-x: var(--x)`. A breakpoint is a STATIC value
 * like the branded colour ramp, and belongs in the plain `@theme` block beside
 * `--color-ground` and `--font-sans`. This is asserted by RANGE, brace-matched
 * out of the shipped file, rather than by eyeballing the diff.
 *
 * ⚠ THE VALUE MOVED 640 -> 820 AT TABLET-1 (ADR-0063) — small tablets get the
 * phone tier. 820px matches NO Tailwind default (`md` is 48rem = 768px, `lg` is
 * 64rem = 1024px), so the name is the only thing tying the two together, and the
 * duplication-by-name is ruled KEPT exactly as it was against `sm` (MOBILE-1 §4,
 * M1-8): ADR-0045's file map requires an explicitly minted breakpoint. So this
 * file pins the NAME and the VALUE together. The other half of the move is
 * `debate/phone-tier.ts`'s hand-copied `QUERY`; `desktop-neutrality.test.tsx`
 * reads it, and the two must agree.
 *
 * ⛔ AND 820 IS NOT WHERE A SIGNED-IN HEADER FITS. The desktop header is trimmed
 * below Tailwind's `xl` (`max-xl:hidden` on Radio/GitHub, X, the §21.1 divider
 * and the visitor counter) — the last two assertions below pin that trim and the
 * `xl` value it stands on.
 *
 * ⚠ WHY A SOURCE SCAN AND NOT A RENDER TEST. jsdom performs no layout and
 * resolves no Tailwind utility, so nothing rendered can see whether a variant
 * exists. `discovery-height-chain.test.ts:19-24` and
 * `debate-height-chain.test.ts:83-88` state the same limit for the same reason.
 * This file proves the DECLARATION is present and correctly placed; a browser
 * against the compiled CSS proves the variant it generates actually matches.
 *
 * ⚠ V-REGISTER DISCIPLINE. This reads the SHIPPED FILE. It does not rebuild a
 * lookalike declaration and check that against itself.
 */

const ROOT = process.cwd();
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

const GLOBALS = "src/app/globals.css";

/** The token name, and the exact declaration MOBILE-1 §4 mints. */
const TOKEN = "--breakpoint-mobile";
const DECLARATION = "--breakpoint-mobile: 820px;";

/**
 * The `{ … }` body owned by an at-rule, brace-matched out of the shipped file
 * rather than bounded by a neighbouring comment string. A marker like
 * `/* shadcn semantic slots` would work today and would go stale the first time
 * somebody re-words a comment — the braces are the structure.
 */
function blockRange(
	source: string,
	openerAt: number,
	label: string,
): { open: number; close: number } {
	const open = source.indexOf("{", openerAt);
	if (open === -1) {
		throw new Error(`${GLOBALS}: ${label} has no opening brace.`);
	}
	let depth = 0;
	for (let i = open; i < source.length; i += 1) {
		if (source[i] === "{") {
			depth += 1;
		} else if (source[i] === "}") {
			depth -= 1;
			if (depth === 0) {
				return { open, close: i };
			}
		}
	}
	throw new Error(`${GLOBALS}: ${label} is never closed.`);
}

/**
 * The PLAIN `@theme` block. ⚠ `\s*\{` is what keeps this from also matching
 * `@theme inline {` — and from matching the three PROSE mentions of `@theme`
 * in this file's comments, none of which is followed by a brace. A guard that
 * cannot tell a declaration from a comment about one is not measuring the thing
 * it names (`debate-height-chain.test.ts:183-190`, the same lesson).
 */
function plainThemeRange(source: string): { open: number; close: number } {
	const hits = [...source.matchAll(/@theme\s*\{/g)];
	if (hits.length !== 1) {
		throw new Error(
			`${GLOBALS}: expected exactly one plain \`@theme {\` block, found ` +
				`${hits.length}. If the token layer was restructured, re-derive this ` +
				`guard's ranges rather than deleting it.`,
		);
	}
	return blockRange(source, hits[0].index, "@theme");
}

/** The shadcn var()-indirection block — where this token must NOT be. */
function inlineThemeRange(source: string): { open: number; close: number } {
	const hits = [...source.matchAll(/@theme\s+inline\s*\{/g)];
	if (hits.length !== 1) {
		throw new Error(
			`${GLOBALS}: expected exactly one \`@theme inline {\` block, found ` +
				`${hits.length}.`,
		);
	}
	return blockRange(source, hits[0].index, "@theme inline");
}

describe("globals.css — the MOBILE-1 breakpoint token", () => {
	it("mobile-breakpoint::guard-is-alive", () => {
		// A guard whose extractors matched nothing would pass every placement
		// assertion below VACUOUSLY — the recorded failure mode this directory
		// keeps re-learning (`discovery-height-chain.test.ts:126-136`). Both
		// ranges must be real, disjoint, and in the order the file declares them.
		const source = read(GLOBALS);
		const plain = plainThemeRange(source);
		const inline = inlineThemeRange(source);

		expect(plain.close).toBeGreaterThan(plain.open);
		expect(inline.close).toBeGreaterThan(inline.open);
		// `@theme inline` is declared FIRST in this file and the two never nest.
		expect(inline.close).toBeLessThan(plain.open);

		// …and the brace matcher found the block a reader would point at: the
		// plain `@theme` body is the one holding the branded ramp.
		const plainBody = source.slice(plain.open, plain.close);
		expect(plainBody).toContain("--color-ground: #181818;");
		expect(plainBody).toContain("--color-n0: #212121;");
		// …while the inline body is the var()-indirection layer, holding none of it.
		const inlineBody = source.slice(inline.open, inline.close);
		expect(inlineBody).toContain("--color-background: var(--background);");
		expect(inlineBody).not.toContain("#");
	});

	it("mobile-breakpoint::declares---breakpoint-mobile-at-exactly-820px", () => {
		// THE WHOLE OF PHASE A HANGS ON THIS ONE LINE. Without it Tailwind emits
		// no `max-mobile:*` rule at all and every override in the reflow is a
		// no-op that fails silently at phone width.
		expect(
			read(GLOBALS),
			`${GLOBALS} does not declare \`${DECLARATION}\`. Tailwind v4 generates ` +
				`the \`mobile:\` / \`max-mobile:\` variants from a named ` +
				`\`--breakpoint-*\` theme value; without this declaration every ` +
				`\`max-mobile:*\` token in the tree compiles to nothing, with no ` +
				`error and no build failure.`,
		).toContain(DECLARATION);
	});

	it("mobile-breakpoint::the-token-is-declared-exactly-once", () => {
		// ⛔ THE POSITIVE CONTROL, AND IT IS NOT DECORATION. A `toContain` on a
		// substring proves the bytes exist SOMEWHERE — inside a comment, inside a
		// second stray block, inside a `.dark` ramp — and cannot tell a real
		// declaration from prose about one. Exactly one occurrence is what makes
		// the placement assertion below unambiguous: there is one site, so
		// "the declaration is inside `@theme`" names a single thing.
		const occurrences = [...read(GLOBALS).matchAll(/--breakpoint-mobile/g)];
		expect(
			occurrences,
			`${GLOBALS} carries ${occurrences.length} occurrences of \`${TOKEN}\`, ` +
				`expected exactly 1. A second copy means two sites can disagree ` +
				`about the phone cutoff, and the one Tailwind honours is decided by ` +
				`source order rather than by a ruling.`,
		).toHaveLength(1);
	});

	it("mobile-breakpoint::the-token-lives-in-@theme-and-NOT-in-@theme-inline", () => {
		const source = read(GLOBALS);
		const at = source.indexOf(DECLARATION);
		expect(
			at,
			`${GLOBALS}: \`${DECLARATION}\` not found, so its placement cannot be ` +
				`checked. Mint it in the plain \`@theme\` block.`,
		).toBeGreaterThan(-1);

		const plain = plainThemeRange(source);
		const inline = inlineThemeRange(source);

		// ⛔ INSIDE THE PLAIN BLOCK. A `--breakpoint-*` outside any `@theme` is a
		// plain custom property: it resolves in `var()` and generates NO VARIANT,
		// which is the same silent nothing as omitting it.
		expect(
			at > plain.open && at < plain.close,
			`${GLOBALS}: \`${TOKEN}\` is declared outside the plain \`@theme\` ` +
				`block. Only a theme value generates a Tailwind variant; a bare ` +
				`custom property on \`:root\` resolves in var() and emits no ` +
				`\`max-mobile:*\` rule.`,
		).toBe(true);

		// ⛔ AND NOT IN THE INLINE BLOCK. `@theme inline` is shadcn's
		// var()-indirection layer (every member is `--color-x: var(--x)`); a
		// static px value does not belong in it, and putting it there would make
		// the one place a reader looks for the breakpoint the wrong place.
		expect(
			at > inline.open && at < inline.close,
			`${GLOBALS}: \`${TOKEN}\` is declared inside \`@theme inline\`, which ` +
				`is reserved for the shadcn var() indirection slots. A static ` +
				`breakpoint belongs in the plain \`@theme\` block beside the branded ` +
				`ramp.`,
		).toBe(false);
	});

	it("mobile-breakpoint::the-px-vs-rem-divergence-from-tailwind-is-STATED-not-assumed", () => {
		// ⛔⛔ THREE DOCUMENTS ONCE CALLED THIS TOKEN "A DELIBERATE SYNONYM FOR
		// `sm`", AND IT IS A UNIT DIFFERENCE, NOT AN IDENTITY. Tailwind's default
		// breakpoints are `rem` (`md` 48rem, `lg` 64rem, `xl` 80rem) and this repo
		// overrides none of them; `mobile` is 820px. A rem breakpoint equals a px
		// one only at a 16px root font size — and root font size is a first-class
		// browser accessibility setting, so at a 20px root `md` fires at 960px
		// while `mobile` still fires at 820px. All those boundaries ship in this
		// one stylesheet, so anywhere a `max-mobile:` override is meant to hand
		// off to an `sm:`/`md:`/`lg:`/`xl:` rule, for that reader it does not.
		//
		// ⚠ THE TOKEN VALUE IS RIGHT AND `px` IS DELIBERATE: this breakpoint
		// describes a DEVICE viewport, which does not grow when someone
		// enlarges their text, and Phase B's gate must fire at the same
		// physical width. Nothing here asks for the value to change.
		//
		// ⚠ WHAT IS ASSERTED IS THE COMMENT, AND THAT IS THE POINT. This
		// guard's other four assertions never mention `rem`, `48rem`, root font
		// size or 16px — so the repo's one written record that the two
		// boundaries differ lived in prose nothing checked, in a file whose
		// whole subject is this token. The divergence is intended; being
		// undocumented is what was wrong, and a documented-only fact in a tree
		// this size is one refactor from being undocumented again.
		const source = read(GLOBALS);
		const at = source.indexOf(DECLARATION);
		const commentBefore = source.slice(Math.max(0, at - 2000), at);
		for (const needed of ["48rem", "root font size"]) {
			expect(
				commentBefore,
				`${GLOBALS}: the comment above \`${DECLARATION}\` no longer records ` +
					`"${needed}". \`${TOKEN}\` is 820px and Tailwind's \`md\` is 48rem; ` +
					`they coincide only at a 16px root font size, which readers change. ` +
					`Calling them synonyms — as this comment, docs/plans/MOBILE-1.md ` +
					`M1-8 and PR #486's body all once did — records a unit difference ` +
					`as an identity. Do not "fix" this by changing the token: px is ` +
					`deliberate. Restore the caveat.`,
			).toContain(needed);
		}

		// ⛔ AND THE PREMISE IS MEASURED, NOT RECITED. If a future Tailwind ships
		// `md` in px, or this repo overrides it, the caveat above becomes the
		// stale claim rather than the correct one — so the divergence it
		// describes is read from the installed package, and this guard reddens
		// when the ground moves instead of outliving it.
		const theme = read("node_modules/tailwindcss/theme.css");
		const declared = (name: string) =>
			new RegExp(`--breakpoint-${name}:\\s*([^;]+);`).exec(theme)?.[1]?.trim();
		expect(
			declared("md"),
			`tailwindcss/theme.css no longer declares \`--breakpoint-md: 48rem\`. The ` +
				`px-vs-rem caveat in globals.css and ADR-0063 describes a divergence ` +
				`that may no longer exist — re-derive both rather than deleting this ` +
				`assertion.`,
		).toBe("48rem");
		for (const name of ["sm", "md", "lg", "xl"]) {
			expect(
				new RegExp(`--breakpoint-${name}\\b`).test(source),
				`${GLOBALS}: now overrides \`--breakpoint-${name}\`. The caveat and the ` +
					`header trim assume Tailwind's unoverridden defaults; re-derive them.`,
			).toBe(false);
		}
	});

	it("mobile-breakpoint::the-desktop-header-is-trimmed-below-xl-and-xl-is-the-measured-1280", () => {
		// ⛔ 820px is NOT where a SIGNED-IN desktop header fits (measured worst
		// case: 256px overflow at 820, 11px at 1200, fits at 1240+). The trim is
		// `max-xl:hidden` on the four controls, gated on the prop like every other
		// breakpoint class in the header chain. Pinned by SOURCE because jsdom does
		// no layout; the geometry is a browser fact recorded in ADR-0063.
		const SITES: Array<[string, string]> = [
			[
				"src/components/shell/GlobalHeader.tsx",
				'data-testid="header-secondary-controls"',
			],
			["src/components/shell/GlobalHeader.tsx", '"mx-3 h-[30px] w-px bg-n2"'],
			["src/components/shell/XLink.tsx", '"w-[34px] justify-center px-0"'],
			[
				"src/components/shell/VisitorCounter.tsx",
				'"flex items-center gap-1.5 text-xs text-muted-foreground select-none"',
			],
		];
		for (const [file, anchor] of SITES) {
			const src = read(file);
			const at = src.indexOf(anchor);
			expect(at, `${file}: anchor \`${anchor}\` not found`).toBeGreaterThan(-1);
			const window = src.slice(at, at + 400);
			expect(
				window.includes(
					'mobileResponsive && "max-mobile:hidden max-xl:hidden"',
				),
				`${file}: the control near \`${anchor}\` lost \`max-xl:hidden\` (gated on ` +
					`mobileResponsive). Without it a signed-in header overflows between 820 ` +
					`and ~1240px — the sideways scroll TABLET-1 exists to remove.`,
			).toBe(true);
		}
		const theme = read("node_modules/tailwindcss/theme.css");
		expect(
			/--breakpoint-xl:\s*80rem\s*;/.test(theme),
			"tailwindcss no longer ships `--breakpoint-xl: 80rem` (1280px at a 16px root); " +
				"the trim's threshold was measured against it. Re-measure a SIGNED-IN header.",
		).toBe(true);
	});
});
