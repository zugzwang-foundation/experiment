// MKT-ROSTER-1 · ONE-TIME. The PRODUCTION write-guarded client.
//
// ⛔⛔ NEVER MERGED — see `_lib/prod-target.ts`'s header. D-49 authorises one
// pre-launch production run of the restore; ADR-0036's callout records it.
//
// This is `tests/staging/_lib/client.ts` with its target guard inverted and
// NOTHING ELSE changed in substance. The write guard itself is IMPORTED from
// the staging lib rather than copied: `write-guard.ts` is target-agnostic (its
// only imports are node:url and drizzle-orm) and it is the mechanism that makes
// ADR-0036 primitive 4 structural — "no row is written by this file" is a
// property of that proxy, not of a promise, and a second copy of it would be a
// second thing to get wrong.
//
// ⚠ Importing is not editing. `tests/staging/_lib/**` is untouched by this
// branch, which is the wall that keeps the production refusal single-sourced on
// `main`.
//
// ⚠ `isEngineCaller` refuses ANY caller under `/tests/` first and explicitly,
// so it already covers this directory: a direct write attempted from
// `tests/prod-onetime/**` is refused by the same rule that refuses one from
// `tests/staging/**`. No allowance was added for this lane, deliberately.

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@/db/schema";
import {
	createWriteGuard,
	type WriteRecord,
} from "../../staging/_lib/write-guard";
import {
	EXPECTED_DATABASE,
	PRODUCTION_PROJECT_REF,
	resolveProdTarget,
	safeHost,
} from "./prod-target";

const target = resolveProdTarget(process.env);
if (!target.ok) {
	throw new Error(
		`REFUSED — the production restore target guard did not pass.\n  ${target.reason}\n\n` +
			"Run it as: pnpm exec tsx scripts/_onetime/mkt-roster-1-prod-restore.ts --create",
	);
}
const TARGET_URL = target.url;

// `max: 10` MATCHES src/db/index.ts and the staging runner, and it is not a
// tuning choice: a single-connection pool DEADLOCKS any engine path that opens
// a nested transaction. The restore is sequential regardless.
const client = postgres(TARGET_URL, { max: 10, prepare: false });
const rawDb = drizzle(client, { schema });
const guard = createWriteGuard(rawDb);

/** The handle `vi.mock("@/db")` returns. Every engine write flows through it. */
export const guardedDb = guard.db;

export function writeLog(): readonly WriteRecord[] {
	return guard.writes();
}

export function forbiddenTableWrites(): readonly WriteRecord[] {
	return guard.forbiddenTableWrites();
}

/** SELECT-only façade — never the drizzle client, for primitive 4's sake. */
export const readOnly = {
	select: rawDb.select.bind(rawDb),
	query: rawDb.query,
} as const;

/**
 * G-3' · assert against the LIVE SOCKET, not the config.
 *
 * Same argument as the staging original: a config can say one thing while the
 * connection says another — a `?host=` override, an ambient PGHOST/PGUSER, a
 * pooler redirect all move the driver-resolved options without touching the env
 * string the target guard read. Inverted here to demand production.
 */
export async function assertProdLiveConnection(): Promise<void> {
	const options = (
		client as unknown as { options?: { host?: string[]; user?: string } }
	).options;
	const hosts = options?.host ?? [];
	const host = hosts.join(",");
	const user = options?.user ?? "";
	if (hosts.length === 0 || !user) {
		throw new Error(
			"G-3' failed: could not read the driver-resolved connection parameters; refusing",
		);
	}
	if (!`${user}@${host}`.includes(PRODUCTION_PROJECT_REF)) {
		throw new Error(
			`G-3' failed: the live connection does not carry the production ref (dialling ${host}); refusing`,
		);
	}
	// ⛔ EVERY element, never the joined string. postgres-js dials a multihost
	// list in order, and `[evil, …supabase.com].join(",")` ends with
	// ".supabase.com" while the driver connects to the first entry.
	// `@security-auditor`, MEDIUM.
	const badHosts = hosts.filter((h) => {
		const x = h.toLowerCase().split(":")[0] ?? "";
		return !x.endsWith(".supabase.com") && !x.endsWith(".supabase.co");
	});
	if (badHosts.length > 0) {
		throw new Error(
			`G-3' failed: the live connection dials ${badHosts.length} non-Supabase host(s) — ${badHosts.join(", ")}; refusing`,
		);
	}
	const [row] = await client<{ database: string; replication: string }[]>`
		SELECT current_database() AS database,
		       current_setting('session_replication_role') AS replication
	`;
	if (!row) throw new Error("G-3' failed: the connection returned no row");
	if (row.database !== EXPECTED_DATABASE) {
		throw new Error(
			`G-3' failed: current_database() is "${row.database}"; refusing`,
		);
	}
	if (row.replication !== "origin") {
		throw new Error(
			`G-3' failed: session_replication_role is "${row.replication}". Under any other value the append-only triggers do not fire at all while the catalogue still reports them enabled; refusing.`,
		);
	}
}

export async function closeProdConnection(): Promise<void> {
	await client.end({ timeout: 10 });
}

export function describeProdTarget(): string {
	return `prod · ${safeHost(TARGET_URL)}`;
}
