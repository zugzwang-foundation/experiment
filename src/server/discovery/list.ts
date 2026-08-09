import "server-only";

import { desc, eq } from "drizzle-orm";

import type { DbClient, DbTransaction } from "@/db";
import { markets } from "@/db/schema";
import { DISCOVERY_GRID_SIZE } from "@/server/config/limits";
import { getMarketPricingAndReserves } from "@/server/debate-view/market-pricing";
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
 * DISCOVERY-COMPLETE C8 (V13) — a card PLUS its pool reserves.
 *
 * ⚠ The reserves are deliberately a SIBLING of the card, never a field ON it.
 * `DiscoveryCard` is carried into `DiscoveryCarousel`, a `"use client"`
 * component, so anything on that type is serialized to the browser. Reserves
 * are a server-internal row value (AGENTS.md §6 — never expose an internal row
 * shape in a DTO), and they exist here only to be threaded into
 * `selectHeroTopPosts` inside the server component. Keeping them off the card
 * makes that structural rather than a rule someone has to remember.
 */
export type DiscoveryListing = {
	card: DiscoveryCard;
	reserves: { yes: string; no: string } | null;
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
): Promise<DiscoveryListing[]> {
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

	const listings: DiscoveryListing[] = [];
	for (const m of rows) {
		// C8: the SAME single pool read now also yields the raw reserves — one
		// more return field on one existing read, the shipped
		// `getMarketPricingAndUnitToWin` precedent. +0 round-trips.
		const priced = await getMarketPricingAndReserves(client, m.id);
		const totals = await getMarketTotals(client, m.id);
		const imageUrl = await getDefaultMarketMediaUrl(client, m.id);
		listings.push({
			card: {
				id: m.id,
				slug: m.slug,
				title: m.title,
				pricing: priced?.pricing ?? null,
				totals,
				imageUrl,
			},
			reserves: priced?.reserves ?? null,
		});
	}
	return listings;
}
