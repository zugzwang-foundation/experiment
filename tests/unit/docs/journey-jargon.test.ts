import { describe, expect, it } from "vitest";
import { parseBridges, parseEntries } from "./_journey-entries";

/**
 * NO JOURNEY PROSE CARRIES THE PROJECT'S OWN SHORTHAND.
 *
 * No task code, no decision-record number, no spec section mark, no register
 * reference, no file path or filename, no pull-request number, no commit hash
 * (style spec §7). A drifting session reaches for all of these because they are
 * the nearest TRUE thing to say — which is exactly why the rule needs a machine
 * behind it. The prose has one job: survive being read by somebody who has
 * never seen this repository. A sentence that needs a decision-record number to
 * make sense has already failed at that, and the failure is invisible to the
 * person writing it, because to them the shorthand reads as precision.
 *
 * ⚠ THE MONO LINE IS EXEMPT AND MUST BE. It is the real commit subject, and
 * real commit subjects here are full of exactly these tokens — 253 of them
 * would trip these patterns. That is the whole design: all technical language
 * lives on that one line, so the prose can be free of it. A guard that scanned
 * the mono line too would be unsatisfiable and would be deleted within a week.
 *
 * ⚠ SCOPE IS EVERY LINE A READER MEETS EXCEPT THAT ONE: prose, table cells,
 * entry TITLES, and the BRIDGE at the head of each act. The bridge is 1,887
 * words of prose across eight written bridges — Act I has none — and was scanned
 * by nothing until a review planted four tokens in one and watched all sixteen
 * tests pass. It is also the region
 * most likely to leak, by construction — §11 asks a bridge to say where the
 * project is and name what is about to break, which is connective, meta work,
 * and unlike an entry it has no mono line to park technical language on.
 *
 * ⚠ THE PATTERNS ARE CALIBRATED AGAINST THE WHOLE CORPUS, NOT INVENTED. Every
 * one was run over every scanned line of every entry, every title and every
 * bridge and returned zero hits, and each is paired below with the token class
 * it must catch. False positives were designed out rather than tolerated:
 * "Washington, D.C." tripped a task-code pattern that only wanted capitals and
 * a separator; "and/or" and then "plan/execute/log" tripped path patterns that
 * only wanted slashes; "defaced" trips a bare hex-run pattern, which is why the
 * hash pattern also requires a digit. A guard that reddens on correct prose
 * gets suppressed, and a suppressed guard catches nothing.
 */

/** Repository roots. A path is shorthand; `plan/execute/log` is English. */
const ROOTS =
	"(?:src|docs|tests|scripts|drizzle|supabase|public|\\.github|node_modules)";
const EXT = "(?:md|ts|tsx|js|jsx|sql|json|css|yml|yaml|txt|sh|toml|lock)";

/**
 * A task, decision or register reference with a number on the end:
 * `CHART-3`, `ADR-0045`, `S-4`, `HO-T4`, `ENGINE.10`, `AUDIT-FIX-B5`,
 * `POLISH-1a`, `INV-1`, `O-11`, `V-9`, `I-GENESIS-001`.
 * Requires the numeric tail, so `D.C.` and `U.S.` do not match.
 */
const TASK_NUMBERED =
	/\b[A-Z][A-Z0-9]*(?:[-.][A-Z0-9]+)*[-.][A-Z]?[0-9]+[a-z]?\b/;

/**
 * A hyphenated all-caps lane name with no number: `WARLI-MOUNT`,
 * `STAGING-PARITY`, `AUDIT-FIX`. Each segment needs two or more letters, which
 * is what keeps initialisms like `D.C.` out.
 */
const TASK_ALLCAPS = /\b[A-Z]{2,}(?:-[A-Z]{2,})+\b/;

/** A spec or contract section mark. */
const SECTION_MARK = /§/;

/**
 * A path rooted in this repository: `src/server`, `docs/adr`,
 * `tests/unit/docs/`, `drizzle/migrations`. Deliberately NOT "two things with a
 * slash between them" — that reddens on `plan/execute/log`, which is the style
 * spec's own phrase, and on `approve/discard/block`, `he/she/they` and
 * `23/07/2026`.
 */
const REPO_PATH = new RegExp(`\\b${ROOTS}/[\\w./-]+`);

/** A filename, with or without a directory: `CLAUDE.md`, `docs/parked.md`, `0003_x.sql`. */
const FILE_NAME = new RegExp(`\\b[\\w-]+(?:/[\\w-]+)*\\.${EXT}\\b`);

/** A pull-request or issue reference. Two digits or more, so `#1` in prose survives. */
const PR_REF = /#\d{2,}/;

/**
 * A short commit hash. Requires at least one digit, because `defaced` and
 * `effaced` are seven characters drawn from the same alphabet and are English.
 */
const SHORT_SHA = /\b(?=[0-9a-f]{7,40}\b)(?=[0-9a-f]*\d)[0-9a-f]{7,40}\b/;

const PATTERNS: ReadonlyArray<readonly [string, RegExp]> = [
	["task code with a number", TASK_NUMBERED],
	["all-caps lane name", TASK_ALLCAPS],
	["spec section mark", SECTION_MARK],
	["repository path", REPO_PATH],
	["filename", FILE_NAME],
	["pull-request reference", PR_REF],
	["commit hash", SHORT_SHA],
];

/** Strings each pattern MUST catch — the control that proves it can fire. */
const MUST_CATCH: ReadonlyArray<readonly [string, string]> = [
	["task code with a number", "CHART-3 landed on the first"],
	["task code with a number", "recorded at ADR-0045 for later"],
	["task code with a number", "the S-4 lane closed"],
	["task code with a number", "O-11 says the report is a file"],
	["task code with a number", "ENGINE.10 measured it"],
	["all-caps lane name", "WARLI-MOUNT hung the artwork"],
	["all-caps lane name", "STAGING-PARITY built the fixtures"],
	["spec section mark", "the rule lives at §7.2"],
	["repository path", "everything under src/server"],
	["repository path", "it lives in docs/journey/README.md"],
	["repository path", "scoped by directory across tests/unit/docs/"],
	["filename", "the rule was already in CLAUDE.md"],
	["filename", "0003_append_only_triggers.sql applies it"],
	["pull-request reference", "it landed in #465"],
	["commit hash", "on commit ead7415, right after"],
];

/**
 * Ordinary prose that must NOT trip anything. Every line here broke an earlier
 * draft of the patterns.
 */
const MUST_PASS: readonly string[] = [
	"The app went to Washington, D.C. — because nobody typed a line saying otherwise.",
	"Black means YES and white means NO, and that is the whole visual language.",
	"It reported sixty frames a second either way, and 60 was the wrong answer twice.",
	"Whether it was one thing and/or the other was never written down.",
	"A two-thirds majority, in week 19, on a 50/50 split.",
	"The plan/execute/log rhythm ran all summer, and approve/discard/block was the menu.",
	"A defaced wall, effaced entirely, decade after decade.",
];

/**
 * Shorthand classes deliberately OUT of scope, recorded so the boundary is a
 * decision somebody made rather than a gap nobody noticed:
 *   · bare acronyms with no separator — CPMM, RLS, PFP, OTP. They read as
 *     ordinary capitalised words and a pattern for them would redden on YES/NO.
 *   · a section spelled out in words — "section seven point two".
 *   · a seven-character hex run with no digit — `defaced`, `effaced`. A real
 *     hash avoids one about 0.1% of the time; English does not.
 */
const KNOWN_UNCAUGHT = [
	"bare acronyms (CPMM, RLS)",
	"sections spelled out in words",
	"all-letter hex runs (defaced)",
] as const;

describe("journey entries — no shorthand in prose", () => {
	const entries = parseEntries();
	const bridges = parseBridges();

	it("each pattern catches the token class it names (controls)", () => {
		for (const [name, sample] of MUST_CATCH) {
			const pattern = PATTERNS.find(([n]) => n === name)?.[1];
			expect(pattern, `no pattern named ${name}`).toBeDefined();
			expect(
				pattern?.test(sample),
				`pattern "${name}" failed to catch ${JSON.stringify(sample)} — it cannot fire, so it proves nothing about the corpus`,
			).toBe(true);
		}
		// every pattern is exercised by at least one control
		for (const [name] of PATTERNS) {
			expect(
				MUST_CATCH.some(([n]) => n === name),
				`pattern "${name}" has no control and could be dead`,
			).toBe(true);
		}
		expect(KNOWN_UNCAUGHT.length).toBeGreaterThan(0);
	});

	it("no pattern reddens on ordinary prose (negative controls)", () => {
		for (const sample of MUST_PASS) {
			for (const [name, pattern] of PATTERNS) {
				expect(
					pattern.test(sample),
					`pattern "${name}" reddened on correct prose: ${JSON.stringify(sample)}`,
				).toBe(false);
			}
		}
	});

	it("scans a non-empty corpus, its titles and its bridges (control)", () => {
		expect(entries.length).toBeGreaterThan(400);
		expect(entries.flatMap((e) => e.visible).length).toBeGreaterThan(600);
		expect(bridges.length).toBe(9);
		// eight are written; Act I has none, by record.
		expect(bridges.filter((b) => b.words > 0).length).toBe(8);
		expect(bridges.reduce((n, b) => n + b.words, 0)).toBeGreaterThan(1500);
	});

	it("no entry's prose, table or title carries shorthand", () => {
		const hits: string[] = [];
		for (const e of entries) {
			for (const line of [e.title, ...e.visible]) {
				for (const [name, pattern] of PATTERNS) {
					const m = pattern.exec(line);
					if (m) {
						hits.push(
							`${e.file}:${e.line} ${e.title} — ${name} ${JSON.stringify(m[0])} in: ${line.trim().slice(0, 90)}`,
						);
					}
				}
			}
		}
		expect(hits, `shorthand found in entry prose:\n${hits.join("\n")}`).toEqual(
			[],
		);
	});

	it("no bridge carries shorthand", () => {
		const hits: string[] = [];
		for (const b of bridges) {
			for (const line of b.lines) {
				for (const [name, pattern] of PATTERNS) {
					const m = pattern.exec(line);
					if (m) {
						hits.push(
							`${b.file} bridge — ${name} ${JSON.stringify(m[0])} in: ${line.trim().slice(0, 90)}`,
						);
					}
				}
			}
		}
		expect(hits, `shorthand found in a bridge:\n${hits.join("\n")}`).toEqual(
			[],
		);
	});
});
