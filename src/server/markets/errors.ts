import "server-only";

/**
 * Defensive sentinel for the market state machine: thrown by `canTransition`
 * when an unknown status key reaches the gate — a JS caller passing a non-enum
 * value, or a corrupt `markets.status` row (plan §5). TypeScript precludes it
 * for typed callers (every key is a `MarketStatus`), so reaching it is a caller
 * bug, NOT a SPEC.1 §15 product error. Module-local by design, mirroring
 * `cpmm/errors.ts`; distinct from `src/lib/errors.ts`.
 */
export class MarketTransitionError extends Error {
	constructor(message: string) {
		super(message);
		// Set explicitly so both `instanceof MarketTransitionError` and `.name`
		// survive (native class extends Error under the ES2017 target).
		this.name = "MarketTransitionError";
	}
}
