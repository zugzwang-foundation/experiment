import { describe, expect, it } from "vitest";

import {
	getResolutionBlocks,
	isKnownMarketSlug,
	RESOLUTION_BLOCKS,
} from "@/components/debate/resolution-block-data";
import stagingSnapshot from "../../../docs/data/staging-markets-snapshot.json";

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

	it("resolution-block-data::map-slugs-match-the-committed-LIVE-staging-snapshot", () => {
		// ⛔⛔ THE GUARD ABOVE IS NOT INDEPENDENT — @code-reviewer caught that it
		// compares the map against a list HAND-COPIED into this same file, so a
		// slug added to both moves together and the test still passes. This one
		// compares against `docs/data/staging-markets-snapshot.json` instead —
		// zero IO (the file is committed, refreshed by S1/S5 of this same
		// branch), and it's the one comparison that can catch the case that can
		// actually occur: a real ninth market landing in the live DB with no
		// corresponding map entry.
		const liveSlugs = stagingSnapshot.markets.map((m) => m.slug).sort();
		expect(Object.keys(RESOLUTION_BLOCKS).sort()).toEqual(liveSlugs);
	});

	it("resolution-block-data::CLOSES-matches-the-LIVE-resolution_deadline-for-every-market", () => {
		// ⛔⛔ CLOSES duplicates `markets.resolution_deadline` with no foreign-key
		// or shared-source mechanism keeping the two in sync — this file's own
		// docblock says a wrong value here "would tell a participant they can
		// still trade for another month" (the Oktoberfest exception). This
		// assertion is the sync mechanism: it fails the moment the map and the
		// live column disagree, for any of the eight markets.
		for (const market of stagingSnapshot.markets) {
			const blocks = getResolutionBlocks(market.slug);
			const deadline = new Date(market.resolution_deadline);
			const expectedDate = deadline.toLocaleDateString("en-GB", {
				day: "numeric",
				month: "short",
				year: "numeric",
				timeZone: "UTC",
			});
			const expectedTime = `${deadline.getUTCHours().toString().padStart(2, "0")}:${deadline
				.getUTCMinutes()
				.toString()
				.padStart(2, "0")}Z`;
			expect(blocks.closes.line1).toBe(expectedDate);
			expect(blocks.closes.line2).toBe(expectedTime);
		}
	});
});

/**
 * Content spot-check against the ratified register — doubles as regression
 * coverage for the whole map (RF-2), and specifically pins the THREE rows
 * (oktoberfest, bitcoin, github) whose RESOLUTION text intentionally
 * diverges from the "X" pattern (see the data file's own docblock) so a
 * future "cleanup" can't silently normalize them away. An earlier version of
 * this comment said "two rows" — @code-reviewer caught that github is a
 * third, and the test two lines down was already correctly named
 * `...-for-the-other-three`, so the miscount was in the prose, not the code.
 */
describe("resolution-block-data — content matches the ratified register", () => {
	it("resolution-block-data::RESOLUTION-is-Response-on-X-for-the-five-account-watching-markets", () => {
		// ⚠⚠ BLOCK-3 · MKT-SLATE v1.1 — "X" → "Response on X". RESOLUTION
		// redefined from "the surface" to "the thing read to settle the
		// market"; for these five the thing is a response POST, not the bare
		// platform name. See the data file's own docblock.
		for (const slug of [
			"mumbai-bmc-pink-october-disclosure",
			"chess-fide-tiebreak-response",
			"math-erdos-contribution-response",
			"claude-bundle-response",
			"yc-paper-club-response",
		] as const) {
			expect(RESOLUTION_BLOCKS[slug].resolution.line1).toBe("Response on X");
			expect(RESOLUTION_BLOCKS[slug].resolution.href).toBeNull();
		}
	});

	it("resolution-block-data::RESOLUTION-names-the-institution-for-the-other-three", () => {
		// ⚠ BLOCK-2 — the literal surface "oktoberfest.de", not the brand name
		// "Oktoberfest" BLOCK-1 shipped. Founder-ruled (AMEND-1 item 15); see
		// this file's own docblock. RESOLVER keeps "Oktoberfest" — only
		// RESOLUTION changed.
		// ⚠⚠ BLOCK-3 · MKT-SLATE v1.1 — oktoberfest's RESOLUTION gains line2
		// "report": the redefined field names the THING read (the report),
		// not just the surface it's published at.
		expect(
			RESOLUTION_BLOCKS["oktoberfest-munich-beer-volume"].resolution,
		).toEqual({ line1: "oktoberfest.de", line2: "report", href: null });
		expect(RESOLUTION_BLOCKS["bitcoin-price-50k"].resolution.line1).toBe(
			"CoinMarketCap",
		);
		expect(
			RESOLUTION_BLOCKS["github-zugzwang-repo-stars"].resolution.line1,
		).toBe("GitHub");
	});

	it("resolution-block-data::OKT-01-RESOLVER-gains-management-as-line2", () => {
		// ⚠⚠ BLOCK-3 · MKT-SLATE v1.1 — "Oktoberfest" / "management": who (the
		// festival) + which part of who (the organizing body that authors the
		// report RESOLUTION now names). href unchanged.
		expect(
			RESOLUTION_BLOCKS["oktoberfest-munich-beer-volume"].resolver,
		).toEqual({
			line1: "Oktoberfest",
			line2: "management",
			href: "https://www.oktoberfest.de/en",
		});
	});

	it("resolution-block-data::BTC-01-RESOLVER-no-longer-carries-a-Low-subvalue", () => {
		// ⚠⚠ BLOCK-3 — §4c removed line2 "Low"; line1 and href are unchanged.
		// Explicit regression guard: this is the one row that LOST a line2
		// this task, easy to silently restore by copying an older fixture.
		expect(RESOLUTION_BLOCKS["bitcoin-price-50k"].resolver).toEqual({
			line1: "CoinMarketCap",
			line2: null,
			href: "https://coinmarketcap.com/currencies/bitcoin/historical-data/",
		});
	});

	it("resolution-block-data::CLA-01-RESOLVER-is-deliberately-single-account-not-an-oversight", () => {
		// ⚠ BLOCK-2 — founder-ruled. The live criterion qualifies three
		// accounts (@AnthropicAI, @claudeai, @ClaudeDevs); this chip stays a
		// single named pointer, not an exhaustive citation. Guards against a
		// future "completion" adding a second account or a `+2` marker.
		const resolver = RESOLUTION_BLOCKS["claude-bundle-response"].resolver;
		expect(resolver.line1).toBe("@claudeai");
		expect(resolver.line2).toBeNull();
		expect(resolver.href).toBe("https://x.com/claudeai");
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

	it("resolution-block-data::FLAVOUR-is-sentence-case-IN-THE-DATA-and-href-is-null", () => {
		// ⚠⚠ BLOCK-3 — lowercase → sentence case, and it happens HERE, never via
		// a CSS `capitalize` on the rendered value. `capitalize` transforms the
		// first letter of every WORD, which would turn "oktoberfest.de report"
		// (a different block's two-word-ish value) into "Oktoberfest.de
		// Report" — capitalizing "report" is exactly what sentence case (only
		// the first letter of the WHOLE string) must not do. The data is the
		// only place this can be gotten right per-string.
		const expected: Record<(typeof KNOWN_SLUGS)[number], string> = {
			"mumbai-bmc-pink-october-disclosure": "Pressure",
			"oktoberfest-munich-beer-volume": "Consumption",
			"chess-fide-tiebreak-response": "Petition",
			"bitcoin-price-50k": "Barrier",
			"math-erdos-contribution-response": "Innovation",
			"claude-bundle-response": "Suggestion",
			"yc-paper-club-response": "Showcase",
			"github-zugzwang-repo-stars": "Callout",
		};
		for (const slug of KNOWN_SLUGS) {
			const flavour = RESOLUTION_BLOCKS[slug].flavour;
			expect(flavour.line1).toBe(expected[slug]);
			// Sentence case: first character upper, the rest lower (these are
			// single words, so "the rest lower" is the whole remainder).
			expect(flavour.line1[0]).toBe(flavour.line1[0].toUpperCase());
			expect(flavour.line1.slice(1)).toBe(flavour.line1.slice(1).toLowerCase());
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
