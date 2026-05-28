/**
 * Seed the staging Supabase identity_pool with the same ~200-row dev
 * pool that local dev uses (per LD-4). Same guard pattern as
 * migrate-staging.ts — refuses to run unless DATABASE_URL_STAGING is
 * set AND contains STAGING_PROJECT_REF_FRAGMENT. Per SCAFFOLD.8 plan
 * §4.3.
 *
 * Operator usage:
 *   doppler run --config staging -- pnpm db:seed:staging
 *
 * Delegates the actual seed to `scripts/seed-identity-pool-dev.ts` via
 * a `tsx` subprocess so we don't fork the dev-seed logic across two
 * files. The subprocess inherits `process.env` but with
 * `DATABASE_URL = DATABASE_URL_STAGING`, so `@/db`'s `postgres(...)` call
 * connects to staging and only staging.
 */

import { spawnSync } from "node:child_process";

const dbUrl = process.env.DATABASE_URL_STAGING;
const fragment = process.env.STAGING_PROJECT_REF_FRAGMENT;

function safeHost(url: string): string {
	try {
		return new URL(url).host;
	} catch {
		return "(unparseable)";
	}
}

if (!dbUrl) {
	console.error(
		"[seed-staging] DATABASE_URL_STAGING is not set. Run with: doppler run --config staging -- pnpm db:seed:staging",
	);
	process.exit(1);
}
if (!fragment) {
	console.error(
		"[seed-staging] STAGING_PROJECT_REF_FRAGMENT not set; cannot verify URL is staging",
	);
	process.exit(1);
}
if (!dbUrl.includes(fragment)) {
	console.error(
		`[seed-staging] DATABASE_URL_STAGING does not contain expected fragment "${fragment}"; refusing to run`,
	);
	console.error(`[seed-staging] Saw URL host: ${safeHost(dbUrl)}`);
	process.exit(1);
}

console.log(`[seed-staging] Target: ${safeHost(dbUrl)}`);
console.log("[seed-staging] Delegating to seed-identity-pool-dev.ts...");

const result = spawnSync("pnpm", ["tsx", "scripts/seed-identity-pool-dev.ts"], {
	stdio: "inherit",
	env: { ...process.env, DATABASE_URL: dbUrl },
});

if (result.status !== 0) {
	console.error(
		`[seed-staging] dev-seed exited with status ${result.status ?? "null"}`,
	);
	process.exit(result.status ?? 1);
}
console.log("[seed-staging] Done.");
