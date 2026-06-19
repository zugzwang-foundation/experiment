import { and, eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// DEBATE.7 §10 — `moderation::track-b-blocked-no-ban`
// (`track-b-blocked.test.ts`). The ordinary Track-B disposition: the gate
// returns `track_b` (a flagged-but-not-CSAM category), the route runs
// `recordGateBlock` (appends a `mod_actions` row, reason `track_b_blocked`,
// NO ban, NO image), then throws `CommentTrackBBlockedError` → 400
// `comment_track_b_blocked`. The bet+comment tx never opens; no stake moves.
// The author MAY revise: a resubmit that now passes succeeds.
//
// FAILING-FIRST (DEBATE.7 — symbols land at implement): RED because
//   - `recordGateBlock` does NOT exist → no `mod_actions` row on track_b
//     (`place/route.ts` lines 99-104 only `throw`).
//   - `CommentTrackBBlockedError` (code `comment_track_b_blocked`, HTTP 400) does
//     NOT exist — the route still throws `CommentTrackBUnderReviewError`
//     (`comment_track_b_under_review`, HTTP 423), so the 400 + code assertions
//     fail.
//   - `mod_actions.reason` / `blocked_text` / `target_market_id` columns + the
//     `mod_reason` pgEnum do NOT exist.
//
// Assert PERSISTED STATE (the DEBATE.2 lesson). REAL DB tx; externals mocked.

const { mockGetSession, mockPrecommit } = vi.hoisted(() => ({
	mockGetSession: vi.fn(),
	mockPrecommit: vi.fn(),
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
	precommitModerate: mockPrecommit,
}));

import { POST as placePOST } from "@/app/api/bets/place/route";
import {
	bets,
	comments,
	dharmaLedger,
	modActions,
	positions,
	users,
} from "@/db/schema";
import { testClient, testDb } from "../../db/_fixtures/db";
import {
	placeRequest,
	seedDharmaGrant,
	seedOpenMarketWithPool,
	seedUser,
} from "./_fixtures/wire";

const TRACK_B_SCORES = {
	hate: 0.91,
	"hate/threatening": 0.55,
	sexual: 0.02,
	"sexual/minors": 0.0,
};

describe("DEBATE.7 moderation::track-b-blocked — block, no ban", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});
	afterEach(async () => {
		await testClient.unsafe(
			`TRUNCATE mod_actions, events, dharma_ledger, bets, comments, positions, pools, markets, users CASCADE`,
		);
	});

	it("track-b-blocked-no-ban", async () => {
		const userId = await seedUser("trackB-acc", "trackB-acc");
		const marketId = await seedOpenMarketWithPool("trackB-acc-market");
		await seedDharmaGrant(userId);
		const ledgerBefore = await testDb
			.select({ id: dharmaLedger.id })
			.from(dharmaLedger)
			.where(eq(dharmaLedger.userId, userId));

		mockGetSession.mockResolvedValue({ user: { id: userId } });
		mockPrecommit.mockResolvedValue({
			outcome: "track_b",
			categories: ["hate", "hate/threatening"],
			categoryScores: TRACK_B_SCORES,
		});

		const res = await placePOST(
			placeRequest(
				{
					marketId,
					side: "YES",
					stake: "10",
					body: "track-B blocked argument body",
				},
				"trackB-acc-key",
			),
		);

		// Wire: 400 comment_track_b_blocked (the §5 rename of the old 423).
		expect(res.status).toBe(400);
		const payload = await res.json();
		expect(payload.ok).toBe(false);
		expect(payload.error.code).toBe("comment_track_b_blocked");

		// ── mod_actions: reason track_b_blocked, NO ban, NO image ────────────────
		const actionRows = await testDb
			.select({
				reason: modActions.reason,
				verdict: modActions.verdict,
				actorId: modActions.actorId,
				categories: modActions.categories,
				blockedText: modActions.blockedText,
				targetMarketId: modActions.targetMarketId,
				targetUserId: modActions.targetUserId,
				imageR2Key: modActions.imageR2Key,
			})
			.from(modActions);
		expect(actionRows.length).toBe(1);
		const action = actionRows[0];
		expect(action?.reason).toBe("track_b_blocked");
		expect(action?.verdict).toBe("track_b");
		expect(action?.actorId).toBe("system");
		expect(action?.categories).toEqual(TRACK_B_SCORES);
		expect(action?.blockedText).toBe("track-B blocked argument body");
		expect(action?.targetMarketId).toBe(marketId);
		expect(action?.targetUserId).toBe(userId);
		expect(action?.imageR2Key).toBeNull();

		// ── NO ban (Track B removes nothing) ─────────────────────────────────────
		const [notBanned] = await testDb
			.select({ bannedAt: users.bannedAt })
			.from(users)
			.where(eq(users.id, userId));
		expect(notBanned?.bannedAt).toBeNull();

		// ── No bet / comment / stake ─────────────────────────────────────────────
		const betRows = await testDb
			.select({ id: bets.id })
			.from(bets)
			.where(eq(bets.marketId, marketId));
		expect(betRows.length).toBe(0);
		const commentRows = await testDb
			.select({ id: comments.id })
			.from(comments)
			.where(eq(comments.marketId, marketId));
		expect(commentRows.length).toBe(0);
		const positionRows = await testDb
			.select({ id: positions.id })
			.from(positions)
			.where(
				and(eq(positions.userId, userId), eq(positions.marketId, marketId)),
			);
		expect(positionRows.length).toBe(0);
		const ledgerAfter = await testDb
			.select({ id: dharmaLedger.id })
			.from(dharmaLedger)
			.where(eq(dharmaLedger.userId, userId));
		expect(ledgerAfter.length).toBe(ledgerBefore.length);
	});

	it("track-b-blocked::revised-resubmit-now-passes", async () => {
		// The author may revise — a Track-B block is not a ban. A second submit
		// (distinct idempotency key) whose revised body now PASSES the gate goes
		// through: the bet + comment land, and the user is never banned.
		const userId = await seedUser("trackB-revise", "trackB-revise");
		const marketId = await seedOpenMarketWithPool("trackB-revise-market");
		await seedDharmaGrant(userId);
		mockGetSession.mockResolvedValue({ user: { id: userId } });

		// First submit → track_b → blocked.
		mockPrecommit.mockResolvedValueOnce({
			outcome: "track_b",
			categories: ["hate"],
			categoryScores: TRACK_B_SCORES,
		});
		const blocked = await placePOST(
			placeRequest(
				{ marketId, side: "YES", stake: "10", body: "offensive first draft" },
				"trackB-revise-key-1",
			),
		);
		expect(blocked.status).toBe(400);
		expect((await blocked.json()).error.code).toBe("comment_track_b_blocked");

		// Revised resubmit → pass → 200; the bet + comment land.
		mockPrecommit.mockResolvedValueOnce({
			outcome: "pass",
			categories: [],
			categoryScores: {},
		});
		const ok = await placePOST(
			placeRequest(
				{ marketId, side: "YES", stake: "10", body: "civil revised argument" },
				"trackB-revise-key-2",
			),
		);
		expect(ok.status).toBe(200);
		expect((await ok.json()).ok).toBe(true);

		// Exactly one bet + one comment landed (the revised submit only).
		const betRows = await testDb
			.select({ id: bets.id })
			.from(bets)
			.where(eq(bets.marketId, marketId));
		expect(betRows.length).toBe(1);
		const commentRows = await testDb
			.select({ id: comments.id })
			.from(comments)
			.where(eq(comments.marketId, marketId));
		expect(commentRows.length).toBe(1);

		// The Track-B block recorded its row; the user was NEVER banned.
		const actionRows = await testDb
			.select({ reason: modActions.reason })
			.from(modActions);
		expect(actionRows.length).toBe(1);
		expect(actionRows[0]?.reason).toBe("track_b_blocked");
		const [stillActive] = await testDb
			.select({ bannedAt: users.bannedAt })
			.from(users)
			.where(eq(users.id, userId));
		expect(stillActive?.bannedAt).toBeNull();
	});
});
