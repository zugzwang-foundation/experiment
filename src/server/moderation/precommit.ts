import "server-only";
import {
	ModerationInFlightError,
	ModerationUnavailableError,
} from "@/lib/errors";
import {
	READ_URL_TTL_SECONDS_MODERATION,
	RESERVATION_KEY_PREFIX,
	RESERVATION_TTL_SECONDS,
} from "@/server/config/limits";
import { moderate } from "@/server/moderation/openai";
import { signRead } from "@/server/storage/sign-read";
import { redis } from "@/server/upstash/redis";

// Pre-commit moderation per SPEC.2 §10.10 + ADR-0014. Owns the
// 10-second `mod:reserve:*` Redis reservation lifecycle:
//   1. Compute reservation key `mod:reserve:${userId}:${marketId}:${idempotencyKey}`
//   2. SET NX EX 10. Null → ModerationInFlightError (caller → HTTP 409).
//   3. try { ... } finally { redis.del(reservationKey) }
//   4. Inside try: if imageR2Key → mint 60s read URL; openai.moderate(...)
//   5. Map verdict: 'sexual/minors' → track_a (REFUSAL-2 CSAM legal floor);
//      any other flagged → track_b; none → pass.
//
// SCAFFOLD.16 adds PhotoDNA + Safer in parallel via `Promise.all`; the
// caller-facing return shape (`{ outcome, categories }`) stays unchanged.

const TRACK_A_CATEGORY = "sexual/minors" as const;

// `u/<userId>/<uploadId>.<ext>` shape from `signUploadAndInsert` per
// SCAFFOLD.15 Q9 + SPEC.2 §12.9. Defensive shape gate at the precommit
// boundary (SCAFFOLD.15 security-auditor LOW absorption) so a future
// misconfigured caller can't pass an attacker-controlled key that mints
// a signed READ URL into arbitrary `uploads/`-bucket objects. The shape
// check is loose (segments are non-empty + path-safe + ext is whitelisted);
// the actual security gate is the `startsWith(\`u/${userId}/\`)` namespace
// scoping below, which prevents cross-user disclosure.
const IMAGE_R2_KEY_SHAPE = /^u\/[^/]+\/[^/]+\.(jpg|png|webp|gif|avif)$/i;

interface PrecommitArgs {
	text: string;
	imageR2Key?: string | undefined;
	idempotencyKey: string;
	userId: string;
	marketId: string;
}

interface PrecommitResult {
	outcome: "pass" | "track_a" | "track_b";
	categories: string[];
}

export async function precommitModerate(
	args: PrecommitArgs,
): Promise<PrecommitResult> {
	const { text, imageR2Key, idempotencyKey, userId, marketId } = args;
	const reservationKey = `${RESERVATION_KEY_PREFIX}${userId}:${marketId}:${idempotencyKey}`;

	const reservation = await redis.set(reservationKey, "1", {
		nx: true,
		ex: RESERVATION_TTL_SECONDS,
	});
	if (reservation !== "OK") {
		throw new ModerationInFlightError();
	}

	try {
		let imageUrl: string | undefined;
		if (imageR2Key) {
			if (
				!IMAGE_R2_KEY_SHAPE.test(imageR2Key) ||
				!imageR2Key.startsWith(`u/${userId}/`)
			) {
				// Defensive gate per SCAFFOLD.15 security-auditor LOW absorption.
				// The image-comment commit path (DEBATE.2) derives this key
				// from `image_uploads.r2_object_key` which is trigger-immutable
				// and `u/${userId}/...`-prefixed. Surface a clear failure if
				// any future caller passes a free-form / cross-user key.
				throw new ModerationUnavailableError(
					new Error(
						`precommit_moderate: invalid imageR2Key shape (must match u/${userId}/<uuid>.<ext>)`,
					),
				);
			}
			try {
				imageUrl = await signRead(imageR2Key, READ_URL_TTL_SECONDS_MODERATION);
			} catch (err) {
				throw new ModerationUnavailableError(err);
			}
		}

		let result: Awaited<ReturnType<typeof moderate>>;
		try {
			result = await moderate({ text, imageUrl });
		} catch (err) {
			// Wrap any throw from the moderate hop (openai.ts already wraps
			// terminal failures into ModerationUnavailableError, but a mock /
			// future PhotoDNA addition might throw a raw error — the contract
			// surface here is: precommit always fails CLOSED as
			// ModerationUnavailableError, regardless of source. Idempotent
			// double-wrap: if `err` is already a ModerationUnavailableError,
			// the cause-chain is preserved via the new wrapper).
			throw new ModerationUnavailableError(err);
		}

		const flaggedCategories: string[] = [];
		for (const [name, flagged] of Object.entries(result.categories)) {
			if (flagged === true) {
				flaggedCategories.push(name);
			}
		}

		let outcome: PrecommitResult["outcome"] = "pass";
		if (result.categories[TRACK_A_CATEGORY] === true) {
			outcome = "track_a";
		} else if (flaggedCategories.length > 0) {
			outcome = "track_b";
		}

		return { outcome, categories: flaggedCategories };
	} finally {
		await redis.del(reservationKey);
	}
}
