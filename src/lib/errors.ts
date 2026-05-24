// Discriminated domain-error registry per AGENTS.md §4. Each error class
// carries a public readonly `kind` string that downstream consumers
// discriminate on without needing `instanceof` chains; the class itself
// is the carrier so `throw new ImageMimeRejectedError(...)` is the call
// site, and `if (err instanceof ImageMimeRejectedError)` is the catch
// site for type-narrowing. The `kind` field maps 1:1 to the HTTP error
// envelope code (`error_<kind>`) per SPEC.2 §11 + §15 conventions.
//
// SCAFFOLD.15 bootstraps the registry with the 7 errors named in plan
// §5.3. Future strata extend by adding new classes here.

export type DomainErrorKind =
	| "storage_unavailable"
	| "storage_object_missing"
	| "moderation_unavailable"
	| "moderation_in_flight"
	| "image_mime_rejected"
	| "image_oversize"
	| "orphan_sweep_lock_contention";

interface ErrorEnvelope {
	error: string;
}

/**
 * Common base — every domain error carries the `kind` discriminator + a
 * `toEnvelope()` shape for HTTP response shaping. Caller-facing modules
 * `throw` the subclass; route handlers catch and `.toEnvelope()` into the
 * `{ ok: false, error: { code } }` shape per SPEC.2 §4.4.
 */
export abstract class DomainError extends Error {
	abstract readonly kind: DomainErrorKind;

	toEnvelope(): ErrorEnvelope {
		return { error: `error_${this.kind}` };
	}
}

/** R2 (or any storage substrate) returned a 5xx / connection failure. Fail-CLOSED at handler boundary → HTTP 503 `error_storage_unavailable`. */
export class StorageUnavailableError extends DomainError {
	readonly kind = "storage_unavailable" as const;
	constructor(public readonly cause: unknown) {
		super("storage_unavailable");
		this.name = "StorageUnavailableError";
	}
}

/** R2 returned 404 for a key we expected to exist (e.g., HeadObject after PUT). */
export class StorageObjectMissingError extends DomainError {
	readonly kind = "storage_object_missing" as const;
	constructor(public readonly key: string) {
		super(`storage_object_missing: ${key}`);
		this.name = "StorageObjectMissingError";
	}
}

/** OpenAI moderation call failed after retries (network / 5xx / 429 / timeout). Fail-CLOSED → HTTP 503 `error_moderation_unavailable`. */
export class ModerationUnavailableError extends DomainError {
	readonly kind = "moderation_unavailable" as const;
	constructor(public readonly cause: unknown) {
		super("moderation_unavailable");
		this.name = "ModerationUnavailableError";
	}
}

/** Reservation key already held — concurrent precommitModerate for the same `(userId, marketId, idempotencyKey)`. Caller maps to HTTP 409 `error_moderation_in_flight + Retry-After: 2`. */
export class ModerationInFlightError extends DomainError {
	readonly kind = "moderation_in_flight" as const;
	constructor() {
		super("moderation_in_flight");
		this.name = "ModerationInFlightError";
	}
}

/** Client passed a `contentType` outside the IMAGE_UPLOADS_ALLOWED_MIME whitelist. Caller maps to HTTP 400 `error_image_mime_rejected`. */
export class ImageMimeRejectedError extends DomainError {
	readonly kind = "image_mime_rejected" as const;
	constructor(
		public readonly received: string,
		public readonly allowed: readonly string[],
	) {
		super(
			`image_mime_rejected: received="${received}", allowed=${JSON.stringify(allowed)}`,
		);
		this.name = "ImageMimeRejectedError";
	}
}

/** Client passed a `byteSize` outside `(0, IMAGE_UPLOADS_MAX_BYTES]`. Caller maps to HTTP 400 `error_image_oversize`. */
export class ImageOversizeError extends DomainError {
	readonly kind = "image_oversize" as const;
	constructor(
		public readonly received: number,
		public readonly max: number,
	) {
		super(`image_oversize: received=${received}, max=${max}`);
		this.name = "ImageOversizeError";
	}
}

/** Orphan-sweep cron observed contention on the distributed lock (another sweep in flight). Caller exits cleanly with HTTP 200 `{ status: "locked", swept: 0 }`. Not an error class for HTTP envelope use; carried here for symmetry with the rest of the registry + ENGINE.6 event-typing. */
export class OrphanSweepLockContentionError extends DomainError {
	readonly kind = "orphan_sweep_lock_contention" as const;
	constructor() {
		super("orphan_sweep_lock_contention");
		this.name = "OrphanSweepLockContentionError";
	}
}
