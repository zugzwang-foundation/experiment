import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// I-SIDE-BIND-001 — INV-3 (comments side-bound at post-time). ENGINE.8 MINTS the
// canonical test (plan §"Thesis invariants touched" → INV-3; the
// `comments.side_at_post_time` write lives in `place.ts`). DEBATE.3 SHARES it
// (tracker drift recorded in the ENGINE.8 log; ENGINE.8 mints, DEBATE.3 reuses).
//
// CANONICAL ASSERTION (plan §"Thesis invariants" INV-3): via the place flow,
// post a comment-bearing bet on side X (YES) → capture the original comment's
// id + its side_at_post_time. Sell that position to ZERO (sell flow). Re-enter
// on side ¬X (NO) via the place flow (a NEW comment). Assert the ORIGINAL
// comment's side_at_post_time is STILL X (YES) — UNCHANGED across the flip.
// Side-bound at post-time, immutable across the flip; flipping sides never moves
// a prior comment. The append-only trigger
// (0003_append_only_triggers.sql, comments = Bucket A) is the storage-layer
// ground truth; this proves the FLOW honours it end-to-end.
//
// CI-RED (DB/route-backed): local Postgres :54322 is DOWN — this fails with
// ECONNREFUSED (infra, NOT an assertion-red) and/or an unresolved greenfield
// VALUE import of the place/sell Route Handlers. Written type-correct +
// behaviorally complete so CI goes GREEN once ENGINE.8 lands. The greenfield
// VALUE imports (the two route POST handlers) keep this from resolving until
// implement.
//
// External-service mocking (mock at the module boundary; let the REAL DB tx hit
// test Postgres) — vi.hoisted + vi.mock per the integration-test precedent:
//   - `@sentry/nextjs`               (the wrapper emits breadcrumbs)
//   - `@/server/auth`                (auth.api.getSession → a seeded participant)
//   - `@/server/middleware/origin-allowlist` (checkOrigin → true)
//   - `@/server/middleware/rate-limit`       (checkRateLimit → allowed; ipIdentifier passthrough)
//   - `@/server/idempotency/cache`           (idempotencyLookupOrReserve → miss; computeBodyFingerprint passthrough)
//   - `@/server/moderation/precommit`        (precommitModerate → { outcome:'pass' })
//
// All money/share/stake values cross boundaries as exact decimal STRINGS; no
// float ever crosses a boundary (CLAUDE.md §2).

const { mockGetSession } = vi.hoisted(() => ({
	mockGetSession: vi.fn(),
}));

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

// Greenfield VALUE imports — keep this file unresolvable until ENGINE.8 lands.
import { POST as placePOST } from "@/app/api/bets/place/route";
import { POST as sellPOST } from "@/app/api/bets/sell/route";
import { comments, markets, pools, users } from "@/db/schema";

import { testClient, testDb } from "../db/_fixtures/db";

const SEED_RESERVES = "100.000000000000000000";

function postRequest(path: string, body: unknown, idempotencyKey: string) {
	return new Request(`https://prd.example.com${path}`, {
		method: "POST",
		headers: {
			"content-type": "application/json",
			origin: "https://prd.example.com",
			"Idempotency-Key": idempotencyKey,
			"x-forwarded-for": "203.0.113.7",
		},
		body: JSON.stringify(body),
	});
}

async function seedUser(emailTag: string, pseudonym: string): Promise<string> {
	const [user] = await testDb
		.insert(users)
		.values({
			name: "Side-Bind User",
			email: `${emailTag}@example.com`,
			pseudonym,
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
			title: "Side-Bind Market",
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

// Seed a positive Dharma balance so the in-spine bet_stake debits don't trip
// the no-overdraft floor (a fresh user reads canonical-zero). Imported lazily
// to keep the mock graph above the import order.
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

describe("I-SIDE-BIND-001: comments side-bound at post-time across a flip", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(async () => {
		await testClient.unsafe(
			`TRUNCATE events, dharma_ledger, bets, comments, positions, pools, markets, users CASCADE`,
		);
	});

	it("comment-side-bound::flip-does-not-move-frozen-side", async () => {
		const userId = await seedUser("side-bind", "side-bind");
		const marketId = await seedOpenMarketWithPool("side-bind-market");
		await seedDharmaGrant(userId);

		// All flow steps run as this seeded participant.
		mockGetSession.mockResolvedValue({ user: { id: userId } });

		// ── 1. ENTER on YES (side X) via the place flow ────────────────────────
		const enterYesRes = await placePOST(
			postRequest(
				"/api/bets/place",
				{
					marketId,
					side: "YES",
					stake: "10",
					body: "I argue YES, and I bind this comment to YES.",
				},
				"side-bind-enter-yes",
			),
		);
		expect(enterYesRes.status).toBe(200);

		// Capture the ORIGINAL comment + its frozen side_at_post_time (= YES).
		const originalComments = await testDb
			.select({
				id: comments.id,
				sideAtPostTime: comments.sideAtPostTime,
			})
			.from(comments)
			.where(eq(comments.marketId, marketId));
		expect(originalComments.length).toBe(1);
		const originalCommentId = originalComments[0]?.id ?? "";
		expect(originalComments[0]?.sideAtPostTime).toBe("YES");

		// Read the held YES quantity to sell exactly to zero.
		const { heldSideOrNull, getHeldPosition } = await import(
			"@/server/positions/read"
		);
		const held = await getHeldPosition(testDb, { userId, marketId });
		expect(held?.side).toBe("YES");
		const heldQuantity = held?.quantity ?? "0";

		// ── 2. SELL the YES position to ZERO via the sell flow ─────────────────
		const sellRes = await sellPOST(
			postRequest(
				"/api/bets/sell",
				{ marketId, shares: heldQuantity },
				"side-bind-sell-yes",
			),
		);
		expect(sellRes.status).toBe(200);

		// Position is now flat — no held side (so the NO entry is legal, not an
		// opposite_side_held rejection).
		const afterSell = await heldSideOrNull(testDb, { userId, marketId });
		expect(afterSell).toBeNull();

		// ── 3. RE-ENTER on NO (side ¬X) via the place flow (a NEW comment) ─────
		const enterNoRes = await placePOST(
			postRequest(
				"/api/bets/place",
				{
					marketId,
					side: "NO",
					stake: "10",
					body: "Now I flip: I argue NO. This is a NEW comment, bound to NO.",
				},
				"side-bind-enter-no",
			),
		);
		expect(enterNoRes.status).toBe(200);

		// ── ASSERT (INV-3): the ORIGINAL comment's side_at_post_time is STILL YES.
		// The flip neither moved nor mutated the frozen-side comment; the new NO
		// comment is a distinct row bound to NO.
		const originalAfterFlip = await testDb
			.select({ sideAtPostTime: comments.sideAtPostTime })
			.from(comments)
			.where(eq(comments.id, originalCommentId));
		expect(originalAfterFlip[0]?.sideAtPostTime).toBe("YES");

		// And the market now carries TWO comments: the original (YES) + the new
		// (NO) — both bound to their respective post-time sides, neither moved.
		const allComments = await testDb
			.select({
				id: comments.id,
				sideAtPostTime: comments.sideAtPostTime,
			})
			.from(comments)
			.where(eq(comments.marketId, marketId));
		expect(allComments.length).toBe(2);
		const yesRow = allComments.find((c) => c.id === originalCommentId);
		const noRow = allComments.find((c) => c.id !== originalCommentId);
		expect(yesRow?.sideAtPostTime).toBe("YES");
		expect(noRow?.sideAtPostTime).toBe("NO");
	});

	it("comment-side-bound::direct-update-of-side-at-post-time-rejected", async () => {
		// STORAGE-LAYER half of INV-3 (DEBATE.3) — column-targeted + named. comments
		// is Bucket A (0003 lines 48-49; SPEC.2 §6.5), so the whole-row append-only
		// trigger rejects ANY UPDATE; a direct mutation of side_at_post_time raises
		// P0001 "UPDATE not permitted". REGRESSION GUARD, not a TDD driver: the
		// trigger has shipped since SCAFFOLD.2 3.C, so this is green from day one —
		// DEBATE.3 proves the obligation is already delivered, it builds no new
		// enforcement. The flip-flow `it` above is the FLOW half; this is the storage
		// half, asserted in the canonical invariant home with the named P0001 (vs the
		// scale test's bare `.rejects.toThrow()` outside `pnpm test:invariants`).
		const userId = await seedUser("side-bind-storage", "side-bind-storage");
		const marketId = await seedOpenMarketWithPool("side-bind-storage-market");

		const [comment] = await testDb
			.insert(comments)
			.values({
				userId,
				marketId,
				body: "frozen-side argument",
				sideAtPostTime: "YES",
			})
			.returning({ id: comments.id });
		const commentId = comment?.id ?? "";

		await expect(
			testClient.unsafe(
				`UPDATE comments SET side_at_post_time = 'NO' WHERE id = $1`,
				[commentId],
			),
		).rejects.toMatchObject({
			code: "P0001",
			message: expect.stringContaining("UPDATE not permitted"),
		});
	});
});
