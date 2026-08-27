import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db";
import { identityPool } from "@/db/schema";
import { auth } from "@/server/auth/index";
import { testClient, testDb } from "../db/_fixtures/db";
import { truncateTables } from "../db/_fixtures/truncate";

// ═══════════════════════════════════════════════════════════════════════════
// S-3 · Test 1 — the deadlock. THE CONTROL, AND THE PERMANENT REGRESSION.
// Plan: docs/plans/S-3.md §"The demonstration" · constraints C-1, C-2, C-3,
// C-3a. The plan is the authority; this docblock only restates what a reader
// of the FILE has to know before the first assertion makes sense.
//
// ⛔ THIS FILE IS EXPECTED **RED** BEFORE THE FIX AND **GREEN** AFTER IT, AND
//    IT RUNS UNCHANGED IN BOTH PHASES.
//
//   PRE-FIX  (the `transaction` key of the `drizzleAdapter(db, {...})` call in
//            `src/server/auth/index.ts` still reads `true`):
//            the N `createOAuthUser` calls NEVER RESOLVE, and the intersection
//            of `idle in transaction` pids across the window is N — the same N
//            backends, never moving. ASSERT 1 and ASSERT 2 are SOFT, so BOTH
//            report red in the same run rather than the settle aborting before
//            the intersection is ever evaluated.
//   POST-FIX (`transaction: true` dropped): all N resolve well inside the
//            bound, and the intersection is 0 — transactions opened and closed,
//            pids churned.
//
// The pre-fix numbers are NOT asserted here. They are recorded in the step-4
// run record, from the `[S-3]` diagnostics this file prints. A file that
// asserted the pre-fix values could not also be the post-fix exit criterion,
// and step 6 re-runs this file unchanged at the same N.
//
// ── THE DEFECT ─────────────────────────────────────────────────────────────
// The `transaction` key of the `drizzleAdapter(db, {...})` call in
// `src/server/auth/index.ts` is set to `true`, so `createOAuthUser` holds ONE pooled connection open for the whole
// of its transaction. Inside that transaction the `user.create.before` hook
// calls `consumeIdentityPoolTuple(db)` on the MODULE-LEVEL `db` — which opens a
// SECOND `db.transaction` (`src/server/identity-pool/consume.ts:28`), and
// therefore checks out a SECOND connection from the SAME pool.
// `src/db/index.ts:96` sets `max: 4`. Four concurrent signups each hold one
// slot and each wait for a second slot that no one will ever release. Nothing
// on either side ends the standoff: postgres.js has no acquire timeout, and a
// backend idle in transaction never arms `statement_timeout`.
//
// ── WHY A TRANSACTION STILL EXISTS AFTER THE FIX (C-2, ratification A-4) ────
// The fix removes ONE transaction, not every transaction. `consume.ts`'s own
// `db.transaction(...)` survives BYTE FOR BYTE — it must, it is what makes the
// `SELECT … FOR UPDATE SKIP LOCKED` + `UPDATE assigned_at` allocation atomic.
// Between those two statements there is a client round-trip, and for that
// round-trip the backend holds an open transaction running no query: that is
// literally `state = 'idle in transaction'`. So a post-fix run WILL sample
// `idle in transaction` backends, and an assertion of "zero backends idle in
// transaction" would fail a correct fix at the exit criterion, where it is
// most expensive.
//
//   ⇒ THE POST-FIX DISCRIMINATOR IS **PERSISTENCE**, NOT **PRESENCE**.
//     Pre-fix the same pids appear in EVERY sample. Post-fix pids churn and
//     none survives the window. Hence: intersection across samples, not count.
//
// ⚠ `consume.ts`'s own comment (the "Stranded-tuple semantic" block,
//   consume.ts:18-23) is WRONG, and it is the first thing the next reader will
//   find when they ask why a transaction is still there. It tells them Better
//   Auth's OAuth flow does NOT wrap the user create in a transaction — which is
//   exactly the premise under which nesting a second checkout inside it looks
//   free. On `83cf6fb` the adapter's `transaction: true` means `createOAuthUser`
//   DOES run inside one adapter transaction on one pooled connection. That is
//   finding **S3-8**: report, do not fix — it is not this file's to correct, and
//   it is named here so the next reader distrusts the comment rather than this
//   test.
//
// ── ASSERT 2's WINDOW: FROM THE FIRST NON-EMPTY IDLE SAMPLE ────────────────
// Founder ruling at the step-4 correction, option 1. The intersection is taken
// over samples starting at the FIRST NON-EMPTY idle sample, not over every
// sample taken.
//
// Why: sample 0 is deliberately taken the instant the burst is fired, before
// the transactions have opened, so it is empty. Intersecting across ALL samples
// let that one empty warm-up sample collapse the result to zero — and zero is
// the POST-fix expectation. The first step-4 run measured exactly that:
// `intersectionSize: 0` on UNFIXED code, while samples 1..22 intersected to
// the four wedged pids. ASSERT 2 passed pre-fix, which made it vacuous: it
// would have passed in both phases for opposite reasons and certified a fix it
// never tested at step 6, the exit criterion. A false GREEN.
//
// The window definition states the property C-2 actually names — "the same N
// backends, never moving" — and depends on no constant, no magic warm-up count
// that would rot the moment timings shift.
//
// ⚠ THE RESIDUAL EDGE CASE, AND ITS DIRECTION. Post-fix, if the ONLY non-empty
// idle sample is the LAST one, the window is a single sample and the
// intersection is that sample — non-empty. ASSERT 2 then goes red on a correct
// fix: a FALSE RED. That is accepted deliberately, because the two failure
// directions are not symmetric — today's defect is a false GREEN, which is
// silent and certifies nothing; a false RED is loud and gets read. If step 6
// reds on ASSERT 2 with `windowSize: 1`, DIAGNOSE THAT FIRST — it is this edge
// case, not a failed fix. The diagnostics below print `windowStart` and
// `windowSize` for exactly that reason.
//
// ── WHY `afterEach` TRUNCATE DOES **NOT** BLOCK PRE-FIX ─────────────────────
// Recorded because the opposite was predicted, and step 6 must not inherit the
// prediction. It was reasoned that the wedged transactions would hold
// `identity_pool` locks, that TRUNCATE needs ACCESS EXCLUSIVE, and that the
// teardown hook would therefore queue behind them and time out.
//
// It does not, and the run says why in its own evidence: `last_query` on all
// four wedged backends is **`"begin "`** and nothing after it. The outer
// transaction executed nothing past BEGIN, because `user.create.before` blocks
// waiting for a second pooled connection BEFORE `consume.ts` ever reaches its
// `SELECT … FOR UPDATE SKIP LOCKED`. No `identity_pool` row lock is ever
// acquired, so TRUNCATE has nothing to queue behind. Measured after the first
// step-4 run: every table empty, and all 26 `bucket_%` no-truncate guards back
// to enabled with none stranded.
//
// ── WHY ITS OWN FILE ───────────────────────────────────────────────────────
// Once the pool wedges, everything sharing the process wedges. Vitest isolates
// per file (`vitest.config.ts` → `pool: "forks"`, `isolate: true`,
// `fileParallelism: false`), so the blast radius is this file.
//
// ── THE OBSERVATION CHANNEL ────────────────────────────────────────────────
// `tests/db/_fixtures/db.ts` builds `testClient` / `testDb` as two SEPARATE
// `postgres(connectionString, { max: 1 })` handles — distinct pools from
// `@/db`'s. They still answer while the application pool is wedged, which is
// the whole reason `pg_stat_activity` is readable from inside the wedge.
// The application pool is genuinely reached: `vitest.config.ts` aliases
// `server-only` to a no-op shim, so `@/server/auth/index` → `@/db` resolves to
// the real client with the shipped `max`.
//
// Entry point is the one `signup-create-path.integration.test.ts` already uses:
// `await auth.$context` → `ctx.internalAdapter.createOAuthUser(...)`, the exact
// call `oauth2/link-account.mjs:91-94` makes. No mocking of the adapter, the
// databaseHooks, or `consumeIdentityPoolTuple` — the defect IS the nesting, so
// a mock anywhere in that chain would mask it.
// ═══════════════════════════════════════════════════════════════════════════

// ─── C-3a · PRE-FLIGHT, AT MODULE SCOPE — BEFORE A SINGLE ROW IS WRITTEN ────
// Module scope, not `beforeAll`: `beforeEach` writes rows, and this is the only
// thing standing between a stale developer config and POOL_MAX concurrent
// signups fired at staging.
//
// It reads the SHIPPED host off the live client, never `process.env`:
// `src/db/index.ts` selects between DATABASE_URL and DATABASE_URL_TXN on
// DB_POOLER_MODE, so a pre-flight reading one env var can certify an endpoint
// the pool never connected to. Session mode makes them identical today — a
// coincidence of configuration, not a property.
//
// `.every()`, never `[0]`: postgres.js `ParsedOptions` narrows `host` to
// `string[]` because it supports a multi-host failover list, and ONE
// non-loopback element in that list is reachable on a retry the pre-flight
// never inspected.
//
// A loud throw, never a `console.warn` — O-1, structural beats procedural.
const LOOPBACK = new Set(["localhost", "127.0.0.1", "::1"]);
const hosts = db.$client.options.host;
if (hosts.length === 0 || !hosts.every((h) => LOOPBACK.has(h))) {
	throw new Error(
		`S-3 demonstration refuses to run against non-loopback host(s): ${hosts.join(", ")}. ` +
			"It fires db.$client.options.max concurrent signups and wedges the pool by design.",
	);
}

// ─── C-1 · N DERIVES FROM THE SHIPPED `max`, GUARDED BY A BOUND ────────────
// Calibration: first measured at max: 4 (S-3, 2026-08-27).
// N self-calibrates — a nested-checkout deadlock fires at exactly `max`,
// whatever `max` is; the structure is max-independent. Never hardcode N = 4:
// an equality guard would only schedule a CI break for the day S-5 raises the
// pool. The bound below is a PRACTICALITY limit, not a correctness one — above
// 16 this test fires more than sixteen concurrent signups on every CI run and
// has become impractical rather than merely recalibrated.
const POOL_MAX = db.$client.options.max;
if (POOL_MAX > 16) {
	throw new Error(
		`S-3 demonstration fires POOL_MAX concurrent signups; src/db/index.ts now reports ` +
			`max: ${POOL_MAX}, above the practical ceiling of 16. Re-scope the demonstration ` +
			"before trusting it. See docs/adr/0042.",
	);
}
const N = POOL_MAX;

// ─── Timings ───────────────────────────────────────────────────────────────
// The poll window is bounded and never a single bare sleep (C-2 step 2). The
// first sample is taken IMMEDIATELY after the burst is fired (query first, then
// sleep).
//
// ⚠ THE INTERVAL IS 25 ms, NOT 250 ms, AND THAT IS A MEASUREMENT NOT A TASTE.
// NOT ESTABLISHED #7 asks whether the poll reliably overlaps a fast burst. It
// does not, at 250 ms: the first step-4 run measured the N=3 clean leg
// witnessing live work in exactly **1 sample out of 23**, because three
// unwedged signups finish in ~167 ms each and the whole burst is over inside a
// single 250 ms gap. Guard 2 requires >= 1 witness sample, so that run cleared
// its floor by one sample.
//
// That thinness is a step-6 hazard rather than a step-4 one. Post-fix the N=4
// burst behaves like the N=3 burst — fast — so a Guard 2 red would look exactly
// like a failed fix while actually being a poll that missed. Dropping to 25 ms
// puts ~7 samples inside a ~170 ms burst instead of ~1, which moves the margin
// off the floor. The window stays 6 s: shortening the interval buys overlap
// resolution, and the window is what buys PERSISTENCE evidence for ASSERT 2.
const POLL_INTERVAL_MS = 25;
const POLL_WINDOW_MS = 6_000;

// The bounded settle race. Pre-fix the pool wedges with NO acquire timeout, so
// an unbounded `await Promise.allSettled(inflight)` hangs rather than fails.
// Racing it against this deadline turns a wedge into a clean deterministic RED
// with the diagnostics intact, instead of a raw runner timeout that prints
// nothing.
const SETTLE_BUDGET_MS = 20_000;

// Explicit per-test timeout (3rd arg to `it`). `vitest.config.ts` defaults to
// testTimeout: 10_000, which is shorter than POLL_WINDOW_MS + SETTLE_BUDGET_MS
// on its own — a default-timeout run would abort mid-poll and report a runner
// timeout in place of the measurement. 60 s leaves headroom over the ~26 s
// worst case (6 s poll + 20 s settle + teardown) without ever becoming the
// mechanism that ends a wedge; the bounded race above is what ends it.
const TEST_TIMEOUT_MS = 60_000;

// ─── Fixtures ──────────────────────────────────────────────────────────────
// N identity_pool tuples with DISTINCT (colour, animal, number) triples so both
// `identity_pool_tuple_idx` (unique on the triple) and the `pseudonym` unique
// hold at N up to the ceiling. The hook composes
// pseudonym = `${colour}${animal}${number padded to 3}` (consume.ts:53).
const TUPLES = Array.from({ length: N }, (_, i) => {
	const suffix = String(i).padStart(3, "0");
	return {
		colour: "Red",
		animal: "Fox",
		number: i,
		pseudonym: `RedFox${suffix}`,
		pfpFilename: `redfox${suffix}.png`,
	};
});

// Distinct emails and distinct accountIds — N concurrent signups must be N
// distinct users, or the burst collapses into a uniqueness conflict and stops
// being a concurrency measurement.
function userPayloadFor(i: number) {
	const sub = `google-sub-pool-deadlock-${String(i).padStart(3, "0")}`;
	return {
		email: `pool-deadlock-${String(i).padStart(3, "0")}@example.com`,
		name: `Pool Deadlock ${i}`,
		image: "https://example.com/avatar.png",
		emailVerified: true,
		googleId: sub,
	};
}

function accountDataFor(i: number) {
	const sub = `google-sub-pool-deadlock-${String(i).padStart(3, "0")}`;
	return {
		providerId: "google",
		accountId: sub,
		accessToken: "test-access-token",
		refreshToken: "test-refresh-token",
		idToken: "test-id-token",
		scope: "openid email profile",
		accessTokenExpiresAt: null,
		refreshTokenExpiresAt: null,
	};
}

// truncateTables (not DELETE): identity_pool carries a Bucket-B BEFORE DELETE
// no-delete trigger and, since 0021, a no-truncate guard; the fixture disables
// the guards for exactly one teardown transaction. `events` is listed because
// the signup hook emits `user.pseudonym_assigned` rows that no CASCADE reaches.
// Same six tables as signup-create-path.integration.test.ts.
//
// ⚠ PRE-FIX this teardown is EXPECTED TO BLOCK: the wedged backends hold
// uncommitted `FOR UPDATE` / `UPDATE identity_pool` locks, and TRUNCATE needs
// ACCESS EXCLUSIVE. Vitest's 10 s hookTimeout bounds it and the fork is torn
// down after the file, which closes the connection and cancels the query.
// Abandoning that await cannot strand disabled guards: `truncateTables` issues
// disable → truncate → enable as ONE parameterless `.unsafe()` round-trip, i.e.
// one implicit transaction, so a batch that never commits never made the
// disable visible to any other session. Post-fix nothing is holding a lock and
// the teardown is ordinary.
async function truncateAll(): Promise<void> {
	await truncateTables(testClient, [
		"users",
		"accounts",
		"sessions",
		"identity_pool",
		"verifications",
		"events",
	]);
}

// Row by row, not one multi-row INSERT: consume.ts's FIFO order is
// `created_at, id`, and batching would stamp every row with the same `now()`.
// Irrelevant to this test's assertions, deliberately not modelled wrong anyway.
async function seedTuples(): Promise<void> {
	for (const tuple of TUPLES) {
		await testDb.insert(identityPool).values({ ...tuple, assignedAt: null });
	}
}

// ─── Observation types + helpers ───────────────────────────────────────────
type ActivityRow = {
	pid: number;
	state: string | null;
	wait_event_type: string | null;
	wait_event: string | null;
	in_xact: unknown;
	last_query: string | null;
};

type RequestOutcome = {
	index: number;
	status: "fulfilled" | "rejected";
	ms: number;
	error: string | null;
};

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => {
		setTimeout(resolve, ms);
	});
}

// Bounded race. The timer is CLEARED in `finally` rather than unref'd — the
// losing branch must not hold the worker open, and `unref` is not reliably
// typed here (tsconfig `lib` includes "dom", so the global setTimeout overload
// can resolve to the DOM one returning `number`).
async function withDeadline<T>(p: Promise<T>, ms: number): Promise<T | null> {
	let timer: ReturnType<typeof setTimeout> | undefined;
	const deadline = new Promise<null>((resolve) => {
		timer = setTimeout(() => resolve(null), ms);
	});
	try {
		return await Promise.race([p, deadline]);
	} finally {
		clearTimeout(timer);
	}
}

// The persistence discriminator, over the window that STARTS AT THE FIRST
// NON-EMPTY IDLE SAMPLE (founder ruling, step-4 correction option 1 — the long
// note in the file docblock explains why, and names the false-RED edge case
// this deliberately accepts).
//
// If NO sample is non-empty the window is empty and so is the intersection —
// which is the correct post-fix reading (nothing ever sat idle in a
// transaction) and is separately protected from vacuity by the
// >= 3-samples-TAKEN guard.
function intersectFromFirstNonEmpty(samples: readonly (readonly number[])[]): {
	intersection: Set<number>;
	windowStart: number;
	windowSize: number;
} {
	const windowStart = samples.findIndex((s) => s.length > 0);
	if (windowStart === -1) {
		return { intersection: new Set<number>(), windowStart: -1, windowSize: 0 };
	}
	const window = samples.slice(windowStart);
	let acc = new Set<number>(window[0]);
	for (let i = 1; i < window.length; i += 1) {
		const next = new Set<number>(window[i]);
		acc = new Set<number>([...acc].filter((pid) => next.has(pid)));
	}
	return { intersection: acc, windowStart, windowSize: window.length };
}

// Run-length encodes the per-sample pid sets. At a 25 ms interval a 6 s window
// takes ~240 samples, and dumping 240 identical arrays buries the signal it is
// meant to carry. RLE is lossless here and makes the wedge legible at a glance:
// pre-fix it collapses to two runs (one empty warm-up, then N pids repeated).
function runLengthEncode(
	samples: readonly (readonly number[])[],
): Array<{ pids: readonly number[]; count: number }> {
	const runs: Array<{ pids: readonly number[]; count: number }> = [];
	for (const s of samples) {
		const key = s.join(",");
		const last = runs[runs.length - 1];
		if (last && last.pids.join(",") === key) last.count += 1;
		else runs.push({ pids: s, count: 1 });
	}
	return runs;
}

// Every diagnostic line carries the `[S-3]` prefix so the step-4 run record can
// be lifted out of a full-suite log with one grep.
function logRecord(
	title: string,
	fields: ReadonlyArray<readonly [string, unknown]>,
): void {
	console.log(`[S-3] ===== ${title} =====`);
	for (const [key, value] of fields) {
		const rendered = typeof value === "string" ? value : JSON.stringify(value);
		console.log(`[S-3] ${key}: ${rendered}`);
	}
}

beforeEach(async () => {
	await truncateAll();
	await seedTuples();
});

afterEach(async () => {
	await truncateAll();
});

// ─── C-3 · BOUNDED TEARDOWN ────────────────────────────────────────────────
// This file OPENS NO CLIENT OF ITS OWN — it borrows `testClient` / `testDb`
// from tests/db/_fixtures/db.ts, which are shared across the suite. So there is
// deliberately NO `end()` call here, bounded or otherwise: ending a shared
// fixture client would break every file that runs after this one. C-3's rule
// stands for any client this file might later open — `end({ timeout: 5 })`,
// NEVER a bare `end()`, because postgres.js `end()` defers until in-flight
// queries complete, which on a wedged pool is never, and that converts a clean
// red into a hung runner.

describe("Google OAuth signup nested pool checkout (S-3)", () => {
	it(
		"oauth-signup-pool-deadlock::concurrent-signups-do-not-wedge-the-pool",
		async () => {
			// ── ARRANGE ────────────────────────────────────────────────────────
			// Pre-flight (C-3a) and the N guard (C-1) already ran at module scope,
			// before `beforeEach` wrote a row. Tuples are seeded. `auth.$context`
			// resolves the real Better Auth context — same entry as
			// signup-create-path.integration.test.ts.
			const ctx = await auth.$context;

			// ── ACT · step 1 — FIRE N, COLLECT, DO NOT AWAIT ────────────────────
			// Awaiting here never returns pre-fix, and post-fix reads an empty
			// sample set for the wrong reason (the burst would be over before the
			// first poll). The `.catch(() => {})` on the recorder chain is the
			// unhandled-rejection guard: pre-fix these promises may reject long
			// after the bounded settle race has already given up on them.
			const outcomes: RequestOutcome[] = [];
			const burstStartedAt = Date.now();
			const inflight: Promise<unknown>[] = Array.from({ length: N }, (_, i) => {
				const startedAt = Date.now();
				const p: Promise<unknown> = ctx.internalAdapter.createOAuthUser(
					userPayloadFor(i),
					accountDataFor(i),
				);
				p.then(
					() => {
						outcomes.push({
							index: i,
							status: "fulfilled",
							ms: Date.now() - startedAt,
							error: null,
						});
					},
					(err: unknown) => {
						outcomes.push({
							index: i,
							status: "rejected",
							ms: Date.now() - startedAt,
							error: err instanceof Error ? err.message : String(err),
						});
					},
				).catch(() => {});
				return p;
			});

			// ── ACT · step 2 — POLL, NEVER A SINGLE BARE SLEEP ─────────────────
			// Read through `testClient` (its own max:1 pool) so the wedge cannot
			// silence the observer. Query first, then sleep, so sample 0 lands as
			// close to the burst as the event loop allows.
			//
			// Two quantities come out of ONE query:
			//   · the INTERSECTION set, scoped to state = 'idle in transaction'
			//     ONLY — this is the assertion's input;
			//   · the OVERLAP WITNESS, counted over the FULL
			//     ('active','idle in transaction') result — this only establishes
			//     that the observation window overlapped live work. `active` rows
			//     never enter the intersection.
			const idleSamples: number[][] = [];
			let overlapWitnessSamples = 0;
			let maxIdleSampleSize = 0;
			let lastWitnessRows: ActivityRow[] = [];
			const pollStartedAt = Date.now();

			while (Date.now() - pollStartedAt < POLL_WINDOW_MS) {
				const rows = await testClient<ActivityRow[]>`
					SELECT pid, state, wait_event_type, wait_event,
					       now() - xact_start AS in_xact,
					       left(query, 120) AS last_query
					FROM pg_stat_activity
					WHERE datname = current_database()
					  AND pid <> pg_backend_pid()
					  AND state IN ('active', 'idle in transaction')
				`;

				if (rows.length > 0) {
					overlapWitnessSamples += 1;
					lastWitnessRows = [...rows];
				}

				const idlePids = new Set<number>(
					rows
						.filter((r) => r.state === "idle in transaction")
						.map((r) => r.pid),
				);
				maxIdleSampleSize = Math.max(maxIdleSampleSize, idlePids.size);
				idleSamples.push([...idlePids].sort((a, b) => a - b));

				await sleep(POLL_INTERVAL_MS);
			}

			const { intersection, windowStart, windowSize } =
				intersectFromFirstNonEmpty(idleSamples);
			const pollElapsedMs = Date.now() - pollStartedAt;

			// ── DIAGNOSTICS, EMITTED BEFORE ANYTHING THAT CAN HANG ─────────────
			// This IS the artifact of step 4. It must exist on disk in the run log
			// even when the settle race below never resolves, so it is printed
			// before the first `await` that can wedge.
			//
			// `maxIdleSampleSize` is RECORDED, NOT ASSERTED. Pre-fix it is N (the
			// V-2 attribution: a hang alone is consistent with a slow DB, N
			// backends idle in transaction is not). Post-fix it is whatever
			// consume.ts's own short transactions happened to overlap — 0 to N,
			// all legitimate. A file that runs unchanged in both phases can only
			// carry the phase-independent assertion, which is the intersection.
			logRecord("poll window", [
				["N", N],
				["POOL_MAX", POOL_MAX],
				["hosts", hosts],
				["pollWindowMs", POLL_WINDOW_MS],
				["pollIntervalMs", POLL_INTERVAL_MS],
				["samplesTaken", idleSamples.length],
				["idleSampleRuns", runLengthEncode(idleSamples)],
				["maxIdleSampleSize", maxIdleSampleSize],
				// windowStart / windowSize are the diagnostic that tells a step-6
				// reader whether an ASSERT 2 red is the real thing or the accepted
				// false-RED edge case. windowSize === 1 means the only non-empty
				// idle sample was the last one — read the docblock, not a bug.
				["intersectionWindowStart", windowStart],
				["intersectionWindowSize", windowSize],
				["intersection", [...intersection].sort((a, b) => a - b)],
				["intersectionSize", intersection.size],
				["overlapWitnessSamples", overlapWitnessSamples],
				["pollElapsedMs", pollElapsedMs],
				[
					"lastWitnessRows",
					lastWitnessRows.map((r) => ({
						pid: r.pid,
						state: r.state,
						wait_event_type: r.wait_event_type,
						wait_event: r.wait_event,
						in_xact: String(r.in_xact),
						last_query: r.last_query,
					})),
				],
			]);

			// ── ACT · step 3 — SETTLE, BOUNDED ─────────────────────────────────
			const settled = await withDeadline(
				Promise.allSettled(inflight),
				SETTLE_BUDGET_MS,
			);
			const burstElapsedMs = Date.now() - burstStartedAt;
			const fulfilledCount = outcomes.filter(
				(o) => o.status === "fulfilled",
			).length;
			const rejected = outcomes.filter((o) => o.status === "rejected");

			logRecord("settle", [
				["settledWithinBudget", settled !== null],
				["settleBudgetMs", SETTLE_BUDGET_MS],
				["fulfilled", fulfilledCount],
				["rejected", rejected.length],
				["pending", N - outcomes.length],
				["burstElapsedMs", burstElapsedMs],
				[
					"perRequestMs",
					[...outcomes]
						.sort((a, b) => a.index - b.index)
						.map((o) => ({ i: o.index, status: o.status, ms: o.ms })),
				],
				["rejectionMessages", rejected.map((o) => o.error)],
			]);

			// ── ASSERT ─────────────────────────────────────────────────────────
			// Order is deliberate: the two INCONCLUSIVE guards first (they say
			// whether the observation is worth reading at all), then the settle
			// assertion (the most informative pre-fix red), then the persistence
			// discriminator.

			// GUARD 1 — ≥ 3 samples TAKEN, not 3 containing rows. An intersection
			// over one sample is trivially itself; over zero it is vacuous. Fewer
			// than three ⇒ inconclusive, fail the run. Post-fix most samples will
			// legitimately be EMPTY, so this must never be a non-empty requirement.
			expect(idleSamples.length).toBeGreaterThanOrEqual(3);

			// GUARD 2 — ≥ 1 sample in which the FULL ('active','idle in
			// transaction') query returned rows. This is what establishes that the
			// window overlapped live work; without it a post-fix empty intersection
			// could just mean the burst finished before polling began. It fails an
			// unproven run rather than passing it (NOT ESTABLISHED #7).
			expect(overlapWitnessSamples).toBeGreaterThanOrEqual(1);

			// ⚠ ASSERT 1 AND ASSERT 2 ARE **SOFT**, AND THAT IS LOAD-BEARING.
			// A hard `expect` throws on the first failure, so pre-fix ASSERT 1
			// (the settle) would abort the test and ASSERT 2 would never be
			// evaluated at all. That is how ASSERT 2 went unobserved through the
			// first step-4 run while being vacuous — nothing ever ran it against a
			// wedge. `expect.soft` evaluates both and still fails the test, so the
			// pre-fix run reports BOTH reds and each is known to be capable of
			// failing. The GUARDS above stay HARD on purpose: they say whether the
			// observation is worth reading, so there is no point continuing past
			// one.

			// ASSERT 1 — all N signups settle inside the bound, all fulfilled.
			// PRE-FIX: `settled` is null and `pending` is N — the wedge.
			expect.soft(settled).not.toBeNull();
			expect.soft(rejected.map((o) => o.error)).toEqual([]);
			expect.soft(fulfilledCount).toBe(N);

			// ASSERT 2 — PERSISTENCE, not presence. No backend held an open
			// transaction across the window: every transaction opened and closed,
			// pids churned.
			// PRE-FIX: size === N — the same N backends, never moving, a wedge.
			// The window starts at the first non-empty idle sample; see the
			// docblock for why, and for the false-RED edge case it accepts.
			expect.soft(intersection.size).toBe(0);
		},
		TEST_TIMEOUT_MS,
	);
});
