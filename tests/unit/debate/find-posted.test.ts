import { describe, expect, it } from "vitest";

import { findPostedNode } from "@/components/debate/find-posted";
import type { DebatePost } from "@/components/debate/types";

import { newPost, newRemovedPost, newReply } from "./render/_posted-fixtures";

/**
 * FEED-1 — the receipt → model lookup, in isolation.
 *
 * ⚠ NO jsdom AND NO RENDER, deliberately. The render suites drive this through
 * the whole surface and prove it is WIRED; this proves what it RETURNS, on the
 * cases a render can barely reach — a parent that holds no such reply, a
 * `commentId` matching nothing at all, the market arm asked about a reply. Those
 * are one-line calls here and a whole scenario each through a component tree.
 *
 * ⛔⛔ THE MASKING RULE IS THE REASON THIS FILE EXISTS SEPARATELY (SC-1). A
 * removed match must come back as `null`, not as a removed variant for someone
 * downstream to remember to check. The signature is what enforces it — the
 * return type admits only the present variants — and these are the cases that
 * would go red if the narrowing were ever loosened to "let the renderer decide".
 */

/** A parent post carrying one support reply and one counter reply. */
function parentWithReplies(replies: {
	support?: ReturnType<typeof newReply>[];
	counter?: ReturnType<typeof newReply>[];
}): DebatePost {
	const post = newPost({ id: "cmt-parent", ordinal: 1, sideAtPostTime: "YES" });
	return {
		...post,
		replies: {
			support: replies.support ?? [],
			counter: replies.counter ?? [],
			twoSlot: [],
		},
	};
}

const POST_A = newPost({ id: "cmt-a", ordinal: 1, sideAtPostTime: "YES" });
const POST_B = newPost({ id: "cmt-b", ordinal: 2, sideAtPostTime: "NO" });

describe("findPostedNode — top-level posts", () => {
	it("find-posted::returns-the-post-whose-id-IS-the-commentId", () => {
		const found = findPostedNode({
			posts: [POST_A, POST_B],
			parent: null,
			commentId: "cmt-b",
		});
		// ⛔ `cmt-b`, not `posts[0]`. The defect this rejects is a lookup that
		// ignores the receipt and shows whatever happens to be first.
		expect(found).toEqual({ kind: "post", post: POST_B });
	});

	it("find-posted::returns-null-when-NOTHING-matches", () => {
		expect(
			findPostedNode({
				posts: [POST_A, POST_B],
				parent: null,
				commentId: "cmt-not-here",
			}),
		).toBeNull();
	});

	it("find-posted::returns-null-for-an-EMPTY-model", () => {
		expect(
			findPostedNode({ posts: [], parent: null, commentId: "cmt-a" }),
		).toBeNull();
	});

	it("find-posted::a-REMOVED-post-comes-back-as-null-not-as-a-removed-variant", () => {
		// ⛔⛔ SC-1. The row IS there; the content is withheld. Returning the
		// removed variant would push the decision downstream to whichever renderer
		// received it — the exact shape that lets a masked body reach a screen the
		// day someone adds a second consumer.
		const removed = newRemovedPost({
			id: "cmt-gone",
			ordinal: 3,
			sideAtPostTime: "NO",
		});
		expect(
			findPostedNode({
				posts: [POST_A, removed],
				parent: null,
				commentId: "cmt-gone",
			}),
		).toBeNull();
	});
	it("find-posted::a-removed-node-carrying-a-BODY-still-comes-back-as-null", () => {
		// ⛔⛔ SC-1's SECOND OBLIGATION, AND IT WAS NOT ASSERTED ANYWHERE. Both
		// removed cases above are built from fixtures that carry NO body — so they
		// prove the `null` return and prove nothing at all about whether a body
		// could travel. The removed variant has no body field at the TYPE level,
		// which is the whole argument; this is the case that shows the argument is
		// about the RUNTIME too, because a projection that widened, a stale cache
		// or a hand-built row can all hand this function an object with a body on
		// it and a `removed: true` beside it.
		//
		// ⚠ The cast is deliberate and is the point: it constructs the row the
		// type system says cannot exist, which is exactly the row a masking guard
		// has to survive. The assertion is on the RETURN, not on a row id — a
		// caller that received the node would be free to render the body.
		const leaky = {
			removed: true,
			id: "cmt-gone",
			ordinal: 3,
			sideAtPostTime: "NO",
			createdAt: "2026-09-18T09:00:00.000Z",
			title: "WITHHELD-TITLE-SENTINEL",
			body: "WITHHELD-BODY-SENTINEL",
			aggregate: {
				supportCount: 0,
				counterCount: 0,
				supportDharma: "0.000000000000000000",
				counterDharma: "0.000000000000000000",
			},
			replies: { support: [], counter: [], twoSlot: [] },
		} as unknown as DebatePost;

		const found = findPostedNode({
			posts: [POST_A, leaky],
			parent: null,
			commentId: "cmt-gone",
		});
		expect(found).toBeNull();
		// The body's absence, not the row's (SC-1). `null` has no field for it to
		// travel in, and this is the assertion that says so in the shape a second
		// consumer would have to break.
		expect(JSON.stringify(found)).not.toContain("WITHHELD-BODY-SENTINEL");
		expect(JSON.stringify(found)).not.toContain("WITHHELD-TITLE-SENTINEL");
	});
	it("find-posted::a-row-whose-removed-flag-is-MISSING-is-treated-as-removed", () => {
		// ⛔ FAIL-CLOSED, and this is the case that distinguishes `removed === false`
		// from a truthiness test. At the type level `removed` is `true | false` and
		// either form narrows identically; at RUNTIME a row arriving without the
		// field — a regression in the union construction, a hand-built payload —
		// passes a truthiness check and is returned as PRESENT. Masking is the one
		// place in this file where "probably fine" is not a posture.
		const noFlag = { ...POST_A, removed: undefined } as unknown as DebatePost;
		expect(
			findPostedNode({ posts: [noFlag], parent: null, commentId: "cmt-a" }),
			"an unstated removal is a removal",
		).toBeNull();
	});
});

describe("findPostedNode — replies under the focused post", () => {
	it("find-posted::finds-a-reply-in-the-SUPPORT-list", () => {
		const reply = newReply({ id: "cmt-r", side: "YES" });
		const found = findPostedNode({
			posts: [POST_A],
			parent: parentWithReplies({ support: [reply] }),
			commentId: "cmt-r",
		});
		expect(found).toEqual({ kind: "reply", reply });
	});

	it("find-posted::finds-a-reply-in-the-COUNTER-list-too", () => {
		// Both lists are searched: the relation a reply was filed under is not
		// something the receipt tells the caller, so a lookup that checked only one
		// would work for half of all replies and fail silently for the other half.
		const reply = newReply({ id: "cmt-r", side: "NO" });
		const found = findPostedNode({
			posts: [POST_A],
			parent: parentWithReplies({ counter: [reply] }),
			commentId: "cmt-r",
		});
		expect(found).toEqual({ kind: "reply", reply });
	});

	it("find-posted::a-REMOVED-reply-comes-back-as-null", () => {
		const removed = {
			removed: true as const,
			id: "cmt-r",
			ordinal: 1,
			side: "YES" as const,
			createdAt: "2026-09-18T09:05:00.000Z",
		};
		expect(
			findPostedNode({
				posts: [POST_A],
				parent: parentWithReplies({ support: [removed] }),
				commentId: "cmt-r",
			}),
		).toBeNull();
	});

	it("find-posted::returns-null-when-the-market-arm-is-asked-about-a-reply", () => {
		// ⚠ `parent: null` IS the market arm. There is no focused post, so there is
		// no reply list in scope — and a lookup that swept every post's replies
		// would be searching places the answer provably cannot be.
		const reply = newReply({ id: "cmt-r", side: "YES" });
		const withReply = parentWithReplies({ support: [reply] });
		expect(
			findPostedNode({
				posts: [withReply],
				parent: null,
				commentId: "cmt-r",
			}),
		).toBeNull();
	});

	it("find-posted::does-not-find-a-reply-that-lives-under-a-DIFFERENT-parent", () => {
		const reply = newReply({ id: "cmt-r", side: "YES" });
		expect(
			findPostedNode({
				posts: [POST_A, parentWithReplies({ support: [reply] })],
				parent: POST_A,
				commentId: "cmt-r",
			}),
		).toBeNull();
	});
});
