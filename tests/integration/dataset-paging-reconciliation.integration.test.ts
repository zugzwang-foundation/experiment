import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { drizzleSource } from "@/server/export/dataset/drizzle-source";
import { EgressContractGapError } from "@/server/export/egress/errors";

import { testClient, testDb } from "../db/_fixtures/db";
import { truncateTables } from "../db/_fixtures/truncate";

/**
 * DATASET.2 review — **the paging loop, and the one guard nothing had ever
 * made fire.**
 *
 * ## What was not covered before this file
 *
 * `drizzle-source.ts` pages every table with a keyset cursor at
 * `PAGE_SIZE = 5000`. Every existing test reads the dirty fixture, whose
 * largest table is **27 rows** — so page 1 always returned fewer rows than the
 * limit and the loop broke immediately. **Nothing below that first `break` had
 * ever executed**: not the cursor assignment, not the `gt(orderColumn, cursor)`
 * predicate, not the second round trip, not the null-cursor throw, and not the
 * `count(*)` reconciliation that follows the loop.
 *
 * The reconciliation is the load-bearing one. `build.ts`'s `assertCountsAgree`
 * compares the writer's count against a re-parse of the emitted CSV, and BOTH
 * derive from the same paged read — so a paging loop that drops rows produces a
 * truncated file whose manifest describes it *accurately*, and every guard in
 * the pipeline reports clean. `drizzle-source.ts` says so in its own docblock
 * and names the mechanism: *"keyset `gt` would silently SKIP a duplicate that
 * landed on a page boundary — and the row-count reconciliation below is what
 * would notice."*
 *
 * ## Why the scenario is constructible at all
 *
 * `events` is the one shipped table whose ORDER_COLUMN is **not unique by
 * constraint**. Its PK is the composite `(event_id, created_at)` — a
 * partitioned table cannot enforce uniqueness on a column outside the partition
 * key — so two rows may share an `event_id` under different `created_at`s.
 * `drizzle-source.ts` states that this holds only *by construction in
 * `events/insert.ts`*, which is a property of the writer, not of the schema.
 *
 * Put the duplicate on the page boundary and the keyset seek steps straight
 * over its twin: page 1 ends on `event_id = X`, page 2 asks for `> X`, and the
 * second row carrying `X` is never returned. 5001 rows in the table, 5000 in
 * the export, no error anywhere except here.
 *
 * ⚠ **Local ephemeral Postgres only** (`DATABASE_URL` → `:54322`).
 */

/** Must equal `PAGE_SIZE` in `src/server/export/dataset/drizzle-source.ts`. */
const PAGE_SIZE = 5_000;

const AGGREGATE_ID = "0192f3a4-cccc-7000-8000-000000000001";
const IN_PARTITION = "2026-10-01T12:00:00.000Z";
const IN_PARTITION_LATER = "2026-10-02T12:00:00.000Z";

/** Deterministic, ascending, byte-ordered event ids. */
function eventId(i: number): string {
	return `0192f3a4-0000-7000-8000-${String(i).padStart(12, "0")}`;
}

/** `n` rows with DISTINCT, ascending `event_id`s. */
async function seedDistinctEvents(n: number): Promise<void> {
	await testClient.unsafe(
		`INSERT INTO events
			(event_id, event_type, aggregate_type, aggregate_id,
			 payload, payload_version, metadata, created_at)
		 SELECT
			('0192f3a4-0000-7000-8000-' || lpad(i::text, 12, '0'))::uuid,
			'market.opened', 'market', $1::uuid,
			'{}'::jsonb, 1, '{}'::jsonb, $2::timestamptz
		 FROM generate_series(1, ${n}) AS i`,
		[AGGREGATE_ID, IN_PARTITION] as never,
	);
}

/**
 * One extra row reusing an existing `event_id` under a different `created_at`.
 *
 * ⚠ Legal against the live schema — that is the whole point. The composite PK
 * `(event_id, created_at)` accepts it, so this is a row the database can hold
 * and the reader can miss.
 */
async function seedDuplicateOf(id: string): Promise<void> {
	await testClient.unsafe(
		`INSERT INTO events
			(event_id, event_type, aggregate_type, aggregate_id,
			 payload, payload_version, metadata, created_at)
		 VALUES ($1::uuid, 'market.opened', 'market', $2::uuid,
			 '{}'::jsonb, 1, '{}'::jsonb, $3::timestamptz)`,
		[id, AGGREGATE_ID, IN_PARTITION_LATER] as never,
	);
}

beforeEach(async () => {
	await truncateTables(testClient, ["events"]);
}, 30_000);

afterAll(async () => {
	await truncateTables(testClient, ["events"]);
}, 30_000);

describe("paging · the second page executes at all", () => {
	it("POSITIVE CONTROL — a read spanning TWO pages returns every row, in order", async () => {
		// ⚠ The control that makes the failure test below mean something. Until
		// this file existed, no test had ever put more than 27 rows through this
		// reader, so `page.length < PAGE_SIZE` broke the loop on the first
		// iteration every time and the keyset cursor was dead code.
		await seedDistinctEvents(PAGE_SIZE + 1);

		const rows = await drizzleSource(testDb, "probe").read("events");

		expect(rows.length).toBe(PAGE_SIZE + 1);
		// It crossed the boundary, and the crossing did not repeat or reorder.
		const ids = rows.map((r) => String(r.event_id));
		expect(new Set(ids).size).toBe(PAGE_SIZE + 1);
		expect(ids).toEqual([...ids].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)));
		expect(ids[PAGE_SIZE - 1]).toBe(eventId(PAGE_SIZE));
		expect(ids[PAGE_SIZE]).toBe(eventId(PAGE_SIZE + 1));
	}, 60_000);
});

describe("paging · a duplicate order key on the page boundary", () => {
	it("the reconciliation FIRES — the export refuses to ship a truncated file", async () => {
		// 5000 distinct ids, then a second row carrying the LARGEST id. Sorted,
		// the tie occupies positions 5000 and 5001 — exactly the boundary.
		await seedDistinctEvents(PAGE_SIZE);
		await seedDuplicateOf(eventId(PAGE_SIZE));

		const read = drizzleSource(testDb, "probe").read("events");

		await expect(read).rejects.toBeInstanceOf(EgressContractGapError);
		await expect(read).rejects.toThrow(
			/paged read returned 5000 row\(s\) but the table holds 5001/,
		);
	}, 60_000);

	it("and the row loss is REAL — the same keyset loop, without the guard, truncates", async () => {
		// ⚠ The mutation proof, run as code. `read()` throwing is only evidence
		// that a comparison failed; this reproduces the paging loop verbatim
		// MINUS the reconciliation and measures what would have shipped.
		//
		// This is what makes the guard load-bearing rather than decorative: with
		// it deleted, the pipeline emits 5000 rows, `assertCountsAgree` compares
		// 5000 against a re-parse of a 5000-row CSV, agrees, and the manifest
		// publishes `row_count: 5000` for a table holding 5001.
		await seedDistinctEvents(PAGE_SIZE);
		await seedDuplicateOf(eventId(PAGE_SIZE));

		const collected: string[] = [];
		let cursor: string | undefined;
		for (;;) {
			const page = cursor
				? await testClient.unsafe(
						`SELECT event_id FROM events WHERE event_id > $1::uuid
						 ORDER BY event_id ASC LIMIT ${PAGE_SIZE}`,
						[cursor] as never,
					)
				: await testClient.unsafe(
						`SELECT event_id FROM events
						 ORDER BY event_id ASC LIMIT ${PAGE_SIZE}`,
					);
			if (page.length === 0) break;
			for (const r of page) collected.push(String(r.event_id));
			if (page.length < PAGE_SIZE) break;
			cursor = collected[collected.length - 1];
		}

		const [countRow] = await testClient`SELECT count(*)::int AS n FROM events`;
		expect(Number(countRow?.n)).toBe(PAGE_SIZE + 1);
		// One row in the table is unreachable by the paged read.
		expect(collected.length).toBe(PAGE_SIZE);
	}, 60_000);

	it("POSITIVE CONTROL — the same 5000 rows WITHOUT the duplicate read clean", async () => {
		// Without this, the failure above is equally consistent with "the reader
		// cannot handle 5000 rows at all" — which is a different defect and
		// would need a different fix.
		await seedDistinctEvents(PAGE_SIZE);

		const rows = await drizzleSource(testDb, "probe").read("events");
		expect(rows.length).toBe(PAGE_SIZE);
	}, 60_000);
});
