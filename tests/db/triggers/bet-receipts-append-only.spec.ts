import { afterEach, describe, expect, it } from "vitest";

import { markets, users } from "@/db/schema";
import { testClient, testDb } from "../_fixtures/db";
import { truncateTables } from "../_fixtures/truncate";

// Bucket A — bet_receipts (AUDIT-FIX-B3 0022). The durable idempotency completion
// record: written as the LAST write inside BOTH place() and sell() W-1 callbacks,
// its unique `idempotency_key` 23505s any replay and its stored `result` answers
// it deterministically. Like every Bucket-A table, the storage-layer floor is that
// a row cannot be mutated post-INSERT (0003 row-level UPDATE/DELETE guards reused;
// TRUNCATE covered by truncate-rejected.spec.ts).
//
// FK chain: users → markets → bet_receipts (user_id + market_id both NOT NULL,
// onDelete restrict). Insert via raw `testClient.unsafe` — the `betReceipts`
// drizzle table lands in the same 0022 schema edit, so the spec bypasses it and
// hits the trigger directly (SPEC.2 §6.6 fixture-bypass posture).
//
// COLLECTION-RED until 0022: `bet_receipts` (table + triggers) does not exist yet,
// so both the seed INSERT and the truncateTables teardown fail — correct RED until
// the executor applies the migration.

async function seedUserAndMarket(
	tag: string,
): Promise<{ userId: string; marketId: string }> {
	const [user] = await testDb
		.insert(users)
		.values({
			name: "Receipt User",
			email: `${tag}@example.com`,
			pseudonym: `receipt-${tag}`,
		})
		.returning({ id: users.id });
	const [market] = await testDb
		.insert(markets)
		.values({
			slug: `receipt-market-${tag}`,
			title: "Receipt Market",
			resolutionDeadline: new Date("2027-01-01T00:00:00Z"),
		})
		.returning({ id: markets.id });
	return { userId: user?.id ?? "", marketId: market?.id ?? "" };
}

async function insertReceipt(
	userId: string,
	marketId: string,
	idempotencyKey: string,
): Promise<string> {
	const rows = await testClient.unsafe<Array<{ id: string }>>(
		`INSERT INTO bet_receipts
		   (idempotency_key, body_fingerprint, user_id, market_id, flow, result)
		 VALUES ($1, $2, $3, $4, 'place', '{}'::jsonb)
		 RETURNING id`,
		[idempotencyKey, "fp-append-only", userId, marketId],
	);
	return rows[0]?.id ?? "";
}

describe("bet_receipts — append-only trigger", () => {
	afterEach(async () => {
		await truncateTables(testClient, ["bet_receipts", "markets", "users"]);
	});

	it("rejects UPDATE with P0001", async () => {
		const { userId, marketId } = await seedUserAndMarket("upd");
		const id = await insertReceipt(userId, marketId, "receipt-upd-key");

		await expect(
			testClient.unsafe(
				`UPDATE bet_receipts SET body_fingerprint = 'mutated' WHERE id = $1`,
				[id],
			),
		).rejects.toMatchObject({
			code: "P0001",
			message: expect.stringContaining("UPDATE not permitted"),
		});
	});

	it("rejects DELETE with P0001", async () => {
		const { userId, marketId } = await seedUserAndMarket("del");
		const id = await insertReceipt(userId, marketId, "receipt-del-key");

		await expect(
			testClient.unsafe(`DELETE FROM bet_receipts WHERE id = $1`, [id]),
		).rejects.toMatchObject({
			code: "P0001",
			message: expect.stringContaining("DELETE not permitted"),
		});
	});
});
