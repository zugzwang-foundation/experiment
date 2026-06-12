import { eq } from "drizzle-orm";
import { v7 as uuidv7 } from "uuid";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@sentry/nextjs", () => ({
	captureMessage: vi.fn(),
	addBreadcrumb: vi.fn(),
	captureException: vi.fn(),
}));

import { events, markets } from "@/db/schema";
import { AdminActorError } from "@/server/admin/actor";
import { createMarket } from "@/server/markets/create";
import {
	MarketDeadlineCeilingError,
	MarketDeadlineInPastError,
	MarketSlugTakenError,
} from "@/server/markets/errors";

import { testClient, testDb } from "../../db/_fixtures/db";

// ENGINE.14 §5.6 tests-first (S1, plan §Test plan charter) — the F-ADMIN-1
// createMarket acceptance home (M1–M4). Greenfield VALUE imports from
// `@/server/markets/create` + `@/server/admin/actor` + the lifecycle error
// taxonomy RED at collection until S2 lands. DB-BACKED (:54322).
//
// Pins (plan §Flows + D-14.b/f + R-14.1/R-14.5/R-14.6 + L-E9.3): `eventId?`
// is OPTIONAL — supplied → used VERBATIM (M1 boundary pass); absent → minted
// ONCE at service entry, closed over across SERIALIZABLE retries (M2).
// Ceiling rejects deadline > FREEZE_INSTANT_UTC, `==` PASSES (SPEC.1 §12.1
// "≤"); deadline ≤ now rejects (D-14.b). Payload EXACTLY
// { marketId, resolutionDeadline } — NO seedAmount key (the R-14.1 move).
// Returned event ids pinned SEMANTICALLY (=== the inserted events row's
// event_id, ≠ marketId) — never toBeDefined().

const FREEZE_INSTANT_UTC = new Date("2026-11-05T23:59:00.000Z");
const NOW = new Date("2026-09-15T00:00:00.000Z");
const DEADLINE = new Date("2026-10-01T00:00:00.000Z");
const TITLE = "PLACEHOLDER — not a real market";
const DESCRIPTION = "PLACEHOLDER criterion — not a real criterion";

function adminMetadata(flowId: string) {
	return {
		request_id: "test-engine14-create",
		flow_id: flowId,
		user_id: null,
		actor_id: "admin-singleton",
		idempotency_key: null,
		ip: "test",
		user_agent: "vitest",
	};
}

function createArgs(slug: string, resolutionDeadline: Date) {
	return {
		slug,
		title: TITLE,
		description: DESCRIPTION,
		resolutionDeadline,
		now: NOW,
		metadata: adminMetadata("F-ADMIN-1"),
	};
}

async function marketRowsBySlug(slug: string) {
	return testDb
		.select({ id: markets.id })
		.from(markets)
		.where(eq(markets.slug, slug));
}

async function allEventRows() {
	return testDb.select({ eventId: events.eventId }).from(events);
}

async function createdEventRows() {
	return testDb
		.select({
			eventId: events.eventId,
			payload: events.payload,
			metadata: events.metadata,
		})
		.from(events)
		.where(eq(events.eventType, "market.created"));
}

describe("ENGINE.14 F-ADMIN-1 — createMarket (W-4 create branch)", () => {
	afterEach(async () => {
		await testClient.unsafe(`TRUNCATE events, pools, markets CASCADE`);
		vi.clearAllMocks();
	});

	it("admin-markets::M1-ceiling-reject", async () => {
		// One millisecond past the freeze instant → MarketDeadlineCeilingError;
		// NOTHING written (asserted, not assumed).
		const caught = await createMarket(
			createArgs(
				"placeholder-m1-ceiling",
				new Date("2026-11-05T23:59:00.001Z"),
			),
		).catch((e: unknown) => e);
		expect(caught).toBeInstanceOf(MarketDeadlineCeilingError);

		expect((await marketRowsBySlug("placeholder-m1-ceiling")).length).toBe(0);
		expect((await allEventRows()).length).toBe(0);
	});

	it("admin-markets::M1-boundary-pass-at-freeze", async () => {
		// deadline == FREEZE passes ("≤" per SPEC.1 §12.1). The supplied-eventId
		// round-trip rides this boundary call: the explicit uuidv7() is used
		// VERBATIM (createdEventId === supplied === the events row's event_id).
		const suppliedEventId = uuidv7();
		const result = await createMarket({
			...createArgs("placeholder-m1-boundary", FREEZE_INSTANT_UTC),
			eventId: suppliedEventId,
		});

		expect(result.status).toBe("Draft");
		expect(result.createdEventId).toBe(suppliedEventId);
		expect(result.createdEventId).not.toBe(result.marketId);

		const eventRows = await createdEventRows();
		expect(eventRows.length).toBe(1);
		expect(eventRows[0]?.eventId).toBe(suppliedEventId);
	});

	it("admin-markets::M1-past-deadline-reject", async () => {
		// Both halves of D-14.b: deadline === now AND deadline < now reject.
		const caughtEq = await createMarket(
			createArgs("placeholder-m1-past-eq", NOW),
		).catch((e: unknown) => e);
		expect(caughtEq).toBeInstanceOf(MarketDeadlineInPastError);

		const caughtLt = await createMarket(
			createArgs(
				"placeholder-m1-past-lt",
				new Date("2026-09-14T00:00:00.000Z"),
			),
		).catch((e: unknown) => e);
		expect(caughtLt).toBeInstanceOf(MarketDeadlineInPastError);

		expect((await marketRowsBySlug("placeholder-m1-past-eq")).length).toBe(0);
		expect((await marketRowsBySlug("placeholder-m1-past-lt")).length).toBe(0);
		expect((await allEventRows()).length).toBe(0);
	});

	it("admin-markets::M2-create-happy-draft-and-event", async () => {
		// NO eventId supplied — the mint-if-absent path: the service mints ONCE
		// at entry (closed over across W-4 retries) and returns it.
		const result = await createMarket(
			createArgs("placeholder-m2-happy", DEADLINE),
		);

		// D-14.f response shape — key-set EXACT.
		expect(result).toEqual({
			marketId: result.marketId,
			slug: "placeholder-m2-happy",
			status: "Draft",
			createdEventId: result.createdEventId,
		});

		// Row: Draft, created_by admin-singleton, content round-trips.
		const [row] = await testDb
			.select({
				id: markets.id,
				slug: markets.slug,
				title: markets.title,
				description: markets.description,
				status: markets.status,
				createdBy: markets.createdBy,
			})
			.from(markets)
			.where(eq(markets.id, result.marketId));
		expect(row).toEqual({
			id: result.marketId,
			slug: "placeholder-m2-happy",
			title: TITLE,
			description: DESCRIPTION,
			status: "Draft",
			createdBy: "admin-singleton",
		});

		// Exactly ONE market.created events row; payload EXACT — NO seedAmount
		// key (R-14.1: the seed instant is Draft → Open, not creation).
		const eventRows = await createdEventRows();
		expect(eventRows.length).toBe(1);
		expect(eventRows[0]?.payload).toEqual({
			marketId: result.marketId,
			resolutionDeadline: DEADLINE.toISOString(),
		});
		const metadata = eventRows[0]?.metadata as {
			actor_id?: unknown;
			user_id?: unknown;
		};
		expect(metadata.actor_id).toBe("admin-singleton");
		expect(metadata.user_id).toBeNull();

		// Semantic id pins (L-E9.3) — never toBeDefined().
		expect(result.createdEventId).toBe(eventRows[0]?.eventId);
		expect(result.createdEventId).not.toBe(result.marketId);
	});

	it("admin-markets::M3-slug-taken-typed", async () => {
		await createMarket(createArgs("placeholder-m3-taken", DEADLINE));

		const caught = await createMarket(
			createArgs("placeholder-m3-taken", DEADLINE),
		).catch((e: unknown) => e);
		expect(caught).toBeInstanceOf(MarketSlugTakenError);

		// Exactly ONE markets row persists; the second create wrote NOTHING —
		// exactly ONE market.created event.
		expect((await marketRowsBySlug("placeholder-m3-taken")).length).toBe(1);
		expect((await createdEventRows()).length).toBe(1);
	});

	it("admin-markets::M4-actor-rejects-nonnull-user-id", async () => {
		// R-14.5: metadata.user_id must be null for lifecycle flows.
		const caught = await createMarket({
			...createArgs("placeholder-m4-user", DEADLINE),
			metadata: { ...adminMetadata("F-ADMIN-1"), user_id: uuidv7() },
		}).catch((e: unknown) => e);
		expect(caught).toBeInstanceOf(AdminActorError);

		expect((await marketRowsBySlug("placeholder-m4-user")).length).toBe(0);
		expect((await allEventRows()).length).toBe(0);
	});

	it("admin-markets::M4-actor-rejects-wrong-actor-id", async () => {
		// R-14.5: metadata.actor_id must be EXACTLY 'admin-singleton'.
		const caught = await createMarket({
			...createArgs("placeholder-m4-actor", DEADLINE),
			metadata: { ...adminMetadata("F-ADMIN-1"), actor_id: "not-the-admin" },
		}).catch((e: unknown) => e);
		expect(caught).toBeInstanceOf(AdminActorError);

		expect((await marketRowsBySlug("placeholder-m4-actor")).length).toBe(0);
		expect((await allEventRows()).length).toBe(0);
	});
});
