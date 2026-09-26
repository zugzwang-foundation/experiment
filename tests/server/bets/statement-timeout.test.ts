import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * AWS-MIGRATION-3 item 3, tests-first (CLAUDE.md §5.6) — the RETRY disposition
 * of SQLSTATE 57014. Plan `docs/plans/AWS-MIGRATION-3.md` §"Test plan" row 2:
 * a driver error with `code: "57014"` is NOT retried, is thrown as the typed
 * error, and `captureMessage` is called once; `40001` still retries.
 *
 * ⛔ WHY "NOT RETRIED" IS THE LOAD-BEARING HALF, not the 503.
 * `statement_timeout` is SET LOCAL to 1,000 ms inside the bet transaction and
 * that bound COVERS the `FOR NO KEY UPDATE` wait on the pool row — so under
 * contention 57014 is a lock wait that has already spent its full second.
 * Retrying it is the one response guaranteed to make the contention worse: five
 * more attempts, each up to a second of lock-holding, on the hot row everyone
 * else is queued behind. A serialization failure (40001) is the opposite case —
 * the row is usually free on the next attempt — which is why the two SQLSTATEs
 * must take opposite branches out of the same `catch`.
 *
 * HARNESS. `@/db` is mocked so `db.transaction` is a spy that REJECTS; the
 * callback therefore never runs and no Postgres is needed. That is deliberate:
 * the subject here is the wrapper's classify-and-branch logic, and a real DB
 * would make the attempt COUNT — the actual assertion — depend on live
 * contention. The two DB-backed W-1 files (`concurrency.test.ts`,
 * `I-ATOMICITY-001.spec.ts`) keep their own coverage; this one is pure control
 * flow, so it runs anywhere.
 *
 * `@sentry/nextjs` is mocked at the module boundary (the
 * `tests/server/bets/concurrency.test.ts` precedent) so the alarm calls are
 * observable without a transport.
 *
 * REAL TIMERS on purpose. The 40001 control walks the full ADR-0056 budget and
 * sleeps `random(0..base)` per retry — worst case ~1.55 s against a 10 s
 * `testTimeout`. Fake timers would need `advanceTimersByTimeAsync` interleaved
 * with the retry loop's awaits, which is more harness than the assertion is
 * worth; the assertion here is a call COUNT, not a duration.
 */

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

const { mockTransaction } = vi.hoisted(() => ({ mockTransaction: vi.fn() }));

vi.mock("@/db", () => ({
	db: { transaction: mockTransaction },
}));

import {
	BetSerializationExhaustedError,
	BetStatementTimeoutError,
} from "@/server/bets/errors";
import { runBetTransaction } from "@/server/bets/transaction";

const MARKET_ID = "11111111-1111-7111-8111-111111111111";

/**
 * A postgres-js driver error as the wrapper sees it at the TOP level — raw
 * `tx.execute` and COMMIT-time failures carry `.code` directly.
 */
function driverError(code: string): Error & { code: string } {
	const err = new Error(`simulated driver error ${code}`) as Error & {
		code: string;
	};
	err.code = code;
	return err;
}

/**
 * The SAME SQLSTATE where drizzle 0.45 actually leaves it for QUERY-BUILDER
 * calls — wrapped in a DrizzleQueryError with the code on `.cause` and
 * undefined at the top level. `transaction.ts`'s own docblock records this
 * split, and the pool lock is a query-builder call, so this is the shape a real
 * bet timeout arrives in. A classifier reading only `.code` passes the row above
 * and fails this one.
 */
function wrappedDriverError(code: string): Error & { cause: { code: string } } {
	const err = new Error("DrizzleQueryError: Failed query") as Error & {
		cause: { code: string };
	};
	err.cause = { code };
	return err;
}

const NEVER_CALLED = async (): Promise<never> => {
	throw new Error("callback must not run: db.transaction is stubbed to reject");
};

/** The alarm names `captureMessage` was called with, in order. */
function alarmNames(): unknown[] {
	return mockCaptureMessage.mock.calls.map((call) => call[0]);
}

beforeEach(() => {
	mockTransaction.mockReset();
	mockCaptureMessage.mockReset();
	mockAddBreadcrumb.mockReset();
	mockCaptureException.mockReset();
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe("bet-statement-timeout — 57014 is typed, alarmed, and never retried", () => {
	it("bet-statement-timeout::57014-is-not-retried", async () => {
		// Arrange — every attempt would fail the same way if the wrapper retried.
		mockTransaction.mockRejectedValue(driverError("57014"));

		// Act
		const attempt = runBetTransaction(
			{ marketId: MARKET_ID, flow: "F-BET-1" },
			NEVER_CALLED,
		);

		// Assert — ONE attempt. This is the assertion the whole item exists for: a
		// second attempt means 57014 landed in the retryable set.
		await expect(attempt).rejects.toBeInstanceOf(BetStatementTimeoutError);
		expect(mockTransaction).toHaveBeenCalledTimes(1);
		// And no backoff breadcrumb — the retry path was never entered at all.
		expect(mockAddBreadcrumb).not.toHaveBeenCalled();
	});

	it("bet-statement-timeout::57014-throws-the-typed-error-carrying-the-flow", async () => {
		mockTransaction.mockRejectedValue(driverError("57014"));

		await expect(
			runBetTransaction({ marketId: MARKET_ID, flow: "F-BET-3" }, NEVER_CALLED),
		).rejects.toMatchObject({
			name: "BetStatementTimeoutError",
			flow: "F-BET-3",
		});
	});

	it("bet-statement-timeout::fires-bet_statement_timeout-exactly-once", async () => {
		mockTransaction.mockRejectedValue(driverError("57014"));

		await runBetTransaction(
			{ marketId: MARKET_ID, flow: "F-BET-1" },
			NEVER_CALLED,
		).catch(() => undefined);

		expect(mockCaptureMessage).toHaveBeenCalledTimes(1);
		const call = mockCaptureMessage.mock.calls[0] ?? [];
		expect(call[0]).toBe("bet_statement_timeout");
		// The flow tag is what makes the alarm actionable (the alarm-3 precedent
		// tags `flow` + `sqlstate`). The Sentry LEVEL is the executor's call and is
		// deliberately not pinned here.
		const options = call[1] as { tags?: Record<string, unknown> } | undefined;
		expect(options?.tags).toMatchObject({
			flow: "F-BET-1",
			sqlstate: "57014",
		});
	});

	it("bet-statement-timeout::does-not-fire-the-serialization-alarm", async () => {
		// ⛔ Alarm-3 counts a specific fault. Routed through the exhaustion branch,
		// it would fire on every timeout and `bet_serialization_exhausted` would
		// stop meaning what its name says — which is how an alarm becomes noise
		// nobody reads.
		mockTransaction.mockRejectedValue(driverError("57014"));

		await runBetTransaction(
			{ marketId: MARKET_ID, flow: "F-BET-1" },
			NEVER_CALLED,
		).catch(() => undefined);

		expect(alarmNames()).not.toContain("bet_serialization_exhausted");
	});

	it("bet-statement-timeout::57014-on-cause-is-classified-too", async () => {
		// The drizzle query-builder shape — the one a real pool-lock timeout takes.
		mockTransaction.mockRejectedValue(wrappedDriverError("57014"));

		await expect(
			runBetTransaction(
				{ marketId: MARKET_ID, flow: "F-COMMENT-2" },
				NEVER_CALLED,
			),
		).rejects.toBeInstanceOf(BetStatementTimeoutError);
		expect(mockTransaction).toHaveBeenCalledTimes(1);
	});
});

describe("bet-statement-timeout — the 40001 control still retries", () => {
	it("bet-statement-timeout::40001-still-retries-to-exhaustion", async () => {
		// ⛔ THE CONTROL THAT MAKES THE ROWS ABOVE MEAN ANYTHING. An
		// implementation that broke retrying altogether — emptied
		// RETRYABLE_SQLSTATES, or returned before the loop — would satisfy every
		// "not retried" assertion above. This is the positive control.
		mockTransaction.mockRejectedValue(driverError("40001"));

		await expect(
			runBetTransaction({ marketId: MARKET_ID, flow: "F-BET-1" }, NEVER_CALLED),
		).rejects.toBeInstanceOf(BetSerializationExhaustedError);

		// MORE THAN ONCE, deliberately not an exact count: the budget is an
		// ADR-0056 DECISION PARAMETER that has already moved once (4 → 6 attempts),
		// and pinning it here would redden this file on a tuning change that has
		// nothing to do with 57014.
		expect(mockTransaction.mock.calls.length).toBeGreaterThan(1);
		expect(mockAddBreadcrumb).toHaveBeenCalled();

		expect(alarmNames()).toContain("bet_serialization_exhausted");
		expect(alarmNames()).not.toContain("bet_statement_timeout");
	});

	it("bet-statement-timeout::40P01-still-retries", async () => {
		mockTransaction.mockRejectedValue(driverError("40P01"));

		await expect(
			runBetTransaction({ marketId: MARKET_ID, flow: "F-BET-2" }, NEVER_CALLED),
		).rejects.toBeInstanceOf(BetSerializationExhaustedError);
		expect(mockTransaction.mock.calls.length).toBeGreaterThan(1);
	});
});

describe("bet-statement-timeout — every other error is untouched", () => {
	it("bet-statement-timeout::unrelated-sqlstate-bubbles-unwrapped-and-unretried", async () => {
		// The failure-mode control: the new branch sits inside the
		// `sqlstate === null` arm that EVERY non-retryable error passes through. A
		// branch written too wide would swallow FK violations, unique violations
		// and MarketNotOpenError into a 503 the client is told to retry — turning
		// a deterministic refusal into an endless retry loop.
		const unique = driverError("23505");
		mockTransaction.mockRejectedValue(unique);

		await expect(
			runBetTransaction({ marketId: MARKET_ID, flow: "F-BET-1" }, NEVER_CALLED),
		).rejects.toBe(unique);

		expect(mockTransaction).toHaveBeenCalledTimes(1);
		expect(mockCaptureMessage).not.toHaveBeenCalled();
	});

	it("bet-statement-timeout::an-error-with-no-sqlstate-bubbles-unwrapped", async () => {
		const plain = new Error("something else entirely");
		mockTransaction.mockRejectedValue(plain);

		await expect(
			runBetTransaction({ marketId: MARKET_ID, flow: "F-BET-1" }, NEVER_CALLED),
		).rejects.toBe(plain);
		expect(mockTransaction).toHaveBeenCalledTimes(1);
	});
});
