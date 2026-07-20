import "server-only";

import { CpmmDecimal, halfEven18, toFixed18 } from "@/server/cpmm/decimal";
import { canonicalize } from "@/server/dharma/canonical";
import { DharmaInputError } from "@/server/dharma/errors";

/**
 * UI.A5 Slice 1 — the SideEpisode + Đa pure math (SPEC.1 1.0.18 §2
 * "SideEpisode" + §23 "The Đa staked basis"). One machinery, two consumers:
 * the positions-table Staked (Đa) figure and the graph's SideEpisode gap law
 * (plan §2 Slice 1). Pure — no IO, no clock, no randomness; all quantities are
 * NUMERIC(38,18) decimal strings, arithmetic via `CpmmDecimal` (precision 50),
 * internal values exact, quantized 18-dp at the boundary (the cpmm "quantize
 * the EXACT intermediates" doctrine). Never a JS float (CLAUDE.md §2).
 *
 * Đa is DISPLAY BASIS ONLY — R-9.8's position-level settlement attribution at
 * resolution/void is unchanged (§23 verbatim).
 */

export type EpisodeSide = "YES" | "NO";

/** A buy — one `bets` row (`stake`, `share_quantity`, `created_at`). */
export type BuyTrade = {
	source: "buy";
	/** `bets.id` (UUIDv7 — the within-source tiebreak). */
	id: string;
	at: Date;
	side: EpisodeSide;
	stake: string;
	shares: string;
};

/** A sell — one `bet.sold` event (`payload.sharesSold`; no `bets` row). */
export type SellTrade = {
	source: "sell";
	/** The `bet.sold` `event_id` (UUIDv7 — the within-source tiebreak). */
	id: string;
	at: Date;
	side: EpisodeSide;
	shares: string;
};

export type Trade = BuyTrade | SellTrade;

export type SideEpisode = {
	side: EpisodeSide;
	/** The episode-opening buy's `at`. */
	openedAt: Date;
	/** The full-exit trade's `at`; `null` = the episode is still open. */
	closedAt: Date | null;
	/** The episode-opening BUY's id — the N-1a argument-cell substrate. */
	openingTradeId: string;
	/** Đa at episode end — canonical zero for a closed episode. */
	stakedBasis: string;
	/** Shares held at episode end — canonical zero for a closed episode. */
	quantity: string;
};

export type TradeStep = {
	trade: Trade;
	/** Index into `episodes[]` — monotone non-decreasing across steps. */
	episodeIndex: number;
	quantityAfter: string;
	/** The episode's running Đa after this trade. */
	basisAfter: string;
};

export type EpisodeWalk = { episodes: SideEpisode[]; steps: TradeStep[] };

/**
 * An invalid trade stream — a sell exceeding the held quantity, a sell while
 * flat, a trade on the opposite side while still holding, or a non-positive
 * quantity. Unreachable over real data (the positions `CHECK (quantity >= 0)`
 * + `positions_one_held_side_idx` + the bet floors make every persisted stream
 * valid); a throw here is a caller bug or corrupted substrate, never a product
 * error. Module-local sentinel (`positions/errors.ts` parity — explicit
 * `this.name` so `instanceof` and `.name` survive `extends Error` under the
 * ES2017 target).
 */
export class ProfileTradeStreamError extends Error {
	readonly kind = "profile_trade_stream_invalid";

	constructor(message: string) {
		super(message);
		this.name = "ProfileTradeStreamError";
	}
}

const SOURCE_RANK: Record<Trade["source"], number> = { buy: 0, sell: 1 };

/**
 * Gate a quantity string through the shared NUMERIC(38,18) authority
 * (`dharma/canonical` — `numericString` + `CpmmDecimal`), translating its
 * module-local `DharmaInputError` to this module's sentinel (the
 * `positions/compute.ts` pattern). Without this, a `"NaN"`/`"Infinity"` string
 * passes decimal.js construction and silently poisons the walk instead of
 * failing loud.
 */
function toDecimal(value: string, label: string) {
	try {
		return new CpmmDecimal(canonicalize(value));
	} catch (e) {
		if (e instanceof DharmaInputError) {
			throw new ProfileTradeStreamError(
				`not a NUMERIC(38,18) decimal string: ${label}=${JSON.stringify(value)}`,
			);
		}
		throw e;
	}
}

/**
 * The N-3 deterministic merge law (plan §2 Slice 1, verbatim): merge key =
 * `created_at` ascending across both sources; cross-source same-timestamp
 * tiebreak = buy before sell (the only interleave that keeps the running
 * quantity non-negative — the positions CHECK rejects the other order);
 * within-source tiebreak = `id` ascending (UUIDv7, time-ordered). The
 * comparator is total over distinct trades, so the output is independent of
 * input array order.
 */
export function mergeTradeStream(
	buys: BuyTrade[],
	sells: SellTrade[],
): Trade[] {
	return [...buys, ...sells].sort((a, b) => {
		const dt = a.at.getTime() - b.at.getTime();
		if (dt !== 0) {
			return dt;
		}
		const ds = SOURCE_RANK[a.source] - SOURCE_RANK[b.source];
		if (ds !== 0) {
			return ds;
		}
		return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
	});
}

/** Internal accumulator for the episode under construction. */
type OpenEpisode = {
	side: EpisodeSide;
	openedAt: Date;
	openingTradeId: string;
};

/**
 * Walk an ALREADY-MERGED per-(user, market) stream (both sides may appear
 * sequentially — a flip is exit-then-open, §2 SideEpisode maximality).
 *
 * The Đa law (§23): opens when quantity first rises from zero on a side;
 * basis += stake on every buy; on a partial sell the basis is reduced
 * pro-rata — basis′ = basis × (q − q_sold)/q (the R-9.8 surviving-fraction
 * mechanic, episode-scoped for display); a full exit closes the episode and
 * zeroes the basis; re-entry opens a fresh episode — prior-episode prices
 * never blend. Quantities chain by exact 18-dp add/sub; the basis carries
 * precision-50 intermediates internally (pro-rata division rounds at that
 * precision) and quantizes half-even at the 18-dp boundary.
 */
export function computeEpisodes(trades: Trade[]): EpisodeWalk {
	const episodes: SideEpisode[] = [];
	const steps: TradeStep[] = [];

	let open: OpenEpisode | null = null;
	let quantity = new CpmmDecimal(0);
	let basis = new CpmmDecimal(0);

	for (const trade of trades) {
		const shares = toDecimal(trade.shares, "shares");
		if (shares.lessThanOrEqualTo(0)) {
			throw new ProfileTradeStreamError(
				`non-positive shares on ${trade.source} ${trade.id}`,
			);
		}

		if (trade.source === "buy") {
			const stake = toDecimal(trade.stake, "stake");
			if (stake.lessThanOrEqualTo(0)) {
				throw new ProfileTradeStreamError(
					`non-positive stake on buy ${trade.id}`,
				);
			}
			if (open === null) {
				open = {
					side: trade.side,
					openedAt: trade.at,
					openingTradeId: trade.id,
				};
			} else if (trade.side !== open.side) {
				throw new ProfileTradeStreamError(
					`buy on ${trade.side} while holding ${open.side} (one-held-side)`,
				);
			}
			quantity = quantity.plus(shares);
			basis = basis.plus(stake);
		} else {
			if (open === null) {
				throw new ProfileTradeStreamError(`sell ${trade.id} while flat`);
			}
			if (trade.side !== open.side) {
				throw new ProfileTradeStreamError(
					`sell on ${trade.side} while holding ${open.side}`,
				);
			}
			if (shares.greaterThan(quantity)) {
				throw new ProfileTradeStreamError(
					`sell of ${trade.shares} exceeds held ${toFixed18(quantity)}`,
				);
			}
			if (shares.equals(quantity)) {
				// Full exit — close the episode; basis zeroes by law, not by math.
				quantity = new CpmmDecimal(0);
				basis = new CpmmDecimal(0);
				episodes.push({
					side: open.side,
					openedAt: open.openedAt,
					closedAt: trade.at,
					openingTradeId: open.openingTradeId,
					stakedBasis: toFixed18(basis),
					quantity: toFixed18(quantity),
				});
				open = null;
			} else {
				const remaining = quantity.minus(shares);
				basis = basis.times(remaining).dividedBy(quantity);
				quantity = remaining;
			}
		}

		steps.push({
			trade,
			// The current episode is always the LAST entry once finalized below;
			// while open it occupies the next slot — both cases: episodes.length
			// counts closed episodes, so an open episode's index is that count.
			episodeIndex: open === null ? episodes.length - 1 : episodes.length,
			quantityAfter: toFixed18(quantity),
			basisAfter: halfEven18(basis),
		});
	}

	if (open !== null) {
		episodes.push({
			side: open.side,
			openedAt: open.openedAt,
			closedAt: null,
			openingTradeId: open.openingTradeId,
			stakedBasis: halfEven18(basis),
			quantity: toFixed18(quantity),
		});
	}

	return { episodes, steps };
}
