import "server-only";

import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";

import type { DbClient, DbTransaction } from "@/db";
import {
	bets,
	bookmarks,
	comments,
	events,
	markets,
	payoutEvents,
	pools,
	positions,
} from "@/db/schema";
import type { PostSubstrate, ReplySubstrate } from "@/lib/ranking";
import { CpmmDecimal, toFixed18 } from "@/server/cpmm/decimal";
import { loadRemovedSet } from "@/server/debate-view/load-debate-view";
import { resolveAuthors } from "@/server/debate-view/resolve-authors";
import { eventPayloadSchemas } from "@/server/events/schemas";
import {
	buildPostItem,
	buildReplyItem,
	type MarketMeta,
	type ProfileArgumentItem,
} from "@/server/profile/arguments";
import type { SellTrade } from "@/server/profile/episodes";

import { type BookmarkBetRow, computeBookmarkFigures } from "./figures";

/** A bound read client — top-level `db` OR a caller's transaction. */
type BookmarkReader = DbClient | DbTransaction;

/**
 * One saved item on the /bookmarks surface (ADR-0032 D-4/D-5; plan §4.4). The
 * DTO extends the A5 `ProfileArgumentItem` union — the SAME compile-time
 * masking boundary — with `authorPseudonym` (the item is SOMEONE ELSE's
 * argument, so the author is named). The present variant additionally carries
 * `staked` (Đa) + `current` (Đb); the removed variant carries author ONLY. The
 * `Extract` split makes a `staked`/`current` leak onto a removed stub a COMPILE
 * error — masking single-sourced through the unchanged union.
 */
export type BookmarkItem =
	| (Extract<ProfileArgumentItem, { removed: true }> & {
			authorPseudonym: string;
	  })
	| (Extract<ProfileArgumentItem, { removed: false }> & {
			authorPseudonym: string;
			/** Đa — canonical 18-dp string (never a float; CLAUDE.md §2). */
			staked: string;
			/** Đb — canonical 18-dp string. */
			current: string;
	  });

/** The per-post aggregate row shape — MIRRORS `arguments.ts` PostAggRow. */
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

/** The per-reply row shape — MIRRORS `arguments.ts` ReplyRow. */
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
 * The cross-author bookmark read (UI-A6 §4 — the substance). Produces
 * `BookmarkItem[]` in `bookmarks.created_at` DESC (recency) order — NOT the
 * RANKING.md §3.6 profile order. Each item renders the bookmarked AUTHOR's
 * argument + their Đa/Đb + marker in the Profile surface's forced-visitor mode.
 *
 * Reuse (single-sourced, no parallel path): the A5 pure builders
 * `buildPostItem`/`buildReplyItem` (masking via the unchanged
 * `ProfileArgumentItem` union + `loadRemovedSet`), `resolveAuthors` (scrub-safe
 * author heads), and the FI-2 same-source figures (`figures.ts`, mirroring
 * `positions.ts` — §4.5). The marker input is a PER-ITEM single-entry held map
 * keyed to the ITEM'S AUTHOR (not the viewer) — the read applies no viewer
 * filter (D-3 write guard + UI hiding is the self-bookmark contract).
 *
 * Fully batched — 13 IN-list-scoped queries, O(1) round-trips, no N+1 and no
 * per-item `loadProfilePositions` (plan steer 2). Read-only; no store (§23).
 */
export async function loadBookmarks(
	client: BookmarkReader,
	args: { viewerId: string },
): Promise<BookmarkItem[]> {
	const { viewerId } = args;

	// Q1 — the viewer's bookmarks, recency (created_at DESC) order. The `id`
	// tiebreak (UUIDv7 = insert order) keeps a same-timestamp pair deterministic.
	const bookmarkRows = await client
		.select({
			commentId: bookmarks.commentId,
			createdAt: bookmarks.createdAt,
			id: bookmarks.id,
		})
		.from(bookmarks)
		.where(eq(bookmarks.userId, viewerId))
		.orderBy(desc(bookmarks.createdAt), desc(bookmarks.id));
	if (bookmarkRows.length === 0) {
		return [];
	}
	const orderedCommentIds = bookmarkRows.map((b) => b.commentId);

	// Q2 — the bookmarked comments' substrate: author A, market M, post/reply
	// split. `body`/`created_at`/side come from Q3/Q4 (the aggregate queries).
	const substrateRows = await client
		.select({
			id: comments.id,
			userId: comments.userId,
			marketId: comments.marketId,
			parentCommentId: comments.parentCommentId,
		})
		.from(comments)
		.where(inArray(comments.id, orderedCommentIds));
	const substrateById = new Map(substrateRows.map((c) => [c.id, c]));
	const authorIds = [...new Set(substrateRows.map((c) => c.userId))];
	const authorIdSet = new Set(authorIds);
	const marketIds = [...new Set(substrateRows.map((c) => c.marketId))];
	const postIds = substrateRows
		.filter((c) => c.parentCommentId === null)
		.map((c) => c.id);
	const replyIds = substrateRows
		.filter((c) => c.parentCommentId !== null)
		.map((c) => c.id);

	// Q3 — post aggregate (the `arguments.ts` postRows SQL, scoped to bookmarked
	// post ids instead of a single author). Support ⟺ reply side = post side.
	const postRows =
		postIds.length > 0
			? await client.execute<PostAggRow>(sql`
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
				WHERE p.id IN (${sql.join(
					postIds.map((id) => sql`${id}::uuid`),
					sql`, `,
				)})
				GROUP BY p.id, p.market_id, p.side_at_post_time, p.created_at, p.body, pb.stake, pb.price_at_bet
			`)
			: [];

	// Q4 — reply-stake (the `arguments.ts` replyRows SQL, scoped to bookmarked
	// reply ids). INV-1: one bet per reply (JOIN LATERAL the earliest).
	const replyRows =
		replyIds.length > 0
			? await client.execute<ReplyRow>(sql`
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
				WHERE rc.id IN (${sql.join(
					replyIds.map((id) => sql`${id}::uuid`),
					sql`, `,
				)})
			`)
			: [];

	// Q5 — markets (slug/title for the card + the marketById builder input).
	const marketRows = await client
		.select({ id: markets.id, slug: markets.slug, title: markets.title })
		.from(markets)
		.where(inArray(markets.id, marketIds));
	const marketById = new Map<string, MarketMeta>(
		marketRows.map((m) => [m.id, m]),
	);

	// Q6 — pools (reserves for the open-holding Đb `computeSell`).
	const poolRows = await client
		.select({
			marketId: pools.marketId,
			yesReserves: pools.yesReserves,
			noReserves: pools.noReserves,
		})
		.from(pools)
		.where(inArray(pools.marketId, marketIds));
	const reservesByMarket = new Map(
		poolRows.map((p) => [p.marketId, { yes: p.yesReserves, no: p.noReserves }]),
	);

	// Q7 — the AUTHORS' held positions (quantity > 0) across the touched markets,
	// keyed per (author, market) — the marker input + the Đb open basis.
	const positionRows = await client
		.select({
			userId: positions.userId,
			marketId: positions.marketId,
			side: positions.side,
			quantity: positions.quantity,
		})
		.from(positions)
		.where(
			and(
				inArray(positions.userId, authorIds),
				inArray(positions.marketId, marketIds),
			),
		);
	const heldByAuthorMarket = new Map<
		string,
		{ side: "YES" | "NO"; quantity: string }
	>();
	for (const p of positionRows) {
		if (new CpmmDecimal(p.quantity).greaterThan(0)) {
			heldByAuthorMarket.set(amKey(p.userId, p.marketId), {
				side: p.side,
				quantity: p.quantity,
			});
		}
	}

	// Q8 — net Σ payout per (author, market): the settled-holding Đb (OQ-9 A);
	// its presence is the open-vs-settled discriminant (positions.ts parity).
	const payoutRows = await client
		.select({
			userId: payoutEvents.userId,
			marketId: payoutEvents.marketId,
			amount: payoutEvents.amount,
		})
		.from(payoutEvents)
		.where(
			and(
				inArray(payoutEvents.userId, authorIds),
				inArray(payoutEvents.marketId, marketIds),
			),
		);
	const settledNetByAuthorMarket = new Map<
		string,
		InstanceType<typeof CpmmDecimal>
	>();
	for (const r of payoutRows) {
		const key = amKey(r.userId, r.marketId);
		const prior = settledNetByAuthorMarket.get(key) ?? new CpmmDecimal(0);
		settledNetByAuthorMarket.set(key, prior.plus(r.amount));
	}

	// Q9 — the authors' BUYS (episode substrate). The FI-2-relevant columns
	// MIRROR `positions.ts` userBets (§4.5a same-source mandate — id/side/stake/
	// share_quantity/created_at feed the BuyTrade); `comment_id` is carried for
	// byte-parity (the episode walk ignores it), and `user_id` is the
	// cross-author grouping key (positions.ts scopes by one user and needs
	// neither). One read, no per-item query — the true 13-query O(1) shape.
	const betRows = await client
		.select({
			id: bets.id,
			userId: bets.userId,
			marketId: bets.marketId,
			side: bets.side,
			stake: bets.stake,
			shareQuantity: bets.shareQuantity,
			commentId: bets.commentId,
			createdAt: bets.createdAt,
		})
		.from(bets)
		.where(
			and(inArray(bets.userId, authorIds), inArray(bets.marketId, marketIds)),
		);
	const buysByAuthorMarket = new Map<string, BookmarkBetRow[]>();
	for (const b of betRows) {
		const key = amKey(b.userId, b.marketId);
		const list = buysByAuthorMarket.get(key) ?? [];
		list.push({
			id: b.id,
			side: b.side,
			stake: b.stake,
			shareQuantity: b.shareQuantity,
			createdAt: b.createdAt,
		});
		buysByAuthorMarket.set(key, list);
	}

	// Q10 — the authors' SELLS. Sell-source MIRRORS `positions.ts` soldEvents
	// EXACTLY (§4.5a — `events` `bet.sold`, `payload.sharesSold`/`payload.side`,
	// `eventId` as trade id, `createdAt` as `at`); the ONLY cross-author delta is
	// `payload.userId ∈ A[]` + group by (A, M). Do NOT invent a `bets`-sell.
	const soldEvents = await client
		.select({
			payload: events.payload,
			createdAt: events.createdAt,
			eventId: events.eventId,
		})
		.from(events)
		.where(
			and(
				eq(events.aggregateType, "market"),
				inArray(events.aggregateId, marketIds),
				eq(events.eventType, "bet.sold"),
			),
		);
	const sellsByAuthorMarket = new Map<string, SellTrade[]>();
	for (const ev of soldEvents) {
		const payload = eventPayloadSchemas["bet.sold"].parse(ev.payload);
		if (!authorIdSet.has(payload.userId)) {
			continue;
		}
		const key = amKey(payload.userId, payload.marketId);
		const list = sellsByAuthorMarket.get(key) ?? [];
		list.push({
			source: "sell",
			id: ev.eventId,
			at: ev.createdAt,
			side: payload.side,
			shares: payload.sharesSold,
		});
		sellsByAuthorMarket.set(key, list);
	}

	// Q11 — §9 ordinal domain + parent/opener bodies: ALL top-level comments in
	// the touched markets (removed INCLUDED — append-only ⇒ permanent).
	const marketComments = await client
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
	for (const c of marketComments) {
		const next = (ordinalCounter.get(c.marketId) ?? 0) + 1;
		ordinalCounter.set(c.marketId, next);
		ordinalById.set(c.id, next);
		topLevelBodyById.set(c.id, c.body);
	}

	// Q12 — masking: the single-sourced audited gate over the bookmarked ids +
	// their reply parents (a removed parent ⇒ repliedToTitle null, no leak).
	const maskingCandidates = new Set<string>(orderedCommentIds);
	for (const r of replyRows) {
		maskingCandidates.add(r.parent_comment_id);
	}
	const removedSet = await loadRemovedSet(client, [...maskingCandidates]);

	// Q13 — author heads (scrub-safe: bracketed placeholder for H2-erased; zero
	// PII — reads only public `pseudonym`).
	const authorMap = await resolveAuthors(client, authorIds);

	// Build the per-post / per-reply substrate + meta (mirrors arguments.ts).
	const postSubstrateById = new Map<string, PostSubstrate>();
	const postMeta = new Map<
		string,
		{ marketId: string; body: string; createdAt: Date }
	>();
	for (const r of postRows) {
		postSubstrateById.set(r.id, {
			id: r.id,
			parentSide: r.parent_side,
			supportCount: Number(r.support_count),
			counterCount: Number(r.counter_count),
			supportDharma: toFixed18(new CpmmDecimal(r.support_dharma)),
			counterDharma: toFixed18(new CpmmDecimal(r.counter_dharma)),
			createdAt: new Date(r.created_at),
			authorStake: r.author_stake,
			priceAtBet: r.price_at_bet,
		});
		postMeta.set(r.id, {
			marketId: r.market_id,
			body: r.body,
			createdAt: new Date(r.created_at),
		});
	}
	const replySubstrateById = new Map<string, ReplySubstrate>();
	const replyMeta = new Map<
		string,
		{
			marketId: string;
			parentCommentId: string;
			body: string;
			createdAt: Date;
		}
	>();
	for (const r of replyRows) {
		replySubstrateById.set(r.id, {
			id: r.id,
			side: r.side,
			stake: toFixed18(new CpmmDecimal(r.stake)),
			createdAt: new Date(r.created_at),
			priceAtBet: r.price_at_bet,
		});
		replyMeta.set(r.id, {
			marketId: r.market_id,
			parentCommentId: r.parent_comment_id,
			body: r.body,
			createdAt: new Date(r.created_at),
		});
	}

	// Per-item assembly in Q1 (recency) order.
	const items: BookmarkItem[] = [];
	for (const commentId of orderedCommentIds) {
		const substrate = substrateById.get(commentId);
		if (substrate === undefined) {
			continue; // defensive: the bookmark FK guarantees the comment exists.
		}
		const authorId = substrate.userId;
		const marketId = substrate.marketId;
		const authorPseudonym = authorMap.get(authorId)?.pseudonym ?? "";
		const held = heldByAuthorMarket.get(amKey(authorId, marketId));

		// The marker input is a PER-ITEM single-entry map keyed to the AUTHOR's
		// held side (not the viewer's) — the builders read only `.get(marketId)`.
		const perItemHeld = new Map<string, "YES" | "NO">();
		if (held !== undefined) {
			perItemHeld.set(marketId, held.side);
		}

		let argItem: ProfileArgumentItem;
		let side: "YES" | "NO";
		if (substrate.parentCommentId === null) {
			const post = postSubstrateById.get(commentId);
			if (post === undefined) {
				continue;
			}
			side = post.parentSide;
			argItem = buildPostItem({
				post,
				meta: postMeta.get(commentId),
				marketById,
				ordinalById,
				heldByMarket: perItemHeld,
				removedSet,
			});
		} else {
			const reply = replySubstrateById.get(commentId);
			if (reply === undefined) {
				continue;
			}
			side = reply.side;
			argItem = buildReplyItem({
				reply,
				meta: replyMeta.get(commentId),
				marketById,
				ordinalById,
				topLevelBodyById,
				heldByMarket: perItemHeld,
				removedSet,
			});
		}

		if (argItem.removed) {
			// Removed stub — author ONLY (§4.4); no staked/current (compile-enforced).
			items.push({ ...argItem, authorPseudonym });
			continue;
		}

		const figures = computeBookmarkFigures({
			side,
			held,
			buys: buysByAuthorMarket.get(amKey(authorId, marketId)) ?? [],
			sells: sellsByAuthorMarket.get(amKey(authorId, marketId)) ?? [],
			reserves: reservesByMarket.get(marketId),
			settledNet: settledNetByAuthorMarket.get(amKey(authorId, marketId)),
		});
		items.push({
			...argItem,
			authorPseudonym,
			staked: figures.staked,
			current: figures.current,
		});
	}

	return items;
}

/** Composite (author, market) map key. */
function amKey(authorId: string, marketId: string): string {
	return `${authorId}:${marketId}`;
}
