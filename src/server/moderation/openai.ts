import "server-only";
import OpenAI, {
	APIConnectionError,
	APIConnectionTimeoutError,
	APIUserAbortError,
	AuthenticationError,
	InternalServerError,
	PermissionDeniedError,
	RateLimitError,
} from "openai";

import { ModerationUnavailableError } from "@/lib/errors";
import {
	OPENAI_MAX_RETRIES,
	OPENAI_MODERATION_MODEL_SNAPSHOT,
	OPENAI_TIMEOUT_MS,
} from "@/server/config/limits";
import { safeCaptureException } from "@/server/observability/safe-capture";

// OpenAI v6 client wrapper for the omni-moderation-2024-09-26 snapshot per
// SCAFFOLD.15 plan §5.2 + SPEC.2 §10.10 + ADR-0014. Module-load construction
// of the singleton client; OPENAI_API_KEY is validated at first call (not
// at module load) so tests that mock this module don't need the env var set.
//
// Failure-mode posture:
//   - Transient (network / timeout / 5xx / 429): 1 retry per
//     OPENAI_MAX_RETRIES; on second failure, fail-CLOSED via
//     ModerationUnavailableError. Per ADR-0006 §"Failure-mode profile".
//   - Auth (401/403): throw immediately WITHOUT retry (retrying a bad key
//     would burn rate-limit on the OpenAI side); capture with the byte-stable
//     `openai_moderation_auth_failure` Sentry tag (per SPEC.2 §17.2 row 4).
//   - All captures sit at THIS vendor boundary (AUDIT-FIX-B1 A6, ruling #4)
//     — precommit re-wraps but mints no vendor failure of its own.

let cachedClient: OpenAI | null = null;

function getClient(): OpenAI {
	if (cachedClient) return cachedClient;
	if (!process.env.OPENAI_API_KEY) {
		throw new Error(
			"OPENAI_API_KEY not set — moderation pipeline cannot reach OpenAI (see .env.example).",
		);
	}
	cachedClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
	return cachedClient;
}

interface ModerateArgs {
	text: string;
	imageUrl?: string | undefined;
}

interface ModerateResult {
	flagged: boolean;
	categories: Record<string, boolean>;
	scores: Record<string, number>;
}

function isTransient(err: unknown): boolean {
	return (
		err instanceof APIConnectionError ||
		err instanceof APIConnectionTimeoutError ||
		err instanceof APIUserAbortError ||
		err instanceof InternalServerError ||
		err instanceof RateLimitError
	);
}

function isAuthFailure(err: unknown): boolean {
	return (
		err instanceof AuthenticationError || err instanceof PermissionDeniedError
	);
}

export async function moderate(args: ModerateArgs): Promise<ModerateResult> {
	const { text, imageUrl } = args;
	const client = getClient();

	const input: Array<
		| { type: "text"; text: string }
		| { type: "image_url"; image_url: { url: string } }
	> = [{ type: "text", text }];
	if (imageUrl) {
		input.push({ type: "image_url", image_url: { url: imageUrl } });
	}

	let lastErr: unknown;
	for (let attempt = 0; attempt <= OPENAI_MAX_RETRIES; attempt++) {
		try {
			const response = await client.moderations.create(
				{ model: OPENAI_MODERATION_MODEL_SNAPSHOT, input },
				{ signal: AbortSignal.timeout(OPENAI_TIMEOUT_MS) },
			);
			const result = response.results[0];
			if (!result) {
				throw new Error("openai_moderation_empty_results");
			}
			// AUDIT-FIX-A21 — well-formedness guard, the sibling of the
			// empty-results anomaly above. A `flagged === true` verdict with NO
			// category set true yields no derivable track: the mapper
			// (precommit.ts) reads specific category booleans / flaggedCategories
			// and would fall through to `pass` — a fail-open on a legal-floor gate
			// (SPEC.1 §16.5). Treat it as a malformed vendor shape and fail CLOSED.
			// Emit the DISTINCT tag `openai_moderation_malformed_flagged` (NOT
			// upstream_failure) so a category rename under the pinned
			// omni-moderation-2024-09-26 snapshot reads as label-drift, not an
			// outage. The capture stays at THIS vendor boundary per AUDIT-FIX-B1
			// A6 ruling #4; the `instanceof ModerationUnavailableError` re-throw in
			// the catch below keeps this from being reclassified into
			// upstream_failure (which would lose the drift signal) or retried.
			if (
				result.flagged === true &&
				!Object.values(result.categories).some((v) => v === true)
			) {
				const cause = new Error("openai_moderation_malformed_flagged");
				safeCaptureException(cause, {
					tags: { kind: "openai_moderation_malformed_flagged" },
				});
				throw new ModerationUnavailableError(cause);
			}
			// Cast widens OpenAI's strongly-typed Moderation.Categories /
			// CategoryScores shapes (per moderations.d.ts) to string-indexed
			// records so the caller (precommitModerate) can iterate via
			// Object.entries without per-key narrowing. Trust boundary per
			// AGENTS.md §4 — third-party API response shape.
			return {
				flagged: result.flagged,
				categories: result.categories as unknown as Record<string, boolean>,
				scores: result.category_scores as unknown as Record<string, number>,
			};
		} catch (err) {
			lastErr = err;
			if (err instanceof ModerationUnavailableError) {
				// AUDIT-FIX-A21 malformed-flagged guard already captured with its
				// distinct tag and failed closed — re-throw as-is. Do NOT fall
				// through to the classifier below (which would re-capture it as
				// `openai_moderation_upstream_failure`, losing the drift signal)
				// or the transient retry loop.
				throw err;
			}
			if (isAuthFailure(err)) {
				// Tag `openai_moderation_auth_failure` per SPEC.2 §17.2 row 4
				// (byte-identical). Auth failures never retry.
				safeCaptureException(err, {
					tags: { kind: "openai_moderation_auth_failure" },
				});
				throw new ModerationUnavailableError(err);
			}
			if (!isTransient(err)) {
				// Non-transient upstream failure (incl. the empty-results anomaly,
				// which lands here as a plain Error) — capture, then fail closed.
				safeCaptureException(err, {
					tags: { kind: "openai_moderation_upstream_failure" },
				});
				throw new ModerationUnavailableError(err);
			}
			// transient → loop; if we've exhausted retries, fall through
		}
	}
	// Retries exhausted on transients — same upstream tag with the last error.
	safeCaptureException(lastErr, {
		tags: { kind: "openai_moderation_upstream_failure" },
	});
	throw new ModerationUnavailableError(lastErr);
}
