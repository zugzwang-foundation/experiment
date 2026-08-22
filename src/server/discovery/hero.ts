import "server-only";

import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";

import type { DbClient, DbTransaction } from "@/db";
import { bets, comments, imageUploads, lots, positions } from "@/db/schema";
import { type PostSubstrate, type Side, topOrder } from "@/lib/ranking";
import { computeSell, type Reserves } from "@/server/cpmm/calculate";
import { CpmmDecimal, toFixed18 } from "@/server/cpmm/decimal";
import {
	deriveTitleTeaser,
	loadRemovedSet,
} from "@/server/debate-view/load-debate-view";
import { loadRankingSubstrate } from "@/server/debate-view/ranking-substrate";
import {
	type AuthorIdentity,
	resolveAuthors,
} from "@/server/debate-view/resolve-authors";
import { signRead } from "@/server/storage/sign-read";

/** Mirrors the D9 render-side seam (`load-debate-view.ts`, `media.ts`). */
const READ_URL_TTL_SECONDS = 3600;

/** A bound read client — top-level `db` OR a caller's transaction. */
type DiscoveryReader = DbClient | DbTransaction;

/**
 * Defensive author fallback — mirrors the `loadDebateView` posture (every
 * `comments.user_id` is a real `users` row, so this is unreachable in
 * practice; it keeps a single missing identity from 500-ing the public
 * Discovery render). Carries no real pseudonym — never a leak.
 */
const UNKNOWN_AUTHOR: AuthorIdentity = {
	pseudonym: "—",
	pfpUrl: "/pfp-placeholder.svg",
};

/**
 * A hero panel's top post (SPEC.1 §22 F-DISC-2). ALWAYS a non-removed post —
 * a Track-B-hidden post is ineligible and skipped entirely, so no masked
 * union variant exists on this DTO (there is nothing to mask; the removed
 * post's body/author are never even read). `ordinal` is the permanent
 * 1-based deep-link rank (`/m/[slug]?post=N`, UI.A2 / OQ-4 A).
 */
export type HeroPost = {
	id: string;
	ordinal: number;
	side: Side;
	title: string;
	teaser: string;
	author: AuthorIdentity;
	authorStake: string;
	/**
	 * V10 — the post's own entry-bet `price_at_bet`: the effective price of THE
	 * SIDE THE AUTHOR BOUGHT at the instant the bet executed (decimal string,
	 * 0–1). ⚠ NOT the YES probability — `bets/place.ts:162` stores
	 * `computeBuy(...).pEff`, computed at `cpmm/calculate.ts:73-97` as
	 * `stake ÷ shares` where `a = reserves[side]` is the BOUGHT side, so a NO bet
	 * stores the NO price. The view layer renders it RAW; deriving a complement
	 * would print the wrong number on every NO chip.
	 *
	 * Already loaded on `PostSubstrate` (ranking.ts:50, selected by
	 * ranking-substrate.ts:74) and discarded until now, so this costs ZERO new
	 * queries. Passed through verbatim, exactly as `load-debate-view.ts:267` does.
	 */
	entryPrice: string;
	/**
	 * V16 — every reply-bet on this post, support and counter together. Both
	 * halves are already on `PostSubstrate` (ranking.ts:31-34) and were discarded
	 * until now, so this costs ZERO new queries. A plain integer sum: these are
	 * COUNTS, not money.
	 */
	replyCount: number;
	/**
	 * V16 — total Dharma staked across those reply-bets, 18-dp decimal string.
	 * Summed with `CpmmDecimal`, NEVER JS `+` on the strings (CLAUDE.md §2).
	 */
	replyDharma: string;
	/**
	 * V17 — the Support/Counter split, carried from the substrate (no arithmetic
	 * — the view derives the bar fill; the two are only normalised to 18 dp so
	 * the DTO's Đ fields share one shape). Support/Counter are
	 * read-time aggregates over reply-bets (ADR-0017/0018) — there is no
	 * standalone friendly-fire vote, and `friendly_fire_events` was dropped at
	 * DEBATE.9. Display-only: see §3c, the bar is never an affordance.
	 */
	supportDharma: string;
	counterDharma: string;
	/**
	 * V15 — a short-TTL presigned R2 GET for the post's image attachment, or
	 * `null` when the post has none OR the object is momentarily unavailable.
	 * The key rides the EXISTING picked-posts select as a LEFT JOIN column, so
	 * this costs ZERO new round-trips, and `signRead` is a local HMAC
	 * (`getSignedUrl` from s3-request-presigner) — no network call, no DB hit.
	 */
	imageUrl: string | null;
	/**
	 * V13 — the current Đ value of **THIS POST's OWN** stake, or `null` when no
	 * honest figure exists. Founder ruling OD-1 = Option B, POST-ANCHORED.
	 *
	 * **Both figures are POST-scoped**: `authorStake` is the Đ this post staked
	 * and this is what this post's shares are worth now — the same quantity at
	 * two times, which is what makes the arrow between them mean anything. It is
	 * NOT the author's whole market holding.
	 *
	 * The shares are the POST'S OWN surviving lot shares (RANK-1). They used to be
	 * `min(betShares, heldQuantity)` because `positions` is fungible and there was
	 * no exact per-post attribution; `lots.surviving_shares` is that attribution,
	 * so the approximation is retired and both figures now describe the same lot.
	 *
	 * `null` whenever a value cannot be honestly computed: no pool row, no bet
	 * row, no held row, a non-positive quantity, or a holding on the OPPOSITE
	 * side (author flipped). The panel then renders the single figure with no
	 * arrow — the honest degradation, and the common case for an older post.
	 */
	currentValue: string | null;
	createdAt: string;
};

export type HeroTopPosts = { yes: HeroPost | null; no: HeroPost | null };

/**
 * The Discovery hero's top post per side (SPEC.1 §22 F-DISC-2; plan §3,
 * OQ-3 = B — the LEAN selector): `loadRankingSubstrate` → the pure §9
 * **Top** order (`topOrder` — NOT `buildTopList`: the ADR-0017 P2
 * latest-interleave is display cadence below the top slot and must not
 * influence the hero pick; F-DISC-2 pins "the highest-ranked post on each
 * side under the §9 Top order") → per side, the FIRST post not in
 * `loadRemovedSet` — the SAME masking primitive F-DEBATE-1's debate view
 * enforces (extracted-and-exported, never re-implemented; `content_removed`
 * ONLY — a ban removes voice, not past content, ADR-0021 §4). A side with no
 * eligible post is `null`, never a placeholder.
 *
 * **Masking is safety-critical:** body, author identity, and title/teaser
 * are resolved ONLY for the ≤2 picked (non-removed) posts — a Track-B-hidden
 * post's argument or author cannot serialize into this DTO because it is
 * never read. Read-only; viewer-independent (the public render, no session).
 */
export async function selectHeroTopPosts(
	client: DiscoveryReader,
	marketId: string,
	/**
	 * V13 — the market's pool reserves, threaded from the read
	 * `listOpenMarkets` already performs. REQUIRED and explicitly nullable: a
	 * missing required argument is a compile error, a defaulted one silently
	 * drops the progression figure (O-1). `null` ⇒ every `currentValue` is null.
	 */
	reserves: Reserves | null,
): Promise<HeroTopPosts> {
	const substrate = await loadRankingSubstrate(client, { marketId });
	if (substrate.length === 0) {
		return { yes: null, no: null };
	}

	const removedSet = await loadRemovedSet(
		client,
		substrate.map((s) => s.id),
	);

	const ordered = topOrder(substrate);
	const pick = (side: Side): PostSubstrate | null =>
		ordered.find((p) => p.parentSide === side && !removedSet.has(p.id)) ?? null;
	const yesPick = pick("YES");
	const noPick = pick("NO");
	if (!yesPick && !noPick) {
		return { yes: null, no: null };
	}

	// Body + author for the PICKED (non-removed) posts only.
	const pickedIds = [yesPick, noPick]
		.filter((p): p is PostSubstrate => p !== null)
		.map((p) => p.id);
	// V15 — the image key rides THIS select as a LEFT JOIN column rather than a
	// second read. `load-debate-view.ts` batches a separate key read
	// (`mintImageUrls`) because it mints for MANY comments; the hero mints for
	// ≤2 KNOWN ids, so the key travels on the same `WHERE id IN (…)` as the body.
	// `mintImageUrls` is module-private and MUST stay that way — exporting it
	// would put a diff on `load-debate-view.ts` and break the ADR-0034 guard.
	// V13 — THIS POST'S OWN entry bet, as a LATERAL rather than a plain join.
	//
	// The ordering is `created_at ASC, id ASC LIMIT 1`, IDENTICAL to the
	// earliest-bet LATERAL in `ranking-substrate.ts` that supplies
	// `PostSubstrate.authorStake`. That is the whole point: `authorStake` (the
	// arrow's LEFT figure) and this `betShares` (which produces the RIGHT one)
	// then provably come from the SAME bet, rather than incidentally agreeing.
	//
	// A plain `LEFT JOIN bets ON bets.comment_id = comments.id` would NOT do.
	// `bets_comment_id_idx` is a PLAIN index, not a unique one, so nothing at
	// the storage layer forbids a second bet on a comment; a plain join would
	// fan the picked-posts result out and pick an arbitrary bet. The shipped
	// substrate already defends against exactly this with `LIMIT 1`, and this
	// read must not assume more than the substrate does.
	//
	// ⚠ RANK-1 — THE SHARES ARE THE LOT'S SURVIVING ONES, NOT THE BET'S MINTED
	// ONES, and that is what keeps the arrow honest. OD-1 = Option B rules that
	// the two figures must be "the same quantity at two times". RANK-1 moved the
	// LEFT figure (`authorStake`) onto the surviving lot basis; leaving the RIGHT
	// one on `bets.share_quantity` would have joined a stake that had been exited
	// to a value computed from shares the author no longer holds — rendering
	// `Đ 0 → Đ 500` on a post whose author had fully exited it, while a second
	// post in the same market kept `positions.quantity` high enough for the
	// `min()` below to find shares. A phantom gain, on a public panel, under a
	// named pseudonym.
	//
	// It also RETIRES the approximation this file used to apologise for. Before
	// lots there was no per-post attribution, so `min(betShares, heldQuantity)`
	// was the honest degradation; `lots.surviving_shares` IS that attribution, so
	// the degradation is no longer needed. The `min()` stays as the belt: it now
	// only binds if lots and positions ever disagreed, which R2 forbids.
	//
	// COALESCE for the same reason every other RANK-1 site has one: a bet with no
	// lot cannot arise (R8), and if one ever did, reading it as ZERO shares would
	// silently delete a real holding from the panel.
	const postBet = client
		.select({
			commentId: bets.commentId,
			shareQuantity:
				sql<string>`COALESCE(${lots.survivingShares}, ${bets.shareQuantity})`.as(
					"share_quantity",
				),
		})
		.from(bets)
		// 1:1 by `lots_bet_id_uq` — cannot fan the LIMIT 1 subquery out.
		.leftJoin(lots, eq(lots.betId, bets.id))
		.where(eq(bets.commentId, comments.id))
		.orderBy(asc(bets.createdAt), asc(bets.id))
		.limit(1)
		.as("post_bet");

	const rows = await client
		.select({
			id: comments.id,
			userId: comments.userId,
			body: comments.body,
			createdAt: comments.createdAt,
			imageKey: imageUploads.r2ObjectKey,
			// V13 — the shares THIS POST's bet minted (post-scoped).
			betShares: postBet.shareQuantity,
			// V13 — the author's held quantity ON THE SIDE THEY ARGUED. The side
			// predicate is part of the JOIN, so a holding on the opposite side
			// (author flipped) simply does not match and arrives null — the same
			// answer as "exited", which is what we want. This join cannot fan out:
			// `positions_user_market_side_idx` is a UNIQUE index on
			// (user_id, market_id, side).
			heldQuantity: positions.quantity,
		})
		.from(comments)
		.leftJoin(imageUploads, eq(imageUploads.id, comments.imageUploadsId))
		.leftJoinLateral(postBet, sql`true`)
		.leftJoin(
			positions,
			and(
				eq(positions.userId, comments.userId),
				eq(positions.marketId, comments.marketId),
				eq(positions.side, comments.sideAtPostTime),
			),
		)
		.where(inArray(comments.id, pickedIds));
	const rowById = new Map(rows.map((r) => [r.id, r]));

	// SC-1: this mints ONLY for `pickedIds`, which `pick()` already filtered
	// against `removedSet` — a removed post's key is never selected, so its URL
	// can never be minted. Presigning is a local HMAC (no network, no DB), so
	// this adds no round-trip either.
	const urlById = new Map<string, string>();
	await Promise.all(
		rows.map(async (r) => {
			if (r.imageKey === null) {
				return;
			}
			try {
				urlById.set(r.id, await signRead(r.imageKey, READ_URL_TTL_SECONDS));
			} catch {
				// R2 unavailable for this object → degrade to no image (the
				// `mintImageUrls` / `getDefaultMarketMediaUrl` resilience posture).
				// One unavailable object must never 500 the public render.
			}
		}),
	);
	const authorMap = await resolveAuthors(
		client,
		rows.map((r) => r.userId),
	);

	// The deep-link ordinal domain: ALL top-level comments, removed INCLUDED
	// (append-only ⇒ permanent), ranked (created_at, id) ASC — the EXACT
	// Postgres order `resolvePostParam` resolves against (congruence by
	// construction; never a JS Date re-sort, which would truncate to ms).
	const ordinalRows = await client
		.select({ id: comments.id })
		.from(comments)
		.where(
			and(eq(comments.marketId, marketId), isNull(comments.parentCommentId)),
		)
		.orderBy(asc(comments.createdAt), asc(comments.id));
	const ordinalById = new Map(ordinalRows.map((r, i) => [r.id, i + 1]));

	/**
	 * V13 — the current value of **THIS POST's OWN** stake, POST-SCOPED.
	 *
	 * Founder ruling OD-1 = Option B, post-anchored: *two numbers joined by an
	 * arrow must be the same quantity at two times.* So the left figure is
	 * `authorStake` (the Đ this post staked) and the right is the Đ **this
	 * post's shares** are worth now — never the author's whole market holding.
	 * A market-scoped right figure would show an author with three Đ1,000 posts
	 * `Đ 1,000 → Đ 4,221` on every panel: a 4× gain on an argument that is
	 * roughly flat, on a public surface, attributed to a named pseudonym.
	 *
	 * Discovery lists OPEN markets only (`list.ts`), so settlement cannot have
	 * occurred: the settled branch of `computeBookmarkFigures` is unreachable
	 * here and the value collapses to ONE pure `computeSell` call — no episode
	 * walk, no `payout_events`, no `events`.
	 *
	 * ⚠ **THE PARAGRAPH THAT USED TO SIT HERE IS SUPERSEDED, AND IS REWRITTEN
	 * RATHER THAN APPENDED TO (O-5).** It argued that `positions` is fungible, so
	 * "this post's shares" had no exact answer, and that `min(betShares,
	 * heldQuantity)` was therefore the ruled degradation — one that "CAN
	 * over-attribute across several posts by one author". **`lots` is that exact
	 * answer** (ADR-0039 D-1), and since RANK-1 `betShares` carries the post's own
	 * `lots.surviving_shares`. The over-attribution the old paragraph accepted is
	 * gone: three posts sold down to one post's worth no longer show that worth on
	 * each, because each panel now reads only its own lot.
	 *
	 * `min(…, heldQuantity)` STAYS, demoted from the attribution rule to a belt.
	 * It now binds only if `lots` and `positions` ever disagreed — which is
	 * ADR-0039 R2's invariant (`Σ surviving lot shares == positions.quantity`), so
	 * a bind means drift, not fungibility. Keeping it costs nothing and keeps the
	 * figure incapable of over-claiming against a real position, which is the
	 * property this whole docblock exists to guarantee.
	 *
	 * Every guard returns null rather than throwing. `computeSell` calls
	 * `requirePositive` on shares and reserves, and a throw here would escape
	 * into `DiscoveryContent`'s ONE whole-surface catch and flip the ENTIRE page
	 * to `ErrorState` over one author's row. Deliberately NOT the
	 * `figures.ts:130` posture, which throws under a held-position precondition
	 * this does not have.
	 */
	const currentValueFor = (
		side: Side,
		betShares: string | null,
		heldQuantity: string | null,
	): string | null => {
		if (reserves === null || betShares === null || heldQuantity === null) {
			return null;
		}
		const held = new CpmmDecimal(heldQuantity);
		const minted = new CpmmDecimal(betShares);
		// Exited (the row survives at quantity 0 — positions is Bucket C), or a
		// bet that minted nothing. Either way there is no honest figure.
		const shares = held.lessThan(minted) ? held : minted;
		if (!shares.greaterThan(0)) {
			return null;
		}
		return computeSell({
			reserves,
			// The CPMM's own side literals are lowercase (calculate.ts), the
			// schema enum's are upper — the `bets/place.ts:123` conversion.
			side: side === "YES" ? "yes" : "no",
			shares: toFixed18(shares),
		}).proceeds;
	};

	const toHeroPost = (p: PostSubstrate | null): HeroPost | null => {
		if (!p) {
			return null;
		}
		const row = rowById.get(p.id);
		if (!row) {
			// Unreachable (the substrate derives from comments) — defensive null
			// rather than a 500 on the public render.
			return null;
		}
		const { title, teaser } = deriveTitleTeaser(row.body);
		return {
			id: p.id,
			ordinal: ordinalById.get(p.id) ?? 0,
			side: p.parentSide,
			title,
			teaser,
			author: authorMap.get(row.userId) ?? UNKNOWN_AUTHOR,
			authorStake: p.authorStake,
			entryPrice: p.priceAtBet,
			replyCount: p.supportCount + p.counterCount,
			replyDharma: toFixed18(
				new CpmmDecimal(p.supportDharma).plus(p.counterDharma),
			),
			// Value-preserving NORMALISATION, not arithmetic. The substrate's
			// aggregates are SQL sums, so an empty one arrives as the unpadded
			// "0" while a non-empty one arrives 18-dp. Emitting both raw would
			// make this DTO internally inconsistent — `replyDharma` above is
			// always 18-dp — and hand any consumer doing a string comparison a
			// trap that only appears on posts with no replies.
			supportDharma: toFixed18(new CpmmDecimal(p.supportDharma)),
			counterDharma: toFixed18(new CpmmDecimal(p.counterDharma)),
			imageUrl: urlById.get(p.id) ?? null,
			currentValue: currentValueFor(
				p.parentSide,
				row.betShares,
				row.heldQuantity,
			),
			createdAt: row.createdAt.toISOString(),
		};
	};

	return { yes: toHeroPost(yesPick), no: toHeroPost(noPick) };
}
