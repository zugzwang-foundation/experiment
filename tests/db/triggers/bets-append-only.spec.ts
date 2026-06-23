import { afterEach, describe, expect, it } from "vitest";

import { bets, comments, markets, users } from "@/db/schema";
import { testClient, testDb } from "../_fixtures/db";

// Bucket A — bets. Per SPEC.2 §6.2 + 0003 lines 46-47.
// INV-1 (bet ↔ comment atomicity) is application-layer (SERIALIZABLE
// transaction in ENGINE.7); the storage-layer floor is that a bet row
// cannot be mutated post-INSERT.
//
// FK chain: users → markets → comments (with bet_id NULL — breaks the
// bets↔comments circular pair) → bets.

describe("bets — append-only trigger", () => {
	afterEach(async () => {
		await testClient.unsafe(`TRUNCATE bets, comments, markets, users CASCADE`);
	});

	it("rejects UPDATE with P0001", async () => {
		const [user] = await testDb
			.insert(users)
			.values({
				name: "Test User",
				email: "bet-test-1@example.com",
				pseudonym: "blue-fox-bet-1",
			})
			.returning({ id: users.id });

		const [market] = await testDb
			.insert(markets)
			.values({
				slug: "test-market-bet-1",
				title: "Test Market 1",
				resolutionDeadline: new Date("2027-01-01T00:00:00Z"),
			})
			.returning({ id: markets.id });

		const [comment] = await testDb
			.insert(comments)
			.values({
				userId: user?.id ?? "",
				marketId: market?.id ?? "",
				body: "test",
				sideAtPostTime: "YES",
			})
			.returning({ id: comments.id });

		const [bet] = await testDb
			.insert(bets)
			.values({
				userId: user?.id ?? "",
				marketId: market?.id ?? "",
				side: "YES",
				stake: "1",
				shareQuantity: "1",
				priceAtBet: "0.5",
				commentId: comment?.id ?? "",
			})
			.returning({ id: bets.id });

		await expect(
			testClient.unsafe(`UPDATE bets SET stake = 999 WHERE id = $1`, [
				bet?.id ?? "",
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
				email: "bet-test-2@example.com",
				pseudonym: "blue-fox-bet-2",
			})
			.returning({ id: users.id });

		const [market] = await testDb
			.insert(markets)
			.values({
				slug: "test-market-bet-2",
				title: "Test Market 2",
				resolutionDeadline: new Date("2027-01-01T00:00:00Z"),
			})
			.returning({ id: markets.id });

		const [comment] = await testDb
			.insert(comments)
			.values({
				userId: user?.id ?? "",
				marketId: market?.id ?? "",
				body: "test",
				sideAtPostTime: "YES",
			})
			.returning({ id: comments.id });

		const [bet] = await testDb
			.insert(bets)
			.values({
				userId: user?.id ?? "",
				marketId: market?.id ?? "",
				side: "YES",
				stake: "1",
				shareQuantity: "1",
				priceAtBet: "0.5",
				commentId: comment?.id ?? "",
			})
			.returning({ id: bets.id });

		await expect(
			testClient.unsafe(`DELETE FROM bets WHERE id = $1`, [bet?.id ?? ""]),
		).rejects.toMatchObject({
			code: "P0001",
			message: expect.stringContaining("DELETE not permitted"),
		});
	});
});
