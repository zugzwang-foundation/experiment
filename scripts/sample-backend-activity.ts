/**
 * SAMPLE BACKEND ACTIVITY — what is `pg_stat_activity` doing while something else runs?
 *
 * A sampling loop over `pg_stat_activity`, recording every client backend's
 * `state`, `xact_start`, `query_start`, `state_change` and wait event on a fixed
 * period, to a JSONL record. It observes; it never drives.
 *
 * ⚠ NAMED DOWNSTREAM CALLER: **S-5**, the load programme. W-10 records that after
 * the S-1 flip an overloaded pool QUEUES rather than erroring — a saturated run
 * reports zero errors and looks healthy. So "it looked fine" is not available as
 * evidence, and run #1 has to watch queue depth and backend utilisation directly.
 * This is that instrument.
 *
 * ── ⛔ WHY THIS DOES NOT USE THE SHIPPED `@/db` CLIENT ────────────────────────
 *
 * **Read this before "fixing" the import to match `scripts/verify-pooler-mode.ts`.**
 *
 * That script MUST use the shipped singleton: it measures the pooler the app
 * actually opens, so a copied client would be exercising a connection nobody
 * ships. **This script must NOT**, and for the opposite reason: it observes a
 * pooler, so it must not reach the database THROUGH the pooler under test. An
 * observation multiplexed through the thing being observed cannot tell the
 * subject from the instrument — S-1 plan §4, property 1.
 *
 * ⚠ TWO SCRIPTS, TWO OPPOSITE RULES, BOTH CORRECT. Making them consistent would
 * quietly destroy this one. It therefore opens its OWN `postgres()` client on
 * `DATABASE_URL` (the `:5432` session pooler) and REFUSES to start if that
 * resolves to `:6543`. This is the case AGENTS.md §7 describes — a tsx script
 * inlining its own client — and it conforms.
 *
 * A second reason, learned the hard way: the shipped pool sets `idle_timeout: 20`,
 * so a held connection drops after ~20 s and manufactures the very "no persisting
 * backend" reading a hold test exists to measure. An instrument that produces its
 * own result is not an instrument.
 *
 * ── HOW TO RUN ───────────────────────────────────────────────────────────────
 *
 *   doppler run --project zugzwang-experiment --config stg -- \
 *     pnpm tsx scripts/sample-backend-activity.ts
 *
 *   # prove the sampler can actually see a transaction before trusting a quiet screen:
 *   … scripts/sample-backend-activity.ts --self-test
 *
 * Env: `SAMPLE_SECONDS` (default 60) · `SAMPLE_PERIOD_MS` (default 200) ·
 * `SAMPLE_OUT` (default `./sample-backend-activity.jsonl`).
 *
 * ── ⚠ A QUIET SCREEN IS NOT A FINDING UNTIL --self-test HAS PASSED ───────────
 *
 * Print-on-change means a quiet database prints nothing — which is indistinguish-
 * able from a sampler that is blind. `--self-test` opens a deliberate READ ONLY
 * transaction on a second connection and asserts the sampler sees it. **Measured
 * 2026-08-24: the live screen missed a real 1.7 s bet transaction entirely**, and
 * the run was only saved because the JSONL captures every backend's timestamps
 * every period, so the transaction was recoverable from the residue afterwards.
 * **The console is not the record. The JSONL is.**
 *
 * ⚠ Correlating this record against a wall clock needs the CLOCK OFFSET, which is
 * why it is taken at start AND end below and written into the record.
 *
 * ⛔ THE OFFSET IS A MEASUREMENT, NOT A CONSTANT — do not carry a number for it.
 * Observed on staging across two days: ≈ +3.3 s, then ≈ +4.2 s, then ≈ −0.2 s. It
 * has changed sign. It also drifts within a single run (~0.3 s over 60 s). Reading
 * a burst against an uncorrected local timestamp is what once made a real burst
 * look like it never reached the database at all — so take the offset from the
 * record of the run you are reading, never from this comment or from memory.
 */

import { appendFileSync, writeFileSync } from "node:fs";

import postgres from "postgres";

const SECONDS = Number(process.env.SAMPLE_SECONDS ?? 60);
const PERIOD_MS = Number(process.env.SAMPLE_PERIOD_MS ?? 200);
const OUT = process.env.SAMPLE_OUT ?? "./sample-backend-activity.jsonl";
const SELF_TEST = process.argv.includes("--self-test");
const SELF_TEST_HOLD_S = 4;

interface Row {
	pid: number;
	state: string;
	backend_start: string;
	xact_start: string | null;
	query_start: string | null;
	state_change: string | null;
	wait_event_type: string | null;
	wait_event: string | null;
	has_xid: boolean;
	q: string;
}

/**
 * Refuse a target nobody ratified, BEFORE the first statement.
 *
 * Same contract as `scripts/verify-pooler-mode.ts` and every sibling that reaches
 * a live database (`smoke-staging.ts`, `seed-staging.ts`, `migrate-staging.ts`).
 * This one only READS `pg_stat_activity` — but a read against the wrong database
 * is still a wrong-target run, and the refusal must not depend on the caller
 * having reasoned about blast radius.
 *
 * Exit 2 on refusal, matching `verify-pooler-mode.ts`: 2 means the instrument
 * could not answer, which is a different fact from any answer it might give.
 */
function resolveTarget(): string {
	const url = process.env.DATABASE_URL;
	if (!url) throw new Error("DATABASE_URL is not set");

	// ⛔ THE OBSERVING CHANNEL MUST NOT BE THE POOLER UNDER TEST (§4 property 1).
	if (url.includes(":6543")) {
		throw new Error(
			"REFUSED: DATABASE_URL resolves to :6543. This observes a pooler, so it must " +
				"not reach the database through the pooler under test. Use the :5432 session pooler.",
		);
	}

	const fragment = process.env.STAGING_PROJECT_REF_FRAGMENT;
	if (!fragment) {
		throw new Error(
			"STAGING_PROJECT_REF_FRAGMENT is not set; cannot verify the target is staging. " +
				"Run via: doppler run --project zugzwang-experiment --config stg -- …",
		);
	}
	if (!url.includes(fragment)) {
		throw new Error(
			"DATABASE_URL does not contain STAGING_PROJECT_REF_FRAGMENT; refusing to run. " +
				"This is the wrong-target case — check the Doppler config (stg, never prd).",
		);
	}

	const env = process.env.ZUGZWANG_ENV;
	if (env !== "staging" && env !== "preview") {
		throw new Error(
			`ZUGZWANG_ENV is ${env === undefined ? "unset" : `"${env}"`}; this script runs against staging or preview only. Refusing rather than guessing.`,
		);
	}
	return url;
}

async function clockOffset(sql: postgres.Sql): Promise<{
	offsetSec: number;
	rttMs: number;
	dbNow: string;
	localNow: string;
}> {
	const before = Date.now();
	const [r] = await sql`SELECT now() AS db_now`;
	const after = Date.now();
	const mid = (before + after) / 2;
	const db = new Date(r?.db_now as string).getTime();
	return {
		offsetSec: (db - mid) / 1000,
		rttMs: after - before,
		dbNow: new Date(db).toISOString(),
		localNow: new Date(mid).toISOString(),
	};
}

/**
 * The positive control, folded into the instrument it validates.
 *
 * ⚠ DELIBERATELY NOT A SEPARATE FILE. A control that lives beside its instrument
 * drifts from it: the sampler gets edited, the control keeps passing against the
 * shape it remembers, and nobody notices until a run that mattered comes back
 * empty. Here it exercises the same query on the same connection settings.
 *
 * READ ONLY, takes no locks, holds no rows, commits itself — so it leaves nothing
 * to clean up. That is structural rather than lucky, and it matters on Windows,
 * where a probe's SIGTERM handler is not reliably delivered and cleanup-on-signal
 * cannot be depended on.
 */
async function runSelfTestHolder(url: string): Promise<number> {
	const holder = postgres(url, { max: 1, idle_timeout: 20, prepare: false });
	try {
		const [{ pid }] =
			(await holder`SELECT pg_backend_pid() AS pid`) as unknown as [
				{ pid: number },
			];
		await holder.begin(async (tx) => {
			await tx`SET TRANSACTION READ ONLY`;
			await tx`SELECT pg_sleep(${SELF_TEST_HOLD_S})`;
		});
		return pid;
	} finally {
		await holder.end({ timeout: 5 });
	}
}

async function main(): Promise<void> {
	const url = resolveTarget();
	const sql = postgres(url, { max: 1, idle_timeout: 30, prepare: false });

	try {
		const start = await clockOffset(sql);
		writeFileSync(
			OUT,
			`${JSON.stringify({ kind: "clock", when: "start", ...start })}\n`,
		);
		console.log(
			`observing :5432 | clock offset db-local = ${start.offsetSec.toFixed(2)}s (rtt ${start.rttMs}ms)`,
		);
		console.log(`sampling every ${PERIOD_MS}ms for ${SECONDS}s -> ${OUT}`);
		console.log(`local start ${start.localNow} / db start ${start.dbNow}`);
		if (SELF_TEST) {
			console.log(
				`--self-test: a READ ONLY transaction will be held for ${SELF_TEST_HOLD_S}s; the sampler MUST see it.`,
			);
		}
		console.log(
			"\n  ROWS BELOW ARE CHANGES ONLY — a quiet screen means a quiet database,\n" +
				"  but only once --self-test has passed. The JSONL is the record.\n",
		);

		// Fire the control alongside the loop rather than before it: the point is
		// that the sampler sees a transaction that is live WHILE it is sampling.
		let holderPid: number | undefined;
		const holder = SELF_TEST
			? runSelfTestHolder(url).then((pid) => {
					holderPid = pid;
					return pid;
				})
			: undefined;

		const deadline = Date.now() + SECONDS * 1000;
		let lastKey = "";
		let samples = 0;
		let maxBackends = 0;
		const seenPids = new Set<number>();
		const xactPids = new Set<number>();

		while (Date.now() < deadline) {
			const t0 = Date.now();
			let rows: Row[];
			try {
				rows = (await sql`
          SELECT pid, state, backend_start, xact_start, query_start, state_change,
                 wait_event_type, wait_event, backend_xid IS NOT NULL AS has_xid,
                 left(regexp_replace(query, '[[:space:]]+', ' ', 'g'), 140) AS q
            FROM pg_stat_activity
           WHERE datname = current_database()
             AND backend_type = 'client backend'
             -- Exclude THIS sampler's own backend. An instrument that produces
             -- its own result is not an instrument.
             AND pid <> pg_backend_pid()
           ORDER BY pid`) as unknown as Row[];
			} catch (e) {
				console.error(`sample error: ${(e as Error).message}`);
				await new Promise((r) => setTimeout(r, PERIOD_MS));
				continue;
			}

			samples += 1;
			maxBackends = Math.max(maxBackends, rows.length);
			for (const r of rows) {
				seenPids.add(Number(r.pid));
				if (r.xact_start) xactPids.add(Number(r.pid));
			}
			const stamp = new Date().toISOString();
			appendFileSync(
				OUT,
				`${JSON.stringify({ kind: "sample", localAt: stamp, n: rows.length, rows })}\n`,
			);

			const busy = rows.filter((r) => r.state !== "idle" || r.xact_start);
			const key = `${busy
				.map((r) => `${r.pid}:${r.state}:${r.query_start}:${r.xact_start}`)
				.join("|")}#${rows.length}`;
			if (key !== lastKey) {
				lastKey = key;
				for (const r of busy) {
					const inXact = r.xact_start
						? `XACT since ${new Date(r.xact_start).toISOString().slice(11, 23)}`
						: "-";
					const wait = r.wait_event
						? `${r.wait_event_type}/${r.wait_event}`
						: "-";
					console.log(
						`${stamp.slice(11, 23)} pid=${r.pid} ${String(r.state).padEnd(19)} ${inXact.padEnd(30)} xid=${r.has_xid ? "Y" : "n"} wait=${String(wait).padEnd(18)} n=${rows.length} :: ${r.q}`,
					);
				}
			}
			const elapsed = Date.now() - t0;
			if (elapsed < PERIOD_MS) {
				await new Promise((r) => setTimeout(r, PERIOD_MS - elapsed));
			}
		}

		if (holder) await holder;

		const end = await clockOffset(sql);
		appendFileSync(
			OUT,
			`${JSON.stringify({ kind: "clock", when: "end", ...end })}\n`,
		);
		appendFileSync(
			OUT,
			`${JSON.stringify({ kind: "summary", samples, maxBackends, distinctPids: [...seenPids], pidsSeenInXact: [...xactPids] })}\n`,
		);

		console.log("\n== SAMPLER DONE ==");
		console.log(
			`samples=${samples}  maxBackends=${maxBackends}  distinctPids=${seenPids.size}  pidsEverInXact=${[...xactPids].join(",") || "none"}`,
		);
		console.log(`clock offset end = ${end.offsetSec.toFixed(2)}s`);
		console.log(`record: ${OUT}`);

		if (SELF_TEST) {
			const saw = holderPid !== undefined && xactPids.has(holderPid);
			console.log("");
			if (saw) {
				console.log(
					`✅ SELF-TEST PASS — the held transaction on backend ${holderPid} was observed.`,
				);
				console.log(
					"  A quiet screen from this sampler can now be read as a quiet database.",
				);
			} else {
				console.log(
					`⛔ SELF-TEST FAIL — backend ${holderPid ?? "?"} held a READ ONLY transaction for`,
				);
				console.log(
					`  ${SELF_TEST_HOLD_S}s and this sampler did not see it. The instrument is blind;`,
				);
				console.log(
					"  any quiet run recorded with it proves nothing. Do not record an observation.",
				);
				process.exitCode = 2;
			}
		}
	} finally {
		await sql.end({ timeout: 5 });
	}
}

main().catch((err: unknown) => {
	console.error("[sample-backend-activity]", err);
	// 2 = the instrument could not answer (refused, or broke). Never 1, which is
	// reserved for a run that answered and disagreed with what was asserted.
	process.exitCode = 2;
});
