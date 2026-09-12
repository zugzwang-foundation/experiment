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
import { getMarketPricingAndReservesBatch } from "@/server/debate-view/market-pricing";
import { getMarketTotals } from "@/server/debate-view/market-totals";
import { selectHeroTopPosts } from "@/server/discovery/hero";
import { getDefaultMarketMediaUrl } from "@/server/discovery/media";
import { replayReserveSeries } from "@/server/discovery/price-series";

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
	// ⛔ THE BATCH IS ONE STATEMENT FOR THE WHOLE SURFACE, AND IT BELONGS AHEAD
	// OF THE LOOP — T-03's actual shape. ⚠ THIS LINE WAS THE BUG THAT MADE THIS
	// FILE RED ON ITS OWN BRANCH: T-03 moved the page to
	// `getMarketPricingAndReservesBatch` and moved the assertion below from
	// `1 + 11N` to `2 + 10N`, but left the singular per-market read HERE. The
	// guard then measured 23 against an expected 22 and shipped failing — a
	// replication that had stopped replicating, which is the one way this file
	// can be wrong without being obviously wrong. Fixed at CACHE-KEY-1.
	await getMarketPricingAndReservesBatch(
		countingDb,
		rows.map((m) => m.id),
	);
	for (const m of rows) {
		await getMarketTotals(countingDb, m.id);
		await getDefaultMarketMediaUrl(countingDb, m.id);
		// CHART-1 — the hero's series now rides `getCachedReserveWalk`, which wraps
		// `replayReserveSeries` (3 statements) and NOT `loadPriceSeries` (4 — it
		// spent a fourth on the live `pools` row for the F-1 drift WARN, which a
		// floored history makes non-diagnostic). The cached function cannot take a
		// counting client — a cache key must be serializable and a DB client is not
		// — so this line replicates what it wraps, exactly as the rest of this
		// function replicates the cached block around it.
		await replayReserveSeries(countingDb, m.id);
		// CACHE-KEY-1 — two arguments, no `reserves`. The statement count is
		// unchanged by that: dropping a parameter removes no read. What moved out
		// of this function is one pure `computeSell`, which never touched the
		// database and therefore never appeared in this budget.
		await selectHeroTopPosts(countingDb, m.id);
	}
}

describe("Discovery round-trip budget — 2 + 10N (plan §3a, the binding constraint)", () => {
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

	it("discovery::round-trip-count-is-2-plus-10N", async () => {
		// TWO markets, so a per-market cost is distinguishable from a fixed one:
		// a guard at N=1 cannot tell 1+12N from 13, and would miss a regression
		// that adds a constant read.
		for (const [i, tag] of ["rt-market-1", "rt-market-2"].entries()) {
			await seedMarketWithPost(tag, i + 1);
		}

		executed = 0;
		await composeDiscovery();
		const N = 2;

		// 1 outer market list + 1 BATCHED pricing read
		//   + N getMarketTotals + N media
		//   + 3N replayReserveSeries (events·opened / bets / events·bet.*)
		//   + 5N selectHeroTopPosts (substrate / removedSet / picked / authors
		//                            / ordinals)
		// = 2 + 10N. 22 at N=2.
		//
		// ⚠ THE PIN MOVED AGAIN AT T-03 — 1+11N → 2+10N — AND THE SHAPE OF THE
		// MOVE MATTERS MORE THAN ITS SIZE. A per-market term became a CONSTANT:
		// `getMarketPricingAndReserves` was called once per market and awaited in
		// series, so the live price cost one round trip per market, every render,
		// uncacheably. `getMarketPricingAndReservesBatch` reads every pool in one
		// `IN (…)`. At N=2 that is a single statement saved and looks trivial; at
		// the shipped `DISCOVERY_GRID_SIZE` of 8 it is seven statements and, more
		// to the point, EIGHT SEQUENTIAL ROUND TRIPS COLLAPSED INTO ONE.
		//
		// ⚠ AND IT WAS DELIBERATELY NOT DONE WITH `Promise.all`. Parallelising the
		// singular read would have fixed the same latency while making the open
		// connection bottleneck worse — eight concurrent reads per visitor against
		// a pool capped at four per instance. The batch takes one connection once.
		// A future change that "simplifies" this back to a per-market read inside
		// the loop reddens here, which is the point of pinning a decrease.
		//
		// ⚠ THE PIN MOVED DOWN BY N AT CHART-1 — 1+12N → 1+11N — AND A DECREASE
		// IS RE-PINNED DELIBERATELY RATHER THAN LEFT SLACK. The dropped statement
		// is `loadPriceSeries`'s live `pools` read, which existed to WARN when the
		// event replay disagreed with the pool. Under a floored history that
		// comparison is no longer diagnostic — a walk up to
		// `MARKET_SERIES_MIN_WINDOW_MS` old legitimately differs from a pool that
		// has moved since — and the property it protected is now guaranteed by
		// construction, because `withLiveTail` composes the chart's right edge
		// from the page's own live read. Pinning the lower number is what makes
		// the removal permanent instead of a budget someone can quietly spend.
		//
		// ⚠ AND THE REAL WIN IS NOT VISIBLE IN THIS NUMBER AT ALL. This file
		// measures the UNCACHED cost — what a cold render or a miss pays. CHART-1
		// changes how OFTEN that cost is paid: the walk moved onto a key no bet
		// can move, so it is derived once per window instead of once per bet, and
		// no statement-count assertion can see that. Stated here so the modest
		// −N is not mistaken for the whole result.
		expect(executed).toBe(2 + 10 * N);
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
		await selectHeroTopPosts(countingDb, market?.id ?? "");
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
		// T-03 — the live read is now BATCHED ahead of the loop rather than
		// issued per market inside it. What R3 actually protects is unchanged and
		// is the second assertion: `pricing` is assigned from the LIVE read,
		// never from the cached block. The first assertion pins the batch call so
		// a revert to a per-market read inside the loop reddens here as well as
		// in the round-trip count above.
		expect(page).toContain("getMarketPricingAndReservesBatch(");
		expect(page).toContain("priceByMarket.get(m.id) ?? null");
		expect(page).toContain("pricing: priced?.pricing ?? null");
		// The negative half: the cached call's result must never feed `pricing`.
		expect(page).not.toMatch(/pricing:\s*data\./);
	});

	it("getCachedMarketDiscoveryData never reads reserves, and never keys on them", () => {
		// ⛔ THE REASON FLIPPED AT CACHE-KEY-1 AND THE ASSERTION GOT STRONGER.
		// It used to be: `reserves` must be a value the CALLER observed live,
		// because an internally-fetched one would hide behind a key the caller
		// never saw. Now `reserves` is not a parameter at all — the block is keyed
		// on the market id with a window — so an internal pool read would be
		// CACHED, and any figure derived from it would be stale money on the most
		// public surface in the product. Both halves are pinned: no read, and no
		// parameter to smuggle one back through.
		const block = functionBlock(
			read("src/server/discovery/list.ts"),
			"getCachedMarketDiscoveryData",
		);
		expect(block).toContain('"use cache"');
		expect(block).not.toContain("getMarketPricingAndReserves");

		const list = read("src/server/discovery/list.ts");
		const sig = list.slice(
			list.indexOf("export async function getCachedMarketDiscoveryData("),
			list.indexOf("): Promise<CachedMarketDiscoveryData>"),
		);
		expect(sig).not.toContain("reserves");
		// POSITIVE CONTROL — the slice really is the signature, so the negative
		// above is not passing against an empty string.
		expect(sig).toContain("marketId: string");
	});

	it("both cached discovery blocks carry an explicit cacheLife, and the per-market one is windowed", () => {
		const list = read("src/server/discovery/list.ts");
		for (const name of [
			"getCachedDiscoveryMarketIds",
			"getCachedMarketDiscoveryData",
		]) {
			const block = functionBlock(list, name);
			expect(block).toContain('"use cache"');
			// Explicit at the call site — never left to inherit the default
			// profile (Phase C self-check item 1).
			expect(block).toMatch(/cacheLife\(/);
		}

		// ⚠ THE TWO ARE DELIBERATELY DIFFERENT AND THE ASYMMETRY IS THE POINT.
		// The market-ID listing keeps the named `"minutes"` profile: it holds
		// WHICH markets are open, it is invalidated by the `discovery` tag on
		// open/close/void, and nothing about it decays on a clock. The per-market
		// block holds arguments, which do — so it takes the explicit
		// `SHARED_VIEW_MIN_WINDOW_MS` window (CACHE-KEY-1, ADR-0051).
		expect(functionBlock(list, "getCachedDiscoveryMarketIds")).toMatch(
			/cacheLife\(\s*["']minutes["']\s*\)/,
		);
		const perMarket = functionBlock(list, "getCachedMarketDiscoveryData");
		expect(perMarket).toMatch(/cacheLife\(\s*\{/);
		expect(perMarket).toContain("SHARED_VIEW_WINDOW_SEC");
		// Bound to the constant, never a literal — so the tune stays a one-line
		// change at `limits.ts` (the `cached-series.ts` rule, applied here).
		expect(list).toContain("SHARED_VIEW_MIN_WINDOW_MS / 1000");
		expect(perMarket).not.toMatch(/cacheLife\(\s*\{[^}]*\b15\b/);
	});

	it("hero.ts takes no reserves and withholds the one reserve-derived field", () => {
		// ⚠ REWRITTEN AT CACHE-KEY-1. This canary used to assert the opposite —
		// "selectHeroTopPosts keeps taking `reserves` and computing `currentValue`
		// exactly as before" — which was Design B's point while the block around it
		// was keyed on reserves. Once that key became a clock, a `currentValue`
		// computed inside the window would be a Đ amount derived from a pool that
		// has since moved. So the arithmetic moved OUT to `hero-value.ts`, and the
		// type is what enforces it: `HeroPostBase` omits the field, so a
		// `DiscoveryMarketView` cannot be built without composing it (**O-1**).
		const hero = read("src/server/discovery/hero.ts");
		expect(hero).toContain(
			"	marketId: string,\n): Promise<{ posts: HeroTopPostsBase; shares: HeroPostShares }> {",
		);
		expect(hero).toContain(
			'export type HeroPostBase = Omit<HeroPost, "currentValue">;',
		);
		// The arithmetic really is gone from this module, not merely unused.
		// ⚠ MATCHED ON THE IMPORT, NOT THE BARE NAME: this file's docblocks
		// legitimately say the word `computeSell` while explaining where the
		// figure went, and a scan that reddened on its own explanation would get
		// suppressed (the `cached-view-contract.test.ts` lesson).
		expect(hero).not.toContain('from "@/server/cpmm/calculate"');

		// …and really is present in the module that now owns it, so the negative
		// above cannot pass by the figure having been deleted outright.
		const value = read("src/server/discovery/hero-value.ts");
		expect(value).toContain("computeSell(");
		expect(value).toContain("export function valueHeroPosts(");
	});

	it("the page composes currentValue from the LIVE reserves, never from the cached block", () => {
		// The other half of the split: the omission above is only a safety
		// property if something puts the figure back from a live read. Without
		// this, a page that dropped `valueHeroPosts` would fail to compile — but a
		// page that passed it CACHED reserves would compile perfectly and render
		// stale money.
		const page = read("src/app/(public)/page.tsx");
		expect(page.replace(/\s+/g, " ")).toContain(
			"valueHeroPosts( data.topPosts, data.heroShares, priced?.reserves ?? null, )",
		);
		expect(page).not.toMatch(/valueHeroPosts\([^)]*data\.reserves/);
	});
});
