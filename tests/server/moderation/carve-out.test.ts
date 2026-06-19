import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// DEBATE.7 §10 — `moderation::sexual-minors-text-blocked-surfaced`
// (the carve-out row). Text-only `sexual/minors` is the ONE blocked-not-
// published disposition surfaced to reactive ban-review: the gate returns
// `track_b` (text-only carve-out), and `recordGateBlock`'s discriminant
// (`outcome === "track_b" && !imageR2Key && categories.includes("sexual/minors")`)
// writes reason `sexual_minors_text_blocked` (NOT `track_b_blocked`). The
// `blocked_text` is RETAINED for ban-review. The author is NEVER told the
// category — the wire response is the SAME 400 `comment_track_b_blocked` as an
// ordinary Track-B block (SPEC.1 §983); the distinction lives ONLY in
// `mod_actions.reason`, never in the response.
//
// FAILING-FIRST (DEBATE.7 — symbols land at implement): RED because
//   - `recordGateBlock` does NOT exist → no `mod_actions` row + no carve-out
//     discriminant (`place/route.ts` lines 99-104 only `throw`).
//   - the `sexual_minors_text_blocked` value of the `mod_reason` pgEnum + the
//     `reason` / `blocked_text` / `target_market_id` columns do NOT exist.
//   - `CommentTrackBBlockedError` (400 `comment_track_b_blocked`) does NOT exist
//     (route still throws the 423 `comment_track_b_under_review`).
//
// Assert PERSISTED STATE. REAL DB tx; externals mocked.

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
import { bets, comments, modActions, users } from "@/db/schema";
import { testClient, testDb } from "../../db/_fixtures/db";
import {
	placeRequest,
	seedDharmaGrant,
	seedOpenMarketWithPool,
	seedUser,
} from "./_fixtures/wire";

const CARVE_OUT_SCORES = {
	sexual: 0.61,
	"sexual/minors": 0.74,
};

describe("DEBATE.7 moderation::sexual-minors-text-blocked-surfaced (carve-out)", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});
	afterEach(async () => {
		await testClient.unsafe(
			`TRUNCATE mod_actions, events, dharma_ledger, bets, comments, positions, pools, markets, users CASCADE`,
		);
	});

	it("sexual-minors-text-blocked-surfaced", async () => {
		const userId = await seedUser("carveout-acc", "carveout-acc");
		const marketId = await seedOpenMarketWithPool("carveout-acc-market");
		await seedDharmaGrant(userId);
		mockGetSession.mockResolvedValue({ user: { id: userId } });
		// Text-only (no imageR2Key) + sexual/minors flagged → gate routes track_b
		// (the carve-out: text scores route to admin review, never auto-ban).
		mockPrecommit.mockResolvedValue({
			outcome: "track_b",
			categories: ["sexual/minors", "sexual"],
			categoryScores: CARVE_OUT_SCORES,
		});

		const res = await placePOST(
			placeRequest(
				{
					marketId,
					side: "NO",
					stake: "10",
					body: "carve-out text body retained for ban-review",
				},
				"carveout-acc-key",
			),
		);

		// Wire: the SAME 400 comment_track_b_blocked as an ordinary Track-B block —
		// the category is NEVER revealed to the author (SPEC.1 §983).
		expect(res.status).toBe(400);
		const payload = await res.json();
		expect(payload.ok).toBe(false);
		expect(payload.error.code).toBe("comment_track_b_blocked");

		// ── The discriminant lives ONLY in mod_actions.reason ────────────────────
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
		// The carve-out reason — NOT track_b_blocked. This is the discriminant the
		// reactive ban-review dashboard filters on.
		expect(action?.reason).toBe("sexual_minors_text_blocked");
		expect(action?.verdict).toBe("track_b");
		expect(action?.actorId).toBe("system");
		expect(action?.categories).toEqual(CARVE_OUT_SCORES);
		// blocked_text RETAINED for ban-review (admin-only; STRIP-in-dataset).
		expect(action?.blockedText).toBe(
			"carve-out text body retained for ban-review",
		);
		expect(action?.targetMarketId).toBe(marketId);
		expect(action?.targetUserId).toBe(userId);
		// Carve-out is text-only — no image attached.
		expect(action?.imageR2Key).toBeNull();

		// ── No ban (the carve-out is surfaced for HUMAN review, not auto-ban) ─────
		const [notBanned] = await testDb
			.select({ bannedAt: users.bannedAt })
			.from(users)
			.where(eq(users.id, userId));
		expect(notBanned?.bannedAt).toBeNull();

		// ── No bet / comment (the blocked-not-published row IS the only artefact) ─
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
	});
});
