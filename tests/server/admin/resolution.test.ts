import { eq } from "drizzle-orm";
import { v7 as uuidv7 } from "uuid";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@sentry/nextjs", () => ({
	captureMessage: vi.fn(),
	addBreadcrumb: vi.fn(),
	captureException: vi.fn(),
}));

import { events, markets, pools, resolutionEvents } from "@/db/schema";
import { ResolutionStateError } from "@/server/resolution/errors";
import { settleMarket } from "@/server/resolution/settle";
import { triggerResolution } from "@/server/resolution/trigger";

import { testClient, testDb } from "../../db/_fixtures/db";

// ENGINE.9 §5.6 tests-first (S1, plan §Test plan) — the F-ADMIN-3 trigger
// suite (`resolving-state-then-resolved`). Greenfield value imports from
// `@/server/resolution/{trigger,settle,errors}` RED at collection until
// ENGINE.9 lands. DB-BACKED (local Postgres :54322).
//
// W-3a contract (plan §The four flows):
//   - one tx, expectedStatus ["Closed"], lockPool false;
//   - UPDATE markets → 'Resolving' + ONE `market.resolving` events row,
//     payload = { marketId } ONLY (C-1 — outcome/evidence live on
//     `resolution_events` per R-9.1, never duplicated);
//   - metadata.actor_id 'admin-singleton', metadata.user_id NULL (§3.7);
//   - the trigger writes NO `resolution_events` row (F-ADMIN-3's "Response:
//     Resolution event ID" belongs to the COMPOSED trigger→settle endpoint,
//     ENGINE.10);
//   - off-Closed → ResolutionStateError (the §6.1 graph is the law); the
//     trigger is irreversible (no Resolving→Voided edge — R-9.3).

const SEED_RESERVES = "100.000000000000000000";

type FixtureStatus =
	| "Draft"
	| "Open"
	| "Closed"
	| "Resolving"
	| "Resolved"
	| "Voided"
	| "Frozen";

function adminMetadata(flowId: string) {
	return {
		request_id: "test-admin-resolution",
		flow_id: flowId,
		user_id: null,
		actor_id: "admin-singleton",
		idempotency_key: null,
		ip: "test",
		user_agent: "vitest",
	};
}

async function seedMarketWithPool(
	slug: string,
	status: FixtureStatus,
): Promise<string> {
	const [market] = await testDb
		.insert(markets)
		.values({
			slug,
			title: "Trigger Market",
			status,
			resolutionDeadline: new Date("2026-11-01T00:00:00Z"),
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

describe("ENGINE.9 F-ADMIN-3 — triggerResolution (W-3a)", () => {
	afterEach(async () => {
		await testClient.unsafe(
			`TRUNCATE events, payout_events, resolution_events, dharma_ledger, bets, comments, positions, pools, markets, users CASCADE`,
		);
		vi.clearAllMocks();
	});

	it("admin-resolution::resolving-state-then-resolved", async () => {
		const marketId = await seedMarketWithPool("trigger-happy", "Closed");
		const triggerEventId = uuidv7();

		const result = await triggerResolution({
			marketId,
			triggerEventId,
			metadata: adminMetadata("F-ADMIN-3"),
		});
		expect(result).toEqual({ marketId, status: "Resolving" });

		// Status flipped Closed → Resolving.
		const [marketRow] = await testDb
			.select({ status: markets.status })
			.from(markets)
			.where(eq(markets.id, marketId));
		expect(marketRow?.status).toBe("Resolving");

		// Exactly ONE market.resolving events row; payload is marketId ONLY
		// (C-1); admin actor metadata (§3.7).
		const eventRows = await testDb
			.select({
				eventId: events.eventId,
				eventType: events.eventType,
				aggregateType: events.aggregateType,
				aggregateId: events.aggregateId,
				payload: events.payload,
				metadata: events.metadata,
			})
			.from(events)
			.where(eq(events.eventType, "market.resolving"));
		expect(eventRows.length).toBe(1);
		expect(eventRows[0]?.eventId).toBe(triggerEventId);
		expect(eventRows[0]?.aggregateType).toBe("market");
		expect(eventRows[0]?.aggregateId).toBe(marketId);
		expect(eventRows[0]?.payload).toEqual({ marketId });
		const metadata = eventRows[0]?.metadata as {
			actor_id?: unknown;
			user_id?: unknown;
		};
		expect(metadata.actor_id).toBe("admin-singleton");
		expect(metadata.user_id).toBeNull();

		// The trigger writes NO resolution_events row.
		const resolutionRows = await testDb
			.select({ id: resolutionEvents.id })
			.from(resolutionEvents)
			.where(eq(resolutionEvents.marketId, marketId));
		expect(resolutionRows.length).toBe(0);

		// …then resolved: settle (a SECOND tx, the composed F-ADMIN-3 shape —
		// trigger → settle back-to-back) succeeds from the trigger's Resolving.
		await settleMarket({
			marketId,
			winningSide: "YES",
			reason: "Criterion met; trigger→settle composition.",
			settleEventId: uuidv7(),
			metadata: adminMetadata("F-RESOLVE-1"),
		});
		const [settled] = await testDb
			.select({ status: markets.status })
			.from(markets)
			.where(eq(markets.id, marketId));
		expect(settled?.status).toBe("Resolved");
	});

	for (const status of [
		"Draft",
		"Open",
		"Resolving",
		"Resolved",
		"Voided",
		"Frozen",
	] as const) {
		it(`admin-resolution::trigger-rejected-on-${status.toLowerCase()}`, async () => {
			const marketId = await seedMarketWithPool(
				`trigger-neg-${status.toLowerCase()}`,
				status,
			);

			const caught = await triggerResolution({
				marketId,
				triggerEventId: uuidv7(),
				metadata: adminMetadata("F-ADMIN-3"),
			}).catch((e: unknown) => e);

			expect(caught).toBeInstanceOf(ResolutionStateError);

			// Nothing written: status unchanged, zero events, zero
			// resolution_events.
			const [marketRow] = await testDb
				.select({ status: markets.status })
				.from(markets)
				.where(eq(markets.id, marketId));
			expect(marketRow?.status).toBe(status);
			const eventRows = await testDb
				.select({ eventId: events.eventId })
				.from(events)
				.where(eq(events.aggregateId, marketId));
			expect(eventRows.length).toBe(0);
			const resolutionRows = await testDb
				.select({ id: resolutionEvents.id })
				.from(resolutionEvents)
				.where(eq(resolutionEvents.marketId, marketId));
			expect(resolutionRows.length).toBe(0);
		});
	}

	it("admin-resolution::double-trigger-fails-illegal-edge", async () => {
		// The trigger is irreversible (R-9.3): a second trigger observes
		// Resolving and fails the gate — stranded-Resolving recovery is
		// `settleMarket`, never a re-trigger.
		const marketId = await seedMarketWithPool("trigger-double", "Closed");

		await triggerResolution({
			marketId,
			triggerEventId: uuidv7(),
			metadata: adminMetadata("F-ADMIN-3"),
		});

		const caught = await triggerResolution({
			marketId,
			triggerEventId: uuidv7(),
			metadata: adminMetadata("F-ADMIN-3"),
		}).catch((e: unknown) => e);
		expect(caught).toBeInstanceOf(ResolutionStateError);

		// Still exactly ONE market.resolving event; status still Resolving.
		const eventRows = await testDb
			.select({ eventId: events.eventId })
			.from(events)
			.where(eq(events.eventType, "market.resolving"));
		expect(eventRows.length).toBe(1);
		const [marketRow] = await testDb
			.select({ status: markets.status })
			.from(markets)
			.where(eq(markets.id, marketId));
		expect(marketRow?.status).toBe("Resolving");
	});
});
