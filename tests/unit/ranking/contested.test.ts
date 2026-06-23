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
	return {
		parentSide: "YES",
		supportCount: 0,
		counterCount: 0,
		supportDharma: "0",
		counterDharma: "0",
		createdAt: new Date("2026-09-01T00:00:00.000Z"),
		authorStake: "100",
		...over,
	};
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
			supportDharma: "0",
			counterDharma: "0",
			authorStake: "100",
		});
		const bigEven = post({
			id: "post-big-even",
			supportCount: 20,
			counterCount: 20,
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
			supportDharma: "0",
			counterDharma: "300",
			authorStake: "100",
		});
		const peer = post({
			id: "post-peer",
			supportCount: 0,
			counterCount: 28,
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
			supportDharma: "0",
			counterDharma: "200",
			authorStake: "100",
		});
		const even = post({
			id: "post-even",
			supportCount: 4,
			counterCount: 4,
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
