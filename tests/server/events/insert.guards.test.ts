import { afterEach, describe, expect, it } from "vitest";

// Per ENGINE.6 plan §F (helper tests — guards) + §B (Zod payload +
// metadata validation; UUIDv7 13th-hex-char check) + §C (two new
// DomainError subclasses).
//
// Helper at `src/server/events/insert.ts` (does NOT yet exist) MUST:
//   1. Throw `InvalidEventPayloadError` synchronously on payload Zod fail.
//      No DB I/O before validation — row-count snapshot unchanged.
//   2. Throw `InvalidEventPayloadError` synchronously on metadata Zod fail
//      (metadata is Zod-validated per plan §B).
//   3. Throw `InvalidEventIdError` synchronously if `eventId[14] !== '7'`
//      (UUIDv7 version-byte check; plan §B `uuidv7ToCreatedAt`).
//
// `InvalidEventPayloadError` + `InvalidEventIdError` are new DomainError
// subclasses added at plan §C to `src/lib/errors.ts`. `toEnvelope()` for
// both returns `{ error: 'error_internal' }` (programming-error surface,
// not user-facing).

import { v4 as uuidv4, v7 as uuidv7 } from "uuid";

import { events, users } from "@/db/schema";
import { InvalidEventIdError, InvalidEventPayloadError } from "@/lib/errors";
import { insertEvent } from "@/server/events/insert";
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
			name: "Events Guards",
			email: `guards-${suffix}@example.com`,
			pseudonym: `guards-${suffix}`,
		})
		.returning({ id: users.id });
	if (!user) throw new Error("user seed failed");
	return { userId: user.id };
}

function validMetadata(userId: string | null, actorId: string) {
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

async function eventsCount(): Promise<number> {
	const rows = await testClient<
		{ count: string }[]
	>`SELECT COUNT(*)::text AS count FROM events`;
	return Number.parseInt(rows[0]?.count ?? "0", 10);
}

/**
 * Invalid-payload table — one ROW per EVENT_TYPE. Each "invalid payload"
 * omits a required field that the plan §A schema declares. The helper MUST
 * reject these synchronously with InvalidEventPayloadError; the events
 * row-count snapshot MUST be unchanged after the throw.
 *
 * If ENGINE.6 ships a schema that accepts these payloads, this file FAILs
 * — surfaces the schema-laxness drift before the runtime assertion.
 */
type BadCase = {
	eventType: EventType;
	aggregateType: string;
	buildBadPayload: () => Record<string, unknown>;
};

const BAD_CASES: BadCase[] = [
	{
		eventType: "image_upload.sign_requested",
		aggregateType: "image_upload",
		// Missing key (plan §A: { uploadId, userId, contentType, byteSize, key }).
		buildBadPayload: () => ({
			uploadId: uuidv7(),
			userId: uuidv7(),
			contentType: "image/jpeg",
			byteSize: 50_000,
		}),
	},
	{
		eventType: "image_upload.committed",
		aggregateType: "image_upload",
		// Missing commentId.
		buildBadPayload: () => ({
			uploadId: uuidv7(),
			userId: uuidv7(),
			key: "u/x/y.jpg",
		}),
	},
	{
		eventType: "image_upload.blocked",
		aggregateType: "image_upload",
		// Missing reasonCategory.
		buildBadPayload: () => ({
			uploadId: uuidv7(),
			userId: uuidv7(),
			modVerdict: "block",
		}),
	},
	{
		eventType: "image_upload.orphaned",
		aggregateType: "image_upload",
		// Missing key.
		buildBadPayload: () => ({ uploadId: uuidv7() }),
	},
	{
		eventType: "user.oauth_signed_in",
		aggregateType: "user",
		// Missing googleId.
		buildBadPayload: () => ({ userId: uuidv7(), provider: "google" }),
	},
	{
		eventType: "user.otp_signed_in",
		aggregateType: "user",
		// Missing email.
		buildBadPayload: () => ({ userId: uuidv7() }),
	},
	{
		eventType: "user.pseudonym_assigned",
		aggregateType: "user",
		// Missing pseudonym.
		buildBadPayload: () => ({ userId: uuidv7(), pfpFilename: "01.svg" }),
	},
	{
		eventType: "user.tos_accepted",
		aggregateType: "user",
		// Missing privacyVersionHash (plan §A: { userId, tosVersionHash, privacyVersionHash, ip, userAgent }).
		buildBadPayload: () => ({
			userId: uuidv7(),
			tosVersionHash: "h-tos",
			ip: "1.2.3.4",
			userAgent: "ua",
		}),
	},
	{
		eventType: "user.signed_out",
		aggregateType: "user",
		// Missing userId.
		buildBadPayload: () => ({}),
	},
	{
		eventType: "admin.signed_in",
		aggregateType: "admin_session",
		// Missing ip.
		buildBadPayload: () => ({ sessionId: uuidv7() }),
	},
	{
		eventType: "admin.signed_out",
		aggregateType: "admin_session",
		// Missing sessionId.
		buildBadPayload: () => ({}),
	},
];

describe("insertEvent — guards (ENGINE.6 §F + §B + §C)", () => {
	// === Per-EVENT_TYPE payload Zod rejection ================================

	for (const c of BAD_CASES) {
		it(`events::guard-${c.eventType}-rejects-missing-required-field`, async () => {
			// Plan §B: helper Zod-validates payload BEFORE any DB I/O. Throws
			// InvalidEventPayloadError synchronously. Row-count snapshot
			// before + after the rejected call MUST be unchanged.
			const { userId } = await seedUser(`bad-${c.eventType}`);
			const eventId = uuidv7();
			const before = await eventsCount();

			await expect(
				testDb.transaction(async (tx) => {
					await insertEvent(tx, {
						eventId,
						eventType: c.eventType,
						aggregateType: c.aggregateType,
						aggregateId: uuidv7(),
						// Bad payload — missing required field per plan §A.
						payload: c.buildBadPayload() as never,
						metadata: validMetadata(userId, userId),
					});
				}),
			).rejects.toBeInstanceOf(InvalidEventPayloadError);

			// No row written — validation fires BEFORE DB I/O.
			const after = await eventsCount();
			expect(after).toBe(before);
		});
	}

	// === Non-UUIDv7 event_id rejection =======================================

	it("events::guard-rejects-non-uuidv7-eventId-throws-InvalidEventIdError", async () => {
		// Plan §B: uuidv7ToCreatedAt throws InvalidEventIdError if
		// `eventId[14] !== '7'`. UUIDv4's 13th hex char (== eventId[14]
		// after dashes) is '4', not '7'. Helper rejects synchronously;
		// no DB I/O attempted.
		const { userId } = await seedUser("uuidv4");
		const v4Id = uuidv4();
		expect(v4Id[14]).toBe("4"); // sanity — confirms test fixture is right
		const before = await eventsCount();

		await expect(
			testDb.transaction(async (tx) => {
				await insertEvent(tx, {
					eventId: v4Id,
					eventType: "user.signed_out",
					aggregateType: "user",
					aggregateId: userId,
					payload: { userId },
					metadata: validMetadata(userId, userId),
				});
			}),
		).rejects.toBeInstanceOf(InvalidEventIdError);

		const after = await eventsCount();
		expect(after).toBe(before);
	});

	it("events::guard-rejects-malformed-eventId-string", async () => {
		// Sanity floor: garbage non-UUID string fails the same guard
		// (`eventId[14] !== '7'` is the gate; the index-14 char of any
		// 36-char string can be checked). Asserts the throw path is
		// stable for all non-v7 inputs.
		const { userId } = await seedUser("garbage");
		const garbage = "not-a-valid-uuid-string-anywhere-here";
		const before = await eventsCount();

		await expect(
			testDb.transaction(async (tx) => {
				await insertEvent(tx, {
					eventId: garbage,
					eventType: "user.signed_out",
					aggregateType: "user",
					aggregateId: userId,
					payload: { userId },
					metadata: validMetadata(userId, userId),
				});
			}),
		).rejects.toBeInstanceOf(InvalidEventIdError);

		const after = await eventsCount();
		expect(after).toBe(before);
	});

	// === Metadata Zod rejection — each of the 7 fields individually ==========

	const METADATA_FIELDS = [
		"request_id",
		"flow_id",
		"user_id",
		"actor_id",
		"idempotency_key",
		"ip",
		"user_agent",
	] as const;

	for (const field of METADATA_FIELDS) {
		it(`events::guard-metadata-missing-${field}-throws-InvalidEventPayloadError`, async () => {
			// Plan §B: helper Zod-validates metadata via `eventMetadataSchema`
			// (the 7-field set per SPEC.2 §3.7). Missing any single field
			// throws InvalidEventPayloadError. user_id + idempotency_key are
			// nullable per their semantics, so "missing" means absent from
			// the object (not present-as-null). `eventMetadataSchema` MUST
			// require the keys be present.
			const { userId } = await seedUser(`meta-${field}`);
			const eventId = uuidv7();
			const meta = validMetadata(userId, userId) as Record<string, unknown>;
			delete meta[field];
			const before = await eventsCount();

			await expect(
				testDb.transaction(async (tx) => {
					await insertEvent(tx, {
						eventId,
						eventType: "user.signed_out",
						aggregateType: "user",
						aggregateId: userId,
						payload: { userId },
						// biome-ignore lint/suspicious/noExplicitAny: testing helper guard
						metadata: meta as any,
					});
				}),
			).rejects.toBeInstanceOf(InvalidEventPayloadError);

			const after = await eventsCount();
			expect(after).toBe(before);
		});
	}

	// === Error-envelope shape (plan §C) ======================================

	it("events::guard-InvalidEventPayloadError-envelope-shape", async () => {
		// Plan §C: `toEnvelope()` returns `{ error: 'error_internal' }`
		// (programming-error surface, NOT user-facing). Confirms the new
		// DomainError subclass follows the registry's `toEnvelope()` shape
		// per src/lib/errors.ts:31-37.
		const err = new InvalidEventPayloadError("user.signed_out", []);
		expect(err.toEnvelope()).toEqual({ error: "error_internal" });
		expect(err.kind).toBe("invalid_event_payload");
		expect(err.eventType).toBe("user.signed_out");
	});

	it("events::guard-InvalidEventIdError-envelope-shape", async () => {
		// Plan §C: same shape rule applies. Carries `eventId` as public
		// readonly for diagnosability in logs.
		const err = new InvalidEventIdError("not-a-v7");
		expect(err.toEnvelope()).toEqual({ error: "error_internal" });
		expect(err.kind).toBe("invalid_event_id");
		expect(err.eventId).toBe("not-a-v7");
	});

	// === Events-table not written when guard fires ===========================

	it("events::guard-zero-rows-written-on-any-rejection-path", async () => {
		// Belt-and-suspenders: across all three rejection paths (bad payload,
		// bad metadata, bad eventId), the helper writes zero rows. Asserts
		// no half-state leaks through. Uses a single common user fixture +
		// triggers each guard in sequence.
		const { userId } = await seedUser("zero-after");
		const before = await eventsCount();

		// Path 1: bad payload.
		await expect(
			testDb.transaction(async (tx) => {
				await insertEvent(tx, {
					eventId: uuidv7(),
					eventType: "user.signed_out",
					aggregateType: "user",
					aggregateId: userId,
					payload: {} as never, // missing userId
					metadata: validMetadata(userId, userId),
				});
			}),
		).rejects.toBeInstanceOf(InvalidEventPayloadError);

		// Path 2: bad metadata.
		const badMeta = validMetadata(userId, userId) as Record<string, unknown>;
		delete badMeta.flow_id;
		await expect(
			testDb.transaction(async (tx) => {
				await insertEvent(tx, {
					eventId: uuidv7(),
					eventType: "user.signed_out",
					aggregateType: "user",
					aggregateId: userId,
					payload: { userId },
					// biome-ignore lint/suspicious/noExplicitAny: testing helper guard
					metadata: badMeta as any,
				});
			}),
		).rejects.toBeInstanceOf(InvalidEventPayloadError);

		// Path 3: bad eventId.
		await expect(
			testDb.transaction(async (tx) => {
				await insertEvent(tx, {
					eventId: uuidv4(),
					eventType: "user.signed_out",
					aggregateType: "user",
					aggregateId: userId,
					payload: { userId },
					metadata: validMetadata(userId, userId),
				});
			}),
		).rejects.toBeInstanceOf(InvalidEventIdError);

		const after = await eventsCount();
		expect(after).toBe(before);

		// Silence the unused-import warning while keeping `events` in scope
		// for future expansion (e.g., direct row-shape assertions).
		expect(events).toBeDefined();
	});
});
