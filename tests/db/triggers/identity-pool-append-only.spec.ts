import { afterEach, describe, expect, it } from "vitest";

import { identityPool } from "@/db/schema";
import { testClient, testDb } from "../_fixtures/db";
import { truncateTables } from "../_fixtures/truncate";

// Bucket B — identity_pool. Per SPEC.2 §6.3 + 0003 lines 108-129.
// Single whitelisted column: assigned_at (NULL → timestamp once).
// Per-table function enforce_identity_pool_assigned_at. BEFORE DELETE
// shares the Bucket-A no-delete function (0003 line 194).
//
// No FKs. Non-whitelisted column chosen for case 3: pseudonym (text).

describe("identity_pool — append-only trigger (Bucket B)", () => {
	afterEach(async () => {
		await truncateTables(testClient, ["identity_pool"]);
	});

	async function setupRow(suffix: string) {
		const [row] = await testDb
			.insert(identityPool)
			.values({
				colour: "blue",
				animal: "fox",
				number: 42,
				pseudonym: `blue-fox-42-${suffix}`,
				pfpFilename: "blue-fox-42.png",
			})
			.returning({ id: identityPool.id });
		return { rowId: row?.id ?? "" };
	}

	it("accepts assigned_at NULL→timestamp", async () => {
		const { rowId } = await setupRow("1");

		await testClient.unsafe(
			`UPDATE identity_pool SET assigned_at = '2026-06-15T12:00:00Z' WHERE id = $1`,
			[rowId],
		);

		const rows = await testClient<{ assigned_at: Date | null }[]>`
			SELECT assigned_at FROM identity_pool WHERE id = ${rowId}
		`;
		expect(rows[0]?.assigned_at).toEqual(new Date("2026-06-15T12:00:00Z"));
	});

	it("rejects re-firing assigned_at once set (one-shot)", async () => {
		const { rowId } = await setupRow("2");
		await testClient.unsafe(
			`UPDATE identity_pool SET assigned_at = '2026-06-15T12:00:00Z' WHERE id = $1`,
			[rowId],
		);

		await expect(
			testClient.unsafe(
				`UPDATE identity_pool SET assigned_at = '2026-07-01T00:00:00Z' WHERE id = $1`,
				[rowId],
			),
		).rejects.toMatchObject({
			code: "P0001",
			message: expect.stringContaining("assigned_at is one-shot"),
		});
	});

	it("rejects non-whitelisted column update (pseudonym)", async () => {
		const { rowId } = await setupRow("3");

		await expect(
			testClient.unsafe(
				`UPDATE identity_pool SET pseudonym = 'changed-id' WHERE id = $1`,
				[rowId],
			),
		).rejects.toMatchObject({
			code: "P0001",
			message: expect.stringContaining("only assigned_at may transition"),
		});
	});

	it("accepts no-op UPDATE on pre-transition (assigned_at NULL) row", async () => {
		const { rowId } = await setupRow("4");

		await testClient.unsafe(
			`UPDATE identity_pool SET assigned_at = NULL WHERE id = $1`,
			[rowId],
		);

		const rows = await testClient<{ assigned_at: Date | null }[]>`
			SELECT assigned_at FROM identity_pool WHERE id = ${rowId}
		`;
		expect(rows[0]?.assigned_at).toBeNull();
	});

	it("accepts no-op UPDATE on post-transition (assigned_at non-NULL) row", async () => {
		const { rowId } = await setupRow("5");
		await testClient.unsafe(
			`UPDATE identity_pool SET assigned_at = '2026-06-15T12:00:00Z' WHERE id = $1`,
			[rowId],
		);

		await testClient.unsafe(
			`UPDATE identity_pool SET assigned_at = '2026-06-15T12:00:00Z' WHERE id = $1`,
			[rowId],
		);

		const rows = await testClient<{ assigned_at: Date | null }[]>`
			SELECT assigned_at FROM identity_pool WHERE id = ${rowId}
		`;
		expect(rows[0]?.assigned_at).toEqual(new Date("2026-06-15T12:00:00Z"));
	});

	it("rejects DELETE with P0001", async () => {
		const { rowId } = await setupRow("6");

		await expect(
			testClient.unsafe(`DELETE FROM identity_pool WHERE id = $1`, [rowId]),
		).rejects.toMatchObject({
			code: "P0001",
			message: expect.stringContaining("DELETE not permitted"),
		});
	});
});
