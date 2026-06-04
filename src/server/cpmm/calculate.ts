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

/** Seed a fresh pool with symmetric reserves (§7.1). */
export function seedPool(seed: string): Reserves {
	const v = toFixed18(requirePositive(seed, "seed"));
	return { yes: v, no: v };
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
 * Resolved unwind (§8.1): the residual returned to the winning side equals its
 * reserve — a selector, not curve math. Both reserves are validated (§3.4:
 * y, n > 0 always). The void residual is a ledger identity (§8.2) — no curve
 * function exists for it.
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
