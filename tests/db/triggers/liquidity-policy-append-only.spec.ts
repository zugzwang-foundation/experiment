import { afterEach, describe, expect, it } from "vitest";

import { testClient } from "../_fixtures/db";
import { truncateTables } from "../_fixtures/truncate";

// Bucket A — liquidity_policy (LIQ-1 Phase 2, migration 0027, ADR-0047 §G).
// The injector's parameter history: one row per version, newest
// `effective_from <= now()` wins, and tuning is an INSERT of a NEW version
// rather than an UPDATE of the current one.
//
// ⚠ THE APPEND-ONLY PROPERTY HERE IS NOT BOOKKEEPING — IT IS THE AUDIT TRAIL
// ITSELF. Every `pool.liquidity_added` row carries a `policyVersion`, and that
// is the ONLY way a reader of the public dataset reproduces an injection: the
// target rule is `max(floor, coefficient × count(*) FROM users)`, and neither
// operand is derivable from the events. Let one row be UPDATEd and every
// injection that cites it silently starts describing parameters that were
// never in force.
//
// The bounds CHECK is tested here alongside the triggers, and belongs with
// them for the same reason: tuning is an operator INSERT by design (ADR §G:
// "Never a deploy"), so there is no PR, no CI run and no reviewer between a
// typo and every Open market. THE CONSTRAINT IS THE REVIEW (plan §9 R-3).
//
// Rows are inserted with `testClient.unsafe` rather than through drizzle, on
// the SPEC.2 §6.6 fixture-bypass posture: the point is to reach the trigger,
// not to exercise the query builder.

const BASE = {
	coefficient: "500",
	floor: "100000",
	trigger_ratio: "0.80",
	guard_low: "0.02",
	guard_high: "0.95",
	endgame_hours: 72,
	lock_timeout_ms: 100,
};

async function insertPolicy(
	version: number,
	overrides: Partial<typeof BASE> & { enabled?: boolean } = {},
): Promise<string> {
	const v = { ...BASE, enabled: false, ...overrides };
	const rows = await testClient.unsafe<Array<{ id: string }>>(
		`INSERT INTO liquidity_policy
		   (version, coefficient, floor, trigger_ratio, guard_low, guard_high,
		    endgame_hours, lock_timeout_ms, enabled)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		 RETURNING id`,
		[
			version,
			v.coefficient,
			v.floor,
			v.trigger_ratio,
			v.guard_low,
			v.guard_high,
			v.endgame_hours,
			v.lock_timeout_ms,
			v.enabled,
		],
	);
	return rows[0]?.id ?? "";
}

/**
 * Restore migration `0027`'s seeded row.
 *
 * ⚠ This is not tidiness. `liquidity_policy` is Bucket A, so the only way to
 * clear it is TRUNCATE — and once truncated, nothing puts the row back:
 * drizzle believes `0027` is applied and will never re-run it, and
 * `db:seed:staging` seeds `identity_pool` alone. A spec that truncated and
 * walked away would leave every later injector test reading NO POLICY, which
 * fails closed and looks exactly like a correctly-disabled system.
 *
 * That is the same hazard `tests/staging/_lib/guards.ts` answers on staging by
 * making the table a TRUNCATE **exclusion** with its guard left armed. Here the
 * database is disposable, so the answer is to put the row back by hand.
 */
async function restoreSeedRow(): Promise<void> {
	await testClient.unsafe(
		`INSERT INTO liquidity_policy
		   (version, coefficient, floor, trigger_ratio, guard_low, guard_high,
		    endgame_hours, lock_timeout_ms, enabled, effective_from)
		 VALUES (1, 500, 100000, 0.80, 0.02, 0.95, 72, 100, false, now())
		 ON CONFLICT (version) DO NOTHING`,
	);
}

describe("liquidity_policy — append-only triggers", () => {
	afterEach(async () => {
		await truncateTables(testClient, ["liquidity_policy"]);
		await restoreSeedRow();
	});

	it("rejects UPDATE with P0001", async () => {
		const id = await insertPolicy(9001);

		await expect(
			testClient.unsafe(
				`UPDATE liquidity_policy SET enabled = true WHERE id = $1`,
				[id],
			),
		).rejects.toMatchObject({
			code: "P0001",
			message: expect.stringContaining("UPDATE not permitted"),
		});
	});

	it("rejects UPDATE even of a column nothing reads", async () => {
		// The guard is on the ROW, not on a column set. Stated as its own case
		// because "we only touched effective_from" is exactly the reasoning that
		// would reach for an UPDATE here, and it is the reasoning the trigger
		// exists to refuse.
		const id = await insertPolicy(9002);

		await expect(
			testClient.unsafe(
				`UPDATE liquidity_policy SET effective_from = now() WHERE id = $1`,
				[id],
			),
		).rejects.toMatchObject({ code: "P0001" });
	});

	it("rejects DELETE with P0001", async () => {
		const id = await insertPolicy(9003);

		await expect(
			testClient.unsafe(`DELETE FROM liquidity_policy WHERE id = $1`, [id]),
		).rejects.toMatchObject({
			code: "P0001",
			message: expect.stringContaining("DELETE not permitted"),
		});
	});

	it("rejects TRUNCATE with its guard armed", async () => {
		// The teardown above DISABLES the guard to clear the table, which means
		// nothing else in this file proves the guard is armed in the first place.
		// This case is that proof — and it is the one that matters on staging,
		// where the table is a TRUNCATE exclusion precisely so this refusal
		// aborts a reset batch that reached for it.
		await insertPolicy(9004);

		await expect(
			testClient.unsafe(`TRUNCATE liquidity_policy`),
		).rejects.toMatchObject({
			code: "P0001",
			message: expect.stringContaining("TRUNCATE not permitted"),
		});
	});

	it("accepts a second version — tuning is an INSERT, not an UPDATE", async () => {
		// The positive control. Three rejections in a row could be produced by a
		// table nothing can write to at all, which would be a different and
		// equally broken thing; this proves the append half of append-only.
		await insertPolicy(9005, { coefficient: "500" });
		await insertPolicy(9006, { coefficient: "750" });

		const rows = await testClient.unsafe<Array<{ coefficient: string }>>(
			`SELECT coefficient FROM liquidity_policy
			 WHERE version IN (9005, 9006) ORDER BY version DESC LIMIT 1`,
		);
		expect(rows[0]?.coefficient).toBe("750.000000000000000000");
	});

	it("rejects a duplicate version — the newest-wins read needs a total order", async () => {
		await insertPolicy(9007);
		await expect(insertPolicy(9007)).rejects.toMatchObject({ code: "23505" });
	});
});

describe("liquidity_policy — the bounds CHECK is the only review there is", () => {
	afterEach(async () => {
		await truncateTables(testClient, ["liquidity_policy"]);
		await restoreSeedRow();
	});

	// Each of these is a one-INSERT operator typo that, without the CHECK, either
	// stops every injection silently or lets one run unbounded. There is no code
	// path between the typo and production, which is why they are enumerated
	// rather than sampled.
	const REJECTED: ReadonlyArray<
		readonly [name: string, overrides: Partial<typeof BASE>]
	> = [
		[
			"a zero coefficient — every market's target collapses to the floor",
			{ coefficient: "0" },
		],
		["a negative coefficient", { coefficient: "-1" }],
		[
			"a zero floor — a market with no users gets no depth at all",
			{ floor: "0" },
		],
		[
			"a trigger_ratio above 1 — injects a market already at target",
			{ trigger_ratio: "1.5" },
		],
		["a zero trigger_ratio — nothing ever fires", { trigger_ratio: "0" }],
		[
			"guard_low above guard_high — the band is empty, every market skips",
			{ guard_low: "0.9", guard_high: "0.1" },
		],
		[
			"a guard_high of 1 — no price is ever above it, so the guard is off",
			{ guard_high: "1" },
		],
		["a zero guard_low", { guard_low: "0" }],
		[
			"a negative endgame_hours — the endgame window runs backwards",
			{ endgame_hours: -1 },
		],
		[
			"a zero lock_timeout_ms — the sweep waits forever on a contended pool",
			{ lock_timeout_ms: 0 },
		],
		// ⛔ THE CEILING (@db-migration-reviewer HIGH-1, migration 0028). The
		// bounds CHECK bounded every parameter from BELOW and only one from above,
		// and `lock_timeout_ms` is the one the whole one-transaction sweep's safety
		// argument rests on: the sweep holds a pool row from lock to sweep-end, and
		// a bet waiting on it has a 1,000 ms statement_timeout whose 57014 is NOT
		// retryable. A bet that loses that race does not retry — it 500s.
		//
		// Measured before 0028: `lock_timeout_ms = 2147483647` was ACCEPTED. These
		// are the two realistic ways an operator typing a bare INSERT gets there.
		[
			"an extra zero on lock_timeout_ms — 8 markets × 1 s against a 1 s bet budget",
			{ lock_timeout_ms: 1000 },
		],
		["a ms/s unit slip on lock_timeout_ms", { lock_timeout_ms: 100000 }],
		[
			"an int4-max lock_timeout_ms — the value that was accepted before 0028",
			{ lock_timeout_ms: 2147483647 },
		],
		// L-8. Measured: `now() + make_interval(hours => 2147483647)` evaluates
		// cleanly to the year 247010 — every market skipped forever, silently, with
		// the undershoot alarm as the only sign anything is wrong.
		[
			"an endgame_hours past any plausible tuning — every market skipped forever",
			{ endgame_hours: 8761 },
		],
	];

	for (const [name, overrides] of REJECTED) {
		it(`rejects ${name}`, async () => {
			// ⚠ The constraint NAME is deliberately not asserted here any more.
			// `0028` splits the ceilings into their own constraints
			// (`liquidity_policy_lock_timeout_ceiling`,
			// `liquidity_policy_endgame_ceiling`), and pinning one name would have
			// made this loop assert WHICH constraint caught the typo rather than
			// THAT one did — the operator does not care, and a future split would
			// red a test about nothing.
			await expect(insertPolicy(9100, overrides)).rejects.toMatchObject({
				code: "23514",
			});
		});
	}

	it("accepts lock_timeout_ms exactly at the 0028 ceiling", async () => {
		// The boundary is inclusive: 250 is a legal tuning, 251 is not. Pinned as
		// its own case because a reviewer tightening `<=` to `<` would silently
		// forbid a value the ADR Runbook names as available.
		await expect(
			insertPolicy(9102, { lock_timeout_ms: 250 }),
		).resolves.toBeTruthy();
	});

	it("accepts trigger_ratio exactly 1 — the boundary is inclusive by design", async () => {
		// At 1.0 the injector chases the target continuously. That is legal and
		// deliberate, so the CHECK is `<= 1`. Pinned as a case because a reviewer
		// tightening it to `< 1` would break a valid tuning with no test to say so.
		await expect(
			insertPolicy(9101, { trigger_ratio: "1" }),
		).resolves.toBeTruthy();
	});
});
