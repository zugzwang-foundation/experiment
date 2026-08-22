import "server-only";

/**
 * Module-local error sentinels for the lot core (ADR-0039), mirroring
 * `positions/errors.ts` / `dharma/errors.ts` / `cpmm/errors.ts`. These are NOT
 * SPEC.1 §15 product errors — callers run the business checks (market state,
 * floors, eligibility, ownership) before reaching this layer, so a throw here
 * is a caller bug or a defensive boundary trip.
 *
 * `this.name` is set explicitly so both `instanceof` and `.name` survive native
 * `extends Error` under the ES2017 target (the cpmm / dharma / positions
 * errors.ts parity).
 */

/**
 * A sale would take more shares than the lot — or the holding — still has. The
 * application mirror of `lots_surviving_shares_non_negative`, and the per-lot
 * twin of `PositionOversellError`.
 *
 * ⚠ The ceiling is the SURVIVING quantity, never the original: a half-sold lot
 * must not be sellable again up to its mint size, and a Sold lot must not be
 * sellable at all (R9 — Sold is permanent).
 */
export class LotOversellError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "LotOversellError";
	}
}

/**
 * A malformed or out-of-domain quantity: a non-NUMERIC(38,18) decimal string, a
 * non-positive mint, or a non-positive sale. Distinct from `LotOversellError`
 * because they mean different things to a caller — one is "you asked for more
 * than exists", the other is "that is not a quantity".
 */
export class LotInputError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "LotInputError";
	}
}
