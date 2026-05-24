import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Per ENGINE.6 plan §F (migration-site test) + §D.1 (sign-upload helper
// refactor + emission). Verifies the `image_upload.sign_requested` event is
// emitted atomically with the `image_uploads` INSERT inside the helper's
// transaction.
//
// Three load-bearing properties:
//   1. Happy path: row in `events` with event_type='image_upload.sign_requested',
//      aggregate_type='image_upload', aggregate_id=uploadId, payload matches
//      plan §A schema, all 7 metadata fields present.
//   2. Atomicity: tx rollback → neither image_uploads nor events row present.
//   3. mintPutUrl runs AFTER tx commits (verified by mock-call ordering or
//      throw-after-tx test).

const { mockMintPutUrl } = vi.hoisted(() => ({
	mockMintPutUrl: vi.fn(),
}));

vi.mock("@/server/storage/r2", () => ({
	mintPutUrl: mockMintPutUrl,
	mintReadUrl: vi.fn(),
	headObject: vi.fn(),
	deleteObject: vi.fn(),
}));

import { v7 as uuidv7 } from "uuid";

import { imageUploads, users } from "@/db/schema";
import { signUploadAndInsert } from "@/server/storage/sign-upload";
import { testClient, testDb } from "../../db/_fixtures/db";

beforeEach(() => {
	mockMintPutUrl.mockReset();
	// Default to throw — any helper code path that still calls mintPutUrl
	// inside the tx must fail loudly.
	mockMintPutUrl.mockImplementation(() => {
		throw new Error(
			"mintPutUrl MUST NOT be called from inside signUploadAndInsert",
		);
	});
});

afterEach(async () => {
	await testClient.unsafe(`TRUNCATE events, image_uploads, users CASCADE`);
	vi.clearAllMocks();
});

async function seedUser(suffix: string): Promise<{ userId: string }> {
	const [user] = await testDb
		.insert(users)
		.values({
			name: "Sign Event",
			email: `signevt-${suffix}@example.com`,
			pseudonym: `signevt-${suffix}`,
		})
		.returning({ id: users.id });
	if (!user) throw new Error("user seed failed");
	return { userId: user.id };
}

function metadata(userId: string) {
	return {
		request_id: "req-sign-evt",
		flow_id: "F-COMMENT-3",
		user_id: userId,
		actor_id: userId,
		idempotency_key: null,
		ip: "1.2.3.4",
		user_agent: "Mozilla/5.0 (test)",
	};
}

describe("sign-upload emits image_upload.sign_requested (ENGINE.6 §D.1)", () => {
	// === Happy path: row + event committed atomically ========================

	it("image_upload.sign_requested::happy-path-emits-event-with-payload-and-metadata", async () => {
		// Plan §A payload: { uploadId, userId, contentType, byteSize, key }.
		// Plan §B + 7-field metadata per SPEC.2 §3.7.
		// The events row is written inside the same tx as the image_uploads
		// INSERT — both commit together.
		const { userId } = await seedUser("happy");
		const eventId = uuidv7();
		let uploadId = "";
		let key = "";

		await testDb.transaction(async (tx) => {
			const r = await signUploadAndInsert(tx, {
				userId,
				contentType: "image/jpeg",
				byteSize: 50_000,
				eventId,
				metadata: metadata(userId),
			});
			uploadId = r.uploadId;
			key = r.key;
		});

		// image_uploads row written.
		const uploadRows = await testClient<
			{ id: string }[]
		>`SELECT id FROM image_uploads WHERE id = ${uploadId}`;
		expect(uploadRows.length).toBe(1);

		// events row written with correct shape.
		const eventRows = await testClient<
			{
				event_id: string;
				event_type: string;
				aggregate_type: string;
				aggregate_id: string;
				payload: Record<string, unknown>;
				metadata: Record<string, unknown>;
			}[]
		>`SELECT event_id, event_type, aggregate_type, aggregate_id, payload, metadata
		    FROM events WHERE event_id = ${eventId}`;
		expect(eventRows.length).toBe(1);
		const ev = eventRows[0]!;
		expect(ev.event_type).toBe("image_upload.sign_requested");
		expect(ev.aggregate_type).toBe("image_upload");
		expect(ev.aggregate_id).toBe(uploadId);
		expect(ev.payload).toEqual({
			uploadId,
			userId,
			contentType: "image/jpeg",
			byteSize: 50_000,
			key,
		});
		// All 7 metadata fields per SPEC.2 §3.7.
		expect(ev.metadata).toEqual(metadata(userId));
	});

	// === Atomicity: tx rollback → no rows in either table ====================

	it("image_upload.sign_requested::tx-rollback-persists-neither-row", async () => {
		// Per plan §D.1: image_uploads INSERT + insertEvent inside one tx.
		// If the wrapping tx throws after the helper returns, both rows are
		// gone — atomicity through the helper.
		const { userId } = await seedUser("rb");
		const eventId = uuidv7();
		let capturedUploadId = "";

		await expect(
			testDb.transaction(async (tx) => {
				const r = await signUploadAndInsert(tx, {
					userId,
					contentType: "image/jpeg",
					byteSize: 50_000,
					eventId,
					metadata: metadata(userId),
				});
				capturedUploadId = r.uploadId;
				throw new Error("rollback-marker");
			}),
		).rejects.toThrow(/rollback-marker/);

		// Neither row present.
		const uploadRows = await testClient<
			{ id: string }[]
		>`SELECT id FROM image_uploads WHERE id = ${capturedUploadId}`;
		const eventRows = await testClient<
			{ event_id: string }[]
		>`SELECT event_id FROM events WHERE event_id = ${eventId}`;
		expect(uploadRows.length).toBe(0);
		expect(eventRows.length).toBe(0);
	});

	// === mintPutUrl runs AFTER tx commits (HTTP-outside-tx per CLAUDE.md §3) =

	it("image_upload.sign_requested::mintPutUrl-not-called-from-inside-helper-tx", async () => {
		// Plan §D.1 + CLAUDE.md §3: HTTP-in-tx is a refusal trigger. The
		// helper must NOT call mintPutUrl from inside the tx. The route
		// orchestrates `tx → mintPutUrl outside tx`. The beforeEach mock
		// throws if mintPutUrl is invoked; this test asserts the helper
		// completes without triggering that throw.
		const { userId } = await seedUser("no-mint");
		const eventId = uuidv7();
		await testDb.transaction(async (tx) => {
			await signUploadAndInsert(tx, {
				userId,
				contentType: "image/jpeg",
				byteSize: 50_000,
				eventId,
				metadata: metadata(userId),
			});
		});
		expect(mockMintPutUrl).not.toHaveBeenCalled();
	});

	// === aggregate_id = uploadId (the row being created) =====================

	it("image_upload.sign_requested::aggregate_id-equals-image_uploads-id", async () => {
		// Plan §A: aggregate_type='image_upload', aggregate_id=uploadId.
		// The events row's aggregate_id is the image_uploads.id PK — both
		// share the same UUIDv7 (the helper generates uploadId internally
		// per SCAFFOLD.15; the events row carries it through).
		const { userId } = await seedUser("agg-id");
		const eventId = uuidv7();
		let uploadId = "";

		await testDb.transaction(async (tx) => {
			const r = await signUploadAndInsert(tx, {
				userId,
				contentType: "image/png",
				byteSize: 25_000,
				eventId,
				metadata: metadata(userId),
			});
			uploadId = r.uploadId;
		});

		const rows = await testClient<
			{ aggregate_id: string }[]
		>`SELECT aggregate_id FROM events WHERE event_id = ${eventId}`;
		expect(rows[0]?.aggregate_id).toBe(uploadId);

		// Cross-check: image_uploads.id matches.
		const uRows = await testClient<
			{ id: string }[]
		>`SELECT id FROM image_uploads WHERE id = ${uploadId}`;
		expect(uRows[0]?.id).toBe(uploadId);
	});

	// === Retry-with-same-eventId dedupes (storage-layer idempotency) =========

	it("image_upload.sign_requested::same-eventId-across-two-tx-deduplicates", async () => {
		// Plan §B V1 + LD-8: caller may safely retry with same eventId.
		// ON CONFLICT dedupes; final events row-count for that eventId = 1.
		// NOTE: image_uploads has no idempotency key, so two helper calls
		// with the same eventId will write 2 image_uploads rows but only 1
		// events row (the events helper's idempotency primitive, not the
		// image_uploads INSERT's). This is acceptable per SPEC.2 §11 — the
		// orphan-sweep catches the second image_uploads row within 2h.
		const { userId } = await seedUser("retry");
		const eventId = uuidv7();

		await testDb.transaction(async (tx) => {
			await signUploadAndInsert(tx, {
				userId,
				contentType: "image/jpeg",
				byteSize: 10_000,
				eventId,
				metadata: metadata(userId),
			});
		});
		await testDb.transaction(async (tx) => {
			await signUploadAndInsert(tx, {
				userId,
				contentType: "image/jpeg",
				byteSize: 10_000,
				eventId,
				metadata: metadata(userId),
			});
		});

		const rows = await testClient<
			{ count: string }[]
		>`SELECT COUNT(*)::text AS count FROM events WHERE event_id = ${eventId}`;
		expect(rows[0]?.count).toBe("1");
	});
});
