import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * DISCOVERY-COMPLETE C8 — the client-boundary guard for V13's pool reserves
 * (plan halt item 13).
 *
 * V13 needs the market's pool reserves to compute the author's current position
 * value. They are threaded server-side, from the pool read `listOpenMarkets`
 * already performs, into `selectHeroTopPosts`. They must NEVER become a field on
 * `DiscoveryCard` or `DiscoveryMarketView`: `DiscoveryCarousel` is a
 * `"use client"` component, so ANY field on those types is serialized into the
 * RSC payload and shipped to the browser. Reserves are an internal pool row
 * (AGENTS.md §6 — never expose an internal row shape in a DTO).
 *
 * The design makes this structural rather than remembered: `listOpenMarkets`
 * returns `DiscoveryListing = { card, reserves }`, so reserves are a SIBLING of
 * the card and cannot ride it by accident. This test is the belt — it catches
 * someone later "simplifying" the sibling back onto the card, which would
 * compile fine and silently leak.
 *
 * Static: no DB, no render.
 */

const ROOT = process.cwd();
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

/** The `export type X = { … }` block, brace-matched. */
function typeBlock(source: string, name: string): string {
	const start = source.indexOf(`export type ${name} = {`);
	if (start === -1) {
		throw new Error(`type ${name} not found — this guard is stale`);
	}
	let depth = 0;
	for (let i = source.indexOf("{", start); i < source.length; i++) {
		if (source[i] === "{") {
			depth++;
		} else if (source[i] === "}") {
			depth--;
			if (depth === 0) {
				return source.slice(start, i + 1);
			}
		}
	}
	throw new Error(`unbalanced braces reading ${name}`);
}

describe("V13 reserves never cross the client boundary", () => {
	it("guard-is-alive", () => {
		// Both types must still exist under these names, or the assertions below
		// would pass vacuously against an empty string.
		const list = read("src/server/discovery/list.ts");
		const carousel = read("src/components/discovery/DiscoveryCarousel.tsx");
		expect(typeBlock(list, "DiscoveryCard").length).toBeGreaterThan(80);
		expect(typeBlock(carousel, "DiscoveryMarketView").length).toBeGreaterThan(
			40,
		);
		// And the sibling type this design depends on is really there.
		expect(list).toContain("export type DiscoveryListing");
		expect(typeBlock(list, "DiscoveryListing")).toContain("reserves");
	});

	it("DiscoveryCard-carries-no-reserves-field", () => {
		expect(
			typeBlock(read("src/server/discovery/list.ts"), "DiscoveryCard"),
		).not.toContain("reserves");
	});

	it("DiscoveryMarketView-carries-no-reserves-field", () => {
		expect(
			typeBlock(
				read("src/components/discovery/DiscoveryCarousel.tsx"),
				"DiscoveryMarketView",
			),
		).not.toContain("reserves");
	});

	it("no-client-component-under-discovery-mentions-reserves", () => {
		// `DiscoveryCarousel` is the `"use client"` root of this surface; anything
		// it renders is client-side too. None of them may name a reserve.
		for (const file of [
			"src/components/discovery/DiscoveryCarousel.tsx",
			"src/components/discovery/DiscoveryGrid.tsx",
			"src/components/discovery/MarketCard.tsx",
			"src/components/discovery/HeroPanels.tsx",
			// FIFTH ENTRY, added at PRIMITIVES-2 PR-A. `MarketThumb` is rendered by
			// `MarketCard` and `HeroPanels` (both above), so it entered this client
			// graph when the three image sites adopted it. This list is
			// hand-maintained, so it stays GREEN while incomplete — a component in
			// the graph but absent here is a silent coverage hole, not a red test.
			// Concretely: threading pool reserves into the thumb would serialize an
			// internal `pools` row shape into the RSC payload with this belt still
			// passing.
			"src/components/discovery/MarketThumb.tsx",
		]) {
			expect(read(file)).not.toContain("reserves");
		}
	});

	it("the-page-keeps-reserves-in-a-server-local-binding", () => {
		const page = read("src/app/(public)/page.tsx");
		// ⚠ REWRITTEN AT S-4 PHASE C/D — the PROPERTY is unchanged, the shape it
		// takes is not. Reserves used to be destructured from `listOpenMarkets`'s
		// listing and handed to `selectHeroTopPosts`. They are now read LIVE per
		// market and handed to the cached block, which calls the hero read
		// inside itself.
		//
		// What must remain true, and is what this guard actually protects:
		// reserves are a server-local binding that reaches a server function and
		// NOTHING ELSE. `DiscoveryCard` crosses into `DiscoveryCarousel`
		// (`"use client"`), so a reserve that ended up on the card would
		// serialize an internal `pools` row into the browser.

		// Read live, into a local — never onto the view.
		// ⚠ T-03 changed the SHAPE of this read, not the property. The
		// per-market `getMarketPricingAndReserves(db, m.id)` became one batched
		// read ahead of the loop, with each market's row taken from a
		// server-local Map. Reserves still land in a server-local binding
		// (`priced`), still reach only a server function, and still never touch
		// the card — which is the whole of what this guard protects.
		// ADR-0055 renamed the read this page performs — the pool batch now goes
		// through `getCachedDiscoveryPricing`. What this line pins is unchanged:
		// the page performs the pool read ITSELF, so `reserves` is a binding here
		// and never a prop.
		expect(page).toContain("getCachedDiscoveryPricing(");
		expect(page).toContain("priceByMarket.get(m.id) ?? null");
		// …and passed to a SERVER function as an argument. ⚠ CACHE-KEY-1 changed
		// WHICH function: reserves used to be the cached block's second argument
		// (its cache KEY, which every bet busted); they now go to `valueHeroPosts`,
		// a pure server helper that composes the hero's Đ figure outside the cache
		// entirely. Matched whitespace-insensitively on purpose: pinning exact
		// indentation here would make this guard fail on a Biome reformat, which
		// is noise rather than a leak.
		expect(page.replace(/\s+/g, " ")).toContain(
			"valueHeroPosts( data.topPosts, data.heroShares, priced?.reserves ?? null, )",
		);
		// …and NEVER onto the card that crosses the client boundary. `pricing`
		// (a derived, public price) does ride the card; the raw reserves do not.
		expect(page).not.toMatch(/reserves\s*[,:]\s*$/m);
		expect(page).not.toContain("card.reserves");
		expect(page).not.toContain("reserves: priced");
	});

	it("heroShares-never-reaches-the-client-boundary", () => {
		// CACHE-KEY-1 — THE SECOND SERVER-LOCAL SIBLING, held to the same rule as
		// `reserves` and for the same reason. Moving `currentValue` out of the
		// cache meant the cached block had to return the SHARE COUNT the figure is
		// computed from. A share quantity is an internal `lots` / `positions` row
		// value (AGENTS.md §6); if it ever landed on `HeroPost` it would serialize
		// into the RSC payload for every visitor, signed-out included, because
		// `DiscoveryCarousel` is `"use client"`.
		//
		// The design keeps it structural — `heroShares` is a SIBLING of `topPosts`
		// on `CachedMarketDiscoveryData`, so it cannot ride a post by accident —
		// and this is the belt against someone later "simplifying" it onto one.
		const list = read("src/server/discovery/list.ts");
		const hero = read("src/server/discovery/hero.ts");

		// GUARD IS ALIVE — the sibling really exists under this name.
		expect(typeBlock(list, "CachedMarketDiscoveryData")).toContain(
			"heroShares",
		);
		expect(hero).toContain("export type HeroPostShares");

		// …and it is NOT a FIELD on the post type that crosses the boundary.
		// ⚠ MATCHED AS A DECLARATION, NOT A SUBSTRING. `HeroPost`'s docblocks say
		// "this post's shares" repeatedly while explaining what the figure means,
		// so a bare `not.toContain("shares")` reddens on the prose that documents
		// the rule — and the tempting fix for that is deleting the explanation.
		expect(typeBlock(hero, "HeroPost")).not.toMatch(
			/^\s*(heroShares|shares|betShares|heldQuantity)\s*[?:]/m,
		);
		// POSITIVE CONTROL — the same pattern, against the SAME block, does find a
		// real declaration. So the negative above is not passing on a regex that
		// matches nothing.
		expect(typeBlock(hero, "HeroPost")).toMatch(/^\s*id\s*[?:]/m);
		expect(
			read("src/components/discovery/DiscoveryCarousel.tsx"),
		).not.toContain("heroShares");
		for (const file of [
			"src/components/discovery/DiscoveryCarousel.tsx",
			"src/components/discovery/DiscoveryGrid.tsx",
			"src/components/discovery/MarketCard.tsx",
			"src/components/discovery/HeroPanels.tsx",
			"src/components/discovery/MarketThumb.tsx",
		]) {
			expect(read(file)).not.toContain("heroShares");
		}
	});
});
