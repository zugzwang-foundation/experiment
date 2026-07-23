import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Static regression guard (DROUND / SPEC.1 §10.8): every Đ value rendered to a
// user goes through the single shared ROUNDING display formatter — `formatDharma`
// or `formatDharmaGrouped`. This guard fails if a money value is rendered raw in
// JSX, or if the EXACT (unrounded) `formatDharmaExact` escape hatch is used in a
// view component anywhere but the ONE dround-allowed sell-module input seed.
//
// Modelled on tests/unit/design/no-raw-hex-view-layer.test.ts, with three
// deliberate differences: (i) it keys on MONEY IDENTIFIERS, not the Đ glyph —
// the profile tiles and positions table render Đ values with no glyph; (ii) it
// ALSO scans src/app/(admin) — the historical raw offender (ReviewFeed) lives
// there, and the hex guard does not scan it; (iii) it allowlists EXACTLY ONE
// line, by the `dround-allow:` marker comment (the sell seed, SPEC.1 §10.8).

const ROOT = process.cwd();
const SCAN_DIRS = ["src/components", "src/app/(public)", "src/app/(admin)"];

// The formatter module DEFINES `formatDharmaExact` and uses it internally (the
// malformed-input fallback) — scanning it for its own name is noise, not a leak.
const FORMATTER_MODULE = "src/components/debate/format.ts";

// Đ-currency field names. A JSX interpolation of one of these — as a bare
// member/identifier expression, not wrapped in a rounding formatter — is a raw
// Đ render. (`current`/`stake`/`balance` also name React refs / non-Đ props, but
// those appear in statements/attributes, never as bare JSX child interpolations.)
const MONEY_IDS = [
	"walletValue",
	"positionsValue",
	"netProfitLoss",
	"balanceAfter",
	"balance",
	"spendableToday",
	"staked",
	"currentValue",
	"current",
	"authorStake",
	"stake",
	"supportDharma",
	"counterDharma",
	"dharmaStaked",
	"proceeds",
	"authorDharma",
];

// A JSX-child interpolation `{ chain.moneyId }` (or bare `{ moneyId }`) whose `{`
// is NOT an attribute value (`name={…}`) and whose content is a pure member
// expression ending in a money id — i.e. NOT wrapped in `formatDharma(…)` /
// `formatDharmaGrouped(…)`, which always introduce a `(` that breaks the run.
const RAW_RENDER = new RegExp(
	`(?<!=)\\{\\s*[\\w.]*\\b(?:${MONEY_IDS.join("|")})\\b\\s*\\}`,
);

const EXACT_CALL = /formatDharmaExact\s*\(/;
const ALLOW_MARKER = /dround-allow:/;

function tsxFilesUnder(dir: string): string[] {
	return readdirSync(join(ROOT, dir), { recursive: true, withFileTypes: true })
		.filter(
			(e) => e.isFile() && (e.name.endsWith(".ts") || e.name.endsWith(".tsx")),
		)
		.map((e) => join(e.parentPath, e.name));
}

function stripComments(source: string): string {
	return source
		.replace(/\/\*[\s\S]*?\*\//g, "")
		.replace(/^\s*\/\/.*$/gm, "")
		.replace(/\/\/[^"'`\n]*$/gm, "");
}

const files = SCAN_DIRS.flatMap(tsxFilesUnder);

describe("view layer — no raw Đ render, one allowlisted seed (DROUND)", () => {
	it("scans a non-empty view-layer file set (guard is alive)", () => {
		expect(files.length).toBeGreaterThan(20);
	});

	it("renders no money identifier raw (unwrapped) in JSX", () => {
		const offenders = files
			.map((file) => {
				const match = stripComments(readFileSync(file, "utf8")).match(
					RAW_RENDER,
				);
				return match
					? `${file.replace(`${ROOT}/`, "")} → ${match[0].trim()}`
					: null;
			})
			.filter((hit): hit is string => hit !== null);
		expect(offenders).toEqual([]);
	});

	it("uses formatDharmaExact only at the ONE dround-allowed seed", () => {
		const markers: string[] = [];
		const offenders: string[] = [];
		for (const file of files) {
			if (file.endsWith(FORMATTER_MODULE)) {
				continue;
			}
			const lines = readFileSync(file, "utf8").split("\n");
			lines.forEach((line, i) => {
				if (ALLOW_MARKER.test(line)) {
					markers.push(`${file.replace(`${ROOT}/`, "")}:${i + 1}`);
				}
				if (EXACT_CALL.test(line)) {
					// Allowlisted iff a `dround-allow:` marker sits in the preceding
					// lines (the marker annotates the statement it precedes).
					const window = lines.slice(Math.max(0, i - 5), i + 1).join("\n");
					if (!ALLOW_MARKER.test(window)) {
						offenders.push(`${file.replace(`${ROOT}/`, "")}:${i + 1}`);
					}
				}
			});
		}
		// EXACTLY one dround-allow marker exists, and no un-allowlisted Exact call.
		expect(markers).toHaveLength(1);
		expect(offenders).toEqual([]);
	});
});
