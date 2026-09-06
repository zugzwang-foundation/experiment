import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * MOBILE-1 · Phase B — THE `touch-primary` VARIANT IS MINTED IN `globals.css`,
 * WITH BOTH HALVES OF ITS MEDIA QUERY, BESIDE — NOT INSIDE — PHASE A'S
 * BREAKPOINT TOKEN.
 *
 * WHAT THIS PROVES, AND WHERE IT COMES FROM. `docs/plans/MOBILE-1.md` §4
 * "Client-side CTA hides (Phase B)", condition 2: a NEW,
 * viewport-width-independent rule targeting coarse-pointer/no-hover devices,
 * minted as a Tailwind v4 custom variant —
 *
 *   `@custom-variant touch-primary (@media (hover: none) and (pointer: coarse));`
 *
 * ⛔ BOTH HALVES, DELIBERATELY. Tailwind v4 ships a built-in `pointer-coarse:`
 * variant and the plan explicitly declines it: the combined
 * `hover: none` + `pointer: coarse` form "is more precise against hybrid/2-in-1
 * devices with a secondary pointer" (plan §4). A machine with a touchscreen AND
 * a mouse reports `pointer: coarse` on the touch input while remaining
 * hover-capable; the combined form does not fire on it, the bare form does. So
 * the two halves are asserted separately, each with its own failure message —
 * a single `toContain` on the whole line would tell a reader the declaration
 * changed without telling them which half went missing.
 *
 * ⛔ IT IS `@custom-variant`, NOT A `@theme` MEMBER. `--breakpoint-*` values
 * generate width variants; a media-feature variant is a different mechanism and
 * lives outside the token block. Putting it inside `@theme` would make the one
 * place a reader looks for the breakpoint the wrong place, and the variant
 * would not generate at all.
 *
 * ⚠ PHASE B CONSUMES PHASE A'S TOKEN — IT DOES NOT MOVE, RENAME OR REDEFINE
 * IT. `--breakpoint-mobile: 640px` is Phase A's mint
 * (`tests/unit/design/mobile-breakpoint-token.test.ts` owns its full placement
 * contract). This file asserts only the part Phase B could break: that the
 * token is still there, still 640px, still declared exactly once, still inside
 * the plain `@theme` block — and that the new variant landed BESIDE it rather
 * than inside it, so neither mechanism shadows the other.
 *
 * ⚠ WHY A SOURCE SCAN. jsdom performs no layout and resolves no media query, so
 * nothing rendered can see whether a variant exists — the same limit
 * `mobile-breakpoint-token.test.ts:45-50` states for the same reason. This file
 * proves the DECLARATION; that the compiled variant actually matches
 * `(hover: none) and (pointer: coarse)` AND NOTHING ELSE is a browser
 * measurement (plan §7 Manual/Browser row — Tailwind v4 issue #16053 can
 * generate malformed CSS from a raw-media-query custom variant, which a source
 * scan cannot see).
 *
 * ⚠ V-REGISTER DISCIPLINE. This reads the SHIPPED FILE.
 *
 * ⚠ TDD DRIVER, NOT A `_probe-*` REGRESSION GUARD (CLAUDE.md §5.6).
 */

const ROOT = process.cwd();
const GLOBALS = "src/app/globals.css";
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

const VARIANT = "touch-primary";
/** The exact media condition, normalised to single spaces. */
const CONDITION = "@media (hover: none) and (pointer: coarse)";
const BREAKPOINT_DECLARATION = "--breakpoint-mobile: 640px;";

/**
 * The `{ … }` body owned by an at-rule, brace-matched out of the shipped file
 * rather than bounded by a neighbouring comment string — the braces are the
 * structure, a comment is not.
 */
function blockRange(
	source: string,
	openerAt: number,
	label: string,
): { open: number; close: number } {
	const open = source.indexOf("{", openerAt);
	if (open === -1)
		throw new Error(`${GLOBALS}: ${label} has no opening brace.`);
	let depth = 0;
	for (let i = open; i < source.length; i += 1) {
		if (source[i] === "{") depth += 1;
		else if (source[i] === "}") {
			depth -= 1;
			if (depth === 0) return { open, close: i };
		}
	}
	throw new Error(`${GLOBALS}: ${label} is never closed.`);
}

/**
 * The PLAIN `@theme` block. `\s*\{` is what keeps this from matching
 * `@theme inline {` and from matching prose mentions of `@theme` in this file's
 * comments, none of which is followed by a brace.
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

/** Every `@custom-variant <name> (…)` DECLARATION in the file. */
function customVariants(
	source: string,
): { name: string; body: string; index: number }[] {
	const re = /@custom-variant\s+([A-Za-z][\w-]*)\s*\(([\s\S]*?)\);/g;
	return [...source.matchAll(re)].map((m) => ({
		name: m[1] ?? "",
		body: (m[2] ?? "").replace(/\s+/g, " ").trim(),
		index: m.index,
	}));
}

describe("touch-primary-variant::the-variant-is-minted", () => {
	it("touch-primary-variant::the-file-declares-exactly-two-custom-variants", () => {
		// TWO ASSERTIONS, IN THIS ORDER, AND THE ORDER IS THE DIAGNOSTIC. The
		// first is the extractor's own positive control — a scan that matched
		// nothing would pass every placement assertion below VACUOUSLY, which is
		// the failure mode this directory keeps re-learning. `dark` is the file's
		// pre-existing custom variant and is what proves the reader works at all.
		// The second is the census. If BOTH fail, the extractor died; if only the
		// census fails, the variant is missing.
		const variants = customVariants(read(GLOBALS));

		const dark = variants.find((v) => v.name === "dark");
		expect(
			dark,
			`${GLOBALS}: the extractor found no \`@custom-variant dark\`, so it is ` +
				`not reading declarations at all and every assertion below is ` +
				`meaningless. Re-derive it rather than deleting this control.`,
		).toBeDefined();
		expect(dark?.body).toBe("&:is(.dark *)");

		// ⛔ EXACTLY TWO, BY NAME. `dark` is descoped-inert (never applied — the
		// single dark theme lives in `:root`) and `touch-primary` is Phase B's.
		// A census rather than a `toContain` because a THIRD custom variant is a
		// second matching mechanism nobody ruled, and it would be invisible to
		// every other row in this file.
		expect(
			variants.map((v) => v.name).sort(),
			`${GLOBALS}: declares custom variants ` +
				`[${variants.map((v) => v.name).join(", ")}], expected exactly ` +
				`[dark, ${VARIANT}]. \`${VARIANT}\` is MOBILE-1 §4's second hide ` +
				`condition and the ONLY layer a default-mode iPad ever meets — the ` +
				`server-side gate cannot see that device class at all (plan §3 ` +
				`"Consequence", Self-critique #1, rated high).`,
		).toEqual(["dark", VARIANT].sort());
	});

	it("touch-primary-variant::declares-touch-primary-exactly-once", () => {
		const hits = customVariants(read(GLOBALS)).filter(
			(v) => v.name === VARIANT,
		);
		expect(
			hits.length,
			`${GLOBALS}: expected exactly one \`@custom-variant ${VARIANT} (…)\` ` +
				`declaration, found ${hits.length}. Without it every ` +
				`\`${VARIANT}:hidden\` token in the tree compiles to NOTHING — no ` +
				`error, no warning, no build failure — and the CTAs stay visible on ` +
				`every tablet and iPad, which is the one device class with no ` +
				`server-side backstop at all (MOBILE-1 §3 Consequence). Two ` +
				`declarations would be two conditions whose winner is decided by ` +
				`source order rather than by a ruling.`,
		).toBe(1);
	});

	it("touch-primary-variant::the-condition-is-hover-none-AND-pointer-coarse", () => {
		const variant = customVariants(read(GLOBALS)).find(
			(v) => v.name === VARIANT,
		);
		if (!variant) {
			throw new Error(
				`${GLOBALS}: no \`@custom-variant ${VARIANT}\` declaration — see the ` +
					`row above.`,
			);
		}

		// Each half separately, so the failure names which one went missing.
		expect(
			variant.body,
			`${GLOBALS}: \`${VARIANT}\` does not test \`hover: none\`. The bare ` +
				`\`pointer: coarse\` form — which is Tailwind v4's own built-in ` +
				`\`pointer-coarse:\` variant — is DELIBERATELY not used: MOBILE-1 §4 ` +
				`chose the combined form because it is "more precise against ` +
				`hybrid/2-in-1 devices with a secondary pointer". A hover-capable ` +
				`touchscreen machine matches the bare form and must not.`,
		).toContain("(hover: none)");
		expect(
			variant.body,
			`${GLOBALS}: \`${VARIANT}\` does not test \`pointer: coarse\`.`,
		).toContain("(pointer: coarse)");
		expect(
			variant.body,
			`${GLOBALS}: \`${VARIANT}\`'s two conditions are not combined with ` +
				`\`and\`. Either alone is a different — and wrong — device set.`,
		).toContain(" and ");

		// …and the whole condition, exactly, whitespace-normalised.
		expect(
			variant.body,
			`${GLOBALS}: \`${VARIANT}\`'s condition is \`${variant.body}\`, ` +
				`expected \`${CONDITION}\` (MOBILE-1 §4).`,
		).toBe(CONDITION);
	});

	it("touch-primary-variant::the-variant-lives-OUTSIDE-@theme", () => {
		const source = read(GLOBALS);
		const variant = customVariants(source).find((v) => v.name === VARIANT);
		if (!variant) {
			throw new Error(
				`${GLOBALS}: no \`@custom-variant ${VARIANT}\` declaration — see ` +
					`above.`,
			);
		}
		const theme = plainThemeRange(source);
		expect(
			variant.index > theme.open && variant.index < theme.close,
			`${GLOBALS}: \`@custom-variant ${VARIANT}\` is declared INSIDE the ` +
				`plain \`@theme\` block. \`@theme\` holds token VALUES; a custom ` +
				`variant is a different mechanism and belongs at the top level ` +
				`beside \`@custom-variant dark\`.`,
		).toBe(false);
	});
});

describe("touch-primary-variant::Phase-A's-breakpoint-token-is-consumed-not-moved", () => {
	it("touch-primary-variant::--breakpoint-mobile-is-consumed-unchanged-BESIDE-the-new-variant", () => {
		// Phase B CONSUMES this token (`max-mobile:hidden` on every gated CTA) and
		// must not redefine, rename or relocate it. Its full placement contract
		// belongs to `mobile-breakpoint-token.test.ts`; what is asserted here is
		// only what THIS phase could break.
		//
		// ⚠ "PHASE B CONSUMED IT WITHOUT MOVING IT" IS A CLAIM ABOUT A DIFF, AND
		// A DIFF NEEDS TWO SIDES. Asserting only that the Phase A token is
		// unchanged would be green on a tree where Phase B never happened —
		// true, and about nothing. So this row requires BOTH declarations to be
		// present, then pins the token, which is the claim it is actually named
		// for.
		const source = read(GLOBALS);

		expect(
			customVariants(source).some((v) => v.name === VARIANT),
			`${GLOBALS}: \`@custom-variant ${VARIANT}\` is not declared, so ` +
				`"Phase B consumed Phase A's token without moving it" is a claim ` +
				`about a change that has not landed. Mint the variant (MOBILE-1 §4), ` +
				`then this row measures the thing it names.`,
		).toBe(true);

		const occurrences = [...source.matchAll(/--breakpoint-mobile/g)];
		expect(
			occurrences.length,
			`${GLOBALS}: \`--breakpoint-mobile\` occurs ${occurrences.length} ` +
				`times, expected exactly 1. Phase B consumes Phase A's token; a ` +
				`second copy means two sites can disagree about the phone cutoff.`,
		).toBe(1);

		expect(
			source,
			`${GLOBALS}: \`${BREAKPOINT_DECLARATION}\` is gone or changed. Phase B's ` +
				`\`max-mobile:hidden\` gate fires at exactly this width; moving it ` +
				`silently moves every Phase A reflow with it.`,
		).toContain(BREAKPOINT_DECLARATION);

		const theme = plainThemeRange(source);
		const at = source.indexOf(BREAKPOINT_DECLARATION);
		expect(
			at > theme.open && at < theme.close,
			`${GLOBALS}: \`--breakpoint-mobile\` is no longer inside the plain ` +
				`\`@theme\` block. Only a theme value generates a Tailwind variant; a ` +
				`bare custom property resolves in var() and emits no ` +
				`\`max-mobile:*\` rule at all — silently.`,
		).toBe(true);
	});

	it("touch-primary-variant::the-two-mechanisms-are-separate-and-neither-shadows-the-other", () => {
		// ⛔ THE POINT OF PUTTING BOTH ASSERTIONS IN ONE FILE. Phase B's two hide
		// conditions are INDEPENDENT by design (plan §4: "two independent hide
		// conditions... not one widened breakpoint") — a width rule and a
		// media-feature rule, deliberately uncorrelated so that a tablet at 1024px
		// is caught by one and a phone-width desktop window is caught by the
		// other. Collapsing them into one mechanism — e.g. redefining
		// `--breakpoint-mobile` to cover tablets, or expressing `touch-primary` as
		// a width — is the change this row exists to catch, and it would look
		// perfectly reasonable in a diff.
		const source = read(GLOBALS);
		const variant = customVariants(source).find((v) => v.name === VARIANT);
		if (!variant) {
			throw new Error(
				`${GLOBALS}: no \`@custom-variant ${VARIANT}\` declaration, so the ` +
					`independence of the two mechanisms cannot be checked. Mint it ` +
					`(MOBILE-1 §4).`,
			);
		}

		// The variant carries no width at all — it is viewport-width-INDEPENDENT.
		expect(
			/\b(?:min|max)-width\b/.test(variant.body),
			`${GLOBALS}: \`${VARIANT}\` now carries a width condition ` +
				`(\`${variant.body}\`). It is deliberately width-independent: a tablet ` +
				`is 1024px wide and must still be caught.`,
		).toBe(false);

		// …and the breakpoint token carries no media feature.
		expect(
			/--breakpoint-mobile:\s*640px;/.test(source),
			`${GLOBALS}: \`--breakpoint-mobile\` is no longer a bare 640px value.`,
		).toBe(true);
	});
});
