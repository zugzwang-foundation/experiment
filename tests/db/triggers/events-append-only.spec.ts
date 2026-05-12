import { afterEach, describe, expect, it } from "vitest";

import { events } from "@/db/schema";
import { testClient, testDb } from "../_fixtures/db";

// Bucket A — events. Per SPEC.2 §6.2 + 0003_append_only_triggers.sql lines 42-43:
// BEFORE UPDATE / BEFORE DELETE both fire enforce_bucket_a_no_update /
// enforce_bucket_a_no_delete. Postgres 11+ propagates row-level triggers to
// every inherited partition automatically — fixtures hit the events parent.
//
// Fixture supplies created_at = '2026-06-15T12:00:00Z' explicitly so the row
// routes to events_2026_06. (Storage PK is composite (event_id, created_at)
// per 0002_events_partitioning.sql; the Drizzle schema declares event_id as
// single-column PK — composite alignment is PRECURSOR.5 backlog. Explicit
// createdAt is the canonical workaround.)
//
// Rejection-path queries go through testClient.unsafe() so the PostgresError
// surfaces unwrapped — Drizzle 0.45 wraps trigger errors in DrizzleQueryError
// with the original on `.cause`. Raw SQL keeps the assertion shape simple.

describe("events — append-only trigger", () => {
	afterEach(async () => {
		await testClient.unsafe(`TRUNCATE events CASCADE`);
	});

	it("rejects UPDATE with P0001 (append-only violation)", async () => {
		const aggregateId = "11111111-1111-7111-8111-111111111111";
		const createdAt = new Date("2026-06-15T12:00:00Z");
		const [inserted] = await testDb
			.insert(events)
			.values({
				eventType: "test.event",
				aggregateType: "market",
				aggregateId,
				payload: {},
				payloadVersion: 1,
				metadata: {},
				createdAt,
			})
			.returning({ eventId: events.eventId });

		await expect(
			testClient.unsafe(
				`UPDATE events SET payload = '{"changed":true}'::jsonb WHERE event_id = $1`,
				[inserted?.eventId ?? ""],
			),
		).rejects.toMatchObject({
			code: "P0001",
			message: expect.stringContaining("UPDATE not permitted"),
		});
	});

	it("rejects DELETE with P0001 (append-only violation)", async () => {
		const aggregateId = "22222222-2222-7222-8222-222222222222";
		const createdAt = new Date("2026-06-15T12:00:00Z");
		const [inserted] = await testDb
			.insert(events)
			.values({
				eventType: "test.event",
				aggregateType: "market",
				aggregateId,
				payload: {},
				payloadVersion: 1,
				metadata: {},
				createdAt,
			})
			.returning({ eventId: events.eventId });

		await expect(
			testClient.unsafe(`DELETE FROM events WHERE event_id = $1`, [
				inserted?.eventId ?? "",
			]),
		).rejects.toMatchObject({
			code: "P0001",
			message: expect.stringContaining("DELETE not permitted"),
		});
	});
});
