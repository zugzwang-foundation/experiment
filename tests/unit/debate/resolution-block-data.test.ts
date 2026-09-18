import { describe, expect, it } from "vitest";

import {
	getResolutionBlocks,
	isKnownMarketSlug,
	RESOLUTION_BLOCKS,
} from "@/components/debate/resolution-block-data";
import prodSnapshot from "../../../docs/data/prod-markets-snapshot.json";
import stagingSnapshot from "../../../docs/data/staging-markets-snapshot.json";

const KNOWN_SLUGS = [
	"chess-fide-tiebreak-response",
	"bitcoin-price-50k",
	"math-erdos-solved-on-zugzwang",
	"claude-bundle-response",
	"yc-w27-acceptance",
	"github-zugzwang-repo-stars",
] as const;

/**
 * G1 — the map is exhaustive over the six known slugs, and an unknown slug
 * fails loud rather than falling back to a silent empty bar. The
 * compile-time half (an object literal missing one of the six keys is a
 * `tsc` error) is not itself vitest-testable — it's a property of
 * `RESOLUTION_BLOCKS`'s own `Record<KnownMarketSlug, …>` annotation, verified
 * once by deleting an entry and confirming `tsc --noEmit` reports it, then
 * restored (recorded in the run report, not re-derived here). This file
 * covers the runtime half.
 */
describe("resolution-block-data — G1, exhaustive + fails loud on an unknown slug", () => {
	it("resolution-block-data::G1-all-six-known-slugs-resolve", () => {
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
		expect(() => getResolutionBlocks("some-future-seventh-market")).toThrow();
	});

	it("resolution-block-data::exactly-six-entries-no-more-no-less", () => {
		// ⛔ Guards against a seventh slug being silently added (or one dropped)
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
		// actually occur: a real seventh market landing in the live DB with no
		// corresponding map entry.
		const liveSlugs = stagingSnapshot.markets.map((m) => m.slug).sort();
		expect(Object.keys(RESOLUTION_BLOCKS).sort()).toEqual(liveSlugs);
		// ⛔⛔ AND AGAINST PRODUCTION, WHICH THIS COMPARISON DID NOT COVER UNTIL
		// D-50. The staging snapshot was the only one pinned here, and the two
		// files are not interchangeable: they hold different ids, and before this
		// ruling they held different WORDING. A slug present in production and
		// absent from this map is not a degraded render — `getResolutionBlocks`
		// THROWS, `ResolverCards` catches and drops one row, but the slug would
		// also have no `market_media`, no glyph and no flavour, and the market a
		// participant actually opens is production's. Pinning one environment and
		// inferring the other is the shape that let a prod-only divergence be
		// invisible for a whole ruling (`@code-reviewer` MEDIUM).
		// ⚠ Asserted as EQUALITY against prod too, not as a subset: a map that is
		// a superset would mean an entry for a market nobody can reach, which is
		// the state BLOCK-1's throw exists to make impossible.
		const prodSlugs = prodSnapshot.markets.map((m) => m.slug).sort();
		expect(Object.keys(RESOLUTION_BLOCKS).sort()).toEqual(prodSlugs);
		// ⛔ NON-VACUITY, and it is not decorative here: if a future edit pointed
		// both imports at the same file, every assertion above would still pass
		// and the coverage would silently halve.
		expect(liveSlugs).toHaveLength(6);
		expect(prodSlugs).toHaveLength(6);
		expect(stagingSnapshot.markets[0].id).not.toBe(prodSnapshot.markets[0].id);
	});

	it("resolution-block-data::CLOSES-matches-the-LIVE-resolution_deadline-for-every-market", () => {
		// ⛔⛔ CLOSES duplicates `markets.resolution_deadline` with no foreign-key
		// or shared-source mechanism keeping the two in sync — this file's own
		// docblock says a wrong value here "would tell a participant they can
		// still trade for another month". This assertion is the sync mechanism:
		// it fails the moment the map and the live column disagree, for any of
		// the six markets.
		// ⚠⚠ MKT-ROSTER-1 MAKES THIS THE WHOLE OF G3. The market that closed a
		// month early was one of the two removed, so the map now holds a single
		// date; the literal-date test further down no longer has an exception to
		// distinguish and is a plain pin. THIS test is the one that still derives
		// its expectation from the live column, so it is the only one that can
		// catch a deadline moving. Do not delete it as a duplicate of that one.
		// ⚠⚠ BLOCK-4 — THE TIME HALF OF THIS GUARD IS RETIRED, THE DATE HALF IS
		// NOT, AND THE ASYMMETRY IS DELIBERATE. `line2` used to carry the UTC
		// time ("23:45Z") and was asserted against the same deadline;
		// every `line2` in the map is now `null` (§1). What made this guard worth
		// having was never the time — it was the DATE, which is the field that
		// can tell a participant the wrong month. That half is unchanged and is
		// still derived from the live column rather than hardcoded here.
		for (const market of stagingSnapshot.markets) {
			const blocks = getResolutionBlocks(market.slug);
			const deadline = new Date(market.resolution_deadline);
			const expectedDate = deadline.toLocaleDateString("en-GB", {
				day: "numeric",
				month: "short",
				year: "numeric",
				timeZone: "UTC",
			});
			expect(blocks.closes.line1).toBe(expectedDate);
			expect(blocks.closes.line2).toBeNull();
		}
		// ⛔ NON-VACUITY — the loop is over the snapshot, and an empty or
		// truncated snapshot file would make every assertion above run zero
		// times. Pin the count the rest of this file already expects.
		expect(stagingSnapshot.markets.length).toBe(6);
	});
});

/**
 * Content spot-check against the ratified register — doubles as regression
 * coverage for the whole map (RF-2), and specifically pins the TWO rows
 * (bitcoin, github) whose RESOLUTION text intentionally diverges from the "X"
 * pattern (see the data file's own docblock) so a future "cleanup" can't
 * silently normalize them away.
 * ⚠ There were THREE until MKT-ROSTER-1; the third was a removed market. An
 * earlier version of this comment said "two rows" for a DIFFERENT reason —
 * @code-reviewer caught that github had been missed — and the number is back at
 * two by subtraction rather than by that miscount returning.
 */
describe("resolution-block-data — content matches the ratified register", () => {
	it("resolution-block-data::RESOLUTION-is-Response-on-X-for-the-three-account-watching-markets", () => {
		// ⚠⚠ BLOCK-3 · MKT-SLATE v1.1 — "X" → "Response on X". RESOLUTION
		// redefined from "the surface" to "the thing read to settle the
		// market"; for these three the thing is a response POST, not the bare
		// platform name. See the data file's own docblock.
		// ⛔⛔ D-50 — THERE WERE FOUR AND `yc-w27-acceptance` LEFT THE SET. Its
		// v3.0 criterion settles on YC's written decision to the applicant, so
		// nothing about it is read off X; it is pinned on its own below. The
		// count in this test's NAME moved with the list deliberately — a name
		// that says "four" over a three-element array is the drift this file
		// exists to catch, one level up.
		let checked = 0;
		for (const slug of [
			"chess-fide-tiebreak-response",
			"math-erdos-solved-on-zugzwang",
			"claude-bundle-response",
		] as const) {
			expect(RESOLUTION_BLOCKS[slug].resolution.line1).toBe("Response on X");
			expect(RESOLUTION_BLOCKS[slug].resolution.href).toBeNull();
			checked += 1;
		}
		// ⛔ NON-VACUITY — three is now the whole set, so an empty array would
		// satisfy every assertion above while proving nothing.
		expect(checked).toBe(3);
	});

	it("resolution-block-data::YCP-01-is-the-only-market-NOT-settled-on-X", () => {
		// ⛔⛔ D-50 — the roster's first non-X resolution type. RESOLUTION is the
		// DOCUMENT read ("YC decision"), RESOLVER the institution that issues it,
		// and they are deliberately NOT the same string — which makes this the
		// one market where the two values diverge while sharing one glyph. The
		// href is the application page v3.0 §3 cites by name and date for YC's
		// own timing statement, not an X profile.
		const blocks = RESOLUTION_BLOCKS["yc-w27-acceptance"];
		expect(blocks.resolution.line1).toBe("YC decision");
		expect(blocks.resolution.href).toBeNull();
		expect(blocks.resolver.line1).toBe("Y Combinator");
		expect(blocks.resolver.href).toBe("https://www.ycombinator.com/apply");
		// ⛔ The guard with teeth: "Response on X" must not come back here by a
		// fixture copied forward from before D-50.
		expect(blocks.resolution.line1).not.toBe("Response on X");
		expect(blocks.resolver.href).not.toMatch(/x\.com/);
	});

	it("resolution-block-data::RESOLUTION-names-the-institution-for-the-other-two", () => {
		// ⚠ These two name a PUBLISHER rather than a post: the thing read to
		// settle them is a published series and a star count, so RESOLUTION and
		// RESOLVER coincide (see the data file's own docblock) and a "cleanup"
		// that normalised them to "Response on X" would be wrong on both.
		// ⚠⚠ MKT-ROSTER-1 — A THIRD ROW STOOD HERE AND WENT WITH ITS MARKET. It
		// carried a lowercase DOMAIN as its RESOLUTION value, which is why this
		// test and its render-level twin pinned case so hard: a CSS `capitalize`
		// would have rendered a different domain. That specific hazard is gone
		// with the value, but the case rule is NOT retired — "Response on X"
		// becomes "Response On X" under `capitalize`, on four markets, so the
		// rule still has a subject and the render-level guard was re-homed onto
		// it rather than deleted.
		expect(RESOLUTION_BLOCKS["bitcoin-price-50k"].resolution.line1).toBe(
			"CoinMarketCap",
		);
		expect(
			RESOLUTION_BLOCKS["github-zugzwang-repo-stars"].resolution.line1,
		).toBe("GitHub");
	});

	it("resolution-block-data::BTC-01-RESOLVER-no-longer-carries-a-Low-subvalue", () => {
		// ⚠⚠ BLOCK-3 — §4c removed line2 "Low"; line1 and href are unchanged.
		// Explicit regression guard: this is the one row that LOST a line2
		// this task, easy to silently restore by copying an older fixture.
		expect(RESOLUTION_BLOCKS["bitcoin-price-50k"].resolver).toEqual({
			line1: "CoinMarketCap",
			line2: null,
			href: "https://coinmarketcap.com/currencies/bitcoin/historical-data/",
			fontSize: 12,
		});
	});

	it("resolution-block-data::CLA-01-RESOLVER-is-the-SOLE-qualifying-account", () => {
		// ⚠⚠ D-50 INVERTS THIS GUARD'S REASON WHILE KEEPING ITS ASSERTION, and
		// the old text is replaced rather than annotated (§8 O-5). It read:
		// "BLOCK-2 — founder-ruled. The live criterion qualifies three accounts
		// (@AnthropicAI, @claudeai, @ClaudeDevs); this chip stays a single named
		// pointer, not an exhaustive citation."
		// v3.0 §3 makes @ClaudeDevs the ONLY account that can resolve this
		// market — "Posts by @claudeai, @AnthropicAI or any other account do not
		// count" — so one name is now the exhaustive citation rather than an
		// abbreviation of three. Same shape, opposite justification.
		const resolver = RESOLUTION_BLOCKS["claude-bundle-response"].resolver;
		expect(resolver.line1).toBe("@ClaudeDevs");
		expect(resolver.line2).toBeNull();
		expect(resolver.href).toBe("https://x.com/ClaudeDevs");
		// ⛔ The two accounts v3.0 explicitly EXCLUDES must not reappear here —
		// this is the assertion that would have caught a fixture copied forward.
		expect(resolver.line1).not.toBe("@claudeai");
		expect(resolver.href).not.toBe("https://x.com/claudeai");
	});

	it("resolution-block-data::CHE-01-RESOLVER-is-Anand-in-person-at-the-11px-floor", () => {
		// ⛔⛔ D-50 — the resolver is a PERSON, not the federation. v3.0 §3 binds
		// to Viswanathan Anand "whatever office he holds or ceases to hold during
		// the window", and rules that a post by @FIDE_chess does not count "even
		// one that speaks for him" — so restoring the federation account here
		// would contradict the criterion, not merely abbreviate it.
		// ⛔ AND THIS IS THE MAP'S ONLY 11px ENTRY, pinned so that a "tidy-up"
		// to the 12–14 band cannot silently make it overflow: fifteen characters
		// need 95.01px at 12 against a 90.664px column. Measured on the deployed
		// build 2026-09-18, with BLOCK-4's four published figures reproduced
		// first as a positive control.
		const resolver = RESOLUTION_BLOCKS["chess-fide-tiebreak-response"].resolver;
		expect(resolver.line1).toBe("@vishy64theking");
		expect(resolver.href).toBe("https://x.com/vishy64theking");
		expect(resolver.fontSize).toBe(11);
		expect(resolver.line1).not.toBe("@FIDE_chess");
		expect(resolver.href).not.toMatch(/FIDE/);
	});

	it("resolution-block-data::the-11px-floor-is-occupied-exactly-ONCE", () => {
		// ⛔⛔ D-50 — the data file asserted "no entry in this map is at the 11px
		// floor as shipped" until this ruling, and that sentence is now corrected
		// there. This is the mechanical half of the correction: exactly one entry
		// may sit on the floor, and it is CHE's resolver. A second arrival is a
		// signal that a value outgrew the column and wants re-measuring in a real
		// browser rather than a step down.
		const atFloor: string[] = [];
		for (const slug of KNOWN_SLUGS) {
			for (const key of [
				"resolution",
				"resolver",
				"closes",
				"flavour",
			] as const) {
				if (RESOLUTION_BLOCKS[slug][key].fontSize === 11) {
					atFloor.push(`${slug}.${key}`);
				}
			}
		}
		expect(atFloor).toEqual(["chess-fide-tiebreak-response.resolver"]);
	});

	it("resolution-block-data::RESOLVER-hrefs-are-real-absolute-URLs", () => {
		for (const slug of KNOWN_SLUGS) {
			const href = RESOLUTION_BLOCKS[slug].resolver.href;
			expect(href).not.toBeNull();
			expect(href).toMatch(/^https:\/\//);
		}
	});

	it("resolution-block-data::GIT-01-text-and-href-deliberately-diverge", () => {
		// ⚠⚠ BLOCK-4 §1 — the display text is now the single word "GitHub"
		// (was "Zugzwang" / "repo"), and the href is BYTE-UNCHANGED. G5 is
		// exactly this pair, and the divergence it names got WIDER, not
		// narrower: the text no longer even hints at which repo.
		const resolver = RESOLUTION_BLOCKS["github-zugzwang-repo-stars"].resolver;
		expect(resolver.line1).toBe("GitHub");
		expect(resolver.line2).toBeNull();
		expect(resolver.href).toBe(
			"https://github.com/zugzwang-foundation/experiment",
		);
		// The negative case this guard exists for: the href must not be the
		// short display text, and the display text must not be the URL.
		expect(resolver.href).not.toBe(resolver.line1);
		expect(resolver.line1).not.toContain("github.com");
		// ⛔⛔ THE FAILURE G5 IS ACTUALLY AGAINST, STATED POSITIVELY. The cheap
		// wrong "fix" is not writing the URL into `line1` — it is trimming the
		// href down to the platform to make it agree with the new one-word text,
		// which would send a reader to github.com instead of this repository and
		// would still satisfy every assertion above. Pin the path segments.
		expect(resolver.href).toContain("/zugzwang-foundation/experiment");
		expect(resolver.href).not.toBe("https://github.com");
		expect(resolver.href).not.toBe("https://github.com/");
	});

	it("resolution-block-data::CLOSES-is-5-Nov-on-every-market", () => {
		// ⛔⛔ G3, AND IT HAS LOST ITS EXCEPTION. This test existed because ONE
		// market closed a month before the rest, and a block reading "5 Nov 2026"
		// on it would have told a participant they could still trade for another
		// month. MKT-ROSTER-1 removed that market, so every remaining CLOSES is
		// the same date and this is now a literal pin rather than a
		// distinguishing test.
		// ⚠ THAT MAKES IT THE WEAKER HALF OF G3, NOT THE WHOLE OF IT. The half
		// with teeth is `CLOSES-matches-the-LIVE-resolution_deadline-for-every-market`
		// above, which derives its expectation from the snapshot instead of
		// hardcoding it — that one still catches a deadline that moves. Keep both:
		// this one catches a map edited away from the live column in the same
		// commit as the snapshot, which the derived test cannot see.
		let checked = 0;
		for (const slug of KNOWN_SLUGS) {
			expect(RESOLUTION_BLOCKS[slug].closes).toEqual({
				line1: "5 Nov 2026",
				line2: null,
				href: null,
				fontSize: 14,
			});
			checked += 1;
		}
		// ⛔ NON-VACUITY — an empty KNOWN_SLUGS would satisfy the loop above.
		expect(checked).toBe(6);
	});

	it("resolution-block-data::BLOCK-4-no-entry-on-any-market-carries-a-line2", () => {
		// ⛔⛔ §5 GUARD 1, AT THE DATA LEVEL — no block renders a second line. The
		// render-level half is in `resolver-cards.test.tsx`; both are needed,
		// because this one cannot see a component that renders a subvalue span
		// from something other than `line2`, and that one cannot see a map entry
		// whose second line is restored but happens not to be rendered by the
		// fixture a given test picked.
		// ⚠ THIS IS THE GUARD THE §1 BRIEF IS MOST AT RISK FROM: BLOCK-4 removed
		// four separate second lines, and the cheapest way to reintroduce any of
		// them is to copy an older map entry forward. Sweeping every block on
		// every market catches that wherever it lands, not only on the rows this
		// file names individually.
		let checked = 0;
		for (const slug of KNOWN_SLUGS) {
			for (const key of [
				"resolution",
				"resolver",
				"closes",
				"flavour",
			] as const) {
				expect(RESOLUTION_BLOCKS[slug][key].line2).toBeNull();
				checked += 1;
			}
		}
		// ⛔ NON-VACUITY — six markets × four blocks. A loop that ran over an
		// empty map would satisfy every assertion above.
		expect(checked).toBe(24);
	});

	it("resolution-block-data::FLAVOUR-is-sentence-case-IN-THE-DATA-and-href-is-null", () => {
		// ⚠⚠ BLOCK-3 — lowercase → sentence case, and it happens HERE, never via
		// a CSS `capitalize` on the rendered value. `capitalize` transforms the
		// first letter of every WORD.
		// ⚠⚠ MKT-ROSTER-1 MOVED THE WORKED EXAMPLE AND NOT THE RULE. The value
		// this comment used to cite was a lowercase domain on a market that has
		// been removed — `capitalize` would have rendered a DIFFERENT DOMAIN. The
		// surviving unsafe value is RESOLUTION's `"Response on X"`, which
		// `capitalize` renders `"Response On X"`, on four of the six markets. The
		// hazard is milder and it is not gone, so the data is still the only
		// place this can be gotten right per-string.
		// ⚠⚠ BLOCK-4 §1 — TWO FLAVOUR CHANGES, founder-ruled, and they are the
		// only values in this map that are neither a name, a date nor a URL:
		// `claude-bundle-response` "Suggestion" → "Feedback" (the criterion
		// resolves on ANY qualifying reply, and "Suggestion" excluded the
		// rejections it resolves YES on), `bitcoin-price-50k` "Barrier" →
		// "Sentiment" (named the $50k threshold; now names the market).
		const expected: Record<(typeof KNOWN_SLUGS)[number], string> = {
			"chess-fide-tiebreak-response": "Petition",
			"bitcoin-price-50k": "Sentiment",
			"math-erdos-solved-on-zugzwang": "Innovation",
			"claude-bundle-response": "Feedback",
			"yc-w27-acceptance": "Showcase",
			"github-zugzwang-repo-stars": "Callout",
		};
		// ⛔ THE SUPERSEDED PAIR, ASSERTED ABSENT. The map above would still pass
		// if a later edit reverted a value AND this fixture with it — they move
		// together, which is the same non-independence @code-reviewer caught in
		// the `KNOWN_SLUGS` guard higher up this file. These two lines cannot.
		expect(RESOLUTION_BLOCKS["bitcoin-price-50k"].flavour.line1).not.toBe(
			"Barrier",
		);
		expect(RESOLUTION_BLOCKS["claude-bundle-response"].flavour.line1).not.toBe(
			"Suggestion",
		);
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
