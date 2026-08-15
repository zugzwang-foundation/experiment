// @vitest-environment jsdom
// SPDX-License-Identifier: AGPL-3.0-or-later

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * HTML-FINISH · BOOKMARKS R2 — the arrangement guards.
 *
 * ⚠⚠ THIS FILE REPLACES R1'S, AND THE REPLACEMENT IS THE POINT. R1 asserted ONE
 * panel and a card list, and it was GREEN on a wrong shape — because it encoded
 * R1's reading of the surface rather than the surface's own spec. The founder
 * overruled that reading; SPEC.1 `:1665` defers this route to ADR-0032, whose
 * D-5 rules the page *"reuses the Profile surface in forced-visitor mode"*.
 * A guard that pins the wrong shape is worse than no guard, so it moves with
 * the code rather than being left to pass.
 *
 * ⚠ ASSERTS ON STRUCTURE, never on `textContent` alone (CLAUDE.md §8 `O-7`).
 * ⚠ NO VALUE IS ASSERTED — colour, radius, px and type size belong to the
 * shipped dark token system; what is pinned is topology and containment.
 *
 * No jest-dom in this repo (AGENTS.md §9) — plain DOM assertions only.
 */

vi.mock("@/db", () => ({ db: {} }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));
vi.mock("next/navigation", () => ({
	redirect: vi.fn(),
	useRouter: () => ({ refresh: vi.fn() }),
}));
vi.mock("@/server/auth", () => ({ auth: { api: { getSession: vi.fn() } } }));
vi.mock("@/server/bookmarks/list", () => ({ loadBookmarks: vi.fn() }));
vi.mock("@/server/profile/positions", () => ({
	loadProfilePositions: vi.fn(async () => []),
}));
vi.mock("@/server/profile/graph-series", () => ({
	loadProfileGraphSeries: vi.fn(async () => ({
		windowStart: "2026-09-15T00:00:00.000Z",
		windowEnd: "2026-11-05T23:59:00.000Z",
		yMax: 10000,
		freeDharma: [],
		netWorth: [],
		perMarket: [],
		nodes: [],
	})),
}));
vi.mock("@/server/profile/tiles", () => ({
	loadProfileTiles: vi.fn(async () => ({
		walletValue: "500.000000000000000000",
		positionsValue: "120.000000000000000000",
		netProfitLoss: "-30.000000000000000000",
		argumentsCount: { total: 5, posts: 3, replies: 2 },
		supportReceived: "40.000000000000000000",
		counterReceived: "12.000000000000000000",
	})),
}));
vi.mock("@/server/profile/resolve", () => ({
	resolveProfileUser: vi.fn(async () => ({
		id: "0190b3a0-9999-7000-8000-00000000000f",
		pseudonym: "RedFox001",
		banned: false,
		pfpUrl: "/pfp-placeholder.svg",
	})),
}));

import * as bookmarksPage from "@/app/(public)/bookmarks/page";
import { auth } from "@/server/auth";
import type { BookmarkItem } from "@/server/bookmarks/list";
import { loadBookmarks } from "@/server/bookmarks/list";

const BookmarksPage = bookmarksPage.default;

afterEach(cleanup);

beforeEach(() => {
	vi.mocked(auth.api.getSession).mockResolvedValue({
		user: {
			id: "0190b3a0-9999-7000-8000-00000000000f",
			pseudonym: "RedFox001",
		},
	} as unknown as Awaited<ReturnType<typeof auth.api.getSession>>);
	vi.mocked(loadBookmarks).mockResolvedValue([]);
});

/** Fixture labels only — never a market question or resolution criterion
 *  (CLAUDE.md §3 forbids inventing market content). */
function item(n: number, over: Partial<BookmarkItem> = {}): BookmarkItem {
	return {
		removed: false,
		kind: "post",
		id: `0190c0de-ffff-7000-8000-00000000010${n}`,
		side: n % 2 === 0 ? "YES" : "NO",
		marketSlug: `fixture-${n}`,
		marketTitle: `Market fixture-${n}`,
		ordinal: n,
		title: `Fixture argument ${n}`,
		teaser: `Fixture teaser ${n}`,
		body: `Fixture body ${n}`,
		marker: "none",
		authorStake: "25.000000000000000000",
		priceAtBet: "0.380000000000000000",
		createdAt: "2026-08-15T00:00:00.000Z",
		aggregate: {
			supportCount: 2,
			counterCount: 1,
			supportDharma: "30.000000000000000000",
			counterDharma: "10.000000000000000000",
		},
		authorPseudonym: "BlueHare002",
		staked: "25.000000000000000000",
		current: "31.000000000000000000",
		...over,
	} as BookmarkItem;
}

describe("R2 · the surface is the Profile arrangement", () => {
	it("renders the TOP BAND — identity card and graph slot, side by side", async () => {
		render(await BookmarksPage());
		const band = screen.getByTestId("bookmarks-headzone");
		expect(band.contains(screen.getByTestId("identity-card"))).toBe(true);
		// The six tiles live INSIDE the identity block (HTML-FINISH row 8).
		expect(band.contains(screen.getByTestId("profile-tiles"))).toBe(true);
		// The band does NOT grow — only the arena divides the leftover height.
		expect(band.getAttribute("class")).not.toContain("flex-1");
	});

	it("the tiles are the VIEWER's own record, all six", async () => {
		render(await BookmarksPage());
		for (const t of [
			"tile-wallet",
			"tile-positions",
			"tile-net-pl",
			"tile-arguments",
			"tile-support",
			"tile-counter",
		]) {
			expect(screen.getByTestId(t)).toBeTruthy();
		}
	});

	it("renders a TWO-PANEL arena — the table and the replica", async () => {
		vi.mocked(loadBookmarks).mockResolvedValue([item(1), item(2)]);
		const { container } = render(await BookmarksPage());
		const arena = screen.getByTestId("bookmarks-arena");
		expect(arena.contains(screen.getByTestId("bookmarks-panel"))).toBe(true);
		expect(arena.contains(screen.getByTestId("replica-panel"))).toBe(true);
		expect(container.querySelectorAll("[data-testid$='-panel']").length).toBe(
			2,
		);
	});

	it("the table has FIVE columns with the arrow track FOURTH", async () => {
		vi.mocked(loadBookmarks).mockResolvedValue([item(1)]);
		render(await BookmarksPage());
		const heads = [
			...screen.getByTestId("bookmarks-table").querySelectorAll("thead th"),
		];
		expect(heads.length).toBe(5);
		expect(heads.map((h) => h.textContent)).toEqual([
			"Position",
			"Argument",
			"Staked",
			"",
			"Current",
		]);
	});

	it("SELECTION drives the replica — clicking a row swaps the argument read", async () => {
		// ⚠ THE WHOLE POINT OF THE REPLICA. Without this the right panel is a
		// static decoration; the assertion is that the SECOND row's body replaces
		// the first, not merely that a body exists.
		vi.mocked(loadBookmarks).mockResolvedValue([item(1), item(2)]);
		render(await BookmarksPage());
		expect(screen.getByTestId(`replica-${item(1).id}`)).toBeTruthy();
		fireEvent.click(screen.getByTestId(`bookmark-row-${item(2).id}`));
		expect(screen.getByTestId(`replica-${item(2).id}`)).toBeTruthy();
		expect(screen.queryByTestId(`replica-${item(1).id}`)).toBeNull();
	});

	it("the replica reads the argument BODY whole, unclamped", async () => {
		vi.mocked(loadBookmarks).mockResolvedValue([item(1)]);
		render(await BookmarksPage());
		const body = screen.getByTestId(`replica-body-${item(1).id}`);
		expect(body.textContent).toBe("Fixture body 1");
		// ⛔ NOT clamped — the panel body scrolls, so the argument is read in full.
		expect(body.getAttribute("class")).not.toContain("line-clamp");
	});

	it("`Bookmarks` titles the LEFT panel exactly once", async () => {
		vi.mocked(loadBookmarks).mockResolvedValue([item(1)]);
		const { container } = render(await BookmarksPage());
		const exact = [...container.querySelectorAll("*")].filter(
			(el) => el.children.length === 0 && el.textContent === "Bookmarks",
		);
		expect(exact.length).toBe(1);
		expect(exact[0]?.tagName).toBe("H1");
		expect(
			screen.getByTestId("bookmarks-panel-head").contains(exact[0] as Node),
		).toBe(true);
	});

	it("the RIGHT panel is titled by the selected item's market, never a placeholder", async () => {
		vi.mocked(loadBookmarks).mockResolvedValue([item(1)]);
		render(await BookmarksPage());
		const head = screen.getByTestId("replica-panel-head");
		expect(head.textContent).toContain("Market fixture-1");
		// The mockup's no-selection placeholder is the dummy string `Market title`.
		expect(head.textContent).not.toContain("Market title");
	});

	it("⛔ THE BLOCKED PARTS RENDER NOTHING — each named", async () => {
		vi.mocked(loadBookmarks).mockResolvedValue([item(1)]);
		const { container } = render(await BookmarksPage());
		const html = container.innerHTML;
		// 1. No Open/Closed status filter — needs `statusLabel`, DATA-BLOCKED.
		expect(screen.queryByTestId("bookmarks-status-filter")).toBeNull();
		// 2. No status badge in the Position cell — same missing field.
		expect(screen.queryByTestId(`position-status-${item(1).id}`)).toBeNull();
		// 3. NEVER a Sell mount — ADR-0032 D-5, on this route by ruling.
		expect(html).not.toContain("sell-trigger");
		expect(html.toLowerCase()).not.toContain(">sell<");
		// 4. No author avatar in the replica head — `resolveAuthors` returns no
		//    PFP, so the head carries the name alone.
		const replica = screen.getByTestId(`replica-${item(1).id}`);
		expect(replica.querySelector("img")).toBeNull();
		expect(screen.getByTestId("replica-author").textContent).toBe(
			"BlueHare002",
		);
	});

	it("⛔ NO LIVE PRICE anywhere — `priceAtBet` is never printed as one", async () => {
		// ⚠⚠ THE ONE THAT WOULD LIE. The mockup's right colhead carries a live
		// price; `priceAtBet` is the FROZEN entry price and a different quantity.
		// The replica panel head must carry the market title and no percentage.
		vi.mocked(loadBookmarks).mockResolvedValue([item(1)]);
		render(await BookmarksPage());
		expect(screen.getByTestId("replica-panel-head").textContent).not.toMatch(
			/%/,
		);
	});

	it("the market filter keys on marketSlug, and filtering cannot strand the list", async () => {
		vi.mocked(loadBookmarks).mockResolvedValue([item(1), item(2)]);
		render(await BookmarksPage());
		fireEvent.click(screen.getByTestId("bookmarks-market-filter"));
		// The option testid IS the key — `marketSlug`, because `BookmarkItem`
		// carries no `marketId`.
		fireEvent.click(screen.getByTestId("bookmarks-market-option-fixture-2"));
		expect(screen.getByTestId(`bookmark-row-${item(2).id}`)).toBeTruthy();
		expect(screen.queryByTestId(`bookmark-row-${item(1).id}`)).toBeNull();
		// Every option came FROM the items, so no choice can empty the table —
		// which is why this surface needs no stranded-filter copy.
		expect(screen.queryByTestId("bookmarks-empty-filtered")).toBeNull();
	});

	it("a REMOVED item keeps its slot and leaks no body", async () => {
		const gone = {
			removed: true,
			kind: "post",
			id: "0190c0de-ffff-7000-8000-000000000199",
			side: "YES",
			marketSlug: "fixture-9",
			marketTitle: "Market fixture-9",
			ordinal: 9,
			createdAt: "2026-08-15T00:00:00.000Z",
			aggregate: {
				supportCount: 0,
				counterCount: 0,
				supportDharma: "0.000000000000000000",
				counterDharma: "0.000000000000000000",
			},
			authorPseudonym: "BlueHare002",
		} as unknown as BookmarkItem;
		vi.mocked(loadBookmarks).mockResolvedValue([gone]);
		const { container } = render(await BookmarksPage());
		expect(screen.getByTestId(`bookmark-row-${gone.id}`)).toBeTruthy();
		// SC-1 — assert the BODY's absence, not the row's.
		expect(container.innerHTML).not.toContain("Fixture body");
		expect(screen.getByTestId(`replica-removed-${gone.id}`)).toBeTruthy();
	});
});
