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
	author_stake_original: string;
	author_sold: boolean;
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
 * one per reply under INV-1.) That LATERAL now also reaches the bet's **lot**, so
 * `a` is the author's SURVIVING basis rather than the frozen stake (ADR-0039 R4
 * as amended at RANK-1, RANKING.md §3.4/§8) — the `lots` join is 1:1
 * (`lots_bet_id_uq`), so it adds a lookup and cannot add a row.
 *
 * **Frozen at resolution — but by market state, NOT by append-only-ness.** Every
 * `bets` / `comments` input is Bucket A, and new reply-bets require
 * `market.state = Open`; but since LOTS-1 the stake inputs read
 * `lots.surviving_basis`, and `lots` is **Bucket C, mutable** (ADR-0039 D-1). So
 * the substrate is stable after resolution because a resolved market accepts no
 * further bets or sells — there is nothing left to move a lot — and not because
 * the rows themselves cannot change. **INV-4 is untouched either way**: it
 * governs `resolution_events` / `payout_events`, which no lot path writes.
 * ⚠ This paragraph claimed "every input is append-only" until RANK-1; that
 * stopped being true when the aggregates took the `lots` join, and a stale
 * invariant claim is worse than none. No `now` parameter is needed: the v1 outputs (Top +
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
			-- RANK-1 / ADR-0039 R4 (amended) — a is the author's conviction STILL
			-- HELD, so the §3.4 tiebreak (which decides topOrder outright in any
			-- all-sub-floor market) cannot be bought and then refunded. The frozen
			-- figure rides alongside for the badge's strikethrough; it is not sorted on.
			pb.stake AS author_stake,
			pb.original_stake AS author_stake_original,
			pb.sold AS author_sold,
			pb.price_at_bet AS price_at_bet,
			COUNT(rb.id) FILTER (
				WHERE rc.side_at_post_time = p.side_at_post_time
			) AS support_count,
			COUNT(rb.id) FILTER (
				WHERE rc.side_at_post_time <> p.side_at_post_time
			) AS counter_count,
			-- LOTS-1 / ADR-0039 R4+R5 — the attracted-value aggregates key off SURVIVING
			-- LOT BASIS, not the frozen bets.stake. A replier who sells their lot
			-- down withdraws the weight they lent the parent, which is what R5 names.
			-- The historical figure is not lost: bets.stake is Bucket-A immutable and
			-- still readable; it simply stops being what this aggregate reports.
			--
			-- ⚠ COALESCE FALLS BACK TO THE FROZEN STAKE when a reply-bet has no lot.
			-- Unreachable under R8 (every bet mints a lot), but the alternative on an
			-- unreachable row is to silently score a real contribution as ZERO — the
			-- same class of error as letting missing bookkeeping veto a sell (S5). An
			-- unknown surviving amount is better read as "all of it survives", which
			-- is exactly the pre-LOTS-1 behaviour.
			COALESCE(SUM(COALESCE(rl.surviving_basis, rb.stake)) FILTER (
				WHERE rc.side_at_post_time = p.side_at_post_time
			), 0) AS support_dharma,
			COALESCE(SUM(COALESCE(rl.surviving_basis, rb.stake)) FILTER (
				WHERE rc.side_at_post_time <> p.side_at_post_time
			), 0) AS counter_dharma
		FROM comments p
		JOIN LATERAL (
			SELECT
				-- The COALESCE is the same one the aggregates above use, for the same
				-- reason: a lot-less bet is unreachable under R8, and if it ever did
				-- arise, scoring it ZERO would silently delete a real argument's weight.
				COALESCE(pl.surviving_basis, b.stake) AS stake,
				b.stake AS original_stake,
				-- R6/R10 — Sold is EXACTLY zero surviving shares, never "nearly". A bet
				-- with no lot row is not Sold: = 0 yields NULL there, and the COALESCE
				-- reads that as false rather than as a fully-exited argument.
				COALESCE(pl.surviving_shares = 0, false) AS sold,
				b.price_at_bet
			FROM bets b
			-- 1:1 by lots_bet_id_uq, so this is an index lookup that cannot fan the
			-- LATERAL's single row out.
			LEFT JOIN lots pl ON pl.bet_id = b.id
			WHERE b.comment_id = p.id
			ORDER BY b.created_at ASC, b.id ASC
			LIMIT 1
		) pb ON true
		LEFT JOIN comments rc ON rc.parent_comment_id = p.id
		LEFT JOIN bets rb ON rb.comment_id = rc.id
		LEFT JOIN lots rl ON rl.bet_id = rb.id
		WHERE p.market_id = ${args.marketId}
			AND p.parent_comment_id IS NULL
		GROUP BY p.id, p.side_at_post_time, p.created_at,
			pb.stake, pb.original_stake, pb.sold, pb.price_at_bet
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
		authorStakeOriginal: r.author_stake_original,
		authorSold: r.author_sold,
		priceAtBet: r.price_at_bet,
	}));
}
