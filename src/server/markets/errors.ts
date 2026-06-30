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

// MEDIA.1 (ADR-0026 #5 / SPEC.1 §15 service invariant) — the at-create media
// guards: a market is never live without media (≥1 image, exactly one
// is_default). Service-required VALIDATION (not moderation — ADR-0027). Thrown
// at `createMarket` entry, before any write; wire-mapped to `media_required` /
// `default_media_required` in `toActionError`.
export class MediaRequiredError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "MediaRequiredError";
	}
}

export class DefaultMediaRequiredError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "DefaultMediaRequiredError";
	}
}

// MEDIA.1 (ADR-0026 #6) — the optional outbound video URL failed validation
// (must be a well-formed https YouTube URL). Wire-mapped to `video_url_invalid`.
export class MarketVideoUrlInvalidError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "MarketVideoUrlInvalidError";
	}
}

// MEDIA.1 (Q3 client-supplied-PK trust boundary) — the client-pre-generated
// `marketId` PK already exists. `createMarket` is STRICT INSERT-ONLY (plain
// INSERT, no onConflict): a supplied existing/arbitrary id REJECTS (never
// upserts), so it cannot mutate any existing market's data. Mapped from the
// markets-PK 23505 to a typed error (never a raw 500); wire code
// `market_id_conflict`.
export class MarketIdConflictError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "MarketIdConflictError";
	}
}
