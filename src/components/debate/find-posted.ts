import type { DebatePost, PresentPost, PresentReply } from "./types";

/**
 * FEED-1 — THE JUST-POSTED COMMENT, FOUND IN THE REFRESHED MODEL.
 *
 * ⚠⚠ WHY A LOOKUP AND NOT A RECONSTRUCTION, WHICH IS THE WHOLE POINT OF THIS
 * FILE. `place()` returns a RECEIPT — `{ betId, commentId, side, sharesBought,
 * newPrice, parentCommentId }` — and a card needs three things the receipt does
 * not carry and the client cannot derive:
 *   · `ordinal` is a read-time rank over EVERY top-level comment in the market.
 *     "One more than what I already rendered" is wrong the instant another
 *     author's post lands in the gap between this page's load and this submit.
 *   · `badge` needs a full ranking pass over the debate (ADR-0017 multi-mode).
 *   · `entryPrice` is `price_at_bet` — the effective price PAID (`pEff`) — while
 *     the receipt's `newPrice` is `p1`, the price AFTER the trade. Different
 *     numbers, and the memory note on this exact field says do not improvise it.
 * ⇒ Three fields that a reconstruction would get WRONG, and — the part that
 * decides it — **no jsdom test in this repo could tell**, because none of them
 * runs the real read model. A confirmation showing a wrong ordinal teaches the
 * author to distrust the surface. So the post is FOUND, never assembled.
 *
 * ⛔⛔ MASKING IS ENFORCED BY THE RETURN TYPE, NOT BY A CONVENTION (SC-1).
 * This returns the PRESENT variant only. A `removed: true` match returns `null`,
 * which the caller treats exactly as "not found" and closes the slot. That is
 * not a policy choice made here — it is the only thing the signature admits, so
 * a withheld body has no field to travel in and cannot reach the confirmed
 * render even by mistake.
 *
 * ⚠ AND THE INPUT IS ALREADY MASKED. `posts` and `parent.replies` are the OUTPUT
 * of `loadDebateView`, where masking is keyed solely on
 * `mod_actions.reason = 'content_removed'` (ADR-0021; ADR-0034 D-4). This
 * function opens no second read path and therefore forks no second masking
 * implementation — the reason F-DEBATE-4's poll re-invokes the composed path
 * rather than adding a read endpoint.
 */
export type PostedNode =
	| { kind: "post"; post: PresentPost }
	| { kind: "reply"; reply: PresentReply };

export function findPostedNode(args: {
	/** The refreshed model's top-level posts. */
	posts: DebatePost[];
	/**
	 * The focused post whose replies to search — `null` in the market arm.
	 *
	 * ⚠ SCOPED, NOT GLOBAL, and correctly so: a reply composer only exists INSIDE
	 * a focused post, so a just-posted reply's parent is always this one. A sweep
	 * over every post's replies would search places the answer provably is not.
	 */
	parent: DebatePost | null;
	/** The receipt's `commentId`. */
	commentId: string;
}): PostedNode | null {
	const post = args.posts.find((p) => p.id === args.commentId);
	if (post !== undefined) {
		// ⚠ `=== false`, NOT a truthiness test. At the type level `removed` is
		// `true | false` and either form narrows; at RUNTIME a row arriving with
		// `undefined` would pass a truthiness check and be returned as PRESENT.
		// This file exists to be the one auditable place the narrowing happens, so
		// it takes the fail-closed form — the same posture the moderation gate
		// itself has (ADR-0014: fail closed on a terminal error).
		return post.removed === false ? { kind: "post", post } : null;
	}
	if (args.parent === null) {
		return null;
	}
	// `support` and `counter` PARTITION the replies by relation, so the
	// concatenation holds no duplicate. `twoSlot` is a SUBSET of the two and is
	// deliberately not searched — it would find nothing the pair does not.
	const reply = [
		...args.parent.replies.support,
		...args.parent.replies.counter,
	].find((r) => r.id === args.commentId);
	if (reply === undefined) {
		return null;
	}
	// Fail-closed, for the reason given above.
	return reply.removed === false ? { kind: "reply", reply } : null;
}
