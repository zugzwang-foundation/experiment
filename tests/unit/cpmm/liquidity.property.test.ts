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

// ─── LIQ-1 Phase 2 · T1 — the EXACTNESS contract (plan §3 T1; OD-1 / R1) ────
//
// Everything above is Phase 1's suite and stays green UNCHANGED. Those
// properties are RELATIONS over the module's own outputs — the price moves by
// at most one ulp, the backing closes exactly — and a body that is one ulp low
// satisfies every one of them. That is precisely why they did not catch M-1,
// and it is why this is a new block rather than a tightened tolerance up there.
//
// The claim here is different in KIND: `floor18(S + a·S/L)` must be the EXACT
// floor, not the floor of a precision-50 approximation. Measured (plan §9 M-1):
// where the true quotient lands on an 18-dp boundary AND `a·S` needs more than
// 50 significant digits, decimal.js rounds the PRODUCT first, the quotient
// reads `…09799999999999999999999` instead of `…098`, and `floor18` drops a
// whole ulp — 0.000% below 1e7 reserves, 6.2–6.9% at and above 1e8 in the
// `S == L` family, 0 of 50,000 at the D-14 90:1 skew.
//
// ⛔ THE ORACLE IS INTEGER ARITHMETIC, NOT A SECOND DECIMAL.JS CALL. Checking
// `addLiquidity` against a differently-configured decimal.js would compare one
// approximation against another and agree on every vector where both happen to
// round the same way — the shape of a test that cannot fail. `exactShortAfter`
// is exact by construction: every quantity is an exact multiple of 1e-18 (the
// NUMERIC(38,18) column), so the whole formula is integer arithmetic on scaled
// units, and BigInt division truncates toward zero — which IS floor for the
// strictly-positive operands `requirePositive` admits. There is no ulp for it
// to be low by.
//
// This file is also the reason the T5 SQL↔TS differential
// (`tests/db/cpmm/liquidity-differential.spec.ts`) is allowed to use
// `addLiquidity` as its oracle at all: ADR §A's "two implementations, one
// definition" only means something if the definition side is pinned to
// something that is not an implementation.

/** The vector, measured. `yes = no`, both above 1e8 — the `S == L` family at
 * the magnitude where M-1 bites. */
const M1_RESERVE = "412210715.000275296202860772";
const M1_AMOUNT = "259972213.000482476402074098";
/** `S + a`, exactly. At `S == L` the quotient `a·S/L` IS `a`, so the short side
 * absorbs the whole amount and both reserves land here. */
const M1_EXPECTED = "672182928.000757772604934870";
/** What the shipped precision-50 body answers instead: one ulp low, with a
 * 1e-18 discard that ADR §A's own definition (`discarded = a·(1 − S/L)`) says
 * cannot exist at `S/L = 1`. */
const M1_SHIPPED_WRONG = "672182928.000757772604934869";

/** The EXACT `floor18(S + a·S/L)` in scaled 1e-18 units — integer arithmetic
 * only. BigInt `/` truncates toward zero; all three operands are strictly
 * positive, so truncation is floor. */
function exactShortAfter(l: bigint, s: bigint, a: bigint): bigint {
	return s + (a * s) / l;
}

/** ≥ 10,000 cases (plan §3 T1). Its own literal seed, distinct from the shared
 * `SEED` above — a fuzz that names a defect RATE has to be replayable for the
 * same reason a differential does. */
const P2_SEED = 20260907;
const P2_NUM_RUNS = 10_000;
/** `[1e2, 1e18)` in whole Đ, decade-stratified. `fc.bigInt` draws LINEAR-
 * uniformly, so an unstratified 16-decade window would put ~90% of its mass in
 * the top decade and never visit the magnitudes where M-1 does NOT fire — half
 * of what this property claims. */
const P2_DECADE_MIN = 2;
const P2_DECADE_MAX = 17;

/**
 * The three adversarial families, FORCED rather than hoped for.
 *
 * `S == L` is the one that found M-1, and a run without it agrees everywhere.
 * `L == 2S` is its nearest neighbour with a terminating quotient. `90:1` is ADR
 * §Acceptance's named skew, where the measured M-1 rate is 0 of 50,000 — i.e.
 * the family that must STAY exact, so a fix cannot buy correctness at one ratio
 * by losing it at another. `free` is the unconstrained control.
 */
type ExactFamily = "S==L" | "L==2S" | "90:1" | "free";
const EXACT_FAMILIES: readonly ExactFamily[] = [
	"S==L",
	"L==2S",
	"90:1",
	"free",
];

/** A whole-Đ magnitude in `[1e2, 1e18)` with an arbitrary 18-dp tail, as scaled
 * units. The fractional tail is not decoration: an integer-valued reserve keeps
 * `a·S` inside 50 significant digits and hides the defect entirely. */
const magnitudeUnitsArb: fc.Arbitrary<bigint> = fc
	.integer({ min: P2_DECADE_MIN, max: P2_DECADE_MAX })
	.chain((d) =>
		fc.tuple(
			fc.bigInt({ min: pow10(d), max: pow10(d + 1) - BigInt(1) }),
			fc.bigInt({ min: BigInt(0), max: SCALE - BigInt(1) }),
		),
	)
	.map(([whole, frac]) => whole * SCALE + frac);

/** Place a family's `(L, S)` onto the `(yes, no)` columns. `yesIsLong` runs
 * BOTH orientations through every family: long/short selection is a branch in
 * the subject, and a fuzz that only ever made `yes` long leaves half of it
 * unexercised. */
function placePair(
	family: ExactFamily,
	base: bigint,
	other: bigint,
	yesIsLong: boolean,
): { yes: bigint; no: bigint } {
	let long: bigint;
	let short: bigint;
	if (family === "S==L") {
		long = base;
		short = base;
	} else if (family === "L==2S") {
		long = base;
		short = base / BigInt(2);
	} else if (family === "90:1") {
		long = base;
		short = base / BigInt(90);
	} else {
		long = base >= other ? base : other;
		short = base >= other ? other : base;
	}
	// Unreachable at these magnitudes (base ≥ 1e2 Đ = 1e20 units), but a zero
	// reserve is a `requirePositive` THROW rather than a wrong answer, and a
	// generator that can produce one turns a value assertion into a crash.
	if (short <= BigInt(0)) {
		short = BigInt(1);
	}
	return yesIsLong ? { yes: long, no: short } : { yes: short, no: long };
}

describe("liquidity.property — ADR-0047 §A is EXACT, not precision-50 (T1)", () => {
	it("liquidity::exact-at-symmetric-reserves-above-1e8", () => {
		const out = addLiquidity({
			reserves: { yes: M1_RESERVE, no: M1_RESERVE },
			amount: M1_AMOUNT,
		});

		// THE assertion. At `S == L` the quotient `a·S/L` is `a` exactly, so the
		// short side absorbs the whole amount and BOTH reserves land on `S + a`.
		// There is nothing to round here at all, which is what makes this the
		// clearest available statement of the defect: the answer is not a
		// question of tolerance, it is an addition.
		expect(out.reserves.no).toBe(M1_EXPECTED);
		expect(out.reserves.yes).toBe(M1_EXPECTED);

		// …and therefore NOTHING is discarded. A non-zero discard at `S/L = 1`
		// contradicts ADR §A's own definition of the discard.
		expect(out.discardedNo).toBe("0.000000000000000000");
		expect(out.discardedYes).toBe("0.000000000000000000");

		// Derived rather than transcribed: the constant above is a convenience
		// for the reader, and THIS is the claim.
		expect(toUnits(out.reserves.no)).toBe(
			toUnits(M1_RESERVE) + toUnits(M1_AMOUNT),
		);

		// ⛔ THE SHIPPED ANSWER, NAMED. Without this line a future body wrong in
		// some NEW way could still be one ulp low here, and the failure would
		// read as an arbitrary numeric mismatch. Pinned as the value being
		// rejected, so the diagnosis outlives the fix.
		expect(out.reserves.no).not.toBe(M1_SHIPPED_WRONG);
	});

	it("liquidity::floor-is-exact-across-magnitudes", () => {
		const drawn: Record<ExactFamily, number> = {
			"S==L": 0,
			"L==2S": 0,
			"90:1": 0,
			free: 0,
		};

		fc.assert(
			fc.property(
				fc.constantFrom(...EXACT_FAMILIES),
				magnitudeUnitsArb,
				magnitudeUnitsArb,
				magnitudeUnitsArb,
				fc.boolean(),
				(family, base, other, amountUnits, yesIsLong) => {
					drawn[family] += 1;
					const pair = placePair(family, base, other, yesIsLong);

					const out = addLiquidity({
						reserves: {
							yes: decimalString(pair.yes),
							no: decimalString(pair.no),
						},
						amount: decimalString(amountUnits),
					});

					// Ties go to `yes` — the subject's own rule, not a guess. At
					// `S == L` both branches agree, so this only decides which
					// COLUMN carries the (zero) discard.
					const yesLong = pair.yes >= pair.no;
					const l = yesLong ? pair.yes : pair.no;
					const s = yesLong ? pair.no : pair.yes;
					const sPrime = exactShortAfter(l, s, amountUnits);

					const afterLong = toUnits(
						yesLong ? out.reserves.yes : out.reserves.no,
					);
					const afterShort = toUnits(
						yesLong ? out.reserves.no : out.reserves.yes,
					);
					const discardLong = toUnits(
						yesLong ? out.discardedYes : out.discardedNo,
					);
					const discardShort = toUnits(
						yesLong ? out.discardedNo : out.discardedYes,
					);

					// The long side takes the whole amount — exact add, no rounding.
					expect(afterLong).toBe(l + amountUnits);
					// ⛔ THE LOAD-BEARING LINE: the short side is the EXACT floor.
					expect(afterShort).toBe(sPrime);
					// The discard is the residual OF THE EXACT FLOOR, so the backing
					// identity closes on the corrected value and not on the old one.
					expect(discardLong).toBe(BigInt(0));
					expect(discardShort).toBe(amountUnits - (sPrime - s));
					expect(toUnits(out.backingMinted)).toBe(amountUnits);
				},
			),
			{ seed: P2_SEED, numRuns: P2_NUM_RUNS },
		);

		// ⭐ THE COVERAGE CONTROL. "Forced" is a claim about the RUN, not about
		// the generator's type. A `constantFrom` that silently stopped drawing
		// `S==L` would leave this property green while the only family that finds
		// M-1 went unexercised — a green test proving nothing. Asserted.
		for (const family of EXACT_FAMILIES) {
			expect(drawn[family]).toBeGreaterThan(0);
		}
	});
});
