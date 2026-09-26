/**
 * Apply Drizzle migrations to the STAGING database, PER-MIGRATION-TRANSACTION,
 * behind a project-ref-fragment guard that refuses to run against any URL that
 * doesn't contain the operator-set STAGING_PROJECT_REF_FRAGMENT. Per
 * SCAFFOLD.8 plan §4.3 + OQ-4.
 *
 * ⚠ AWS-MIGRATION-2: this used to shell out to `pnpm drizzle-kit migrate`, which
 * applies every pending migration in ONE transaction. On the Supabase staging
 * project — migrated incrementally since 0001 — that never mattered. On a FRESH
 * database it fails at 0013 with Postgres 55P04, because 0009's
 * `ALTER TYPE ... ADD VALUE 'initial_grant'` cannot be used inside the
 * transaction that added it. The staging RDS instance is the first fresh target
 * this script has ever had, so it now uses the same per-migration applier as
 * `scripts/migrate-prod.ts` (`scripts/apply-migrations-per-tx.ts`). The guards
 * are unchanged.
 *
 * Operator usage:
 *   doppler run --config stg -- pnpm db:migrate:staging
 *   (or the ECS migration task, which carries the same two secrets)
 *
 * Guard sequence:
 *   1. DATABASE_URL_STAGING must be set (NOT DATABASE_URL — the suffix
 *      separation prevents env-confusion accidents at invocation time).
 *   2. STAGING_PROJECT_REF_FRAGMENT must be set (a substring of the target's
 *      host — the Supabase project ref today, the RDS endpoint after ADR-0059).
 *   3. The URL must contain the fragment. If not, refuse to run.
 *
 * Plan §3.A Phase-1 amendment (2026-05-27): staging uses DATABASE_URL
 * only — the staging Supabase project does not provision a separate
 * DIRECT_URL, matching prod's direct-only posture.
 *
 * Recovery: if a migration fails mid-run, the failing migration's transaction
 * rolls back (earlier migrations stay committed). Investigate, fix forward,
 * re-run — the journal check resumes from the last committed migration. If
 * unrecoverable, drop the staging schema and re-run (per brief §7 + plan §3.B
 * HARDEN-phase carry-forward for 0007 partial-apply).
 */

import {
	applyMigrationsPerTransaction,
	safeHost,
} from "./apply-migrations-per-tx";

const dbUrl = process.env.DATABASE_URL_STAGING;
const fragment = process.env.STAGING_PROJECT_REF_FRAGMENT;

if (!dbUrl) {
	console.error(
		"[migrate-staging] DATABASE_URL_STAGING is not set. Run with: doppler run --config stg -- pnpm db:migrate:staging",
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

applyMigrationsPerTransaction(dbUrl, "migrate-staging").catch((err) => {
	console.error(
		"[migrate-staging] Migration failed mid-run. The failing migration rolled back; earlier migrations are committed. Investigate, fix forward, re-run. If unrecoverable: drop the staging schema and re-run.",
	);
	console.error(err);
	process.exit(1);
});
