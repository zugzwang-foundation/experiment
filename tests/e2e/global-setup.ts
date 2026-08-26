import { execSync } from "node:child_process";
import { join } from "node:path";
import { assertIsolatedEnvironment } from "./_fixtures/env-guard";

// Runs once before the whole Playwright suite. Order matters: the fence
// first, always — nothing below is safe to run against a shared database.
export default async function globalSetup(): Promise<void> {
	assertIsolatedEnvironment();

	const repoRoot = join(__dirname, "..", "..");
	const env = { ...process.env };

	// resetWorld() — wipe + re-migrate the local DB, re-seed identity_pool.
	execSync("pnpm exec tsx tests/e2e/_fixtures/reset-local-db.ts", {
		cwd: repoRoot,
		env,
		stdio: "inherit",
	});

	// seedWorld() + session forging + the round-trip proof, all inside the
	// Vitest context acceptTosAction needs (see generate-local-world.vitest.ts
	// for why this can't be a plain tsx script).
	execSync(
		"pnpm exec vitest run --config vitest.e2e-fixtures.config.ts tests/e2e/_fixtures/generate-local-world.vitest.ts",
		{ cwd: repoRoot, env, stdio: "inherit" },
	);
}
