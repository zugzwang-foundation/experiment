import { afterEach, describe, expect, it } from "vitest";
import { users } from "@/db/schema";
import { testClient, testDb } from "../db/_fixtures/db";
import { truncateTables } from "../db/_fixtures/truncate";

// ENGINE.9 §5.6 tests-first (I2, plan §Test plan) — the zero-alarms drift
// charter over resolution-shaped ledger histories, including the D-1 fixture
// matrix (a)/(b)/(c). This suite REDs against the SHIPPED 0011
// `check_nightly_drift()` BY DESIGN — it drives migration 0015
// (`nightly_drift_zero_terminal_fix`): the shipped D2-A and D2-B clauses
// false-alarm every per-user chain whose terminal row sits at balance 0.
//
// NO src import — direct-SQL ledger fixtures (dharma_ledger is Bucket-A
// append-only; INSERT-only is legal) + `SELECT check_nightly_drift()` +
// `cron_alarms` reads. Each fixture user is ISOLATED; D1 (position drift)
// sees no events/positions rows and stays silent throughout.
//
// Notation (0011): per row, implied_prev ip = balance_after − amount
// (uncollectable rows: ip := balance_after). Z = count(ip = 0),
// L = count(balance_after = 0).
//   shipped D2-B fires when Z ≠ 1; corrected: (Z − L) NOT IN (0, 1).
//   shipped D2-A fires when no unique net=+1 sink exists OR sink ≠ Σ non-unc
//   amounts; corrected adds the zero-sink branch (sink_count = 0 ∧ Σ = 0).
//
// Expected split (the plan's fix-validation matrix):
//   (a)/(b)/(c) → ZERO alarms wanted → RED under shipped 0011;
//   settled / voided end-state shapes (terminal ≠ 0) → zero alarms (GREEN
//   under shipped — pinned so 0015 cannot regress them);
//   positive controls (broken link / duplicate genesis) → alarms WANTED and
//   the shipped function fires → GREEN (detection must not be weakened).

async function seedUser(emailTag: string): Promise<string> {
	const [user] = await testDb
		.insert(users)
		.values({
			name: "Drift User",
			email: `${emailTag}@example.com`,
			pseudonym: emailTag,
		})
		.returning({ id: users.id });
	return user?.id ?? "";
}

/**
 * Direct ledger INSERT (fixture bypass — SPEC.2 §6.6). bet_id stays NULL
 * (legal for fixture bet_stake rows; the drift checks never read bet_id).
 * Distinct created_at per row keeps the history realistic; the checks are
 * order-free regardless.
 */
async function insertRow(
	userId: string,
	entryType: string,
	amount: string,
	balanceAfter: string,
	minuteOffset: number,
): Promise<void> {
	await testClient.unsafe(
		`INSERT INTO dharma_ledger (user_id, entry_type, amount, balance_after, created_at)
		 VALUES ($1, $2::dharma_entry_type, $3, $4, $5)`,
		[
			userId,
			entryType,
			amount,
			balanceAfter,
			new Date(
				Date.parse("2026-09-15T06:00:00Z") + minuteOffset * 60_000,
			).toISOString(),
		],
	);
}

async function insertHistory(
	userId: string,
	rows: readonly [entryType: string, amount: string, balanceAfter: string][],
): Promise<void> {
	for (const [i, [entryType, amount, balanceAfter]] of rows.entries()) {
		await insertRow(userId, entryType, amount, balanceAfter, i);
	}
}

async function runDrift(): Promise<void> {
	await testClient.unsafe(`SELECT check_nightly_drift()`);
}

async function dharmaAlarmsFor(
	userId: string,
): Promise<{ derivation: string }[]> {
	const rows = await testClient.unsafe(
		`SELECT payload->>'derivation' AS derivation
		 FROM cron_alarms
		 WHERE alarm_id = 'dharma_chain_drift' AND payload->>'user_id' = $1`,
		[userId],
	);
	return rows.map((r) => ({ derivation: String(r.derivation) }));
}

async function totalAlarmCount(): Promise<number> {
	const rows = await testClient.unsafe(
		`SELECT count(*)::int AS count FROM cron_alarms`,
	);
	return Number(rows[0]?.count ?? -1);
}

describe("ENGINE.9 I2 — nightly drift over resolution ledger shapes", () => {
	afterEach(async () => {
		await truncateTables(testClient, ["cron_alarms", "dharma_ledger", "users"]);
	});

	it("nightly-drift::settled-market-shapes-zero-alarms", async () => {
		// Post-settle end states, terminal ≠ 0 (clean under shipped AND
		// corrected — pinned so 0015 cannot weaken the normal case).
		// Winner: grant +1000 → stake −100 → payout +150.
		// Loser:  grant +1000 → stake −100 (no settlement ledger row, R-9.2).
		const winner = await seedUser("drift-settle-winner");
		const loser = await seedUser("drift-settle-loser");
		await insertHistory(winner, [
			["initial_grant", "1000", "1000"],
			["bet_stake", "-100", "900"],
			["bet_payout", "150", "1050"],
		]);
		await insertHistory(loser, [
			["initial_grant", "1000", "1000"],
			["bet_stake", "-100", "900"],
		]);

		await runDrift();
		expect(await totalAlarmCount()).toBe(0);
	});

	it("nightly-drift::voided-market-shape-zero-alarms", async () => {
		// Post-void end state: grant +1000 → stake −100 → void_refund +100.
		const userId = await seedUser("drift-void");
		await insertHistory(userId, [
			["initial_grant", "1000", "1000"],
			["bet_stake", "-100", "900"],
			["void_refund", "100", "1000"],
		]);

		await runDrift();
		expect(await totalAlarmCount()).toBe(0);
	});

	it("nightly-drift::corrected-floored-user-parked-at-zero-zero-alarms", async () => {
		// Fixture (a) — the R-9.6 floored clawback PARKED AT ZERO (the exact
		// post-correction shape S4 produces; uncollectable row terminal,
		// model A). Z = {r1,r3,r6} = 3, L = {r2,r5,r6} = 3 ⇒ Z − L = 0:
		// corrected D2-B clean, shipped (Z ≠ 1) FIRES. All nets 0 ⇒
		// sink_count = 0 with Σ non-unc = 0: corrected D2-A clean (zero-sink
		// branch), shipped (sink_count ≠ 1) FIRES. → RED until 0015.
		const userId = await seedUser("drift-parked-zero");
		await insertHistory(userId, [
			["initial_grant", "100", "100"],
			["bet_stake", "-100", "0"],
			["bet_payout", "150", "150"],
			["bet_stake", "-110", "40"],
			["correction_reverse", "-40", "0"],
			["uncollectable", "-110", "0"],
		]);

		await runDrift();
		expect(await dharmaAlarmsFor(userId)).toEqual([]);
		expect(await totalAlarmCount()).toBe(0);
	});

	it("nightly-drift::spend-to-exactly-zero-and-stop-zero-alarms", async () => {
		// Fixture (b) — THE DISCRIMINATING FIXTURE: clean under shipped D2-B
		// (Z = 1), false-alarmed by shipped D2-A (all nets 0, no sink) AND by
		// the round-1 0015 formula (Z − L = 0 ≠ 1), clean under corrected
		// 0015. → RED until 0015.
		const userId = await seedUser("drift-spend-stop");
		await insertHistory(userId, [
			["initial_grant", "100", "100"],
			["bet_stake", "-100", "0"],
		]);

		await runDrift();
		expect(await dharmaAlarmsFor(userId)).toEqual([]);
		expect(await totalAlarmCount()).toBe(0);
	});

	it("nightly-drift::spend-to-zero-then-credit-zero-alarms", async () => {
		// Fixture (c) — spend to zero, later credit: Z = {r1,r3} = 2 ⇒
		// shipped D2-B (Z ≠ 1) FIRES; Z − L = 1 ⇒ corrected clean. D2-A is
		// clean under both (unique sink 50 = Σ non-unc). → RED until 0015.
		const userId = await seedUser("drift-zero-credit");
		await insertHistory(userId, [
			["initial_grant", "100", "100"],
			["bet_stake", "-100", "0"],
			["daily_allowance", "50", "50"],
		]);

		await runDrift();
		expect(await dharmaAlarmsFor(userId)).toEqual([]);
		expect(await totalAlarmCount()).toBe(0);
	});

	it("nightly-drift::control-broken-link-still-alarms", async () => {
		// POSITIVE CONTROL 1 — a genuinely broken chain link: r2 has
		// ip = 60 − (−30) = 90 with NO predecessor row at balance 90. The
		// D2-B edge-link clause (i) fires under shipped 0011 AND must STILL
		// fire under corrected 0015 (clause (i) is untouched — detection is
		// not weakened). GREEN now and after.
		const userId = await seedUser("drift-broken-link");
		await insertHistory(userId, [
			["initial_grant", "100", "100"],
			["bet_stake", "-30", "60"],
		]);

		await runDrift();
		const alarms = await dharmaAlarmsFor(userId);
		expect(alarms.length).toBeGreaterThanOrEqual(1);
		expect(alarms.some((a) => a.derivation === "D2-B")).toBe(true);
	});

	it("nightly-drift::control-duplicate-genesis-still-alarms", async () => {
		// POSITIVE CONTROL 2 — a fabricated second genesis with terminal ≠ 0:
		// r2 (bet_payout +50, ba 50) has ip = 0. NOT a second initial_grant —
		// the 0013 unique index forecloses that vector independently.
		// Z = 2, L = 0 ⇒ Z − L = 2 ∉ {0, 1}: D2-B fires under shipped AND
		// corrected. Nets {100:+1, 50:+1, 0:−2} ⇒ sink_count = 2: D2-A fires
		// under shipped AND corrected. GREEN now and after.
		const userId = await seedUser("drift-dup-genesis");
		await insertHistory(userId, [
			["initial_grant", "100", "100"],
			["bet_payout", "50", "50"],
		]);

		await runDrift();
		const alarms = await dharmaAlarmsFor(userId);
		expect(alarms.some((a) => a.derivation === "D2-B")).toBe(true);
		expect(alarms.some((a) => a.derivation === "D2-A")).toBe(true);
	});

	it("nightly-drift::pin-uncollectable-fork-evades-both-derivations-zero-alarms", async () => {
		// PIN test — documents the order-free detector residual (0015 header
		// residual class; an A2 fork of this shape evades BOTH D2-A and D2-B). A
		// seq-ordered per-user walk (a "D2-C", parked in docs/parked.md per
		// OQ-3) would flip this to alarm. A deliberate behavioral pin, not an
		// endorsement.
		//
		// Fork: [+10 → 10], [-3 → 7], [uncollectable -5 → 10 (stale base 10)].
		// uncollectable's implied_prev := balance_after = 10, so ip = {0,10,10},
		// ba = {10,7,10}: Z - L = 1 ⇒ D2-B silent; a single net-+1 sink 7 = the
		// sum of non-uncollectable amounts (10 - 3) ⇒ D2-A silent. The forked
		// row's stale base is invisible: 10 already balances as both a ba and ip.
		const userId = await seedUser("drift-pin-uncollectable-fork");
		await insertHistory(userId, [
			["initial_grant", "10", "10"],
			["bet_stake", "-3", "7"],
			["uncollectable", "-5", "10"],
		]);

		await runDrift();
		expect(await totalAlarmCount()).toBe(0);
	});

	it("nightly-drift::pin-balance-value-collision-fork-zero-alarms", async () => {
		// PIN test — documents the order-free detector residual (0015 header
		// residual class; an A2 fork of this shape evades BOTH D2-A and D2-B). A
		// seq-ordered per-user walk (a "D2-C", parked in docs/parked.md per
		// OQ-3) would flip this to alarm. A deliberate behavioral pin, not an
		// endorsement.
		//
		// Fork: [+10 → 10], [-3 → 7], [bet_payout +3 → 10 (implied_prev 7)]. The
		// fork multiset is identical to the legit linear chain +10,-3,+3:
		// ip = {0,10,7}, ba = {10,7,10} ⇒ Z - L = 1 (D2-B silent); a single
		// net-+1 sink 10 = the sum of amounts 10 (D2-A silent). Indistinguishable
		// from a legit chain under any order-free check.
		const userId = await seedUser("drift-pin-balance-collision-fork");
		await insertHistory(userId, [
			["initial_grant", "10", "10"],
			["bet_stake", "-3", "7"],
			["bet_payout", "3", "10"],
		]);

		await runDrift();
		expect(await totalAlarmCount()).toBe(0);
	});
});
