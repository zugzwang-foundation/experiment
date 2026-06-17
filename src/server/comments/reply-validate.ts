import "server-only";

import { eq } from "drizzle-orm";

import type { DbClient, DbTransaction } from "@/db";
import { comments } from "@/db/schema";
import {
	ParentCommentNotFoundError,
	ReplyDepthExceededError,
} from "@/server/bets/errors";
import { REPLY_DEPTH_MAX } from "@/server/config/limits";

// DEBATE.2 — reply parent validation (plan §3 step 2). A reply IS a Support/
// Counter reply-bet (ADR-0017); this validates the parent linkage PRE-tx, before
// place() opens the W-1 write. Reads only the immutable append-only `comments`
// table; NO write.
//
//   - parent absent OR in a different market → ParentCommentNotFoundError (404)
//   - parent already at REPLY_DEPTH_MAX (its own parent_comment_id is non-null)
//     → ReplyDepthExceededError (400) — flat replies, REPLY_DEPTH_MAX = 1.
//
// Returns the validated parent's id + frozen side (the caller may thread the
// side into the read-time affordance; the write-path side is the REPLIER's, set
// in place()). Parent existence/market/depth are immutable (append-only +
// side-freeze), so the pre-tx read is race-free; the FK at commit is the backstop.

type Reader = DbClient | DbTransaction;

export interface ValidatedReplyParent {
	parentCommentId: string;
	sideAtPostTime: "YES" | "NO";
}

export async function validateReplyParent(
	client: Reader,
	args: { parentCommentId: string; marketId: string },
): Promise<ValidatedReplyParent> {
	const [parent] = await client
		.select({
			id: comments.id,
			marketId: comments.marketId,
			parentCommentId: comments.parentCommentId,
			sideAtPostTime: comments.sideAtPostTime,
		})
		.from(comments)
		.where(eq(comments.id, args.parentCommentId));

	// Absent OR cross-market → the same 404 (a uniform "not found" — the parent is
	// not a valid reply target in this market).
	if (parent === undefined || parent.marketId !== args.marketId) {
		throw new ParentCommentNotFoundError();
	}

	// Depth: a reply onto this parent would be at (parent depth + 1). The flat
	// model tracks depth via parent_comment_id only (0 = top-level, 1 = a reply).
	const parentDepth = parent.parentCommentId === null ? 0 : 1;
	if (parentDepth + 1 > REPLY_DEPTH_MAX) {
		throw new ReplyDepthExceededError();
	}

	return { parentCommentId: parent.id, sideAtPostTime: parent.sideAtPostTime };
}
