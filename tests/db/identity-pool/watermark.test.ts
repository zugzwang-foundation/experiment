// SCAFFOLD.17 plan §D — real-Postgres integration tests for the pg_cron
// low-watermark check function `check_identity_pool_watermark()` shipped
// in `drizzle/migrations/0007_pg_cron_jobs.sql`. Tests the function
// directly (NOT the scheduled tick) per research brief R5 — pg_cron
// background-worker timing inside `supabase start` is unreliable.
//
// Raw-SQL access pattern: `watermark_state` + `cron_alarms` ship as raw
// DDL only (no Drizzle declaration in SCAFFOLD.17); tests use
// `testDb.execute(sql\`...\`)` for reads and `testClient.unsafe(...)` for
// mutations. `identity_pool` continues with the typed Drizzle query
// builder (it ships at HEAD per `src/db/schema/identity.ts`).
//
// Tests-first per CLAUDE.md §5.6 — written by test-writer reviewer-call
// at Phase 2 START. Tests MUST fail against the Phase 1 stub at
// `drizzle/migrations/0007_pg_cron_jobs.sql` (header-only): the SQL call
// rejects with "function check_identity_pool_watermark does not exist"
// (and `watermark_state` / `cron_alarms` relations do not exist either).

import { sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";

import { identityPool } from "@/db/schema";
import { testClient, testDb } from "../_fixtures/db";

const COLOURS = [
	"Red",
	"Blue",
	"Amber",
	"Green",
	"Crimson",
	"Azure",
	"Emerald",
	"Violet",
	"Saffron",
	"Ivory",
] as const;
const ANIMALS = [
	"Fox",
	"Wolf",
	"Otter",
	"Badger",
	"Lynx",
	"Hare",
	"Owl",
	"Hawk",
	"Stoat",
	"Pine",
] as const;

// Build 100 deterministic identity_pool rows matching the manifest-100
// fixture shape (10 colours × 10 animals; PascalCase pseudonym; kebab
// pfp_filename). Used to set up watermark scenarios without touching the
// CSV fixture (the watermark tests don't care about provenance — only
// pool totals and assigned/unassigned counts).
function build100Rows() {
	const rows: Array<{
		colour: string;
		animal: string;
		number: number;
		pseudonym: string;
		pfpFilename: string;
	}> = [];
	for (let colourIdx = 0; colourIdx < 10; colourIdx++) {
		for (let animalIdx = 0; animalIdx < 10; animalIdx++) {
			const colour = COLOURS[colourIdx] ?? "Red";
			const animal = ANIMALS[animalIdx] ?? "Fox";
			const number = colourIdx * 10 + animalIdx;
			const nnn = String(number).padStart(3, "0");
			rows.push({
				colour,
				animal,
				number,
				pseudonym: `${colour}${animal}${nnn}`,
				pfpFilename: `${colour.toLowerCase()}-${animal.toLowerCase()}-${nnn}.webp`,
			});
		}
	}
	return rows;
}

// Insert N rows and mark M of them as assigned (oldest M by created_at).
// Returns nothing; reads happen in the test body.
async function seedPool(total: number, assignedCount: number) {
	const allRows = build100Rows().slice(0, total);
	await testDb.insert(identityPool).values(allRows);
	if (assignedCount > 0) {
		await testClient.unsafe(
			`UPDATE identity_pool SET assigned_at = now() WHERE id IN (
				SELECT id FROM identity_pool ORDER BY created_at ASC LIMIT $1
			)`,
			[assignedCount],
		);
	}
}

async function alarmCount(): Promise<number> {
	const rows = (await testDb.execute(
		sql`SELECT count(*)::int AS c FROM cron_alarms`,
	)) as unknown as Array<{ c: number }>;
	return rows[0]?.c ?? 0;
}

async function readWatermarkState(): Promise<string> {
	const rows = (await testDb.execute(
		sql`SELECT state FROM watermark_state WHERE metric = 'identity_pool_unassigned'`,
	)) as unknown as Array<{ state: string }>;
	return rows[0]?.state ?? "missing";
}

async function runWatermarkCheck() {
	await testDb.execute(sql`SELECT check_identity_pool_watermark()`);
}

describe("check_identity_pool_watermark — pg_cron alarm transition", () => {
	beforeEach(async () => {
		// TRUNCATE bypasses per-row Bucket B triggers; watermark_state +
		// cron_alarms are operational (Bucket C) with no append-only trigger.
		await testClient.unsafe(
			`TRUNCATE identity_pool, watermark_state, cron_alarms CASCADE`,
		);
		// Re-seed the watermark_state row to the migration's initial state.
		// ON CONFLICT DO NOTHING in case TRUNCATE left it behind on some
		// fixtures (PRIMARY KEY metric); safe-idempotent.
		await testClient.unsafe(
			`INSERT INTO watermark_state (metric, state)
			 VALUES ('identity_pool_unassigned', 'above')
			 ON CONFLICT (metric) DO NOTHING`,
		);
	});

	// === Plan §D Test 1 — above threshold, no alarm ========================

	it("does not fire when 6 unassigned > 5% threshold (above state)", async () => {
		await seedPool(100, 94); // 6 unassigned → 6% > 5%, stays above

		await runWatermarkCheck();

		expect(await readWatermarkState()).toBe("above");
		expect(await alarmCount()).toBe(0);
	});

	// === Plan §D Test 2 — transition above → below fires once ==============

	it("fires exactly one alarm on above → below transition (4 unassigned of 100)", async () => {
		await seedPool(100, 96); // 4 unassigned = 4% < 5%, below

		await runWatermarkCheck();

		expect(await readWatermarkState()).toBe("below");
		expect(await alarmCount()).toBe(1);

		const rows = (await testDb.execute(
			sql`SELECT alarm_id, payload FROM cron_alarms ORDER BY id ASC`,
		)) as unknown as Array<{
			alarm_id: string;
			payload: { state: string; unassigned: number; total: number };
		}>;
		expect(rows[0]?.alarm_id).toBe("identity_pool_low_watermark");
		expect(rows[0]?.payload).toMatchObject({
			state: "below",
			unassigned: 4,
			total: 100,
		});
	});

	// === Plan §D Test 3 — repeated tick stays below, no second alarm =======

	it("does not re-fire when state is already below (idempotent re-tick)", async () => {
		// In-test full setup (Flag 1 absorption): drive transition, then
		// re-run the function without mutating the pool. Second invocation
		// MUST be a no-op (transition CTE returns no rows).
		await seedPool(100, 96); // 4 unassigned, below

		await runWatermarkCheck(); // drives above → below + 1 alarm
		await runWatermarkCheck(); // pool unchanged, no new alarm

		expect(await readWatermarkState()).toBe("below");
		expect(await alarmCount()).toBe(1);
	});

	// === Plan §D Test 4 — below → above clears state, no alarm ============

	it("clears state on below → above transition without emitting an alarm", async () => {
		// Step 1: drive into below state (4 unassigned).
		await seedPool(100, 96);
		await runWatermarkCheck();
		expect(await readWatermarkState()).toBe("below");
		expect(await alarmCount()).toBe(1);

		// Step 2: TRUNCATE identity_pool only (preserve watermark_state +
		// cron_alarms to verify continuity); re-seed 100 with 94 assigned →
		// 6 unassigned = 6% > 5%, above.
		await testClient.unsafe(`TRUNCATE identity_pool CASCADE`);
		await seedPool(100, 94);

		// Step 3: invoke; assert state cleared, alarm count UNCHANGED (only
		// below transitions emit per the CTE's `WHERE t.state = 'below'`).
		await runWatermarkCheck();

		expect(await readWatermarkState()).toBe("above");
		expect(await alarmCount()).toBe(1);
	});

	// === Plan §D Test 5 — second episode fires new alarm ===================

	it("fires a new alarm on each fresh below episode (per-episode, not per-tick)", async () => {
		// Full above → below → above → below sequence; each below transition
		// emits exactly one alarm. Per-episode, not per-tick.

		// Episode 1: above → below.
		await seedPool(100, 96);
		await runWatermarkCheck();
		expect(await readWatermarkState()).toBe("below");
		expect(await alarmCount()).toBe(1);

		// Recovery: below → above (no alarm).
		await testClient.unsafe(`TRUNCATE identity_pool CASCADE`);
		await seedPool(100, 94);
		await runWatermarkCheck();
		expect(await readWatermarkState()).toBe("above");
		expect(await alarmCount()).toBe(1);

		// Episode 2: above → below (new alarm).
		await testClient.unsafe(`TRUNCATE identity_pool CASCADE`);
		await seedPool(100, 96);
		await runWatermarkCheck();
		expect(await readWatermarkState()).toBe("below");
		expect(await alarmCount()).toBe(2);
	});

	// === Plan §D Test 6 — schedule registration ============================

	it("registers the 'identity-pool-watermark' cron job exactly once", async () => {
		const rows = (await testDb.execute(
			sql`SELECT jobname FROM cron.job WHERE jobname = 'identity-pool-watermark'`,
		)) as unknown as Array<{ jobname: string }>;
		expect(rows).toHaveLength(1);
		expect(rows[0]?.jobname).toBe("identity-pool-watermark");
	});
});
