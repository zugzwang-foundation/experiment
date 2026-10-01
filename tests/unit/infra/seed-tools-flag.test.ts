import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { productionConfig } from "../../../infra/config/production";
import { stagingConfig } from "../../../infra/config/staging";

// SEED-STAGING-1 / ADR-0064 — `ZUGZWANG_SEED_TOOLS` is the runtime permission
// for the admin seed-activity tool, and the ONLY place it may come from is the
// staging task definition. The app also requires ZUGZWANG_ENV=staging, but
// that value is baked into images by next.config's `env:` block; this flag is
// what keeps a staging image run under production's task definition refusing.
// So the property worth pinning is an ABSENCE on production, with the staging
// presence as its positive control.

const REPO_ROOT = join(__dirname, "..", "..", "..");

describe("seed-tools-flag — staging only", () => {
	it("seed-tools-flag::staging-enables-the-tool (positive control)", () => {
		expect(stagingConfig.seedTools).toBe("enabled");
	});

	it("seed-tools-flag::production-config-never-carries-it", () => {
		expect(productionConfig.seedTools).toBeUndefined();
		const source = readFileSync(
			join(REPO_ROOT, "infra", "config", "production.ts"),
			"utf8",
		);
		expect(source).not.toMatch(/seedTools|ZUGZWANG_SEED_TOOLS/);
	});

	it("seed-tools-flag::the-stack-emits-it-only-when-configured", () => {
		const source = readFileSync(
			join(REPO_ROOT, "infra", "lib", "compute-stack.ts"),
			"utf8",
		);
		// Conditional spread, never an unconditional key.
		expect(source).toMatch(
			/\.\.\.\(config\.seedTools\s*\?\s*\{\s*ZUGZWANG_SEED_TOOLS:\s*config\.seedTools\s*\}\s*:\s*\{\}\)/,
		);
		expect(source.match(/ZUGZWANG_SEED_TOOLS/g)).toHaveLength(1);
	});
});
