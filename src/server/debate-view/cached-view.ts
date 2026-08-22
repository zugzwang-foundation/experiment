import "server-only";

import { cacheLife, cacheTag } from "next/cache";

import { db } from "@/db";
import type { Reserves } from "@/server/cpmm/calculate";
import type { MarketSummary } from "@/server/markets/get-by-slug";

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
 *     sell — moves the CPMM pool, which changes this key and forces a miss. So
 *     the debate view cannot serve a post that a just-placed bet should have
 *     changed, and the price bar's own figures cannot go stale.
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
 * return at hit time. (Disclosed at Phase C as a departure from R3's literal
 * "price is never cached" wording — never STALE, which is the property R3
 * protects, but not literally uncached. Awaiting the Gate C ruling; if that
 * ruling goes the other way, this file is where the fix lands.)
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

	// `reserves` is a KEY INPUT ONLY — deliberately not forwarded. Forwarding it
	// would change `loadDebateView`'s signature, which this task does not touch.
	void reserves;

	return loadDebateView(db, { market });
}
