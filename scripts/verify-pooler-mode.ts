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
 *   doppler run --project zugzwang-experiment --config stg -- \
 *     pnpm tsx --conditions=react-server scripts/verify-pooler-mode.ts
 *
 *   # assert the OTHER direction (the both-directions self-test, below):
 *   … scripts/verify-pooler-mode.ts --expect=session
 *
 * ⚠ THE `doppler run --config stg --` WRAPPER IS PART OF THE INVOCATION, not
 * decoration. Without it the target is whatever the ambient shell happens to
 * hold, and this script issues a bare session-level `SET` on up to `max`
 * backends of whatever it reaches. `stg` and `prd` are one word apart. The
 * guards in `assertTarget()` below are what make a wrong word refuse instead of
 * connect, and the wrapper is what makes the right word the easy one to type.
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
 *
 * ⚠ BOTH DIRECTIONS IS AN EXIT-CODE PROPERTY, NOT ONLY A PRINTED ONE. `--expect`
 * names which verdict this run asserts; the exit code reports agreement, never
 * the verdict itself. A `SESSION` verdict against `:5432` is a PASS and exits 0.
 * The first version hardcoded `exitCode = 1` on SESSION, so the correct half of
 * the self-test exited non-zero and no caller could tell "detected session mode,
 * as asked" from "the check failed" from "the instrument is broken".
 *
 * ── ⛔ WHY THE READS ARE CONCURRENT, AND WHY THE SEQUENTIAL VERSION LIED ──────
 *
 * The first version awaited each read in turn. postgres.js hands a sequential
 * caller the same pooled socket every time (`open.shift()`, one connection
 * returned before the next asks), so ALL `SAMPLES` reads traversed ONE client
 * socket no matter how large `SAMPLES` was. Against a quiet pool Supavisor then
 * hands that socket the same warm backend at every checkout and does not reset
 * GUCs on check-in — so a correctly-flipped transaction pooler produced one pid
 * and a surviving sentinel, i.e. `VERDICT: SESSION MODE`. **Measured: it did
 * exactly that against a pooler independently proven to be multiplexing.**
 *
 * The version that printed that verdict also advised *"Raise SAMPLES before
 * concluding the flip did not happen."* Raising it changes nothing — every extra
 * sample rides the same socket. The instrument prescribed a remedy it had made
 * useless, which is the failure O-3 names: a true refusal reported with a
 * misleading cause.
 *
 * ⚠ CONCURRENCY ALONE WOULD HAVE TRADED A FALSE NEGATIVE FOR A FALSE POSITIVE,
 * and this is the part worth reading. Under SESSION mode each client socket owns
 * its own pinned backend, so simply firing the reads concurrently yields several
 * distinct pids — and the old `rotated` test (`pids.length > 1`) would have
 * called that TRANSACTION. The old `persisted` test breaks the same way: the
 * sentinel was set on ONE socket, so reads arriving on the other sockets miss it
 * and "the setting dropped" would also read as TRANSACTION. Both signals invert.
 *
 * So the sentinel is PRIMED ON EVERY SOCKET first (phase 1), which is what makes
 * both signals survive concurrency:
 *
 *   SESSION      · C sockets ⇒ C pinned backends, every one of them primed ⇒ the
 *                  sentinel is seen on every read, forever, and the pid set can
 *                  never exceed C.
 *   TRANSACTION  · C simultaneous statements force C distinct checkouts per
 *                  round, so the pool cannot serve the run from one warm
 *                  backend. Reads reach backends that were never primed (the
 *                  sentinel drops) and the pid set grows past C.
 *
 * Either signal alone still establishes transaction mode, exactly as before —
 * what changed is that the experiment can now produce them.
 */

import "server-only";

import { sql } from "drizzle-orm";

import { connectionVarName, db, poolerMode } from "@/db";

/** A sentinel no default and no other code path would ever produce. */
const SENTINEL_MS = 7777;

/** How many ROUNDS of concurrent reads to take. One round cannot see rotation. */
const SAMPLES = 5;

/**
 * How many statements to hold in flight at once.
 *
 * Pinned to the shipped pool's `max` (`src/db/index.ts`). Fewer would leave
 * sockets unprimed, and a read arriving on an unprimed socket looks like a
 * dropped sentinel under BOTH modes — the false positive the docblock describes.
 * More cannot help: postgres.js will not open past `max`, so the extra work
 * queues behind the same sockets and adds latency, not discrimination.
 *
 * ⚠ IF `max` MOVES, THIS MOVES WITH IT. S-5 is authorised to raise `max` once it
 * has measured (ADR-0038 P1.2, decision 2), and this constant is a silent
 * dependency on that number.
 */
const CONCURRENCY = 4;

/**
 * Which verdict this run asserts. `transaction` is the default because the named
 * downstream caller (S-5, before load run #1) is asking "is the flip live?".
 * `--expect=session` is how the other direction gets asserted — against `:5432`,
 * where SESSION is the correct answer and must therefore exit 0.
 */
type Mode = "transaction" | "session";
const EXPECT: Mode = process.argv.includes("--expect=session")
	? "session"
	: "transaction";

/**
 * Refuse a target nobody ratified, BEFORE issuing a single statement.
 *
 * ⚠ THIS SCRIPT WRITES. The bare session-level `SET` is the entire mechanism, so
 * "read-only" is not available as a mitigation — it mutates shared session state
 * on up to `CONCURRENCY` backends of whatever it connects to. Every sibling that
 * reaches a live database fails closed on a project-ref fragment first
 * (`smoke-staging.ts`, `seed-staging.ts`, `migrate-staging.ts`, `migrate-prod.ts`,
 * and the ADR-0035/0036 five-guard contract). This is the only one that did not,
 * and it shipped in the PR that cites those ADRs.
 *
 * ⛔ `src/db/index.ts`'s prod refusal DOES NOT COVER THIS, and the asymmetry is
 * the reason this guard has to exist separately. That one fires only on
 * `mode === "transaction" && ZUGZWANG_ENV === "prod"`. Under
 * `doppler run --config prd` with `DB_POOLER_MODE` unset — the STEADY STATE in
 * `prd` — `mode` resolves to `session`, the refusal never fires, and this script
 * would connect to production and set a GUC there. It protects prod from the
 * transaction POOLER; it does not protect prod from this SCRIPT.
 */
function assertTarget(): void {
	const fragment = process.env.STAGING_PROJECT_REF_FRAGMENT;
	if (!fragment) {
		throw new Error(
			"STAGING_PROJECT_REF_FRAGMENT is not set; cannot verify the target is staging. " +
				"Run via: doppler run --project zugzwang-experiment --config stg -- …",
		);
	}
	const target = process.env[connectionVarName];
	if (!target) {
		// Unreachable in practice — `@/db` throws at import if this is unset — but
		// stated rather than assumed, because this guard must not depend on the
		// import order that makes it unreachable.
		throw new Error(`${connectionVarName} is not set`);
	}
	if (!target.includes(fragment)) {
		throw new Error(
			`${connectionVarName} does not contain STAGING_PROJECT_REF_FRAGMENT; refusing to run. ` +
				"This is the wrong-target case — check the Doppler config (stg, never prd).",
		);
	}
	const env = process.env.ZUGZWANG_ENV;
	if (env !== "staging" && env !== "preview") {
		throw new Error(
			`ZUGZWANG_ENV is ${env === undefined ? "unset" : `"${env}"`}; this script runs against staging or preview only. ` +
				"Refusing rather than guessing.",
		);
	}
}

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

/**
 * Put back what the probe moved.
 *
 * ⚠ THE PROBE MUTATES SHARED STATE, AND UNDER TRANSACTION MODE THAT STATE
 * OUTLIVES THIS PROCESS. A bare session-level `SET` is the whole mechanism here
 * — it has to be session-level or it would prove nothing — but in transaction
 * mode the backend carrying it goes back to the Supavisor pool at check-in, and
 * neither pgbouncer nor Supavisor guarantees a reset on the way in. The sentinel
 * would then be inherited by whatever runs on that backend next.
 *
 * Application transactions are insulated (`SET LOCAL statement_timeout` overrides
 * for the transaction), but a `SET LOCAL` reverts to the SESSION value at COMMIT,
 * so reads issued outside a transaction on that backend would inherit the
 * sentinel. A timeout is a ceiling rather than a bypass, so nothing is unsafe —
 * but the named downstream caller is S-5, running this immediately before load
 * run #1. An instrument that leaves residue in the system it is about to measure
 * is a defect of the instrument.
 *
 * ⛔ CLEANUP IS BEST-EFFORT BY CONSTRUCTION, and that is not a shortcut — it is
 * the same property the probe measures. In transaction mode we cannot address a
 * specific backend: each `RESET` lands wherever the pooler sends it. So we issue
 * them until every polluted pid has been reached, bounded, and REPORT any pid we
 * could not reach rather than implying the cleanup was total.
 */
async function resetSentinel(polluted: Set<number>): Promise<void> {
	if (polluted.size === 0) return;
	const remaining = new Set(polluted);
	// Generous relative to `max: 4`, still bounded — a pooler that never rotates
	// must not spin here.
	const maxAttempts = polluted.size * 8;

	for (let i = 0; i < maxAttempts && remaining.size > 0; i++) {
		const row = firstRowWith<Probe>(
			await db.execute(
				sql`RESET statement_timeout; SELECT current_setting('statement_timeout') AS v, pg_backend_pid() AS pid`,
			),
			"v",
		);
		if (row) remaining.delete(row.pid);
	}

	if (remaining.size === 0) {
		console.log(`cleanup · sentinel reset on all ${polluted.size} backend(s).`);
		return;
	}
	console.warn(
		`⚠ cleanup · could NOT reach backend(s) ${[...remaining].join(", ")} — they`,
	);
	console.warn(
		`  may still carry statement_timeout=${SENTINEL_MS}ms. Harmless (a ceiling,`,
	);
	console.warn(
		"  not a bypass) but say so in the evidence rather than assuming it lapsed.",
	);
}

/** One concurrent read. Returns undefined if the row could not be read. */
async function probeRead(): Promise<Probe | undefined> {
	return firstRowWith<Probe>(
		await db.execute(
			sql`SELECT current_setting('statement_timeout') AS v, pg_backend_pid() AS pid`,
		),
		"v",
	);
}

async function main(): Promise<void> {
	console.log(
		"verify-pooler-mode — is this pooler in transaction or session mode?",
	);

	// ⛔ BEFORE THE FIRST STATEMENT. A wrong target must refuse, not connect.
	assertTarget();

	console.log(`pooler port: ${poolerPort()}`);
	console.log(`asserting  : ${EXPECT.toUpperCase()} MODE (--expect)`);
	console.log("");

	// ── PHASE 1 · PRIME ────────────────────────────────────────────────────────
	// Set the sentinel on EVERY socket the pool will open, concurrently, and read
	// it back in the same call so we know each SET was accepted. Priming all of
	// them is what keeps both signals meaningful under concurrency — see the
	// docblock. If any of these fails, the probe is broken and neither verdict
	// below means anything.
	const primed = await Promise.all(
		Array.from({ length: CONCURRENCY }, async () =>
			firstRowWith<Probe>(
				await db.execute(
					sql`SET statement_timeout = ${sql.raw(`'${SENTINEL_MS}ms'`)}; SELECT current_setting('statement_timeout') AS v, pg_backend_pid() AS pid`,
				),
				"v",
			),
		),
	);
	for (const [i, row] of primed.entries()) {
		console.log(
			`prime ${i + 1} · set + read back : ${row?.v} (backend ${row?.pid})`,
		);
	}

	const primedOk = primed.filter(
		(r): r is Probe => r?.v === `${SENTINEL_MS}ms`,
	);
	if (primedOk.length !== CONCURRENCY) {
		console.error("");
		console.error(
			`⛔ CONTROL BROKEN — the SET took on ${primedOk.length}/${CONCURRENCY} sockets.`,
		);
		console.error(
			"   Neither verdict is available. Do not record any criterion.",
		);
		// Some SETs may already have landed, so clean up even on the broken path.
		await resetSentinel(new Set(primedOk.map((r) => r.pid)));
		process.exitCode = 2;
		return;
	}
	const primedPids = new Set(primedOk.map((r) => r.pid));
	console.log("");

	// ── PHASE 2 · SAMPLE ───────────────────────────────────────────────────────
	// `SAMPLES` rounds of `CONCURRENCY` SIMULTANEOUS reads. The simultaneity is
	// the experiment: it forces the pooler to hold that many checkouts at once,
	// so it cannot serve the whole run from one warm backend the way the old
	// sequential loop allowed.
	const observations: Probe[] = [];
	for (let round = 0; round < SAMPLES; round++) {
		const rows = await Promise.all(
			Array.from({ length: CONCURRENCY }, () => probeRead()),
		);
		if (rows.some((r) => r === undefined)) {
			console.error("");
			console.error("⛔ CONTROL BROKEN — a follow-up read returned no row.");
			await resetSentinel(
				new Set([
					...primedPids,
					...observations
						.filter((o) => o.v === `${SENTINEL_MS}ms`)
						.map((o) => o.pid),
				]),
			);
			process.exitCode = 2;
			return;
		}
		const round_ = rows as Probe[];
		observations.push(...round_);
		console.log(
			`round ${round + 1} · ${round_.map((r) => `${r.v}@${r.pid}`).join("  ")}`,
		);
	}
	console.log("");

	const pids = [...new Set([...primedPids, ...observations.map((o) => o.pid)])];

	// ⚠ THE TWO SIGNALS, RESTATED FOR THE CONCURRENT PROBE.
	//
	// `sentinelDropped` — a read reached a backend that was never primed. Under
	// session mode every socket is primed and pinned, so this cannot happen.
	//
	// `exceededSockets` — more distinct backends than we hold sockets. Under
	// session mode the pid set is bounded BY the socket count, permanently; only
	// a pooler that returns backends between statements can exceed it.
	//
	// The old `rotated` test (`pids.length > 1`) is GONE, and deliberately: under
	// concurrency it is true in both modes, so keeping it would have made every
	// session-mode run report TRANSACTION.
	const sentinelDropped = observations.some((o) => o.v !== `${SENTINEL_MS}ms`);
	const exceededSockets = pids.length > CONCURRENCY;

	console.log(`backends seen  : ${pids.length} (${pids.join(", ")})`);
	console.log(`sockets primed : ${CONCURRENCY}`);
	console.log(
		`sentinel held  : ${sentinelDropped ? "NOT on every read" : "every read"}`,
	);
	console.log("");

	// Put the sentinel back BEFORE printing a verdict, so the cleanup line sits
	// with the evidence it belongs to rather than after the conclusion.
	const polluted = new Set<number>([
		...primedPids,
		...observations.filter((o) => o.v === `${SENTINEL_MS}ms`).map((o) => o.pid),
	]);
	await resetSentinel(polluted);
	console.log("");

	// EITHER signal alone establishes transaction mode. Session mode requires
	// BOTH to be absent.
	const verdict: Mode =
		sentinelDropped || exceededSockets ? "transaction" : "session";

	if (verdict === "transaction") {
		console.log("VERDICT: TRANSACTION MODE.");
		if (sentinelDropped) {
			console.log(
				"  A read reached a backend that was never primed, so backends are",
			);
			console.log("  being returned to the pool between statements.");
		}
		if (exceededSockets) {
			console.log(
				`  ${pids.length} distinct backends served ${CONCURRENCY} sockets, so a socket`,
			);
			console.log("  does not own its backend.");
		}
	} else {
		console.log("VERDICT: SESSION MODE.");
		console.log(
			`  Across ${SAMPLES} rounds of ${CONCURRENCY} simultaneous reads the sentinel`,
		);
		console.log(
			`  survived on every one and no more than ${CONCURRENCY} backends appeared,`,
		);
		console.log("  so each socket is pinned to its own backend.");
	}
	console.log("");

	// ── THE EXIT CODE REPORTS AGREEMENT, NEVER THE VERDICT ─────────────────────
	// 0 = the pooler is what --expect asked for · 1 = it is the other one ·
	// 2 = the instrument could not answer (set above, never here).
	if (verdict === EXPECT) {
		console.log(`✅ PASS — expected ${EXPECT}, observed ${verdict}.`);
		if (EXPECT === "transaction") console.log("  Criterion 6 fires.");
		return;
	}

	console.log(`⛔ FAIL — expected ${EXPECT}, observed ${verdict}.`);
	if (EXPECT === "transaction") {
		console.log(
			"  CRITERION 6 FAILS and every other observation against this pooler",
		);
		console.log("  is void. Do not record any criterion.");
	} else {
		console.log(
			"  The both-directions self-test did not hold: this connection was",
		);
		console.log(
			"  expected to be a session pooler. Check which URL was resolved",
		);
		console.log("  before concluding anything about transaction mode.");
	}
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
