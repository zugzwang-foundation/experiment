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
 * ⚠ NO LINE MAY BEGIN WITH `#`. `git notes add -F` applies `stripspace` on the
 * non-editor path, which silently drops `#`-leading lines — so a markdown
 * heading in a body would be eaten between the file a reviewer read and the
 * note that landed, with nothing reporting it.
 */

/** `CLAUDE.md` §5.13.1, the one text every note opens with. */
const CANONICAL_BLOCK_MD5 = "8f4aab09d860acfca37a6df02ae8f481";

const notesDir = (): string => join(journeyDir(), "notes-owed");

const bodyFiles = (): string[] =>
	readdirSync(notesDir())
		.filter((f) => /^n\d+-[0-9a-f]{7}\.txt$/.test(f))
		.sort();

const md5 = (s: string): string => createHash("md5").update(s).digest("hex");

describe("journey — note bodies owed", () => {
	const files = bodyFiles();
	const entries = parseEntries();

	it("there are bodies to check (control)", () => {
		expect(files.length).toBeGreaterThan(0);
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
			const live = entry.prose.join("\n").replace(/\n{3,}/g, "\n\n");
			if (prose !== live) {
				drift.push(
					`${f} ("${title}") has drifted from its entry — the note would say something the record does not`,
				);
			}
		}
		expect(drift, drift.join("\n")).toEqual([]);
	});

	it("no line begins with '#', which git notes would silently eat", () => {
		for (const f of files) {
			const lines = readFileSync(join(notesDir(), f), "utf8").split("\n");
			const hashed = lines.filter((l) => l.startsWith("#"));
			expect(hashed, `${f} carries a line git notes would strip`).toEqual([]);
		}
	});
});
