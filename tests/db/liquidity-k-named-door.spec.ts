import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { markets, pools, users } from "@/db/schema";
import { computeBuy, computeSell } from "@/server/cpmm/calculate";
import { CpmmDecimal } from "@/server/cpmm/decimal";
import { testClient, testDb } from "./_fixtures/db";
import { truncateTables } from "./_fixtures/truncate";

// OD-2 / ruling R2 — the ADR §Acceptance row, as amended.
//
// ⚠ THE ROW THIS TESTS WAS FALSE AS ORIGINALLY WRITTEN, AND THAT IS WHY IT WAS
// RULED ON. It said `k′ > k` only on inject. `cpmm.md` §12 E2 is a BUY that
// moves `k` from 10000 to 10000.000000000000000010, because `floor18` dust
// accrues to the pool on every trade — and all fourteen live staging pools sit
// above their opening `k` for exactly that reason. A test written to the
// original row would have failed against correct code.
//
// R2's replacement, asserted here clause by clause:
//
//   "k changes only through a named door — every reserve write has exactly one
//    event row; between consecutive events k is unchanged; buy/sell k′ ≥ k;
//    inject k′ > k by the computed amount; open sets k."

const MIGRATIONS = fileURLToPath(
	new URL("../../drizzle/migrations/", import.meta.url),
);

async function seedPolicy(v: number): Promise<void> {
	await testClient.unsafe(
		`INSERT INTO liquidity_policy
		   (version, coefficient, floor, trigger_ratio, guard_low, guard_high,
		    endgame_hours, lock_timeout_ms, enabled)
		 VALUES ($1, 500, 100000, 0.80, 0.02, 0.95, 72, 100, true)`,
		[v],
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

const k = (yes: string, no: string) =>
	new CpmmDecimal(yes).times(new CpmmDecimal(no));

describe("k changes only through a named door (ADR-0047 §Acceptance, R2)", () => {
	beforeEach(async () => {
		await testClient.unsafe(`DELETE FROM liquidity_heartbeat`);
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
	});

	it("k-door::buy-and-sell-never-lower-k", async () => {
		// The clause the original row got backwards. `k′ ≥ k` is the invariant;
		// `floor18` dust makes it STRICTLY greater on most trades, and a test
		// asserting equality would fail against correct code — which is precisely
		// what happened to the acceptance row itself.
		//
		// Pure functions, no database: the walk is the claim, and mounting it
		// against Postgres would only add a way for the test to be wrong.
		let reserves = {
			yes: "9000.000000000000000000",
			no: "1000.000000000000000000",
		};
		let previous = k(reserves.yes, reserves.no);

		for (const step of [
			{ side: "yes" as const, stake: "37.5" },
			{ side: "no" as const, stake: "12.25" },
			{ side: "yes" as const, stake: "0.000000000000000001" },
			{ side: "no" as const, stake: "250" },
		]) {
			const out = computeBuy({ reserves, side: step.side, stake: step.stake });
			reserves = out.reserves;
			const next = k(reserves.yes, reserves.no);
			expect(next.greaterThanOrEqualTo(previous)).toBe(true);
			previous = next;
		}

		// And a sell, which returns shares to the pool.
		const sold = computeSell({
			reserves,
			side: "yes",
			shares: "10.000000000000000000",
		});
		expect(
			k(sold.reserves.yes, sold.reserves.no).greaterThanOrEqualTo(previous),
		).toBe(true);
	});

	it("k-door::inject-raises-k-by-the-computed-amount", async () => {
		// The injector's own clause. A price-preserving placement scales BOTH
		// reserves by (L + a)/L, so `k` scales by the SQUARE of that — which is
		// what "by the computed amount" means and what distinguishes an injection
		// from a trade in the ledger of `k`.
		await testDb.insert(users).values({
			name: "K door",
			email: "k-door@example.com",
			pseudonym: "k-door",
		});
		const [m] = await testDb
			.insert(markets)
			.values({
				slug: "k-door-inject",
				title: "k door",
				resolutionDeadline: new Date(Date.now() + 30 * 24 * 3600 * 1000),
				status: "Open",
			})
			.returning({ id: markets.id });
		const marketId = m?.id ?? "";
		await testDb.insert(pools).values({
			marketId,
			yesReserves: "9000.000000000000000000",
			noReserves: "1000.000000000000000000",
		});
		await seedPolicy(9901);

		const kBefore = k("9000", "1000");
		await testClient.unsafe(`SELECT run_liquidity_injection()`);

		const after = await testClient.unsafe<Array<{ yes: string; no: string }>>(
			`SELECT yes_reserves AS yes, no_reserves AS no FROM pools WHERE market_id = $1`,
			[marketId],
		);
		const kAfter = k(after[0]?.yes ?? "0", after[0]?.no ?? "0");

		// STRICTLY greater — an injection that left `k` unchanged would have added
		// no depth at all.
		expect(kAfter.greaterThan(kBefore)).toBe(true);

		// ...and by the amount the placement implies: k' / k == ((L + a)/L)², to
		// within the one ulp the short side's floor can cost. Asserting the RATIO
		// rather than "it went up" is what makes this a measurement of the door
		// rather than of the fact that something happened.
		const payload = await testClient.unsafe<Array<{ backing: string }>>(
			`SELECT payload->>'backingMinted' AS backing FROM events
			 WHERE aggregate_id = $1 AND event_type = 'pool.liquidity_added'`,
			[marketId],
		);
		const a = new CpmmDecimal(payload[0]?.backing ?? "0");
		const scale = new CpmmDecimal("9000").plus(a).dividedBy("9000");
		const expected = kBefore.times(scale).times(scale);
		const relativeError = kAfter.minus(expected).abs().dividedBy(expected);
		expect(relativeError.lessThan("1e-15")).toBe(true);
	});

	it("k-door::every-reserve-write-has-exactly-one-event-row", async () => {
		// The clause that makes the other three checkable at all. If a reserve
		// could move without an event, `k` would change with no door and the
		// audit trail would be describing a different market from the one running.
		await testDb.insert(users).values({
			name: "K door two",
			email: "k-door-2@example.com",
			pseudonym: "k-door-2",
		});
		const [m] = await testDb
			.insert(markets)
			.values({
				slug: "k-door-events",
				title: "k door events",
				resolutionDeadline: new Date(Date.now() + 30 * 24 * 3600 * 1000),
				status: "Open",
			})
			.returning({ id: markets.id });
		const marketId = m?.id ?? "";
		await testDb.insert(pools).values({
			marketId,
			yesReserves: "9000.000000000000000000",
			noReserves: "1000.000000000000000000",
		});
		await seedPolicy(9902);

		// Three sweeps. The first injects; the next two find the tank at target
		// and skip, so the event count must be 1 rather than 3 — a writer that
		// emitted on a skip would put a door in the audit trail that nothing
		// walked through.
		await testClient.unsafe(`SELECT run_liquidity_injection()`);
		const afterFirst = await testClient.unsafe<
			Array<{ yes: string; no: string }>
		>(
			`SELECT yes_reserves AS yes, no_reserves AS no FROM pools WHERE market_id = $1`,
			[marketId],
		);
		await testClient.unsafe(`SELECT run_liquidity_injection()`);
		await testClient.unsafe(`SELECT run_liquidity_injection()`);

		const rows = await testClient.unsafe<Array<{ n: string }>>(
			`SELECT count(*)::text AS n FROM events
			 WHERE aggregate_id = $1 AND event_type = 'pool.liquidity_added'`,
			[marketId],
		);
		expect(rows[0]?.n).toBe("1");

		// BETWEEN consecutive events `k` is unchanged: two sweeps wrote nothing,
		// so the reserves are exactly what the first left.
		const afterThird = await testClient.unsafe<
			Array<{ yes: string; no: string }>
		>(
			`SELECT yes_reserves AS yes, no_reserves AS no FROM pools WHERE market_id = $1`,
			[marketId],
		);
		expect(afterThird[0]).toEqual(afterFirst[0]);
	});

	it("k-door::no-OTHER-code-path-writes-pools", async () => {
		// ⛔ THE SOURCE SCAN, and OD-2 asks for it explicitly. The three clauses
		// above are all "given a write, it was a door"; this one is "there are no
		// other writes". Nothing else can establish that — a behavioural test can
		// only observe the paths it thinks to exercise.
		//
		// ⚠ Matched as CLASS TOKENS rather than as bare words, per the register
		// entry a source scan in this repo has tripped over six times: a naive
		// /pools/ would match the word in a comment explaining why a file does NOT
		// write pools, and report the explanation as the defect.
		const SRC = fileURLToPath(new URL("../../src/", import.meta.url));
		const { execSync } = await import("node:child_process");

		// Drizzle writes: `.update(pools)` and `.insert(pools)`.
		const drizzleWrites = execSync(
			`grep -rn --include=*.ts -E '\\.(update|insert|delete)\\(pools\\)' ${SRC} || true`,
			{ encoding: "utf8" },
		)
			.split("\n")
			.filter(Boolean);

		// EXACTLY THREE production writers, and they are §7.4's first, second and
		// fourth doors — the third being the migration below:
		//   - markets/open.ts — the one production pools INSERT (open sets k)
		//   - bets/place.ts   — buy
		//   - bets/sell.ts    — sell
		//
		// ⚠ This list was written as TWO (`bets/persist.ts`) on a guess and the
		// scan corrected it, which is the scan doing its job: a source guard
		// written from memory is a guard that asserts the author's model rather
		// than the tree. The corrected shape is the better result — three source
		// writers plus one migration writer is exactly the four doors §7.4 names,
		// with nothing left over.
		const files = new Set(
			drizzleWrites.map((l) => l.split(":")[0]?.replace(SRC, "") ?? ""),
		);
		expect([...files].sort()).toEqual([
			"server/bets/place.ts",
			"server/bets/sell.ts",
			"server/markets/open.ts",
		]);

		// And the migrations: the ONLY raw `UPDATE pools` in the whole migration
		// set is the injector's. A second one would be a fourth door nobody
		// declared.
		const migrationWrites = execSync(
			`grep -rn -E '^[[:space:]]*UPDATE pools' ${MIGRATIONS} || true`,
			{ encoding: "utf8" },
		)
			.split("\n")
			.filter(Boolean);
		expect(migrationWrites).toHaveLength(1);
		expect(migrationWrites[0]).toContain("0027_liquidity_injector_pg_cron.sql");
	});

	it("k-door::the-injector-is-the-only-pg_cron-job-that-writes-a-money-table", async () => {
		// The registrations are stripped on this substrate, so the migration text
		// is the authority. `0007` and `0011` alarm and diagnose; neither writes a
		// reserve, a position or a ledger row — which is what makes the injector's
		// arrival a genuinely new class of writer rather than one more of the same.
		const sql = readFileSync(
			`${MIGRATIONS}0027_liquidity_injector_pg_cron.sql`,
			"utf8",
		);
		expect(sql).toContain("SELECT run_liquidity_injection()");
		expect(sql).toContain("SELECT check_liquidity_alarms()");
		// The alarms function must NEVER write a money table — it is a reader.
		const alarmsBody = sql.slice(
			sql.indexOf("CREATE OR REPLACE FUNCTION check_liquidity_alarms"),
		);
		expect(alarmsBody).not.toMatch(/UPDATE pools/);
		expect(alarmsBody).not.toMatch(/INSERT INTO dharma_ledger/);
		expect(alarmsBody).not.toMatch(/INSERT INTO positions/);
	});
});
