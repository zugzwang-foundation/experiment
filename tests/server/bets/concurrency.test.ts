import { eq, sql } from "drizzle-orm";
import { v7 as uuidv7 } from "uuid";
import { afterEach, describe, expect, it, vi } from "vitest";

// --- @sentry/nextjs mock ---------------------------------------------------
//
// The W-1 wrapper emits `Sentry.addBreadcrumb` per retry attempt and
// `Sentry.captureMessage('bet_serialization_exhausted', …)` ONCE on terminal
// exhaustion (alarm 3, plan §"Observability"). Mock the SDK at the wrapper
// boundary so the test asserts on the captured calls without touching the real
// transport. vi.mock is hoisted → factory vars come from vi.hoisted (the
// rate-limit.integration.test.ts / rate-limit-prefix.test.ts precedent).
const { mockCaptureMessage, mockAddBreadcrumb, mockCaptureException } =
	vi.hoisted(() => ({
		mockCaptureMessage: vi.fn(),
		mockAddBreadcrumb: vi.fn(),
		mockCaptureException: vi.fn(),
	}));

vi.mock("@sentry/nextjs", () => ({
	captureMessage: mockCaptureMessage,
	addBreadcrumb: mockAddBreadcrumb,
	captureException: mockCaptureException,
}));

import {
	bets,
	comments,
	dharmaLedger,
	events,
	friendlyFireEvents,
	markets,
	pools,
	positions,
	users,
} from "@/db/schema";
import {
	BetSerializationExhaustedError,
	MarketNotOpenError,
} from "@/server/bets/errors";
import { runBetTransaction } from "@/server/bets/transaction";
import { computeBuy } from "@/server/cpmm/calculate";
import { appendLedgerRow } from "@/server/dharma/persist";
import { insertEvent } from "@/server/events/insert";
import { upsertPositionDelta } from "@/server/positions/persist";

import { createdAtFromUuidV7, testClient, testDb } from "../../db/_fixtures/db";

// ENGINE.7 §5.6 tests-first — the 7 W-1 wrapper concurrency tests + 1 events-
// idempotency property test (plan ruling (e)/(f); §"Test plan").
//
// DB-BACKED: cannot RED locally (local Postgres :54322 DOWN; ECONNREFUSED is
// infra, not an assertion red — the whole-suite-needs-Postgres convention).
// First true run is CI on the PR. Written type-correct + behaviorally complete
// so CI goes GREEN once `runBetTransaction` lands. The greenfield value import
// (`runBetTransaction`) keeps this from resolving until ENGINE.7 lands.
//
// Concurrency harness: vitest runs with fileParallelism:false, so we cannot
// rely on cross-file parallelism — every concurrent scenario is built WITHIN a
// single test via two in-flight promises + a JS latch/barrier. `testClient`
// (raw postgres-js) and the wrapper's `@/db` pool (max:10) are SEPARATE
// connections, giving genuine two-connection concurrency.
//
// HARNESS REALIZATION (serializable-isolation-enforced): the pool
// `FOR NO KEY UPDATE` lock serializes same-pool txns AND the wrapper retries
// 40001, so an unretried write-skew abort cannot be OBSERVED on the happy path.
// The deterministic assertion is to read the isolation level from INSIDE the
// callback (`SELECT current_setting('transaction_isolation')` → 'serializable').
// This is a harness mechanic, not a plan deviation.
//
// All money/share values cross boundaries as exact 18-dp canonical strings; no
// float ever crosses a boundary (CLAUDE.md §2).

const META = {
	request_id: "test",
	flow_id: "F-BET-1",
	user_id: null,
	actor_id: "test",
	idempotency_key: null,
	ip: "test",
	user_agent: "test",
};

const SEED_RESERVES = "100.000000000000000000";

/** A resolvable barrier: `promise` settles when `release()` is called. */
function deferred(): { promise: Promise<void>; release: () => void } {
	let release!: () => void;
	const promise = new Promise<void>((resolve) => {
		release = resolve;
	});
	return { promise, release };
}

async function seedUser(emailTag: string, pseudonym: string): Promise<string> {
	const [user] = await testDb
		.insert(users)
		.values({
			name: "Concurrency User",
			email: `${emailTag}@example.com`,
			pseudonym,
		})
		.returning({ id: users.id });
	return user?.id ?? "";
}

async function seedMarketWithPool(
	slug: string,
	status: "Open" | "Closed" | "Resolving",
): Promise<string> {
	const [market] = await testDb
		.insert(markets)
		.values({
			slug,
			title: "Concurrency Market",
			status,
			resolutionDeadline: new Date("2027-01-01T00:00:00Z"),
		})
		.returning({ id: markets.id });
	const marketId = market?.id ?? "";
	await testDb.insert(pools).values({
		marketId,
		yesReserves: SEED_RESERVES,
		noReserves: SEED_RESERVES,
	});
	return marketId;
}

async function seedOpenMarketWithPool(slug: string): Promise<string> {
	return seedMarketWithPool(slug, "Open");
}

// Positive Dharma balance so the in-spine bet_stake debit does not overdraft.
async function seedDharmaGrant(userId: string): Promise<void> {
	await testDb.transaction((tx) =>
		appendLedgerRow(tx, {
			userId,
			amount: "1000",
			entryType: "initial_grant",
		}),
	);
}

describe("ENGINE.7 W-1 runBetTransaction — concurrency + retry", () => {
	afterEach(async () => {
		await testClient.unsafe(
			`TRUNCATE events, dharma_ledger, bets, comments, positions, pools, markets, users, friendly_fire_events CASCADE`,
		);
		vi.clearAllMocks();
	});

	it("bets::serializable-isolation-enforced", async () => {
		// The callback runs at SERIALIZABLE. Read the isolation level from INSIDE
		// the wrapper's tx — deterministic (see HARNESS REALIZATION above: a
		// retried write-skew abort is unobservable on the happy path).
		const marketId = await seedOpenMarketWithPool("ser-iso-market");

		const isolation = await runBetTransaction(
			{ marketId, flow: "F-BET-1" },
			async ({ tx }) => {
				// postgres-js `execute<TRow extends Record<string, unknown>>`
				// returns `Promise<TRow[]>` — TRow is the ROW shape, the result is
				// the row array (the sweep-orphans.ts `UpdateReturningRow` precedent).
				const rows = await tx.execute<{ transaction_isolation: string }>(
					sql`SELECT current_setting('transaction_isolation') AS transaction_isolation`,
				);
				return rows[0]?.transaction_isolation;
			},
		);

		expect(isolation).toBe("serializable");
	});

	it("bets::pool-row-lock-acquired", async () => {
		// Two concurrent same-pool runBetTransaction serialize on the
		// FOR NO KEY UPDATE row: the SECOND's callback body cannot enter until the
		// FIRST commits. Built within one test via two in-flight promises + a
		// barrier that holds the first tx open until we observe the second is
		// still blocked.
		const marketId = await seedOpenMarketWithPool("pool-lock-market");

		const firstEntered = deferred();
		const releaseFirst = deferred();
		let secondEntered = false;

		// First tx: signals it entered, then holds the pool lock open until
		// releaseFirst settles (we control commit timing).
		const firstPromise = runBetTransaction(
			{ marketId, flow: "F-BET-1" },
			async () => {
				firstEntered.release();
				await releaseFirst.promise;
				return "first";
			},
		);

		// Wait until the first tx is inside its callback (holding the lock).
		await firstEntered.promise;

		// Second tx: must BLOCK acquiring the same pool lock; flips secondEntered
		// only once it enters its callback (i.e. after the lock is granted).
		const secondPromise = runBetTransaction(
			{ marketId, flow: "F-BET-1" },
			async () => {
				secondEntered = true;
				return "second";
			},
		);

		// Give the second tx ample scheduler time to attempt the lock; while the
		// first holds it, the second MUST still be blocked (callback not entered).
		await new Promise((r) => setTimeout(r, 200));
		expect(secondEntered).toBe(false);

		// Release the first → it commits → the second acquires the lock + runs.
		releaseFirst.release();
		const firstResult = await firstPromise;
		const secondResult = await secondPromise;

		expect(firstResult).toBe("first");
		expect(secondResult).toBe("second");
		expect(secondEntered).toBe(true);
	});

	it("bets::no-key-update-allows-fk-share", async () => {
		// FOR NO KEY UPDATE is COMPATIBLE with FOR KEY SHARE (the lock Postgres
		// takes implicitly on the parent pool row when a child INSERT validates its
		// FK). While a runBetTransaction holds FOR NO KEY UPDATE, a concurrent RAW
		// `SELECT … FOR KEY SHARE` on the SAME pool row proceeds WITHOUT blocking.
		// If the impl wrongly used FOR UPDATE, this select would block → RED.
		// testClient (separate connection) gives genuine concurrency.
		const marketId = await seedOpenMarketWithPool("fk-share-market");

		const holding = deferred();
		const release = deferred();

		const txPromise = runBetTransaction(
			{ marketId, flow: "F-BET-1" },
			async () => {
				holding.release();
				await release.promise;
				return "held";
			},
		);

		await holding.promise;

		// Concurrent FOR KEY SHARE on the locked pool row, on a SEPARATE
		// connection. With FOR NO KEY UPDATE held, this must resolve promptly
		// (compatible locks); race it against a timeout to prove non-blocking.
		const fkShareSelect = testClient.unsafe(
			`SELECT id FROM pools WHERE market_id = $1 FOR KEY SHARE`,
			[marketId],
		);
		const timeout = new Promise<"timeout">((resolve) =>
			setTimeout(() => resolve("timeout"), 1_000),
		);
		const winner = await Promise.race([
			fkShareSelect.then(() => "select" as const),
			timeout,
		]);

		// The FOR KEY SHARE select won the race — it did NOT block on the held
		// FOR NO KEY UPDATE lock.
		expect(winner).toBe("select");

		release.release();
		await txPromise;
	});

	it("bets::canonical-lock-order", async () => {
		// A representative callback exercises the 4-table spine
		// pools → positions → dharma_ledger → events and writes NO
		// friendly_fire_events row (the struck 5th table — ADR-0017 P1; the
		// tracker's 5-table order is superseded by SPEC.2 §9's 4-table order).
		const userId = await seedUser("lock-order", "lock-order");
		const marketId = await seedOpenMarketWithPool("lock-order-market");
		await seedDharmaGrant(userId);
		const eventId = uuidv7();

		await runBetTransaction(
			{ marketId, flow: "F-BET-3" },
			async ({ tx, pool }) => {
				const buy = computeBuy({
					reserves: { yes: pool.yesReserves, no: pool.noReserves },
					side: "yes",
					stake: "10",
				});
				// pools → positions → dharma_ledger → events (4-table spine).
				await tx
					.update(pools)
					.set({
						yesReserves: buy.reserves.yes,
						noReserves: buy.reserves.no,
					})
					.where(eq(pools.id, pool.id));
				await upsertPositionDelta(tx, {
					userId,
					marketId,
					side: "YES",
					shareDelta: buy.shares,
				});
				await appendLedgerRow(tx, {
					userId,
					amount: "-10",
					entryType: "bet_stake",
				});
				await insertEvent(tx, {
					eventId,
					eventType: "bet.sold",
					aggregateType: "market",
					aggregateId: marketId,
					payload: {
						betId: uuidv7(),
						marketId,
						userId,
						side: "YES",
						sharesSold: buy.shares,
						proceeds: "10",
						price: buy.pEff,
					},
					metadata: META,
				});
			},
		);

		// The 4-table spine wrote; friendly_fire_events is NEVER touched.
		const ffRows = await testDb.select().from(friendlyFireEvents);
		expect(ffRows.length).toBe(0);

		// Sanity: the spine did write its 4 rows.
		const positionRows = await testDb
			.select()
			.from(positions)
			.where(eq(positions.userId, userId));
		expect(positionRows.length).toBe(1);
		const eventRows = await testDb
			.select()
			.from(events)
			.where(eq(events.aggregateId, marketId));
		expect(eventRows.length).toBe(1);
	});

	it("bets::retry-on-40001", async () => {
		// A synthetic 40001 (serialization_failure) on attempt 1 is RETRIED; the
		// callback succeeds on attempt 2. Assert it ran twice and returned the
		// success value. Closure counter injects the fault.
		const marketId = await seedOpenMarketWithPool("retry-40001-market");

		let attempts = 0;
		const result = await runBetTransaction(
			{ marketId, flow: "F-BET-1" },
			async () => {
				attempts += 1;
				if (attempts === 1) {
					throw Object.assign(new Error("serialization_failure"), {
						code: "40001",
					});
				}
				return "ok-after-retry";
			},
		);

		expect(attempts).toBe(2);
		expect(result).toBe("ok-after-retry");
	});

	it("bets::retry-on-40P01", async () => {
		// Same as above with a synthetic 40P01 (deadlock_detected) on attempt 1.
		const marketId = await seedOpenMarketWithPool("retry-40p01-market");

		let attempts = 0;
		const result = await runBetTransaction(
			{ marketId, flow: "F-BET-1" },
			async () => {
				attempts += 1;
				if (attempts === 1) {
					throw Object.assign(new Error("deadlock_detected"), {
						code: "40P01",
					});
				}
				return "ok-after-deadlock-retry";
			},
		);

		expect(attempts).toBe(2);
		expect(result).toBe("ok-after-deadlock-retry");
	});

	it("bets::retry-budget-exhausted-emits-alarm-3", async () => {
		// 40001 on EVERY attempt → after the budget (1 initial + 3 retries = 4
		// attempts) the wrapper throws BetSerializationExhaustedError AND
		// Sentry.captureMessage('bet_serialization_exhausted', …) fires exactly
		// once (alarm 3). The thrown error carries the last SQLSTATE + flow; its
		// class-level mapping is 503 / Retry-After: 1.
		const marketId = await seedOpenMarketWithPool("exhausted-market");

		let attempts = 0;
		const caught = await runBetTransaction(
			{ marketId, flow: "F-BET-2" },
			async () => {
				attempts += 1;
				throw Object.assign(new Error("serialization_failure"), {
					code: "40001",
				});
			},
		).catch((e: unknown) => e);

		// Budget = 4 attempts (1 + 3 retries).
		expect(attempts).toBe(4);

		expect(caught).toBeInstanceOf(BetSerializationExhaustedError);
		const err = caught as BetSerializationExhaustedError;
		// Carries the last SQLSTATE + originating flow. (The class-level 503 /
		// Retry-After:1 / code / errorType envelope mapping is asserted in the pure
		// tests/unit/bets/errors.test.ts — here we only assert wrapper BEHAVIOR:
		// the right class was thrown carrying the right data.)
		expect(err.sqlstate).toBe("40001");
		expect(err.flow).toBe("F-BET-2");

		// captureMessage fired exactly once, for the alarm-3 message.
		expect(mockCaptureMessage).toHaveBeenCalledTimes(1);
		expect(mockCaptureMessage.mock.calls[0]?.[0]).toBe(
			"bet_serialization_exhausted",
		);
	});

	it("bets::concurrency-retry-events-idempotent", async () => {
		// PROPERTY (ruling f, NOT a named invariant): force a 40001 on attempt 1
		// with a callback that calls insertEvent using a handler-entry event_id
		// generated ONCE and closed over (NOT regenerated per attempt). After the
		// successful retry assert EXACTLY ONE events row AND its created_at equals
		// the event_id-derived timestamp (stable across the retry — the retry-
		// purity contract). A per-attempt-regenerated event_id would drift
		// created_at / leak a second row.
		const userId = await seedUser("retry-pure", "retry-pure");
		const marketId = await seedOpenMarketWithPool("retry-pure-market");
		await seedDharmaGrant(userId);

		// Generated ONCE, at "handler entry", closed over by the callback.
		const eventId = uuidv7();
		const expectedCreatedAt = createdAtFromUuidV7(eventId);

		let attempts = 0;
		await runBetTransaction(
			{ marketId, flow: "F-BET-1" },
			async ({ tx, pool }) => {
				attempts += 1;
				const buy = computeBuy({
					reserves: { yes: pool.yesReserves, no: pool.noReserves },
					side: "yes",
					stake: "10",
				});
				await tx
					.update(pools)
					.set({
						yesReserves: buy.reserves.yes,
						noReserves: buy.reserves.no,
					})
					.where(eq(pools.id, pool.id));
				await upsertPositionDelta(tx, {
					userId,
					marketId,
					side: "YES",
					shareDelta: buy.shares,
				});
				await appendLedgerRow(tx, {
					userId,
					amount: "-10",
					entryType: "bet_stake",
				});
				await insertEvent(tx, {
					eventId,
					eventType: "bet.placed",
					aggregateType: "market",
					aggregateId: marketId,
					payload: {
						betId: uuidv7(),
						marketId,
						userId,
						side: "YES",
						stake: "10",
						shares: buy.shares,
						price: buy.pEff,
						commentId: uuidv7(),
						parentCommentId: null,
					},
					metadata: META,
				});
				// Fault on attempt 1, AFTER the event insert → the whole tx (incl.
				// the events row) rolls back and the retry re-runs with the SAME
				// closed-over event_id.
				if (attempts === 1) {
					throw Object.assign(new Error("serialization_failure"), {
						code: "40001",
					});
				}
			},
		);

		expect(attempts).toBe(2);

		// Exactly ONE events row for this market — the retry did not leak a second.
		const eventRows = await testDb
			.select({ eventId: events.eventId, createdAt: events.createdAt })
			.from(events)
			.where(eq(events.aggregateId, marketId));
		expect(eventRows.length).toBe(1);
		expect(eventRows[0]?.eventId).toBe(eventId);
		// created_at is the UUIDv7-derived timestamp, STABLE across the retry
		// (insertEvent derives it from the event_id prefix, never now()).
		expect(eventRows[0]?.createdAt.getTime()).toBe(expectedCreatedAt.getTime());
	});

	// ── Coarse market-state gate (ruling a) ───────────────────────────────────
	// The wrapper's one non-concurrency responsibility: after the pool lock, an
	// UNLOCKED `SELECT status FROM markets` gate. Open → run the callback;
	// non-Open → MarketNotOpenError carrying the observed status, NOT retried
	// (no SQLSTATE → the retry filter rethrows immediately). Fine F-BET-6
	// in-flight window deferred (S1: no resolving_at column) → coarse reject-all.
	describe("coarse market-state gate (ruling a)", () => {
		it("bets::gate-open-invokes-callback", async () => {
			// Open → the gate passes and the callback IS invoked.
			const marketId = await seedMarketWithPool("gate-open-market", "Open");

			let invoked = false;
			const result = await runBetTransaction(
				{ marketId, flow: "F-BET-1" },
				async () => {
					invoked = true;
					return "ran";
				},
			);

			expect(invoked).toBe(true);
			expect(result).toBe("ran");
		});

		it("bets::gate-closed-throws-skips-callback-zero-rows", async () => {
			// Closed → MarketNotOpenError(status='Closed'); the callback is NEVER
			// invoked and NOTHING is written (the gate is BEFORE the callback).
			const marketId = await seedMarketWithPool("gate-closed-market", "Closed");

			let attempts = 0;
			const caught = await runBetTransaction(
				{ marketId, flow: "F-BET-1" },
				async () => {
					attempts += 1; // must never run
					return "should-not-run";
				},
			).catch((e: unknown) => e);

			expect(caught).toBeInstanceOf(MarketNotOpenError);
			expect((caught as MarketNotOpenError).status).toBe("Closed");
			expect(attempts).toBe(0);

			// Zero rows across the spine; pool reserves untouched.
			const [poolRow] = await testDb
				.select({
					yesReserves: pools.yesReserves,
					noReserves: pools.noReserves,
				})
				.from(pools)
				.where(eq(pools.marketId, marketId));
			expect(poolRow?.yesReserves).toBe(SEED_RESERVES);
			expect(poolRow?.noReserves).toBe(SEED_RESERVES);

			const positionRows = await testDb
				.select()
				.from(positions)
				.where(eq(positions.marketId, marketId));
			expect(positionRows.length).toBe(0);
			const betRows = await testDb
				.select()
				.from(bets)
				.where(eq(bets.marketId, marketId));
			expect(betRows.length).toBe(0);
			const commentRows = await testDb
				.select()
				.from(comments)
				.where(eq(comments.marketId, marketId));
			expect(commentRows.length).toBe(0);
			const eventRows = await testDb
				.select()
				.from(events)
				.where(eq(events.aggregateId, marketId));
			expect(eventRows.length).toBe(0);
			// No grant seeded → the ledger is globally empty (no dharma write).
			const ledgerRows = await testDb.select().from(dharmaLedger);
			expect(ledgerRows.length).toBe(0);
		});

		it("bets::gate-resolving-coarse-rejects-all", async () => {
			// Resolving → coarse reject-all (S1: the fine in-flight window is
			// deferred — no resolving_at column). MarketNotOpenError carries the
			// EXACT observed status 'Resolving' so ENGINE.8 can pick the §15 code.
			const marketId = await seedMarketWithPool(
				"gate-resolving-market",
				"Resolving",
			);

			let attempts = 0;
			const caught = await runBetTransaction(
				{ marketId, flow: "F-BET-1" },
				async () => {
					attempts += 1;
					return "should-not-run";
				},
			).catch((e: unknown) => e);

			expect(caught).toBeInstanceOf(MarketNotOpenError);
			expect((caught as MarketNotOpenError).status).toBe("Resolving");
			expect(attempts).toBe(0);
		});

		it("bets::gate-rejection-not-retried-single-pass", async () => {
			// The gate throw is NOT retried: MarketNotOpenError has no retryable
			// SQLSTATE, so it bubbles on the first pass — no retry breadcrumb, no
			// alarm-3, the callback never reached. (A wrongly-retried gate would
			// loop the gate SELECT, emit retry breadcrumbs, and could even exhaust
			// the budget into a BetSerializationExhaustedError.)
			const marketId = await seedMarketWithPool(
				"gate-noretry-market",
				"Closed",
			);

			let attempts = 0;
			const caught = await runBetTransaction(
				{ marketId, flow: "F-BET-1" },
				async () => {
					attempts += 1;
					return "should-not-run";
				},
			).catch((e: unknown) => e);

			expect(caught).toBeInstanceOf(MarketNotOpenError);
			// The callback (downstream of the gate) is never reached → single pass.
			expect(attempts).toBe(0);
			// No retry was scheduled: zero retry breadcrumbs, no alarm-3.
			expect(mockAddBreadcrumb).not.toHaveBeenCalled();
			expect(mockCaptureMessage).not.toHaveBeenCalled();
		});
	});
});
