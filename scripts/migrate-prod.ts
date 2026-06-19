/**
 * Apply Drizzle migrations to the PRODUCTION Supabase project, PER-MIGRATION-
 * TRANSACTION, behind a project-ref-fragment guard. The prod counterpart of
 * `scripts/migrate-staging.ts`.
 *
 * WHY a bespoke applier instead of `drizzle-kit migrate`:
 *   drizzle's pg dialect wraps ALL pending migrations in a SINGLE transaction
 *   (drizzle-orm/pg-core dialect `migrate()` →
 *   `session.transaction(async tx => { for (migration of migrations) ... })`).
 *   When prod is N migrations behind, applying e.g. 0006→0016 in one tx puts
 *   `ALTER TYPE "dharma_entry_type" ADD VALUE 'initial_grant'` (0009) and its
 *   USE in a partial-index predicate `WHERE entry_type = 'initial_grant'`
 *   (0013) in the SAME transaction → Postgres 55P04 ("unsafe use of new value
 *   of enum type"): a value added by ALTER TYPE ADD VALUE cannot be used until
 *   the adding transaction commits. This is the exact failure hit on staging.
 *
 *   This script commits EACH migration in its own transaction, so 0009's value
 *   is committed before 0013 references it. (0016's `CREATE TYPE "mod_reason"`
 *   + same-file use is unaffected — 55P04 applies only to ALTER TYPE ADD VALUE,
 *   not to a freshly CREATEd type. 0012's use of the original `daily_allowance`
 *   value is likewise unaffected.) All current migrations are transaction-safe
 *   (no CREATE INDEX CONCURRENTLY / VACUUM / REINDEX), so per-migration tx is
 *   correct for every file.
 *
 * Bookkeeping mirrors drizzle's dialect EXACTLY (schema `drizzle`, table
 * `__drizzle_migrations`, columns `hash` text + `created_at` bigint, hash =
 * sha256 of the file via `readMigrationFiles`, created_at = journal `when`), so
 * a later `drizzle-kit migrate` and the /api/health drift guard see a
 * consistent journal. Migration FILES are read via drizzle-orm's own
 * `readMigrationFiles` — identical hashing/ordering to drizzle-kit.
 *
 * NOTE vs CI: CI strips pg_cron statements from `*pg_cron*.sql` because the CI
 * Postgres has no pg_cron. Prod (Supabase) HAS pg_cron, so this script applies
 * the migrations VERBATIM (no stripping) — 0007/0011 run their real
 * `CREATE EXTENSION pg_cron` + `cron.schedule(...)`.
 *
 * Operator usage:
 *   doppler run --config prd -- pnpm db:migrate:prod
 *
 * Guard sequence:
 *   1. DATABASE_URL_PROD must be set (suffix-separated from DATABASE_URL — the
 *      separation prevents env-confusion accidents at invocation time).
 *   2. PROD_PROJECT_REF_FRAGMENT must be set in the prd Doppler config (a
 *      substring of the prod Supabase project ref).
 *   3. The URL must contain the fragment, else refuse to run.
 *
 * tsx caveat (AGENTS.md §7): this script inlines its own `postgres()` client
 * and must NOT delegate into the `@/db` → `server-only` chain.
 *
 * Recovery: if a migration fails mid-run, the failing migration's transaction
 * rolls back (earlier migrations stay committed). Investigate, fix forward,
 * re-run — the journal check resumes from the last committed migration.
 */

import { readMigrationFiles } from "drizzle-orm/migrator";
import postgres from "postgres";

const dbUrl = process.env.DATABASE_URL_PROD;
const fragment = process.env.PROD_PROJECT_REF_FRAGMENT;

const MIGRATIONS_FOLDER = "drizzle/migrations";

function safeHost(url: string): string {
	try {
		return new URL(url).host;
	} catch {
		return "(unparseable)";
	}
}

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

async function main(url: string): Promise<void> {
	const migrations = readMigrationFiles({
		migrationsFolder: MIGRATIONS_FOLDER,
	});
	const sql = postgres(url, { max: 1 });
	try {
		console.log(`[migrate-prod] Target: ${safeHost(url)}`);

		// Bookkeeping schema/table — identical DDL to drizzle's dialect.
		await sql.unsafe('CREATE SCHEMA IF NOT EXISTS "drizzle"');
		await sql.unsafe(
			'CREATE TABLE IF NOT EXISTS "drizzle"."__drizzle_migrations" (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at bigint)',
		);

		const lastRows = await sql.unsafe(
			'select created_at from "drizzle"."__drizzle_migrations" order by created_at desc limit 1',
		);
		const lastMillis =
			lastRows[0]?.created_at != null ? Number(lastRows[0].created_at) : null;

		let applied = 0;
		for (const migration of migrations) {
			// Apply if no migrations yet, or this one is newer than the DB head.
			if (lastMillis !== null && lastMillis >= migration.folderMillis) {
				continue;
			}
			// PER-MIGRATION TRANSACTION — the entire point of this script. Each
			// migration commits before the next begins (sql.begin = BEGIN/COMMIT).
			await sql.begin(async (tx) => {
				for (const statement of migration.sql) {
					const trimmed = statement.trim();
					if (trimmed.length === 0) {
						continue;
					}
					// Parameterless → postgres-js simple protocol, which runs every
					// migration chunk verbatim — including PL/pgSQL `$$` bodies
					// (0003/0007/0011) and `ALTER TYPE ... ADD VALUE` (0009).
					await tx.unsafe(trimmed);
				}
				await tx.unsafe(
					'insert into "drizzle"."__drizzle_migrations" ("hash","created_at") values ($1,$2)',
					[migration.hash, migration.folderMillis],
				);
			});
			applied += 1;
			console.log(
				`[migrate-prod] applied folderMillis=${migration.folderMillis} (hash ${migration.hash.slice(0, 12)})`,
			);
		}

		console.log(
			`[migrate-prod] Done. Applied ${applied} migration(s); ${migrations.length} total in journal.`,
		);
	} finally {
		await sql.end();
	}
}

main(dbUrl).catch((err) => {
	console.error(
		"[migrate-prod] Migration failed mid-run. The failing migration rolled back; earlier migrations are committed. Investigate, fix forward, re-run.",
	);
	console.error(err);
	process.exit(1);
});
