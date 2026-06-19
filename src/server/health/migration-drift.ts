import { type SQL, sql } from "drizzle-orm";

import journal from "../../../drizzle/migrations/meta/_journal.json";

// Migration drift detection — compares the DEPLOYED CODE's migration journal
// head (bundled `drizzle/migrations/meta/_journal.json`, imported statically so
// it ships in the serverless bundle) against the CONNECTED DB's applied head
// (`drizzle.__drizzle_migrations`). A mismatch means "code ahead of schema"
// (or behind it) — the exact silent state that left prod 11 migrations behind
// and 500s when new code reads a column the DB doesn't have yet.
//
// This module takes the drizzle `db` as a PARAMETER and imports neither `@/db`
// nor `server-only`, so it carries no server-only chain: the /api/health route
// passes its own client, and the logic stays independently testable.

type JournalEntry = { idx: number; when: number; tag: string };

// Minimal structural shape of a drizzle client this module needs — keeps the
// dependency to `.execute(SQL)` only (the route's PostgresJsDatabase satisfies
// it) without importing the heavy db type or its server-only chain.
export type DriftDbClient = {
	execute: (query: SQL) => Promise<unknown>;
};

export type MigrationDriftStatus = "ok" | "drift" | "error";

// The journal head = the latest migration the deployed code knows about. Its
// `when` (epoch ms) is the same value drizzle records as
// `__drizzle_migrations.created_at` (= `migration.folderMillis`).
export function journalHead(): JournalEntry {
	const entries = (journal as { entries: JournalEntry[] }).entries;
	const last = entries.at(-1);
	if (!last) {
		throw new Error("migration journal has no entries");
	}
	return { idx: last.idx, when: last.when, tag: last.tag };
}

// The DB head = the most-recent migration `created_at` in
// `drizzle.__drizzle_migrations`, or null if no migrations are applied.
export async function dbMigrationHeadMillis(
	db: DriftDbClient,
): Promise<number | null> {
	const rows = (await db.execute(
		sql`select created_at from drizzle.__drizzle_migrations order by created_at desc limit 1`,
		// Raw-SQL result is a driver row list (trust boundary) — postgres-js
		// returns bigint `created_at` as a string; Number() normalizes it to the
		// numeric epoch-ms the journal uses.
	)) as unknown as Array<{ created_at: string | number | null }>;
	const value = rows[0]?.created_at;
	return value == null ? null : Number(value);
}

// "ok"    — journal head === DB head (code and schema agree)
// "drift" — heads differ, or no migrations are applied at all
// "error" — the comparison could not be performed (DB unreachable, etc.)
export async function migrationDriftStatus(
	db: DriftDbClient,
): Promise<MigrationDriftStatus> {
	try {
		const head = journalHead();
		const dbHead = await dbMigrationHeadMillis(db);
		if (dbHead === null) {
			return "drift";
		}
		return dbHead === head.when ? "ok" : "drift";
	} catch {
		return "error";
	}
}
