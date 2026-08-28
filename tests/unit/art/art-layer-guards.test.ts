import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
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

describe("art layer — it is sealed, and it is unmounted", () => {
	it("imports nothing from outside its own directory (bar react)", () => {
		const OUTWARD =
			/from\s+["'](@\/(?!components\/art)[^"']+|\.\.\/\.\.\/[^"']+)["']/;
		expect('import { db } from "@/db";').toMatch(OUTWARD); // positive control
		const offenders = artCode
			.filter((f) => OUTWARD.test(f.code))
			.map((f) => `${f.file} → ${f.code.match(OUTWARD)?.[0]}`);
		expect(offenders).toEqual([]);
	});

	it("is mounted NOWHERE — nothing outside the art layer imports it", () => {
		// DELIBERATE, and the reason is not caution about the artwork. The mount
		// point is `src/app/(auth)/**`, a named critical path that another session
		// holds a live lock on for the signup-deadlock fix. Mounting is three
		// lines; a collision there costs a full plan → execute → review → gate
		// cycle. When this is mounted on purpose, this test is the one to delete,
		// and deleting it should be a visible decision rather than a silent one.
		const all = sourceFilesUnder("src");
		const importers = all
			.filter((file) => !file.startsWith(ART_DIR))
			.filter((file) =>
				/(?:from|import)\s*\(?\s*["'][^"']*components\/art[^"']*["']/.test(
					stripComments(readFileSync(join(ROOT, file), "utf8")),
				),
			);
		expect(importers).toEqual([]);

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
