import type postgres from "postgres";
import { describe, expect, it } from "vitest";

import { testClient } from "../_fixtures/db";

// Bucket B — system_state. Per SPEC.2 §6.3 + 0003 lines 168-184.
// Single whitelisted column: frozen_at (NULL → timestamp once). Per-table
// function enforce_system_state_frozen_at. BEFORE DELETE shares the
// Bucket-A no-delete function (0003 line 198).
//
// system_state is the singleton Bucket-B table. The seed row
// ('system', NULL, <seeded_at>) ships in 0004_seed_system_state.sql.
//
// The truncate-after-each strategy used by every other 4.x file is
// unavailable: PK collision blocks re-INSERT, the Bucket-B trigger blocks
// DELETE, and the trigger's DISTINCT-FROM guard on `OLD.frozen_at IS NOT
// NULL` blocks UPDATE-reset of frozen_at to NULL after it's been set.
// Per-test transaction rollback is the file-specific carve-out: every
// mutation runs inside testClient.begin() and unwinds via a sentinel error
// that inRolledBackTx catches silently.
//
// HARD RULE per CAT 4.13.2: every UPDATE / DELETE / SELECT inside an it()
// body MUST go through `tx` (the postgres.TransactionSql arg from begin()),
// never through `testDb` or the file-level `testClient`. testClient appears
// at file scope only as the begin() handle for inRolledBackTx.

class RollbackSignal extends Error {
	constructor() {
		super("ROLLBACK_SIGNAL_PER_TEST_ISOLATION");
		this.name = "RollbackSignal";
	}
}

// Run a test body inside testClient.begin() and catch the RollbackSignal
// to unwind the transaction without surfacing the rollback as a test
// failure. Re-throws ANY other error (e.g., a P0001 from the trigger) so
// expect().rejects.toMatchObject(...) catches it at the call site.
async function inRolledBackTx(
	body: (tx: postgres.TransactionSql) => Promise<void>,
): Promise<void> {
	try {
		await testClient.begin(async (tx) => {
			await body(tx);
			throw new RollbackSignal();
		});
	} catch (e) {
		if (e instanceof RollbackSignal) return;
		throw e;
	}
}

describe("system_state — append-only trigger (Bucket B singleton)", () => {
	it("accepts frozen_at NULL→timestamp (conclusion freeze)", async () => {
		await inRolledBackTx(async (tx) => {
			await tx`UPDATE system_state SET frozen_at = '2026-11-05T23:59:00Z' WHERE id = 'system'`;
			const rows = await tx<
				{ frozen_at: Date | null }[]
			>`SELECT frozen_at FROM system_state WHERE id = 'system'`;
			expect(rows[0]?.frozen_at).toEqual(new Date("2026-11-05T23:59:00Z"));
		});
	});

	it("rejects re-firing frozen_at once set (one-shot)", async () => {
		await expect(
			inRolledBackTx(async (tx) => {
				await tx`UPDATE system_state SET frozen_at = '2026-11-05T23:59:00Z' WHERE id = 'system'`;
				await tx`UPDATE system_state SET frozen_at = '2026-12-01T00:00:00Z' WHERE id = 'system'`;
			}),
		).rejects.toMatchObject({
			code: "P0001",
			message: expect.stringContaining("frozen_at is one-shot"),
		});
	});

	it("rejects non-whitelisted column update (created_at)", async () => {
		await expect(
			inRolledBackTx(async (tx) => {
				await tx`UPDATE system_state SET created_at = '2099-01-01T00:00:00Z' WHERE id = 'system'`;
			}),
		).rejects.toMatchObject({
			code: "P0001",
			message: expect.stringContaining("only frozen_at may transition"),
		});
	});

	it("accepts no-op UPDATE on pre-freeze row (frozen_at NULL → NULL)", async () => {
		await inRolledBackTx(async (tx) => {
			await tx`UPDATE system_state SET frozen_at = NULL WHERE id = 'system'`;
			const rows = await tx<
				{ frozen_at: Date | null }[]
			>`SELECT frozen_at FROM system_state WHERE id = 'system'`;
			expect(rows[0]?.frozen_at).toBeNull();
		});
	});

	it("accepts no-op UPDATE on post-freeze row (frozen_at same → same)", async () => {
		await inRolledBackTx(async (tx) => {
			await tx`UPDATE system_state SET frozen_at = '2026-11-05T23:59:00Z' WHERE id = 'system'`;
			await tx`UPDATE system_state SET frozen_at = '2026-11-05T23:59:00Z' WHERE id = 'system'`;
			const rows = await tx<
				{ frozen_at: Date | null }[]
			>`SELECT frozen_at FROM system_state WHERE id = 'system'`;
			expect(rows[0]?.frozen_at).toEqual(new Date("2026-11-05T23:59:00Z"));
		});
	});

	it("rejects DELETE with P0001", async () => {
		await expect(
			inRolledBackTx(async (tx) => {
				await tx`DELETE FROM system_state WHERE id = 'system'`;
			}),
		).rejects.toMatchObject({
			code: "P0001",
			message: expect.stringContaining("DELETE not permitted"),
		});
	});
});
