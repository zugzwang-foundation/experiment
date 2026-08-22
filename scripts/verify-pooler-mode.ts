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

import { connectionVarName, db, poolerMode } from "@/db";

/** A sentinel no default and no other code path would ever produce. */
const SENTINEL_MS = 7777;

/** How many separate round trips to take. One sample cannot see rotation. */
const SAMPLES = 5;

/**
 * Never print a connection string. Report only the pooler PORT.
 *
 * The variable NAME comes from `@/db` rather than being re-derived here — the
 * script must describe the connection the app actually opened, and a local copy
 * of the selection rule can disagree with the shipped one without anything
 * failing.
 */
function poolerPort(): string {
	const raw = process.env[connectionVarName];
	// Anchor to the host segment: a password containing `:1234/` would otherwise
	// match first and the script would report a port nobody is connected to.
	const port = raw?.match(/@[^/@]*:(\d{4,5})(?:[/?]|$)/)?.[1] ?? "unknown";
	return `${port} (DB_POOLER_MODE=${poolerMode}, via ${connectionVarName})`;
}

/**
 * ⚠ A PARAMETERLESS multi-command batch goes over the SIMPLE protocol, and
 * postgres-js then resolves to an ARRAY OF PER-STATEMENT RESULTS — not to rows.
 * Destructuring `const [first] = await db.execute(batch)` therefore binds the
 * `SET`'s empty result, not the `SELECT`'s row, and every field reads
 * `undefined`.
 *
 * This is measured in-repo, not read off a doc: see
 * `tests/integration/staging-reset-mechanism.integration.test.ts`, which pins
 * both `simple: args.length === 0` and `length === 2` for a two-command batch.
 */
function firstRowWith<T>(result: unknown, key: keyof T): T | undefined {
	const rows = (result as unknown[]).flat() as T[];
	return rows.find((r) => r && typeof r === "object" && key in r);
}

type Probe = { v: string; pid: number };

async function main(): Promise<void> {
	console.log(
		"verify-pooler-mode — is this pooler in transaction or session mode?",
	);
	console.log(`pooler port: ${poolerPort()}`);
	console.log("");

	// Statement 1 — mutate session state, then read it back IN THE SAME call so
	// we know the SET was actually accepted. If this read fails, the probe is
	// broken and neither verdict below means anything.
	const applied = firstRowWith<Probe>(
		await db.execute(
			sql`SET statement_timeout = ${sql.raw(`'${SENTINEL_MS}ms'`)}; SELECT current_setting('statement_timeout') AS v, pg_backend_pid() AS pid`,
		),
		"v",
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

	// SEPARATE round trips. This is the whole experiment.
	//
	// ⚠ MORE THAN ONE, and the verdict uses the BACKEND PID, not only the
	// setting. A transaction-mode pooler returns the backend at COMMIT but is
	// free to hand the SAME one back next time, and neither pgbouncer nor
	// Supavisor guarantees a reset on check-in. So `the setting survived` alone
	// is NOT proof of session mode: against an idle pool with max 4, same-backend
	// reuse is likely rather than exotic, and a single sample would report a
	// correctly-flipped runtime as SESSION — halting S-1 on a working pooler.
	const observations: Probe[] = [];
	for (let i = 0; i < SAMPLES; i++) {
		const row = firstRowWith<Probe>(
			await db.execute(
				sql`SELECT current_setting('statement_timeout') AS v, pg_backend_pid() AS pid`,
			),
			"v",
		);
		if (!row) {
			console.error("");
			console.error("⛔ CONTROL BROKEN — a follow-up read returned no row.");
			process.exitCode = 2;
			return;
		}
		observations.push(row);
		console.log(`read ${i + 1} · ${row.v} (backend ${row.pid})`);
	}
	console.log("");

	const pids = [...new Set([applied.pid, ...observations.map((o) => o.pid)])];
	const rotated = pids.length > 1;
	const persisted = observations.every((o) => o.v === `${SENTINEL_MS}ms`);
	console.log(`backends seen : ${pids.join(", ")}`);
	console.log(`setting held  : ${persisted ? "every read" : "not every read"}`);
	console.log("");

	// EITHER signal alone establishes transaction mode: a rotated backend proves
	// the connection was returned to the pool, and a dropped setting proves it was
	// reset on check-in. Session mode requires BOTH to be absent.
	if (rotated || !persisted) {
		console.log("VERDICT: TRANSACTION MODE.");
		console.log(
			rotated
				? `  Statements ran on DIFFERENT backends (${pids.join(" → ")}), so the`
				: `  The bare SET did not survive a round trip, so the backend was`,
		);
		console.log("  connection went back to the pool between statements.");
		console.log("  Criterion 6 fires.");
		return;
	}

	console.log("VERDICT: SESSION MODE.");
	console.log(
		`  Across ${SAMPLES} separate statements the bare SET survived and ONE`,
	);
	console.log("  backend was seen, so the connection is pinned.");
	console.log(
		"  If this run was meant to be transaction mode, CRITERION 6 FAILS",
	);
	console.log("  and every other observation against it is void.");
	console.log("");
	console.log(
		`  ⚠ Read this as 'no evidence of pooling in ${SAMPLES} samples', not as`,
	);
	console.log("  proof of session mode. A transaction pooler that reused one");
	console.log(
		"  backend and never reset it would look identical. Raise SAMPLES",
	);
	console.log("  before concluding the flip did not happen.");
	process.exitCode = 1;
}

main()
	.catch((err: unknown) => {
		console.error("control errored:", err);
		process.exitCode = 2;
	})
	.finally(async () => {
		// The shipped singleton owns no teardown hook; the process ending is the
		// release. Explicit so nobody adds a db.end() that changes pool behaviour
		// mid-measurement.
		//
		// ⚠ DRAIN FIRST. This script's entire product is its stdout, and when that
		// is a pipe or a file — which is how an evidence package gets captured —
		// Node's writes are asynchronous and process.exit() discards whatever is
		// still buffered. A truncated tail here loses the verdict silently.
		await new Promise<void>((resolve) => {
			if (process.stdout.write("")) resolve();
			else process.stdout.once("drain", () => resolve());
		});
		process.exit(process.exitCode ?? 0);
	});
