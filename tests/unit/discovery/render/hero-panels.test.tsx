// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { HERO_SIDE_EMPTY, HeroPanels } from "@/components/discovery/HeroPanels";
import type { HeroPost, HeroTopPosts } from "@/server/discovery/hero";
import type { DiscoveryCard } from "@/server/discovery/list";
import type { PricePoint } from "@/server/discovery/price-series";

import {
	EXTENDED,
	MARKET_ID,
	SLUG,
	TITLE,
} from "../../composer/render/_harness";

/**
 * UI.A4 Slice 4 (plan §2 row 4 / §4) — the design-language §3.2 hero: three
 * panels in DOM order `top-YES post | market | top-NO post`. The market panel
 * is the card composition at hero size; a post panel deep-links its title +
 * teaser to `/m/[slug]?post=N` (the built A2 deep-link, OQ-4 A) while the
 * author pseudonym stays PLAIN TEXT — non-linked in v1 (OQ-4 A). A null side
 * renders the OQ-6 empty copy VERBATIM via the exported `HERO_SIDE_EMPTY`
 * const (imported here, never re-typed) — identical whatever the reason the
 * side is empty, so it can never hint hidden content exists. Fixture prose
 * reuses the shipped composer-harness strings + the server-suite scaffold
 * labels — never invented market content (CLAUDE.md §3).
 */

afterEach(cleanup);

const MARKET_TITLE = "Discovery Market";

const SERIES: PricePoint[] = [
	{ at: "2026-07-01T00:00:00.000Z", yes: "0.500000000000000000" },
	{ at: "2026-07-01T00:01:00.000Z", yes: "0.700000000000000000" },
	{ at: "2026-07-01T00:02:00.000Z", yes: "0.400000000000000000" },
];

const CARD: DiscoveryCard = {
	id: MARKET_ID,
	slug: SLUG,
	title: MARKET_TITLE,
	pricing: { yes: "0.380000000000000000", no: "0.620000000000000000" },
	totals: {
		dharmaStaked: "14260.000000000000000000",
		postCount: 28,
		replyCount: 68,
	},
	imageUrl: "https://signed.test/market-media/m/x/card.webp",
};

function heroPost(side: HeroPost["side"]): HeroPost {
	return {
		id:
			side === "YES"
				? "0190b3a0-9999-7000-8000-00000000000a"
				: "0190b3a0-9999-7000-8000-00000000000b",
		ordinal: side === "YES" ? 3 : 1,
		side,
		title: TITLE,
		teaser: EXTENDED,
		author: {
			pseudonym: side === "YES" ? "hero-yes-author" : "hero-no-author",
			pfpUrl: "/pfp-placeholder.svg",
		},
		authorStake: "40.000000000000000000",
		createdAt: "2026-07-01T00:00:00.000Z",
	};
}

function renderHero(topPosts: HeroTopPosts) {
	return render(<HeroPanels card={CARD} series={SERIES} topPosts={topPosts} />);
}

/** DOM-order assertion: `a` precedes `b` in the rendered tree. */
function precedes(a: Element, b: Element): boolean {
	return (
		(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0
	);
}

describe("UI.A4 §4 — HeroPanels (top-YES | market | top-NO)", () => {
	it("render::three-panels-in-order", () => {
		renderHero({ yes: heroPost("YES"), no: heroPost("NO") });
		expect(screen.getByTestId("hero-panels")).toBeTruthy();
		// Two post panels, YES first, NO last (document order).
		const posts = screen.getAllByTestId("hero-post");
		expect(posts).toHaveLength(2);
		const [yesPanel, noPanel] = posts;
		expect(yesPanel.getAttribute("data-side")).toBe("YES");
		expect(noPanel.getAttribute("data-side")).toBe("NO");
		// The market panel sits BETWEEN them (§3.2 hero order).
		const sparkline = screen.getByTestId("price-sparkline");
		expect(sparkline.getAttribute("data-size")).toBe("hero");
		expect(precedes(yesPanel, sparkline)).toBe(true);
		expect(precedes(sparkline, noPanel)).toBe(true);
		// Market panel carries question + stat line + the reused PriceBar.
		expect(screen.getByText(MARKET_TITLE).textContent).toBe(MARKET_TITLE);
		const statText = screen.getByTestId("stat-line").textContent ?? "";
		expect(statText).toContain("Đ 14260 staked");
		expect(screen.getByRole("img", { name: "YES 38%, NO 62%" })).toBeTruthy();
	});

	it("render::hero-post-deep-links-to-ordinal", () => {
		const { container } = renderHero({ yes: heroPost("YES"), no: null });
		// The A2 deep-link (OQ-4 A): /m/[slug]?post=N, N = the substrate ordinal.
		const link = container.querySelector(`a[href="/m/${SLUG}?post=3"]`);
		if (!link) {
			throw new Error("expected the hero-post deep-link anchor");
		}
		// Title + teaser render inside the deep-link.
		expect(link.textContent).toContain(TITLE);
		expect(link.textContent).toContain(EXTENDED);
		// The author's stake, Đ-formatted via the reused formatDharma.
		const post = screen.getByTestId("hero-post");
		expect(post.textContent ?? "").toContain("Đ 40");
	});

	it("render::author-pseudonym-not-linked", () => {
		renderHero({ yes: heroPost("YES"), no: null });
		// OQ-4 A: the author pseudonym is PLAIN TEXT in v1 — no ancestor <a>.
		const pseudonym = screen.getByText(/hero-yes-author/);
		expect(pseudonym.closest("a")).toBeNull();
	});

	it("render::side-empty-copy-verbatim", () => {
		// yes: null → exactly one empty panel carrying the exported YES copy.
		const yesEmpty = renderHero({ yes: null, no: heroPost("NO") });
		expect(yesEmpty.getAllByTestId("hero-side-empty")).toHaveLength(1);
		expect(yesEmpty.getByText(HERO_SIDE_EMPTY.YES).textContent).toBe(
			HERO_SIDE_EMPTY.YES,
		);
		expect(yesEmpty.queryByText(HERO_SIDE_EMPTY.NO)).toBeNull();
		expect(yesEmpty.getByTestId("hero-post").getAttribute("data-side")).toBe(
			"NO",
		);
		yesEmpty.unmount();

		// …and the inverse for no: null.
		const noEmpty = renderHero({ yes: heroPost("YES"), no: null });
		expect(noEmpty.getAllByTestId("hero-side-empty")).toHaveLength(1);
		expect(noEmpty.getByText(HERO_SIDE_EMPTY.NO).textContent).toBe(
			HERO_SIDE_EMPTY.NO,
		);
		expect(noEmpty.queryByText(HERO_SIDE_EMPTY.YES)).toBeNull();
		noEmpty.unmount();

		// Both null → two empties, and STILL the market panel.
		const bothEmpty = renderHero({ yes: null, no: null });
		expect(bothEmpty.getAllByTestId("hero-side-empty")).toHaveLength(2);
		expect(bothEmpty.getByText(HERO_SIDE_EMPTY.YES)).toBeTruthy();
		expect(bothEmpty.getByText(HERO_SIDE_EMPTY.NO)).toBeTruthy();
		expect(bothEmpty.getByText(MARKET_TITLE).textContent).toBe(MARKET_TITLE);
		expect(
			bothEmpty.getByTestId("price-sparkline").getAttribute("data-size"),
		).toBe("hero");
	});
});
