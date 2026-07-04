import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Per ENGINE.6 plan §F (migration-site test) + §D.6 (per-row micro-tx;
// preserves SCAFFOLD.15 security-auditor MEDIUM #1 UPDATE-then-delete
// ordering).
//
// Three load-bearing properties:
//   1. CAS-success → 1 `events` row per CAS-won candidate. Payload
//      `{ uploadId, key }`, aggregate_type='image_upload', aggregate_id=row.id,
//      metadata.actor_id='system', metadata.user_id=null,
//      metadata.flow_id='F-CRON-ORPHAN-SWEEP'.
//   2. CAS-loss → 0 events rows for that row (concurrent W-2 commit
//      terminalized to 'committed' between SELECT and UPDATE).
//   3. Per-row deleteObject failure → 0 events rows beyond what's already
//      written. Specifically: the events row is emitted INSIDE the tx
//      BEFORE deleteObject runs, so a downstream deleteObject failure does
//      NOT erase the events row. (The tx committed; the events row stays;
//      Layer 1 R2 90-day lifecycle catches the linger.)
//   4. Sequence ordering: deleteObject runs AFTER the per-row tx commits.

import { sql } from "drizzle-orm";

import { users } from "@/db/schema";
import {
	ORPHAN_SWEEP_CIRCUIT_BREAKER_THRESHOLD,
	ORPHAN_WINDOW_MINUTES,
} from "@/server/config/limits";
import { sweepOrphans } from "@/server/storage/sweep-orphans";
import { testClient, testDb } from "../../db/_fixtures/db";
import { truncateTables } from "../../db/_fixtures/truncate";

beforeEach(() => {
	// no module-level mocks — deleteObject is injected as a function param
});

afterEach(async () => {
	await truncateTables(testClient, ["events", "image_uploads", "users"]);
	vi.clearAllMocks();
});

async function seedUser(suffix: string): Promise<{ userId: string }> {
	const [user] = await testDb
		.insert(users)
		.values({
			name: "Sweep Event",
			email: `sweepevt-${suffix}@example.com`,
			pseudonym: `sweepevt-${suffix}`,
		})
		.returning({ id: users.id });
	if (!user) throw new Error("user seed failed");
	return { userId: user.id };
}

async function seedUpload(
	userId: string,
	r2Key: string,
	minutesAgo: number,
): Promise<{ id: string }> {
	const rows = await testClient<{ id: string }[]>`
		INSERT INTO image_uploads
			(user_id, r2_object_key, content_type, byte_size, created_at)
		VALUES
			(${userId}, ${r2Key}, ${"image/jpeg"}, ${50_000},
			 now() - (${minutesAgo} || ' minutes')::interval)
		RETURNING id
	`;
	if (!rows[0]) throw new Error("upload seed failed");
	return { id: rows[0].id };
}

describe("sweepOrphans emits image_upload.orphaned (ENGINE.6 §D.6)", () => {
	// === CAS-success emits 1 event row =======================================

	it("image_upload.orphaned::cas-success-emits-event-per-row", async () => {
		// Per plan §D.6: each CAS-won candidate produces exactly one events
		// row with event_type='image_upload.orphaned', aggregate_id=row.id,
		// payload={ uploadId: row.id, key: r2_object_key }, metadata system
		// actor.
		const { userId } = await seedUser("happy");
		const { id } = await seedUpload(
			userId,
			"u/u/orph.jpg",
			ORPHAN_WINDOW_MINUTES + 10,
		);
		const mockDelete = vi.fn().mockResolvedValue(undefined);

		const result = await sweepOrphans({
			db: testDb,
			deleteObject: mockDelete,
			batchSize: 100,
			orphanWindowMinutes: ORPHAN_WINDOW_MINUTES,
			circuitBreakerThreshold: ORPHAN_SWEEP_CIRCUIT_BREAKER_THRESHOLD,
		});

		expect(result.status).toBe("ok");
		expect(result.swept).toBe(1);

		// One events row for this aggregate_id.
		const evRows = await testClient<
			{
				event_type: string;
				aggregate_type: string;
				aggregate_id: string;
				payload: Record<string, unknown>;
				metadata: Record<string, unknown>;
			}[]
		>`SELECT event_type, aggregate_type, aggregate_id, payload, metadata
		    FROM events WHERE aggregate_id = ${id}::uuid`;
		expect(evRows.length).toBe(1);
		// biome-ignore lint/style/noNonNullAssertion: length pre-asserted by expect above
		const ev = evRows[0]!;
		expect(ev.event_type).toBe("image_upload.orphaned");
		expect(ev.aggregate_type).toBe("image_upload");
		expect(ev.aggregate_id).toBe(id);
		expect(ev.payload).toEqual({ uploadId: id, key: "u/u/orph.jpg" });
		// metadata: actor_id='system', user_id=null, flow_id='F-CRON-ORPHAN-SWEEP'.
		expect(ev.metadata.actor_id).toBe("system");
		expect(ev.metadata.user_id).toBeNull();
		expect(ev.metadata.flow_id).toBe("F-CRON-ORPHAN-SWEEP");
	});

	// === Multi-row sweep emits one event per CAS-success =====================

	it("image_upload.orphaned::multi-row-emits-one-event-per-row", async () => {
		// Three CAS-wins → three events rows. Order doesn't matter
		// (sequence-of-per-row-txes); count is the assertion.
		const { userId } = await seedUser("multi");
		const a = await seedUpload(userId, "u/u/a.jpg", ORPHAN_WINDOW_MINUTES + 5);
		const b = await seedUpload(userId, "u/u/b.png", ORPHAN_WINDOW_MINUTES + 10);
		const c = await seedUpload(
			userId,
			"u/u/c.webp",
			ORPHAN_WINDOW_MINUTES + 30,
		);
		const mockDelete = vi.fn().mockResolvedValue(undefined);

		const result = await sweepOrphans({
			db: testDb,
			deleteObject: mockDelete,
			batchSize: 100,
			orphanWindowMinutes: ORPHAN_WINDOW_MINUTES,
			circuitBreakerThreshold: ORPHAN_SWEEP_CIRCUIT_BREAKER_THRESHOLD,
		});
		expect(result.swept).toBe(3);

		const rows = await testClient<{ aggregate_id: string }[]>`
			SELECT aggregate_id FROM events
			 WHERE event_type = 'image_upload.orphaned'
			   AND aggregate_id = ANY(ARRAY[${a.id}, ${b.id}, ${c.id}]::uuid[])`;
		expect(rows.length).toBe(3);
		expect(rows.map((r) => r.aggregate_id).sort()).toEqual(
			[a.id, b.id, c.id].sort(),
		);
	});

	// === CAS-loss emits NOTHING ==============================================

	it("image_upload.orphaned::cas-loss-emits-no-event-but-cas-success-does", async () => {
		// Per plan §D.6: if a row was terminalized to 'committed' before the
		// sweep visits it, the CAS predicate matches zero rows and the per-
		// row tx does NOT emit. To prove this assertion is non-trivial (i.e.
		// distinct from "no events table writes at all"), we ALSO seed a
		// second row that IS a valid orphan candidate. Expected post-sweep:
		//   - committed row: 0 events emitted (CAS-loss branch).
		//   - orphan row:    1 event emitted (CAS-success branch).
		// This double-anchor catches the (current-impl) "no emit anywhere"
		// state AND the (faulty-impl) "always emit even on CAS-loss" state.
		const { userId } = await seedUser("cas-loss-vs-win");
		const committed = await seedUpload(
			userId,
			"u/u/committed.jpg",
			ORPHAN_WINDOW_MINUTES + 10,
		);
		const orphan = await seedUpload(
			userId,
			"u/u/orphan.jpg",
			ORPHAN_WINDOW_MINUTES + 10,
		);
		await testClient.unsafe(
			`UPDATE image_uploads SET terminal_state='committed', terminal_at=now() WHERE id = $1`,
			[committed.id],
		);
		const mockDelete = vi.fn().mockResolvedValue(undefined);

		const result = await sweepOrphans({
			db: testDb,
			deleteObject: mockDelete,
			batchSize: 100,
			orphanWindowMinutes: ORPHAN_WINDOW_MINUTES,
			circuitBreakerThreshold: ORPHAN_SWEEP_CIRCUIT_BREAKER_THRESHOLD,
		});
		// 1 swept (the genuinely-orphan row); the committed row is skipped.
		expect(result.swept).toBe(1);
		expect(mockDelete).toHaveBeenCalledTimes(1);

		// Committed row: 0 events emitted (CAS-loss / never-a-candidate branch).
		const committedEvents = await testClient<
			{ count: string }[]
		>`SELECT COUNT(*)::text AS count FROM events WHERE aggregate_id = ${committed.id}::uuid AND event_type = 'image_upload.orphaned'`;
		expect(committedEvents[0]?.count).toBe("0");
		// Orphan row: 1 event emitted (CAS-success branch).
		const orphanEvents = await testClient<
			{ count: string }[]
		>`SELECT COUNT(*)::text AS count FROM events WHERE aggregate_id = ${orphan.id}::uuid AND event_type = 'image_upload.orphaned'`;
		expect(orphanEvents[0]?.count).toBe("1");
	});

	// === Sequence ordering: deleteObject AFTER tx commits ====================

	it("image_upload.orphaned::deleteObject-runs-after-per-row-tx-commits", async () => {
		// Per plan §D.6: tx { UPDATE-CAS + insertEvent } → tx commits → THEN
		// deleteObject. This is the SCAFFOLD.15 security-auditor MEDIUM #1
		// fix; inverting the order re-opens the W-2/sweep TOCTOU.
		//
		// Observable: at the moment `deleteObject` is invoked, the events
		// row for that aggregate_id is ALREADY visible via testClient
		// (committed). We assert this by making deleteObject a probe that
		// reads from the events table while it runs.
		const { userId } = await seedUser("ordering");
		const { id } = await seedUpload(
			userId,
			"u/u/ordering.jpg",
			ORPHAN_WINDOW_MINUTES + 10,
		);

		// Probe: deleteObject queries events table; the events row for this
		// aggregate must already be present (tx committed before
		// deleteObject was invoked).
		let observedEventsRowAtDeleteTime = 0;
		const mockDelete = vi
			.fn()
			.mockImplementation(async (_bucket: string, _key: string) => {
				const rows = await testClient<
					{ count: string }[]
				>`SELECT COUNT(*)::text AS count FROM events WHERE aggregate_id = ${id}::uuid AND event_type = 'image_upload.orphaned'`;
				observedEventsRowAtDeleteTime = Number.parseInt(
					rows[0]?.count ?? "0",
					10,
				);
			});

		const result = await sweepOrphans({
			db: testDb,
			deleteObject: mockDelete,
			batchSize: 100,
			orphanWindowMinutes: ORPHAN_WINDOW_MINUTES,
			circuitBreakerThreshold: ORPHAN_SWEEP_CIRCUIT_BREAKER_THRESHOLD,
		});
		expect(result.swept).toBe(1);
		expect(observedEventsRowAtDeleteTime).toBe(1);
	});

	// === deleteObject failure does NOT erase the already-committed event ====

	it("image_upload.orphaned::deleteObject-failure-leaves-events-row-intact", async () => {
		// Per plan §D.6 + SPEC.2 §12.6: deleteObject runs AFTER the tx
		// commits. If deleteObject throws, the events row stays (the tx
		// already committed). Layer 1 R2 90-day lifecycle catches the R2
		// linger. This test asserts the events row is present even when
		// deleteObject fails — the failure is logged via console.error +
		// SCAFFOLD.5 Sentry-tag, but the audit trail stays.
		const { userId } = await seedUser("delete-fail");
		const { id } = await seedUpload(
			userId,
			"u/u/del-fail.jpg",
			ORPHAN_WINDOW_MINUTES + 10,
		);
		const mockDelete = vi.fn().mockRejectedValue(new Error("R2 503"));

		const result = await sweepOrphans({
			db: testDb,
			deleteObject: mockDelete,
			batchSize: 100,
			orphanWindowMinutes: ORPHAN_WINDOW_MINUTES,
			circuitBreakerThreshold: ORPHAN_SWEEP_CIRCUIT_BREAKER_THRESHOLD,
		});
		// swept = 1 (CAS-success count, not delete-success). status stays
		// 'ok' since only 1 failure < circuitBreakerThreshold.
		expect(result.swept).toBe(1);

		// Events row IS present — the tx committed before deleteObject ran.
		const rows = await testClient<
			{ event_id: string }[]
		>`SELECT event_id FROM events WHERE aggregate_id = ${id}::uuid AND event_type = 'image_upload.orphaned'`;
		expect(rows.length).toBe(1);

		// And the image_uploads row is orphan-terminalized.
		const uRows = await testClient<
			{ terminal_state: string }[]
		>`SELECT terminal_state FROM image_uploads WHERE id = ${id}`;
		expect(uRows[0]?.terminal_state).toBe("orphan");
	});

	// === Event eventId is generated per-row (cron-analog of handler-entry) ==

	it("image_upload.orphaned::per-row-eventId-allows-independent-tx-commits", async () => {
		// Per plan §D.6: cron has no handler entry; `eventId` is generated
		// per-row inside the tx. Each row's tx is independent. We assert
		// this by verifying that multiple rows in a single sweep produce
		// distinct events rows (no shared eventId across rows).
		const { userId } = await seedUser("per-row-id");
		const a = await seedUpload(userId, "u/u/x.jpg", ORPHAN_WINDOW_MINUTES + 5);
		const b = await seedUpload(userId, "u/u/y.jpg", ORPHAN_WINDOW_MINUTES + 10);
		const mockDelete = vi.fn().mockResolvedValue(undefined);

		await sweepOrphans({
			db: testDb,
			deleteObject: mockDelete,
			batchSize: 100,
			orphanWindowMinutes: ORPHAN_WINDOW_MINUTES,
			circuitBreakerThreshold: ORPHAN_SWEEP_CIRCUIT_BREAKER_THRESHOLD,
		});

		const rows = await testClient<{ event_id: string; aggregate_id: string }[]>`
			SELECT event_id, aggregate_id FROM events
			 WHERE event_type = 'image_upload.orphaned'
			   AND aggregate_id = ANY(ARRAY[${a.id}, ${b.id}]::uuid[])`;
		expect(rows.length).toBe(2);
		// Distinct event_ids.
		expect(rows[0]?.event_id).not.toBe(rows[1]?.event_id);
		// Use the `sql` import to make biome happy (also smoke-test that
		// the events table is reachable via the Drizzle client path).
		const probe = await testDb.execute(sql`SELECT 1 AS ok`);
		expect(probe.length).toBe(1);
	});
});
