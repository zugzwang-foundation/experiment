import { execFileSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * EVERY TRACKED SESSION LOG IS STILL PRESENT AND NON-EMPTY.
 *
 * Minted at DISCOVERY-COMPLETE Gate C, from a defect this PR contained.
 * `git add -A` swept up relay text that had been pasted into
 * `docs/logs/DISCOVERY-COMPLETE.md` and replaced a 195-line six-field log with a
 * 47-line to-do list. **No gate saw it.** `just verify` passed; CI would have
 * passed; the whole thing would have squashed to `main` AS the log.
 *
 * That is the same failure class as `vercel.json`'s missing region field:
 * **silent, not wrong.** Every other control in this repo watches for a CHANGE
 * being incorrect. Nothing watched for a file simply CEASING TO EXIST, or being
 * emptied — and CLAUDE.md §5.9 calls a session that ends without a log "the most
 * expensive failure mode", because the next session starts blind.
 *
 * Deliberately GENERALISED, not pinned to one filename: the point is that the
 * SET survives. A guard naming DISCOVERY-COMPLETE.md would not have caught the
 * next log's deletion.
 *
 * Deliberately checks TRACKED-AT-HEAD rather than a directory listing: a
 * `git rm`'d log would vanish from both the listing and the expectation, so
 * globbing the working tree and comparing it to itself proves nothing. Asking
 * git what is committed and then checking the disk is what makes deletion
 * visible.
 *
 * Scope: PRESENCE, NON-EMPTINESS, and one MINIMAL shape assertion — the first
 * non-blank line is a markdown H1.
 *
 * ⚠ That third check is what actually catches HIGH-2. Presence and non-emptiness
 * ALONE WOULD NOT HAVE: the clobbered file was 47 lines of perfectly non-empty
 * relay text. It opened `ZUGZWANG · #311 GATE C — …`, not `# …`, and all 153
 * logs tracked at HEAD today open with an H1 — so the check is both sufficient
 * for the real defect and false-positive-free on the whole existing corpus,
 * verified rather than assumed.
 *
 * It deliberately stops there. The §5.9 six-field shape is a discipline for the
 * writer; a guard policing it would redden on every legitimately-shaped variant.
 * H1-or-not is the cheapest predicate that separates "a session log" from "some
 * other text pasted over one".
 */

const ROOT = process.cwd();

/** Logs tracked at HEAD, from git rather than from the working tree. */
function trackedSessionLogs(): string[] {
	return execFileSync(
		"git",
		["ls-tree", "-r", "--name-only", "HEAD", "docs/logs/"],
		{
			cwd: ROOT,
			encoding: "utf8",
		},
	)
		.split("\n")
		.map((line) => line.trim())
		.filter((line) => line.endsWith(".md"));
}

describe("session logs survive", () => {
	it("session-logs::the-tracked-set-is-non-empty", () => {
		// ALIVE CHECK, the C0 shape. A `git ls-tree` that matched nothing — wrong
		// path, renamed directory, detached HEAD with no tree — would make every
		// assertion below iterate an empty list and pass VACUOUSLY, which is the
		// exact failure mode this file exists to prevent. 153 logs at HEAD today.
		expect(trackedSessionLogs().length).toBeGreaterThanOrEqual(150);
	});

	it("session-logs::every-tracked-log-is-present-and-non-empty", () => {
		const missing: string[] = [];
		const empty: string[] = [];
		const notALog: string[] = [];

		for (const rel of trackedSessionLogs()) {
			const abs = join(ROOT, rel);
			try {
				if (statSync(abs).size === 0) {
					empty.push(rel);
					continue;
				}
			} catch {
				// ENOENT — committed at HEAD, gone from disk.
				missing.push(rel);
				continue;
			}
			// A file of only whitespace is empty in every sense that matters.
			const source = readFileSync(abs, "utf8");
			if (source.trim() === "") {
				empty.push(rel);
				continue;
			}
			// The HIGH-2 shape: still a file, still non-empty, no longer a log.
			const firstLine = source
				.split("\n")
				.find((line) => line.trim() !== "")
				?.trim();
			if (!firstLine?.startsWith("# ")) {
				notALog.push(rel);
			}
		}

		expect({ missing, empty, notALog }).toEqual({
			missing: [],
			empty: [],
			notALog: [],
		});
	});
});
