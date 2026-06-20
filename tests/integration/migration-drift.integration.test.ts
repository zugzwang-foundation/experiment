import { describe, expect, it } from "vitest";

import {
	dbMigrationHeadMillis,
	journalHead,
	migrationDriftStatus,
} from "@/server/health/migration-drift";
import { testDb } from "../db/_fixtures/db";

// MIGRATE-DRIFT §7 — real-DB coverage for the migration drift guard. The test
// Postgres is migrated to the journal head by CI (and locally by the operator),
// so the guard must report "ok". This is the path the /api/health drift field
// runs in production; if it ever reported "drift" here it would mean the test
// DB is behind the code's journal — which is itself the exact signal the guard
// exists to surface.

describe("migration drift guard (real DB)", () => {
	it("reports 'ok' when the connected DB is at the journal head", async () => {
		expect(await migrationDriftStatus(testDb)).toBe("ok");
	});

	it("DB head millis equals the journal head 'when'", async () => {
		expect(await dbMigrationHeadMillis(testDb)).toBe(journalHead().when);
	});
});
