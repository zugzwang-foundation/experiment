import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// AUDIT-FIX-B5 (A13) — every gate-block branch emits exactly ONE
// `moderation.blocked` events row INSIDE the same standalone `recordGateBlock`
// transaction as the `mod_actions` row (+ track_a ban, + image flip). Closes the
// §3.7 gap (every state-mutating flow emits ≥1 events row in the same tx) + the
// §7.5 F-MOD-* write set (`mod_actions` + `events`). aggregate_type='mod_action',
// aggregate_id = the mod_actions.id; payload { userId, reason, banned, uploadId };
// metadata self-actor (user_id = actor_id = submitting user), flow F-MOD-1
// (track_a) / F-MOD-2 (both track_b branches).
//
// FAILING-FIRST: RED because `recordGateBlock` calls `insertEvent` ZERO times and
// `moderation.blocked` / aggregate_type `mod_action` do not yet exist — the
// events-table assertions below all fail (0 rows).
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
vi.mock("@/server/storage/verify-object", () => ({
	verifyUploadedObject: vi.fn(async () => ({
		etag: '"b5-fixture-etag"',
		byteSize: 1024,
	})),
}));

import { POST as placePOST } from "@/app/api/bets/place/route";
import { modActions } from "@/db/schema";
import { testClient, testDb } from "../../db/_fixtures/db";
import { truncateTables } from "../../db/_fixtures/truncate";
import {
	placeRequest,
	seedDharmaGrant,
	seedImageUpload,
	seedOpenMarketWithPool,
	seedUser,
} from "./_fixtures/wire";

type EventRow = {
	event_type: string;
	aggregate_type: string;
	aggregate_id: string;
	payload: {
		userId: string;
		reason: string;
		banned: boolean;
		uploadId: string | null;
	};
	metadata: { user_id: string | null; actor_id: string; flow_id: string };
};

async function readBlockedEvents(): Promise<EventRow[]> {
	return testClient<EventRow[]>`
		SELECT event_type, aggregate_type, aggregate_id, payload, metadata
		  FROM events WHERE event_type = 'moderation.blocked'`;
}

describe("AUDIT-FIX-B5 (A13) moderation.blocked — emit on every block branch", () => {
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
			"image_uploads",
			"markets",
			"users",
		]);
	});

	it("track_a (text-only) → one moderation.blocked, banned:true, uploadId:null, F-MOD-1", async () => {
		const userId = await seedUser("b5-tA", "b5-tA");
		const marketId = await seedOpenMarketWithPool("b5-tA-market");
		await seedDharmaGrant(userId);
		mockGetSession.mockResolvedValue({ user: { id: userId } });
		mockPrecommit.mockResolvedValue({
			outcome: "track_a",
			categories: ["sexual"],
			categoryScores: { sexual: 0.97, "sexual/minors": 0.02 },
		});

		const res = await placePOST(
			placeRequest(
				{ marketId, side: "YES", stake: "10", body: "track-A body" },
				"b5-tA-key",
			),
		);
		expect(res.status).toBe(400);

		const [action] = await testDb
			.select({ id: modActions.id })
			.from(modActions);
		const events = await readBlockedEvents();
		expect(events.length).toBe(1);
		const ev = events[0];
		expect(ev?.event_type).toBe("moderation.blocked");
		expect(ev?.aggregate_type).toBe("mod_action");
		expect(ev?.aggregate_id).toBe(action?.id);
		expect(ev?.payload).toEqual({
			userId,
			reason: "track_a_autoban",
			banned: true,
			uploadId: null,
		});
		expect(ev?.metadata.user_id).toBe(userId);
		expect(ev?.metadata.actor_id).toBe(userId);
		expect(ev?.metadata.flow_id).toBe("F-MOD-1");
	});

	it("track_a (image) → moderation.blocked, banned:true, uploadId set, F-MOD-1", async () => {
		const userId = await seedUser("b5-tA-img", "b5-tA-img");
		const marketId = await seedOpenMarketWithPool("b5-tA-img-market");
		await seedDharmaGrant(userId);
		const { uploadId } = await seedImageUpload(userId);
		mockGetSession.mockResolvedValue({ user: { id: userId } });
		mockPrecommit.mockResolvedValue({
			outcome: "track_a",
			categories: ["sexual"],
			categoryScores: { sexual: 0.96 },
		});

		const res = await placePOST(
			placeRequest(
				{
					marketId,
					side: "YES",
					stake: "10",
					body: "image caption",
					imageUploadsId: uploadId,
				},
				"b5-tA-img-key",
			),
		);
		expect(res.status).toBe(400);

		const events = await readBlockedEvents();
		expect(events.length).toBe(1);
		expect(events[0]?.payload).toEqual({
			userId,
			reason: "track_a_autoban",
			banned: true,
			uploadId,
		});
		expect(events[0]?.metadata.flow_id).toBe("F-MOD-1");
	});

	it("sexual_minors_text_blocked (text-only) → moderation.blocked, banned:false, uploadId:null, F-MOD-2", async () => {
		const userId = await seedUser("b5-smtb", "b5-smtb");
		const marketId = await seedOpenMarketWithPool("b5-smtb-market");
		await seedDharmaGrant(userId);
		mockGetSession.mockResolvedValue({ user: { id: userId } });
		// text-only sexual/minors → Track B carve-out (no image).
		mockPrecommit.mockResolvedValue({
			outcome: "track_b",
			categories: ["sexual/minors"],
			categoryScores: { "sexual/minors": 0.71 },
		});

		const res = await placePOST(
			placeRequest(
				{ marketId, side: "NO", stake: "10", body: "text-only smtb body" },
				"b5-smtb-key",
			),
		);
		expect(res.status).toBe(400);

		const [action] = await testDb
			.select({ reason: modActions.reason, id: modActions.id })
			.from(modActions);
		expect(action?.reason).toBe("sexual_minors_text_blocked");

		const events = await readBlockedEvents();
		expect(events.length).toBe(1);
		expect(events[0]?.aggregate_id).toBe(action?.id);
		expect(events[0]?.payload).toEqual({
			userId,
			reason: "sexual_minors_text_blocked",
			banned: false,
			uploadId: null,
		});
		expect(events[0]?.metadata.flow_id).toBe("F-MOD-2");
	});

	it("track_b_blocked (text-only) → moderation.blocked, banned:false, uploadId:null, F-MOD-2", async () => {
		const userId = await seedUser("b5-tB", "b5-tB");
		const marketId = await seedOpenMarketWithPool("b5-tB-market");
		await seedDharmaGrant(userId);
		mockGetSession.mockResolvedValue({ user: { id: userId } });
		mockPrecommit.mockResolvedValue({
			outcome: "track_b",
			categories: ["hate"],
			categoryScores: { hate: 0.9 },
		});

		const res = await placePOST(
			placeRequest(
				{ marketId, side: "YES", stake: "10", body: "track-B body" },
				"b5-tB-key",
			),
		);
		expect(res.status).toBe(400);

		const events = await readBlockedEvents();
		expect(events.length).toBe(1);
		expect(events[0]?.payload).toEqual({
			userId,
			reason: "track_b_blocked",
			banned: false,
			uploadId: null,
		});
		expect(events[0]?.metadata.flow_id).toBe("F-MOD-2");
		expect(events[0]?.metadata.actor_id).toBe(userId);
	});
});
