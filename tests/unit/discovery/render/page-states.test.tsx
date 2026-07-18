// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

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
//   whole-surface try/catch around ALL read-model composition —
//   `listOpenMarkets(db)` then per-market (sequential) `loadPriceSeries` +
//   `selectHeroTopPosts` → DiscoveryMarketView[]. ANY throw anywhere
//   (including the masking read inside selectHeroTopPosts) → `<ErrorState />`
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

vi.mock("@/db", () => ({ db: {} }));
vi.mock("@/server/discovery/list", () => ({ listOpenMarkets: vi.fn() }));
vi.mock("@/server/discovery/price-series", () => ({
	loadPriceSeries: vi.fn(),
}));
vi.mock("@/server/discovery/hero", () => ({ selectHeroTopPosts: vi.fn() }));

import { Suspense } from "react";

// RED import: the greenfield Slice-6 page under test (fails collection).
import * as page from "@/app/(public)/page";
import { EMPTY_COPY } from "@/components/discovery/EmptyState";
import { ERROR_COPY } from "@/components/discovery/ErrorState";
import { LoadingSkeleton } from "@/components/discovery/LoadingSkeleton";
import { type HeroTopPosts, selectHeroTopPosts } from "@/server/discovery/hero";
import { type DiscoveryCard, listOpenMarkets } from "@/server/discovery/list";
import {
	loadPriceSeries,
	type PricePoint,
} from "@/server/discovery/price-series";

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

/** Prime all three loaders on the happy path: the list resolves n cards;
 * every market gets the 1-point seed series; market 1 alone carries hero
 * posts (topPosts null/null elsewhere — the Slice-5 fixture shape). */
function primeHappyLoaders(n: number): DiscoveryCard[] {
	const list = cards(n);
	vi.mocked(listOpenMarkets).mockResolvedValue(list);
	vi.mocked(loadPriceSeries).mockResolvedValue(SEED_SERIES);
	vi.mocked(selectHeroTopPosts).mockImplementation(async (_client, marketId) =>
		marketId === list[0].id ? HERO_TOP_POSTS : { yes: null, no: null },
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
		// series + hero read exactly ONCE PER listed market, keyed by that
		// market's id, in list order (the plan-§3 sequential per-market walk).
		expect(vi.mocked(loadPriceSeries)).toHaveBeenCalledTimes(2);
		expect(vi.mocked(loadPriceSeries)).toHaveBeenNthCalledWith(
			1,
			expect.anything(),
			list[0].id,
		);
		expect(vi.mocked(loadPriceSeries)).toHaveBeenNthCalledWith(
			2,
			expect.anything(),
			list[1].id,
		);
		expect(vi.mocked(selectHeroTopPosts)).toHaveBeenCalledTimes(2);
		expect(vi.mocked(selectHeroTopPosts)).toHaveBeenNthCalledWith(
			1,
			expect.anything(),
			list[0].id,
		);
		expect(vi.mocked(selectHeroTopPosts)).toHaveBeenNthCalledWith(
			2,
			expect.anything(),
			list[1].id,
		);

		// Neither sibling state leaks into the happy path.
		expect(screen.queryByTestId("discovery-empty")).toBeNull();
		expect(screen.queryByTestId("discovery-error")).toBeNull();
	});

	it("render::zero-markets-empty-state-page", async () => {
		vi.mocked(listOpenMarkets).mockResolvedValue([]);

		render(await DiscoveryContent());

		// EmptyState — asserted via the imported OQ-6 const, never re-typed.
		expect(screen.getByTestId("discovery-empty")).toBeTruthy();
		expect(screen.getByText(EMPTY_COPY.title)).toBeTruthy();

		// No hero, no grid (plan §5 zero-markets row)…
		expect(screen.queryByTestId("discovery-carousel")).toBeNull();
		expect(screen.queryAllByTestId("market-card")).toHaveLength(0);
		// …and the per-market loaders NEVER run on an empty list.
		expect(vi.mocked(loadPriceSeries)).not.toHaveBeenCalled();
		expect(vi.mocked(selectHeroTopPosts)).not.toHaveBeenCalled();
	});

	it("render::read-model-throw-whole-surface-error", async () => {
		vi.mocked(listOpenMarkets).mockRejectedValue(
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
		// THE auditor's pin (the Slice-3 catch-granularity law): the list and
		// every series read succeed; the MASKING read (selectHeroTopPosts)
		// throws on the SECOND market only. A per-market/per-call catch would
		// render market 1 and default market 2's hero — masking fail-OPEN. The
		// law: the WHOLE surface fails closed instead.
		const list = cards(2);
		vi.mocked(listOpenMarkets).mockResolvedValue(list);
		vi.mocked(loadPriceSeries).mockResolvedValue(SEED_SERIES);
		vi.mocked(selectHeroTopPosts)
			.mockResolvedValueOnce(HERO_TOP_POSTS)
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

	it("render::loading-fallback-is-skeleton", () => {
		// Element INTROSPECTION only — the async child is never rendered here.
		// DiscoveryPage is SYNC by contract: it returns the Suspense boundary
		// immediately (an async page would return a Promise, failing el.type).
		const el = DiscoveryPage();
		expect(el.type).toBe(Suspense);
		// The fallback is the Slice-5 LoadingSkeleton — by component REFERENCE.
		expect(el.props.fallback.type).toBe(LoadingSkeleton);
		// The suspended child is the exported async body itself.
		expect(el.props.children.type).toBe(DiscoveryContent);

		// OQ-1 A pin: Discovery ships UNCACHED/dynamic v1 — the route segment
		// opts out of static prerender via the `dynamic` export; no 'use cache'.
		expect(page.dynamic).toBe("force-dynamic");
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
		// viewer-independent markup.
		expect(loggedIn.container.innerHTML).toBe(anon.container.innerHTML);
	});
});
