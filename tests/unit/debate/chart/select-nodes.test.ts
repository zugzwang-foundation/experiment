import { describe, expect, it } from "vitest";

// UI.19 Slice 2 tests-first (plan §Slice 2 unit tests / §3c / SPEC.1 1.0.22 §9
// "Post nodes") — the RED driver for the PURE node selector
// `selectChartNodes(substrate, removedSet, walk): ChartNode[]` that the impl adds
// to `src/server/debate-view/price-chart.ts`.
//
// RED target: `@/server/debate-view/price-chart` exists (slice 1) but exports
// neither `selectChartNodes` nor the `ChartNode` type yet, so the VALUE import of
// `selectChartNodes` reds this file (missing export → not a function). This is the
// RIGHT RED reason (CLAUDE.md §5.6): a missing export, not a typo.
//
// The algorithm this file PINS (plan §3c, "no second ranking rule"):
//   ordered = topOrder(substrate)                 // pure §9 Top, NO interleave
//   for post of ordered (IN TOP ORDER):
//     if removedSet.has(post.id): skip            // masking — removed excluded
//     bucket = (utcDay(createdAt), parentSide)    // utcDay = ISO slice(0,10)
//     FIRST eligible post per bucket WINS; later members drop  // partition, not a re-rank
//   node = { id, side: parentSide (INV-3), at: createdAt.toISOString(),
//            yYes: getPrices(reservesAt(walk, createdAt)).yes }
//   reservesAt(walk, at) = reserves of the LAST step with step.at <= at    // never interpolate
//   node array sorted by (at asc, id asc)
//
// Every post here has n=0/D=0 (zero replies) so `topOrder` falls to the §3.4
// tiebreak (higher authorStake first, then earlier createdAt, then smaller id) —
// making the intended bucket-winner controllable by authorStake alone. Prices are
// decimal STRINGS; expected node y is computed via the same pure `getPrices`
// (CLAUDE.md §2 — never JS floats).

import { type PostSubstrate, type Side, topOrder } from "@/lib/ranking";
import { getPrices, type Reserves } from "@/server/cpmm/calculate";
// The RED imports: `selectChartNodes` (value) + `ChartNode` (type) do not yet
// exist on the slice-1 price-chart module.
import {
	type ChartNode,
	selectChartNodes,
} from "@/server/debate-view/price-chart";
import type { ReservePoint } from "@/server/discovery/price-series";

const DEC = (whole: string): string => `${whole}.000000000000000000`;

/** A zero-reply post (n=0/D=0 ⇒ `topOrder` is pure §3.4 tiebreak). `stake` is the
 * authorStake — the primary tiebreak, so it selects the bucket winner. */
function post(args: {
	id: string;
	side: Side;
	at: string;
	stake?: string;
}): PostSubstrate {
	return {
		id: args.id,
		parentSide: args.side,
		supportCount: 0,
		counterCount: 0,
		supportDharma: "0",
		counterDharma: "0",
		createdAt: new Date(args.at),
		authorStake: args.stake ?? DEC("10"),
		priceAtBet: DEC("0"),
	};
}

function step(at: string, yes: string, no: string): ReservePoint {
	return { at: new Date(at), reserves: { yes, no } as Reserves };
}

const byId = (nodes: ChartNode[], id: string): ChartNode | undefined =>
	nodes.find((n) => n.id === id);
const ids = (nodes: ChartNode[]): Set<string> =>
	new Set(nodes.map((n) => n.id));
const bucketKey = (n: ChartNode): string => `${n.at.slice(0, 10)}|${n.side}`;

// A walk whose steps give clean YES prices: {40,160}→0.8, {160,40}→0.2,
// {100,100}→0.5. reservesAt picks the last step ≤ at (never interpolates).
const WALK: ReservePoint[] = [
	step("2026-09-10T00:00:00.000Z", DEC("100"), DEC("100")), // yes 0.5
	step("2026-09-10T00:05:00.000Z", DEC("40"), DEC("160")), // yes 0.8
	step("2026-09-10T00:10:00.000Z", DEC("160"), DEC("40")), // yes 0.2
	step("2026-09-11T00:00:00.000Z", DEC("80"), DEC("120")), // yes 0.6
];

describe("UI.19 §9 — selectChartNodes (pure per-(UTC day, side) Top partition)", () => {
	// ── Bucketing: 2 UTC days × 2 sides → 4 nodes, one per bucket ────────────────
	it("buckets by (UTC day, side) — 2 days × 2 sides yields 4 nodes", () => {
		const substrate: PostSubstrate[] = [
			post({ id: "a", side: "YES", at: "2026-09-10T00:05:00.000Z" }),
			post({ id: "b", side: "NO", at: "2026-09-10T00:06:00.000Z" }),
			post({ id: "c", side: "YES", at: "2026-09-11T00:05:00.000Z" }),
			post({ id: "d", side: "NO", at: "2026-09-11T00:06:00.000Z" }),
		];

		const nodes = selectChartNodes(substrate, new Set(), WALK);

		expect(nodes).toHaveLength(4);
		expect(ids(nodes)).toEqual(new Set(["a", "b", "c", "d"]));
		// Four DISTINCT (utcDay, side) buckets.
		expect(new Set(nodes.map(bucketKey)).size).toBe(4);
		// Side is the post's frozen parentSide.
		expect(byId(nodes, "a")?.side).toBe("YES");
		expect(byId(nodes, "b")?.side).toBe("NO");
		// Sorted by (at asc, id asc).
		expect(nodes.map((n) => n.id)).toEqual(["a", "b", "c", "d"]);
	});

	// ── Removed winner → the next eligible bucket member takes the slot ──────────
	it("skips a removed bucket-winner and promotes the next eligible post", () => {
		const substrate: PostSubstrate[] = [
			// Same bucket (YES, 09-10). `win` outranks `next` on stake.
			post({
				id: "win",
				side: "YES",
				at: "2026-09-10T00:05:00.000Z",
				stake: DEC("50"),
			}),
			post({
				id: "next",
				side: "YES",
				at: "2026-09-10T00:07:00.000Z",
				stake: DEC("10"),
			}),
		];

		// Positive control — with nothing removed, `win` is the node.
		const unmasked = selectChartNodes(substrate, new Set(), WALK);
		expect(unmasked).toHaveLength(1);
		expect(unmasked[0]?.id).toBe("win");

		// Remove the winner → `next` (the next Top-order member of the bucket) wins.
		const masked = selectChartNodes(substrate, new Set(["win"]), WALK);
		expect(masked).toHaveLength(1);
		expect(masked[0]?.id).toBe("next");
	});

	// ── A bucket whose ONLY post is removed → no node (never a placeholder) ──────
	it("emits no node for a bucket whose only post is removed", () => {
		const substrate: PostSubstrate[] = [
			post({ id: "only", side: "YES", at: "2026-09-10T00:05:00.000Z" }),
		];

		// Positive control — present → exactly one node.
		expect(selectChartNodes(substrate, new Set(), WALK)).toHaveLength(1);

		// Removed → the slot stays EMPTY (no placeholder node).
		const nodes = selectChartNodes(substrate, new Set(["only"]), WALK);
		expect(nodes).toHaveLength(0);
	});

	// ── within-bucket-order-is-toporder — the winner == topOrder's first bucket
	//    member (the selector NEVER re-sorts; "no second ranking rule" made
	//    mechanical, web Gate-C addition to §3c) ──────────────────────────────────
	it("within-bucket-order-is-toporder", () => {
		// One bucket (YES, 09-10) with 3 posts. The highest-stake post (`hi`) is the
		// LATEST by createdAt and a MID id — so a naive "earliest createdAt" or
		// "smallest id" selector would pick a DIFFERENT post. Only a selector that
		// takes-first over `topOrder`'s output picks `hi`.
		const substrate: PostSubstrate[] = [
			post({
				id: "m1",
				side: "YES",
				at: "2026-09-10T00:05:00.000Z",
				stake: DEC("20"),
			}),
			post({
				id: "m2",
				side: "YES",
				at: "2026-09-10T00:08:00.000Z",
				stake: DEC("10"),
			}),
			post({
				id: "hi",
				side: "YES",
				at: "2026-09-10T00:20:00.000Z", // latest
				stake: DEC("50"), // highest stake ⇒ topOrder-first
			}),
		];

		const nodes = selectChartNodes(substrate, new Set(), WALK);
		expect(nodes).toHaveLength(1);

		// MECHANICAL: the bucket winner is exactly the FIRST member of that bucket in
		// `topOrder`'s output — the selector partitions, it does not re-rank.
		const ordered = topOrder(substrate);
		const bucketFirst = ordered.find(
			(p) =>
				p.parentSide === "YES" &&
				p.createdAt.toISOString().slice(0, 10) === "2026-09-10",
		);
		expect(nodes[0]?.id).toBe(bucketFirst?.id);
		expect(nodes[0]?.id).toBe("hi");
		// Not the earliest-createdAt / smallest-id post — proving no second rule.
		expect(nodes[0]?.id).not.toBe("m1");
	});

	// ── Node y = getPrices(reservesAt).yes for the LAST walk step ≤ createdAt ────
	//    (exercises BOTH "exactly on a step" and "strictly between steps"; never
	//    interpolates) ─────────────────────────────────────────────────────────────
	it("prices each node from the last walk step at or before its createdAt", () => {
		const substrate: PostSubstrate[] = [
			// EXACTLY on step index 2 (00:10) → reservesAt = {160,40} → yes 0.2.
			post({ id: "exact", side: "YES", at: "2026-09-10T00:10:00.000Z" }),
			// STRICTLY between step 1 (00:05) and step 2 (00:10) → reservesAt = the
			// EARLIER step {40,160} → yes 0.8 (NOT interpolated toward 0.2).
			post({ id: "between", side: "NO", at: "2026-09-10T00:07:00.000Z" }),
		];

		const nodes = selectChartNodes(substrate, new Set(), WALK);

		const exactRes: Reserves = { yes: DEC("160"), no: DEC("40") };
		const betweenRes: Reserves = { yes: DEC("40"), no: DEC("160") };

		// Exact-on-step: the step's own reserves.
		expect(byId(nodes, "exact")?.yYes).toBe(getPrices(exactRes).yes);
		// Between-steps: the LAST step at/before — never the later step, never a
		// midpoint interpolation.
		expect(byId(nodes, "between")?.yYes).toBe(getPrices(betweenRes).yes);
		expect(byId(nodes, "between")?.yYes).not.toBe(getPrices(exactRes).yes);

		// node.at is the post's own createdAt ISO.
		expect(byId(nodes, "exact")?.at).toBe("2026-09-10T00:10:00.000Z");
	});
});
