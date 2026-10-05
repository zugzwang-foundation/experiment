import "server-only";

// SEED-STAGING-1 — the guard every seeding entry point calls first.
//
// The tool creates participants and places bets on their behalf, which is only
// acceptable where nobody real is reading the result. Two conditions must BOTH
// hold, read from the running process's environment on every call:
//
//   ZUGZWANG_ENV        === "staging"
//   ZUGZWANG_SEED_TOOLS === "enabled"
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
// ⛔ WHY TWO VARIABLES. ZUGZWANG_ENV alone would still make the image's
// identity and the tool's permission the same fact. ZUGZWANG_SEED_TOOLS is in
// no build configuration at all; it is set ONLY on the staging ECS task
// definition (infra/config/staging.ts `seedTools`). A staging image promoted
// or mis-deployed to production therefore still refuses, because production's
// task definition does not carry it.
//
// Anything else — an unset variable, a casing variant, a boolean-shaped
// "true" — refuses. An unrecognised value is never a guess about intent.

export const SEED_TOOLS_ENV_KEY = "ZUGZWANG_SEED_TOOLS";
export const SEED_TOOLS_ENABLED = "enabled";
const ZUGZWANG_ENV_KEY = "ZUGZWANG_ENV";

export class SeedToolsDisabledError extends Error {
	constructor() {
		super("seeding tools are not enabled on this deployment");
		this.name = "SeedToolsDisabledError";
	}
}

/** Pure: the decision, given the two values. */
export function seedToolsAllowed(
	zugzwangEnv: string | undefined,
	seedTools: string | undefined,
): boolean {
	return zugzwangEnv === "staging" && seedTools === SEED_TOOLS_ENABLED;
}

/** Reads the RUNNING process's environment — never a build-time literal. */
function runtimeEnv(name: string): string | undefined {
	return process.env[name];
}

export function isSeedToolsEnabled(): boolean {
	return seedToolsAllowed(
		runtimeEnv(ZUGZWANG_ENV_KEY),
		runtimeEnv(SEED_TOOLS_ENV_KEY),
	);
}

export function assertSeedToolsEnabled(): void {
	if (!isSeedToolsEnabled()) throw new SeedToolsDisabledError();
}
