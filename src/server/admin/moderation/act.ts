"use server";

import { and, eq, isNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/db";
import { comments, modActions, users } from "@/db/schema";
import {
	type ActionResult,
	adminSessionRequired,
	requireAdminSession,
	validationError,
} from "@/server/admin/wire";

// UI.6 S3(b) — the reactive Remove/Ban Server Action (F-ADMIN-4 partial;
// ADR-0020/0021). Two INDEPENDENT axes, never a combined verb (no
// `remove_and_ban`, R2): each call is one explicit decision → one append-only
// `mod_actions` audit row. This is the write-side of the SAME `content_removed`
// masking the debate view already reads (`loadRemovedSet`).
//
// Invariant posture (mirrors `recordGateBlock`, MINUS the events emit + image
// flip — D-6/R3: reactive Remove/Ban mint NO event, EVENT_TYPES stays 24):
//   - Remove → append ONE `content_removed` row; ZERO writes to `comments`
//     (Bucket-A append-only; the comment is hidden read-side via masking, never
//     mutated). INV-3 (comments immutable) holds by construction.
//   - Ban → append ONE `user_banned` row + set `users.banned_at` ONLY where NULL
//     (idempotent). Touches NO position / bet / dharma_ledger / comment — "ban
//     removes voice, not balance; a banned author's prior content stays visible"
//     (INV-1/2/3, ADR-0021). No clawback, no compensating sell.
//   - Reactive rows carry `verdict = NULL` + `categories = {}` (no classifier
//     was involved — D-3) and `actor_id = 'admin-singleton'`.
//
// Layer-2 admin gate first (per-action; null → zero writes). No DDL: the
// `content_removed` / `user_banned` reasons already exist in `modReasonEnum`.

const moderateCommentSchema = z.object({
	commentId: z.string().uuid(),
	action: z.enum(["remove", "ban"]),
});

export interface ModerateCommentInput {
	commentId: string;
	action: "remove" | "ban";
}

type ModerateCommentData = {
	modActionId: string;
	action: "remove" | "ban";
};

/** A typed error envelope for the moderate surface (no wire lifecycle codes). */
function moderationError(
	code: string,
	message: string,
): { ok: false; error: { code: string; message: string } } {
	return { ok: false, error: { code, message } };
}

export async function moderateComment(
	input: ModerateCommentInput,
): Promise<ActionResult<ModerateCommentData>> {
	if (!(await requireAdminSession())) return adminSessionRequired();

	const parsed = moderateCommentSchema.safeParse(input);
	if (!parsed.success) return validationError(parsed.error);
	const { commentId, action } = parsed.data;

	// Resolve the comment's author + market (the ban target / audit context).
	const [comment] = await db
		.select({ userId: comments.userId, marketId: comments.marketId })
		.from(comments)
		.where(eq(comments.id, commentId));
	if (!comment) {
		return moderationError(
			"comment_not_found",
			"That comment no longer exists.",
		);
	}

	const modActionId = await db.transaction(async (tx) => {
		if (action === "remove") {
			// ONE content_removed row; NO write to `comments` (masking is read-side).
			const [row] = await tx
				.insert(modActions)
				.values({
					reason: "content_removed",
					verdict: null,
					targetCommentId: commentId,
					targetMarketId: comment.marketId,
					categories: {},
					actorId: "admin-singleton",
				})
				.returning({ id: modActions.id });
			if (row === undefined) {
				throw new Error(
					"moderateComment: content_removed INSERT produced no row",
				);
			}
			return row.id;
		}

		// action === "ban": ONE user_banned row + banned_at (only where NULL).
		const [row] = await tx
			.insert(modActions)
			.values({
				reason: "user_banned",
				verdict: null,
				targetUserId: comment.userId,
				targetMarketId: comment.marketId,
				categories: {},
				actorId: "admin-singleton",
			})
			.returning({ id: modActions.id });
		if (row === undefined) {
			throw new Error("moderateComment: user_banned INSERT produced no row");
		}
		// INV-2/3: `banned_at` ONLY; the `IS NULL` guard makes the ban idempotent
		// (a re-ban never re-stamps). NO positions / dharma_ledger read or write.
		await tx
			.update(users)
			.set({ bannedAt: sql`now()` })
			.where(and(eq(users.id, comment.userId), isNull(users.bannedAt)));
		return row.id;
	});

	revalidatePath("/admin/moderation");
	return { ok: true, data: { modActionId, action } };
}
