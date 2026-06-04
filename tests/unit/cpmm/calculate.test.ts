import { describe, expect, it } from "vitest";

import {
	computeBuy,
	computeResolvedUnwind,
	computeSell,
	getPrices,
	seedPool,
} from "@/server/cpmm/calculate";
import { CpmmDecimal } from "@/server/cpmm/decimal";

// ENGINE.2 §5.6 tests-first (TDD RED) — smoke spot vectors for the pure CPMM
// math module `src/server/cpmm/` (greenfield; these imports WILL fail to
// resolve until ENGINE.2 implements them — that unresolved-import RED state is
// the goal, per the plan's OQ-B reorder).
//
// Vectors lifted VERBATIM from cpmm.md §12 (E1–E5); serialization pinned to
// uniform 18-dp strings by ENGINE.2 OQ-C (`Decimal.toFixed(18)`). E4 is in
// scope per plan amendment A4 (the no-dust k′ = k branch) — superseding the
// checklist's "E1/E2/E3/E5" line.
//
// Scope (plan §7): five functions' spot vectors ONLY. NO property tests, NO
// fast-check, NO verbatim-vector suite — those are ENGINE.3, explicitly
// deferred. One subject per file: this file = calculate.ts; validate.test.ts =
// the error contract.
//
// Invariants touched as spot vectors:
//   - INV-2 exactness: every returned decimal is an exact 18-dp string
//     (decimal.js, never JS floats — CLAUDE.md §2).
//   - INV-C2 k non-decreasing (cpmm.md §11): E2/E3 assert k′ ≥ k via .gte();
//     E4 asserts k′ = k exactly via .eq() (the no-dust branch).
//   - INV-C4 residual identity (cpmm.md §8.1/§11): E5 asserts the resolved
//     unwind residual equals the winning-side reserve, both branches.

// Every decimal string leaving the module is exactly 18 fractional digits
// (cpmm.md §10.3 + OQ-C). Local helper — no new fixture machinery (plan scope).
const DP18 = /^\d+\.\d{18}$/;

function expect18dp(value: string): void {
	expect(value).toMatch(DP18);
}

describe("seedPool (E1)", () => {
	it("seeds symmetric reserves at 18 dp", () => {
		const reserves = seedPool("100");
		expect(reserves).toEqual({
			yes: "100.000000000000000000",
			no: "100.000000000000000000",
		});
	});

	it("returns 18-dp reserve strings", () => {
		const reserves = seedPool("100");
		expect18dp(reserves.yes);
		expect18dp(reserves.no);
	});
});

describe("getPrices (E1)", () => {
	it("reads 0.5 / 0.5 off a 50/50 pool", () => {
		const prices = getPrices({ yes: "100", no: "100" });
		expect(prices).toEqual({
			yes: "0.500000000000000000",
			no: "0.500000000000000000",
		});
	});

	it("returns 18-dp price strings", () => {
		const prices = getPrices({ yes: "100", no: "100" });
		expect18dp(prices.yes);
		expect18dp(prices.no);
	});
});

describe("computeBuy — YES, stake 10, from (100, 100) (E2)", () => {
	const out = computeBuy({
		reserves: { yes: "100", no: "100" },
		side: "yes",
		stake: "10",
	});

	it("floors shares to 18 dp (s = 19.0909… repeating)", () => {
		expect(out.shares).toBe("19.090909090909090909");
	});

	it("derives reserves from the floored share (dust to pool)", () => {
		expect(out.reserves).toEqual({
			yes: "90.909090909090909091",
			no: "110.000000000000000000",
		});
	});

	it("reports the price bundle p0 / pEff / p1 / impact", () => {
		expect(out.p0).toBe("0.500000000000000000");
		expect(out.pEff).toBe("0.523809523809523810");
		expect(out.p1).toBe("0.547511312217194570");
		expect(out.impact).toBe("0.047511312217194570");
	});

	it("returns every output as an 18-dp string", () => {
		expect18dp(out.shares);
		expect18dp(out.reserves.yes);
		expect18dp(out.reserves.no);
		expect18dp(out.p0);
		expect18dp(out.pEff);
		expect18dp(out.p1);
		expect18dp(out.impact);
	});

	it("INV-C2: k′ ≥ k — rounding dust accrues to the pool", () => {
		const kPrime = new CpmmDecimal(out.reserves.yes).times(out.reserves.no);
		const k0 = new CpmmDecimal("100").times("100");
		expect(kPrime.gte(k0)).toBe(true);
	});
});

describe("computeSell — full sell-back of E2's shares (E3)", () => {
	const out = computeSell({
		reserves: { yes: "90.909090909090909091", no: "110" },
		side: "yes",
		shares: "19.090909090909090909",
	});

	it("floors proceeds to 18 dp (round-trip returns S − 1 ulp)", () => {
		expect(out.proceeds).toBe("9.999999999999999999");
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

	it("returns every output as an 18-dp string", () => {
		expect18dp(out.proceeds);
		expect18dp(out.reserves.yes);
		expect18dp(out.reserves.no);
		expect18dp(out.p0);
		expect18dp(out.pEff);
		expect18dp(out.p1);
		expect18dp(out.impact);
	});

	it("INV-C2: k′ ≥ k across the sell", () => {
		const kPrime = new CpmmDecimal(out.reserves.yes).times(out.reserves.no);
		const k0 = new CpmmDecimal("90.909090909090909091").times("110");
		expect(kPrime.gte(k0)).toBe(true);
	});
});

describe("computeBuy — YES, stake 10, from (150, 50) — no-dust branch (E4)", () => {
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

	it("reports the price bundle from the skewed (150, 50) pool", () => {
		expect(out.p0).toBe("0.250000000000000000");
		expect(out.pEff).toBe("0.285714285714285714");
		expect(out.p1).toBe("0.324324324324324324");
		expect(out.impact).toBe("0.074324324324324324");
	});

	it("returns every output as an 18-dp string", () => {
		expect18dp(out.shares);
		expect18dp(out.reserves.yes);
		expect18dp(out.reserves.no);
		expect18dp(out.p0);
		expect18dp(out.pEff);
		expect18dp(out.p1);
		expect18dp(out.impact);
	});

	it("INV-C2: k′ = k exactly — s was exact, no dust", () => {
		const kPrime = new CpmmDecimal(out.reserves.yes).times(out.reserves.no);
		const k0 = new CpmmDecimal("150").times("50");
		expect(kPrime.eq(k0)).toBe(true);
	});
});

describe("computeResolvedUnwind — E2 post-state, both branches (E5)", () => {
	const reserves = {
		yes: "90.909090909090909091",
		no: "110.000000000000000000",
	};

	it("INV-C4: YES wins ⇒ residual = the YES reserve", () => {
		const out = computeResolvedUnwind({ reserves, outcome: "yes" });
		expect(out.residual).toBe("90.909090909090909091");
	});

	it("INV-C4: NO wins ⇒ residual = the NO reserve", () => {
		const out = computeResolvedUnwind({ reserves, outcome: "no" });
		expect(out.residual).toBe("110.000000000000000000");
	});

	it("returns an 18-dp residual string", () => {
		expect18dp(computeResolvedUnwind({ reserves, outcome: "yes" }).residual);
		expect18dp(computeResolvedUnwind({ reserves, outcome: "no" }).residual);
	});
});
