import "server-only";

import type { DbClient, DbTransaction } from "@/db";
import { MARKET_SERIES_MAX_POINTS } from "@/server/config/limits";
import {
	mapWalkToSeries,
	type PricePoint,
	replayReserveSeries,
	toWireWalk,
	type WireReservePoint,
} from "@/server/discovery/price-series";

/** A bound read client — top-level `db` OR a caller's transaction. */
type PriceChartReader = DbClient | DbTransaction;

/**
 * ⛔ `ChartNode`, `selectChartNodes` AND `reservesAt` STOOD HERE AND ARE REMOVED AT
 * CHART-NODE-REMOVE (founder ruling): the expanded-mode post nodes come off every
 * surface. What they were: the single top post per `(UTC day, side)` bucket, drawn
 * as an `r=4` circle with a `--color-ground` rim at the YES price of its own bet
 * vertex, side-bound by its frozen `side_at_post_time`.
 *
 * ⚠ THE SELECTOR IS DELETED, NOT LEFT UNCALLED, and that is the point of the
 * removal. A render-layer delete would have left `topOrder` walking the whole
 * substrate and `getPrices` running once per bucket on every market-detail read —
 * dead compute wearing a fix's clothes.
 *
 * ⚠ WHAT DID **NOT** FOLLOW IT DOWN, because the chain stops there: `postSubstrate`
 * and `removedSet` are still loaded by `loadDebateView` for the Top list, the
 * badges and the comment-body masking, so this removal buys no read back. The
 * saving is CPU inside an already-paid read, not a round trip.
 */

/**
 * The market-detail price series (SPEC.1 1.0.22 §9 / F-DEBATE-5) — a read-time
 * reserve replay, no stored series (the §22 posture reused unamended). The
 * shared §22 `replayReserveSeries` (OQ-2 B) walks `bet.placed` / `bet.sold`
 * from the `market.opened` seed; each step maps to the pool's YES spot price
 * (`getPrices().yes`), then the walk is thinned to `MARKET_SERIES_MAX_POINTS`
 * (256) by uniform stride (first + last retained). This is Discovery's
 * `replayReserveSeries` consumed ADDITIVELY — `loadPriceSeries` and its 64-point
 * `DISCOVERY_SERIES_MAX_POINTS` cap are untouched.
 *
 * The retained TERMINAL point is stamped with `spotYes` — the same `pricing.yes`
 * the `PriceBar` renders (decision #6): one quantity, one source, so the chart
 * point directly beneath the bar can never disagree with it (§10.8 discipline).
 * Interior / history points remain the pure replay (their only source). A
 * defensive `spotYes == null` (unreachable for an opened, non-Draft market)
 * leaves the replay-final terminal. Returns `[]` only on the unreachable
 * no-`market.opened` case (an empty walk). Read-only.
 */
export async function loadMarketPriceSeries(
	client: PriceChartReader,
	marketId: string,
	spotYes: string | null,
): Promise<PricePoint[]> {
	const walk = toWireWalk(await replayReserveSeries(client, marketId));
	if (walk.length === 0) {
		return [];
	}
	return buildSeries(walk, spotYes);
}

/**
 * The market-detail chart model (SPEC.1 §9 / F-DEBATE-5) — the price series,
 * derived over ONE `replayReserveSeries` walk. Read-only.
 *
 * ⚠ IT STILL RETURNS AN OBJECT RATHER THAN A BARE ARRAY, and that is deliberate
 * restraint rather than an oversight. `{ series }` is what every consumer already
 * destructures, and flattening it to `PricePoint[]` would touch four more files to
 * save one pair of braces — while making a null-vs-empty distinction that
 * `MarketHeader` depends on harder to see, not easier.
 *
 * ⛔ IT USED TO RETURN `{ series, nodes }`. The nodes are removed at
 * CHART-NODE-REMOVE by founder ruling; `postSubstrate` and `removedSet` were
 * arguments only for them and are gone with them. **They are still LOADED by
 * `loadDebateView`** — the Top list, the badges and the comment masking all read
 * them — so this function stopped asking for them without any read stopping.
 */
export async function deriveMarketPriceChart(
	client: PriceChartReader,
	args: {
		marketId: string;
		spotYes: string | null;
		/**
		 * An ALREADY-DERIVED reserve walk, supplied by the caller (CHART-1). When
		 * present the replay is skipped entirely — this is how the market-detail
		 * page pays for the walk once per `MARKET_SERIES_MIN_WINDOW_MS` instead of
		 * once per cache miss (`getCachedReserveWalk`).
		 *
		 * ⛔ IT IS A PARAMETER, NEVER FETCHED HERE, AND THAT IS DELIBERATE — the
		 * same shape `getCachedMarketDiscoveryData` uses for `reserves`. Reaching
		 * for the cached walk inside this function would put a cache boundary
		 * underneath `loadDebateView`, which the `.md` export route also calls and
		 * which ADR-0025 forbids caching. Leaving the choice with the caller keeps
		 * the export uncached by construction rather than by anyone remembering.
		 *
		 * Omitted ⇒ the live replay, byte-for-byte the prior behaviour. The export
		 * route omits it.
		 */
		walk?: WireReservePoint[];
	},
): Promise<{ series: PricePoint[] }> {
	const walk =
		args.walk ?? toWireWalk(await replayReserveSeries(client, args.marketId));
	if (walk.length === 0) {
		return { series: [] };
	}
	// ⛔ THE TERMINAL STAMP IS ONLY LEGITIMATE ON A FRESHLY REPLAYED WALK, AND
	// THIS ARGUMENT IS WHY. Decision #6 stamps the series' last point with the
	// live pool price so the chart cannot disagree with `PriceBar`. That was
	// exact while the walk was always replayed inside the same read that fetched
	// `spotYes`: the walk's last step WAS the event that produced that price, so
	// the stamp changed nothing and only guaranteed agreement.
	//
	// With an INJECTED walk (CHART-1) the two come from different instants. On a
	// cache miss caused by a bet, the walk can still HIT its own key and arrive
	// without that bet, while `spotYes` is read live and carries it. Stamping
	// then writes the NEW price onto the PREVIOUS event's timestamp — drawing the
	// market as having moved three days ago and sat flat since, if that is when
	// the previous bet was. ⚠ The error is in X, and it is NOT bounded by the
	// window: it is the gap to the preceding event, which is unbounded on a quiet
	// market. A price at the wrong time is a false statement about the market,
	// not a stale one.
	//
	// So the injected path leaves the replay's own terminal alone and lets
	// `withLiveTail` compose the edge at the page — which appends `(now, spot)`
	// as a NEW point rather than moving an old one, and is the mechanism that
	// exists for exactly this. The uninjected path (the `.md` export) keeps
	// decision #6 byte-for-byte.
	//
	// Found by `@code-reviewer` at the CHART-1 cascade. Invisible to the whole
	// suite: `'use cache'` THROWS under a bare `vitest run`, so no test can put a
	// stale walk beside a fresh spot.
	return {
		series: buildSeries(walk, args.walk === undefined ? args.spotYes : null),
	};
}

/**
 * Map the shared reserve walk to the downsampled YES-price series, stamping the
 * retained terminal with `spotYes` (decision #6). Pure; shared by
 * `loadMarketPriceSeries` and `deriveMarketPriceChart` so both agree by
 * construction.
 */
function buildSeries(
	walk: WireReservePoint[],
	spotYes: string | null,
): PricePoint[] {
	const series = mapWalkToSeries(walk, MARKET_SERIES_MAX_POINTS);

	// Stamp the terminal with the shared PriceBar spot (decision #6) — the point
	// beneath the bar agrees with it by construction, not by monitoring.
	if (spotYes !== null) {
		series[series.length - 1] = {
			...series[series.length - 1],
			yes: spotYes,
		};
	}

	return series;
}
