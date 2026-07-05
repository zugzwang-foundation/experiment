import { afterEach, describe, expect, it } from "vitest";

import { testClient } from "../_fixtures/db";
import { truncateTables } from "../_fixtures/truncate";

// AUDIT-FIX-B2 A20 — the TRUNCATE-guard storage contract (migration 0021);
// extended by AUDIT-FIX-B3 0022 (bet_receipts → 13 protected).
// TRUNCATE fires no ROW-level triggers, so it bypasses the entire 0003
// append-only guard (INV-2/INV-4 storage ground truth) on all 13 protected
// tables. 0021 adds BEFORE TRUNCATE … FOR EACH STATEMENT reject triggers
// (shared enforce_bucket_a_no_truncate(), bare-RAISE → P0001, message
// "…: TRUNCATE not permitted") on the 9 non-partitioned Bucket-A tables (8 from
// 0021 + bet_receipts from 0022), the events family (parent + all 13 partitions —
// PG17 statement triggers do NOT clone to partitions, and direct-partition
// TRUNCATE skips the parent trigger), and the 3 Bucket-B tables.
//
// COLLECTION-RED now: `../_fixtures/truncate` (the disable→TRUNCATE→re-enable
// fixture helper) is built by the implementer, not here. Even with a stub
// helper this file is ASSERTION-RED pre-0021 (TRUNCATE currently SUCCEEDS
// everywhere). POST-implementation (0021 applied + helper landed): PASS.
//
// SAFETY: this file MUST run only against a 0021 DB (guards present). Pre-0021
// the rejection-matrix TRUNCATEs would SUCCEED and CASCADE-wipe data — the
// missing-import collection-RED is the interlock until both halves land.

// The 13 protected tables (10 Bucket A + 3 Bucket B). Every attempt uses CASCADE
// so an FK-referencing precondition never preempts the table's own guard.
const PROTECTED_TABLES = [
	"events",
	"dharma_ledger",
	"bets",
	"comments",
	"resolution_events",
	"payout_events",
	"mod_actions",
	"admin_events",
	"user_events",
	// AUDIT-FIX-B3 0022 — the durable idempotency completion record (Bucket A).
	"bet_receipts",
	"identity_pool",
	"image_uploads",
	"system_state",
] as const;

describe("A20 — TRUNCATE rejected on append-only tables (0021 guard)", () => {
	afterEach(async () => {
		// Self-contained teardown via the fixture helper (the only path that can
		// clear guarded tables once 0021 lands); the positive control is the sole
		// test that seeds rows.
		await truncateTables(testClient, ["dharma_ledger", "users"]);
	});

	// ── Rejection matrix: each protected table rejects TRUNCATE … CASCADE ──
	for (const table of PROTECTED_TABLES) {
		it(`truncate-guard::rejects-truncate-on-${table}`, async () => {
			await expect(
				testClient.unsafe(`TRUNCATE ${table} CASCADE`),
			).rejects.toMatchObject({
				code: "P0001",
				message: expect.stringContaining("TRUNCATE not permitted"),
			});
		});
	}

	// ── Partition coverage: the events PARENT is covered by the matrix above.
	// Direct-partition TRUNCATE skips the parent trigger (PG17), so each
	// partition carries its own guard — one monthly + the default pinned here.
	// (events_default is the exact hole the alarms-drain teardown exploits
	// today — pin it closed.)
	it("truncate-guard::rejects-truncate-on-events-monthly-partition", async () => {
		await expect(
			testClient.unsafe(`TRUNCATE events_2026_07 CASCADE`),
		).rejects.toMatchObject({
			code: "P0001",
			message: expect.stringContaining("TRUNCATE not permitted"),
		});
	});

	it("truncate-guard::rejects-truncate-on-events-default-partition", async () => {
		await expect(
			testClient.unsafe(`TRUNCATE events_default CASCADE`),
		).rejects.toMatchObject({
			code: "P0001",
			message: expect.stringContaining("TRUNCATE not permitted"),
		});
	});

	// ── Positive control: the fixture helper still resets state AND re-enables
	// the guards afterwards (a leaked DISABLE would let the final TRUNCATE pass).
	it("truncate-guard::fixture-helper-resets-state-and-re-enables-guards", async () => {
		const inserted = await testClient.unsafe<Array<{ id: string }>>(
			`INSERT INTO users (name, email, pseudonym) VALUES ($1, $2, $3) RETURNING id`,
			["Truncate Ctl", "truncate-ctl@example.com", "truncate-ctl"],
		);
		const userId = inserted[0]?.id ?? "";
		await testClient.unsafe(
			`INSERT INTO dharma_ledger (user_id, entry_type, amount, balance_after)
			 VALUES ($1, $2::dharma_entry_type, $3, $4)`,
			[userId, "initial_grant", "100", "100"],
		);

		// The helper disables the 26 guards, TRUNCATEs CASCADE, re-enables.
		await truncateTables(testClient, ["dharma_ledger", "users"]);

		const ledgerCount = await testClient.unsafe<Array<{ count: number }>>(
			`SELECT count(*)::int AS count FROM dharma_ledger`,
		);
		const userCount = await testClient.unsafe<Array<{ count: number }>>(
			`SELECT count(*)::int AS count FROM users`,
		);
		expect(Number(ledgerCount[0]?.count ?? -1)).toBe(0);
		expect(Number(userCount[0]?.count ?? -1)).toBe(0);

		// Guards RE-ENABLED: a raw TRUNCATE is rejected again.
		await expect(
			testClient.unsafe(`TRUNCATE dharma_ledger CASCADE`),
		).rejects.toMatchObject({
			code: "P0001",
			message: expect.stringContaining("TRUNCATE not permitted"),
		});
	});

	// ── Negative control: positions is Bucket C (mutable, UNGUARDED) — TRUNCATE
	// succeeds before AND after a helper call (the helper never installs a
	// positions guard, and its ENABLE arm never spuriously creates one).
	it("truncate-guard::bucket-c-positions-truncate-succeeds-before-and-after-helper", async () => {
		await expect(
			testClient.unsafe(`TRUNCATE positions CASCADE`),
		).resolves.toBeDefined();

		await truncateTables(testClient, ["dharma_ledger", "users"]);

		await expect(
			testClient.unsafe(`TRUNCATE positions CASCADE`),
		).resolves.toBeDefined();
	});
});
