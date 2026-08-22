import "server-only";

import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";

import type { DbClient, DbTransaction } from "@/db";
import { comments, markets, positions } from "@/db/schema";
import {
	type PostSubstrate,
	profileOrder,
	type ReplySubstrate,
} from "@/lib/ranking";
import { CpmmDecimal, toFixed18 } from "@/server/cpmm/decimal";
import {
	deriveTitleTeaser,
	loadRemovedSet,
} from "@/server/debate-view/load-debate-view";
import { computeMarker, type Marker } from "@/server/positions/compute";

/** A bound read client — top-level `db` OR a caller's transaction. */
type ProfileReader = DbClient | DbTransaction;

/** §9 Support/Counter footer over a post's reply-bets (read-time aggregate). */
export type ProfileArgumentAggregate = {
	supportCount: number;
	counterCount: number;
	supportDharma: string;
	counterDharma: string;
};

/**
 * One entry in the profile argument list (SPEC.1 §23 "The argument list"). The
 * `removed` variant carries NO title/teaser/body/marker — a leak is a COMPILE
 * error (the `load-debate-view` union-variant pattern). Structural fields
 * survive so the stub keeps its §3.6 slot, frozen side chip (INV-3), ordinal,
 * and — for a post — the Support/Counter footer (removed items remain counted).
 */
export type ProfileArgumentItem =
	| {
			removed: true;
			kind: "post";
			id: string;
			side: "YES" | "NO";
			marketSlug: string;
			marketTitle: string;
			ordinal: number;
			createdAt: string;
			aggregate: ProfileArgumentAggregate;
	  }
	| {
			removed: true;
			kind: "reply";
			id: string;
			side: "YES" | "NO";
			marketSlug: string;
			marketTitle: string;
			ordinal: number;
			createdAt: string;
	  }
	| {
			removed: false;
			kind: "post";
			id: string;
			/** `side_at_post_time` — frozen (INV-3), distinct from `marker`. */
			side: "YES" | "NO";
			marketSlug: string;
			marketTitle: string;
			/** The post's OWN §9 ordinal — the `/m/[slug]?post=<ordinal>` target. */
			ordinal: number;
			title: string;
			teaser: string;
			body: string;
			/** `computeMarker` on the PROFILE USER's held side in this market. */
			marker: Marker;
			/** The author's own stake **still held** on this post (canon §3 item
			 * 11's head) — the surviving lot basis, which is also what the §3.6
			 * post order tie-breaks on (ADR-0039 R4 as amended at RANK-1).
			 * Distinct from a reply's `stake` below — see §0.5's name collision —
			 * and distinct from `.6`'s `staked` (the episode basis). */
			authorStake: string;
			/** The frozen `bets.stake`, for the struck-through original (R6). */
			authorStakeOriginal: string;
			/** R6/R10 `Sold` — the author has exited this argument entirely. */
			authorSold: boolean;
			/** `price_at_bet` — the effective price of THE SIDE THE AUTHOR BOUGHT,
			 * already side-scoped by the engine. ⚠ NOT the YES probability:
			 * deriving `100 − x` would misprint a NO entry. Forwarded RAW. */
			priceAtBet: string;
			createdAt: string;
			aggregate: ProfileArgumentAggregate;
	  }
	| {
			removed: false;
			kind: "reply";
			id: string;
			side: "YES" | "NO";
			marketSlug: string;
			marketTitle: string;
			/** The PARENT post's §9 ordinal — a reply deep-links to its parent. */
			ordinal: number;
			title: string;
			teaser: string;
			body: string;
			marker: Marker;
			/** The reply-bet's own stake **still held** — the §3.6 reply ruler, and
			 * the same value rendered beside it (surviving lot basis, RANK-1). */
			stake: string;
			/** The frozen `bets.stake`, for the struck-through original (R6). */
			stakeOriginal: string;
			/** R6/R10 `Sold` — nothing survives on this argument. */
			sold: boolean;
			/** `price_at_bet` — the bought side's price, as on the post variant. */
			priceAtBet: string;
			/** The parent post's title; null when the parent is removed (no leak). */
			repliedToTitle: string | null;
			createdAt: string;
	  };

/** The raw shape the per-user post-aggregate query yields (driver strings). */
type PostAggRow = {
	id: string;
	market_id: string;
	parent_side: "YES" | "NO";
	created_at: string | Date;
	body: string;
	author_stake: string;
	author_stake_original: string;
	author_sold: boolean;
	price_at_bet: string;
	support_count_total: string | number;
	counter_count_total: string | number;
	support_count: string | number;
	counter_count: string | number;
	support_dharma: string;
	counter_dharma: string;
};

type ReplyRow = {
	id: string;
	market_id: string;
	parent_comment_id: string;
	side: "YES" | "NO";
	created_at: string | Date;
	body: string;
	stake: string;
	original_stake: string;
	sold: boolean;
	price_at_bet: string;
};

/**
 * Load the profile user's argument list — their top-level posts and replies
 * across every market, ordered by RANKING.md §3.6 (posts by attracted `D`
 * descending, then replies by own stake descending, all posts above all
 * replies; viewer-independent, no interleave). Composes the shipped primitives:
 * `profileOrder` (the §3.6 order), `computeMarker` (on the PROFILE USER's held
 * side per market), `loadRemovedSet` (the audited masking gate, zero edits),
 * and `deriveTitleTeaser`. A `content_removed` comment collapses to the removed
 * stub for EVERY viewer (masking is viewer-independent; ban never masks) while
 * keeping its §3.6 slot and — for a post — its still-real aggregate footer.
 * Read-only; no store (§23).
 */
export async function loadProfileArguments(
	client: ProfileReader,
	args: { userId: string },
): Promise<ProfileArgumentItem[]> {
	const { userId } = args;

	// The user's top-level posts + per-side reply-bet aggregates (the
	// `ranking-substrate.ts` shape, scoped per-USER across markets). Reply-bets
	// are reached via `rb.comment_id = rc.id` (the circular pair — NEVER
	// `comments.bet_id`); Support ⟺ reply side = the post's side.
	const postRows = await client.execute<PostAggRow>(sql`
		SELECT
			p.id,
			p.market_id,
			p.side_at_post_time AS parent_side,
			p.created_at,
			p.body,
			-- RANK-1 / ADR-0039 R4 (amended) — a is conviction STILL HELD. On this
			-- surface it feeds the §3.6 post tiebreak AND the rendered stake, which
			-- is why they can never disagree: one column, two consumers.
			pb.stake AS author_stake,
			pb.original_stake AS author_stake_original,
			pb.sold AS author_sold,
			pb.price_at_bet AS price_at_bet,
			-- ⚠ TWO DIFFERENT NUMBERS LIVE HERE AND THEY ARE NOT INTERCHANGEABLE
			-- (ADR-0039 patch record P3, RANK-3).
			--
			-- *_count_total  = the DISPLAYED count. Every reply, self-authored and
			--                  removed INCLUDED. It answers "how many replies are
			--                  here" and must match what a reader can count on the
			--                  surface. This is the only one that reaches a DTO.
			-- *_count        = the RANKING input. DISTINCT PEOPLE, self-authored
			--                  excluded. Never rendered anywhere, on any surface.
			--
			-- R-2: the lanes count PEOPLE, not replies. The thesis is K·n > C and n
			-- is how many people hold the knowledge — one person posting five times
			-- is n = 1. COUNT(rb.id) measured the wrong noun; this is a correction
			-- to a definition, not a mitigation.
			--
			-- ⚠ THE SELF-EXCLUSION MOVED FROM THE JOIN INTO THESE FILTERS at RANK-3,
			-- and it had to: a JOIN predicate removes the row, so the total could
			-- not be computed from the same query. A FILTER keeps the row and
			-- declines to count it, which preserves the property the JOIN form was
			-- chosen for — a post whose only replies are its own still appears, with
			-- its ranking counts at zero, rather than vanishing from the listing.
			-- ⚠ THE DISPLAY TOTAL COUNTS REPLY COMMENTS, NOT REPLY-BET ROWS, and the
			-- distinction is load-bearing rather than pedantic. R-1 only holds if
			-- this number equals what a reader can COUNT on the surface, and the
			-- surface is the reply lane, which is one row per reply COMMENT
			-- (reply-substrate.ts takes its bet through a LIMIT 1 LATERAL). The
			-- join below is a plain LEFT JOIN on bets.comment_id, which has an
			-- index but NO unique constraint -- so COUNT(rb.id) would report 2 for
			-- a comment carrying two bets while the lane still showed one row, and
			-- the differential this task exists to close would silently re-open at
			-- exactly the surfaces it was closed at. That a second bet is
			-- unreachable today is a property of place.ts being the sole write
			-- path, not of the schema; COUNT(DISTINCT rc.id) does not depend on it.
			--
			-- AND rb.id IS NOT NULL makes both forms agree with the lane on the
			-- other edge too: the lane's LATERAL is an inner join, so a comment
			-- with no bet at all is absent from it. Without this clause the people
			-- count would score such a row as a whole person of traction at zero
			-- stake, since rc.user_id is non-null whether or not a bet exists.
			COUNT(DISTINCT rc.id) FILTER (
				WHERE rc.side_at_post_time = p.side_at_post_time
					AND rb.id IS NOT NULL
			) AS support_count_total,
			COUNT(DISTINCT rc.id) FILTER (
				WHERE rc.side_at_post_time <> p.side_at_post_time
					AND rb.id IS NOT NULL
			) AS counter_count_total,
			COUNT(DISTINCT rc.user_id) FILTER (
				WHERE rc.side_at_post_time = p.side_at_post_time
					AND rc.user_id <> p.user_id
					AND rb.id IS NOT NULL
			) AS support_count,
			COUNT(DISTINCT rc.user_id) FILTER (
				WHERE rc.side_at_post_time <> p.side_at_post_time
					AND rc.user_id <> p.user_id
					AND rb.id IS NOT NULL
			) AS counter_count,
			-- LOTS-1 / ADR-0039 R4+R5 — the attracted-value aggregates key off SURVIVING
			-- LOT BASIS, not the frozen bets.stake. A replier who sells their lot
			-- down withdraws the weight they lent the parent, which is what R5 names.
			-- The historical figure is not lost: bets.stake is Bucket-A immutable and
			-- still readable; it simply stops being what this aggregate reports.
			--
			-- ⚠ COALESCE FALLS BACK TO THE FROZEN STAKE when a reply-bet has no lot.
			-- Unreachable under R8 (every bet mints a lot), but the alternative on an
			-- unreachable row is to silently score a real contribution as ZERO — the
			-- same class of error as letting missing bookkeeping veto a sell (S5). An
			-- unknown surviving amount is better read as "all of it survives", which
			-- is exactly the pre-LOTS-1 behaviour.
			COALESCE(SUM(COALESCE(rl.surviving_basis, rb.stake)) FILTER (
				WHERE rc.side_at_post_time = p.side_at_post_time
					AND rc.user_id <> p.user_id
			), 0) AS support_dharma,
			COALESCE(SUM(COALESCE(rl.surviving_basis, rb.stake)) FILTER (
				WHERE rc.side_at_post_time <> p.side_at_post_time
					AND rc.user_id <> p.user_id
			), 0) AS counter_dharma
		FROM ${comments} p
		JOIN LATERAL (
			SELECT
				COALESCE(pl.surviving_basis, b.stake) AS stake,
				b.stake AS original_stake,
				COALESCE(pl.surviving_shares = 0, false) AS sold,
				b.price_at_bet
			FROM bets b
			LEFT JOIN lots pl ON pl.bet_id = b.id
			WHERE b.comment_id = p.id
			ORDER BY b.created_at ASC, b.id ASC
			LIMIT 1
		) pb ON true
		LEFT JOIN ${comments} rc ON rc.parent_comment_id = p.id
		LEFT JOIN bets rb ON rb.comment_id = rc.id
		LEFT JOIN lots rl ON rl.bet_id = rb.id
		WHERE p.user_id = ${userId} AND p.parent_comment_id IS NULL
		GROUP BY p.id, p.market_id, p.side_at_post_time, p.created_at, p.body,
			pb.stake, pb.original_stake, pb.sold, pb.price_at_bet
	`);

	// The user's replies + each reply-bet's own stake (INV-1: one bet per reply).
	const replyRows = await client.execute<ReplyRow>(sql`
		SELECT
			rc.id,
			rc.market_id,
			rc.parent_comment_id,
			rc.side_at_post_time AS side,
			rc.created_at,
			rc.body,
			-- RANK-1 — the §3.6 reply ruler, and the figure beside it.
			rb.stake,
			rb.original_stake,
			rb.sold,
			rb.price_at_bet
		FROM ${comments} rc
		JOIN LATERAL (
			SELECT
				COALESCE(rl.surviving_basis, b.stake) AS stake,
				b.stake AS original_stake,
				COALESCE(rl.surviving_shares = 0, false) AS sold,
				b.price_at_bet
			FROM bets b
			LEFT JOIN lots rl ON rl.bet_id = b.id
			WHERE b.comment_id = rc.id
			ORDER BY b.created_at ASC, b.id ASC
			LIMIT 1
		) rb ON true
		WHERE rc.user_id = ${userId} AND rc.parent_comment_id IS NOT NULL
	`);

	if (postRows.length === 0 && replyRows.length === 0) {
		return [];
	}

	// Canonicalize the aggregate sums to 18-dp (COALESCE(...,0) yields "0"); the
	// ordering `D` and the footer both read the canonical strings.
	const posts: PostSubstrate[] = postRows.map((r) => ({
		id: r.id,
		parentSide: r.parent_side,
		supportCount: Number(r.support_count),
		counterCount: Number(r.counter_count),
		supportCountTotal: Number(r.support_count_total),
		counterCountTotal: Number(r.counter_count_total),
		supportDharma: toFixed18(new CpmmDecimal(r.support_dharma)),
		counterDharma: toFixed18(new CpmmDecimal(r.counter_dharma)),
		createdAt: new Date(r.created_at),
		authorStake: r.author_stake,
		authorStakeOriginal: r.author_stake_original,
		authorSold: r.author_sold,
		priceAtBet: r.price_at_bet,
	}));
	const replies: ReplySubstrate[] = replyRows.map((r) => ({
		id: r.id,
		side: r.side,
		stake: toFixed18(new CpmmDecimal(r.stake)),
		stakeOriginal: toFixed18(new CpmmDecimal(r.original_stake)),
		sold: r.sold,
		createdAt: new Date(r.created_at),
		priceAtBet: r.price_at_bet,
	}));

	// Per-item metadata (market + body + the reply→parent linkage).
	const postMeta = new Map(
		postRows.map((r) => [
			r.id,
			{
				marketId: r.market_id,
				body: r.body,
				createdAt: new Date(r.created_at),
			},
		]),
	);
	const replyMeta = new Map(
		replyRows.map((r) => [
			r.id,
			{
				marketId: r.market_id,
				parentCommentId: r.parent_comment_id,
				body: r.body,
				createdAt: new Date(r.created_at),
			},
		]),
	);

	// Relevant markets — for slug/title, the ordinal domain, and held sides.
	const marketIds = [
		...new Set([
			...postRows.map((r) => r.market_id),
			...replyRows.map((r) => r.market_id),
		]),
	];

	const marketRows = await client
		.select({ id: markets.id, slug: markets.slug, title: markets.title })
		.from(markets)
		.where(inArray(markets.id, marketIds));
	const marketById = new Map(marketRows.map((m) => [m.id, m]));

	// §9 ordinal domain — 1-based rank by (created_at, id) over ALL top-level
	// comments per market, removed INCLUDED (append-only ⇒ permanent). The same
	// scan surfaces every parent post's body (parents are top-level).
	const topLevel = await client
		.select({
			id: comments.id,
			marketId: comments.marketId,
			body: comments.body,
		})
		.from(comments)
		.where(
			and(
				inArray(comments.marketId, marketIds),
				isNull(comments.parentCommentId),
			),
		)
		.orderBy(asc(comments.createdAt), asc(comments.id));
	const ordinalById = new Map<string, number>();
	const topLevelBodyById = new Map<string, string>();
	const ordinalCounter = new Map<string, number>();
	for (const c of topLevel) {
		const next = (ordinalCounter.get(c.marketId) ?? 0) + 1;
		ordinalCounter.set(c.marketId, next);
		ordinalById.set(c.id, next);
		topLevelBodyById.set(c.id, c.body);
	}

	// The PROFILE USER's held side per market (quantity > 0) — the marker input
	// (their OWN held side, since they authored every item; `listMarketComments`
	// parity — a sold-to-zero position has no held row → null → "Exited").
	const heldRows = await client
		.select({
			marketId: positions.marketId,
			side: positions.side,
			quantity: positions.quantity,
		})
		.from(positions)
		.where(eq(positions.userId, userId));
	const heldByMarket = new Map<string, "YES" | "NO">();
	for (const h of heldRows) {
		if (new CpmmDecimal(h.quantity).greaterThan(0)) {
			heldByMarket.set(h.marketId, h.side);
		}
	}

	// Masking — content_removed over the user's own items + the reply parents
	// (a removed parent ⇒ repliedToTitle null). The audited gate, zero edits.
	const maskingCandidates = new Set<string>([
		...postRows.map((r) => r.id),
		...replyRows.map((r) => r.id),
		...replyRows.map((r) => r.parent_comment_id),
	]);
	const removedSet = await loadRemovedSet(client, [...maskingCandidates]);

	const ordered = profileOrder(posts, replies);

	return ordered.map((item): ProfileArgumentItem => {
		if (item.kind === "post") {
			return buildPostItem({
				post: item.post,
				meta: postMeta.get(item.post.id),
				marketById,
				ordinalById,
				heldByMarket,
				removedSet,
			});
		}
		return buildReplyItem({
			reply: item.reply,
			meta: replyMeta.get(item.reply.id),
			marketById,
			ordinalById,
			topLevelBodyById,
			heldByMarket,
			removedSet,
		});
	});
}

// Exported for cross-author reuse by the bookmarks read model (UI-A6 steer 1):
// the pure builders below take `heldByMarket` per-call, so the bookmark read
// passes a per-item single-entry map keyed to the ITEM'S AUTHOR (not the
// viewer). No behaviour change — masking stays single-sourced through the
// unchanged `ProfileArgumentItem` union + `loadRemovedSet`.
export type MarketMeta = { id: string; slug: string; title: string };

function aggregateOf(post: PostSubstrate): ProfileArgumentAggregate {
	return {
		// ⚠ THE DISPLAY TOTALS, NEVER THE RANKING COUNTS (ADR-0039 P3, RANK-3).
		// The ranking counts are DISTINCT PEOPLE with self-authored replies
		// excluded; these are every reply, self-authored and removed included.
		// Putting the ranking numbers on a DTO is what created the SC-1
		// differential: subtract the rendered aggregate from the rendered lane
		// length and the remainder is the self-reply count — which, on a post
		// carrying a removed reply, attributes that removal to a named pseudonym
		// from a signed-out page.
		supportCount: post.supportCountTotal,
		counterCount: post.counterCountTotal,
		supportDharma: post.supportDharma,
		counterDharma: post.counterDharma,
	};
}

export function buildPostItem(args: {
	post: PostSubstrate;
	meta: { marketId: string; body: string; createdAt: Date } | undefined;
	marketById: Map<string, MarketMeta>;
	ordinalById: Map<string, number>;
	heldByMarket: Map<string, "YES" | "NO">;
	removedSet: Set<string>;
}): ProfileArgumentItem {
	const { post, meta, marketById, ordinalById, heldByMarket, removedSet } =
		args;
	const market = meta ? marketById.get(meta.marketId) : undefined;
	const marketSlug = market?.slug ?? "";
	const marketTitle = market?.title ?? "";
	const ordinal = ordinalById.get(post.id) ?? 0;
	const createdAt = (meta?.createdAt ?? post.createdAt).toISOString();
	const aggregate = aggregateOf(post);

	if (removedSet.has(post.id)) {
		return {
			removed: true,
			kind: "post",
			id: post.id,
			side: post.parentSide,
			marketSlug,
			marketTitle,
			ordinal,
			createdAt,
			aggregate,
		};
	}
	const { title, teaser } = deriveTitleTeaser(meta?.body ?? "");
	return {
		removed: false,
		kind: "post",
		id: post.id,
		side: post.parentSide,
		marketSlug,
		marketTitle,
		ordinal,
		title,
		teaser,
		body: meta?.body ?? "",
		marker: computeMarker({
			sideAtPostTime: post.parentSide,
			heldSide: heldByMarket.get(meta?.marketId ?? "") ?? null,
		}),
		// Read-and-forward: both are already fetched by the unchanged post query
		// and already carried on `PostSubstrate`. This re-derives neither.
		// ⚠ They are 18-dp by COLUMN TYPE, not by a `toFixed18` call — unlike the
		// aggregate sums beside them in the substrate assembly, which are
		// canonicalised there because COALESCE(...,0) yields a bare "0".
		// ⚠ RANK-1 — `authorStake` is no longer `bets.stake`: it is
		// `COALESCE(lots.surviving_basis, bets.stake)`. The 18-dp conclusion still
		// holds — BOTH branches are numeric(38,18) and a two-arm COALESCE over one
		// typmod passes the datum through unchanged — and that matters beyond
		// tidiness, because the badge decides whether to strike the original
		// through by comparing these two strings. `authorStakeOriginal` beside it
		// is the frozen `bets.stake`.
		authorStake: post.authorStake,
		authorStakeOriginal: post.authorStakeOriginal,
		authorSold: post.authorSold,
		priceAtBet: post.priceAtBet,
		createdAt,
		aggregate,
	};
}

export function buildReplyItem(args: {
	reply: ReplySubstrate;
	meta:
		| {
				marketId: string;
				parentCommentId: string;
				body: string;
				createdAt: Date;
		  }
		| undefined;
	marketById: Map<string, MarketMeta>;
	ordinalById: Map<string, number>;
	topLevelBodyById: Map<string, string>;
	heldByMarket: Map<string, "YES" | "NO">;
	removedSet: Set<string>;
}): ProfileArgumentItem {
	const {
		reply,
		meta,
		marketById,
		ordinalById,
		topLevelBodyById,
		heldByMarket,
		removedSet,
	} = args;
	const market = meta ? marketById.get(meta.marketId) : undefined;
	const marketSlug = market?.slug ?? "";
	const marketTitle = market?.title ?? "";
	// A reply deep-links to its PARENT's ordinal (§9).
	const parentId = meta?.parentCommentId;
	const ordinal = parentId ? (ordinalById.get(parentId) ?? 0) : 0;
	const createdAt = (meta?.createdAt ?? reply.createdAt).toISOString();

	if (removedSet.has(reply.id)) {
		return {
			removed: true,
			kind: "reply",
			id: reply.id,
			side: reply.side,
			marketSlug,
			marketTitle,
			ordinal,
			createdAt,
		};
	}
	// The parent's title — null when the parent is itself removed (no leak).
	const repliedToTitle =
		parentId && !removedSet.has(parentId)
			? deriveTitleTeaser(topLevelBodyById.get(parentId) ?? "").title
			: null;
	const { title, teaser } = deriveTitleTeaser(meta?.body ?? "");
	return {
		removed: false,
		kind: "reply",
		id: reply.id,
		side: reply.side,
		marketSlug,
		marketTitle,
		ordinal,
		title,
		teaser,
		body: meta?.body ?? "",
		marker: computeMarker({
			sideAtPostTime: reply.side,
			heldSide: heldByMarket.get(meta?.marketId ?? "") ?? null,
		}),
		stake: reply.stake,
		stakeOriginal: reply.stakeOriginal,
		sold: reply.sold,
		// Read-and-forward, as on the post variant — already carried on
		// `ReplySubstrate` from the unchanged reply query, 18-dp by column type.
		priceAtBet: reply.priceAtBet,
		repliedToTitle,
		createdAt,
	};
}
