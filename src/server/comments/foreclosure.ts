import "server-only";

import type { DbClient, DbTransaction } from "@/db";
import { heldSideOrNull } from "@/server/positions/read";

// DEBATE.2 — the single-side × Counter FORECLOSURE read surface (plan §3 "Open
// Item 1 / ruling 1a"; SPEC.2 "Read-time reply affordance"). A PURE derivation +
// a thin positions reader — NO render (the UI is DESIGN.5 / DEBATE.4), NO write.
//
// Support targets the parent's frozen side P; Counter targets ¬P. A reply IS a
// bet on the targeted side, so a viewer who already holds the OTHER side is
// foreclosed from that target. The write-path mirror is the existing F-BET-10
// `opposite_side_held` check inside place() — the two agree by construction.

export type Affordance = "allowed" | "foreclosed";

export interface ReplyAffordance {
	/** A reply on the parent's frozen side P. */
	support: Affordance;
	/** A reply on ¬P. */
	counter: Affordance;
	/** Why-foreclosed, for disable-and-explain; null when both sides are allowed. */
	reason: string | null;
}

type Side = "YES" | "NO";

const otherSide = (s: Side): Side => (s === "YES" ? "NO" : "YES");

/**
 * Pure truth table. `P` = parent.side_at_post_time; `H` = the viewer's held side
 * (null = no position). Support targets P; Counter targets ¬P.
 *
 *   H === P    → Counter foreclosed (Counter = bet ¬P ≠ H), Support allowed.
 *   H === ¬P   → Support foreclosed (Support = bet P ≠ H), Counter allowed.
 *   H === null → both allowed (each is an entry bet on its own side).
 *
 * Total over these inputs, no side effects. `reason` is non-null IFF a side is
 * foreclosed.
 */
export function computeReplyAffordance(
	P: Side,
	H: Side | null,
): ReplyAffordance {
	if (H === null) {
		return { support: "allowed", counter: "allowed", reason: null };
	}
	if (H === P) {
		return {
			support: "allowed",
			counter: "foreclosed",
			reason: `Countering would bet ${otherSide(P)}, opposite your held ${H} position (single-side rule).`,
		};
	}
	// H === ¬P
	return {
		support: "foreclosed",
		counter: "allowed",
		reason: `Supporting would bet ${P}, opposite your held ${H} position (single-side rule).`,
	};
}

/**
 * Thin reader: pulls `H` via `heldSideOrNull` (ENGINE.11) for the viewer in the
 * parent's market, reads `P` off the parent comment's frozen side, and delegates
 * to the pure `computeReplyAffordance`. No write, no render.
 */
export async function readReplyAffordance(
	client: DbClient | DbTransaction,
	args: {
		viewerId: string;
		parentComment: { marketId: string; sideAtPostTime: Side };
	},
): Promise<ReplyAffordance> {
	const held = await heldSideOrNull(client, {
		userId: args.viewerId,
		marketId: args.parentComment.marketId,
	});
	return computeReplyAffordance(args.parentComment.sideAtPostTime, held);
}
