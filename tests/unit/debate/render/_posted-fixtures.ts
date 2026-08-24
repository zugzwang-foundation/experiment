import type {
	DebatePost,
	DebateReply,
	DebateViewModel,
	PresentPost,
} from "@/components/debate/types";

import { mumbaiMetroModel } from "../../debate-export/_fixtures/mumbai-metro.input";

/**
 * FEED-1 — fixtures for the confirmation guards. Underscore-prefixed: the vitest
 * include glob is `tests/**\/*.{test,spec}.{ts,tsx}`, so this is never collected.
 *
 * ⚠⚠ WHAT A "REFRESHED MODEL" IS HERE, AND WHY IT IS A NEW OBJECT. The build's
 * refresh-landed signal is `model !== posted.fromModel` — a new RSC payload
 * deserializes into new objects, and nothing else hands this component a
 * different model while a composer is engaged. Every builder below therefore
 * returns a NEW top-level object, because a mutated-in-place model would model
 * something the server cannot produce and would prove nothing.
 *
 * ⛔ NO MARKET CONTENT IS INVENTED (CLAUDE.md §3). The argument prose below is
 * reused verbatim from the shipped composer suite's own fixture strings; the
 * pseudonyms are the identity-pool shapes the mumbai-metro fixture already uses.
 */

/** The §4.4 success envelope `place()` returns — a RECEIPT, not a post. */
export function placeOk(commentId: string, side: "YES" | "NO" = "YES") {
	return {
		status: 200,
		body: {
			ok: true,
			data: {
				betId: "bet-0001",
				commentId,
				side,
				sharesBought: "20.000000000000000000",
				// ⚠ `newPrice` is `p1` — the price AFTER the trade. It is NOT
				// `entryPrice` (`pEff`, the price PAID), and the two differ below on
				// purpose so a build that mistook one for the other would be visible.
				newPrice: "0.560000000000000000",
				parentCommentId: null,
			},
		},
	};
}

/** Reused fixture prose (payload.test.ts) — no invented market content. */
const TITLE = "The base rate argument.";
const BODY = "The extended argument, first paragraph.";

/**
 * A present top-level post. ⚠ `ordinal` and `badge` are the two fields a client
 * reconstruction provably cannot produce, so the guards assert on them: they are
 * only ever right if the card came from the model.
 */
export function newPost(over: {
	id: string;
	ordinal: number;
	sideAtPostTime: "YES" | "NO";
	badge?: PresentPost["badge"];
}): DebatePost {
	return {
		removed: false,
		id: over.id,
		ordinal: over.ordinal,
		sideAtPostTime: over.sideAtPostTime,
		createdAt: "2026-09-18T09:00:00.000Z",
		title: TITLE,
		teaser: "",
		body: BODY,
		imageUrl: null,
		marker: "none",
		badge: over.badge ?? null,
		author: { pseudonym: "AmberFinch404", pfpUrl: "/pfp-placeholder.svg" },
		authorStake: "50.000000000000000000",
		authorStakeOriginal: "50.000000000000000000",
		authorSold: false,
		entryPrice: "0.470000000000000000",
		aggregate: {
			supportCount: 0,
			counterCount: 0,
			supportDharma: "0.000000000000000000",
			counterDharma: "0.000000000000000000",
		},
		replies: { support: [], counter: [], twoSlot: [] },
	};
}

/** A REMOVED top-level post — no body, no author, at the type level (§6). */
export function newRemovedPost(over: {
	id: string;
	ordinal: number;
	sideAtPostTime: "YES" | "NO";
}): DebatePost {
	return {
		removed: true,
		id: over.id,
		ordinal: over.ordinal,
		sideAtPostTime: over.sideAtPostTime,
		createdAt: "2026-09-18T09:00:00.000Z",
		aggregate: {
			supportCount: 0,
			counterCount: 0,
			supportDharma: "0.000000000000000000",
			counterDharma: "0.000000000000000000",
		},
		replies: { support: [], counter: [], twoSlot: [] },
	};
}

/** A present depth-1 reply. */
export function newReply(over: {
	id: string;
	side: "YES" | "NO";
}): DebateReply {
	return {
		removed: false,
		id: over.id,
		side: over.side,
		createdAt: "2026-09-18T09:05:00.000Z",
		body: BODY,
		marker: "none",
		// ⚠ A pseudonym NO base-fixture reply uses, so "the confirmation shows THIS
		// reply" is distinguishable from "the confirmation shows A reply". Same
		// <Colour><Animal><NNN> identity-pool shape the fixture already uses.
		author: { pseudonym: "CobaltLark733", pfpUrl: "/pfp-placeholder.svg" },
		stake: "25.000000000000000000",
		stakeOriginal: "25.000000000000000000",
		sold: false,
		entryPrice: "0.510000000000000000",
		imageUrl: null,
	};
}

/** The base model, unchanged — the payload the bet is placed against. */
export function baseModel(): DebateViewModel {
	return { ...mumbaiMetroModel };
}

/** A NEW model object carrying `post` among the top-level posts. */
export function modelWithPost(post: DebatePost): DebateViewModel {
	return {
		...mumbaiMetroModel,
		posts: [...mumbaiMetroModel.posts, post],
	};
}

/**
 * A NEW model object in which `parentId`'s support list carries `reply`.
 * ⚠ Support, not counter: the guards drive a Support reply, and placing it in
 * the list its relation names is what the real projection does.
 */
export function modelWithReply(
	parentId: string,
	reply: DebateReply,
): DebateViewModel {
	return {
		...mumbaiMetroModel,
		posts: mumbaiMetroModel.posts.map((p) =>
			p.id === parentId
				? {
						...p,
						replies: {
							...p.replies,
							support: [...p.replies.support, reply],
						},
					}
				: p,
		),
	};
}

/** A NEW model object that is otherwise identical — a refresh that brought nothing. */
export function modelUnchanged(): DebateViewModel {
	return { ...mumbaiMetroModel, posts: [...mumbaiMetroModel.posts] };
}
