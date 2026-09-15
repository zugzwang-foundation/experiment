// SEED-1-DUMMY — the seed runner's database handles. ADR-0053.
// NEVER import this from src/**.
//
// Same shape as tests/staging/_lib/client.ts, and for the same reasons (read
// that file's header): the runner is handed a WRITE-GUARDED client for the
// engine and a SELECT-only façade for itself, never a raw handle. The target is
// resolved at module scope and throws before a client exists.

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@/db/schema";
import { assertLiveConnection } from "../../staging/_lib/reset";
import {
	createWriteGuard,
	type WriteRecord,
} from "../../staging/_lib/write-guard";
import { resolveSeedTarget } from "./target";

const target = resolveSeedTarget(process.env);
if (!target.ok) {
	throw new Error(
		`REFUSED — the seed target guard did not pass.\n  ${target.reason}`,
	);
}

export const SEED_MODE = target.mode;
const TARGET_URL = target.url;
const TARGET_REF = target.ref;

// `max: 4` matches src/db/index.ts's control against the session pooler's
// pool_size (security-auditor L-5), with an idle timeout so a 24h window does
// not pin idle connections. `max: 1` deadlocks Better Auth's
// user create (see tests/staging/_lib/client.ts). `prepare: false` for the
// Supabase session pooler.
const client = postgres(TARGET_URL, {
	max: 4,
	idle_timeout: 20,
	prepare: false,
});
const rawDb = drizzle(client, { schema });
const guard = createWriteGuard(rawDb);

export const guardedDb = guard.db;

export function writeLog(): readonly WriteRecord[] {
	return guard.writes();
}

/** Writes into the ADR-0036 primitive 4 table set. */
export function forbiddenTableWrites(): readonly WriteRecord[] {
	return guard.forbiddenTableWrites();
}

export const readOnly = {
	select: rawDb.select.bind(rawDb),
	query: rawDb.query,
} as const;

/** G-3 against the LIVE SOCKET: it must carry the mode's project ref. */
export async function assertSeedLiveConnection(): Promise<void> {
	if (SEED_MODE === "local") return;
	if (!TARGET_REF) {
		throw new Error(
			"G-3 failed: no project ref to check the live connection against; refusing",
		);
	}
	await assertLiveConnection(client, TARGET_REF);
}

export async function closeSeedConnection(): Promise<void> {
	await client.end({ timeout: 10 });
}

/** One-line target summary. Never logs credentials. */
export function describeSeedTarget(): string {
	try {
		return `${SEED_MODE} · ${new URL(TARGET_URL).host}`;
	} catch {
		return `${SEED_MODE} · (unparseable host)`;
	}
}
