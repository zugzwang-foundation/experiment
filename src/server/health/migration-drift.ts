import { type SQL, sql } from "drizzle-orm";
import { readMigrationFiles } from "drizzle-orm/migrator";

// Migration drift detection (PER-HASH) — compares the DEPLOYED CODE's committed
// migration set against the CONNECTED DB's applied set by SHA-256 CONTENT HASH,
// not by timestamp. `readMigrationFiles` computes, for every committed
// migration, the exact sha256 drizzle records in `drizzle.__drizzle_migrations`
// (the same function `scripts/migrate-prod.ts` applies with); the detector reads
// the applied hashes back and reports "ok" iff the two multisets are equal.
//
// WHY PER-HASH (not the prior head-timestamp check): drizzle-orm #5769 — a
// migrate can exit 0 while a migration is silently skipped, or an applied
// migration's content can diverge from the committed file at the SAME head
// timestamp. A timestamp/count check at head granularity is blind to that; a
// content-hash multiset compare is not (ADR-0024 §Decision Outcome #6).
//
// PURE HASH-MULTISET COMPARE — NO `CI`/pg_cron conditional. CI strips pg_cron
// from `*pg_cron*.sql` (migrations 0007/0011) before applying, so a stripped-
// file hash would false-positive against the committed-file hash. This detector
// is safe only because its single caller, `/api/health`, runs ONLY in deployed
// environments (pg_cron present → unstripped), never in CI. The CLI surface
// `scripts/check-migration-drift.ts` keeps ADR-0022's timestamp+count for CI.
//
// This module takes the drizzle `db` as a PARAMETER and imports neither `@/db`
// nor `server-only`, so it carries no server-only chain: the /api/health route
// passes its own client, and the logic stays independently testable.

// Minimal structural shape of a drizzle client this module needs — keeps the
// dependency to `.execute(SQL)` only (the route's PostgresJsDatabase satisfies
// it) without importing the heavy db type or its server-only chain.
export type DriftDbClient = {
	execute: (query: SQL) => Promise<unknown>;
};

export type MigrationDriftStatus = "ok" | "drift" | "error";

const MIGRATIONS_FOLDER = "drizzle/migrations";

// Code-side hash set — sha256 of every committed migration's SQL, the exact
// values drizzle writes to `__drizzle_migrations.hash`.
function codeMigrationHashes(): string[] {
	return readMigrationFiles({ migrationsFolder: MIGRATIONS_FOLDER }).map(
		(m) => m.hash,
	);
}

// Applied hash set — every hash row in `drizzle.__drizzle_migrations`.
async function appliedMigrationHashes(db: DriftDbClient): Promise<string[]> {
	// Raw-SQL result is a driver row list (trust boundary).
	const rows = (await db.execute(
		sql`select hash from drizzle.__drizzle_migrations`,
	)) as unknown as Array<{ hash: string }>;
	return rows.map((r) => r.hash);
}

// Order-independent multiset equality over two hash lists.
function multisetEqual(a: string[], b: string[]): boolean {
	if (a.length !== b.length) {
		return false;
	}
	const counts = new Map<string, number>();
	for (const h of a) {
		counts.set(h, (counts.get(h) ?? 0) + 1);
	}
	for (const h of b) {
		const remaining = counts.get(h);
		if (remaining === undefined) {
			return false;
		}
		if (remaining === 1) {
			counts.delete(h);
		} else {
			counts.set(h, remaining - 1);
		}
	}
	return counts.size === 0;
}

// "ok"    — applied-hash multiset === code-hash multiset (content agrees)
// "drift" — the multisets differ (a divergent/planted hash, a missing head row,
//            code ahead of or behind the DB, or no migrations applied at all)
// "error" — the comparison could not be performed (DB unreachable, migration
//            files unreadable, ...)
export async function migrationDriftStatus(
	db: DriftDbClient,
): Promise<MigrationDriftStatus> {
	try {
		const code = codeMigrationHashes();
		const applied = await appliedMigrationHashes(db);
		return multisetEqual(code, applied) ? "ok" : "drift";
	} catch {
		return "error";
	}
}
