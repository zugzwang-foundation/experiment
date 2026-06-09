import "server-only";

import type { MarketStatus } from "@/server/markets/transitions";

import type { BetFlow } from "./transaction";

/**
 * The W-1 bet-transaction wrapper's two module-local error classes (mirrors
 * `cpmm/errors.ts` / `dharma/errors.ts` / `markets/errors.ts` — `extends Error`
 * with an explicit `this.name` so `instanceof` AND `.name` survive native
 * subclassing under the ES2017 target). UNLIKE those modules' caller-bug
 * sentinels, these are SPEC.1 §15 PRODUCT errors carrying an observed-state
 * discriminant (plan §"Errors" S5). The status → §15 code map + the response
 * envelope wiring are ENGINE.8's; ENGINE.7 only mints + throws these.
 *
 * `BetFlow` is imported type-only (erased) — the sole runtime edge is
 * `transaction.ts → errors.ts`, so no runtime import cycle exists.
 */

/**
 * The full-jitter retry budget (1 initial attempt + 3 retries) was exhausted —
 * every attempt hit a retryable serialization failure (SQLSTATE 40001 / 40P01).
 * Alarm 3 (SPEC.2 §17.2 row 3): the wrapper has already fired
 * `captureMessage('bet_serialization_exhausted')` before throwing this. Carries
 * the LAST observed SQLSTATE + the originating flow — the Sentry-tag surface +
 * ENGINE.8's §15 envelope inputs.
 *
 * The §15 envelope is class-level + FIXED (plan §"Errors" S2): HTTP 503,
 * `Retry-After: 1`, code `error_bet_serialization_exhausted`, error_type
 * `unavailable` (the §15.2 canonical enum value — NOT the §9 prose's
 * `temporary_unavailable`). ENGINE.8 reads these statics to build the response.
 */
export class BetSerializationExhaustedError extends Error {
	static readonly httpStatus = 503;
	static readonly retryAfterSeconds = 1;
	static readonly code = "error_bet_serialization_exhausted";
	static readonly errorType = "unavailable";

	readonly sqlstate: string;
	readonly flow: BetFlow;

	constructor(args: { sqlstate: string; flow: BetFlow }) {
		super(
			`bet transaction exhausted the serialization retry budget (last SQLSTATE ${args.sqlstate}, flow ${args.flow})`,
		);
		this.name = "BetSerializationExhaustedError";
		this.sqlstate = args.sqlstate;
		this.flow = args.flow;
	}
}

/**
 * The coarse market-state gate observed a non-Open market. A PRODUCT error that
 * is NOT retried — it carries no SQLSTATE, so the wrapper's retry filter
 * rethrows it immediately (plan §"Coarse market-state gate"). Carries the EXACT
 * observed `status` so ENGINE.8 maps it to the right §15 code (Closed →
 * `market_closed_at`, Resolving → `in_flight_timeout` coarse reject-all,
 * Draft/Resolved/Voided/Frozen → `market_not_open`). The wrapper does NOT pick
 * the code — that status → §15 map is ENGINE.8's.
 */
export class MarketNotOpenError extends Error {
	readonly status: MarketStatus;

	constructor(status: MarketStatus) {
		super(`market is not Open for betting (status ${status})`);
		this.name = "MarketNotOpenError";
		this.status = status;
	}
}
