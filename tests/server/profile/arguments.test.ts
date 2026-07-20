import { v7 as uuidv7 } from "uuid";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@sentry/nextjs", () => ({
	captureMessage: vi.fn(),
	addBreadcrumb: vi.fn(),
	captureException: vi.fn(),
}));

import { bets, comments, markets, modActions, pools, users } from "@/db/schema";
import { deriveTitleTeaser } from "@/server/debate-view/load-debate-view";
import { loadProfileArguments } from "@/server/profile/arguments";

import { testClient, testDb } from "../../db/_fixtures/db";
import { truncateTables } from "../../db/_fixtures/truncate";

// UI.A5 Slice 3 §5.6 tests-first (plan §2 row 3 + §11 extras). SPEC.1 1.0.18
// §23 "The argument list" (L1517) + RANKING.md §3.6 (L152-160) + SPEC.1 §9
// deep-link ordinals + plan §13 items 3/13. The VALUE import from
// `@/server/profile/arguments` FAILS at collection until Slice 3 lands —
// red-for-the-right-reason. DB-BACKED (local Postgres :54322).
//
// Order (§3.6, by reference to `profileOrder`): the user's top-level POSTS by
// attracted D = supportDharma + counterDharma DESC, then the user's REPLIES by
// their OWN reply-bet stake DESC, ALL posts above ALL replies (different
// rulers). Deep-links (§9): a post → its OWN 1-based ordinal over the market's
// top-level comments (removed INCLUDED); a reply → its PARENT post's ordinal,
// with `repliedToTitle` = the parent's derived title (null if the parent is
// removed — no leak). Reply-bets are reached via `bets.comment_id`, never
// `comments.bet_id`; Support ⟺ reply side = parent side.

const POOL = "100.000000000000000000";

function dp18(intStr: string): string {
	return `${intStr}.000000000000000000`;
}

async function seedUser(pseudonym: string, emailTag: string): Promise<string> {
	const id = uuidv7();
	await testDb.insert(users).values({
		id,
		name: `Fixture ${emailTag}`,
		email: `${emailTag}@example.com`,
		pseudonym,
		emailVerified: false,
	});
	return id;
}

async function seedMarket(
	slug: string,
	status: "Open" | "Closed" | "Resolving" | "Resolved" | "Voided" | "Frozen",
	resolved?: { outcome: "YES" | "NO" },
): Promise<string> {
	const id = uuidv7();
	await testDb.insert(markets).values({
		id,
		slug,
		title: `Market ${slug}`,
		status,
		resolutionDeadline: new Date("2026-11-01T00:00:00Z"),
		resolvedAt: resolved ? new Date("2026-10-15T00:00:00Z") : null,
		resolutionOutcome: resolved?.outcome ?? null,
	});
	return id;
}

async function seedPool(
	marketId: string,
	yes = POOL,
	no = POOL,
): Promise<void> {
	await testDb
		.insert(pools)
		.values({ marketId, yesReserves: yes, noReserves: no });
}

async function seedComment(args: {
	userId: string;
	marketId: string;
	body: string;
	side: "YES" | "NO";
	parentCommentId?: string;
	createdAt: Date;
}): Promise<string> {
	const id = uuidv7();
	await testDb.insert(comments).values({
		id,
		userId: args.userId,
		marketId: args.marketId,
		parentCommentId: args.parentCommentId ?? null,
		body: args.body,
		sideAtPostTime: args.side,
		createdAt: args.createdAt,
	});
	return id;
}

async function seedBet(args: {
	userId: string;
	marketId: string;
	side: "YES" | "NO";
	stake: string;
	shares: string;
	commentId: string;
	createdAt: Date;
}): Promise<string> {
	const id = uuidv7();
	await testDb.insert(bets).values({
		id,
		userId: args.userId,
		marketId: args.marketId,
		side: args.side,
		stake: args.stake,
		shareQuantity: args.shares,
		priceAtBet: "0.500000000000000000",
		commentId: args.commentId,
		createdAt: args.createdAt,
	});
	return id;
}

async function seedRemoval(commentId: string): Promise<void> {
	await testDb.insert(modActions).values({
		targetCommentId: commentId,
		reason: "content_removed",
		categories: {},
		actorId: "admin-singleton",
	});
}

/** Seed a top-level post + its author entry-bet (INV-1); returns the comment id. */
async function seedPost(args: {
	userId: string;
	marketId: string;
	body: string;
	side: "YES" | "NO";
	authorStake: string;
	createdAt: Date;
}): Promise<string> {
	const commentId = await seedComment({
		userId: args.userId,
		marketId: args.marketId,
		body: args.body,
		side: args.side,
		createdAt: args.createdAt,
	});
	await seedBet({
		userId: args.userId,
		marketId: args.marketId,
		side: args.side,
		stake: args.authorStake,
		shares: args.authorStake,
		commentId,
		createdAt: args.createdAt,
	});
	return commentId;
}

/** Seed a reply comment + its reply-bet (INV-1); returns the reply comment id. */
async function seedReply(args: {
	userId: string;
	marketId: string;
	parentCommentId: string;
	body: string;
	side: "YES" | "NO";
	stake: string;
	createdAt: Date;
}): Promise<string> {
	const commentId = await seedComment({
		userId: args.userId,
		marketId: args.marketId,
		parentCommentId: args.parentCommentId,
		body: args.body,
		side: args.side,
		createdAt: args.createdAt,
	});
	await seedBet({
		userId: args.userId,
		marketId: args.marketId,
		side: args.side,
		stake: args.stake,
		shares: args.stake,
		commentId,
		createdAt: args.createdAt,
	});
	return commentId;
}

const TRUNCATE_LIST = [
	"events",
	"payout_events",
	"resolution_events",
	"mod_actions",
	"dharma_ledger",
	"bets",
	"comments",
	"positions",
	"pools",
	"markets",
	"users",
];

describe("UI.A5 Slice 3 — loadProfileArguments (RANKING.md §3.6 + §9 deep-links)", () => {
	afterEach(async () => {
		await truncateTables(testClient, TRUNCATE_LIST);
		vi.clearAllMocks();
	});

	it("ranking-3-6-order", async () => {
		// userA authors 3 posts (attracted D = 100, 300, 50 via other users'
		// reply-bets) + 2 replies (own stakes 80, 40) across 2 markets. §3.6 order:
		// posts by D DESC, then replies by own stake DESC, ALL posts above ALL
		// replies. Expected: post(300), post(100), post(50), reply(80), reply(40).
		// Note post(50) sits ABOVE reply(80) — different rulers, posts always first.
		const userA = await seedUser("rank-author", "rank-author");
		const userB = await seedUser("rank-replier", "rank-replier");
		const userC = await seedUser("rank-parent", "rank-parent");

		const m1 = await seedMarket("m-rank-1", "Open");
		await seedPool(m1);
		const m2 = await seedMarket("m-rank-2", "Open");
		await seedPool(m2);

		// Post1 (m1, D = 100 Support).
		const post1 = await seedPost({
			userId: userA,
			marketId: m1,
			body: "Ranked post one attracting one hundred",
			side: "YES",
			authorStake: dp18("10"),
			createdAt: new Date("2026-09-10T10:00:00Z"),
		});
		await seedReply({
			userId: userB,
			marketId: m1,
			parentCommentId: post1,
			body: "Support reply attracting D to post one",
			side: "YES",
			stake: dp18("100"),
			createdAt: new Date("2026-09-11T10:00:00Z"),
		});

		// Post2 (m1, D = 300 Support).
		const post2 = await seedPost({
			userId: userA,
			marketId: m1,
			body: "Ranked post two attracting three hundred",
			side: "YES",
			authorStake: dp18("10"),
			createdAt: new Date("2026-09-10T11:00:00Z"),
		});
		await seedReply({
			userId: userB,
			marketId: m1,
			parentCommentId: post2,
			body: "Support reply attracting D to post two",
			side: "YES",
			stake: dp18("300"),
			createdAt: new Date("2026-09-11T11:00:00Z"),
		});

		// Post3 (m2, D = 50 Support).
		const post3 = await seedPost({
			userId: userA,
			marketId: m2,
			body: "Ranked post three attracting fifty",
			side: "YES",
			authorStake: dp18("10"),
			createdAt: new Date("2026-09-10T12:00:00Z"),
		});
		await seedReply({
			userId: userB,
			marketId: m2,
			parentCommentId: post3,
			body: "Support reply attracting D to post three",
			side: "YES",
			stake: dp18("50"),
			createdAt: new Date("2026-09-11T12:00:00Z"),
		});

		// userA's replies hang under userC's posts (parents excluded from userA's
		// list). Reply1 stake 80 (m1); Reply2 stake 40 (m2).
		const parentA = await seedPost({
			userId: userC,
			marketId: m1,
			body: "Parent post A for user A reply one",
			side: "YES",
			authorStake: dp18("10"),
			createdAt: new Date("2026-09-09T10:00:00Z"),
		});
		const reply1 = await seedReply({
			userId: userA,
			marketId: m1,
			parentCommentId: parentA,
			body: "User A reply one with stake eighty",
			side: "YES",
			stake: dp18("80"),
			createdAt: new Date("2026-09-12T10:00:00Z"),
		});

		const parentB = await seedPost({
			userId: userC,
			marketId: m2,
			body: "Parent post B for user A reply two",
			side: "YES",
			authorStake: dp18("10"),
			createdAt: new Date("2026-09-09T11:00:00Z"),
		});
		const reply2 = await seedReply({
			userId: userA,
			marketId: m2,
			parentCommentId: parentB,
			body: "User A reply two with stake forty",
			side: "YES",
			stake: dp18("40"),
			createdAt: new Date("2026-09-12T11:00:00Z"),
		});

		const rows = await loadProfileArguments(testDb, { userId: userA });
		// Only userA's own 3 posts + 2 replies — reply/parent authors never appear.
		expect(rows.length).toBe(5);

		// Exact §3.6 order, pinned by id.
		expect(rows.map((r) => r.id)).toEqual([
			post2,
			post1,
			post3,
			reply1,
			reply2,
		]);
		// Posts above replies (different rulers) — post3 (D=50) above reply1 (80).
		expect(rows.map((r) => r.kind)).toEqual([
			"post",
			"post",
			"post",
			"reply",
			"reply",
		]);

		// Pin the D ruler on the top and ruler-crossing posts.
		const top = rows[0];
		if (top && top.removed === false && top.kind === "post") {
			expect(top.aggregate.supportDharma).toBe(dp18("300"));
			expect(top.aggregate.counterDharma).toBe(dp18("0"));
		}
		const crossing = rows[2];
		if (crossing && crossing.removed === false && crossing.kind === "post") {
			expect(crossing.aggregate.supportDharma).toBe(dp18("50"));
		}

		// Pin the stake ruler on the first reply (80 > 50 yet still below all posts).
		const firstReply = rows[3];
		if (
			firstReply &&
			firstReply.removed === false &&
			firstReply.kind === "reply"
		) {
			expect(firstReply.stake).toBe(dp18("80"));
		}
		const secondReply = rows[4];
		if (
			secondReply &&
			secondReply.removed === false &&
			secondReply.kind === "reply"
		) {
			expect(secondReply.stake).toBe(dp18("40"));
		}
	});

	it("deep-link-ordinals", async () => {
		// §9 ordinals: a POST carries its OWN 1-based ordinal (rank by
		// (created_at,id) asc over the market's top-level comments, removed
		// INCLUDED); a REPLY carries its PARENT post's ordinal + the parent's
		// derived title. A REMOVED parent → repliedToTitle null (no leak) but the
		// ordinal is still the parent's (the §9 silent fallback lives at render).
		const userA = await seedUser("ord-author", "ord-author");
		const userC = await seedUser("ord-parent", "ord-parent");

		// m-ord-post: an EARLIER top-level comment (ordinal 1) so userA's post P
		// lands at its OWN ordinal 2.
		const mPost = await seedMarket("m-ord-post", "Open");
		await seedPool(mPost);
		await seedPost({
			userId: userC,
			marketId: mPost,
			body: "Earlier top-level comment at ordinal one",
			side: "YES",
			authorStake: dp18("10"),
			createdAt: new Date("2026-09-01T10:00:00Z"),
		});
		const postP = await seedPost({
			userId: userA,
			marketId: mPost,
			body: "User A post that lands at ordinal two",
			side: "YES",
			authorStake: dp18("10"),
			createdAt: new Date("2026-09-02T10:00:00Z"),
		});

		// m-ord-reply: parent Q at ordinal 1; userA's reply R deep-links to Q.
		const mReply = await seedMarket("m-ord-reply", "Open");
		await seedPool(mReply);
		const qBody = "Parent Q at ordinal one";
		const parentQ = await seedPost({
			userId: userC,
			marketId: mReply,
			body: qBody,
			side: "YES",
			authorStake: dp18("10"),
			createdAt: new Date("2026-09-01T10:00:00Z"),
		});
		const replyR = await seedReply({
			userId: userA,
			marketId: mReply,
			parentCommentId: parentQ,
			body: "User A reply pointing back at parent Q",
			side: "NO",
			stake: dp18("60"),
			createdAt: new Date("2026-09-03T10:00:00Z"),
		});

		// m-ord-removed-parent: parent S at ordinal 1 but content_removed; userA's
		// reply T still carries S's ordinal, repliedToTitle null (no leak).
		const mRemoved = await seedMarket("m-ord-removed-parent", "Open");
		await seedPool(mRemoved);
		const parentS = await seedPost({
			userId: userC,
			marketId: mRemoved,
			body: "Removed parent S at ordinal one",
			side: "YES",
			authorStake: dp18("10"),
			createdAt: new Date("2026-09-01T10:00:00Z"),
		});
		await seedRemoval(parentS);
		const replyT = await seedReply({
			userId: userA,
			marketId: mRemoved,
			parentCommentId: parentS,
			body: "User A reply under the removed parent S",
			side: "NO",
			stake: dp18("40"),
			createdAt: new Date("2026-09-04T10:00:00Z"),
		});

		const rows = await loadProfileArguments(testDb, { userId: userA });
		// userA authored P (post) + R, T (replies) — 3 items.
		expect(rows.length).toBe(3);

		// Post P → its OWN ordinal 2.
		const itemP = rows.find((r) => r.id === postP);
		expect(itemP?.removed).toBe(false);
		expect(itemP?.kind).toBe("post");
		if (itemP && itemP.removed === false && itemP.kind === "post") {
			expect(itemP.ordinal).toBe(2);
			expect(itemP.marketSlug).toBe("m-ord-post");
		}

		// Reply R → parent Q's ordinal 1 + Q's derived title.
		const itemR = rows.find((r) => r.id === replyR);
		expect(itemR?.removed).toBe(false);
		expect(itemR?.kind).toBe("reply");
		if (itemR && itemR.removed === false && itemR.kind === "reply") {
			expect(itemR.ordinal).toBe(1);
			expect(itemR.repliedToTitle).toBe(deriveTitleTeaser(qBody).title);
			expect(itemR.marketSlug).toBe("m-ord-reply");
		}

		// Reply T → removed parent S's ordinal 1 but repliedToTitle null (no leak).
		const itemT = rows.find((r) => r.id === replyT);
		expect(itemT?.removed).toBe(false);
		expect(itemT?.kind).toBe("reply");
		if (itemT && itemT.removed === false && itemT.kind === "reply") {
			expect(itemT.ordinal).toBe(1);
			expect(itemT.repliedToTitle).toBeNull();
			expect(itemT.marketSlug).toBe("m-ord-removed-parent");
		}
	});
});
