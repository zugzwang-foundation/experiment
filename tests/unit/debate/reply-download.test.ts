import { describe, expect, it } from "vitest";

import {
	parentOfReply,
	replyDownloadOrdinal,
} from "@/components/debate/reply-download";
import type { DebatePost } from "@/components/debate/types";

import { mumbaiMetroModel } from "../debate-export/_fixtures/mumbai-metro.input";

/**
 * REPLY-IMAGE-EXPORT — the two rules every reply download mount shares: no
 * mark under a removed parent (SC-1), and the pop-up pairs its reply with the
 * reply's REAL parent rather than whichever post is on screen now.
 */
const posts = mumbaiMetroModel.posts;

describe("replyDownloadOrdinal", () => {
	it("is the parent's ordinal for a present post", () => {
		const p1 = posts.find((p) => p.id === "cmt-p1");
		expect(replyDownloadOrdinal(p1)).toBe(2);
	});

	it("is null for a removed parent, and for no parent at all", () => {
		const first = posts[0];
		if (first === undefined) throw new Error("fixture");
		const removed: DebatePost = {
			removed: true,
			id: first.id,
			ordinal: first.ordinal,
			sideAtPostTime: first.sideAtPostTime,
			createdAt: first.createdAt,
			aggregate: first.aggregate,
			replies: first.replies,
		};
		expect(replyDownloadOrdinal(removed)).toBeNull();
		expect(replyDownloadOrdinal(null)).toBeNull();
		expect(replyDownloadOrdinal(undefined)).toBeNull();
	});
});

describe("parentOfReply", () => {
	it("finds the reply's own post from either relation list", () => {
		expect(parentOfReply(posts, "cmt-r1-1")?.id).toBe("cmt-p1");
		expect(parentOfReply(posts, "cmt-r1-3")?.id).toBe("cmt-p1");
		expect(parentOfReply(posts, "cmt-r2-1")?.id).toBe("cmt-p2");
	});

	it("names the REAL parent whatever post is on screen — the stale-pop-up case", () => {
		// A pop-up opened on post p2's reply, then a back swipe focuses p1: the
		// ordinal must still be p2's, never the focused post's.
		const onScreen = posts.find((p) => p.id === "cmt-p1");
		const real = parentOfReply(posts, "cmt-r2-1");
		expect(replyDownloadOrdinal(real)).toBe(3);
		expect(replyDownloadOrdinal(real)).not.toBe(replyDownloadOrdinal(onScreen));
	});

	it("is null for an id no post carries", () => {
		expect(parentOfReply(posts, "cmt-nope")).toBeNull();
	});
});
