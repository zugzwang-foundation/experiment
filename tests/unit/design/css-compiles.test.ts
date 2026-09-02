import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * THE GATE THAT DID NOT EXIST WHEN `next dev` DIED ON EVERY ROUTE.
 *
 * A comment in a test file once spelled out an arbitrary-value colour class
 * whose value was a CSS `var()` call containing three literal ASCII dots.
 * Tailwind's scanner does a plain text search for anything class-shaped and
 * has no concept of a comment, so it generated that call straight into the
 * built stylesheet — where a bare `.` is a delimiter, not an identifier, and
 * the whole file fails to parse. `next dev` then failed to compile EVERY route
 * while `next build` only logged a warning and carried on.
 *
 * ⛔ DO NOT WRITE THAT TOKEN OUT IN THIS FILE, OR IN ANY OTHER. Describing it
 * in prose is safe; reproducing it is not, because the scanner cannot tell the
 * two apart. This paragraph originally quoted it verbatim and re-broke the
 * build on the first run of the guard below — the third instance of that exact
 * mistake in one day, after the test comments this fixes and a delivery report
 * that quoted them. The escaped string in the control test IS safe: the
 * backslashes mean no bare class-shaped token appears in this source.
 *
 * ⚠ NOTHING IN THIS REPOSITORY WOULD HAVE CAUGHT IT. `ci.yml` runs biome, tsc,
 * drizzle checks and vitest — none of which compiles CSS. `just verify` does run
 * `next build`, but `next build` treats this failure as non-fatal. So the defect
 * sat on `main` across twenty-plus commits with every gate green, and was found
 * only because somebody ran the app by hand.
 *
 * ⚠ THE HAZARD IS NOT "example code in a test comment". The scanner reads
 * `docs/`, every `.md` at the repo root, and UNTRACKED files in the working
 * tree. A delivery report quoting the broken token in prose, in an untracked
 * root `.md`, silently re-broke the build. `git grep` could not see it, CI could
 * not see it, and a fresh clone was clean.
 *
 * WHY TWO STAGES, AND WHY BOTH ARE LOAD-BEARING. Measured: PostCSS alone does
 * NOT catch this — it emits the invalid declaration without complaint. The
 * throw belongs to Lightning CSS, which is what Next parses the PostCSS output
 * with. A one-stage guard here would have been green against the very defect it
 * was written for.
 *
 * ⚠ PROXY, NOT IDENTITY. Next 16 parses CSS inside the `@next/swc-*` native
 * binary, at whatever revision Next vendored; the Lightning CSS loaded here
 * arrives on Tailwind's release cadence. Same parser family, pinned version,
 * and nothing pins the two together — so this catches the defect class, and is
 * not a claim to be running Next's own parser object.
 *
 * Scope: this stage catches PARSE failures. No `targets` is passed, where Next
 * supplies a browserslist-derived set, so target-dependent TRANSFORM failures
 * are out of scope. The defect class is parse-level.
 */

const ROOT = process.cwd();
const GLOBALS_CSS = join(ROOT, "src", "app", "globals.css");

/**
 * Neither `postcss` nor `lightningcss` is resolvable from the project root —
 * pnpm's strict layout keeps transitive dependencies in `node_modules/.pnpm/`,
 * and neither is a direct dependency. Adding them would be an AGENTS.md §11
 * "ask first" for tooling the app already ships.
 *
 * ⚠ EACH IS ANCHORED AT A PACKAGE THAT ACTUALLY DECLARES IT, and the two
 * anchors are DIFFERENT ON PURPOSE. `@tailwindcss/postcss` declares `postcss`,
 * so `postcss` resolves from there on a real dependency edge. It does NOT
 * declare `lightningcss` — measured, its dependency set is `@alloc/quick-lru`,
 * `postcss`, `@tailwindcss/oxide`, `tailwindcss`, `@tailwindcss/node`.
 * Resolving Lightning CSS from it therefore walks past the real dependency set
 * and lands in pnpm's hoisted hidden store, which is an artifact of the whole
 * graph rather than a relationship between these two packages: the hidden store
 * holds ONE entry per package name, so a second `lightningcss` major entering
 * the graph would silently swap the parser this guard exercises.
 *
 * `@tailwindcss/node` DOES declare it, at the exact pin `1.32.0`, and is itself
 * a declared dependency of `@tailwindcss/postcss`. Anchoring there is a genuine
 * edge, one hop further out, and costs nothing.
 */
const projectRequire = createRequire(join(ROOT, "package.json"));
const tailwindPostcss = projectRequire("@tailwindcss/postcss") as (options?: {
	base?: string;
}) => unknown;
const tailwindPostcssRequire = createRequire(
	projectRequire.resolve("@tailwindcss/postcss"),
);
const tailwindNodeRequire = createRequire(
	tailwindPostcssRequire.resolve("@tailwindcss/node"),
);

/**
 * `createRequire` returns `any`, so these are the trust boundary AGENTS.md §4
 * wants annotated. Narrowed to the surface actually used, which also turns a
 * mistyped option into a compile error rather than a silent no-op.
 */
const postcss = tailwindPostcssRequire("postcss") as (plugins: unknown[]) => {
	process: (css: string, opts: { from: string }) => Promise<{ css: string }>;
};

const lightningcss = tailwindNodeRequire("lightningcss") as {
	transform: (options: {
		filename: string;
		code: Buffer;
		minify: boolean;
		errorRecovery: boolean;
	}) => unknown;
};

/**
 * ⚠ THE SCAN-BREADTH SENTINEL, AND WHY IT REPLACED A LENGTH CHECK.
 *
 * This guard's first version asserted `css.length > 10_000`. That floor sits
 * BELOW the output of a compile that scans no source files at all — preflight,
 * `@theme` and the raw-props block alone clear it. So the scanner could have
 * gone completely blind and all three tests would still have passed: the main
 * assertion because nothing invalid was generated (nothing was generated), and
 * the control because it hand-feeds poison to the parser and never touches the
 * scanner. A guard green for the reason it exists to detect.
 *
 * The realistic route in is not somebody disabling the scan — it is the scan
 * ROOT moving, which a Tailwind minor can do and a checkout without `.git`
 * resolves differently. If the root collapsed to `src/app`, output would be far
 * larger than any sane floor while missing `tests/`, `docs/` and every root
 * `.md` — the entire hazard class above.
 *
 * So the assertion is a token THIS FILE OWNS, in `tests/`, which can only reach
 * the stylesheet if the scanner walked out of `src/` and read this file. It is
 * deliberately not borrowed from another file's prose: a sentinel someone else
 * can edit makes the guard hostage to them. Both halves live here, so they move
 * together or not at all.
 *
 * A red here means the scan narrowed. It cannot mean the two halves drifted:
 * the expected rule is DERIVED from the class below, not written out twice.
 */
const SCAN_SENTINEL_CLASS = "w-[7919px]";

/**
 * Derived, never written out twice. Two hand-maintained constants could drift
 * apart, and the drift would land on the SAFE side — an expectation nobody
 * generates still passes if the other half was edited to match. One source,
 * mechanically escaped the way Tailwind escapes a class selector.
 */
const SCAN_SENTINEL_RULE = `.${SCAN_SENTINEL_CLASS.replace(/[[\]]/g, "\\$&")}`;

/** Stage 1 — the real plugin, over the real entry stylesheet. */
async function compileGlobals(): Promise<string> {
	const source = readFileSync(GLOBALS_CSS, "utf8");
	const result = await postcss([tailwindPostcss()]).process(source, {
		from: GLOBALS_CSS,
	});
	return result.css;
}

/** Stage 2 — the parser Next's output is handed to. */
function parseOrThrow(css: string): void {
	lightningcss.transform({
		filename: "globals.css",
		code: Buffer.from(css),
		minify: false,
		errorRecovery: false,
	});
}

describe("the built stylesheet parses — the gate that was missing", () => {
	it("css::THE-SCANNER-REACHED-OUTSIDE-src", async () => {
		const css = await compileGlobals();

		// `SCAN_SENTINEL_CLASS` appears in this file and nowhere else in the tree.
		// Its rule can only be in the output if the scanner read `tests/`.
		expect(css).toContain(SCAN_SENTINEL_RULE);
	}, 60_000);

	it("css::THE-PROJECT-S-COMPILED-CSS-IS-VALID", async () => {
		const css = await compileGlobals();

		expect(() => parseOrThrow(css)).not.toThrow();
	}, 60_000);

	// ⛔ THE POSITIVE CONTROL. Without it the assertion above is a claim about a
	// parser nobody has watched fail, and this repository has already shipped a
	// guard that was green because it could not see the thing it named. This
	// pins the EXACT rule Tailwind emitted for the token that broke `next dev`.
	//
	// ⚠ It hand-feeds the parser and never touches the scanner, which is why it
	// cannot substitute for the sentinel above. The two test different halves.
	it("css::THE-GUARD-CAN-ACTUALLY-FAIL", async () => {
		const css = await compileGlobals();
		const poisoned = `${css}\n.text-\\[color\\:var\\(\\.\\.\\.\\)\\]{color:var(...)}\n`;

		// Asserted on the structured field rather than the message string, which
		// is Lightning CSS's rendering of an internal token name and free to churn.
		expect(() => parseOrThrow(poisoned)).toThrow(
			expect.objectContaining({ data: { type: "UnexpectedToken" } }),
		);
	}, 60_000);

	// The other half of the FIX-1 finding, pinned so it is not re-litigated: an
	// ellipsis inside brackets is HARMLESS. `…` is a valid CSS ident code point;
	// an ASCII `.` is a delimiter. Only one of the two tokens that fix removed
	// was ever load-bearing, and more of the harmless shape are in the tree on
	// purpose.
	//
	// ⚠ Redundant by measurement — the real stylesheet already carries rules of
	// this shape, so the first test covers it. Kept because the ruling cost real
	// time to establish and an executable statement of it will outlive a comment.
	// Uses `height`, which is the property Tailwind actually emits for the
	// bracketed forms in this tree, rather than a more strictly-parsed one.
	it("css::AN-ELLIPSIS-IN-BRACKETS-IS-NOT-THE-HAZARD", async () => {
		const css = await compileGlobals();
		const withEllipsis = `${css}\n.h-\\[…\\]{height:…}\n`;

		expect(() => parseOrThrow(withEllipsis)).not.toThrow();
	}, 60_000);
});
