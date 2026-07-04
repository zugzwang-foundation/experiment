import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// DEBATE.7 §10 — image-block (both tracks, image flow). When a gate-block fires
// on an image-bearing submit, `recordGateBlock` additionally flips the attached
// `image_uploads.terminal_state → 'blocked'` (the whitelisted Bucket-B
// NULL→set transition) and records the `image_r2_key` on the `mod_actions` row.
// The terminal flip uses the SAME claimed-exactly-one CAS (`terminal_state IS
// NULL` guard) that `place()` uses for the committed path — so the orphan sweep
// (which reaps `terminal_state IS NULL`) never deletes a blocked image's R2
// object, and the flip is idempotent. Covered for BOTH dispositions:
//   - track_a + image → blocked + auto-ban + image_uploads → 'blocked';
//   - track_b + image → blocked + no ban + image_uploads → 'blocked'.
//
// FAILING-FIRST (DEBATE.7 — symbols land at implement): RED because
//   - `recordGateBlock` does NOT exist → `image_uploads.terminal_state` stays
//     NULL, no `mod_actions` row (`place/route.ts` lines 99-104 only `throw`).
//   - `mod_actions.reason` / `target_market_id` columns + the `mod_reason`
//     pgEnum do NOT exist; `mod_actions.image_r2_key` is never written by a gate
//     block (no writer).
//   - `CommentTrackBBlockedError` (400 `comment_track_b_blocked`) does NOT exist
//     (track_b arm asserts the renamed 400).
//
// Assert PERSISTED STATE. REAL DB tx; externals mocked. NB the route resolves
// the image attachment pre-tx via the REAL `resolveImageAttachment` (reads the
// seeded un-attached image_uploads row), so the seeded r2 key shape is
// load-bearing (`u/<userId>/<uploadId>.jpg`).

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
// AUDIT-FIX-A1: the place route runs `verifyUploadedObject` (a real R2
// HeadObject) pre-moderation. Mock it benign so this route-integration test
// never hits the network — the seeded u/<userId>/<uploadId>.jpg image still
// flows through the (mocked) precommit block path unchanged.
vi.mock("@/server/storage/verify-object", () => ({
	verifyUploadedObject: vi.fn(async () => ({
		etag: '"imgblock-fixture-etag"',
		byteSize: 1024,
	})),
}));

import { POST as placePOST } from "@/app/api/bets/place/route";
import { imageUploads, modActions, users } from "@/db/schema";
import { testClient, testDb } from "../../db/_fixtures/db";
import { truncateTables } from "../../db/_fixtures/truncate";
import {
	placeRequest,
	seedDharmaGrant,
	seedImageUpload,
	seedOpenMarketWithPool,
	seedUser,
} from "./_fixtures/wire";

describe("DEBATE.7 moderation — image-block (both tracks)", () => {
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

	it("image-block::track-a-image-blocks-upload-and-bans", async () => {
		const userId = await seedUser("imgblock-a", "imgblock-a");
		const marketId = await seedOpenMarketWithPool("imgblock-a-market");
		await seedDharmaGrant(userId);
		const { uploadId, r2ObjectKey } = await seedImageUpload(userId);
		mockGetSession.mockResolvedValue({ user: { id: userId } });
		// A2: adult `sexual` on an IMAGE → track_a (CSAM-image backstop).
		mockPrecommit.mockResolvedValue({
			outcome: "track_a",
			categories: ["sexual"],
			categoryScores: { sexual: 0.96, "sexual/minors": 0.01 },
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
				"imgblock-a-key",
			),
		);

		expect(res.status).toBe(400);
		expect((await res.json()).error.code).toBe("comment_track_a_blocked");

		// mod_actions row carries the image_r2_key + reason track_a_autoban.
		const [action] = await testDb
			.select({
				reason: modActions.reason,
				imageR2Key: modActions.imageR2Key,
				targetMarketId: modActions.targetMarketId,
			})
			.from(modActions);
		expect(action?.reason).toBe("track_a_autoban");
		expect(action?.imageR2Key).toBe(r2ObjectKey);
		expect(action?.targetMarketId).toBe(marketId);

		// image_uploads flipped to 'blocked' (the CAS claimed exactly one row,
		// mirroring place()'s committed-path CAS) — the orphan sweep skips it.
		const [upload] = await testDb
			.select({ terminalState: imageUploads.terminalState })
			.from(imageUploads)
			.where(eq(imageUploads.id, uploadId));
		expect(upload?.terminalState).toBe("blocked");

		// Track A image → auto-ban.
		const [banned] = await testDb
			.select({ bannedAt: users.bannedAt })
			.from(users)
			.where(eq(users.id, userId));
		expect(banned?.bannedAt).not.toBeNull();
	});

	it("image-block::track-b-image-blocks-upload-no-ban", async () => {
		const userId = await seedUser("imgblock-b", "imgblock-b");
		const marketId = await seedOpenMarketWithPool("imgblock-b-market");
		await seedDharmaGrant(userId);
		const { uploadId, r2ObjectKey } = await seedImageUpload(userId);
		mockGetSession.mockResolvedValue({ user: { id: userId } });
		// e.g. violence/graphic on an image → ordinary track_b.
		mockPrecommit.mockResolvedValue({
			outcome: "track_b",
			categories: ["violence/graphic"],
			categoryScores: { "violence/graphic": 0.93 },
		});

		const res = await placePOST(
			placeRequest(
				{
					marketId,
					side: "NO",
					stake: "10",
					body: "graphic image caption",
					imageUploadsId: uploadId,
				},
				"imgblock-b-key",
			),
		);

		expect(res.status).toBe(400);
		expect((await res.json()).error.code).toBe("comment_track_b_blocked");

		const [action] = await testDb
			.select({
				reason: modActions.reason,
				imageR2Key: modActions.imageR2Key,
			})
			.from(modActions);
		expect(action?.reason).toBe("track_b_blocked");
		expect(action?.imageR2Key).toBe(r2ObjectKey);

		// image_uploads flipped to 'blocked' on Track B too.
		const [upload] = await testDb
			.select({ terminalState: imageUploads.terminalState })
			.from(imageUploads)
			.where(eq(imageUploads.id, uploadId));
		expect(upload?.terminalState).toBe("blocked");

		// Track B → NO ban.
		const [notBanned] = await testDb
			.select({ bannedAt: users.bannedAt })
			.from(users)
			.where(eq(users.id, userId));
		expect(notBanned?.bannedAt).toBeNull();
	});
});
