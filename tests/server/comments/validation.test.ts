import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// DEBATE.2 — SPEC.1 §8 F-COMMENT-4 ("Comment exceeds length limit").
// `validation.test.ts::length-limit`: a body longer than COMMENT_MAX_LENGTH
// (5000) → 400 `comment_too_long`, before any state change (the route rejects
// pre-tx). The `CommentTooLongError` class + the route's length check are
// ALREADY built (ENGINE.8); this test is the SPEC.1 §8 acceptance row pinning
// the wire code + the no-write post-condition. The body-length boundary is read
// from the live COMMENT_MAX_LENGTH constant so a HARDEN tuning pass doesn't make
// this stale.
//
// Mirrors atomicity.test.ts: REAL place route + REAL runBetTransaction against
// test Postgres; only externals mocked. TRUNCATE in afterEach.

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
import { bets, comments, markets, pools, users } from "@/db/schema";
import { COMMENT_MAX_LENGTH } from "@/server/config/limits";

import { testClient, testDb } from "../../db/_fixtures/db";

const SEED_RESERVES = "100.000000000000000000";

function placeRequest(body: unknown, idempotencyKey: string) {
	return new Request("https://prd.example.com/api/bets/place", {
		method: "POST",
		headers: {
			"content-type": "application/json",
			origin: "https://prd.example.com",
			"Idempotency-Key": idempotencyKey,
			"x-forwarded-for": "203.0.113.33",
		},
		body: JSON.stringify(body),
	});
}

async function seedUser(tag: string): Promise<string> {
	const [user] = await testDb
		.insert(users)
		.values({
			name: "Validation User",
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
			title: "Validation Market",
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

describe("F-COMMENT-4 — comment exceeds length limit", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});
	afterEach(async () => {
		await testClient.unsafe(
			`TRUNCATE events, dharma_ledger, bets, comments, positions, pools, markets, users CASCADE`,
		);
	});

	it("length-limit", async () => {
		const userId = await seedUser("len-limit");
		const marketId = await seedOpenMarketWithPool("len-limit-market");
		await seedDharmaGrant(userId);
		mockGetSession.mockResolvedValue({ user: { id: userId } });

		// One char over the live limit (read from the constant — not hard-coded).
		const overLong = "x".repeat(COMMENT_MAX_LENGTH + 1);

		const res = await placePOST(
			placeRequest(
				{ marketId, side: "YES", stake: "10", body: overLong },
				"len-limit-key",
			),
		);

		expect(res.status).toBe(400);
		const payload = await res.json();
		expect(payload.ok).toBe(false);
		expect(payload.error.code).toBe("comment_too_long");

		// Rejected BEFORE any state change — no comment, no bet.
		const commentRows = await testDb
			.select()
			.from(comments)
			.where(eq(comments.marketId, marketId));
		expect(commentRows.length).toBe(0);
		const betRows = await testDb
			.select()
			.from(bets)
			.where(eq(bets.marketId, marketId));
		expect(betRows.length).toBe(0);
	});
});
