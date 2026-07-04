import { afterEach, describe, expect, it } from "vitest";

import { comments, markets, users } from "@/db/schema";
import { testClient, testDb } from "../_fixtures/db";
import { truncateTables } from "../_fixtures/truncate";

// Bucket A — comments. Per SPEC.2 §6.2 + 0003 lines 48-49.
// Case 1 (UPDATE rejected) is the literal INV-3 mechanism — comments is
// Bucket A and side_at_post_time cannot mutate post-INSERT because the
// entire row cannot. Storage-layer mechanism of INV-3 (comments side-bound).
//
// FK chain: users → markets → comments (bet_id NULL).

describe("comments — append-only trigger", () => {
	afterEach(async () => {
		await truncateTables(testClient, ["comments", "markets", "users"]);
	});

	it("rejects UPDATE with P0001", async () => {
		const [user] = await testDb
			.insert(users)
			.values({
				name: "Test User",
				email: "cmt-test-1@example.com",
				pseudonym: "blue-fox-cmt-1",
			})
			.returning({ id: users.id });

		const [market] = await testDb
			.insert(markets)
			.values({
				slug: "test-market-cmt-1",
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

		await expect(
			testClient.unsafe(`UPDATE comments SET body = 'changed' WHERE id = $1`, [
				comment?.id ?? "",
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
				email: "cmt-test-2@example.com",
				pseudonym: "blue-fox-cmt-2",
			})
			.returning({ id: users.id });

		const [market] = await testDb
			.insert(markets)
			.values({
				slug: "test-market-cmt-2",
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

		await expect(
			testClient.unsafe(`DELETE FROM comments WHERE id = $1`, [
				comment?.id ?? "",
			]),
		).rejects.toMatchObject({
			code: "P0001",
			message: expect.stringContaining("DELETE not permitted"),
		});
	});
});
