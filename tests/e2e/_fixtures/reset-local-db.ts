// Wipes and re-migrates the LOCAL dev Postgres, then re-seeds identity_pool.
// Never touches staging/production — assertIsolatedEnvironment() runs before
// this is ever invoked (see global-setup.ts).
//
// Bucket-A tables reject TRUNCATE by design (ADR-0030), so this drops the
// `public` schema outright (plus `drizzle`, which holds drizzle-kit's own
// migration-tracking table and would otherwise report every migration as
// already-applied against an empty public schema) and re-migrates from
// scratch — the same recipe proven by hand earlier this session.
//
// Runs as a plain script (tsx), not through @/db — AGENTS.md §7: scripts
// under tsx must not import the @/db → server-only chain.

import { execSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import postgres from "postgres";

const REPO_ROOT = join(__dirname, "..", "..", "..");

async function resetLocalDb(databaseUrl: string): Promise<void> {
	const host = new URL(databaseUrl.replace(/^postgres(ql)?:\/\//, "http://"))
		.hostname;
	if (!["localhost", "127.0.0.1", "::1"].includes(host)) {
		throw new Error(
			`reset-local-db: refusing — DATABASE_URL host is "${host}", not loopback.`,
		);
	}

	const sql = postgres(databaseUrl, { max: 1 });
	await sql`DROP SCHEMA IF EXISTS public CASCADE`;
	await sql`CREATE SCHEMA public`;
	await sql`DROP SCHEMA IF EXISTS drizzle CASCADE`;
	await sql.end();

	// Same pg_cron-strip pattern used for the initial local setup and by
	// ci.yml for the CI Postgres substrate — 0007/0011 carry `cron.schedule`
	// registrations that only apply on Supabase, never on vanilla Postgres.
	const tmpDir = mkdtempSync(join(tmpdir(), "zz-e2e-migrations-"));
	execSync(`cp -r "${join(REPO_ROOT, "drizzle/migrations")}"/* "${tmpDir}"`, {
		stdio: "inherit",
	});
	for (const file of readdirSync(tmpDir)) {
		if (!file.includes("pg_cron")) continue;
		execSync(
			`sed -i '' -e '/^CREATE EXTENSION IF NOT EXISTS pg_cron/d' -e '/^SELECT cron\\.schedule(/,/^);$/d' "${join(tmpDir, file)}"`,
		);
	}

	const configPath = join(tmpDir, "drizzle.config.local.ts");
	execSync(
		`cat > "${configPath}" <<'EOF'
import { defineConfig } from "drizzle-kit";
export default defineConfig({
	dialect: "postgresql",
	schema: "${join(REPO_ROOT, "src/db/schema")}",
	out: "${tmpDir}",
	dbCredentials: { url: process.env.DATABASE_URL! },
	tablesFilter: ["!events"],
	casing: "snake_case",
	strict: true,
	verbose: true,
});
EOF`,
	);

	execSync(`pnpm exec drizzle-kit migrate --config="${configPath}"`, {
		cwd: REPO_ROOT,
		env: { ...process.env, DATABASE_URL: databaseUrl },
		stdio: "inherit",
	});

	if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true, force: true });

	// Re-seed identity_pool — user creation throws identity_pool_exhausted
	// against an empty pool (src/server/auth/index.ts databaseHooks).
	execSync("pnpm seed:identity-pool:dev", {
		cwd: REPO_ROOT,
		env: { ...process.env, DATABASE_URL: databaseUrl },
		stdio: "inherit",
	});
}

if (require.main === module) {
	const databaseUrl = process.env.DATABASE_URL;
	if (!databaseUrl) {
		console.error("reset-local-db: DATABASE_URL is not set");
		process.exit(1);
	}
	resetLocalDb(databaseUrl)
		.then(() => {
			console.log("[reset-local-db] done");
			process.exit(0);
		})
		.catch((err) => {
			console.error("[reset-local-db] failed:", err);
			process.exit(1);
		});
}

export { resetLocalDb };
