import "server-only";

import { cacheLife, cacheTag } from "next/cache";

import { db } from "@/db";
import {
	SHARED_VIEW_EXPIRE_SEC,
	SHARED_VIEW_MIN_WINDOW_MS,
} from "@/server/config/limits";
import { getCachedReserveWalk } from "@/server/discovery/cached-series";
import type { MarketSummary } from "@/server/markets/get-by-slug";
import { recordCacheMiss } from "@/server/observability/cache-metrics";

import { type DebateViewModel, loadDebateView } from "./load-debate-view";
import { coalesceDebateView } from "./shared-view-store";

/** `SHARED_VIEW_MIN_WINDOW_MS` in the seconds `cacheLife` speaks. Derived,
 * never a second literal — the `cached-series.ts` convention, so the tune
 * stays a one-line change at the constant. */
const WINDOW_SEC = SHARED_VIEW_MIN_WINDOW_MS / 1000;

/**
 * S-4 Phase D — the debate view's SHARED block, cached per market.
 *
 * ⛔ WHY THIS IS A SEPARATE FILE AND NOT A DIRECTIVE ON `loadDebateView`.
 * `loadDebateView` backs THREE surfaces: this page, the `.md` export route
 * (`m/[slug]/export/route.ts`) and the post-image route
 * (`m/[slug]/export/image/route.ts`). ADR-0025 forbids caching the `.md`
 * export — "a cache is a window in which just-removed content could keep
 * serving" — so a `'use cache'` placed on `loadDebateView` itself would
 * silently hand the export a cache it is contractually not allowed to have,
 * with no build error and no type error to catch it. The `.md` export keeps
 * calling `loadDebateView` DIRECTLY. `load-debate-view.ts` is not edited by
 * this task (it is also ADR-0034-guarded).
 *
 * ⛔⛔ KEYED ON `market` AND NOTHING ELSE — CHANGED AT CACHE-KEY-1 (ADR-0051),
 * AND THE PARAGRAPH THIS REPLACES IS THE WHOLE REASON THE CHANGE EXISTS.
 * It used to take `reserves` as a second argument. A `'use cache'` function's
 * key is its serialized argument list, so `reserves` in the key meant: every
 * bet moves the CPMM pool → the key changes → **a full miss for every reader of
 * that market**. The block worked on quiet markets and stopped working entirely
 * on the market everyone was betting on — invalidation coupled to ACTIVITY,
 * which SPEC.1 §9 *Refresh* names as performing worst exactly when load is
 * highest. `getCachedReserveWalk` below was already keyed on identity alone for
 * precisely this reason; this block is now its sibling in fact as well as in
 * position.
 *
 * What the key holds instead:
 *
 *   - `market` is a `MarketSummary` — six stable columns. It carries `status`,
 *     so a lifecycle transition (Open → Closed → Resolved) changes the key and
 *     auto-misses. No explicit invalidation is needed for state changes.
 *   - `cacheLife` supplies the clock. The window COALESCES: fifty bets in
 *     thirty seconds cost one derivation instead of fifty.
 *   - `cacheTag(\`market:${id}\`)` covers the one mutation that moves neither
 *     the pool nor the status: a moderator removing content. That tag string is
 *     already fired by `src/server/admin/moderation/act.ts`, so removal
 *     invalidation is wired end-to-end with no new code here.
 *
 * ⛔ WHY DROPPING `reserves` DOES NOT MAKE A PRICE STALE, which is the question
 * the old paragraph existed to answer and answered by cache-key reasoning.
 * `loadDebateView` still derives `pricing`/`unitToWin` from a pool read of its
 * own, and that read now rides this cache — but **no surface renders it**. Both
 * callers override both fields from their own live read after this returns
 * (`m/[slug]/page.tsx`, `m/[slug]/export/image/route.ts`), and `withLiveTail`
 * recomposes the chart's right edge from that same read. The guarantee is an
 * explicit assignment at each call site, not a property of a key — which is
 * what makes it survive the key's removal unchanged. ADR-0041 D-2/D-6 put those
 * overrides in place; ADR-0051 is what makes them load-bearing.
 *
 * ⛔ AND IT CLOSES ADR-0041 OQ-1 RATHER THAN INHERITING IT. That open question
 * was: key equality is STRICTLY WEAKER than "no bet has intervened", because a
 * fee-less CPMM lets a buy-then-sell-back restore the exact prior 18-dp pair, so
 * the key could match an entry predating two bets and the comments they minted.
 * With no `reserves` in the key there is no equality to be weaker than
 * anything — the window bounds staleness directly, for every cause at once.
 *
 * ⛔ NOTHING VIEWER-SCOPED MAY ENTER THIS FUNCTION. No session, no `headers()`,
 * no `cookies()`, no `loadViewerMarketContext`. Its output is shared verbatim
 * across every reader of this market, so a viewer-scoped input would leak one
 * participant's balance/position to the next. `loadDebateView` is itself
 * viewer-independent by construction (ADR-0034 keeps viewer state off
 * `DebateViewModel` precisely so masking stays correct), which is what makes
 * this wrapper safe. Asserted as a positive scan finding in
 * `tests/server/debate-view/cached-view-contract.test.ts`.
 *
 * ⚠ `/m/[slug]` DELIBERATELY BYPASSES THIS FUNCTION FOR A VIEWER WHO POSTED
 * INSIDE THE LAST WINDOW, and that is NOT a hole in the sentence above. The
 * page calls `loadDebateView` directly instead; nothing viewer-scoped crosses
 * INTO this function, because the choice of which function to call is made
 * outside it. See `viewer-freshness.ts` for why the bypass is needed at all —
 * short version: every comment rides a bet (INV-1), so the old `reserves` key
 * was making a poster's own comment appear as an accident of the CPMM, and
 * nothing else was.
 *
 * ⚠ NO `client` PARAMETER, unlike `loadDebateView` — a Drizzle client is not a
 * serializable cache key. Imports `db` directly, the same shape
 * `server/discovery/list.ts`'s cached readers take.
 */
export async function getCachedDebateView(
	market: MarketSummary,
): Promise<DebateViewModel> {
	"use cache";
	cacheLife({
		stale: WINDOW_SEC,
		revalidate: WINDOW_SEC,
		expire: SHARED_VIEW_EXPIRE_SEC,
	});
	cacheTag(`market:${market.id}`);

	// CHART-1 — the price chart's HISTORY, on its OWN key.
	//
	// ⚠ THE NESTING SURVIVES CACHE-KEY-1 AND IS NO LONGER LOAD-BEARING THE WAY
	// IT WAS. Before this block was fixed, it missed on every bet while
	// `getCachedReserveWalk` did not — so the nesting was what stopped the
	// three-statement reserve replay being re-derived once per bet per reader.
	// Both are windowed now, so the walk's separate key buys the smaller thing
	// it was always also buying: a LONGER window for history than for arguments
	// (`MARKET_SERIES_MIN_WINDOW_MS` is 60 s, this block's is 15 s), because a
	// picture of the past does not need re-drawing four times a minute.
	// Recorded rather than deleted: "the nesting is the point" was true when it
	// was written, and it is a weaker claim now.
	//
	// ⚠ On an `Open` market the chart's RIGHT EDGE is not floored with it: both
	// callers recompose the terminal point from their own live pool read
	// (`withLiveTail`), so the chart cannot disagree with the `PriceBar`
	// beneath it — the objection §9 raised against exactly this trade, answered
	// rather than waived.
	//
	// ⛔ On every OTHER state the right edge IS floored with the walk, because
	// `withLiveTail` returns a non-`Open` series untouched (CHART-1.A). That is
	// deliberate: a frozen market's chart is its event history, and restamping it
	// with a live price would put that price on a past event's timestamp
	// (**INV-4**).
	const walk = await getCachedReserveWalk(market.id);

	recordCacheMiss("debate-view", market.id);

	// CACHE-COALESCE-1 — the L1 miss above is PER INSTANCE. What follows makes
	// the render itself fleet-wide: one instance derives the block for this
	// window and the rest read its entry from Upstash. `debate-view-render`
	// therefore counts what the DATABASE paid, which `debate-view` misses never
	// did once there was more than one instance (load-test I-07/I-17/I-18).
	return coalesceDebateView({
		market,
		render: () => {
			recordCacheMiss("debate-view-render", market.id);
			return loadDebateView(db, { market, walk });
		},
	});
}
