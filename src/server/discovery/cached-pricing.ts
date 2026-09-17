import "server-only";

import { cacheLife } from "next/cache";

import { db } from "@/db";
import {
	DISCOVERY_PRICE_EXPIRE_SEC,
	DISCOVERY_PRICE_MIN_WINDOW_MS,
} from "@/server/config/limits";
import { getMarketPricingAndReservesBatch } from "@/server/debate-view/market-pricing";

/** `DISCOVERY_PRICE_MIN_WINDOW_MS` in the seconds `cacheLife` speaks. Derived,
 * never a second literal — the `cached-series.ts` convention. */
const PRICE_WINDOW_SEC = DISCOVERY_PRICE_MIN_WINDOW_MS / 1000;

/** One market's pool-derived figures. Plain strings end to end — see below. */
export type DiscoveryPricingEntry = {
	pricing: { yes: string; no: string };
	reserves: { yes: string; no: string };
	unitToWin: { yes: string; no: string };
};

/**
 * Discovery's per-market pool read, behind a `DISCOVERY_PRICE_MIN_WINDOW_MS`
 * window (ADR-0055).
 *
 * ⛔ WHAT THIS CHANGES, because the line it replaced was load-bearing and
 * deliberate. `/` composed this read LIVE on every render, which is what kept
 * the whole surface out of the prerender: `getCachedDiscoveryMarketIds` and
 * `getCachedMarketDiscoveryData` were already cached, so this one uncached
 * await was the only reason Discovery re-rendered — and re-queried — for every
 * visitor. Measured on production at `d2af66cd`: two requests three seconds
 * apart differed in exactly forty characters, every one of them a render-clock
 * timestamp, with identical prices either side. The per-request database read
 * was buying a figure that had not moved, at the cost of a connection per
 * visitor on the surface that takes the most traffic.
 *
 * ⚠ IT IS A MONEY FIGURE BEHIND A WINDOW, AND ADR-0051 EXPRESSLY REFUSED THAT
 * — do not read this as an oversight of that ADR. Its rule was that "money on a
 * public surface may not lag a window", and the rule was right about money and
 * wrong about which surface carries the risk. `/m/[slug]`, where a bet is
 * actually placed, has been serving a PRERENDERED price all along (measured
 * thirteen hours old on production, corrected only by the client poll), so
 * Discovery — where nobody can bet — was paying a live read per visitor to be
 * stricter than the page that takes the money. ADR-0055 closes that asymmetry
 * in the direction that costs nothing a reader can perceive.
 *
 * ⛔ IT TAKES NO DATABASE CLIENT, AND THAT IS NOT A STYLE CHOICE. A
 * `'use cache'` function's key IS its argument list, so a `DbClient` parameter
 * would put a connection object into a cache key — unserialisable, and wrong
 * even if it serialised, because two callers' clients would mint two entries
 * for one answer. The uncached `getMarketPricingAndReservesBatch` keeps its
 * client parameter for `/m/[slug]`, which reads inside a transaction; this
 * wrapper binds the module-level `db` precisely because it must not.
 *
 * ⚠ RETURNS AN ARRAY OF PAIRS, NOT THE `Map` THE INNER READ RETURNS. The
 * caller rebuilds the `Map`. A cached value crosses a serialisation boundary,
 * and an array of `[string, {strings}]` pairs is the shape that is obviously
 * safe across one — where relying on `Map` support would make this module's
 * correctness a property of the framework's serialiser rather than of the data.
 * Every leaf is already a decimal STRING (never a `Decimal`, never a float),
 * which is what makes the whole entry safe to carry.
 *
 * ⚠ NO `cacheTag` — deliberate, and the asymmetry with its two cached siblings
 * is the point. A tag exists to be BUSTED, and the only event that moves a
 * price is a bet. Tagging this would mean firing `revalidateTag` from the bet
 * path, i.e. invalidating the entry on exactly the traffic that makes the cache
 * worth having — which is the defect CACHE-KEY-1 (ADR-0051) was written to end,
 * reintroduced one layer down. The window is the whole mechanism: it coalesces,
 * and it expires on its own.
 */
export async function getCachedDiscoveryPricing(
	marketIds: readonly string[],
): Promise<Array<[string, DiscoveryPricingEntry]>> {
	"use cache";
	cacheLife({
		stale: PRICE_WINDOW_SEC,
		revalidate: PRICE_WINDOW_SEC,
		expire: DISCOVERY_PRICE_EXPIRE_SEC,
	});

	return [...(await getMarketPricingAndReservesBatch(db, marketIds))];
}
