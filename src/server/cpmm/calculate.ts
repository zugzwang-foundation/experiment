/**
 * Derived from Manifold's CPMM implementation (MIT).
 * Upstream: manifoldmarkets/manifold — common/src/calculate-cpmm.ts
 * Read at fork: zugzwang-foundation/manifold-reference,
 *   tag ref-2026-04-28-found5 = commit d5b55cf9472ec05f545e6c1a817d88005b8dbf2b
 * Upstream license: MIT — Copyright (c) 2022 Manifold Markets, Inc.
 * Full notice: THIRD_PARTY_NOTICES.md (repo root).
 * This file: AGPL-3.0-or-later, © The Zugzwang Authors. See docs/specs/cpmm.md §2.
 */
import "server-only";

import { CpmmDecimal, floor18, halfEven18, toFixed18 } from "./decimal";
import { CpmmInputError } from "./errors";
import { requirePositive } from "./validate";

/**
 * A market side. Lowercase per cpmm.md §13 — distinct from the system-wide
 * `side` pgEnum / event payloads, which are uppercase "YES" | "NO". Case
 * translation is the caller's (handler glue) responsibility.
 */
export type Side = "yes" | "no";

/** The CPMM reserve pair, as exact 18-dp decimal strings. */
export type Reserves = { yes: string; no: string };

function opposite(side: Side): Side {
	return side === "yes" ? "no" : "yes";
}

/**
 * Seed a fresh pool with symmetric reserves — the p = 1/2 case of §7.1, kept
 * because every historical `market.opened` row is this shape and the chart
 * replays them through it. `openingReserves` is what a market opens with now.
 */
export function seedPool(seed: string): Reserves {
	const v = toFixed18(requirePositive(seed, "seed"));
	return { yes: v, no: v };
}

/**
 * ADR-0047 §A/§B — the reserve-placement primitive. Two exported functions over
 * one idea: `openingReserves` places a fresh pair at a chosen price, and
 * `addLiquidity` grows an existing pair without moving the price. Both return
 * their discard as a RESIDUAL (`discarded := amount − (S′ − S)`) rather than as
 * an independently rounded product, which is what makes the §7.1 backing
 * identity close EXACTLY at 18 dp no matter which way `S′` rounds.
 *
 * `addLiquidity` has NO runtime caller in Phase 1, and that is deliberate: it is
 * the specification and differential-fuzz oracle the Phase 2 SQL injector is
 * pinned against (ADR-0047 §A "two implementations, one definition"). It is
 * fuzzed at ≥10,000 pairs, so it is exercised harder than most shipped code.
 */

/** Seed a fresh pool with two explicit reserves (§7.1). */
export function seedReserves(yes: string, no: string): Reserves {
	return {
		yes: toFixed18(requirePositive(yes, "seedReserves.yes")),
		no: toFixed18(requirePositive(no, "seedReserves.no")),
	};
}

/**
 * Place a fresh pair at opening price p over a tank of T Đ (§7.1, ADR-0047 §B):
 *
 *     no  = floor18(p · T)
 *     yes = T − no                  ⇒  yes + no == T exactly, at 18 dp
 *
 * ⚠ `no` is the floored side and `yes` absorbs the dust ON PURPOSE. The opening
 * price is `no / (yes + no)` = `no / T`, so flooring the NUMERATOR while the
 * denominator stays exactly T is what lands the price on p; deriving `yes` by
 * subtraction is what keeps the sum exact. Dust accrues to the pool, never to a
 * participant (INV-C2, the same convention as `computeBuy` above).
 *
 * ⚠ DIRECTION. A side's price is proportional to the OPPOSITE reserve, so a LOW
 * `openingPriceYes` means a LARGE yes-reserve: p = 0.10 at T = 100,000 gives
 * (90,000, 10,000), not (10,000, 90,000). Both orderings type-check and both
 * make a valid pool — only one opens the market where the admin said.
 *
 * The open mints `max(yes, no)` pairs; `min(yes, no)` of the short side enters
 * the pool and the rest is DISCARDED — destroyed, held by no one, in no
 * position. That is the term the backing identity carries.
 */
export function openingReserves({
	openingPriceYes,
	tank,
}: {
	openingPriceYes: string;
	tank: string;
}): {
	reserves: Reserves;
	backingMinted: string;
	discardedYes: string;
	discardedNo: string;
} {
	const p = requirePositive(openingPriceYes, "openingPriceYes");
	const T = requirePositive(tank, "tank");
	if (!p.lessThan(1)) {
		throw new CpmmInputError(
			`openingPriceYes must be strictly inside (0,1), received ${JSON.stringify(openingPriceYes)}`,
		);
	}

	const no = new CpmmDecimal(floor18(p.times(T)));
	const yes = T.minus(no);
	// §3.4: y, n > 0 always. A tank small enough that p·T floors to zero (or
	// leaves nothing for the other side) would produce a pool every downstream
	// `requirePositive` rejects — surface it HERE, at the boundary, not from
	// inside a transaction three calls later.
	if (!no.gt(0) || !yes.gt(0)) {
		throw new CpmmInputError(
			`openingReserves: tank ${JSON.stringify(tank)} at price ${JSON.stringify(openingPriceYes)} yields a non-positive reserve (${toFixed18(yes)}, ${toFixed18(no)})`,
		);
	}

	const backing = yes.greaterThan(no) ? yes : no;
	return {
		reserves: { yes: toFixed18(yes), no: toFixed18(no) },
		backingMinted: toFixed18(backing),
		discardedYes: toFixed18(backing.minus(yes)),
		discardedNo: toFixed18(backing.minus(no)),
	};
}

/**
 * Price-preserving liquidity addition (ADR-0047 §A), upstream's
 * `addCpmmLiquidityFixedP` (`common/src/calculate-cpmm.ts:735–759` at the §2
 * pinned commit). With L the LONG reserve and S the short one:
 *
 *     L′ = L + a
 *     S′ = floor18(S + a · S / L)
 *     discarded = a − (S′ − S)        ← residual, on the S side
 *
 * `a · S / L` is generally non-terminating (it is `a/9` at the D-14 reserves),
 * so a fixed-18-dp `S′` cannot preserve the price exactly; it moves by at most
 * one ulp. Taking the discard as `a − (S′ − S)` rather than as a separately
 * rounded `a · (1 − S/L)` is what keeps `(S′ − S) + discarded == a` EXACT — the
 * property the backing identity rests on.
 */
export function addLiquidity({
	reserves,
	amount,
}: {
	reserves: Reserves;
	amount: string;
}): {
	reserves: Reserves;
	backingMinted: string;
	discardedYes: string;
	discardedNo: string;
} {
	const y = requirePositive(reserves.yes, "reserves.yes");
	const n = requirePositive(reserves.no, "reserves.no");
	const a = requirePositive(amount, "amount");

	// Ties go to `yes` as the long side; at S/L = 1 the two branches agree
	// exactly (S′ = S + a, discard 0), so the choice is arbitrary, not load-bearing.
	const yesIsLong = y.greaterThanOrEqualTo(n);
	const L = yesIsLong ? y : n;
	const S = yesIsLong ? n : y;

	const lPrime = L.plus(a);
	const sPrime = new CpmmDecimal(floor18(S.plus(a.times(S).dividedBy(L))));
	const discarded = a.minus(sPrime.minus(S));

	const ZERO = toFixed18(new CpmmDecimal(0));
	return {
		reserves: yesIsLong
			? { yes: toFixed18(lPrime), no: toFixed18(sPrime) }
			: { yes: toFixed18(sPrime), no: toFixed18(lPrime) },
		backingMinted: toFixed18(a),
		discardedYes: yesIsLong ? ZERO : toFixed18(discarded),
		discardedNo: yesIsLong ? toFixed18(discarded) : ZERO,
	};
}

/**
 * Spot prices (§3.3). A side's price is proportional to the OPPOSITE reserve:
 * p_yes = n / (y + n), p_no = y / (y + n).
 */
export function getPrices(reserves: Reserves): { yes: string; no: string } {
	const y = requirePositive(reserves.yes, "reserves.yes");
	const n = requirePositive(reserves.no, "reserves.no");
	const sum = y.plus(n);
	return {
		yes: halfEven18(n.dividedBy(sum)),
		no: halfEven18(y.dividedBy(sum)),
	};
}

/**
 * Buy `stake` worth of `side` shares (§4.1). Closed form: the bought-side
 * reserve a′ = a·b / (b + S); shares s = a + S − a′. The user-credited share
 * is FLOORED (§10.3); the output reserves are derived by exact add/sub of the
 * FLOORED share, so k′ ≥ k (rounding dust to the pool, INV-C2). Prices are
 * quantized from the EXACT precision-50 intermediates, never the floored
 * outputs (plan A1).
 */
export function computeBuy({
	reserves,
	side,
	stake,
}: {
	reserves: Reserves;
	side: Side;
	stake: string;
}): {
	shares: string;
	reserves: Reserves;
	p0: string;
	pEff: string;
	p1: string;
	impact: string;
} {
	const opp = opposite(side);
	const S = requirePositive(stake, "stake");
	const a = requirePositive(reserves[side], `reserves.${side}`);
	const b = requirePositive(reserves[opp], `reserves.${opp}`);

	const aPrimeExact = a.times(b).dividedBy(b.plus(S));
	const sExact = a.plus(S).minus(aPrimeExact);
	const shares = floor18(sExact);
	const sR = new CpmmDecimal(shares);
	const aPrime = a.plus(S).minus(sR);
	const bPrime = b.plus(S);

	const p0Exact = b.dividedBy(a.plus(b));
	const p1Exact = bPrime.dividedBy(aPrimeExact.plus(bPrime));

	const reservesOut: Reserves =
		side === "yes"
			? { yes: toFixed18(aPrime), no: toFixed18(bPrime) }
			: { yes: toFixed18(bPrime), no: toFixed18(aPrime) };

	return {
		shares,
		reserves: reservesOut,
		p0: halfEven18(p0Exact),
		pEff: halfEven18(S.dividedBy(sExact)),
		p1: halfEven18(p1Exact),
		impact: halfEven18(p1Exact.minus(p0Exact).abs()),
	};
}

/**
 * Sell `shares` of `side` back to the pool (§5.1). Proceeds M is the SMALLER
 * root of M² − (a + s + b)·M + s·b = 0. M is FLOORED (user-credited, §10.3);
 * reserves are derived by exact add/sub of the FLOORED proceeds (k′ ≥ k,
 * INV-C2). Prices quantize the EXACT intermediates (plan A1).
 */
export function computeSell({
	reserves,
	side,
	shares,
}: {
	reserves: Reserves;
	side: Side;
	shares: string;
}): {
	proceeds: string;
	reserves: Reserves;
	p0: string;
	pEff: string;
	p1: string;
	impact: string;
} {
	const opp = opposite(side);
	const s = requirePositive(shares, "shares");
	const a = requirePositive(reserves[side], `reserves.${side}`);
	const b = requirePositive(reserves[opp], `reserves.${opp}`);

	const sum = a.plus(s).plus(b);
	const disc = sum.times(sum).minus(s.times(b).times(4));
	const mExact = sum.minus(disc.sqrt()).dividedBy(2);
	const proceeds = floor18(mExact);
	const mR = new CpmmDecimal(proceeds);
	const aPrime = a.plus(s).minus(mR);
	const bPrime = b.minus(mR);

	const p0Exact = b.dividedBy(a.plus(b));
	const aPxExact = a.plus(s).minus(mExact);
	const bPxExact = b.minus(mExact);
	const p1Exact = bPxExact.dividedBy(aPxExact.plus(bPxExact));

	const reservesOut: Reserves =
		side === "yes"
			? { yes: toFixed18(aPrime), no: toFixed18(bPrime) }
			: { yes: toFixed18(bPrime), no: toFixed18(aPrime) };

	return {
		proceeds,
		reserves: reservesOut,
		p0: halfEven18(p0Exact),
		pEff: halfEven18(mExact.dividedBy(s)),
		p1: halfEven18(p1Exact),
		impact: halfEven18(p1Exact.minus(p0Exact).abs()),
	};
}

/**
 * ⛔ SUPERSEDED AS THE RESOLVED UNWIND BY ADR-0047 §E. THIS IS NOT WHAT
 * `settleMarket` PAYS OUT, AND IT HAS NO `src/` CALLER.
 *
 * It returns the bare winning-side reserve, which WAS the residual for as long
 * as every open was symmetric and nothing was ever discarded. With a discard the
 * residual is `winning reserve + D_winning` — the destroyed shares' Đ has no
 * holder to pay and nowhere else to go — and `resolution/settle.ts` computes
 * that directly, routing around this function on purpose.
 *
 * Kept, not deleted, because `cpmm.md` §13 names it in the module contract and
 * three `tests/unit/cpmm/` files pin it, including the §12 worked vectors. But
 * it is the obviously-named function for a job it no longer does, so a future
 * caller reaching for it by name would silently under-pay every asymmetric NO
 * outcome. Flagged by `@code-reviewer` MEDIUM-3; its fate is a Phase-2 decision
 * alongside the §8.1 amendment, not an edit to make here.
 *
 * Both reserves are validated (§3.4: y, n > 0 always). The void residual is a
 * ledger identity (§8.2) — no curve function exists for it.
 */
export function computeResolvedUnwind({
	reserves,
	outcome,
}: {
	reserves: Reserves;
	outcome: Side;
}): { residual: string } {
	const y = requirePositive(reserves.yes, "reserves.yes");
	const n = requirePositive(reserves.no, "reserves.no");
	return { residual: toFixed18(outcome === "yes" ? y : n) };
}
