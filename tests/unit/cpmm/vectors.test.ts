import { describe, expect, it } from "vitest";

import {
	addLiquidity,
	computeBuy,
	computeResolvedUnwind,
	computeSell,
	getPrices,
	openingReserves,
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
			out.impact,
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

describe("E6 — asymmetric open, one buy, one injection, both outcomes (cpmm.md §12)", () => {
	// The example E5 said was owed. E1–E5 all sit on a SYMMETRIC seed, where
	// `D_X = 0` and the §8.1 residual identity is indistinguishable from the
	// reserves-only form it replaced. This is the one where the discard terms
	// carry weight — and the NO branch is what shows the cost of omitting them.
	//
	// Every figure is a module OUTPUT re-encoded verbatim, exactly as E1–E5 are.
	// Nothing here is hand-arithmetic.

	const open = openingReserves({
		openingPriceYes: "0.100000000000000000",
		tank: "100000.000000000000000000",
	});
	const buy = computeBuy({
		reserves: open.reserves,
		side: "yes",
		stake: "100.000000000000000000",
	});
	const A = "90530.014868134850929828"; // a = L·(200000/tank − 1)
	const inj = addLiquidity({ reserves: buy.reserves, amount: A });

	it("E6.1: the open places 90,000 / 10,000 and discards 80,000 NO", () => {
		expect(open.reserves).toEqual({
			yes: "90000.000000000000000000",
			no: "10000.000000000000000000",
		});
		// ⚠ THE DEPOSIT IS 90,000, NOT THE 100,000 TANK. The open mints
		// max(yes,no) pairs; the other 80,000 NO shares are destroyed — held by
		// nobody, in no position. That is 88.9% of the short side.
		expect(open.backingMinted).toBe("90000.000000000000000000");
		expect(open.discardedNo).toBe("80000.000000000000000000");
		expect(open.discardedYes).toBe("0.000000000000000000");
		expect(getPrices(open.reserves).yes).toBe("0.100000000000000000");
	});

	it("E6.2: a 100 Đ YES buy moves p_yes to 0.101805371203880201", () => {
		expect(buy.shares).toBe("991.089108910891089108");
		expect(buy.reserves).toEqual({
			yes: "89108.910891089108910892",
			no: "10100.000000000000000000",
		});
		expectAll18dp(buy.shares, buy.reserves.yes, buy.reserves.no);
	});

	it("E6.3: the injection preserves the price EXACTLY, to all 18 places", () => {
		// The design claim, on a concrete vector rather than a fuzz bound. Here it
		// is not merely within one ulp — it is identical.
		expect(getPrices(inj.reserves).yes).toBe(getPrices(buy.reserves).yes);
		expect(inj.reserves).toEqual({
			yes: "179638.925759223959840720",
			no: "20361.074240776040159279",
		});
		expect(inj.discardedNo).toBe("80268.940627358810770549");
		expect(inj.discardedYes).toBe("0.000000000000000000");
	});

	it("E6.4: the tank lands one ulp short of target — the floor, not an error", () => {
		// 199999.999999999999999999. The short side is floored, so the sum cannot
		// reach the target exactly; pinning it stops a later reader "fixing" a
		// rounding that is the specification.
		const tank = toUnits(inj.reserves.yes) + toUnits(inj.reserves.no);
		expect(tank).toBe(toUnits("200000.000000000000000000") - BigInt(1));
	});

	it("E6.5: the backing identity closes per side, EXACTLY", () => {
		// Y + H_yes + D_yes == N + H_no + D_no == total Đ deposited, where the
		// deposit is the open's 90,000 PLUS the bettor's 100 PLUS the injection.
		const dYes = toUnits(open.discardedYes) + toUnits(inj.discardedYes);
		const dNo = toUnits(open.discardedNo) + toUnits(inj.discardedNo);

		const yesSide = toUnits(inj.reserves.yes) + toUnits(buy.shares) + dYes;
		const noSide = toUnits(inj.reserves.no) + BigInt(0) + dNo;
		expect(yesSide).toBe(noSide);

		const deposited =
			toUnits(open.backingMinted) +
			toUnits("100.000000000000000000") +
			toUnits(inj.backingMinted);
		expect(yesSide).toBe(deposited);
		expect(deposited).toBe(toUnits("180630.014868134850929828"));
	});

	it("E6.6: NO outcome — unwind = w + D_W, and w ALONE would strand 160,268.94", () => {
		// ⛔ THE POINT OF THE WHOLE EXAMPLE. On the NO branch the winning reserve
		// is 20,361.07 and the winning side's cumulative discard is 160,268.94.
		// The SUPERSEDED form (`unwind = w`) returns the first and abandons the
		// second: 89% of everything deposited, in a resolved market, with no
		// holder and no path out, on a terminal append-only row.
		//
		// On a symmetric seed the two forms agree — which is exactly why five
		// worked examples stood as long as they did without the error showing.
		const D = toUnits("180630.014868134850929828");
		const w = toUnits(inj.reserves.no);
		const dW = toUnits(open.discardedNo) + toUnits(inj.discardedNo);

		expect(w + dW).toBe(D); // unwind == D: nobody holds a NO share
		expect(D - w - dW).toBe(BigInt(0)); // payout == 0

		// And the superseded form, measured: what it would have left behind.
		expect(D - w).toBe(toUnits("160268.940627358810770549"));

		// ⚠ `computeResolvedUnwind` returns the BARE reserve — which is why it is
		// @deprecated. Pinned here as the COUNTEREXAMPLE, not as the answer.
		expect(
			computeResolvedUnwind({ reserves: inj.reserves, outcome: "no" }).residual,
		).toBe(inj.reserves.no);
	});

	it("E6.7: YES outcome — payout is exactly the shares held", () => {
		const D = toUnits("180630.014868134850929828");
		const w = toUnits(inj.reserves.yes);
		const dW = toUnits(open.discardedYes) + toUnits(inj.discardedYes); // 0
		expect(D - w - dW).toBe(toUnits(buy.shares));
	});
});
