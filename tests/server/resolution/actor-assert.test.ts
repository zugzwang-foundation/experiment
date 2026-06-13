import { v7 as uuidv7 } from "uuid";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@sentry/nextjs", () => ({
	captureMessage: vi.fn(),
	addBreadcrumb: vi.fn(),
	captureException: vi.fn(),
}));

import { markets, pools } from "@/db/schema";
import { AdminActorError } from "@/server/admin/actor";
import { correctResolution } from "@/server/resolution/correct";
import { settleMarket } from "@/server/resolution/settle";
import { triggerResolution } from "@/server/resolution/trigger";
import { voidMarket } from "@/server/resolution/void";

import { testClient, testDb } from "../../db/_fixtures/db";

// ENGINE.15 S1 tests-first (charter file 3 — CF-6 belt, §Actor retrofit). The
// four W-3 resolution services (trigger/settle/correct/void) must each
// `assertAdminActor(args.metadata)` at function entry — the ≤16-line belt S2/S4
// adds (mirroring the ENGINE.14 lifecycle pattern). RED NOW because the belt is
// ABSENT: with a minimal VALID fixture that would otherwise SUCCEED, calling
// with PARTICIPANT-shaped metadata currently does NOT throw AdminActorError
// (the service runs to completion, or throws some other error), so
// `rejects.toBeInstanceOf(AdminActorError)` fails on the ASSERTION. The
// companion admin-shaped cases PASS now and must stay passing. Mirrors the
// markets.test.ts M4 pattern. DB-BACKED (:54322).
//
// Reject metadata: two participant shapes — actor_id !== 'admin-singleton'
// (a real user id), and user_id !== null (the M4 split). Either must trip the
// belt.

const SEED = "100.000000000000000000";
const FIXTURE_DEADLINE = new Date("2026-11-01T00:00:00.000Z");
const RESOLVE_REASON = "Criterion met: actor-belt fixture evidence.";
const CORRECT_REASON = "Corrected: actor-belt fixture evidence.";
const VOID_REASON = "Voided: actor-belt fixture evidence.";

function adminMetadata(flowId: string) {
	return {
		request_id: "test-actor-belt",
		flow_id: flowId,
		user_id: null,
		actor_id: "admin-singleton",
		idempotency_key: null,
		ip: "test",
		user_agent: "vitest",
	};
}

/** actor_id is a real user id (not 'admin-singleton') — participant shape. */
function participantActorMetadata(flowId: string) {
	const userId = uuidv7();
	return {
		request_id: "test-actor-belt",
		flow_id: flowId,
		user_id: userId,
		actor_id: userId,
		idempotency_key: null,
		ip: "test",
		user_agent: "vitest",
	};
}

/** admin actor_id but a NON-null user_id — the M4 split, also illegal. */
function nonNullUserMetadata(flowId: string) {
	return {
		request_id: "test-actor-belt",
		flow_id: flowId,
		user_id: uuidv7(),
		actor_id: "admin-singleton",
		idempotency_key: null,
		ip: "test",
		user_agent: "vitest",
	};
}

type FixtureStatus = "Open" | "Closed" | "Resolving" | "Resolved";

async function seedMarketWithPool(
	slug: string,
	status: FixtureStatus,
): Promise<string> {
	const [market] = await testDb
		.insert(markets)
		.values({
			slug,
			title: "Actor Belt Market",
			description: "PLACEHOLDER criterion — not a real criterion",
			status: status === "Resolved" ? "Closed" : status,
			resolutionDeadline: FIXTURE_DEADLINE,
		})
		.returning({ id: markets.id });
	const marketId = market?.id ?? "";
	await testDb.insert(pools).values({
		marketId,
		yesReserves: SEED,
		noReserves: SEED,
	});
	return marketId;
}

/** Drive an empty-bet market through trigger → settle to a Resolved YES tip. */
async function seedResolvedMarket(slug: string): Promise<string> {
	const marketId = await seedMarketWithPool(slug, "Closed");
	await triggerResolution({
		marketId,
		triggerEventId: uuidv7(),
		metadata: adminMetadata("F-ADMIN-3"),
	});
	await settleMarket({
		marketId,
		winningSide: "YES",
		reason: RESOLVE_REASON,
		settleEventId: uuidv7(),
		metadata: adminMetadata("F-RESOLVE-1"),
	});
	return marketId;
}

async function seedResolvingMarket(slug: string): Promise<string> {
	const marketId = await seedMarketWithPool(slug, "Closed");
	await triggerResolution({
		marketId,
		triggerEventId: uuidv7(),
		metadata: adminMetadata("F-ADMIN-3"),
	});
	return marketId;
}

describe("resolution actor-assert belt (CF-6)", () => {
	afterEach(async () => {
		await testClient.unsafe(
			`TRUNCATE events, payout_events, resolution_events, dharma_ledger, bets, comments, positions, pools, markets, users CASCADE`,
		);
		vi.clearAllMocks();
	});

	// === triggerResolution ===================================================

	it("actor-belt::trigger-rejects-participant-actor", async () => {
		const marketId = await seedMarketWithPool("belt-trigger-actor", "Closed");
		await expect(
			triggerResolution({
				marketId,
				triggerEventId: uuidv7(),
				metadata: participantActorMetadata("F-ADMIN-3"),
			}),
		).rejects.toBeInstanceOf(AdminActorError);
	});

	it("actor-belt::trigger-rejects-nonnull-user", async () => {
		const marketId = await seedMarketWithPool("belt-trigger-user", "Closed");
		await expect(
			triggerResolution({
				marketId,
				triggerEventId: uuidv7(),
				metadata: nonNullUserMetadata("F-ADMIN-3"),
			}),
		).rejects.toBeInstanceOf(AdminActorError);
	});

	it("actor-belt::trigger-admin-metadata-resolves", async () => {
		const marketId = await seedMarketWithPool("belt-trigger-ok", "Closed");
		await expect(
			triggerResolution({
				marketId,
				triggerEventId: uuidv7(),
				metadata: adminMetadata("F-ADMIN-3"),
			}),
		).resolves.toMatchObject({ status: "Resolving" });
	});

	// === settleMarket ========================================================

	it("actor-belt::settle-rejects-participant-actor", async () => {
		const marketId = await seedResolvingMarket("belt-settle-actor");
		await expect(
			settleMarket({
				marketId,
				winningSide: "YES",
				reason: RESOLVE_REASON,
				settleEventId: uuidv7(),
				metadata: participantActorMetadata("F-RESOLVE-1"),
			}),
		).rejects.toBeInstanceOf(AdminActorError);
	});

	it("actor-belt::settle-rejects-nonnull-user", async () => {
		const marketId = await seedResolvingMarket("belt-settle-user");
		await expect(
			settleMarket({
				marketId,
				winningSide: "YES",
				reason: RESOLVE_REASON,
				settleEventId: uuidv7(),
				metadata: nonNullUserMetadata("F-RESOLVE-1"),
			}),
		).rejects.toBeInstanceOf(AdminActorError);
	});

	it("actor-belt::settle-admin-metadata-resolves", async () => {
		const marketId = await seedResolvingMarket("belt-settle-ok");
		await expect(
			settleMarket({
				marketId,
				winningSide: "YES",
				reason: RESOLVE_REASON,
				settleEventId: uuidv7(),
				metadata: adminMetadata("F-RESOLVE-1"),
			}),
		).resolves.toMatchObject({ winningSide: "YES" });
	});

	// === correctResolution ===================================================

	it("actor-belt::correct-rejects-participant-actor", async () => {
		const marketId = await seedResolvedMarket("belt-correct-actor");
		await expect(
			correctResolution({
				marketId,
				correctedSide: "NO",
				reason: CORRECT_REASON,
				correctEventId: uuidv7(),
				metadata: participantActorMetadata("F-RESOLVE-2"),
			}),
		).rejects.toBeInstanceOf(AdminActorError);
	});

	it("actor-belt::correct-rejects-nonnull-user", async () => {
		const marketId = await seedResolvedMarket("belt-correct-user");
		await expect(
			correctResolution({
				marketId,
				correctedSide: "NO",
				reason: CORRECT_REASON,
				correctEventId: uuidv7(),
				metadata: nonNullUserMetadata("F-RESOLVE-2"),
			}),
		).rejects.toBeInstanceOf(AdminActorError);
	});

	it("actor-belt::correct-admin-metadata-resolves", async () => {
		const marketId = await seedResolvedMarket("belt-correct-ok");
		await expect(
			correctResolution({
				marketId,
				correctedSide: "NO",
				reason: CORRECT_REASON,
				correctEventId: uuidv7(),
				metadata: adminMetadata("F-RESOLVE-2"),
			}),
		).resolves.toMatchObject({ betsAffected: 0 });
	});

	// === voidMarket ==========================================================

	it("actor-belt::void-rejects-participant-actor", async () => {
		const marketId = await seedMarketWithPool("belt-void-actor", "Open");
		await expect(
			voidMarket({
				marketId,
				reason: VOID_REASON,
				voidEventId: uuidv7(),
				metadata: participantActorMetadata("F-RESOLVE-3"),
			}),
		).rejects.toBeInstanceOf(AdminActorError);
	});

	it("actor-belt::void-rejects-nonnull-user", async () => {
		const marketId = await seedMarketWithPool("belt-void-user", "Open");
		await expect(
			voidMarket({
				marketId,
				reason: VOID_REASON,
				voidEventId: uuidv7(),
				metadata: nonNullUserMetadata("F-RESOLVE-3"),
			}),
		).rejects.toBeInstanceOf(AdminActorError);
	});

	it("actor-belt::void-admin-metadata-resolves", async () => {
		const marketId = await seedMarketWithPool("belt-void-ok", "Open");
		await expect(
			voidMarket({
				marketId,
				reason: VOID_REASON,
				voidEventId: uuidv7(),
				metadata: adminMetadata("F-RESOLVE-3"),
			}),
		).resolves.toMatchObject({ betsRefunded: 0 });
	});
});
