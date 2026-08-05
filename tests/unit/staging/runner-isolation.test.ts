import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { configDefaults } from "vitest/config";
import defaultConfig from "../../../vitest.config";
import stagingConfig from "../../../vitest.staging.config";

// STAGING-PARITY Slice A — ADR-0036 primitive 2: "tests/staging/** is excluded
// from vitest.config.ts's include patterns, mirroring the existing
// tests/scale/** precedent. A bare `vitest run` — local, CI, or a subagent's —
// must never be able to reach a live database. This is not a convention; it is
// a config exclusion, and it is asserted by a unit test."
//
// This file IS that assertion. It reads the resolved config objects rather
// than grepping text, so a rename or a restructure cannot make it pass
// vacuously — with one deliberate exception noted at the source-text case.

function testBlock(config: unknown): Record<string, unknown> {
	const test = (config as { test?: Record<string, unknown> }).test;
	if (!test) throw new Error("config has no `test` block");
	return test;
}

const defaultTest = testBlock(defaultConfig);
const stagingTest = testBlock(stagingConfig);

describe("vitest.config.ts excludes tests/staging/**", () => {
	it("carries the staging exclusion", () => {
		expect(defaultTest.exclude).toContain("tests/staging/**");
	});

	it("still carries the scale exclusion it mirrors", () => {
		expect(defaultTest.exclude).toContain("tests/scale/**");
	});

	it("preserves vitest's own default excludes", () => {
		// Spreading configDefaults.exclude is what keeps node_modules/dist out;
		// a hand-written array that dropped them would still pass the two cases
		// above while quietly re-including thousands of files.
		for (const pattern of configDefaults.exclude) {
			expect(defaultTest.exclude).toContain(pattern);
		}
	});

	it("does not name tests/staging in its include patterns", () => {
		const include = defaultTest.include as string[];
		for (const pattern of include) {
			expect(pattern).not.toMatch(/staging/);
		}
	});
});

describe("vitest.staging.config.ts is the only runner that includes them", () => {
	it("includes exactly the staging runners", () => {
		expect(stagingTest.include).toEqual(["tests/staging/**/*.staging.test.ts"]);
	});

	it("carries no staging exclusion of its own", () => {
		const exclude = (stagingTest.exclude ?? []) as string[];
		expect(exclude.some((p) => p.includes("staging"))).toBe(false);
	});

	it("runs files sequentially, like the other two configs", () => {
		// The reset toggles triggers at the catalog level, which is global to
		// the database. Cross-file parallelism would race it.
		expect(stagingTest.fileParallelism).toBe(false);
	});
});

describe("the two configs partition the tree", () => {
	it("no path is collected by both", () => {
		const stagingIncludes = stagingTest.include as string[];
		const defaultExcludes = defaultTest.exclude as string[];
		// Every staging include pattern must be covered by a default exclude.
		for (const pattern of stagingIncludes) {
			const root = pattern.split("**")[0] ?? pattern;
			expect({
				pattern,
				covered: defaultExcludes.some((ex) => ex.startsWith(root)),
			}).toEqual({
				pattern,
				covered: true,
			});
		}
	});

	it("the reset runner file sits under the excluded path", () => {
		// On-disk check, deliberately: the point is WHERE the file lives, which
		// no resolved-config object can report.
		const runner = fileURLToPath(
			new URL("../../staging/reset.staging.test.ts", import.meta.url),
		);
		expect(existsSync(runner)).toBe(true);
		expect(runner).toMatch(/\/tests\/staging\//);
		// And it is a *.staging.test.ts, so the staging config's include picks
		// it up while the default config's exclude drops it.
		expect(runner.endsWith(".staging.test.ts")).toBe(true);
	});
});
