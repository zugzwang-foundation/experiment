import "server-only";

import { captureMessage } from "@sentry/nextjs";
import { and, eq, isNull, sql } from "drizzle-orm";

import { db } from "@/db";
import { imageUploads, modActions, users } from "@/db/schema";

// DEBATE.7 — reactive-moderation CONSEQUENCE writer (ADR-0021). The gate
// (`precommitModerate`) runs entirely BEFORE any DB transaction and releases its
// Redis reservation in its own `finally` (precommit.ts) — so by the time the
// route calls `recordGateBlock` there is NO reservation held and NO HTTP in
// flight. This opens exactly ONE standalone pure-DB short tx (the golden rule: a
// Postgres tx is NEVER held across the OpenAI hop — the hop is already done).
//
// Invariant posture:
//   - INV-1: the route calls this INSTEAD of opening the bet+comment tx, so on a
//     gate block the bet+comment tx never opens — there is no partial state.
//   - INV-2 / INV-3: the track_a auto-ban touches ONLY `users.banned_at`
//     (NULL→now, idempotent guard); positions + dharma_ledger are never read or
//     written. "Ban removes voice, not balance; positions ride to resolution."
//     No clawback, no compensating sell.
//   - Append-only: `mod_actions` is Bucket A — rows are INSERTed, never mutated.
//
// CSAM seam (OD-5 / LD-7): a track_a whose categories include `sexual/minors`
// emits a Sentry signal AFTER the tx commits (Sentry is not the OpenAI hop, but
// it is kept out of the tx regardless). NO NCMEC API call is made — the
// integration is parked (see the TODO marker below).

/** The three `mod_reason` values the GATE auto-action path can produce (the other two — content_removed / user_banned — are reactive-admin only). */
type GateBlockReason =
	| "track_a_autoban"
	| "track_b_blocked"
	| "sexual_minors_text_blocked";

export interface RecordGateBlockArgs {
	/** The gate verdict — only track_a / track_b reach the consequence writer (`pass` opens the bet tx instead). */
	outcome: "track_a" | "track_b";
	/** The flagged OpenAI category NAMES — drives the carve-out + CSAM-seam discriminants. */
	categories: string[];
	/** The raw OpenAI category SCORES at decision time → persisted into `mod_actions.categories` (SPEC.1 §786). */
	categoryScores: Record<string, number>;
	/** The acting (blocked) user — target of the audit row + the track_a ban. */
	userId: string;
	/** The market the blocked submit targeted (a gate-block has no comment row to JOIN — F-ADMIN-5). */
	marketId: string;
	/** The rejected comment body, retained for reactive ban-review (admin-only; STRIP-in-dataset). */
	blockedText: string;
	/** The attached image's R2 key (image flows only) → written to `mod_actions.image_r2_key`; also the text-vs-image carve-out discriminant. */
	imageR2Key?: string | undefined;
	/** The attached image's upload PK (image flows only) → the key for the `image_uploads → 'blocked'` CAS (the unique PK, mirroring place()). */
	imageUploadId?: string | undefined;
}

/**
 * Derive the `mod_actions.reason` from the verdict (the discriminant lives in
 * the writer, NOT the gate — §6). track_a → autoban. For track_b, the text-only
 * `sexual/minors` carve-out is the ONE blocked-not-published row surfaced to
 * reactive ban-review (`sexual_minors_text_blocked`); everything else flagged is
 * an ordinary `track_b_blocked`. `!imageR2Key` is the defensive belt — precommit
 * only yields track_b for `sexual/minors` when there is no image.
 */
function deriveReason(args: RecordGateBlockArgs): GateBlockReason {
	if (args.outcome === "track_a") {
		return "track_a_autoban";
	}
	if (!args.imageR2Key && args.categories.includes("sexual/minors")) {
		return "sexual_minors_text_blocked";
	}
	return "track_b_blocked";
}

export async function recordGateBlock(
	args: RecordGateBlockArgs,
): Promise<void> {
	const { outcome, categories, categoryScores, userId, marketId, blockedText } =
		args;
	const imageR2Key = args.imageR2Key;
	const imageUploadId = args.imageUploadId;
	const reason = deriveReason(args);

	const modActionId = await db.transaction(async (tx) => {
		const [row] = await tx
			.insert(modActions)
			.values({
				targetUserId: userId,
				targetMarketId: marketId,
				reason,
				// The gate verdict (track_a / track_b); NULL is reserved for reactive
				// admin-action rows, which this writer never produces.
				verdict: outcome,
				// The full OpenAI score map ("with confidence" — SPEC.1 §786 / App.B.10).
				categories: categoryScores,
				blockedText,
				imageR2Key: imageR2Key ?? null,
				// Gate auto-actions are the system actor (admin has no users row).
				actorId: "system",
			})
			.returning({ id: modActions.id });
		if (row === undefined) {
			throw new Error(
				"recordGateBlock: mod_actions INSERT … RETURNING produced no row",
			);
		}

		// track_a → auto-ban. INV-2/3: `banned_at` ONLY; the `banned_at IS NULL`
		// guard makes the ban idempotent, so a benign duplicate write (the §8
		// reservation-release→cache-write race) never re-stamps or errors.
		if (outcome === "track_a") {
			await tx
				.update(users)
				.set({ bannedAt: sql`now()` })
				.where(and(eq(users.id, userId), isNull(users.bannedAt)));
		}

		// Image flow → flip `image_uploads → 'blocked'`, mirroring place()'s
		// committed CAS EXACTLY: keyed on the unique PK `imageUploads.id` (NOT the
		// un-constrained `r2_object_key`), the whitelisted Bucket-B two-column
		// NULL→set transition (`terminal_state` + `terminal_at` together — the
		// enforce_image_uploads_terminal_atomic trigger), guarded by
		// `terminal_state IS NULL` so the orphan sweep never reaps a blocked image's
		// R2 object and the flip is idempotent. Best-effort: a block with no
		// matching un-terminal upload (e.g. a text-flow caller — no uploadId) claims
		// zero rows — harmless, NO throw. (UNLIKE place()'s committed path, where a
		// 0-row claim is a concurrent-race rollback: a published bet must own its
		// image; a gate-block need not.)
		if (imageUploadId) {
			await tx
				.update(imageUploads)
				.set({ terminalState: "blocked", terminalAt: sql`now()` })
				.where(
					and(
						eq(imageUploads.id, imageUploadId),
						isNull(imageUploads.terminalState),
					),
				);
		}

		return row.id;
	});

	// CSAM seam (OD-5 / LD-7) — Sentry-only, AFTER the tx commits. Fires ONLY on
	// track_a + `sexual/minors` (real CSAM-adjacency). Under A2 a track_a from
	// adult `sexual`+image is NOT `sexual/minors`, so it does NOT fire (correct —
	// it is not CSAM). The text-only `sexual/minors` carve-out is track_b, so it
	// never reaches this track_a-only seam (it surfaces via its reason + the feed).
	if (outcome === "track_a" && categories.includes("sexual/minors")) {
		// TODO(MOD-NCMEC-INTEGRATION): file NCMEC CyberTipline report — parked per parked.md LD-7
		captureMessage("csam_auto_report_pending", {
			level: "warning",
			tags: { mod_action_id: modActionId },
		});
	}
}
