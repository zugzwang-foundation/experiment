import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
	computeBuy,
	computeResolvedUnwind,
	computeSell,
	getPrices,
	type Reserves,
	seedPool,
} from "@/server/cpmm/calculate";
import {
	bigMax,
	buyScenario,
	crossConsistencyBuyScenario,
	crossConsistencySellScenario,
	decimalString,
	NUM_RUNS,
	reservesArb,
	SCALE,
	SEED,
	seedArb,
	sellScenario,
	sequenceArb,
	sideArb,
	toUnits,
} from "./_arbitraries";

// ENGINE.3 property suite — cross-cutting invariants INV-C1..C5 (cpmm.md §11) +
// charter line 5 (prices sum to 1; getPrices-vs-p1 cross-consistency). Every
// identity is exact bigint via toUnits — decimal.js / CpmmDecimal NEVER imported,
// and s / M / a′ / b′ are never recomputed; assertions are relations over the
// module's own outputs and spec identities only (OQ-6). fc.assert is fixed
// { seed: SEED, numRuns: NUM_RUNS } (OQ-4); 9a (totality + 18-dp shape) folded in.

const DP18 = /^\d+\.\d{18}$/;

function expectAll18dp(...values: string[]): void {
	for (const value of values) {
		expect(value).toMatch(DP18);
	}
}

// k as the exact 36-dp product of the returned 18-dp reserve strings, in scaled
// bigint (k × 1e36) — never decimal.js, never a curve recompute (OQ-6). Mirrors
// the identically-named helper in vectors.test.ts.
function kScaled(reserves: Reserves): bigint {
	return toUnits(reserves.yes) * toUnits(reserves.no);
}

// |a − b| in scaled units — the ≤ 1-ulp tolerance for the line-5 properties.
function ulpDiff(a: bigint, b: bigint): bigint {
	const d = a - b;
	return d < BigInt(0) ? -d : d;
}

// INV-C3 domain on a buy/sell output: reserves > 0, prices p0/pEff/p1 ∈ (0, 1).
function expectDomain(out: {
	reserves: Reserves;
	p0: string;
	pEff: string;
	p1: string;
}): void {
	expect(toUnits(out.reserves.yes)).toBeGreaterThan(BigInt(0));
	expect(toUnits(out.reserves.no)).toBeGreaterThan(BigInt(0));
	for (const p of [out.p0, out.pEff, out.p1]) {
		expect(toUnits(p)).toBeGreaterThan(BigInt(0));
		expect(toUnits(p)).toBeLessThan(SCALE);
	}
}

describe("invariants.property — INV-C1..C5 + line 5 (cpmm.md §11)", () => {
	it("INV-C1 — conservation (buy): b′ − b == S and a′ == a + S − s_r", () => {
		fc.assert(
			fc.property(buyScenario, ({ reserves, side, stake }) => {
				const out = computeBuy({ reserves, side, stake });
				expectAll18dp(
					out.shares,
					out.reserves.yes,
					out.reserves.no,
					out.p0,
					out.pEff,
					out.p1,
					out.impact,
				);
				const opp = side === "yes" ? "no" : "yes";
				expect(toUnits(out.reserves[opp]) - toUnits(reserves[opp])).toBe(
					toUnits(stake),
				);
				expect(toUnits(out.reserves[side])).toBe(
					toUnits(reserves[side]) + toUnits(stake) - toUnits(out.shares),
				);
			}),
			{ seed: SEED, numRuns: NUM_RUNS },
		);
	});

	it("INV-C1 — conservation (sell): b − b′ == M_r and a′ − a == s − M_r", () => {
		fc.assert(
			fc.property(sellScenario, ({ reserves, side, shares }) => {
				const out = computeSell({ reserves, side, shares });
				expectAll18dp(
					out.proceeds,
					out.reserves.yes,
					out.reserves.no,
					out.p0,
					out.pEff,
					out.p1,
					out.impact,
				);
				const opp = side === "yes" ? "no" : "yes";
				expect(toUnits(reserves[opp]) - toUnits(out.reserves[opp])).toBe(
					toUnits(out.proceeds),
				);
				expect(toUnits(out.reserves[side]) - toUnits(reserves[side])).toBe(
					toUnits(shares) - toUnits(out.proceeds),
				);
			}),
			{ seed: SEED, numRuns: NUM_RUNS },
		);
	});

	it("INV-C2 — k non-decreasing on buy (discharges §4.2.4)", () => {
		fc.assert(
			fc.property(buyScenario, ({ reserves, side, stake }) => {
				const out = computeBuy({ reserves, side, stake });
				expectAll18dp(
					out.shares,
					out.reserves.yes,
					out.reserves.no,
					out.p0,
					out.pEff,
					out.p1,
					out.impact,
				);
				expect(kScaled(out.reserves)).toBeGreaterThanOrEqual(kScaled(reserves));
			}),
			{ seed: SEED, numRuns: NUM_RUNS },
		);
	});

	it("INV-C2 — k non-decreasing on sell (discharges §5.2.4)", () => {
		fc.assert(
			fc.property(sellScenario, ({ reserves, side, shares }) => {
				const out = computeSell({ reserves, side, shares });
				expectAll18dp(
					out.proceeds,
					out.reserves.yes,
					out.reserves.no,
					out.p0,
					out.pEff,
					out.p1,
					out.impact,
				);
				expect(kScaled(out.reserves)).toBeGreaterThanOrEqual(kScaled(reserves));
			}),
			{ seed: SEED, numRuns: NUM_RUNS },
		);
	});

	it("INV-C3 — domain: reserves > 0, p0/pEff/p1 ∈ (0, 1) (buy + sell)", () => {
		fc.assert(
			fc.property(buyScenario, ({ reserves, side, stake }) => {
				const out = computeBuy({ reserves, side, stake });
				expectAll18dp(
					out.shares,
					out.reserves.yes,
					out.reserves.no,
					out.p0,
					out.pEff,
					out.p1,
					out.impact,
				);
				expectDomain(out);
			}),
			{ seed: SEED, numRuns: NUM_RUNS },
		);
		fc.assert(
			fc.property(sellScenario, ({ reserves, side, shares }) => {
				const out = computeSell({ reserves, side, shares });
				expectAll18dp(
					out.proceeds,
					out.reserves.yes,
					out.reserves.no,
					out.p0,
					out.pEff,
					out.p1,
					out.impact,
				);
				expectDomain(out);
			}),
			{ seed: SEED, numRuns: NUM_RUNS },
		);
	});

	it("INV-C4 — solvency / residual identity across a random op sequence", () => {
		fc.assert(
			fc.property(seedArb, sequenceArb, (c, ops) => {
				let reserves = seedPool(c);
				// D = pool Đ balance; at seed reserves (C, C) ⇒ D = C, holdings 0/0.
				let pool = toUnits(c);
				const holdings = { yes: BigInt(0), no: BigInt(0) };

				const checkIdentity = (): void => {
					// INV-C4 / §8.1: holdings[x] == D − reserve[x], exact bigint, both
					// sides — tracked PURELY from module outputs (no curve recompute).
					expect(holdings.yes).toBe(pool - toUnits(reserves.yes));
					expect(holdings.no).toBe(pool - toUnits(reserves.no));
				};
				checkIdentity(); // seed: 0 == C − C, both sides

				for (const op of ops) {
					const opp = op.side === "yes" ? "no" : "yes";
					if (op.kind === "buy") {
						const b = toUnits(reserves[opp]);
						const stake = bigMax(BigInt(1), (b * op.amountNum) / SCALE);
						const out = computeBuy({
							reserves,
							side: op.side,
							stake: decimalString(stake),
						});
						expectAll18dp(
							out.shares,
							out.reserves.yes,
							out.reserves.no,
							out.p0,
							out.pEff,
							out.p1,
							out.impact,
						);
						reserves = out.reserves;
						holdings[op.side] += toUnits(out.shares);
						pool += stake;
					} else {
						const shares = (holdings[op.side] * op.amountNum) / SCALE;
						if (shares === BigInt(0)) {
							continue; // no / sub-ulp holdings ⇒ unsellable; skip (§5.4)
						}
						const out = computeSell({
							reserves,
							side: op.side,
							shares: decimalString(shares),
						});
						expectAll18dp(
							out.proceeds,
							out.reserves.yes,
							out.reserves.no,
							out.p0,
							out.pEff,
							out.p1,
							out.impact,
						);
						reserves = out.reserves;
						holdings[op.side] -= shares;
						pool -= toUnits(out.proceeds);
					}
					checkIdentity();
				}

				// Terminal unwind (pure reads): residual == winning-side reserve, and
				// residual + holdings[outcome] == D — both outcome branches.
				for (const outcome of ["yes", "no"] as const) {
					const { residual } = computeResolvedUnwind({ reserves, outcome });
					expect(residual).toMatch(DP18);
					expect(residual).toBe(reserves[outcome]);
					expect(toUnits(residual) + holdings[outcome]).toBe(pool);
				}
			}),
			{ seed: SEED, numRuns: NUM_RUNS },
		);
	});

	it("INV-C5 — determinism: identical inputs ⇒ identical outputs", () => {
		fc.assert(
			fc.property(buyScenario, (sc) => {
				const out = computeBuy(sc);
				expectAll18dp(
					out.shares,
					out.reserves.yes,
					out.reserves.no,
					out.p0,
					out.pEff,
					out.p1,
					out.impact,
				);
				expect(out).toEqual(computeBuy(sc));
			}),
			{ seed: SEED, numRuns: NUM_RUNS },
		);
		fc.assert(
			fc.property(sellScenario, (sc) => {
				const out = computeSell(sc);
				expectAll18dp(
					out.proceeds,
					out.reserves.yes,
					out.reserves.no,
					out.p0,
					out.pEff,
					out.p1,
					out.impact,
				);
				expect(out).toEqual(computeSell(sc));
			}),
			{ seed: SEED, numRuns: NUM_RUNS },
		);
		fc.assert(
			fc.property(reservesArb, sideArb, (reserves, outcome) => {
				const r1 = computeResolvedUnwind({ reserves, outcome }).residual;
				expect(r1).toMatch(DP18);
				expect(r1).toBe(computeResolvedUnwind({ reserves, outcome }).residual);
			}),
			{ seed: SEED, numRuns: NUM_RUNS },
		);
	});

	it("line 5 — prices sum to 1: |p_yes + p_no − 1| ≤ 1 ulp", () => {
		fc.assert(
			fc.property(reservesArb, (reserves) => {
				const p = getPrices(reserves);
				expectAll18dp(p.yes, p.no);
				expect(
					ulpDiff(toUnits(p.yes) + toUnits(p.no), SCALE),
				).toBeLessThanOrEqual(BigInt(1));
			}),
			{ seed: SEED, numRuns: NUM_RUNS },
		);
	});

	it("line 5 — OQ-5 cross-consistency (buy): |getPrices(reserves′)[side] − p1| ≤ 1 ulp", () => {
		fc.assert(
			fc.property(crossConsistencyBuyScenario, ({ reserves, side, stake }) => {
				const out = computeBuy({ reserves, side, stake });
				expectAll18dp(
					out.shares,
					out.reserves.yes,
					out.reserves.no,
					out.p0,
					out.pEff,
					out.p1,
					out.impact,
				);
				const spot = getPrices(out.reserves)[side];
				expect(spot).toMatch(DP18);
				expect(ulpDiff(toUnits(spot), toUnits(out.p1))).toBeLessThanOrEqual(
					BigInt(1),
				);
			}),
			{ seed: SEED, numRuns: NUM_RUNS },
		);
	});

	it("line 5 — OQ-5 cross-consistency (sell): |getPrices(reserves′)[side] − p1| ≤ 1 ulp", () => {
		fc.assert(
			fc.property(
				crossConsistencySellScenario,
				({ reserves, side, shares }) => {
					const out = computeSell({ reserves, side, shares });
					expectAll18dp(
						out.proceeds,
						out.reserves.yes,
						out.reserves.no,
						out.p0,
						out.pEff,
						out.p1,
						out.impact,
					);
					const spot = getPrices(out.reserves)[side];
					expect(spot).toMatch(DP18);
					expect(ulpDiff(toUnits(spot), toUnits(out.p1))).toBeLessThanOrEqual(
						BigInt(1),
					);
				},
			),
			{ seed: SEED, numRuns: NUM_RUNS },
		);
	});
});
