import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * WARLI-1 slice 6 — the standing guards on the art layer.
 *
 * ⚠ EVERY NEGATIVE HERE IS PAIRED WITH A POSITIVE CONTROL, because a search
 * that returns nothing is equally consistent with "the thing is absent" and
 * "my pattern is wrong", and only one of those is good news. Each `not.toMatch`
 * is preceded by the same pattern finding something it is known to find.
 *
 * ⚠ AND EVERY SCAN STRIPS COMMENTS FIRST. This repo has been bitten six times
 * by a source-scan guard whose negative pattern matched the COMMENT EXPLAINING
 * THE ABSENCE — a file saying "`--color-yes` must never appear here" is caught
 * by a guard looking for `--color-yes`. It would have fired immediately here:
 * the docblocks in `hero.tsx`, `primitives/types.ts` and the plan all name the
 * pole tokens in prose, precisely because naming them is how the rule is
 * explained. Prose about a rule is not a violation of it.
 */

const ROOT = process.cwd();
const ART_DIR = "src/components/art";

function sourceFilesUnder(dir: string): readonly string[] {
	return readdirSync(join(ROOT, dir), { recursive: true, withFileTypes: true })
		.filter(
			(entry) =>
				entry.isFile() &&
				(entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")),
		)
		.map((entry) => join(entry.parentPath, entry.name).replace(`${ROOT}/`, ""));
}

/** Verbatim from `tests/unit/design/no-raw-hex-view-layer.test.ts:81-86`. */
function stripComments(source: string): string {
	return source
		.replace(/\/\*[\s\S]*?\*\//g, "")
		.replace(/^\s*\/\/.*$/gm, "")
		.replace(/\/\/[^"'`\n]*$/gm, "");
}

const artFiles = sourceFilesUnder(ART_DIR);
const artCode = artFiles.map((file) => ({
	file,
	code: stripComments(readFileSync(join(ROOT, file), "utf8")),
}));

const POLE_TOKEN =
	/--(?:color|graph)-(?:yes|no)\b|\b(?:bg|text|border|stroke|fill|ring|from|to|via)-(?:yes|no)\b/;
const RASTER = /\.(?:png|jpe?g|gif|webp|avif|bmp|tiff?|ico)\b/i;
const HEX_LITERAL =
	/#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})\b/;

describe("art layer — the guard is alive", () => {
	it("scans a real, non-empty set of art files", () => {
		// A glob that silently matches nothing passes every negative below.
		expect(artFiles.length).toBeGreaterThanOrEqual(8);
		expect(artFiles).toContain("src/components/art/warli/hero.tsx");
		expect(artFiles).toContain("src/components/art/warli/geometry.ts");
	});

	it("reads real content — the reader finds what is known to be there", () => {
		// POSITIVE CONTROL for the whole file: the same read + strip that every
		// negative below runs against must be able to FIND something. Every
		// primitive paints with `currentColor`, so it is present by construction.
		const withCurrentColor = artCode.filter((f) =>
			f.code.includes("currentColor"),
		);
		expect(withCurrentColor.length).toBeGreaterThanOrEqual(4);
	});
});

describe("art layer — no raster assets", () => {
	it("the raster pattern matches a raster reference (positive control)", () => {
		expect('import mark from "./zugzwang-mark.png";').toMatch(RASTER);
		expect('<img src="/brand/hero.webp" />').toMatch(RASTER);
	});

	it("imports or references no raster anywhere under src/components/art", () => {
		// A raster has no addressable parts, so it cannot be animated, and it
		// carries the wrong payload for a route sized for 100k signups. The
		// whole piece is line, and line is the only thing that can be.
		const offenders = artCode
			.filter((f) => RASTER.test(f.code))
			.map((f) => `${f.file} → ${f.code.match(RASTER)?.[0]}`);
		expect(offenders).toEqual([]);
	});
});

describe("art layer — the side poles are not decoration", () => {
	it("the pole pattern matches a pole reference (positive control)", () => {
		expect('stroke="var(--color-yes)"').toMatch(POLE_TOKEN);
		expect('className="fill-no"').toMatch(POLE_TOKEN);
		expect("side === 'YES' ? 'bg-yes' : 'bg-no'").toMatch(POLE_TOKEN);
	});

	it("never reaches for --color-yes / --color-no or their utilities", () => {
		// `--color-yes` and `--color-no` encode bet SIDE (INV-3). Binding
		// decoration to them would make an artwork depend on a thesis invariant,
		// and a later correct change to what a pole MEANS would silently restyle
		// a drawing that has no sides.
		//
		// ⚠ THE TRAP IS THAT IT WOULD LOOK RIGHT. `--color-ground` is #181818 and
		// `--color-yes` is ALSO #181818; `--color-ink` and `--color-no` are both
		// #fafafa. A figure painted with `--color-no` would render pixel-identical
		// to one painted with `--color-ink`, so no screenshot, no visual review and
		// no colour assertion could ever tell them apart. This text scan is the
		// only thing that can, which is why it exists rather than a render check.
		const offenders = artCode
			.filter((f) => POLE_TOKEN.test(f.code))
			.map((f) => `${f.file} → ${f.code.match(POLE_TOKEN)?.[0]}`);
		expect(offenders).toEqual([]);
	});

	it("carries no raw hex colour of its own", () => {
		// Belt and braces over `tests/unit/design/no-raw-hex-view-layer.test.ts`,
		// which already auto-scans `src/components`. Kept because that guard's
		// scope is a decision someone could narrow, and this one states the art
		// layer's own requirement in the art layer's own file.
		expect("#c0ffee").toMatch(HEX_LITERAL); // positive control
		const offenders = artCode
			.filter((f) => HEX_LITERAL.test(f.code))
			.map((f) => `${f.file} → ${f.code.match(HEX_LITERAL)?.[0]}`);
		expect(offenders).toEqual([]);
	});
});

describe("art layer — the injection sinks stay shut", () => {
	// ⚠ MINTED BY THE SECURITY AUDIT, which found the layer clean on every one of
	// these and then said the property was held by NOBODY. It was true by habit.
	//
	// `<foreignObject>` is the one to care about: it re-enters HTML parsing inside
	// an SVG, and it is exactly what a contributor reaches for the first time they
	// want real text in this drawing. The others are the standard SVG-XSS set.
	//
	// ⚠ WHAT THIS GUARD CANNOT SEE, stated so it does not read as total. Matching
	// is literal and case-sensitive, so all of these walk past it:
	//
	//   · `React.createElement("foreignObject", …)` — the non-JSX form, which is
	//     also what any dynamic-tag construction compiles to. No `<foreignObject`
	//     token ever appears.
	//   · A sink assembled by concatenation or interpolation: `"<foreign" +
	//     "Object"`, `` `<${tag}>` ``.
	//   · Anything reached through a variable rather than written out.
	//
	//   ⛔ AND STRUCTURALLY, IT CAN NEVER SEE `<style`. `hero.tsx` legitimately
	//     contains one, so the token cannot go in this list — which means a SECOND
	//     `<style>` with an interpolated child, the exact sink the security audit
	//     found a false comment beside, is invisible here by construction. That
	//     one is closed by review, not by this file.
	const SINKS = [
		"dangerouslySetInnerHTML",
		"innerHTML",
		"insertAdjacentHTML",
		"document.write",
		"<foreignObject",
		"<script",
		"<iframe",
		"<object",
		"<embed",
		"<animate",
		"<use",
		"<image",
		// Both spellings of the same attribute: the xlink namespace form, React's
		// camelCase form, and the SVG2 bare `href` that has replaced them.
		"xlink:href",
		"xlinkHref",
		"srcDoc",
		"srcdoc",
		"javascript:",
	];

	it("the sink patterns match their own sink (positive control)", () => {
		const sample =
			'<foreignObject><div dangerouslySetInnerHTML={{__html: x}}/></foreignObject><script src="x"/><use xlink:href="#y"/>';
		for (const sink of [
			"dangerouslySetInnerHTML",
			"<foreignObject",
			"<script",
			"<use",
			"xlink:href",
		]) {
			expect(sample).toContain(sink);
		}
	});

	it("opens none of them anywhere under src/components/art", () => {
		const offenders = artCode.flatMap((f) =>
			SINKS.filter((sink) => f.code.includes(sink)).map(
				(sink) => `${f.file} → ${sink}`,
			),
		);
		expect(offenders).toEqual([]);
	});

	it("keeps the preview generator's one raw-HTML sink escaped", () => {
		// ⚠ THE GENERATOR IS SCANNED BY NO GUARD IN THIS REPO — `ART_DIR` does not
		// reach `scripts/`. So the file holding the ONLY raw-HTML concatenation and
		// the ONLY `<script>` was unguarded, which means the escape fix that closed
		// the audit's L-2 was itself held by nobody: exactly the shape L-3 was
		// minted to end, one file over.
		//
		// The general sink list cannot be reused here — this file legitimately
		// contains `<script`, `<style` and raw markup, because writing an HTML
		// document is its whole job. What IS assertable is the specific property
		// the fix established: nothing reaches that document unescaped.
		const gen = stripComments(
			readFileSync(join(ROOT, "scripts/warli-preview.tsx"), "utf8"),
		);

		// POSITIVE CONTROL: the escaped forms are present, so the search works.
		expect(gen).toContain("${esc(spec.label)}");
		expect(gen).toContain("${esc(density)}");
		expect(gen).toContain("${esc(kind)}");

		// …and the unescaped forms are absent. `spec.label` is typed plain
		// `string`; the other two are closed unions and are escaped anyway, so the
		// rule is uniform and greppable rather than requiring the reader to
		// re-derive which values happen to be constrained.
		// ⚠ `${kind}` JOINED THIS LIST AT WARLI-2, and its absence was the exact
		// coverage-by-habit this test exists to end. `kind` comes from
		// `SCENE_MOTIFS: readonly string[]` — plain `string`, the SAME trust level
		// as `spec.label`, which the list already covered. Dropping its `esc()`
		// passed the guard green.
		for (const raw of [
			"${spec.label}",
			"${density}",
			"${spec.prop}",
			"${kind}",
		]) {
			expect(gen).not.toContain(raw);
		}

		// And the generated document must not gain a live sink of its own.
		for (const sink of [
			"eval(",
			"new Function",
			"innerHTML",
			"document.write",
			"<foreignObject",
			"<iframe",
			"javascript:",
		]) {
			expect(gen).not.toContain(sink);
		}
	});
});

describe("art layer — it is sealed, and it is unmounted", () => {
	it("imports nothing from outside its own directory (bar react)", () => {
		// ⚠ THIS WAS A DENYLIST AND IT LEAKED. It matched `@/…` and `../../…` and
		// therefore could not see the import a contributor is most likely to add to
		// an art layer: a BARE npm specifier. `framer-motion`, `clsx`, `d3` — all
		// invisible. And `../../` is depth-dependent: from `primitives/` it is
		// still INSIDE the art directory (a false positive waiting to happen) while
		// from the art root a single `../` escapes it entirely (a false negative
		// that was live).
		//
		// Inverted to an ALLOWLIST: every specifier must be `react`, or relative
		// AND resolve to a path still under `src/components/art`. A denylist has to
		// enumerate every way out; an allowlist has to enumerate the one way in.
		const SPECIFIER = /(?:^|[^\w$])(?:from|import)\s*\(?\s*["']([^"']+)["']/g;
		const ALLOWED_BARE = new Set(["react", "react/jsx-runtime"]);

		const classify = (file: string, spec: string) => {
			if (ALLOWED_BARE.has(spec)) {
				return null;
			}
			if (!spec.startsWith(".")) {
				return `${file} → bare specifier "${spec}"`;
			}
			const resolved = join(ROOT, dirname(file), spec);
			return resolved.startsWith(join(ROOT, ART_DIR))
				? null
				: `${file} → escapes the art layer: "${spec}"`;
		};

		// POSITIVE CONTROLS: real ways out, all caught by the classifier.
		expect(
			classify("src/components/art/warli/hero.tsx", "@/db"),
		).not.toBeNull();
		expect(
			classify("src/components/art/warli/hero.tsx", "framer-motion"),
		).not.toBeNull();
		// ⚠ DEPTH MATTERS, and writing this control taught me so: from `warli/`,
		// `../shell/X` resolves to `art/shell/X` and is still INSIDE — my first
		// version of this line asserted it escaped, and reddened. Two levels up
		// from `warli/`, or ONE level up from a file sitting directly in `art/`,
		// is what actually leaves. That depth-dependence is exactly why the old
		// literal `../../` denylist was wrong in both directions.
		expect(
			classify("src/components/art/warli/hero.tsx", "../../shell/X"),
		).not.toBeNull();
		expect(classify("src/components/art/x.ts", "../shell/X")).not.toBeNull();
		// …and the legitimate ones, so the classifier is not simply refusing all.
		expect(classify("src/components/art/warli/hero.tsx", "react")).toBeNull();
		expect(classify("src/components/art/warli/hero.tsx", "./ring")).toBeNull();
		expect(
			classify("src/components/art/warli/ring.tsx", "../primitives"),
		).toBeNull();

		const offenders = artCode.flatMap((f) =>
			[...f.code.matchAll(SPECIFIER)]
				.map((m) => classify(f.file, m[1] ?? ""))
				.filter((hit): hit is string => hit !== null),
		);
		expect(offenders).toEqual([]);
	});

	/**
	 * ⚠ TEMPORARY, AND IT NAMES THE ONE FILE IT FORGIVES.
	 *
	 * `WARLI-VIEW` added a throwaway viewer route so the composition could be
	 * looked at in a browser — the artwork is mounted nowhere, so a deployment
	 * alone renders nothing. **This allowance exists ONLY for that route and must
	 * be deleted when the route is.**
	 *
	 * ⛔ It is NOT the mount. The mount decision is still open on a measured cost
	 * (~82 KB gzipped markup, ~35 ms server CPU per render — WARLI-2 OWED-2), and
	 * a viewer nobody but the founder opens does not settle it.
	 */
	const TEMPORARY_WARLI_VIEW_ROUTE = "src/app/(public)/warli/page.tsx";

	it("is mounted NOWHERE — nothing outside the art layer imports it, bar the temporary viewer", () => {
		// DELIBERATE, and the reason is not caution about the artwork. The real
		// mount point is `src/app/(auth)/**`, a named critical path another lane
		// holds. Mounting is three lines; a collision there costs a full plan →
		// execute → review → gate cycle. When this is mounted on purpose, this
		// test is the one to delete, and deleting it should be a visible decision
		// rather than a silent one.
		const all = sourceFilesUnder("src");
		const importers = all
			.filter((file) => !file.startsWith(ART_DIR))
			.filter((file) =>
				/(?:from|import)\s*\(?\s*["'][^"']*components\/art[^"']*["']/.test(
					stripComments(readFileSync(join(ROOT, file), "utf8")),
				),
			);

		// ⚠ EXACT EQUALITY AGAINST ONE NAMED PATH — deliberately NOT a filter that
		// drops the viewer before asserting `[]`.
		//
		// The difference is what happens when the route is DELETED. A filter would
		// keep passing, leaving a stale allowance that silently forgives whatever
		// is added at that path next. Exact equality REDS the moment the importer
		// set stops being exactly this one file — whether something new imports the
		// art layer, OR the viewer goes away and the allowance outlives it.
		//
		// So the requirement "remove this when the route is removed" is enforced by
		// the assertion rather than asked for in a comment. This is one allowed
		// path, not a denylist and not a widened directory: any second importer
		// fails, and `src/app/(auth)/**` is not reachable through it.
		expect(importers).toEqual([TEMPORARY_WARLI_VIEW_ROUTE]);

		// POSITIVE CONTROL: the same scan, pointed at a component family that IS
		// mounted, finds importers. Without this the assertion above would pass
		// just as happily against a broken regex.
		const shellImporters = all.filter((file) =>
			/(?:from|import)\s*\(?\s*["'][^"']*components\/shell[^"']*["']/.test(
				stripComments(readFileSync(join(ROOT, file), "utf8")),
			),
		);
		expect(shellImporters.length).toBeGreaterThan(0);
	});
});
