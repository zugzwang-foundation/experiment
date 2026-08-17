import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";

/**
 * THE ROOT README IS THE ONLY DISCOVERY PATH TO 341 GIT NOTES.
 *
 * GitHub's web UI cannot show a notes ref — `/tree/refs/notes/commits` is a
 * hard 404, because the tree browser only walks `refs/heads/*` and
 * `refs/tags/*`. A plain `git log` does not show notes either; `--notes` is off
 * by default. So a visitor's entire route to the reasoning behind 341 commits
 * is one paragraph in `README.md`, and nothing on disk breaks if it is trimmed,
 * reworded, or has a character eaten in transit.
 *
 * That is the same failure class as the unset deploy region and the emptied
 * session log: **silent, not wrong.** Every other control here watches for a
 * change being incorrect. This one watches for a working instruction quietly
 * ceasing to work.
 *
 * ⚠ THE REFSPEC IS ASSERTED BY EXECUTION, NEVER BY STRING MATCH. The preface
 * for `docs/journey/` shipped once as `"refs/notes/:refs/notes/"` — both
 * asterisks eaten by a markdown renderer upstream, inserted verbatim, reviewed
 * by eye, and merged. It fetches nothing and fails. Every string-shaped check
 * short of a full literal comparison passes on it, which is exactly why this
 * test builds a throwaway repository with a note in it and runs whatever the
 * README actually contains. If the refspec cannot move a note, this is RED.
 *
 * No network: the fetch runs between two temporary local repositories.
 */

const ROOT = process.cwd();
const README = readFileSync(join(ROOT, "README.md"), "utf8");

const TMP: string[] = [];
afterAll(() => {
	for (const d of TMP) rmSync(d, { recursive: true, force: true });
});

const git = (cwd: string, ...args: string[]): string =>
	execFileSync("git", args, {
		cwd,
		encoding: "utf8",
		stdio: ["ignore", "pipe", "pipe"],
	});

const scratch = (name: string): string => {
	const d = mkdtempSync(join(tmpdir(), `zz-${name}-`));
	TMP.push(d);
	return d;
};

/** Every refspec the README hands a reader, in order. */
const readmeRefspecs = (): string[] =>
	[...README.matchAll(/git fetch\s+\S+\s+"([^"]+)"/g)].map((m) => m[1]);

/**
 * A source repository with one commit and one note on it, plus the SHA the
 * note is attached to. Stands in for `origin`.
 */
const seedSource = (): { path: string; sha: string; note: string } => {
	const path = scratch("notes-src");
	const note = "the reasoning a reader is here for";
	git(path, "init", "--quiet");
	git(
		path,
		"-c",
		"user.email=t@t",
		"-c",
		"user.name=t",
		"commit",
		"--quiet",
		"--allow-empty",
		"-m",
		"seed",
	);
	const sha = git(path, "rev-parse", "HEAD").trim();
	git(
		path,
		"-c",
		"user.email=t@t",
		"-c",
		"user.name=t",
		"notes",
		"add",
		"-m",
		note,
		sha,
	);
	return { path, sha, note };
};

describe("the README's notes-discovery path still works", () => {
	it("hands the reader at least one fetch refspec", () => {
		expect(readmeRefspecs().length).toBeGreaterThan(0);
	});

	it("EXECUTES every refspec the README publishes, and each one moves a note", () => {
		const src = seedSource();
		for (const refspec of readmeRefspecs()) {
			const dest = scratch("notes-dest");
			git(dest, "init", "--quiet");

			// The assertion: run exactly what the file says. A malformed refspec
			// throws here; one that is well-formed but matches nothing transfers
			// no note and fails the check below.
			expect(
				() => git(dest, "fetch", src.path, refspec),
				`refspec published in README.md does not fetch: ${refspec}`,
			).not.toThrow();

			const shown = git(dest, "notes", "show", src.sha).trim();
			expect(shown, `refspec transferred no note: ${refspec}`).toBe(src.note);
		}
	});

	it("points at the journey document, and the path it names exists", () => {
		const linked = [...README.matchAll(/\(([^)]*docs\/journey\/[^)]*)\)/g)].map(
			(m) => m[1],
		);
		expect(
			linked.length,
			"README.md names no path under docs/journey/",
		).toBeGreaterThan(0);
		for (const rel of linked) {
			expect(
				existsSync(join(ROOT, rel)),
				`README links a path that does not exist: ${rel}`,
			).toBe(true);
		}
	});
});
