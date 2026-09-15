import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { afterEach, describe, expect, it, vi } from "vitest";

// S-4 PHASE E — the `/m/[slug]` read budget, pinned.
//
// WHY THIS SURFACE NEEDS A GUARD MORE THAN ANY OTHER. `DebatePoll` calls
// `router.refresh()` every `POLL_INTERVAL_MS_DEBATE_VIEW` (30 s) for every open
// tab, and a refresh re-executes the LAYOUT as well as the page. So a single
// statement added here is not paid once per navigation — it is paid twice a
// minute, per active tab, forever. Discovery's equivalent guard
// (`tests/server/discovery/round-trip-budget.test.ts`) calls its own count "THE
// BINDING CONSTRAINT"; on this surface the same count carries a multiplier.
//
// ⚠ IT COUNTS EXECUTED STATEMENTS, NOT CALL SITES. Drizzle's `logger.logQuery`
// fires once per statement actually sent to Postgres. A guard that counted
// `.select()` builders would score the ranking substrate's `JOIN LATERAL` as a
// round trip and redden on a change that adds none — the trap the Discovery
// guard documents at length.
//
// ⚠ IT MEASURES THE UNCACHED COST, AND THAT IS THE POINT. Under a bare
// `vitest run` the `'use cache'` directive on `getCachedDebateView` is inert
// (it only caches inside the Next.js server runtime), so every call here
// executes for real. That is exactly the number worth pinning: a cache hit
// costs zero and guards nothing, while THIS is what a cold render, a cache
// miss, and every render after an invalidation actually pay. Real cold/warm
// hit verification needs Playwright, which is not installed (AGENTS.md §9).

vi.mock("@sentry/nextjs", () => ({
	captureMessage: vi.fn(),
	addBreadcrumb: vi.fn(),
	captureException: vi.fn(),
}));

vi.mock("@/server/storage/r2", () => ({
	mintReadUrl: vi.fn(
		async (bucket: string, key: string, ttlSeconds: number) =>
			`https://signed.test/${bucket}/${key}?ttl=${ttlSeconds}`,
	),
}));

import * as schema from "@/db/schema";
import { bets, comments, events, markets, pools, users } from "@/db/schema";
import { loadDebateView } from "@/server/debate-view/load-debate-view";
import { getMarketPricingAndReserves } from "@/server/debate-view/market-pricing";
import { loadViewerMarketContext } from "@/server/debate-view/viewer-context";
import {
	replayReserveSeries,
	toWireWalk,
} from "@/server/discovery/price-series";
import { getMarketBySlug } from "@/server/markets/get-by-slug";

import { testClient, testDb } from "../../db/_fixtures/db";
import { truncateTables } from "../../db/_fixtures/truncate";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
	throw new Error("DATABASE_URL not set; tests cannot connect.");
}

/** A SECOND drizzle handle over its own connection, wired to a query logger.
 * `testDb` stays the seeding client so seed writes never enter the count. */
let executed = 0;
const countingDb = drizzle(postgres(connectionString, { max: 1 }), {
	schema,
	logger: {
		logQuery() {
			executed += 1;
		},
	},
});

const POOL_SEED = "100.000000000000000000";
const SLUG = "budget-market";
const at = (i: number) => new Date(Date.UTC(2026, 8, 15, 0, 0, i));

/** One market, one author, one top-level post riding one bet, plus the two
 * events the price replay needs.
 *
 * ⚠ THE EVENTS ARE LOAD-BEARING FOR THE COUNT, not decoration — the same trap
 * the Discovery guard documents. `replayReserveSeries` returns early after ONE
 * statement when a market has no `market.opened` row, so a fixture missing it
 * would measure a smaller budget and quietly redefine the number this file
 * exists to pin. The guard would pass while asserting the wrong thing. */
async function seedMarket(): Promise<{ marketId: string; userId: string }> {
	const [user] = await testDb
		.insert(users)
		.values({ name: "B", email: "budget@example.com", pseudonym: "Budgeteer" })
		.returning({ id: users.id });
	const [market] = await testDb
		.insert(markets)
		.values({
			slug: SLUG,
			title: "Budget Market",
			status: "Open",
			resolutionDeadline: new Date("2026-11-01T00:00:00Z"),
			createdAt: at(1),
		})
		.returning({ id: markets.id });
	const marketId = market?.id ?? "";
	const userId = user?.id ?? "";

	await testDb
		.insert(pools)
		.values({ marketId, yesReserves: POOL_SEED, noReserves: POOL_SEED });

	const [c] = await testDb
		.insert(comments)
		.values({
			userId,
			marketId,
			body: "A YES argument, so the author + substrate reads all engage.",
			sideAtPostTime: "YES",
			parentCommentId: null,
			betId: null,
			createdAt: at(1),
		})
		.returning({ id: comments.id });
	const commentId = c?.id ?? "";

	const [b] = await testDb
		.insert(bets)
		.values({
			userId,
			marketId,
			side: "YES",
			stake: "40.000000000000000000",
			shareQuantity: "40.000000000000000000",
			priceAtBet: "0.5",
			commentId,
			createdAt: at(1),
		})
		.returning({ id: bets.id });

	await testDb.insert(events).values([
		{
			eventType: "market.opened",
			aggregateType: "market",
			aggregateId: marketId,
			payload: { marketId, seedAmount: POOL_SEED },
			payloadVersion: 1,
			metadata: {},
			createdAt: at(1),
		},
		{
			eventType: "bet.placed",
			aggregateType: "bet",
			aggregateId: b?.id ?? "",
			payload: {
				betId: b?.id ?? "",
				marketId,
				userId,
				side: "YES",
				stake: "40.000000000000000000",
				shares: "40.000000000000000000",
				price: "0.500000000000000000",
				commentId,
				parentCommentId: null,
			},
			payloadVersion: 1,
			metadata: {},
			createdAt: at(2),
		},
	]);

	return { marketId, userId };
}

afterEach(async () => {
	await truncateTables(testClient, [
		"events",
		"payout_events",
		"resolution_events",
		"dharma_ledger",
		"bets",
		"comments",
		"positions",
		"pools",
		"market_media",
		"markets",
		"mod_actions",
		"image_uploads",
		"bookmarks",
		"users",
	]);
	vi.clearAllMocks();
});

describe("/m/[slug] read budget — the polled surface (S-4 Phase E)", () => {
	it("the WARM REMAINDER is exactly 2 statements", async () => {
		// THE NUMBER THAT MATTERS AT SCALE. On a cache hit the shared block costs
		// nothing, so this pair is what the 2nd, 100th and 1000th concurrent
		// viewer of one market each pay — the slug resolve, and the LIVE pool
		// read that keys the cache and feeds the price bar.
		//
		// It is also the floor: no amount of caching removes these two, because
		// the second one must stay live (a stale price misquotes what a bet will
		// execute at) and the first is what produces the id the second needs.
		await seedMarket();

		executed = 0;
		const market = await getMarketBySlug(countingDb, SLUG);
		expect(market).not.toBeNull();
		await getMarketPricingAndReserves(countingDb, market?.id ?? "");

		expect(executed).toBe(2);
	});

	it("the CACHED BLOCK costs 12 statements on a miss", async () => {
		// What a cold render — or any render after an invalidation — pays for the
		// viewer-independent half: comments + held-sides, ranking substrate,
		// reply substrate, pricing, totals, media, removed-set, authors, and the
		// three-statement reserve replay behind the price chart.
		//
		// This is the number `getCachedDebateView` exists to stop paying per
		// viewer. If it climbs, every cache miss and every post-invalidation
		// render across the whole market got more expensive at once.
		const { marketId } = await seedMarket();
		const market = await getMarketBySlug(testDb, SLUG);
		expect(market?.id).toBe(marketId);

		executed = 0;
		// biome-ignore lint/style/noNonNullAssertion: asserted non-null above.
		await loadDebateView(countingDb, { market: market! });

		// 2 listMarketComments (comments + held sides)
		//   + 1 ranking substrate + 1 reply substrate
		//   + 1 pricing/unitToWin + 1 totals + 1 default media
		//   + 1 removed set + 1 authors
		//   + 3 price chart (events·opened / bets / events·bet.*)
		//   = 12. NO image read: this fixture's comment carries no attachment,
		//   and `mintImageUrls` EARLY-RETURNS on an empty input rather than
		//   issuing an empty `inArray` — the +1 case is exercised separately in
		//   the load-debate-view integration suite.
		expect(executed).toBe(12);
	});

	// ── CHART-1 — the same 12, now split across TWO keys ─────────────────────
	//
	// ⛔ THE TOTAL DID NOT MOVE, AND THAT IS THE FINDING, NOT A DISAPPOINTMENT.
	// A cold render still pays 12. What changed is that 3 of those 12 — the
	// reserve replay behind the price chart — moved onto `getCachedReserveWalk`,
	// which is keyed on the MARKET ID ALONE.
	//
	// ⚠ THE SENTENCE THAT FOLLOWED IS SUPERSEDED AND IS REWRITTEN RATHER THAN
	// APPENDED TO (O-5). It read: "The block around it is keyed on `(market,
	// reserves)`, so every bet changes that key and forces a miss; no bet touches
	// the walk's key. So the 9 are re-paid per bet and the 3 are re-paid once per
	// `MARKET_SERIES_MIN_WINDOW_MS`." That was an accurate description of a
	// defect. CACHE-KEY-1 (ADR-0051) re-keyed the block around it on `market`
	// alone with a `SHARED_VIEW_MIN_WINDOW_MS` window, so the 9 are now re-paid
	// once per 15 s and the 3 once per 60 s, and NEITHER is re-paid per bet
	// (SPEC.1 1.0.45 §9 *Refresh*). The split still buys the longer window for
	// history; it no longer has to rescue the history from an invalidation
	// coupled to activity, because there is no longer one.
	//
	// ⚠ A STATEMENT COUNT CANNOT SEE ANY OF THAT, WHICH IS EXACTLY WHY THE SPLIT
	// IS PINNED AND NOT JUST THE TOTAL. Pinning 12 alone would stay green if
	// someone moved the replay back inside the block around it — the regression
	// this task exists to prevent — because the sum is identical either way. The
	// two assertions below fail on that change; the one above does not.
	it("debate-view::price-chart-history-floored-to-min-window — the walk is 3 of the 12", async () => {
		const { marketId } = await seedMarket();

		executed = 0;
		await replayReserveSeries(countingDb, marketId);

		// events·opened / bets·ids / events·bet.* — the whole cost that moved.
		expect(executed).toBe(3);
	});

	it("debate-view::price-chart-history-floored-to-min-window — the remainder is 9 when the walk is supplied", async () => {
		const { marketId } = await seedMarket();
		const market = await getMarketBySlug(testDb, SLUG);
		expect(market?.id).toBe(marketId);

		const walk = toWireWalk(await replayReserveSeries(testDb, marketId));

		executed = 0;
		// biome-ignore lint/style/noNonNullAssertion: asserted non-null above.
		await loadDebateView(countingDb, { market: market!, walk });

		// 12 − 3. The `walk` argument is what `getCachedDebateView` passes after
		// resolving it from its own cache, so this is the real per-bet cost of a
		// market-detail render once the history has been derived this window.
		expect(executed).toBe(9);
	});

	it("the VIEWER CONTEXT costs 3 statements with no held position", async () => {
		// Viewer-scoped and therefore never cached, on any mechanism — this is
		// what a SIGNED-IN viewer adds on top of the warm remainder, on every
		// render and every poll tick.
		//
		// 3 with no holding: held-position, balance, cursor+now. A held position
		// adds a 4th (the pool read for Đb), which is why this fixture
		// deliberately holds none — the floor is the number worth pinning, and
		// the +1 is documented on the module.
		const { marketId, userId } = await seedMarket();

		executed = 0;
		await loadViewerMarketContext(countingDb, { userId, marketId });

		// ⚠ The transaction's own BEGIN/COMMIT are not logged as queries by the
		// postgres-js driver, so this counts statements, not round trips to the
		// wire. Named because the two differ here and nowhere else in this file.
		expect(executed).toBe(3);
	});

	it("POSITIVE CONTROL — the counter observes real statements", async () => {
		// V-2. Every assertion above is an exact-equality on a counter; if the
		// logger were mis-wired the counter would sit at 0 and every one of them
		// would need to have been written as 0 to pass — but a future edit that
		// broke the wiring would turn them all green-by-accident at whatever
		// number they were last set to. This proves the instrument reads
		// non-zero, and that seeding through `testDb` never enters the count.
		await seedMarket();

		executed = 0;
		await getMarketBySlug(countingDb, SLUG);
		expect(executed).toBe(1);

		// And a seed write through the OTHER handle moves nothing.
		const before = executed;
		await testDb
			.insert(users)
			.values({ name: "X", email: "x@example.com", pseudonym: "NotCounted" })
			.returning({ id: users.id });
		expect(executed).toBe(before);
	});

	it("POSITIVE CONTROL — an added read is caught", async () => {
		// The regression this file exists to prevent, demonstrated rather than
		// asserted: issuing one extra read through the counting client moves the
		// number by exactly one. So a future PR that adds a query to any read in
		// the budget above goes RED, instead of the count drifting upward
		// unnoticed one statement at a time.
		await seedMarket();

		executed = 0;
		const market = await getMarketBySlug(countingDb, SLUG);
		await getMarketPricingAndReserves(countingDb, market?.id ?? "");
		expect(executed).toBe(2);

		await getMarketPricingAndReserves(countingDb, market?.id ?? "");
		expect(executed).toBe(3);
	});
});
