import { and, desc, eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// DEBATE.1 / DEBATE.2 — SPEC.1 §8 F-COMMENT-5 ("No stake, no voice"). Two cases:
//   ::comment-requires-bet — the DEBATE.1 INV-1 API frontstop. A place request
//     with a MISSING/EMPTY comment body returns the NAMED wire code
//     `comment_requires_bet` (400), NOT the generic `error_invalid_request_body`.
//     (Today the route's placeBodySchema `body: z.string().min(1)` fails an empty
//     body and the catch-all throws InvalidRequestBodyError → generic 400; so this
//     is ASSERTION-RED until the implement phase splits the body branch into the
//     named code.)
//   ::exited-user-prior-comments-remain — a user who sold to zero may post/reply
//     again via a fresh ENTRY bet; their PRIOR comments REMAIN (append-only). The
//     Exited MARKER render is DEBATE.5 (out of scope); DEBATE.2 only asserts that
//     re-entry works and prior comments persist untouched.
//
// Mirrors atomicity.test.ts: REAL place route + REAL runBetTransaction against
// test Postgres; only the externals (auth/origin/rate-limit/idempotency/
// moderation) are mocked. Money/share/stake values cross as decimal STRINGS
// (CLAUDE.md §2). Assert POST-CONDITIONS, not write order. TRUNCATE in afterEach.

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
import { POST as sellPOST } from "@/app/api/bets/sell/route";
import { comments, markets, pools, positions, users } from "@/db/schema";

import { testClient, testDb } from "../../db/_fixtures/db";
import { truncateTables } from "../../db/_fixtures/truncate";

const SEED_RESERVES = "100.000000000000000000";

function placeRequest(body: unknown, idempotencyKey: string) {
	return new Request("https://prd.example.com/api/bets/place", {
		method: "POST",
		headers: {
			"content-type": "application/json",
			origin: "https://prd.example.com",
			"Idempotency-Key": idempotencyKey,
			"x-forwarded-for": "203.0.113.31",
		},
		body: JSON.stringify(body),
	});
}

function sellRequest(body: unknown, idempotencyKey: string) {
	return new Request("https://prd.example.com/api/bets/sell", {
		method: "POST",
		headers: {
			"content-type": "application/json",
			origin: "https://prd.example.com",
			"Idempotency-Key": idempotencyKey,
			"x-forwarded-for": "203.0.113.31",
		},
		body: JSON.stringify(body),
	});
}

async function seedUser(tag: string): Promise<string> {
	const [user] = await testDb
		.insert(users)
		.values({
			name: "No-Position User",
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
			title: "No-Position Market",
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

describe("F-COMMENT-5 — no stake, no voice (DEBATE.1 frontstop + re-entry)", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});
	afterEach(async () => {
		await truncateTables(testClient, [
			"events",
			"dharma_ledger",
			"bets",
			"comments",
			"positions",
			"pools",
			"markets",
			"users",
		]);
	});

	it("comment-requires-bet", async () => {
		// The INV-1 API frontstop: a place request with an EMPTY comment body is
		// not a valid atomic bet+comment pair → 400 `comment_requires_bet` (the
		// NAMED code), NOT the generic `error_invalid_request_body`. And nothing
		// persists (no bet, no comment, no position).
		const userId = await seedUser("nostake-empty");
		const marketId = await seedOpenMarketWithPool("nostake-empty-market");
		await seedDharmaGrant(userId);
		mockGetSession.mockResolvedValue({ user: { id: userId } });

		const res = await placePOST(
			placeRequest(
				{ marketId, side: "YES", stake: "10", body: "" },
				"nostake-empty-key",
			),
		);

		expect(res.status).toBe(400);
		const payload = await res.json();
		expect(payload.ok).toBe(false);
		expect(payload.error.code).toBe("comment_requires_bet");

		// No torn state: nothing wrote.
		const commentRows = await testDb
			.select()
			.from(comments)
			.where(eq(comments.marketId, marketId));
		expect(commentRows.length).toBe(0);
		const positionRows = await testDb
			.select()
			.from(positions)
			.where(
				and(eq(positions.userId, userId), eq(positions.marketId, marketId)),
			);
		expect(positionRows.length).toBe(0);
	});

	it("exited-user-prior-comments-remain", async () => {
		// A user posts (entry bet + comment), sells the position to zero, then
		// RE-ENTERS via a fresh entry bet + a second comment. Both comments REMAIN
		// — append-only, the exit never touches prior comments (INV-3).
		const userId = await seedUser("exited-reenter");
		const marketId = await seedOpenMarketWithPool("exited-reenter-market");
		await seedDharmaGrant(userId);
		mockGetSession.mockResolvedValue({ user: { id: userId } });

		// 1. First entry post-bet (held YES) with its FIRST argument.
		const first = await placePOST(
			placeRequest(
				{ marketId, side: "YES", stake: "10", body: "first argument on YES" },
				"exited-first-key",
			),
		);
		expect(first.status).toBe(200);

		// 2. Sell the full YES position to zero.
		const held = await testDb
			.select({ quantity: positions.quantity })
			.from(positions)
			.where(
				and(
					eq(positions.userId, userId),
					eq(positions.marketId, marketId),
					eq(positions.side, "YES"),
				),
			);
		const heldQuantity = held[0]?.quantity ?? "0";
		const sell = await sellRequest(
			{ marketId, shares: heldQuantity },
			"exited-sell-key",
		);
		const sellRes = await sellPOST(sell);
		expect(sellRes.status).toBe(200);

		// Position is now zero-quantity (or absent as a held row).
		const { heldSideOrNull } = await import("@/server/positions/read");
		expect(await heldSideOrNull(testDb, { userId, marketId })).toBeNull();

		// 3. Re-enter via a FRESH entry bet + a SECOND argument.
		const second = await placePOST(
			placeRequest(
				{
					marketId,
					side: "YES",
					stake: "10",
					body: "second argument after re-entry",
				},
				"exited-reenter-key",
			),
		);
		expect(second.status).toBe(200);

		// Both comments remain — the exit never deleted/mutated the prior one.
		const commentRows = await testDb
			.select({ body: comments.body, createdAt: comments.createdAt })
			.from(comments)
			.where(eq(comments.marketId, marketId))
			.orderBy(desc(comments.createdAt));
		expect(commentRows.length).toBe(2);
		const bodies = commentRows.map((r) => r.body);
		expect(bodies).toContain("first argument on YES");
		expect(bodies).toContain("second argument after re-entry");
	});
});
