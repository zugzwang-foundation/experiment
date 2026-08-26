import "server-only";

import type { DbClient, DbTransaction } from "@/db";
import { type PostSubstrate, type Side, topOrder } from "@/lib/ranking";
import { MARKET_SERIES_MAX_POINTS } from "@/server/config/limits";
import { getPrices, type Reserves } from "@/server/cpmm/calculate";
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
	const walk = toWireWalk(await replayReserveSeries(client, marketId));
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
): Promise<{ series: PricePoint[]; nodes: ChartNode[] }> {
	const walk =
		args.walk ?? toWireWalk(await replayReserveSeries(client, args.marketId));
	if (walk.length === 0) {
		return { series: [], nodes: [] };
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
	const series = buildSeries(
		walk,
		args.walk === undefined ? args.spotYes : null,
	);
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
 *
 * ⚠ THAT LAST GUARANTEE WEAKENS WHEN THE WALK IS INJECTED, and saying so is the
 * point of this paragraph. `postSubstrate` is read fresh on every miss; an
 * injected `walk` is floored to `MARKET_SERIES_MIN_WINDOW_MS`. A post created
 * inside that window is therefore in the substrate and NOT in the walk, so
 * `reservesAt` returns the last step BEFORE its bet and the node is drawn at the
 * price that preceded it. Expanded mode only, bounded by the window, and it
 * self-corrects on the next revalidation — but it is a real divergence from the
 * sentence above rather than a hypothetical. Not clamped here on purpose:
 * dropping such a post from node eligibility would hide a real argument to
 * protect a pixel. Raised by `@code-reviewer` at the CHART-1 cascade.
 */
export function selectChartNodes(
	substrate: PostSubstrate[],
	removedSet: Set<string>,
	walk: WireReservePoint[],
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
function reservesAt(walk: WireReservePoint[], at: Date): Reserves {
	const t = at.getTime();
	let chosen = walk[0].reserves;
	for (const step of walk) {
		if (Date.parse(step.at) <= t) {
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
