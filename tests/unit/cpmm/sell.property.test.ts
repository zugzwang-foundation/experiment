import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { computeBuy, computeSell } from "@/server/cpmm/calculate";
import {
	buyScenario,
	materialSellScenario,
	NUM_RUNS,
	SEED,
	sellScenario,
	toUnits,
} from "./_arbitraries";

// ENGINE.3 property suite — computeSell (cpmm.md §5.2/§5.3; charter rows 3.1–3.3
// + the derived round-trip). Assertion forms pinned by the plan's rounding-aware
// table; exact bigint via toUnits ONLY (decimal.js / CpmmDecimal never imported;
// M / a′ / b′ never recomputed). fc.assert fixed { seed: SEED, numRuns: NUM_RUNS }.
// 9a (totality + 18-dp shape) folded into every property.

const DP18 = /^\d+\.\d{18}$/;

function expectAll18dp(...values: string[]): void {
	for (const value of values) {
		expect(value).toMatch(DP18);
	}
}

describe("sell.property — computeSell (cpmm.md §5.2/§5.3)", () => {
	it("§5.2.1/§5.2.2 — proceeds bounds: 0 < M, M < s, M < b, a′ > a", () => {
		// §5.2.1 (real & distinct roots) carries no separate assertion: its
		// observable consequence is that `proceeds` is a finite 18-dp value AND the
		// §5.2.2 bounds hold — a NaN / complex / larger-root result would fail the
		// 18-dp shape gate or these bounds. So shape + §5.2.2 together discharge it.
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
				const m = toUnits(out.proceeds);
				expect(m).toBeGreaterThan(BigInt(0)); // 0 < M
				expect(m).toBeLessThan(toUnits(shares)); // M < s
				expect(m).toBeLessThan(toUnits(reserves[opp])); // M < b (opposite reserve)
				expect(toUnits(out.reserves[side])).toBeGreaterThan(
					toUnits(reserves[side]),
				); // a′ > a
			}),
			{ seed: SEED, numRuns: NUM_RUNS },
		);
	});

	it("§5.2.3 — price ordering: weak p1 ≤ pEff ≤ p0 (monotone rounding)", () => {
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
				expect(toUnits(out.p1)).toBeLessThanOrEqual(toUnits(out.pEff));
				expect(toUnits(out.pEff)).toBeLessThanOrEqual(toUnits(out.p0));
			}),
			{ seed: SEED, numRuns: NUM_RUNS },
		);
	});

	it("§5.2.3 — price ordering: strict p1 < p0 (material trade)", () => {
		fc.assert(
			fc.property(materialSellScenario, ({ reserves, side, shares }) => {
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
				expect(toUnits(out.p1)).toBeLessThan(toUnits(out.p0));
			}),
			{ seed: SEED, numRuns: NUM_RUNS },
		);
	});

	it("§5.3 — round-trip: buy s for S, sell all s back ⇒ M_r ≤ S", () => {
		fc.assert(
			fc.property(buyScenario, ({ reserves, side, stake }) => {
				const buyOut = computeBuy({ reserves, side, stake });
				expectAll18dp(
					buyOut.shares,
					buyOut.reserves.yes,
					buyOut.reserves.no,
					buyOut.p0,
					buyOut.pEff,
					buyOut.p1,
					buyOut.impact,
				);
				const sellOut = computeSell({
					reserves: buyOut.reserves,
					side,
					shares: buyOut.shares,
				});
				expectAll18dp(
					sellOut.proceeds,
					sellOut.reserves.yes,
					sellOut.reserves.no,
					sellOut.p0,
					sellOut.pEff,
					sellOut.p1,
					sellOut.impact,
				);
				expect(toUnits(sellOut.proceeds)).toBeLessThanOrEqual(toUnits(stake));
			}),
			{ seed: SEED, numRuns: NUM_RUNS },
		);
	});
});
