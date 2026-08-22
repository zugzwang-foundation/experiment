import { eq } from "drizzle-orm";
import { v7 as uuidv7 } from "uuid";
import { afterEach, describe, expect, it } from "vitest";
import { db } from "@/db";
import { lots, markets, pools, users } from "@/db/schema";
import { rankReplies, topOrder, twoSlot } from "@/lib/ranking";
import { place } from "@/server/bets/place";
import { sell } from "@/server/bets/sell";
import { runBetTransaction } from "@/server/bets/transaction";
import { loadRankingSubstrate } from "@/server/debate-view/ranking-substrate";
import { loadReplySubstrate } from "@/server/debate-view/reply-substrate";

import { testClient, testDb } from "../../db/_fixtures/db";
import { truncateTables } from "../../db/_fixtures/truncate";

/**
 * RANK-1 — **the free rank-capture, and the proof it is closed.** DB-BACKED,
 * driven through the real engine (`place` → `sell`), never through hand-written
 * rows: the exploit is a property of what the shipped write path leaves behind,
 * so a fixture that hand-sets `lots` would prove nothing about it.
 *
 * **The attack, confirmed adversarially at MERGE-1, not hypothesised.** Place a
 * large reply-bet on a rival's post. The reply lane orders on the FROZEN
 * `bets.stake`, so the reply takes the top Support (or Counter) slot and
 * `twoSlot` surfaces it to every visitor as the best argument on that side.
 * Then exit it. The CPMM is fee-less, so the round trip returns the stake minus
 * dust; `bets.stake` is Bucket-A immutable and never moves. **The slot is
 * permanent, the cost is dust, and it repeats on every post in every market.**
 *
 * Two things shipped at LOTS-1 made it worse rather than better. Per-lot sell
 * (ADR-0039 R3) made the exit SURGICAL — before it, recovering one reply's
 * stake shrank every argument the attacker held in that market pro-rata.
 * Attracted-value decay (R5) made it INVISIBLE — the captured slot now renders
 * Đ 0 attracted value beside a #1 ordering, so the one signal a reader could
 * have used to detect the manipulation reads as a rounding artifact.
 *
 * ⚠ **Both tests here are RED on `main` at `7fdaa99` and that is the point.**
 * They are the acceptance criterion for RANK-1, written before the fix. The
 * "before" halves pass on `main` (they describe the capture succeeding); the
 * "after" halves are what `main` cannot satisfy.
 *
 * There are THREE frozen-stake rulers (ADR-0039 R4, as amended by RANK-1). The
 * attracted aggregates closed at LOTS-1 S9 (`attracted-decay.test.ts`, beside
 * this file). The two here are the ones that were still open:
 *
 *   (i)  the reply-lane ordering ruler — `compareReply` on `ReplySubstrate.stake`
 *   (ii) the post-lane tiebreak — `tiebreak()` on `PostSubstrate.authorStake`,
 *        which decides `topOrder` whenever the lane margins tie. In a young
 *        market that is the COMMON case, not an edge one: every post below the
 *        activity floors is BELOW_FLOOR, so the whole list is decided by (ii).
 *        Ruler (ii) is named in no document; it was found as SURPRISE S-2.
 */

const SEED = "1000.000000000000000000";
/** 18-dp decimal string → exact scaled integer (no JS float, CLAUDE.md §2). */
const units = (v: string): bigint => BigInt(v.replace(".", ""));

const TABLES = [
	"lots",
	"bets",
	"comments",
	"positions",
	"dharma_ledger",
	"events",
	"bet_receipts",
	"pools",
	"markets",
	"users",
];

function meta(userId: string, flowId: string) {
	return {
		request_id: "test-rank-capture",
		flow_id: flowId,
		user_id: userId,
		actor_id: userId,
		idempotency_key: null,
		ip: "test",
		user_agent: "vitest",
	};
}

async function seedUser(tag: string): Promise<string> {
	const [user] = await testDb
		.insert(users)
		.values({
			name: "Rank User",
			email: `${tag}@example.com`,
			pseudonym: tag,
			tosAcceptedAt: new Date("2026-01-01T00:00:00Z"),
			lastAllowanceAccruedAt: new Date(),
		})
		.returning({ id: users.id });
	const userId = user?.id ?? "";
	const { appendLedgerRow } = await import("@/server/dharma/persist");
	await testDb.transaction((tx) =>
		appendLedgerRow(tx, {
			userId,
			amount: "5000",
			entryType: "initial_grant",
		}),
	);
	return userId;
}

async function seedOpenMarketWithPool(slug: string): Promise<string> {
	const [market] = await testDb
		.insert(markets)
		.values({
			slug,
			title: "Rank Capture Market",
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

async function placeBet(args: {
	userId: string;
	marketId: string;
	side: "YES" | "NO";
	stake: string;
	parentCommentId?: string | null;
}): Promise<{ betId: string; commentId: string }> {
	const r = await runBetTransaction(
		{ marketId: args.marketId, flow: "F-BET-1" },
		(ctx) =>
			place(ctx, {
				userId: args.userId,
				marketId: args.marketId,
				side: args.side,
				stake: args.stake,
				body: `rank argument ${uuidv7()}`,
				parentCommentId: args.parentCommentId ?? null,
				idempotencyKey: uuidv7(),
				bodyFingerprint: uuidv7(),
				betEventId: uuidv7(),
				commentEventId: uuidv7(),
				creditEventId: uuidv7(),
				metadata: meta(args.userId, "F-BET-1"),
			}),
	);
	return { betId: r.betId, commentId: r.commentId };
}

/** Exit ONE argument entirely, through the shipped per-lot sell path (R3). */
async function exitArgumentFully(args: {
	userId: string;
	marketId: string;
	betId: string;
}): Promise<{ survivingShares: string; survivingBasis: string }> {
	const [lot] = await testDb
		.select()
		.from(lots)
		.where(eq(lots.betId, args.betId));
	await runBetTransaction({ marketId: args.marketId, flow: "F-BET-3" }, (ctx) =>
		sell(ctx, {
			userId: args.userId,
			marketId: args.marketId,
			shares: lot?.survivingShares ?? "0",
			lotId: lot?.id,
			sellEventId: uuidv7(),
			syntheticBetId: uuidv7(),
			idempotencyKey: uuidv7(),
			bodyFingerprint: uuidv7(),
			metadata: meta(args.userId, "F-BET-3"),
		}),
	);
	const [after] = await testDb
		.select()
		.from(lots)
		.where(eq(lots.betId, args.betId));
	return {
		survivingShares: after?.survivingShares ?? "",
		survivingBasis: after?.survivingBasis ?? "",
	};
}

describe("RANK-1 — rank cannot be bought and refunded (ADR-0039 R4, amended)", () => {
	afterEach(async () => {
		await truncateTables(testClient, TABLES);
	});

	it("ruler (i): an exited reply-bet loses the top Support slot it bought", async () => {
		const author = await seedUser("rank-post-author");
		const attacker = await seedUser("rank-attacker");
		const honest = await seedUser("rank-honest-replier");
		const opponent = await seedUser("rank-counter-replier");
		const marketId = await seedOpenMarketWithPool("m-rank-reply-lane");

		const post = await placeBet({
			userId: author,
			marketId,
			side: "YES",
			stake: "100",
		});
		// The capture: the largest Support reply on the post takes the lane.
		const captured = await placeBet({
			userId: attacker,
			marketId,
			side: "YES",
			stake: "500",
			parentCommentId: post.commentId,
		});
		// The argument that SHOULD hold the slot once the capture is unwound.
		const genuine = await placeBet({
			userId: honest,
			marketId,
			side: "YES",
			stake: "120",
			parentCommentId: post.commentId,
		});
		// A Counter reply, so `twoSlot` returns one from each side rather than
		// two Support — the shape a reader actually sees.
		const counter = await placeBet({
			userId: opponent,
			marketId,
			side: "NO",
			stake: "60",
			parentCommentId: post.commentId,
		});

		const posts = await loadRankingSubstrate(db, { marketId });
		const parent = posts.find((p) => p.id === post.commentId);
		expect(parent).toBeDefined();

		const before = await loadReplySubstrate(db, { marketId });
		const rankedBefore = rankReplies(
			before.get(post.commentId) ?? [],
			parent?.parentSide ?? "YES",
		);
		// (b) — the capture WORKS today: top of the Support lane, and the reply
		// `twoSlot` surfaces as the best argument on that side.
		expect(rankedBefore.support.map((r) => r.id)).toEqual([
			captured.commentId,
			genuine.commentId,
		]);
		expect(twoSlot(rankedBefore).map((r) => r.id)).toEqual([
			captured.commentId,
			counter.commentId,
		]);

		// (c) — exit it, in full, through the shipped sell path.
		const lotAfter = await exitArgumentFully({
			userId: attacker,
			marketId,
			betId: captured.betId,
		});
		// (d) — the lot is Sold: nothing survives, on either column.
		expect(units(lotAfter.survivingShares)).toBe(BigInt(0));
		expect(units(lotAfter.survivingBasis)).toBe(BigInt(0));

		const after = await loadReplySubstrate(db, { marketId });
		const rankedAfter = rankReplies(
			after.get(post.commentId) ?? [],
			parent?.parentSide ?? "YES",
		);
		// ⛔ RED ON `main`. The slot is bought once and held forever there.
		expect(rankedAfter.support.map((r) => r.id)).toEqual([
			genuine.commentId,
			captured.commentId,
		]);
		expect(twoSlot(rankedAfter).map((r) => r.id)).toEqual([
			genuine.commentId,
			counter.commentId,
		]);
	});

	it("ruler (ii): an exited post loses the topOrder tiebreak it bought", async () => {
		const loud = await seedUser("rank-loud-author");
		const quiet = await seedUser("rank-quiet-author");
		const marketId = await seedOpenMarketWithPool("m-rank-post-lane");

		// TWO posts with NO replies. Every Top lane is BELOW_FLOOR — n = 0 < 5,
		// D = 0 < 200, and the dominance-split lane is gated at n >= 6 — so the
		// lane margins TIE and `topOrder` is decided ENTIRELY by `tiebreak()`,
		// i.e. by author stake. This is the young-market common case.
		const big = await placeBet({
			userId: loud,
			marketId,
			side: "YES",
			stake: "300",
		});
		const small = await placeBet({
			userId: quiet,
			marketId,
			side: "YES",
			stake: "120",
		});

		const before = await loadRankingSubstrate(db, { marketId });
		expect(topOrder(before).map((p) => p.id)).toEqual([
			big.commentId,
			small.commentId,
		]);

		const lotAfter = await exitArgumentFully({
			userId: loud,
			marketId,
			betId: big.betId,
		});
		expect(units(lotAfter.survivingShares)).toBe(BigInt(0));
		expect(units(lotAfter.survivingBasis)).toBe(BigInt(0));

		const after = await loadRankingSubstrate(db, { marketId });
		// ⛔ RED ON `main`. `tiebreak()` reads the frozen `pb.stake`, so the
		// exited post keeps the top slot its refunded money bought.
		expect(topOrder(after).map((p) => p.id)).toEqual([
			small.commentId,
			big.commentId,
		]);
	});
});
