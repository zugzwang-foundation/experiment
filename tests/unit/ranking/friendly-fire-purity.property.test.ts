import fc from "fast-check";
import { describe, expect, it } from "vitest";
import type { Badge, PostSubstrate } from "@/lib/ranking";
import { badgeFor, topOrder } from "@/lib/ranking";
import {
	DEFAULT_RANKING_CONFIG,
	type RankingConfig,
} from "@/lib/ranking.config";

/**
 * FF-1 · G10b — **the extension is PURE: the flag reaches `b` and nothing
 * else** (ADR-0058 outcome 5, Driver 5; RANKING.md §2 as amended).
 *
 * ADR-0058 is only auditable as a pure extension if two separate things hold,
 * and they pull in opposite directions:
 *
 *   1. **The flag must NOT leak into traction or stake.** `n` counts PEOPLE and
 *      `D` sums attracted Dharma; neither is a question about stance, and a
 *      declared stance that quietly moved either would let a participant buy
 *      rank with a checkbox — free, since the flag costs nothing once a
 *      reply-bet is already being placed (ADR-0058 Consequences, Negative 2).
 *   2. **The flag MUST reach `b`.** An implementation that accepted the two new
 *      fields and ignored them satisfies (1) perfectly and delivers nothing.
 *
 * A property suite written for (1) alone is therefore VACUOUSLY GREEN against
 * exactly the wrong implementation — which is the state of the tree today, and
 * why §3 below exists and is the file's red driver.
 *
 * ## How (1) is asked through a public surface
 *
 * `derive` is module-private, so `n` and `D` cannot be read directly. Instead
 * the lanes that depend on anything else are CLOSED: `LANES_ONLY` puts the
 * `lop` and `nPowB` floors beyond any reachable value (`lop` ∈ [0,1] and
 * `nPowB` = n^b ≤ n, both far under 1e9), so `clears()` is false for them
 * always and `topOrder` / `badgeFor` become functions of `n` and `D` alone.
 * Any difference the stance assignment makes under that config is a leak.
 *
 * ## The legal stance assignments
 *
 * `endorse_count` counts distinct same-side repliers with NO flag; it cannot
 * exceed `support_count`. `contest_count` counts everyone who countered PLUS
 * every same-side replier who flagged, each person once — so it is at least
 * `counter_count` and at most `support_count + counter_count`. One further
 * constraint is not arithmetic but arises from the model: if nobody replied on
 * the own side without a flag (`endorse = 0`) while `support_count > 0`, then
 * every one of those people flagged, so `contest_count ≥ 1`. Without that,
 * a generator can emit `max(endorse, contest) = 0` on a post that HAS replies,
 * making `b` undefined where the model says it is defined.
 */

const CFG = DEFAULT_RANKING_CONFIG;

/**
 * The n-and-D-only config. Both suppressed floors are unreachable rather than
 * merely large: `lop = 1 − b` never exceeds 1, and `nPowB = n^b` never exceeds
 * `n`, which these generators cap at 50.
 */
const LANES_ONLY: RankingConfig = {
	...CFG,
	floorLane: { ...CFG.floorLane, lop: 1e9, nPowB: 1e9 },
};

/** Whole Đ as an exact 18-dp decimal string — never a JS float (CLAUDE.md §2). */
const dharma = (whole: number): string => `${whole}.000000000000000000`;

type Draw = {
	supportCount: number;
	counterCount: number;
	supportDharma: number;
	counterDharma: number;
	authorStake: number;
	minute: number;
	endorseCount: number;
	contestCount: number;
};

/**
 * A post plus ANY legal stance assignment over its side counts. The two are
 * drawn together because the assignment's domain depends on the counts.
 */
const drawArb: fc.Arbitrary<Draw> = fc
	.record({
		supportCount: fc.integer({ min: 0, max: 25 }),
		counterCount: fc.integer({ min: 0, max: 25 }),
		supportDharma: fc.integer({ min: 0, max: 2000 }),
		counterDharma: fc.integer({ min: 0, max: 2000 }),
		authorStake: fc.integer({ min: 1, max: 500 }),
		minute: fc.integer({ min: 0, max: 5000 }),
	})
	.chain((base) =>
		fc.integer({ min: 0, max: base.supportCount }).chain((endorseCount) => {
			const lo = Math.max(
				base.counterCount,
				// Every same-side replier flagged ⇒ they are all contesters.
				endorseCount === 0 && base.supportCount > 0 ? 1 : 0,
			);
			const hi = Math.max(lo, base.supportCount + base.counterCount);
			return fc
				.integer({ min: lo, max: hi })
				.map((contestCount) => ({ ...base, endorseCount, contestCount }));
		}),
	);

function build(draw: Draw, index: number): PostSubstrate {
	return {
		// Padded so the §3.4 final tiebreak (lexicographic UUIDv7) is stable and
		// the two variants below order identically when everything else ties.
		id: `post-${String(index).padStart(4, "0")}`,
		parentSide: index % 2 === 0 ? "YES" : "NO",
		supportCount: draw.supportCount,
		counterCount: draw.counterCount,
		endorseCount: draw.endorseCount,
		contestCount: draw.contestCount,
		supportCountTotal: draw.supportCount,
		counterCountTotal: draw.counterCount,
		supportDharma: dharma(draw.supportDharma),
		counterDharma: dharma(draw.counterDharma),
		friendlyFireDharma: "0",
		createdAt: new Date(Date.UTC(2026, 8, 15, 0, draw.minute)),
		authorStake: dharma(draw.authorStake),
		authorStakeOriginal: dharma(draw.authorStake),
		authorSold: false,
		priceAtBet: "0.5",
	};
}

/** The same post with NO flag anywhere — the pre-ADR reading of the same rows. */
function unflagged(p: PostSubstrate): PostSubstrate {
	return { ...p, endorseCount: p.supportCount, contestCount: p.counterCount };
}

const SEED = 20260922;
const NUM_RUNS = 500;
/**
 * `badgeFor` re-derives the WHOLE pool per call (`allPosts.map(derive)`), and
 * each derive costs a `Decimal.pow`, so the badge property is O(posts²) per run
 * where the order property is O(posts). Measured at 500 runs × 8 posts: 7.1 s
 * against 1.3 s. Lowered here rather than shrinking the corpus, because the
 * multi-post pool is what makes a margin denominator exist at all.
 */
const NUM_RUNS_BADGE = 150;

describe("ranking::friendly-fire-purity — traction and stake never see the flag", () => {
	it("topOrder is identical under ANY legal stance assignment (n/D lanes only)", () => {
		fc.assert(
			fc.property(
				fc.array(drawArb, { minLength: 1, maxLength: 8 }),
				(draws) => {
					const posts = draws.map(build);
					const baseline = posts.map(unflagged);
					expect(topOrder(posts, LANES_ONLY).map((p) => p.id)).toEqual(
						topOrder(baseline, LANES_ONLY).map((p) => p.id),
					);
				},
			),
			{ seed: SEED, numRuns: NUM_RUNS },
		);
	});

	it("badgeFor is identical under ANY legal stance assignment (n/D lanes only)", () => {
		fc.assert(
			fc.property(
				fc.array(drawArb, { minLength: 1, maxLength: 8 }),
				(draws) => {
					const posts = draws.map(build);
					const baseline = posts.map(unflagged);
					for (let i = 0; i < posts.length; i++) {
						expect(badgeFor(posts[i] as PostSubstrate, posts, LANES_ONLY)).toBe(
							badgeFor(baseline[i] as PostSubstrate, baseline, LANES_ONLY),
						);
					}
				},
			),
			{ seed: SEED, numRuns: NUM_RUNS_BADGE },
		);
	});

	it("…and the suppressed lanes really are suppressed — the control", () => {
		// ⚠ WITHOUT THIS THE TWO PROPERTIES ABOVE ARE UNFALSIFIABLE. If `LANES_ONLY`
		// suppressed nothing — a typo in the floors, a lane list that stopped
		// reading `cfg` — they would still pass, because they compare the model
		// against itself. So: a post that IS badged under the default config
		// must be UNBADGED here, proving the third lane is the one that was shut
		// off and that the remaining two decide alone.
		const even = build(
			{
				supportCount: 4,
				counterCount: 4,
				supportDharma: 100,
				counterDharma: 100,
				authorStake: 90,
				minute: 1,
				endorseCount: 4,
				contestCount: 4,
			},
			1,
		);
		const blowout = build(
			{
				supportCount: 0,
				counterCount: 8,
				supportDharma: 0,
				counterDharma: 200,
				authorStake: 100,
				minute: 0,
				endorseCount: 0,
				contestCount: 8,
			},
			0,
		);
		const pool = [blowout, even];
		// Under the real config the contestation lane fires (contested.test.ts's
		// own calibration)…
		expect(badgeFor(even, pool, CFG)).toBe("Contested");
		// …and under LANES_ONLY it cannot, because that lane never clears.
		expect(badgeFor(even, pool, LANES_ONLY)).toBeNull();
	});
});

describe("ranking::friendly-fire-purity — the all-false corpus is the pre-ADR model", () => {
	/**
	 * A FIXED corpus with the stance pair left at the zero-flag identity
	 * (`endorse = support`, `contest = counter`). The expected values below are
	 * a BASELINE MEASURED FROM THE PRE-ADR MODEL, not a derivation — they are
	 * what `badgeFor` and `topOrder` return today, recorded so that FF-1 landing
	 * cannot move them. ⚠ If one of these ever needs updating, the question to
	 * answer first is whether the flag leaked; "the order changed" is the
	 * symptom this block exists to raise, never a thing to re-record.
	 */
	const CORPUS: PostSubstrate[] = [
		// n = 40, b = 1 ⇒ n^b = 40; D = 600.
		build(
			{
				supportCount: 20,
				counterCount: 20,
				supportDharma: 300,
				counterDharma: 300,
				authorStake: 100,
				minute: 0,
				endorseCount: 20,
				contestCount: 20,
			},
			0,
		),
		// n = 6, b = 1 ⇒ n^b = 6; D = 100 (under the stake floor).
		build(
			{
				supportCount: 3,
				counterCount: 3,
				supportDharma: 50,
				counterDharma: 50,
				authorStake: 80,
				minute: 1,
				endorseCount: 3,
				contestCount: 3,
			},
			1,
		),
		// n = 10, b = 0 ⇒ n^b = 1 (under the contestation floor); D = 250.
		build(
			{
				supportCount: 10,
				counterCount: 0,
				supportDharma: 250,
				counterDharma: 0,
				authorStake: 70,
				minute: 2,
				endorseCount: 10,
				contestCount: 0,
			},
			2,
		),
		// The silent post: every lane below every floor.
		build(
			{
				supportCount: 0,
				counterCount: 0,
				supportDharma: 0,
				counterDharma: 0,
				authorStake: 60,
				minute: 3,
				endorseCount: 0,
				contestCount: 0,
			},
			3,
		),
		// n = 4 (under the traction floor), D = 5000 — the stake lane's winner.
		build(
			{
				supportCount: 2,
				counterCount: 2,
				supportDharma: 2500,
				counterDharma: 2500,
				authorStake: 50,
				minute: 4,
				endorseCount: 2,
				contestCount: 2,
			},
			4,
		),
		// n = 155, b ≈ 0.033 ⇒ n^b ≈ 1.18; D = 170 — the traction lane's winner.
		build(
			{
				supportCount: 150,
				counterCount: 5,
				supportDharma: 150,
				counterDharma: 20,
				authorStake: 40,
				minute: 5,
				endorseCount: 150,
				contestCount: 5,
			},
			5,
		),
	];

	it("badges are unchanged for every post", () => {
		const badges = CORPUS.map((p) => badgeFor(p, CORPUS, CFG));
		expect(badges).toEqual([
			"Contested",
			null,
			null,
			null,
			"Highest Stakes",
			"Most Debated",
		] satisfies (Badge | null)[]);
	});

	it("the Top order is unchanged", () => {
		// Measured against the pre-ADR model, and it exercises all three Top
		// lanes rather than one: 0004 leads on STAKE (D 5000 against a runner-up
		// of 600 — ratio 8.33), 0005 on TRACTION (n 155 against 40 — 3.875),
		// 0002 on the gated DOMINANCE SPLIT (lop 1.0 against 0.967 — 1.034), and
		// 0000 trails them at a flat 1.0 on both shared lanes. 0003 is
		// below every floor and sorts last by rank class.
		expect(topOrder(CORPUS, CFG).map((p) => p.id)).toEqual([
			"post-0004",
			"post-0005",
			"post-0002",
			"post-0000",
			"post-0001",
			"post-0003",
		]);
	});
});

describe("ranking::friendly-fire-purity — but b IS read (the sensitivity control)", () => {
	/**
	 * ⛔ **THE RED DRIVER, AND THE REASON THE TWO PROPERTIES ABOVE ARE NOT THE
	 * WHOLE FILE.** They compare the model against itself under a config that
	 * hides the only lane the flag touches, so an implementation that accepted
	 * `endorseCount` / `contestCount` and never read them would pass both — and
	 * that is precisely the tree's state before FF-1 lands.
	 *
	 * The shape below is chosen so that SIDE carries no information at all:
	 * `counterCount = 0` for both posts, so the pre-ADR formula gives
	 * `b = min(m, 0) / max(m, 0) = 0` for EVERY member of the family and no
	 * member can ever clear the contestation floor. Under declared stance the
	 * split post has `b` near 1 and `n^b` near `m`. Traction and stake are exact
	 * dead heats between the pair (equal `n`, equal `D`, both ratios 1.0 < kLane),
	 * so the contestation lane is the only one that can decide, and a badge
	 * appearing at all is proof that `b` moved.
	 *
	 * ⚠ `m ≥ 6`: at `m = 5` the split is 2/3, `b = 2/3` and `5^(2/3) ≈ 2.92`,
	 * which sits just UNDER `floorLane.nPowB = 3`. The bound is a property of
	 * the floor, not a generator convenience, and lowering it would make this
	 * control flaky rather than wrong-looking.
	 */
	it("an even same-side split earns Contested at every size the floor admits", () => {
		fc.assert(
			fc.property(
				fc.integer({ min: 6, max: 40 }),
				fc.integer({ min: 200, max: 4000 }),
				(m, d) => {
					const endorseCount = Math.floor(m / 2);
					const contestCount = m - endorseCount;
					const shared = {
						supportCount: m,
						counterCount: 0,
						supportDharma: d,
						counterDharma: 0,
						minute: 0,
					};
					const split = build(
						{ ...shared, authorStake: 100, endorseCount, contestCount },
						0,
					);
					const unanimous = build(
						{
							...shared,
							authorStake: 90,
							endorseCount: m,
							contestCount: 0,
						},
						1,
					);
					const pool = [split, unanimous];
					// The split post is the SOLE contestation-lane clearer → SENTINEL.
					expect(badgeFor(split, pool, CFG)).toBe("Contested");
					// Its twin, identical in n and D, clears nothing and wears nothing.
					expect(badgeFor(unanimous, pool, CFG)).toBeNull();
				},
			),
			{ seed: SEED, numRuns: NUM_RUNS },
		);
	});
});
