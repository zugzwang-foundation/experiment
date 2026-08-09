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
 * author pseudonym links to its profile (`/u/[pseudonym]`, activated at UI.A5
 * — the A4 follow-up #2; a SIBLING of the card-body deep-link). A null side
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
		// DISTINCT per side, deliberately. `price_at_bet` is already the price of
		// the side BOUGHT (bets/place.ts:162 -> cpmm/calculate.ts:97), so a shared
		// value would make the NO expectation purely a function of whatever
		// transform the component applies — which is precisely how a complement
		// bug hides. The d5 fixtures use the same shape: a YES post at 27, a NO
		// post at 55 (surface_d5_v1_0.html:1496, :1512).
		entryPrice:
			side === "YES" ? "0.270000000000000000" : "0.550000000000000000",
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
		// The SAME shared `StatLine` the card renders, so it GROUPS here too:
		// every Đ value rendered to a user groups its integer part in threes with
		// a literal ASCII comma (SPEC.1 §10.8, 1.0.29 — the same-commit rider).
		// The pre-ruling `Đ 14260` this line used to pin was a docket, not a
		// baseline: discovery staked totals rendered ungrouped beside composers
		// that grouped. Inverted with market-card.test.tsx:65 (ruling R-K).
		expect(statText).toContain("Đ 14,260 staked");
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

	it("render::whole-panel-is-the-post-click-target", () => {
		// POLISH.2 V18 — the mockup's handler is bound to the WHOLE
		// `.argbody[data-post]`, excluding `.pseud`
		// (surface_discovery_v1_0.html:402-407). The build reaches that with a
		// stretched link rather than by wrapping the panel, because the author
		// link must stay a separate target and anchors cannot nest.
		//
		// Both halves are asserted. Without the `after:inset-0` half the click
		// target silently shrinks back to the title+teaser box and NOTHING else
		// on disk would notice; without `relative` on the panel the ::after
		// escapes to the nearest positioned ancestor and covers the wrong box.
		const { container } = renderHero({ yes: heroPost("YES"), no: null });

		const panel = screen.getByTestId("hero-post");
		expect(panel.className).toContain("relative");

		const link = container.querySelector(`a[href="/m/${SLUG}?post=3"]`);
		expect(link?.className ?? "").toContain("after:absolute");
		expect(link?.className ?? "").toContain("after:inset-0");

		// The author link sits ABOVE that overlay, or it becomes unclickable.
		const authorLink = screen.getByTestId("hero-author-link-YES");
		expect(authorLink.className).toContain("relative");
		expect(authorLink.className).toContain("z-10");
	});

	it("render::author-links-to-own-profile", () => {
		// UI.A5 A4-follow-up #2: the author pseudonym now links to its profile
		// (`/u/[pseudonym]`) — a SIBLING of the card-body deep-link, not the same
		// anchor (supersedes the OQ-4-A "plain text in v1" behaviour).
		renderHero({ yes: heroPost("YES"), no: null });
		const pseudonym = screen.getByText(/hero-yes-author/);
		const authorLink = pseudonym.closest("a");
		expect(authorLink).not.toBeNull();
		expect(authorLink?.getAttribute("href")).toMatch(/^\/u\//);
		// It is the PROFILE link, never the `?post=` card-body deep-link.
		expect(authorLink?.getAttribute("href") ?? "").not.toContain("?post=");
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

	// DISCOVERY-COMPLETE C1/C3 — the hero wiring for the shared-primitive
	// presets. The presets themselves are proven in
	// tests/unit/debate/render/side-badge.test.tsx and
	// tests/unit/discovery/render/price-bar-presets.test.tsx; these assert that
	// the hero is the surface actually asking for them.
	it("render::hero-asks-for-the-hero-presets", () => {
		const { container } = renderHero({
			yes: heroPost("YES"),
			no: heroPost("NO"),
		});

		// V29 — the 22px bar, labels outside. Scoped to the BAR: `PriceSparkline`
		// also stamps `data-size="hero"`, so a bare `[data-size="hero"]` selector
		// passes without PriceBar having received the preset at all.
		const bar = container.querySelector('[data-size="hero"] [role="img"]');
		expect(bar).not.toBeNull();
		expect(bar?.getAttribute("class")).toContain("h-[22px]");

		// V50 — the 16px hero-head avatar.
		const avatars = container.querySelectorAll('[data-slot="avatar"]');
		expect(avatars.length).toBe(2);
		for (const avatar of avatars) {
			expect(avatar.getAttribute("data-size")).toBe("xs");
		}

		// V10/V11 — the chip carries the author's own entry price at the hero
		// geometry, rendered RAW. The fixtures store 0.27 on the YES post and 0.55
		// on the NO post, because `price_at_bet` is already the price of the side
		// bought. Each panel reads back its OWN stored value; neither is derived.
		const yesPanel = container.querySelector(
			'[data-testid="hero-post"][data-side="YES"]',
		);
		expect(yesPanel?.textContent).toContain("YES @ 27%");
		const noPanel = container.querySelector(
			'[data-testid="hero-post"][data-side="NO"]',
		);
		expect(noPanel?.textContent).toContain("NO @ 55%");
		// Neither panel shows the other's complement — the bug this pins.
		expect(noPanel?.textContent).not.toContain("45%");
		expect(yesPanel?.textContent).not.toContain("73%");
	});
});
