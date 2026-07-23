import "server-only";

import type { DbClient, DbTransaction } from "@/db";
import { type PostSubstrate, type Side, topOrder } from "@/lib/ranking";
import { MARKET_SERIES_MAX_POINTS } from "@/server/config/limits";
import { getPrices, type Reserves } from "@/server/cpmm/calculate";
import {
	type PricePoint,
	type ReservePoint,
	replayReserveSeries,
} from "@/server/discovery/price-series";

/** A bound read client — top-level `db` OR a caller's transaction. */
type PriceChartReader = DbClient | DbTransaction;

/**
 * One expanded-mode post node (SPEC.1 1.0.22 §9 "Post nodes" / F-DEBATE-5): the
 * single top post per `(UTC day, side)` bucket, marked against the price line.
 * `side` is the post's frozen `side_at_post_time` (**INV-3**) — never re-sided by
 * a later flip. `yYes` is the YES price at the post's own bet vertex (decision a),
 * an 18-dp decimal string (CLAUDE.md §2 — never a JS float). `at` is the post's
 * `created_at` ISO instant.
 */
export type ChartNode = { id: string; side: Side; at: string; yYes: string };

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
	return buildSeries(walk, spotYes);
}

/**
 * The full market-detail chart model (SPEC.1 §9 / F-DEBATE-5, slice 2): the
 * series + the expanded post nodes, derived over ONE shared `replayReserveSeries`
 * walk (decision #2 — no second reserve read). Node selection reuses the
 * ALREADY-loaded `postSubstrate` + `removedSet` from `loadDebateView` (the single
 * audited masking primitive). Read-only.
 */
export async function deriveMarketPriceChart(
	client: PriceChartReader,
	args: {
		marketId: string;
		postSubstrate: PostSubstrate[];
		removedSet: Set<string>;
		spotYes: string | null;
	},
): Promise<{ series: PricePoint[]; nodes: ChartNode[] }> {
	const walk = await replayReserveSeries(client, args.marketId);
	if (walk.length === 0) {
		return { series: [], nodes: [] };
	}
	const series = buildSeries(walk, args.spotYes);
	const nodes = selectChartNodes(args.postSubstrate, args.removedSet, walk);
	return { series, nodes };
}

/**
 * The per-`(UTC day, side)` top post nodes (SPEC.1 §9 "Post nodes" / F-DEBATE-5).
 * PURE. **No second ranking rule** (F-DEBATE-5): the pure §9 `topOrder` is walked
 * IN RANK ORDER and partitioned by `(utcDay(createdAt), parentSide)`; the FIRST
 * eligible post per bucket wins — the selector never re-sorts. Eligibility is the
 * `content_removed` MASK: a post whose id is in `removedSet` is skipped (it never
 * claims its bucket), so the next-ranked post takes the slot or the slot stays
 * empty — mirrors §22 F-DISC-2, ADR-0021. `removedSet` is the ALREADY-loaded set
 * from `loadDebateView` (`mod_actions.reason = 'content_removed'` only — never a
 * user ban). Node `side` is the frozen `parentSide` (**INV-3**); node `yYes` is
 * the YES price at the post's own bet vertex — `reservesAt` picks the LAST walk
 * step at or before the post's `createdAt`, NEVER interpolating (price is a step
 * function). Per decision (a) a post's `created_at` is ≥ its own `bet.placed`
 * event, so that step is the post's own bet. Nodes are sorted `(at asc, id asc)`.
 */
export function selectChartNodes(
	substrate: PostSubstrate[],
	removedSet: Set<string>,
	walk: ReservePoint[],
): ChartNode[] {
	if (walk.length === 0) {
		return [];
	}
	const ordered = topOrder(substrate);
	const takenBuckets = new Set<string>();
	const nodes: ChartNode[] = [];
	for (const post of ordered) {
		if (removedSet.has(post.id)) {
			continue; // masking — a removed post never claims its bucket
		}
		const bucket = `${post.createdAt.toISOString().slice(0, 10)}|${post.parentSide}`;
		if (takenBuckets.has(bucket)) {
			continue; // take-first over Top order — a partition, not a re-rank
		}
		takenBuckets.add(bucket);
		nodes.push({
			id: post.id,
			side: post.parentSide,
			at: post.createdAt.toISOString(),
			yYes: getPrices(reservesAt(walk, post.createdAt)).yes,
		});
	}
	nodes.sort((a, b) =>
		a.at < b.at ? -1 : a.at > b.at ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
	);
	return nodes;
}

/**
 * The reserves in effect at `at` — the LAST walk step whose `at` is ≤ the target
 * (the step function's value; never interpolated). The walk is `created_at`-ASC,
 * so this is the state after the most recent event at or before `at`; `walk[0]`
 * (the `market.opened` seed) is the floor for the unreachable before-all case.
 */
function reservesAt(walk: ReservePoint[], at: Date): Reserves {
	const t = at.getTime();
	let chosen = walk[0].reserves;
	for (const step of walk) {
		if (step.at.getTime() <= t) {
			chosen = step.reserves;
		}
	}
	return chosen;
}

/**
 * Map the shared reserve walk to the downsampled YES-price series, stamping the
 * retained terminal with `spotYes` (decision #6). Pure; shared by
 * `loadMarketPriceSeries` and `deriveMarketPriceChart` so both agree by
 * construction.
 */
function buildSeries(
	walk: ReservePoint[],
	spotYes: string | null,
): PricePoint[] {
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
