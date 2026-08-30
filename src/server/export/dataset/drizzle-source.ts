import { asc, getTableColumns, getTableName, gt } from "drizzle-orm";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";

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
 * No `insert`, `update`, `delete` or `transaction` appears here. Deliberately
 * **no transaction at all**, not even a read-only one: the release runs after
 * the 2026-11-05 write freeze (§19.1), so there is no concurrent writer to be
 * isolated from, and a transaction spanning sixteen table reads of a
 * multi-million-row `events` would hold one connection and one snapshot open
 * for the length of the whole export — buying consistency that the freeze
 * already provides, at the cost of a long-lived idle-in-transaction session.
 *
 * ⚠ That reasoning depends on the freeze. A reader pointed at a LIVE database
 * would need the snapshot, and would then need `REPEATABLE READ`. Stated here
 * because the next person to reuse this will be pointing it somewhere else.
 */

/**
 * The minimum drizzle surface this reader needs.
 *
 * Structural rather than `typeof db`, so the caller may pass the app
 * singleton, a script's own `postgres()`-backed client, or a test client
 * without any of them having to be the same type. It also states, in the type,
 * that this module can only SELECT — there is no `insert` or `transaction` on
 * it to reach for.
 */
export interface DatasetDb {
	select: (fields: Record<string, PgColumn>) => {
		from: (table: PgTable) => {
			where: (cond: unknown) => {
				orderBy: (...cols: unknown[]) => {
					limit: (n: number) => Promise<Record<string, unknown>[]>;
				};
			};
			orderBy: (...cols: unknown[]) => {
				limit: (n: number) => Promise<Record<string, unknown>[]>;
			};
		};
	};
}

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
 * (AGENTS.md §6), and `event_id` alone is unique because it is a UUIDv7.
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
		// `is(value, PgTable)` is the check `inventory.ts` uses; reusing the
		// same predicate keeps the two from disagreeing about what a table is.
		if (
			typeof value === "object" &&
			value !== null &&
			Symbol.for("drizzle:Name") in value
		) {
			map.set(getTableName(value as PgTable), value as PgTable);
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
			const projection: Record<string, PgColumn> = {};
			let orderColumn: PgColumn | undefined;
			for (const col of Object.values(columns)) {
				projection[col.name] = col;
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
				if (cursor === undefined) {
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
