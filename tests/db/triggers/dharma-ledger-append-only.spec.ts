import { afterEach, describe, expect, it } from "vitest";

import { dharmaLedger, users } from "@/db/schema";
import { testClient, testDb } from "../_fixtures/db";

// Bucket A — dharma_ledger. Per SPEC.2 §6.2 + 0003 lines 44-45.
// Storage-layer half of INV-2 (no overdraft) — append-only ledger means a
// historical entry cannot be silently mutated to fake retroactive balance.
// The CHECK (balance_after >= 0) is the column-level INV-2 enforcement and
// is NOT under test here (HARDEN.* territory).
//
// Rejection-path queries go through testClient.unsafe() so the PostgresError
// surfaces unwrapped.

describe("dharma_ledger — append-only trigger", () => {
	afterEach(async () => {
		await testClient.unsafe(`TRUNCATE dharma_ledger, users CASCADE`);
	});

	it("rejects UPDATE with P0001", async () => {
		const [user] = await testDb
			.insert(users)
			.values({
				name: "Test User",
				email: "test1@example.com",
				pseudonym: "blue-fox-1",
			})
			.returning({ id: users.id });

		const [ledger] = await testDb
			.insert(dharmaLedger)
			.values({
				userId: user?.id ?? "",
				entryType: "daily_allowance",
				amount: "100",
				balanceAfter: "100",
			})
			.returning({ id: dharmaLedger.id });

		await expect(
			testClient.unsafe(`UPDATE dharma_ledger SET amount = 999 WHERE id = $1`, [
				ledger?.id ?? "",
			]),
		).rejects.toMatchObject({
			code: "P0001",
			message: expect.stringContaining("UPDATE not permitted"),
		});
	});

	it("rejects DELETE with P0001", async () => {
		const [user] = await testDb
			.insert(users)
			.values({
				name: "Test User",
				email: "test2@example.com",
				pseudonym: "blue-fox-2",
			})
			.returning({ id: users.id });

		const [ledger] = await testDb
			.insert(dharmaLedger)
			.values({
				userId: user?.id ?? "",
				entryType: "daily_allowance",
				amount: "100",
				balanceAfter: "100",
			})
			.returning({ id: dharmaLedger.id });

		await expect(
			testClient.unsafe(`DELETE FROM dharma_ledger WHERE id = $1`, [
				ledger?.id ?? "",
			]),
		).rejects.toMatchObject({
			code: "P0001",
			message: expect.stringContaining("DELETE not permitted"),
		});
	});
});
