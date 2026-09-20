import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { FREEZE_INSTANT_UTC } from "@/server/markets/create";

import {
	CONTENT_MARKET_COUNT,
	CONTENT_MARKET_SOURCE_PATH,
	loadContentMarkets,
} from "../../staging/content-markets";

// ═══════════════════════════════════════════════════════════════════════════
// LIQ-1-RESTORE B2 — the content markets parse, and parse into something
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
	it("reads every market out of the committed snapshot", () => {
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
	 * Measured against the committed snapshot, re-measured 2026-09-18 after
	 * MKT-ROSTER-1 took the slate to six, and AGAIN after D-50 overlaid five
	 * markets' v3.0 wording onto it:
	 *
	 *   slug                                 v2.2    v3.0    v3.1    v3.2
	 *   chess-fide-tiebreak-response         3609 -> 1903
	 *   bitcoin-price-50k                    3795 -> 3795   (MKT-BTC-01 untouched)
	 *   math-erdos-solved-on-zugzwang        3836 -> 2852 -> 2293 -> 2852
	 *   claude-bundle-response               3733 -> 2169
	 *   yc-w27-acceptance                     789 -> 1658   (re-slugged)
	 *   github-zugzwang-repo-stars            794 ->  792
	 *
	 * ⚠ COLUMNS THREE AND FOUR ARE ONE MARKET AND TWO RULINGS, AND THE SECOND
	 * UNDOES THE FIRST. MKT-MAT-01 went to v3.1 (2026-09-19) to revert to its
	 * ratified v2.2 rule: every clause carrying the "solved ON ZUGZWANG"
	 * condition left — the question, the YES and NO conditions, the whole
	 * `On Zugzwang.` paragraph, the third element of the criterion, and the
	 * evidence pointer, 559 characters of one idea. The reason was sound: the
	 * title had dropped those words a day earlier, and a title asking whether
	 * three Erdős problems get solved, over a description resolving only if they
	 * are solved here, is a resolution dispute waiting for a reader who trusts
	 * the title.
	 *
	 * ⛔⛔ v3.2 (2026-09-20) WITHDRAWS v3.1 AND RESTORES v3.0 IN FULL, AND THE
	 * REASON IS NOT EDITORIAL. Between the two rulings the production market took
	 * a bet — Đ 10 on NO, 2026-09-19T14:13:43Z — and it still holds the stake,
	 * its comment and its position. `scripts/apply-v3-market-specs.ts` refuses to
	 * edit a market holding any of the three (D-50 ruling 2), because no event
	 * carries a market's wording: change the question and nothing records what
	 * the author of that argument actually staked on. So the DATABASE keeps v3.0
	 * and the canon comes back to meet it, rather than the other way round. The
	 * v3.1 objection is real and remains open — it is a question about wording
	 * that can only be settled by a ruling on the stake, not by an edit.
	 *
	 * ⚠⚠ D-50 MOVED EVERY FIGURE EXCEPT BITCOIN'S, AND FOUR OF THE FIVE WENT
	 * DOWN — which is the direction the bound below is least able to see. The
	 * v3.0 criteria are tighter, not longer: staging had been carrying pre-v2.2
	 * copy (chess lost 1 706 characters), so the drop is a market catching up to
	 * the founder's current wording rather than a truncation. The 700-character
	 * floor still holds on all six, by a margin of 92 at the tightest (github's
	 * 792). ⇒ if a future edit takes any description under ~800, the floor is no
	 * longer a comfortable guard and wants raising to sit under the real minimum.
	 *
	 * FOUR of the six carried a long, fully-structured criterion and two did not;
	 * after v3.0 the spread is narrower and the shape of the argument is the same.
	 * A test written to 700–800 would be red on arrival for those four, and the
	 * only way to make it green is to edit founder-authored market copy — which
	 * is a CLAUDE.md §3 refusal, not a fix.
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
			"chess-fide-tiebreak-response": 1903,
			"bitcoin-price-50k": 3795,
			"math-erdos-solved-on-zugzwang": 2852,
			"claude-bundle-response": 2169,
			"yc-w27-acceptance": 1658,
			"github-zugzwang-repo-stars": 792,
		});
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// ⛔⛔ THE PRODUCTION SNAPSHOT, GUARDED HERE BECAUSE NOTHING ELSE GUARDS IT.
//
// `docs/data/prod-markets-snapshot.json` arrived with MKT-ROSTER-1 and shipped
// with no parse guard at all (`@code-reviewer`, HIGH). Its staging sibling has
// had one since LIQ-1-RESTORE — the block above — and the asymmetry matters more
// for the production file than for staging's, for two reasons:
//
//   1 · It is the ONLY committed copy of production's own description text.
//       Production was built fresh on 2026-09-14, not restored from staging, so
//       the two environments' copy diverged. Nothing else in the repository can
//       reconstruct production's.
//       ⚠⚠ THE FIGURE THAT USED TO STAND HERE — "SEVEN of the eight
//       descriptions and one title" — WAS ALREADY WRONG BEFORE D-50 (measured:
//       FIVE of six descriptions and one title, the slate having gone to six at
//       D-49), and D-50 makes it wrong in the other direction too: ruling 3
//       aligns the five it touches, so the divergence is now ONE description
//       (`bitcoin-price-50k`, which ruling 4 leaves at v2.2) and ZERO titles.
//       ⇒ NO COUNT IS WRITTEN HERE. It has been wrong at two different values
//       for two different reasons, which is `O-15`: a number in prose decays
//       whatever the prose says about it. The live figure is asserted rather
//       than described — `tests/unit/staging/market-spec-snapshot-parity.test.ts`
//       pins the five as identical across both files and `bitcoin-price-50k` as
//       deliberately not.
//   2 · It is the input to the one irreversible step in the task. A short or
//       malformed snapshot would first surface at the production RESTORE — that
//       is, after the wipe.
//
// ⚠ IT VALIDATES SHAPE DIRECTLY, NOT THROUGH THE LOADER. `loadProdContentMarkets`
// lives on the never-merged one-time branch; this guard has to survive on `main`,
// where that module does not exist. So it reads the committed bytes and asserts
// the properties `createMarket` will actually require, which is what the loader
// would have checked anyway.
// ═══════════════════════════════════════════════════════════════════════════

describe("the production snapshot is well-formed", () => {
	const PROD_PATH = fileURLToPath(
		new URL("../../../docs/data/prod-markets-snapshot.json", import.meta.url),
	);
	type SnapMarket = {
		id: string;
		slug: string;
		title: string;
		description: string;
		resolution_deadline: string;
		media_video_url: string | null;
	};
	type SnapMedia = {
		market_id: string;
		r2_object_key: string;
		display_order: number;
		is_default: boolean;
	};
	const snap = JSON.parse(readFileSync(PROD_PATH, "utf8")) as {
		source?: { user?: string };
		counts?: Record<string, number>;
		markets: SnapMarket[];
		market_media: SnapMedia[];
	};

	it("prod-snapshot::holds exactly six markets and twelve media rows", () => {
		// CONTROL FIRST — a parse that yielded an empty array would satisfy every
		// loop below while looking at nothing.
		expect(snap.markets.length).toBe(6);
		expect(snap.market_media.length).toBe(12);
		expect(snap.counts).toEqual({ markets: 6, pools: 6, market_media: 12 });
	});

	it("prod-snapshot::records PRODUCTION as its source, not staging", () => {
		// ⛔ THE LOAD-BEARING LINE. Seeding production from the staging capture
		// would replace the founder's production copy and orphan every R2 object,
		// and every other assertion here would still pass — both files now hold
		// six markets, so a count cannot tell them apart.
		expect(snap.source?.user).toContain("zbvprdcyxhlguxbostdj");
		expect(snap.source?.user).not.toContain("rwfdoqzsghqhhdapxafg");
	});

	it("prod-snapshot::ids are production's own and overlap staging's nowhere", () => {
		const prodIds = new Set(snap.markets.map((m) => m.id));
		const stagingIds = new Set(SPECS.map((s) => s.marketId));
		for (const id of prodIds) expect(stagingIds.has(id)).toBe(false);
		expect(prodIds.size).toBe(6);
	});

	it("prod-snapshot::every market is createMarket-acceptable", () => {
		let checked = 0;
		for (const m of snap.markets) {
			expect(m.id, m.slug).toMatch(
				/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
			);
			expect(m.slug.length, m.slug).toBeGreaterThan(0);
			expect(m.title.length, m.slug).toBeGreaterThan(0);
			// A short description is a market nobody can adjudicate.
			expect(m.description.length, m.slug).toBeGreaterThan(400);
			const deadline = Date.parse(m.resolution_deadline);
			expect(Number.isNaN(deadline), m.slug).toBe(false);
			// Never past the conclusion freeze.
			expect(deadline, m.slug).toBeLessThanOrEqual(
				FREEZE_INSTANT_UTC.getTime(),
			);
			checked += 1;
		}
		expect(checked).toBe(6);
	});

	it("prod-snapshot::media keys are market-id-scoped with a uuid stem", () => {
		let checked = 0;
		for (const m of snap.markets) {
			const mine = snap.market_media.filter((x) => x.market_id === m.id);
			// ⚠ PER-MARKET, not just a file total. A snapshot with three on one
			// market and one on another sums to twelve and is still broken.
			expect(mine.length, m.slug).toBe(2);
			expect(mine.filter((x) => x.is_default).length, m.slug).toBe(1);
			for (const x of mine) {
				// The same exact shape `createMarket` validates — an exact match,
				// never a prefix, so `m/<id>/../<other>/x.jpg` cannot pass.
				expect(x.r2_object_key, m.slug).toMatch(
					new RegExp(`^m/${m.id}/[0-9a-f-]{36}\\.[a-z0-9]+$`),
				);
				checked += 1;
			}
		}
		expect(checked).toBe(12);
	});
});
