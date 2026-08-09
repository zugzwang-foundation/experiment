import "server-only";

import { eq } from "drizzle-orm";

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
 * says so. This mirrors `getMarketPricingAndUnitToWin` below — one read, one
 * extra return field, no new round-trip.
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
	return { pricing: getPrices(reserves), reserves };
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
