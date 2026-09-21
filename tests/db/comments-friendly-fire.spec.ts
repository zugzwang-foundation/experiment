import { afterEach, describe, expect, it } from "vitest";

import { comments, markets, pools, users } from "@/db/schema";
import { testClient, testDb } from "./_fixtures/db";
import { truncateTables } from "./_fixtures/truncate";

// FF-1 · G1 + G2 — `comments.friendly_fire` (ADR-0058 / D-51; migration
// `0031_comments_friendly_fire`).
//
// G1 — the column exists with `DEFAULT false NOT NULL`, and the table CHECK
//      `comments_friendly_fire_requires_parent` refuses a TOP-LEVEL row that
//      carries `friendly_fire = true`. Rejects: a flagged post. The positive
//      control is the legal shape — a REPLY row with the flag inserts.
// G2 — an UPDATE that would set (or clear) the flag on an existing row is
//      refused by the Bucket-A trigger `bucket_a_no_update` (migration 0003),
//      with the trigger's own message. Rejects: a mutable flag. The positive
//      control is the same UPDATE shape against a Bucket-C table (`pools`),
//      which succeeds — proving the refusal comes from the trigger and not
//      from the harness.
//
// Storage-layer only: rows are direct-seeded through the Drizzle client (the
// SPEC.2 §6.6 fixture posture), so the trigger and the CHECK are the only
// enforcement under test. The same-side half of eligibility is NOT here — it
// needs the parent row and lives on the write path
// (tests/server/comments/friendly-fire.test.ts).

async function seedUserMarket(tag: string) {
	const [user] = await testDb
		.insert(users)
		.values({
			name: "FF User",
			email: `${tag}@example.com`,
			pseudonym: `ff-${tag}`,
		})
		.returning({ id: users.id });
	const [market] = await testDb
		.insert(markets)
		.values({
			slug: `ff-market-${tag}`,
			title: "FF Market",
			resolutionDeadline: new Date("2027-01-01T00:00:00Z"),
		})
		.returning({ id: markets.id });
	const userId = user?.id ?? "";
	const marketId = market?.id ?? "";
	await testDb.insert(pools).values({
		marketId,
		yesReserves: "100.000000000000000000",
		noReserves: "100.000000000000000000",
	});
	return { userId, marketId };
}

describe("comments.friendly_fire — G1 column + CHECK", () => {
	afterEach(async () => {
		await truncateTables(testClient, ["comments", "pools", "markets", "users"]);
	});

	it("G1 · the column exists, boolean, NOT NULL, DEFAULT false", async () => {
		const rows = await testClient.unsafe(
			`SELECT data_type, is_nullable, column_default
			   FROM information_schema.columns
			  WHERE table_schema = 'public' AND table_name = 'comments'
			    AND column_name = 'friendly_fire'`,
		);
		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({
			data_type: "boolean",
			is_nullable: "NO",
			column_default: "false",
		});
	});

	it("G1 · an INSERT that omits the column reads back false", async () => {
		const { userId, marketId } = await seedUserMarket("g1-default");
		const [post] = await testDb
			.insert(comments)
			.values({ userId, marketId, body: "a post", sideAtPostTime: "YES" })
			.returning({ id: comments.id, friendlyFire: comments.friendlyFire });
		expect(post?.friendlyFire).toBe(false);
	});

	it("G1 · a TOP-LEVEL row with friendly_fire = true is refused by the CHECK (23514)", async () => {
		const { userId, marketId } = await seedUserMarket("g1-check");
		await expect(
			testClient.unsafe(
				`INSERT INTO comments (user_id, market_id, body, side_at_post_time, friendly_fire)
				 VALUES ($1, $2, 'a flagged post', 'YES', true)`,
				[userId, marketId],
			),
		).rejects.toMatchObject({
			code: "23514",
			constraint_name: "comments_friendly_fire_requires_parent",
		});
		// Nothing landed.
		const count = await testClient.unsafe(
			`SELECT count(*)::int AS n FROM comments WHERE market_id = $1`,
			[marketId],
		);
		expect(count[0]?.n).toBe(0);
	});

	it("G1 · POSITIVE CONTROL — a REPLY row with friendly_fire = true inserts (the CHECK admits the legal shape)", async () => {
		const { userId, marketId } = await seedUserMarket("g1-legal");
		const [post] = await testDb
			.insert(comments)
			.values({ userId, marketId, body: "a post", sideAtPostTime: "YES" })
			.returning({ id: comments.id });
		const [reply] = await testDb
			.insert(comments)
			.values({
				userId,
				marketId,
				body: "a friendly-fire reply",
				sideAtPostTime: "YES",
				parentCommentId: post?.id ?? "",
				friendlyFire: true,
			})
			.returning({ id: comments.id, friendlyFire: comments.friendlyFire });
		expect(reply?.friendlyFire).toBe(true);
	});
});

describe("comments.friendly_fire — G2 the flag is immutable (Bucket-A trigger)", () => {
	afterEach(async () => {
		await truncateTables(testClient, ["comments", "pools", "markets", "users"]);
	});

	it("G2 · UPDATE … SET friendly_fire = true on a reply is refused with the trigger's message", async () => {
		const { userId, marketId } = await seedUserMarket("g2-set");
		const [post] = await testDb
			.insert(comments)
			.values({ userId, marketId, body: "a post", sideAtPostTime: "YES" })
			.returning({ id: comments.id });
		const [reply] = await testDb
			.insert(comments)
			.values({
				userId,
				marketId,
				body: "a plain support reply",
				sideAtPostTime: "YES",
				parentCommentId: post?.id ?? "",
			})
			.returning({ id: comments.id });
		await expect(
			testClient.unsafe(
				`UPDATE comments SET friendly_fire = true WHERE id = $1`,
				[reply?.id ?? ""],
			),
		).rejects.toMatchObject({
			code: "P0001",
			message: expect.stringContaining(
				"append-only violation on table public.comments: UPDATE not permitted",
			),
		});
		// …and the flag did not move.
		const after = await testClient.unsafe(
			`SELECT friendly_fire FROM comments WHERE id = $1`,
			[reply?.id ?? ""],
		);
		expect(after[0]?.friendly_fire).toBe(false);
	});

	it("G2 · UPDATE … SET friendly_fire = false on a flagged reply is refused too (no un-firing)", async () => {
		const { userId, marketId } = await seedUserMarket("g2-clear");
		const [post] = await testDb
			.insert(comments)
			.values({ userId, marketId, body: "a post", sideAtPostTime: "NO" })
			.returning({ id: comments.id });
		const [reply] = await testDb
			.insert(comments)
			.values({
				userId,
				marketId,
				body: "a friendly-fire reply",
				sideAtPostTime: "NO",
				parentCommentId: post?.id ?? "",
				friendlyFire: true,
			})
			.returning({ id: comments.id });
		await expect(
			testClient.unsafe(
				`UPDATE comments SET friendly_fire = false WHERE id = $1`,
				[reply?.id ?? ""],
			),
		).rejects.toMatchObject({
			code: "P0001",
			message: expect.stringContaining("UPDATE not permitted"),
		});
		const after = await testClient.unsafe(
			`SELECT friendly_fire FROM comments WHERE id = $1`,
			[reply?.id ?? ""],
		);
		expect(after[0]?.friendly_fire).toBe(true);
	});

	it("G2 · POSITIVE CONTROL — the same UPDATE shape against a Bucket-C table (pools) succeeds", async () => {
		const { marketId } = await seedUserMarket("g2-control");
		const result = await testClient.unsafe(
			`UPDATE pools SET yes_reserves = yes_reserves WHERE market_id = $1`,
			[marketId],
		);
		expect(result.count).toBe(1);
	});
});
