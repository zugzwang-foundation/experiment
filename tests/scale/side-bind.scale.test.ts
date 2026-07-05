import { eq } from "drizzle-orm";
import { v7 as uuidv7 } from "uuid";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@sentry/nextjs", () => ({
	captureMessage: vi.fn(),
	addBreadcrumb: vi.fn(),
	captureException: vi.fn(),
}));

import { comments } from "@/db/schema";
import { place } from "@/server/bets/place";
import { sell } from "@/server/bets/sell";
import { runBetTransaction } from "@/server/bets/transaction";

import { testClient, testDb } from "../db/_fixtures/db";
import { truncateTables } from "../db/_fixtures/truncate";
import {
	seedOpenMarketWithPool,
	seedUser,
	userMetadata,
} from "./_fixtures/seed";
import { collide } from "./_harness/collide";

// ENGINE.10 — side-bind under scale (axis 4 / Q-1). INV-3: a comment's
// `side_at_post_time` is FROZEN at post-time. Concurrent post-bets on both sides
// + sell-out/re-enter-the-other-side flips must NEVER move a prior comment's
// frozen side.
//
// Q-1 FENCE (fence-first): exercised via `place()` / `sell()` ONLY. NO reply
// endpoint, NEVER a non-null `parentCommentId` (that would pre-test DEBATE.2's
// unbuilt reply validation). The side-bind CORRECTNESS half is covered here; the
// reply-posting LOAD half defers to the post-DEBATE.2 k6 stratum.
//
// DB-BACKED (local Postgres :54322).

function placeTask(args: {
	userId: string;
	marketId: string;
	side: "YES" | "NO";
	stake: string;
}): () => Promise<{ betId: string; commentId: string; side: "YES" | "NO" }> {
	const idempotencyKey = uuidv7();
	const betEventId = uuidv7();
	const commentEventId = uuidv7();
	const creditEventId = uuidv7();
	const body = `scale side-bind argument ${uuidv7()}`;
	return () =>
		runBetTransaction({ marketId: args.marketId, flow: "F-BET-1" }, (ctx) =>
			place(ctx, {
				userId: args.userId,
				marketId: args.marketId,
				side: args.side,
				stake: args.stake,
				body,
				parentCommentId: null, // INV fence — ALWAYS null, NEVER a reply
				idempotencyKey,
				bodyFingerprint: uuidv7(),
				betEventId,
				commentEventId,
				creditEventId,
				metadata: userMetadata(args.userId, "F-BET-1"),
			}),
		).then((r) => ({ betId: r.betId, commentId: r.commentId, side: r.side }));
}

async function snapshotCommentSides(
	marketId: string,
): Promise<Map<string, string>> {
	const rows = await testDb
		.select({ id: comments.id, side: comments.sideAtPostTime })
		.from(comments)
		.where(eq(comments.marketId, marketId));
	return new Map(rows.map((r) => [r.id, r.side]));
}

describe("scale — side-bind / INV-3 frozen side under flips (axis 4, Q-1)", () => {
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
			"users",
		]);
		vi.clearAllMocks();
	});

	it("side-bind::prior-comment-side-unchanged-after-concurrent-flips", async () => {
		// Phase 1: a concurrent storm of post-bets on BOTH sides, one per user
		// (single-side-per-user constraint — each user holds one side). Snapshot
		// every prior comment's frozen side.
		const marketId = await seedOpenMarketWithPool("synthetic-market-side-1");
		const userCount = 24;
		const userIds: string[] = [];
		const factories: Array<
			() => Promise<{ betId: string; commentId: string; side: "YES" | "NO" }>
		> = [];
		for (let i = 0; i < userCount; i++) {
			const userId = await seedUser(`side-${i}`, "1000");
			userIds.push(userId);
			factories.push(
				placeTask({
					userId,
					marketId,
					side: i % 2 === 0 ? "YES" : "NO",
					stake: "10",
				}),
			);
		}
		await collide(factories, { degree: 32 });

		const before = await snapshotCommentSides(marketId);
		expect(before.size).toBeGreaterThan(0);

		// Phase 2: each user sells out its full position, then re-enters the
		// OTHER side — a flip path. The flips race concurrently. Every flip writes
		// a NEW comment with the NEW side; it must NEVER mutate a prior comment.
		const flipFactories: Array<() => Promise<unknown>> = [];
		for (let i = 0; i < userCount; i++) {
			const userId = userIds[i] ?? "";
			const originalSide = i % 2 === 0 ? "YES" : "NO";
			const otherSide: "YES" | "NO" = originalSide === "YES" ? "NO" : "YES";
			flipFactories.push(async () => {
				// Sell the full held position (comment-free — no comments row).
				await runBetTransaction({ marketId, flow: "F-BET-3" }, (ctx) =>
					sell(ctx, {
						userId,
						marketId,
						// Sell a quantity guaranteed to clear the small position; the
						// CPMM sell clamps to the held amount.
						shares: "1000000",
						sellEventId: uuidv7(),
						syntheticBetId: uuidv7(),
						idempotencyKey: uuidv7(),
						bodyFingerprint: uuidv7(),
						metadata: userMetadata(userId, "F-BET-3"),
					}),
				).catch(() => undefined);
				// Re-enter the OTHER side via place() (a new comment, new frozen side).
				await placeTask({
					userId,
					marketId,
					side: otherSide,
					stake: "10",
				})().catch(() => undefined);
			});
		}
		await collide(flipFactories, { degree: 32 });

		// INV-3: every PRIOR comment's `side_at_post_time` is byte-for-byte
		// unchanged after the flip storm. (New flip comments are additive.)
		const after = await snapshotCommentSides(marketId);
		for (const [commentId, side] of before) {
			expect(after.get(commentId)).toBe(side);
		}

		// Storage-layer half of INV-3: `comments.side_at_post_time` lives in a
		// Bucket-A append-only table — a direct UPDATE of any prior comment's
		// frozen side is rejected. (Folded into the RED storm test so this §7
		// assertion is never green-from-day-one.)
		const anyPriorCommentId = [...before.keys()][0] ?? "";
		await expect(
			testClient.unsafe(
				`UPDATE comments SET side_at_post_time = 'NO' WHERE id = $1`,
				[anyPriorCommentId],
			),
		).rejects.toThrow();
	});
});
