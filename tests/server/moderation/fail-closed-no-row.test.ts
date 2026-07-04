import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// DEBATE.7 §10 — fail-closed extension. A terminal OpenAI failure fails CLOSED
// (ADR-0014 / SPEC.2 §10): `ModerationUnavailableError` → 503
// `error_moderation_unavailable` + `Retry-After: 5`, no bet/comment, reservation
// already released. DEBATE.7 EXTENDS the existing fail-closed assertion: the new
// writer (`recordGateBlock`) must NOT fire on a terminal failure — there is NO
// gate verdict to record, so NO `mod_actions` row is written (a fail-closed
// block is not an audited disposition).
//
// FAILING-FIRST (DEBATE.7 — symbols land at implement): RED because the test
// references `mod_actions.reason` (the new column) in its "no row" assertion —
// the `reason` column + the `mod_reason` pgEnum do NOT exist yet, so the schema
// import + select fail to type-check / run. (The 503 + Retry-After arm exercises
// the pre-existing fail-closed path; the load-bearing NEW assertion is the
// absent-row one, which depends on the post-migration schema.)
//
// Assert PERSISTED STATE (no row). REAL DB tx; the gate's vendor surfaces
// (redis / openai / sign-read) are mocked so `precommitModerate` runs FOR REAL
// and throws ModerationUnavailableError on the terminal OpenAI failure.

const { mockGetSession, mockRedis, mockOpenAiModerate, mockSignRead } =
	vi.hoisted(() => ({
		mockGetSession: vi.fn(),
		mockRedis: {
			set: vi.fn(),
			get: vi.fn(),
			del: vi.fn(),
			eval: vi.fn(),
		},
		mockOpenAiModerate: vi.fn(),
		mockSignRead: vi.fn(),
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
// NB: precommitModerate is NOT mocked here — it runs for real (the gate's vendor
// surfaces are mocked below), so the terminal OpenAI failure flows through the
// real fail-closed path into the route.
vi.mock("@/server/upstash/redis", () => ({
	redis: mockRedis,
}));
vi.mock("@/server/moderation/openai", () => ({
	moderate: mockOpenAiModerate,
}));
vi.mock("@/server/storage/sign-read", () => ({
	signRead: mockSignRead,
}));

import { POST as placePOST } from "@/app/api/bets/place/route";
import { bets, comments, modActions } from "@/db/schema";
import { testClient, testDb } from "../../db/_fixtures/db";
import { truncateTables } from "../../db/_fixtures/truncate";
import {
	placeRequest,
	seedDharmaGrant,
	seedOpenMarketWithPool,
	seedUser,
} from "./_fixtures/wire";

describe("DEBATE.7 moderation — fail-closed writes NO mod_actions row", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockRedis.set.mockReset();
		mockRedis.del.mockReset();
		mockOpenAiModerate.mockReset();
		mockSignRead.mockReset();
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

	it("fail-closed::terminal-openai-failure-503-and-no-mod-actions-row", async () => {
		const userId = await seedUser("failclosed-acc", "failclosed-acc");
		const marketId = await seedOpenMarketWithPool("failclosed-acc-market");
		await seedDharmaGrant(userId);
		mockGetSession.mockResolvedValue({ user: { id: userId } });

		// Reservation acquired + released; the OpenAI hop terminally fails →
		// precommitModerate wraps it as ModerationUnavailableError (fail-closed).
		mockRedis.set.mockResolvedValue("OK");
		mockRedis.del.mockResolvedValue(1);
		mockOpenAiModerate.mockRejectedValue(new Error("openai 5xx after retry"));

		const res = await placePOST(
			placeRequest(
				{
					marketId,
					side: "YES",
					stake: "10",
					body: "fail-closed argument body",
				},
				"failclosed-acc-key",
			),
		);

		// 503 + Retry-After: 5 (ADR-0014 / SPEC.2 §10 fail-closed posture).
		expect(res.status).toBe(503);
		expect(res.headers.get("retry-after")).toBe("5");
		const payload = await res.json();
		expect(payload.ok).toBe(false);
		expect(payload.error.code).toBe("error_moderation_unavailable");
		expect(payload.error.retry_after).toBe(5);

		// THE new load-bearing assertion: NO mod_actions row — the writer must NOT
		// fire on a terminal moderation failure (there is no verdict to record).
		const actionRows = await testDb
			.select({ reason: modActions.reason })
			.from(modActions);
		expect(actionRows.length).toBe(0);

		// And no bet / comment landed either (fail-closed — nothing published).
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
