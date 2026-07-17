import "server-only";

import { and, asc, eq, isNull } from "drizzle-orm";

import type { DbClient, DbTransaction } from "@/db";
import { comments } from "@/db/schema";

/**
 * UI.A2 §3.4 (ratified OQ-4) — the deep-link `?post=<N>` shape gate: a
 * 1-based ordinal, no leading zero, capped at 5 digits. Anything else is the
 * zero-branch (silent market-view fallback) — the resolver returns `null`
 * WITHOUT touching the client.
 */
const POST_PARAM_SHAPE = /^[1-9][0-9]{0,4}$/;

/**
 * Resolve a `?post=<N>` deep-link param to a comment id, or `null`.
 *
 * N is the market's 1-based **post ordinal**: rank by `(created_at, id)`
 * ascending over the market's TOP-LEVEL comments (`parent_comment_id IS
 * NULL`), removed posts INCLUDED in the domain — append-only ⇒ every post's
 * ordinal is permanent; a later removal never renumbers (the removed-target
 * fallback is the PAGE layer's job, not this resolver's). Replies are never
 * in the domain. ADR-0016 D6's "natural ordering" mechanism — no raw UUID
 * touches a participant URL.
 *
 * One ordered indexed read (`comments_market_created_idx`); returns ids
 * only — a pure read, no comment write, no side derivation (INV-3 read-only
 * posture). Out-of-range → `null`. This query order is mirrored by the
 * view model's `DebatePost.ordinal` (`load-debate-view.ts`) — the
 * round-trip integration test pins the two against each other.
 */
export async function resolvePostParam(
	client: DbClient | DbTransaction,
	args: { marketId: string; post: string },
): Promise<string | null> {
	if (!POST_PARAM_SHAPE.test(args.post)) {
		return null;
	}
	// A count (bounded ≤ 99999 by the shape gate), not Dharma — plain integer.
	const n = Number.parseInt(args.post, 10);
	const rows = await client
		.select({ id: comments.id })
		.from(comments)
		.where(
			and(
				eq(comments.marketId, args.marketId),
				isNull(comments.parentCommentId),
			),
		)
		.orderBy(asc(comments.createdAt), asc(comments.id))
		.offset(n - 1)
		.limit(1);
	return rows[0]?.id ?? null;
}
