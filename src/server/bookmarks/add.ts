"use server";

import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { z } from "zod";

import { db } from "@/db";
import { bookmarks, comments } from "@/db/schema";
import { auth } from "@/server/auth";

// ADR-0032 D-2 / D-3 — the "add bookmark" Server Action. Two explicit actions
// (add + remove), NOT a toggle: two rapid taps could both read "absent" and
// net to bookmarked (D-2), so the client — which always knows the icon state —
// calls the correct action. Single INSERT, no db.transaction (one write; the
// comment lookup is only a guard, and `comments` is Bucket-A immutable so its
// user_id cannot change under us — no TOCTOU).
//
// A6 does NOT wire this action to any surface (the add-icon lives on the debate
// view + other-user Profile cards — that cross-surface wiring is the named
// follow-on BOOKMARK-ADD-WIRE, plan §11). The action exists and is fully tested
// (F-BM-1) so BOOKMARK-ADD-WIRE only wires the icon; it invents no new logic.

export type AddBookmarkResult =
	| { ok: true }
	| {
			ok: false;
			code: "unauthenticated" | "comment_not_found" | "self_bookmark_forbidden";
	  };

const commentIdSchema = z.string().uuid();

export async function addBookmarkAction(
	commentId: string,
): Promise<AddBookmarkResult> {
	// Auth gate (D-6): there is no anonymous bookmark set.
	const session = await auth.api.getSession({ headers: await headers() });
	const viewerId = session?.user?.id;
	if (!viewerId) {
		return { ok: false, code: "unauthenticated" };
	}

	// A non-UUID commentId can match no comment — and comparing it against a
	// `uuid` column would raise 22P02 (a 500), so validate before the query.
	const parsed = commentIdSchema.safeParse(commentId);
	if (!parsed.success) {
		return { ok: false, code: "comment_not_found" };
	}

	// Load the target comment's author to enforce the not-found + others-only
	// gates (plan §3.2). Read-only guard; `comments.user_id` is immutable.
	const target = await db.query.comments.findFirst({
		where: eq(comments.id, parsed.data),
		columns: { userId: true },
	});
	if (!target) {
		return { ok: false, code: "comment_not_found" };
	}

	// D-3 others-only: a bookmark is a pointer at SOMEONE ELSE's argument. A
	// self-bookmark is rejected at the write boundary (the /bookmarks surface
	// additionally hides the affordance on own content).
	if (target.userId === viewerId) {
		return { ok: false, code: "self_bookmark_forbidden" };
	}

	// Idempotent write: a comment is bookmarked at most once per user
	// (UNIQUE(user_id, comment_id) backstop). A double-tap is a no-op that
	// still returns ok — the client icon state stays consistent.
	await db
		.insert(bookmarks)
		.values({ userId: viewerId, commentId: parsed.data })
		.onConflictDoNothing({
			target: [bookmarks.userId, bookmarks.commentId],
		});

	return { ok: true };
}
