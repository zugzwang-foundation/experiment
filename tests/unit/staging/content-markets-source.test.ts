import { describe, expect, it } from "vitest";

import { FREEZE_INSTANT_UTC } from "@/server/markets/create";

import {
	CONTENT_MARKET_COUNT,
	CONTENT_MARKET_SOURCE_PATH,
	loadContentMarkets,
} from "../../staging/content-markets";

// ═══════════════════════════════════════════════════════════════════════════
// LIQ-1-RESTORE B2 — the eight content markets parse, and parse into something
// `createMarket` will actually accept.
//
// This runs in CI on every PR and touches no database. It reads the REAL
// snapshot bytes rather than a fixture of them, because the failure this guards
// is the snapshot itself going wrong — a market lost in a merge, a media key
// rewritten, a deadline edited past the freeze. A fixture would test the parser
// against a copy of the thing it is supposed to be checking.
// ═══════════════════════════════════════════════════════════════════════════

const SPECS = loadContentMarkets();

describe("the source is real", () => {
	// CONTROL — every assertion below loops over SPECS, and a loop over an
	// empty array asserts nothing. Prove the read found something first.
	it("reads all eight markets out of the committed snapshot", () => {
		expect(SPECS).toHaveLength(CONTENT_MARKET_COUNT);
		expect(CONTENT_MARKET_SOURCE_PATH).toMatch(
			/docs\/data\/staging-markets-snapshot\.json$/,
		);
	});

	it("gives every market a non-empty title and description", () => {
		for (const s of SPECS) {
			expect({
				slug: s.slug,
				title: s.title.trim().length > 0,
				description: s.description.trim().length > 0,
			}).toEqual({ slug: s.slug, title: true, description: true });
		}
	});
});

describe("slugs and ids", () => {
	it("are distinct", () => {
		expect(new Set(SPECS.map((s) => s.slug)).size).toBe(SPECS.length);
		expect(new Set(SPECS.map((s) => s.marketId)).size).toBe(SPECS.length);
	});

	it("are the kebab shape createMarket's SLUG_RE admits", () => {
		// Mirrors `create.ts`'s SLUG_RE + the 3–80 length bound. A slug that
		// fails here is a MarketSlugInvalidError halfway through a seeding run.
		for (const s of SPECS) {
			expect({
				slug: s.slug,
				kebab: /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s.slug),
				length: s.slug.length >= 3 && s.slug.length <= 80,
			}).toEqual({ slug: s.slug, kebab: true, length: true });
		}
	});

	it("are canonical UUIDv7s, because createMarket rejects anything else", () => {
		const UUID_V7 =
			/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
		for (const s of SPECS) {
			expect({ slug: s.slug, v7: UUID_V7.test(s.marketId) }).toEqual({
				slug: s.slug,
				v7: true,
			});
		}
	});
});

describe("deadlines", () => {
	it("all sit at or below the conclusion-freeze instant", () => {
		// The constant is IMPORTED, not restated. `create.ts` throws
		// MarketDeadlineCeilingError on `deadline > FREEZE_INSTANT_UTC`, and if
		// that instant ever moves this assertion must move with it rather than
		// keep asserting a literal that used to be true.
		expect(FREEZE_INSTANT_UTC.toISOString()).toBe("2026-11-05T23:59:00.000Z");
		for (const s of SPECS) {
			expect({
				slug: s.slug,
				withinCeiling:
					s.resolutionDeadline.getTime() <= FREEZE_INSTANT_UTC.getTime(),
			}).toEqual({ slug: s.slug, withinCeiling: true });
		}
	});

	it("are all still in the future at the time of writing", () => {
		// `createMarket` also throws MarketDeadlineInPastError on
		// `deadline <= now`. This is the seeder's real expiry: once a content
		// market's deadline passes, it cannot be recreated by this path at all —
		// which is worth failing loudly for rather than discovering mid-run.
		const AUTHORED_AT = new Date("2026-09-07T00:00:00.000Z");
		for (const s of SPECS) {
			expect({
				slug: s.slug,
				future: s.resolutionDeadline.getTime() > AUTHORED_AT.getTime(),
			}).toEqual({ slug: s.slug, future: true });
		}
	});
});

describe("media manifests", () => {
	it("carry at least one image with exactly one default", () => {
		// `validateMediaManifest`'s two rules, checked before a run rather than
		// during one. A market that fails either is a MediaRequiredError /
		// DefaultMediaRequiredError with some markets already created.
		for (const s of SPECS) {
			expect({
				slug: s.slug,
				count: s.media.length > 0,
				defaults: s.media.filter((m) => m.isDefault).length,
			}).toEqual({ slug: s.slug, count: true, defaults: 1 });
		}
	});

	it("carry keys in the exact m/<marketId>/<mediaId>.<ext> shape", () => {
		// THE LOAD-BEARING ONE. `createMarket` builds this regex per market and
		// rejects any key that deviates — an EXACT match, not a prefix, so
		// `m/<id>/../other/x.jpg` cannot pass. Reusing the original market ids is
		// what keeps the surviving R2 objects addressable; this is the assertion
		// that says the ids and the keys still agree.
		for (const s of SPECS) {
			const keyRe = new RegExp(`^m/${s.marketId}/[0-9a-f-]{36}\\.[a-z0-9]+$`);
			for (const m of s.media) {
				expect({
					slug: s.slug,
					key: m.key,
					matches: keyRe.test(m.key),
				}).toEqual({
					slug: s.slug,
					key: m.key,
					matches: true,
				});
			}
		}
	});

	it("derive each mediaId as the key's own filename stem", () => {
		// Not a fresh uuid: the id IS the stem, so a mint here would build a key
		// pointing at bytes that do not exist.
		for (const s of SPECS) {
			for (const m of s.media) {
				expect(m.key).toBe(
					`m/${s.marketId}/${m.mediaId}.${m.key.split(".").pop()}`,
				);
			}
		}
	});

	it("order the default first", () => {
		for (const s of SPECS) {
			expect({ slug: s.slug, firstIsDefault: s.media[0]?.isDefault }).toEqual({
				slug: s.slug,
				firstIsDefault: true,
			});
		}
	});
});

describe("description lengths", () => {
	/**
	 * ⚠ THE KICKOFF SAID 700–800 CHARACTERS. THE CONTENT DOES NOT.
	 *
	 * Measured against the committed snapshot on 2026-09-07:
	 *
	 *   mumbai-bmc-pink-october-disclosure   2990
	 *   oktoberfest-munich-beer-volume       3939
	 *   chess-fide-tiebreak-response         3609
	 *   bitcoin-price-50k                    3795
	 *   math-erdos-contribution-response     3836
	 *   claude-bundle-response               3733
	 *   yc-paper-club-response                789
	 *   github-zugzwang-repo-stars            794
	 *
	 * Six of the eight carry an appended "Resolution type. …" passage the other
	 * two do not. A test written to 700–800 would be red on arrival for those
	 * six, and the only way to make it green is to edit founder-authored market
	 * copy — which is a CLAUDE.md §3 refusal, not a fix.
	 *
	 * So the bound below is the MEASURED one, and it is deliberately loose at the
	 * top and tight at the bottom: the failure worth catching is a description
	 * that got TRUNCATED (a bad merge, a partial write, an empty field), not one
	 * that grew. `markets.description` is the resolution criterion the market
	 * settles against; a short one is a market nobody can adjudicate.
	 */
	it("are all long enough to be a resolution criterion", () => {
		for (const s of SPECS) {
			expect({ slug: s.slug, tooShort: s.description.length < 700 }).toEqual({
				slug: s.slug,
				tooShort: false,
			});
		}
	});

	it("records the measured distribution, so a silent rewrite is visible", () => {
		// A pin, not a bound. If somebody edits the copy this goes red and the
		// diff says by how much — which is the point: market copy changing
		// without a ruling is the thing to notice.
		expect(
			Object.fromEntries(SPECS.map((s) => [s.slug, s.description.length])),
		).toEqual({
			"mumbai-bmc-pink-october-disclosure": 2990,
			"oktoberfest-munich-beer-volume": 3939,
			"chess-fide-tiebreak-response": 3609,
			"bitcoin-price-50k": 3795,
			"math-erdos-contribution-response": 3836,
			"claude-bundle-response": 3733,
			"yc-paper-club-response": 789,
			"github-zugzwang-repo-stars": 794,
		});
	});
});
