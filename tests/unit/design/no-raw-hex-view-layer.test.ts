import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Static regression guard (UI.A1 §7): the participant view layer never
// carries a raw hex colour literal — every colour arrives through the
// globals.css token layer (`bg-yes`, `bg-n0`, `var(--hairline)`, …). A hex
// literal in a class string or style prop is the tell for a smuggled
// colour bypassing the frozen v0.4 contract. rgb()/rgba() stays ALLOWED —
// the ratified not-tokenized treatments arriving at A2+ (engaged-slot
// backlight, Support/Counter glows) are white/black-alpha rgb() values.
//
// Comments are stripped before matching: prose citing contract hex (e.g.
// "the #FAFAFA cells are chrome, R-4") is documentation, not a colour.
// (Trailing same-line comments are stripped only when no quote character
// follows the `//` — a `//` inside a string, e.g. an https:// URL, always
// has its closing quote after it and so is never eaten.)

const ROOT = process.cwd();
const SCAN_DIRS = ["src/components", "src/app/(public)"];
// Participant view files that live OUTSIDE the scanned dirs. The two root-level
// error boundaries sit at `src/app/` — outside `src/app/(public)` — but are
// participant surfaces all the same, and `global-error.tsx` in particular
// replaces the root layout and hand-rolls its own `<html>`/`<body>`, which is
// exactly where a smuggled literal would hide (SHELL-COMPLETE B10).
const SCAN_FILES = [
	"src/app/(auth)/layout.tsx",
	"src/app/not-found.tsx",
	"src/app/global-error.tsx",
	// The ROOT layout, enrolled at PRIMITIVES-1 C4(b) — the comment above
	// already argued for it and the file was not in the list. It hand-rolls the
	// real `<html>`/`<body>` on EVERY route (participant and admin alike), so a
	// smuggled literal here is the widest-reach colour bypass in the tree, and
	// it sat unscanned. Proven by reversal at P4.
	"src/app/layout.tsx",
];
// 8/6/4/3-digit forms, longest-first — alpha hex (#rrggbbaa/#rgba) is the
// likeliest smuggle spelling of the A2+ white/black-alpha treatments
// (@code-reviewer, UI.A1).
const HEX_LITERAL =
	/#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})\b/;

function tsxFilesUnder(dir: string): string[] {
	return readdirSync(join(ROOT, dir), {
		recursive: true,
		withFileTypes: true,
	})
		.filter(
			(entry) =>
				entry.isFile() &&
				(entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")),
		)
		.map((entry) => join(entry.parentPath, entry.name));
}

function stripComments(source: string): string {
	return source
		.replace(/\/\*[\s\S]*?\*\//g, "")
		.replace(/^\s*\/\/.*$/gm, "")
		.replace(/\/\/[^"'`\n]*$/gm, "");
}

describe("view layer — no raw hex colour literals", () => {
	const files = [
		...SCAN_DIRS.flatMap(tsxFilesUnder),
		...SCAN_FILES.map((f) => join(ROOT, f)),
	];

	it("scans a non-empty view-layer file set (guard is alive)", () => {
		expect(files.length).toBeGreaterThan(20);
	});

	it("finds no #rgb / #rrggbb literal outside comments", () => {
		const offenders = files
			.map((file) => {
				const match = stripComments(readFileSync(file, "utf8")).match(
					HEX_LITERAL,
				);
				return match ? `${file.replace(`${ROOT}/`, "")} → ${match[0]}` : null;
			})
			.filter((hit): hit is string => hit !== null);
		expect(offenders).toEqual([]);
	});
});
