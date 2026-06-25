import { afterEach, describe, expect, it, vi } from "vitest";

// DEBATE.4 §8 tests-first (plan §5 / D1) — the RED driver for `getMarketPricing`,
// the NEW pool→price read-model. It reads the market's `pools` reserves and
// returns spot prices via the CPMM `getPrices` (`p_yes = n / (y + n)`,
// `p_no = y / (y + n)`), or `null` when no pool row exists. The DEBATE.4
// PriceBar renders these.
//
// RED target: `@/server/debate-view/market-pricing` does NOT yet exist, so this
// file fails at COLLECTION until the implement phase lands the loader.
//
// The expected price is computed by importing the SAME `getPrices` the loader
// must use (over the same reserves) — so the assertion pins "the loader delegates
// to getPrices on the pool reserves", not a hand-recomputed float (decimal
// posture, CLAUDE.md §2; getPrices is half-even-18 quantized).
//
// DB-backed (local Postgres :54322). TRUNCATE in afterEach.

vi.mock("@sentry/nextjs", () => ({
	captureMessage: vi.fn(),
	addBreadcrumb: vi.fn(),
	captureException: vi.fn(),
}));

import { markets, pools } from "@/db/schema";
import { getPrices } from "@/server/cpmm/calculate";
// The RED import: greenfield loader under test.
import { getMarketPricing } from "@/server/debate-view/market-pricing";

import { testClient, testDb } from "../../db/_fixtures/db";

async function seedMarket(slug: string): Promise<string> {
	const [market] = await testDb
		.insert(markets)
		.values({
			slug,
			title: "Pricing Market",
			status: "Open",
			resolutionDeadline: new Date("2026-11-01T00:00:00Z"),
		})
		.returning({ id: markets.id });
	return market?.id ?? "";
}

describe("DEBATE.4 §5 — getMarketPricing (pool reserves → spot prices)", () => {
	afterEach(async () => {
		await testClient.unsafe(
			`TRUNCATE events, payout_events, resolution_events, dharma_ledger, bets, comments, positions, pools, markets, mod_actions, users CASCADE`,
		);
		vi.clearAllMocks();
	});

	it("symmetric reserves → yes == no == 0.5 (matches getPrices)", async () => {
		const marketId = await seedMarket("pricing-symmetric");
		const yesReserves = "100.000000000000000000";
		const noReserves = "100.000000000000000000";
		await testDb.insert(pools).values({ marketId, yesReserves, noReserves });

		const pricing = await getMarketPricing(testDb, marketId);

		const expected = getPrices({ yes: yesReserves, no: noReserves });
		expect(pricing).not.toBeNull();
		expect(pricing?.yes).toBe(expected.yes);
		expect(pricing?.no).toBe(expected.no);
		// Symmetric → both halves.
		expect(pricing?.yes).toBe("0.500000000000000000");
		expect(pricing?.no).toBe("0.500000000000000000");
	});

	it("asymmetric reserves → prices follow getPrices (p_yes = n/(y+n))", async () => {
		const marketId = await seedMarket("pricing-asymmetric");
		// y = 40, n = 160 → p_yes = 160/200 = 0.8, p_no = 40/200 = 0.2.
		const yesReserves = "40.000000000000000000";
		const noReserves = "160.000000000000000000";
		await testDb.insert(pools).values({ marketId, yesReserves, noReserves });

		const pricing = await getMarketPricing(testDb, marketId);

		const expected = getPrices({ yes: yesReserves, no: noReserves });
		expect(pricing?.yes).toBe(expected.yes);
		expect(pricing?.no).toBe(expected.no);
		// Pin the curve: price of YES tracks the OPPOSITE (NO) reserve.
		expect(pricing?.yes).toBe("0.800000000000000000");
		expect(pricing?.no).toBe("0.200000000000000000");
	});

	it("no pool row → null (market exists but unpooled)", async () => {
		const marketId = await seedMarket("pricing-no-pool");
		// No pools insert.

		const pricing = await getMarketPricing(testDb, marketId);
		expect(pricing).toBeNull();
	});
});
