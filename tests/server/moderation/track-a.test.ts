import { and, eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// DEBATE.7 §10 — `moderation::track-a-auto-ban` →
// `track-a.test.ts::auto-ban-and-positions-preserved` (the exact path SPEC.1
// §782 names). The reactive-moderation consequence wiring: when the gate
// returns `track_a`, the route runs the new standalone-tx writer
// (`recordGateBlock`) BEFORE throwing — it appends one `mod_actions` audit row
// + auto-bans the user (`users.banned_at = now()`), and (image flow) flips
// `image_uploads.terminal_state → 'blocked'`. The bet+comment tx NEVER opens
// (INV-1 holds trivially — no partial state); positions + dharma_ledger are
// UNTOUCHED ("ban removes voice, not balance" — INV-2/INV-3).
//
// FAILING-FIRST (DEBATE.7 — symbols land at implement): RED because
//   - `src/server/moderation/consequences.ts` / `recordGateBlock` does NOT exist,
//     so `place/route.ts` writes NO `mod_actions` row on track_a (lines 99-104
//     only `throw`) — every persisted-row assertion below fails.
//   - `mod_actions.reason` / `blocked_text` / `target_market_id` columns + the
//     `mod_reason` pgEnum do NOT exist (schema is verdict-keyed only).
//   - `precommitModerate` does NOT yet return `categoryScores`.
//
// Assert PERSISTED STATE (the DEBATE.2 lesson), not just the wire response. The
// REAL DB tx hits test Postgres; only the externals are mocked (auth / origin /
// rate-limit / idempotency / moderation verdict — MOCKED per §10).

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
import { truncateTables } from "../../db/_fixtures/truncate";
import {
	placeRequest,
	seedDharmaGrant,
	seedOpenMarketWithPool,
	seedUser,
} from "./_fixtures/wire";

// Scores the enriched `precommitModerate` return carries into
// `mod_actions.categories` ("with confidence" — SPEC.1 §786 / App.B.10).
const TRACK_A_SCORES = {
	sexual: 0.97,
	"sexual/minors": 0.02,
	violence: 0.01,
};

describe("DEBATE.7 moderation::track-a — auto-ban + positions preserved", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});
	afterEach(async () => {
		await truncateTables(testClient, [
			"mod_actions",
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

	it("track-a::auto-ban-and-positions-preserved", async () => {
		const userId = await seedUser("trackA-acc", "trackA-acc");
		const marketId = await seedOpenMarketWithPool("trackA-acc-market");
		// A prior, clean position + a single initial_grant the ban must NOT disturb
		// ("positions ride to resolution"). Both pre-date the blocked submit.
		await seedDharmaGrant(userId);
		await testDb.insert(positions).values({
			userId,
			marketId,
			side: "YES",
			quantity: "5.000000000000000000",
		});
		const ledgerBefore = await testDb
			.select({ id: dharmaLedger.id })
			.from(dharmaLedger)
			.where(eq(dharmaLedger.userId, userId));

		mockGetSession.mockResolvedValue({ user: { id: userId } });
		// Gate returns track_a + the enriched scores the writer persists.
		mockPrecommit.mockResolvedValue({
			outcome: "track_a",
			categories: ["sexual"],
			categoryScores: TRACK_A_SCORES,
		});

		const res = await placePOST(
			placeRequest(
				{
					marketId,
					side: "YES",
					stake: "10",
					body: "track-A blocked argument body",
				},
				"trackA-acc-key",
			),
		);

		// Wire: 400 comment_track_a_blocked (category never revealed beyond the code).
		expect(res.status).toBe(400);
		const payload = await res.json();
		expect(payload.ok).toBe(false);
		expect(payload.error.code).toBe("comment_track_a_blocked");

		// ── The mod_actions audit row — EVERY field §2/§10 names for track_a ─────
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
		expect(action?.reason).toBe("track_a_autoban");
		expect(action?.verdict).toBe("track_a");
		expect(action?.actorId).toBe("system");
		// categories carries the OpenAI SCORES (not the boolean/name list).
		expect(action?.categories).toEqual(TRACK_A_SCORES);
		expect(action?.blockedText).toBe("track-A blocked argument body");
		expect(action?.targetMarketId).toBe(marketId);
		expect(action?.targetUserId).toBe(userId);
		// Text-only flow — no image attached.
		expect(action?.imageR2Key).toBeNull();

		// ── The auto-ban: users.banned_at SET ───────────────────────────────────
		const [banned] = await testDb
			.select({ bannedAt: users.bannedAt })
			.from(users)
			.where(eq(users.id, userId));
		expect(banned?.bannedAt).not.toBeNull();

		// ── INV-1: the bet+comment tx NEVER opened — no bet, no comment ──────────
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

		// ── INV-2 / INV-3: positions + dharma_ledger UNTOUCHED ───────────────────
		const positionRows = await testDb
			.select({ side: positions.side, quantity: positions.quantity })
			.from(positions)
			.where(
				and(eq(positions.userId, userId), eq(positions.marketId, marketId)),
			);
		expect(positionRows.length).toBe(1);
		expect(positionRows[0]?.side).toBe("YES");
		expect(positionRows[0]?.quantity).toBe("5.000000000000000000");
		const ledgerAfter = await testDb
			.select({ id: dharmaLedger.id })
			.from(dharmaLedger)
			.where(eq(dharmaLedger.userId, userId));
		expect(ledgerAfter.length).toBe(ledgerBefore.length);
	});
});
