import { describe, expect, it } from "vitest";

import {
	computeBuy,
	computeResolvedUnwind,
	computeSell,
	getPrices,
	type Reserves,
	seedPool,
} from "@/server/cpmm/calculate";
import { SCALE, toUnits } from "./_arbitraries";

// ENGINE.3 fixed-vector suite (OQ-10): cpmm.md §12 worked examples E1–E5
// re-encoded VERBATIM as their exact 18-dp module-output strings. The frozen
// module is GREEN — these VERIFY it (not TDD RED; a red vector is a STOP, never
// a debugging driver). No fast-check here: §12 pins concrete inputs/outputs.
//
// `k` is derived as the EXACT 36-dp product of the returned reserve strings, in
// scaled bigint (k × 1e36) — never decimal.js, never a parallel curve recompute
// (OQ-6: identities on module outputs only). E5's residual identity is asserted
// in exact bigint.

// Every decimal string leaving the module is exactly 18 fractional digits
// (cpmm.md §10.3); OQ-9a shape gate, re-asserted on each §12 vector.
const DP18 = /^\d+\.\d{18}$/;

function expectAll18dp(...values: string[]): void {
	for (const value of values) {
		expect(value).toMatch(DP18);
	}
}

/** k as the exact product of the 18-dp reserve strings, scaled (k × 1e36). */
function kScaled(reserves: Reserves): bigint {
	return toUnits(reserves.yes) * toUnits(reserves.no);
}

/** An 18-dp k literal lifted to the same 1e36 scale for exact comparison. */
function k36(value: string): bigint {
	return toUnits(value) * SCALE;
}

describe("E1 — seed & spot price (cpmm.md §12)", () => {
	const seeded = seedPool("100");

	it("seeds symmetric reserves (100, 100) at 18 dp", () => {
		expect(seeded).toEqual({
			yes: "100.000000000000000000",
			no: "100.000000000000000000",
		});
		expectAll18dp(seeded.yes, seeded.no);
	});

	it("reads p_yes = p_no = 0.5 off the 50/50 pool", () => {
		const prices = getPrices(seeded);
		expect(prices).toEqual({
			yes: "0.500000000000000000",
			no: "0.500000000000000000",
		});
		expectAll18dp(prices.yes, prices.no);
	});
});

describe("E2 — buy YES, S = 10, from (100, 100) (cpmm.md §12)", () => {
	const out = computeBuy({
		reserves: { yes: "100", no: "100" },
		side: "yes",
		stake: "10",
	});

	it("floors shares to s = 19.090909090909090909", () => {
		expect(out.shares).toBe("19.090909090909090909");
	});

	it("derives reserves from the floored share (dust to pool)", () => {
		expect(out.reserves).toEqual({
			yes: "90.909090909090909091",
			no: "110.000000000000000000",
		});
	});

	it("reports p0 / pEff / p1 / impact verbatim", () => {
		expect(out.p0).toBe("0.500000000000000000");
		expect(out.pEff).toBe("0.523809523809523810");
		expect(out.p1).toBe("0.547511312217194570");
		expect(out.impact).toBe("0.047511312217194570");
	});

	it("INV-C2: k′ = 10000.000000000000000010 exactly (dust ⇒ k′ > k)", () => {
		expect(kScaled(out.reserves)).toBe(k36("10000.000000000000000010"));
		expect(kScaled(out.reserves) > k36("10000.000000000000000000")).toBe(true);
	});

	it("returns every output as an 18-dp string", () => {
		expectAll18dp(
			out.shares,
			out.reserves.yes,
			out.reserves.no,
			out.p0,
			out.pEff,
			out.p1,
			out.impact,
		);
	});
});

describe("E3 — immediate full sell-back of E2's shares (cpmm.md §12)", () => {
	const startReserves: Reserves = { yes: "90.909090909090909091", no: "110" };
	const out = computeSell({
		reserves: startReserves,
		side: "yes",
		shares: "19.090909090909090909",
	});

	it("floors proceeds to M = 9.999999999999999999 (S − 1 ulp)", () => {
		expect(out.proceeds).toBe("9.999999999999999999");
	});

	it("§5.3 round-trip: M ≤ S — dust retained by the pool", () => {
		expect(toUnits(out.proceeds) <= toUnits("10.000000000000000000")).toBe(
			true,
		);
	});

	it("derives post-sell reserves (dust retained)", () => {
		expect(out.reserves).toEqual({
			yes: "100.000000000000000001",
			no: "100.000000000000000001",
		});
	});

	it("returns the sold side back to spot 0.5", () => {
		expect(out.p1).toBe("0.500000000000000000");
	});

	it("INV-C2: k″ ≥ k across the sell", () => {
		expect(kScaled(out.reserves) >= kScaled(startReserves)).toBe(true);
	});

	it("returns every output as an 18-dp string", () => {
		expectAll18dp(
			out.proceeds,
			out.reserves.yes,
			out.reserves.no,
			out.p0,
			out.pEff,
			out.p1,
		);
	});
});

describe("E4 — skewed no-dust buy YES, S = 10, from (150, 50) (cpmm.md §12)", () => {
	const out = computeBuy({
		reserves: { yes: "150", no: "50" },
		side: "yes",
		stake: "10",
	});

	it("yields an exact integer share count (s = 35)", () => {
		expect(out.shares).toBe("35.000000000000000000");
	});

	it("derives clean integer reserves", () => {
		expect(out.reserves).toEqual({
			yes: "125.000000000000000000",
			no: "60.000000000000000000",
		});
	});

	it("reports the skewed-pool price bundle verbatim", () => {
		expect(out.p0).toBe("0.250000000000000000");
		expect(out.pEff).toBe("0.285714285714285714");
		expect(out.p1).toBe("0.324324324324324324");
		expect(out.impact).toBe("0.074324324324324324");
	});

	it("INV-C2: k′ = k = 7500 exactly — s was exact, no dust", () => {
		expect(kScaled(out.reserves)).toBe(k36("7500.000000000000000000"));
		expect(kScaled(out.reserves)).toBe(kScaled({ yes: "150", no: "50" }));
	});

	it("returns every output as an 18-dp string", () => {
		expectAll18dp(
			out.shares,
			out.reserves.yes,
			out.reserves.no,
			out.p0,
			out.pEff,
			out.p1,
			out.impact,
		);
	});
});

describe("E5 — resolution residual on E2's post-state, both branches (cpmm.md §12)", () => {
	const reserves: Reserves = {
		yes: "90.909090909090909091",
		no: "110.000000000000000000",
	};
	// D = seed 100 + stake 10 = 110 (cpmm.md §8.1: D = seed + Σstakes − Σproceeds).
	const D =
		toUnits("100.000000000000000000") + toUnits("10.000000000000000000");
	const userYesHoldings = "19.090909090909090909"; // = D − YES reserve (E2)

	it("ties D = seed + stake = 110", () => {
		expect(D).toBe(toUnits("110.000000000000000000"));
	});

	it("INV-C4: YES wins ⇒ residual = YES reserve; holdings + unwind = D", () => {
		const { residual } = computeResolvedUnwind({ reserves, outcome: "yes" });
		expect(residual).toBe("90.909090909090909091");
		expect(toUnits(userYesHoldings) + toUnits(residual)).toBe(D);
		expectAll18dp(residual);
	});

	it("INV-C4: NO wins ⇒ residual = NO reserve; 0 holdings + unwind = D", () => {
		const { residual } = computeResolvedUnwind({ reserves, outcome: "no" });
		expect(residual).toBe("110.000000000000000000");
		expect(BigInt(0) + toUnits(residual)).toBe(D); // 0 NO holdings + unwind = D
		expectAll18dp(residual);
	});
});
