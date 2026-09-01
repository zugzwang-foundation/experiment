import { readFileSync, statSync } from "node:fs";

import { describe, expect, it } from "vitest";

/**
 * DATASET.3 · **no source file contains a NUL byte.**
 *
 * ## Why this exists, and it is not a hypothetical
 *
 * Two files written during this run acquired a stray `\0` inside a string
 * literal — `"bad\0value"` and `?? "\0never"`, in both cases replacing an
 * ordinary space. One of them was **committed**, and every gate passed over it:
 * `tsc` accepted it (a NUL is a legal character in a TypeScript string),
 * `biome` accepted it, and the whole test suite went green, because the NUL
 * happened to land in a `??` fallback string nothing compared.
 *
 * The other one did surface — as `TypeError: Headers.append: "bad value" is an
 * invalid header value`, which reads as a complaint about the SPACE and sent
 * the first diagnosis in exactly the wrong direction. That is the shape worth
 * guarding: a corrupt byte does not announce itself, it makes some later thing
 * fail for a reason that looks like something else.
 *
 * ⚠ **And `grep` cannot find it for you.** A file containing a NUL is treated
 * as binary, so a search for a string sitting right beside the NUL returns
 * nothing at all — an `O-13` silence, in the one tool anyone would reach for
 * to check. The absence of grep hits was very nearly read as "the string is not
 * there".
 *
 * A whole-repo sweep is cheap: 1,524 tracked text files, read once. The cost of
 * not having it is a corrupt byte in a published research corpus, or in the
 * strip rules that decide what gets published.
 */

/** Extensions that are legitimately binary and are skipped. */
const BINARY = new Set([
	"png",
	"jpg",
	"jpeg",
	"webp",
	"gif",
	"ico",
	"gz",
	"zip",
	"pdf",
	"woff",
	"woff2",
	"ttf",
	"otf",
	"mp4",
	"webm",
]);

function trackedFiles(): string[] {
	// `git ls-files` rather than a glob: it is the set the repository actually
	// carries, so a file that is present-but-ignored cannot fail this and a
	// tracked file cannot escape it.
	const { execFileSync } =
		require("node:child_process") as typeof import("node:child_process");
	return execFileSync("git", ["ls-files", "-z"], { encoding: "buffer" })
		.toString("utf8")
		.split("\0")
		.filter((f) => f.length > 0);
}

describe("source integrity · no NUL byte in any tracked text file", () => {
	const files = trackedFiles().filter((f) => {
		const ext = f.split(".").pop() ?? "";
		if (BINARY.has(ext.toLowerCase())) return false;
		try {
			return statSync(f).isFile();
		} catch {
			return false;
		}
	});

	it("POSITIVE CONTROL — the sweep actually reads files", () => {
		// Without this, "no file has a NUL" is satisfied by a sweep over an
		// empty list — which is what a broken `git ls-files` would produce, and
		// it would look exactly like a clean repository.
		expect(files.length).toBeGreaterThan(500);
		expect(files).toContain("package.json");
	});

	it("POSITIVE CONTROL — the detector can see a NUL", () => {
		// The detector, exercised on a string that has one. A test asserting
		// `count === 0` everywhere passes identically against a detector that
		// always returns zero.
		expect(Buffer.from("a\0b", "utf8").includes(0)).toBe(true);
		expect(Buffer.from("ab", "utf8").includes(0)).toBe(false);
	});

	it("no tracked text file contains a NUL", () => {
		const offenders: string[] = [];
		for (const f of files) {
			if (readFileSync(f).includes(0)) offenders.push(f);
		}
		expect(
			offenders,
			"a NUL byte in a source file survives tsc, biome and the test suite, " +
				"and makes grep treat the file as binary so it cannot be found by " +
				"searching for the text beside it",
		).toEqual([]);
	});
});
