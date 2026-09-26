/**
 * Apply pending Drizzle migrations ONE TRANSACTION PER MIGRATION.
 *
 * Lifted verbatim from `scripts/migrate-prod.ts` (ADR-0022) so that
 * `scripts/migrate-staging.ts` can use it too. The reason it exists is the
 * reason staging now needs it: drizzle's pg dialect wraps ALL pending migrations
 * in a SINGLE transaction, so on an EMPTY database — a fresh RDS instance —
 * `ALTER TYPE "dharma_entry_type" ADD VALUE 'initial_grant'` (0009) and its use
 * in a partial-index predicate (0013) land in the same transaction and Postgres
 * refuses with 55P04 ("unsafe use of new value of enum type"). The old staging
 * path never hit it only because the Supabase staging project was migrated
 * incrementally, never from zero. AWS-MIGRATION-2 is the first time it is.
 *
 * Bookkeeping mirrors drizzle's dialect EXACTLY (schema `drizzle`, table
 * `__drizzle_migrations`, columns `hash` text + `created_at` bigint, hash =
 * sha256 of the file via `readMigrationFiles`, created_at = journal `when`), so a
 * later `drizzle-kit migrate` and the /api/health per-hash drift guard see one
 * consistent journal.
 *
 * Applies migrations VERBATIM — no pg_cron stripping. Every target this runs
 * against (Supabase, RDS with the pg_cron parameter group) HAS pg_cron; only CI
 * strips it, and CI does not use this applier.
 *
 * tsx caveat (AGENTS.md §7): inlines its own `postgres()` client; never
 * delegates into the `@/db` → `server-only` chain.
 *
 * Both `migrate-staging.ts` and `migrate-prod.ts` delegate here since
 * AWS-MIGRATION-3 (the prod copy of this loop was folded in so the cutover
 * runs the code the staging rehearsal proved, fresh-RDS preparation included).
 */

import { readMigrationFiles } from "drizzle-orm/migrator";
import postgres from "postgres";

const MIGRATIONS_FOLDER = "drizzle/migrations";

export function safeHost(url: string): string {
	try {
		return new URL(url).host;
	} catch {
		return "(unparseable)";
	}
}

export async function applyMigrationsPerTransaction(
	url: string,
	label: string,
): Promise<void> {
	const migrations = readMigrationFiles({
		migrationsFolder: MIGRATIONS_FOLDER,
	});
	const sql = postgres(url, { max: 1 });
	try {
		console.log(`[${label}] Target: ${safeHost(url)}`);

		// TARGET PREPARATION, not a migration. Migration 0007 says
		// `CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions` — the
		// Supabase convention, where an `extensions` schema always exists. A plain
		// RDS instance has no such schema and 0007 fails with 3F000 before pg_cron
		// is ever loaded (measured at AWS-MIGRATION-2, first fresh target). The
		// committed migration set is append-only, so the target is made to look
		// like the one the migrations were written for, rather than the migration
		// being edited. On Supabase this is a no-op (IF NOT EXISTS). pg_cron's own
		// objects live in `cron` regardless — `WITH SCHEMA` only names where the
		// extension is recorded, which is why creating an empty schema suffices.
		await sql.unsafe('CREATE SCHEMA IF NOT EXISTS "extensions"');
		// ...and the schema alone is not enough on RDS, whose pg_cron build pins
		// itself to pg_catalog and rejects `WITH SCHEMA extensions` with 0A000
		// (also measured). Installing the extension FIRST makes 0007's
		// `CREATE EXTENSION IF NOT EXISTS` short-circuit on "already exists" —
		// Postgres checks existence before it validates the schema clause — and
		// its `cron.schedule` calls then run as written. Guarded on availability
		// so a target without pg_cron fails on 0007 with the real message rather
		// than here with a misleading one. No-op on Supabase, which has it.
		const cronAvailable = await sql.unsafe(
			"select 1 from pg_available_extensions where name = 'pg_cron'",
		);
		if (cronAvailable.length > 0) {
			await sql.unsafe("CREATE EXTENSION IF NOT EXISTS pg_cron");
		}

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
			// PER-MIGRATION TRANSACTION — the entire point of this module. Each
			// migration commits before the next begins (sql.begin = BEGIN/COMMIT).
			await sql.begin(async (tx) => {
				for (const statement of migration.sql) {
					const trimmed = statement.trim();
					if (trimmed.length === 0) {
						continue;
					}
					// Parameterless → postgres-js simple protocol, which runs every
					// migration chunk verbatim — including PL/pgSQL `$$` bodies
					// (0003/0007/0011/0027) and `ALTER TYPE ... ADD VALUE` (0009).
					await tx.unsafe(trimmed);
				}
				await tx.unsafe(
					'insert into "drizzle"."__drizzle_migrations" ("hash","created_at") values ($1,$2)',
					[migration.hash, migration.folderMillis],
				);
			});
			applied += 1;
			console.log(
				`[${label}] applied folderMillis=${migration.folderMillis} (hash ${migration.hash.slice(0, 12)})`,
			);
		}

		console.log(
			`[${label}] Done. Applied ${applied} migration(s); ${migrations.length} total in journal.`,
		);
	} finally {
		await sql.end();
	}
}
