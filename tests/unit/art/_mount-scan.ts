// SPDX-License-Identifier: AGPL-3.0-or-later

import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

/**
 * The art layer's INBOUND mount detector — one definition, imported by both the
 * guard that pins the mount site and the audit that attacks it.
 *
 * ⛔ IT LIVES HERE BECAUSE A TEXT-LIFT IS NOT A SHARED DEFINITION.
 * `mount-scan-reach.test.ts` originally located the detector by finding the one
 * inline `/…/.test(` literal in the guard's source. That works only while the
 * detector IS a literal: the moment it became a resolving function — which is
 * the fix the audit itself was written to force — the lift found zero and the
 * audit died at collection. A module both files import cannot go stale and
 * cannot be re-pointed at the wrong thing.
 */

const ROOT = process.cwd();
export const ART_DIR = "src/components/art";
const ART_ABS = join(ROOT, ART_DIR);

/**
 * Every import/require specifier in a source text.
 *
 * ⚠ THE QUOTE CLASS INCLUDES A BACKTICK. `` import(`@/components/art/warli`) ``
 * is valid, is what a template-literal specifier looks like, and a `["']`-only
 * class walks straight past it.
 */
export const SPECIFIER =
	/(?:\bfrom|\bimport|\brequire)\s*\(?\s*(["'`])([^"'`]+)\1/g;

/** True when `abs` is the art directory or a path inside it. */
const under = (abs: string): boolean =>
	abs === ART_ABS || abs.startsWith(`${ART_ABS}/`);

/**
 * Does a specifier, written in `file`, actually REACH the art layer?
 *
 * ⛔ RESOLVED, NOT SUBSTRING-MATCHED, and the substring form was a live hole.
 * It flagged a specifier whose TEXT contained `components/art` — the same
 * question as "does it reach the art layer" only for `@/…` and for deep-relative
 * paths written from `src/app`. From a file already under `src/components`, the
 * idiomatic specifier for a neighbour is `../art/warli`, which contains no
 * `components/` at all. Measured: 118 files under `src/` already import a
 * neighbour that way, so it is this codebase's house style rather than a
 * contrived form.
 *
 * ⚠ AND A PREFIX TEST IS NOT A PATH TEST. `src/components/artifacts/x` starts
 * with `src/components/art` and is a different directory; the boundary check in
 * `under` is what keeps that from being both a false positive here and a silent
 * exclusion from the scan.
 */
export function reachesArt(file: string, spec: string): boolean {
	if (spec.startsWith("@/")) {
		return under(join(ROOT, "src", spec.slice(2)));
	}
	if (!spec.startsWith(".")) {
		return false;
	}
	return under(join(ROOT, dirname(file), spec));
}

export function sourceFilesUnder(dir: string): readonly string[] {
	return readdirSync(join(ROOT, dir), { recursive: true, withFileTypes: true })
		.filter(
			(entry) =>
				entry.isFile() &&
				(entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")),
		)
		.map((entry) => join(entry.parentPath, entry.name).replace(`${ROOT}/`, ""));
}

/** Verbatim from `tests/unit/design/no-raw-hex-view-layer.test.ts`. */
export function stripComments(source: string): string {
	return source
		.replace(/\/\*[\s\S]*?\*\//g, "")
		.replace(/^\s*\/\/.*$/gm, "")
		.replace(/\/\/[^"'`\n]*$/gm, "");
}

/** Every file outside the art layer that imports something inside it. */
export function artImporters(): string[] {
	return sourceFilesUnder("src")
		.filter((file) => !under(join(ROOT, file)))
		.filter((file) =>
			[
				...stripComments(readFileSync(join(ROOT, file), "utf8")).matchAll(
					SPECIFIER,
				),
			].some((m) => reachesArt(file, m[2] ?? "")),
		);
}
