import postgres from "postgres";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { markets, pools, users } from "@/db/schema";
import { CpmmDecimal } from "@/server/cpmm/decimal";
import {
	eventMetadataSchema,
	eventPayloadSchemas,
} from "@/server/events/schemas";
import { testClient, testDb } from "./_fixtures/db";
import { truncateTables } from "./_fixtures/truncate";

// A SECOND CLIENT, and it has to be a second client rather than a second
// connection from `testClient`. That handle is `max: 1` by design — so a file's
// TRUNCATE and its subsequent reads share one session — which means `reserve()`
// on it takes the ONLY connection and any query issued while the reservation is
// held waits for a connection that is never coming. Measured: the two cases
// below deadlocked against themselves for the full 20 s timeout.
//
// Both cases that use it are testing CONTENTION, so a genuinely separate session
// is the thing under test rather than an artefact of the fixture.
const contender = postgres(process.env.DATABASE_URL ?? "", { max: 2 });

// T4 / T7 — `run_liquidity_injection()` (migration 0027, ADR-0047 §D).
//
// The function is exercised DIRECTLY (`SELECT run_liquidity_injection()`), not
// through pg_cron, following `0011`'s `check_nightly_drift()` precedent: CI's
// substrate has no pg_cron at all (the `*pg_cron*` strip removes both
// registrations), so a test that needed the scheduler would be a test that only
// ever ran on one machine.
//
// ⚠ EVERY CASE HERE SEEDS ITS OWN POLICY ROW AND ITS OWN MARKETS. The injector
// reads `count(*) FROM users` for its target, so a case that did not control the
// user count would be a case whose expected values depend on what ran before it.

const V = (n: number) => 9500 + n;

type PolicyOverrides = {
	coefficient?: string;
	floor?: string;
	triggerRatio?: string;
	guardLow?: string;
	guardHigh?: string;
	endgameHours?: number;
	lockTimeoutMs?: number;
	enabled?: boolean;
};

async function seedPolicy(
	version: number,
	o: PolicyOverrides = {},
): Promise<void> {
	await testClient.unsafe(
		`INSERT INTO liquidity_policy
		   (version, coefficient, floor, trigger_ratio, guard_low, guard_high,
		    endgame_hours, lock_timeout_ms, enabled)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
		[
			version,
			o.coefficient ?? "500",
			o.floor ?? "100000",
			o.triggerRatio ?? "0.80",
			o.guardLow ?? "0.02",
			o.guardHigh ?? "0.95",
			o.endgameHours ?? 72,
			o.lockTimeoutMs ?? 100,
			o.enabled ?? true,
		],
	);
}

/** Restores 0027's seeded row, which the teardown TRUNCATE removes. */
async function restoreSeedRow(): Promise<void> {
	await testClient.unsafe(
		`INSERT INTO liquidity_policy
		   (version, coefficient, floor, trigger_ratio, guard_low, guard_high,
		    endgame_hours, lock_timeout_ms, enabled, effective_from)
		 VALUES (1, 500, 100000, 0.80, 0.02, 0.95, 72, 100, false, now())
		 ON CONFLICT (version) DO NOTHING`,
	);
}

async function seedMarket(
	slug: string,
	reserves: { yes: string; no: string },
	opts: { status?: "Open" | "Draft" | "Closed"; deadlineHours?: number } = {},
): Promise<string> {
	const deadline = new Date(
		Date.now() + (opts.deadlineHours ?? 24 * 30) * 3600 * 1000,
	);
	const [m] = await testDb
		.insert(markets)
		.values({
			slug,
			title: `Injector fixture ${slug}`,
			resolutionDeadline: deadline,
			status: opts.status ?? "Open",
		})
		.returning({ id: markets.id });
	const marketId = m?.id ?? "";
	await testDb.insert(pools).values({
		marketId,
		yesReserves: reserves.yes,
		noReserves: reserves.no,
	});
	return marketId;
}

async function seedUsers(n: number, tag: string): Promise<void> {
	for (let i = 0; i < n; i++) {
		await testDb.insert(users).values({
			name: `Injector ${tag} ${i}`,
			email: `injector-${tag}-${i}@example.com`,
			pseudonym: `injector-${tag}-${i}`,
		});
	}
}

async function sweep(): Promise<void> {
	await testClient.unsafe(`SELECT run_liquidity_injection()`);
}

async function readPool(
	marketId: string,
): Promise<{ yes: string; no: string }> {
	const rows = await testClient.unsafe<Array<{ yes: string; no: string }>>(
		`SELECT yes_reserves AS yes, no_reserves AS no FROM pools WHERE market_id = $1`,
		[marketId],
	);
	return { yes: rows[0]?.yes ?? "0", no: rows[0]?.no ?? "0" };
}

async function injectionCount(marketId: string): Promise<number> {
	const rows = await testClient.unsafe<Array<{ n: string }>>(
		`SELECT count(*)::text AS n FROM events
		 WHERE aggregate_type = 'market' AND aggregate_id = $1
		   AND event_type = 'pool.liquidity_added'`,
		[marketId],
	);
	return Number(rows[0]?.n ?? "0");
}

async function heartbeats(): Promise<
	Array<{ considered: number; injected: number; policy: number | null }>
> {
	const rows = await testClient.unsafe<
		Array<{ c: number; i: number; p: number | null }>
	>(
		`SELECT markets_considered AS c, markets_injected AS i, policy_version AS p
		 FROM liquidity_heartbeat ORDER BY id`,
	);
	return rows.map((r) => ({
		considered: r.c,
		injected: r.i,
		policy: r.p,
	}));
}

describe("run_liquidity_injection — the sweep", () => {
	beforeEach(async () => {
		await testClient.unsafe(`DELETE FROM liquidity_heartbeat`);
		await testClient.unsafe(`DELETE FROM cron_alarms`);
		await testClient.unsafe(
			`DELETE FROM watermark_state WHERE metric LIKE 'liquidity_%'`,
		);
	});

	afterEach(async () => {
		await truncateTables(testClient, [
			"events",
			"pools",
			"markets",
			"users",
			"liquidity_policy",
		]);
		await restoreSeedRow();
		await testClient.unsafe(`DELETE FROM liquidity_heartbeat`);
		await testClient.unsafe(`DELETE FROM cron_alarms`);
		// ⚠ `frozen_at` is a ONE-SHOT Bucket-B transition: the §6.3 trigger
		// rejects `timestamp → NULL`, so the freeze case below CANNOT undo itself
		// with an UPDATE. Reset by TRUNCATE + reseed, in the teardown rather than
		// in that case's body, because a reset that lives inside the test it
		// serves does not run when the test throws — which is exactly what
		// happened on the first run: six later cases reported "no injection", and
		// every one of them was the injector correctly refusing to act on a system
		// it had been told was frozen. The failure was real and it was mine.
		await truncateTables(testClient, ["system_state"]);
		await testClient.unsafe(
			`INSERT INTO system_state (id, frozen_at) VALUES ('system', NULL)`,
		);
	});

	it("liquidity-injector::disabled-policy-is-a-no-op-but-still-heartbeats", async () => {
		// ⛔ THE R-8 GUARD, AND THE PLAN CALLS IT "the single most consequential
		// deviation from the ADR text". ADR-0024 applies this migration to
		// production BEFORE the code that can read `pool.liquidity_added` is
		// promoted; if the seeded row were `enabled = true`, that window would
		// write rows the running `settleMarket` cannot see — under-reporting a
		// terminal, append-only payout by the injected discard.
		//
		// The heartbeat assertion is the other half and is not decoration (R4):
		// the job must remain observably ALIVE while it is deliberately idle, or
		// "switched off" and "died" are the same signal.
		await seedUsers(3, "disabled");
		const marketId = await seedMarket("inj-disabled", {
			yes: "9000",
			no: "1000",
		});
		await seedPolicy(V(1), { enabled: false });

		const before = await readPool(marketId);
		await sweep();

		expect(await readPool(marketId)).toEqual(before);
		expect(await injectionCount(marketId)).toBe(0);

		const hb = await heartbeats();
		expect(hb).toHaveLength(1);
		expect(hb[0]).toEqual({ considered: 0, injected: 0, policy: V(1) });
	});

	it("liquidity-injector::frozen-is-a-no-op-but-still-heartbeats", async () => {
		// SPEC.1 §12. The injector is a WRITE surface with no exemption — unlike
		// the resolution flows, which must be able to FINISH a market in flight.
		// Nothing needs to be able to GROW after the freeze.
		//
		// The heartbeat still lands, deliberately: post-freeze the injector is a
		// permanent no-op, and a silence alarm firing forever from the moment of
		// the freeze would be noise indistinguishable from a real outage.
		await seedUsers(3, "frozen");
		const marketId = await seedMarket("inj-frozen", {
			yes: "9000",
			no: "1000",
		});
		await seedPolicy(V(2), { enabled: true });
		await testClient.unsafe(
			`UPDATE system_state SET frozen_at = now() WHERE frozen_at IS NULL`,
		);

		const before = await readPool(marketId);
		await sweep();

		expect(await readPool(marketId)).toEqual(before);
		expect(await injectionCount(marketId)).toBe(0);
		expect(await heartbeats()).toHaveLength(1);
		// No reset here: the teardown owns it, for the reason recorded there.
	});

	it("liquidity-injector::injects-to-target-and-preserves-price", async () => {
		// The happy path, and the two things that make it correct rather than
		// merely non-empty: the tank lands ON the target, and `p_yes` does not
		// move. Price neutrality is the whole design claim (ADR-0047 §A) — an
		// injector that topped the pool up while shifting the price would be
		// re-pricing everyone's position by fiat, which is the objection SPEC.1
		// §10.6 was originally written to make.
		await seedUsers(4, "happy"); // target = max(100000, 500 × 4) = 100000
		const marketId = await seedMarket("inj-happy", { yes: "9000", no: "1000" });
		await seedPolicy(V(3));

		const before = await readPool(marketId);
		const priceBefore = new CpmmDecimal(before.no).dividedBy(
			new CpmmDecimal(before.yes).plus(before.no),
		);

		await sweep();

		const after = await readPool(marketId);
		const tank = new CpmmDecimal(after.yes).plus(after.no);
		const priceAfter = new CpmmDecimal(after.no).dividedBy(tank);

		// Tank reaches the target exactly (to 18 dp — `a` is derived from it).
		expect(tank.toFixed(0)).toBe("100000");
		// Price moves by at most one ulp. Measured max over the fuzz: 1.22e-20.
		expect(priceAfter.minus(priceBefore).abs().lessThanOrEqualTo("1e-18")).toBe(
			true,
		);
		expect(await injectionCount(marketId)).toBe(1);

		const hb = await heartbeats();
		expect(hb[0]).toEqual({ considered: 1, injected: 1, policy: V(3) });
	});

	it("liquidity-injector::target-computed-once-per-tick-not-once-per-market", async () => {
		// ADR-0047 §C: the target is UNIFORM across every Open market. Computing
		// it per market would take one `count(*)` per market and could straddle a
		// signup, handing two markets in one sweep different targets — which would
		// show up later as two markets of different depth for no stated reason.
		//
		// Asserted through the payload rather than by counting queries: every
		// injection in one sweep must carry the SAME `target`, and they share a
		// `request_id` so a reader can group the sweep (plan R-4, LIQ-1 L-1).
		await seedUsers(400, "uniform"); // target = 500 × 400 = 200000 > floor
		const a = await seedMarket("inj-uniform-a", { yes: "9000", no: "1000" });
		const b = await seedMarket("inj-uniform-b", { yes: "45000", no: "5000" });
		await seedPolicy(V(4));

		await sweep();

		const rows = await testClient.unsafe<
			Array<{ target: string; run: string }>
		>(
			`SELECT payload->>'target' AS target, metadata->>'request_id' AS run
			 FROM events WHERE event_type = 'pool.liquidity_added'
			   AND aggregate_id IN ($1, $2)`,
			[a, b],
		);
		expect(rows).toHaveLength(2);
		expect(new Set(rows.map((r) => r.target)).size).toBe(1);
		expect(rows[0]?.target).toBe("200000.000000000000000000");
		// One sweep, one run id — the arbiter for "these rows are one tick".
		expect(new Set(rows.map((r) => r.run)).size).toBe(1);
	});

	it("liquidity-injector::guard-band-skips-and-does-not-inject", async () => {
		// R-5, BOTH EDGES. A market at an extreme price is information, not a
		// thing to correct — ADR-0047's judgement — and the injector's
		// price-preserving placement would put almost all new depth on one side.
		//
		// ⚠ A guard skip is INDISTINGUISHABLE from a satisfied trigger in the
		// pool row, which is exactly why the undershoot alarm exists. This case
		// proves the skip; the alarm spec proves it is visible.
		await seedUsers(4, "guard");
		// p_yes = no/(yes+no). 0.01 is below guard_low 0.02; 0.99 above 0.95.
		const low = await seedMarket("inj-guard-low", { yes: "9900", no: "100" });
		const high = await seedMarket("inj-guard-high", { yes: "100", no: "9900" });
		await seedPolicy(V(5));

		const lowBefore = await readPool(low);
		const highBefore = await readPool(high);
		await sweep();

		expect(await readPool(low)).toEqual(lowBefore);
		expect(await readPool(high)).toEqual(highBefore);
		expect(await injectionCount(low)).toBe(0);
		expect(await injectionCount(high)).toBe(0);

		// Both were CONSIDERED — the skip is a decision, not an absence.
		const hb = await heartbeats();
		expect(hb[0]).toEqual({ considered: 2, injected: 0, policy: V(5) });
	});

	it("liquidity-injector::endgame-window-skips-before-taking-any-lock", async () => {
		// A market inside ENDGAME_HOURS of its deadline is left alone: adding
		// depth to a market about to close changes the closing price for no
		// benefit, and the closing price is the measurement the whole experiment
		// is for.
		await seedUsers(4, "endgame");
		const inside = await seedMarket(
			"inj-endgame-inside",
			{ yes: "9000", no: "1000" },
			{ deadlineHours: 12 }, // < endgame_hours 72
		);
		const outside = await seedMarket(
			"inj-endgame-outside",
			{ yes: "9000", no: "1000" },
			{ deadlineHours: 24 * 30 },
		);
		await seedPolicy(V(6));

		const insideBefore = await readPool(inside);
		await sweep();

		expect(await readPool(inside)).toEqual(insideBefore);
		expect(await injectionCount(inside)).toBe(0);
		// The control: the other market DID inject, so the skip above is the
		// endgame rule rather than the sweep failing to run at all.
		expect(await injectionCount(outside)).toBe(1);
	});

	it("liquidity-injector::only-Open-markets-are-touched", async () => {
		// `cpmm.md` §3.1: reserves are immutable from `Open → Closed` onward, and
		// the injector selects on `status = 'Open'` precisely so that sentence
		// stays true. A Draft market has a pool row here only because the fixture
		// gives it one — the product never does — which makes this the stronger
		// negative.
		await seedUsers(4, "status");
		const draft = await seedMarket(
			"inj-draft",
			{ yes: "9000", no: "1000" },
			{ status: "Draft" },
		);
		const closed = await seedMarket(
			"inj-closed",
			{ yes: "9000", no: "1000" },
			{ status: "Closed" },
		);
		const open = await seedMarket("inj-open", { yes: "9000", no: "1000" });
		await seedPolicy(V(7));

		const draftBefore = await readPool(draft);
		const closedBefore = await readPool(closed);
		await sweep();

		expect(await readPool(draft)).toEqual(draftBefore);
		expect(await readPool(closed)).toEqual(closedBefore);
		expect(await injectionCount(open)).toBe(1);
		const hb = await heartbeats();
		expect(hb[0]?.considered).toBe(1);
	});

	it("liquidity-injector::at-or-above-trigger-does-not-inject", async () => {
		// The quieting property (ADR-0047 §D step 4). A market already at
		// `trigger_ratio × target` is left alone, which is what makes the
		// injection frequency fall off rather than run every minute forever.
		await seedUsers(4, "trigger"); // target 100000, trigger 0.80 → 80000
		const marketId = await seedMarket("inj-at-trigger", {
			yes: "81000",
			no: "9000",
		}); // tank 90000 >= 80000
		await seedPolicy(V(8));

		const before = await readPool(marketId);
		await sweep();
		expect(await readPool(marketId)).toEqual(before);
		expect(await injectionCount(marketId)).toBe(0);
	});

	it("liquidity-injector::the-event-payload-reconstructs-the-injection", async () => {
		// ADR-0047 §F. A dataset reader must be able to CHECK an injection, not
		// take it on trust: the before/after pairs make price-neutrality
		// verifiable per row, and `backingMinted` + `discardedShares` are what
		// make the Đ close. Without them the per-side share counts do not
		// reconcile and the backing identity cannot be verified from the export
		// at all.
		await seedUsers(4, "payload");
		const marketId = await seedMarket("inj-payload", {
			yes: "9000",
			no: "1000",
		});
		await seedPolicy(V(9));
		await sweep();

		const rows = await testClient.unsafe<Array<{ p: Record<string, unknown> }>>(
			`SELECT payload AS p FROM events
			 WHERE aggregate_id = $1 AND event_type = 'pool.liquidity_added'`,
			[marketId],
		);
		const p = rows[0]?.p as Record<string, string> & {
			reservesBefore: { yes: string; no: string };
			reservesAfter: { yes: string; no: string };
		};

		expect(p.policyVersion).toBe(V(9));
		expect(p.discardedSide).toBe("NO"); // a YES-long market discards NO
		expect(p.reservesBefore).toEqual({
			yes: "9000.000000000000000000",
			no: "1000.000000000000000000",
		});

		// reservesAfter IS the live pool row — the property `price-series.ts`
		// depends on when it SETS the walk rather than recomputing it.
		const live = await readPool(marketId);
		expect(p.reservesAfter).toEqual(live);

		// The backing delta closes exactly: (yes' + d_yes) − (no' + d_no) is
		// unchanged by the injection.
		const dNo = new CpmmDecimal(p.discardedShares);
		const beforeDelta = new CpmmDecimal("9000").minus("1000");
		const afterDelta = new CpmmDecimal(live.yes).minus(
			new CpmmDecimal(live.no).plus(dNo),
		);
		expect(afterDelta.equals(beforeDelta)).toBe(true);

		// ⛔ THE WRITER↔READER BRIDGE, MECHANICALLY (@db-migration-reviewer
		// MEDIUM-2). `pool.liquidity_added` is the FIRST event type whose writer
		// is not `insertEvent`, so none of that function's three guarantees —
		// payload Zod, metadata Zod, uuidv7 check — runs on this path. Everything
		// else in this case hand-checks individual keys, which leaves the six
		// remaining SHIP keys (`target`, `tankBefore`, `tankAfter`,
		// `backingMinted`, `priceYesBefore`, `priceYesAfter`) asserted by nobody.
		//
		// Parsing the REAL emitted row through the REAL schema is what closes it:
		// two hand-copies of a key list with nothing between them is precisely the
		// defect this task already caught once, in the plan's own T8 sketch —
		// green tests, silent under-report on a terminal payout row.
		expect(() =>
			eventPayloadSchemas["pool.liquidity_added"].parse(p),
		).not.toThrow();

		// The system-actor metadata set (sweep-orphans precedent), through the
		// shipped metadata schema for the same reason.
		const meta = await testClient.unsafe<Array<{ m: Record<string, unknown> }>>(
			`SELECT metadata AS m FROM events
			 WHERE aggregate_id = $1 AND event_type = 'pool.liquidity_added'`,
			[marketId],
		);
		expect(meta[0]?.m).toMatchObject({
			flow_id: "F-CRON-LIQUIDITY-INJECT",
			actor_id: "system",
			user_id: null,
			ip: "pg_cron",
		});
		expect(() => eventMetadataSchema.parse(meta[0]?.m)).not.toThrow();
	});

	it("liquidity-injector::status-is-re-read-INSIDE-the-lock", async () => {
		// ⛔ @db-migration-reviewer MEDIUM-1, and it is a money-path fix rather
		// than tidying. The loop's cursor takes a READ COMMITTED snapshot at loop
		// start; migration 0027 then locked the market row and DISCARDED every
		// column of it. A market that moved `Open → Resolving / Closed / Voided`
		// between snapshot and lock was still injected — and `settleMarket` /
		// `voidMarket` sum `pool.liquidity_added` under the pool lock, so an
		// injection landing after that sum adds backing the terminal, append-only
		// payout row does not account for. There is no edge out of `Resolved`.
		//
		// ⚠ 0027's own `only-Open-markets-are-touched` exercises the CURSOR
		// FILTER, not the TRANSITION, which is exactly why it passed against the
		// gap. This case drives the transition itself: a second session holds the
		// market row and flips its status while the sweep is already running and
		// blocked on that very row.
		await seedUsers(4, "transition");
		const marketId = await seedMarket("inj-transition", {
			yes: "9000",
			no: "1000",
		});
		await seedPolicy(V(16), { lockTimeoutMs: 250 });

		const holder = await contender.reserve();
		try {
			await holder.unsafe(`BEGIN`);
			// Take the markets row FIRST — the same lock the sweep wants, in the
			// same canonical order — then flip the status inside that transaction.
			await holder.unsafe(
				`SELECT 1 FROM markets WHERE id = $1 FOR NO KEY UPDATE`,
				[marketId],
			);
			await holder.unsafe(
				`UPDATE markets SET status = 'Closed' WHERE id = $1`,
				[marketId],
			);

			// ⚠ `.execute()` IS LOAD-BEARING. A postgres.js query is LAZY — it is
			// not sent until awaited — so `const p = client.unsafe(...)` without it
			// starts nothing, the sweep runs after the COMMIT below, and its cursor
			// sees the CLOSED status. That version passes for the wrong reason: it
			// proves the cursor filter, which 0027 already had, and says nothing
			// about the re-read. Measured: `considered: 0` instead of 1.
			const sweeping = testClient
				.unsafe(`SELECT run_liquidity_injection()`)
				.execute();
			// Let it reach the lock before the holder lets go.
			await new Promise((r) => setTimeout(r, 20));
			// Release well inside the 250 ms lock_timeout so the sweep ACQUIRES the
			// row rather than timing out — a timeout would prove nothing about the
			// re-read.
			await new Promise((r) => setTimeout(r, 40));
			await holder.unsafe(`COMMIT`);
			await sweeping;
		} finally {
			holder.release();
		}

		// ⛔ THE ASSERTION. The sweep got the lock, saw the CURRENT status, and
		// declined. Against 0027 this market would carry an injection.
		expect(await injectionCount(marketId)).toBe(0);
		const pool = await readPool(marketId);
		expect(pool).toEqual({
			yes: "9000.000000000000000000",
			no: "1000.000000000000000000",
		});
		// Considered, not injected — the skip is a decision the heartbeat records.
		const hb = await heartbeats();
		expect(hb[0]).toEqual({ considered: 1, injected: 0, policy: V(16) });
	});

	it("liquidity-injector::sweep-duration-bounded", async () => {
		// ⛔ PLAN §9 R-11's SECOND PROOF OBLIGATION, which was named and not met
		// (@db-migration-reviewer HIGH-2). R8 put the whole sweep in ONE
		// transaction, so a pool row locked at the first market stays locked until
		// the LAST one finishes. The bet path waiting on that row has a 1,000 ms
		// non-retryable statement_timeout, and the plan's bound is arithmetic:
		// (open_markets − 1) × lock_timeout_ms.
		//
		// ⚠ THAT ARITHMETIC HAS ALREADY DRIFTED ONCE. The plan reasons from EIGHT
		// markets; staging carries TEN (measured 2026-09-07). This case pins the
		// uncontended sweep well inside the budget so a regression that made the
		// per-market work expensive is visible before it reaches a bet.
		await seedUsers(4, "duration");
		for (let i = 0; i < 8; i++) {
			await seedMarket(`inj-dur-${i}`, { yes: "9000", no: "1000" });
		}
		await seedPolicy(V(17));

		const started = Date.now();
		await sweep();
		const elapsed = Date.now() - started;

		// Uncontended, eight markets, all injecting. The generous ceiling is
		// deliberate: this is a REGRESSION bound on the sweep's own cost, not a
		// performance target, and a tight one would flake on a loaded machine.
		expect(elapsed).toBeLessThan(1000);
		const hb = await heartbeats();
		expect(hb[0]).toEqual({ considered: 8, injected: 8, policy: V(17) });
	});

	it("liquidity-injector::created_at-is-derived-from-the-event-id", async () => {
		// `insertEvent`'s contract, reproduced by hand in plpgsql because the
		// injector does not go through it. `events` is RANGE-partitioned on
		// `created_at`, and two tests elsewhere assert the id→timestamp property —
		// so a `now()` here would be a SECOND clock, agreeing with the first until
		// the day it did not.
		await seedUsers(4, "clock");
		const marketId = await seedMarket("inj-clock", { yes: "9000", no: "1000" });
		await seedPolicy(V(10));
		await sweep();

		const rows = await testClient.unsafe<Array<{ drift_ms: string }>>(
			`SELECT abs(extract(epoch FROM (created_at - to_timestamp(
			   (('x' || substr(replace(event_id::text,'-',''),1,12))::bit(48)::bigint)/1000.0
			 ))) * 1000)::text AS drift_ms
			 FROM events WHERE aggregate_id = $1 AND event_type = 'pool.liquidity_added'`,
			[marketId],
		);
		expect(Number(rows[0]?.drift_ms ?? "999")).toBeLessThan(1);
	});

	it("liquidity-injector::overlapping-runs-one-works-one-exits", async () => {
		// R-7. pg_cron will not start a second run of the same job, but the ADR
		// Runbook explicitly tells an operator to CALL THIS BY HAND when the
		// silence alarm fires — so a hand-run racing the scheduled one is a
		// designed-for case, not a hypothetical.
		//
		// ⚠ The lock is `pg_try_advisory_xact_lock`, not the session form. With
		// the whole sweep in one transaction (R8) the transaction-scoped lock
		// releases on ERROR as well as on commit; a session lock leaked by a
		// hand-run that threw would sit in the operator's psql session and block
		// every scheduled tick afterwards, silently.
		await seedUsers(4, "overlap");
		const marketId = await seedMarket("inj-overlap", {
			yes: "9000",
			no: "1000",
		});
		await seedPolicy(V(11));

		// Hold the advisory lock in a separate session, then sweep.
		const holder = await contender.reserve();
		try {
			await holder.unsafe(
				`SELECT pg_advisory_lock(hashtext('zugzwang.liquidity_injector'))`,
			);
			await sweep();
			// The sweep found the lock held and returned immediately: no
			// injection, and — deliberately — NO heartbeat either, because this
			// tick did not run. The run holding the lock writes the heartbeat.
			expect(await injectionCount(marketId)).toBe(0);
			expect(await heartbeats()).toHaveLength(0);
		} finally {
			await holder.unsafe(
				`SELECT pg_advisory_unlock(hashtext('zugzwang.liquidity_injector'))`,
			);
			holder.release();
		}

		// The positive control: with the lock free, the same sweep injects. Without
		// it, a broken function that always returned early would pass above.
		await sweep();
		expect(await injectionCount(marketId)).toBe(1);
	});

	it("liquidity-injector::a-contended-market-is-skipped-and-the-sweep-continues", async () => {
		// R-9 and R-11 together, and the failure they bound is INVISIBLE: the
		// sweep just takes longer, the heartbeat is late rather than absent, and
		// nothing errors. A test that only checked the FIRST market would pass
		// against a sweep that stopped there.
		//
		// The mechanism moved with ruling R8 — `SET LOCAL lock_timeout` used to
		// be re-issued after every per-market COMMIT and is now issued once,
		// because there is no COMMIT — but the BEHAVIOUR under test is the same
		// one: a market whose pool row is held must not cost the markets after it.
		await seedUsers(4, "contend");
		// `ORDER BY id` drives the loop, so hold whichever sorts FIRST to prove
		// the sweep continues past a blocked market rather than merely finishing
		// the ones before it.
		const a = await seedMarket("inj-contend-a", { yes: "9000", no: "1000" });
		const b = await seedMarket("inj-contend-b", { yes: "9000", no: "1000" });
		await seedPolicy(V(12), { lockTimeoutMs: 100 });

		const ids = [a, b].sort();
		const held = ids[0] ?? a;
		const free = ids[1] ?? b;

		const holder = await contender.reserve();
		try {
			await holder.unsafe(`BEGIN`);
			await holder.unsafe(
				`SELECT 1 FROM pools WHERE market_id = $1 FOR NO KEY UPDATE`,
				[held],
			);
			await sweep();
		} finally {
			await holder.unsafe(`ROLLBACK`);
			holder.release();
		}

		expect(await injectionCount(held)).toBe(0);
		// THE ASSERTION THAT MATTERS: the market AFTER the blocked one still ran.
		expect(await injectionCount(free)).toBe(1);
		const hb = await heartbeats();
		expect(hb[0]).toEqual({ considered: 2, injected: 1, policy: V(12) });
	});

	it("liquidity-injector::a-market-with-no-pool-row-does-not-abort-the-sweep", async () => {
		// The `IF NOT FOUND` branch. An Open market without a pool row should not
		// exist — `openMarket` writes both in one transaction — but a restored
		// snapshot or a hand-fixed status can produce one, and the sweep must
		// treat it as a market to skip rather than as a reason to stop.
		await seedUsers(4, "nopool");
		const [orphan] = await testDb
			.insert(markets)
			.values({
				slug: "inj-no-pool",
				title: "Open market with no pool",
				resolutionDeadline: new Date(Date.now() + 30 * 24 * 3600 * 1000),
				status: "Open",
			})
			.returning({ id: markets.id });
		const healthy = await seedMarket("inj-has-pool", {
			yes: "9000",
			no: "1000",
		});
		await seedPolicy(V(13));

		await sweep();

		expect(await injectionCount(orphan?.id ?? "")).toBe(0);
		expect(await injectionCount(healthy)).toBe(1);
		expect((await heartbeats())[0]?.considered).toBe(2);
	});

	it("liquidity-injector::newest-effective-policy-wins", async () => {
		// ADR-0047 §G: tuning is an INSERT of a new version, never an UPDATE. The
		// read is `effective_from <= now() ORDER BY effective_from DESC, version
		// DESC LIMIT 1` — so a policy staged for the future must NOT take effect,
		// which is the half a "highest version wins" implementation gets wrong.
		await seedUsers(4, "newest");
		const marketId = await seedMarket("inj-newest", {
			yes: "9000",
			no: "1000",
		});
		await seedPolicy(V(14), { enabled: true, coefficient: "500" });
		// A FUTURE policy that would disable the injector. It must be ignored.
		await testClient.unsafe(
			`INSERT INTO liquidity_policy
			   (version, coefficient, floor, trigger_ratio, guard_low, guard_high,
			    endgame_hours, lock_timeout_ms, enabled, effective_from)
			 VALUES ($1, 500, 100000, 0.80, 0.02, 0.95, 72, 100, false, now() + interval '1 hour')`,
			[V(15)],
		);

		await sweep();
		expect(await injectionCount(marketId)).toBe(1);
		expect((await heartbeats())[0]?.policy).toBe(V(14));
	});

	it("liquidity-injector::no-policy-row-at-all-is-a-no-op-with-a-null-version-heartbeat", async () => {
		// The state a truncated `liquidity_policy` would leave behind — which is
		// exactly why the table is a TRUNCATE exclusion on staging. The injector
		// fails CLOSED, which is right, and the heartbeat records that the job ran
		// with no policy, which is the only thing that would tell an operator the
		// difference between "off" and "gone".
		await seedUsers(4, "nopolicy");
		const marketId = await seedMarket("inj-no-policy", {
			yes: "9000",
			no: "1000",
		});
		await truncateTables(testClient, ["liquidity_policy"]);

		await sweep();

		expect(await injectionCount(marketId)).toBe(0);
		const hb = await heartbeats();
		expect(hb).toHaveLength(1);
		expect(hb[0]).toEqual({ considered: 0, injected: 0, policy: null });
	});
});
