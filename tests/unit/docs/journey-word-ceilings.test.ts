import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
	actFiles,
	CEILINGS,
	EXPECTED_ACT_FILES,
	headingCountAcrossDir,
	journeyDir,
	parseBridges,
	parseEntries,
	type Tier,
} from "./_journey-entries";

/**
 * NO JOURNEY ENTRY EXCEEDS ITS TIER'S WORD CEILING.
 *
 * Landmark 200, Chapter 90, Groundwork 40 — ceilings, no floors (style spec
 * §3).
 *
 * ⚠ THIS GUARD CATCHES BREACH. IT CANNOT CATCH INFLATION, AND AN EARLIER
 * VERSION OF THIS DOCBLOCK CLAIMED IT DID. The distinction is not academic and
 * it was found by measurement, not argument: the act written by the first
 * unattended pass came out with 65 Chapters averaging 86 words against 67 for
 * the 118 Chapters written before it, 41 of them within three words of the
 * ceiling and 19 sitting at exactly 89 or 90 — against ONE entry above 87 in
 * the whole of the preceding seven acts. Every one of those was green here,
 * correctly, because none of them breached. **A ceiling measures the line, not
 * the distribution underneath it**, and writing to the budget is what a drafter
 * with no reader does. The repair for that is editorial, and it was made; this
 * test is not the thing that would have caught it, and it should not claim to
 * be.
 *
 * ⚠ THE CEILING CANNOT BE CHECKED WITHOUT A TIER, WHICH IS WHY THE MARKER IS
 * ASSERTED FIRST AND SEPARATELY. Before this landed, a Landmark and a
 * Groundwork entry were indistinguishable by reading — no marker, no class, no
 * ordering, no formatting difference. A ceiling guard over unmarked entries has
 * two options and both are wrong: skip them, and it passes over the whole
 * corpus while looking green; guess a tier, and it enforces a ceiling nobody
 * chose. So an entry with no marker is a failure of THIS test, not a skip.
 *
 * ⚠ `TIER: UNKNOWN` IS PARSEABLE AND MUST NOT BE PRESENT. The task that added
 * these markers was told to use it for an entry that could not be marked
 * without rewording; none arose. Leaving it merely skippable would have put a
 * one-token, self-service exemption from the ceiling one line from any entry
 * that reddened — no test edit, no map entry, nothing explaining itself. So it
 * parses, and its presence is a failure.
 *
 * ⚠ TABLE ROWS ARE NOT PROSE, AND ONLY A LANDMARK MAY HAVE THEM. Counting a
 * table changes the answer: with table rows included, `Let The Money In`
 * measures 206 against a 200 ceiling. But excluding them unconditionally makes
 * a table an unbounded channel for words at any tier — 200 filler words as a
 * table passed at Groundwork — so §4's "Chapters and Groundwork get none" is
 * asserted here rather than assumed.
 *
 * ⚠ ONE PUBLISHED ENTRY EXCEEDS ITS CEILING AND IS PINNED, NOT EXEMPTED.
 * `Backwards In Public` is 207 words against 200. It is a published record and
 * rewording it is forbidden, so the overage is recorded at its exact measured
 * value: it reds if that entry moves in EITHER direction, and the map's own
 * membership is asserted so it cannot quietly grow a second row.
 */

/**
 * Entries known to exceed their ceiling before this guard existed, pinned to
 * the exact word count measured when this file landed.
 *
 * This map may shrink. It must never grow — asserted below, because a docblock
 * saying so is how the guard gets talked out of firing.
 */
const PINNED_OVERAGES: Record<string, number> = {
	"Backwards In Public": 207,
};

/**
 * Bridges outside §11's 150–250 range before this guard existed.
 *
 * `09-the-window.md` measures 365. It is the bridge into the act written LIVE
 * during the experiment window, it is marked provisional in its own text
 * (*"the closing half is provisional until the window ends"*), and the task
 * that added this guard was explicitly forbidden to rewrite it — it carries two
 * of the document's open loops and rewriting it to fit a number would destroy a
 * record to tidy a measurement. So it is pinned at its exact length: green
 * today, red the moment it changes. Whoever drafts the forward half at go-live
 * should bring it into range and delete this pin.
 */
const PINNED_BRIDGES: Record<string, number> = {
	"09-the-window.md": 365,
};

/** The pinned bridge's exact content, so a same-length rewording cannot pass. */
const PINNED_BRIDGE_MD5 = "99a4c10b5c310342f59e218fcf9b4f3c";

/**
 * Per-act entry counts, pinned.
 *
 * ⚠ `headingCountAcrossDir()` is a control on FILE SELECTION and nothing else —
 * it counts headings in the same files the parser reads, so deleting entries
 * moves both numbers together and the comparison stays green. A review deleted
 * **twenty whole entries** from one act and every guard passed; the only thing
 * left was a `> 400` floor in another file, which tolerates losing twenty-seven.
 * That is the same magic-number-floor mechanism this file replaced for file
 * selection, still standing for content.
 *
 * So each act's count is pinned. It reds when an act gains or loses entries —
 * which is exactly right, because that is a decision somebody makes, once per
 * act, and never a thing that should happen quietly.
 */
const EXPECTED_ENTRY_COUNTS: Record<string, number> = {
	"01-before-anything.md": 21,
	"02-the-ground.md": 28,
	"03-the-engine.md": 85,
	"04-the-argument.md": 57,
	"05-the-audit.md": 30,
	"06-the-face.md": 59,
	"07-the-last-mile.md": 61,
	"08-the-instruments.md": 86,
	"09-the-window.md": 0,
};

describe("journey entries — word ceilings", () => {
	const entries = parseEntries();

	it("every act file is present, and none has silently stopped being parsed", () => {
		// A file that stops matching `NN-*.md` vanishes from all guards in silence.
		// The list is pinned, and the total is derived a second way — by walking
		// the directory rather than the pattern — so the two numbers separate the
		// moment one file drops out.
		expect(actFiles()).toEqual([...EXPECTED_ACT_FILES]);
		expect(
			entries.length,
			`the parser sees ${entries.length} entries but ${headingCountAcrossDir()} '### ' headings exist in docs/journey/ — a file has stopped matching the act-file pattern, or a non-act .md has appeared`,
		).toBe(headingCountAcrossDir());
		expect(entries.some((e) => e.words > 0)).toBe(true);
	});

	it("every act file still has the shape the parsers assume", () => {
		// ⚠ THE ONLY THING THAT ASSERTS THE PARSER'S STRUCTURAL ASSUMPTIONS.
		// `parseBridges` identifies the act title and the front-matter span line
		// BY POSITION — lines 1 and 2 — after identifying them by markup was found
		// to eat live prose. Position is the correct property, and until this test
		// nothing checked it held. Both directions were planted and all 26 tests
		// passed: delete the span line and its blank, and the first line of real
		// bridge prose lands on line 2 and is skipped — four shorthand tokens in it
		// went unscanned; delete the act title, and the technical span line is read
		// as prose instead. That is the same escape that proved bridges were
		// unscanned in the first place, reached a third time, through the fix for
		// the fix.
		//
		// The fence check is the other half. No parser here knows what a ``` block
		// is, deliberately — a fence rule in one reader and not another made
		// `headingCountAcrossDir()` disagree with `parseEntries()` and report it as
		// a file-selection failure. So a fenced block arriving in an act file is a
		// red that names itself, rather than sample text quietly becoming an entry.
		const wrong: string[] = [];
		for (const f of EXPECTED_ACT_FILES) {
			const lines = readFileSync(join(journeyDir(), f), "utf8").split("\n");
			const first = lines[0] ?? "";
			const second = lines[1] ?? "";
			if (!/^# Act [IVX]+ — .+/.test(first)) {
				wrong.push(
					`${f}:1 is not the act title, so the bridge parser is skipping the wrong line: ${JSON.stringify(first.slice(0, 60))}`,
				);
			}
			if (!/^\*.+\*$/.test(second.trim())) {
				wrong.push(
					`${f}:2 is not the front-matter span line, so the bridge parser is skipping a line a reader meets: ${JSON.stringify(second.slice(0, 60))}`,
				);
			}
			const fence = lines.findIndex((l) => l.trimStart().startsWith("```"));
			if (fence !== -1) {
				wrong.push(
					`${f}:${fence + 1} opens a fenced block; every reader of this corpus treats '### ' as an entry heading unconditionally, so a heading inside a fence would parse as an entry`,
				);
			}
		}
		expect(wrong, wrong.join("\n")).toEqual([]);
	});

	it("every act holds exactly the entries it is supposed to", () => {
		const actual: Record<string, number> = {};
		for (const f of EXPECTED_ACT_FILES) actual[f] = 0;
		for (const e of entries) actual[e.file] = (actual[e.file] ?? 0) + 1;
		expect(
			actual,
			"an act gained or lost entries — which is a decision, not something that happens quietly",
		).toEqual(EXPECTED_ENTRY_COUNTS);
	});

	it("every entry carries exactly one tier marker, and none is UNKNOWN", () => {
		const unmarked = entries
			.filter((e) => e.markers.length !== 1)
			.map(
				(e) => `${e.file}:${e.line} ${e.title} (${e.markers.length} markers)`,
			);
		expect(
			unmarked,
			`entries without exactly one <!-- TIER: … --> marker:\n${unmarked.join("\n")}`,
		).toEqual([]);

		const unknown = entries
			.filter((e) => e.tier === "UNKNOWN")
			.map((e) => `${e.file}:${e.line} ${e.title}`);
		expect(
			unknown,
			`UNKNOWN is an escape from the ceiling, not a tier. These entries must be marked properly:\n${unknown.join("\n")}`,
		).toEqual([]);
	});

	it("every entry's mono line has the right shape", () => {
		// Without this, a deleted mono line is reported as a missing marker —
		// a true refusal with a misleading cause.
		const bad = entries
			.filter((e) => !e.monoOk)
			.map(
				(e) => `${e.file}:${e.line} ${e.title} — mono: ${e.mono.slice(0, 70)}`,
			);
		expect(bad, `malformed mono lines:\n${bad.join("\n")}`).toEqual([]);
	});

	it("only a Landmark carries a visual, and never more than one", () => {
		const offenders: string[] = [];
		for (const e of entries) {
			if (e.tier !== "LANDMARK" && e.tableRows > 0) {
				offenders.push(
					`${e.file}:${e.line} ${e.title} — ${e.tier} carries ${e.tableRows} table rows; the visual is Landmark furniture (§4)`,
				);
			}
			// a markdown table is a header row, a separator row, then its body:
			// four or more rows past the separator means a second table.
			if (e.tier === "LANDMARK" && e.tableRows > 6) {
				offenders.push(
					`${e.file}:${e.line} ${e.title} — ${e.tableRows} table rows reads as more than one visual (§4: never two)`,
				);
			}
		}
		expect(offenders, offenders.join("\n")).toEqual([]);
	});

	it("every marked entry is within its tier's ceiling", () => {
		const over: string[] = [];
		for (const e of entries) {
			if (e.tier === null || e.tier === "UNKNOWN") continue;
			const ceiling = CEILINGS[e.tier as Exclude<Tier, "UNKNOWN">];
			// `hasOwn`, not `!== undefined`: a plain object answers for every key on
			// `Object.prototype`, so an entry titled `constructor` was exempted from
			// its ceiling by 130 words with all nine tests green — and `Object.keys`
			// does not see it, so the "map has not grown" assertion stayed green too.
			// That is the one-token, self-service exemption this file's docblock says
			// `TIER: UNKNOWN` exists to prevent, reached by a different door.
			if (Object.hasOwn(PINNED_OVERAGES, e.title)) continue;
			if (e.words > ceiling) {
				over.push(
					`${e.file}:${e.line} ${e.title} — ${e.tier} is ${e.words} words, ceiling ${ceiling}`,
				);
			}
		}
		expect(
			over,
			`entries over their tier ceiling:\n${over.join("\n")}`,
		).toEqual([]);
	});

	it("the pin map has not grown, and every pin still measures exactly what it was pinned at", () => {
		expect(
			Object.keys(PINNED_OVERAGES).sort(),
			"a new row in PINNED_OVERAGES is how this guard gets talked out of firing",
		).toEqual(["Backwards In Public"]);
		for (const [title, expected] of Object.entries(PINNED_OVERAGES)) {
			const found = entries.filter((e) => e.title === title);
			expect(found.length, `pinned entry ${title} not found`).toBe(1);
			expect(
				found[0].words,
				`${title} was pinned at ${expected} words because it is a published record that cannot be reworded; it now measures ${found[0].words}`,
			).toBe(expected);
		}
	});

	it("every written bridge is inside the 150–250 word range, or is pinned", () => {
		const bad: string[] = [];
		for (const b of parseBridges()) {
			if (b.words === 0) continue; // Act I has no bridge, by record
			if (PINNED_BRIDGES[b.file] !== undefined) continue;
			if (b.words < 150 || b.words > 250) {
				bad.push(`${b.file} — bridge is ${b.words} words, range is 150–250`);
			}
		}
		expect(bad, bad.join("\n")).toEqual([]);
	});

	it("the pinned bridge has not changed — in length OR in content", () => {
		expect(Object.keys(PINNED_BRIDGES).sort()).toEqual(["09-the-window.md"]);
		const byFile = new Map(parseBridges().map((b) => [b.file, b]));
		for (const [file, expected] of Object.entries(PINNED_BRIDGES)) {
			const b = byFile.get(file);
			expect(
				b?.words,
				`${file}'s bridge was pinned at ${expected} words because it is published prose this task may not rewrite; it now measures ${b?.words}. If it was rewritten at go-live, bring it inside 150–250 and delete this pin.`,
			).toBe(expected);
			// A word count is not a content pin: an earlier version claimed "red the
			// moment it changes" while a same-length rewording passed it.
			expect(
				createHash("md5")
					.update(b?.lines.join("\n") ?? "")
					.digest("hex"),
				`${file}'s bridge was reworded. It is published prose and this guard is what says so.`,
			).toBe(PINNED_BRIDGE_MD5);
		}
	});
});
