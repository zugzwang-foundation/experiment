import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { markets, pools, users } from "@/db/schema";
import { testClient, testDb } from "./_fixtures/db";
import { truncateTables } from "./_fixtures/truncate";

// T7 — `check_liquidity_alarms()` (migration 0027, ADR-0047 §H).
//
// ⛔ THIS IS THE ONLY THING THAT NOTICES A STOPPED INJECTOR. A halted pg_cron
// job raises nothing, logs nothing and alarms nothing; the ABSENCE of a
// heartbeat is the entire signal, which is why the check has to live in a
// DIFFERENT job from the one that writes it.
//
// The environment this ships to already carries the evidence that this matters:
// staging's `cron.job` holds jobid 1 and 3 and no jobid 2, so a registration
// there failed once and nobody found out.
//
// Both alarms are edge-triggered through `watermark_state` on `0007`'s
// `IS DISTINCT FROM` pattern — they fire once per EPISODE, not once per tick.
// An alarm that repeats every five minutes for the length of an outage is an
// alarm that gets muted, and a muted alarm is the same as no alarm.

async function seedPolicy(
	version: number,
	enabled: boolean,
	floor = "100000",
): Promise<void> {
	await testClient.unsafe(
		`INSERT INTO liquidity_policy
		   (version, coefficient, floor, trigger_ratio, guard_low, guard_high,
		    endgame_hours, lock_timeout_ms, enabled)
		 VALUES ($1, 500, $2, 0.80, 0.02, 0.95, 72, 100, $3)`,
		[version, floor, enabled],
	);
}

async function restoreSeedRow(): Promise<void> {
	await testClient.unsafe(
		`INSERT INTO liquidity_policy
		   (version, coefficient, floor, trigger_ratio, guard_low, guard_high,
		    endgame_hours, lock_timeout_ms, enabled, effective_from)
		 VALUES (1, 500, 100000, 0.80, 0.02, 0.95, 72, 100, false, now())
		 ON CONFLICT (version) DO NOTHING`,
	);
}

/** A heartbeat row aged by `minutesAgo`. The synthetic gap is the whole test. */
async function heartbeatAt(minutesAgo: number): Promise<void> {
	await testClient.unsafe(
		`INSERT INTO liquidity_heartbeat
		   (run_id, ran_at, policy_version, markets_considered, markets_injected)
		 VALUES (gen_random_uuid(), now() - ($1 || ' minutes')::interval, 1, 0, 0)`,
		[String(minutesAgo)],
	);
}

async function check(): Promise<void> {
	await testClient.unsafe(`SELECT check_liquidity_alarms()`);
}

async function alarms(id: string): Promise<Array<Record<string, unknown>>> {
	return await testClient.unsafe<Array<Record<string, unknown>>>(
		`SELECT alarm_id, payload FROM cron_alarms WHERE alarm_id = $1 ORDER BY id`,
		[id],
	);
}

async function watermark(
	metric: string,
): Promise<{ state: string; since: string } | undefined> {
	const rows = await testClient.unsafe<Array<{ state: string; since: string }>>(
		`SELECT state, since::text FROM watermark_state WHERE metric = $1`,
		[metric],
	);
	return rows[0];
}

async function seedMarketWithTank(
	slug: string,
	yes: string,
	no: string,
): Promise<string> {
	const [m] = await testDb
		.insert(markets)
		.values({
			slug,
			title: `Alarm fixture ${slug}`,
			resolutionDeadline: new Date(Date.now() + 30 * 24 * 3600 * 1000),
			status: "Open",
		})
		.returning({ id: markets.id });
	const marketId = m?.id ?? "";
	await testDb
		.insert(pools)
		.values({ marketId, yesReserves: yes, noReserves: no });
	return marketId;
}

describe("check_liquidity_alarms — silence and undershoot", () => {
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
		await testClient.unsafe(
			`DELETE FROM watermark_state WHERE metric LIKE 'liquidity_%'`,
		);
	});

	it("liquidity-alarms::a-healthy-heartbeat-emits-nothing", async () => {
		// THE POSITIVE CONTROL, and it goes first deliberately. Every assertion
		// below is "an alarm appeared"; without this one, a function that alarmed
		// unconditionally would pass all of them.
		await seedPolicy(9601, true);
		await heartbeatAt(1);

		await check();

		expect(await alarms("liquidity_silence")).toHaveLength(0);
		expect((await watermark("liquidity_silence"))?.state).toBe("above");
	});

	it("liquidity-alarms::silence-fires-after-a-sixteen-minute-gap", async () => {
		// ADR-0047 §H: no heartbeat in 15 minutes. 16 is one minute past the edge
		// rather than an hour past it, so the test measures the threshold rather
		// than the general idea.
		await seedPolicy(9602, true);
		await heartbeatAt(16);

		await check();

		const fired = await alarms("liquidity_silence");
		expect(fired).toHaveLength(1);
		expect(fired[0]?.payload).toMatchObject({
			state: "below",
			window_minutes: 15,
		});
	});

	it("liquidity-alarms::silence-does-NOT-fire-inside-the-window", async () => {
		// The other edge. 14 minutes is inside the window and must stay quiet —
		// an alarm that fires early is an alarm that trains the operator to
		// discount it.
		await seedPolicy(9603, true);
		await heartbeatAt(14);

		await check();
		expect(await alarms("liquidity_silence")).toHaveLength(0);
	});

	it("liquidity-alarms::silence-fires-EXACTLY-ONCE-across-three-ticks", async () => {
		// ⛔ THE EDGE-TRIGGER ASSERTION, and the one that distinguishes this from
		// a naive predicate. `check_liquidity_alarms` runs every five minutes; a
		// per-tick alarm would produce twelve rows an hour for as long as the
		// outage lasted, which is how an alarm channel becomes noise and then
		// becomes ignored.
		await seedPolicy(9604, true);
		await heartbeatAt(30);

		await check();
		await check();
		await check();

		expect(await alarms("liquidity_silence")).toHaveLength(1);
	});

	it("liquidity-alarms::recovery-flips-the-state-and-emits-nothing", async () => {
		// After the episode ends the watermark must return to `above` WITHOUT
		// emitting — otherwise the next outage would not be an edge and would
		// never fire at all. This is the half that makes "exactly once per
		// episode" mean "once per episode" rather than "once, ever".
		await seedPolicy(9605, true);
		await heartbeatAt(30);
		await check();
		expect(await alarms("liquidity_silence")).toHaveLength(1);

		// The job comes back.
		await heartbeatAt(0);
		await check();

		expect(await alarms("liquidity_silence")).toHaveLength(1); // no NEW row
		expect((await watermark("liquidity_silence"))?.state).toBe("above");

		// ...and a SECOND outage fires again, which is the property recovery
		// exists to preserve.
		await testClient.unsafe(`DELETE FROM liquidity_heartbeat`);
		await heartbeatAt(30);
		await check();
		expect(await alarms("liquidity_silence")).toHaveLength(2);
	});

	it("liquidity-alarms::silence-is-NOT-evaluated-while-the-policy-is-disabled", async () => {
		// ⚠ RULING R4, AND ITS COST IS STATED RATHER THAN HIDDEN. Between the
		// migration applying and the operator's arming INSERT, the injector is
		// deliberately idle — alarming through that window would be alarming on a
		// system that is off on purpose.
		//
		// What that buys is quiet; what it costs is that a registration which
		// failed BEFORE arming is not caught here. The ADR Runbook's "verify a
		// heartbeat within 120 s of the arming INSERT" is what closes the gap, and
		// this test is the reason that line is in the Runbook rather than being
		// decoration.
		await seedPolicy(9606, false);
		await heartbeatAt(120); // two hours of silence

		await check();

		expect(await alarms("liquidity_silence")).toHaveLength(0);
		// Nothing was written at all — not even a watermark row, because the
		// function returns before either alarm.
		expect(await watermark("liquidity_silence")).toBeUndefined();
	});

	it("liquidity-alarms::silence-is-NOT-evaluated-when-no-policy-row-exists", async () => {
		// The truncated-table state. Same reasoning as above, and the same
		// reason `liquidity_policy` is a TRUNCATE exclusion on staging: with no
		// policy the injector fails closed, and alarming about a system that has
		// been switched off by accident is a different problem from this one.
		await truncateTables(testClient, ["liquidity_policy"]);
		await heartbeatAt(120);

		await check();
		expect(await alarms("liquidity_silence")).toHaveLength(0);
	});

	it("liquidity-alarms::undershoot-fires-on-a-market-below-sixty-percent-of-target", async () => {
		// R-5's bound. A guard skip and a satisfied trigger look IDENTICAL in the
		// pool row, so a market stuck outside the guard band would sit
		// under-provisioned indefinitely with nothing to say so. This alarm is
		// what makes the skip visible; the injector spec proves the skip itself.
		//
		// ⚠ Integer arithmetic on the threshold, per `0007`'s own header comment
		// (`unassigned * 20 < total`): `tank * 5 < target * 3`, never `0.6 *`.
		await seedPolicy(9607, true, "100000"); // no users → target = floor
		await seedMarketWithTank("alarm-under", "45000", "5000"); // tank 50000 < 60000
		await heartbeatAt(1); // healthy, so silence stays quiet

		await check();

		const fired = await alarms("liquidity_undershoot");
		expect(fired).toHaveLength(1);
		expect(fired[0]?.payload).toMatchObject({ state: "below", markets: 1 });
		expect(await alarms("liquidity_silence")).toHaveLength(0);
	});

	it("liquidity-alarms::undershoot-does-NOT-fire-on-a-market-at-the-threshold", async () => {
		// tank 60000 against target 100000 is exactly 60% — `tank * 5 < target * 3`
		// is `300000 < 300000`, false. The boundary is pinned as a case because a
		// reviewer switching `<` to `<=` would change when the operator gets woken
		// up, and nothing else in the file would notice.
		await seedPolicy(9608, true, "100000");
		await seedMarketWithTank("alarm-edge", "54000", "6000"); // tank 60000
		await heartbeatAt(1);

		await check();
		expect(await alarms("liquidity_undershoot")).toHaveLength(0);
	});

	it("liquidity-alarms::undershoot-ignores-a-market-that-is-not-Open", async () => {
		// A Closed market's reserves are frozen (`cpmm.md` §3.1) and its depth is
		// no longer anyone's problem. Alarming on it would produce an alarm with
		// no action behind it, which is the class of alarm that gets filtered.
		await seedPolicy(9609, true, "100000");
		const marketId = await seedMarketWithTank("alarm-closed", "4500", "500");
		await testClient.unsafe(
			`UPDATE markets SET status = 'Closed' WHERE id = $1`,
			[marketId],
		);
		await heartbeatAt(1);

		await check();
		expect(await alarms("liquidity_undershoot")).toHaveLength(0);
	});

	it("liquidity-alarms::undershoot-tracks-the-LIVE-target-not-a-fixed-floor", async () => {
		// The target is `max(floor, coefficient × signups)`, so a market that was
		// comfortable yesterday can be under-provisioned today purely because more
		// people arrived — which is the entire premise of ADR-0047. An alarm
		// pinned to the floor would go quiet exactly as the problem got worse.
		await seedPolicy(9610, true, "10000"); // low floor
		// 100 users × 500 = 50,000 target; the floor alone would be 10,000.
		for (let i = 0; i < 100; i++) {
			await testDb.insert(users).values({
				name: `Alarm user ${i}`,
				email: `alarm-target-${i}@example.com`,
				pseudonym: `alarm-target-${i}`,
			});
		}
		// tank 20,000: twice the floor, but 40% of the signup-derived target.
		await seedMarketWithTank("alarm-live-target", "18000", "2000");
		await heartbeatAt(1);

		await check();
		const fired = await alarms("liquidity_undershoot");
		expect(fired).toHaveLength(1);
		expect(fired[0]?.payload).toMatchObject({
			target: "50000.000000000000000000",
		});
	});

	it("liquidity-alarms::the-two-alarms-are-independent", async () => {
		// One episode of each, at once. They share a function and a queue table
		// but not a watermark row, and a reader triaging a page needs to know
		// which of the two conditions holds — "the job stopped" and "a market is
		// starved" have completely different responses.
		await seedPolicy(9611, true, "100000");
		await seedMarketWithTank("alarm-both", "45000", "5000");
		await heartbeatAt(60); // silent AND undershooting

		await check();

		expect(await alarms("liquidity_silence")).toHaveLength(1);
		expect(await alarms("liquidity_undershoot")).toHaveLength(1);
		expect((await watermark("liquidity_silence"))?.state).toBe("below");
		expect((await watermark("liquidity_undershoot"))?.state).toBe("below");
	});

	it("liquidity-alarms::`since`-moves-on-a-transition-and-holds-on-a-repeat", async () => {
		// ⚠ THIS IS WHAT MAKES ADR-0047 §H's SIXTY-MINUTE CONDITION CHECKABLE AT
		// ALL. The duration half of `liquidity_undershoot` deliberately does NOT
		// live in this function — it belongs to the drain handler reading the
		// alarm, because a function that runs every five minutes would otherwise
		// have to re-derive when the episode began. `watermark_state.since` IS
		// that record, and it is only usable if it moves exactly once per episode.
		await seedPolicy(9612, true, "100000");
		await seedMarketWithTank("alarm-since", "45000", "5000");
		await heartbeatAt(1);

		await check();
		const first = (await watermark("liquidity_undershoot"))?.since;
		expect(first).toBeDefined();

		await check();
		const second = (await watermark("liquidity_undershoot"))?.since;
		// Unchanged: the episode did not restart, so the clock did not either.
		expect(second).toBe(first);
	});
});
