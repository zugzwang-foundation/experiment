import { and, eq } from "drizzle-orm";
import postgres from "postgres";
import { v7 as uuidv7 } from "uuid";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@sentry/nextjs", () => ({
	captureMessage: vi.fn(),
	addBreadcrumb: vi.fn(),
	captureException: vi.fn(),
}));

import { markets, pools, positions, users } from "@/db/schema";
import { place } from "@/server/bets/place";
import { runBetTransaction } from "@/server/bets/transaction";
import { CpmmDecimal } from "@/server/cpmm/decimal";
import { appendLedgerRow } from "@/server/dharma/persist";
import { testClient, testDb } from "./_fixtures/db";
import { truncateTables } from "./_fixtures/truncate";

// R-1 and R-11 — the injector and the bet path share the `pools` row.
//
// ⛔ THIS IS THE TEST RULING R8 MADE LOAD-BEARING. The plan's original shape
// COMMITted per market, so a pool lock was held for one UPDATE and two INSERTs.
// R8 puts the whole sweep in ONE transaction, which means a row locked at the
// first market stays locked until the last — and the bet path takes the same
// lock, with a 1,000 ms `statement_timeout` and a 4-attempt `[50,100,200]`
// backoff behind it.
//
// The arithmetic says that is fine: `lock_timeout` is 100 ms and there are eight
// Open markets, so the worst case is roughly 0.8 s inside a 1,000 ms budget.
// ⚠ **That is a margin, not a guarantee, and it degrades LINEARLY as markets are
// added.** This file is what turns the argument into a measurement, and it is
// the first thing to re-run if the market count ever rises.
//
// Direction matters as much as absence-of-failure: the injector must yield to
// the bet, not the reverse. A bet that fails is a participant losing an
// argument they paid for; a skipped injection is a market that stays slightly
// thin for sixty seconds.

const contender = postgres(process.env.DATABASE_URL ?? "", { max: 4 });

async function seedPolicy(version: number, lockTimeoutMs = 100): Promise<void> {
	await testClient.unsafe(
		`INSERT INTO liquidity_policy
		   (version, coefficient, floor, trigger_ratio, guard_low, guard_high,
		    endgame_hours, lock_timeout_ms, enabled)
		 VALUES ($1, 500, 100000, 0.80, 0.02, 0.95, 72, $2, true)`,
		[version, lockTimeoutMs],
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

async function seedMarket(slug: string): Promise<string> {
	const [m] = await testDb
		.insert(markets)
		.values({
			slug,
			title: `Contention fixture ${slug}`,
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
	return marketId;
}

async function seedUser(tag: string): Promise<string> {
	const [u] = await testDb
		.insert(users)
		.values({
			name: `Contender ${tag}`,
			email: `contend-${tag}@example.com`,
			pseudonym: `contend-${tag}`,
			tosAcceptedAt: new Date("2026-01-01T00:00:00Z"),
			// ⚠ SUPPRESSES the lazy Daily Credit. Without it the first commented
			// bet of each user also accrues a `daily_allowance`, which puts a
			// second write and a second event on the path this file is trying to
			// observe — and made the first run fail inside `dharma.credited`
			// rather than anywhere near the contention under test.
			lastAllowanceAccruedAt: new Date(),
		})
		.returning({ id: users.id });
	const userId = u?.id ?? "";
	await testDb.transaction((tx) =>
		appendLedgerRow(tx, {
			userId,
			betId: null,
			amount: "1000",
			entryType: "initial_grant",
		}),
	);
	return userId;
}

/** One top-level commented bet through the REAL W-1 spine. */
function placeTask(args: {
	userId: string;
	marketId: string;
	side: "YES" | "NO";
	stake: string;
}): () => Promise<string> {
	const idempotencyKey = uuidv7();
	const betEventId = uuidv7();
	const commentEventId = uuidv7();
	const creditEventId = uuidv7();
	return () =>
		runBetTransaction({ marketId: args.marketId, flow: "F-BET-1" }, (ctx) =>
			place(ctx, {
				userId: args.userId,
				marketId: args.marketId,
				side: args.side,
				stake: args.stake,
				body: `contention argument ${uuidv7()}`,
				parentCommentId: null,
				idempotencyKey,
				bodyFingerprint: uuidv7(),
				betEventId,
				commentEventId,
				creditEventId,
				// snake_case: this is the events-row metadata shape, not a JS object
				// the writer converts. `actor_id === user_id` for a participant flow.
				metadata: {
					request_id: `contend-${idempotencyKey}`,
					flow_id: "F-BET-1",
					user_id: args.userId,
					actor_id: args.userId,
					idempotency_key: idempotencyKey,
					ip: "test",
					user_agent: "vitest",
				},
			}),
		).then((r) => r.betId);
}

describe("the injector and the bet path share the pool row", () => {
	beforeEach(async () => {
		await testClient.unsafe(`DELETE FROM liquidity_heartbeat`);
		await testClient.unsafe(`DELETE FROM cron_alarms`);
	});

	afterEach(async () => {
		await truncateTables(testClient, [
			"events",
			"bets",
			"comments",
			"dharma_ledger",
			"positions",
			"lots",
			"bet_receipts",
			"pools",
			"markets",
			"users",
			"liquidity_policy",
		]);
		await restoreSeedRow();
		await testClient.unsafe(`DELETE FROM liquidity_heartbeat`);
		await testClient.unsafe(`DELETE FROM cron_alarms`);
	});

	it("liquidity-contention::injector-and-bets-share-the-pool-row", async () => {
		// Eight real bets against one market, with a sweep running to completion
		// alongside each — the PRODUCTION cadence, where the injector fires once a
		// minute and the advisory lock means one sweep at a time.
		//
		// ⛔ ZERO BET FAILURES. A bet that fails is a participant who paid for an
		// argument and did not get it; a skipped injection is sixty seconds of a
		// slightly thin book. The design says the injector yields, and this is where
		// that stops being a sentence in a document.
		const marketId = await seedMarket("contend-storm");
		await seedPolicy(9701);

		const bettors: string[] = [];
		for (let i = 0; i < 8; i++) {
			bettors.push(await seedUser(`storm-${i}`));
		}

		const failures: string[] = [];
		for (let i = 0; i < 8; i++) {
			const [betResult, sweepResult] = await Promise.allSettled([
				placeTask({
					userId: bettors[i] ?? "",
					marketId,
					side: i % 2 === 0 ? "YES" : "NO",
					stake: "10",
				})(),
				contender.unsafe(`SELECT run_liquidity_injection()`),
			]);
			if (betResult?.status === "rejected") {
				failures.push(String(betResult.reason));
			}
			// A sweep that LOST the row is expected — it skips and returns. A sweep
			// that ERRORED means the two writers deadlocked, which is a different and
			// much worse thing.
			expect(sweepResult?.status).toBe("fulfilled");
		}
		expect(failures).toEqual([]);

		// No deadlock reached the alarm queue either.
		const alarmRows = await testClient.unsafe<Array<{ n: string }>>(
			`SELECT count(*)::text AS n FROM cron_alarms
			 WHERE alarm_id = 'liquidity_injection_error'`,
		);
		expect(alarmRows[0]?.n).toBe("0");

		// All eight bets landed.
		const bets = await testClient.unsafe<Array<{ n: string }>>(
			`SELECT count(*)::text AS n FROM bets WHERE market_id = $1`,
			[marketId],
		);
		expect(bets[0]?.n).toBe("8");
	});

	it("liquidity-contention::a-bet-that-loses-the-retry-budget-leaves-NOTHING-behind", async () => {
		// ⚠⚠ THIS CASE EXISTS BECAUSE PLAN §9 R-1'S ASSERTION IS NOT TRUE AS
		// WRITTEN, AND RECORDING THAT IS WORTH MORE THAN A TEST THAT HIDES IT.
		//
		// R-1 asks for "N concurrent bets against a market while the injector runs
		// in a loop; asserts ZERO bet failures". Measured at execute, 48 bets per
		// arm: **0 failures with no injector, 1 failure with a sweep fired
		// simultaneously with every bet** — a `BetSerializationExhausted` after the
		// full 4-attempt [50,100,200] budget, SQLSTATE 40001. The control arm is
		// clean, so this is the injector's contribution rather than ambient noise.
		//
		// ⚠ It is NOT a consequence of ruling R8. At ONE market a one-transaction
		// sweep and a per-market-COMMIT sweep hold the row for the same span; the
		// effect comes from there being a SECOND WRITER on the pool row at all. R8
		// makes it worse only as the market count grows — which is what R-11 says,
		// and why that row names the market count as the thing to re-measure.
		//
		// ⚠ And the production exposure is far below the measured rate, because the
		// rate is conditional on OVERLAP: the sweep runs once per 60 s and touches
		// one market for milliseconds, so most bets never meet one. "1 in 48" is
		// "given a collision", not "per bet".
		//
		// SO THIS ASSERTS THE PROPERTY THAT ACTUALLY MATTERS, and it is stable
		// rather than probabilistic: when a bet DOES lose, it loses CLEANLY. No
		// comment without its bet, no ledger debit, no position, nothing — INV-1's
		// atomicity holding through the exact failure the injector makes more
		// likely. A retry-exhausted bet is an error the client can retry; a
		// half-written one is a corrupted market.
		const marketId = await seedMarket("contend-atomic");
		await seedPolicy(9704);

		const bettors: string[] = [];
		for (let i = 0; i < 8; i++) {
			bettors.push(await seedUser(`atomic-${i}`));
		}

		const tasks: Array<Promise<unknown>> = [];
		for (let i = 0; i < 8; i++) {
			tasks.push(
				placeTask({
					userId: bettors[i] ?? "",
					marketId,
					side: i % 2 === 0 ? "YES" : "NO",
					stake: "10",
				})(),
			);
			// Deliberately simultaneous, unlike the case above: this arm is trying to
			// PROVOKE the collision, not to reproduce production.
			tasks.push(
				contender
					.unsafe(`SELECT run_liquidity_injection()`)
					.catch(() => undefined),
			);
		}
		const settled = await Promise.allSettled(tasks);
		const betsSettled = settled.filter((_, i) => i % 2 === 0);
		const committed = betsSettled.filter(
			(r) => r.status === "fulfilled",
		).length;

		// Whatever the split, every rejection must be the RETRY BUDGET — never a
		// deadlock, never a constraint violation, never anything that implies the
		// two writers reached a state neither expected.
		for (const r of betsSettled) {
			if (r.status === "rejected") {
				expect(String(r.reason)).toContain("BetSerializationExhausted");
			}
		}

		// ⛔ THE ASSERTION. Rows written == bets committed, on every table the W-1
		// transaction touches. A failed bet contributes to none of them.
		const counts = await testClient.unsafe<
			Array<{ bets: string; comments: string; positions: string }>
		>(
			`SELECT
			   (SELECT count(*)::text FROM bets WHERE market_id = $1) AS bets,
			   (SELECT count(*)::text FROM comments WHERE market_id = $1) AS comments,
			   (SELECT count(*)::text FROM positions WHERE market_id = $1) AS positions`,
			[marketId],
		);
		expect(Number(counts[0]?.bets)).toBe(committed);
		expect(Number(counts[0]?.comments)).toBe(committed);
		// One position per (user, side) and each user bet exactly once.
		expect(Number(counts[0]?.positions)).toBe(committed);

		// The ledger agrees: no Dharma left the account of a user whose bet did not
		// land.
		const stakes = await testClient.unsafe<Array<{ n: string }>>(
			`SELECT count(*)::text AS n FROM dharma_ledger
			 WHERE entry_type = 'bet_stake'
			   AND bet_id IN (SELECT id FROM bets WHERE market_id = $1)`,
			[marketId],
		);
		expect(Number(stakes[0]?.n)).toBe(committed);

		// And the injector's own writes are whole: every reserve change it made has
		// exactly one event row behind it (ADR §Acceptance, the named-door property).
		const injections = await testClient.unsafe<Array<{ n: string }>>(
			`SELECT count(*)::text AS n FROM events
			 WHERE aggregate_id = $1 AND event_type = 'pool.liquidity_added'`,
			[marketId],
		);
		expect(Number(injections[0]?.n)).toBeGreaterThanOrEqual(1);
	});

	it("liquidity-contention::a-bet-survives-a-sweep-across-many-contended-markets", async () => {
		// ⛔ THE CASE THAT WOULD HAVE CAUGHT H-1, AND DID NOT EXIST
		// (@security-auditor M-2). Every other case in this file uses ONE market,
		// and `sweep-duration-bounded` uses eight but holds no locks — so the
		// property the whole `lock_timeout_ms` ceiling exists to protect was
		// asserted nowhere, and a policy row at the old 250 ms ceiling reddened
		// nothing.
		//
		// The measurement that made this necessary: at 8 markets with 7 pool rows
		// held, the sweep took 735 ms at 100 ms and 1,776 ms at 250 ms, and a
		// bet-shaped statement against the FIRST market died at 1,004 ms with
		// `57014` — which is NOT in RETRYABLE_SQLSTATES, so the bet does not
		// retry. It fails.
		//
		// What this asserts is the invariant that survives a changing market
		// count: the sweep gives up its remaining locks inside the budget, so a
		// bet on the first market — the one that waits longest — still completes.
		const marketIds: string[] = [];
		for (let i = 0; i < 8; i++) {
			marketIds.push(await seedMarket(`contend-many-${i}`));
		}
		marketIds.sort(); // the sweep iterates ORDER BY id
		const first = marketIds[0] ?? "";
		const held = marketIds.slice(1);
		await seedPolicy(9705, 100);
		// ⚠ 100 is BOTH the shipped value and the 0029 ceiling. Proven to catch
		// H-1: with 0028's body (no sweep budget) and the old 250 ms ceiling this
		// case fails on the bet's own `SELECT … FOR NO KEY UPDATE` — the 57014 the
		// bet path does not retry.
		const bettor = await seedUser("many");

		// Hold every pool row EXCEPT the first, so the sweep burns its
		// `lock_timeout` on each of them in turn while a bet waits on the first.
		const holder = await contender.reserve();
		let elapsed = -1;
		let betId = "";
		try {
			await holder.unsafe(`BEGIN`);
			for (const id of held) {
				await holder.unsafe(
					`SELECT 1 FROM pools WHERE market_id = $1 FOR NO KEY UPDATE`,
					[id],
				);
			}

			// Fire the sweep, let it reach the first market and take its lock,
			// then race a real bet against that same row.
			const sweeping = testClient
				.unsafe(`SELECT run_liquidity_injection()`)
				.execute();
			await new Promise((r) => setTimeout(r, 30));

			const started = Date.now();
			betId = await placeTask({
				userId: bettor,
				marketId: first,
				side: "YES",
				stake: "10",
			})();
			elapsed = Date.now() - started;

			await sweeping;
		} finally {
			await holder.unsafe(`ROLLBACK`);
			holder.release();
		}

		// ⛔ THE ASSERTION: the bet LANDED. Not "no error was thrown somewhere" —
		// a bet id, and a position behind it.
		expect(betId).toBeTruthy();
		const held2 = await testDb
			.select({ quantity: positions.quantity })
			.from(positions)
			.where(and(eq(positions.marketId, first), eq(positions.userId, bettor)));
		expect(held2).toHaveLength(1);

		// ...and it did so inside the bet path's own non-retryable budget. The
		// margin is what the ceiling and the sweep budget are FOR, so it is
		// asserted rather than assumed.
		expect(elapsed).toBeLessThan(1000);

		// The sweep completed and said so: a heartbeat exists. A sweep that
		// aborted would roll its heartbeat back, and the only symptom would be a
		// silence alarm pointing at a scheduler that is running perfectly.
		const hb = await testClient.unsafe<Array<{ c: number; i: number }>>(
			`SELECT markets_considered AS c, markets_injected AS i
			 FROM liquidity_heartbeat ORDER BY id DESC LIMIT 1`,
		);
		expect(hb).toHaveLength(1);
		// It may have stopped early under the budget — that is the design, not a
		// failure — so `considered` is bounded rather than pinned.
		expect(hb[0]?.c ?? 0).toBeGreaterThan(0);
		expect(hb[0]?.c ?? 99).toBeLessThanOrEqual(8);
	});

	it("liquidity-contention::a-bet-holding-the-row-makes-the-injector-yield-not-fail", async () => {
		// The direction assertion, in isolation and deterministically rather than
		// by racing. A held pool row must make the sweep SKIP — returning
		// normally, writing a heartbeat that says it considered the market and
		// injected nothing — never raise.
		//
		// ⚠ The failure this rules out is quiet: a sweep that raised here would
		// roll back its own heartbeat too, so the only symptom would be a missing
		// heartbeat that the silence alarm eventually reports as "the job stopped"
		// — sending an operator after a scheduler that is running perfectly.
		const marketId = await seedMarket("contend-yield");
		await seedPolicy(9702, 100);

		const holder = await contender.reserve();
		const started = Date.now();
		try {
			await holder.unsafe(`BEGIN`);
			await holder.unsafe(
				`SELECT 1 FROM pools WHERE market_id = $1 FOR NO KEY UPDATE`,
				[marketId],
			);
			await testClient.unsafe(`SELECT run_liquidity_injection()`);
		} finally {
			await holder.unsafe(`ROLLBACK`);
			holder.release();
		}
		const elapsed = Date.now() - started;

		// It gave up rather than waiting indefinitely. The bound is the policy's
		// own `lock_timeout` plus slack — generous here, because the point is
		// "bounded", not "fast".
		expect(elapsed).toBeLessThan(5000);

		const hb = await testClient.unsafe<Array<{ c: number; i: number }>>(
			`SELECT markets_considered AS c, markets_injected AS i
			 FROM liquidity_heartbeat ORDER BY id`,
		);
		// Considered, not injected — and the heartbeat EXISTS, which is what says
		// the sweep completed rather than aborted.
		expect(hb).toHaveLength(1);
		expect(hb[0]).toEqual({ c: 1, i: 0 });

		// And nothing was recorded as an error: a lock timeout is the NORMAL case
		// here, not news.
		const errs = await testClient.unsafe<Array<{ n: string }>>(
			`SELECT count(*)::text AS n FROM cron_alarms
			 WHERE alarm_id = 'liquidity_injection_error'`,
		);
		expect(errs[0]?.n).toBe("0");
	});

	it("liquidity-contention::an-injection-between-two-bets-leaves-the-price-continuous", async () => {
		// The participant-visible property. A bet is quoted against a price; if an
		// injection landed between the quote and the fill and moved the price, the
		// participant would be filled somewhere they did not agree to. ADR-0047 §A
		// says the placement is price-preserving; this is that claim measured
		// through the real bet path rather than through the pure function.
		const marketId = await seedMarket("contend-price");
		await seedPolicy(9703);
		const u1 = await seedUser("price-1");
		const u2 = await seedUser("price-2");

		await placeTask({ userId: u1, marketId, side: "YES", stake: "10" })();
		const mid = await testClient.unsafe<Array<{ yes: string; no: string }>>(
			`SELECT yes_reserves AS yes, no_reserves AS no FROM pools WHERE market_id = $1`,
			[marketId],
		);
		const priceBefore = new CpmmDecimal(mid[0]?.no ?? "0").dividedBy(
			new CpmmDecimal(mid[0]?.yes ?? "0").plus(mid[0]?.no ?? "0"),
		);

		await testClient.unsafe(`SELECT run_liquidity_injection()`);

		const after = await testClient.unsafe<Array<{ yes: string; no: string }>>(
			`SELECT yes_reserves AS yes, no_reserves AS no FROM pools WHERE market_id = $1`,
			[marketId],
		);
		const priceAfter = new CpmmDecimal(after[0]?.no ?? "0").dividedBy(
			new CpmmDecimal(after[0]?.yes ?? "0").plus(after[0]?.no ?? "0"),
		);

		expect(priceAfter.minus(priceBefore).abs().lessThanOrEqualTo("1e-18")).toBe(
			true,
		);

		// The second bet still works, and the position it produces is real — the
		// injection changed the DEPTH, which is the whole point, without changing
		// the terms.
		const betId = await placeTask({
			userId: u2,
			marketId,
			side: "YES",
			stake: "10",
		})();
		expect(betId).toBeTruthy();

		const held = await testDb
			.select({ quantity: positions.quantity, side: positions.side })
			.from(positions)
			.where(and(eq(positions.marketId, marketId), eq(positions.userId, u2)));
		expect(held).toHaveLength(1);
		expect(held[0]?.side).toBe("YES");
		expect(new CpmmDecimal(held[0]?.quantity ?? "0").greaterThan(0)).toBe(true);

		// ⚠ AND THE SHARES ARE FEWER THAN THE FIRST BET'S, WHICH IS THE POINT.
		// Both users staked 10 Đ on the same side of the same market; the second
		// bought into a pool the injector had deepened, so a fixed stake moves the
		// price less and buys fewer shares at a price closer to spot. That is the
		// entire mechanism ADR-0047 exists to deliver, observed end to end rather
		// than argued.
		const first = await testDb
			.select({ quantity: positions.quantity })
			.from(positions)
			.where(and(eq(positions.marketId, marketId), eq(positions.userId, u1)));
		expect(
			new CpmmDecimal(held[0]?.quantity ?? "0").lessThan(
				first[0]?.quantity ?? "0",
			),
		).toBe(true);
	});
});
