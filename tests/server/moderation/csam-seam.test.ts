import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// DEBATE.7 §10 — CSAM seam (seam only; no NCMEC build — OD-5 / LD-7). In
// `recordGateBlock`, when `outcome === "track_a" && categories.includes(
// "sexual/minors")`, emit a Sentry custom event (`csam_auto_report_pending`)
// carrying the `mod_actions.id` + a `// TODO(MOD-NCMEC-INTEGRATION)` marker. NO
// NCMEC API call. Under A2, a track_a from adult `sexual`+image is NOT
// `sexual/minors`, so it does NOT fire the seam (correct — it is not CSAM). The
// text-only `sexual/minors` carve-out is track_b, so it never reaches this
// track_a-only seam either (it surfaces via its reason + the reactive feed).
//
// FAILING-FIRST (DEBATE.7 — symbols land at implement): RED because
//   - `src/server/moderation/consequences.ts` / `recordGateBlock` does NOT exist
//     → the VALUE import fails to resolve, the suite cannot collect.
//   - `mod_actions.reason` / `target_market_id` columns + the `mod_reason`
//     pgEnum do NOT exist (the rows recordGateBlock would write).
//
// Sentry is MOCKED (assert the seam fires / does-not-fire); NO real capture. The
// recordGateBlock write hits test Postgres. There is NO NCMEC client in the repo
// — the absence is asserted structurally (no such module import is mocked, and
// the seam is Sentry-only).

const { mockCaptureMessage, mockCaptureException, mockAddBreadcrumb } =
	vi.hoisted(() => ({
		mockCaptureMessage: vi.fn(),
		mockCaptureException: vi.fn(),
		mockAddBreadcrumb: vi.fn(),
	}));

vi.mock("@sentry/nextjs", () => ({
	captureMessage: mockCaptureMessage,
	captureException: mockCaptureException,
	addBreadcrumb: mockAddBreadcrumb,
}));

import { modActions } from "@/db/schema";
// recordGateBlock — the new standalone-tx consequence writer (DEBATE.7 §12). Its
// signature is the implementer's contract; the test exercises it through the
// fields §2/§7 name. VALUE import → RED until consequences.ts lands.
import { recordGateBlock } from "@/server/moderation/consequences";
import { testClient, testDb } from "../../db/_fixtures/db";
import { seedOpenMarketWithPool, seedUser } from "./_fixtures/wire";

describe("DEBATE.7 moderation — CSAM seam (Sentry-only; no NCMEC)", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});
	afterEach(async () => {
		await testClient.unsafe(`TRUNCATE mod_actions, markets, users CASCADE`);
	});

	it("csam-seam::track-a-sexual-minors-fires-sentry-seam", async () => {
		const userId = await seedUser("csam-seam-a", "csam-seam-a");
		const marketId = await seedOpenMarketWithPool("csam-seam-a-market");

		// track_a + categories includes sexual/minors → the CSAM seam fires.
		await recordGateBlock({
			outcome: "track_a",
			categories: ["sexual/minors"],
			categoryScores: { "sexual/minors": 0.95, sexual: 0.9 },
			userId,
			marketId,
			blockedText: "csam-adjacent text body",
			imageR2Key: undefined,
		});

		// A mod_actions row landed (reason track_a_autoban).
		const [action] = await testDb
			.select({ id: modActions.id, reason: modActions.reason })
			.from(modActions);
		expect(action?.reason).toBe("track_a_autoban");

		// The Sentry seam fired carrying the mod_actions.id — no NCMEC call.
		expect(mockCaptureMessage).toHaveBeenCalledWith(
			"csam_auto_report_pending",
			expect.objectContaining({
				tags: expect.objectContaining({ mod_action_id: action?.id }),
			}),
		);
	});

	it("csam-seam::track-a-adult-sexual-image-does-not-fire-seam", async () => {
		const userId = await seedUser("csam-seam-b", "csam-seam-b");
		const marketId = await seedOpenMarketWithPool("csam-seam-b-market");

		// A2: adult `sexual` on an IMAGE is track_a but NOT sexual/minors — it is
		// NOT CSAM, so the seam must NOT fire.
		await recordGateBlock({
			outcome: "track_a",
			categories: ["sexual"],
			categoryScores: { sexual: 0.96, "sexual/minors": 0.01 },
			userId,
			marketId,
			blockedText: "adult image caption",
			imageR2Key: `u/${userId}/img-adult.jpg`,
		});

		// The mod_actions row still lands (track_a_autoban) — but the seam stays quiet.
		const [action] = await testDb
			.select({ reason: modActions.reason })
			.from(modActions);
		expect(action?.reason).toBe("track_a_autoban");

		expect(mockCaptureMessage).not.toHaveBeenCalledWith(
			"csam_auto_report_pending",
			expect.anything(),
		);
	});
});
