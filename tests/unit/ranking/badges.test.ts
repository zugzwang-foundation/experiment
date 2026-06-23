import { describe, expect, it } from "vitest";
import type { PostSubstrate } from "@/lib/ranking";
import { badgeFor } from "@/lib/ranking";
import { DEFAULT_RANKING_CONFIG } from "@/lib/ranking.config";

// DEBATE.8 §5.6 tests-first (TDD RED) — the lane-dominance badge (RANKING.md §5,
// ADR-0017 P3). The value import `badgeFor` WILL fail to resolve until
// `@/lib/ranking` lands — that RED state is the goal (plan scope item 7). One
// subject per file (AGENTS.md §9): this file = `badgeFor` (the badge selector).
//
// Asserts: §5.1 (the badge rule: k_lane-gated AND floor-cleared, exactly one
// badge = the highest-margin dominating lane, else null), §5.2 (the three-lane
// vocabulary). RATIFIED OD-1(A): badges read the badge lanes {traction n,
// stake D, contestation n^b} (Top keeps {n, D, lop}; they diverge on the
// balance axis BY DESIGN). OD-4 placeholder constants: kLane = 3, floorLane
// { n: 5, D: 200, lop: 0.5, nPowB: 3 }.
//
// Decimal posture (CLAUDE.md §2): Dharma / stake inputs are decimal STRINGS.

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
		authorStake: "0",
		...over,
	};
}

// ── Highest-margin selection (§5.1.3) ────────────────────────────────────────
describe("ranking::lane-dominance-badge-highest-margin (§5.1.3)", () => {
	it("a post dominating two badge lanes wears the higher-margin one", () => {
		// P1-like: dominates traction (n) AND contestation (n^b). Big and even
		// (sc=19,cc=21 → n=40, b≈0.905). Traction margin ≈ 40/12 = 3.33×;
		// contestation margin ≈ 40^0.905 / 12^0.5 ≈ 8× — higher → "Contested".
		const p1 = post({
			id: "post-1",
			supportCount: 19,
			counterCount: 21,
			supportDharma: "600",
			counterDharma: "600",
			authorStake: "300",
		});
		const p2 = post({
			id: "post-2",
			supportCount: 4,
			counterCount: 8,
			supportDharma: "1420",
			counterDharma: "1420",
			authorStake: "240",
		});
		const p3 = post({
			id: "post-3",
			supportCount: 1,
			counterCount: 8,
			supportDharma: "150",
			counterDharma: "150",
			authorStake: "180",
		});
		const pool = [p1, p2, p3];
		expect(badgeFor(p1, pool, CFG)).toBe("Contested");
	});
});

// ── k_lane gate (§5.1.2) — leading ≠ dominating ──────────────────────────────
describe("ranking::lane-dominance-badge-k-lane-gated (§5.1.2)", () => {
	it("a post LEADING the stake lane at 2.37× (< kLane 3) earns NO badge", () => {
		// PL leads stake at 2840/1200 ≈ 2.37× — below kLane 3. PL and PR share
		// identical n and balance, so their traction and contestation margins are
		// both 1.0 (no other lane dominates). Leading ≠ dominating → null.
		const pl = post({
			id: "post-lead",
			supportCount: 6,
			counterCount: 6,
			supportDharma: "1420",
			counterDharma: "1420",
			authorStake: "200",
		});
		const pr = post({
			id: "post-runner",
			supportCount: 6,
			counterCount: 6,
			supportDharma: "600",
			counterDharma: "600",
			authorStake: "200",
		});
		expect(badgeFor(pl, [pl, pr], CFG)).toBeNull();
	});
});

// ── floor gate (§5.1.2) — below floorLane = not eligible ─────────────────────
describe("ranking::lane-dominance-badge-floor-gated (§5.1.2)", () => {
	it("a post with n^b just below floorLane.nPowB=3 is not Contested-eligible", () => {
		// A small even post: sc=cc=1 → n=2, b=1, n^b = 2^1 = 2 < 3. Even though
		// it might "lead" the contestation lane relative to one-sided peers, n^b
		// is below the contestation floor → never earns Contested. The post also
		// clears no other lane (n=2 < floor 5, D below floor) → null.
		const small = post({
			id: "post-small-even",
			supportCount: 1,
			counterCount: 1,
			supportDharma: "10",
			counterDharma: "10",
			authorStake: "50",
		});
		const lopsided = post({
			id: "post-lopsided",
			supportCount: 0,
			counterCount: 2,
			supportDharma: "0",
			counterDharma: "20",
			authorStake: "40",
		});
		expect(badgeFor(small, [small, lopsided], CFG)).toBeNull();
	});
});

// ── The three-lane vocabulary (§5.2) ─────────────────────────────────────────
describe("ranking::lane-dominance-badge-vocabulary (§5.2)", () => {
	it("a pure-traction dominator earns 'Most Debated'", () => {
		// MD dominates ONLY traction. Lopsided (sc=30,cc=1 → n=31, b≈0.033) so its
		// n^b ≈ 1.12 is BELOW the contestation floor (3) — no Contested. D modest
		// (not dominating). Traction margin 31/8 ≈ 3.88× ≥ 3 → "Most Debated".
		const md = post({
			id: "post-md",
			supportCount: 30,
			counterCount: 1,
			supportDharma: "150",
			counterDharma: "150",
			authorStake: "100",
		});
		const x1 = post({
			id: "post-x1",
			supportCount: 4,
			counterCount: 4,
			supportDharma: "150",
			counterDharma: "150",
			authorStake: "80",
		});
		const x2 = post({
			id: "post-x2",
			supportCount: 3,
			counterCount: 3,
			supportDharma: "145",
			counterDharma: "145",
			authorStake: "70",
		});
		expect(badgeFor(md, [md, x1, x2], CFG)).toBe("Most Debated");
	});

	it("a pure-stake dominator (≥3×) earns 'Highest Stakes'", () => {
		// HS dominates ONLY stake (D = 3000 vs 300 → 10×). All three posts share
		// n=8 and balance, so traction and contestation margins are 1.0. Stake
		// margin 10× ≥ 3 → "Highest Stakes".
		const hs = post({
			id: "post-hs",
			supportCount: 4,
			counterCount: 4,
			supportDharma: "1500",
			counterDharma: "1500",
			authorStake: "100",
		});
		const y1 = post({
			id: "post-y1",
			supportCount: 4,
			counterCount: 4,
			supportDharma: "150",
			counterDharma: "150",
			authorStake: "80",
		});
		const y2 = post({
			id: "post-y2",
			supportCount: 4,
			counterCount: 4,
			supportDharma: "145",
			counterDharma: "145",
			authorStake: "70",
		});
		expect(badgeFor(hs, [hs, y1, y2], CFG)).toBe("Highest Stakes");
	});

	it("an even-and-big dominator earns 'Contested'", () => {
		// CN dominates contestation: big and even (sc=20,cc=20 → n=40, b=1, n^b=40)
		// vs lopsided peers whose n^b collapses toward 1. Traction not dominating
		// (peers also clear the n floor with comparable n), stake modest.
		const cn = post({
			id: "post-cn",
			supportCount: 20,
			counterCount: 20,
			supportDharma: "300",
			counterDharma: "300",
			authorStake: "100",
		});
		const z1 = post({
			id: "post-z1",
			supportCount: 1,
			counterCount: 35,
			supportDharma: "300",
			counterDharma: "300",
			authorStake: "90",
		});
		const z2 = post({
			id: "post-z2",
			supportCount: 1,
			counterCount: 33,
			supportDharma: "290",
			counterDharma: "290",
			authorStake: "80",
		});
		expect(badgeFor(cn, [cn, z1, z2], CFG)).toBe("Contested");
	});

	it("the majority of posts (dominating no lane) carry no badge", () => {
		// A flat field — every post identical lane values → every lane margin is
		// 1.0 < kLane → none is badged.
		const flat = Array.from({ length: 4 }, (_, i) =>
			post({
				id: `post-flat-${i}`,
				supportCount: 6,
				counterCount: 6,
				supportDharma: "300",
				counterDharma: "300",
				authorStake: "100",
			}),
		);
		for (const p of flat) {
			expect(badgeFor(p, flat, CFG)).toBeNull();
		}
	});
});
