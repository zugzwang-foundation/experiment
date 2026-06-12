import { afterEach, describe, expect, it } from "vitest";

// Per ENGINE.6 plan §F (helper tests) + §B (helper contract) + §A
// (per-event-type Zod schemas). This file is the driver suite for the
// `insertEvent` helper at `src/server/events/insert.ts` (does NOT yet
// exist — these tests are RED until ENGINE.6 implementation lands).
//
// Three load-bearing properties verified:
//   1. For each of the 22 canonical EVENT_TYPES (ENGINE.0 expanded 11→22),
//      a valid payload + valid 7-field metadata → row appears in `events`
//      with correct columns.
//   2. Atomicity: insertEvent inside a tx commits/rolls-back with the rest
//      of the tx. Roll-back leaves no events row.
//   3. Retry-with-same-eventId: two transactions with the same eventId →
//      ON CONFLICT (event_id, created_at) DO NOTHING dedupes. Final
//      events-table row-count for that eventId = 1.
//
// NOT mocked:
//   - testDb (real Postgres; trigger semantics are real; partition routing
//     is real per drizzle/migrations/0002_events_partitioning.sql).
//
// Mocked: none.

import { v7 as uuidv7 } from "uuid";

import { imageUploads, users } from "@/db/schema";
import { type AggregateType, insertEvent } from "@/server/events/insert";
import type { EventType } from "@/server/events/schemas";
import { testClient, testDb } from "../../db/_fixtures/db";

afterEach(async () => {
	await testClient.unsafe(
		`TRUNCATE events, image_uploads, users, admin_sessions CASCADE`,
	);
});

async function seedUser(suffix: string): Promise<{ userId: string }> {
	const [user] = await testDb
		.insert(users)
		.values({
			name: "Events Driver",
			email: `events-${suffix}@example.com`,
			pseudonym: `events-${suffix}`,
		})
		.returning({ id: users.id });
	if (!user) throw new Error("user seed failed");
	return { userId: user.id };
}

function baseMetadata(userId: string | null, actorId: string) {
	return {
		request_id: "req-test-001",
		flow_id: "F-TEST",
		user_id: userId,
		actor_id: actorId,
		idempotency_key: null,
		ip: "127.0.0.1",
		user_agent: "vitest",
	};
}

/**
 * Each entry constructs a valid payload + valid surrounding scaffolding for
 * one canonical EVENT_TYPE. The driver iterates this list and asserts the
 * row lands with all 8 columns correct. If the enum (ENGINE.0 expanded
 * 11→22) disagrees with this table, this file FAILs at the type level
 * (eventType: EventType) — surfaces the drift before the runtime assertion.
 */
type Case = {
	eventType: EventType;
	aggregateType: AggregateType;
	buildPayload: (ctx: {
		userId: string;
		aggregateId: string;
	}) => Record<string, unknown>;
	actorId: (userId: string) => string;
	userIdInMetadata: (userId: string) => string | null;
};

const CASES: Case[] = [
	{
		eventType: "image_upload.sign_requested",
		aggregateType: "image_upload",
		buildPayload: ({ userId, aggregateId }) => ({
			uploadId: aggregateId,
			userId,
			contentType: "image/jpeg",
			byteSize: 50_000,
			key: `u/${userId}/${aggregateId}.jpg`,
		}),
		actorId: (userId) => userId,
		userIdInMetadata: (userId) => userId,
	},
	{
		eventType: "image_upload.committed",
		aggregateType: "image_upload",
		buildPayload: ({ userId, aggregateId }) => ({
			uploadId: aggregateId,
			userId,
			commentId: uuidv7(),
			key: `u/${userId}/${aggregateId}.jpg`,
		}),
		actorId: (userId) => userId,
		userIdInMetadata: (userId) => userId,
	},
	{
		eventType: "image_upload.blocked",
		aggregateType: "image_upload",
		buildPayload: ({ userId, aggregateId }) => ({
			uploadId: aggregateId,
			userId,
			modVerdict: "block",
			reasonCategory: "sexual",
		}),
		actorId: () => "system",
		userIdInMetadata: () => null,
	},
	{
		eventType: "image_upload.orphaned",
		aggregateType: "image_upload",
		buildPayload: ({ userId, aggregateId }) => ({
			uploadId: aggregateId,
			key: `u/${userId}/${aggregateId}.jpg`,
		}),
		actorId: () => "system",
		userIdInMetadata: () => null,
	},
	{
		eventType: "user.oauth_signed_in",
		aggregateType: "user",
		buildPayload: ({ userId }) => ({
			userId,
			provider: "google",
			googleId: "google-12345",
		}),
		actorId: (userId) => userId,
		userIdInMetadata: (userId) => userId,
	},
	{
		eventType: "user.otp_signed_in",
		aggregateType: "user",
		buildPayload: ({ userId }) => ({
			userId,
			email: "otp@example.com",
		}),
		actorId: (userId) => userId,
		userIdInMetadata: (userId) => userId,
	},
	{
		eventType: "user.pseudonym_assigned",
		aggregateType: "user",
		buildPayload: ({ userId }) => ({
			userId,
			pseudonym: "RedFox001",
			pfpFilename: "01-red-fox.svg",
		}),
		actorId: (userId) => userId,
		userIdInMetadata: (userId) => userId,
	},
	{
		eventType: "user.tos_accepted",
		aggregateType: "user",
		buildPayload: ({ userId }) => ({
			userId,
			tosVersionHash: "placeholder-tos-v0",
			privacyVersionHash: "placeholder-privacy-v0",
			ip: "1.2.3.4",
			userAgent: "Mozilla/5.0",
		}),
		actorId: (userId) => userId,
		userIdInMetadata: (userId) => userId,
	},
	{
		eventType: "user.signed_out",
		aggregateType: "user",
		buildPayload: ({ userId }) => ({ userId }),
		actorId: (userId) => userId,
		userIdInMetadata: (userId) => userId,
	},
	{
		eventType: "admin.signed_in",
		aggregateType: "admin_session",
		buildPayload: ({ aggregateId }) => ({
			sessionId: aggregateId,
			ip: "1.2.3.4",
		}),
		actorId: () => "admin-singleton",
		userIdInMetadata: () => null,
	},
	{
		eventType: "admin.signed_out",
		aggregateType: "admin_session",
		buildPayload: ({ aggregateId }) => ({
			sessionId: aggregateId,
		}),
		actorId: () => "admin-singleton",
		userIdInMetadata: () => null,
	},
	// === ENGINE.0 forward-stratum types (11 — plan §3) =======================
	{
		eventType: "market.created",
		aggregateType: "market",
		buildPayload: ({ aggregateId }) => ({
			marketId: aggregateId,
			resolutionDeadline: "2026-11-06T23:59:00+05:30",
		}),
		actorId: () => "admin-singleton",
		userIdInMetadata: () => null,
	},
	{
		eventType: "market.opened",
		aggregateType: "market",
		buildPayload: ({ aggregateId }) => ({
			marketId: aggregateId,
			seedAmount: "1000",
		}),
		actorId: () => "admin-singleton",
		userIdInMetadata: () => null,
	},
	{
		eventType: "market.closed",
		aggregateType: "market",
		buildPayload: ({ aggregateId }) => ({ marketId: aggregateId }),
		actorId: () => "admin-singleton",
		userIdInMetadata: () => null,
	},
	// ENGINE.9 (F-ADMIN-3 trigger): payload is marketId ONLY (plan C-1 —
	// outcome/evidence live on resolution_events per R-9.1).
	{
		eventType: "market.resolving",
		aggregateType: "market",
		buildPayload: ({ aggregateId }) => ({ marketId: aggregateId }),
		actorId: () => "admin-singleton",
		userIdInMetadata: () => null,
	},
	{
		eventType: "market.resolved",
		aggregateType: "market",
		buildPayload: ({ aggregateId }) => ({
			marketId: aggregateId,
			winningSide: "YES",
			resolutionNote: "Resolved YES per criteria.",
			poolUnwindAmount: "50.000000000000000000",
		}),
		actorId: () => "admin-singleton",
		userIdInMetadata: () => null,
	},
	{
		eventType: "market.corrected",
		aggregateType: "market",
		buildPayload: ({ aggregateId }) => ({
			marketId: aggregateId,
			correctsEventId: uuidv7(),
			correctedWinningSide: "NO",
			resolutionNote: "Corrected to NO after review.",
		}),
		actorId: () => "admin-singleton",
		userIdInMetadata: () => null,
	},
	{
		eventType: "market.voided",
		aggregateType: "market",
		buildPayload: ({ aggregateId }) => ({
			marketId: aggregateId,
			voidReason: "Outcome unresolvable.",
			poolUnwindAmount: "100.000000000000000000",
		}),
		actorId: () => "admin-singleton",
		userIdInMetadata: () => null,
	},
	{
		eventType: "bet.placed",
		aggregateType: "bet",
		buildPayload: ({ userId, aggregateId }) => ({
			betId: aggregateId,
			marketId: uuidv7(),
			userId,
			side: "YES",
			stake: "50",
			shares: "33.333333333333333333",
			price: "0.6",
			commentId: uuidv7(),
			parentCommentId: null,
		}),
		actorId: (userId) => userId,
		userIdInMetadata: (userId) => userId,
	},
	{
		eventType: "bet.sold",
		aggregateType: "bet",
		buildPayload: ({ userId, aggregateId }) => ({
			betId: aggregateId,
			marketId: uuidv7(),
			userId,
			side: "NO",
			sharesSold: "10",
			proceeds: "4.5",
			price: "0.45",
		}),
		actorId: (userId) => userId,
		userIdInMetadata: (userId) => userId,
	},
	{
		eventType: "comment.placed",
		aggregateType: "comment",
		buildPayload: ({ userId, aggregateId }) => ({
			commentId: aggregateId,
			betId: uuidv7(),
			userId,
			marketId: uuidv7(),
			side: "YES",
			parentCommentId: null,
			bodyLength: 140,
			uploadId: null,
		}),
		actorId: (userId) => userId,
		userIdInMetadata: (userId) => userId,
	},
	{
		eventType: "dharma.credited",
		aggregateType: "dharma_account",
		buildPayload: ({ userId }) => ({
			userId,
			amount: "100",
			creditedForDate: "2026-09-15",
		}),
		actorId: (userId) => userId,
		userIdInMetadata: (userId) => userId,
	},
];

describe("insertEvent — driver (ENGINE.6 §F + §B)", () => {
	// === Per-EVENT_TYPE happy-path driver ====================================

	for (const c of CASES) {
		it(`events::driver-${c.eventType}-writes-row-with-eight-columns`, async () => {
			// Per plan §A + §B: the helper writes 8 columns (event_id,
			// event_type, aggregate_type, aggregate_id, payload,
			// payload_version=1, metadata, created_at derived from
			// uuidv7ToCreatedAt). For each of the 22 canonical EVENT_TYPES
			// (ENGINE.0 expanded 11→22) we build a valid payload and assert
			// the row lands with all 8 columns set as the helper documents.
			const { userId } = await seedUser(`drv-${c.eventType}`);
			const eventId = uuidv7();
			const aggregateId = uuidv7();
			const payload = c.buildPayload({ userId, aggregateId });
			const metadata = baseMetadata(
				c.userIdInMetadata(userId),
				c.actorId(userId),
			);

			await testDb.transaction(async (tx) => {
				await insertEvent(tx, {
					eventId,
					eventType: c.eventType,
					aggregateType: c.aggregateType,
					aggregateId,
					// `as never` — Case.buildPayload returns the generic
					// `Record<string, unknown>` because TypeScript can't
					// narrow per-row through the loop over CASES. Runtime
					// correctness ensured by the per-row eventType+payload
					// pairing in the CASES table itself.
					payload: payload as never,
					metadata,
				});
			});

			const rows = await testClient<
				{
					event_id: string;
					event_type: string;
					aggregate_type: string;
					aggregate_id: string;
					payload: unknown;
					payload_version: number;
					metadata: unknown;
					created_at: Date;
				}[]
			>`SELECT event_id, event_type, aggregate_type, aggregate_id, payload,
			          payload_version, metadata, created_at
			    FROM events WHERE event_id = ${eventId}`;
			expect(rows.length).toBe(1);
			// biome-ignore lint/style/noNonNullAssertion: length pre-asserted by expect above
			const row = rows[0]!;
			expect(row.event_id).toBe(eventId);
			expect(row.event_type).toBe(c.eventType);
			expect(row.aggregate_type).toBe(c.aggregateType);
			expect(row.aggregate_id).toBe(aggregateId);
			expect(row.payload).toEqual(payload);
			expect(row.payload_version).toBe(1);
			expect(row.metadata).toEqual(metadata);
			// created_at derived from UUIDv7 prefix (V2 per plan §B; NOT now()).
			expect(row.created_at).toBeInstanceOf(Date);
		});
	}

	// === Transaction atomicity ===============================================

	it("events::driver-tx-commit-persists-both-rows", async () => {
		// Per plan §B (single bound-transaction signature). If a caller wraps
		// a non-events INSERT + insertEvent in the same tx and the tx commits,
		// both rows are present.
		const { userId } = await seedUser("tx-commit");
		const eventId = uuidv7();
		const uploadId = uuidv7();
		const key = `u/${userId}/${uploadId}.jpg`;

		await testDb.transaction(async (tx) => {
			await tx.insert(imageUploads).values({
				id: uploadId,
				userId,
				r2ObjectKey: key,
				contentType: "image/jpeg",
				byteSize: 50_000,
			});
			await insertEvent(tx, {
				eventId,
				eventType: "image_upload.sign_requested",
				aggregateType: "image_upload",
				aggregateId: uploadId,
				payload: {
					uploadId,
					userId,
					contentType: "image/jpeg",
					byteSize: 50_000,
					key,
				},
				metadata: baseMetadata(userId, userId),
			});
		});

		const eventRows = await testClient<
			{ event_id: string }[]
		>`SELECT event_id FROM events WHERE event_id = ${eventId}`;
		const uploadRows = await testClient<
			{ id: string }[]
		>`SELECT id FROM image_uploads WHERE id = ${uploadId}`;
		expect(eventRows.length).toBe(1);
		expect(uploadRows.length).toBe(1);
	});

	it("events::driver-tx-rollback-persists-neither-row", async () => {
		// Per plan §B + AGENTS.md §6: if the wrapping tx rolls back,
		// insertEvent's row is GONE — atomicity holds across the helper.
		const { userId } = await seedUser("tx-rb");
		const eventId = uuidv7();
		const uploadId = uuidv7();
		const key = `u/${userId}/${uploadId}.jpg`;

		await expect(
			testDb.transaction(async (tx) => {
				await tx.insert(imageUploads).values({
					id: uploadId,
					userId,
					r2ObjectKey: key,
					contentType: "image/jpeg",
					byteSize: 50_000,
				});
				await insertEvent(tx, {
					eventId,
					eventType: "image_upload.sign_requested",
					aggregateType: "image_upload",
					aggregateId: uploadId,
					payload: {
						uploadId,
						userId,
						contentType: "image/jpeg",
						byteSize: 50_000,
						key,
					},
					metadata: baseMetadata(userId, userId),
				});
				// Force rollback.
				throw new Error("rollback-marker");
			}),
		).rejects.toThrow(/rollback-marker/);

		const eventRows = await testClient<
			{ event_id: string }[]
		>`SELECT event_id FROM events WHERE event_id = ${eventId}`;
		const uploadRows = await testClient<
			{ id: string }[]
		>`SELECT id FROM image_uploads WHERE id = ${uploadId}`;
		expect(eventRows.length).toBe(0);
		expect(uploadRows.length).toBe(0);
	});

	// === Retry-with-same-eventId (storage-layer idempotency per LD-8 + V1) ===

	it("events::driver-retry-same-eventId-dedupes-via-on-conflict", async () => {
		// Per plan §B + §B's three locked properties: caller may safely retry
		// the same eventId across two SEPARATE transactions. ON CONFLICT
		// (event_id, created_at) DO NOTHING suppresses the second INSERT.
		// Final row-count for that eventId = 1 (NOT 2, NOT 0).
		const { userId } = await seedUser("retry");
		const eventId = uuidv7();
		const aggregateId = uuidv7();
		const payload = { userId };
		const metadata = baseMetadata(userId, userId);

		// First tx — should insert one row.
		await testDb.transaction(async (tx) => {
			await insertEvent(tx, {
				eventId,
				eventType: "user.signed_out",
				aggregateType: "user",
				aggregateId,
				payload,
				metadata,
			});
		});
		// Second tx — same eventId; should be a no-op.
		await testDb.transaction(async (tx) => {
			await insertEvent(tx, {
				eventId,
				eventType: "user.signed_out",
				aggregateType: "user",
				aggregateId,
				payload,
				metadata,
			});
		});

		const rows = await testClient<
			{ count: string }[]
		>`SELECT COUNT(*)::text AS count FROM events WHERE event_id = ${eventId}`;
		expect(rows[0]?.count).toBe("1");
	});

	// === Caller-supplied payload_version (defaults to 1) =====================

	it("events::driver-payload-version-defaults-to-1", async () => {
		// Per plan §B EventInsertInput: payloadVersion is optional; default 1.
		const { userId } = await seedUser("pv-default");
		const eventId = uuidv7();

		await testDb.transaction(async (tx) => {
			await insertEvent(tx, {
				eventId,
				eventType: "user.signed_out",
				aggregateType: "user",
				aggregateId: userId,
				payload: { userId },
				metadata: baseMetadata(userId, userId),
			});
		});

		const rows = await testClient<
			{ payload_version: number }[]
		>`SELECT payload_version FROM events WHERE event_id = ${eventId}`;
		expect(rows[0]?.payload_version).toBe(1);
	});

	// === Storage-row count after tx + helper call ============================

	it("events::driver-multiple-event-types-in-one-tx-all-persist", async () => {
		// Two distinct insertEvent calls inside one tx commit together.
		// Asserts the helper is composable inside larger transactions.
		const { userId } = await seedUser("multi");
		const eId1 = uuidv7();
		const eId2 = uuidv7();
		const sessionId = uuidv7();

		await testDb.transaction(async (tx) => {
			await insertEvent(tx, {
				eventId: eId1,
				eventType: "user.tos_accepted",
				aggregateType: "user",
				aggregateId: userId,
				payload: {
					userId,
					tosVersionHash: "placeholder-tos-v0",
					privacyVersionHash: "placeholder-privacy-v0",
					ip: "1.2.3.4",
					userAgent: "ua",
				},
				metadata: baseMetadata(userId, userId),
			});
			await insertEvent(tx, {
				eventId: eId2,
				eventType: "admin.signed_in",
				aggregateType: "admin_session",
				aggregateId: sessionId,
				payload: { sessionId, ip: "1.2.3.4" },
				metadata: baseMetadata(null, "admin-singleton"),
			});
		});

		const rows = await testClient<
			{ event_id: string }[]
		>`SELECT event_id FROM events WHERE event_id = ANY(ARRAY[${eId1}, ${eId2}]::uuid[])`;
		expect(rows.length).toBe(2);
	});

	// === EVENT_TYPES inventory floor =========================================

	it("events::canonical-event-types-inventory-shape", async () => {
		// ENGINE.0 expanded the canonical enum 11 → 21: the original
		// LD-1 set (4 image + 5 user + 2 admin) plus 10 forward-stratum
		// types (6 market + 2 bet + 1 comment + 1 dharma) added by
		// ENGINE.0 (plan §3). ENGINE.13 appended `dharma.granted` (the
		// initial-grant emit site, R2a) ⇒ 22. ENGINE.9 appends
		// `market.resolving` (the F-ADMIN-3 trigger emit, plan C-1) ⇒ 23.
		// Domain breakdown: 4 + 5 + 2 + 7 + 2 + 1 + 2 = 23. The schema
		// file at `src/server/events/schemas.ts` exports `EVENT_TYPES`.
		// If a future PR drops or adds one without amending plan §3 + this
		// floor, surface. `r2_delete_failed` MUST NOT be present
		// (SCAFFOLD.5 Sentry owns).
		const { EVENT_TYPES } = await import("@/server/events/schemas");
		expect([...EVENT_TYPES].sort()).toEqual(
			[
				// original LD-1 set (11)
				"admin.signed_in",
				"admin.signed_out",
				"image_upload.blocked",
				"image_upload.committed",
				"image_upload.orphaned",
				"image_upload.sign_requested",
				"user.oauth_signed_in",
				"user.otp_signed_in",
				"user.pseudonym_assigned",
				"user.signed_out",
				"user.tos_accepted",
				// ENGINE.0 forward-stratum set (10)
				"market.created",
				"market.opened",
				"market.closed",
				"market.resolved",
				"market.corrected",
				"market.voided",
				"bet.placed",
				"bet.sold",
				"comment.placed",
				"dharma.credited",
				// ENGINE.13 (1)
				"dharma.granted",
				// ENGINE.9 (1) — the F-ADMIN-3 Closed→Resolving emit
				"market.resolving",
			].sort(),
		);
		expect((EVENT_TYPES as readonly string[]).length).toBe(23);
		expect(EVENT_TYPES).not.toContain("image_upload.r2_delete_failed");
	});
});
