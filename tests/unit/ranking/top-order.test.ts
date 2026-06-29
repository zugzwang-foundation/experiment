import { describe, expect, it } from "vitest";
import type { PostSubstrate } from "@/lib/ranking";
import { badgeFor, topOrder } from "@/lib/ranking";
import { DEFAULT_RANKING_CONFIG } from "@/lib/ranking.config";

// DEBATE.8 §5.6 tests-first (TDD RED) — the pure read-time ranking spine
// `src/lib/ranking.ts` (greenfield). The value imports `topOrder` / `badgeFor`
// and the `DEFAULT_RANKING_CONFIG` value WILL fail to resolve until DEBATE.8
// implements `@/lib/ranking` + `@/lib/ranking.config` — that unresolved-import
// RED state is the goal (plan scope item 7, execution-sequencing step 2). The
// `import type { PostSubstrate }` is stripped by esbuild, so it does not soften
// the RED — the value imports are what fire it.
//
// One subject per file (AGENTS.md §9): this file = the Top RANKED SPINE
// (`topOrder`, NO interleave) + the worked-example badge. Interleave is
// interleave.test.ts; the badge vocabulary is badges.test.ts.
//
// Asserts: RANKING.md §3 (Top), §3.3 (qualified_margin: BELOW_FLOOR /
// SENTINEL_MAX / real ratio), §3.4 (ties: author stake `a` then earlier-wins),
// §13 (the canonical worked example). Ratified resolutions OD-1(A) + OD-4
// placeholder constants per the kickoff — NOT re-derived here.
//
// Decimal posture (CLAUDE.md §2): all Dharma / stake inputs are decimal STRINGS,
// never JS-float literals. Counts are integers.

// The OD-4 placeholder config — the §13 worked-example illustrative constants:
// kLane = 3 (uniform), floorLane { n: 5, D: 200, lop: 0.5, nPowB: 3 },
// floorSplit = 6, latestInterleaveInterval = 10. Passed explicitly so the test
// pins constants rather than depending on the default (which is asserted to
// equal these in the config assertions below).
const CFG = DEFAULT_RANKING_CONFIG;

// UUIDv7 ordering: earlier id sorts lexicographically smaller AND is the later
// tiebreak after createdAt (§3.4). We use explicit monotone string ids so the
// tiebreak is deterministic without generating real UUIDs.
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
		priceAtBet: "0.5",
		...over,
	};
}

// ── §13 worked example ───────────────────────────────────────────────────────
// Posts P1..P4 with the §13 substrate. Integer (support, counter) splits chosen
// so n is EXACT per the table and lop is the CLOSEST integer split (per the
// kickoff: assert the ORDER + the badge, not the exact lop decimals — the order
// is robust to small lop rounding):
//   P1: n=40, sc=19,cc=21 → b=19/21≈0.905, lop≈0.095 (table 0.10) ; D=1200 ; a=300 ; oldest
//   P2: n=12, sc=4, cc=8  → b=0.5,        lop=0.5   (table 0.55) ; D=2840 ; a=240 ; mid
//   P3: n=9,  sc=1, cc=8  → b=0.125,      lop=0.875 (table 0.80) ; D=300  ; a=180 ; newer
//   P4: n=2,  sc=1, cc=1  → b=1.0,        lop=0.0   (table —)    ; D=50   ; a=90  ; newest
// Dharma split arbitrary but SUMS to the table D. createdAt P1 oldest…P4 newest.
const P1 = post({
	id: "post-1",
	parentSide: "YES",
	supportCount: 19,
	counterCount: 21,
	supportDharma: "600",
	counterDharma: "600",
	createdAt: new Date("2026-09-01T00:00:00.000Z"),
	authorStake: "300",
});
const P2 = post({
	id: "post-2",
	parentSide: "NO",
	supportCount: 4,
	counterCount: 8,
	supportDharma: "1000",
	counterDharma: "1840",
	createdAt: new Date("2026-09-01T01:00:00.000Z"),
	authorStake: "240",
});
const P3 = post({
	id: "post-3",
	parentSide: "YES",
	supportCount: 1,
	counterCount: 8,
	supportDharma: "100",
	counterDharma: "200",
	createdAt: new Date("2026-09-01T02:00:00.000Z"),
	authorStake: "180",
});
const P4 = post({
	id: "post-4",
	parentSide: "NO",
	supportCount: 1,
	counterCount: 1,
	supportDharma: "20",
	counterDharma: "30",
	createdAt: new Date("2026-09-01T03:00:00.000Z"),
	authorStake: "90",
});
// Shuffled input so the test proves ordering, not insertion order.
const WORKED = [P4, P2, P1, P3];

describe("ranking::top-worked-example (§13)", () => {
	it("orders the §13 pool P1, P2, P3, P4", () => {
		const ordered = topOrder(WORKED, CFG);
		expect(ordered.map((p) => p.id)).toEqual([
			"post-1",
			"post-2",
			"post-3",
			"post-4",
		]);
	});

	it("badges only P1 — Contested (its n^b margin beats its traction margin)", () => {
		// OD-1(A): badges read {n, D, n^b}. P1 dominates traction (40/12 ≈ 3.33×)
		// AND contestation (40^0.905 / 12^0.5 ≈ 8×). Highest-margin lane wins →
		// "Contested" (NOT §13's pre-OD-1 "Most Debated" narrative). The other
		// three posts dominate no badge lane.
		expect(badgeFor(P1, WORKED, CFG)).toBe("Contested");
		expect(badgeFor(P2, WORKED, CFG)).toBeNull();
		expect(badgeFor(P3, WORKED, CFG)).toBeNull();
		expect(badgeFor(P4, WORKED, CFG)).toBeNull();
	});
});

// ── SENTINEL_MAX — sole floor-clearer tops, sole badge (§3.3) ────────────────
describe("ranking::top-sentinel-no-competitor (§3.3)", () => {
	// S clears every lane floor; the others are BELOW_FLOOR on every lane. With
	// no qualifying second place, S's qualified_margin is SENTINEL_MAX (ranks
	// above every finite ratio), so S tops and is the only badged post.
	const S = post({
		id: "post-s",
		supportCount: 20,
		counterCount: 20,
		supportDharma: "2500",
		counterDharma: "2500",
		createdAt: new Date("2026-09-01T00:00:00.000Z"),
		authorStake: "500",
	});
	const T1 = post({
		id: "post-t1",
		supportCount: 1,
		counterCount: 1,
		supportDharma: "25",
		counterDharma: "25",
		createdAt: new Date("2026-09-01T01:00:00.000Z"),
		authorStake: "40",
	});
	const T2 = post({
		id: "post-t2",
		supportCount: 0,
		counterCount: 2,
		supportDharma: "0",
		counterDharma: "30",
		createdAt: new Date("2026-09-01T02:00:00.000Z"),
		authorStake: "20",
	});
	const POOL = [T1, S, T2];

	it("the sole floor-clearer ranks first", () => {
		expect(topOrder(POOL, CFG)[0]?.id).toBe("post-s");
	});

	it("the sole floor-clearer is the only badged post", () => {
		expect(badgeFor(S, POOL, CFG)).not.toBeNull();
		expect(badgeFor(T1, POOL, CFG)).toBeNull();
		expect(badgeFor(T2, POOL, CFG)).toBeNull();
	});
});

// ── All-sub-floor cold-start — order is purely §3.4 (§3.3 last bullet, §8) ────
describe("ranking::top-cold-start-author-stake (§3.4 / §8)", () => {
	// Every post is BELOW_FLOOR on every lane (n=2 < 5). Order degrades to the
	// §3.4 tie chain: author stake `a` desc, then earlier-wins (earlier
	// createdAt, then lexicographically smaller id).
	const C1 = post({
		id: "post-c1",
		supportCount: 1,
		counterCount: 1,
		supportDharma: "25",
		counterDharma: "25",
		createdAt: new Date("2026-09-01T00:00:00.000Z"),
		authorStake: "300",
	});
	const C2 = post({
		id: "post-c2",
		supportCount: 1,
		counterCount: 1,
		supportDharma: "25",
		counterDharma: "25",
		createdAt: new Date("2026-09-02T00:00:00.000Z"),
		authorStake: "200",
	});
	const C3 = post({
		id: "post-c3",
		supportCount: 1,
		counterCount: 1,
		supportDharma: "25",
		counterDharma: "25",
		createdAt: new Date("2026-09-01T00:00:00.000Z"),
		authorStake: "200",
	});
	const POOL = [C2, C3, C1];

	it("orders by author stake desc, then earlier createdAt", () => {
		// C1 (a=300) first; among the a=200 tie, C3 (createdAt 09-01) beats C2
		// (createdAt 09-02).
		expect(topOrder(POOL, CFG).map((p) => p.id)).toEqual([
			"post-c1",
			"post-c3",
			"post-c2",
		]);
	});

	it("badges nobody in an all-sub-floor pool", () => {
		expect(badgeFor(C1, POOL, CFG)).toBeNull();
		expect(badgeFor(C2, POOL, CFG)).toBeNull();
		expect(badgeFor(C3, POOL, CFG)).toBeNull();
	});
});

// ── Ties (§3.4) — equal topScore → higher a, then earlier createdAt, then id ──
describe("ranking::top-ties (§3.4)", () => {
	it("equal topScore → higher author stake ranks first", () => {
		// Two identical-substrate posts (identical lane values → identical
		// topScore); only `a` differs.
		const hi = post({
			id: "post-tie-a",
			supportCount: 10,
			counterCount: 10,
			supportDharma: "500",
			counterDharma: "500",
			createdAt: new Date("2026-09-01T00:00:00.000Z"),
			authorStake: "300",
		});
		const lo = post({
			id: "post-tie-b",
			supportCount: 10,
			counterCount: 10,
			supportDharma: "500",
			counterDharma: "500",
			createdAt: new Date("2026-09-01T00:00:00.000Z"),
			authorStake: "100",
		});
		expect(topOrder([lo, hi], CFG).map((p) => p.id)).toEqual([
			"post-tie-a",
			"post-tie-b",
		]);
	});

	it("equal topScore AND equal a → earlier createdAt, then smaller id", () => {
		// Three posts: identical lane values + identical `a`. Tiebreak collapses
		// to earlier createdAt (early/early/late), then lexicographic id between
		// the two equal-createdAt posts.
		const early1 = post({
			id: "post-aaa",
			supportCount: 10,
			counterCount: 10,
			supportDharma: "500",
			counterDharma: "500",
			createdAt: new Date("2026-09-01T00:00:00.000Z"),
			authorStake: "200",
		});
		const early2 = post({
			id: "post-bbb",
			supportCount: 10,
			counterCount: 10,
			supportDharma: "500",
			counterDharma: "500",
			createdAt: new Date("2026-09-01T00:00:00.000Z"),
			authorStake: "200",
		});
		const late = post({
			id: "post-ccc",
			supportCount: 10,
			counterCount: 10,
			supportDharma: "500",
			counterDharma: "500",
			createdAt: new Date("2026-09-05T00:00:00.000Z"),
			authorStake: "200",
		});
		expect(topOrder([late, early2, early1], CFG).map((p) => p.id)).toEqual([
			"post-aaa", // earlier createdAt, smaller id
			"post-bbb", // earlier createdAt, larger id
			"post-ccc", // later createdAt
		]);
	});
});

// ── Config sanity — the OD-4 placeholder values are what the suite pins to ────
describe("ranking::default-config (OD-4 placeholders)", () => {
	it("DEFAULT_RANKING_CONFIG carries the OD-4 placeholder constants", () => {
		expect(DEFAULT_RANKING_CONFIG).toEqual({
			kLane: 3,
			floorLane: { n: 5, D: 200, lop: 0.5, nPowB: 3 },
			floorSplit: 6,
			latestInterleaveInterval: 10,
		});
	});

	it("topOrder defaults to DEFAULT_RANKING_CONFIG when cfg is omitted", () => {
		expect(topOrder(WORKED).map((p) => p.id)).toEqual(
			topOrder(WORKED, CFG).map((p) => p.id),
		);
	});
});
