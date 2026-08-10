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
		// Destructured from the listing and passed straight into the hero read…
		expect(page).toContain("const { card, reserves } of listings");
		expect(page).toContain("selectHeroTopPosts(db, card.id, reserves)");
		// …and never pushed onto the view that crosses to the carousel.
		expect(page).not.toContain("reserves,\n");
		expect(page).not.toContain("card.reserves");
	});
});
