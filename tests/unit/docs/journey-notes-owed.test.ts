import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { journeyDir, parseEntries } from "./_journey-entries";

/**
 * A NOTE BODY SAYS EXACTLY WHAT ITS ENTRY SAYS.
 *
 * `docs/journey/notes-owed/` holds one file per commit whose message carries no
 * `Instructions for AI` block. A human attaches them to `refs/notes/commits`
 * after this lands. That ref is shared, unlocked, and has **no review surface**
 * — so the only thing standing between a reviewer and what actually gets
 * pushed is that the file is byte-identical to an entry the reviewer read in
 * the same diff. **This test is that guarantee.** Break it and the review of
 * the act stops being a review of the notes.
 *
 * ⚠ IT EXISTS BECAUSE THE PROPERTY BROKE ONCE, SILENTLY, IN THE COMMIT THAT
 * CREATED THESE FILES. The bodies were generated from the act file, a reviewer
 * verified all eleven byte-identical, and then the entries were **cut** in a
 * later commit in response to a different finding. Nothing regenerated the
 * bodies and nothing noticed: eleven files that had been checked and cleared
 * now disagreed with the entries they were checked against, and the only
 * symptom would have been a permanent note on a shared ref saying something
 * slightly different from the published record. A guarantee that holds at the
 * moment somebody checks it and not afterwards is not a guarantee.
 *
 * ⚠ WHAT `git notes add -F` ACTUALLY CHANGES, MEASURED — an earlier version of
 * this docblock said it drops `#`-leading lines. **It does not**, on git 2.53:
 * `stripspace` removes comments only under `--strip-comments`, which that path
 * does not pass. Stating a mechanism that does not exist is worse than stating
 * none, because the next reader trusts it.
 *
 * What it DOES do is real and was unguarded: it strips trailing whitespace,
 * collapses runs of blank lines to one, and drops leading and trailing blank
 * lines. So a body carrying any of those would be stored differently from the
 * file a reviewer approved — the same divergence, by a different route. Those
 * three properties are asserted below instead of the `#` claim, which is kept
 * only as a cheap belt: a leading `#` is still a markdown heading nobody wants
 * in a note.
 */

/** `CLAUDE.md` §5.13.1, the one text every note opens with. */
const CANONICAL_BLOCK_MD5 = "8f4aab09d860acfca37a6df02ae8f481";

/**
 * The eleven, by name. Pinned rather than counted, because the apply
 * instructions iterate a written-out list for exactly the same reason: a later
 * task that leaves its own bodies in this directory must not be swept up by
 * anything — not by a glob in a shell block, and not by a guard that only
 * checks the directory is non-empty. A twelfth file is a decision, and it
 * reddens here until somebody makes it.
 */
const EXPECTED_BODIES = [
	"n365-e5e520c.txt",
	"n377-ff1c0f9.txt",
	"n394-f7eba3e.txt",
	"n405-d2e99aa.txt",
	"n406-8153d62.txt",
	"n407-545c5f8.txt",
	"n408-940cdcb.txt",
	"n409-2d40a68.txt",
	"n410-98e203f.txt",
	"n411-0366714.txt",
	"n412-b2da687.txt",
] as const;

const notesDir = (): string => join(journeyDir(), "notes-owed");

const bodyFiles = (): string[] =>
	readdirSync(notesDir())
		.filter((f) => /^n\d+-[0-9a-f]{7}\.txt$/.test(f))
		.sort();

const md5 = (s: string): string => createHash("md5").update(s).digest("hex");

describe("journey — note bodies owed", () => {
	const files = bodyFiles();
	const entries = parseEntries();

	it("the directory holds exactly the eleven bodies this task owes", () => {
		expect(files).toEqual([...EXPECTED_BODIES]);
		expect(entries.length).toBeGreaterThan(400);
	});

	it("every body opens with the canonical block, byte for byte", () => {
		for (const f of files) {
			const head = readFileSync(join(notesDir(), f), "utf8")
				.split("\n")
				.slice(0, 7)
				.join("\n");
			expect(
				md5(`${head}\n`),
				`${f} does not open with the canonical Instructions for AI block`,
			).toBe(CANONICAL_BLOCK_MD5);
		}
	});

	it("every body's prose is byte-identical to its entry in the act file", () => {
		const byTitle = new Map(entries.map((e) => [e.title, e]));
		const drift: string[] = [];
		for (const f of files) {
			const raw = readFileSync(join(notesDir(), f), "utf8");
			const parts = raw.split("\n\n");
			const title = parts[1]?.trim() ?? "";
			const prose = parts.slice(2).join("\n\n").replace(/\n+$/, "");
			const entry = byTitle.get(title);
			if (!entry) {
				drift.push(`${f} names "${title}", which is not an entry`);
				continue;
			}
			if (prose !== entry.proseText) {
				drift.push(
					`${f} ("${title}") has drifted from its entry — the note would say something the record does not`,
				);
			}
		}
		expect(drift, drift.join("\n")).toEqual([]);
	});

	it("every body survives what git notes actually rewrites", () => {
		for (const f of files) {
			const raw = readFileSync(join(notesDir(), f), "utf8");
			const lines = raw.split("\n");

			expect(
				lines.filter((l) => /[ \t]+$/.test(l)),
				`${f} has trailing whitespace, which git notes strips — the stored note would differ from this file`,
			).toEqual([]);

			expect(
				/\n[ \t]*\n[ \t]*\n/.test(raw),
				`${f} has a run of blank lines, which git notes collapses to one`,
			).toBe(false);

			expect(
				/^\s*\n/.test(raw),
				`${f} opens with a blank line, which git notes drops`,
			).toBe(false);

			expect(
				/\n\s*\n$/.test(raw),
				`${f} ends with a blank line, which git notes drops`,
			).toBe(false);

			expect(
				lines.filter((l) => l.startsWith("#")),
				`${f} carries a markdown heading, which does not belong in a note`,
			).toEqual([]);
		}
	});
});
