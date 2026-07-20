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
			/** The reply-bet's own stake — the §3.6 reply ruler. */
			stake: string;
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
	price_at_bet: string;
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
			pb.stake AS author_stake,
			pb.price_at_bet AS price_at_bet,
			COUNT(rb.id) FILTER (
				WHERE rc.side_at_post_time = p.side_at_post_time
			) AS support_count,
			COUNT(rb.id) FILTER (
				WHERE rc.side_at_post_time <> p.side_at_post_time
			) AS counter_count,
			COALESCE(SUM(rb.stake) FILTER (
				WHERE rc.side_at_post_time = p.side_at_post_time
			), 0) AS support_dharma,
			COALESCE(SUM(rb.stake) FILTER (
				WHERE rc.side_at_post_time <> p.side_at_post_time
			), 0) AS counter_dharma
		FROM ${comments} p
		JOIN LATERAL (
			SELECT b.stake, b.price_at_bet
			FROM bets b
			WHERE b.comment_id = p.id
			ORDER BY b.created_at ASC, b.id ASC
			LIMIT 1
		) pb ON true
		LEFT JOIN ${comments} rc ON rc.parent_comment_id = p.id
		LEFT JOIN bets rb ON rb.comment_id = rc.id
		WHERE p.user_id = ${userId} AND p.parent_comment_id IS NULL
		GROUP BY p.id, p.market_id, p.side_at_post_time, p.created_at, p.body, pb.stake, pb.price_at_bet
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
			rb.stake,
			rb.price_at_bet
		FROM ${comments} rc
		JOIN LATERAL (
			SELECT b.stake, b.price_at_bet
			FROM bets b
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
		supportDharma: toFixed18(new CpmmDecimal(r.support_dharma)),
		counterDharma: toFixed18(new CpmmDecimal(r.counter_dharma)),
		createdAt: new Date(r.created_at),
		authorStake: r.author_stake,
		priceAtBet: r.price_at_bet,
	}));
	const replies: ReplySubstrate[] = replyRows.map((r) => ({
		id: r.id,
		side: r.side,
		stake: toFixed18(new CpmmDecimal(r.stake)),
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

type MarketMeta = { id: string; slug: string; title: string };

function aggregateOf(post: PostSubstrate): ProfileArgumentAggregate {
	return {
		supportCount: post.supportCount,
		counterCount: post.counterCount,
		supportDharma: post.supportDharma,
		counterDharma: post.counterDharma,
	};
}

function buildPostItem(args: {
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
		createdAt,
		aggregate,
	};
}

function buildReplyItem(args: {
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
		repliedToTitle,
		createdAt,
	};
}
