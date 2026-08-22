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
import {
	loadLotBasis,
	loadLotDecomposition,
	lotBasisOf,
} from "@/server/lots/basis";
import type { MarketStatus } from "@/server/markets/transitions";

import {
	type BuyTrade,
	computeEpisodes,
	mergeTradeStream,
	type SellTrade,
} from "./episodes";

/** A bound read client — top-level `db` OR a caller's transaction. */
type ProfileReader = DbClient | DbTransaction;

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

/**
 * ONE ARGUMENT'S SHARE of a holding — a `lots` row, rendered (LOTS-1 /
 * ADR-0039). The row's `staked` is the Σ of `survivingBasis` over these; the
 * row's `quantity` is the Σ of `survivingShares`. That is R2, and it is what
 * makes this a decomposition rather than a second opinion.
 *
 * The `argument` field reuses the SAME masked union as the row's own cell, so a
 * removed argument collapses to the variant carrying no title — a leak is a
 * compile error, not a review item (SC-1).
 */
export type ProfilePositionLot = {
	lotId: string;
	/** The bet this lot IS — R1's 1:1. */
	betId: string;
	/**
	 * The ARGUMENT's OWN side (`lots.side`, immutable at mint) — NOT the row's
	 * `positions.side`, which is Bucket C and moves when a participant exits one
	 * pole and re-enters the other. The two agree on every surviving lot by
	 * construction and diverge only on fully-sold ones; see `lots/basis.ts`'s
	 * `LotDecompositionRow.side` for why that is the set where it matters.
	 */
	side: "YES" | "NO";
	/** Đ staked on this argument at post time. Frozen forever (`bets.stake`). */
	originalBasis: string;
	/** Đ still staked here — the summand of Đa. Falls when this lot sells down. */
	survivingBasis: string;
	/** Shares still held from this argument — the summand of `quantity`. */
	survivingShares: string;
	/**
	 * R6/R10 — `Sold`, per ARGUMENT. True IFF nothing survives. A PARTIALLY-sold
	 * lot is false: it renders a reduced figure and NO tag, because a reduced
	 * number is the signal and a tag would overstate it.
	 */
	sold: boolean;
	/** When the argument was made — the decomposition's order. */
	placedAt: string;
	argument: ProfileArgumentCell;
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
	/**
	 * Đa — the holding's staked basis: **Σ `lots.surviving_basis` over its
	 * surviving lots** (LOTS-1 / ADR-0039 D-4, `lots/basis.ts` authority).
	 *
	 * Was the final SideEpisode's `stakedBasis` (`episodes.ts`) until LOTS-1.
	 * The two agree on the position-level sell path by construction and diverge
	 * once a PER-LOT sell targets lots of unequal price — which is the point of
	 * the feature, not a drift. `episodes.ts` still runs here, for the episode
	 * OPENER below; it is simply no longer the basis authority.
	 */
	staked: string;
	/**
	 * The single §10.8 current value — Đb `computeSell(quantity).proceeds`
	 * against the live pool for an open holding; the net Σ `payout_events.amount`
	 * for a settled holding (OQ-9 A). One holding, one value.
	 */
	current: string;
	argument: ProfileArgumentCell;
	/**
	 * The per-argument decomposition of `staked` (LOTS-1 / ADR-0039). Ordered by
	 * when each argument was made. Includes `Sold` lots: R9 makes Sold permanent,
	 * and an argument someone staked on and then exited is part of their record
	 * rather than an absence.
	 *
	 * ⚠ FI-2 is untouched by this field. `current` remains the single Đb for the
	 * holding; no lot carries a current value, because a per-lot Đb would be a
	 * second answer to "what is this worth now" and §23 forbids exactly that.
	 */
	lots: ProfilePositionLot[];
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
 * `positions` read (SPEC.1 §23). The row domain is **every market the user has
 * a position row in**: still held, or fully exited with at least one argument
 * attributed to it (POSREV-1 RF-13 — see the widening's own block below for why
 * it costs no query). A settlement never zeroes a held position (INV-4:
 * resolution's write path never touches `positions`), so a held-to-settlement
 * participation persists its row. Each row is one of two classes:
 *
 *   - **Open holding** (settled=false): the market has NO `payout_events`
 *     settlement for this user. `current` = Đb (`computeSell` against the live
 *     pool, the single FI-2 basis §10.8).
 *   - **Closed history** (settled=true, OQ-9 A): the market carries ≥1
 *     `payout_events` row for this user (held-to-settlement). `current` = the
 *     net Σ of those payout amounts (`bet_payout` + `void_refund` + correction
 *     pairs netted). `statusLabel` = Closed by market state.
 *
 * ⚠⚠ **A fully-exited market NOW YIELDS A ROW, and this paragraph used to say
 * the opposite.** It read: "a fully-exited market — position at zero — yields NO
 * row whether it is still Open OR later settled … its record lives in the
 * argument list + graph" (OQ-3 A). That ruling is SUPERSEDED by POSREV-1 RF-13,
 * and the reason it stood is worth keeping: there was genuinely nothing to
 * *value* — no surviving shares, and `settle.ts` writes a zero-amount payout row
 * per bet. What changed is that the row is no longer asked to carry a value. It
 * carries the ARGUMENTS, each with what was staked behind it, and an exited
 * holding has exactly as many of those as a held one. Its `current` is a
 * canonical zero and is never rendered as a live figure. ⛔ The graph half of
 * that sentence is doubly stale — UNWIRE-1 deleted the graph (ADR-0040).
 *
 * Per holding: `staked` = Đa, which since LOTS-1 is **Σ `lots.surviving_basis`**
 * (`lots/basis.ts`, ADR-0039 D-4) and no longer the episode walk's
 * `stakedBasis` — so a fully-exited holding's Đa is canonical zero for free,
 * because `loadLotBasis` sums only surviving lots. The `argument` cell is still
 * the current episode's opening comment (N-1a), which is the one thing the walk
 * is kept here for. Read-only; no write, no store (§23).
 */
export async function loadProfilePositions(
	client: ProfileReader,
	args: { userId: string },
): Promise<ProfilePositionRow[]> {
	const { userId } = args;

	// ⚠⚠ POSREV-1 RF-13 — THE ROW DOMAIN IS EVERY POSITION ROW, HELD OR EXITED.
	//
	// It used to be `quantity > 0`, and that predicate was a JS `if` over a SELECT
	// that had already fetched every row — which is why widening it costs nothing.
	// It cost something else, though: a participant who fully exited a market had
	// NO row, so an "arguments you no longer hold" view had nothing to render and
	// would have been permanently empty. Their record lived only in the argument
	// list, where it is not attached to what they staked on it.
	//
	// ⛔ THE WIDENING ADDS NO ROUND TRIP, AND THAT IS THE CONSTRAINT IT WAS
	// DESIGNED AROUND. Every read below is one batched `inArray(marketIdList)`;
	// admitting exited markets lengthens the `IN (…)` lists and issues no further
	// statement. Pinned, not asserted:
	// `tests/integration/profile-statement-count.integration.test.ts` counts SQL
	// at the DRIVER at M=1 and M=8 and requires the two to be equal.
	//
	// ⚠ A ZERO-QUANTITY ROW WITH NO LOTS IS DROPPED at the assembly loop below —
	// a position that holds nothing and attributes nothing is not a record of
	// anything. A HELD row with no lots is KEPT, deliberately: that is the
	// lots↔positions drift `planLotSale` refuses to let an attribution layer veto
	// (`lots/persist.ts:204-218`), and hiding a position someone still holds — and
	// can still sell — would be the profile committing the same error.
	const positionRows = await client
		.select({
			marketId: positions.marketId,
			side: positions.side,
			quantity: positions.quantity,
		})
		.from(positions)
		.where(eq(positions.userId, userId));
	const positionByMarket = new Map<
		string,
		{ side: "YES" | "NO"; quantity: string }
	>();
	for (const p of positionRows) {
		positionByMarket.set(p.marketId, { side: p.side, quantity: p.quantity });
	}
	if (positionByMarket.size === 0) {
		return [];
	}
	const marketIdList = [...positionByMarket.keys()];

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

	// Đa — Σ surviving lot basis (LOTS-1 / ADR-0039 D-4). The `episodes.ts` walk
	// is NO LONGER the basis authority; it keeps only the job below, which lots
	// cannot do (the episode OPENER).
	const lotBasis = await loadLotBasis(client, {
		userIds: [userId],
		marketIds: marketIdList,
	});

	// Walk each relevant market's episodes ONCE; the current episode's opener is
	// the N-1a argument-cell substrate + the masking candidate. This is the walk's
	// remaining job here — `openingTradeId` is a fact about WHICH BET opened the
	// current holding, and no per-lot column carries it.
	const openerByMarket = new Map<string, string>();
	for (const marketId of marketIdList) {
		const walk = walkMarket(
			betsByMarket.get(marketId) ?? [],
			sellsByMarket.get(marketId) ?? [],
		);
		const finalEpisode = walk.episodes.at(-1);
		if (finalEpisode) {
			openerByMarket.set(
				marketId,
				openerCommentOf(finalEpisode, betsByMarket.get(marketId)),
			);
		}
	}

	// The per-argument decomposition (LOTS-1 / ADR-0039). Every lot, Sold ones
	// included — R9 makes Sold permanent and R6 gives it a tag.
	const lotsByMarket = await loadLotDecomposition(client, {
		userId,
		marketIds: marketIdList,
	});
	const commentIdByBetId = new Map(
		userBets.map((b) => [b.id, b.commentId] as const),
	);

	// Masking input — content_removed over the opener + parent comments, AND
	// every lot's own argument + ITS parent.
	//
	// ⚠ SC-1 (CLAUDE.md §5.14): masking is a property of every BODY READ, not of
	// rows. The decomposition renders a title per lot, which is a second body
	// read on this surface — so its comments must join the SAME predicate before
	// a title can reach a DTO. They are routed through `buildArgumentCell`, whose
	// removed variant carries no title field at all, so a leak is a compile error
	// rather than a review item.
	const maskingCandidates = new Set<string>(openerByMarket.values());
	for (const openerId of openerByMarket.values()) {
		const parent = commentById.get(openerId)?.parentCommentId;
		if (parent) {
			maskingCandidates.add(parent);
		}
	}
	for (const lotRows of lotsByMarket.values()) {
		for (const lot of lotRows) {
			const commentId = commentIdByBetId.get(lot.betId);
			if (commentId === undefined) {
				continue;
			}
			maskingCandidates.add(commentId);
			const parent = commentById.get(commentId)?.parentCommentId;
			if (parent) {
				maskingCandidates.add(parent);
			}
		}
	}
	const removedSet = await loadRemovedSet(client, [...maskingCandidates]);

	const rows: ProfilePositionRow[] = [];
	for (const marketId of marketIdList) {
		const market = marketById.get(marketId);
		// `position` is defined for every marketId (the domain IS positionByMarket);
		// a missing market row is structurally impossible (the position FK).
		const position = positionByMarket.get(marketId);
		if (market === undefined || position === undefined) {
			continue;
		}
		const marketLots = lotsByMarket.get(marketId) ?? [];
		const held = new CpmmDecimal(position.quantity).greaterThan(0);
		// RF-13's floor: nothing held AND nothing attributed is not a record.
		if (!held && marketLots.length === 0) {
			continue;
		}
		const staked = lotBasisOf(lotBasis, userId, marketId);

		const settled = settledNet.has(marketId);
		// ⛔⛔ `computeSell` REFUSES A ZERO SHARE COUNT — `cpmm/calculate.ts:126`
		// runs `requirePositive(shares, "shares")`, which throws `CpmmInputError`
		// on anything not strictly > 0. Before RF-13 the `quantity > 0` domain
		// made that unreachable here; widening the domain walks straight onto it,
		// and the failure is a THROWN PAGE LOAD for anyone with a fully-exited
		// market — not a wrong number, a 500.
		// ⇒ The guard is also the honest answer rather than a workaround: a
		// holding with no shares is worth exactly zero, and there is no curve to
		// evaluate. `toFixed18(0)` rather than a new literal, so the canonical
		// 18-dp form comes from the same formatter every other figure here uses.
		const current = settled
			? toFixed18(settledNet.get(marketId) ?? new CpmmDecimal(0))
			: held
				? computeSell({
						reserves: reservesOf(poolByMarket.get(marketId)),
						side: position.side === "YES" ? "yes" : "no",
						shares: position.quantity,
					}).proceeds
				: toFixed18(new CpmmDecimal(0));

		const openerId = openerByMarket.get(marketId) ?? null;

		rows.push({
			marketId,
			marketSlug: market.slug,
			marketTitle: market.title,
			marketStatus: market.status,
			statusLabel: market.status === "Open" ? "Open" : "Closed",
			settled,
			side: position.side,
			quantity: position.quantity,
			staked,
			current,
			argument: buildArgumentCell({
				openerId,
				marketSlug: market.slug,
				commentById,
				ordinalById,
				removedSet,
			}),
			lots: marketLots.map((lot) => ({
				lotId: lot.lotId,
				betId: lot.betId,
				side: lot.side,
				originalBasis: lot.originalBasis,
				survivingBasis: lot.survivingBasis,
				survivingShares: lot.survivingShares,
				// R6/R10 — Sold is exactly zero surviving, never "nearly".
				sold: !new CpmmDecimal(lot.survivingShares).greaterThan(0),
				placedAt: lot.createdAt.toISOString(),
				argument: buildArgumentCell({
					openerId: commentIdByBetId.get(lot.betId) ?? null,
					marketSlug: market.slug,
					commentById,
					ordinalById,
					removedSet,
				}),
			})),
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
