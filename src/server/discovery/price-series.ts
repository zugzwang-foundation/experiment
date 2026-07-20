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
	seedPool,
} from "@/server/cpmm/calculate";
import { CpmmDecimal, toFixed18 } from "@/server/cpmm/decimal";
import { eventPayloadSchemas } from "@/server/events/schemas";
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

/** 18-dp canonical form for the F-1 reserve comparison — collapses any
 * formatting difference between the replayed strings and the NUMERIC(38,18)
 * wire text of the live pool row. */
function canonical18(value: string): string {
	return toFixed18(new CpmmDecimal(value));
}

/**
 * The pure §22 reserve walk (UI-A5 OQ-2 B additive export): the `market.opened`
 * seed (`seedPool(payload.seedAmount)`) walked across the market's
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
		.orderBy(asc(events.createdAt))
		.limit(1);

	const opened = openedRows[0];
	if (!opened) {
		return [];
	}
	const openedPayload = eventPayloadSchemas["market.opened"].parse(
		opened.payload,
	);

	let reserves: Reserves = seedPool(openedPayload.seedAmount);
	const walk: ReservePoint[] = [{ at: opened.createdAt, reserves }];

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
 * point per step (first point exactly 0.5 for a symmetric seed). There is NO
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

	const series: PricePoint[] = walk.map((step) => ({
		at: step.at.toISOString(),
		yes: getPrices(step.reserves).yes,
	}));

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

	return downsample(series, DISCOVERY_SERIES_MAX_POINTS);
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
