import { v7 as uuidv7 } from "uuid";
import { afterEach, describe, expect, it, vi } from "vitest";

// AUDIT-FIX-B5 (A30) — observability guard on `insertEvent`'s composite
// `ON CONFLICT (event_id, created_at) DO NOTHING`. A same-event_id reinsert with
// a DIFFERENT payload was silently dropped; now the helper re-SELECTs the
// existing row in the same tx and, on a canonicalized-payload MISMATCH, fires a
// fail-open `safeCaptureException` (tag `event_id_reuse_payload_mismatch`, key
// NAMES only — never payload values). A same-payload retry (the §7.3 storage
// idempotency dedupe) still succeeds SILENTLY. A re-SELECT that finds no row
// (conflicting row outside this snapshot) stays silent (cannot-compare).
//
// FAILING-FIRST: RED because `comparePayloads` does not yet exist and `insertEvent`
// has no RETURNING / re-SELECT / capture — so the different-payload reinsert never
// fires a capture.

const { mockSafeCaptureException } = vi.hoisted(() => ({
	mockSafeCaptureException: vi.fn(
		(_err: unknown, _ctx: { tags: Record<string, string> }) => true,
	),
}));
vi.mock("@/server/observability/safe-capture", () => ({
	safeCaptureException: mockSafeCaptureException,
	safeCaptureMessage: vi.fn(() => true),
	safeFlush: vi.fn(async () => true),
}));

import { comparePayloads, insertEvent } from "@/server/events/insert";
import { testClient, testDb } from "../../db/_fixtures/db";
import { truncateTables } from "../../db/_fixtures/truncate";

function baseMetadata() {
	return {
		request_id: "req-b5",
		flow_id: "F-TEST",
		user_id: null,
		actor_id: "system",
		idempotency_key: null,
		ip: "127.0.0.1",
		user_agent: "vitest",
	};
}

describe("AUDIT-FIX-B5 (A30) comparePayloads — pure decision, all three arms", () => {
	it("existing null (cannot-compare) → no mismatch", () => {
		expect(comparePayloads({ a: 1, b: 2 }, null)).toEqual({
			mismatch: false,
			divergentKeys: [],
		});
	});

	it("same payload, different key order → no mismatch (canonical compare)", () => {
		expect(comparePayloads({ a: 1, b: 2 }, { b: 2, a: 1 })).toEqual({
			mismatch: false,
			divergentKeys: [],
		});
	});

	it("differing value → mismatch, only the divergent key name", () => {
		expect(comparePayloads({ a: 1, b: 2 }, { a: 1, b: 3 })).toEqual({
			mismatch: true,
			divergentKeys: ["b"],
		});
	});

	it("key present on one side only → mismatch on that key", () => {
		expect(comparePayloads({ a: 1 }, { a: 1, b: 2 })).toEqual({
			mismatch: true,
			divergentKeys: ["b"],
		});
	});
});

describe("AUDIT-FIX-B5 (A30) insertEvent — event_id-reuse payload guard", () => {
	afterEach(async () => {
		mockSafeCaptureException.mockClear();
		await truncateTables(testClient, ["events"]);
	});

	it("same event_id + DIFFERENT payload → fires event_id_reuse_payload_mismatch (key names only)", async () => {
		const eventId = uuidv7();
		const uploadId = uuidv7();
		await testDb.transaction((tx) =>
			insertEvent(tx, {
				eventId,
				eventType: "image_upload.orphaned",
				aggregateType: "image_upload",
				aggregateId: uploadId,
				payload: { uploadId, key: "k-original" },
				metadata: baseMetadata(),
			}),
		);
		// Reinsert same event_id, divergent `key` — conflict fires, DO NOTHING.
		await testDb.transaction((tx) =>
			insertEvent(tx, {
				eventId,
				eventType: "image_upload.orphaned",
				aggregateType: "image_upload",
				aggregateId: uploadId,
				payload: { uploadId, key: "k-DIVERGENT" },
				metadata: baseMetadata(),
			}),
		);

		expect(mockSafeCaptureException).toHaveBeenCalledTimes(1);
		const [, ctx] = mockSafeCaptureException.mock.calls[0];
		expect(ctx.tags.kind).toBe("event_id_reuse_payload_mismatch");
		expect(ctx.tags.event_id).toBe(eventId);
		expect(ctx.tags.differing_keys).toBe("key");
		// PII guard: neither payload VALUE appears anywhere in the captured context.
		const serialized = JSON.stringify(ctx);
		expect(serialized).not.toContain("k-original");
		expect(serialized).not.toContain("k-DIVERGENT");

		// The reinsert did NOT add a row (dedupe held).
		const rows = await testClient<{ count: string }[]>`
			SELECT COUNT(*)::text AS count FROM events WHERE event_id = ${eventId}`;
		expect(rows[0]?.count).toBe("1");
	});

	it("same event_id + SAME payload → silent dedupe (no capture, no throw)", async () => {
		const eventId = uuidv7();
		const uploadId = uuidv7();
		const payload = { uploadId, key: "k-stable" };
		await testDb.transaction((tx) =>
			insertEvent(tx, {
				eventId,
				eventType: "image_upload.orphaned",
				aggregateType: "image_upload",
				aggregateId: uploadId,
				payload,
				metadata: baseMetadata(),
			}),
		);
		await expect(
			testDb.transaction((tx) =>
				insertEvent(tx, {
					eventId,
					eventType: "image_upload.orphaned",
					aggregateType: "image_upload",
					aggregateId: uploadId,
					payload,
					metadata: baseMetadata(),
				}),
			),
		).resolves.toBeUndefined();

		expect(mockSafeCaptureException).not.toHaveBeenCalled();
		const rows = await testClient<{ count: string }[]>`
			SELECT COUNT(*)::text AS count FROM events WHERE event_id = ${eventId}`;
		expect(rows[0]?.count).toBe("1");
	});

	it("happy-path real insert (no conflict) → inserted_count >= 1, guard skipped, no capture", async () => {
		// The fused CTE runs its `existing_payload` subquery on EVERY call — including
		// a fresh insert. On a real insert the just-written row is invisible to the
		// statement-start snapshot, so `existing_payload` comes back NULL; the guard
		// is skipped PURELY via `inserted_count >= 1`, so NO capture fires despite the
		// NULL. This locks behaviour 4 in isolation: the redesign made the happy path
		// traverse the existing-payload read that the superseded two-statement design
		// skipped, so the `inserted_count >= 1` skip branch is a NEW code path.
		const eventId = uuidv7();
		const uploadId = uuidv7();
		await expect(
			testDb.transaction((tx) =>
				insertEvent(tx, {
					eventId,
					eventType: "image_upload.orphaned",
					aggregateType: "image_upload",
					aggregateId: uploadId,
					payload: { uploadId, key: "k-fresh" },
					metadata: baseMetadata(),
				}),
			),
		).resolves.toBeUndefined();

		expect(mockSafeCaptureException).not.toHaveBeenCalled();
		const rows = await testClient<{ count: string }[]>`
			SELECT COUNT(*)::text AS count FROM events WHERE event_id = ${eventId}`;
		expect(rows[0]?.count).toBe("1");
	});
});
