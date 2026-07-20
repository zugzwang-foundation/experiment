"use server";

import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { z } from "zod";

import { db } from "@/db";
import { bookmarks } from "@/db/schema";
import { auth } from "@/server/auth";

// ADR-0032 D-2 — the "remove bookmark" Server Action, and the /bookmarks
// in-page un-bookmark handler (plan §3.3). Single DELETE, idempotent: removing
// an absent bookmark is a successful no-op (D-2). Un-bookmark is a legitimate
// Bucket-C DELETE (no append-only trigger). The surface owns optimistic
// removal + router.refresh() (Slice 4); this action is a pure DB op so it stays
// unit-testable without a next/cache mock.

export type RemoveBookmarkResult =
	| { ok: true }
	| { ok: false; code: "unauthenticated" };

const commentIdSchema = z.string().uuid();

export async function removeBookmarkAction(
	commentId: string,
): Promise<RemoveBookmarkResult> {
	// Auth gate (D-6): the DELETE is always scoped to the session user, so a
	// viewer can only ever remove their OWN bookmark row.
	const session = await auth.api.getSession({ headers: await headers() });
	const viewerId = session?.user?.id;
	if (!viewerId) {
		return { ok: false, code: "unauthenticated" };
	}

	// A malformed id can match no row (and would raise 22P02 against a `uuid`
	// column). Absent → successful no-op, so an invalid id is also just ok.
	const parsed = commentIdSchema.safeParse(commentId);
	if (!parsed.success) {
		return { ok: true };
	}

	await db
		.delete(bookmarks)
		.where(
			and(eq(bookmarks.userId, viewerId), eq(bookmarks.commentId, parsed.data)),
		);

	return { ok: true };
}
