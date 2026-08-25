/**
 * Shared generator domain for the LOTS-1 lot-core property suite
 * (`tests/unit/lots/`) — NOT a spec subject. Mirrors
 * `tests/unit/cpmm/_arbitraries.ts` in construction and in doctrine: every
 * quantity is built as a scaled `bigint` of 1e-18 units and rendered to an
 * 18-dp decimal string. **No JS float is ever used to construct a value**
 * (CLAUDE.md §2 — money-as-string). fast-check yields `bigint` directly and all
 * arithmetic here is bigint, so the generated corpus is exact.
 *
 * Keeping the whole domain in ONE module makes the §5.10 pre-PR audit a binary
 * grep, which is the reason the cpmm suite does it that way.
 */
import fc from "fast-check";

/**
 * 10^n as a bigint. Written this way rather than as an `n`-suffixed literal
 * because the repo tsconfig targets ES2017, under which TS rejects BigInt
 * literals (TS2737); the `bigint` TYPE and the `BigInt` global are available
 * via `lib: esnext`, so only the literal syntax is gated.
 */
const pow10 = (n: number): bigint => BigInt(`1${"0".repeat(n)}`);

/** 1 Đ in 1e-18 units. */
export const SCALE = pow10(18);
export const ONE_UNIT = BigInt(1);
export const ZERO = BigInt(0);

/** Scaled bigint units → canonical 18-dp decimal string (non-negative). */
export function decimalString(units: bigint): string {
	const int = units / SCALE;
	const frac = units % SCALE;
	return `${int}.${frac.toString().padStart(18, "0")}`;
}

/** 18-dp decimal string → scaled bigint units (exact; ≤ 18 fractional digits). */
export function toUnits(value: string): bigint {
	const [int, frac = ""] = value.split(".");
	return BigInt(int) * SCALE + BigInt(frac.padEnd(18, "0"));
}

function bigMax(a: bigint, b: bigint): bigint {
	return a > b ? a : b;
}
function bigMin(a: bigint, b: bigint): bigint {
	return a < b ? a : b;
}

// ─── domain bounds ──────────────────────────────────────────────────────────
// Sized to the economically reachable envelope, not the full `numericString`
// envelope: ADR-0018 floors every stake, and CPMM prices live in (0,1), so a
// lot's shares and basis are within a few orders of each other. Sub-ULP corners
// are excluded by TEST POLICY (the cpmm suite's stance, same reasoning) — they
// are `numericString`-valid and DO pass the module gate; they are simply
// unreachable.
const SHARES_MIN = pow10(16); // 0.01 shares
const SHARES_MAX = pow10(24); // 1e6 shares
const BASIS_MIN = pow10(16); // 0.01 Đ
const BASIS_MAX = pow10(24); // 1e6 Đ

/**
 * Decade-uniform bigint draw. `fc.bigInt({min,max})` is LINEAR-uniform, so over
 * a multi-decade window ~90% of the mass sits in the top decade — every lot
 * would be ~1e6 and the "spans orders of magnitude" claim would be vacuous
 * under a fixed seed. Enumerate the decades intersecting [min,max], pick one
 * uniformly, then draw uniformly inside it. Constructed, never
 * rejection-sampled; the SUPPORT is identical to `fc.bigInt({min,max})` — only
 * the weighting changes, so no bound-based proof is affected.
 */
function stratUnits(min: bigint, max: bigint): fc.Arbitrary<bigint> {
	const dMin = min.toString().length;
	const dMax = max.toString().length;
	if (dMin === dMax) {
		return fc.bigInt({ min, max });
	}
	return fc.integer({ min: dMin, max: dMax }).chain((d) => {
		const lo = bigMax(min, pow10(d - 1));
		const hi = bigMin(max, pow10(d) - ONE_UNIT);
		return fc.bigInt({ min: lo, max: hi });
	});
}

export type LotSeed = { shares: bigint; basis: bigint };

/** One freshly-minted lot: positive shares, positive basis (ADR-0018 floors). */
export const lotSeedArb: fc.Arbitrary<LotSeed> = fc.record({
	shares: stratUnits(SHARES_MIN, SHARES_MAX),
	basis: stratUnits(BASIS_MIN, BASIS_MAX),
});

/**
 * A holding: 1–8 lots on one (user, market, side). Eight is not arbitrary — it
 * is above the measured real shape (the POSCHK-1 subject holds four bets in one
 * market) while keeping the largest-remainder residual small enough that a
 * failing case shrinks to something a human can read.
 */
export const holdingArb: fc.Arbitrary<LotSeed[]> = fc.array(lotSeedArb, {
	minLength: 1,
	maxLength: 8,
});

/**
 * A holding plus a share count to sell from it, expressed as a fraction of the
 * total so the sell is always ≤ the position (an oversell is a SEPARATE,
 * explicitly-generated case — it must not contaminate the invariant runs).
 * `f = fracNum / SCALE ∈ (0, 1]`, decade-stratified so tiny partial sells are
 * covered and not just near-full ones. `f == 1` is the sell-all case and is
 * deliberately reachable.
 */
export const holdingAndSellArb: fc.Arbitrary<{
	lots: LotSeed[];
	fracNum: bigint;
}> = fc.record({
	lots: holdingArb,
	fracNum: stratUnits(ONE_UNIT, SCALE),
});

/** Σ shares over a holding, in units — this IS `positions.quantity` under R2. */
export function totalShares(lots: readonly LotSeed[]): bigint {
	return lots.reduce((acc, l) => acc + l.shares, ZERO);
}

// ─── fixed fast-check config ────────────────────────────────────────────────
// Uniform across every property in this suite — deterministic and reproducible,
// and the literal values make the §5.10 audit a binary grep. The fixed seed
// pins the exact fast-check 4.8.0 generation/shrink stream.
export const SEED = 20260821;
export const NUM_RUNS = 1000;
