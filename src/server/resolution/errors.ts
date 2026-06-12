import "server-only";

import type { MarketStatus } from "@/server/markets/transitions";

import type { ResolutionFlow } from "./transaction";

/**
 * The W-3 resolution-transaction error classes (the ENGINE.7 statics pattern —
 * `extends Error` with explicit `this.name` so `instanceof` AND `.name`
 * survive native subclassing under the ES2017 target). Wire mapping is
 * ENGINE.10's; ENGINE.9 only mints + throws these.
 *
 * `ResolutionFlow` is imported type-only (erased) — the sole runtime edge is
 * `transaction.ts → errors.ts`, so no runtime import cycle exists (the W-1
 * `bets/errors.ts` precedent).
 */

/**
 * The full-jitter retry budget (1 initial attempt + 3 retries) was exhausted —
 * every attempt hit a retryable serialization failure (SQLSTATE 40001/40P01).
 * The wrapper has already fired
 * `captureMessage('resolution_serialization_exhausted')` before throwing
 * (SPEC.2 §17.2 rider R-K). Carries the LAST observed SQLSTATE + the flow.
 */
export class ResolutionSerializationExhaustedError extends Error {
	static readonly httpStatus = 503;
	static readonly retryAfterSeconds = 1;
	static readonly code = "error_resolution_serialization_exhausted";

	readonly sqlstate: string;
	readonly flow: ResolutionFlow;

	constructor(args: { sqlstate: string; flow: ResolutionFlow }) {
		super(
			`resolution transaction exhausted the serialization retry budget (last SQLSTATE ${args.sqlstate}, flow ${args.flow})`,
		);
		this.name = "ResolutionSerializationExhaustedError";
		this.sqlstate = args.sqlstate;
		this.flow = args.flow;
	}
}

/**
 * The per-flow state gate observed a market outside `expectedStatus` (on the
 * LOCKED row — the wrapper gate is the fence, the §6.1 graph is the law).
 * NOT retried (no SQLSTATE). Wire mapping is ENGINE.10's.
 */
export class ResolutionStateError extends Error {
	readonly flow: ResolutionFlow;
	readonly expected: readonly MarketStatus[];
	readonly observed: MarketStatus;

	constructor(args: {
		flow: ResolutionFlow;
		expected: readonly MarketStatus[];
		observed: MarketStatus;
	}) {
		super(
			`market is not in a legal state for ${args.flow} (observed ${args.observed}, expected ${args.expected.join("|")})`,
		);
		this.name = "ResolutionStateError";
		this.flow = args.flow;
		this.expected = args.expected;
		this.observed = args.observed;
	}
}

/**
 * R-9.3 + OQ-3 (RATIFIED): the corrected outcome must be YES/NO (a correction
 * can never flip a market to VOID) AND must differ from the chain tip's
 * outcome (a same-side "correction" is a no-op masquerading as one).
 */
export class CorrectionOutcomeError extends Error {
	readonly correctedSide: string;
	readonly tipOutcome: string | null;

	constructor(args: { correctedSide: string; tipOutcome: string | null }) {
		super(
			`illegal corrected outcome ${args.correctedSide} (tip outcome ${args.tipOutcome ?? "n/a"}): corrections are YES/NO only and must differ from the chain tip (R-9.3/OQ-3)`,
		);
		this.name = "CorrectionOutcomeError";
		this.correctedSide = args.correctedSide;
		this.tipOutcome = args.tipOutcome;
	}
}
