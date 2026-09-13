import type postgres from "postgres";

// AUDIT-FIX-B2 (A20; ADR-0030) — TEST-ONLY teardown helper. Migration 0021
// rejects TRUNCATE on every protected table via BEFORE TRUNCATE … FOR EACH
// STATEMENT triggers, and TRUNCATE is the only way to clear Bucket-A tables
// (row-level 0003 triggers reject DELETE). Teardowns therefore wrap their
// TRUNCATE in an owner-privilege disable → TRUNCATE → re-enable dance.
//
// ONE parameterless `.unsafe()` round-trip = ONE implicit transaction
// (simple-query protocol, the migrate-prod.ts precedent): if the TRUNCATE
// fails, the whole batch rolls back and the guards are never left disabled.
// The FULL guard set is disabled — not just the listed tables — because
// `TRUNCATE … CASCADE` fires ON TRUNCATE triggers on cascaded tables too:
// short lists (`TRUNCATE markets CASCADE`) reach guarded tables outside
// themselves, and per-call-site FK-closure analysis would silently rot as
// FKs drift. Sequential test files (fileParallelism: false in BOTH vitest
// configs) make the catalog-level toggle race-free.
//
// NEVER import this from src/** (production must not gain an escape hatch,
// and src/ must not depend on tests/). The guard list mirrors
// drizzle/migrations/0021_truncate_guards.sql — keep in sync; the
// truncate-rejected.spec.ts positive control pins re-enablement.

const TRUNCATE_GUARDS: ReadonlyArray<
	readonly [table: string, trigger: string]
> = [
	// Bucket A — 9 non-partitioned tables (AUDIT-FIX-B3 0022 adds bet_receipts).
	["dharma_ledger", "bucket_a_no_truncate"],
	["bets", "bucket_a_no_truncate"],
	["comments", "bucket_a_no_truncate"],
	["resolution_events", "bucket_a_no_truncate"],
	["payout_events", "bucket_a_no_truncate"],
	["mod_actions", "bucket_a_no_truncate"],
	["admin_events", "bucket_a_no_truncate"],
	["user_events", "bucket_a_no_truncate"],
	["bet_receipts", "bucket_a_no_truncate"],
	// LIQ-1 Phase 2 / 0027. ⚠ It carries no inbound FK, so no CASCADE reaches
	// it and no existing teardown needs it — it is here for the ONE test that
	// truncates it by name: the append-only spec, which cannot use DELETE
	// (0003 rejects it) and so has no other way to clean up after proving the
	// guards reject what they are meant to. That spec re-INSERTs 0027's seed
	// row afterwards, because the migration will never re-run to restore it.
	//
	// ⚠ On STAGING it is the opposite: `liquidity_policy` is a
	// TRUNCATE_EXCLUSION with its guard left ARMED (tests/staging/_lib/guards.ts).
	// The two lists disagree on purpose — this one is a local teardown for a
	// database that is rebuilt at will, that one governs the live staging
	// database where losing the policy row silently stops every injection.
	["liquidity_policy", "bucket_a_no_truncate"],
	// events family — parent + all 13 partitions (statement triggers do not
	// clone to partitions; each carries its own).
	["events", "bucket_a_no_truncate"],
	["events_2026_05", "bucket_a_no_truncate"],
	["events_2026_06", "bucket_a_no_truncate"],
	["events_2026_07", "bucket_a_no_truncate"],
	["events_2026_08", "bucket_a_no_truncate"],
	["events_2026_09", "bucket_a_no_truncate"],
	["events_2026_10", "bucket_a_no_truncate"],
	["events_2026_11", "bucket_a_no_truncate"],
	["events_2026_12", "bucket_a_no_truncate"],
	["events_2027_01", "bucket_a_no_truncate"],
	["events_2027_02", "bucket_a_no_truncate"],
	["events_2027_03", "bucket_a_no_truncate"],
	["events_2027_04", "bucket_a_no_truncate"],
	["events_default", "bucket_a_no_truncate"],
	// Bucket B — 3 tables.
	["identity_pool", "bucket_b_no_truncate"],
	["image_uploads", "bucket_b_no_truncate"],
	["system_state", "bucket_b_no_truncate"],
];

/**
 * TRUNCATEs `tables` (always CASCADE — identical semantics to the raw
 * teardown statements this replaces; every current call site either already
 * cascaded or names a table with no inbound FKs) with the 0021 guards
 * disabled for exactly the duration of the one implicit transaction.
 */
export async function truncateTables(
	client: postgres.Sql,
	tables: readonly string[],
): Promise<void> {
	if (tables.length === 0) {
		throw new Error("truncateTables: empty table list");
	}
	const disable = TRUNCATE_GUARDS.map(
		([table, trigger]) => `ALTER TABLE ${table} DISABLE TRIGGER ${trigger};`,
	).join("\n");
	const enable = TRUNCATE_GUARDS.map(
		([table, trigger]) => `ALTER TABLE ${table} ENABLE TRIGGER ${trigger};`,
	).join("\n");
	// ⚠ D4 — THE ROLLBACK GUARANTEE IS A PROPERTY OF THIS CALL'S SHAPE, not of
	// Postgres alone. Disable, TRUNCATE and enable go out as ONE parameterless
	// `unsafe()` call, which postgres.js sends as a single simple-query message
	// (`simple: args.length === 0`), and Postgres runs such a message as ONE
	// implicit transaction: any failure rolls the DISABLE back with it, so the
	// guards are never left off. There is no `finally` re-enable behind this.
	// Passing parameters (extended protocol), splitting the batch into separate
	// calls, or adding a COMMIT inside it silently removes that guarantee.
	await client.unsafe(
		`${disable}\nTRUNCATE ${tables.join(", ")} CASCADE;\n${enable}`,
	);
}
