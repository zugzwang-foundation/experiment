import "server-only";

import { computeSell } from "@/server/cpmm/calculate";
import { type CpmmDecimal, toFixed18 } from "@/server/cpmm/decimal";

// UI-A6 §4.3 + §4.5 (FI-2 cross-surface figure identity). The Đa/Đb + marker
// rule for ONE bookmarked comment, keyed to its AUTHOR A on (market M, frozen
// side S). This is the substance's correctness core: for a held-S item the
// figures MUST be byte-identical to A's own Profile positions figures (SPEC.1
// §23 FI-2 — one holding, one value, across surfaces).
//
// The identity is achieved by SAME-SOURCE derivation (§4.5a). Until LOTS-1 that
// meant re-deriving Đa here from the author's buys and sells through a
// byte-for-byte MIRROR of `positions.ts::walkMarket` (web ruled diff-and-test
// over extraction — plan §4.5 note), with a test locking the two together.
//
// LOTS-1 / ADR-0039 D-4 removes the mirror rather than maintaining it. Đa is now
// Σ `lots.surviving_basis` — a stored column, read by `loadLotBasis` for the
// AUTHOR (never the viewer) — so both surfaces read ONE number from ONE place
// instead of computing the same number twice and testing that they agree. Two
// implementations that must match is a thing to keep true; one source is not.
//
// The `list.test.ts::bookmark-figures-match-author-profile` identity test still
// locks the pair, and now passes for a structural reason rather than an
// arithmetic coincidence.

/** A's current position in M (quantity > 0), or undefined if exited. */
export type BookmarkHeld = { side: "YES" | "NO"; quantity: string } | undefined;

export type BookmarkFigures = {
	/** Đa — Σ surviving lot basis (ADR-0039 D-4); 0 unless held on S. */
	staked: string;
	/** Đb — settled net Σ payout, else `computeSell` proceeds; 0 unless held on S. */
	current: string;
};

const CANONICAL_ZERO = "0.000000000000000000";

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
	/**
	 * Đa for (A, M) — Σ `lots.surviving_basis`, read by `loadLotBasis` for the
	 * AUTHOR A. Canonical zero when A holds nothing. Passed in rather than read
	 * here so this stays pure and the list read batches ONE query for the whole
	 * page (LOTS-1 / ADR-0039 D-4).
	 */
	lotBasis: string;
	/** M's live pool reserves (Q6) — the open-holding Đb basis. */
	reserves: { yes: string; no: string } | undefined;
	/** Σ payout_events.amount for (A, M) (Q8); undefined ⇒ no settlement (open). */
	settledNet: InstanceType<typeof CpmmDecimal> | undefined;
}): BookmarkFigures {
	const { side, held, lotBasis, reserves, settledNet } = args;

	// Đa/Đb only when A holds a position on the card's frozen side S.
	if (held === undefined || held.side !== side) {
		return { staked: CANONICAL_ZERO, current: CANONICAL_ZERO };
	}

	// Đa — Σ surviving lot basis for A in M (ADR-0039 D-4).
	const staked = lotBasis;

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
