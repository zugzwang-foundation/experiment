import { describe, expect, it } from "vitest";

import type { PostSubstrate, ReplySubstrate } from "@/lib/ranking";
import { buildPostItem, buildReplyItem } from "@/server/profile/arguments";

/**
 * PROFILE-IMAGE — the builders forward an argument's presigned attachment URL,
 * and NEVER for a removed argument (SC-1). The URL is minted upstream only for
 * non-removed rows; these assert the second line of defence: even with a URL in
 * the map, the removed variant carries none. The check reads the serialised
 * item, not a field, so no second path can carry it either.
 */

const POST_ID = "0190c0de-2222-7000-8000-0000000000a1";
const REPLY_ID = "0190c0de-2222-7000-8000-0000000000a2";
const PARENT_ID = "0190c0de-2222-7000-8000-0000000000a3";
const MARKET_ID = "0190c0de-3333-7000-8000-0000000000a1";
const IMAGE_URL = "https://r2.example.test/u/fixture.webp?X-Amz-Signature=abc";

const POST: PostSubstrate = {
	id: POST_ID,
	parentSide: "YES",
	supportCount: 0,
	counterCount: 0,
	supportCountTotal: 0,
	counterCountTotal: 0,
	supportDharma: "0.000000000000000000",
	counterDharma: "0.000000000000000000",
	endorseCount: 0,
	contestCount: 0,
	friendlyFireDharma: "0.000000000000000000",
	createdAt: new Date("2026-07-01T00:00:00.000Z"),
	authorStake: "10.000000000000000000",
	authorStakeOriginal: "10.000000000000000000",
	authorSold: false,
	priceAtBet: "0.500000000000000000",
};

const REPLY: ReplySubstrate = {
	id: REPLY_ID,
	side: "NO",
	stake: "5.000000000000000000",
	stakeOriginal: "5.000000000000000000",
	sold: false,
	createdAt: new Date("2026-07-02T00:00:00.000Z"),
	priceAtBet: "0.500000000000000000",
	friendlyFire: false,
};

const common = {
	marketById: new Map([
		[MARKET_ID, { id: MARKET_ID, slug: "fixture", title: "Fixture market" }],
	]),
	ordinalById: new Map([[PARENT_ID, 1]]),
	heldByMarket: new Map<string, "YES" | "NO">(),
};

const postArgs = (removed: boolean, imageUrlById: Map<string, string>) => ({
	...common,
	post: POST,
	meta: {
		marketId: MARKET_ID,
		body: "Post title\n\nPost body.",
		createdAt: POST.createdAt,
	},
	removedSet: new Set(removed ? [POST_ID] : []),
	imageUrlById,
});

const replyArgs = (removed: boolean, imageUrlById: Map<string, string>) => ({
	...common,
	reply: REPLY,
	meta: {
		marketId: MARKET_ID,
		parentCommentId: PARENT_ID,
		body: "Reply title\n\nReply body.",
		createdAt: REPLY.createdAt,
	},
	replyOrdinalById: new Map([[REPLY_ID, 1]]),
	topLevelBodyById: new Map([[PARENT_ID, "Parent title"]]),
	removedSet: new Set(removed ? [REPLY_ID] : []),
	imageUrlById,
});

describe("PROFILE-IMAGE — the builders carry the attachment", () => {
	it("post::a-visible-post-carries-its-image-url", () => {
		const item = buildPostItem(
			postArgs(false, new Map([[POST_ID, IMAGE_URL]])),
		);
		expect(item.removed).toBe(false);
		expect(item.removed === false && item.imageUrl).toBe(IMAGE_URL);
	});

	it("post::a-post-without-an-attachment-carries-null", () => {
		const item = buildPostItem(postArgs(false, new Map()));
		expect(item.removed === false && item.imageUrl).toBeNull();
	});

	it("reply::a-visible-reply-carries-its-image-url", () => {
		const item = buildReplyItem(
			replyArgs(false, new Map([[REPLY_ID, IMAGE_URL]])),
		);
		expect(item.removed === false && item.imageUrl).toBe(IMAGE_URL);
	});
});

describe("PROFILE-IMAGE — SC-1: a removed argument never carries its image", () => {
	it("post::removed-post-serialises-WITHOUT-the-url", () => {
		const item = buildPostItem(postArgs(true, new Map([[POST_ID, IMAGE_URL]])));
		expect(item.removed).toBe(true);
		expect(JSON.stringify(item)).not.toContain(IMAGE_URL);
	});

	it("reply::removed-reply-serialises-WITHOUT-the-url", () => {
		const item = buildReplyItem(
			replyArgs(true, new Map([[REPLY_ID, IMAGE_URL]])),
		);
		expect(item.removed).toBe(true);
		expect(JSON.stringify(item)).not.toContain(IMAGE_URL);
	});
});
