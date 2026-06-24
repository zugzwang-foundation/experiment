import "server-only";

import { sql } from "drizzle-orm";

import type { DbClient, DbTransaction } from "@/db";
import type { ReplySubstrate } from "@/lib/ranking";

/** A bound read client — top-level `db` OR a caller's transaction. */
type DebateViewReader = DbClient | DbTransaction;

/**
 * The raw shape `db.execute<T>` yields. The postgres-js driver parses
 * `timestamptz` → string|Date and `numeric` → string; the DTO mapping below
 * normalizes them to `ReplySubstrate`.
 */
type ReplyRow = {
	id: string;
	parent_comment_id: string;
	side: "YES" | "NO";
	created_at: string | Date;
	stake: string;
};

/**
 * Load the depth-1 reply substrate for a market's debate view (DEBATE.4 §5a /
 * RANKING.md §7) — every reply's own frozen side and its reply-bet stake,
 * grouped by parent post. Feeds the pure `rankReplies` / `twoSlot` model: per
 * post, `rankReplies(map.get(postId) ?? [], post.parentSide)`.
 *
 * ONE set-based query for the whole market (no N+1): each reply (a comment with
 * `parent_comment_id IS NOT NULL`) reaches its stake through a `JOIN LATERAL …
 * LIMIT 1` over the **circular pair `bets.comment_id = rc.id`** — NEVER
 * `comments.bet_id`, which is deliberately NULL (SPEC.2 §14.1). The LATERAL
 * (earliest by `created_at`, `id`) mirrors `loadRankingSubstrate`'s author-bet
 * guard so a reply that ever carried more than one bet cannot fan out; under
 * INV-1 there is exactly one reply-bet per reply. Per-parent grouping is served
 * by `comments_ranking_idx (parent_comment_id, side_at_post_time)`; the stake
 * reach by `bets_comment_id_idx`.
 *
 * Read-only; reads only. A post with no replies is simply ABSENT from the
 * returned Map — the consumer falls back to `[]` via `?? []` (an empty
 * `inArray`-style degenerate is avoided structurally).
 */
export async function loadReplySubstrate(
	client: DebateViewReader,
	args: { marketId: string },
): Promise<Map<string, ReplySubstrate[]>> {
	const rows = await client.execute<ReplyRow>(sql`
		SELECT
			rc.id,
			rc.parent_comment_id,
			rc.side_at_post_time AS side,
			rc.created_at,
			rb.stake
		FROM comments rc
		JOIN LATERAL (
			SELECT b.stake
			FROM bets b
			WHERE b.comment_id = rc.id
			ORDER BY b.created_at ASC, b.id ASC
			LIMIT 1
		) rb ON true
		WHERE rc.market_id = ${args.marketId}
			AND rc.parent_comment_id IS NOT NULL
		ORDER BY rc.created_at ASC, rc.id ASC
	`);

	const byParent = new Map<string, ReplySubstrate[]>();
	for (const r of rows) {
		const reply: ReplySubstrate = {
			id: r.id,
			side: r.side,
			stake: r.stake,
			// `new Date()` is robust whether the driver returned a Date or a wire
			// string (timestamptz decode varies by execute path — accrual.ts note).
			createdAt: new Date(r.created_at),
		};
		const bucket = byParent.get(r.parent_comment_id);
		if (bucket) {
			bucket.push(reply);
		} else {
			byParent.set(r.parent_comment_id, [reply]);
		}
	}
	return byParent;
}
