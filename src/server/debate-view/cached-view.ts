import "server-only";

import { cacheLife, cacheTag } from "next/cache";

import { db } from "@/db";
import type { Reserves } from "@/server/cpmm/calculate";
import { getCachedReserveWalk } from "@/server/discovery/cached-series";
import type { MarketSummary } from "@/server/markets/get-by-slug";
import { recordCacheMiss } from "@/server/observability/cache-metrics";

import { type DebateViewModel, loadDebateView } from "./load-debate-view";

/**
 * S-4 Phase D — the debate view's SHARED block, cached per market.
 *
 * ⛔ WHY THIS IS A SEPARATE FILE AND NOT A DIRECTIVE ON `loadDebateView`.
 * `loadDebateView` backs TWO surfaces: this page and the `.md` export route
 * (`m/[slug]/export/route.ts`). ADR-0025 forbids caching the export — "a cache
 * is a window in which just-removed content could keep serving" — so a
 * `'use cache'` placed on `loadDebateView` itself would silently hand the
 * export a cache it is contractually not allowed to have, with no build error
 * and no type error to catch it. The export keeps calling `loadDebateView`
 * DIRECTLY; only this page goes through the wrapper. `load-debate-view.ts` is
 * not edited by this task (it is also ADR-0034-guarded).
 *
 * ⚠ KEYED ON `(market, reserves)` — the S-4 Phase C mechanism, reused. A
 * `'use cache'` function derives its key from its serialized arguments, so:
 *
 *   - `reserves` is fetched LIVE by the caller (`m/[slug]/page.tsx`, via
 *     `getMarketPricingAndReserves`) and passed in. Every bet — post, reply or
 *     sell — moves the CPMM pool, so a hit proves the live reserves are
 *     PROVABLY EQUAL TO A PREVIOUSLY OBSERVED VALUE: the one that generated
 *     the entry. The price bar's own figures therefore cannot go stale.
 *     ⚠ That is STRICTLY WEAKER than "no bet has intervened", and the
 *     difference is real here: the CPMM is fee-less, so a buy-then-sell-back
 *     of the same shares restores the exact prior 18-dp pair and the key
 *     matches an entry that predates both bets — which mint comments (INV-1)
 *     this entry does not carry. Priced fields stay correct (pure functions
 *     of the matched `reserves`); comments/ranking/totals can lag by one
 *     cache lifetime. Tracked as ADR-0041 OQ-1, open, not fixed here.
 *   - `market` carries `status`, so a lifecycle transition (Open → Closed →
 *     Resolved) changes the key and auto-misses. No explicit invalidation is
 *     needed for state changes.
 *   - `cacheTag(\`market:${id}\`)` covers the one mutation that moves NEITHER
 *     the pool nor the status: a moderator removing content. That tag string
 *     is already fired by `src/server/admin/moderation/act.ts` (S-4 Phase C),
 *     so removal invalidation is wired end-to-end with no new code here.
 *
 * `loadDebateView` internally re-reads pricing via `getMarketPricingAndUnitToWin`.
 * That read rides the cache — which is sound rather than sloppy, because
 * `pricing = getPrices(reserves)` and `unitToWin = deriveUnitToWin(reserves)`
 * are both PURE functions of `reserves`, and `reserves` is the cache key. The
 * cached values are therefore provably identical to what a live read would
 * return at hit time — a claim about PRICED fields only, and one that holds
 * under OQ-1 above precisely because it rests on purity, not on the pool
 * having stayed put. Ratified as R3 v2 in ADR-0041 D-2 — the priced figures
 * are never STALE, which is the property R3 protects, proven from the
 * compiled build and Next's own runtime source rather than asserted here.
 * This is compliance with R3 v2, not an exception to it. (`/m/[slug]/page.tsx` additionally overrides the
 * rendered `pricing`/`unitToWin` with its own live read of the same
 * `reserves` this cache is keyed on — ADR-0041 D-2/D-6 — so the page's own
 * guarantee does not rest on this file's internal computation at all; it is
 * kept here because the price chart's terminal stamp and other consumers of
 * `loadDebateView`'s return shape still need it.)
 *
 * ⛔ NOTHING VIEWER-SCOPED MAY ENTER THIS FUNCTION. No session, no `headers()`,
 * no `cookies()`, no `loadViewerMarketContext`. Its output is shared verbatim
 * across every reader of this market, so a viewer-scoped input would leak one
 * participant's balance/position/bookmarks to the next. `loadDebateView` is
 * itself viewer-independent by construction (ADR-0034 keeps viewer state off
 * `DebateViewModel` precisely so masking stays correct), which is what makes
 * this wrapper safe. Asserted as a positive scan finding in
 * `tests/server/debate-view/cached-view-contract.test.ts`.
 *
 * ⚠ NO `client` PARAMETER, unlike `loadDebateView` — a Drizzle client is not a
 * serializable cache key. Imports `db` directly, the same shape
 * `server/discovery/list.ts`'s cached readers take.
 */
export async function getCachedDebateView(
	market: MarketSummary,
	reserves: Reserves | null,
): Promise<DebateViewModel> {
	"use cache";
	cacheLife("minutes");
	cacheTag(`market:${market.id}`);

	// RELAY C2 — fires only on a miss, same reasoning as the two Discovery
	// cached blocks. This is the ADR-0041 OQ-1 / BR-7 surface — the one this
	// whole instrumentation pass exists to make visible under concurrent
	// write load, segmented against this market's own bet rate at analysis
	// time.
	await recordCacheMiss("debate-view", market.id);

	// `reserves` is a KEY INPUT ONLY — deliberately not forwarded. Forwarding it
	// would change `loadDebateView`'s pricing semantics, which CHART-1 does not
	// touch (the `walk` argument below is a separate, non-priced addition).
	void reserves;

	// CHART-1 — the price chart's HISTORY, on its OWN key.
	//
	// ⛔ THIS IS A NESTED CACHE, AND THE NESTING IS THE POINT. This block is
	// keyed on `(market, reserves)`, so every bet moves the pool, changes the
	// key, and forces a full miss. Before CHART-1 the three-statement reserve
	// replay was inside that miss, which meant the chart's history was re-derived
	// once per bet per reader — the "invalidation coupled to activity performs
	// worst when load is highest" failure SPEC.1 §9 *Refresh* names by hand.
	//
	// `getCachedReserveWalk` is keyed on the market id ALONE, which no bet
	// touches. So on a miss HERE, the walk can still HIT there, and fifty bets in
	// thirty seconds cost one derivation instead of fifty. That is the founder's
	// ruling made mechanical: the graph shows how the market MOVED, and a picture
	// of the past does not need re-drawing four times a minute.
	//
	// ⚠ On an `Open` market the chart's RIGHT EDGE is not floored with it:
	// `m/[slug]/page.tsx` recomposes the terminal point from its own live pool
	// read (`withLiveTail`), so the chart cannot disagree with the `PriceBar`
	// beneath it — the objection §9 raised against exactly this trade, answered
	// rather than waived.
	//
	// ⛔ On every OTHER state the right edge IS floored with the walk, because
	// `withLiveTail` returns a non-`Open` series untouched (CHART-1.A). That is
	// deliberate: a frozen market's chart is its event history, and restamping it
	// with a live price would put that price on a past event's timestamp
	// (**INV-4**).
	const walk = await getCachedReserveWalk(market.id);

	return loadDebateView(db, { market, walk });
}
