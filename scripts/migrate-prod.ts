/**
 * Apply pending drizzle migrations to PRODUCTION, one migration per
 * transaction, behind a project-ref-fragment guard. The prod twin of
 * `migrate-staging.ts`; both delegate to `apply-migrations-per-tx.ts`.
 *
 * AWS-MIGRATION-3: this file used to carry its own copy of the per-transaction
 * loop, written when production was Supabase. Against a FRESH RDS instance
 * that copy fails twice before the first migration commits — 3F000 because
 * `0007` installs pg_cron `WITH SCHEMA extensions` and RDS has no such schema,
 * then 0A000 because RDS pins pg_cron to `pg_catalog` — both measured on the
 * first staging rehearsal (06-STAGING-DEPLOYMENT.md §4). The shared applier
 * carries the target preparation for exactly those two cases and is a no-op on
 * Supabase, so one implementation now serves both environments and the
 * production cutover runs the code the staging rehearsal proved.
 *
 * The guard is unchanged in shape: `DATABASE_URL_PROD` (suffix-separated from
 * `DATABASE_URL`, ADR-0022) must contain `PROD_PROJECT_REF_FRAGMENT`. At
 * cutover both values move to the RDS endpoint in Doppler `prd` — the fragment
 * is then the RDS host, and a URL still pointing at Supabase refuses.
 *
 * Usage: doppler run --config prd -- pnpm db:migrate:prod
 */
import {
	applyMigrationsPerTransaction,
	safeHost,
} from "./apply-migrations-per-tx";

const dbUrl = process.env.DATABASE_URL_PROD;
const fragment = process.env.PROD_PROJECT_REF_FRAGMENT;

if (!dbUrl) {
	console.error(
		"[migrate-prod] DATABASE_URL_PROD is not set. Run with: doppler run --config prd -- pnpm db:migrate:prod",
	);
	process.exit(1);
}
if (!fragment) {
	console.error(
		"[migrate-prod] PROD_PROJECT_REF_FRAGMENT not set; cannot verify URL is prod",
	);
	process.exit(1);
}
if (!dbUrl.includes(fragment)) {
	console.error(
		`[migrate-prod] DATABASE_URL_PROD does not contain expected fragment "${fragment}"; refusing to run`,
	);
	console.error(`[migrate-prod] Saw URL host: ${safeHost(dbUrl)}`);
	process.exit(1);
}

applyMigrationsPerTransaction(dbUrl, "migrate-prod").catch((err) => {
	console.error(
		"[migrate-prod] Migration failed mid-run. The failing migration rolled back; earlier migrations are committed. Investigate, fix forward, re-run.",
	);
	console.error(err);
	process.exit(1);
});
