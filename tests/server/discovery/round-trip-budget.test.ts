import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { afterEach, describe, expect, it, vi } from "vitest";

// DISCOVERY-COMPLETE — the plan §7 test-plan row the build originally MISSED,
// caught by @code-reviewer at Gate C and built here.
//
// Plan §3a calls the round-trip count "THE BINDING CONSTRAINT", and §5's
// failure table names this assertion as the detection mechanism for halt item 3
// ("A new query sneaks in"). Discovery is the surface PERF-1 just rescued from
// 35.07s as the only GO-LIVE BLOCKER; it gained SIX DTO fields in this PR and
// had no mechanical guard on its query count. A reviewer reading every call
// site is not that guard.
//
// ⚠ IT COUNTS EXECUTED STATEMENTS, NOT CALL SITES — and that distinction is
// load-bearing here, not pedantry. C8's V13 `leftJoinLateral` builds its
// subquery with `client.select(...)` and NEVER awaits it (`.as("post_bet")`),
// so a guard that counted `.select()` BUILDERS would score the LATERAL as a
// round-trip and redden on a change that adds none. Drizzle's `logger.logQuery`
// fires once per statement actually sent to Postgres, which is the real
// quantity.

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
import { selectHeroTopPosts } from "@/server/discovery/hero";
import { listOpenMarkets } from "@/server/discovery/list";
import { loadPriceSeries } from "@/server/discovery/price-series";

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
	// `schema` is not optional here: without it the instance types as
	// `ExtractTablesWithRelations<Record<string, never>>` and fails to satisfy
	// `DiscoveryReader`. Runtime is unaffected, so only tsc catches it.
	schema,
	logger: {
		logQuery() {
			executed += 1;
		},
	},
});

const POOL_SEED = "100.000000000000000000";
const at = (i: number) => new Date(Date.UTC(2026, 8, 15, 0, 0, i));

async function seedMarketWithPost(tag: string, i: number): Promise<void> {
	const [user] = await testDb
		.insert(users)
		.values({ name: "RT", email: `${tag}@example.com`, pseudonym: tag })
		.returning({ id: users.id });
	const [market] = await testDb
		.insert(markets)
		.values({
			slug: tag,
			title: "Round-trip Market",
			status: "Open",
			resolutionDeadline: new Date("2026-11-01T00:00:00Z"),
			createdAt: at(i),
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
			body: "A YES argument, so the hero read reaches all five statements.",
			sideAtPostTime: "YES",
			parentCommentId: null,
			betId: null,
			createdAt: at(i),
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
			createdAt: at(i),
		})
		.returning({ id: bets.id });
	const betId = b?.id ?? "";

	// ⚠ THE PRICE-SERIES EVENTS ARE LOAD-BEARING FOR THIS COUNT, not decoration.
	// `loadPriceSeries` returns [] after ONE statement when a market has no
	// `market.opened` event (price-series.ts:72-73), and again after THREE when
	// the bet walk is empty (:166-167). A fixture without both would measure
	// 1 + 9N and quietly redefine the budget this file exists to pin — the
	// guard would pass while asserting the wrong number.
	await testDb.insert(events).values([
		{
			eventType: "market.opened",
			aggregateType: "market",
			aggregateId: marketId,
			payload: { marketId, seedAmount: POOL_SEED },
			payloadVersion: 1,
			metadata: {},
			createdAt: at(i),
		},
		{
			eventType: "bet.placed",
			aggregateType: "bet",
			aggregateId: betId,
			payload: {
				betId,
				marketId,
				userId: userId,
				side: "YES",
				stake: "40.000000000000000000",
				shares: "40.000000000000000000",
				price: "0.500000000000000000",
				commentId,
				parentCommentId: null,
			},
			payloadVersion: 1,
			metadata: {},
			createdAt: at(i + 1),
		},
	]);
}

/** The page's composition, verbatim from `DiscoveryContent` — the outer list,
 * then per market a price series and the hero read. */
async function composeDiscovery(): Promise<void> {
	const listings = await listOpenMarkets(countingDb);
	for (const { card, reserves } of listings) {
		await loadPriceSeries(countingDb, card.id);
		await selectHeroTopPosts(countingDb, card.id, reserves);
	}
}

describe("Discovery round-trip budget — 1 + 12N (plan §3a, the binding constraint)", () => {
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
			"users",
		]);
		vi.clearAllMocks();
	});

	it("discovery::round-trip-count-is-1-plus-12N", async () => {
		// TWO markets, so a per-market cost is distinguishable from a fixed one:
		// a guard at N=1 cannot tell 1+12N from 13, and would miss a regression
		// that adds a constant read.
		for (const [i, tag] of ["rt-market-1", "rt-market-2"].entries()) {
			await seedMarketWithPost(tag, i + 1);
		}

		executed = 0;
		await composeDiscovery();
		const N = 2;

		// 1 outer market list
		//   + N getMarketPricingAndReserves + N getMarketTotals + N media
		//   + 4N loadPriceSeries (events·opened / bets / events·bet.* / pools)
		//   + 5N selectHeroTopPosts (substrate / removedSet / picked / authors
		//                            / ordinals)
		// = 1 + 12N. 25 at N=2.
		expect(executed).toBe(1 + 12 * N);
	});

	it("discovery::the-V13-lateral-is-not-a-round-trip", async () => {
		// The specific regression this file exists to prevent, isolated: the hero
		// read carries THREE joins (image_uploads, the bets LATERAL, positions)
		// and must still issue exactly FIVE statements. If someone converts the
		// LATERAL to a second read — the "simpler" refactor — this goes red while
		// the whole-surface count above would only shift by N and could be
		// misread as a fixture change.
		await seedMarketWithPost("rt-hero-only", 1);
		const [market] = await testDb
			.select({ id: markets.id })
			.from(markets)
			.limit(1);

		executed = 0;
		await selectHeroTopPosts(countingDb, market?.id ?? "", {
			yes: POOL_SEED,
			no: POOL_SEED,
		});
		expect(executed).toBe(5);
	});
});
