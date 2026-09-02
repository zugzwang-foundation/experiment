import "server-only";

import { desc, eq } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import type { DbClient, DbTransaction } from "@/db";
import { db } from "@/db";
import { markets } from "@/db/schema";
import {
	DISCOVERY_GRID_SIZE,
	DISCOVERY_SERIES_MAX_POINTS,
} from "@/server/config/limits";
import type { Reserves } from "@/server/cpmm/calculate";
import { getMarketPricingAndReserves } from "@/server/debate-view/market-pricing";
import { getMarketTotals } from "@/server/debate-view/market-totals";
import { recordCacheMiss } from "@/server/observability/cache-metrics";

import { getCachedReserveWalk } from "./cached-series";
import { type HeroTopPosts, selectHeroTopPosts } from "./hero";
import { getDefaultMarketMediaUrl } from "./media";
import { mapWalkToSeries, type PricePoint } from "./price-series";

/** A bound read client — top-level `db` OR a caller's transaction. */
type DiscoveryReader = DbClient | DbTransaction;

/**
 * The Discovery card DTO (SPEC.1 §22 F-DISC-1 / design-language §3.2 locked
 * composition) — mapped in the server layer, never a raw drizzle row
 * (AGENTS.md §6). `pricing` is the pool-derived spot via the single CPMM
 * `getPrices` authority (null defensive — no pool row); `totals` the
 * `Đ staked · posts · replies` stat line; `imageUrl` the presigned GET for
 * the market's `is_default` `market_media` row (null defensive). The price
 * series rides `getCachedReserveWalk` → `mapWalkToSeries` (CHART-1), composed at
 * the page, where `withLiveTail` also pins its live right edge. ⚠ It rode
 * `loadPriceSeries` until CHART-1 and it is not a "sparkline" any more — the
 * hero renders the same time-scaled component `/m/[slug]` does.
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

/**
 * S-4 Phase C — the Discovery market-id set, cached. `listOpenMarkets` above is
 * UNCHANGED and untouched (its own `list.test.ts` suite is unverifiable in this
 * environment — no local Postgres); this is a NEW, additive read for the live
 * page composition, covering only the `markets` SELECT `listOpenMarkets` also
 * does — no pricing, no totals, no media. Cached: the Open-markets SET doesn't
 * need per-viewer freshness (a just-opened market appearing a few minutes late
 * is not a correctness issue), busts on `openMarket`/`closeMarket` via
 * `revalidateTag("discovery", ...)`.
 *
 * ⚠ NO `client` PARAMETER, unlike every other reader in this file — a `'use
 * cache'` function's key is its serialized arguments, and a Drizzle client
 * isn't a meaningful cache key input. Imports `db` directly instead; this is
 * inherent to how Cache Components works, not a departure from this file's DI
 * convention someone should "fix" back.
 */
export type DiscoveryMarketId = { id: string; slug: string; title: string };

export async function getCachedDiscoveryMarketIds(): Promise<
	DiscoveryMarketId[]
> {
	"use cache";
	cacheLife("minutes");
	cacheTag("discovery");

	// RELAY C2 — fires only on a miss (this line is unreachable on a hit,
	// since a hit never executes this function body at all).
	await recordCacheMiss("discovery-list", null);

	return db
		.select({ id: markets.id, slug: markets.slug, title: markets.title })
		.from(markets)
		.where(eq(markets.status, "Open"))
		.orderBy(desc(markets.createdAt))
		.limit(DISCOVERY_GRID_SIZE);
}

/** One market's cached Discovery data — everything the pack calls "shared"
 * (totals, media, chart geometry, hero posts) EXCEPT price. */
export type CachedMarketDiscoveryData = {
	totals: { dharmaStaked: string; postCount: number; replyCount: number };
	imageUrl: string | null;
	series: PricePoint[];
	topPosts: HeroTopPosts;
};

/**
 * S-4 Phase C — one market's cached Discovery block, KEYED ON `reserves`.
 *
 * The caller (`DiscoveryContent`, `(public)/page.tsx`) fetches `reserves` LIVE
 * via `getMarketPricingAndReserves` every render, then passes it in here. Since
 * the cache key IS that exact value, a hit can only occur when reserves are
 * PROVABLY EQUAL TO A PREVIOUSLY OBSERVED VALUE — the one that generated the
 * entry — because a bet moving the pool changes the key and forces a miss.
 * This is why `selectHeroTopPosts`'s `currentValue` (the Đb execution-value
 * figure, `computeSell(reserves, ...)`) is safe to let ride this cache even
 * though R3 (CLAUDE.md-adjacent S-4 pack decision) says price/reserves are
 * "never cached": `currentValue` is a pure function of the reserves that
 * matched, so it is never STALE, which is the property R3 actually protects —
 * not literal cache-boundary avoidance.
 *
 * ⚠ Key equality is STRICTLY WEAKER than "unchanged since the last write",
 * and on a fee-less CPMM the gap is reachable: a buy-then-sell-back of the
 * same shares restores the exact prior 18-dp reserve pair, so the key matches
 * an entry generated before either bet. `currentValue` and price stay correct
 * (purity, above); `totals` and `topPosts`'s membership/order can lag by one
 * cache lifetime, since every bet rides a comment (INV-1). ADR-0041 OQ-1 —
 * OPEN, two candidate fixes named there, not fixed here.
 * Flagged explicitly for a Gate C ruling on whether this satisfies R3's intent
 * (see the Phase C plan / session log).
 *
 * ⚠ MUST NOT call `getMarketPricingAndReserves` (or read `reserves` any other
 * way) internally — that would defeat the whole mechanism by letting a stale
 * reserves value hide behind a fresh-looking cache key the caller didn't
 * actually observe. `reserves` is a parameter for exactly this reason, never
 * fetched here.
 *
 * `selectHeroTopPosts`'s call here is BYTE-IDENTICAL to how `listOpenMarkets`
 * already calls it — no signature change, no behavior change to that
 * safety-critical (masking) function, whose own test suite is unverifiable in
 * this environment.
 */
export async function getCachedMarketDiscoveryData(
	marketId: string,
	reserves: Reserves | null,
): Promise<CachedMarketDiscoveryData> {
	"use cache";
	cacheLife("minutes");
	cacheTag("discovery");
	cacheTag(`market:${marketId}`);

	// RELAY C2 — fires only on a miss, same reasoning as
	// getCachedDiscoveryMarketIds above.
	await recordCacheMiss("market-data", marketId);

	const totals = await getMarketTotals(db, marketId);
	const imageUrl = await getDefaultMarketMediaUrl(db, marketId);

	// CHART-1 — the hero's series now rides `getCachedReserveWalk`, keyed on the
	// market id ALONE, instead of `loadPriceSeries`, which replayed inside this
	// reserves-keyed block. This block misses on every bet; that one does not, so
	// the walk is derived once per `MARKET_SERIES_MIN_WINDOW_MS` however busy the
	// market gets (SPEC.1 1.0.45 §9 *Refresh*). The hero's own cap is unchanged.
	//
	// ⚠ THE F-1 DRIFT WARN IS DELIBERATELY GONE FROM THIS PATH, AND IT IS A
	// SUPERSESSION RATHER THAN AN OVERSIGHT. `loadPriceSeries` spends a fourth
	// statement reading the live `pools` row and WARNs `discovery_price_series_drift`
	// when the replay's final reserves disagree with it. Under a floored history
	// that comparison is no longer diagnostic: a walk up to a minute old
	// LEGITIMATELY differs from a pool that has moved since, so the check would
	// fire by design and train its own reader to ignore it. What it was
	// protecting — the chart's right edge agreeing with the price bar — is now
	// guaranteed by construction instead of by monitoring, because
	// `withLiveTail` composes that edge from the live read at the page. The
	// ⛔ AND THE INSTRUMENT DOES NOT SURVIVE IN PRODUCTION — this sentence used
	// to claim it did, "on `loadPriceSeries` for any uncached caller", which
	// was false the moment it was written: this was `loadPriceSeries`'s LAST
	// production call site, and it now has none. Caught by `@test-writer` at
	// the CHART-1 audit. The function and its suite are retained rather than
	// deleted — the drift comparison it carries is the only place in the repo
	// that checks the event replay against the live pool, and that check is
	// exactly what would surface an events↔pools divergence. Whether to re-site
	// it or drop it is a Gate C question, flagged rather than decided here.
	// ⛔ AND THE HUMAN TELL WENT WITH IT, WHICH IS THE HALF THIS COMMENT MISSED.
	// `@security-auditor` observed that `withLiveTail` now composes the terminal
	// from the live pool price on BOTH surfaces — so an events↔`pools`
	// divergence no longer shows up as the chart disagreeing with the bar
	// either. The automated detector and the visual one were removed by the same
	// commit, on the money surface, and that coincidence is the finding rather
	// than either removal alone. A pool that moved without a matching event is
	// exactly the shape a CPMM accounting bug takes. ⇒ RE-SITING THIS CHECK IS
	// OWED, and it belongs somewhere that runs against production — beside the
	// `position_drift` cron, or as a staging gate — never back on the render
	// path, where a floored history guarantees it fires by design and trains its
	// reader to ignore it.
	const series = mapWalkToSeries(
		await getCachedReserveWalk(marketId),
		DISCOVERY_SERIES_MAX_POINTS,
	);
	const topPosts = await selectHeroTopPosts(db, marketId, reserves);

	return { totals, imageUrl, series, topPosts };
}
