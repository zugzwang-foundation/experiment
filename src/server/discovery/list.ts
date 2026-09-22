import "server-only";

import { desc, eq } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import type { DbClient, DbTransaction } from "@/db";
import { db } from "@/db";
import { markets } from "@/db/schema";
import { coalesceSharedBlock } from "@/server/cache/shared-block-store";
import {
	DISCOVERY_GRID_SIZE,
	DISCOVERY_SERIES_MAX_POINTS,
	SHARED_VIEW_EXPIRE_SEC,
	SHARED_VIEW_MIN_WINDOW_MS,
} from "@/server/config/limits";
import { getMarketPricingAndReserves } from "@/server/debate-view/market-pricing";
import { getMarketTotals } from "@/server/debate-view/market-totals";
import { recordCacheMiss } from "@/server/observability/cache-metrics";

import { getCachedReserveWalk } from "./cached-series";
import {
	type HeroPostShares,
	type HeroTopPostsBase,
	selectHeroTopPosts,
} from "./hero";
import { getDefaultMarketMediaUrl } from "./media";
import { mapWalkToSeries, type PricePoint } from "./price-series";

/** `SHARED_VIEW_MIN_WINDOW_MS` in the seconds `cacheLife` speaks. Derived,
 * never a second literal — the `cached-series.ts` convention. */
const SHARED_VIEW_WINDOW_SEC = SHARED_VIEW_MIN_WINDOW_MS / 1000;

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

	const rows = await db
		.select({ id: markets.id, slug: markets.slug, title: markets.title })
		.from(markets)
		.where(eq(markets.status, "Open"))
		.orderBy(desc(markets.createdAt))
		.limit(DISCOVERY_GRID_SIZE);
	recordCacheMiss("discovery-list", null);
	return rows;
}

/** One market's cached Discovery data — everything the pack calls "shared"
 * (totals, media, chart geometry, hero posts) EXCEPT price. */
export type CachedMarketDiscoveryData = {
	totals: { dharmaStaked: string; postCount: number; replyCount: number };
	imageUrl: string | null;
	series: PricePoint[];
	/** ⚠ `Base` — WITHOUT `currentValue`, which the page composes from its own
	 * live reserve read (`hero-value.ts`). See `HeroPost.currentValue`. */
	topPosts: HeroTopPostsBase;
	/**
	 * CACHE-KEY-1 — the per-side share count `currentValue` is computed from.
	 *
	 * ⚠ A SERVER-LOCAL SIBLING OF `topPosts`, NEVER A FIELD ON A HERO POST —
	 * the same shape `DiscoveryListing` uses for `reserves` above, and for the
	 * same reason: a hero post crosses into `DiscoveryCarousel` (`"use client"`),
	 * and a raw `lots`/`positions` share quantity is an internal row value that
	 * must not serialize into the RSC payload (AGENTS.md §6). It travels from
	 * here to `valueHeroPosts` inside the server component and is discarded.
	 */
	heroShares: HeroPostShares;
};

/**
 * S-4 Phase C — one market's cached Discovery block, KEYED ON `marketId` ALONE
 * with a `SHARED_VIEW_MIN_WINDOW_MS` window (CACHE-KEY-1, ADR-0051).
 *
 * ⛔⛔ IT WAS KEYED ON `reserves`, AND THAT IS WHAT THIS CHANGE UNDID. The old
 * argument was sound and defended the wrong mechanism: a `'use cache'` key is
 * its serialized argument list, so a hit proved the live reserves equalled the
 * ones that generated the entry, which made `currentValue` provably non-stale
 * by purity. The cost of buying that guarantee was that **every bet changed the
 * key**, so every bet forced a full miss for every reader — the block helped
 * least exactly when the market was busiest, which is the failure SPEC.1 §9
 * *Refresh* names. `getCachedReserveWalk` was already keyed on identity alone
 * for this reason; this block now matches it.
 *
 * ⛔ WHAT REPLACES THE PURITY ARGUMENT, because something had to. `currentValue`
 * no longer ships from here at all: this returns `HeroTopPostsBase` (the field
 * omitted) plus `heroShares`, and `(public)/page.tsx` composes the figure with
 * `valueHeroPosts` against the live batched pool read it already performs. R3's
 * real property — a rendered Đ figure is never computed from stale reserves —
 * is therefore held by WHERE the arithmetic happens rather than by what the key
 * proves. Everything still inside the window (totals, media, series membership,
 * top-post order) is content or a count, and lagging by one window is what a
 * window is for.
 *
 * ⛔ AND ADR-0041 OQ-1 IS CLOSED RATHER THAN INHERITED. That open question was
 * that key equality is STRICTLY WEAKER than "unchanged since the last write" —
 * on a fee-less CPMM a buy-then-sell-back restores the exact prior 18-dp pair,
 * so the key could match an entry predating two bets and the comments they
 * minted (INV-1). With no `reserves` in the key there is no equality to be
 * weaker than anything; the window bounds staleness directly, for every cause
 * at once.
 *
 * ⚠ MUST NOT read `reserves` internally BY ANY ROUTE — still true, and now for
 * a different reason. It used to be that an internal read would let a stale
 * value hide behind a fresh-looking key. Now it would be worse: a pool read
 * inside this window would be CACHED, and any figure derived from it would be
 * exactly the stale money the split above exists to prevent. Pinned by
 * `tests/server/discovery/round-trip-budget.test.ts`.
 *
 * `selectHeroTopPosts`'s selection, masking and statement count are unchanged —
 * only the one pure arithmetic step left it (see `hero-value.ts`).
 */
export async function getCachedMarketDiscoveryData(
	marketId: string,
): Promise<CachedMarketDiscoveryData> {
	"use cache";
	cacheLife({
		stale: SHARED_VIEW_WINDOW_SEC,
		revalidate: SHARED_VIEW_WINDOW_SEC,
		expire: SHARED_VIEW_EXPIRE_SEC,
	});
	// ⚠ NO `cacheTag("discovery")` HERE, DELIBERATELY — and the asymmetry with
	// `getCachedDiscoveryMarketIds` above is the point. `revalidateTag("discovery")`
	// fires on market open / close / void (`markets/open.ts`, `markets/close.ts`,
	// `admin/markets/void.ts`), all of which change WHICH markets the listing
	// carries — that is the listing's business and the listing block above is
	// tagged for it. None of them changes ANOTHER market's totals, media, series
	// or top posts, which is all this block holds. Carrying the tag here meant one
	// admin opening one market evicted every market's cached block site-wide.
	// A market whose own lifecycle moved simply leaves the listing, so its entry
	// here goes unread and expires on its own — there is no staleness to bust.
	cacheTag(`market:${marketId}`);

	// CACHE-COALESCE-2 (ADR-0051 P2) — the `'use cache'` above is the
	// per-instance L1; the derivation below is a FLEET-WIDE single-flight.
	// R-16 measured 1,674 of these in a three-minute burst, each one totals +
	// media + the hero ranking against Postgres, once per instance per window.
	// `market-data` misses keep counting the L1 miss; `market-data-render`
	// counts what the database paid. The hero carries argument text, so a
	// moderation removal marks this block too (`markMarketTextRemoved`).
	// `waitMs: 0`: the home page reads this block for eight markets in series,
	// so a cold loser renders locally rather than stalling the whole page.
	recordCacheMiss("market-data", marketId);
	return coalesceSharedBlock<CachedMarketDiscoveryData>({
		block: "market-data",
		marketId,
		windowMs: SHARED_VIEW_MIN_WINDOW_MS,
		expireMs: SHARED_VIEW_EXPIRE_SEC * 1000,
		waitMs: 0,
		render: () => deriveMarketDiscoveryData(marketId),
	});
}

/** The uncached derivation — everything `getCachedMarketDiscoveryData` holds. */
async function deriveMarketDiscoveryData(
	marketId: string,
): Promise<CachedMarketDiscoveryData> {
	const totals = await getMarketTotals(db, marketId);
	const imageUrl = await getDefaultMarketMediaUrl(db, marketId);

	// CHART-1 — the hero's series rides `getCachedReserveWalk`, keyed on the
	// market id ALONE, instead of `loadPriceSeries`, which replayed inside this
	// block. ⚠ THE ASYMMETRY THAT MADE THAT URGENT IS GONE AS OF CACHE-KEY-1:
	// this block used to miss on every bet while that one did not. Both are
	// windowed now, so the separate key buys the smaller thing it was also always
	// buying — a LONGER window for history (`MARKET_SERIES_MIN_WINDOW_MS`, 60 s)
	// than for the block around it (15 s), because a picture of the past does not
	// need re-drawing four times a minute (SPEC.1 1.0.45 §9 *Refresh*). The
	// hero's own cap is unchanged.
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
	const hero = await selectHeroTopPosts(db, marketId);

	recordCacheMiss("market-data-render", marketId);
	return {
		totals,
		imageUrl,
		series,
		topPosts: hero.posts,
		heroShares: hero.shares,
	};
}
