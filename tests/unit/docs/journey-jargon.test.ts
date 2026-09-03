import { describe, expect, it } from "vitest";
import { parseEntries } from "./_journey-entries";

/**
 * NO JOURNEY PROSE LINE CARRIES THE PROJECT'S OWN SHORTHAND.
 *
 * No task code, no decision-record number, no spec section mark, no register
 * reference, no file path (style spec §7). A drifting session reaches for all
 * of these because they are the nearest TRUE thing to say — which is exactly
 * why the rule needs a machine behind it. The prose has one job: survive being
 * read by somebody who has never seen this repository. A sentence that needs a
 * decision-record number to make sense has already failed at that, and the
 * failure is invisible to the person writing it, because to them the shorthand
 * reads as precision.
 *
 * ⚠ THE MONO LINE IS EXEMPT AND MUST BE. It is the real commit subject, and
 * real commit subjects in this repository are full of exactly these tokens.
 * That is the whole design: all technical language lives on that one line, so
 * the prose can be free of it. A guard that scanned the mono line too would be
 * unsatisfiable and would be deleted within a week.
 *
 * ⚠ TABLE ROWS ARE SCANNED. A visual is something the reader reads, so
 * shorthand smuggled into a table cell is the same defect in a smaller box.
 *
 * ⚠ THE PATTERNS ARE CALIBRATED AGAINST THE WHOLE EXISTING CORPUS, NOT
 * INVENTED. Every one was run over all 504 prose lines of the 341 entries
 * standing when this landed and returned zero hits, and each is paired below
 * with the token class it must catch. Two false positives were found that way
 * and designed out rather than tolerated: "Washington, D.C." tripped a
 * task-code pattern that only required capitals and a separator, and "and/or"
 * tripped a path pattern that only required a slash. A guard that reddens on
 * correct prose gets suppressed, and a suppressed guard catches nothing.
 */

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
 * A file path: two or more slash-separated segments, or one slash and a source
 * extension. Deliberately NOT "contains a slash" — that reddens on `and/or`,
 * `he/she`, `YES/NO` and `50/50`, all of which are ordinary English here.
 */
const FILE_PATH =
	/(?:[\w.-]+\/){2,}[\w.-]*|\b[\w-]+\/[\w-]+\.(?:md|ts|tsx|sql|json|css|yml|yaml|js|txt)\b/;

const PATTERNS: ReadonlyArray<readonly [string, RegExp]> = [
	["task code with a number", TASK_NUMBERED],
	["all-caps lane name", TASK_ALLCAPS],
	["spec section mark", SECTION_MARK],
	["file path", FILE_PATH],
];

/** Strings each pattern MUST catch — the control that proves it can fire. */
const MUST_CATCH: ReadonlyArray<readonly [string, string]> = [
	["task code with a number", "CHART-3 landed on the first"],
	["task code with a number", "recorded at ADR-0045 for later"],
	["task code with a number", "the S-4 lane closed"],
	["task code with a number", "O-11 says the report is a file"],
	["task code with a number", "ENGINE.10 measured it"],
	["task code with a number", "POLISH-1a corrected the header"],
	["all-caps lane name", "WARLI-MOUNT hung the artwork"],
	["all-caps lane name", "STAGING-PARITY built the fixtures"],
	["spec section mark", "the rule lives at §7.2"],
	["file path", "it lives in docs/journey/README.md"],
	["file path", "everything under src/server/bets/"],
];

/** Ordinary prose that must NOT trip anything. */
const MUST_PASS: readonly string[] = [
	"The app went to Washington, D.C. — because nobody typed a line saying otherwise.",
	"Black means YES and white means NO, and that is the whole visual language.",
	"It reported sixty frames a second either way, and 60 was the wrong answer twice.",
	"Whether it was one thing and/or the other was never written down.",
	"A two-thirds majority, in week 19, on a 50/50 split.",
];

describe("journey entries — no shorthand in prose", () => {
	const entries = parseEntries();

	it("each pattern catches the token class it names (controls)", () => {
		for (const [name, sample] of MUST_CATCH) {
			const pattern = PATTERNS.find(([n]) => n === name)?.[1];
			expect(pattern, `no pattern named ${name}`).toBeDefined();
			expect(
				pattern?.test(sample),
				`pattern "${name}" failed to catch ${JSON.stringify(sample)} — it cannot fire, so it proves nothing about the corpus`,
			).toBe(true);
		}
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

	it("scans a non-empty corpus (control for the assertion below)", () => {
		const lines = entries.flatMap((e) => e.visible);
		expect(entries.length).toBeGreaterThan(300);
		expect(lines.length).toBeGreaterThan(400);
	});

	it("no entry's prose carries a task code, a record number, a section mark or a path", () => {
		const hits: string[] = [];
		for (const e of entries) {
			for (const line of e.visible) {
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
});
