// STAGING-PARITY Slice B — the GENERATOR's database handles.
// NEVER import this from src/**.
//
// ═══════════════════════════════════════════════════════════════════════════
// WHAT THIS MODULE HANDS OUT, AND WHAT IT DELIBERATELY DOES NOT
//
//   `guardedDb`  — the drizzle client, wrapped by the ADR-0036 primitive 4
//                  write guard. This is what `vi.mock("@/db")` returns, so the
//                  ENGINE writes through it and every write is attributed.
//   `readOnly`   — a `select`-only façade for the generator's own verification
//                  reads.
//   `writeLog`   — the guard's record, for the post-run assertion.
//
// It does NOT export the raw `postgres` client, and it does NOT export the
// unwrapped drizzle client. That is the structural half of primitive 4: the
// generator has no handle a direct `INSERT INTO` or `.insert()` could travel
// on. The behavioural half (the proxy) and the source match (the unit
// tripwire) are the other two.
//
// The target is resolved AT MODULE SCOPE and throws on refusal, so a
// misconfigured run fails during collection — before a client exists, the same
// shape as the reset's G-1/G-2.

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@/db/schema";
import { assertLiveConnection } from "./reset";
import { resolveRunnerTarget } from "./target";
import { createWriteGuard, type WriteRecord } from "./write-guard";

const target = resolveRunnerTarget(process.env, { requireWriteIntent: true });
if (!target.ok) {
	throw new Error(
		`REFUSED — the staging generator target guard did not pass.\n  ${target.reason}\n\n` +
			"Run it as: pnpm staging:generate (staging) or with ZUGZWANG_STAGING_TARGET=local (local proving)",
	);
}

// Captured at module scope: TypeScript's narrowing of `target` does not reach
// into the closures below, and re-asserting would mean an `as`.
export const RUNNER_MODE = target.mode;
const TARGET_URL = target.url;

// `max: 10` MATCHES src/db/index.ts, and it is NOT a tuning choice — it is a
// correctness requirement.
//
// `max: 1` DEADLOCKS THIS RUNNER. Better Auth's `createOAuthUser` wraps its
// user + account inserts in `runWithTransaction`, which reserves a connection;
// the `user.create.before` hook inside it calls `consumeIdentityPoolTuple`,
// which opens a SECOND transaction of its own (consume.ts:26). On a
// single-connection pool the inner transaction waits for a connection the outer
// one holds, forever — the server sits at `idle in transaction` on a bare
// `begin` and no timeout fires, because nothing is executing.
//
// Observed on the first local run of this file (2026-08-06). The generator is
// sequential regardless — it awaits every engine call in DAG order — so a
// larger pool buys concurrency it never uses and costs nothing.
//
// `prepare: false` mirrors src/db/index.ts: defensive on the Supabase session
// pooler.
const client = postgres(TARGET_URL, { max: 10, prepare: false });
const rawDb = drizzle(client, { schema });

const guard = createWriteGuard(rawDb);

/** The handle `vi.mock("@/db")` returns. Every engine write flows through it. */
export const guardedDb = guard.db;

/** Every write the run issued, with its attributed caller. */
export function writeLog(): readonly WriteRecord[] {
	return guard.writes();
}

/** Writes into the ADR-0036 primitive 4 table set. */
export function forbiddenTableWrites(): readonly WriteRecord[] {
	return guard.forbiddenTableWrites();
}

/**
 * SELECT-only façade. Deliberately not the drizzle client: handing the
 * generator a write-capable handle would make primitive 4 a promise again.
 */
export const readOnly = {
	select: rawDb.select.bind(rawDb),
	query: rawDb.query,
} as const;

/**
 * G-3 for the GENERATOR — assert against the LIVE SOCKET, not the config.
 *
 * @code-reviewer, Slice B: the reset does this (`_lib/reset.ts`
 * `assertLiveConnection`) precisely because "a config can say staging while the
 * connection says otherwise" (Ratification Record §5 W-B item 2) — a `?host=`
 * override, an ambient PGHOST/PGUSER, a pooler redirect all move the
 * driver-resolved options without touching the env string G-1 read. This runner
 * writes ~440 rows and had no equivalent.
 *
 * It reuses the RESET'S OWN function rather than a lookalike, so the two cannot
 * drift and a hardening of G-3 reaches both. Staging mode only: local mode's
 * loopback positive-match is its own discriminator, and `assertLiveConnection`
 * would (correctly) refuse a non-Supabase host.
 *
 * Called from the runner's `beforeAll`, so a failure aborts the suite WITHOUT
 * executing any of it.
 */
export async function assertRunnerLiveConnection(): Promise<void> {
	if (RUNNER_MODE !== "staging") return;
	const fragment = process.env.STAGING_PROJECT_REF_FRAGMENT;
	if (!fragment) {
		throw new Error(
			"G-3 failed: STAGING_PROJECT_REF_FRAGMENT is unset at connection time; refusing",
		);
	}
	await assertLiveConnection(client, fragment);
}

export async function closeRunnerConnection(): Promise<void> {
	await client.end({ timeout: 10 });
}

/** One-line target summary. Never logs credentials. */
export function describeRunnerTarget(): string {
	try {
		return `${RUNNER_MODE} · ${new URL(TARGET_URL).host}`;
	} catch {
		return `${RUNNER_MODE} · (unparseable host)`;
	}
}
