import { and, eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// DEBATE.2 — SPEC.1 §8 F-COMMENT-1 ("Additional top-level argument = a post-bet").
// `direct.test.ts::additional-argument-is-a-post-bet`: a top-level post-bet
// writes the comment + bet atomically (INV-1) with `side_at_post_time` = the
// held/entry side (INV-3) and `parent_comment_id` NULL. A top-level comment is a
// post-bet — never a free comment.
//
// Mirrors atomicity.test.ts: REAL place route + REAL runBetTransaction against
// test Postgres; only externals mocked. Decimal STRINGS (CLAUDE.md §2). Assert
// POST-CONDITIONS. TRUNCATE in afterEach. The new behaviour this pins beyond the
// already-green ENGINE.8 happy path is the `parent_comment_id IS NULL` +
// `side_at_post_time = entry side` contract for the top-level-argument case, and
// the `stake_at_post_time = "0"` Call-A placeholder (asserted in reply.test.ts /
// here is the post branch).

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
import { bets, comments, markets, pools, positions, users } from "@/db/schema";

import { testClient, testDb } from "../../db/_fixtures/db";

const SEED_RESERVES = "100.000000000000000000";

function placeRequest(body: unknown, idempotencyKey: string) {
	return new Request("https://prd.example.com/api/bets/place", {
		method: "POST",
		headers: {
			"content-type": "application/json",
			origin: "https://prd.example.com",
			"Idempotency-Key": idempotencyKey,
			"x-forwarded-for": "203.0.113.32",
		},
		body: JSON.stringify(body),
	});
}

async function seedUser(tag: string): Promise<string> {
	const [user] = await testDb
		.insert(users)
		.values({
			name: "Direct-Comment User",
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
			title: "Direct-Comment Market",
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

describe("F-COMMENT-1 — additional top-level argument is a post-bet", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});
	afterEach(async () => {
		await testClient.unsafe(
			`TRUNCATE events, dharma_ledger, bets, comments, positions, pools, markets, users CASCADE`,
		);
	});

	it("additional-argument-is-a-post-bet", async () => {
		const userId = await seedUser("direct-post");
		const marketId = await seedOpenMarketWithPool("direct-post-market");
		await seedDharmaGrant(userId);
		mockGetSession.mockResolvedValue({ user: { id: userId } });

		const res = await placePOST(
			placeRequest(
				{ marketId, side: "NO", stake: "10", body: "top-level argument on NO" },
				"direct-post-key",
			),
		);
		expect(res.status).toBe(200);

		// One comment: side_at_post_time = the entry side (NO), parent NULL.
		const commentRows = await testDb
			.select({
				id: comments.id,
				sideAtPostTime: comments.sideAtPostTime,
				parentCommentId: comments.parentCommentId,
				betId: comments.betId,
			})
			.from(comments)
			.where(eq(comments.marketId, marketId));
		expect(commentRows.length).toBe(1);
		expect(commentRows[0]?.sideAtPostTime).toBe("NO");
		expect(commentRows[0]?.parentCommentId).toBeNull();

		// One bet, comment_id links the comment (INV-1 schema half), atomic.
		const betRows = await testDb
			.select({ id: bets.id, commentId: bets.commentId, side: bets.side })
			.from(bets)
			.where(eq(bets.marketId, marketId));
		expect(betRows.length).toBe(1);
		expect(betRows[0]?.commentId).toBe(commentRows[0]?.id);
		expect(betRows[0]?.side).toBe("NO");

		// Position held on the entry side.
		const positionRows = await testDb
			.select({ side: positions.side })
			.from(positions)
			.where(
				and(eq(positions.userId, userId), eq(positions.marketId, marketId)),
			);
		expect(positionRows.length).toBe(1);
		expect(positionRows[0]?.side).toBe("NO");
	});
});
