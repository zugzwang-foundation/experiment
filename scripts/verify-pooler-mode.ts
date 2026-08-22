/**
 * VERIFY POOLER MODE — is this connection's pooler in transaction or session mode?
 *
 * A verification that passes when it is not looking is worth nothing (V-2).
 * S-1's criteria 1-5 all assert things about a pooler; this asserts that the
 * pooler under test is the one we think it is. It must fire before any other
 * criterion is recorded as met.
 *
 * ── THIS SHIPS. IT IS NOT AN S-1 ARTIFACT. ───────────────────────────────────
 *
 * It was written as a throwaway for S-1 criterion 6 and reclassified when the
 * control turned out to prove the POOLER rather than the deployment — which is
 * a standing question, not a one-task one.
 *
 * ⚠ NAMED DOWNSTREAM CALLER: **S-5**, the load programme. S-5 must confirm
 * transaction mode is actually active BEFORE load run #1, and W-10 says
 * saturation goes QUIET — overload queues rather than erroring, so a run can
 * report zero errors against a fully saturated pool. "It looked fine" is
 * therefore not available as evidence, and a committed instrument is how the
 * check gets re-run rather than re-derived.
 *
 * That is also why the filename names the MEASUREMENT and not the criterion:
 * S-1 closes, and a script called after a closed task's criterion number is a
 * script nobody can identify in three weeks.
 *
 * ── HOW TO RUN ───────────────────────────────────────────────────────────────
 *
 *   pnpm tsx --conditions=react-server scripts/verify-pooler-mode.ts
 *
 * ⚠ `--conditions=react-server` IS LOAD-BEARING, and this is the one thing about
 * this script worth remembering. `src/db/index.ts` imports `server-only`, whose
 * package exports map `react-server` → an EMPTY module and `default` → a module
 * whose entire body is a `throw`. Under plain `tsx` the import therefore dies
 * before a single line here runs — which is what AGENTS.md §7 is warning about
 * when it says tsx scripts must inline their own `postgres()` client.
 *
 * That advice is right for seed/smoke scripts and WRONG here, because a copied
 * client is a copy: it can drift from the shipped pool options and then the
 * control is exercising a connection nobody ships. Measured 2026-08-22 — plain
 * `tsx` throws, `tsx --conditions=react-server` imports clean — so the shipped
 * singleton is reachable and there is no reason to settle for a replica.
 *
 * ── WHAT IT PROVES, AND WHAT IT DOES NOT ─────────────────────────────────────
 *
 * ✅ PROVES: the POOLER this client is pointed at is (or is not) in transaction
 *    mode.
 * ❌ DOES NOT PROVE: that the DEPLOYED runtime reached that pooler. That is
 *    criterion 2 and it needs the deployment, not this script. Keep the two
 *    claims apart in the evidence package.
 *
 * ── THE MECHANISM ────────────────────────────────────────────────────────────
 *
 * A bare session-level `SET` (NOT `SET LOCAL`) mutates session state. Session
 * mode pins one backend for the whole client session, so the setting survives
 * into the next statement. Transaction mode returns the backend to the pool at
 * COMMIT and the next statement may land anywhere, so it must NOT survive.
 *
 * Non-persistence is therefore the transaction-mode signature — and persistence
 * is the session-mode signature. This script asserts BOTH DIRECTIONS rather than
 * only the one we hope for: run it against :5432 and it must report SESSION. A
 * probe that cannot detect the mode it is not looking for is not a control, it
 * is a formality that happens to agree with us.
 */

import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/db";

/** A sentinel no default and no other code path would ever produce. */
const SENTINEL_MS = 7777;

/** Never print a connection string. Report only the pooler PORT. */
function poolerPort(): string {
	const mode = process.env.DB_POOLER_MODE ?? "session";
	const raw =
		mode === "transaction"
			? process.env.DATABASE_URL_TXN
			: process.env.DATABASE_URL;
	const port = raw?.match(/:(\d{4,5})\//)?.[1] ?? "unknown";
	return `${port} (DB_POOLER_MODE=${mode})`;
}

async function main(): Promise<void> {
	console.log("S-1 · criterion 6 — positive control");
	console.log(`pooler port: ${poolerPort()}`);
	console.log("");

	// Statement 1 — mutate session state, then read it back IN THE SAME call so
	// we know the SET was actually accepted. If this read fails, the probe is
	// broken and neither verdict below means anything.
	const [applied] = await db.execute<{ v: string; pid: number }>(
		sql`SET statement_timeout = ${sql.raw(`'${SENTINEL_MS}ms'`)}; SELECT current_setting('statement_timeout') AS v, pg_backend_pid() AS pid`,
	);
	console.log(
		`stmt 1 · set + read back : ${applied?.v} (backend ${applied?.pid})`,
	);

	if (applied?.v !== `${SENTINEL_MS}ms`) {
		console.error("");
		console.error("⛔ CONTROL BROKEN — the SET did not take effect at all.");
		console.error(
			"   Neither verdict is available. Do not record any criterion.",
		);
		process.exitCode = 2;
		return;
	}

	// Statement 2 — a SEPARATE round trip. This is the whole experiment.
	const [observed] = await db.execute<{ v: string; pid: number }>(
		sql`SELECT current_setting('statement_timeout') AS v, pg_backend_pid() AS pid`,
	);
	console.log(
		`stmt 2 · subsequent read : ${observed?.v} (backend ${observed?.pid})`,
	);
	console.log("");

	const persisted = observed?.v === `${SENTINEL_MS}ms`;

	if (persisted) {
		console.log("VERDICT: SESSION MODE.");
		console.log(
			`  The bare SET survived into a separate statement, so one backend is`,
		);
		console.log(
			`  pinned for the whole client session. If this run was meant to be`,
		);
		console.log(
			`  transaction mode, CRITERION 6 FAILS and every other observation in`,
		);
		console.log(`  this window is void.`);
		process.exitCode = 1;
		return;
	}

	console.log("VERDICT: TRANSACTION MODE.");
	console.log(
		`  The bare SET did not survive the round trip — the backend went back to`,
	);
	console.log(
		`  the pool. Criterion 6 fires. Observed '${observed?.v}' instead.`,
	);
	if (applied?.pid !== observed?.pid) {
		console.log(
			`  Corroborating: the two statements ran on DIFFERENT backends`,
		);
		console.log(`  (${applied?.pid} → ${observed?.pid}).`);
	}
}

main()
	.catch((err: unknown) => {
		console.error("control errored:", err);
		process.exitCode = 2;
	})
	.finally(() => {
		// The shipped singleton owns no teardown hook; the process ending is the
		// release. Explicit so nobody adds a db.end() that changes pool behaviour
		// mid-measurement.
		process.exit(process.exitCode ?? 0);
	});
