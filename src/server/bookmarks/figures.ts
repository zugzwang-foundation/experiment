import "server-only";

import { computeSell } from "@/server/cpmm/calculate";
import { type CpmmDecimal, toFixed18 } from "@/server/cpmm/decimal";
import {
	type BuyTrade,
	computeEpisodes,
	mergeTradeStream,
	type SellTrade,
} from "@/server/profile/episodes";

// UI-A6 §4.3 + §4.5 (FI-2 cross-surface figure identity). The Đa/Đb + marker
// rule for ONE bookmarked comment, keyed to its AUTHOR A on (market M, frozen
// side S). This is the substance's correctness core: for a held-S item the
// figures MUST be byte-identical to A's own Profile positions figures (SPEC.1
// §23 FI-2 — one holding, one value, across surfaces).
//
// The identity is achieved by SAME-SOURCE derivation (§4.5a): the `buys` and
// `sells` fed here are sourced EXACTLY as `loadProfilePositions` sources them
// (buys from `bets`; sells from `events` `bet.sold`, `payload.sharesSold` /
// `payload.side`), and `walkMarket` below MIRRORS `positions.ts::walkMarket`
// byte-for-byte (web ruled diff-and-test over extraction — plan §4.5 note). Do
// NOT invent a different sell-source. The `list.test.ts::bookmark-figures-
// match-author-profile` identity test locks this against `loadProfilePositions`.

/** The `bets`-row shape the walk consumes — mirrors `positions.ts` BetRow. */
export type BookmarkBetRow = {
	id: string;
	side: "YES" | "NO";
	stake: string;
	shareQuantity: string;
	createdAt: Date;
};

/** A's current position in M (quantity > 0), or undefined if exited. */
export type BookmarkHeld = { side: "YES" | "NO"; quantity: string } | undefined;

export type BookmarkFigures = {
	/** Đa — the current SideEpisode's staked basis; 0 unless held on S. */
	staked: string;
	/** Đb — settled net Σ payout, else `computeSell` proceeds; 0 unless held on S. */
	current: string;
};

const CANONICAL_ZERO = "0.000000000000000000";

/**
 * Build the merged per-(author, market) trade stream and walk its episodes.
 * The load-bearing logic mirrors `src/server/profile/positions.ts::walkMarket`
 * — the SAME BuyTrade mapping + the SAME `mergeTradeStream` (which owns the N-3
 * tie-break: `created_at` asc, cross-source tie = buy-before-sell) +
 * `computeEpisodes` (both shared exports from `episodes.ts`). The explicit
 * return annotation pins the parity against inference drift; the only signature
 * delta is the param row type (`BookmarkBetRow` vs `BetRow`), which the mapping
 * flattens away — so the walk output is identical for the same (A, M) trades.
 */
function walkMarket(
	betRows: BookmarkBetRow[],
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
 * The §4.3 five-case rule for Đa/Đb. Đa/Đb are computed IFF A holds a position
 * on side S; a holding on ¬S ("a different argument", §23) or a full exit
 * yields 0/0 — the S-anchored card shows the argument, not a phantom position.
 * Frozen-ness is automatic: a held-to-settlement position persists its row
 * (INV-4) → `settledNet` defined → Đb = net Σ payout; an exited one does not →
 * `held` undefined → 0/0. The MARKER (Exited / Flipped / none) is NOT computed
 * here — it is the builder's job (`buildPostItem`/`buildReplyItem` call
 * `computeMarker` over the SAME author-held-side), single-sourced there so there
 * is no second marker source to drift.
 */
export function computeBookmarkFigures(args: {
	/** S — the comment's frozen `side_at_post_time`. */
	side: "YES" | "NO";
	/** heldBy(A, M) — A's live position in M (quantity > 0), or undefined. */
	held: BookmarkHeld;
	/** A's buys in M (Q9) — same columns as `positions.ts` userBets. */
	buys: BookmarkBetRow[];
	/** A's `bet.sold` sells in M (Q10) — same source as `positions.ts` soldEvents. */
	sells: SellTrade[];
	/** M's live pool reserves (Q6) — the open-holding Đb basis. */
	reserves: { yes: string; no: string } | undefined;
	/** Σ payout_events.amount for (A, M) (Q8); undefined ⇒ no settlement (open). */
	settledNet: InstanceType<typeof CpmmDecimal> | undefined;
}): BookmarkFigures {
	const { side, held, buys, sells, reserves, settledNet } = args;

	// Đa/Đb only when A holds a position on the card's frozen side S.
	if (held === undefined || held.side !== side) {
		return { staked: CANONICAL_ZERO, current: CANONICAL_ZERO };
	}

	// Đa — the FINAL SideEpisode's staked basis (the current S episode).
	const walk = walkMarket(buys, sells);
	const finalEpisode = walk.episodes.at(-1);
	const staked = finalEpisode?.stakedBasis ?? CANONICAL_ZERO;

	// Đb — net Σ payout for a settled (held-to-settlement) holding; else the
	// live `computeSell` proceeds against the pool (open holding).
	const current =
		settledNet !== undefined
			? toFixed18(settledNet)
			: computeSell({
					reserves: reservesOf(reserves),
					side: side === "YES" ? "yes" : "no",
					shares: held.quantity,
				}).proceeds;

	return { staked, current };
}

function reservesOf(reserves: { yes: string; no: string } | undefined): {
	yes: string;
	no: string;
} {
	if (reserves === undefined) {
		// A held position mints only inside the pool-locked W-1 tx — a missing
		// pool for a held market is structurally impossible (positions.ts parity).
		throw new Error("computeBookmarkFigures: held position with no pool row");
	}
	return reserves;
}
