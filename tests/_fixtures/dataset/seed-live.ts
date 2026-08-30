import type postgres from "postgres";

import { DIRTY_TABLE_ROWS } from "./dirty-source";

/**
 * DATASET.2 Slice 5 — seed the dirty fixture into a REAL Postgres.
 *
 * The round-trip equivalence test needs the same rows on both sides: once
 * in memory, once through the live `drizzleSource`. This puts them in the
 * database.
 *
 * ## Fixture-bypass, deliberately (SPEC.2 §6.6)
 *
 * Rows go in by raw `INSERT`, not through `place()` / `moderateComment()` /
 * the engine. That is the opposite of the staging generator's rule
 * (ADR-0036: *"never mocked — anything that writes a row drives the engine"*)
 * and the difference is what each is FOR.
 *
 * The staging generator asks *"does the engine produce a realistic corpus?"*,
 * so it must drive the engine. This asks *"does the READER hand the transform
 * the same bytes the fixture did?"* — and to answer that, the two sides have
 * to start from **identical** rows. Driving the engine would compute its own
 * stakes, prices, timestamps and ids, and the comparison would then be
 * measuring the engine rather than the reader. The literal table is the
 * control.
 *
 * ⚠ **Local ephemeral Postgres only.** Every caller is a `tests/integration/`
 * file running against `DATABASE_URL` (`localhost:54322`), which the default
 * vitest config points at and which `tests/staging/**` is excluded from
 * reaching. Nothing here may ever be aimed at staging or production — brief
 * §5 wall 1.
 */

/**
 * Insertion order. FK-respecting, and hand-written rather than derived.
 *
 * ⚠ **`comments` MUST precede `bets`, and that ordering is forced by the
 * schema rather than chosen.** `bets.comment_id` is `NOT NULL` and references
 * `comments.id` (the built half of INV-1), while `comments.bet_id` is
 * nullable and references `bets.id` — a circular pair, and **neither FK is
 * DEFERRABLE** (`0001_initial_schema.sql`: both are plain
 * `ON DELETE restrict ON UPDATE no action`).
 *
 * So there is exactly one insertable order, and it is the one the W-1
 * transaction itself uses: comment first with `bet_id` NULL, then the bet
 * carrying `comment_id`. See `seedDatasetFixture` for what that means for the
 * fixture's own `bet_id` value.
 */
const INSERT_ORDER = [
	"users",
	"identity_pool",
	"markets",
	"pools",
	"market_media",
	"image_uploads",
	"comments",
	"bets",
	"positions",
	"dharma_ledger",
	"resolution_events",
	"payout_events",
	"mod_actions",
	"events",
	"admin_events",
	"user_events",
] as const;

/**
 * Tables cleared before seeding.
 *
 * Ordered children-first even though every statement is `CASCADE`, so that a
 * reader can see the dependency direction rather than trusting the cascade.
 */
export const DATASET_FIXTURE_TABLES: readonly string[] = [
	"events",
	"admin_events",
	"user_events",
	"mod_actions",
	"payout_events",
	"resolution_events",
	"dharma_ledger",
	"positions",
	"lots",
	"bet_receipts",
	"bookmarks",
	"bets",
	"comments",
	"image_uploads",
	"market_media",
	"pools",
	"markets",
	"identity_pool",
	"users",
];

/**
 * Tables needing `OVERRIDING SYSTEM VALUE` to accept a fixture-supplied value.
 *
 * ⚠ **`dharma_ledger.seq` is `GENERATED ALWAYS AS IDENTITY`** (measured:
 * `information_schema.columns.identity_generation = 'ALWAYS'`) — the ADR-0029
 * total-order column. A plain INSERT carrying `seq` fails with *"cannot insert
 * a non-DEFAULT value into column seq"*.
 *
 * Overriding is the right answer here rather than letting Postgres assign it,
 * and the reason is determinism rather than convenience: **`seq` SHIPS**
 * (Appendix B.7). `truncateTables` issues a plain `TRUNCATE … CASCADE` with no
 * `RESTART IDENTITY`, so the sequence keeps climbing across runs — the value
 * would be 1 on a fresh database, 2 on the next run, and the round-trip's
 * byte comparison would fail on the second execution for a reason that has
 * nothing to do with the reader. **A test that passes only the first time is
 * worse than one that fails**, because the failure arrives later and looks
 * like a regression in whatever changed most recently.
 *
 * SPEC.2 §6.6 sanctions exactly this: fixtures bypass application-layer
 * protection so that the thing under test is the only thing under test.
 */
const OVERRIDING: Readonly<Record<string, string>> = {
	dharma_ledger: "OVERRIDING SYSTEM VALUE ",
};

/**
 * The `jsonb` columns of one table, read from the live catalogue.
 *
 * ⚠ Queried rather than hardcoded to `payload`/`metadata`/`categories`. A
 * hardcoded list is a second declaration of the schema, and it goes stale
 * silently — the failure mode being precisely the one this function exists to
 * fix, where a jsonb column stored as a string scalar still round-trips
 * through two cancelling parses and looks correct.
 *
 * Cached per table: this runs inside the per-row insert loop.
 */
const jsonbColumnCache = new Map<string, ReadonlySet<string>>();

async function jsonbColumns(
	client: postgres.Sql,
	table: string,
): Promise<ReadonlySet<string>> {
	const hit = jsonbColumnCache.get(table);
	if (hit !== undefined) return hit;

	const rows = await client.unsafe(
		`SELECT column_name FROM information_schema.columns
		 WHERE table_schema = 'public' AND table_name = $1 AND data_type = 'jsonb'`,
		[table] as never,
	);
	const set = new Set(rows.map((r) => String(r.column_name)));
	jsonbColumnCache.set(table, set);
	return set;
}

function bind(value: unknown): unknown {
	// ⚠ **Objects pass through UNCHANGED. Do not `JSON.stringify` here.**
	//
	// This function used to stringify them, which was the `@code-reviewer`
	// CRITICAL: combined with the `$N::jsonb` cast, postgres-js infers the
	// parameter's type FROM the cast, looks up its jsonb serializer, and
	// applies `JSON.stringify` itself — so a pre-stringified object was
	// encoded TWICE and landed as a jsonb **string scalar**
	// (`jsonb_typeof = 'string'`), not an object.
	//
	// Measured across three states, which is the only way this was pinned
	// down — the first fix attempt (adding the cast, keeping the stringify)
	// changed nothing at all:
	//
	//   stringify + no cast → jsonb_typeof = 'string'   ✗
	//   stringify + ::jsonb → jsonb_typeof = 'string'   ✗  (the cast alone
	//                                                       is not the fix)
	//   raw object + ::jsonb → jsonb_typeof = 'object'  ✓
	//
	// `NUMERIC(38,18)` values are strings and stay strings: a `Number()`
	// anywhere on this path would truncate an 18-decimal balance to float
	// precision and the CSV would still look completely normal
	// (CLAUDE.md §2).
	return value;
}

/**
 * Truncate the fixture tables, honouring the Bucket-A/B TRUNCATE guards.
 *
 * Reuses the same owner-privilege disable → TRUNCATE → re-enable dance as
 * `tests/db/_fixtures/truncate.ts`, via that module, rather than re-deriving
 * the guard list — a second copy of that list is a second thing to drift.
 */
export async function resetDatasetFixture(
	client: postgres.Sql,
	truncateTables: (c: postgres.Sql, tables: readonly string[]) => Promise<void>,
): Promise<void> {
	await truncateTables(client, DATASET_FIXTURE_TABLES);
}

/**
 * Insert every dirty-fixture row into the live schema.
 *
 * Returns the rows AS SEEDED — which is not always the rows the fixture
 * declares, and the difference is reported rather than hidden. See
 * `SEEDED_DIVERGENCES`.
 */
export async function seedDatasetFixture(
	client: postgres.Sql,
): Promise<Record<string, readonly Record<string, unknown>[]>> {
	const seeded: Record<string, readonly Record<string, unknown>[]> = {};

	for (const table of INSERT_ORDER) {
		const rows = (
			DIRTY_TABLE_ROWS as unknown as Record<
				string,
				readonly Record<string, unknown>[]
			>
		)[table];
		if (rows === undefined || rows.length === 0) {
			seeded[table] = [];
			continue;
		}

		// ⚠ **Inserted in REVERSE fixture order, deliberately.**
		//
		// The fixture is sorted into the live reader's `ORDER BY id`. Seeding it
		// in that same order makes the table's PHYSICAL order identical to its
		// id order — and then a sequential scan with **no `ORDER BY` at all**
		// returns exactly the right answer, so the round-trip's byte comparison
		// passes against a reader that does not order anything.
		//
		// Measured, not theorised: mutating `drizzle-source.ts` to drop its
		// `.orderBy(asc(...))` left all 18 round-trip tests GREEN. The test
		// claimed in its own docblock to catch non-deterministic ordering and
		// did not. Reversing the insert makes physical order disagree with id
		// order, so an unordered read returns rows in the wrong sequence and
		// the comparison fails — which is what that claim requires.
		//
		// It is also the more realistic state: a live table's physical order is
		// whatever inserts, updates and vacuum left behind, never the PK's.
		const adjusted = rows
			.map((r) => adjustForLiveSchema(table, r))
			.slice()
			.reverse();

		for (const row of adjusted) {
			const cols = Object.keys(row);
			// ⚠ **`::jsonb` on every jsonb column — this is the fix for the
			// `@code-reviewer` CRITICAL.**
			//
			// Without the cast, a `JSON.stringify`'d object arrives as an
			// unspecified-type parameter and Postgres stores it as a **jsonb
			// STRING SCALAR** — `jsonb_typeof` = `'string'`, the whole object
			// escaped inside one JSON string — not as a jsonb object. Measured
			// on all 27 seeded `events` rows and both `mod_actions` rows before
			// the fix.
			//
			// It was invisible because two errors cancelled: postgres-js parses
			// the wire text back into a JS *string*, and drizzle's
			// `PgJsonb.mapFromDriverValue` sees a string and parses a SECOND
			// time — recovering an object with the FIXTURE's key order. So the
			// round-trip's byte comparison passed, on a row shape production
			// never writes, for the exact columns carrying the §19.4.1 payload
			// strips and the §19.5 metadata pseudonymization.
			//
			// The cast mirrors what production does verbatim:
			// `src/server/events/insert.ts:164` writes
			// `${JSON.stringify(payloadResult.data)}::jsonb`.
			const jsonbCols = await jsonbColumns(client, table);
			const placeholders = cols
				.map((c, i) => (jsonbCols.has(c) ? `$${i + 1}::jsonb` : `$${i + 1}`))
				.join(", ");
			const quoted = cols.map((c) => `"${c}"`).join(", ");
			await client.unsafe(
				`INSERT INTO "${table}" (${quoted}) ${OVERRIDING[table] ?? ""}VALUES (${placeholders})`,
				cols.map((c) => bind(row[c])) as never,
			);
		}
		seeded[table] = adjusted;
	}

	return seeded;
}

/**
 * Divergences between the in-memory fixture and what the live schema can hold.
 *
 * ⚠ **This list existing at all is the finding.** A fixture that models a
 * state the schema forbids cannot be round-tripped, and until something tried
 * to put it in a database, nothing could tell.
 */
export const SEEDED_DIVERGENCES = [
	{
		table: "users",
		column: "name, email",
		fixture: "NULL on the H2-erased row",
		live: "an erasure placeholder — the columns are NOT NULL",
		shipsInDataset: false,
		why:
			"⚠ **SPEC.2 §19.4 describes an H2 erasure the schema cannot hold.** " +
			"Its H2 note says erasure *'scrubs `users` PII columns'* and that " +
			"*'H2-erased rows ship in the same shape as not-erased rows — both " +
			"have NULL email, NULL google_id'*, and calls the resulting " +
			"indistinguishability *'the privacy-by-design property'*. Measured " +
			"against the live table: `name` is **NOT NULL** and `email` is **NOT " +
			"NULL and UNIQUE**. Only `image`, `google_id` and `pfp_filename` are " +
			"nullable. So the NULLs that property rests on cannot be written, and " +
			"a real H2 erasure must substitute a placeholder rather than NULL — " +
			"which is a decision nobody has recorded. " +
			"**Bounded, and the bound is worth stating precisely: this does NOT " +
			"change a single byte of the dataset.** `name`, `email` and " +
			"`google_id` are all STRIP (Appendix B.1) and never reach a CSV, so " +
			"whichever value sits in them is removed before export. What is " +
			"affected is the erasure mechanism itself, not this pipeline — which " +
			"is why it is reported here and not fixed here.",
	},
] as const;

/**
 * Apply the live schema's constraints to a fixture row.
 *
 * ⚠ Kept as an explicit, documented transform rather than by quietly editing
 * the fixture, because the fixture's value is not simply *wrong*: `bet_id` is
 * a real column that Appendix B.6 ships, and a reader of the fixture should
 * see it exercised. What is wrong is that the value is unreachable in the
 * database, and that fact belongs where someone looking for it will find it.
 */
function adjustForLiveSchema(
	table: string,
	row: Record<string, unknown>,
): Record<string, unknown> {
	// ⚠ `comments.bet_id` WAS adjusted here. It no longer needs to be: the
	// fixture itself now carries NULL, because that is the only value the
	// circular non-deferrable FK pair permits. The fix moved from the seeder
	// to the fixture deliberately — an adjustment here would have let the
	// fixture keep asserting an impossible row while the database quietly
	// disagreed, which is the state that made this discoverable only by
	// trying to insert it.

	// See SEEDED_DIVERGENCES[0]. `name` and `email` are NOT NULL, so an
	// H2-erased row must carry SOMETHING. The placeholder is derived from the
	// row's own id so it is unique (`email` is UNIQUE) and obviously not a
	// real address — `.invalid` is RFC 2606 reserved and can never resolve.
	//
	// ⚠ Applied at SEED time rather than by editing the fixture, deliberately.
	// The fixture models what §19.4 SAYS H2 erasure produces, and that claim is
	// worth keeping visible; this records that the database disagrees. Both
	// builds emit identical bytes regardless, because these columns are STRIP.
	if (table === "users" && row.name === null) {
		const id = String(row.id);
		return {
			...row,
			name: "[erased]",
			email: `erased-${id}@erased.invalid`,
		};
	}

	return row;
}
