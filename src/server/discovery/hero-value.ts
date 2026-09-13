import "server-only";

import { computeSell, type Reserves } from "@/server/cpmm/calculate";

import type { HeroPostShares, HeroTopPosts, HeroTopPostsBase } from "./hero";

/**
 * CACHE-KEY-1 (ADR-0051) — the hero panel's `Đ staked → Đ now` right-hand
 * figure, composed OUTSIDE the cache.
 *
 * ⛔ WHY THIS IS A SEPARATE STEP AT ALL. `getCachedMarketDiscoveryData` used to
 * key on `reserves`, which made `currentValue` safe to cache by a purity
 * argument: a hit proved the live reserves equalled the ones that produced the
 * entry, so a pure function of them could not be stale. Removing that key
 * removes the argument with it. Everything else in the cached block is content
 * or a count and may lag by a window; this is **money on the most public
 * surface in the product**, so it is computed per render from the live pool read
 * `(public)/page.tsx` already performs for `card.pricing`.
 *
 * ⚠ ZERO ADDITIONAL QUERIES. The shares come from the cached block (they are a
 * database fact about a lot, not about a pool) and the reserves come from the
 * batched live read already on the page. This is arithmetic over two values the
 * caller is holding.
 *
 * ⚠ NULL IS AN ANSWER, NOT A FAILURE — and the two null sources are different
 * questions. `shares === null` means the post has no honest figure (no bet row,
 * no held row, exited, or a holding on the opposite side — `hero.ts` decides
 * that). `reserves === null` means the market has no pool row. Either way the
 * panel renders the single stake figure with no arrow, which is the shipped
 * degradation and the common case for an older post.
 *
 * ⛔ IT NEVER THROWS. `computeSell` calls `requirePositive` on shares and
 * reserves, and a throw here would escape into `DiscoveryContent`'s ONE
 * whole-surface catch and flip the ENTIRE page to `ErrorState` over one
 * author's row — the same posture `hero.ts` documents on the half that stayed
 * there.
 */
function valueOne(
	post: HeroTopPostsBase["yes"],
	shares: string | null,
	reserves: Reserves | null,
): HeroTopPosts["yes"] {
	if (post === null) {
		return null;
	}
	if (shares === null || reserves === null) {
		return { ...post, currentValue: null };
	}
	try {
		return {
			...post,
			currentValue: computeSell({
				reserves,
				// The CPMM's own side literals are lowercase (calculate.ts), the
				// schema enum's are upper — the `bets/place.ts:123` conversion.
				side: post.side === "YES" ? "yes" : "no",
				shares,
			}).proceeds,
		};
	} catch {
		return { ...post, currentValue: null };
	}
}

/**
 * Apply the live reserves to both sides' hero posts, turning the cached
 * `HeroTopPostsBase` into the `HeroTopPosts` the carousel renders.
 *
 * ⛔ THE RETURN TYPE IS THE ENFORCEMENT. `HeroPostBase` omits `currentValue`, so
 * a `DiscoveryMarketView` cannot be built without going through here — a
 * composition that forgot this step would be a compile error rather than a
 * silently missing figure (**O-1**).
 */
export function valueHeroPosts(
	posts: HeroTopPostsBase,
	shares: HeroPostShares,
	reserves: Reserves | null,
): HeroTopPosts {
	return {
		yes: valueOne(posts.yes, shares.yes, reserves),
		no: valueOne(posts.no, shares.no, reserves),
	};
}
