import "server-only";

import { sql } from "drizzle-orm";

import type { DbClient, DbTransaction } from "@/db";
import type { PostSubstrate } from "@/lib/ranking";

/** A bound read client — top-level `db` OR a caller's transaction. */
type DebateViewReader = DbClient | DbTransaction;

/**
 * The raw shape `db.execute<T>` yields for the substrate query. The postgres-js
 * driver parses `timestamptz` → `Date`, `numeric` → string, and `bigint`
 * (`COUNT`) → string; the DTO mapping below normalizes them to `PostSubstrate`.
 */
type SubstrateRow = {
	id: string;
	parent_side: "YES" | "NO";
	created_at: string | Date;
	author_stake: string;
	price_at_bet: string;
	support_count: string;
	counter_count: string;
	support_dharma: string;
	counter_dharma: string;
};

/**
 * Compute the per-post ranking substrate for a market's debate view — the four
 * per-side reply-bet aggregates (RANKING.md §2 / SPEC.2 §5.4) plus each post's
 * own entry-bet stake and `created_at` — feeding the pure `ranking.ts` model.
 *
 * Read-time-computed, no projection table, no cached score column (RANKING.md
 * §11.1 / ADR-0005 §4). The four aggregates derive entirely from existing
 * columns: counts/sums over a post's reply-bets, reached via the **circular pair
 * `bets.comment_id = comments.id`** — NEVER `comments.bet_id`, which is
 * deliberately NULL (SPEC.2 §14.1). Per-side grouping on
 * `(parent_comment_id, side_at_post_time)` is served by `comments_ranking_idx`;
 * the Dharma sums reach each reply-bet's stake through `bets_comment_id_idx`.
 *
 * Per ADR-0008 the hot-path lane aggregation is a typed `sql<T>` template
 * (cleaner than the builder for a self-join + per-side conditional sums); it maps
 * to the `PostSubstrate` DTO, never exposing Drizzle/driver row types.
 *
 * **Support vs Counter is resolved at read time**: a reply-bet is *Support* when
 * its `side_at_post_time` equals the parent post's, *Counter* otherwise — there
 * is no friendly-fire vote, no stored Support/Counter tally. **Author stake `a`**
 * is the post's own entry bet (the bet the post rides). It is read through a
 * `JOIN LATERAL … LIMIT 1` (earliest by `created_at`, `id`) rather than a plain
 * join, so the author side cannot fan out the per-side reply aggregates even if a
 * comment ever carried more than one bet — the 1:1 comment↔bet relationship is the
 * single-write-path (`place.ts`) reality, NOT a unique constraint on
 * `bets.comment_id`. (The reply aggregation counts reply-bets directly — exactly
 * one per reply under INV-1.)
 *
 * **Frozen-by-construction at resolution (INV-4):** every input is append-only
 * (`bets` / `comments` are Bucket A) and new reply-bets require `market.state =
 * Open`, so a resolved market's substrate — and the order/badges computed from
 * it — is stable forever. No `now` parameter is needed: the v1 outputs (Top +
 * interleave + badge + reply + profile) rank on current lane values and
 * `created_at`, not on a time-decayed age (gravity is deferred — RANKING.md §3.5
 * / OD-3).
 */
export async function loadRankingSubstrate(
	client: DebateViewReader,
	args: { marketId: string },
): Promise<PostSubstrate[]> {
	const rows = await client.execute<SubstrateRow>(sql`
		SELECT
			p.id,
			p.side_at_post_time AS parent_side,
			p.created_at,
			pb.stake AS author_stake,
			pb.price_at_bet AS price_at_bet,
			COUNT(rb.id) FILTER (
				WHERE rc.side_at_post_time = p.side_at_post_time
			) AS support_count,
			COUNT(rb.id) FILTER (
				WHERE rc.side_at_post_time <> p.side_at_post_time
			) AS counter_count,
			COALESCE(SUM(rb.stake) FILTER (
				WHERE rc.side_at_post_time = p.side_at_post_time
			), 0) AS support_dharma,
			COALESCE(SUM(rb.stake) FILTER (
				WHERE rc.side_at_post_time <> p.side_at_post_time
			), 0) AS counter_dharma
		FROM comments p
		JOIN LATERAL (
			SELECT b.stake, b.price_at_bet
			FROM bets b
			WHERE b.comment_id = p.id
			ORDER BY b.created_at ASC, b.id ASC
			LIMIT 1
		) pb ON true
		LEFT JOIN comments rc ON rc.parent_comment_id = p.id
		LEFT JOIN bets rb ON rb.comment_id = rc.id
		WHERE p.market_id = ${args.marketId}
			AND p.parent_comment_id IS NULL
		GROUP BY p.id, p.side_at_post_time, p.created_at, pb.stake, pb.price_at_bet
		ORDER BY p.created_at ASC, p.id ASC
	`);

	return rows.map((r) => ({
		id: r.id,
		parentSide: r.parent_side,
		supportCount: Number(r.support_count),
		counterCount: Number(r.counter_count),
		supportDharma: r.support_dharma,
		counterDharma: r.counter_dharma,
		// `new Date()` is robust whether the driver returned a Date or a wire
		// string (timestamptz decode varies by execute path — accrual.ts note).
		createdAt: new Date(r.created_at),
		authorStake: r.author_stake,
		priceAtBet: r.price_at_bet,
	}));
}
