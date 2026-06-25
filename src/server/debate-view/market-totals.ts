import "server-only";

import { sql } from "drizzle-orm";

import type { DbClient, DbTransaction } from "@/db";

/** A bound read client — top-level `db` OR a caller's transaction. */
type DebateViewReader = DbClient | DbTransaction;

type TotalsRow = {
	dharma_staked: string;
	post_count: string;
	reply_count: string;
};

/**
 * The market-header attrs for the debate view (DEBATE.4 §5 / D1): total Dharma
 * staked (Σ `bets.stake` across the market), post count (comments with
 * `parent_comment_id IS NULL`), reply count (`parent_comment_id IS NOT NULL`).
 *
 * One round-trip: the Dharma sum is a correlated scalar subquery over `bets`
 * (served by `bets_market_id_idx`), the two counts are `FILTER`ed aggregates
 * over the market's comments (`comments_market_id_idx`). An aggregate SELECT
 * with no GROUP BY returns exactly one row even over an empty market, so the
 * empty case yields `{ "0", 0, 0 }` via `COALESCE(SUM, 0)`. Read-only.
 *
 * NUMERIC(38,18) crosses as a canonical decimal string (CLAUDE.md §2); the
 * `bigint` counts (driver-typed as strings) are normalized to integers.
 */
export async function getMarketTotals(
	client: DebateViewReader,
	marketId: string,
): Promise<{ dharmaStaked: string; postCount: number; replyCount: number }> {
	const rows = await client.execute<TotalsRow>(sql`
		SELECT
			(
				SELECT COALESCE(SUM(b.stake), 0)
				FROM bets b
				WHERE b.market_id = ${marketId}
			) AS dharma_staked,
			COUNT(*) FILTER (WHERE c.parent_comment_id IS NULL) AS post_count,
			COUNT(*) FILTER (WHERE c.parent_comment_id IS NOT NULL) AS reply_count
		FROM comments c
		WHERE c.market_id = ${marketId}
	`);

	const row = rows[0];
	return {
		dharmaStaked: row?.dharma_staked ?? "0",
		postCount: Number(row?.post_count ?? 0),
		replyCount: Number(row?.reply_count ?? 0),
	};
}
