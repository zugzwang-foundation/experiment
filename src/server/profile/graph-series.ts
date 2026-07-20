import "server-only";

import { and, asc, eq, inArray } from "drizzle-orm";

import type { DbClient, DbTransaction } from "@/db";
import { bets, comments, dharmaLedger, events, markets } from "@/db/schema";
import {
	PROFILE_GRAPH_Y_MAX,
	PROFILE_SERIES_MAX_POINTS,
} from "@/server/config/limits";
import { computeSell, type Reserves } from "@/server/cpmm/calculate";
import { CpmmDecimal, toFixed18 } from "@/server/cpmm/decimal";
import {
	type ReservePoint,
	replayReserveSeries,
} from "@/server/discovery/price-series";
import { eventPayloadSchemas } from "@/server/events/schemas";

import {
	type BuyTrade,
	computeEpisodes,
	type EpisodeWalk,
	mergeTradeStream,
	type SellTrade,
} from "./episodes";

/** A bound read client — top-level `db` OR a caller's transaction. */
type ProfileReader = DbClient | DbTransaction;

/** The experiment window (SPEC.1 §23 / §12.1 conclusion freeze). */
const WINDOW_START = "2026-09-15T00:00:00.000Z";
const WINDOW_END = "2026-11-05T23:59:00.000Z";
const WINDOW_START_MS = Date.parse(WINDOW_START);
const WINDOW_END_MS = Date.parse(WINDOW_END);
const CANONICAL_ZERO = "0.000000000000000000";

/** One plotted sample — an ISO instant + an 18-dp Đ value. */
export type GraphSample = { at: string; value: string };

/** One SideEpisode's held-side value line (Đb basis). A full sell-out ENDS
 * the segment (a hard gap); re-entry opens a fresh segment. */
export type PerMarketValueSegment = {
	marketId: string;
	marketSlug: string;
	episodeIndex: number;
	side: "YES" | "NO";
	/** ≥2 points; ONE episode, no internal break; value = Đb at each instant. */
	points: GraphSample[];
	/** ISO at the full sell-out that ends this segment; null = held to window end. */
	exitedAt: string | null;
};

/** The profile user's own post / reply node — rendered in the expanded views. */
export type GraphNode = {
	id: string;
	kind: "post" | "reply";
	marketId: string;
	side: "YES" | "NO";
	at: string;
	/** Cumulative-view node-y: net worth at post time. */
	netWorthValue: string;
	/** Per-market-view node-y: that market's position value at post time. */
	marketValue: string;
};

export type ProfileGraphSeries = {
	windowStart: string;
	windowEnd: string;
	yMax: number;
	/** CUMULATIVE — the pure `dharma_ledger` replay (`balance_after`, seq order). */
	freeDharma: GraphSample[];
	/** CUMULATIVE — free(t) + Σ Đb(t); the last point = wallet + Σ current Đb. */
	netWorth: GraphSample[];
	perMarket: PerMarketValueSegment[];
	nodes: GraphNode[];
};

/** The reserves in effect AT `tMs` — the last walk step with `at <= t`. */
function reservesAt(walk: ReservePoint[], tMs: number): Reserves | null {
	let cur: ReservePoint | undefined;
	for (const step of walk) {
		if (step.at.getTime() <= tMs) {
			cur = step;
		} else {
			break;
		}
	}
	return cur?.reserves ?? null;
}

/** The reserves in effect STRICTLY BEFORE `tMs` — the pre-event state (used at
 * a closed episode's exit instant, where the sell's own step is at `tMs`). */
function reservesBefore(walk: ReservePoint[], tMs: number): Reserves | null {
	let cur: ReservePoint | undefined;
	for (const step of walk) {
		if (step.at.getTime() < tMs) {
			cur = step;
		} else {
			break;
		}
	}
	return cur?.reserves ?? null;
}

type MarketGraph = {
	marketId: string;
	marketSlug: string;
	walk: ReservePoint[];
	episodeWalk: EpisodeWalk;
	segments: PerMarketValueSegment[];
};

/** The user's held share quantity at `tMs` across a market's whole trade
 * stream (all episodes) — the latest step's `quantityAfter`, `null` if none. */
function heldStepAt(
	episodeWalk: EpisodeWalk,
	tMs: number,
): { quantity: string; side: "YES" | "NO" } | null {
	let cur: EpisodeWalk["steps"][number] | undefined;
	for (const s of episodeWalk.steps) {
		if (s.trade.at.getTime() <= tMs) {
			cur = s;
		} else {
			break;
		}
	}
	if (cur === undefined) {
		return null;
	}
	return { quantity: cur.quantityAfter, side: cur.trade.side };
}

/** Đb of a market position at `tMs` (0 when holding nothing) — the §10.8 basis. */
function positionValueAt(mg: MarketGraph, tMs: number): string {
	const held = heldStepAt(mg.episodeWalk, tMs);
	if (held === null || new CpmmDecimal(held.quantity).lessThanOrEqualTo(0)) {
		return CANONICAL_ZERO;
	}
	const reserves = reservesAt(mg.walk, tMs);
	if (reserves === null) {
		return CANONICAL_ZERO;
	}
	return computeSell({
		reserves,
		side: held.side === "YES" ? "yes" : "no",
		shares: held.quantity,
	}).proceeds;
}

/** Build the per-episode value segments (the SideEpisode gap law + Đb basis +
 * true `shares(t)` across mid-episode buys). */
function buildSegments(
	marketId: string,
	marketSlug: string,
	walk: ReservePoint[],
	episodeWalk: EpisodeWalk,
): PerMarketValueSegment[] {
	const segments: PerMarketValueSegment[] = [];

	episodeWalk.episodes.forEach((episode, episodeIndex) => {
		const sideLower = episode.side === "YES" ? "yes" : "no";
		const openedAtMs = episode.openedAt.getTime();
		const closed = episode.closedAt !== null;
		const closedAtMs = episode.closedAt?.getTime() ?? null;
		const endBoundMs = closedAtMs ?? WINDOW_END_MS;

		// The episode's own HELD trade steps (quantity > 0) — buys + partial
		// sells; the closing full-exit (quantity 0) is excluded (nothing to value).
		const heldSteps = episodeWalk.steps.filter(
			(s) =>
				s.episodeIndex === episodeIndex &&
				new CpmmDecimal(s.quantityAfter).greaterThan(0),
		);
		if (heldSteps.length === 0) {
			return;
		}

		// `shares(t)` within the episode — the latest held step's quantity.
		const sharesInEpisodeAt = (tMs: number): string => {
			let cur: string | null = null;
			for (const s of heldSteps) {
				if (s.trade.at.getTime() <= tMs) {
					cur = s.quantityAfter;
				}
			}
			return cur ?? heldSteps[0].quantityAfter;
		};

		// Sample instants: every own held trade + every reserve step strictly
		// inside the held interval (foreign price moves while holding). For a
		// CLOSED episode, drop any held trade AT/after the exit instant — the
		// endpoint below owns that instant with the honest pre-exit value (the
		// degenerate same-ms open+close case; a sub-ms edge unreachable over real
		// data, where each bet is a distinct request µs+ apart).
		const times = new Set<number>();
		for (const s of heldSteps) {
			const ms = s.trade.at.getTime();
			if (!closed || ms < endBoundMs) {
				times.add(ms);
			}
		}
		for (const step of walk) {
			const ms = step.at.getTime();
			if (ms > openedAtMs && ms < endBoundMs) {
				times.add(ms);
			}
		}

		const points: GraphSample[] = [];
		for (const tMs of [...times].sort((a, b) => a - b)) {
			const reserves = reservesAt(walk, tMs);
			if (reserves === null) {
				continue;
			}
			points.push({
				at: new Date(tMs).toISOString(),
				value: computeSell({
					reserves,
					side: sideLower,
					shares: sharesInEpisodeAt(tMs),
				}).proceeds,
			});
		}

		// The endpoint: held-to-window-end (normal Đb at the final reserves) OR
		// the exit instant — where the line STOPS at the pre-exit value (the
		// closing sell's own reserve step is AT closedAt, and shares → 0 there,
		// so use the reserves + shares in effect just before the sell).
		const finalReserves = closed
			? reservesBefore(walk, endBoundMs)
			: reservesAt(walk, endBoundMs);
		if (finalReserves !== null) {
			points.push({
				at: new Date(endBoundMs).toISOString(),
				value: computeSell({
					reserves: finalReserves,
					side: sideLower,
					shares: sharesInEpisodeAt(endBoundMs),
				}).proceeds,
			});
		}

		// Dedupe by instant (a trade at the endpoint could collide), keep order.
		const seen = new Set<string>();
		const deduped: GraphSample[] = [];
		for (const p of points) {
			if (!seen.has(p.at)) {
				seen.add(p.at);
				deduped.push(p);
			}
		}

		segments.push({
			marketId,
			marketSlug,
			episodeIndex,
			side: episode.side,
			points: downsample(deduped, PROFILE_SERIES_MAX_POINTS),
			exitedAt: episode.closedAt?.toISOString() ?? null,
		});
	});

	return segments;
}

/**
 * Derive the §23 Dharma-graph series for a profile user — a read-time replay,
 * no stored series (the §22 posture extends). The free-Dharma line is the pure
 * `dharma_ledger` replay; the net-worth line is `free(t) + Σ Đb(t)` on the
 * single §10.8 basis; per-market value lines are `computeSell(reserves(t),
 * side, shares(t)).proceeds` with true `shares(t)` across mid-episode buys and
 * the SideEpisode gap law; reserves(t) rides the shared §22 `replayReserveSeries`
 * (OQ-2 B). Every served line is downsampled to `PROFILE_SERIES_MAX_POINTS`.
 * Cost is bounded by the user's touched markets (§7 S2). Read-only.
 */
export async function loadProfileGraphSeries(
	client: ProfileReader,
	args: { userId: string },
): Promise<ProfileGraphSeries> {
	const { userId } = args;

	// Free-Dharma line — the pure ledger replay (balance_after, seq order).
	const ledgerRows = await client
		.select({
			balanceAfter: dharmaLedger.balanceAfter,
			createdAt: dharmaLedger.createdAt,
		})
		.from(dharmaLedger)
		.where(eq(dharmaLedger.userId, userId))
		.orderBy(asc(dharmaLedger.seq));
	const freeDharmaFull: GraphSample[] = ledgerRows.map((r) => ({
		at: r.createdAt.toISOString(),
		value: toFixed18(new CpmmDecimal(r.balanceAfter)),
	}));

	// The user's buys → the markets the graph spans (episodes derive from these).
	const userBets = await client
		.select({
			id: bets.id,
			marketId: bets.marketId,
			side: bets.side,
			stake: bets.stake,
			shareQuantity: bets.shareQuantity,
			createdAt: bets.createdAt,
		})
		.from(bets)
		.where(eq(bets.userId, userId));

	// Sorted for a deterministic `perMarket` / net-worth-grid order across renders
	// (the math is order-independent; this stabilizes the DTO payload).
	const marketIds = [...new Set(userBets.map((b) => b.marketId))].sort();
	const marketGraphs: MarketGraph[] = [];

	if (marketIds.length > 0) {
		const marketRows = await client
			.select({ id: markets.id, slug: markets.slug })
			.from(markets)
			.where(inArray(markets.id, marketIds));
		const slugById = new Map(marketRows.map((m) => [m.id, m.slug]));

		const betsByMarket = new Map<string, BuyTrade[]>();
		for (const b of userBets) {
			const list = betsByMarket.get(b.marketId) ?? [];
			list.push({
				source: "buy",
				id: b.id,
				at: b.createdAt,
				side: b.side,
				stake: b.stake,
				shares: b.shareQuantity,
			});
			betsByMarket.set(b.marketId, list);
		}

		// The user's sells ride the MARKET aggregate (`bet.sold`; no bets row) —
		// `payload.userId` filtered app-side (recon §8).
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

		for (const marketId of marketIds) {
			const walk = await replayReserveSeries(client, marketId);
			const episodeWalk = computeEpisodes(
				mergeTradeStream(
					betsByMarket.get(marketId) ?? [],
					sellsByMarket.get(marketId) ?? [],
				),
			);
			const marketSlug = slugById.get(marketId) ?? "";
			marketGraphs.push({
				marketId,
				marketSlug,
				walk,
				episodeWalk,
				segments: buildSegments(marketId, marketSlug, walk, episodeWalk),
			});
		}
	}

	// Net-worth line — free(t) + Σ Đb(t) over an event-union grid.
	const freeDharmaAt = (tMs: number): string => {
		let cur = CANONICAL_ZERO;
		for (const s of freeDharmaFull) {
			if (Date.parse(s.at) <= tMs) {
				cur = s.value;
			} else {
				break;
			}
		}
		return cur;
	};
	const gridTimes = new Set<number>([WINDOW_START_MS, WINDOW_END_MS]);
	for (const s of freeDharmaFull) {
		const ms = Date.parse(s.at);
		if (ms >= WINDOW_START_MS && ms <= WINDOW_END_MS) {
			gridTimes.add(ms);
		}
	}
	for (const mg of marketGraphs) {
		for (const step of mg.walk) {
			const ms = step.at.getTime();
			if (ms >= WINDOW_START_MS && ms <= WINDOW_END_MS) {
				gridTimes.add(ms);
			}
		}
		for (const s of mg.episodeWalk.steps) {
			const ms = s.trade.at.getTime();
			if (ms >= WINDOW_START_MS && ms <= WINDOW_END_MS) {
				gridTimes.add(ms);
			}
		}
	}
	const netWorthFull: GraphSample[] = [...gridTimes]
		.sort((a, b) => a - b)
		.map((tMs) => {
			let total = new CpmmDecimal(freeDharmaAt(tMs));
			for (const mg of marketGraphs) {
				total = total.plus(positionValueAt(mg, tMs));
			}
			return { at: new Date(tMs).toISOString(), value: toFixed18(total) };
		});

	// Nodes — the user's own posts + replies (expanded-view only).
	const nodes: GraphNode[] =
		marketIds.length === 0
			? []
			: await buildNodes(client, userId, marketIds, marketGraphs, freeDharmaAt);

	return {
		windowStart: WINDOW_START,
		windowEnd: WINDOW_END,
		yMax: PROFILE_GRAPH_Y_MAX,
		freeDharma: downsample(freeDharmaFull, PROFILE_SERIES_MAX_POINTS),
		netWorth: downsample(netWorthFull, PROFILE_SERIES_MAX_POINTS),
		perMarket: marketGraphs.flatMap((mg) => mg.segments),
		nodes,
	};
}

async function buildNodes(
	client: ProfileReader,
	userId: string,
	marketIds: string[],
	marketGraphs: MarketGraph[],
	freeDharmaAt: (tMs: number) => string,
): Promise<GraphNode[]> {
	const commentRows = await client
		.select({
			id: comments.id,
			marketId: comments.marketId,
			parentCommentId: comments.parentCommentId,
			side: comments.sideAtPostTime,
			createdAt: comments.createdAt,
		})
		.from(comments)
		.where(
			and(eq(comments.userId, userId), inArray(comments.marketId, marketIds)),
		);
	const graphByMarket = new Map(marketGraphs.map((mg) => [mg.marketId, mg]));

	return commentRows.map((c): GraphNode => {
		const tMs = c.createdAt.getTime();
		const mg = graphByMarket.get(c.marketId);
		let netWorth = new CpmmDecimal(freeDharmaAt(tMs));
		for (const g of marketGraphs) {
			netWorth = netWorth.plus(positionValueAt(g, tMs));
		}
		return {
			id: c.id,
			kind: c.parentCommentId === null ? "post" : "reply",
			marketId: c.marketId,
			side: c.side,
			at: c.createdAt.toISOString(),
			netWorthValue: toFixed18(netWorth),
			marketValue: mg ? positionValueAt(mg, tMs) : CANONICAL_ZERO,
		};
	});
}

/** Uniform-stride thinning to ≤ `max` points — a strict SUBSET (never
 * interpolated), first + last always kept, order preserved (the
 * `discovery/price-series.ts` downsample, generalized). */
function downsample(series: GraphSample[], max: number): GraphSample[] {
	if (series.length <= max) {
		return series;
	}
	const n = series.length;
	const out: GraphSample[] = [];
	for (let i = 0; i < max; i++) {
		out.push(series[Math.round((i * (n - 1)) / (max - 1))]);
	}
	return out;
}
