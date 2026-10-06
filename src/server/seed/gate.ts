import "server-only";

// SEED-STAGING-1 — the guard every seeding entry point calls first.
//
// The tool creates participants and places bets on their behalf. Two
// conditions must BOTH hold, read from the running process's environment on
// every call:
//
//   ZUGZWANG_ENV        === "staging" | "prod"
//   ZUGZWANG_SEED_TOOLS === "enabled"
//
// ⛔ PRODUCTION IS ALLOWED SINCE SEED-PROD-1 (ADR-0064 Amendment 1, founder
// ruling 2026-10-06), and only through the second variable. Seeded activity on
// production is permanent and public — it reaches the 2026-11-06 dataset and
// cannot be reset away — so the permission lives on the production task
// definition (infra/config/production.ts `seedTools`) where removing it is a
// config change and a rolling restart, never a code change.
//
// ⛔ WHY THE VARIABLES ARE READ BY COMPUTED KEY. `next.config.ts` lists
// ZUGZWANG_ENV in its `env:` block, and Next replaces every literal
// `process.env.ZUGZWANG_ENV` member expression with the BUILD's value — in the
// server bundle as well as the client one. Measured on this branch before the
// fix: the shipped gate read `let e="preview"` and contained no environment
// read at all. A gate written that way is decided by whoever built the image,
// not by the server that runs it. `process.env[name]` is not substituted, so
// the value below is the task definition's, at request time.
//
// ⛔ WHY TWO VARIABLES. ZUGZWANG_ENV alone would make the image's identity and
// the tool's permission the same fact. ZUGZWANG_SEED_TOOLS is in no build
// configuration at all; it is set only on the ECS task definitions whose
// config carries `seedTools`. Removing that field from an environment's
// config therefore closes the tool there, whatever image is running.
//
// Anything else — an unset variable, a casing variant, a boolean-shaped
// "true", `preview` — refuses. An unrecognised value is never a guess about
// intent.

export const SEED_TOOLS_ENV_KEY = "ZUGZWANG_SEED_TOOLS";
export const SEED_TOOLS_ENABLED = "enabled";
const ZUGZWANG_ENV_KEY = "ZUGZWANG_ENV";

/** The environments the tool can run in. The labels it writes differ by it. */
export type SeedEnvironment = "staging" | "prod";

export class SeedToolsDisabledError extends Error {
	constructor() {
		super("seeding tools are not enabled on this deployment");
		this.name = "SeedToolsDisabledError";
	}
}

/** Pure: the environment the tool may run as, or null when it may not run. */
export function seedToolsEnvironmentFor(
	zugzwangEnv: string | undefined,
	seedTools: string | undefined,
): SeedEnvironment | null {
	if (seedTools !== SEED_TOOLS_ENABLED) return null;
	if (zugzwangEnv === "staging" || zugzwangEnv === "prod") return zugzwangEnv;
	return null;
}

/** Pure: the decision, given the two values. */
export function seedToolsAllowed(
	zugzwangEnv: string | undefined,
	seedTools: string | undefined,
): boolean {
	return seedToolsEnvironmentFor(zugzwangEnv, seedTools) !== null;
}

/** Reads the RUNNING process's environment — never a build-time literal. */
function runtimeEnv(name: string): string | undefined {
	return process.env[name];
}

/** The running environment when the tool may run here, otherwise null. */
export function seedToolsEnvironment(): SeedEnvironment | null {
	return seedToolsEnvironmentFor(
		runtimeEnv(ZUGZWANG_ENV_KEY),
		runtimeEnv(SEED_TOOLS_ENV_KEY),
	);
}

export function isSeedToolsEnabled(): boolean {
	return seedToolsEnvironment() !== null;
}

/** The running environment, or throws when the tool may not run here. */
export function assertSeedToolsEnabled(): SeedEnvironment {
	const env = seedToolsEnvironment();
	if (env === null) throw new SeedToolsDisabledError();
	return env;
}
