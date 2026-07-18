import "server-only";

import { desc, eq } from "drizzle-orm";

import type { DbClient, DbTransaction } from "@/db";
import { markets } from "@/db/schema";
import { DISCOVERY_GRID_SIZE } from "@/server/config/limits";
import { getMarketPricing } from "@/server/debate-view/market-pricing";
import { getMarketTotals } from "@/server/debate-view/market-totals";

import { getDefaultMarketMediaUrl } from "./media";

/** A bound read client — top-level `db` OR a caller's transaction. */
type DiscoveryReader = DbClient | DbTransaction;

/**
 * The Discovery card DTO (SPEC.1 §22 F-DISC-1 / design-language §3.2 locked
 * composition) — mapped in the server layer, never a raw drizzle row
 * (AGENTS.md §6). `pricing` is the pool-derived spot via the single CPMM
 * `getPrices` authority (null defensive — no pool row); `totals` the
 * `Đ staked · posts · replies` stat line; `imageUrl` the presigned GET for
 * the market's `is_default` `market_media` row (null defensive). The price
 * sparkline series rides `loadPriceSeries` (Slice 2), composed at the page.
 */
export type DiscoveryCard = {
	id: string;
	slug: string;
	title: string;
	pricing: { yes: string; no: string } | null;
	totals: { dharmaStaked: string; postCount: number; replyCount: number };
	imageUrl: string | null;
};

/**
 * The Discovery featured-set read model (SPEC.1 §22 SCL-4/SCL-5): all Open
 * markets ordered `created_at` DESCENDING — newest-first, deliberately
 * capital-neutral (recency, never stake/volume; ADR-0017 Driver 2 applied to
 * the entry surface) — capped at `DISCOVERY_GRID_SIZE`. Served by
 * `markets_status_idx` + a bounded sort (no new index — §22 is doc-only).
 *
 * Per-market composition is sequential — the client may be a
 * single-connection transaction; the volume is bounded at ≤ 8 markets
 * (grouped-query batching is the OQ-1 C follow-up's optimization). Read-only.
 */
export async function listOpenMarkets(
	client: DiscoveryReader,
): Promise<DiscoveryCard[]> {
	const rows = await client
		.select({
			id: markets.id,
			slug: markets.slug,
			title: markets.title,
		})
		.from(markets)
		.where(eq(markets.status, "Open"))
		.orderBy(desc(markets.createdAt))
		.limit(DISCOVERY_GRID_SIZE);

	const cards: DiscoveryCard[] = [];
	for (const m of rows) {
		const pricing = await getMarketPricing(client, m.id);
		const totals = await getMarketTotals(client, m.id);
		const imageUrl = await getDefaultMarketMediaUrl(client, m.id);
		cards.push({
			id: m.id,
			slug: m.slug,
			title: m.title,
			pricing,
			totals,
			imageUrl,
		});
	}
	return cards;
}
