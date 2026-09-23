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
 *   own post   → BOTH foreclosed, whatever is held (D-52 R1: nobody replies to
 *                their own post, on either side).
 *   H === P    → Counter foreclosed (Counter = bet ¬P ≠ H), Support allowed.
 *   H === ¬P   → Support foreclosed (Support = bet P ≠ H), Counter allowed.
 *   H === null → both allowed (each is an entry bet on its own side).
 *
 * Total over these inputs, no side effects. `reason` is non-null IFF a side is
 * foreclosed. `isOwnPost` defaults to false so the two-input form stays the
 * pre-D-52 derivation; the write-path mirror of the own-post row is F-COMMENT-2's
 * `self_reply_forbidden`, as `opposite_side_held` mirrors the other two.
 */
export function computeReplyAffordance(
	P: Side,
	H: Side | null,
	isOwnPost = false,
): ReplyAffordance {
	if (isOwnPost) {
		return {
			support: "foreclosed",
			counter: "foreclosed",
			reason: "You can't reply to your own post.",
		};
	}
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
 * FF-1 / ADR-0058 — whether the composer OFFERS the friendly-fire switch.
 *
 * `P` = parent.side_at_post_time; `S` = the side the reply will BUY — the
 * viewer's held side when they hold one, the side they chose when the reply is
 * their entry (D-51 R2: an entry reply placed as Support is eligible, which is
 * why this takes the side being bought and not `H`). True exactly when the
 * reply would be a Support. Pure, `===`, total over its inputs.
 *
 * UI guidance ONLY. The guard is the write path: `place.ts` rejects
 * `friendly_fire = true` on an opposite-side reply (`friendly_fire_requires_
 * support`) and on a top-level post (`friendly_fire_requires_reply`), and the
 * `comments` CHECK backs the second half. `computeReplyAffordance` above is
 * unchanged by ADR-0058 — this sits beside it, not inside it.
 */
export function friendlyFireEligible(P: Side, S: Side): boolean {
	return P === S;
}

/**
 * Thin reader: pulls `H` via `heldSideOrNull` (ENGINE.11) for the viewer in the
 * parent's market, reads `P` off the parent comment's frozen side, and delegates
 * to the pure `computeReplyAffordance`. No write, no render.
 *
 * D-52 — it also takes the parent's author (`userId`, server-side only) and
 * forecloses both sides when the viewer wrote the parent. Required rather than
 * optional: a caller that forgot it would get an affordance offering a reply
 * the write path refuses, with nothing to say it was incomplete.
 */
export async function readReplyAffordance(
	client: DbClient | DbTransaction,
	args: {
		viewerId: string;
		parentComment: { marketId: string; sideAtPostTime: Side; userId: string };
	},
): Promise<ReplyAffordance> {
	const held = await heldSideOrNull(client, {
		userId: args.viewerId,
		marketId: args.parentComment.marketId,
	});
	return computeReplyAffordance(
		args.parentComment.sideAtPostTime,
		held,
		args.parentComment.userId === args.viewerId,
	);
}
