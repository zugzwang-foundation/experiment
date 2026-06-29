import { describe, expect, it } from "vitest";
import type { ReplySubstrate } from "@/lib/ranking";
import { rankReplies } from "@/lib/ranking";
import { DEFAULT_RANKING_CONFIG } from "@/lib/ranking.config";

// DEBATE.4 §8 tests-first (TDD RED — pure model, no DB, no DOM). This file
// proves the LOCKED column/relation axis from DESIGN-spec-changes-consolidated
// §1 (folded as plan deviation D3): columns are FIXED poles LEFT=YES / RIGHT=NO;
// Support/Counter is POST-RELATIVE, never a column label. A reply routes to a
// column BY ITS OWN FROZEN SIDE; "Support" means the reply's side EQUALS the
// post's side, "Counter" means it differs.
//
// The consumer (per plan §5a) does
//   `rankReplies(map.get(postId) ?? [], post.parentSide)` → { support, counter }
// and then places each ranked reply into a column by the reply's OWN `side`:
//   - a YES reply ALWAYS renders in the LEFT (YES) column;
//   - a NO  reply ALWAYS renders in the RIGHT (NO) column;
// regardless of whether it is Support or Counter for that post. The Support /
// Counter partition is the RELATION; the side is the COLUMN. This test pins both
// the partition (relation = side == post.side) AND the own-side placement rule
// that derives from it.
//
// `rankReplies` is the only pure surface that exposes the relation partition;
// the column-placement rule is then a pure derivation over the partitioned
// output, asserted here without any RTL/DOM dependency (plan §8 ruling: NO new
// DOM/RTL dep — server-boundary + pure-model tests are sufficient).
//
// RED state: this asserts the LOCKED column-routing semantics through the pure
// model. The value import resolves today (ranking.ts is built), but the
// DEBATE.4 column-routing CONTRACT is being pinned here for the first time — the
// route-to-column-by-own-side derivation is the assertion under test.
//
// Decimal posture (CLAUDE.md §2): reply stake is a decimal STRING.

const CFG = DEFAULT_RANKING_CONFIG;

function reply(
	over: Partial<ReplySubstrate> & Pick<ReplySubstrate, "id" | "side">,
): ReplySubstrate {
	return {
		stake: "50",
		createdAt: new Date("2026-09-01T00:00:00.000Z"),
		priceAtBet: "0.5",
		...over,
	};
}

/**
 * The pure column-placement derivation the DEBATE.4 client boundary applies:
 * a reply renders in the column named by its OWN frozen side (YES → LEFT,
 * NO → RIGHT), independent of the Support/Counter relation. Returns the two
 * columns by side.
 */
function routeToColumns(replies: ReplySubstrate[]): {
	yesColumn: ReplySubstrate[];
	noColumn: ReplySubstrate[];
} {
	return {
		yesColumn: replies.filter((r) => r.side === "YES"),
		noColumn: replies.filter((r) => r.side === "NO"),
	};
}

describe("debate-view::column-routing (D3 / DESIGN-spec-changes §1)", () => {
	it("post on YES — support replies are YES (LEFT), counter replies are NO (RIGHT)", () => {
		// Post side = YES. Two same-side (YES) replies and two opposite-side (NO)
		// replies. Support == side == post.side == YES; Counter == NO.
		const sA = reply({ id: "y-s-a", side: "YES", stake: "300" });
		const sB = reply({ id: "y-s-b", side: "YES", stake: "100" });
		const cA = reply({ id: "y-c-a", side: "NO", stake: "500" });
		const cB = reply({ id: "y-c-b", side: "NO", stake: "200" });

		const ranked = rankReplies([sB, cA, sA, cB], "YES", CFG);

		// Relation: Support pool = the YES replies; Counter pool = the NO replies.
		expect(ranked.support.every((r) => r.side === "YES")).toBe(true);
		expect(ranked.counter.every((r) => r.side === "NO")).toBe(true);

		// Column placement BY OWN SIDE: every Support reply lands in the YES
		// (LEFT) column; every Counter reply lands in the NO (RIGHT) column.
		const cols = routeToColumns([...ranked.support, ...ranked.counter]);
		expect(cols.yesColumn.map((r) => r.id).sort()).toEqual(
			["y-s-a", "y-s-b"].sort(),
		);
		expect(cols.noColumn.map((r) => r.id).sort()).toEqual(
			["y-c-a", "y-c-b"].sort(),
		);
		// Every support reply IS in the YES column; every counter reply IS in NO.
		for (const r of ranked.support) expect(r.side).toBe("YES");
		for (const r of ranked.counter) expect(r.side).toBe("NO");
	});

	it("post on NO — support replies are NO (RIGHT), counter replies are YES (LEFT)", () => {
		// Post side = NO. The relation INVERTS: a NO reply is now Support
		// (side == post.side), a YES reply is Counter — but the COLUMN never
		// moves: a YES reply is still LEFT, a NO reply still RIGHT.
		const sA = reply({ id: "n-s-a", side: "NO", stake: "300" });
		const sB = reply({ id: "n-s-b", side: "NO", stake: "100" });
		const cA = reply({ id: "n-c-a", side: "YES", stake: "500" });
		const cB = reply({ id: "n-c-b", side: "YES", stake: "200" });

		const ranked = rankReplies([sB, cA, sA, cB], "NO", CFG);

		// Relation: Support == NO (the post's side); Counter == YES.
		expect(ranked.support.every((r) => r.side === "NO")).toBe(true);
		expect(ranked.counter.every((r) => r.side === "YES")).toBe(true);

		// Column placement BY OWN SIDE is INVARIANT under the post's side: the NO
		// (Support here) replies sit in the RIGHT column; the YES (Counter here)
		// replies sit in the LEFT column. The poles name the SIDE, never the
		// relation.
		const cols = routeToColumns([...ranked.support, ...ranked.counter]);
		expect(cols.noColumn.map((r) => r.id).sort()).toEqual(
			["n-s-a", "n-s-b"].sort(),
		);
		expect(cols.yesColumn.map((r) => r.id).sort()).toEqual(
			["n-c-a", "n-c-b"].sort(),
		);
	});

	it("Support iff reply.side === post.side; placement is by own side, not relation", () => {
		// One YES reply against BOTH a YES post and a NO post: same reply, same
		// column (YES/LEFT) in both — only the RELATION label flips.
		const r = reply({ id: "yes-reply", side: "YES", stake: "120" });

		const underYesPost = rankReplies([r], "YES", CFG);
		// Under a YES post, a YES reply is Support.
		expect(underYesPost.support.map((x) => x.id)).toEqual(["yes-reply"]);
		expect(underYesPost.counter).toEqual([]);

		const underNoPost = rankReplies([r], "NO", CFG);
		// Under a NO post, the SAME YES reply is Counter.
		expect(underNoPost.counter.map((x) => x.id)).toEqual(["yes-reply"]);
		expect(underNoPost.support).toEqual([]);

		// COLUMN is identical in both cases: the YES reply renders LEFT (YES
		// column) regardless of the post's side / the relation label.
		expect(routeToColumns([r]).yesColumn.map((x) => x.id)).toEqual([
			"yes-reply",
		]);
		expect(routeToColumns([r]).noColumn).toEqual([]);
	});
});
