// @vitest-environment jsdom

import { existsSync } from "node:fs";
import { join } from "node:path";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { normalizeRadixIds } from "../../_support/dom-html";

// UI.A4 Slice 6 tests-first (plan §2 row 6 / §4 wiring / §5 state table) —
// the RED driver for the Discovery page `src/app/(public)/page.tsx`, the /
// route inside the ADR-0023 shell (the root `src/app/page.tsx` coming-soon
// placeholder is DELETED in the same slice — a route group adds no path
// segment, so both resolve to /).
//
// RED target: `@/app/(public)/page` does NOT exist yet — this file fails at
// COLLECTION on that unresolvable import until Slice 6's implement phase
// lands the page + performs the displacement.
//
// The page contract under test:
// - default export `DiscoveryPage` (SYNC): returns
//   `<Suspense fallback={<LoadingSkeleton />}><DiscoveryContent /></Suspense>`;
//   module export `dynamic === "force-dynamic"` (OQ-1 A — uncached/dynamic
//   v1, no 'use cache', no static prerender).
// - `DiscoveryContent` (async RSC body, exported for tests): ONE
//   whole-surface try/catch around ALL read-model composition — since S-4
//   Phase C: `getCachedDiscoveryMarketIds()` then, per market (sequential), a
//   LIVE `getMarketPricingAndReserves` and the cached
//   `getCachedMarketDiscoveryData(id, reserves)` → DiscoveryMarketView[].
//   (`loadPriceSeries` / `selectHeroTopPosts` still run — inside the cached
//   function — but are no longer this page's call surface.) ANY throw anywhere
//   (including the masking read that now sits inside the cached block)
//   → `<ErrorState />`
//   — the WHOLE surface fails closed; NEVER a partial render, NEVER a
//   per-market/per-call catch (the Slice-3 @security-auditor's
//   catch-granularity law: a per-call catch defaulting the removed-set would
//   flip masking fail-open). Zero markets → `<EmptyState />` (no hero, no
//   grid). Else → `<DiscoveryCarousel markets={views} />` with ALL ≤8
//   markets' hero data up-front — the carousel re-fetches nothing (§22).
//   NO session/viewer read — the body is viewer-independent (the header
//   identity is the (public)/layout's job, out of A4 scope; plan §5 row 1).
//
// Unit layer: the three read-model loaders AND `@/db` are mocked BEFORE
// imports (the page passes the db handle through to the mocked loaders —
// unit tests never touch a database). OQ-6 copy is asserted THROUGH the
// imported EMPTY_COPY/ERROR_COPY consts, never re-typed (plan §6). Fixtures
// reuse the Slice-5 carousel-suite style ("Discovery Market N" /
// `fixture-market-N`; hero prose = the composer-harness strings — no
// invented market content, CLAUDE.md §3).

// ⚠ REWIRED AT S-4 PHASE C. `DiscoveryContent` no longer calls
// `listOpenMarkets` / `loadPriceSeries` / `selectHeroTopPosts` directly: the
// shared reads moved behind `getCachedMarketDiscoveryData` (`'use cache'`),
// and pricing is now a SEPARATE live read the page performs per market. Those
// three still run — inside the cached function — but they are no longer this
// page's call surface, so mocking them here would mock nothing the page
// touches and the real ones would run against a jsdom environment with no DB.
// (That is exactly what happened: this suite went red at Phase D with the
// whole-surface ErrorState, because Phase C changed the composition and left
// these mocks pointing at the old names.)
vi.mock("@/db", () => ({ db: {} }));
vi.mock("@/server/discovery/list", () => ({
	getCachedDiscoveryMarketIds: vi.fn(),
	getCachedMarketDiscoveryData: vi.fn(),
}));
vi.mock("@/server/debate-view/market-pricing", () => ({
	getMarketPricingAndReserves: vi.fn(),
}));

import { Suspense } from "react";

// RED import: the greenfield Slice-6 page under test (fails collection).
import * as page from "@/app/(public)/page";
import { EMPTY_COPY } from "@/components/discovery/EmptyState";
import { ERROR_COPY } from "@/components/discovery/ErrorState";
import { LoadingSkeleton } from "@/components/discovery/LoadingSkeleton";
import { getMarketPricingAndReserves } from "@/server/debate-view/market-pricing";
import type { HeroTopPosts } from "@/server/discovery/hero";
import {
	type DiscoveryCard,
	getCachedDiscoveryMarketIds,
	getCachedMarketDiscoveryData,
} from "@/server/discovery/list";
import type { PricePoint } from "@/server/discovery/price-series";

import { EXTENDED, TITLE } from "../../composer/render/_harness";

const { DiscoveryContent } = page;
const DiscoveryPage = page.default;

const SEED_SERIES: PricePoint[] = [
	{ at: "2026-07-01T00:00:00.000Z", yes: "0.500000000000000000" },
];

/** Market 1's hero posts — BOTH sides present (the rest side-empty). */
const HERO_TOP_POSTS: HeroTopPosts = {
	yes: {
		id: "0190b3a0-9999-7000-8000-00000000000a",
		ordinal: 1,
		side: "YES",
		title: TITLE,
		teaser: EXTENDED,
		author: { pseudonym: "hero-yes-author", pfpUrl: "/pfp-placeholder.svg" },
		authorStake: "40.000000000000000000",
		entryPrice: "0.270000000000000000",
		replyCount: 24,
		replyDharma: "10000.000000000000000000",
		supportDharma: "3800.000000000000000000",
		counterDharma: "6200.000000000000000000",
		imageUrl: null,
		currentValue: null,
		createdAt: "2026-07-01T00:00:00.000Z",
	},
	no: {
		id: "0190b3a0-9999-7000-8000-00000000000b",
		ordinal: 2,
		side: "NO",
		title: TITLE,
		teaser: EXTENDED,
		author: { pseudonym: "hero-no-author", pfpUrl: "/pfp-placeholder.svg" },
		authorStake: "35.000000000000000000",
		entryPrice: "0.270000000000000000",
		replyCount: 24,
		replyDharma: "10000.000000000000000000",
		supportDharma: "3800.000000000000000000",
		counterDharma: "6200.000000000000000000",
		imageUrl: null,
		currentValue: null,
		createdAt: "2026-07-01T00:01:00.000Z",
	},
};

/** n distinct DiscoveryCard literals: "Discovery Market 1…n" (Slice-5 style). */
function cards(n: number): DiscoveryCard[] {
	return Array.from({ length: n }, (_, i): DiscoveryCard => {
		const ordinal = i + 1;
		const first = i === 0;
		return {
			id: `0190b3a0-9999-7000-8000-${String(ordinal).padStart(12, "0")}`,
			slug: `fixture-market-${ordinal}`,
			title: `Discovery Market ${ordinal}`,
			pricing: { yes: "0.380000000000000000", no: "0.620000000000000000" },
			totals: {
				dharmaStaked: first ? "75.000000000000000000" : "0.000000000000000000",
				postCount: first ? 2 : 0,
				replyCount: 0,
			},
			imageUrl: null,
		};
	});
}

/** Prime the happy path across S-4 Phase C's THREE-call composition: the
 * cached id list resolves n markets; each gets a LIVE pricing read; each gets
 * its cached block (1-point seed series, market 1 alone carrying hero posts —
 * the Slice-5 fixture shape).
 *
 * `reserves: null` throughout: these are page-state tests (Empty/Error/
 * Loading), not V13 valuation tests. `null` reserves are a legal input — it is
 * what the page passes when a market has no pool row — and they still exercise
 * the full call sequence. */
function primeHappyLoaders(n: number): DiscoveryCard[] {
	const list = cards(n);
	vi.mocked(getCachedDiscoveryMarketIds).mockResolvedValue(
		list.map((c) => ({ id: c.id, slug: c.slug, title: c.title })),
	);
	vi.mocked(getMarketPricingAndReserves).mockImplementation(
		async (_client, marketId) => {
			const card = list.find((c) => c.id === marketId);
			return card?.pricing
				? { pricing: card.pricing, reserves: { yes: "1", no: "1" } }
				: null;
		},
	);
	vi.mocked(getCachedMarketDiscoveryData).mockImplementation(
		async (marketId) => {
			const card = list.find((c) => c.id === marketId);
			return {
				totals: card?.totals ?? {
					dharmaStaked: "0.000000000000000000",
					postCount: 0,
					replyCount: 0,
				},
				imageUrl: null,
				series: SEED_SERIES,
				topPosts:
					marketId === list[0].id ? HERO_TOP_POSTS : { yes: null, no: null },
			};
		},
	);
	return list;
}

describe("UI.A4 §6 — Discovery page states (wiring)", () => {
	afterEach(() => {
		cleanup();
		// resetAllMocks (not the DB-suite clearAllMocks): every mock here is a
		// bare vi.fn() primed per-test with mockResolvedValue*/mockImplementation
		// — reset strips the queued implementations so no test inherits a
		// previous test's data; an unprimed loader then fails LOUDLY.
		vi.resetAllMocks();
	});

	it("render::markets-render-carousel", async () => {
		const list = primeHappyLoaders(2);

		render(await DiscoveryContent());

		// The carousel arm renders with BOTH markets' cards.
		expect(screen.getByTestId("discovery-carousel")).toBeTruthy();
		expect(screen.getAllByTestId("market-card")).toHaveLength(2);

		// The §22 all-up-front composition (the carousel re-fetches NOTHING):
		// each listed market gets its cached block exactly ONCE, keyed by that
		// market's id, in list order (the plan-§3 sequential per-market walk).
		expect(vi.mocked(getCachedMarketDiscoveryData)).toHaveBeenCalledTimes(2);
		expect(vi.mocked(getCachedMarketDiscoveryData)).toHaveBeenNthCalledWith(
			1,
			list[0].id,
			// S-4 Phase C: the SECOND argument is the market's live pool reserves,
			// and it is the cache KEY — which is what makes a hit impossible once a
			// bet has moved the pool. The fixture's pricing mock supplies these.
			{ yes: "1", no: "1" },
		);
		expect(vi.mocked(getCachedMarketDiscoveryData)).toHaveBeenNthCalledWith(
			2,
			list[1].id,
			{ yes: "1", no: "1" },
		);

		// R3 — pricing is read LIVE, once per market, OUTSIDE the cached block.
		// If this ever stopped being called per market, price would be coming
		// from cache, which is the one thing the boundary exists to prevent.
		expect(vi.mocked(getMarketPricingAndReserves)).toHaveBeenCalledTimes(2);

		// Neither sibling state leaks into the happy path.
		expect(screen.queryByTestId("discovery-empty")).toBeNull();
		expect(screen.queryByTestId("discovery-error")).toBeNull();
	});

	it("render::zero-markets-empty-state-page", async () => {
		vi.mocked(getCachedDiscoveryMarketIds).mockResolvedValue([]);

		render(await DiscoveryContent());

		// EmptyState — asserted via the imported OQ-6 const, never re-typed.
		expect(screen.getByTestId("discovery-empty")).toBeTruthy();
		expect(screen.getByText(EMPTY_COPY.title)).toBeTruthy();

		// No hero, no grid (plan §5 zero-markets row)…
		expect(screen.queryByTestId("discovery-carousel")).toBeNull();
		expect(screen.queryAllByTestId("market-card")).toHaveLength(0);
		// …and NEITHER per-market read runs on an empty list — the live pricing
		// read included, which is new at Phase C and must not fire either.
		expect(vi.mocked(getMarketPricingAndReserves)).not.toHaveBeenCalled();
		expect(vi.mocked(getCachedMarketDiscoveryData)).not.toHaveBeenCalled();
	});

	it("render::read-model-throw-whole-surface-error", async () => {
		vi.mocked(getCachedDiscoveryMarketIds).mockRejectedValue(
			new Error("simulated list read failure"),
		);

		// The whole-surface catch converts the throw into <ErrorState /> — a
		// rejected DiscoveryContent() promise would fail this await loudly.
		render(await DiscoveryContent());

		expect(screen.getByTestId("discovery-error")).toBeTruthy();
		expect(screen.getByText(ERROR_COPY.title)).toBeTruthy();

		// The surface fails CLOSED — no carousel, no partial content.
		expect(screen.queryByTestId("discovery-carousel")).toBeNull();
		expect(screen.queryAllByTestId("market-card")).toHaveLength(0);
	});

	it("render::masking-read-throw-whole-surface-error", async () => {
		// THE auditor's pin (the Slice-3 catch-granularity law): the id list and
		// market 1 both succeed; the read carrying MASKING throws on the SECOND
		// market only. A per-market/per-call catch would render market 1 and
		// default market 2's hero — masking fail-OPEN. The law: the WHOLE
		// surface fails closed instead.
		//
		// ⚠ S-4 Phase C moved the masking read INSIDE `getCachedMarketDiscoveryData`
		// (`selectHeroTopPosts` → `loadRemovedSet` is called there now), so the
		// throw is staged on that boundary rather than on `selectHeroTopPosts`
		// directly. The property under test is unchanged: a masking failure on
		// ANY market takes the whole surface down. What this now ALSO covers is
		// that wrapping the read in a cache did not introduce a per-market catch
		// that would swallow it.
		const list = cards(2);
		vi.mocked(getCachedDiscoveryMarketIds).mockResolvedValue(
			list.map((c) => ({ id: c.id, slug: c.slug, title: c.title })),
		);
		vi.mocked(getMarketPricingAndReserves).mockResolvedValue({
			pricing: { yes: "0.5", no: "0.5" },
			reserves: { yes: "1", no: "1" },
		});
		vi.mocked(getCachedMarketDiscoveryData)
			.mockResolvedValueOnce({
				totals: list[0].totals,
				imageUrl: null,
				series: SEED_SERIES,
				topPosts: HERO_TOP_POSTS,
			})
			.mockRejectedValueOnce(new Error("simulated masking read failure"));

		render(await DiscoveryContent());

		// The whole surface is the error state…
		expect(screen.getByTestId("discovery-error")).toBeTruthy();
		expect(screen.getByText(ERROR_COPY.title)).toBeTruthy();
		// …and NOT ONE market renders (the partial-render ban): no carousel,
		// no hero, zero market cards — market 1's already-resolved data must
		// not surface.
		expect(screen.queryByTestId("discovery-carousel")).toBeNull();
		expect(screen.queryByTestId("hero-panels")).toBeNull();
		expect(screen.queryAllByTestId("market-card")).toHaveLength(0);
	});

	it("render::no-route-group-loading-boundary", () => {
		// The contract `page.tsx:28-30` states in prose and NOTHING guarded: the
		// Suspense boundary is scoped to THIS page precisely so a route-group
		// `loading.tsx` does not blanket `/m/[slug]` too (POLISH-0 §3).
		//
		// This assertion is FILESYSTEM, not element-tree, and that is the whole
		// point. Every element assertion in the cell below introspects what
		// `DiscoveryPage()` returns; adding a sibling `loading.tsx` changes
		// Next's ROUTING and not that return value, so all of them stay green.
		// Proven at POLISH.2 Gate C: with the file present the ENTIRE suite —
		// 306 files, 2706 tests — passed. The contract had been unguarded since
		// UI.A4 and a comment is not a guard (V-3: asserting a call exists is
		// not asserting what it does).
		//
		// Same shape as `tests/unit/shell/not-found.test.tsx:165`, the footer
		// regression belt: read the real tree, assert the absence.
		expect(
			existsSync(join(process.cwd(), "src/app/(public)/loading.tsx")),
		).toBe(false);
	});

	it("render::loading-fallback-is-skeleton", () => {
		// Element INTROSPECTION only — the async child is never rendered here.
		// DiscoveryPage is SYNC by contract: an async page would return a
		// Promise. That contract is asserted DIRECTLY now rather than inferred
		// from `el.type`, because POLISH.2 V2 put the page inset on a wrapper
		// element and the boundary is no longer the literal root.
		const el = DiscoveryPage();
		expect(el).not.toBeInstanceOf(Promise);

		// V2 — the mockup's `.content` inset (16px 28px 12px,
		// surface_discovery_v1_0.html:67-68), pinned so it cannot silently
		// regress. Re-tuning these at D2b is a deliberate edit, not a drift.
		expect(el.type).toBe("div");
		// ⚠ HTML-FINISH row 8 added the three LAYOUT classes. The mockup's
		// `.content` is `flex:1 1 auto` in a column (`:67-68` — the same rule
		// that carries the inset), so the element that owns the inset is also
		// the one that passes the page's height down to the carousel.
		// Still FULL-STRING equality, deliberately: the inset values are what
		// this line exists to protect and a `toContain` would stop protecting
		// them. The VALUE half is byte-identical — `px-7 pt-4 pb-3` is
		// untouched; only topology was added.
		expect(el.props.className).toBe("flex flex-1 flex-col px-7 pt-4 pb-3");
		// The inset triple, asserted separately so a future reorder of the
		// class string cannot quietly drop one of them.
		for (const inset of ["px-7", "pt-4", "pb-3"]) {
			expect(el.props.className.split(" ")).toContain(inset);
		}

		// The inset wraps BOTH states, so the skeleton and the loaded surface
		// sit on the same inset and the page does not jump on hydration.
		const boundary = el.props.children;
		expect(boundary.type).toBe(Suspense);
		// The fallback is the Slice-5 LoadingSkeleton — by component REFERENCE.
		expect(boundary.props.fallback.type).toBe(LoadingSkeleton);
		// The suspended child is the exported async body itself.
		expect(boundary.props.children.type).toBe(DiscoveryContent);

		// OQ-1 A pin: Discovery ships UNCACHED/dynamic v1 — no 'use cache' yet.
		// S-4 Phase B: `dynamic` is gone (redundant/build-breaking under
		// `cacheComponents`); `instant = false` is the equivalent opt-out until
		// the S-4 Phase C/D cache retrofit lands.
		expect(page.instant).toBe(false);
	});

	it("render::anon-and-logged-in-body-identical", async () => {
		primeHappyLoaders(2);

		// Compile-level viewer-independence: DiscoveryContent accepts NO
		// viewer/session input — it is called with ZERO args (a viewer param
		// would fail tsc here). The header identity is the (public)/layout's
		// job, out of A4 scope (plan §5 row 1) — the BODY cannot vary by
		// viewer because no viewer can reach it.
		const anon = render(await DiscoveryContent());
		const loggedIn = render(await DiscoveryContent());

		// Non-vacuous: the body actually rendered content…
		expect(anon.container.innerHTML.length).toBeGreaterThan(0);
		// …and two composals are byte-identical — deterministic,
		// viewer-independent markup. Normalized for Radix's own per-root
		// `radix-_r_<n>_` trigger/content pairing id (INFO-1's `InfoTip`, inside
		// `StatLine`) — a property of which React root rendered it, not of
		// either composal, and not what this assertion exists to catch.
		expect(normalizeRadixIds(loggedIn.container.innerHTML)).toBe(
			normalizeRadixIds(anon.container.innerHTML),
		);
	});
});
