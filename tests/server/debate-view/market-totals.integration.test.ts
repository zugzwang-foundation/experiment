import { afterEach, describe, expect, it, vi } from "vitest";

// DEBATE.4 §8 tests-first (plan §5 / D1) — the RED driver for `getMarketTotals`,
// the NEW market-header aggregate read-model: total Dharma staked (SUM of all
// `bets.stake` for the market), post count (comments with parent_comment_id IS
// NULL), reply count (parent_comment_id IS NOT NULL). The DEBATE.4 MarketHeader
// renders these three attrs (Đ staked · posts · replies).
//
// RED target: `@/server/debate-view/market-totals` does NOT yet exist, so this
// file fails at COLLECTION until the implement phase lands the loader.
//
// Each post/reply rides a `bets` row of known stake (the only path to a
// SUM(bets.stake) the loader can read) — `bets.comment_id` is the populated
// direction; `comments.bet_id` stays NULL (SPEC.2 §14.1). Posts/replies are
// otherwise direct-seeded (the loader is a pure read).
//
// DB-backed (local Postgres :54322). TRUNCATE in afterEach. Money crosses as a
// STRING (CLAUDE.md §2); counts are integers.

vi.mock("@sentry/nextjs", () => ({
	captureMessage: vi.fn(),
	addBreadcrumb: vi.fn(),
	captureException: vi.fn(),
}));

import { bets, comments, markets, pools, users } from "@/db/schema";
// The RED import: greenfield loader under test.
import { getMarketTotals } from "@/server/debate-view/market-totals";

import { testClient, testDb } from "../../db/_fixtures/db";
import { truncateTables } from "../../db/_fixtures/truncate";

const SEED = "100.000000000000000000";

async function seedUser(tag: string): Promise<string> {
	const [user] = await testDb
		.insert(users)
		.values({
			name: "Totals User",
			email: `${tag}@example.com`,
			pseudonym: tag,
		})
		.returning({ id: users.id });
	return user?.id ?? "";
}

async function seedMarket(slug: string): Promise<string> {
	const [market] = await testDb
		.insert(markets)
		.values({
			slug,
			title: "Totals Market",
			status: "Open",
			resolutionDeadline: new Date("2026-11-01T00:00:00Z"),
		})
		.returning({ id: markets.id });
	const marketId = market?.id ?? "";
	await testDb
		.insert(pools)
		.values({ marketId, yesReserves: SEED, noReserves: SEED });
	return marketId;
}

/** Direct-seed a comment + its riding bet (the only way to give it a stake). */
async function seedCommentWithBet(args: {
	userId: string;
	marketId: string;
	side: "YES" | "NO";
	stake: string;
	parentCommentId: string | null;
	createdAt: Date;
}): Promise<string> {
	const [c] = await testDb
		.insert(comments)
		.values({
			userId: args.userId,
			marketId: args.marketId,
			body: args.parentCommentId === null ? "post" : "reply",
			sideAtPostTime: args.side,
			parentCommentId: args.parentCommentId,
			betId: null,
			createdAt: args.createdAt,
		})
		.returning({ id: comments.id });
	const commentId = c?.id ?? "";
	await testDb.insert(bets).values({
		userId: args.userId,
		marketId: args.marketId,
		side: args.side,
		stake: args.stake,
		shareQuantity: "0",
		priceAtBet: "0.5",
		commentId,
		createdAt: args.createdAt,
	});
	return commentId;
}

describe("DEBATE.4 §5 — getMarketTotals (dharma staked + post/reply counts)", () => {
	afterEach(async () => {
		await truncateTables(testClient, [
			"events",
			"payout_events",
			"resolution_events",
			"dharma_ledger",
			"bets",
			"comments",
			"positions",
			"pools",
			"markets",
			"mod_actions",
			"users",
		]);
		vi.clearAllMocks();
	});

	it("sums all bet stakes; counts posts vs replies exactly", async () => {
		const marketId = await seedMarket("totals-market");
		const u = await seedUser("totals-a");

		// 2 posts (stakes 100 + 250) + 3 replies (stakes 10 + 20 + 30).
		// Σ stake = 100 + 250 + 10 + 20 + 30 = 410.
		const p1 = await seedCommentWithBet({
			userId: u,
			marketId,
			side: "YES",
			stake: "100.000000000000000000",
			parentCommentId: null,
			createdAt: new Date("2026-09-15T00:00:01Z"),
		});
		const p2 = await seedCommentWithBet({
			userId: u,
			marketId,
			side: "NO",
			stake: "250.000000000000000000",
			parentCommentId: null,
			createdAt: new Date("2026-09-15T00:00:02Z"),
		});
		await seedCommentWithBet({
			userId: u,
			marketId,
			side: "YES",
			stake: "10.000000000000000000",
			parentCommentId: p1,
			createdAt: new Date("2026-09-15T01:00:00Z"),
		});
		await seedCommentWithBet({
			userId: u,
			marketId,
			side: "NO",
			stake: "20.000000000000000000",
			parentCommentId: p1,
			createdAt: new Date("2026-09-15T01:00:01Z"),
		});
		await seedCommentWithBet({
			userId: u,
			marketId,
			side: "YES",
			stake: "30.000000000000000000",
			parentCommentId: p2,
			createdAt: new Date("2026-09-15T01:00:02Z"),
		});

		const totals = await getMarketTotals(testDb, marketId);

		// SUM(bets.stake) as a canonical 18-dp decimal string.
		expect(totals.dharmaStaked).toBe("410.000000000000000000");
		expect(totals.postCount).toBe(2);
		expect(totals.replyCount).toBe(3);
	});

	it("empty market → dharmaStaked '0', zero counts (no bets, no comments)", async () => {
		const marketId = await seedMarket("totals-empty");

		const totals = await getMarketTotals(testDb, marketId);

		// "0" (or canonical equivalent) when there are no bets — COALESCE(SUM,0).
		expect(Number(totals.dharmaStaked)).toBe(0);
		expect(totals.postCount).toBe(0);
		expect(totals.replyCount).toBe(0);
	});
});
