import "server-only";

import { and, asc, eq, inArray } from "drizzle-orm";

import type { DbClient, DbTransaction } from "@/db";
import {
	bets,
	comments,
	events,
	markets,
	payoutEvents,
	pools,
	positions,
} from "@/db/schema";
import { computeSell } from "@/server/cpmm/calculate";
import { CpmmDecimal, toFixed18 } from "@/server/cpmm/decimal";
import {
	deriveTitleTeaser,
	loadRemovedSet,
} from "@/server/debate-view/load-debate-view";
import { eventPayloadSchemas } from "@/server/events/schemas";
import type { MarketStatus } from "@/server/markets/transitions";

import {
	type BuyTrade,
	computeEpisodes,
	mergeTradeStream,
	type SellTrade,
} from "./episodes";

/** A bound read client — top-level `db` OR a caller's transaction. */
type ProfileReader = DbClient | DbTransaction;

const CANONICAL_ZERO = "0.000000000000000000";

/**
 * The N-1a argument cell — the FINAL SideEpisode's OPENING argument (the
 * comment riding the episode-opening bet). A `content_removed` opener collapses
 * to the removed variant carrying NO title/body fields — a leak is a compile
 * error (the `load-debate-view` union-variant pattern).
 */
export type ProfileArgumentCell =
	| { removed: true; marketSlug: string }
	| {
			removed: false;
			commentId: string;
			/** `deriveTitleTeaser(body).title` — the debate-view derivation. */
			title: string;
			isReply: boolean;
			/** §9 deep-link ordinal: a post's own; a reply carries its PARENT's. */
			postOrdinal: number;
			marketSlug: string;
			/** Reply context line — the parent's title; null for posts and a removed parent (no leak). */
			repliedToTitle: string | null;
	  };

/** The market-state → §23 status classification: `Open` iff the market is Open. */
export type ProfileStatusLabel = "Open" | "Closed";

export type ProfilePositionRow = {
	marketId: string;
	marketSlug: string;
	marketTitle: string;
	marketStatus: MarketStatus;
	statusLabel: ProfileStatusLabel;
	/** true ⇒ a closed-history row (OQ-3 A: a `payout_events` settlement exists). */
	settled: boolean;
	side: "YES" | "NO";
	quantity: string;
	/** Đa — the current SideEpisode's staked basis (episodes.ts authority). */
	staked: string;
	/**
	 * The single §10.8 current value — Đb `computeSell(quantity).proceeds`
	 * against the live pool for an open holding; the net Σ `payout_events.amount`
	 * for a settled holding (OQ-9 A). One holding, one value.
	 */
	current: string;
	argument: ProfileArgumentCell;
};

type BetRow = {
	id: string;
	side: "YES" | "NO";
	stake: string;
	shareQuantity: string;
	commentId: string;
	createdAt: Date;
};

/** Build the merged per-(user, market) trade stream and walk its episodes. */
function walkMarket(
	betRows: BetRow[],
	sells: SellTrade[],
): ReturnType<typeof computeEpisodes> {
	const buys: BuyTrade[] = betRows.map((b) => ({
		source: "buy",
		id: b.id,
		at: b.createdAt,
		side: b.side,
		stake: b.stake,
		shares: b.shareQuantity,
	}));
	return computeEpisodes(mergeTradeStream(buys, sells));
}

/**
 * Load the profile user's cross-market positions — the first batched
 * `positions` read (SPEC.1 §23). The row domain is the markets where the user
 * still HOLDS a position (`quantity > 0`); a settlement never zeroes a held
 * position (INV-4: resolution's write path never touches `positions`), so a
 * held-to-settlement participation persists its row. Each held row is one of
 * two classes:
 *
 *   - **Open holding** (settled=false): the market has NO `payout_events`
 *     settlement for this user. `current` = Đb (`computeSell` against the live
 *     pool, the single FI-2 basis §10.8).
 *   - **Closed history** (settled=true, OQ-9 A): the market carries ≥1
 *     `payout_events` row for this user (held-to-settlement). `current` = the
 *     net Σ of those payout amounts (`bet_payout` + `void_refund` + correction
 *     pairs netted). `statusLabel` = Closed by market state.
 *
 * A **fully-exited** market — position at zero — yields NO row whether it is
 * still Open OR later settled (settle.ts writes a zero-amount payout row per
 * bet, but there is no surviving held position and nothing to value): OQ-3 A —
 * "an exited market carries no positions row; its record lives in the argument
 * list + graph." (Surfaced for Gate C: the closed-row domain is held-to-
 * settlement, not every payout.) Per holding: `staked` = the current episode's
 * Đa (episodes.ts), and the `argument` cell is that episode's opening comment
 * (N-1a). Read-only; no write, no store (§23).
 */
export async function loadProfilePositions(
	client: ProfileReader,
	args: { userId: string },
): Promise<ProfilePositionRow[]> {
	const { userId } = args;

	// The row domain: every market where the user still holds a position
	// (quantity > 0) — exited markets (Open or settled) carry no row (OQ-3 A).
	const positionRows = await client
		.select({
			marketId: positions.marketId,
			side: positions.side,
			quantity: positions.quantity,
		})
		.from(positions)
		.where(eq(positions.userId, userId));
	const heldByMarket = new Map<
		string,
		{ side: "YES" | "NO"; quantity: string }
	>();
	for (const p of positionRows) {
		if (new CpmmDecimal(p.quantity).greaterThan(0)) {
			heldByMarket.set(p.marketId, { side: p.side, quantity: p.quantity });
		}
	}
	if (heldByMarket.size === 0) {
		return [];
	}
	const marketIdList = [...heldByMarket.keys()];

	// Net Σ payout per (user, market) — the settled-row `current` (OQ-9 A); its
	// presence for a held market is the Open-vs-Closed settled discriminant.
	const payoutRows = await client
		.select({ marketId: payoutEvents.marketId, amount: payoutEvents.amount })
		.from(payoutEvents)
		.where(
			and(
				eq(payoutEvents.userId, userId),
				inArray(payoutEvents.marketId, marketIdList),
			),
		);
	const settledNet = new Map<string, InstanceType<typeof CpmmDecimal>>();
	for (const r of payoutRows) {
		const prior = settledNet.get(r.marketId) ?? new CpmmDecimal(0);
		settledNet.set(r.marketId, prior.plus(r.amount));
	}

	const marketRows = await client
		.select({
			id: markets.id,
			slug: markets.slug,
			title: markets.title,
			status: markets.status,
		})
		.from(markets)
		.where(inArray(markets.id, marketIdList));
	const marketById = new Map(marketRows.map((m) => [m.id, m]));

	const poolRows = await client
		.select({
			marketId: pools.marketId,
			yesReserves: pools.yesReserves,
			noReserves: pools.noReserves,
		})
		.from(pools)
		.where(inArray(pools.marketId, marketIdList));
	const poolByMarket = new Map(poolRows.map((p) => [p.marketId, p]));

	// The user's buys across the relevant markets (episode + opener substrate).
	const userBets = await client
		.select({
			id: bets.id,
			marketId: bets.marketId,
			side: bets.side,
			stake: bets.stake,
			shareQuantity: bets.shareQuantity,
			commentId: bets.commentId,
			createdAt: bets.createdAt,
		})
		.from(bets)
		.where(and(eq(bets.userId, userId), inArray(bets.marketId, marketIdList)));
	const betsByMarket = new Map<string, BetRow[]>();
	for (const b of userBets) {
		const list = betsByMarket.get(b.marketId) ?? [];
		list.push(b);
		betsByMarket.set(b.marketId, list);
	}

	// The user's sells ride the MARKET aggregate (`bet.sold`; no bets row) —
	// `payload.userId` filtered app-side (no payload index; bounded per market).
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
				inArray(events.aggregateId, marketIdList),
				eq(events.eventType, "bet.sold"),
			),
		);
	const sellsByMarket = new Map<string, SellTrade[]>();
	for (const ev of soldEvents) {
		const payload = eventPayloadSchemas["bet.sold"].parse(ev.payload);
		if (payload.userId !== userId) {
			continue;
		}
		const list = sellsByMarket.get(payload.marketId) ?? [];
		list.push({
			source: "sell",
			id: ev.eventId,
			at: ev.createdAt,
			side: payload.side,
			shares: payload.sharesSold,
		});
		sellsByMarket.set(payload.marketId, list);
	}

	// All comments in the relevant markets — the §9 ordinal domain (top-level,
	// removed INCLUDED) + the opener/parent body lookups.
	const marketComments = await client
		.select({
			id: comments.id,
			marketId: comments.marketId,
			parentCommentId: comments.parentCommentId,
			body: comments.body,
			createdAt: comments.createdAt,
		})
		.from(comments)
		.where(inArray(comments.marketId, marketIdList))
		.orderBy(asc(comments.createdAt), asc(comments.id));
	const commentById = new Map(marketComments.map((c) => [c.id, c]));
	// §9 ordinal: 1-based rank by (created_at, id) over TOP-LEVEL comments,
	// removed included — the array is already in that order.
	const ordinalById = new Map<string, number>();
	const ordinalCounter = new Map<string, number>();
	for (const c of marketComments) {
		if (c.parentCommentId === null) {
			const next = (ordinalCounter.get(c.marketId) ?? 0) + 1;
			ordinalCounter.set(c.marketId, next);
			ordinalById.set(c.id, next);
		}
	}

	// Walk each relevant market's episodes ONCE; the current episode's opener is
	// the N-1a argument-cell substrate + the masking candidate.
	const openerByMarket = new Map<string, string>();
	const stakedByMarket = new Map<string, string>();
	for (const marketId of marketIdList) {
		const walk = walkMarket(
			betsByMarket.get(marketId) ?? [],
			sellsByMarket.get(marketId) ?? [],
		);
		const finalEpisode = walk.episodes.at(-1);
		if (finalEpisode) {
			stakedByMarket.set(marketId, finalEpisode.stakedBasis);
			openerByMarket.set(
				marketId,
				openerCommentOf(finalEpisode, betsByMarket.get(marketId)),
			);
		}
	}

	// Masking input — content_removed over the opener + parent comments only
	// (the audited enforcement point, verbatim; ban never masks).
	const maskingCandidates = new Set<string>(openerByMarket.values());
	for (const openerId of openerByMarket.values()) {
		const parent = commentById.get(openerId)?.parentCommentId;
		if (parent) {
			maskingCandidates.add(parent);
		}
	}
	const removedSet = await loadRemovedSet(client, [...maskingCandidates]);

	const rows: ProfilePositionRow[] = [];
	for (const marketId of marketIdList) {
		const market = marketById.get(marketId);
		// `held` is defined for every marketId (the domain IS heldByMarket); a
		// missing market row is structurally impossible (the position FK).
		const held = heldByMarket.get(marketId);
		if (market === undefined || held === undefined) {
			continue;
		}
		const staked = stakedByMarket.get(marketId) ?? CANONICAL_ZERO;

		const settled = settledNet.has(marketId);
		const current = settled
			? toFixed18(settledNet.get(marketId) ?? new CpmmDecimal(0))
			: computeSell({
					reserves: reservesOf(poolByMarket.get(marketId)),
					side: held.side === "YES" ? "yes" : "no",
					shares: held.quantity,
				}).proceeds;

		const openerId = openerByMarket.get(marketId) ?? null;

		rows.push({
			marketId,
			marketSlug: market.slug,
			marketTitle: market.title,
			marketStatus: market.status,
			statusLabel: market.status === "Open" ? "Open" : "Closed",
			settled,
			side: held.side,
			quantity: held.quantity,
			staked,
			current,
			argument: buildArgumentCell({
				openerId,
				marketSlug: market.slug,
				commentById,
				ordinalById,
				removedSet,
			}),
		});
	}

	return rows;
}

/** The episode-opening BUY's `comment_id` (INV-1: every bet rides a comment). */
function openerCommentOf(
	episode: { openingTradeId: string },
	betRows: BetRow[] | undefined,
): string {
	const opener = betRows?.find((b) => b.id === episode.openingTradeId);
	if (opener === undefined) {
		// The opening trade is always a BUY drawn from betRows — unreachable.
		throw new Error(
			`loadProfilePositions: no bet for opening trade ${episode.openingTradeId}`,
		);
	}
	return opener.commentId;
}

type CommentRow = {
	id: string;
	marketId: string;
	parentCommentId: string | null;
	body: string;
	createdAt: Date;
};

function buildArgumentCell(args: {
	openerId: string | null;
	marketSlug: string;
	commentById: Map<string, CommentRow>;
	ordinalById: Map<string, number>;
	removedSet: Set<string>;
}): ProfileArgumentCell {
	const { openerId, marketSlug, commentById, ordinalById, removedSet } = args;
	const opener = openerId ? commentById.get(openerId) : undefined;
	if (openerId === null || opener === undefined || removedSet.has(openerId)) {
		return { removed: true, marketSlug };
	}
	const isReply = opener.parentCommentId !== null;
	const parent =
		opener.parentCommentId !== null
			? commentById.get(opener.parentCommentId)
			: undefined;
	// A reply carries its PARENT's ordinal; a post carries its own.
	const postOrdinal = isReply
		? parent
			? (ordinalById.get(parent.id) ?? 0)
			: 0
		: (ordinalById.get(opener.id) ?? 0);
	// The parent's title — null for a post and for a removed parent (no leak).
	const repliedToTitle =
		isReply && parent && !removedSet.has(parent.id)
			? deriveTitleTeaser(parent.body).title
			: null;
	return {
		removed: false,
		commentId: opener.id,
		title: deriveTitleTeaser(opener.body).title,
		isReply,
		postOrdinal,
		marketSlug,
		repliedToTitle,
	};
}

function reservesOf(
	pool: { yesReserves: string; noReserves: string } | undefined,
): { yes: string; no: string } {
	if (pool === undefined) {
		// A held position mints only inside the pool-locked W-1 tx — a missing
		// pool for a held market is structurally impossible (viewer-context.ts
		// parity).
		throw new Error("loadProfilePositions: held position with no pool row");
	}
	return { yes: pool.yesReserves, no: pool.noReserves };
}
