import { describe, expect, it } from "vitest";

import {
	getResolutionBlocks,
	isKnownMarketSlug,
	RESOLUTION_BLOCKS,
} from "@/components/debate/resolution-block-data";

const KNOWN_SLUGS = [
	"mumbai-bmc-pink-october-disclosure",
	"oktoberfest-munich-beer-volume",
	"chess-fide-tiebreak-response",
	"bitcoin-price-50k",
	"math-erdos-contribution-response",
	"claude-bundle-response",
	"yc-paper-club-response",
	"github-zugzwang-repo-stars",
] as const;

/**
 * G1 — the map is exhaustive over the eight known slugs, and an unknown slug
 * fails loud rather than falling back to a silent empty bar. The
 * compile-time half (an object literal missing one of the eight keys is a
 * `tsc` error) is not itself vitest-testable — it's a property of
 * `RESOLUTION_BLOCKS`'s own `Record<KnownMarketSlug, …>` annotation, verified
 * once by deleting an entry and confirming `tsc --noEmit` reports it, then
 * restored (recorded in the run report, not re-derived here). This file
 * covers the runtime half.
 */
describe("resolution-block-data — G1, exhaustive + fails loud on an unknown slug", () => {
	it("resolution-block-data::G1-all-eight-known-slugs-resolve", () => {
		for (const slug of KNOWN_SLUGS) {
			expect(isKnownMarketSlug(slug)).toBe(true);
			const blocks = getResolutionBlocks(slug);
			for (const key of [
				"resolution",
				"resolver",
				"closes",
				"flavour",
			] as const) {
				expect(blocks[key]).toBeDefined();
				expect(blocks[key].line1.length).toBeGreaterThan(0);
			}
		}
	});

	it("resolution-block-data::G1-an-unknown-slug-throws-rather-than-falling-back", () => {
		// ⛔ POSITIVE CONTROL FIRST — prove the predicate itself distinguishes
		// known from unknown before trusting the negative case below.
		expect(isKnownMarketSlug("bitcoin-price-50k")).toBe(true);
		expect(isKnownMarketSlug("resolver-cards-fixture-market")).toBe(false);
		expect(isKnownMarketSlug("")).toBe(false);

		expect(() => getResolutionBlocks("resolver-cards-fixture-market")).toThrow(
			/no resolution-block data/,
		);
		expect(() => getResolutionBlocks("some-future-ninth-market")).toThrow();
	});

	it("resolution-block-data::exactly-eight-entries-no-more-no-less", () => {
		// ⛔ Guards against a ninth slug being silently added (or one dropped)
		// without anyone updating this test's own KNOWN_SLUGS list.
		expect(Object.keys(RESOLUTION_BLOCKS).sort()).toEqual(
			[...KNOWN_SLUGS].sort(),
		);
	});
});

/**
 * Content spot-check against the ratified register — doubles as regression
 * coverage for the whole map (RF-2), and specifically pins the two rows
 * whose RESOLUTION text intentionally diverges from the "X" pattern (see the
 * data file's own docblock) so a future "cleanup" can't silently normalize
 * them away.
 */
describe("resolution-block-data — content matches the ratified register", () => {
	it("resolution-block-data::RESOLUTION-is-X-for-the-five-account-watching-markets", () => {
		for (const slug of [
			"mumbai-bmc-pink-october-disclosure",
			"chess-fide-tiebreak-response",
			"math-erdos-contribution-response",
			"claude-bundle-response",
			"yc-paper-club-response",
		] as const) {
			expect(RESOLUTION_BLOCKS[slug].resolution.line1).toBe("X");
			expect(RESOLUTION_BLOCKS[slug].resolution.href).toBeNull();
		}
	});

	it("resolution-block-data::RESOLUTION-names-the-institution-for-the-other-three", () => {
		expect(
			RESOLUTION_BLOCKS["oktoberfest-munich-beer-volume"].resolution.line1,
		).toBe("Oktoberfest");
		expect(RESOLUTION_BLOCKS["bitcoin-price-50k"].resolution.line1).toBe(
			"CoinMarketCap",
		);
		expect(
			RESOLUTION_BLOCKS["github-zugzwang-repo-stars"].resolution.line1,
		).toBe("GitHub");
	});

	it("resolution-block-data::RESOLVER-hrefs-are-real-absolute-URLs", () => {
		for (const slug of KNOWN_SLUGS) {
			const href = RESOLUTION_BLOCKS[slug].resolver.href;
			expect(href).not.toBeNull();
			expect(href).toMatch(/^https:\/\//);
		}
	});

	it("resolution-block-data::GIT-01-text-and-href-deliberately-diverge", () => {
		const resolver = RESOLUTION_BLOCKS["github-zugzwang-repo-stars"].resolver;
		expect(resolver.line1).toBe("Zugzwang");
		expect(resolver.line2).toBe("repo");
		expect(resolver.href).toBe(
			"https://github.com/zugzwang-foundation/experiment",
		);
		// The negative case this guard exists for: the href must not be the
		// short display text, and the display text must not be the URL.
		expect(resolver.href).not.toBe(resolver.line1);
		expect(resolver.line1).not.toContain("github.com");
	});

	it("resolution-block-data::CLOSES-is-4-Oct-for-oktoberfest-and-5-Nov-for-the-rest", () => {
		expect(RESOLUTION_BLOCKS["oktoberfest-munich-beer-volume"].closes).toEqual({
			line1: "4 Oct 2026",
			line2: "21:59Z",
			href: null,
		});
		for (const slug of KNOWN_SLUGS) {
			if (slug === "oktoberfest-munich-beer-volume") continue;
			expect(RESOLUTION_BLOCKS[slug].closes).toEqual({
				line1: "5 Nov 2026",
				line2: "23:45Z",
				href: null,
			});
		}
	});

	it("resolution-block-data::FLAVOUR-is-lowercase-not-title-cased-and-href-is-null", () => {
		const expected: Record<(typeof KNOWN_SLUGS)[number], string> = {
			"mumbai-bmc-pink-october-disclosure": "pressure",
			"oktoberfest-munich-beer-volume": "consumption",
			"chess-fide-tiebreak-response": "petition",
			"bitcoin-price-50k": "barrier",
			"math-erdos-contribution-response": "innovation",
			"claude-bundle-response": "suggestion",
			"yc-paper-club-response": "showcase",
			"github-zugzwang-repo-stars": "callout",
		};
		for (const slug of KNOWN_SLUGS) {
			const flavour = RESOLUTION_BLOCKS[slug].flavour;
			expect(flavour.line1).toBe(expected[slug]);
			expect(flavour.line1).toBe(flavour.line1.toLowerCase());
			expect(flavour.href).toBeNull();
			expect(flavour.line2).toBeNull();
		}
	});

	it("resolution-block-data::CLOSES-and-FLAVOUR-hrefs-are-null-on-every-market", () => {
		for (const slug of KNOWN_SLUGS) {
			expect(RESOLUTION_BLOCKS[slug].closes.href).toBeNull();
			expect(RESOLUTION_BLOCKS[slug].flavour.href).toBeNull();
		}
	});
});
