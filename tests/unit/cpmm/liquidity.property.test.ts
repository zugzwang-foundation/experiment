import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
	addLiquidity,
	getPrices,
	openingReserves,
	type Reserves,
} from "@/server/cpmm/calculate";
import {
	crossConsistencyBuyScenario,
	decimalString,
	SCALE,
	SEED,
	toUnits,
} from "./_arbitraries";

// LIQ-1 Phase 1 · T1b (plan §4 T1b; ADR-0047 §A/§B + §Acceptance "Price
// invariance"). RED-FIRST: `addLiquidity` and `openingReserves` do not exist on
// `@/server/cpmm/calculate` yet, so this file fails at COLLECTION until T1
// lands — the ENGINE.9 greenfield-import posture
// (tests/server/resolution/happy-path.test.ts:31-34).
//
// Five properties, plan §4 T1b's table, plus the open-time backing identity:
//
//   1 price invariance under addLiquidity      |Δp| ≤ 1e-18  (R4: ≤, ONE ULP)
//   2 the 90:1 and D-14 9:1 pairs EXPLICITLY   (never left to the generator)
//   3 backing closes EXACTLY: (S′−S) + discarded == a       ← load-bearing
//   4 openingReserves hits the opening price   getPrices(r).yes == p
//   5 direction pin: p_yes = 0.1 ⇒ yes > no    (fixed, NOT generative)
//   + openingReserves closes the identity at open:
//       yes + discardedYes == no + discardedNo == backingMinted
//
// Exact-bigint-native, exactly as `invariants.property.test.ts` is: every
// comparison goes through `toUnits` (18-dp string → scaled bigint). decimal.js
// is NEVER imported here and no curve quantity is ever recomputed — the
// assertions are relations over the module's OWN outputs and the ADR §A
// identities (CLAUDE.md §2, money is never a JS float).
//
// ⚠ R4 fixes the tolerance at `≤ 1e-18`, NOT `< 1e-18` as plan §4 T1b's table
// prints it. One ulp is attainable: `a·S/L` is generally non-terminating (a/9
// at the D-14 ratio), `S′` is floored, and a floored numerator can move a
// half-even-quantized price by exactly one unit in the last place. `<` would
// red a correct implementation.

const DP18 = /^\d+\.\d{18}$/;
/** One unit in the last place at 18 dp, in scaled bigint units. */
const ULP = BigInt(1);
/** ≥ 10,000 fuzzed pairs per plan §4 T1b + ADR §Acceptance. `_arbitraries.ts`'s
 * shared NUM_RUNS is 1,000 and is deliberately NOT widened — this suite is the
 * Phase 2 differential oracle's only exercise (plan §9 R10) and carries its own,
 * larger budget. SEED is the shared fixed seed (OQ-4): reproducible stream. */
const LIQ_NUM_RUNS = 10_000;

function pow10(n: number): bigint {
	return BigInt(`1${"0".repeat(n)}`);
}

function expectAll18dp(...values: string[]): void {
	for (const value of values) {
		expect(value).toMatch(DP18);
	}
}

function absDiff(a: bigint, b: bigint): bigint {
	const d = a - b;
	return d < BigInt(0) ? -d : d;
}

// ─── local generators ───────────────────────────────────────────────────────
// Decade-stratified, mirroring `_arbitraries.ts`'s `stratUnits` rationale
// (CP-1 review F-1): `fc.bigInt({min,max})` draws LINEAR-uniformly, so over an
// 18-decade window ~90% of the mass sits in the top decade — every opening
// price would cluster at p ≈ 1 and the 10%-open case this ADR exists for would
// never be drawn. Kept LOCAL rather than added to `_arbitraries.ts`: prices and
// tanks are not part of the ENGINE.3 buy/sell domain that module is the single
// home of.
function stratBig(min: bigint, max: bigint): fc.Arbitrary<bigint> {
	const dMin = min.toString().length;
	const dMax = max.toString().length;
	if (dMin === dMax) {
		return fc.bigInt({ min, max });
	}
	return fc.integer({ min: dMin, max: dMax }).chain((d) => {
		const decadeLo = pow10(d - 1);
		const decadeHi = pow10(d) - BigInt(1);
		const lo = min > decadeLo ? min : decadeLo;
		const hi = max < decadeHi ? max : decadeHi;
		return fc.bigInt({ min: lo, max: hi });
	});
}

/** p ∈ (0,1), 18-dp — the OPEN interval: units in [1, 1e18 − 1]. `0` and `1`
 * are excluded by construction because either produces a zero reserve (that
 * rejection is `openMarket`'s PRICE_RE boundary, T3b's subject, not this
 * module's). */
const openingPriceArb: fc.Arbitrary<string> = stratBig(
	BigInt(1),
	SCALE - BigInt(1),
).map(decimalString);

/** T a WHOLE number of Đ, 1 … 1e9. On an integer tank `p · T` has ≤ 18 dp, so
 * `floor18` is EXACT and `p_yes` lands on `p` with no residue at all — the arm
 * that pins property 4 as an EQUALITY. D-14's own tank (100,000) is here. */
const wholeTankArb: fc.Arbitrary<string> = stratBig(BigInt(1), pow10(9)).map(
	(k) => decimalString(k * SCALE),
);

/** T an arbitrary 18-dp value ≥ 1 Đ, ≤ 1e9 Đ. `p · T` then generally has 36
 * significant fractional digits, `floor18` drops up to one ulp, and property 4
 * degrades from equality to a ≤ 1-ulp bound. The 1 Đ floor is what makes that
 * bound provable: the flooring residue is divided by T, so a sub-Đ tank would
 * AMPLIFY it (the same 1/total amplification `_arbitraries.ts`'s
 * `OQ5_RESERVE_MIN` exists to bound). */
const tankArb: fc.Arbitrary<string> = stratBig(SCALE, pow10(27)).map(
	decimalString,
);

/** Reserve pair + a positive amount for `addLiquidity`. REUSES the exported
 * `crossConsistencyBuyScenario` — its reserves carry the 1 Đ floor (pool total
 * ≥ 2 Đ) and its stake is a positive 18-dp amount, which is exactly the
 * `addLiquidity` domain. The 1 Đ floor is load-bearing for property 1: the
 * floored `S′`'s residue enters the price divided by the post-add pool total,
 * so a sub-Đ pool would amplify a sub-ulp residue past one ulp and red a
 * correct implementation. */
const liquidityScenario: fc.Arbitrary<{ reserves: Reserves; amount: string }> =
	crossConsistencyBuyScenario.map(({ reserves, stake }) => ({
		reserves,
		amount: stake,
	}));

// ─── shared assertion bodies (used by BOTH the generative and the fixed cases,
//     so the 90:1 pair is checked by the identical code path) ────────────────

type AddLiquidityOut = {
	reserves: Reserves;
	backingMinted: string;
	discardedYes: string;
	discardedNo: string;
};

/** Property 1 — the ADR §A price-preservation claim, at the R4 tolerance. */
function assertPriceInvariance(reserves: Reserves, out: AddLiquidityOut): void {
	const before = getPrices(reserves);
	const after = getPrices(out.reserves);
	expectAll18dp(before.yes, before.no, after.yes, after.no);
	expect(absDiff(toUnits(after.yes), toUnits(before.yes))).toBeLessThanOrEqual(
		ULP,
	);
	expect(absDiff(toUnits(after.no), toUnits(before.no))).toBeLessThanOrEqual(
		ULP,
	);
}

/**
 * Property 3 — the load-bearing one. `a` Đ deposited mints `a` pairs; the long
 * side takes all `a`, the short side takes `S′ − S`, and the remainder is
 * DISCARDED. The identity `(S′ − S) + discarded == a` is what a "round both
 * sides independently" implementation fails: it would compute `discarded` as
 * `floor18(a · (1 − S/L))` and leave an unaccounted residue that the backing
 * identity (ADR §E) can never close over.
 */
function assertBackingCloses(
	reserves: Reserves,
	amount: string,
	out: AddLiquidityOut,
): void {
	expectAll18dp(
		out.reserves.yes,
		out.reserves.no,
		out.backingMinted,
		out.discardedYes,
		out.discardedNo,
	);

	const a = toUnits(amount);
	const yBefore = toUnits(reserves.yes);
	const nBefore = toUnits(reserves.no);
	// Ties → `yes` is the long side (contract §1: S/L = 1, discard 0).
	const longIsYes = yBefore >= nBefore;

	const beforeLong = longIsYes ? yBefore : nBefore;
	const beforeShort = longIsYes ? nBefore : yBefore;
	const afterLong = toUnits(longIsYes ? out.reserves.yes : out.reserves.no);
	const afterShort = toUnits(longIsYes ? out.reserves.no : out.reserves.yes);
	const discardLong = toUnits(longIsYes ? out.discardedYes : out.discardedNo);
	const discardShort = toUnits(longIsYes ? out.discardedNo : out.discardedYes);

	// The long side absorbs the whole amount, exactly.
	expect(afterLong - beforeLong).toBe(a);
	// The discard lands on the SHORT side, and only there.
	expect(discardLong).toBe(BigInt(0));
	expect(discardShort).toBeGreaterThanOrEqual(BigInt(0));
	// Neither reserve ever shrinks.
	expect(afterShort).toBeGreaterThanOrEqual(beforeShort);
	// THE identity: every minted pair is either in the pool or discarded.
	expect(afterShort - beforeShort + discardShort).toBe(a);
	// `a` Đ deposited ⇒ `a` pairs minted.
	expect(toUnits(out.backingMinted)).toBe(a);
}

describe("liquidity.property — ADR-0047 §A/§B reserve placement (T1b)", () => {
	it("liquidity::price-invariance-across-fuzzed-reserve-pairs", () => {
		fc.assert(
			fc.property(liquidityScenario, ({ reserves, amount }) => {
				assertPriceInvariance(reserves, addLiquidity({ reserves, amount }));
			}),
			{ seed: SEED, numRuns: LIQ_NUM_RUNS },
		);
	});

	it("liquidity::backing-closes-exactly-across-fuzzed-reserve-pairs", () => {
		fc.assert(
			fc.property(liquidityScenario, ({ reserves, amount }) => {
				assertBackingCloses(
					reserves,
					amount,
					addLiquidity({ reserves, amount }),
				);
			}),
			{ seed: SEED, numRuns: LIQ_NUM_RUNS },
		);
	});

	// Property 2 — the skewed pairs the ADR names, PINNED rather than left to
	// the generator. `(90000, 1000)` is ADR §Acceptance's "including 90:1";
	// `(90000, 10000)` is D-14's own opening pool. Both run the identical
	// assertion bodies as the fuzz above, plus the explicit reserve arithmetic.
	const SKEWED: ReadonlyArray<{ label: string; reserves: Reserves }> = [
		{
			label: "90:1",
			reserves: {
				yes: "90000.000000000000000000",
				no: "1000.000000000000000000",
			},
		},
		{
			label: "D-14 9:1",
			reserves: {
				yes: "90000.000000000000000000",
				no: "10000.000000000000000000",
			},
		},
	];
	// A mix of amounts that DO and do NOT divide evenly by the ratio: a/9 and
	// a/90 terminate for the first two and recur for the rest, so the floored
	// `S′` path is genuinely exercised rather than dodged.
	const AMOUNTS = [
		"9000.000000000000000000",
		"90000.000000000000000000",
		"1.000000000000000000",
		"1000.000000000000000000",
		"7777.777777777777777777",
		"0.000000000000000001",
	];

	for (const { label, reserves } of SKEWED) {
		for (const amount of AMOUNTS) {
			it(`liquidity::skewed-pair-${label}-holds-both-properties-at-a=${amount}`, () => {
				const out = addLiquidity({ reserves, amount });
				assertPriceInvariance(reserves, out);
				assertBackingCloses(reserves, amount, out);
				// On both pairs `yes` is the long side, so the discard is on `no`
				// — the direction that matters, stated rather than derived.
				expect(out.discardedYes).toBe("0.000000000000000000");
			});
		}
	}

	it("liquidity::opening-reserves-hits-the-opening-price-exactly-on-a-whole-tank", () => {
		// On an integer tank `p · T` is representable at 18 dp, `floor18` is a
		// no-op, and `p_yes = no / T = p` EXACTLY. This is the arm that covers
		// the product: every tank ADR §Constants names is a whole number of Đ.
		fc.assert(
			fc.property(openingPriceArb, wholeTankArb, (openingPriceYes, tank) => {
				const out = openingReserves({ openingPriceYes, tank });
				expectAll18dp(
					out.reserves.yes,
					out.reserves.no,
					out.backingMinted,
					out.discardedYes,
					out.discardedNo,
				);
				// The tank is fully placed: yes + no == T, exactly, at 18 dp.
				expect(toUnits(out.reserves.yes) + toUnits(out.reserves.no)).toBe(
					toUnits(tank),
				);
				expect(getPrices(out.reserves).yes).toBe(openingPriceYes);
			}),
			{ seed: SEED, numRuns: LIQ_NUM_RUNS },
		);
	});

	it("liquidity::opening-reserves-hits-the-opening-price-within-one-ulp-on-any-tank", () => {
		// ⚠ The general case is a BOUND, not an equality, and plan §4 T1b's
		// property-4 row ("all p ∈ (0,1) at 18 dp") does not say so. `p · T` for
		// two 18-dp values carries up to 36 fractional digits; `floor18` drops
		// the tail, so `p_yes = no / T` sits up to one ulp below `p`. Surfaced
		// rather than papered over — see the return note.
		fc.assert(
			fc.property(openingPriceArb, tankArb, (openingPriceYes, tank) => {
				const out = openingReserves({ openingPriceYes, tank });
				expect(toUnits(out.reserves.yes) + toUnits(out.reserves.no)).toBe(
					toUnits(tank),
				);
				expect(
					absDiff(
						toUnits(getPrices(out.reserves).yes),
						toUnits(openingPriceYes),
					),
				).toBeLessThanOrEqual(ULP);
			}),
			{ seed: SEED, numRuns: LIQ_NUM_RUNS },
		);
	});

	it("liquidity::opening-reserves-closes-the-backing-identity-at-open", () => {
		// ADR §E at t = 0, before any position exists:
		//   Y + D_yes == N + D_no == backingMinted == total Đ deposited.
		// A symmetric open (p = ½) is the special case where both discards are
		// zero — which is exactly why the identity was invisible before this ADR.
		fc.assert(
			fc.property(openingPriceArb, wholeTankArb, (openingPriceYes, tank) => {
				const out = openingReserves({ openingPriceYes, tank });
				const y = toUnits(out.reserves.yes);
				const n = toUnits(out.reserves.no);
				const b = toUnits(out.backingMinted);

				expect(y + toUnits(out.discardedYes)).toBe(b);
				expect(n + toUnits(out.discardedNo)).toBe(b);
				// backingMinted == max(yes, no): the pair-mint count.
				expect(b).toBe(y > n ? y : n);
				// Exactly one side is short, so exactly one discard is non-zero
				// (both are zero only at the symmetric open).
				const dYes = toUnits(out.discardedYes);
				const dNo = toUnits(out.discardedNo);
				expect(dYes === BigInt(0) || dNo === BigInt(0)).toBe(true);
			}),
			{ seed: SEED, numRuns: LIQ_NUM_RUNS },
		);
	});

	it("liquidity::opening-price-of-0.1-puts-the-LARGE-reserve-on-yes", () => {
		// Property 5 — FIXED, not generative, because the failure it guards is
		// not a rounding error: writing `yes = p · T` instead of `(1 − p) · T`
		// type-checks, produces a valid pool, and opens every market on the
		// platform at 90% YES with nothing to error on (plan §9 R2). A side's
		// price is proportional to the OPPOSITE reserve (calculate.ts:36-37), so
		// a LOW p_yes means a LARGE yes-reserve.
		const out = openingReserves({
			openingPriceYes: "0.1",
			tank: "100000",
		});

		expect(out.reserves.yes).toBe("90000.000000000000000000");
		expect(out.reserves.no).toBe("10000.000000000000000000");
		expect(toUnits(out.reserves.yes)).toBeGreaterThan(toUnits(out.reserves.no));

		// The price the admin asked for is the price the pool opens at.
		expect(getPrices(out.reserves).yes).toBe("0.100000000000000000");

		// ADR §Consequences: 90,000 pairs minted, 80,000 NO shares discarded —
		// an 88.89% discard fraction, held by nobody.
		expect(out.backingMinted).toBe("90000.000000000000000000");
		expect(out.discardedYes).toBe("0.000000000000000000");
		expect(out.discardedNo).toBe("80000.000000000000000000");
	});

	it("liquidity::symmetric-open-at-p-one-half-discards-nothing", () => {
		// The reduction the amended cpmm.md §7.1 claims: at p = ½ the asymmetric
		// open IS the old symmetric seed, discard-free. If this reddens, every
		// legacy market's arithmetic has moved.
		const out = openingReserves({
			openingPriceYes: "0.5",
			tank: "200",
		});
		expect(out.reserves.yes).toBe("100.000000000000000000");
		expect(out.reserves.no).toBe("100.000000000000000000");
		expect(out.backingMinted).toBe("100.000000000000000000");
		expect(out.discardedYes).toBe("0.000000000000000000");
		expect(out.discardedNo).toBe("0.000000000000000000");
		expect(getPrices(out.reserves).yes).toBe("0.500000000000000000");
	});
});
