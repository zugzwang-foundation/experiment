import { describe, expect, it } from "vitest";

import {
	BetSerializationExhaustedError,
	MarketNotOpenError,
} from "@/server/bets/errors";

// ENGINE.7 §5.6 tests-first — the W-1 wrapper's two module-local error classes
// (plan §"Errors" + §"File plan" → `src/server/bets/errors.ts`).
//
// PURE / DB-INDEPENDENT. Unlike the two DB-backed ENGINE.7 specs
// (I-ATOMICITY-001 + concurrency.test.ts), this file touches no Postgres, so it
// RED→GREENs locally: it REDs now purely on the greenfield value import (the
// module does not exist on disk until execute), and GREENs the moment
// `errors.ts` lands. The DB-backed specs can only RED at collection locally
// (Postgres :54322 DOWN) — this is the one ENGINE.7 slice with a real local
// executable receipt.
//
// ADDITIVE DEVIATION (surfaced to the invoking session): this file is NOT in
// the plan's §"File plan" list (which names only concurrency.test.ts +
// I-ATOMICITY-001.spec.ts). Kept minimal (CLAUDE.md §5.2) — it asserts only the
// observable error contract the plan pins: constructor fields, `.name`/
// `instanceof` survival (ES2017 — cpmm/dharma/markets errors precedent), the
// `BetSerializationExhaustedError` → 503 / `Retry-After: 1` /
// `error_bet_serialization_exhausted` (`error_type: unavailable`, S2) class-level
// mapping, and the `MarketNotOpenError.status` discriminant.
//
// The exact constructor/field SHAPE is the executor's call; these assertions
// target the OBSERVABLE contract only (the SQLSTATE+flow carried on the
// exhaustion error; the 503/Retry-After:1 mapping; the observed-status
// discriminant). If execute settles a different field name, adjust the reads —
// the contract (what is carried, what maps to what) is the load-bearing part.

describe("BetSerializationExhaustedError", () => {
	it("bets-errors::exhausted-carries-sqlstate-and-flow", () => {
		// Constructed on retry-budget exhaustion with the LAST observed SQLSTATE
		// and the originating bet flow (plan §"Errors" + §"Observability" — alarm-3
		// is tagged with both). Both must be readable off the thrown instance so
		// ENGINE.8's envelope mapping + the Sentry tag can read them.
		const err = new BetSerializationExhaustedError({
			sqlstate: "40001",
			flow: "F-BET-1",
		});

		expect(err).toBeInstanceOf(BetSerializationExhaustedError);
		expect(err).toBeInstanceOf(Error);
		// `.name` survives native `extends Error` under ES2017 (explicit
		// this.name — cpmm/errors.ts parity).
		expect(err.name).toBe("BetSerializationExhaustedError");
		expect(err.sqlstate).toBe("40001");
		expect(err.flow).toBe("F-BET-1");
	});

	it("bets-errors::exhausted-maps-503-retry-after-1-unavailable-code", () => {
		// The class-level §15 envelope mapping (plan §"Errors" S2 disposition):
		// HTTP 503, Retry-After: 1, code string `error_bet_serialization_exhausted`,
		// error_type `unavailable` (NOT `temporary_unavailable` — the §15.2 enum
		// canonical value; S2 drift recorded in the plan). Asserted at the class
		// level so the mapping is a stable contract independent of the instance.
		const err = new BetSerializationExhaustedError({
			sqlstate: "40P01",
			flow: "F-BET-3",
		});

		expect(err.sqlstate).toBe("40P01");
		expect(err.flow).toBe("F-BET-3");
		expect(BetSerializationExhaustedError.httpStatus).toBe(503);
		expect(BetSerializationExhaustedError.retryAfterSeconds).toBe(1);
		expect(BetSerializationExhaustedError.code).toBe(
			"error_bet_serialization_exhausted",
		);
		expect(BetSerializationExhaustedError.errorType).toBe("unavailable");
	});
});

describe("MarketNotOpenError", () => {
	it("bets-errors::not-open-carries-observed-status-discriminant", () => {
		// Carries the OBSERVED non-Open `status` (plan §"Coarse market-state gate"
		// + §"Errors" S5 — a product error with an observed-state discriminant).
		// ENGINE.8 maps the status → §15 code (Closed → market_closed_at,
		// Resolving → in_flight_timeout, etc.); the wrapper only carries it.
		const err = new MarketNotOpenError("Closed");

		expect(err).toBeInstanceOf(MarketNotOpenError);
		expect(err).toBeInstanceOf(Error);
		expect(err.name).toBe("MarketNotOpenError");
		expect(err.status).toBe("Closed");
	});

	it("bets-errors::not-open-status-is-the-observed-non-open-state", () => {
		// The discriminant is the EXACT observed market_status, not a coarse
		// boolean — so ENGINE.8 can pick the right §15 code per state. Resolving is
		// the coarse reject-all case (fine in-flight window deferred — S1).
		const resolving = new MarketNotOpenError("Resolving");
		expect(resolving.status).toBe("Resolving");

		const draft = new MarketNotOpenError("Draft");
		expect(draft.status).toBe("Draft");
	});
});
