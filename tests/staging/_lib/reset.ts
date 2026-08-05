import type postgres from "postgres";
import {
	DISABLED_TRUNCATE_GUARDS,
	EXPECTED_GUARD_CATALOG_ROWS,
	isAllowedStagingHost,
	safeHost,
} from "./guards";

// STAGING-PARITY Slice A — the reset mechanism (ADR-0035 primitive 2) and its
// post-run verification (G-3, G-4). Constants and the target guard live in
// ./guards.ts; the runner that wires them together is ../reset.staging.test.ts.
//
// NEVER import this from src/**.

export type GuardCatalogRow = {
	readonly table: string;
	readonly trigger: string;
	readonly enabled: string;
};

/**
 * Every non-internal `bucket_%` trigger in `public`, with its enabled state.
 * `tgenabled = 'O'` is "origin" — the normal, firing state.
 */
export async function readGuardCatalog(
	client: postgres.Sql,
): Promise<GuardCatalogRow[]> {
	return client<GuardCatalogRow[]>`
		SELECT c.relname AS table, t.tgname AS trigger, t.tgenabled AS enabled
		FROM pg_trigger t
		JOIN pg_class c ON c.oid = t.tgrelid
		JOIN pg_namespace n ON n.oid = c.relnamespace
		WHERE n.nspname = 'public'
		  AND NOT t.tgisinternal
		  AND t.tgname LIKE 'bucket_%'
		ORDER BY c.relname, t.tgname
	`;
}

/** The database name every Supabase project reports. Asserted by G-3. */
export const EXPECTED_DATABASE = "postgres";

/**
 * G-3 · live connection. Asserts against the connection the DRIVER actually
 * resolved and dialled, plus a live round-trip — not against the env string
 * G-1 already read. A config can say staging while the connection says
 * otherwise (a `?host=` override, an ambient PGHOST/PGUSER, a pooler
 * redirect): those all move the driver-resolved options, which is what this
 * reads.
 *
 * THE FRAGMENT IS MATCHED AGAINST `user@host`, NOT host alone. Staging connects
 * through the Supabase SESSION POOLER, whose hostname carries no project ref —
 * the ref lives in the USERNAME (`postgres.<ref>@aws-1-ap-south-1.pooler…`).
 * Verified read-only against the live staging target on 2026-08-05: the bare
 * 20-character ref is present in `options.user` and absent from `options.host`.
 * A host-only check would therefore refuse every legitimate run.
 *
 * STATED LIMITATION — the pooler exposes NO project-discriminating server-side
 * fact: `current_database()` and `current_user` both read `postgres` on every
 * Supabase project, staging and production alike (same read-only probe). So
 * G-3 is an assertion about the connection the driver opened, not an
 * independent oracle proving that connection is staging. The target
 * discriminators are G-1's fragment match and its hard PRODUCTION_PROJECT_REF
 * refusal. Recorded rather than papered over.
 */
export async function assertLiveConnection(
	client: postgres.Sql,
	fragment: string,
): Promise<{ database: string; user: string; target: string }> {
	// Driver-resolved connection parameters. postgres-js does not type
	// `.options` as public surface, so this is read defensively: on a driver
	// bump that renames it, `target` is empty and G-3 FAILS CLOSED below.
	const options = (
		client as unknown as { options?: { host?: string[]; user?: string } }
	).options;
	const host = options?.host?.join(",") ?? "";
	const user = options?.user ?? "";
	if (!host || !user) {
		throw new Error(
			"G-3 failed: could not read the driver-resolved connection parameters; refusing",
		);
	}

	const target = `${user}@${host}`;
	if (!target.includes(fragment)) {
		throw new Error(
			`G-3 failed: the live connection does not carry the staging ref fragment "${fragment}" (dialling ${host}); refusing`,
		);
	}
	// The fragment lives in the USERNAME on the pooler, so on its own it says
	// nothing about where we dial: a localhost DSN carrying the staging ref as
	// its user satisfies the match. Constrain the host too.
	if (!isAllowedStagingHost(host)) {
		throw new Error(
			`G-3 failed: the live connection dials "${host}", which is not a Supabase host; refusing`,
		);
	}

	const [row] = await client<
		{ database: string; user: string; replication: string }[]
	>`
		SELECT current_database()                        AS database,
		       current_user                              AS user,
		       current_setting('session_replication_role') AS replication
	`;
	if (!row) {
		throw new Error("G-3 failed: the connection returned no row");
	}
	if (row.database !== EXPECTED_DATABASE) {
		throw new Error(
			`G-3 failed: current_database() is "${row.database}", expected "${EXPECTED_DATABASE}"; refusing`,
		);
	}
	// ADR-0030:48 scopes this whole pattern as "owner-privilege only (no
	// session_replication_role, no production escape-hatch GUC)". Under
	// `replica` NO trigger fires — including the four never-disabled guards —
	// while G-4's catalog check still reads a clean 78/all-enabled, because
	// tgenabled is unchanged. That combination would silently void the entire
	// append-only contract while every check reported green, and it is
	// reachable through a `?options=-c session_replication_role=replica`
	// query parameter in the connection string. @security-auditor, Slice A.
	if (row.replication !== "origin") {
		throw new Error(
			`G-3 failed: session_replication_role is "${row.replication}", expected "origin". Under any other value the append-only triggers do not fire at all, while the catalog still reports them enabled; refusing.`,
		);
	}

	return { database: row.database, user: row.user, target };
}

/**
 * Bounds how long the batch will WAIT for a lock — not how long it may run.
 *
 * The batch takes `ACCESS EXCLUSIVE` on the truncate set and
 * `SHARE ROW EXCLUSIVE` on every guarded relation. Without a timeout, a reset
 * issued while staging serves traffic queues behind the open transaction and
 * holds write-blocking locks on every append-only table for as long as that
 * takes — and, because a lock request queues ahead of later readers, it stalls
 * the application too. Bounded, the batch instead fails fast with `55P03`, and
 * the whole thing rolls back under primitive 2. A self-inflicted staging
 * outage becomes a retry. Ruling 2, 2026-08-06.
 *
 * `SET LOCAL` — transaction-scoped, so it reverts when the implicit
 * transaction ends and cannot leak into the pooled session. That matters on
 * the Supabase session pooler, where the connection is reused.
 *
 * DELIBERATELY NOT `statement_timeout`. That would bound EXECUTION, and a
 * legitimate `TRUNCATE … CASCADE` over 21 relations has no principled upper
 * bound — capping it would abort correct work and turn a slow reset into a
 * failed one. Lock WAIT is the contended resource; execution is not.
 *
 * F1, 2026-08-06 — THE ASSUMPTION THIS RESTS ON, NOW MEASURED. `SET LOCAL`
 * outside a transaction block emits `WARNING 25P01 "SET LOCAL can only be used
 * in transaction blocks"` and NO-OPS. Nothing asserted that a multi-statement
 * simple-query implicit transaction counts as a transaction block for that
 * purpose, so the bound was unverified. Probed against local Postgres 17:
 * issued ALONE the statement warns and `current_setting('lock_timeout')` reads
 * `"0"`; issued as the first statement of the batch below it reads `"15s"` with
 * no notice, and reverts to `"0"` on the next round-trip. Pinned by
 * tests/integration/staging-reset-mechanism — which builds the REAL batch via
 * `buildResetBatch` rather than a lookalike, so a driver bump that unbinds it
 * fails loudly here instead of silently removing the bound.
 */
export const LOCK_TIMEOUT = "15s";
const LOCK_TIMEOUT_STATEMENT = `SET LOCAL lock_timeout = '${LOCK_TIMEOUT}';`;

/** Postgres identifiers this module is willing to interpolate into raw SQL. */
const SAFE_IDENTIFIER = /^[a-z_][a-z0-9_]*$/;

function assertSafeIdentifiers(names: readonly string[], what: string): void {
	for (const name of names) {
		if (!SAFE_IDENTIFIER.test(name)) {
			throw new Error(
				`refusing to build SQL with an unsafe ${what}: ${JSON.stringify(name)}`,
			);
		}
	}
}

/**
 * Disable → TRUNCATE … CASCADE → enable, as ONE parameterless
 * `client.unsafe()` round-trip.
 *
 * ADR-0035 primitive 2 — atomicity is the PRIMARY mechanism. Under the simple
 * query protocol that string is one implicit transaction, and
 * `ALTER TABLE … DISABLE TRIGGER` is transactional DDL in Postgres, so any
 * abort — a failed TRUNCATE, a killed process, an OOM, a dropped socket —
 * rolls the disable back with it. THE GUARDS CANNOT BE LEFT OFF, BECAUSE THEY
 * ARE NEVER COMMITTED OFF.
 *
 * Do not split this into separate round-trips. If it is ever split, each
 * statement commits on its own and a crash between them leaves the guards
 * disabled; verifyPostReset is what would notice, and it only runs on the
 * paths that reach it.
 *
 * There is deliberately no exclusion-bypass parameter: system_state's guard is
 * never disabled, so naming it here is refused by the storage layer itself,
 * for every caller.
 *
 * This function is the MECHANISM ONLY — it contains no `finally` re-enable.
 * The belt lives one layer up, in the operational runner
 * (../reset.staging.test.ts), for two reasons: it is an operational
 * safety-net rather than part of the transactional guarantee, and keeping it
 * out of here is what lets the atomicity test observe the rollback directly
 * instead of observing a belt that repaired the damage.
 */
export async function runGuardedReset(
	client: postgres.Sql,
	tables: readonly string[],
): Promise<void> {
	await client.unsafe(buildResetBatch(tables));
}

/**
 * The batch text, built and validated but not sent.
 *
 * Split out for ONE reason (F1, 2026-08-06): the `SET LOCAL lock_timeout` bound
 * is only real if it binds inside THIS string, and a test that reassembles a
 * lookalike proves nothing about the shipped one. The integration suite builds
 * the real batch here, appends a `current_setting('lock_timeout')` read, and
 * asserts the value — so the assertion moves with the mechanism.
 *
 * Every refusal lives here rather than in `runGuardedReset`, so it fires for
 * the test path too and nothing can build an unvalidated batch.
 */
export function buildResetBatch(tables: readonly string[]): string {
	if (tables.length === 0) {
		throw new Error("runGuardedReset: empty truncate set");
	}
	// `tables` is a PARAMETER, and the batch below is raw string-built SQL. All
	// shipped call sites pass module constants, but a caller passing
	// `users; ALTER TABLE dharma_ledger DISABLE TRIGGER bucket_a_no_update; --`
	// would disable a NEVER-disabled guard and COMMIT it, since the whole batch
	// would then succeed. That is the single path by which a _no_update /
	// _no_delete guard could be left off. @security-auditor, Slice A.
	assertSafeIdentifiers(tables, "table name");

	assertSafeIdentifiers(
		DISABLED_TRUNCATE_GUARDS.flatMap(([table, trigger]) => [table, trigger]),
		"guard identifier",
	);

	const disable = DISABLED_TRUNCATE_GUARDS.map(
		([table, trigger]) => `ALTER TABLE ${table} DISABLE TRIGGER ${trigger};`,
	).join("\n");
	const enable = DISABLED_TRUNCATE_GUARDS.map(
		([table, trigger]) => `ALTER TABLE ${table} ENABLE TRIGGER ${trigger};`,
	).join("\n");

	return `${LOCK_TIMEOUT_STATEMENT}\n${disable}\nTRUNCATE ${tables.join(", ")} CASCADE;\n${enable}`;
}

/**
 * The BELT (ADR-0035 primitive 2, explicitly demoted) — re-enable every guard
 * the reset would have disabled.
 *
 * This is the WEAKER of the two mechanisms and is documented as such: a
 * `finally` does not run on SIGKILL, on OOM, or on a dropped socket, which are
 * precisely the failures that matter. The single-transaction batch in
 * runGuardedReset is what actually covers those, because the DISABLE is never
 * committed. This exists because it costs one round-trip, and because if a
 * future edit ever splits that batch, it becomes load-bearing.
 */
export async function reEnableGuards(client: postgres.Sql): Promise<void> {
	await client.unsafe(
		DISABLED_TRUNCATE_GUARDS.map(
			([table, trigger]) => `ALTER TABLE ${table} ENABLE TRIGGER ${trigger};`,
		).join("\n"),
	);
}

/**
 * G-4 · post-run verification. Verification, not assumption — this is what
 * notices if a future edit splits the single batch into separate round-trips
 * and turns primitive 2's guarantee off.
 *
 * Throws with the offending rows named. Callers exit non-zero.
 */
export async function countMigrations(client: postgres.Sql): Promise<number> {
	const [row] = await client<{ n: number }[]>`
		SELECT count(*)::int AS n FROM drizzle.__drizzle_migrations
	`;
	return row?.n ?? 0;
}

/**
 * Explicit "no baseline was captured" — the only way to get G-4's WEAKER
 * ledger check.
 *
 * The parameter used to be optional, which meant a caller could get the weak
 * check by simply forgetting it, and the run still reported green. That is the
 * same silent-weakening shape as a blanked deny list: the check degrades, and
 * nothing says so. Six call sites were taking the weak path by omission.
 *
 * Required-with-a-sentinel instead of optional-plus-a-warning, deliberately: a
 * `console.warn` is not a control — it lands in the middle of a destructive
 * run's output, which is exactly where a warning gets missed — whereas
 * omitting a required argument is a COMPILE error. Same principle as ADR-0036
 * primitive 2: make it structural, not procedural. A caller that genuinely has
 * no baseline must now say so in the source, and the degrade is announced at
 * runtime as well. Q-H, 2026-08-06.
 */
export const NO_MIGRATION_BASELINE = "no-baseline";

export async function verifyPostReset(
	client: postgres.Sql,
	/**
	 * The `drizzle.__drizzle_migrations` row count read BEFORE the batch, or
	 * `NO_MIGRATION_BASELINE` to state explicitly that none was captured.
	 *
	 * ADR-0035 G-4 requires the ledger to RETAIN its row count — a
	 * merely-non-empty check passes a partial deletion, and G-4 is the layer
	 * whose whole job is verification rather than assumption.
	 */
	migrationsBefore: number | typeof NO_MIGRATION_BASELINE,
): Promise<void> {
	const failures: string[] = [];

	if (migrationsBefore === NO_MIGRATION_BASELINE) {
		// Announce the degrade. This is the belt; the type is the control.
		console.warn(
			"[G-4] DEGRADED: no pre-batch migration baseline was captured, so the " +
				"drizzle.__drizzle_migrations check can only prove the ledger is NON-EMPTY. " +
				"A partial deletion would pass. Pass the pre-batch count to check retention.",
		);
	}

	// 1 · every bucket_% guard present and enabled.
	const catalog = await readGuardCatalog(client);
	const disabled = catalog.filter((r) => r.enabled !== "O");
	if (disabled.length > 0) {
		failures.push(
			`guards left disabled:\n${disabled
				.map((r) => `  (${r.table}, ${r.trigger}, tgenabled=${r.enabled})`)
				.join("\n")}`,
		);
	}
	if (catalog.length !== EXPECTED_GUARD_CATALOG_ROWS) {
		failures.push(
			`guard catalog returned ${catalog.length} rows, expected ${EXPECTED_GUARD_CATALOG_ROWS} — a guard is missing, or a migration added a protected relation without its triggers (ADR-0030 forward obligation)`,
		);
	}

	// 2 · system_state's singleton row survives, unfrozen.
	const systemState = await client<{ id: string; frozen_at: Date | null }[]>`
		SELECT id, frozen_at FROM system_state
	`;
	if (systemState.length !== 1) {
		failures.push(
			`system_state must hold exactly 1 row, saw ${systemState.length} — the freeze sentinel is gone and isFrozen() would fail OPEN silently`,
		);
	} else if (systemState[0]?.frozen_at !== null) {
		failures.push(
			`system_state.frozen_at is not NULL — staging is frozen and cannot be unfrozen (one-shot, trigger-enforced)`,
		);
	}

	// 3 · the migration ledger RETAINS its row count.
	const migrationsAfter = await countMigrations(client);
	if (migrationsAfter === 0) {
		failures.push(
			`drizzle.__drizzle_migrations is empty — drizzle-kit would re-run 0000 onward against a populated schema and /api/health would report drift`,
		);
	} else if (
		migrationsBefore !== NO_MIGRATION_BASELINE &&
		migrationsAfter !== migrationsBefore
	) {
		failures.push(
			`drizzle.__drizzle_migrations holds ${migrationsAfter} rows, expected ${migrationsBefore} — the ledger lost rows and /api/health would report drift`,
		);
	}

	if (failures.length > 0) {
		throw new Error(
			`G-4 post-run verification FAILED:\n${failures.join("\n")}`,
		);
	}
}

/**
 * One-line target summary for the run log.
 *
 * HOST ALONE IS NOT IDENTIFYING. On the session pooler `new URL(url).host` is
 * `aws-1-ap-south-1.pooler.supabase.com:5432` — the same string for every
 * Supabase project in the region, staging and production alike — because the
 * project ref lives in the USERNAME, which `new URL()` drops. A log line
 * carrying only the host cannot tell a reader which database was wiped, which
 * is precisely the question the log exists to answer. So the validated
 * fragment is printed alongside it.
 *
 * The fragment is safe to log: it is known-good by the time this is called
 * (G-1 matched it, G-3 matched it against the live connection), it is a
 * project ref rather than a credential, and it is already committed in ten
 * documents. The password and the raw URL are NEVER logged. Ruling, 2026-08-06.
 */
export function describeTarget(url: string, fragment: string): string {
	return `${safeHost(url)} · ref=${fragment}`;
}
