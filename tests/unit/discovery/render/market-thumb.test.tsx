// @vitest-environment jsdom

import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { HeroPanels } from "@/components/discovery/HeroPanels";
import { MarketCard } from "@/components/discovery/MarketCard";
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
 * PRIMITIVES-2 PR-A, commit 1 — **RED BY CONSTRUCTION**.
 *
 * The defect: a presigned R2 GET URL that 404s at the browser has **no
 * degradation path at any of the three Discovery image sites**. Every site
 * branches on `imageUrl === null` and renders a design-ratified `IMG`
 * placeholder, but a non-null URL whose object is missing renders a plain
 * `<img>` with no `onError` — so the browser paints its own broken-image glyph
 * and, on the two market thumbs, overflows the `alt` text into the metadata
 * row. `getDefaultMarketMediaUrl` cannot see this: presigning is a local HMAC
 * over a key, so it returns a perfectly well-formed URL for an object that is
 * not there (plan §2, recon R10).
 *
 * Sites, re-counted at `f51a9dd`, not inherited from the plan's §2:
 *   1. `MarketCard.tsx:51-55`      — 52×52, `items-start`
 *   2. `HeroPanels.tsx:62-66`      — 54×54, `items-center`
 *   3. `HeroPanels.tsx:184-191`    — `flex-1 min-h-[40px]`, both `data-testid` arms
 * Zero `onError` handlers exist anywhere under `src/` at this commit.
 *
 * **The assertion shape is D3 stated as a property.** The error state must
 * render *the site's own null placeholder* — not an invented visual — so the
 * post-error DOM must be **byte-identical to the null-image DOM**. That is one
 * full-string `toBe` per site (§8.1: never `.toContain`; class order is caught),
 * and it simultaneously discharges D3 and the "error renders the same node as
 * null" half of the exit criteria.
 *
 * **N3 — every absence assertion carries a positive control.** A DOM-equality
 * assertion is vacuous if the two fixtures it compares cannot differ, so
 * `control::` proves, per site, that (a) the loaded and null renders genuinely
 * differ and (b) the images this test fires `error` at exist first, at the
 * exact expected count. Without those, all three site assertions could pass
 * against a component that never renders an image at all. The count is what
 * makes site 3 a BOTH-POLES assertion rather than a YES-only one — see `SITES`.
 *
 * Fixture labels reuse the shipped server-suite scaffold ("Discovery Market",
 * `signed.test`) and the composer harness strings — never invented market
 * content (CLAUDE.md §3). No jest-dom in this repo (AGENTS.md §9) — plain DOM
 * assertions only.
 */

afterEach(cleanup);

const MARKET_TITLE = "Discovery Market";

/** A well-formed presigned URL whose object is gone — the exact failure mode. */
const CARD_IMAGE_URL = "https://signed.test/market-media/m/x/card.webp";
const POST_IMAGE_URL = "https://signed.test/uploads/u/x/arg.webp";

const SERIES: PricePoint[] = [
	{ at: "2026-07-01T00:00:00.000Z", yes: "0.500000000000000000" },
	{ at: "2026-07-01T00:01:00.000Z", yes: "0.700000000000000000" },
	{ at: "2026-07-01T00:02:00.000Z", yes: "0.400000000000000000" },
];

function cardFixture(imageUrl: string | null): DiscoveryCard {
	return {
		id: MARKET_ID,
		slug: SLUG,
		title: MARKET_TITLE,
		pricing: { yes: "0.380000000000000000", no: "0.620000000000000000" },
		totals: {
			dharmaStaked: "14260.000000000000000000",
			postCount: 28,
			replyCount: 68,
		},
		imageUrl,
	};
}

function heroPost(side: HeroPost["side"], imageUrl: string | null): HeroPost {
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
		// DISTINCT per side — `price_at_bet` is already the bought side's price,
		// so a shared value lets a complement bug hide (the hero-panels precedent).
		entryPrice:
			side === "YES" ? "0.270000000000000000" : "0.550000000000000000",
		replyCount: 24,
		replyDharma: "10000.000000000000000000",
		supportDharma: "3800.000000000000000000",
		counterDharma: "6200.000000000000000000",
		imageUrl,
		currentValue: null,
		createdAt: "2026-07-01T00:00:00.000Z",
	};
}

function topPosts(postImageUrl: string | null): HeroTopPosts {
	return {
		yes: heroPost("YES", postImageUrl),
		no: heroPost("NO", postImageUrl),
	};
}

/**
 * The three sites, each expressed as a null render, a loaded render, and every
 * `<img>` the browser would fail to load. Driving all three through one table
 * keeps the site count honest: a fourth `<img>` appearing under `discovery/`
 * without a row here is visible as an omission, not as a silent pass.
 *
 * ⚠ `imgCount` is not decoration. The hero POST image renders **twice** — once
 * per panel — so a `querySelector`-shaped test fires `error` at the YES panel
 * only and then asserts a whole-container equality that NO correct
 * implementation can satisfy, because the NO panel's image never failed. The
 * count is asserted and the error is fired at every match, which makes this
 * site's assertion a **both-poles** one by construction instead of a YES-only
 * assertion that stays green while the NO panel is broken.
 */
const SITES = [
	{
		name: "card-thumb · MarketCard.tsx:51-55 (52×52, items-start)",
		imgCount: 1,
		renderNull: () =>
			render(<MarketCard card={cardFixture(null)} series={SERIES} />),
		renderLoaded: () =>
			render(<MarketCard card={cardFixture(CARD_IMAGE_URL)} series={SERIES} />),
		selector: `img[src="${CARD_IMAGE_URL}"]`,
	},
	{
		name: "hero-thumb · HeroPanels.tsx:62-66 (54×54, items-center)",
		imgCount: 1,
		renderNull: () =>
			render(
				<HeroPanels
					card={cardFixture(null)}
					series={SERIES}
					topPosts={topPosts(null)}
				/>,
			),
		renderLoaded: () =>
			render(
				<HeroPanels
					card={cardFixture(CARD_IMAGE_URL)}
					series={SERIES}
					topPosts={topPosts(null)}
				/>,
			),
		selector: `img[src="${CARD_IMAGE_URL}"]`,
	},
	{
		// TWO images — the YES panel's and the NO panel's. See `imgCount` above.
		name: "hero-post-image · HeroPanels.tsx:184-191 (flex-1 min-h-[40px], both poles)",
		imgCount: 2,
		renderNull: () =>
			render(
				<HeroPanels
					card={cardFixture(null)}
					series={SERIES}
					topPosts={topPosts(null)}
				/>,
			),
		renderLoaded: () =>
			render(
				<HeroPanels
					card={cardFixture(null)}
					series={SERIES}
					topPosts={topPosts(POST_IMAGE_URL)}
				/>,
			),
		selector: `img[src="${POST_IMAGE_URL}"]`,
	},
] as const;

/** EVERY `<img>` at a site — never just the first (see `imgCount` above). */
function findImgs(
	container: HTMLElement,
	selector: string,
): HTMLImageElement[] {
	return Array.from(container.querySelectorAll<HTMLImageElement>(selector));
}

describe("PRIMITIVES-2 D2/D3 — the three Discovery image sites degrade a 404", () => {
	for (const site of SITES) {
		// N3 POSITIVE CONTROL. Proves the site assertion below is discriminating:
		// the two fixtures really do produce different DOM, and the images the
		// assertion fires `error` at are really there to be found, at the exact
		// expected count. A green site assertion means nothing without these.
		it(`control::${site.name} — loaded and null renders differ, and every img exists`, () => {
			const nullRender = site.renderNull();
			const nullHtml = nullRender.container.innerHTML;
			expect(findImgs(nullRender.container, site.selector)).toHaveLength(0);
			nullRender.unmount();

			const loaded = site.renderLoaded();
			expect(findImgs(loaded.container, site.selector)).toHaveLength(
				site.imgCount,
			);
			expect(loaded.container.innerHTML).not.toBe(nullHtml);
		});

		it(`${site.name} — a 404ing image degrades to the site's own placeholder`, () => {
			const nullRender = site.renderNull();
			const nullHtml = nullRender.container.innerHTML;
			nullRender.unmount();

			const loaded = site.renderLoaded();
			const imgs = findImgs(loaded.container, site.selector);
			// N1 alive check — a selector that silently matched nothing would make
			// the loop below a no-op and the equality vacuous.
			expect(imgs).toHaveLength(site.imgCount);

			// The browser's load failure, delivered exactly as the browser delivers
			// it, at EVERY image the site renders — both poles for the hero post
			// image. At this commit nothing is listening, so the DOM does not move
			// and this assertion is RED.
			for (const img of imgs) {
				fireEvent.error(img);
			}

			// D3 — the error state IS the null state. Full-string equality, never
			// `.toContain`: a placeholder emitting the right classes in the wrong
			// order is a real delta and must fail here.
			expect(loaded.container.innerHTML).toBe(nullHtml);
		});
	}
});
