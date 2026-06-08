import "server-only";

/**
 * Module-local error sentinels for the position core (mirrors
 * `dharma/errors.ts` / `cpmm/errors.ts`). These are NOT SPEC.1 §15 product
 * errors — callers run the business checks (market state, floors, eligibility)
 * before reaching this layer, so a throw here is a caller bug or a defensive
 * boundary trip. Module-local by design, distinct from `src/lib/errors.ts`.
 *
 * `this.name` is set explicitly so both `instanceof` and `.name` survive native
 * `extends Error` under the ES2017 target (cpmm/dharma errors.ts parity).
 */

/**
 * A position mutation would drive `quantity < 0`. The application mirror of the
 * storage `CHECK (quantity >= 0)` — the R-3 oversell floor (mints
 * I-NO-OVERSELL-001). `quantity == 0` is allowed (the sell-to-zero / flip path).
 */
export class PositionOversellError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "PositionOversellError";
	}
}

/** A malformed NUMERIC(38,18) decimal string (fails the `numericString` gate). */
export class PositionInputError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "PositionInputError";
	}
}

/**
 * The single-side rule was violated: a second held (`quantity > 0`) row for one
 * `(user, market)`. The catch-and-translate of SQLSTATE 23505 on
 * `positions_one_held_side_idx` (R-5 flip-ordering backstop), and the read-side
 * `≤ 1` defense-in-depth trip.
 */
export class PositionSingleSideError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "PositionSingleSideError";
	}
}
