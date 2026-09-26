import { describe, expect, it } from "vitest";

import {
	BetSerializationExhaustedError,
	BetStatementTimeoutError,
	toWireError,
} from "@/server/bets/errors";

/**
 * AWS-MIGRATION-3 item 3, tests-first (CLAUDE.md §5.6) — the SQLSTATE 57014
 * (`query_canceled`) disposition. Plan `docs/plans/AWS-MIGRATION-3.md` §"Test
 * plan" row 1.
 *
 * WHY THIS ERROR EXISTS AT ALL. `runBetTransaction` SETs LOCAL
 * `statement_timeout = 1000` inside every bet transaction, and its own docblock
 * records that an abort raises 57014, that 57014 is NOT retryable, and that what
 * it should become on the wire was left open ("the 57014↔alarm-3 question is a
 * HARDEN.* observability call"). Until this lands, a timed-out bet falls through
 * `toWireError`'s final branch and reaches the participant as **500
 * `error_internal`** — an opaque server fault for a condition that is (a)
 * transient, (b) safe to retry, and (c) the single most likely symptom of the
 * load the AWS move is sized for (`08-STAGING-LOAD-TEST-RESULTS.md` §3–§5).
 *
 * ⛔ THE 500 IS ALSO CACHED WRONGLY, AND THAT IS THE LOAD-BEARING HALF.
 * `runBetEndpoint` caches only `< 500` (ADR-0031), so today a timeout is
 * UNCACHED and a retry re-runs the whole W-1 transaction — which is right. A
 * naive fix that gave this a 4xx would make a transient fault a CACHED refusal
 * under the idempotency key, poisoning it. So the status must be 503: a real
 * status, uncached, with a `Retry-After` the client can obey.
 *
 * PURE / DB-INDEPENDENT, the `tests/unit/bets/errors.test.ts` precedent. It REDs
 * now purely on the greenfield value import (`BetStatementTimeoutError` is not
 * exported from `src/server/bets/errors.ts` yet) and GREENs the moment the class
 * plus its `toWireError` arm land. The RETRY behaviour — that 57014 is thrown
 * once and never retried — is `tests/server/bets/statement-timeout.test.ts`'s
 * subject, not this file's.
 */

describe("BetStatementTimeoutError", () => {
	it("bet-timeout::carries-the-originating-flow", () => {
		// Arrange / Act — the wrapper constructs this on a 57014 abort with the
		// flow it was called for. Nothing else is carried: unlike
		// BetSerializationExhaustedError there is no "last observed SQLSTATE" to
		// report, because there is exactly one SQLSTATE that reaches here.
		const err = new BetStatementTimeoutError({ flow: "F-BET-1" });

		// Assert — `.name` and `instanceof` both survive native `extends Error`
		// under the ES2017 target only if the class sets `this.name` explicitly
		// (the cpmm/dharma/markets/bets precedent).
		expect(err).toBeInstanceOf(BetStatementTimeoutError);
		expect(err).toBeInstanceOf(Error);
		expect(err.name).toBe("BetStatementTimeoutError");
		expect(err.flow).toBe("F-BET-1");
	});

	it("bet-timeout::flow-is-read-back-not-defaulted", () => {
		// A second, distinct flow read back distinctly — so a hardcoded literal
		// or a default cannot satisfy the row above. The Sentry tag and any later
		// per-flow alarm split both read this field.
		expect(new BetStatementTimeoutError({ flow: "F-BET-3" }).flow).toBe(
			"F-BET-3",
		);
		expect(new BetStatementTimeoutError({ flow: "F-COMMENT-2" }).flow).toBe(
			"F-COMMENT-2",
		);
	});

	it("bet-timeout::class-level-envelope-is-503-error_bet_timeout-retry-2", () => {
		// The §15 envelope is CLASS-LEVEL and fixed, mirroring
		// BetSerializationExhaustedError — asserted off the class so the contract
		// is stable independent of any instance, which is how `toWireError` reads
		// it (`err.constructor` statics).
		expect(BetStatementTimeoutError.httpStatus).toBe(503);
		expect(BetStatementTimeoutError.code).toBe("error_bet_timeout");
		expect(BetStatementTimeoutError.retryAfterSeconds).toBe(2);
		// `unavailable` is the SPEC.1 §15.2 canonical enum value — NOT the §9
		// prose's `temporary_unavailable`. Same call as the sibling class above.
		expect(BetStatementTimeoutError.errorType).toBe("unavailable");
	});
});

describe("toWireError(BetStatementTimeoutError)", () => {
	it("bet-timeout::maps-to-503-with-body-and-header-retry-after", () => {
		// Arrange
		const err = new BetStatementTimeoutError({ flow: "F-BET-1" });

		// Act
		const wire = toWireError(err);

		// Assert — §4.4: the body `retry_after` field is present IFF the status is
		// 429/503, and the HTTP `Retry-After` header carries the same number.
		expect(wire.status).toBe(503);
		expect(wire.body.ok).toBe(false);
		expect(wire.body.error.code).toBe("error_bet_timeout");
		expect(wire.body.error.retry_after).toBe(2);
		expect(wire.retryAfterHeader).toBe(2);
		// A message is required by the envelope and its wording is the executor's;
		// only its presence is contractual.
		expect(typeof wire.body.error.message).toBe("string");
		expect(wire.body.error.message.length).toBeGreaterThan(0);
	});

	it("bet-timeout::never-falls-through-to-500-error_internal", () => {
		// ⛔ THE FAILURE MODE THIS FILE EXISTS FOR. A class added to errors.ts
		// WITHOUT an explicit `toWireError` arm silently reaches the final branch
		// and becomes 500 `error_internal` — the file's own comments name this trap
		// four times (the positions, lots and storage sentinels were each mapped
		// for exactly this reason). A test that only asserted the statics would
		// pass against a class nothing maps.
		const wire = toWireError(new BetStatementTimeoutError({ flow: "F-BET-2" }));

		expect(wire.status).not.toBe(500);
		expect(wire.body.error.code).not.toBe("error_internal");
	});

	it("bet-timeout::is-not-collapsed-onto-the-serialization-exhausted-envelope", () => {
		// Both are 503 + Retry-After, so the cheapest wrong implementation routes
		// 57014 through the existing exhaustion arm. It must not: the two are
		// different faults with different advice (1 s after losing a race for the
		// pool row; 2 s after a statement ran out of time), and collapsing them
		// would make alarm-3's `bet_serialization_exhausted` count timeouts.
		const timeout = toWireError(
			new BetStatementTimeoutError({ flow: "F-BET-1" }),
		);
		const exhausted = toWireError(
			new BetSerializationExhaustedError({
				sqlstate: "40001",
				flow: "F-BET-1",
			}),
		);

		expect(timeout.body.error.code).not.toBe(exhausted.body.error.code);
		expect(exhausted.body.error.code).toBe("error_bet_serialization_exhausted");
		expect(exhausted.body.error.retry_after).toBe(1);
		expect(timeout.body.error.retry_after).toBe(2);
	});
});
