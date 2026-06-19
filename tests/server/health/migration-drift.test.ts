import { describe, expect, it, vi } from "vitest";
import {
	type DriftDbClient,
	dbMigrationHeadMillis,
	journalHead,
	migrationDriftStatus,
} from "@/server/health/migration-drift";
import journal from "../../../drizzle/migrations/meta/_journal.json";

// MIGRATE-DRIFT §7 — unit coverage for the migration drift guard. The DB is
// mocked here (a structural `{ execute }` stub); the real-DB path is exercised
// in tests/integration/migration-drift.integration.test.ts.

// The journal head value the function should return, derived from the SAME
// source of truth the implementation reads — so this test never goes stale when
// a migration is added (it re-reads the journal), while still proving the
// function returns the LAST (newest) entry, not the first or a wrong field.
const entries = (
	journal as { entries: Array<{ idx: number; when: number; tag: string }> }
).entries;
const expectedHead = entries[entries.length - 1];

// A stub drizzle client whose `.execute` resolves to a given row list.
function stubDb(rows: unknown): DriftDbClient {
	return { execute: vi.fn().mockResolvedValue(rows) };
}

describe("migration-drift", () => {
	describe("journalHead", () => {
		it("returns the newest journal entry (idx/when/tag)", () => {
			const head = journalHead();
			expect(head.tag).toBe(expectedHead?.tag);
			expect(head.when).toBe(expectedHead?.when);
			expect(head.idx).toBe(expectedHead?.idx);
		});
	});

	describe("dbMigrationHeadMillis", () => {
		it("coerces a postgres-js bigint string to a number", async () => {
			const db = stubDb([{ created_at: "1781807918121" }]);
			expect(await dbMigrationHeadMillis(db)).toBe(1781807918121);
		});

		it("accepts a numeric created_at unchanged", async () => {
			const db = stubDb([{ created_at: 1781807918121 }]);
			expect(await dbMigrationHeadMillis(db)).toBe(1781807918121);
		});

		it("returns null when no migrations are applied", async () => {
			const db = stubDb([]);
			expect(await dbMigrationHeadMillis(db)).toBeNull();
		});
	});

	describe("migrationDriftStatus", () => {
		it("ok when the DB head equals the journal head (string)", async () => {
			const db = stubDb([{ created_at: String(expectedHead?.when) }]);
			expect(await migrationDriftStatus(db)).toBe("ok");
		});

		it("ok when the DB head equals the journal head (number)", async () => {
			const db = stubDb([{ created_at: expectedHead?.when }]);
			expect(await migrationDriftStatus(db)).toBe("ok");
		});

		it("drift when the DB head is behind the journal head", async () => {
			const db = stubDb([{ created_at: "1" }]);
			expect(await migrationDriftStatus(db)).toBe("drift");
		});

		it("drift when no migrations are applied at all", async () => {
			const db = stubDb([]);
			expect(await migrationDriftStatus(db)).toBe("drift");
		});

		it("error when the DB query throws (DB unreachable)", async () => {
			const db: DriftDbClient = {
				execute: vi.fn().mockRejectedValue(new Error("ECONNREFUSED")),
			};
			expect(await migrationDriftStatus(db)).toBe("error");
		});
	});
});
