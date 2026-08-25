import { eq } from "drizzle-orm";
import { v7 as uuidv7 } from "uuid";
import { afterEach, describe, expect, it } from "vitest";
import { db } from "@/db";
import { lots, markets, pools, users } from "@/db/schema";
import { place } from "@/server/bets/place";
import { sell } from "@/server/bets/sell";
import { runBetTransaction } from "@/server/bets/transaction";
import { loadRankingSubstrate } from "@/server/debate-view/ranking-substrate";
import { loadReplySubstrate } from "@/server/debate-view/reply-substrate";
import { loadProfileArguments } from "@/server/profile/arguments";

import { testClient, testDb } from "../../db/_fixtures/db";
import { truncateTables } from "../../db/_fixtures/truncate";

/**
 * RANK-1 R-F — **the decay reaches EVERY read site, not just the tested one.**
 *
 * The stake block is duplicated across separately-maintained query sites, and
 * before this file only `ranking-substrate.ts` was exercised (by
 * `attracted-decay.test.ts`, beside it). A copy that drifts therefore shipped
 * green — which is not hypothetical: `scripts/verify-ranking-staging.ts` HAD
 * drifted, and had been computing a different order from the application ever
 * since LOTS-1 landed, with nothing to say so.
 *
 * Each test below drives the real engine (`place` → `sell`) and then asserts, at
 * one site, all three halves of the substitution together:
 *
 *   1. the CURRENT figure fell (the ruler moved),
 *   2. the FROZEN original is intact (nothing was erased — R9), and
 *   3. `Sold` is exact — true only at zero surviving, never on a partial (R6).
 *
 * Asserting them together matters: a site that returned the surviving basis but
 * dropped the original would pass a decay-only test while rendering a badge
 * with no history, and a site that flipped `Sold` on a partial would pass both
 * while overstating what happened.
 */

const SEED = "1000.000000000000000000";
const units = (v: string): bigint => BigInt(v.replace(".", ""));
const dp18 = (v: string): string => {
	const [int, frac = ""] = v.split(".");
	return `${int}.${frac.padEnd(18, "0")}`;
};

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
		request_id: "test-rank-decay-parity",
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
			name: "Parity User",
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
				body: `parity argument ${uuidv7()}`,
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

async function sellShares(args: {
	userId: string;
	marketId: string;
	betId: string;
	/** "half" exercises R6's partial branch; "all" exercises the Sold branch. */
	amount: "half" | "all";
}): Promise<void> {
	const [lot] = await testDb
		.select()
		.from(lots)
		.where(eq(lots.betId, args.betId));
	let shares = lot?.survivingShares ?? "0";
	if (args.amount === "half") {
		const SCALE = BigInt(`1${"0".repeat(18)}`);
		const half = units(shares) / BigInt(2);
		shares = `${half / SCALE}.${(half % SCALE).toString().padStart(18, "0")}`;
	}
	await runBetTransaction({ marketId: args.marketId, flow: "F-BET-3" }, (ctx) =>
		sell(ctx, {
			userId: args.userId,
			marketId: args.marketId,
			shares,
			lotId: lot?.id,
			sellEventId: uuidv7(),
			syntheticBetId: uuidv7(),
			idempotencyKey: uuidv7(),
			bodyFingerprint: uuidv7(),
			metadata: meta(args.userId, "F-BET-3"),
		}),
	);
}

/**
 * One market: an author who posts Đ200 and then sells HALF of it (partial — a
 * reduced figure and NO tag), and a replier who stakes Đ200 and then exits
 * ENTIRELY (Sold). Two branches, one fixture, so every site below is asked the
 * same question.
 */
async function seedPartialAndFullExit(slug: string) {
	const author = await seedUser(`${slug}-author`);
	const replier = await seedUser(`${slug}-replier`);
	const [market] = await testDb
		.insert(markets)
		.values({
			slug,
			title: "Parity Market",
			status: "Open",
			resolutionDeadline: new Date("2026-11-01T00:00:00Z"),
		})
		.returning({ id: markets.id });
	const marketId = market?.id ?? "";
	await testDb
		.insert(pools)
		.values({ marketId, yesReserves: SEED, noReserves: SEED });

	const post = await placeBet({
		userId: author,
		marketId,
		side: "YES",
		stake: "200",
	});
	const reply = await placeBet({
		userId: replier,
		marketId,
		side: "YES",
		stake: "200",
		parentCommentId: post.commentId,
	});

	await sellShares({
		userId: author,
		marketId,
		betId: post.betId,
		amount: "half",
	});
	await sellShares({
		userId: replier,
		marketId,
		betId: reply.betId,
		amount: "all",
	});

	return { author, replier, marketId, post, reply };
}

describe("RANK-1 R-F — the decay is the same at every read site", () => {
	afterEach(async () => {
		await truncateTables(testClient, TABLES);
	});

	it("an UNTOUCHED argument returns byte-identical current and original", async () => {
		// ⚠ THE BADGE DEPENDS ON THIS AND NOTHING ELSE ASSERTS IT. Every other
		// assertion in this file compares through `units()`, i.e. numerically — so a
		// scale divergence between `COALESCE(lots.surviving_basis, bets.stake)` and
		// `bets.stake` (say "100" against "100.000000000000000000") would satisfy all
		// of them while making `originalStake !== authorStake` true for EVERY
		// argument in the product, painting a strikethrough across arguments nobody
		// has touched. The comparison the render does is a STRING comparison, so the
		// guard has to be one too.
		const author = await seedUser("m-untouched-author");
		const [market] = await testDb
			.insert(markets)
			.values({
				slug: "m-untouched",
				title: "Untouched Market",
				status: "Open",
				resolutionDeadline: new Date("2026-11-01T00:00:00Z"),
			})
			.returning({ id: markets.id });
		const marketId = market?.id ?? "";
		await testDb
			.insert(pools)
			.values({ marketId, yesReserves: SEED, noReserves: SEED });
		const post = await placeBet({
			userId: author,
			marketId,
			side: "YES",
			stake: "200",
		});

		const rows = await loadRankingSubstrate(db, { marketId });
		const row = rows.find((r) => r.id === post.commentId);
		expect(row?.authorStake).toBe(row?.authorStakeOriginal);
		expect(row?.authorSold).toBe(false);

		// …and the same on the profile path, where the two go through DIFFERENT
		// code (`toFixed18` on replies, raw on posts) and could diverge separately.
		const items = await loadProfileArguments(db, { userId: author });
		const item = items.find((i) => i.id === post.commentId);
		if (item === undefined || item.removed || item.kind !== "post") {
			throw new Error("expected a present post item");
		}
		expect(item.authorStake).toBe(item.authorStakeOriginal);
	});

	it("site 1 — loadRankingSubstrate: author basis halves, original intact, not Sold", async () => {
		const f = await seedPartialAndFullExit("m-parity-substrate");
		const rows = await loadRankingSubstrate(db, { marketId: f.marketId });
		const row = rows.find((r) => r.id === f.post.commentId);

		// 1 — the ruler moved.
		expect(units(row?.authorStake ?? "0")).toBe(units(dp18("100")));
		// 2 — the frozen commitment is intact (R9: nothing is erased).
		expect(units(row?.authorStakeOriginal ?? "0")).toBe(units(dp18("200")));
		// 3 — R6: a PARTIAL sale is a reduced figure and NO tag.
		expect(row?.authorSold).toBe(false);
		// …and the reply that exited entirely withdrew its attracted weight.
		expect(units(row?.supportDharma ?? "0")).toBe(BigInt(0));
		expect(row?.supportCount).toBe(1); // the argument still exists
	});

	it("site 4 — loadReplySubstrate: the exited reply reads zero and Sold is exact", async () => {
		const f = await seedPartialAndFullExit("m-parity-reply");
		const byParent = await loadReplySubstrate(db, { marketId: f.marketId });
		const reply = (byParent.get(f.post.commentId) ?? []).find(
			(r) => r.id === f.reply.commentId,
		);

		expect(units(reply?.stake ?? "-1")).toBe(BigInt(0));
		expect(units(reply?.stakeOriginal ?? "0")).toBe(units(dp18("200")));
		expect(reply?.sold).toBe(true);
	});

	it("site 2 — loadProfileArguments: BOTH the post ruler and the reply ruler decay", async () => {
		const f = await seedPartialAndFullExit("m-parity-profile");

		const authorItems = await loadProfileArguments(db, { userId: f.author });
		const postItem = authorItems.find((i) => i.id === f.post.commentId);
		if (
			postItem === undefined ||
			postItem.removed ||
			postItem.kind !== "post"
		) {
			throw new Error("expected a present post item on the author's profile");
		}
		expect(units(postItem.authorStake)).toBe(units(dp18("100")));
		expect(units(postItem.authorStakeOriginal)).toBe(units(dp18("200")));
		expect(postItem.authorSold).toBe(false);

		const replierItems = await loadProfileArguments(db, { userId: f.replier });
		const replyItem = replierItems.find((i) => i.id === f.reply.commentId);
		if (
			replyItem === undefined ||
			replyItem.removed ||
			replyItem.kind !== "reply"
		) {
			throw new Error("expected a present reply item on the replier's profile");
		}
		expect(units(replyItem.stake)).toBe(BigInt(0));
		expect(units(replyItem.stakeOriginal)).toBe(units(dp18("200")));
		expect(replyItem.sold).toBe(true);
	});

	// UNWIRE-1-RESOLVE — "site 3 — loadBookmarks: the same, on the cross-author
	// read" removed whole: the bookmark module is unwired product-wide
	// (UNWIRE-1), and RANK-1's own parity claim ("the decay is the same at
	// every read site") no longer has this site to be parity with. Sites 1
	// (loadRankingSubstrate), 2 (loadProfileArguments) and 4
	// (loadReplySubstrate) are untouched and still exercise the same claim
	// over the surviving read sites.
});
