import { readFileSync } from "node:fs";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

// SEED-STAGING-1 §3 G2/G5 + §16 `gate.ts` — the guard every seeding entry
// point calls first.
//
// Two conditions, both read from the RUNNING process (ADR-0064, revised after
// `@code-reviewer` C-1): ZUGZWANG_ENV is "staging" or "prod" (production since
// SEED-PROD-1, ADR-0064 Amendment 1) AND ZUGZWANG_SEED_TOOLS === "enabled".
// The second is set only on the ECS task definitions whose config carries
// `seedTools`, so no build artifact carries permission.
//
// ⚠ What this file can and cannot prove. Vitest never applies next.config.ts's
// `env:` define, so a runtime-read test passes whether or not the BUILT bundle
// still reads at runtime — which is exactly how C-1 shipped green. The last
// block therefore scans the SOURCE for the literal member form Next
// substitutes; that is the property the built gate depends on.
//
// `tests/_setup/env.ts` defaults ZUGZWANG_ENV to "prod" and sets no seed flag —
// the hostile values — so a test that forgets to set either still exercises a
// refusal.

import {
	assertSeedToolsEnabled,
	isSeedToolsEnabled,
	SEED_TOOLS_ENABLED,
	SEED_TOOLS_ENV_KEY,
	SeedToolsDisabledError,
	seedToolsAllowed,
	seedToolsEnvironment,
	seedToolsEnvironmentFor,
} from "@/server/seed/gate";

const ENV_KEY = "ZUGZWANG_ENV";
const saved: Record<string, string | undefined> = {};

function setVar(key: string, value: string | undefined): void {
	if (value === undefined) delete process.env[key];
	else process.env[key] = value;
}

beforeEach(() => {
	saved[ENV_KEY] = process.env[ENV_KEY];
	saved[SEED_TOOLS_ENV_KEY] = process.env[SEED_TOOLS_ENV_KEY];
});

afterEach(() => {
	setVar(ENV_KEY, saved[ENV_KEY]);
	setVar(SEED_TOOLS_ENV_KEY, saved[SEED_TOOLS_ENV_KEY]);
});

describe("seed-gate — the pure decision", () => {
	it("seed-gate::allows-staging-and-prod-with-the-flag-enabled", () => {
		expect(seedToolsAllowed("staging", "enabled")).toBe(true);
		expect(seedToolsAllowed("prod", "enabled")).toBe(true);
	});

	it("seed-gate::names-the-environment-it-allows", () => {
		// The environment decides the labels a run writes (plan.ts SEED_LABELS),
		// so the gate returns it rather than a bare yes.
		expect(seedToolsEnvironmentFor("staging", "enabled")).toBe("staging");
		expect(seedToolsEnvironmentFor("prod", "enabled")).toBe("prod");
		expect(seedToolsEnvironmentFor("prod", undefined)).toBeNull();
		expect(seedToolsEnvironmentFor("preview", "enabled")).toBeNull();
	});

	it("seed-gate::the-environment-alone-is-not-enough", () => {
		// The point of the second variable: environment IDENTITY is not permission.
		expect(seedToolsAllowed("staging", undefined)).toBe(false);
		expect(seedToolsAllowed("staging", "")).toBe(false);
		expect(seedToolsAllowed("prod", undefined)).toBe(false);
		expect(seedToolsAllowed("prod", "")).toBe(false);
	});

	it("seed-gate::the-flag-alone-is-not-enough", () => {
		expect(seedToolsAllowed("preview", "enabled")).toBe(false);
		expect(seedToolsAllowed("unknown", "enabled")).toBe(false);
		expect(seedToolsAllowed(undefined, "enabled")).toBe(false);
	});

	it("seed-gate::refuses-casing-and-boolean-shaped-variants", () => {
		expect(seedToolsAllowed("Staging", "enabled")).toBe(false);
		expect(seedToolsAllowed("staging", "Enabled")).toBe(false);
		expect(seedToolsAllowed("staging", "true")).toBe(false);
		expect(seedToolsAllowed("staging", "1")).toBe(false);
		expect(seedToolsAllowed("Prod", "enabled")).toBe(false);
		expect(seedToolsAllowed("production", "enabled")).toBe(false);
	});
});

describe("seed-gate — the runtime read", () => {
	it("seed-gate::enabled-when-both-runtime-variables-allow-it", () => {
		setVar(ENV_KEY, "staging");
		setVar(SEED_TOOLS_ENV_KEY, SEED_TOOLS_ENABLED);
		expect(isSeedToolsEnabled()).toBe(true);
		expect(assertSeedToolsEnabled()).toBe("staging");
		expect(seedToolsEnvironment()).toBe("staging");
	});

	it("seed-gate::refuses-on-staging-without-the-flag", () => {
		setVar(ENV_KEY, "staging");
		setVar(SEED_TOOLS_ENV_KEY, undefined);
		expect(isSeedToolsEnabled()).toBe(false);
		expect(() => assertSeedToolsEnabled()).toThrow(SeedToolsDisabledError);
	});

	it("seed-gate::enabled-on-prod-with-the-flag", () => {
		setVar(ENV_KEY, "prod");
		setVar(SEED_TOOLS_ENV_KEY, SEED_TOOLS_ENABLED);
		expect(isSeedToolsEnabled()).toBe(true);
		expect(assertSeedToolsEnabled()).toBe("prod");
	});

	it("seed-gate::refuses-on-prod-without-the-flag", () => {
		setVar(ENV_KEY, "prod");
		setVar(SEED_TOOLS_ENV_KEY, undefined);
		expect(isSeedToolsEnabled()).toBe(false);
		expect(seedToolsEnvironment()).toBeNull();
		expect(() => assertSeedToolsEnabled()).toThrow(SeedToolsDisabledError);
	});

	it("seed-gate::the-refusal-message-names-nothing", () => {
		setVar(ENV_KEY, "prod");
		let caught: unknown;
		try {
			assertSeedToolsEnabled();
		} catch (err) {
			caught = err;
		}
		expect(caught).toBeInstanceOf(SeedToolsDisabledError);
		expect((caught as Error).name).toBe("SeedToolsDisabledError");
		expect((caught as Error).message).not.toMatch(/ZUGZWANG|prod|staging/i);
	});
});

describe("seed-gate — the built gate must still read at runtime (C-1)", () => {
	const source = readFileSync(
		join(__dirname, "..", "..", "..", "src", "server", "seed", "gate.ts"),
		"utf8",
	);
	// Comments explain the trap and therefore NAME the forbidden form; strip
	// them so the scan reads code only.
	const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

	it("seed-gate::never-uses-the-member-form-next-substitutes", () => {
		// `process.env.X` is replaced at build time for any X in next.config's
		// `env:` block; `process.env[name]` is not.
		expect(code).not.toMatch(/process\.env\.[A-Za-z_]/);
	});

	it("seed-gate::reads-by-computed-key (positive control)", () => {
		expect(code).toMatch(/process\.env\[\s*name\s*\]/);
	});

	it("seed-gate::the-seed-flag-is-in-no-build-config", () => {
		const nextConfig = readFileSync(
			join(__dirname, "..", "..", "..", "next.config.ts"),
			"utf8",
		);
		expect(nextConfig).not.toContain(SEED_TOOLS_ENV_KEY);
	});
});
