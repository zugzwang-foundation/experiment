import { describe, expect, it } from "vitest";
import type { PostSubstrate } from "@/lib/ranking";
import { buildTopList, profileOrder, topOrder } from "@/lib/ranking";
import { DEFAULT_RANKING_CONFIG } from "@/lib/ranking.config";

// DEBATE.8 §5.6 tests-first (TDD RED) — the latest interleave (RANKING.md §4,
// ADR-0017 P2). The value imports `buildTopList` / `topOrder` / `profileOrder`
// WILL fail to resolve until `@/lib/ranking` lands — that RED state is the goal
// (plan scope item 7). One subject per file (AGENTS.md §9): this file = the
// interleave (`buildTopList` = ranked spine + every-N injection).
//
// Asserts: §4.2 (the rule — after every LATEST_INTERLEAVE_INTERVAL ranked
// posts, inject the newest-by-createdAt not-yet-shown post), §4.3 (one-at-a-time,
// no duplication, Top-only). latestInterleaveInterval = 10 (OD-4 placeholder).

const CFG = DEFAULT_RANKING_CONFIG;

// 12 ranked posts. Lane values chosen so the §3 ranked spine is a strict
// descending chain R01 (best) … R12 (worst) by `D` (stake lane), and createdAt
// is assigned so the NEWEST-by-createdAt post is the LOWEST-ranked one (R12) —
// the realistic case where a brand-new post has accrued the least stake. This
// makes the injection target deterministic: after the first 10 ranked
// (R01..R10), the newest unshown among {R11, R12} is R12.
function makePost(rank: number): PostSubstrate {
	// D descends with rank so R01 has the most Dharma (tops the stake lane).
	// Keep all posts above the D-floor (200) and even (so no lane SENTINELs
	// distort the strict spine). Dharma is a decimal string (CLAUDE.md §2).
	const dharma = String(10_000 - rank * 100); // R01=9900 … R12=8800, all ≥ 200
	const half = String((10_000 - rank * 100) / 2);
	return {
		id: `post-${String(rank).padStart(2, "0")}`,
		parentSide: "YES",
		supportCount: 15,
		counterCount: 15,
		supportDharma: half,
		counterDharma: half,
		// createdAt monotonically NEWER as rank grows → R12 is the newest.
		createdAt: new Date(2026, 8, 1, rank, 0, 0),
		authorStake: String(1000 - rank),
		priceAtBet: "0.5",
		// keep D meaningful
		...(dharma ? {} : {}),
	};
}

const TWELVE = Array.from({ length: 12 }, (_, i) => makePost(i + 1));
// Shuffled input — buildTopList must derive its own ranked spine.
const SHUFFLED = [...TWELVE].reverse();

describe("ranking::latest-interleave-every-N (§4.2/§4.3)", () => {
	it("injects the newest-unshown post at position 11 (after 10 ranked)", () => {
		const list = buildTopList(SHUFFLED, CFG);
		const ids = list.map((p) => p.id);
		// Positions 1..10 (indices 0..9) are the top-10 ranked: R01..R10.
		expect(ids.slice(0, 10)).toEqual([
			"post-01",
			"post-02",
			"post-03",
			"post-04",
			"post-05",
			"post-06",
			"post-07",
			"post-08",
			"post-09",
			"post-10",
		]);
		// Position 11 (index 10) is the injected latest = the newest-by-createdAt
		// not-yet-shown post = R12 (post-12).
		expect(ids[10]).toBe("post-12");
		// Ranking resumes: position 12 is the remaining ranked post R11.
		expect(ids[11]).toBe("post-11");
	});

	it("emits exactly one latest post per cadence point (§4.3 one-at-a-time)", () => {
		const list = buildTopList(SHUFFLED, CFG);
		// 12 posts, interval 10 → exactly one injection point (after the first
		// 10), so the output is exactly 12 long (no batch injection).
		expect(list).toHaveLength(12);
	});
});

describe("ranking::latest-interleave-no-duplication (§4.3)", () => {
	it("every post appears exactly once", () => {
		const list = buildTopList(SHUFFLED, CFG);
		const ids = list.map((p) => p.id);
		expect(ids).toHaveLength(12);
		expect(new Set(ids).size).toBe(12);
	});

	it("a post that naturally ranks in the first N is not re-injected as latest", () => {
		// R01 (top-ranked) appears once at position 1 and is never injected
		// again — even though injection picks "newest unshown", R01 is already
		// shown by the time the cadence point is reached.
		const ids = buildTopList(SHUFFLED, CFG).map((p) => p.id);
		expect(ids.filter((id) => id === "post-01")).toHaveLength(1);
	});
});

describe("ranking::interleave-edge-below-interval (§4.2)", () => {
	it("≤ interval posts ⇒ buildTopList == topOrder (no injection)", () => {
		const five = TWELVE.slice(0, 5);
		expect(buildTopList(five, CFG).map((p) => p.id)).toEqual(
			topOrder(five, CFG).map((p) => p.id),
		);
	});

	it("exactly interval posts ⇒ still no injection (nothing unshown remains)", () => {
		const ten = TWELVE.slice(0, 10);
		expect(buildTopList(ten, CFG).map((p) => p.id)).toEqual(
			topOrder(ten, CFG).map((p) => p.id),
		);
	});
});

describe("ranking::interleave-top-only (§4.3.1 — not profile)", () => {
	it("profileOrder does NOT interleave (no injected-latest reordering)", () => {
		// §3.6 + §4.3: the interleave applies to Top ONLY. The profile is a body
		// of work — its post order is pure D-desc with NO injection. Build a pool
		// where the interleave WOULD reorder Top (12 posts) and assert the
		// profile keeps the pure ranked order (no R12 jump to position 11).
		const profile = profileOrder(SHUFFLED, []);
		const postIds = profile
			.filter((item) => item.kind === "post")
			.map((item) => (item.kind === "post" ? item.post.id : ""));
		// Profile posts are ordered by D desc = R01..R12, with NO injection: R12
		// stays last, never jumps to position 11.
		expect(postIds).toEqual([
			"post-01",
			"post-02",
			"post-03",
			"post-04",
			"post-05",
			"post-06",
			"post-07",
			"post-08",
			"post-09",
			"post-10",
			"post-11",
			"post-12",
		]);
	});
});
