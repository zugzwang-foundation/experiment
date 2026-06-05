/**
 * Shared support for the ENGINE.3 CPMM property suite (`tests/unit/cpmm/`) —
 * NOT a spec subject. The single home of the OQ-3 generator domain (ratified
 * plan docs/plans/ENGINE.3.md "Generators" section; charter cpmm.md
 * §4.2/§5.2/§11/§12), the bigint↔18-dp-string helpers, and the fixed fast-check
 * seed + run count. Keeping the whole domain in ONE module makes the §5.10
 * pre-PR audit a binary grep.
 *
 * Exact-decimal-string-native (CLAUDE.md §2 — money-as-string, never JS floats):
 * every generated quantity is built as a scaled `bigint` of 1e-18 units → 18-dp
 * decimal string. NO JS float (`Number`) is ever used to construct a value —
 * fast-check yields `bigint` directly (`fc.bigInt`), and all arithmetic is
 * bigint. (SEED / NUM_RUNS / maxLength / decade indices are fast-check *config*
 * integers, not quantities under test.)
 *
 * Out-of-domain (ENGINE.2 security triage; plan carry-forward #2 / A7): the
 * sub-ULP-reserve × near-ceiling-stake corner is excluded by TEST POLICY, not
 * by the module — sub-ULP positive values ARE `numericString`-valid and DO pass
 * the module's input gate; they are excluded here only because they are
 * economically unreachable (the §4/§5 totality proofs and the precision-50
 * headroom are sized for realistic magnitudes, not the full `numericString`
 * envelope). Separately, magnitudes ≥ 1e20 Đ are impossible under the
 * 20-integer-digit regex (`/^-?\d{1,20}(?:\.\d{1,18})?$/`). Every reserve,
 * stake, and share drawn by the SINGLE-OP scenario generators sits strictly
 * inside that safe interior. The INV-C4 sequence harness instead resolves each
 * op amount against live state — a buy floored at `max(1 unit, b·f)` (never 0),
 * a sell capped at `floor(holdings·f) ≤ holdings` — and its drifting
 * intermediate states are asserted ONLY under A4's exact-identities regime,
 * never the bound-based strict/gap forms.
 */
import fc from "fast-check";

import type { Reserves, Side } from "@/server/cpmm/calculate";

// ─── bigint ↔ 18-dp decimal-string helpers ──────────────────────────────────
// Values are scaled bigints of 1e-18 units (1 Đ === SCALE units). decimalString
// and toUnits are exact inverses for any non-negative value with ≤ 18 fractional
// digits — which is every module output (exactly 18 dp) and every test literal.

/**
 * 10^n as a bigint. Used instead of `n`-suffixed BigInt literals because the
 * repo tsconfig targets ES2017, under which TS forbids BigInt literals (TS2737);
 * the `bigint` type + `BigInt` global are available via `lib: esnext`, so exact
 * integer arithmetic is unaffected — only the literal *syntax* is gated.
 */
const pow10 = (n: number): bigint => BigInt(`1${"0".repeat(n)}`);

/** 1 Đ in 1e-18 units. */
export const SCALE = pow10(18);

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

/** bigint max / min — the generators clamp ratio + magnitude bounds with these. */
export function bigMax(a: bigint, b: bigint): bigint {
	return a > b ? a : b;
}
export function bigMin(a: bigint, b: bigint): bigint {
	return a < b ? a : b;
}

function ceilDiv(a: bigint, b: bigint): bigint {
	return (a + b - BigInt(1)) / b;
}

// ─── domain bounds (OQ-3, approved verbatim) ────────────────────────────────
const RESERVE_MIN = pow10(16); // 0.01 Đ
const RESERVE_MAX = pow10(27); // 1e9 Đ
const RATIO_MAX = pow10(4); // pair ratio guard: 1e-4 ≤ y/n ≤ 1e4 (both ways)
const TRADE_MIN = pow10(16); // 0.01 Đ — stake / share floor
const STAKE_ABS_MAX = pow10(27); // 1e9 Đ — absolute stake cap
const REL_CAP = pow10(3); // 1e3 — relative cap factor (S ≤ 1e3·b ; s ≤ 1e3·a)
const OQ5_RESERVE_MIN = SCALE; // 1 Đ floor ⇒ pool total ≥ 2 Đ (OQ-5)

// ─── magnitude-stratified bigint draw (CP-1 review F-1, 2026-06-05) ─────────
// fc.bigInt({min,max}) draws LINEAR-uniformly, so over a multi-decade window
// ~90% of the mass sits in the top decade — every reserve would cluster at
// ~1e8–1e9 Đ, every stake at the 1e3·b cap. With the fixed seed that bias is
// permanent and collapses the plan's "multi-order-of-magnitude spans" vacuity
// guard. stratUnits restores DECADE-uniform coverage: enumerate the decades (by
// digit length) intersecting [min, max], pick one uniformly, then draw uniformly
// within decade ∩ [min, max]. Constructed (never rejection-sampled); bigint-only
// (magnitude via toString().length — never Math.log10 on a value). The SUPPORT
// is byte-identical to fc.bigInt({min,max}); only the weighting changes — so
// every bound-based soundness proof (ratio guard, p1 < 1 cap, material-impact
// floor, A3 gap) is untouched. Single-decade windows degenerate to plain uniform.
function stratUnits(min: bigint, max: bigint): fc.Arbitrary<bigint> {
	const dMin = min.toString().length;
	const dMax = max.toString().length;
	if (dMin === dMax) {
		return fc.bigInt({ min, max });
	}
	return fc.integer({ min: dMin, max: dMax }).chain((d) => {
		const lo = bigMax(min, pow10(d - 1));
		const hi = bigMin(max, pow10(d) - BigInt(1));
		return fc.bigInt({ min: lo, max: hi });
	});
}

// ─── the side arbitrary (lowercase per cpmm.md §13, verbatim) ───────────────
const SIDES = ["yes", "no"] as const satisfies readonly Side[];
const KINDS = ["buy", "sell"] as const;
export const sideArb: fc.Arbitrary<Side> = fc.constantFrom(...SIDES);

// ─── reserve-pair generator (constructed ratio guard, never rejection-sampled) ─
// Pick a base magnitude `a` decade-uniformly (stratUnits) across the 11-order
// band, then the partner `b` decade-uniformly inside the ratio window
// [ceil(a / 1e4), a · 1e4] clamped into the band — realizing the plan's
// skew-exponent span as sub-decade coverage of b/a across the full 1e-4..1e4
// window. BOTH reserves ∈ [reserveMin, RESERVE_MAX] AND 1e-4 ≤ a/b ≤ 1e4 hold by
// construction (stratification leaves the support unchanged); `a ∈ [lo, hi]`
// always, so the dependent range is non-empty.
function reservePairUnits(
	reserveMin: bigint,
): fc.Arbitrary<{ yes: bigint; no: bigint }> {
	return stratUnits(reserveMin, RESERVE_MAX).chain((a) => {
		const lo = bigMax(reserveMin, ceilDiv(a, RATIO_MAX));
		const hi = bigMin(RESERVE_MAX, a * RATIO_MAX);
		return stratUnits(lo, hi).map((b) => ({ yes: a, no: b }));
	});
}

function reservesOf(pair: { yes: bigint; no: bigint }): Reserves {
	return { yes: decimalString(pair.yes), no: decimalString(pair.no) };
}

// ─── scenario shapes (module-input shape: exact 18-dp strings) ──────────────
export type BuyScenario = { reserves: Reserves; side: Side; stake: string };
export type SellScenario = { reserves: Reserves; side: Side; shares: string };
export type ImpactPair = {
	reserves: Reserves;
	side: Side;
	stake1: string;
	stake2: string;
};
export type SeqOp = { side: Side; kind: "buy" | "sell"; amountNum: bigint };

// Buy: S ∈ [0.01, min(1e9, 1e3·b)] — absolute + opposite-reserve-relative cap.
// The relative cap S ≤ 1e3·b keeps p1 < 1 sound (complement ≥ ~1e-10 ≫ 1 ulp).
function makeBuyScenario(reserveMin: bigint): fc.Arbitrary<BuyScenario> {
	return reservePairUnits(reserveMin).chain((pair) =>
		sideArb.chain((side) => {
			const b = side === "yes" ? pair.no : pair.yes; // opposite reserve
			const sMax = bigMin(STAKE_ABS_MAX, b * REL_CAP);
			return stratUnits(TRADE_MIN, sMax).map((stake) => ({
				reserves: reservesOf(pair),
				side,
				stake: decimalString(stake),
			}));
		}),
	);
}

// Sell: s ∈ [0.01, 1e3·a] — sold-side relative cap.
function makeSellScenario(reserveMin: bigint): fc.Arbitrary<SellScenario> {
	return reservePairUnits(reserveMin).chain((pair) =>
		sideArb.chain((side) => {
			const a = side === "yes" ? pair.yes : pair.no; // sold-side reserve
			return stratUnits(TRADE_MIN, a * REL_CAP).map((shares) => ({
				reserves: reservesOf(pair),
				side,
				shares: decimalString(shares),
			}));
		}),
	);
}

export const buyScenario: fc.Arbitrary<BuyScenario> =
	makeBuyScenario(RESERVE_MIN);
export const sellScenario: fc.Arbitrary<SellScenario> =
	makeSellScenario(RESERVE_MIN);

// OQ-5 cross-consistency: the same buy/sell domain but reserves floored at 1 Đ
// (pool total ≥ 2 Đ). Bounds the 1/total price-divergence amplification (A1) so
// |getPrices(result.reserves)[side] − p1| ≤ 1 ulp is provable; consumed ONLY by
// the `getPrices vs p1` property.
export const crossConsistencyBuyScenario: fc.Arbitrary<BuyScenario> =
	makeBuyScenario(OQ5_RESERVE_MIN);
export const crossConsistencySellScenario: fc.Arbitrary<SellScenario> =
	makeSellScenario(OQ5_RESERVE_MIN);

// Material-trade subgens: S ∈ [1e-3·b, 1e3·b] (resp. s ∈ [1e-3·a, 1e3·a]) —
// force impact ≥ ~2e-7 worst-case across the skew range (~5e-4 near balanced),
// ≫ 1 ulp, so the STRICT price separations (p0 < p1 / p1 < p0) are genuinely
// exercised, not satisfied all-equal (A2/A12). Used ONLY where a strict ordering
// is asserted.
export const materialBuyScenario: fc.Arbitrary<BuyScenario> = reservePairUnits(
	RESERVE_MIN,
).chain((pair) =>
	sideArb.chain((side) => {
		const b = side === "yes" ? pair.no : pair.yes;
		return stratUnits(b / REL_CAP, b * REL_CAP).map((stake) => ({
			reserves: reservesOf(pair),
			side,
			stake: decimalString(stake),
		}));
	}),
);

export const materialSellScenario: fc.Arbitrary<SellScenario> =
	reservePairUnits(RESERVE_MIN).chain((pair) =>
		sideArb.chain((side) => {
			const a = side === "yes" ? pair.yes : pair.no;
			return stratUnits(a / REL_CAP, a * REL_CAP).map((shares) => ({
				reserves: reservesOf(pair),
				side,
				shares: decimalString(shares),
			}));
		}),
	);

// Strict-impact-parity pair (A3): two buys on the SAME (reserves, side) with
// S₂ ≥ 2·S₁, both inside the 1e3·b cap (so S₁ ≤ 5e2·b), both material (≥ 1e-3·b).
// The ≥2× gap guarantees a strict impact separation impact(S₂) > impact(S₁).
// Consumed ONLY by the buy `monotone impact` strict assertion.
export const impactParityScenario: fc.Arbitrary<ImpactPair> = reservePairUnits(
	RESERVE_MIN,
).chain((pair) =>
	sideArb.chain((side) => {
		const b = side === "yes" ? pair.no : pair.yes;
		return stratUnits(b / REL_CAP, (b * REL_CAP) / BigInt(2)).chain((stake1) =>
			stratUnits(stake1 * BigInt(2), b * REL_CAP).map((stake2) => ({
				reserves: reservesOf(pair),
				side,
				stake1: decimalString(stake1),
				stake2: decimalString(stake2),
			})),
		);
	}),
);

// ─── INV-C4 solvency-sequence domain ────────────────────────────────────────
// A market is seeded with C Đ (reserves (C, C); D = C; holdings 0/0 — the
// identity holds trivially at seed). Then a sequence of ≤ 20 ops replays on the
// curve. Each op carries a fraction f = amountNum / SCALE ∈ (0, 1]; the INV-C4
// harness (invariants.property.test.ts, CP-2) RESOLVES it against current state:
//   - buy : S = max(1 unit, b · f)  (b = current opposite reserve) — S ≤ b, so
//           each buy at most doubles the opposite reserve; over ≤ 20 ops the
//           reserves stay far below the 1e20 Đ / 20-digit numericString ceiling.
//   - sell: s = floor(holdings[side] · f) ≤ holdings — never exceeds the
//           position (§5.4 sufficiency modeled, not violated); the harness skips
//           a sell whose resolved share count is 0 (no / sub-ulp holdings).
// Intermediate states drift outside the single-op ratio guard, so the sequence
// asserts ONLY the exact bigint identities (+ no-throw / 18-dp shape) — never a
// strict / gap-conditioned form (A4). amountNum is decade-stratified so f spans
// tiny fractions, not just near-1 (F-1).
export const seedArb: fc.Arbitrary<string> = stratUnits(
	RESERVE_MIN,
	RESERVE_MAX,
).map(decimalString);

export const seqOpArb: fc.Arbitrary<SeqOp> = fc.record({
	side: sideArb,
	kind: fc.constantFrom(...KINDS),
	amountNum: stratUnits(BigInt(1), SCALE), // f = amountNum / SCALE ∈ (0, 1]
});

export const sequenceArb: fc.Arbitrary<SeqOp[]> = fc.array(seqOpArb, {
	maxLength: 20,
});

// ─── fixed fast-check config (OQ-4 / A8) ────────────────────────────────────
// Uniform across EVERY property, the INV-C4 sequence included — deterministic &
// reproducible (cpmm.md §10.4); the literal values make the §5.10 audit a binary
// grep. The fixed seed pins the exact fast-check 4.8.0 generation/shrink stream
// (the OQ-1 version-pin interaction).
export const SEED = 20260605;
export const NUM_RUNS = 1000;
