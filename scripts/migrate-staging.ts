/**
 * Apply Drizzle migrations to the staging Supabase project, with a
 * project-ref-fragment guard that refuses to run against any URL that
 * doesn't contain the operator-set STAGING_PROJECT_REF_FRAGMENT. Per
 * SCAFFOLD.8 plan §4.3 + OQ-4.
 *
 * Operator usage:
 *   doppler run --config staging -- pnpm db:migrate:staging
 *
 * Guard sequence:
 *   1. DATABASE_URL_STAGING must be set (NOT DATABASE_URL — the suffix
 *      separation prevents env-confusion accidents at invocation time).
 *   2. STAGING_PROJECT_REF_FRAGMENT must be set in the staging Doppler
 *      config (a substring of the Supabase project ref, e.g.,
 *      "xyz123abc.supabase.co").
 *   3. The URL must contain the fragment. If not, refuse to run.
 *
 * Plan §3.A Phase-1 amendment (2026-05-27): staging uses DATABASE_URL
 * only — the staging Supabase project does not provision a separate
 * DIRECT_URL, matching prod's direct-only posture.
 *
 * Recovery: if migration fails mid-run, investigate; fix forward; re-run.
 * If unrecoverable, drop the staging schema and re-run (per brief §7 +
 * plan §3.B HARDEN-phase carry-forward for 0007 partial-apply).
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
		"[migrate-staging] DATABASE_URL_STAGING is not set. Run with: doppler run --config staging -- pnpm db:migrate:staging",
	);
	process.exit(1);
}
if (!fragment) {
	console.error(
		"[migrate-staging] STAGING_PROJECT_REF_FRAGMENT not set; cannot verify URL is staging",
	);
	process.exit(1);
}
if (!dbUrl.includes(fragment)) {
	console.error(
		`[migrate-staging] DATABASE_URL_STAGING does not contain expected fragment "${fragment}"; refusing to run`,
	);
	console.error(`[migrate-staging] Saw URL host: ${safeHost(dbUrl)}`);
	process.exit(1);
}

console.log(`[migrate-staging] Target: ${safeHost(dbUrl)}`);
console.log("[migrate-staging] Applying migrations via drizzle-kit migrate...");

const result = spawnSync("pnpm", ["drizzle-kit", "migrate"], {
	stdio: "inherit",
	env: { ...process.env, DATABASE_URL: dbUrl },
});

if (result.status !== 0) {
	console.error(
		"[migrate-staging] Migration failed mid-run. Investigate the failed migration; fix forward; re-run. If unrecoverable: drop the staging schema and re-run.",
	);
	process.exit(result.status ?? 1);
}
console.log("[migrate-staging] Done.");
