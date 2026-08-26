import { readFileSync } from "node:fs";
import { join } from "node:path";
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
//
// S-4 PHASE C — this file's shape changed, its NUMBER didn't. Discovery's live
// composition (`(public)/page.tsx`'s `DiscoveryContent`) now calls
// `getCachedDiscoveryMarketIds` / `getCachedMarketDiscoveryData`
// (`server/discovery/list.ts`), both `'use cache'` — which cannot take a
// counting Drizzle client as an argument (a cache key must be serializable; a
// DB client object is not, and passing one would be a correctness bug in the
// real Next.js runtime, not just a test inconvenience). So this file no longer
// calls those two functions by name — it replicates their READ COMPOSITION
// inline against `countingDb`, exactly as `composeDiscovery` always has,
// proving the underlying statement count is UNCHANGED by Phase C (`'use
// cache'` adds an invalidation layer on top of the same reads; it does not
// remove or add one). This is the "uncached-cost baseline" the Phase C plan
// calls for — it does not and cannot prove a cache HIT occurs, which needs the
// real Next.js server runtime (Playwright, not installed — AGENTS.md §9).

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
import { getMarketPricingAndReserves } from "@/server/debate-view/market-pricing";
import { getMarketTotals } from "@/server/debate-view/market-totals";
import { selectHeroTopPosts } from "@/server/discovery/hero";
import { getDefaultMarketMediaUrl } from "@/server/discovery/media";
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

/** Discovery's live read composition, replicated against `countingDb` — see
 * the file-header note on why this can't call `getCachedDiscoveryMarketIds` /
 * `getCachedMarketDiscoveryData` by name. Statement-for-statement identical to
 * what `(public)/page.tsx`'s `DiscoveryContent` does today. */
async function composeDiscovery(): Promise<void> {
	const rows = await countingDb
		.select({ id: markets.id, slug: markets.slug, title: markets.title })
		.from(markets)
		.orderBy(markets.createdAt);
	for (const m of rows) {
		await getMarketPricingAndReserves(countingDb, m.id);
		await getMarketTotals(countingDb, m.id);
		await getDefaultMarketMediaUrl(countingDb, m.id);
		await loadPriceSeries(countingDb, m.id);
		await selectHeroTopPosts(countingDb, m.id, null);
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
		// = 1 + 12N. 25 at N=2. UNCHANGED from pre-Phase-C: the cache boundary
		// sits on top of this composition, it does not alter it.
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

// ── S-4 Phase C — cache-boundary contract (static, no DB) ────────────────────
//
// Real cold/warm cache-hit verification needs the Next.js server runtime
// (`'use cache'` doesn't cache anything under a bare Vitest invocation — see
// the file header). This repo has no Playwright (AGENTS.md §9), so this is a
// STRUCTURAL check instead, matching `poll-contract.test.ts`'s source-scan
// pattern: it can't prove a cache hit happens, but it can prove the boundary
// is drawn where R3 requires — price/reserves live, everything else cached.

const ROOT = process.cwd();
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

/** The `export async function NAME(...) { ... }` block, brace-matched from
 * the `{` that opens the function body — mirrors
 * `reserves-server-only.test.ts`'s `typeBlock` helper for type literals. */
function functionBlock(source: string, name: string): string {
	const sigStart = source.indexOf(`export async function ${name}(`);
	if (sigStart === -1) {
		throw new Error(`function ${name} not found — this guard is stale`);
	}
	const bodyStart = source.indexOf("{", source.indexOf(")", sigStart));
	let depth = 0;
	for (let i = bodyStart; i < source.length; i++) {
		if (source[i] === "{") {
			depth++;
		} else if (source[i] === "}") {
			depth--;
			if (depth === 0) {
				return source.slice(bodyStart, i + 1);
			}
		}
	}
	throw new Error(`unbalanced braces reading ${name}`);
}

describe("Discovery cache boundary — R3 (price/reserves never cached)", () => {
	it("card.pricing is assigned from the LIVE read, never from the cached one", () => {
		const page = read("src/app/(public)/page.tsx");
		expect(page).toContain("getMarketPricingAndReserves(db, m.id)");
		expect(page).toContain("pricing: priced?.pricing ?? null");
		// The negative half: the cached call's result must never feed `pricing`.
		expect(page).not.toMatch(/pricing:\s*data\./);
	});

	it("getCachedMarketDiscoveryData never fetches its own reserves", () => {
		// The whole reserves-keyed-cache mechanism (see that function's own
		// docstring) depends on `reserves` being a value the CALLER observed
		// live — a function that re-fetched reserves internally would let a
		// stale value hide behind a key the caller never actually saw.
		const block = functionBlock(
			read("src/server/discovery/list.ts"),
			"getCachedMarketDiscoveryData",
		);
		expect(block).toContain('"use cache"');
		expect(block).not.toContain("getMarketPricingAndReserves");
	});

	it("getCachedMarketDiscoveryData and getCachedDiscoveryMarketIds carry an explicit cacheLife", () => {
		const list = read("src/server/discovery/list.ts");
		for (const name of [
			"getCachedDiscoveryMarketIds",
			"getCachedMarketDiscoveryData",
		]) {
			const block = functionBlock(list, name);
			expect(block).toContain('"use cache"');
			// Explicit at the call site — never left to inherit the default
			// profile (Phase C self-check item 1).
			expect(block).toMatch(/cacheLife\(\s*["']minutes["']\s*\)/);
		}
	});

	it("hero.ts and its test suite are untouched by the cache retrofit", () => {
		// Design B's whole point: selectHeroTopPosts keeps taking `reserves` and
		// computing `currentValue` exactly as before — the caching lives around
		// it, not inside it. This is a canary, not a strict diff guard: it just
		// confirms the signature contract this file's own `composeDiscovery`
		// depends on hasn't drifted.
		const hero = read("src/server/discovery/hero.ts");
		expect(hero).toContain(
			"reserves: Reserves | null,\n): Promise<HeroTopPosts> {",
		);
	});
});
