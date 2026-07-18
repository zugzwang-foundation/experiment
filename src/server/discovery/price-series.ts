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

/** 18-dp canonical form for the F-1 reserve comparison — collapses any
 * formatting difference between the replayed strings and the NUMERIC(38,18)
 * wire text of the live pool row. */
function canonical18(value: string): string {
	return toFixed18(new CpmmDecimal(value));
}

/**
 * The Discovery price-series replay (SPEC.1 §22 "Price series (no new
 * store)"; plan §3 / OQ-2 = A): a pure events-replay derivation — the
 * `market.opened` seed (`seedPool(payload.seedAmount)`, first point exactly
 * 0.5) walked across the market's `bet.placed` / `bet.sold` events in
 * `created_at` ASC order via the pure CPMM `computeBuy`/`computeSell`, one
 * `getPrices` point per step. Sells write NO bets row (plan §1d) — the
 * events table is the only faithful source; there is NO materialized series.
 * Served by `events_aggregate_idx`. Returns `[]` when the market has no
 * `market.opened` event (defensive — an Open market always has one).
 *
 * **F-1 (soft consistency check):** the replayed final reserves are compared
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
	const series: PricePoint[] = [
		{ at: opened.createdAt.toISOString(), yes: getPrices(reserves).yes },
	];

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
		series.push({
			at: ev.createdAt.toISOString(),
			yes: getPrices(reserves).yes,
		});
	}

	// F-1 soft check — WARN + always serve, never throw (OQ-2 ruling).
	const poolRows = await client
		.select({ yesReserves: pools.yesReserves, noReserves: pools.noReserves })
		.from(pools)
		.where(eq(pools.marketId, marketId))
		.limit(1);
	const pool = poolRows[0];
	if (
		pool &&
		(canonical18(pool.yesReserves) !== canonical18(reserves.yes) ||
			canonical18(pool.noReserves) !== canonical18(reserves.no))
	) {
		safeCaptureMessage("discovery_price_series_drift", {
			level: "warning",
			tags: { marketId },
			extra: {
				replayedYes: reserves.yes,
				replayedNo: reserves.no,
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
