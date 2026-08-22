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
	original_stake: string;
	sold: boolean;
	price_at_bet: string;
};

/**
 * Load the depth-1 reply substrate for a market's debate view (DEBATE.4 §5a /
 * RANKING.md §7) — every reply's own frozen side and its reply-bet basis,
 * grouped by parent post. Feeds the pure `rankReplies` / `twoSlot` model: per
 * post, `rankReplies(map.get(postId) ?? [], post.parentSide)`.
 *
 * ⚠ **This is the loader the two-slot debate view ranks on, and it is the site
 * the free rank-capture ran through.** Until RANK-1 it selected the frozen
 * `bets.stake`, so a large reply-bet bought the top Support or Counter slot and
 * an exit returned the money while the slot stayed bought — the CPMM is
 * fee-less, so the capture cost dust and repeated on every post in every market.
 * It now selects `COALESCE(lots.surviving_basis, bets.stake)` (ADR-0039 R4 as
 * amended). ⚠ It is a FOURTH read site: ADR-0039 D-5 originally listed three
 * (`ranking-substrate.ts`, `profile/arguments.ts`, `bookmarks/list.ts`), which
 * is right for the *attracted aggregates* and wrong for the *reply ruler* — this
 * file carries the ruler for the debate view and had no `lots` join at all.
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
			-- RANK-1 / ADR-0039 R4 (amended) — the reply LANE sorts on this, so it is
			-- the SURVIVING basis. The frozen figure rides alongside for the badge's
			-- struck-through original; nothing sorts on it.
			rb.stake,
			rb.original_stake,
			rb.sold,
			rb.price_at_bet
		FROM comments rc
		JOIN LATERAL (
			SELECT
				COALESCE(rl.surviving_basis, b.stake) AS stake,
				b.stake AS original_stake,
				-- R6/R10 — exactly zero, never "nearly"; a lot-less bet is not Sold.
				COALESCE(rl.surviving_shares = 0, false) AS sold,
				b.price_at_bet
			FROM bets b
			-- 1:1 by lots_bet_id_uq — an index lookup inside a LIMIT 1 LATERAL.
			LEFT JOIN lots rl ON rl.bet_id = b.id
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
			stakeOriginal: r.original_stake,
			sold: r.sold,
			priceAtBet: r.price_at_bet,
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
