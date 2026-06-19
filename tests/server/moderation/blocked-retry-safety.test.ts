import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// DEBATE.7 §8 — retry-safety of a gate-block under the §3.1 door order. Two
// distinct safety properties at the boundary where reactive-moderation
// consequences meet idempotency + the auth+ban gate:
//
//   A. A Track-B block is recorded ONCE: a same-key retry replays the cached
//      400 from the idempotency cache and NEVER re-enters `inner` — so the gate
//      (`precommitModerate`, the OpenAI verdict surface) is NOT called a second
//      time and NO second classification happens. No ban anywhere (Track B
//      removes nothing).
//
//   B. A Track-A auto-ban makes ALL of that user's subsequent submits 403 at the
//      auth+ban gate, which sits BEFORE the idempotency cache (route step 1 vs
//      step 3) — so a same-key retry returns 403 `banned_user` (NOT the cached
//      400), the gate is NOT called, and `recordGateBlock` is never reached. A
//      DIFFERENT new key from the now-banned user is also 403 — banned-state is
//      read from the REAL `users` row, independent of any idempotency key.
//
// Why this is the safety seam: the only way to get two `mod_actions` rows is two
// genuinely-distinct idempotency keys = two real submits (plan §8). A retry must
// NEVER re-classify, and a banned user must NEVER reach the consequence writer.
//
// FAILING-FIRST (DEBATE.7 — symbols land at implement, plan §14 step 3): RED
// because none of the consequence wiring exists yet —
//   - `src/server/moderation/consequences.ts` / `recordGateBlock` does NOT
//     exist, so `place/route.ts` (lines 99-104 only `throw`) writes NO
//     `mod_actions` row and sets NO `banned_at` on a gate-block.
//   - `CommentTrackBBlockedError` (code `comment_track_b_blocked`, HTTP 400)
//     does NOT exist — the route still throws `CommentTrackBUnderReviewError`
//     (`comment_track_b_under_review`, HTTP 423), so the 400 + code assertions
//     fail.
//   - the `mod_actions.reason` column + the `mod_reason` pgEnum do NOT exist
//     (schema is verdict-keyed only) — the `reason` SELECT fails.
// Because the first track_a submit cannot set `banned_at`, Test B's retry never
// flips to 403 → RED. Because the first track_b submit cannot return the renamed
// 400, Test A's cached-replay code assertion → RED.
//
// Assertion discipline (kickoff): assert the BEHAVIOURAL contract — no second
// classifier call · idempotent/precedent ban · banned-retry rejected — and
// persisted STATE (banned_at NULL vs SET; no new bets/comments on the banned
// retry) via existence/state checks. DO NOT assert a `mod_actions` row COUNT
// anywhere — plan §8 permits a benign duplicate audit row (the
// reservation-release→cache-write race); over-recording is harmless on the
// append-only audit table.
//
// REAL DB tx hits test Postgres (so the auth+ban gate reads the genuine
// `users.bannedAt` the writer sets). The externals are mocked: auth / origin /
// rate-limit / the OpenAI verdict (`precommitModerate`). The idempotency cache
// is a STATEFUL miss-then-hit machine (the `idempotency-replay.test.ts` pattern)
// so the cache-hit replay arm is genuine. `runBetTransaction` is NOT mocked —
// the gate aborts before it on every case here.

const { mockGetSession, mockPrecommit, idemStore, mockLookupOrReserve } =
	vi.hoisted(() => {
		const store = new Map<
			string,
			{ status: number; body: unknown; bodyFingerprint: string }
		>();
		return {
			mockGetSession: vi.fn(),
			mockPrecommit: vi.fn(),
			idemStore: store,
			// Single-key-encoding-both-states machine (SPEC.2 §11): first call for a
			// key → miss (caller MUST call release(response) to populate the store);
			// a subsequent call with the same key+fingerprint → hit (verbatim replay).
			mockLookupOrReserve: vi.fn(async (key: string, fingerprint: string) => {
				const existing = store.get(key);
				if (existing && existing.bodyFingerprint === fingerprint) {
					return { kind: "hit", cachedResponse: existing };
				}
				return {
					kind: "miss",
					release: async (
						response: {
							status: number;
							body: unknown;
							bodyFingerprint: string;
						} | null,
					) => {
						if (response === null) {
							store.delete(key);
							return;
						}
						store.set(key, response);
					},
				};
			}),
		};
	});

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
	computeBodyFingerprint: vi.fn(async (body: unknown) => JSON.stringify(body)),
	idempotencyLookupOrReserve: mockLookupOrReserve,
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

const TRACK_B_SCORES = {
	hate: 0.9,
	"hate/threatening": 0.4,
	"sexual/minors": 0.0,
};
const TRACK_A_SCORES = {
	sexual: 0.97,
	"sexual/minors": 0.02,
};

describe("DEBATE.7 moderation::blocked-retry-safety", () => {
	beforeEach(() => {
		idemStore.clear();
		vi.clearAllMocks();
	});
	afterEach(async () => {
		await testClient.unsafe(
			`TRUNCATE mod_actions, events, dharma_ledger, bets, comments, positions, pools, markets, users CASCADE`,
		);
	});

	it("blocked-retry-safety::track-b-same-key-retry-replays-cache-no-second-classifier-call", async () => {
		const userId = await seedUser("retry-trackB", "retry-trackB");
		const marketId = await seedOpenMarketWithPool("retry-trackB-market");
		await seedDharmaGrant(userId);
		mockGetSession.mockResolvedValue({ user: { id: userId } });
		// The gate scores track_b on EVERY call; the test proves it is consulted
		// only once across both submits (the cache hit short-circuits the second).
		mockPrecommit.mockResolvedValue({
			outcome: "track_b",
			categories: ["hate"],
			categoryScores: TRACK_B_SCORES,
		});

		const KEY = "retry-trackB-key";
		const reqBody = {
			marketId,
			side: "YES",
			stake: "10",
			body: "track-B blocked argument body",
		};

		// 1. First submit → idem MISS → gate runs → track_b → recordGateBlock writes
		// a `track_b_blocked` row, NO ban → 400 comment_track_b_blocked (the renamed
		// 400, §5). The terminal 4xx is cached against KEY.
		const first = await placePOST(placeRequest(reqBody, KEY));
		expect(first.status).toBe(400);
		expect((await first.json()).error.code).toBe("comment_track_b_blocked");

		// The gate was consulted exactly once on the miss pass.
		expect(mockPrecommit).toHaveBeenCalledTimes(1);

		// A `track_b_blocked` audit row landed (existence/state, NOT a count — plan
		// §8 permits a benign duplicate). No ban — Track B removes nothing.
		const afterFirst = await testDb
			.select({ reason: modActions.reason })
			.from(modActions);
		expect(afterFirst.some((r) => r.reason === "track_b_blocked")).toBe(true);
		const [notBannedYet] = await testDb
			.select({ bannedAt: users.bannedAt })
			.from(users)
			.where(eq(users.id, userId));
		expect(notBannedYet?.bannedAt).toBeNull();

		// 2. Retry the SAME key (+ same body) → idem HIT → the cached 400 replays
		// VERBATIM, `inner` never re-runs.
		const retry = await placePOST(placeRequest(reqBody, KEY));
		expect(retry.status).toBe(400);
		const retryBody = await retry.json();
		expect(retryBody.error.code).toBe("comment_track_b_blocked");

		// THE load-bearing assertion: the gate was NOT consulted a second time —
		// the cache hit short-circuited before `inner`/moderation. No double
		// classification.
		expect(mockPrecommit).toHaveBeenCalledTimes(1);

		// The user is STILL not banned anywhere — a Track-B block is not a ban, and
		// the replay cannot have introduced one.
		const [stillNotBanned] = await testDb
			.select({ bannedAt: users.bannedAt })
			.from(users)
			.where(eq(users.id, userId));
		expect(stillNotBanned?.bannedAt).toBeNull();
	});

	it("blocked-retry-safety::track-a-ban-rejects-all-retries-at-auth-gate-before-cache", async () => {
		const userId = await seedUser("retry-trackA", "retry-trackA");
		const marketId = await seedOpenMarketWithPool("retry-trackA-market");
		await seedDharmaGrant(userId);
		mockGetSession.mockResolvedValue({ user: { id: userId } });
		mockPrecommit.mockResolvedValue({
			outcome: "track_a",
			categories: ["sexual"],
			categoryScores: TRACK_A_SCORES,
		});

		const KEY1 = "retry-trackA-key-1";
		const body1 = {
			marketId,
			side: "YES",
			stake: "10",
			body: "track-A blocked argument body",
		};

		// 1. First submit → idem MISS → gate runs → track_a → recordGateBlock sets
		// `banned_at` (NOT seeded directly — the writer sets it, keeping this RED
		// until `recordGateBlock` exists) → 400 comment_track_a_blocked.
		const first = await placePOST(placeRequest(body1, KEY1));
		expect(first.status).toBe(400);
		expect((await first.json()).error.code).toBe("comment_track_a_blocked");
		expect(mockPrecommit).toHaveBeenCalledTimes(1);

		// The auto-ban landed on the REAL users row.
		const [banned] = await testDb
			.select({ bannedAt: users.bannedAt })
			.from(users)
			.where(eq(users.id, userId));
		expect(banned?.bannedAt).not.toBeNull();

		// 2. Retry the SAME key → the auth+ban gate (route step 1) fires BEFORE the
		// idempotency cache (step 3): 403 `banned_user`, NOT the cached 400. The
		// gate is NOT consulted (we never reach `inner`).
		const sameKeyRetry = await placePOST(placeRequest(body1, KEY1));
		expect(sameKeyRetry.status).toBe(403);
		expect((await sameKeyRetry.json()).error.code).toBe("banned_user");
		// Still exactly one classifier call total — the banned retry never reached
		// the gate.
		expect(mockPrecommit).toHaveBeenCalledTimes(1);

		// 3. The same banned user submits a DIFFERENT bet with a NEW key → still 403
		// `banned_user` (banned-state is read from the users row, key-independent).
		// The gate is NOT consulted, and `recordGateBlock` is never reached → no new
		// bet / comment, no new audit row written for this attempt.
		const KEY2 = "retry-trackA-key-2";
		const body2 = {
			marketId,
			side: "NO",
			stake: "10",
			body: "a fresh attempt from the banned user",
		};
		const newKeySubmit = await placePOST(placeRequest(body2, KEY2));
		expect(newKeySubmit.status).toBe(403);
		expect((await newKeySubmit.json()).error.code).toBe("banned_user");
		// The gate was NEVER consulted for the banned user's new-key attempt either.
		expect(mockPrecommit).toHaveBeenCalledTimes(1);

		// The banned user's submits never published anything: no bet, no comment in
		// the market (existence/state check — DEBATE.2 lesson).
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
