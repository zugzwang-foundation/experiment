import "server-only";

/**
 * Module-local error sentinels for the Dharma ledger core (mirrors
 * `src/server/cpmm/errors.ts`). These are NOT SPEC.1 §15 product errors —
 * callers run every business check (floors, balance, tag policy) before
 * reaching this core, so a throw here is a caller bug or a defensive
 * boundary trip. Module-local by design, distinct from `src/lib/errors.ts`.
 *
 * `this.name` is set explicitly so both `instanceof` and `.name` survive
 * native `extends Error` under the ES2017 target (cpmm/errors.ts parity).
 */

/**
 * Malformed decimal string (fails the `numericString` gate), OR an
 * `uncollectable` row with `amount > 0` (the A9 sign guard — the only
 * defense for that tag, since it bypasses balance arithmetic + the CHECK).
 */
export class DharmaInputError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "DharmaInputError";
	}
}

/**
 * A balance-moving row would drive `balance_after < 0`. The application
 * mirror of the storage `CHECK (balance_after >= 0)` — the INV-2
 * no-overdraft floor.
 */
export class DharmaOverdraftError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "DharmaOverdraftError";
	}
}

/**
 * A pool tag (`pool_seed` / `pool_unwind`) reached the user-only ledger
 * write path or the conservation checker. R-2: the ledger is user-only in
 * v1; admin↔pool flows are `events` rows + `pools` reserve deltas, never a
 * `dharma_ledger` row.
 */
export class DharmaPoolTagError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "DharmaPoolTagError";
	}
}
