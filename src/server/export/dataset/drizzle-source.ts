import type { SQL } from "drizzle-orm";
import { asc, getTableColumns, getTableName, gt, is, sql } from "drizzle-orm";
import type {
	PgColumn,
	PgDatabase,
	PgQueryResultHKT,
	PgTable,
} from "drizzle-orm/pg-core";
import { PgTable as PgTableClass } from "drizzle-orm/pg-core";

import * as schema from "@/db/schema";
import { EgressContractGapError } from "@/server/export/egress/errors";

import { TABLE_INVENTORY } from "./inventory";
import type { DatasetSource } from "./source";
import type { SourceRow } from "./strip";

/**
 * DATASET.2 Slice 4 — the LIVE `DatasetSource`.
 *
 * The drizzle reader behind the seam DATASET.1 built. Until now there was
 * exactly one implementation — the deliberately dirty in-memory fixture — and
 * the pipeline could be exercised end to end without a database. This is the
 * other half.
 *
 * ## Why the client is INJECTED and this file has no `server-only`
 *
 * Every other DB-touching module under `src/server/**` imports `server-only`
 * (AGENTS.md §7). This one takes a drizzle handle as an argument and imports
 * neither `server-only` nor `@/db`, and that is deliberate rather than an
 * oversight:
 *
 *   · **The build script runs under `tsx`.** AGENTS.md §7 states plainly that
 *     a `tsx` script must not delegate into the `@/db` → `server-only` chain —
 *     the package's `default` export condition is a bare `throw`, so the
 *     script dies on the import before a line of it runs. `build-dataset.ts`
 *     is that script. A `server-only` import here would make the release
 *     pipeline unrunnable by the only thing that runs it.
 *   · **Injection is what keeps the seam honest.** The fixture path and the
 *     live path have to be the same code downstream, or the twelve
 *     mutation-verified guards prove something about a pipeline nobody ships.
 *     A module that reaches for a singleton connection cannot be handed a test
 *     database without a mock, and a mocked database is not a database.
 *
 * ⚠ `@code-reviewer` M-14 declined `server-only` for the other export modules
 * on the grounds that they *"touch neither the DB nor secrets"*. That
 * reasoning does not extend to this file, which touches the DB — so the
 * justification above is a different one, and it is stated rather than
 * inherited.
 *
 * ## Read-only, and nothing is held open
 *
 * No `insert`, `update` or `delete` appears here.
 *
 * ⚠ **`transaction` DOES appear here as of DATASET.3 (ruling B), and this
 * sentence used to say it did not.** `withDatasetSnapshot` at the foot of the
 * file opens one — `REPEATABLE READ`, `READ ONLY` — so that the sixteen table
 * reads and their counts see ONE instant instead of sixteen. The read-only
 * guarantee is no longer "there is no write verb in this file", which was an
 * absence anyone could add to; it is `READ ONLY` declared to the server, which
 * rejects a write rather than relying on nobody writing one.
 *
 * Corrected in place rather than annotated, because a docblock describing the
 * file it used to be is worse than none: it is what the next reader trusts
 * instead of reading.
 *
 * ⛔⛔ **THE JUSTIFICATION THAT USED TO SIT HERE WAS FALSE, AND IT WAS THE
 * LOAD-BEARING SENTENCE.** It read: *"the release runs after the 2026-11-05
 * write freeze (§19.1), so there is no concurrent writer to be isolated
 * from"*. **Measured at DATASET.2 — there is one**, and DATASET.3 stopped
 * depending on the answer:
 *
 * | cron | schedule | `isFrozen()` gate | writes a SHIPPED table |
 * |---|---|---|---|
 * | `close-due-markets` | every minute | **yes** | — |
 * | `alarms-drain` | every 5 minutes | no | no (`cron_alarms`, not shipped) |
 * | **`r2-orphan-sweep`** | **every 6 hours** | **NO** | **`events` INSERT + `image_uploads` UPDATE** |
 *
 * (Schedules in words rather than cron syntax on purpose: the literal
 * `vercel.json` value for the sweep contains the two characters that end a
 * block comment, and pasting it here silently truncated this docblock
 * mid-table — caught by `tsc`, but only because the wreckage happened to be
 * un-parseable.)
 *
 * `sweep-orphans.ts` appends `image_upload.orphaned` to `events` and CASes the
 * Bucket-B whitelisted `image_uploads.terminal_state` transition — both legal
 * post-freeze at the storage layer. `isFrozen()` is wired onto two surfaces
 * and this is not one of them, and `is-frozen-surface.test.ts` pins that as
 * intended, so the exclusion is structural rather than an oversight.
 *
 * ⚠ **This pipeline already knew.** `build.ts`'s `NON_SECRET_SENTINELS` names
 * *"the orphan sweep writes `ip: "cron"` / `user_agent: "vercel-cron"`"* as a
 * live emit site it must exempt. Two files on one branch held contradictory
 * beliefs about whether that writer stops (`@security-auditor` F-11).
 *
 * **What that costs, concretely.** The sweep fires at 00:00/06:00/12:00/18:00
 * UTC and commits one row:
 *
 *   · **after the last page, before `count(*)`** → the reconciliation below
 *     fires and **aborts the entire one-shot build**, with a message naming a
 *     paging bug and pointing the operator at the wrong subsystem. (Before the
 *     reconciliation existed the same event was simply invisible.)
 *   · **mid-read** → the row sorts after the cursor, is picked up, counts
 *     agree, and the archive silently ships a fact that postdates the freeze.
 *   · **between two table reads** → `image_uploads.csv` ships
 *     `terminal_state = NULL` for a row `events.csv` reports as orphaned. A
 *     self-contradicting archive that no guard notices, because each file is
 *     internally consistent.
 *
 * ## ✅ FIXED at DATASET.3, ruling B — `withDatasetSnapshot`
 *
 * The middle option is now built: `withDatasetSnapshot` wraps the whole build
 * — all sixteen reads AND their `count(*)` reconciliations — in ONE
 * `REPEATABLE READ`, `READ ONLY` transaction, so every table is read at one
 * instant. All three failure modes above close together, and they close
 * because they were all the same failure: sixteen independent snapshots.
 *
 * ⚠ **It holds regardless of the cron ruling, which is why it could be built
 * without one.** Freeze-gating `r2-orphan-sweep` remains a founder call and a
 * separate task (S4); a snapshot is correct whether or not the sweep stops,
 * and it is correct against any future writer nobody has thought of yet. That
 * is the difference between fixing the instance and fixing the class — the
 * same distinction ruling E draws one file over.
 *
 * ⚠ The connection-hold trade-off is re-decided rather than inherited. The
 * original reasoning against a transaction was that it would hold one
 * connection and one snapshot open across sixteen reads of a multi-million-row
 * `events`. That cost is real and it is the correct price: the alternative is
 * an archive whose sixteen files describe sixteen different instants, and
 * §19.1's promise to rebuild a v2 "against the same source state" has no
 * meaning if the first build had no single source state either.
 *
 * `READ ONLY` is belt-and-braces on a module with no write verb in it — but it
 * is the belt that a future caller inherits without having to read this file.
 */

/**
 * The drizzle handle this reader is given.
 *
 * ⚠ **This was a hand-rolled structural interface, and no real drizzle client
 * could satisfy it** (`@code-reviewer` HIGH-4, measured with `tsc`): its
 * `where(cond: unknown)` and `orderBy(...cols: unknown[])` are contravariant
 * under `strictFunctionTypes`, so `const d: DatasetDb = testDb` was a type
 * error and every call site reached for `as unknown as DatasetDb` — the double
 * cast AGENTS.md §11 lists under **Never**, which erases the check entirely.
 * A type that is only ever satisfied by casting past it verifies nothing, and
 * a drizzle signature change would have surfaced for the first time on the
 * one-shot release run.
 *
 * `PgDatabase` is drizzle's own base class, which both the postgres-js and
 * node-postgres handles extend, so the app singleton, a script's own client
 * and a test client are all assignable **without a cast**.
 *
 * The lost property is worth naming: the old shape claimed to state "this
 * module can only SELECT". It never did — the casts saw to that — and the
 * real guarantee is the one the reviewer verified by reading the file: there
 * is no `insert`, `update`, `delete` or `transaction` anywhere in it.
 */
export type DatasetDb = PgDatabase<PgQueryResultHKT, Record<string, unknown>>;

/**
 * Column each table is ordered and paged by.
 *
 * ⚠ **Determinism is a correctness property here, not a nicety.** Postgres is
 * free to return rows in any order absent an `ORDER BY`, and the release
 * manifest publishes a `content_sha256` over the emitted bytes — so an
 * unordered read makes the archive's checksum a function of the planner's mood
 * and destroys §19.1's ability to rebuild a v2 "against the same source
 * state". Every table is explicitly ordered.
 *
 * All sixteen shipped tables carry `id` except `events`, whose PK is the
 * composite `(event_id, created_at)` — it is the hand-partitioned table
 * (AGENTS.md §6). ⚠ `event_id` alone is unique **by construction in
 * `events/insert.ts`, not by constraint** — the only unique index on each
 * partition is `(event_id, created_at)`, because a partitioned table cannot
 * enforce uniqueness on a column outside the partition key, and `insert.ts`'s
 * `ON CONFLICT (event_id, created_at) DO NOTHING` would accept the same
 * `event_id` under a different `created_at`. It holds because `created_at` is
 * derived from the UUIDv7's own timestamp. Stated rather than assumed
 * (`@code-reviewer` MEDIUM-7), because keyset `gt` would silently SKIP a
 * duplicate that landed on a page boundary — and the row-count reconciliation
 * below is what would notice.
 *
 * Written out per table rather than introspected from the PK, because the
 * value is auditable against §19.3 by reading it, and because a table whose
 * ordering nobody chose is exactly the row that would page wrongly.
 */
const ORDER_COLUMN: Readonly<Record<string, string>> = {
	events: "event_id",
	dharma_ledger: "id",
	bets: "id",
	comments: "id",
	resolution_events: "id",
	payout_events: "id",
	mod_actions: "id",
	admin_events: "id",
	user_events: "id",
	identity_pool: "id",
	image_uploads: "id",
	markets: "id",
	pools: "id",
	positions: "id",
	users: "id",
	market_media: "id",
};

/**
 * Rows fetched per round trip.
 *
 * ⚠ **This bounds the QUERY, not the export.** See `read`'s note — the seam
 * returns an array, so the whole table lands in memory either way. What paging
 * buys is that no single statement has to build a multi-million-row result set
 * inside the driver, which is where a statement timeout or an OOM would
 * actually land first.
 */
const PAGE_SIZE = 5_000;

/** Live `pgTable` by its DB name, built once from the schema barrel. */
function tablesByName(): ReadonlyMap<string, PgTable> {
	const map = new Map<string, PgTable>();
	for (const value of Object.values(schema)) {
		// ⚠ `is(value, PgTable)` — the SAME predicate `inventory.ts:271` and
		// `treatments.ts:276` use, so the three cannot disagree about what
		// counts as a table. This claim used to sit above a hand-rolled
		// `Symbol.for("drizzle:Name") in value` test (`@code-reviewer` LOW):
		// the two agree today (24 tables either way, measured), so it was
		// documentation drift rather than a defect — but a comment that names
		// a shared predicate should name one that is actually shared.
		if (is(value, PgTableClass)) {
			map.set(getTableName(value), value);
		}
	}
	return map;
}

/**
 * A `DatasetSource` backed by the live Postgres schema.
 *
 * @param db     an injected drizzle handle — see the file docblock
 * @param label  what is being read, verbatim into the manifest's `source`
 */
export function drizzleSource(db: DatasetDb, label: string): DatasetSource {
	const tables = tablesByName();

	return {
		label,

		/**
		 * All rows of one table, in a deterministic order.
		 *
		 * ## An unshipped table is never QUERIED, not queried-and-discarded
		 *
		 * ⚠ The brief's wording is exact and the distinction is the point: a
		 * reader that reads `sessions` and then drops it has still pulled every
		 * session token of every participant into the export process's memory,
		 * into the driver's buffers, and into whatever the process later writes
		 * on a crash. **The strongest guarantee available is that the query is
		 * never issued**, and it is enforced here by throwing rather than by
		 * the caller remembering to ask only for the right tables.
		 *
		 * `UNDECIDED` throws for the same reason `inventory.ts` refuses to
		 * bucket `lots`: reading it would be indistinguishable from having
		 * decided it ships.
		 */
		async read(table: string): Promise<readonly SourceRow[]> {
			const entry = (
				TABLE_INVENTORY as Record<string, { status: string } | undefined>
			)[table];

			if (entry === undefined) {
				throw new EgressContractGapError(
					`table: ${table}`,
					"is not in the §19.3 inventory. Refusing to read a table nobody " +
						"has classified — silence is the defect the inventory guard " +
						"exists to catch, and reading first would settle it by accident.",
				);
			}
			if (entry.status !== "SHIPPED") {
				throw new EgressContractGapError(
					`table: ${table}`,
					`is classified ${entry.status}, not SHIPPED. The read is refused ` +
						"rather than performed-and-discarded: a withheld table's rows " +
						"must never enter this process at all.",
				);
			}

			const pgTable = tables.get(table);
			if (pgTable === undefined) {
				throw new EgressContractGapError(
					`table: ${table}`,
					"is SHIPPED per §19.3 but is not exported from `@/db/schema`. " +
						"The inventory and the schema disagree; refusing to guess which.",
				);
			}

			const columns = getTableColumns(pgTable);
			const orderName = ORDER_COLUMN[table];
			if (orderName === undefined) {
				throw new EgressContractGapError(
					`table: ${table}`,
					"has no declared ORDER_COLUMN. An unordered read makes the " +
						"archive's published checksum depend on the query planner.",
				);
			}

			// ⚠ Project by the DB column NAME, not drizzle's TS property name.
			// `getTableColumns` returns `{ camelCaseTsName: PgColumn }` and a
			// bare `.select().from()` would hand back rows keyed the same way —
			// `userId`, `createdAt`. Every downstream consumer (Appendix B's
			// treatment maps, the strip's column lookups, the CSV header, the
			// fixture) speaks the DB's `snake_case`. Renaming here, once, at the
			// boundary, is what makes the live path and the fixture path
			// interchangeable behind the seam; doing it anywhere later would
			// mean two vocabularies inside the pipeline.
			const projection: Record<string, PgColumn | SQL<string | null>> = {};
			let orderColumn: PgColumn | undefined;
			for (const col of Object.values(columns)) {
				// ⚠ **TIMESTAMPS ARE READ AS TEXT — ruling S6, DATASET.3.**
				//
				// `timestamp({ withTimezone: true })` comes back from
				// postgres-js as a JS `Date`, and a JS `Date` holds
				// MILLISECONDS. Postgres stores MICROSECONDS. So
				// `12:00:00.123456+00` arrived here as `12:00:00.123`, and
				// `escapeField`'s `toISOString()` then wrote three digits —
				// 456 µs discarded, permanently, on an artifact that cannot be
				// re-issued. Two events 200 µs apart export as the same
				// instant, which is exactly the resolution an event-ordering
				// question needs.
				//
				// ⚠ **The precision is gone before `escapeField` ever sees the
				// value**, so this could not be fixed downstream: the driver
				// parsed it away. `to_char` is what keeps it, and it keeps the
				// emitted FORMAT identical too — same ISO-8601 `…Z` shape, six
				// fractional digits instead of three — so the change is a
				// widening rather than a new format for a reader to handle.
				//
				// ⚠ And it was UNTESTABLE until the fixture was widened. Every
				// `created_at` in the dirty fixture was `…T12:00:00.000Z`, so a
				// truncating reader and a faithful one produced identical bytes
				// and the round-trip comparison was blind BY CONSTRUCTION.
				// Widening the fixture to `.123456Z` — before touching this
				// file — turned the existing byte comparison red, which is the
				// measurement that made this fix a fix rather than a claim.
				// ⚠ **`=== "timestamp with time zone"`, not `startsWith`**
				// (`@code-reviewer` M-2). `startsWith("timestamp")` also matches
				// a NAIVE `timestamp`, and `AT TIME ZONE 'UTC'` means the
				// opposite thing for the two: on a `timestamptz` it converts an
				// instant to UTC (correct, session-independent); on a naive
				// `timestamp` it REINTERPRETS the wall-clock as UTC and shifts
				// it. Measured — a naive column holding 12:00 IST emitted
				// `17:30:00.123456Z`, a different instant, still wearing a `Z`.
				//
				// Every one of the 43 timestamp columns in the schema is
				// `withTimezone: true` today, so this is latent. It stays a
				// throw rather than a silent fallback because the seeder guards
				// the NARROWER set (`data_type = 'timestamp with time zone'`),
				// so a future naive column would be bind-bound by the fixture
				// AND mis-rendered by the reader — invisible to the round-trip
				// byte comparison in both directions at once.
				// ⚠ An explicit precision renders as `timestamp (6) with time
				// zone`, which is still a timestamptz and still correct for the
				// UTC cast — the first version of this check threw on it with a
				// message saying the cast *"would shift the value"*, which is
				// not true of it (F-11 re-run, LOW). Match on the `with time
				// zone` SUFFIX, which is the property that actually decides.
				const sqlType = col.getSQLType();
				const isTz = sqlType.endsWith("with time zone");
				if (sqlType.startsWith("timestamp") && !isTz) {
					throw new EgressContractGapError(
						`${table}.${col.name}`,
						`is \`${sqlType}\`, not \`timestamp with time zone\`. The ` +
							"reader's UTC cast is only correct for an instant; on a naive " +
							"timestamp it would shift the value and still label it Z.",
					);
				}
				projection[col.name] =
					sqlType === "timestamp with time zone"
						? sql<
								string | null
							>`to_char(${col} AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`
						: col;
				if (col.name === orderName) orderColumn = col;
			}
			if (orderColumn === undefined) {
				throw new EgressContractGapError(
					`table: ${table}`,
					`declares ORDER_COLUMN '${orderName}', which is not a column of ` +
						"the live table.",
				);
			}

			// ⚠ KEYSET paging, never OFFSET. `OFFSET n` makes Postgres walk and
			// discard n rows per page, so reading a 2M-row `events` in 5k pages
			// costs ~400 scans of an average 1M rows — quadratic, on the one
			// job that gets a single attempt on a conference morning. Keyset
			// paging seeks straight to the last key read.
			//
			// It is also what makes the page boundary safe: `OFFSET` over an
			// unstable ordering can repeat or skip a row between pages, and
			// there is no signal when it does.
			const out: SourceRow[] = [];
			let cursor: unknown;

			for (;;) {
				const query =
					cursor === undefined
						? db.select(projection).from(pgTable).orderBy(asc(orderColumn))
						: db
								.select(projection)
								.from(pgTable)
								.where(gt(orderColumn, cursor))
								.orderBy(asc(orderColumn));

				const page = await query.limit(PAGE_SIZE);
				if (page.length === 0) break;

				for (const row of page) out.push(row as SourceRow);
				if (page.length < PAGE_SIZE) break;

				cursor = page[page.length - 1]?.[orderName];
				// ⚠ `null` as well as `undefined` (`@code-reviewer` MEDIUM-6).
				// The check was `=== undefined` while the comment below said
				// "null/absent" — and a `null` slipping through does NOT loop
				// forever, which would at least be visible. It issues
				// `col > NULL` → NULL → zero rows → `break`, ending the export
				// EARLY with no error and no signal, losing exactly the
				// NULL-keyed tail that `ASC` sorts last. A guard whose one
				// stated purpose is the case it does not cover.
				if (cursor === undefined || cursor === null) {
					// The order column came back null/absent — paging cannot
					// advance and would loop forever on the same page. Fail
					// rather than spin: an infinite loop in a guard-bearing
					// pipeline fails OPEN (someone kills it and ships the
					// previous artifact), which is the worst available outcome.
					throw new EgressContractGapError(
						`table: ${table}`,
						`ORDER_COLUMN '${orderName}' was null or absent on a row; ` +
							"keyset paging cannot advance past it.",
					);
				}
			}

			// ⚠ **Reconcile against the table, not against ourselves**
			// (`@code-reviewer` HIGH-5).
			//
			// `build.ts`'s `assertCountsAgree` compares the writer's count
			// against a re-parse of the emitted CSV — but BOTH derive from this
			// same read. If the paging loop drops rows (a null cursor, a
			// duplicate order key, a mis-pruned partition), `rowCount` and
			// `verifiedRowCount` still agree, the manifest publishes a number
			// that faithfully describes a TRUNCATED file, and every guard
			// reports clean. `build.ts` names "row counts computed from a
			// different read than the one that wrote the files" as the wrong
			// answer; for a PAGED reader the right answer needs a count that
			// did not come from the paging loop at all.
			//
			// One extra query per table, on a job that gets one attempt.
			const [countRow] = await db
				.select({ n: sql<number>`count(*)::int` })
				.from(pgTable);
			const actual = Number(countRow?.n ?? -1);
			if (actual !== out.length) {
				throw new EgressContractGapError(
					`table: ${table}`,
					`paged read returned ${out.length} row(s) but the table holds ` +
						`${actual}. The export would ship a truncated file whose ` +
						"manifest row count describes it accurately — refusing.",
				);
			}

			return out;
		},
	};
}

/**
 * ## What this does NOT do, stated rather than implied
 *
 * **It pages the query; it does not stream the export.** `DatasetSource.read`
 * returns `Promise<readonly SourceRow[]>`, so every row of a table is
 * materialised in this process regardless of how many round trips fetched it —
 * and the pipeline downstream materialises again, twice: `stripTable` and
 * `pseudonymizeTable` each `map` the whole array, and `toCsv` joins the whole
 * file into one string before it is written.
 *
 * So paging buys three real things and one it does not:
 *
 *   ✅ no single statement builds a multi-million-row result set in the driver
 *   ✅ no statement timeout on one enormous query
 *   ✅ deterministic, seek-based traversal with no quadratic OFFSET cost
 *   ❌ it does **not** bound total memory for the export
 *
 * Making the export itself streaming means changing the seam to an
 * `AsyncIterable<SourceRow>` and pushing that shape through `stripTable`,
 * `pseudonymizeTable`, `toCsv` and the egress guards — the guards being the
 * awkward part, since `assertTableClean` scans a whole table's rows and the
 * row-count gate re-parses the emitted file. That is a real piece of work and
 * it is **not** attempted here, because a half-streamed pipeline has the
 * memory profile of a fully materialised one and the complexity of neither.
 *
 * ⚠ **Whether it is needed is a measurement nobody has taken.** The experiment
 * runs 15 Sep – 5 Nov 2026; `events` at 100k users is the only table plausibly
 * large enough to matter, and its real row count on 6 November is not known
 * today. The honest position is that this reader is correct at any size and
 * memory-bounded at none, and that the check belongs in the release rehearsal
 * rather than in a guess made tonight.
 */

/**
 * Run `fn` inside ONE `REPEATABLE READ`, `READ ONLY` transaction — ruling B,
 * DATASET.3.
 *
 * ## Why the release build needs a snapshot at all
 *
 * The reasoning that used to sit in this file's header was that the release
 * runs after the 2026-11-05 write freeze, so there is no concurrent writer to
 * isolate from. **That is false**, and it was false on the same branch that
 * wrote it: `r2-orphan-sweep` is not freeze-gated and appends
 * `image_upload.orphaned` to `events` every six hours, while `build.ts`'s own
 * `NON_SECRET_SENTINELS` names that job by name as a live emit site the
 * harvest must exempt. Two files, one branch, contradictory beliefs about
 * whether that writer stops.
 *
 * Without a snapshot the sweep firing mid-build costs one of three things,
 * depending only on when: an abort of the one-shot build blaming a paging bug;
 * an archive silently shipping a fact that postdates the freeze; or —
 * quietest and worst — `image_uploads.csv` shipping `terminal_state = NULL`
 * for a row `events.csv` reports as orphaned, a self-contradicting archive no
 * guard notices because each file is internally consistent.
 *
 * ## Why the handle is passed rather than captured
 *
 * `drizzleSource` takes whatever handle it is given, so the caller composes:
 *
 * ```ts
 * await withDatasetSnapshot(db, (tx) =>
 *   buildDataset({ source: drizzleSource(tx, label), releaseDate }),
 * );
 * ```
 *
 * ⚠ **This is the one `transaction` verb in this module**, and the file
 * docblock's *"no `insert`, `update`, `delete` or `transaction` appears here"*
 * is corrected rather than left standing — a docblock that describes the file
 * it used to be is worse than none, because it is what the next reader trusts
 * instead of reading. The read-only guarantee is now stated by `READ ONLY` at
 * the transaction level, which is stronger than an absence anyone can add to.
 *
 * ⚠ `SET TRANSACTION` is issued as the first statement INSIDE the transaction,
 * not as a connection option. Connection-level `default_transaction_read_only`
 * is silently ignored by the Supavisor pooler this project runs behind, so a
 * belt fastened there would not exist. This one is per-transaction and is the
 * server's own mechanism.
 */
export async function withDatasetSnapshot<T>(
	db: DatasetDb,
	fn: (tx: DatasetDb) => Promise<T>,
): Promise<T> {
	return db.transaction(async (tx) => {
		await tx.execute(
			sql`SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY`,
		);
		// ⚠ No cast. `PgTransaction` extends `PgDatabase`, so `tx` is directly
		// assignable — I wrote `tx as unknown as DatasetDb` out of habit, 380
		// lines below the docblock explaining that exactly that double cast is
		// what made the OLD `DatasetDb` type verify nothing
		// (`@code-reviewer` M-1, and AGENTS.md §11 lists it under **Never**).
		// Reinstating it here would have restored the blind spot on the only
		// new DB-touching path on the branch. `tsc` is clean without it.
		return fn(tx);
	});
}
