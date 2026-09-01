import type {
	DebatePost,
	DebateReply,
	DebateViewModel,
	PresentPost,
} from "@/components/debate/types";

import { mumbaiMetroModel as mumbaiMetroModelRaw } from "../../debate-export/_fixtures/mumbai-metro.input";

/**
 * BLOCK-1 — `mumbaiMetroModelRaw.market.slug` is not one of BLOCK-1's eight
 * known live markets, so `ResolverCards` (nested under `MarketHeader`, which
 * every fixture below renders through) now throws on it — correctly; that's
 * the new guard this task shipped (G1, `resolution-block-data.ts`). Nothing
 * in this file tests ResolverCards' content, so every builder below gets a
 * locally-corrected model with a real slug instead. The golden input fixture
 * itself (`mumbai-metro.input.ts`) is marked "do not hand-edit" and stays
 * untouched — this shadows the name, it doesn't alter the import.
 */
const mumbaiMetroModel: DebateViewModel = {
	...mumbaiMetroModelRaw,
	market: { ...mumbaiMetroModelRaw.market, slug: "bitcoin-price-50k" },
};

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
const BODY = "The base rate argument.";

/**
 * ⚠⚠ THE MODEL'S TITLE IS DELIBERATELY **NOT** THE STRING THE COMPOSER TYPES.
 *
 * In life they would be the same — the author typed it, the server stored it —
 * and that is exactly the problem: an assertion that the card shows the typed
 * string passes just as happily against a card built from the composer's own
 * local draft, which is the reconstruction this whole feature refuses to do.
 * Diverging them here is what makes `h3 === MODEL_TITLE` mean "this came from
 * the MODEL" rather than "this came from somewhere".
 *
 * ⛔ Still not invented: both halves are shipped fixture prose from the composer
 * suite (`payload.test.ts`). Nothing here is market content.
 */
export const MODEL_TITLE = "The extended argument, first paragraph.";

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
		title: MODEL_TITLE,
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

/**
 * ⛔⛔ THE ROW THE TYPE SAYS CANNOT EXIST, CARRYING A BODY — SC-1's positive
 * specimen. `newRemovedPost` above carries no body at all, so an assertion that
 * its body is absent is an assertion about nothing. This one is built through a
 * cast precisely so the guard has withheld content to fail to find.
 *
 * ⚠⚠ AND HERE IS EXACTLY WHAT IT PROVES, BECAUSE THIS COMMENT SAID SOMETHING
 * STRONGER AND IT WAS MEASURED FALSE. It read: "if the masking narrowing ever
 * loosened, THIS is the string that would appear on screen." It would not.
 * Loosening `find-posted`'s narrowing alone gets the row as far as `PostCard`,
 * whose OWN `if (post.removed)` check then draws `Removed by moderator` — the
 * sentinel still never reaches the document. ⇒ The three assertions in the
 * render guard pin DIFFERENT layers: the sentinel line pins `PostCard`'s union
 * check, and the two null assertions pin the narrowing. The claim that the
 * narrowing ALONE keeps a body off screen belongs to `find-posted.test.ts`,
 * which asserts on the RETURN VALUE, where `PostCard` does not exist.
 * ⛔ A guard that describes itself wrongly costs the same keystroke to fix as
 * one that fails wrongly (O-3), and it misleads for longer.
 *
 * ⚠ It models a real failure, not a fantasy: the server emitting a removed
 * variant that still carries its columns is exactly what a regression in
 * `loadDebateView`'s union construction would produce.
 */
export const WITHHELD_SENTINEL = "WITHHELD-BODY-SENTINEL";

export function newRemovedPostCarryingBody(over: {
	id: string;
	ordinal: number;
	sideAtPostTime: "YES" | "NO";
}): DebatePost {
	// ⚠⚠ A FULLY RENDERABLE PRESENT ROW, FLAGGED REMOVED — and it has to be fully
	// renderable or the guard reds for the WRONG REASON. Built from the removed
	// variant alone it has no `author`, so a loosened narrowing crashes inside
	// `ArgProfile` on `pfpUrl` instead of putting the withheld text on screen:
	// a red that says "something broke" where the guard needs to say "the body
	// reached the document" (O-3 — a true refusal with a misleading cause is a
	// defect). Built this way, removing the narrowing renders the card and the
	// sentinel assertion fires on its own terms.
	return {
		...newPost(over),
		removed: true,
		title: WITHHELD_SENTINEL,
		body: WITHHELD_SENTINEL,
		teaser: WITHHELD_SENTINEL,
	} as unknown as DebatePost;
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

/**
 * A NEW model object carrying `posts` appended IN ORDER — so a caller can put a
 * card AHEAD of another and move the second one's index.
 *
 * ⚠⚠ THIS EXISTS TO MAKE ONE GUARD FALSIFIABLE. "A second payload must not
 * re-jump" cannot tell an id-keyed guard from an index-keyed one unless the
 * card's index actually MOVES between payloads — and in life it moves whenever
 * a new bet lands above it, which is the common case, not the exotic one.
 */
export function modelWithPosts(...added: DebatePost[]): DebateViewModel {
	return {
		...mumbaiMetroModel,
		posts: [...mumbaiMetroModel.posts, ...added],
	};
}

/** A NEW model object that is otherwise identical — a refresh that brought nothing. */
export function modelUnchanged(): DebateViewModel {
	return { ...mumbaiMetroModel, posts: [...mumbaiMetroModel.posts] };
}
