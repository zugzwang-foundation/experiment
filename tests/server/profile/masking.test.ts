import { v7 as uuidv7 } from "uuid";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@sentry/nextjs", () => ({
	captureMessage: vi.fn(),
	addBreadcrumb: vi.fn(),
	captureException: vi.fn(),
}));

import { bets, comments, markets, modActions, pools, users } from "@/db/schema";
import { loadProfileArguments } from "@/server/profile/arguments";

import { testClient, testDb } from "../../db/_fixtures/db";
import { truncateTables } from "../../db/_fixtures/truncate";

// UI.A5 Slice 3 §5.6 tests-first (plan §2 row 3 + §11 → §17 row
// `profile::removed-masked-for-all-viewers-and-counted`). SAFETY-CRITICAL
// masking — SPEC.1 1.0.18 §23 "Masking" (L1519) + "The argument list" (L1517),
// F-PROF-2. The VALUE import from `@/server/profile/arguments` FAILS at
// collection until Slice 3 lands — red-for-the-right-reason.
// DB-BACKED (local Postgres :54322).
//
// The removed variant is the load-debate-view union-variant pattern: a
// `content_removed` comment renders as `{ removed: true }` carrying NO
// title/teaser/body/marker — a content leak is a COMPILE error, and here a
// runtime `in`-check pins the absence. Masking is viewer-INDEPENDENT: there is
// NO viewer/session param, so the one returned payload IS what the owner and any
// visitor both get. Removed items stay counted (the aggregate footer on a
// removed POST renders its real Support/Counter) and keep their §3.6 slot.

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

describe("UI.A5 Slice 3 — loadProfileArguments masking (F-PROF-2 safety-critical)", () => {
	afterEach(async () => {
		await truncateTables(testClient, TRUNCATE_LIST);
		vi.clearAllMocks();
	});

	it("removed-stub-for-all-viewers-including-owner", async () => {
		// The profile user authors a top-level POST (P) and a REPLY (R); BOTH carry
		// a `content_removed` mod-action. `loadProfileArguments` returns each as the
		// `{ removed: true }` union variant — NO title/teaser/body/marker key
		// (compile-level no-leak; the `in`-check pins the runtime absence). There is
		// NO viewer param, so this single payload is IDENTICALLY what the owner and
		// every visitor get — masking is viewer-independent by construction.
		const userA = await seedUser("mask-author", "mask-author");
		const userC = await seedUser("mask-parent-author", "mask-parent");

		// P — the profile user's removed top-level post (market m-mask-post).
		const mPost = await seedMarket("m-mask-post", "Open");
		await seedPool(mPost);
		const commentP = await seedComment({
			userId: userA,
			marketId: mPost,
			body: "This top-level post will be removed by a moderator",
			side: "YES",
			createdAt: new Date("2026-09-10T10:00:00Z"),
		});
		await seedBet({
			userId: userA,
			marketId: mPost,
			side: "YES",
			stake: dp18("40"),
			shares: dp18("40"),
			commentId: commentP,
			createdAt: new Date("2026-09-10T10:00:00Z"),
		});
		await seedRemoval(commentP);

		// R — the profile user's removed REPLY to a (non-removed) parent Q by userC
		// in a second market (m-mask-reply).
		const mReply = await seedMarket("m-mask-reply", "Open");
		await seedPool(mReply);
		const commentQ = await seedComment({
			userId: userC,
			marketId: mReply,
			body: "Parent post that the removed reply hangs under",
			side: "YES",
			createdAt: new Date("2026-09-11T10:00:00Z"),
		});
		await seedBet({
			userId: userC,
			marketId: mReply,
			side: "YES",
			stake: dp18("30"),
			shares: dp18("30"),
			commentId: commentQ,
			createdAt: new Date("2026-09-11T10:00:00Z"),
		});
		const commentR = await seedComment({
			userId: userA,
			marketId: mReply,
			body: "This counter reply will be removed by a moderator",
			side: "NO",
			parentCommentId: commentQ,
			createdAt: new Date("2026-09-12T10:00:00Z"),
		});
		await seedBet({
			userId: userA,
			marketId: mReply,
			side: "NO",
			stake: dp18("25"),
			shares: dp18("25"),
			commentId: commentR,
			createdAt: new Date("2026-09-12T10:00:00Z"),
		});
		await seedRemoval(commentR);

		// The ONE call — no viewer param. Owner and visitor receive this same list.
		const rows = await loadProfileArguments(testDb, { userId: userA });
		expect(rows.length).toBe(2);

		const postItem = rows.find((r) => r.kind === "post");
		const replyItem = rows.find((r) => r.kind === "reply");

		// Removed POST stub — no content fields, structural slot intact.
		expect(postItem?.removed).toBe(true);
		expect(postItem?.id).toBe(commentP);
		expect(postItem?.side).toBe("YES");
		expect(postItem?.marketSlug).toBe("m-mask-post");
		expect("title" in (postItem ?? {})).toBe(false);
		expect("teaser" in (postItem ?? {})).toBe(false);
		expect("body" in (postItem ?? {})).toBe(false);
		expect("marker" in (postItem ?? {})).toBe(false);

		// Removed REPLY stub — no content fields (and no stake/repliedToTitle leak).
		expect(replyItem?.removed).toBe(true);
		expect(replyItem?.id).toBe(commentR);
		expect(replyItem?.side).toBe("NO");
		expect(replyItem?.marketSlug).toBe("m-mask-reply");
		expect("title" in (replyItem ?? {})).toBe(false);
		expect("teaser" in (replyItem ?? {})).toBe(false);
		expect("body" in (replyItem ?? {})).toBe(false);
		expect("marker" in (replyItem ?? {})).toBe(false);
		expect("stake" in (replyItem ?? {})).toBe(false);
		expect("repliedToTitle" in (replyItem ?? {})).toBe(false);
	});

	it("removed-still-counted", async () => {
		// A removed POST stays COUNTED: its Support/Counter aggregate footer renders
		// the TRUE sums over its (real) reply-bets, and it keeps its §3.6 slot —
		// ordered by its still-real attracted D (removed-included, masked only at
		// render). Proof of the slot: the removed post (D = 50) sorts ABOVE a
		// visible lower-D post (D = 20); a buggy "zero the removed post's D" would
		// invert the order.
		const userA = await seedUser("count-author", "count-author");
		const userB = await seedUser("count-supporter", "count-supporter");
		const userC = await seedUser("count-counter", "count-counter");
		const userD = await seedUser("count-supporter-2", "count-supporter-2");

		const marketId = await seedMarket("m-count", "Open");
		await seedPool(marketId);

		// P — removed top-level YES post. Attracted D = 30 (Support) + 20 (Counter).
		const commentP = await seedComment({
			userId: userA,
			marketId,
			body: "Removed post that still attracts real reply-bets",
			side: "YES",
			createdAt: new Date("2026-09-10T10:00:00Z"),
		});
		await seedBet({
			userId: userA,
			marketId,
			side: "YES",
			stake: dp18("10"),
			shares: dp18("10"),
			commentId: commentP,
			createdAt: new Date("2026-09-10T10:00:00Z"),
		});
		// Support reply-bet (YES == P's side), stake 30.
		const replySupport = await seedComment({
			userId: userB,
			marketId,
			body: "Support reply on the removed post",
			side: "YES",
			parentCommentId: commentP,
			createdAt: new Date("2026-09-11T10:00:00Z"),
		});
		await seedBet({
			userId: userB,
			marketId,
			side: "YES",
			stake: dp18("30"),
			shares: dp18("30"),
			commentId: replySupport,
			createdAt: new Date("2026-09-11T10:00:00Z"),
		});
		// Counter reply-bet (NO != P's side), stake 20.
		const replyCounter = await seedComment({
			userId: userC,
			marketId,
			body: "Counter reply on the removed post",
			side: "NO",
			parentCommentId: commentP,
			createdAt: new Date("2026-09-11T11:00:00Z"),
		});
		await seedBet({
			userId: userC,
			marketId,
			side: "NO",
			stake: dp18("20"),
			shares: dp18("20"),
			commentId: replyCounter,
			createdAt: new Date("2026-09-11T11:00:00Z"),
		});

		// P2 — a VISIBLE lower-D post (D = 20 Support) to make the slot observable.
		const commentP2 = await seedComment({
			userId: userA,
			marketId,
			body: "Visible post with a smaller attracted D",
			side: "YES",
			createdAt: new Date("2026-09-10T12:00:00Z"),
		});
		await seedBet({
			userId: userA,
			marketId,
			side: "YES",
			stake: dp18("10"),
			shares: dp18("10"),
			commentId: commentP2,
			createdAt: new Date("2026-09-10T12:00:00Z"),
		});
		const replyP2 = await seedComment({
			userId: userD,
			marketId,
			body: "Support reply on the visible post",
			side: "YES",
			parentCommentId: commentP2,
			createdAt: new Date("2026-09-11T12:00:00Z"),
		});
		await seedBet({
			userId: userD,
			marketId,
			side: "YES",
			stake: dp18("20"),
			shares: dp18("20"),
			commentId: replyP2,
			createdAt: new Date("2026-09-11T12:00:00Z"),
		});

		// P is the removed post whose count survives — the removal was missing from
		// the original fixture (the test's own comment/assertions require it).
		await seedRemoval(commentP);

		const rows = await loadProfileArguments(testDb, { userId: userA });
		// Only userA's OWN two posts — reply authors (B/C/D) never appear here.
		expect(rows.length).toBe(2);

		// Slot: removed P (D = 50) sorts first, above visible P2 (D = 20).
		const removedPost = rows[0];
		expect(removedPost?.removed).toBe(true);
		expect(removedPost?.kind).toBe("post");
		expect(removedPost?.id).toBe(commentP);
		if (
			removedPost &&
			removedPost.removed === true &&
			removedPost.kind === "post"
		) {
			// Counted: the aggregate footer carries the true reply-bet sums.
			expect(removedPost.aggregate.supportCount).toBe(1);
			expect(removedPost.aggregate.counterCount).toBe(1);
			expect(removedPost.aggregate.supportDharma).toBe(dp18("30"));
			expect(removedPost.aggregate.counterDharma).toBe(dp18("20"));
		}

		const visiblePost = rows[1];
		expect(visiblePost?.removed).toBe(false);
		expect(visiblePost?.id).toBe(commentP2);
	});
});
