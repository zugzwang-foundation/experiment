import "server-only";

import { clampStakeToMax } from "@/server/bets/floors";
import {
	computeBuy,
	computeSell,
	type Reserves,
} from "@/server/cpmm/calculate";

/**
 * UI.A2 §3.2 — the cpmm.md §6.4 preview consumable, as it crosses the wire
 * from `GET /m/[slug]/quote`. Wire shape CLOSED (ratified OQ-2): the §6.4
 * bundle IS the ruled consumable — A3 only chooses what to render. Reserves
 * are deliberately NOT echoed (quotes are derivable outputs; the raw pool
 * pair stays server-side). Advisory per cpmm §6.3: the authoritative numbers
 * are recomputed inside the W-1 tx under the pool lock at execution.
 *
 * The DTO `side` is the wire-side UPPERCASE "YES" | "NO"; cpmm's `Side` is
 * lowercase (cpmm.md §13) — the case translation lives here, in the builder.
 */
export type QuoteDTO =
	| {
			kind: "buy";
			side: "YES" | "NO";
			/** The EFFECTIVE stake — clamped when submitted > BET_MAX_STAKE. */
			stake: string;
			/** SPEC.1 §16.1: "the clamped result is surfaced in the non-blocking preview". */
			clamped: boolean;
			/** computeBuy — To-win: payout if the side wins = shares × Đ1. */
			shares: string;
			p0: string;
			pEff: string;
			p1: string;
			impact: string;
	  }
	| {
			kind: "sell";
			side: "YES" | "NO";
			/** As submitted — SELL IS NEVER CLAMPED (SG-2). */
			shares: string;
			/** computeSell — the sell-proceeds basis: then-current reserves (§6.3). */
			proceeds: string;
			p0: string;
			pEff: string;
			p1: string;
			impact: string;
	  };

/**
 * The buy-side quote. Applies `clampStakeToMax` BEFORE `computeBuy` (cpmm
 * §6.4: "the caller applies the per-bet stake cap … before `computeBuy`, so
 * on a clamped buy these figures reflect the clamped stake"). `stake` ≤ max
 * passes through byte-identical (the clamp's strict-`>` passthrough law), so
 * `clamped` falls out of a plain string identity check.
 */
export function buildBuyQuote(args: {
	reserves: Reserves;
	side: "YES" | "NO";
	stake: string;
}): QuoteDTO {
	const stake = clampStakeToMax(args.stake);
	const clamped = stake !== args.stake;
	const buy = computeBuy({
		reserves: args.reserves,
		side: args.side === "YES" ? "yes" : "no",
		stake,
	});
	return {
		kind: "buy",
		side: args.side,
		stake,
		clamped,
		shares: buy.shares,
		p0: buy.p0,
		pEff: buy.pEff,
		p1: buy.p1,
		impact: buy.impact,
	};
}

/**
 * The sell-side quote — NEVER clamped (SG-2; SPEC.1 §7/§16.1 verbatim), and
 * with ZERO position coupling, deliberately: `computeSell` is pure math over
 * public reserves; the composer bounds input by the viewer context's held
 * quantity, and the execute path (`insufficient_shares` + I-NO-OVERSELL) is
 * the enforcement layer.
 */
export function buildSellQuote(args: {
	reserves: Reserves;
	side: "YES" | "NO";
	shares: string;
}): QuoteDTO {
	const sell = computeSell({
		reserves: args.reserves,
		side: args.side === "YES" ? "yes" : "no",
		shares: args.shares,
	});
	return {
		kind: "sell",
		side: args.side,
		shares: args.shares,
		proceeds: sell.proceeds,
		p0: sell.p0,
		pEff: sell.pEff,
		p1: sell.p1,
		impact: sell.impact,
	};
}

/**
 * The strip's `TO WIN Đ1 → Đx` substrate (values-log §6 ruling 1 consumer):
 * per-side `computeBuy(stake: "1").shares` over the same reserves. Consumed
 * by `getMarketPricingAndUnitToWin` so the header's one pool read yields
 * prices AND unit-to-win together.
 */
export function deriveUnitToWin(reserves: Reserves): {
	yes: string;
	no: string;
} {
	return {
		yes: computeBuy({ reserves, side: "yes", stake: "1" }).shares,
		no: computeBuy({ reserves, side: "no", stake: "1" }).shares,
	};
}
