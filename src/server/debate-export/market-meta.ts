import "server-only";

import { desc, eq, sql } from "drizzle-orm";

import type { DbClient, DbTransaction } from "@/db";
import { markets, resolutionEvents } from "@/db/schema";

/** A bound read client — top-level `db` OR a caller's transaction. */
type Reader = DbClient | DbTransaction;

/**
 * Export-only, market-scoped metadata the debate-view read-model does not surface
 * (EXPORT.1 gap-fills; ADR-0025 §7 / debate-export.md §11). Identity-free — it
 * reads no `users` rows and emits no pseudonyms — so it carries NO masking concern
 * (the masking lives entirely in `loadDebateView`, inherited, never here).
 */
export type ExportMarketMeta = {
	/** `markets.resolution_outcome` — `null` unless resolved/voided. */
	outcome: string | null;
	/** `markets.resolved_at` as ISO-8601 — `null` unless resolved/voided. */
	resolvedAt: string | null;
	/** Chain-tip `resolution_events.reason` (final state only, no correction
	 * history) — `null` unless resolved/voided. */
	resolutionReason: string | null;
	/**
	 * `COUNT(DISTINCT user_id)` over the market's bets. A moderator-removed node's
	 * masked author STILL counts (removal hides voice, not balance — §10.5), so
	 * this is a raw `bets` aggregate, NEVER derived from the masked view-model.
	 */
	participants: number;
	/**
	 * `SUM(stake)` over the market's bets, canonical NUMERIC(38,18) decimal string.
	 * A removed node's stake STILL counts (§10.5) — raw `bets` aggregate, NEVER a
	 * sum of the masked nodes (which omit the removed node's stake).
	 */
	totalStakeDharma: string;
};

type AggRow = { participants: string; total_stake: string };

/**
 * Load the export-only market metadata: the resolution final-state (projected
 * `markets` columns + the chain-tip `resolution_events.reason`) and the raw
 * `bets` aggregates. Both aggregates are computed over the market's bets directly
 * — never summed from the masked nodes — so a removed node's stake AND author
 * count toward the document totals while being withheld on the node itself
 * (debate-export.md §10.5). Read-only.
 */
export async function loadExportMarketMeta(
	client: Reader,
	marketId: string,
): Promise<ExportMarketMeta> {
	const marketRows = await client
		.select({
			outcome: markets.resolutionOutcome,
			resolvedAt: markets.resolvedAt,
		})
		.from(markets)
		.where(eq(markets.id, marketId))
		.limit(1);
	const market = marketRows[0];

	// Chain-tip resolution reason — the latest resolution event (UUIDv7 id breaks a
	// same-instant tie). Final state only; an unresolved market has none → null.
	const reasonRows = await client
		.select({ reason: resolutionEvents.reason })
		.from(resolutionEvents)
		.where(eq(resolutionEvents.marketId, marketId))
		.orderBy(desc(resolutionEvents.createdAt), desc(resolutionEvents.id))
		.limit(1);

	// Raw market-scoped aggregates over bets — both INCLUDE removed-node rows
	// (§10.5). `COALESCE(SUM, 0)` keeps a no-bet market well-defined.
	const aggRows = await client.execute<AggRow>(sql`
		SELECT
			COUNT(DISTINCT user_id) AS participants,
			COALESCE(SUM(stake), 0) AS total_stake
		FROM bets
		WHERE market_id = ${marketId}
	`);
	const agg = aggRows[0];

	return {
		outcome: market?.outcome ?? null,
		resolvedAt: market?.resolvedAt?.toISOString() ?? null,
		resolutionReason: reasonRows[0]?.reason ?? null,
		participants: Number(agg?.participants ?? 0),
		totalStakeDharma: agg?.total_stake ?? "0",
	};
}
