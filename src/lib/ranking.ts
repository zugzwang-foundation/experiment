import type Decimal from "decimal.js";

import { DEFAULT_RANKING_CONFIG, type RankingConfig } from "./ranking.config";
import { RankingDecimal } from "./ranking-decimal";

/**
 * The read-time debate-view ranking model (RANKING.md, ADR-0017). PURE: no IO,
 * no DB, no `server-only` — it receives the per-post aggregated substrate (the
 * four per-side signals + age + author stake) and returns the Top order + the
 * latest interleave, the per-post lane-dominance badge, the depth-1 reply order,
 * and the profile order. The SQL that produces the substrate lives at the query
 * layer (`src/server/debate-view/ranking-substrate.ts`); this file is importable
 * from the server, the tests, and `tsx` scripts alike.
 *
 * All Dharma / stake inputs are decimal STRINGS (NUMERIC(38,18)); all score
 * arithmetic runs through `RankingDecimal` (OD-2 / CLAUDE.md §2 / §10
 * reproducibility), never JS floats. Counts are integers.
 *
 * Constants (`kLane`, the floors, `floorSplit`, the interleave interval) are
 * INJECTED via `cfg` (defaulting to `DEFAULT_RANKING_CONFIG`) so the model is
 * tuning-independent — see `ranking.config.ts`.
 */

export type Side = "YES" | "NO";

/** The per-post substrate `ranking.ts` consumes (RANKING.md §2). */
export type PostSubstrate = {
	/** UUIDv7 — an earlier id is an earlier post (the final tiebreak, §3.4). */
	id: string;
	/** The post's own frozen side (`side_at_post_time`) — support/counter basis. */
	parentSide: Side;
	/** Reply-bets on the post's own side. */
	supportCount: number;
	/** Reply-bets on the opposing side. */
	counterCount: number;
	/** SUM of support-side reply-bet stakes — decimal string. */
	supportDharma: string;
	/** SUM of counter-side reply-bet stakes — decimal string. */
	counterDharma: string;
	/** `comments.created_at`. */
	createdAt: Date;
	/** The post's own entry-bet stake `a` (author conviction) — decimal string. */
	authorStake: string;
};

/** A depth-1 reply's substrate (RANKING.md §7). */
export type ReplySubstrate = {
	id: string;
	/** The reply's own frozen side; Support iff it equals the parent's side. */
	side: Side;
	/** The reply-bet's stake (`bets.stake`) — decimal string. */
	stake: string;
	createdAt: Date;
};

/** The three lane-dominance badges (RANKING.md §5.2). */
export type Badge = "Most Debated" | "Highest Stakes" | "Contested";

/** Replies partitioned + stake-sorted within side (RANKING.md §7). */
export type RankedReplies = {
	support: ReplySubstrate[];
	counter: ReplySubstrate[];
};

/** A profile-order entry — posts above replies, different rulers (§3.6). */
export type ProfileItem =
	| { kind: "post"; post: PostSubstrate }
	| { kind: "reply"; reply: ReplySubstrate };

// ── Derived per-post quantities (RANKING.md §2) ──────────────────────────────
// Computed ONCE per post (the `pow` for `nPowB` is the only non-trivial op), so
// the per-lane margins below are cheap field reads, not repeated exponentiation.

type Derived = {
	post: PostSubstrate;
	/** n = support_count + counter_count (VOLUME). */
	n: number;
	/** D = support_dharma + counter_dharma (VALUE). */
	D: Decimal;
	/** lop = 1 − b (DOMINANCE); null iff n = 0 (b undefined). */
	lop: Decimal | null;
	/** n^b (CONTESTATION); 0 iff n = 0 — the §6.1 guard (avoids 0^undefined). */
	nPowB: Decimal;
};

function derive(p: PostSubstrate): Derived {
	const n = p.supportCount + p.counterCount;
	const max = Math.max(p.supportCount, p.counterCount);
	// b = min/max ∈ [0,1]; undefined iff n = 0 (0/0). lop = 1 − b.
	const b =
		max === 0
			? null
			: new RankingDecimal(Math.min(p.supportCount, p.counterCount)).div(max);
	return {
		post: p,
		n,
		D: new RankingDecimal(p.supportDharma).plus(p.counterDharma),
		lop: b === null ? null : new RankingDecimal(1).minus(b),
		// §6.1: a zero-reply post has contestation 0 (NOT 0^undefined); a fully
		// one-sided post has b = 0 ⇒ n^0 = 1 (sunk near the bottom of the lane).
		nPowB:
			n === 0 ? new RankingDecimal(0) : new RankingDecimal(n).pow(b as Decimal),
	};
}

// ── Qualified margin: ratio-to-#2 over an absolute floor (RANKING.md §3.3) ────
// A lane margin is one of three rank CLASSES so the ordering
// `BELOW_FLOOR < any real ratio < SENTINEL_MAX` is total (§3.3): SENTINEL_MAX is
// "ranks above every finite ratio" (a sole floor-clearer), NOT a magic number.

const RANK_BELOW = 0 as const;
const RANK_REAL = 1 as const;
const RANK_SENTINEL = 2 as const;

type LaneMargin =
	| { rank: typeof RANK_BELOW; ratio: null }
	| { rank: typeof RANK_REAL; ratio: Decimal }
	| { rank: typeof RANK_SENTINEL; ratio: null };

const BELOW_FLOOR: LaneMargin = { rank: RANK_BELOW, ratio: null };
const SENTINEL_MAX: LaneMargin = { rank: RANK_SENTINEL, ratio: null };

/** >0 iff a ranks above b; total over the three rank classes (§3.3). */
function cmpMargin(a: LaneMargin, b: LaneMargin): number {
	if (a.rank !== b.rank) return a.rank - b.rank;
	if (a.rank === RANK_REAL && b.rank === RANK_REAL) return a.ratio.cmp(b.ratio);
	return 0; // both BELOW, or both SENTINEL — equal class
}

type Lane = {
	/** The lane value for a post; null = not applicable (e.g. lop when n = 0). */
	value: (d: Derived) => Decimal | null;
	/** Absolute floor (inclusive: `value >= floor` clears, §3.3). */
	floor: number;
	/** Optional admission gate (the split lane requires `n >= floorSplit`). */
	gate?: (d: Derived) => boolean;
};

function clears(d: Derived, lane: Lane): boolean {
	if (lane.gate && !lane.gate(d)) return false;
	const v = lane.value(d);
	return v?.gte(lane.floor) ?? false;
}

function qualifiedMargin(
	target: Derived,
	all: Derived[],
	lane: Lane,
): LaneMargin {
	if (!clears(target, lane)) return BELOW_FLOOR;
	// Values of every floor-clearer in this lane, highest first. The "second
	// place" (the runner-up to the lane leader) is the margin denominator — a
	// single value per lane, so the leader gets a ratio > 1 and everyone else
	// ≤ 1 (§3.3). A sole clearer has no second place → SENTINEL_MAX. The
	// `length < 2` test coincides with the spec's `v2 == 0` BECAUSE every
	// `floor_lane` is strictly > 0 (a clearer's value is therefore positive) —
	// the `isZero()` guard below pins that assumption if a future floor is 0.
	const values = all
		.filter((d) => clears(d, lane))
		.map((d) => lane.value(d) as Decimal)
		.sort((x, y) => y.cmp(x));
	if (values.length < 2) return SENTINEL_MAX;
	const second = values[1] as Decimal;
	if (second.isZero()) return SENTINEL_MAX; // defensive — floors are all > 0
	return {
		rank: RANK_REAL,
		ratio: (lane.value(target) as Decimal).div(second),
	};
}

function maxMargin(margins: LaneMargin[]): LaneMargin {
	return margins.reduce((best, m) => (cmpMargin(m, best) > 0 ? m : best));
}

// The Top-order lanes (§3.1): traction n, stake D, dominance-split lop (gated).
function topLanes(cfg: RankingConfig): Lane[] {
	return [
		{ value: (d) => new RankingDecimal(d.n), floor: cfg.floorLane.n },
		{ value: (d) => d.D, floor: cfg.floorLane.D },
		{
			value: (d) => d.lop,
			floor: cfg.floorLane.lop,
			gate: (d) => d.n >= cfg.floorSplit,
		},
	];
}

// The BADGE lanes (§5, OD-1(A)): traction n, stake D, contestation n^b. Shares
// traction + stake with Top; the third lane DIFFERS — Top ranks dominance
// (`lop`), the badge marks even-contestation (`n^b`) — by design.
const BADGE_NAMES: readonly Badge[] = [
	"Most Debated",
	"Highest Stakes",
	"Contested",
];
function badgeLanes(cfg: RankingConfig): Lane[] {
	return [
		{ value: (d) => new RankingDecimal(d.n), floor: cfg.floorLane.n },
		{ value: (d) => d.D, floor: cfg.floorLane.D },
		{ value: (d) => d.nPowB, floor: cfg.floorLane.nPowB },
	];
}

// ── Top order (§3) ───────────────────────────────────────────────────────────

function topScore(
	target: Derived,
	all: Derived[],
	cfg: RankingConfig,
): LaneMargin {
	return maxMargin(
		topLanes(cfg).map((lane) => qualifiedMargin(target, all, lane)),
	);
}

/**
 * The §3.4 tie chain, uniform across the whole model: higher author stake `a`
 * first, then earlier-wins (earlier `createdAt`, then lexicographically smaller
 * UUIDv7 id). >0 iff a ranks AFTER b.
 */
function tiebreak(a: PostSubstrate, b: PostSubstrate): number {
	const byStake = new RankingDecimal(b.authorStake).cmp(a.authorStake);
	if (byStake !== 0) return byStake;
	const byTime = a.createdAt.getTime() - b.createdAt.getTime();
	if (byTime !== 0) return byTime;
	return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/**
 * The Top RANKED SPINE — `Top_score` descending, ties per §3.4. No interleave
 * (that is `buildTopList`). Pure; input order is irrelevant.
 */
export function topOrder(
	posts: PostSubstrate[],
	cfg: RankingConfig = DEFAULT_RANKING_CONFIG,
): PostSubstrate[] {
	const derived = posts.map(derive);
	const scored = derived.map((d) => ({
		post: d.post,
		score: topScore(d, derived, cfg),
	}));
	scored.sort((a, b) => {
		const byScore = cmpMargin(b.score, a.score); // score descending
		return byScore !== 0 ? byScore : tiebreak(a.post, b.post);
	});
	return scored.map((s) => s.post);
}

/**
 * The market-detail post list: the Top ranked spine with the latest interleave
 * (§4). After every `latestInterleaveInterval` ranked posts, the next slot is
 * the newest (by `createdAt`) not-yet-shown post; ranking then resumes. Exactly
 * one injection per cadence point, no duplication, every post exactly once.
 */
export function buildTopList(
	posts: PostSubstrate[],
	cfg: RankingConfig = DEFAULT_RANKING_CONFIG,
): PostSubstrate[] {
	const ranked = topOrder(posts, cfg);
	const interval = cfg.latestInterleaveInterval;
	const shown: PostSubstrate[] = [];
	const shownIds = new Set<string>();
	let cursor = 0;
	while (shown.length < ranked.length) {
		// Emit the next `interval` not-yet-shown ranked posts.
		let emitted = 0;
		while (cursor < ranked.length && emitted < interval) {
			const p = ranked[cursor] as PostSubstrate;
			cursor++;
			if (!shownIds.has(p.id)) {
				shown.push(p);
				shownIds.add(p.id);
				emitted++;
			}
		}
		if (shown.length >= ranked.length) break;
		const unshown = ranked.filter((p) => !shownIds.has(p.id));
		if (unshown.length === 0) break;
		// The newest unshown post (tiebreak: later UUIDv7 id = newer).
		const latest = unshown.reduce((best, p) => {
			const byTime = p.createdAt.getTime() - best.createdAt.getTime();
			if (byTime > 0) return p;
			if (byTime === 0 && p.id > best.id) return p;
			return best;
		});
		shown.push(latest);
		shownIds.add(latest.id);
	}
	return shown;
}

// ── Lane-dominance badge (§5, OD-1(A)) ───────────────────────────────────────

/**
 * The single badge a post wears, or null. A post is badged iff it DOMINATES a
 * badge lane — its margin is `SENTINEL_MAX` (sole floor-clearer) or a real ratio
 * `>= kLane` — and the badge is its HIGHEST-margin dominating lane (§5.1). The
 * badge lanes are {traction n, stake D, contestation n^b} (OD-1(A)); they
 * diverge from the Top-order lanes on the balance axis by design.
 */
export function badgeFor(
	post: PostSubstrate,
	allPosts: PostSubstrate[],
	cfg: RankingConfig = DEFAULT_RANKING_CONFIG,
): Badge | null {
	const derived = allPosts.map(derive);
	// Key on id (not object identity) so a value-equal post drawn from a
	// re-mapped DTO still resolves to its member of `derived` and is evaluated
	// against the floor-clearer set (§5.1), not as a standalone fallback.
	const target = derived.find((d) => d.post.id === post.id) ?? derive(post);
	const lanes = badgeLanes(cfg);
	let best: { badge: Badge; margin: LaneMargin } | null = null;
	for (let i = 0; i < lanes.length; i++) {
		const margin = qualifiedMargin(target, derived, lanes[i] as Lane);
		const dominates =
			margin.rank === RANK_SENTINEL ||
			(margin.rank === RANK_REAL && margin.ratio.gte(cfg.kLane));
		if (!dominates) continue;
		// Highest margin wins; on a tie (e.g. co-sentinels) the earlier lane in
		// {Most Debated, Highest Stakes, Contested} wins — deterministic.
		if (best === null || cmpMargin(margin, best.margin) > 0) {
			best = { badge: BADGE_NAMES[i] as Badge, margin };
		}
	}
	return best === null ? null : best.badge;
}

// ── Reply ranking (depth = 1) — stake desc within side (RANKING.md §7) ───────

function compareReply(a: ReplySubstrate, b: ReplySubstrate): number {
	const byStake = new RankingDecimal(b.stake).cmp(a.stake); // stake descending
	if (byStake !== 0) return byStake;
	const byTime = a.createdAt.getTime() - b.createdAt.getTime(); // earlier-wins
	if (byTime !== 0) return byTime;
	return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/**
 * Partition replies into Support (reply side = parent side) and Counter pools,
 * each stake-descending with earlier-wins ties (§7). `_cfg` is accepted for a
 * uniform call shape but unused — a flat reply has no tunable lane.
 */
export function rankReplies(
	replies: ReplySubstrate[],
	parentSide: Side,
	_cfg: RankingConfig = DEFAULT_RANKING_CONFIG,
): RankedReplies {
	return {
		support: replies.filter((r) => r.side === parentSide).sort(compareReply),
		counter: replies.filter((r) => r.side !== parentSide).sort(compareReply),
	};
}

/**
 * The debate-view two-slot default (§7.1): the best Support + best Counter; if
 * one side is empty, the two best from the other; a single reply alone; zero ⇒
 * none. (The "show all" expansion renders each side's full `RankedReplies`.)
 */
export function twoSlot(ranked: RankedReplies): ReplySubstrate[] {
	const { support, counter } = ranked;
	if (support.length > 0 && counter.length > 0)
		return [support[0] as ReplySubstrate, counter[0] as ReplySubstrate];
	if (support.length > 0) return support.slice(0, 2);
	if (counter.length > 0) return counter.slice(0, 2);
	return [];
}

// ── Profile order (§3.6) — the simplest lens, no interleave ──────────────────

/**
 * One user's arguments (RANKING.md §3.6): posts by attracted value `D`
 * descending, then replies by their own stake descending, all posts above all
 * replies (different rulers — a post is ranked by what it attracted; a reply, a
 * leaf, only by its own stake). Viewer-independent (no viewer param); the latest
 * interleave does NOT apply (a profile is a body of work, not a live feed).
 */
export function profileOrder(
	posts: PostSubstrate[],
	replies: ReplySubstrate[],
): ProfileItem[] {
	const sortedPosts = [...posts].sort((a, b) => {
		const byD = new RankingDecimal(b.supportDharma)
			.plus(b.counterDharma)
			.cmp(new RankingDecimal(a.supportDharma).plus(a.counterDharma)); // D desc
		return byD !== 0 ? byD : tiebreak(a, b);
	});
	const sortedReplies = [...replies].sort(compareReply);
	return [
		...sortedPosts.map((post): ProfileItem => ({ kind: "post", post })),
		...sortedReplies.map((reply): ProfileItem => ({ kind: "reply", reply })),
	];
}
