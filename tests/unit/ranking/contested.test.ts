import { describe, expect, it } from "vitest";
import type { PostSubstrate } from "@/lib/ranking";
import { badgeFor } from "@/lib/ranking";
import { DEFAULT_RANKING_CONFIG } from "@/lib/ranking.config";

// DEBATE.8 §5.6 tests-first (TDD RED) — the Contested (n^b) lens and its
// zero-reply edge (RANKING.md §6.1). The value import `badgeFor` WILL fail to
// resolve until `@/lib/ranking` lands — that RED state is the goal (plan scope
// item 7). One subject per file (AGENTS.md §9): this file = the §6.1 contestation
// edges, exercised through `badgeFor` (the only public surface the contestation
// lane reaches in v1 — the standalone Contested mode is computed-but-unexposed,
// OD-3).
//
// Asserts §6.1: (1) n = 0 ⇒ contestation score 0 — a zero-reply post never earns
// Contested and the 0^undefined trap is avoided (no throw); (2) a fully
// one-sided post has b = 0 ⇒ n^b = n^0 = 1, sunk near the bottom of the
// contestation lane (never Contested-eligible since 1 < floorLane.nPowB = 3).
//
// Derived-quantity contract (kickoff): n = supportCount + counterCount;
// b = min(sc,cc)/max(sc,cc); nPowB = n===0 ? 0 : n^b. OD-4 placeholder floor
// floorLane.nPowB = 3.

const CFG = DEFAULT_RANKING_CONFIG;

function post(
	over: Partial<PostSubstrate> & Pick<PostSubstrate, "id">,
): PostSubstrate {
	const built: PostSubstrate = {
		parentSide: "YES",
		supportCount: 0,
		counterCount: 0,
		// FF-1 / ADR-0058 — the DECLARED-STANCE pair the balance term `b` now
		// reads. Defaulted below from the side counts rather than stated here,
		// because the default is not a convenience: `endorse_count = support_count`
		// and `contest_count = counter_count` IS the zero-flag identity ADR-0058
		// Driver 5 promises, so every case in this file that says nothing about
		// the flag keeps exactly the badge it had before the ADR.
		endorseCount: 0,
		contestCount: 0,
		// The Support-lane meter's numerator. A DISPLAY figure only — no lane and
		// no badge reads it — so it defaults to zero and no case here states it.
		friendlyFireDharma: "0",
		// RANK-3 — the DISPLAY totals (self- and removed-inclusive). In these fixtures
		// every replier is a distinct person and nobody replies to their own post, so
		// the displayed reply count and the distinct-people ranking count coincide. A
		// case needing them to differ states both explicitly.
		supportCountTotal: 0,
		counterCountTotal: 0,
		supportDharma: "0",
		counterDharma: "0",
		createdAt: new Date("2026-09-01T00:00:00.000Z"),
		authorStake: "100",
		authorStakeOriginal: "100",
		authorSold: false,
		priceAtBet: "0.5",
		...over,
	};
	// The zero-flag identity, applied AFTER the spread so it reads the case's own
	// side counts rather than the zeros above.
	const withStance: PostSubstrate = {
		...built,
		endorseCount: over.endorseCount ?? built.supportCount,
		contestCount: over.contestCount ?? built.counterCount,
	};
	// RANK-1 — `authorStake` is now SURVIVING basis and `authorStakeOriginal` the
	// frozen one. Unless a case explicitly states an original (an argument sold
	// down), the two are equal: a fixture where the original is SMALLER than what
	// survives is unrepresentable in the database (`lots_surviving_basis_monotone`),
	// and a fixture the storage layer would reject teaches nothing.
	return over.authorStakeOriginal === undefined
		? { ...withStance, authorStakeOriginal: withStance.authorStake }
		: withStance;
}

describe("ranking::contested-zero-reply-guard (§6.1)", () => {
	it("n = 0 ⇒ contestation 0 — a zero-reply post never earns Contested", () => {
		// A post with zero reply-bets (sc = cc = 0 → n = 0). The §6.1 guard sets
		// its contestation score to 0 (NOT 0^undefined). Even alongside an
		// even-and-big peer that DOES earn Contested, the zero-reply post is
		// unbadged.
		const zero = post({
			id: "post-zero",
			supportCount: 0,
			counterCount: 0,
			supportCountTotal: 0,
			counterCountTotal: 0,
			supportDharma: "0",
			counterDharma: "0",
			authorStake: "100",
		});
		const bigEven = post({
			id: "post-big-even",
			supportCount: 20,
			counterCount: 20,
			supportCountTotal: 20,
			counterCountTotal: 20,
			supportDharma: "300",
			counterDharma: "300",
			authorStake: "90",
		});
		expect(badgeFor(zero, [zero, bigEven], CFG)).toBeNull();
	});

	it("does not throw on the n = 0 post (avoids the 0^undefined trap)", () => {
		const zero = post({ id: "post-zero", supportCount: 0, counterCount: 0 });
		// Sole-post pool — exercises the guard with no competitors at all.
		expect(() => badgeFor(zero, [zero], CFG)).not.toThrow();
		expect(badgeFor(zero, [zero], CFG)).toBeNull();
	});
});

describe("ranking::contested-fully-one-sided (§6.1)", () => {
	it("a fully one-sided post (b = 0) ⇒ n^b = 1, never Contested-eligible", () => {
		// All reply-bets on one side (sc = 0, cc = 30 → n = 30, b = 0). n^b =
		// n^0 = 1, which is below floorLane.nPowB (3) — the post is correctly sunk
		// in the contestation lane and earns no Contested badge. (It does not
		// dominate traction/stake here either → null.)
		const lopsided = post({
			id: "post-lopsided",
			supportCount: 0,
			counterCount: 30,
			supportCountTotal: 0,
			counterCountTotal: 30,
			supportDharma: "0",
			counterDharma: "300",
			authorStake: "100",
		});
		const peer = post({
			id: "post-peer",
			supportCount: 0,
			counterCount: 28,
			supportCountTotal: 0,
			counterCountTotal: 28,
			supportDharma: "0",
			counterDharma: "290",
			authorStake: "90",
		});
		expect(badgeFor(lopsided, [lopsided, peer], CFG)).toBeNull();
	});

	it("a one-sided post does NOT win Contested over an even peer of equal n and D", () => {
		// The contrast that makes §6.1 load-bearing: at EQUAL n (8) and EQUAL D
		// (200) — so neither dominates traction or stake — the one-sided post
		// (b=0 → n^b=1) loses the contestation lane to the even post (b=1 →
		// n^b=8). The even post is the live cliffhanger; the blowout is not.
		const blowout = post({
			id: "post-blowout",
			supportCount: 0,
			counterCount: 8,
			supportCountTotal: 0,
			counterCountTotal: 8,
			supportDharma: "0",
			counterDharma: "200",
			authorStake: "100",
		});
		const even = post({
			id: "post-even",
			supportCount: 4,
			counterCount: 4,
			supportCountTotal: 4,
			counterCountTotal: 4,
			supportDharma: "100",
			counterDharma: "100",
			authorStake: "90",
		});
		// The blowout earns no badge (n^b = 1 below floor; traction/stake margins
		// both 1.0). The even post wins the contestation lane (its n^b = 8 is the
		// sole floor-clearer → SENTINEL_MAX).
		expect(badgeFor(blowout, [blowout, even], CFG)).toBeNull();
		expect(badgeFor(even, [blowout, even], CFG)).toBe("Contested");
	});
});

// FF-1 · G10 — the balance term reads DECLARED STANCE, not side (ADR-0058
// outcome 5; RANKING.md §2 as amended).
//
// This is the ADR's founding case, stated as a number. A post with ten
// endorsements and ten same-side critiques is the most contested thing the
// product can produce, and under the SIDE formula it is scored
// b = min(20, 0) / max(20, 0) = 0 — an uncontested blowout, n^b = 1, sunk below
// floorLane.nPowB and unable to wear Contested at all. That is not a tuning
// miss; it is the instrument reading the wrong axis, because every one of those
// twenty people had to buy YES to say anything, and `support_count` therefore
// measures which pool they entered rather than what they argued.
//
// ⚠ THE REVERT-TO-RED IS THE SIDE FORMULA ITSELF. Point `derive` back at
// `supportCount`/`counterCount` and the first assertion below goes red with
// b = 0 — which is exactly the state this file is in until FF-1 lands, so the
// red is not hypothetical and does not need manufacturing.
describe("ranking::contested-reads-declared-stance (ADR-0058)", () => {
	it("ten endorsements against ten same-side critiques IS Contested", () => {
		// Twenty distinct people replied on the post's own side; half of them
		// flagged. n = 20 (unchanged — traction counts people, not stances),
		// D = 400 (unchanged — attraction is not partitioned by the flag), and
		// b = min(10, 10) / max(10, 10) = 1 ⇒ n^b = 20.
		const flagged = post({
			id: "post-ff-contested",
			supportCount: 20,
			counterCount: 0,
			endorseCount: 10,
			contestCount: 10,
			supportCountTotal: 20,
			counterCountTotal: 0,
			supportDharma: "400",
			counterDharma: "0",
			authorStake: "100",
		});
		// The peer is the SAME post with nobody flagging: identical n, identical
		// D, identical totals — the ONLY difference is the stance split. So any
		// badge that moves between them moved on the balance axis and nowhere
		// else, which is what makes this a test of `b` rather than of the lanes.
		const unanimous = post({
			id: "post-ff-unanimous",
			supportCount: 20,
			counterCount: 0,
			endorseCount: 20,
			contestCount: 0,
			supportCountTotal: 20,
			counterCountTotal: 0,
			supportDharma: "400",
			counterDharma: "0",
			authorStake: "90",
		});
		const pool = [flagged, unanimous];

		// n^b = 20 clears floorLane.nPowB (3) and is the SOLE clearer → the
		// contestation lane returns SENTINEL_MAX and the badge fires.
		expect(badgeFor(flagged, pool, CFG)).toBe("Contested");
		// b = 0 ⇒ n^b = 20^0 = 1, below the floor. Traction and stake are dead
		// heats (ratio 1.0, under kLane 3), so the unanimous post wears nothing.
		expect(badgeFor(unanimous, pool, CFG)).toBeNull();
	});

	it("with no flag anywhere the two posts are indistinguishable — the purity half", () => {
		// ⚠ THE CONTROL FOR THE TEST ABOVE. If `derive` ignored the new pair
		// entirely, the first assertion there would be red — but if it read the
		// pair and the DEFAULT were wrong, this one would be. Two posts with
		// identical side counts and NO stance stated must still both be unbadged,
		// exactly as they were before ADR-0058.
		const a = post({
			id: "post-ff-plain-a",
			supportCount: 20,
			counterCount: 0,
			supportCountTotal: 20,
			counterCountTotal: 0,
			supportDharma: "400",
			counterDharma: "0",
			authorStake: "100",
		});
		const b = post({
			id: "post-ff-plain-b",
			supportCount: 20,
			counterCount: 0,
			supportCountTotal: 20,
			counterCountTotal: 0,
			supportDharma: "400",
			counterDharma: "0",
			authorStake: "90",
		});
		expect(badgeFor(a, [a, b], CFG)).toBeNull();
		expect(badgeFor(b, [a, b], CFG)).toBeNull();
	});
});
