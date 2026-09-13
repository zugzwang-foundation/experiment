import "server-only";

import { eq, inArray } from "drizzle-orm";

import type { DbClient, DbTransaction } from "@/db";
import { pools } from "@/db/schema";
import { getPrices } from "@/server/cpmm/calculate";

import { deriveUnitToWin } from "./quote";

/** A bound read client — top-level `db` OR a caller's transaction. */
type DebateViewReader = DbClient | DbTransaction;

/**
 * The market's spot prices for the debate-view price bar (DEBATE.4 §5 / D1) —
 * `{ yes, no }` as exact 18-dp decimal strings in (0,1), derived from the pool
 * reserves via the shared CPMM `getPrices` (the SINGLE pricing authority — no
 * hand-rolled price). Returns `null` when the market has no pool row (an
 * unseeded Draft never reaches this surface; defensive null otherwise).
 *
 * Read-only. NUMERIC(38,18) crosses as a string end-to-end (CLAUDE.md §2); the
 * price quantization (half-even-18) lives in `getPrices`, never here.
 */
export async function getMarketPricing(
	client: DebateViewReader,
	marketId: string,
): Promise<{ yes: string; no: string } | null> {
	const rows = await client
		.select({
			yesReserves: pools.yesReserves,
			noReserves: pools.noReserves,
		})
		.from(pools)
		.where(eq(pools.marketId, marketId))
		.limit(1);

	const pool = rows[0];
	if (!pool) {
		return null;
	}
	return getPrices({ yes: pool.yesReserves, no: pool.noReserves });
}

/**
 * DISCOVERY-COMPLETE C8 (V13) — the SAME one pool read, now also returning the
 * raw reserves. `getMarketPricing` above stays UNTOUCHED: its shape is pinned by
 * `tests/server/debate-view/market-pricing.integration.test.ts` and its docstring
 * says so. This mirrors `getMarketPricingAndUnitToWin` below — one read, now two
 * extra return fields (`reserves`, `unitToWin`), no new round-trip.
 *
 * `unitToWin` was added so `/m/[slug]/page.tsx` can override the cached
 * `DebateViewModel`'s `market.pricing`/`market.unitToWin` with this LIVE read
 * after calling `getCachedDebateView` — the reserves used to key that cache
 * came from THIS SAME read, so the override is a same-value assignment on a
 * hit and a same-derivation assignment on a miss either way; it exists so the
 * page's own guarantee doesn't rest on cache-key-equality reasoning nobody
 * can see from the call site.
 *
 * ⚠ The reserves are a SERVER-INTERNAL row value. They must never reach
 * `DiscoveryCard` / `DiscoveryMarketView`, which cross to the `"use client"`
 * carousel and would serialize them to the browser (AGENTS.md §6 — never expose
 * internal row shapes in a DTO). `listOpenMarkets` therefore returns them
 * BESIDE the card, not on it.
 */
export async function getMarketPricingAndReserves(
	client: DebateViewReader,
	marketId: string,
): Promise<{
	pricing: { yes: string; no: string };
	reserves: { yes: string; no: string };
	unitToWin: { yes: string; no: string };
} | null> {
	const rows = await client
		.select({
			yesReserves: pools.yesReserves,
			noReserves: pools.noReserves,
		})
		.from(pools)
		.where(eq(pools.marketId, marketId))
		.limit(1);

	const pool = rows[0];
	if (!pool) {
		return null;
	}
	const reserves = { yes: pool.yesReserves, no: pool.noReserves };
	return {
		pricing: getPrices(reserves),
		reserves,
		unitToWin: deriveUnitToWin(reserves),
	};
}

/**
 * T-03 — the SAME derivation as `getMarketPricingAndReserves`, for MANY markets
 * in ONE round trip. This is the grouped-query batching `discovery/list.ts` has
 * named as the OQ-1 C follow-up since S-4 Phase C.
 *
 * ⛔ WHY THIS EXISTS AND WHY IT IS A BATCH RATHER THAN A `Promise.all`.
 * Discovery calls the single-market read once per market, sequentially awaited,
 * so eight open markets cost EIGHT round trips in series before the page can
 * render — and that read is deliberately never cached (it is the live price),
 * so every visitor pays all eight every time. `Promise.all` over the singular
 * read would fix the LATENCY and make the CONNECTION problem worse: eight
 * concurrent reads per visitor against a pool capped at four per instance, at
 * exactly the moment the connection bottleneck (the open P1) is the thing
 * hurting. One `IN (…)` query fixes both — one round trip, one connection,
 * strictly less total work than before.
 *
 * Returned as a Map keyed by market id. A market with no pool row is simply
 * ABSENT from the map rather than present-with-null, so a caller's
 * `map.get(id) ?? null` reproduces the singular read's defensive-null contract
 * exactly. An empty input returns an empty map without touching the database.
 *
 * Read-only. Same `getPrices` / `deriveUnitToWin` authorities as every other
 * read in this file — no second pricing path, which is the point.
 */
export async function getMarketPricingAndReservesBatch(
	client: DebateViewReader,
	marketIds: readonly string[],
): Promise<
	Map<
		string,
		{
			pricing: { yes: string; no: string };
			reserves: { yes: string; no: string };
			unitToWin: { yes: string; no: string };
		}
	>
> {
	const byMarket = new Map<
		string,
		{
			pricing: { yes: string; no: string };
			reserves: { yes: string; no: string };
			unitToWin: { yes: string; no: string };
		}
	>();
	if (marketIds.length === 0) {
		return byMarket;
	}

	const rows = await client
		.select({
			marketId: pools.marketId,
			yesReserves: pools.yesReserves,
			noReserves: pools.noReserves,
		})
		.from(pools)
		.where(inArray(pools.marketId, [...marketIds]));

	for (const row of rows) {
		const reserves = { yes: row.yesReserves, no: row.noReserves };
		byMarket.set(row.marketId, {
			pricing: getPrices(reserves),
			reserves,
			unitToWin: deriveUnitToWin(reserves),
		});
	}
	return byMarket;
}

/**
 * UI.A2 §3.2 — the header read extended for the A3 strip: the SAME one pool
 * read now also yields `unitToWin` = per-side `computeBuy(stake: "1").shares`
 * (`deriveUnitToWin`). `getMarketPricing` above stays untouched (its shape is
 * pinned by the existing integration suite); this is the debate-view
 * aggregator's read. Returns `null` when the market has no pool row — the
 * shared defensive-null path.
 */
export async function getMarketPricingAndUnitToWin(
	client: DebateViewReader,
	marketId: string,
): Promise<{
	pricing: { yes: string; no: string };
	unitToWin: { yes: string; no: string };
} | null> {
	const rows = await client
		.select({
			yesReserves: pools.yesReserves,
			noReserves: pools.noReserves,
		})
		.from(pools)
		.where(eq(pools.marketId, marketId))
		.limit(1);

	const pool = rows[0];
	if (!pool) {
		return null;
	}
	const reserves = { yes: pool.yesReserves, no: pool.noReserves };
	return {
		pricing: getPrices(reserves),
		unitToWin: deriveUnitToWin(reserves),
	};
}
