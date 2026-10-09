import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { productionConfig } from "../../../infra/config/production";
import { stagingConfig } from "../../../infra/config/staging";

// SEED-STAGING-1 / ADR-0064 — `ZUGZWANG_SEED_TOOLS` is the runtime permission
// for the admin seed-activity tool, and it comes ONLY from an environment's
// config `seedTools` field, rendered onto that task definition. Since
// SEED-PROD-1 (ADR-0064 Amendment 1) both staging and production carry it.
// What stays pinned: the stack emits it only when configured, and no build
// configuration carries it (gate.test.ts), so removing the field from one
// environment's config is what closes the tool there.

const REPO_ROOT = join(__dirname, "..", "..", "..");

describe("seed-tools-flag — staging and production", () => {
	it("seed-tools-flag::staging-enables-the-tool", () => {
		expect(stagingConfig.seedTools).toBe("enabled");
	});

	it("seed-tools-flag::production-enables-the-tool (SEED-PROD-1)", () => {
		expect(productionConfig.seedTools).toBe("enabled");
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
