import "server-only";

import { and, asc, eq, inArray, or } from "drizzle-orm";

import type { DbClient, DbTransaction } from "@/db";
import { bets, events, pools } from "@/db/schema";
import { DISCOVERY_SERIES_MAX_POINTS } from "@/server/config/limits";
import {
	computeBuy,
	computeSell,
	getPrices,
	type Reserves,
	seedReserves,
} from "@/server/cpmm/calculate";
import { CpmmDecimal, toFixed18 } from "@/server/cpmm/decimal";
import { eventPayloadSchemas } from "@/server/events/schemas";
import { readOpenedReserves } from "@/server/markets/backing";
import { safeCaptureMessage } from "@/server/observability/safe-capture";

/** A bound read client — top-level `db` OR a caller's transaction. */
type DiscoveryReader = DbClient | DbTransaction;

/** One point of the Discovery price graph: the market's YES spot price
 * (18-dp decimal string; NO = 1 − YES at render, design-language §3.2) at an
 * ISO instant. */
export type PricePoint = { at: string; yes: string };

/** One step of the market's CPMM reserve walk — the pool reserves as of an
 * instant (a step function; reserves change only at a bet event). The additive
 * seam (UI-A5 OQ-2 B): the profile graph reads `reserves(t)` from this SAME
 * §22 replay to price its per-market position-value lines, so both surfaces
 * share ONE replay authority (no second reserve walk to drift). */
export type ReservePoint = { at: Date; reserves: Reserves };

/**
 * The same step, with its instant as an ISO string instead of a `Date` — the
 * form the walk takes once it crosses a cache boundary (CHART-1, SPEC.1 1.0.45
 * §9 *Refresh*).
 *
 * ⛔ THE `Date` IS CONVERTED DELIBERATELY, NOT INCIDENTALLY. `getCachedReserveWalk`
 * is a `'use cache'` function, so its return value is serialized and revived by
 * the framework rather than handed back by reference. Whether a `Date` survives
 * that round trip intact is a property of the serializer, not of this code — and
 * the directive is INERT under a bare `vitest run` (see
 * `tests/server/debate-view/round-trip-budget.test.ts`, which pins the uncached
 * cost for exactly this reason). So a `Date` that failed to revive would pass
 * every test in this repository and fail only in production, where nobody is
 * watching a chart's x-axis closely enough to notice it silently became
 * `[object Object]`. An ISO string has no such failure mode. The conversion
 * costs one `map` and removes the question.
 */
export type WireReservePoint = { at: string; reserves: Reserves };

/** `ReservePoint[]` → `WireReservePoint[]`. Pure; the only place the `Date` →
 * ISO conversion happens, so the two shapes cannot drift apart. */
export function toWireWalk(walk: ReservePoint[]): WireReservePoint[] {
	return walk.map((step) => ({
		at: step.at.toISOString(),
		reserves: step.reserves,
	}));
}

/**
 * A reserve walk mapped to the downsampled YES-price series — the ONE mapping
 * both surfaces use, at their own caps (§22's `DISCOVERY_SERIES_MAX_POINTS`,
 * §9's `MARKET_SERIES_MAX_POINTS`). Pure: index math and `getPrices`, never
 * money arithmetic of its own.
 *
 * ⚠ THIS REPLACED TWO IDENTICAL PRIVATE `downsample` HELPERS, and the docblock
 * on the second one used to justify the duplication by "the A5 precedent — the
 * index helper is never exported". That precedent held while there were two
 * consumers in two files. CHART-1 added a third (the cached walk), and a rule
 * whose effect is "write the stride arithmetic a third time" is no longer
 * protecting anything — three copies of a subsetting rule that must agree
 * exactly is a drift surface, not an encapsulation win. Exported here, once.
 */
export function mapWalkToSeries(
	walk: WireReservePoint[],
	max: number,
): PricePoint[] {
	const series: PricePoint[] = walk.map((step) => ({
		at: step.at,
		yes: getPrices(step.reserves).yes,
	}));
	return downsample(series, max);
}

/**
 * The chart's LIVE RIGHT EDGE, composed onto a floored history (SPEC.1 1.0.45
 * §9 — *X domain* and *Refresh*, founder-ruled at CHART-1). PURE: it reads a
 * price and a clock that its CALLER supplies, and does no IO of its own.
 *
 * This is the half of the mechanism that makes the other half affordable. The
 * history behind it may be up to `MARKET_SERIES_MIN_WINDOW_MS` old; this point
 * never is. Both callers already hold `spotYes` — it is the same
 * `pricing.yes` they render in `PriceBar` — so pinning the edge costs **zero
 * additional queries**, which is the only reason §9's superseded objection ("a
 * chart that lagged the price bar sitting directly beneath it would be worse
 * than no chart") is *answered* here rather than waived.
 *
 * Two shapes, chosen by market state:
 *
 * - **`Open`** — the domain runs to **now**, and the series gains a terminal
 *   point at the present instant carrying the live price. A market nobody has
 *   bet on in a week therefore renders a flat tail running to today, which is
 *   TRUE and is information: *nothing has happened lately* is a fact about the
 *   market, and the old behaviour — ending the axis at some arbitrary past
 *   instant — hid it. It also removes the jitter the window would otherwise
 *   introduce, where the right edge slid between "last event" and "whenever the
 *   entry was derived" depending on cache age.
 * - **Every other state** — the series is returned **UNTOUCHED**. The domain does
 *   not advance (**INV-4**) and the terminal keeps the price its own event
 *   produced. A frozen market's chart is its event history and nothing else.
 *
 *   ⚠ THIS BRANCH USED TO RESTAMP THE TERMINAL WITH `spotYes`, and the change is
 *   a correction rather than a tightening. The old text defended it as "a no-op
 *   in practice, since a closed market's pool cannot move" — an unguarded
 *   assumption, and `@security-auditor` named what falsifies it in the same run:
 *   **the day `pool_unwind` wakes.** A voided market's pool would then move after
 *   its last event, and the restamp would draw that price at the timestamp of a
 *   bet placed before it.
 *
 *   ⛔ THAT IS THE SHAPE THIS FILE ALREADY REJECTED ONE BRANCH ABOVE. The
 *   injected-walk path in `deriveMarketPriceChart` declines the identical
 *   operation for the identical reason — *a price at the wrong time is a false
 *   statement about the market, not a stale one* — so the two branches were
 *   answering the same question differently, and only one of them could be
 *   right. The property the restamp bought was "the chart can never disagree
 *   with `PriceBar` in EVERY state rather than in most of them". That property
 *   is not worth a wrong x, and it is worth least of all **here**: INV-4 exists
 *   because nobody re-examines a resolved market, so a false statement on a
 *   frozen chart has no natural discovery path. If the pool ever does move after
 *   close, the chart and `PriceBar` will visibly disagree — and **that
 *   disagreement is the correct outcome**, because it is true and it is
 *   findable, where a silent retro-stamp is neither.
 *
 * ⚠ The append can push the series one point past its cap. That is deliberate
 * and is not a cap violation to "fix": the cap bounds how much HISTORY crosses
 * the wire, and this point is not history — dropping a real interior point to
 * make room for it would trade a fact for an accounting convenience.
 *
 * ⚠ `spotYes === null` (no pool row — unreachable for an opened market) leaves
 * the replay's own terminal untouched rather than inventing one. Defensive.
 */
export function withLiveTail(
	series: PricePoint[],
	args: { spotYes: string | null; nowIso: string; isOpen: boolean },
): PricePoint[] {
	const last = series[series.length - 1];
	if (last === undefined || args.spotYes === null) {
		return series;
	}
	if (args.isOpen && Date.parse(args.nowIso) > Date.parse(last.at)) {
		return [...series, { at: args.nowIso, yes: args.spotYes }];
	}
	return series;
}

/** 18-dp canonical form for the F-1 reserve comparison — collapses any
 * formatting difference between the replayed strings and the NUMERIC(38,18)
 * wire text of the live pool row. */
function canonical18(value: string): string {
	return toFixed18(new CpmmDecimal(value));
}

/**
 * The pure §22 reserve walk (UI-A5 OQ-2 B additive export): the `market.opened`
 * reserves (`readOpenedReserves`, which normalises the legacy symmetric payload
 * and the ADR-0047 asymmetric one to one pair) walked across the market's
 * `bet.placed` / `bet.sold` events in `created_at` ASC order via the pure CPMM
 * `computeBuy`/`computeSell`, one reserve step per event. NO downsampling, NO
 * drift check, NO pool read — the raw walk, so a consumer can read `reserves(t)`
 * at any instant (the step in effect at t is the latest with `at <= t`). Sells
 * write NO bets row (plan §1d), so the events table is the only faithful source;
 * served by `events_aggregate_idx`. `loadPriceSeries` (Discovery) and the
 * profile graph (`graph-series.ts`) both consume this — one replay authority.
 * Returns `[]` when the market has no `market.opened` event (defensive — an
 * Open market always has one).
 */
export async function replayReserveSeries(
	client: DiscoveryReader,
	marketId: string,
): Promise<ReservePoint[]> {
	const openedRows = await client
		.select({ payload: events.payload, createdAt: events.createdAt })
		.from(events)
		.where(
			and(
				eq(events.aggregateType, "market"),
				eq(events.aggregateId, marketId),
				eq(events.eventType, "market.opened"),
			),
		)
		// `event_id` tiebreaks a `created_at` tie — ms precision, and a backfill
		// can write several rows in one millisecond. `markets/backing.ts` carries
		// the identical pair: these two reads must never pick different rows.
		.orderBy(asc(events.createdAt), asc(events.eventId))
		.limit(1);

	const openedRow = openedRows[0];
	if (!openedRow) {
		return [];
	}
	// ⛔ THE PAYLOAD UNION IS NOT DISCRIMINATED HERE. `readOpenedReserves` is
	// the one reader (ADR-0047, `markets/backing.ts`), and this walk takes the
	// pair it returns whichever shape the row is. Seeding a SYMMETRIC pair for
	// an asymmetric market is the failure this call exists to prevent, and it
	// is a SILENT one: the F-1 drift check below WARNs and always serves, so
	// the wrong price line would render on every Discovery card and every
	// debate page with nothing but a log line nobody is watching.
	const opened = readOpenedReserves(openedRow.payload);

	let reserves: Reserves = seedReserves(opened.yes, opened.no);
	const walk: ReservePoint[] = [{ at: openedRow.createdAt, reserves }];

	// The emitter↔replay aggregate contract: `bet.placed` rides the BET
	// aggregate — `(aggregate_type 'bet', aggregate_id = bets.id)`
	// (place.ts:184) — while `bet.sold` rides the MARKET aggregate
	// (sell.ts:96, the [R4] market-scoped ruling; a sale writes NO bets row,
	// so the market-aggregate scan is its only source). Buys are therefore
	// resolved via the market's bet ids (`bets_market_id_idx`), and the two
	// branches union in one query, ordered DB-side (µs-exact — never a JS
	// Date re-sort). Each branch rides `events_aggregate_idx`.
	const betIdRows = await client
		.select({ id: bets.id })
		.from(bets)
		.where(eq(bets.marketId, marketId));
	const betIds = betIdRows.map((r) => r.id);

	const soldBranch = and(
		eq(events.aggregateType, "market"),
		eq(events.aggregateId, marketId),
		eq(events.eventType, "bet.sold"),
	);
	const placedBranch =
		betIds.length > 0
			? and(
					eq(events.aggregateType, "bet"),
					inArray(events.aggregateId, betIds),
					eq(events.eventType, "bet.placed"),
				)
			: undefined;

	const betEvents = await client
		.select({
			eventType: events.eventType,
			payload: events.payload,
			createdAt: events.createdAt,
		})
		.from(events)
		.where(placedBranch ? or(soldBranch, placedBranch) : soldBranch)
		// created_at ASC is the replay order (SPEC.1 §22); event_id (UUIDv7,
		// time-ordered) is the deterministic same-instant tiebreak.
		.orderBy(asc(events.createdAt), asc(events.eventId));

	for (const ev of betEvents) {
		if (ev.eventType === "bet.placed") {
			const p = eventPayloadSchemas["bet.placed"].parse(ev.payload);
			reserves = computeBuy({
				reserves,
				side: p.side === "YES" ? "yes" : "no",
				stake: p.stake,
			}).reserves;
		} else {
			const p = eventPayloadSchemas["bet.sold"].parse(ev.payload);
			reserves = computeSell({
				reserves,
				side: p.side === "YES" ? "yes" : "no",
				shares: p.sharesSold,
			}).reserves;
		}
		walk.push({ at: ev.createdAt, reserves });
	}

	return walk;
}

/**
 * The Discovery price-series (SPEC.1 §22 "Price series (no new store)"): the
 * §22 reserve walk (`replayReserveSeries`) mapped to one `getPrices` YES-spot
 * point per step. The first point is the market's OPENING price — exactly 0.5
 * for a legacy symmetric seed, `openingPriceYes` for an ADR-0047 open. There is NO
 * materialized series. Returns `[]` when the market has no `market.opened`.
 *
 * **F-1 (soft consistency check):** the walk's final reserves are compared
 * against the live `pools` row; on mismatch this WARNs
 * (`discovery_price_series_drift`) and ALWAYS serves the computed series —
 * never throw/500. A concurrent bet landing between the events scan and the
 * pool read is a legal race, not a logic bug (§16 OQ-2 ruling).
 *
 * **F-4 (downsample):** the series is thinned server-side to at most
 * `DISCOVERY_SERIES_MAX_POINTS` points — a uniform-stride SUBSET of the walk
 * (never interpolated), first (seed) and last (final) points always kept,
 * order preserved — bounding the DTO regardless of bet count.
 */
export async function loadPriceSeries(
	client: DiscoveryReader,
	marketId: string,
): Promise<PricePoint[]> {
	const walk = await replayReserveSeries(client, marketId);
	if (walk.length === 0) {
		return [];
	}

	const series = mapWalkToSeries(toWireWalk(walk), DISCOVERY_SERIES_MAX_POINTS);

	// F-1 soft check — WARN + always serve, never throw (OQ-2 ruling). The walk's
	// LAST step is the replayed final reserves.
	const finalReserves = walk[walk.length - 1].reserves;
	const poolRows = await client
		.select({ yesReserves: pools.yesReserves, noReserves: pools.noReserves })
		.from(pools)
		.where(eq(pools.marketId, marketId))
		.limit(1);
	const pool = poolRows[0];
	if (
		pool &&
		(canonical18(pool.yesReserves) !== canonical18(finalReserves.yes) ||
			canonical18(pool.noReserves) !== canonical18(finalReserves.no))
	) {
		safeCaptureMessage("discovery_price_series_drift", {
			level: "warning",
			tags: { marketId },
			extra: {
				replayedYes: finalReserves.yes,
				replayedNo: finalReserves.no,
				poolYes: pool.yesReserves,
				poolNo: pool.noReserves,
				points: series.length,
			},
		});
	}

	return series;
}

/** Uniform-stride thinning to ≤ `max` points — a strict SUBSET of the input
 * (indices `round(i·(n−1)/(max−1))`, strictly increasing for n > max), first
 * and last always kept, order preserved. Index math only — never money. */
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
