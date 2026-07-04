import { afterEach, describe, expect, it } from "vitest";

// Per ENGINE.6 plan §F (helper tests — probes) + §B (V2 + V1 + partition
// routing) + tests/db/_fixtures/db.ts `createdAtFromUuidV7` helper.
//
// Three load-bearing probes that verify the helper's promises against the
// storage substrate at `drizzle/migrations/0002_events_partitioning.sql`:
//
//   1. created_at derivation: `events.created_at` MUST equal the UUIDv7
//      first-48-bit unix-ms prefix EXACTLY — NOT now() (V2). Retry-safety
//      depends on this: two transactions with the same eventId compute the
//      same created_at, and the composite-PK ON CONFLICT dedupes (LD-8).
//
//   2. SQL shape: the helper emits an INSERT … ON CONFLICT clause naming
//      both partition-key columns (event_id, created_at) per V1. The
//      conflict-target shape is the load-bearing detail; the existing
//      events table only has the composite PK as a conflict target so the
//      ON CONFLICT MUST reference both columns.
//
//   3. Partition routing: a row with created_at in 2026-06 lands in
//      `events_2026_06`; a row with created_at outside the experiment
//      window (e.g., 2030-01) lands in `events_default`. The partition
//      attachment is real per 0002; Sentry alarm 2 wiring on DEFAULT writes
//      is HARDEN.*/SCAFFOLD.5 scope and intentionally NOT tested here.

import { v7 as uuidv7 } from "uuid";

import { users } from "@/db/schema";
import { insertEvent } from "@/server/events/insert";
import { createdAtFromUuidV7, testClient, testDb } from "../../db/_fixtures/db";
import { truncateTables } from "../../db/_fixtures/truncate";

afterEach(async () => {
	await truncateTables(testClient, [
		"events",
		"image_uploads",
		"users",
		"admin_sessions",
	]);
});

async function seedUser(suffix: string): Promise<{ userId: string }> {
	const [user] = await testDb
		.insert(users)
		.values({
			name: "Events Probe",
			email: `probe-${suffix}@example.com`,
			pseudonym: `probe-${suffix}`,
		})
		.returning({ id: users.id });
	if (!user) throw new Error("user seed failed");
	return { userId: user.id };
}

function validMetadata(userId: string | null, actorId: string) {
	return {
		request_id: "req-probe",
		flow_id: "F-TEST",
		user_id: userId,
		actor_id: actorId,
		idempotency_key: null,
		ip: "127.0.0.1",
		user_agent: "vitest",
	};
}

/**
 * Construct a UUIDv7 with a hand-crafted millisecond prefix so the test
 * asserts an EXACT created_at value. The format per RFC 9562 §5.7:
 *
 *   <unix_ts_ms : 48 bits>-<ver=7 : 4 bits>...
 *
 * Hex layout: `xxxxxxxx-xxxx-7xxx-Yxxx-xxxxxxxxxxxx`
 *   - First 12 hex chars (48 bits) = unix-ms big-endian.
 *   - 13th hex char (index 14 with dashes) = '7' (version).
 *   - 17th hex char (index 19 with dashes) = 8/9/A/B (variant top-bits).
 */
function uuidv7AtMs(unixMs: number): string {
	const hex = unixMs.toString(16).padStart(12, "0");
	// time_low (8 hex) + time_mid (4 hex) = first 12 hex of ms prefix.
	const timeLow = hex.slice(0, 8);
	const timeMid = hex.slice(8, 12);
	// version=7 nibble + random rest of time_hi (3 hex of random).
	const timeHiAndVersion = `7${"abc"}`;
	// variant=10xx (8/9/A/B); pick 'a' + 3 random hex.
	const clockSeq = `a${"bcd"}`;
	// node = 12 hex of random.
	const node = "0123456789ab";
	return `${timeLow}-${timeMid}-${timeHiAndVersion}-${clockSeq}-${node}`;
}

describe("insertEvent — probes (ENGINE.6 §F + §B)", () => {
	// === Probe 1: created_at derived from UUIDv7 prefix (V2 + LD-9) ==========

	it("events::probe-createdAt-equals-uuidv7-prefix-ms-exact", async () => {
		// Plan §B `uuidv7ToCreatedAt`: extracts first 48 bits as unix-ms.
		// Construct a UUIDv7 at a known ms; assert `events.created_at`
		// matches the millisecond exactly (NOT the now() at INSERT time).
		const { userId } = await seedUser("createdAt");
		const targetMs = Date.UTC(2026, 5 /* June */, 15, 12, 0, 0); // 2026-06-15T12:00:00Z
		const eventId = uuidv7AtMs(targetMs);
		// Sanity: the constructed id is a v7 (13th hex char == '7').
		expect(eventId[14]).toBe("7");

		await testDb.transaction(async (tx) => {
			await insertEvent(tx, {
				eventId,
				eventType: "user.signed_out",
				aggregateType: "user",
				aggregateId: userId,
				payload: { userId },
				metadata: validMetadata(userId, userId),
			});
		});

		const rows = await testClient<
			{ created_at: Date }[]
		>`SELECT created_at FROM events WHERE event_id = ${eventId}`;
		expect(rows.length).toBe(1);
		expect(rows[0]?.created_at.getTime()).toBe(targetMs);

		// Symmetry: the fixture helper exposes the same derivation; both
		// must agree on the same input. This is the contract the helper +
		// the partition-routing layer depend on.
		expect(createdAtFromUuidV7(eventId).getTime()).toBe(targetMs);
	});

	it("events::probe-createdAt-uses-uuidv7-not-now", async () => {
		// Negative probe: even if many seconds pass between eventId
		// construction and the INSERT, `events.created_at` is the eventId's
		// derived ms — NOT now(). Build an id at a past ms, sleep briefly,
		// then INSERT. Asserts the row's created_at is the past ms (with
		// tolerance for clock skew but well below the sleep delta).
		const { userId } = await seedUser("now-vs-prefix");
		// 365 days before execution time — relative-to-now to stay robust
		// across CI runs on any date. Lands in `events_default` (outside
		// 2026-05..2027-04 named partitions), which is fine: this probe
		// doesn't assert partition routing (see the dedicated partition
		// probes below).
		const pastMs = Date.now() - 1000 * 60 * 60 * 24 * 365;
		const eventId = uuidv7AtMs(pastMs);

		// 50ms is enough to confirm derived-ms != now() on any non-broken clock.
		await new Promise((r) => setTimeout(r, 50));

		await testDb.transaction(async (tx) => {
			await insertEvent(tx, {
				eventId,
				eventType: "user.signed_out",
				aggregateType: "user",
				aggregateId: userId,
				payload: { userId },
				metadata: validMetadata(userId, userId),
			});
		});

		const rows = await testClient<
			{ created_at: Date }[]
		>`SELECT created_at FROM events WHERE event_id = ${eventId}`;
		expect(rows[0]?.created_at.getTime()).toBe(pastMs);
		// Hard floor: > 30 days delta vs. now() — if helper used now()
		// the value would be within ~50ms of Date.now(). Pinning a 365-day
		// past pastMs makes this assertion robust regardless of execution
		// date.
		expect(
			Math.abs(Date.now() - (rows[0]?.created_at.getTime() ?? 0)),
		).toBeGreaterThan(
			1_000 * 60 * 60 * 24 * 30, // > 30 days from the test execution time
		);
	});

	// === Probe 2: SQL shape — ON CONFLICT (event_id, created_at) =============

	it("events::probe-sql-on-conflict-is-composite-event_id-created_at", async () => {
		// Plan §B + V1 + LD-3: helper MUST issue `ON CONFLICT (event_id,
		// created_at) DO NOTHING`. The composite is mandatory — the only
		// primary key on the partitioned events table is (event_id,
		// created_at) per 0002, so the partition-key column MUST be part of
		// the conflict target.
		//
		// The helper uses hand-written `sql\`...\`` (NOT Drizzle query
		// builder per LD-3). We probe the emitted SQL by reaching into the
		// Drizzle postgres-js parameter-debug layer — testClient is the raw
		// driver and we can use a notice listener OR sql trace; the
		// portable test is: do two transactions with the SAME eventId
		// produce the same `created_at` and dedupe to row-count 1. That's
		// the OBSERVABLE behavior that an ON CONFLICT (event_id, created_at)
		// guarantees and that ON CONFLICT (event_id) alone would also
		// satisfy in this specific case — so we also assert the more
		// stringent property by issuing two transactions with the same
		// eventId after the helper writes (proves the partition-key column
		// is part of the conflict target, since a single-column
		// `ON CONFLICT (event_id)` would fail with "no unique or exclusion
		// constraint matching" on a composite-PK partitioned table).
		const { userId } = await seedUser("sql-probe");
		const eventId = uuidv7();

		// First call writes the row.
		await testDb.transaction(async (tx) => {
			await insertEvent(tx, {
				eventId,
				eventType: "user.signed_out",
				aggregateType: "user",
				aggregateId: userId,
				payload: { userId },
				metadata: validMetadata(userId, userId),
			});
		});

		// Second call with same eventId — must NOT throw "ON CONFLICT
		// specification ... does not match any unique constraint". The fact
		// that this succeeds proves the conflict target is (event_id,
		// created_at) — the ONLY constraint on the partitioned table.
		await expect(
			testDb.transaction(async (tx) => {
				await insertEvent(tx, {
					eventId,
					eventType: "user.signed_out",
					aggregateType: "user",
					aggregateId: userId,
					payload: { userId },
					metadata: validMetadata(userId, userId),
				});
			}),
		).resolves.toBeUndefined();

		const rows = await testClient<
			{ count: string }[]
		>`SELECT COUNT(*)::text AS count FROM events WHERE event_id = ${eventId}`;
		expect(rows[0]?.count).toBe("1");
	});

	// === Probe 3: partition routing ==========================================

	it("events::probe-partition-routing-2026-06-lands-in-events_2026_06", async () => {
		// Plan §B + drizzle/migrations/0002_events_partitioning.sql: rows
		// with created_at in [2026-06-01, 2026-07-01) land in the
		// events_2026_06 partition. Verified via tableoid::regclass — the
		// canonical Postgres idiom for "which physical table is this row
		// stored in".
		const { userId } = await seedUser("part-jun");
		const targetMs = Date.UTC(2026, 5 /* June */, 15, 12, 0, 0);
		const eventId = uuidv7AtMs(targetMs);

		await testDb.transaction(async (tx) => {
			await insertEvent(tx, {
				eventId,
				eventType: "user.signed_out",
				aggregateType: "user",
				aggregateId: userId,
				payload: { userId },
				metadata: validMetadata(userId, userId),
			});
		});

		const rows = await testClient<
			{ partition: string }[]
		>`SELECT tableoid::regclass::text AS partition FROM events WHERE event_id = ${eventId}`;
		expect(rows[0]?.partition).toBe("events_2026_06");
	});

	it("events::probe-partition-routing-out-of-range-lands-in-events_default", async () => {
		// Plan §B + 0002: out-of-range rows (2027-05+ or pre-2026-05) land
		// in the DEFAULT partition. SCAFFOLD.5 + HARDEN.* wires Sentry
		// alarm 2 on DEFAULT writes; this test asserts the routing only,
		// NOT the alarm wiring.
		const { userId } = await seedUser("part-default");
		// 2030-01-01T00:00:00Z — well outside the 2026-05..2027-04 window.
		const targetMs = Date.UTC(2030, 0, 1, 0, 0, 0);
		const eventId = uuidv7AtMs(targetMs);

		await testDb.transaction(async (tx) => {
			await insertEvent(tx, {
				eventId,
				eventType: "user.signed_out",
				aggregateType: "user",
				aggregateId: userId,
				payload: { userId },
				metadata: validMetadata(userId, userId),
			});
		});

		const rows = await testClient<
			{ partition: string }[]
		>`SELECT tableoid::regclass::text AS partition FROM events WHERE event_id = ${eventId}`;
		expect(rows[0]?.partition).toBe("events_default");
	});

	// === Bound-transaction-only signature (V3) ===============================

	it("events::probe-bound-transaction-only-signature", async () => {
		// Plan §B Q1 + V3: `tx: DbTransaction` (NOT `DbClient`). At runtime
		// this is enforced by the SQL semantics — `tx.execute(...)` outside
		// a transaction context throws a Drizzle internal error. We probe
		// by asserting that the helper accepts a `tx` callback and the
		// inserted row is visible via the outer client AFTER commit (sanity
		// floor that the bound-tx signature actually wires through to the
		// real connection). Compile-time enforcement is the primary gate;
		// this is the runtime fallback assertion.
		const { userId } = await seedUser("bound-tx");
		const eventId = uuidv7();

		await testDb.transaction(async (tx) => {
			await insertEvent(tx, {
				eventId,
				eventType: "user.signed_out",
				aggregateType: "user",
				aggregateId: userId,
				payload: { userId },
				metadata: validMetadata(userId, userId),
			});
		});

		// Visible outside the tx after commit.
		const rows = await testClient<
			{ event_id: string }[]
		>`SELECT event_id FROM events WHERE event_id = ${eventId}`;
		expect(rows.length).toBe(1);
	});

	// === Probe 4: metadata passed through verbatim (V4) =====================

	it("events::probe-metadata-passed-through-without-enrichment", async () => {
		// V4 lock per plan §B + LD-7 + ADR-0007 + SPEC.2 §3.7: the helper
		// passes `metadata` through verbatim. No enrichment (synthetic keys
		// added), no stripping (legitimate keys removed), no transformation
		// (value mutation). The persisted JSONB column equals the input.
		// Locks the property behaviorally so a future helper-side change
		// that enriches metadata (e.g., auto-tagging request_id from async-
		// local storage) trips this probe before Phase 7 audit grep would.
		const { userId } = await seedUser("md-passthrough");
		const eventId = uuidv7();

		// Distinct, non-null values across all 7 SPEC.2 §3.7 fields so the
		// key-set assertion exercises every entry. idempotency_key non-null
		// here even though emit sites at handler entry often pass null;
		// the helper MUST persist whatever the caller supplies.
		const inputMetadata = {
			request_id: "req-md-probe",
			flow_id: "F-V4-PROBE",
			user_id: userId,
			actor_id: userId,
			idempotency_key: "idem-key-probe",
			ip: "9.8.7.6",
			user_agent: "ua-probe-v4",
		};

		await testDb.transaction(async (tx) => {
			await insertEvent(tx, {
				eventId,
				eventType: "user.signed_out",
				aggregateType: "user",
				aggregateId: userId,
				payload: { userId },
				metadata: inputMetadata,
			});
		});

		const rows = await testClient<
			{ metadata: Record<string, unknown> }[]
		>`SELECT metadata FROM events WHERE event_id = ${eventId}`;
		expect(rows.length).toBe(1);
		const persisted = rows[0]?.metadata as Record<string, unknown>;

		// (a) Field-set equality: no enrichment (extra keys added), no
		//     stripping (legitimate keys removed). Sorted key arrays equal.
		expect(Object.keys(persisted).sort()).toEqual(
			Object.keys(inputMetadata).sort(),
		);

		// (b) Value equality: no transformation. Deep equality across the
		//     full metadata object.
		expect(persisted).toEqual(inputMetadata);
	});
});
