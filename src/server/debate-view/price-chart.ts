import "server-only";

import type { DbClient, DbTransaction } from "@/db";
import { MARKET_SERIES_MAX_POINTS } from "@/server/config/limits";
import { getPrices } from "@/server/cpmm/calculate";
import {
	type PricePoint,
	replayReserveSeries,
} from "@/server/discovery/price-series";

/** A bound read client — top-level `db` OR a caller's transaction. */
type PriceChartReader = DbClient | DbTransaction;

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
	const walk = await replayReserveSeries(client, marketId);
	if (walk.length === 0) {
		return [];
	}

	const full: PricePoint[] = walk.map((step) => ({
		at: step.at.toISOString(),
		yes: getPrices(step.reserves).yes,
	}));

	const series = downsample(full, MARKET_SERIES_MAX_POINTS);

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

/** Uniform-stride thinning to ≤ `max` points — a strict SUBSET (never
 * interpolated), first + last always kept, order preserved (the
 * `discovery/price-series.ts` downsample, re-implemented file-local per the A5
 * precedent — the index helper is never exported). */
function downsample(series: PricePoint[], max: number): PricePoint[] {
	if (series.length <= max) {
		return series;
	}
	const n = series.length;
	const out: PricePoint[] = [];
	for (let i = 0; i < max; i++) {
		out.push(series[Math.round((i * (n - 1)) / (max - 1))]);
	}
	return out;
}
