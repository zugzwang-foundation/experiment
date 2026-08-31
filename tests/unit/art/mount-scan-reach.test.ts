import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";

import { ART_DIR, reachesArt, SPECIFIER, stripComments } from "./_mount-scan";

/**
 * WARLI-MOUNT · @test-writer audit — CAN A SECOND MOUNT WALK PAST THE PIN?
 *
 * `tests/unit/art/art-layer-guards.test.ts` pins the art layer's importer list
 * to exactly `src/app/(auth)/layout.tsx`. The claim it makes in its own words is
 * "the scan that used to prove 'nowhere' is the only thing in the tree that can
 * prove 'not anywhere else'." That claim is only as wide as the detector behind
 * it, and the detector is a SUBSTRING test — as it read on 2026-08-31, quoted
 * here to explain the defect and nowhere relied upon (the executable copy is
 * LIFTED below, never retyped):
 *
 *     /(?:from|import)\s*\(?\s*["'][^"']*components\/art[^"']*["']/
 *
 * A specifier is flagged if its TEXT contains `components/art`. Whether a
 * specifier reaches the art layer is a question about where it RESOLVES, and
 * those two are the same question only for `@/…` and for deep-relative paths
 * written from `src/app`. They come apart the moment the importing file already
 * lives under `src/components`, where the idiomatic specifier for a neighbour is
 * `../art/warli` — no `components/` in it at all. 118 files under `src/` already
 * import a neighbour that way, so this is the codebase's own house style rather
 * than a contrived form, and `biome.json` carries no rule against it.
 *
 * ⚠ THE FIX ALREADY EXISTS ONE FUNCTION UP IN THE GUARD BEING AUDITED. The
 * sibling row — "imports nothing from outside its own directory" — resolves each
 * specifier with `join(ROOT, dirname(file), spec)` and compares the resolved path
 * against `ART_DIR`, precisely because its author found that a literal `../../`
 * denylist was "wrong in both directions". The mount scan is that same question
 * pointed outward and it never got the same treatment.
 *
 * ⛔ THIS FILE ASSERTS A PROPERTY, NOT AN IMPLEMENTATION. Each row states what
 * the mount scan MUST conclude, and an ORACLE — path resolution, the reference
 * semantics — states what is actually true. Rows where the live detector and the
 * oracle disagree are RED, and they are red on purpose: they are the target for
 * whatever fix the guard takes.
 *
 * ⚠ THE DETECTOR IS LIFTED OUT OF THE GUARD FILE, NEVER RETYPED. A copied regex
 * drifts from its original silently and then tests a pattern nobody ships —
 * which is the exact defect class this repo keeps re-finding. Extraction fails
 * CLOSED: if the guard's line moves, this file throws at import rather than
 * quietly exercising a stale copy.
 */

const ROOT = process.cwd();

/**
 * ⛔ THE DETECTOR IS IMPORTED NOW, NOT LIFTED, AND THIS FILE FORCED THAT CHANGE.
 * It used to locate the guard's detector by ROLE — "the one inline `/…/.test(`
 * that is not the shell control" — which was a careful design and still only
 * worked while the detector WAS an inline literal. The fix this file was written
 * to demand replaced that literal with a resolving function, the lift found
 * zero, and the audit died at collection. A text-lift is not a shared
 * definition; `./_mount-scan` is. Both the guard and this file import it, so
 * neither can end up exercising a pattern the other does not ship.
 */

/**
 * THE ORACLE. A specifier reaches the art layer iff it RESOLVES to a path at or
 * under `src/components/art`. Bare npm specifiers cannot, by construction.
 *
 * The `${art}/` boundary is deliberate and is not the same as a bare
 * `startsWith(art)`: a plain prefix test would read a hypothetical
 * `src/components/artifacts/…` as inside the art layer.
 */
function resolvesIntoArtLayer(file: string, spec: string): boolean {
	const abs = spec.startsWith("@/")
		? join(ROOT, "src", spec.slice(2))
		: spec.startsWith(".")
			? join(ROOT, dirname(file), spec)
			: null;
	if (abs === null) return false;
	const art = join(ROOT, ART_DIR);
	return abs === art || abs.startsWith(`${art}/`);
}

/** Every module specifier in a source string, in any of the forms TS admits. */

/** The oracle's verdict on a whole file: does this file reach the art layer? */
function reallyImportsArtLayer(file: string, source: string): boolean {
	return [...stripComments(source).matchAll(SPECIFIER)].some((m) =>
		resolvesIntoArtLayer(file, m[2] ?? ""),
	);
}

/**
 * The live detector's verdict on the same file — now the SHARED one, so this is
 * no longer "the guard's verdict as this file understands it" but literally the
 * function the guard calls.
 */
function scanFlags(file: string, source: string): boolean {
	return [...stripComments(source).matchAll(SPECIFIER)].some((m) =>
		reachesArt(file, m[2] ?? ""),
	);
}

type Mount = { readonly name: string; file: string; source: string };

/** Forms the scan is known to catch — the controls. */
const CAUGHT: readonly Mount[] = [
	{
		name: "the live mount, absolute barrel specifier",
		file: "src/app/(auth)/layout.tsx",
		source: 'import { WarliHero } from "@/components/art/warli";',
	},
	{
		name: "absolute, straight at the file behind the barrel",
		file: "src/app/(public)/layout.tsx",
		source: 'import { WarliHero } from "@/components/art/warli/hero";',
	},
	{
		name: "dynamic import(), absolute",
		file: "src/app/(public)/layout.tsx",
		source:
			'const W = dynamic(() => import("@/components/art/warli"), { ssr: false });',
	},
	{
		name: "deep-relative from src/app",
		file: "src/app/(public)/layout.tsx",
		source: 'import { WarliHero } from "../../components/art/warli";',
	},
	{
		name: "re-export barrel, absolute",
		file: "src/components/backdrop/index.ts",
		source: 'export { WarliHero } from "@/components/art/warli";',
	},
];

/**
 * Forms that reach the art layer and that the scan does NOT see. Every one is a
 * live second mount with the pin still green.
 */
const EVADES_SIBLING_RELATIVE: readonly Mount[] = [
	{
		name: "sibling-relative, from another component family",
		file: "src/components/shell/AuthBackdrop.tsx",
		source: 'import { WarliHero } from "../art/warli";',
	},
	{
		name: "sibling-relative, straight at hero.tsx",
		file: "src/components/debate/DebateBackdrop.tsx",
		source: 'import { WarliHero } from "../art/warli/hero";',
	},
];

const EVADES_CHILD_RELATIVE: readonly Mount[] = [
	{
		name: "child-relative, from a file sitting directly in src/components",
		file: "src/components/PageBackdrop.tsx",
		source: 'import { WarliHero } from "./art/warli";',
	},
	{
		name: "child-relative re-export — a barrel that is itself imported",
		file: "src/components/PageBackdrop.tsx",
		source: 'export * from "./art/warli";',
	},
];

const EVADES_TEMPLATE_LITERAL: readonly Mount[] = [
	{
		name: "dynamic import() written with a template literal",
		file: "src/app/(public)/layout.tsx",
		source: "const W = dynamic(() => import(`@/components/art/warli`));",
	},
];

describe("art-mount-scan — the detector under audit is the shipped one", () => {
	it("art-mount-scan::lifts-the-live-detector-from-the-guard", () => {
		// Extraction throws on failure, so reaching here proves a pattern was
		// found. This asserts it is the RIGHT one: it must agree with the guard
		// on the mount that is actually in the tree.
		const layout = readFileSync(
			join(ROOT, "src/app/(auth)/layout.tsx"),
			"utf8",
		);
		expect(scanFlags("src/app/(auth)/layout.tsx", layout)).toBe(true);
		// ⚠ NOTHING HERE PINS THE PATTERN'S TEXT. A first draft asserted
		// `SCAN.source` contained "components", which is fencing on a fragment of
		// the very thing this file asks to be rewritten — it went red against the
		// candidate fix while the fix was working. O-8: fence by role, never by a
		// piece of the string. With the detector shared rather than lifted there is
		// no text left to fence on at all, which is the stronger form of the same
		// discipline.
		expect(SPECIFIER.flags).toContain("g"); // matchAll requires it
	});

	it("art-mount-scan::the-oracle-and-the-scan-agree-on-every-known-form", () => {
		for (const row of CAUGHT) {
			expect(
				reallyImportsArtLayer(row.file, row.source),
				`oracle: ${row.name}`,
			).toBe(true);
			expect(scanFlags(row.file, row.source), `scan: ${row.name}`).toBe(true);
		}
	});

	it("art-mount-scan::flags-nothing-that-does-not-reach-the-art-layer", () => {
		// The other half of a detector's job. Without this row, "flag everything"
		// would satisfy every assertion below it.
		const innocent: readonly Mount[] = [
			{
				name: "a shell import",
				file: "src/app/(auth)/layout.tsx",
				source:
					'import { GlobalHeader } from "@/components/shell/GlobalHeader";',
			},
			{
				name: "a sibling in the same family",
				file: "src/components/debate/DebateView.tsx",
				source: 'import { ReplyCard } from "./ReplyCard";',
			},
			{
				name: "a bare npm specifier",
				file: "src/components/shell/GlobalHeader.tsx",
				source: 'import { useState } from "react";',
			},
		];
		for (const row of innocent) {
			expect(
				reallyImportsArtLayer(row.file, row.source),
				`oracle: ${row.name}`,
			).toBe(false);
			expect(scanFlags(row.file, row.source), `scan: ${row.name}`).toBe(false);
		}
	});
});

describe("art-mount-scan — a second mount must not be able to hide", () => {
	/**
	 * ⛔ RED BY DESIGN. `../art/warli` from `src/components/<family>/` resolves
	 * into the art layer and mounts the whole 790 KB drawing; its TEXT carries no
	 * `components/art`, so the pin stays green at exactly one site while two
	 * exist. This is the highest-realism evasion of the set — sibling-relative is
	 * how this codebase already writes a neighbour import in 118 files.
	 */
	it("art-mount-scan::sees-a-sibling-relative-second-mount", () => {
		for (const row of EVADES_SIBLING_RELATIVE) {
			expect(
				reallyImportsArtLayer(row.file, row.source),
				`oracle must call this a mount: ${row.name}`,
			).toBe(true);
			expect(
				scanFlags(row.file, row.source),
				`${row.name} — ${row.file} really mounts the art layer and the pin cannot see it`,
			).toBe(true);
		}
	});

	/**
	 * ⛔ RED BY DESIGN. Same defect one directory shallower, and the second row is
	 * the re-export chain: a barrel that is itself imported mounts the layer
	 * transitively, and the barrel's own specifier is what the scan had to catch.
	 */
	it("art-mount-scan::sees-a-child-relative-mount-or-re-export", () => {
		for (const row of EVADES_CHILD_RELATIVE) {
			expect(
				reallyImportsArtLayer(row.file, row.source),
				`oracle must call this a mount: ${row.name}`,
			).toBe(true);
			expect(
				scanFlags(row.file, row.source),
				`${row.name} — ${row.file} really mounts the art layer and the pin cannot see it`,
			).toBe(true);
		}
	});

	/**
	 * ⛔ RED BY DESIGN, and the lowest-realism of the three. The detector's quote
	 * class is `["']`; a backtick specifier is outside it. `import()` is the form
	 * a contributor reaches for when the artwork is meant to load lazily, which is
	 * a plausible thing to want for a 790 KB drawing.
	 */
	it("art-mount-scan::sees-a-template-literal-dynamic-import", () => {
		for (const row of EVADES_TEMPLATE_LITERAL) {
			expect(
				reallyImportsArtLayer(row.file, row.source),
				`oracle must call this a mount: ${row.name}`,
			).toBe(true);
			expect(
				scanFlags(row.file, row.source),
				`${row.name} — ${row.file} really mounts the art layer and the pin cannot see it`,
			).toBe(true);
		}
	});
});
