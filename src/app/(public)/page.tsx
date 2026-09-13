import { Suspense } from "react";
import type { DiscoveryMarketView } from "@/components/discovery/DiscoveryCarousel";
import { DiscoveryCarousel } from "@/components/discovery/DiscoveryCarousel";
import { EmptyState } from "@/components/discovery/EmptyState";
import { ErrorState } from "@/components/discovery/ErrorState";
import { LoadingSkeleton } from "@/components/discovery/LoadingSkeleton";
import { db } from "@/db";
import { getMarketPricingAndReservesBatch } from "@/server/debate-view/market-pricing";
import { valueHeroPosts } from "@/server/discovery/hero-value";
import {
	getCachedDiscoveryMarketIds,
	getCachedMarketDiscoveryData,
} from "@/server/discovery/list";
import { withLiveTail } from "@/server/discovery/price-series";
import { recordCacheAttempt } from "@/server/observability/cache-metrics";

/**
 * OQ-1 A (ratified §16): Discovery's R-2 cache retrofit landed at S-4 Phase C
 * — `getCachedDiscoveryMarketIds` / `getCachedMarketDiscoveryData`
 * (`server/discovery/list.ts`) carry `'use cache'`; this page itself stays
 * uncached, composing them plus a live per-market pricing read (see
 * `DiscoveryContent` below). S-4 Phase B enabled `cacheComponents`, under
 * which `force-dynamic` is redundant (Next.js: "all pages are dynamic by
 * default") and errors the build if left in place. `instant = false`
 * replaces it here as the equivalent opt-out — this route still isn't
 * restructured for the framework's instant-navigation validation (that's the
 * `cookies()`/`headers()` Suspense hoist, S-4 Phase D territory, not this
 * page's concern since it reads neither), so it defers that check rather
 * than forcing static prerendering it was never meant to have.
 */
export const instant = false;

/**
 * Discovery — the public front page at `/` (SPEC.1 §22; UI.A4 Slice 6).
 * Displaces the pre-launch coming-soon placeholder (`src/app/page.tsx`,
 * deleted this slice — a route group adds no path segment) and renders
 * inside the ADR-0023 `(public)/` shell: the layout owns the header and the
 * single `<main>`; anonymous and authenticated viewers get the SAME body
 * (header identity is the layout's concern — plan §5 row 1).
 *
 * The sync shell mounts the streaming boundary: `LoadingSkeleton` is the
 * §4.10 load state (Suspense fallback — no route-group `loading.tsx`, which
 * would blanket `/m/[slug]` too; the boundary is scoped HERE).
 *
 * INSET, NOT A CONTAINER (POLISH.2 V2). The mockup's `.content` carries
 * `padding:16px 28px 12px` inside a full-width screen — no max-width, no
 * centering. That is exactly what this is: `PageContainer`'s note that
 * "DISCOVERY (`/`) TAKES NO CONTAINER. Full-bleed is deliberate" still holds
 * and is NOT weakened here — full-bleed means no max-width and no `mx-auto`,
 * both still absent. The inset lives on the page rather than in a preset
 * because no other route wants a container-less inset, and `PageContainer` is
 * shell-owned (out of POLISH.2's scope).
 */
export default function DiscoveryPage() {
	return (
		// HTML-FINISH row 8 — the mockup's `.content` is `flex:1 1 auto` in a
		// column (`:67-68`), i.e. it takes the height `<main>` now provides and
		// passes it on. The inset itself is V2/PD-2-01 and is unchanged.
		// ⛔ The mockup's `min-height:0` on this element is NOT ported: it is
		// what would let the column shrink below its content and clip. Without
		// it flex items keep `min-height:auto`, so they grow into slack and the
		// PAGE scrolls when there is none (RULED A1).
		<div className="flex flex-1 flex-col px-7 pt-4 pb-3">
			<Suspense fallback={<LoadingSkeleton />}>
				<DiscoveryContent />
			</Suspense>
		</div>
	);
}

/**
 * The async read-model composition (exported for the page-states/wiring
 * suites): all ≤ `DISCOVERY_GRID_SIZE` markets' card + series + hero data
 * up-front — the carousel is client-side motion over already-loaded props
 * and re-fetches NOTHING (§22).
 *
 * S-4 Phase C — split into a CACHED half and a LIVE half, never a single
 * uncached loop the way this used to read:
 *   - `getCachedDiscoveryMarketIds()` — cached, the Open-markets set.
 *   - `getMarketPricingAndReservesBatch` — LIVE, every render, never cached in
 *     any form, one statement for the whole surface (T-03). `pricing` goes
 *     straight onto `card` from here.
 *   - `getCachedMarketDiscoveryData(id)` — cached, keyed on the market id
 *     ALONE with a `SHARED_VIEW_MIN_WINDOW_MS` window (CACHE-KEY-1,
 *     ADR-0051). ⚠ IT USED TO TAKE `reserves` AS A SECOND ARGUMENT, and that
 *     is what this task removed: a `'use cache'` key is its argument list, so
 *     every bet moved the pool, changed the key, and forced a miss for every
 *     reader — the cache worked on quiet markets and not at all on busy ones.
 *   - `valueHeroPosts(...)` — the one figure that could NOT simply move
 *     behind the window. `topPosts[].currentValue` is `computeSell` over the
 *     live pool, i.e. money on a public surface, so the cached block returns
 *     the share counts and the figure is composed HERE against the batched
 *     live read. The type enforces it: `HeroTopPostsBase` omits the field.
 * `reserves` itself stays a server-local binding throughout — never pushed
 * onto `card`, which crosses into the `"use client"` carousel (C8/V13), and
 * neither is `heroShares`, for the same reason.
 *
 * ONE whole-surface try/catch: ANY read-model throw — including the masking
 * read inside `selectHeroTopPosts` (now reached via `getCachedMarketDiscoveryData`)
 * — renders `ErrorState` for the WHOLE surface. Never a partial render, never
 * a per-market/per-call catch: a narrower catch that defaulted the
 * removed-set would flip Track-B masking fail-open (the Slice-3
 * @security-auditor catch-granularity law). Zero markets → the §22 empty
 * state (no hero, no grid). Viewer-independent — no session read anywhere in
 * the body.
 */
export async function DiscoveryContent() {
	let views: DiscoveryMarketView[];
	try {
		recordCacheAttempt("discovery-list", null);
		const marketIds = await getCachedDiscoveryMarketIds();
		// T-03 — ONE pool read for every market on the surface, not one per
		// market in series. This read is deliberately never cached (it is the
		// live price), so before batching every visitor paid one round trip per
		// open market, sequentially, before the page could render. Batching is
		// the right shape rather than `Promise.all` precisely because the open
		// connection bottleneck is what hurts here: this takes ONE connection
		// once, where concurrent singular reads would take one per market at the
		// worst possible moment. `priceByMarket.get(id) ?? null` below reproduces
		// the singular read's defensive-null contract for a market with no pool.
		const priceByMarket = await getMarketPricingAndReservesBatch(
			db,
			marketIds.map((m) => m.id),
		);
		views = [];
		for (const m of marketIds) {
			const priced = priceByMarket.get(m.id) ?? null;
			recordCacheAttempt("market-data", m.id);
			const data = await getCachedMarketDiscoveryData(m.id);
			views.push({
				card: {
					id: m.id,
					slug: m.slug,
					title: m.title,
					pricing: priced?.pricing ?? null,
					totals: data.totals,
					imageUrl: data.imageUrl,
				},
				// CHART-1 — the hero chart's live right edge (SPEC.1 1.0.45 §9).
				// `data.series` is floored history from `getCachedReserveWalk`; the
				// terminal point is composed HERE from `priced`, the same live pool
				// read two lines above that already fills `card.pricing` and renders
				// in the price bar. Zero additional queries — that is the only reason
				// the history is allowed to be a minute old.
				//
				// ⚠ `nowIso` is read at RENDER, never inside the cache: a clock read
				// behind a cached boundary freezes for the whole window, which would
				// put an `Open` market's "now" edge up to a minute in the past — the
				// exact defect this composition exists to prevent.
				//
				// ⛔ `isOpen` IS A LITERAL HERE, AND ITS LICENCE IS PINNED — read the
				// guard before changing either. Every market on this surface is
				// `Open` by construction, because `getCachedDiscoveryMarketIds`
				// filters `status = 'Open'`. That licence is a fact about ANOTHER
				// function, so it is held by
				// `tests/server/discovery/live-tail-wiring.test.ts` →
				// "Discovery's isOpen literal is licensed by the Open filter, and the
				// two are pinned together", which asserts the literal and that
				// `where` in one breath and carries a control proving it fails on a
				// widened filter.
				//
				// ⚠ WHY A LITERAL RATHER THAN A READ, measured at CHART-1.A: neither
				// cached shape carries `status` — `DiscoveryMarketId` is
				// `{id, slug, title}` and `CachedMarketDiscoveryData` is
				// `{totals, imageUrl, series, topPosts}` — and adding it to the
				// projection would be theatre, not a read: a SELECT from a query that
				// already filters `status = 'Open'` can only ever return `'Open'`, so
				// it would carry exactly the information this literal carries while
				// looking dynamic. The filter IS the observation; the guard is what
				// makes it load-bearing. INV-4 is not reachable from here; the
				// non-`Open` branch is exercised on `/m/[slug]`.
				series: withLiveTail(data.series, {
					spotYes: priced?.pricing.yes ?? null,
					nowIso: new Date().toISOString(),
					isOpen: true,
				}),
				// CACHE-KEY-1 — the hero's `Đ staked → Đ now` right-hand figure,
				// composed HERE from `priced`, the same live pool read that already
				// fills `card.pricing` two lines above. Zero additional queries.
				//
				// ⛔ IT CANNOT BE SKIPPED BY ACCIDENT (**O-1**). `data.topPosts` is
				// `HeroTopPostsBase` — `currentValue` OMITTED — so assigning it
				// directly is a type error rather than a silently missing figure.
				// That omission is the whole reason the cached block may now be
				// keyed on identity: everything it still carries is content or a
				// count and may lag one window, while a Đ amount on the most public
				// surface in the product may not. See `hero-value.ts`.
				topPosts: valueHeroPosts(
					data.topPosts,
					data.heroShares,
					priced?.reserves ?? null,
				),
				// CHART-2 — `C-CHART-2` clause 1's terminal pulse, carried to the
				// hero chart. ⛔ THE SECOND SPENDING OF THE SAME LICENCE, and it is
				// deliberately written adjacent to the first so the two are read
				// together: both are `true` for exactly one reason — every market on
				// this surface is `Open` by construction, because
				// `getCachedDiscoveryMarketIds` filters `status = 'Open'`. Neither is
				// an assumption about a market; both are restatements of that filter.
				// ⚠ THEY ARE PINNED TOGETHER, NOT SEPARATELY.
				// `tests/server/discovery/live-tail-wiring.test.ts` asserts this file
				// carries exactly two `isOpen: true` and no `isOpen: false`, beside
				// the `where` that licenses them — so a widened filter reds the suite
				// once for both rather than leaving one of them quietly wrong.
				isOpen: true,
			});
		}
	} catch {
		// Whole-surface fail-closed. The OQ-6 reload button is LIVE —
		// ErrorState is a "use client" leaf calling window.location.reload()
		// (R4 ruling, 2026-07-18), so the handler-less RSC render is complete.
		return <ErrorState />;
	}

	if (views.length === 0) {
		return <EmptyState />;
	}
	return <DiscoveryCarousel markets={views} />;
}
