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
 * ⚠ NOTHING IN THIS REPOSITORY WOULD HAVE CAUGHT IT, and that is the reason
 * this file exists rather than a lint rule or a review habit. `ci.yml` runs
 * biome, tsc, drizzle checks and vitest — none of which compiles CSS. `just
 * verify` does run `next build`, but `next build` treats this failure as
 * non-fatal. So the defect sat on `main` across twenty-plus commits with every
 * gate green, and was found only because somebody ran the app by hand.
 *
 * ⚠ THE HAZARD IS NOT "example code in a test comment". It is far wider: the
 * scanner reads `docs/`, every `.md` at the repo root, and UNTRACKED files in
 * the working tree. Measured while writing this guard — a delivery report
 * quoting the broken token in prose, in an untracked root `.md`, silently
 * re-broke the build. `git grep` could not see it, CI could not see it, and a
 * fresh clone was clean. Prose describing the defect is indistinguishable from
 * the defect, to a scanner.
 *
 * WHY TWO STAGES, AND WHY BOTH ARE LOAD-BEARING. Measured: PostCSS alone does
 * NOT catch this — it emits the invalid declaration without complaint. The
 * throw belongs to Lightning CSS, which is what Next parses the PostCSS output
 * with. A one-stage guard here would have been green against the very defect
 * it was written for.
 */

const ROOT = process.cwd();
const GLOBALS_CSS = join(ROOT, "src", "app", "globals.css");

/**
 * `lightningcss` and `postcss` are NOT resolvable from the project root —
 * pnpm's strict layout keeps transitive dependencies in `node_modules/.pnpm/`,
 * and neither is a direct dependency. Adding them would be an AGENTS.md §11
 * "ask first" for tooling the app already ships.
 *
 * Both ARE resolvable from `@tailwindcss/postcss`'s own root, and that IS a
 * direct dependency. Anchoring there gets the exact versions the application
 * builds with, at zero dependency cost. It also means this guard exercises the
 * SHIPPED plugin rather than a reconstruction of it — a copy is free to drift
 * from what Next actually runs, and a guard exercising a pipeline nobody ships
 * is the failure mode a guard exists to prevent.
 */
const projectRequire = createRequire(join(ROOT, "package.json"));
const tailwindPostcss = projectRequire("@tailwindcss/postcss");
const tailwindRequire = createRequire(
	projectRequire.resolve("@tailwindcss/postcss"),
);
const postcss = tailwindRequire("postcss");
const lightningcss = tailwindRequire("lightningcss");

/** Stage 1 — the real plugin, over the real entry stylesheet. */
async function compileGlobals(): Promise<string> {
	const source = readFileSync(GLOBALS_CSS, "utf8");
	const result = await postcss([tailwindPostcss()]).process(source, {
		from: GLOBALS_CSS,
	});
	return result.css;
}

/** Stage 2 — the parser Next hands the PostCSS output to. */
function parseOrThrow(css: string): void {
	lightningcss.transform({
		filename: "globals.css",
		code: Buffer.from(css),
		minify: false,
		errorRecovery: false,
	});
}

describe("the built stylesheet parses — the gate that was missing", () => {
	it("css::THE-PROJECT-S-COMPILED-CSS-IS-VALID", async () => {
		const css = await compileGlobals();

		// A compile that produced nothing would pass `parseOrThrow` trivially.
		expect(css.length).toBeGreaterThan(10_000);

		expect(() => parseOrThrow(css)).not.toThrow();
	}, 60_000);

	// ⛔ THE POSITIVE CONTROL. Without it the assertion above is a claim about a
	// parser nobody has watched fail, and this repository has already shipped a
	// guard that was green because it could not see the thing it named. This
	// pins the EXACT rule Tailwind emitted for the token that broke `next dev`.
	it("css::THE-GUARD-CAN-ACTUALLY-FAIL", async () => {
		const css = await compileGlobals();
		const poisoned = `${css}\n.text-\\[color\\:var\\(\\.\\.\\.\\)\\]{color:var(...)}\n`;

		expect(() => parseOrThrow(poisoned)).toThrow(/Delim/);
	}, 60_000);

	// The other half of the FIX-1 finding, pinned so it is not re-litigated:
	// an ellipsis inside brackets is HARMLESS. `…` is a valid CSS ident code
	// point; an ASCII `.` is a delimiter. Only one of the two tokens that fix
	// removed was ever load-bearing, and seven more of the harmless shape are
	// still in the tree on purpose.
	it("css::AN-ELLIPSIS-IN-BRACKETS-IS-NOT-THE-HAZARD", async () => {
		const css = await compileGlobals();
		const withEllipsis = `${css}\n.text-\\[…\\]{color:…}\n`;

		expect(() => parseOrThrow(withEllipsis)).not.toThrow();
	}, 60_000);
});
