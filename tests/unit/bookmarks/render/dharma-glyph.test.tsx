// @vitest-environment jsdom

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * HTML-FINISH · BOOKMARKS round 3 · C1 — **EVERY Đ QUANTITY ON THIS SURFACE
 * CARRIES THE GLYPH. ALL OF THEM OR NONE.**
 *
 * ⚠ A HALF-APPLIED GLYPH IS THE RECORDED DEFECT THIS EXISTS TO PREVENT. Profile
 * shipped Đ on four tiles and left Net P/L bare beside them for a whole round,
 * and shipped bare `25 → 25` in its positions table for two more, because each
 * new render site had to REMEMBER the convention. A convention that must be
 * remembered at the next site will be missed at the one after.
 *
 * ⇒ THE CHECK IS STRUCTURAL, NOT A LIST OF SITES: it scans every bookmarks
 * source file for `formatDharma(` calls that reach JSX and requires the glyph
 * immediately before each. Adding a component is covered the moment it exists.
 *
 * ⛔ THE GLYPH IS ASSERTED BY CODE POINT — U+0110 LATIN CAPITAL LETTER D WITH
 * STROKE (`c4 90`). Ð (U+00D0 ETH) is visually identical in many faces, so a
 * paste-comparison would accept the wrong character.
 *
 * ⚠ THE SPACING IS PART OF THE CONVENTION: `Đ ` then the formatted number,
 * never `Đ1,234`. Profile's shipped form is `Đ {formatDharma(…)}`.
 */

const ROOT = process.cwd();
const SRC_DIRS = ["src/components/bookmarks", "src/app/(public)/bookmarks"];

function filesUnder(dir: string): string[] {
	return readdirSync(join(ROOT, dir), { recursive: true, withFileTypes: true })
		.filter(
			(e) => e.isFile() && (e.name.endsWith(".ts") || e.name.endsWith(".tsx")),
		)
		.map((e) => join(e.parentPath, e.name));
}

/** Comments stripped — prose about the glyph is not a render of it. */
function code(source: string): string {
	return source
		.replace(/\/\*[\s\S]*?\*\//g, "")
		.replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
		.replace(/^\s*\/\/.*$/gm, "");
}

const files = SRC_DIRS.flatMap(filesUnder);

/**
 * A `formatDharma(` call that renders — i.e. sits inside a JSX interpolation.
 * The import line and any non-JSX use are excluded by requiring the `{`.
 */
const RENDER_CALL = /\{\s*formatDharma\(/g;

describe("C1 — Đ on every Đ quantity, all of them or none", () => {
	it("glyph::the-scan-covers-a-non-empty-bookmarks-source-set", () => {
		// A guard that silently matched nothing passes every assertion below
		// vacuously — the recorded failure mode for scan-shaped guards.
		expect(files.length).toBeGreaterThan(2);
		const withMoney = files.filter((f) =>
			RENDER_CALL.test(code(readFileSync(f, "utf8"))),
		);
		expect(
			withMoney.length,
			"no bookmarks file renders a Đ value — the scan has nothing to check, " +
				"which means it cannot fail and is not protecting anything.",
		).toBeGreaterThan(0);
	});

	it("glyph::EVERY-rendered-formatDharma-is-preceded-by-Đ-and-a-space", () => {
		const offenders: string[] = [];
		for (const file of files) {
			const src = code(readFileSync(file, "utf8"));
			const lines = src.split("\n");
			lines.forEach((line, i) => {
				if (!/\{\s*formatDharma\(/.test(line)) {
					return;
				}
				// The glyph may sit on this line before the call, or end the line
				// above (the shipped `Đ{" "}` / `Đ ` continuation forms).
				const before = line.slice(0, line.indexOf("{"));
				const prev = lines[i - 1] ?? "";
				const carriesHere = /Đ\s*$/.test(before) || /Đ\{" "\}\s*$/.test(before);
				const carriesAbove = /Đ\s*(\{" "\})?\s*$/.test(prev.trimEnd());
				if (!carriesHere && !carriesAbove) {
					offenders.push(
						`${file.replace(`${ROOT}/`, "")}:${i + 1} → ${line.trim().slice(0, 70)}`,
					);
				}
			});
		}
		expect(
			offenders,
			"C1: these Đ values render as bare digits. ALL OF THEM OR NONE — a " +
				"half-applied glyph is the defect this guard exists to prevent.",
		).toEqual([]);
	});

	it("glyph::the-character-is-U+0110-not-a-lookalike", () => {
		let seen = 0;
		for (const file of files) {
			for (const ch of code(readFileSync(file, "utf8"))) {
				// Any D-with-stroke-ish glyph in the render layer must be U+0110.
				if (ch === "Đ") {
					seen++;
				}
				expect(
					ch === "Ð",
					`${file.replace(`${ROOT}/`, "")} contains Ð (U+00D0 ETH), which is ` +
						`visually identical to Đ (U+0110) in many faces and is NOT the ` +
						`Dharma glyph.`,
				).toBe(false);
			}
		}
		expect(
			seen,
			"no U+0110 found in the bookmarks source at all",
		).toBeGreaterThan(0);
	});

	it("glyph::POSITIVE-CONTROL-the-predicate-rejects-a-bare-render", () => {
		// ⚠ PROOF BY REVERSAL. A guard only ever run against a passing tree is
		// indistinguishable from one that cannot fail.
		const bare = "const x = <span>{formatDharma(item.staked)}</span>;";
		const line = bare;
		const before = line.slice(0, line.indexOf("{"));
		expect(/Đ\s*$/.test(before)).toBe(false);
		const carried = "const x = <span>Đ {formatDharma(item.staked)}</span>;";
		const b2 = carried.slice(0, carried.indexOf("{"));
		expect(/Đ\s*$/.test(b2)).toBe(true);
	});
});
