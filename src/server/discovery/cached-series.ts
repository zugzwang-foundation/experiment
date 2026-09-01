import "server-only";

import { cacheLife, cacheTag } from "next/cache";

import { db } from "@/db";
import { MARKET_SERIES_MIN_WINDOW_MS } from "@/server/config/limits";

import {
	replayReserveSeries,
	toWireWalk,
	type WireReservePoint,
} from "./price-series";

/** `MARKET_SERIES_MIN_WINDOW_MS` in the seconds `cacheLife` speaks. Derived,
 * never a second literal — SPEC.1 §16.1 requires the window be read from the
 * constant at every call site so the HARDEN.6 tune stays a one-line change. */
const WINDOW_SEC = MARKET_SERIES_MIN_WINDOW_MS / 1000;

/** The window's outer bound: an entry may be SERVED stale for at most this long
 * while a revalidation is in flight. Sixty windows — the same 3600 s the
 * framework's own `"minutes"` profile uses, expressed as a multiple of the
 * design constant rather than pinned separately, so moving the window moves this
 * with it and the `revalidate <= expire` ordering can never invert. */
const EXPIRE_SEC = WINDOW_SEC * 60;

/**
 * The market's CPMM reserve walk, derived at most once per
 * `MARKET_SERIES_MIN_WINDOW_MS` (SPEC.1 1.0.45 §9 *Refresh — floored history,
 * live edge*; founder-ruled at CHART-1).
 *
 * ⛔ **KEYED ON `marketId` AND NOTHING ELSE, AND THAT IS THE WHOLE MECHANISM.**
 * A `'use cache'` function's key is its serialized arguments. The two blocks
 * that already wrap these surfaces — `getCachedDebateView` and
 * `getCachedMarketDiscoveryData` — key on `reserves`, which every bet moves, so
 * every bet forces a full miss for every reader. That is the failure mode
 * SPEC.1 §9 *Refresh* names: invalidation coupled to activity performs WORST
 * exactly when load is highest. Keying on market identity alone is what lets the
 * window COALESCE — fifty bets in thirty seconds cost one derivation instead of
 * fifty — and it is why this read is a sibling of those blocks rather than a
 * line inside one of them.
 *
 * ⛔ **NOTHING VIEWER-SCOPED CAN ENTER HERE, BY CONSTRUCTION RATHER THAN BY
 * DISCIPLINE.** The function takes one parameter and it is a market id. There is
 * no session, no `headers()`, no `cookies()`, no viewer context, and no
 * parameter one could be smuggled through — which is a stronger guarantee than
 * `cached-view.ts` can make, since that one takes a whole `market` object. The
 * output is shared verbatim across every reader of this market and contains only
 * pool reserves and event timestamps: public, market-scoped facts (ADR-0034
 * D-1). Pinned by `tests/server/discovery/cached-series-contract.test.ts`.
 *
 * ⚠ **NO CLOCK READ INSIDE THIS FUNCTION, EVER.** A `Date.now()` here would be
 * frozen at derivation time and then served for a whole window, so an `Open`
 * market's "now" edge would silently be up to a minute in the past — the exact
 * defect §9's live-terminal clause exists to prevent. The domain's live end and
 * the terminal's live price are BOTH composed outside this boundary, by
 * `withLiveTail`, at the two pages that already read the pool live for
 * `PriceBar`. That is not an optimisation; it is the reason the window can be
 * longer than the poll interval at all.
 *
 * ⚠ **THIS IS A CACHE, NOT A STORE.** SPEC.1 §9 rules that a materialised or
 * persisted series is a spec change rather than an implementation choice, and
 * names the cached-per-load read as the sanctioned mitigation. Nothing here
 * writes a row, a column, an event or a key: the entry is derived on read,
 * invalidated by tag, and reconstructible from `events` alone.
 *
 * `cacheTag(\`market:${id}\`)` is the invalidation seam, already fired by
 * `admin/moderation/act.ts`. ⚠ Content removal does not change a price walk, so
 * that tag over-invalidates — deliberately. Over-invalidating costs one wasted
 * derivation on a rare admin action; under-invalidating would serve a wrong
 * chart, and there is no third tag that separates the two cases without
 * inventing an invalidation nobody fires.
 *
 * ⚠ **BETS DELIBERATELY FIRE NO TAG AND MUST NOT START.** `bets/place.ts` and
 * `bets/sell.ts` call neither `revalidateTag` nor `updateTag` (verified at
 * CHART-1). If a future change adds one on the bet path, this window stops
 * coalescing and silently reverts to per-bet recomputation — the chart would
 * still be correct, and the entire cost argument would be gone with no test
 * going red. Read that as a constraint on the bet path, not a fragility here.
 *
 * ⛔ `marketId` MUST BE A DATABASE-RESOLVED ID, NEVER A REQUEST PARAMETER, and
 * nothing but this sentence says so. Both call sites resolve it first —
 * `getMarketBySlug` (which `notFound()`s an unknown slug) and
 * `getCachedDiscoveryMarketIds` (which reads the `markets` table) — so the key
 * space is bounded by the market count today. It is bounded by CONVENTION, not
 * by the signature: the parameter is a `string`, and a future Route Handler that
 * took an id off the request and passed it straight in — `m/[slug]/quote/route.ts`
 * is already that shape — would hand an unauthenticated caller the ability to
 * write arbitrarily many entries into the shared cache handler and evict the real
 * ones. Raised by `@security-auditor` at the CHART-1 cascade.
 *
 * ⚠ TAGGED `market:${id}` BUT NOT `discovery`, unlike both of its callers. That
 * is correct today and was traced rather than assumed: every lifecycle
 * transition that fires `revalidateTag("discovery")` — open, close, void —
 * leaves this walk's inputs untouched, because `openMarket` is the only writer
 * of `market.opened` and no bet can land on a non-`Open` market (the W-1
 * transaction rejects buys and sells alike). It stops being correct the day a
 * lifecycle transition moves the pool, which is not hypothetical: `pool_unwind`
 * exists in `dharma_entry_type` and is documented dormant in v1. If it ever
 * wakes, this function needs the `discovery` tag too.
 *
 * Returns `[]` for a market with no `market.opened` event. Read-only.
 */
export async function getCachedReserveWalk(
	marketId: string,
): Promise<WireReservePoint[]> {
	"use cache";
	cacheLife({
		stale: WINDOW_SEC,
		revalidate: WINDOW_SEC,
		expire: EXPIRE_SEC,
	});
	cacheTag(`market:${marketId}`);

	return toWireWalk(await replayReserveSeries(db, marketId));
}
