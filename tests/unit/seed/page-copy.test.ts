import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

// SEED-PROD-1 — the /admin/seed notice must tell the truth about what cannot
// be undone in each environment. A SOURCE SCAN because `page.tsx` may export
// nothing but what Next allows, so `ENV_NOTICE` cannot be imported.
//
// The property: production's copy says the activity is permanent and never
// says "staging" or implies a reset; staging's still says a reset clears it.

const source = readFileSync(
	join(
		__dirname,
		"..",
		"..",
		"..",
		"src",
		"app",
		"(admin)",
		"admin",
		"seed",
		"page.tsx",
	),
	"utf8",
);

/** The text of one `ENV_NOTICE` entry, from its key to its closing brace. */
function entry(key: "staging" | "prod"): string {
	const table = source.slice(source.indexOf("const ENV_NOTICE"));
	const start = table.indexOf(`\t${key}: {`);
	expect(start).toBeGreaterThan(-1);
	return table.slice(start, table.indexOf("\t},", start));
}

describe("seed-page-copy — per-environment notice", () => {
	it("seed-page-copy::production-says-permanent-and-never-staging-or-reset", () => {
		const prod = entry("prod");
		expect(prod).toMatch(/permanent/i);
		expect(prod).toMatch(/never reset/i);
		expect(prod).not.toMatch(/staging/i);
		expect(prod).not.toMatch(/reset clears|clears it/i);
	});

	it("seed-page-copy::staging-still-says-a-reset-clears-it (positive control)", () => {
		const staging = entry("staging");
		expect(staging).toMatch(/staging reset clears it/i);
	});

	it("seed-page-copy::the-notice-is-read-from-the-table-not-a-literal", () => {
		// No hard-coded "Staging only" notice survives beside the table.
		expect(source).not.toMatch(/Staging only/);
		expect(source).toMatch(/ENV_NOTICE\[env\]/);
	});
});
