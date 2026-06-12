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

// ENGINE.14 lifecycle taxonomy — the three W-4 flows + the wrapper. Same
// statics pattern (explicit `this.name` survives ES2017 subclassing);
// messages are built at the throw sites; wire mapping is ENGINE.10's.
// Map: SlugInvalid/SlugTaken D-14.a · ContentRequired R-14.4 ·
// DeadlineInPast D-14.b/c · DeadlineCeiling R-14.6 · SeedInvalid F-ADMIN-2 ·
// LifecycleState (the W-4 expectedStatus gate) · DeadlineNotReached R-14.3 ·
// SerializationExhausted (the wrapper fires Sentry first — R-14.2).
export class MarketSlugInvalidError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "MarketSlugInvalidError";
	}
}

export class MarketSlugTakenError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "MarketSlugTakenError";
	}
}

export class MarketContentRequiredError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "MarketContentRequiredError";
	}
}

export class MarketDeadlineInPastError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "MarketDeadlineInPastError";
	}
}

export class MarketDeadlineCeilingError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "MarketDeadlineCeilingError";
	}
}

export class MarketSeedInvalidError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "MarketSeedInvalidError";
	}
}

export class MarketLifecycleStateError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "MarketLifecycleStateError";
	}
}

export class MarketDeadlineNotReachedError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "MarketDeadlineNotReachedError";
	}
}

export class LifecycleSerializationExhaustedError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "LifecycleSerializationExhaustedError";
	}
}
