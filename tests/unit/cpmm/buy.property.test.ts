import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { computeBuy } from "@/server/cpmm/calculate";
import {
	buyScenario,
	impactParityScenario,
	materialBuyScenario,
	NUM_RUNS,
	orderedStakePairScenario,
	SCALE,
	SEED,
	toUnits,
} from "./_arbitraries";

// ENGINE.3 property suite — computeBuy (cpmm.md §4.2; charter rows 2.1–2.3).
// Assertion forms (strict / weak / gap-conditioned) are pinned EXACTLY by the
// ratified plan's rounding-aware table; generators by its Generators section.
// All test-side arithmetic is exact bigint via toUnits — decimal.js / CpmmDecimal
// are NEVER imported, and s / a′ / b′ are never recomputed; every assertion is a
// relation over the module's OWN outputs. fc.assert is fixed
// { seed: SEED, numRuns: NUM_RUNS } (OQ-4). 9a (totality + 18-dp shape) is folded
// into every property: computeBuy never throws on the valid domain and every
// output string is exactly 18 dp.

const DP18 = /^\d+\.\d{18}$/;

function expectAll18dp(...values: string[]): void {
	for (const value of values) {
		expect(value).toMatch(DP18);
	}
}

describe("buy.property — computeBuy (cpmm.md §4.2)", () => {
	it("§4.2.1 — s > S strict (domain gap ≥ ~1e-6 ≫ 1 ulp)", () => {
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
				expect(toUnits(out.shares)).toBeGreaterThan(toUnits(stake));
			}),
			{ seed: SEED, numRuns: NUM_RUNS },
		);
	});

	it("§4.2.2 — price ordering: weak p0 ≤ pEff ≤ p1 (monotone rounding)", () => {
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
				expect(toUnits(out.p0)).toBeLessThanOrEqual(toUnits(out.pEff));
				expect(toUnits(out.pEff)).toBeLessThanOrEqual(toUnits(out.p1));
			}),
			{ seed: SEED, numRuns: NUM_RUNS },
		);
	});

	it("§4.2.2 — price ordering: strict p0 < p1 (material trade)", () => {
		fc.assert(
			fc.property(materialBuyScenario, ({ reserves, side, stake }) => {
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
				expect(toUnits(out.p0)).toBeLessThan(toUnits(out.p1));
			}),
			{ seed: SEED, numRuns: NUM_RUNS },
		);
	});

	it("§4.2.3 — directionality: bought reserve ↓, opposite ↑, p1 < 1", () => {
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
				expect(toUnits(out.reserves[side])).toBeLessThan(
					toUnits(reserves[side]),
				);
				expect(toUnits(out.reserves[opp])).toBeGreaterThan(
					toUnits(reserves[opp]),
				);
				expect(toUnits(out.p1)).toBeLessThan(SCALE);
			}),
			{ seed: SEED, numRuns: NUM_RUNS },
		);
	});

	it("§4.2.3 — monotone impact: weak impact(S₂) ≥ impact(S₁), S₁ < S₂", () => {
		fc.assert(
			fc.property(
				orderedStakePairScenario,
				({ reserves, side, stake1, stake2 }) => {
					const out1 = computeBuy({ reserves, side, stake: stake1 });
					const out2 = computeBuy({ reserves, side, stake: stake2 });
					expectAll18dp(
						out1.shares,
						out1.reserves.yes,
						out1.reserves.no,
						out1.p0,
						out1.pEff,
						out1.p1,
						out1.impact,
						out2.shares,
						out2.reserves.yes,
						out2.reserves.no,
						out2.p0,
						out2.pEff,
						out2.p1,
						out2.impact,
					);
					expect(toUnits(out2.impact)).toBeGreaterThanOrEqual(
						toUnits(out1.impact),
					);
				},
			),
			{ seed: SEED, numRuns: NUM_RUNS },
		);
	});

	it("§4.2.3 — monotone impact: strict impact(S₂) > impact(S₁), S₂ ≥ 2·S₁", () => {
		fc.assert(
			fc.property(
				impactParityScenario,
				({ reserves, side, stake1, stake2 }) => {
					const out1 = computeBuy({ reserves, side, stake: stake1 });
					const out2 = computeBuy({ reserves, side, stake: stake2 });
					expectAll18dp(
						out1.shares,
						out1.reserves.yes,
						out1.reserves.no,
						out1.p0,
						out1.pEff,
						out1.p1,
						out1.impact,
						out2.shares,
						out2.reserves.yes,
						out2.reserves.no,
						out2.p0,
						out2.pEff,
						out2.p1,
						out2.impact,
					);
					expect(toUnits(out2.impact)).toBeGreaterThan(toUnits(out1.impact));
				},
			),
			{ seed: SEED, numRuns: NUM_RUNS },
		);
	});
});
