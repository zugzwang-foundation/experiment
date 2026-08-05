import type postgres from "postgres";
import {
	DISABLED_TRUNCATE_GUARDS,
	EXPECTED_GUARD_CATALOG_ROWS,
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

/**
 * G-3 · live connection. Asserts against the SOCKET about to be used, not the
 * config that produced it — a config can say staging while the connection says
 * otherwise. Returns the connection facts for logging.
 */
export async function assertLiveConnection(
	client: postgres.Sql,
	fragment: string,
): Promise<{ database: string; user: string; host: string }> {
	const [row] = await client<{ database: string; user: string }[]>`
		SELECT current_database() AS database, current_user AS user
	`;
	if (!row) {
		throw new Error("G-3 failed: the connection returned no row");
	}

	// The host as the DRIVER resolved it for this connection, not as the env
	// string spelled it.
	const options = (client as unknown as { options?: { host?: string[] } })
		.options;
	const host = options?.host?.join(",") ?? "";
	if (!host) {
		throw new Error("G-3 failed: could not read the live connection host");
	}
	if (!host.includes(fragment)) {
		throw new Error(
			`G-3 failed: the live connection host does not contain the staging ref fragment "${fragment}" (connected to ${host}); refusing`,
		);
	}

	return { database: row.database, user: row.user, host };
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
	if (tables.length === 0) {
		throw new Error("runGuardedReset: empty truncate set");
	}

	const disable = DISABLED_TRUNCATE_GUARDS.map(
		([table, trigger]) => `ALTER TABLE ${table} DISABLE TRIGGER ${trigger};`,
	).join("\n");
	const enable = DISABLED_TRUNCATE_GUARDS.map(
		([table, trigger]) => `ALTER TABLE ${table} ENABLE TRIGGER ${trigger};`,
	).join("\n");

	await client.unsafe(
		`${disable}\nTRUNCATE ${tables.join(", ")} CASCADE;\n${enable}`,
	);
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
export async function verifyPostReset(client: postgres.Sql): Promise<void> {
	const failures: string[] = [];

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

	// 3 · the migration ledger survives.
	const [migrations] = await client<{ n: number }[]>`
		SELECT count(*)::int AS n FROM drizzle.__drizzle_migrations
	`;
	if (!migrations || migrations.n === 0) {
		failures.push(
			`drizzle.__drizzle_migrations is empty — drizzle-kit would re-run 0000 onward against a populated schema and /api/health would report drift`,
		);
	}

	if (failures.length > 0) {
		throw new Error(
			`G-4 post-run verification FAILED:\n${failures.join("\n")}`,
		);
	}
}

/** One-line target summary. Host only — never the credentials. */
export function describeTarget(url: string): string {
	return safeHost(url);
}
