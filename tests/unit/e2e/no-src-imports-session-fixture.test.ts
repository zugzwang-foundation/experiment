import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// C2 from the E2E-1 handover — a helper that can mint a valid session is
// genuinely dangerous if it ever escapes the test folder. This is the
// mechanical enforcement: fail if anything under src/ imports the
// session-forging fixture, so the guard doesn't rely on convention alone.

const SRC_DIR = fileURLToPath(new URL("../../../src/", import.meta.url));

function collectSources(dir: string, acc: string[] = []): string[] {
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const full = `${dir}${entry.name}`;
		if (entry.isDirectory()) collectSources(`${full}/`, acc);
		else if (/\.(ts|tsx)$/.test(entry.name)) acc.push(full);
	}
	return acc;
}

/** The pattern any relative import of the fixture must contain. */
const FIXTURE_IMPORT_MARKER = /e2e\/_fixtures\/session/;

function findOffendingFiles(files: readonly string[]): string[] {
	return files.filter((f) =>
		FIXTURE_IMPORT_MARKER.test(readFileSync(f, "utf8")),
	);
}

describe("src/ never imports the session-forging fixture", () => {
	const files = collectSources(SRC_DIR).sort();

	it("scans a non-empty file set", () => {
		// A loop over an empty array asserts nothing.
		expect(files.length).toBeGreaterThan(0);
	});

	it("finds no import of tests/e2e/_fixtures/session anywhere under src/", () => {
		const offenders = findOffendingFiles(files);
		expect(offenders).toEqual([]);
	});

	// POSITIVE CONTROL — a negative assertion needs proof the pattern can
	// actually fire, not just that it found nothing this run (V-2).
	it("the detector itself fires on a file that DOES import the fixture", () => {
		const synthetic = [
			'import { forgeSession } from "../../../tests/e2e/_fixtures/session";',
		];
		// Simulate the scan against an in-memory source string rather than a
		// real file, so this control never has to touch a real src/ file.
		const hit = synthetic.some((line) => FIXTURE_IMPORT_MARKER.test(line));
		expect(hit).toBe(true);
	});
});
