import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// DEBATE.2 — SPEC.1 §8 F-COMMENT-2 ("Reply = a Support/Counter reply-bet").
// A reply IS a bet (ADR-0017); the reply-write goes through the EXISTING place
// path with a validated `parentCommentId`. This suite is route-level and asserts
// WIRE CODES (the 3 new codes — comment-requires-bet's siblings — are minted as
// `BetProductError` subclasses in src/server/bets/errors.ts; no catalogue doc).
//
// Scenarios:
//   ::reply-is-a-bet-replier-side-not-parent (INV-3) — the reply's
//     side_at_post_time = the REPLIER's entry side, NEVER the parent's. Parent on
//     YES, replier on NO → reply.side_at_post_time === "NO".
//   ::reply-floor-enforced — stake < 50 (BET_MIN_STAKE_REPLY) on a reply →
//     `below_reply_floor` 400 (the class is built; the route must route replies
//     through the reply floor).
//   ::depth-1-reply-to-a-reply-rejected — parent has non-null parent_comment_id →
//     `reply_depth_exceeded` 400 (REPLY_DEPTH_MAX = 1).
//   ::parent-in-different-market-not-found — parent exists but in another market →
//     `parent_comment_not_found` 404.
//   ::parent-missing-not-found — absent parent id → `parent_comment_not_found` 404.
//   ::opposite-side-held-on-reply-rejected — replier holds ¬(chosen side) →
//     `opposite_side_held` 400 (F-BET-10, place.ts:69 — the foreclosed-side write
//     goes through THIS path).
//   ::response-echoes-parent-comment-id — a reply's success response includes
//     `parentCommentId` (F-COMMENT-2 response shape; currently omitted).
//   ::call-a-stake-at-post-time-literal-zero — place() writes the LITERAL "0" into
//     comments.stake_at_post_time for a reply (NOT the stake) — read the persisted
//     row (Call A, plan §2, operator-ratified "0").
//
// Mirrors atomicity.test.ts: REAL place route + REAL runBetTransaction against
// test Postgres; only externals mocked. Decimal STRINGS (CLAUDE.md §2). TRUNCATE
// in afterEach.

const { mockGetSession } = vi.hoisted(() => ({ mockGetSession: vi.fn() }));

vi.mock("@sentry/nextjs", () => ({
	captureMessage: vi.fn(),
	addBreadcrumb: vi.fn(),
	captureException: vi.fn(),
}));
vi.mock("@/server/auth", () => ({
	auth: { api: { getSession: mockGetSession } },
}));
vi.mock("@/server/middleware/origin-allowlist", () => ({
	checkOrigin: () => true,
}));
vi.mock("@/server/middleware/rate-limit", () => ({
	checkRateLimit: vi.fn(async () => ({
		allowed: true,
		remaining: 99,
		reset: 0,
	})),
	ipIdentifier: (ip: string) => ip,
}));
vi.mock("@/server/idempotency/cache", () => ({
	computeBodyFingerprint: vi.fn(async () => "fp"),
	idempotencyLookupOrReserve: vi.fn(async () => ({
		kind: "miss",
		release: vi.fn(async () => {}),
	})),
}));
vi.mock("@/server/moderation/precommit", () => ({
	precommitModerate: vi.fn(async () => ({ outcome: "pass", categories: [] })),
}));

import { POST as placePOST } from "@/app/api/bets/place/route";
import { comments, markets, pools, users } from "@/db/schema";
import { BET_MIN_STAKE_REPLY } from "@/server/config/limits";

import { testClient, testDb } from "../../db/_fixtures/db";

const SEED_RESERVES = "100.000000000000000000";
// A reply stake at/above the pinned reply floor (50) — clears the floor so the
// reply-specific path is exercised, not the floor reject.
const REPLY_STAKE = "50";
const MISSING_UUID = "0190b3a0-dead-7000-8000-00000000beef";

function placeRequest(body: unknown, idempotencyKey: string) {
	return new Request("https://prd.example.com/api/bets/place", {
		method: "POST",
		headers: {
			"content-type": "application/json",
			origin: "https://prd.example.com",
			"Idempotency-Key": idempotencyKey,
			"x-forwarded-for": "203.0.113.34",
		},
		body: JSON.stringify(body),
	});
}

async function seedUser(tag: string): Promise<string> {
	const [user] = await testDb
		.insert(users)
		.values({
			name: "Reply User",
			email: `${tag}@example.com`,
			pseudonym: tag,
			tosAcceptedAt: new Date("2026-01-01T00:00:00Z"),
		})
		.returning({ id: users.id });
	return user?.id ?? "";
}

async function seedOpenMarketWithPool(slug: string): Promise<string> {
	const [market] = await testDb
		.insert(markets)
		.values({
			slug,
			title: "Reply Market",
			status: "Open",
			resolutionDeadline: new Date("2027-01-01T00:00:00Z"),
		})
		.returning({ id: markets.id });
	const marketId = market?.id ?? "";
	await testDb.insert(pools).values({
		marketId,
		yesReserves: SEED_RESERVES,
		noReserves: SEED_RESERVES,
	});
	return marketId;
}

async function seedDharmaGrant(userId: string): Promise<void> {
	const { appendLedgerRow } = await import("@/server/dharma/persist");
	await testDb.transaction((tx) =>
		appendLedgerRow(tx, {
			userId,
			amount: "1000",
			entryType: "initial_grant",
		}),
	);
}

// Place a top-level post-bet via the REAL route → returns the created comment id
// (the parent). Used to seed a real parent comment with depth 0.
async function placeParentPost(args: {
	userId: string;
	marketId: string;
	side: "YES" | "NO";
	idempotencyKey: string;
}): Promise<string> {
	mockGetSession.mockResolvedValue({ user: { id: args.userId } });
	const res = await placePOST(
		placeRequest(
			{
				marketId: args.marketId,
				side: args.side,
				stake: "10",
				body: `parent argument on ${args.side}`,
			},
			args.idempotencyKey,
		),
	);
	expect(res.status).toBe(200);
	const payload = await res.json();
	return payload.data.commentId as string;
}

describe("F-COMMENT-2 — reply is a Support/Counter reply-bet", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});
	afterEach(async () => {
		await testClient.unsafe(
			`TRUNCATE events, dharma_ledger, bets, comments, positions, pools, markets, users CASCADE`,
		);
	});

	it("reply-is-a-bet-replier-side-not-parent", async () => {
		// INV-3: parent author on YES; the REPLIER enters on NO. The reply's
		// side_at_post_time MUST be the replier's side (NO), NEVER the parent's (YES).
		const parentAuthor = await seedUser("reply-inv3-parent");
		const replier = await seedUser("reply-inv3-replier");
		const marketId = await seedOpenMarketWithPool("reply-inv3-market");
		await seedDharmaGrant(parentAuthor);
		await seedDharmaGrant(replier);

		const parentCommentId = await placeParentPost({
			userId: parentAuthor,
			marketId,
			side: "YES",
			idempotencyKey: "reply-inv3-parent-key",
		});

		mockGetSession.mockResolvedValue({ user: { id: replier } });
		const res = await placePOST(
			placeRequest(
				{
					marketId,
					side: "NO",
					stake: REPLY_STAKE,
					body: "counter argument on NO",
					parentCommentId,
				},
				"reply-inv3-replier-key",
			),
		);
		expect(res.status).toBe(200);
		const payload = await res.json();
		const replyCommentId = payload.data.commentId as string;

		const [replyRow] = await testDb
			.select({
				sideAtPostTime: comments.sideAtPostTime,
				parentCommentId: comments.parentCommentId,
			})
			.from(comments)
			.where(eq(comments.id, replyCommentId));
		// The replier's frozen side, NOT the parent's YES.
		expect(replyRow?.sideAtPostTime).toBe("NO");
		expect(replyRow?.parentCommentId).toBe(parentCommentId);
	});

	it("reply-floor-enforced", async () => {
		// A reply stake below the reply floor (50) → `below_reply_floor` 400, even
		// though it would clear the lower post floor (10).
		const parentAuthor = await seedUser("reply-floor-parent");
		const replier = await seedUser("reply-floor-replier");
		const marketId = await seedOpenMarketWithPool("reply-floor-market");
		await seedDharmaGrant(parentAuthor);
		await seedDharmaGrant(replier);

		const parentCommentId = await placeParentPost({
			userId: parentAuthor,
			marketId,
			side: "YES",
			idempotencyKey: "reply-floor-parent-key",
		});

		// floor − 1 (BigInt; no bigint literal under ES2017).
		const belowFloor = String(
			BigInt(BET_MIN_STAKE_REPLY.split(".")[0] ?? BET_MIN_STAKE_REPLY) -
				BigInt(1),
		);

		mockGetSession.mockResolvedValue({ user: { id: replier } });
		const res = await placePOST(
			placeRequest(
				{
					marketId,
					side: "YES",
					stake: belowFloor,
					body: "under-reply-floor argument",
					parentCommentId,
				},
				"reply-floor-replier-key",
			),
		);
		expect(res.status).toBe(400);
		const payload = await res.json();
		expect(payload.error.code).toBe("below_reply_floor");
	});

	it("depth-1-reply-to-a-reply-rejected", async () => {
		// REPLY_DEPTH_MAX = 1: replying to a comment that itself has a non-null
		// parent_comment_id → `reply_depth_exceeded` 400.
		const parentAuthor = await seedUser("reply-depth-parent");
		const replier1 = await seedUser("reply-depth-r1");
		const replier2 = await seedUser("reply-depth-r2");
		const marketId = await seedOpenMarketWithPool("reply-depth-market");
		await seedDharmaGrant(parentAuthor);
		await seedDharmaGrant(replier1);
		await seedDharmaGrant(replier2);

		const parentCommentId = await placeParentPost({
			userId: parentAuthor,
			marketId,
			side: "YES",
			idempotencyKey: "reply-depth-parent-key",
		});

		// A depth-1 reply (its parent_comment_id is the top-level post).
		mockGetSession.mockResolvedValue({ user: { id: replier1 } });
		const firstReply = await placePOST(
			placeRequest(
				{
					marketId,
					side: "YES",
					stake: REPLY_STAKE,
					body: "depth-1 reply",
					parentCommentId,
				},
				"reply-depth-r1-key",
			),
		);
		expect(firstReply.status).toBe(200);
		const firstReplyId = (await firstReply.json()).data.commentId as string;

		// Replying to the reply (depth-2) is rejected.
		mockGetSession.mockResolvedValue({ user: { id: replier2 } });
		const secondReply = await placePOST(
			placeRequest(
				{
					marketId,
					side: "YES",
					stake: REPLY_STAKE,
					body: "depth-2 reply attempt",
					parentCommentId: firstReplyId,
				},
				"reply-depth-r2-key",
			),
		);
		expect(secondReply.status).toBe(400);
		const payload = await secondReply.json();
		expect(payload.error.code).toBe("reply_depth_exceeded");
	});

	it("parent-in-different-market-not-found", async () => {
		// Parent exists but in market B; the reply targets market A → 404
		// `parent_comment_not_found` (the same-market check fails).
		const parentAuthor = await seedUser("reply-xmkt-parent");
		const replier = await seedUser("reply-xmkt-replier");
		const marketA = await seedOpenMarketWithPool("reply-xmkt-a");
		const marketB = await seedOpenMarketWithPool("reply-xmkt-b");
		await seedDharmaGrant(parentAuthor);
		await seedDharmaGrant(replier);

		// Parent comment lives in market B.
		const parentInB = await placeParentPost({
			userId: parentAuthor,
			marketId: marketB,
			side: "YES",
			idempotencyKey: "reply-xmkt-parent-key",
		});

		// Reply submitted against market A with market B's parent.
		mockGetSession.mockResolvedValue({ user: { id: replier } });
		const res = await placePOST(
			placeRequest(
				{
					marketId: marketA,
					side: "YES",
					stake: REPLY_STAKE,
					body: "cross-market reply attempt",
					parentCommentId: parentInB,
				},
				"reply-xmkt-replier-key",
			),
		);
		expect(res.status).toBe(404);
		const payload = await res.json();
		expect(payload.error.code).toBe("parent_comment_not_found");
	});

	it("parent-missing-not-found", async () => {
		// An absent parent id → 404 `parent_comment_not_found`.
		const replier = await seedUser("reply-missing-replier");
		const marketId = await seedOpenMarketWithPool("reply-missing-market");
		await seedDharmaGrant(replier);

		mockGetSession.mockResolvedValue({ user: { id: replier } });
		const res = await placePOST(
			placeRequest(
				{
					marketId,
					side: "YES",
					stake: REPLY_STAKE,
					body: "reply to nothing",
					parentCommentId: MISSING_UUID,
				},
				"reply-missing-replier-key",
			),
		);
		expect(res.status).toBe(404);
		const payload = await res.json();
		expect(payload.error.code).toBe("parent_comment_not_found");
	});

	it("opposite-side-held-on-reply-rejected", async () => {
		// The replier already HOLDS YES; a reply on NO is an opposite-side bet →
		// `opposite_side_held` 400 (F-BET-10, in place()). The foreclosed-side write
		// goes through THIS existing check.
		const parentAuthor = await seedUser("reply-opp-parent");
		const replier = await seedUser("reply-opp-replier");
		const marketId = await seedOpenMarketWithPool("reply-opp-market");
		await seedDharmaGrant(parentAuthor);
		await seedDharmaGrant(replier);

		const parentCommentId = await placeParentPost({
			userId: parentAuthor,
			marketId,
			side: "NO",
			idempotencyKey: "reply-opp-parent-key",
		});

		// The replier first ENTERS on YES (a top-level post-bet → holds YES).
		mockGetSession.mockResolvedValue({ user: { id: replier } });
		const entry = await placePOST(
			placeRequest(
				{ marketId, side: "YES", stake: "10", body: "replier entry on YES" },
				"reply-opp-entry-key",
			),
		);
		expect(entry.status).toBe(200);

		// Now the replier attempts a NO reply (opposite of held YES).
		const res = await placePOST(
			placeRequest(
				{
					marketId,
					side: "NO",
					stake: REPLY_STAKE,
					body: "opposite-side reply attempt",
					parentCommentId,
				},
				"reply-opp-replier-key",
			),
		);
		expect(res.status).toBe(400);
		const payload = await res.json();
		expect(payload.error.code).toBe("opposite_side_held");
	});

	it("response-echoes-parent-comment-id", async () => {
		// F-COMMENT-2 response shape: a reply's success response includes
		// `parentCommentId` (the post response superset).
		const parentAuthor = await seedUser("reply-echo-parent");
		const replier = await seedUser("reply-echo-replier");
		const marketId = await seedOpenMarketWithPool("reply-echo-market");
		await seedDharmaGrant(parentAuthor);
		await seedDharmaGrant(replier);

		const parentCommentId = await placeParentPost({
			userId: parentAuthor,
			marketId,
			side: "YES",
			idempotencyKey: "reply-echo-parent-key",
		});

		mockGetSession.mockResolvedValue({ user: { id: replier } });
		const res = await placePOST(
			placeRequest(
				{
					marketId,
					side: "YES",
					stake: REPLY_STAKE,
					body: "support reply echo",
					parentCommentId,
				},
				"reply-echo-replier-key",
			),
		);
		expect(res.status).toBe(200);
		const payload = await res.json();
		expect(payload.data.parentCommentId).toBe(parentCommentId);
	});

	it("call-a-stake-at-post-time-literal-zero", async () => {
		// Call A (operator-ratified "0"): place() writes the LITERAL "0" into the
		// vestigial comments.stake_at_post_time for a reply — NOT the stake (50).
		// Read the persisted row.
		const parentAuthor = await seedUser("reply-calla-parent");
		const replier = await seedUser("reply-calla-replier");
		const marketId = await seedOpenMarketWithPool("reply-calla-market");
		await seedDharmaGrant(parentAuthor);
		await seedDharmaGrant(replier);

		const parentCommentId = await placeParentPost({
			userId: parentAuthor,
			marketId,
			side: "YES",
			idempotencyKey: "reply-calla-parent-key",
		});

		mockGetSession.mockResolvedValue({ user: { id: replier } });
		const res = await placePOST(
			placeRequest(
				{
					marketId,
					side: "YES",
					stake: REPLY_STAKE,
					body: "call-a reply",
					parentCommentId,
				},
				"reply-calla-replier-key",
			),
		);
		expect(res.status).toBe(200);
		const replyCommentId = (await res.json()).data.commentId as string;

		const [replyRow] = await testDb
			.select({ stakeAtPostTime: comments.stakeAtPostTime })
			.from(comments)
			.where(eq(comments.id, replyCommentId));
		// The dead column is written the literal "0", not the 50-stake (the NUMERIC
		// canonical form is the 18-dp zero string).
		expect(replyRow?.stakeAtPostTime).toBe("0.000000000000000000");
	});
});
