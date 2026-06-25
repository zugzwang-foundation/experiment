import { readMigrationFiles } from "drizzle-orm/migrator";
import { describe, expect, it, vi } from "vitest";
import {
	type DriftDbClient,
	migrationDriftStatus,
} from "@/server/health/migration-drift";

// D1 Change #2 (ADR-0024 §Decision Outcome #6) — UNIT coverage for the PER-HASH
// migration-drift detector. The DB is MOCKED here (a structural `{ execute }`
// stub); the real-DB path is exercised in
// tests/integration/migration-drift.integration.test.ts. Keep the two-layer
// split: this file owns the mocked-client surface AND the "error" branch (the
// integration test has no error case), the integration file owns the real
// Postgres `__drizzle_migrations` mutation scenarios.
//
// WHY THE STUB ROWS CARRY `hash` (not `created_at`): the rewritten detector runs
// `select hash from drizzle.__drizzle_migrations` and compares that applied-hash
// multiset against the committed code's hash set. A `.execute` stub must
// therefore resolve to `{ hash: string }` rows. (The PRIOR timestamp detector
// — and its `journalHead` / `dbMigrationHeadMillis` exports — is gone; those are
// deliberately NOT imported.)

// The expected applied set, computed once from the SAME source the detector
// reads: `readMigrationFiles` over the repo-root migrations folder. This runs
// in the repo root where `drizzle/migrations` is present, so it yields the exact
// hash multiset the detector compares against — and re-reads on every migration
// add, so the test never goes stale.
const codeRows = readMigrationFiles({
	migrationsFolder: "drizzle/migrations",
}).map((m) => ({ hash: m.hash }));

// A stub drizzle client whose `.execute` resolves to a given row list.
function stubDb(rows: unknown): DriftDbClient {
	return { execute: vi.fn().mockResolvedValue(rows) };
}

describe("migration-drift", () => {
	describe("migrationDriftStatus (per-hash multiset compare)", () => {
		it("ok when the applied-hash multiset equals the code-hash multiset", async () => {
			const db = stubDb(codeRows);
			expect(await migrationDriftStatus(db)).toBe("ok");
		});

		it("ok is order-independent (multiset, not sequence)", async () => {
			const db = stubDb([...codeRows].reverse());
			expect(await migrationDriftStatus(db)).toBe("ok");
		});

		it("drift on a single corrupted applied hash (count unchanged)", async () => {
			const corrupted = codeRows.map((r) => ({ ...r }));
			corrupted[0] = {
				hash: "deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef",
			};
			const db = stubDb(corrupted);
			expect(await migrationDriftStatus(db)).toBe("drift");
		});

		it("drift when the DB is behind (one applied row missing)", async () => {
			const db = stubDb(codeRows.slice(1));
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
