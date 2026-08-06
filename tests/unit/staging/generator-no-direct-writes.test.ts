import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { FORBIDDEN_DIRECT_WRITE_TABLES } from "../../staging/_lib/write-guard";

// ═══════════════════════════════════════════════════════════════════════════
// ADR-0036 PRIMITIVE 4 — THE SOURCE TRIPWIRE
//
// The generator writes NO rows directly. Gate 1 asserts every `bets` row has a
// matching `bet.placed` event; if the GENERATOR could write both halves, gate 1
// would pass BECAUSE the generator wrote them. A verification satisfiable by
// the thing it verifies is not a verification (Ratification Record §5 W-G).
// This assertion is what keeps gate 1 non-vacuous, and it must not be
// simplified away in review.
//
// ── THIS IS THE WEAK FORM, AND IT IS DELIBERATELY THE SECOND CONTROL ────────
// Manifest §5: "a source match reads text ABOUT a file rather than what the
// file DOES, and it false-alarms on correct code" — QK-c proved it false-alarms
// on a pure reformat. So the STRONG control is behavioural and lives in
// `tests/staging/_lib/write-guard.ts`: it attributes every write the real run
// issues to its immediate caller and THROWS when that caller is under `tests/`.
// A third, structural control sits underneath both — `_lib/client.ts` hands the
// generator no write-capable handle at all.
//
// This file is the cheap tripwire that runs in CI on every PR, where the
// behavioural one cannot (it needs a database).
//
// ── THE FOUR CONTROLS MANIFEST §5 REQUIRES OF IT ────────────────────────────
//   1 POSITIVE CONTROL PER PATTERN — a negative assertion passes when its
//     pattern matches nothing, which is exactly what a rename produces.
//   2 NON-EMPTY FILE SET — a loop over an empty array asserts nothing.
//   3 WHITESPACE TOLERANCE — a needle dies the moment a formatter wraps a call.
//   4 MUTATION CONTROL AT AUTHORING TIME — a real `db.insert()` was added to
//     the generator, RED confirmed, reverted, GREEN confirmed. The verdict is
//     recorded in docs/logs/STAGING-PARITY-B.md.
// ═══════════════════════════════════════════════════════════════════════════

const STAGING_DIR = fileURLToPath(new URL("../../staging/", import.meta.url));

/**
 * Every `.ts` under `tests/staging/`, runners and helpers alike.
 *
 * Scoped to the WHOLE directory rather than the generator file, because a
 * direct write moved into a helper is the same defect wearing a different hat —
 * and `_lib/` is where it would go if anyone tried to make one look tidy.
 */
function collectSources(dir: string, acc: string[] = []): string[] {
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const full = `${dir}${entry.name}`;
		if (entry.isDirectory()) collectSources(`${full}/`, acc);
		else if (entry.name.endsWith(".ts")) acc.push(full);
	}
	return acc;
}

const FILES = collectSources(STAGING_DIR).sort();

/**
 * Blank out comments, preserving every character offset.
 *
 * LOAD-BEARING, not hygiene. The generator's header DISCUSSES `INSERT INTO` and
 * `.insert(` at length — it has to, since explaining the rule requires naming
 * what the rule forbids. A scan that did not strip comments would fail on the
 * documentation of the very property it is checking. The reset's
 * `runner-gating.test.ts` hit the same shape with `it(`.
 */
function stripComments(text: string): string {
	let out = "";
	let i = 0;
	while (i < text.length) {
		if (text.startsWith("//", i)) {
			const end = text.indexOf("\n", i);
			const stop = end === -1 ? text.length : end;
			out += " ".repeat(stop - i);
			i = stop;
		} else if (text.startsWith("/*", i)) {
			const end = text.indexOf("*/", i + 2);
			const stop = end === -1 ? text.length : end + 2;
			out += text.slice(i, stop).replace(/[^\n]/g, " ");
			i = stop;
		} else {
			out += text[i];
			i += 1;
		}
	}
	return out;
}

/** snake_case table name -> the camelCase drizzle binding it is imported as. */
function camel(table: string): string {
	return table.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
}

/**
 * The two patterns ADR-0036 primitive 4 names, per table.
 *
 * WHITESPACE TOLERANCE IS THE POINT (control 3). Biome wraps a long call across
 * lines the moment its arguments grow, so `.insert(bets)` becomes
 * `.insert(\n\t\tbets,\n\t)` on a reformat — and a literal `indexOf(".insert(bets)")`
 * would then match nothing and report clean. `\s*` everywhere a formatter can
 * insert a break, and a trailing-comma allowance.
 */
function patternsFor(table: string): { label: string; re: RegExp }[] {
	const binding = camel(table);
	return [
		{
			label: `INSERT INTO ${table}`,
			re: new RegExp(`insert\\s+into\\s+"?${table}"?\\b`, "i"),
		},
		{
			label: `.insert(${binding})`,
			re: new RegExp(`\\.\\s*insert\\s*\\(\\s*${binding}\\s*,?\\s*\\)`),
		},
	];
}

describe("the file set is real", () => {
	// CONTROL 2 — a loop over an empty array asserts nothing. If a directory
	// rename ever emptied this list, every per-file assertion below would pass
	// while examining zero bytes.
	it("finds the generator and its helpers", () => {
		expect(FILES.length).toBeGreaterThan(0);
		const names = FILES.map((f) => f.slice(STAGING_DIR.length));
		expect(names).toContain("generate.staging.test.ts");
		expect(names).toContain("fixtures.ts");
		expect(names.some((n) => n.startsWith("_lib/"))).toBe(true);
	});

	it("reads non-empty bodies", () => {
		for (const file of FILES) {
			expect({ file, empty: readFileSync(file, "utf8").length === 0 }).toEqual({
				file,
				empty: false,
			});
		}
	});

	it("covers every table the ADR names", () => {
		expect(FORBIDDEN_DIRECT_WRITE_TABLES).toEqual([
			"bets",
			"comments",
			"events",
			"dharma_ledger",
			"positions",
			"pools",
			"resolution_events",
			"payout_events",
			"mod_actions",
			"bet_receipts",
			// Bucket C, emits no event, and a direct insert would be two lines
			// shorter and look harmless — which is exactly why it is listed.
			"bookmarks",
		]);
	});
});

describe("every pattern actually matches something", () => {
	// CONTROL 1 — one positive control PER PATTERN. Without these the whole
	// suite is green when the matchers are broken, which is indistinguishable
	// from green when the code is clean.
	for (const table of FORBIDDEN_DIRECT_WRITE_TABLES) {
		const binding = camel(table);
		for (const { label, re } of patternsFor(table)) {
			it(`fires on a synthetic violation: ${label}`, () => {
				const violation = label.startsWith("INSERT")
					? `await client.unsafe("INSERT INTO ${table} (id) VALUES ($1)", [id]);`
					: `await db.insert(${binding}).values({});`;
				expect(violation).toMatch(re);
			});
		}
	}

	// CONTROL 3 — the reformat case, stated as its own assertion rather than
	// trusted to the regex. QK-c's finding was that a source match false-alarms
	// on a pure reformat; the mirror failure is a source match that goes SILENT
	// on one.
	it("survives a formatter wrapping the call across lines", () => {
		const wrapped = "await db\n\t.insert(\n\t\tbets,\n\t)\n\t.values({});";
		const { re } = patternsFor("bets")[1] as { re: RegExp };
		expect(wrapped).toMatch(re);
	});

	it("survives extra whitespace inside INSERT INTO", () => {
		const spaced = 'await client.unsafe(`INSERT   INTO\n  "events" (id)`);';
		const { re } = patternsFor("events")[0] as { re: RegExp };
		expect(spaced).toMatch(re);
	});

	it("does not fire on an unrelated table", () => {
		// The matchers are table-scoped; a legitimate write elsewhere must not
		// register, or the suite becomes noise and gets disabled.
		const benign = "await db.insert(someOtherTable).values({});";
		for (const table of FORBIDDEN_DIRECT_WRITE_TABLES) {
			for (const { re } of patternsFor(table)) {
				expect({ table, hit: re.test(benign) }).toEqual({ table, hit: false });
			}
		}
	});
});

describe("the comment stripper does work", () => {
	it("blanks comments without moving offsets", () => {
		const raw = readFileSync(`${STAGING_DIR}generate.staging.test.ts`, "utf8");
		const stripped = stripComments(raw);
		expect(stripped).toHaveLength(raw.length);
		// The generator's header genuinely names the forbidden patterns — proof
		// the stripper is doing work rather than matching nothing.
		expect(raw).toMatch(/^\s*\/\/.*INSERT INTO/m);
		expect(stripComments(raw)).not.toMatch(/^\s*\/\/.*INSERT INTO/m);
	});
});

describe("no operational runner writes a forbidden table directly", () => {
	for (const file of FILES) {
		const relative = file.slice(STAGING_DIR.length);
		const body = stripComments(readFileSync(file, "utf8"));

		for (const table of FORBIDDEN_DIRECT_WRITE_TABLES) {
			for (const { label, re } of patternsFor(table)) {
				it(`${relative} · no ${label}`, () => {
					expect({
						file: relative,
						pattern: label,
						hit: re.test(body),
					}).toEqual({ file: relative, pattern: label, hit: false });
				});
			}
		}
	}
});
