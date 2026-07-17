import { describe, expect, it } from "vitest";

import { BET_MAX_STAKE } from "@/server/config/limits";
import {
	computeBuy,
	computeSell,
	type Reserves,
} from "@/server/cpmm/calculate";
import {
	buildBuyQuote,
	buildSellQuote,
	deriveUnitToWin,
} from "@/server/debate-view/quote";

// UI.A2 §9 slice 2 §5.6 tests-first — the quote substrate's PURE math surface
// (plan §3.2 QuoteDTO + §6 edge cases + §7 test-plan row 2; cpmm.md 2.1.0
// §4/§5/§6.4; SG-2 sell-never-clamped).
//
// PURE / DB-INDEPENDENT (locally-RED → the real RED→GREEN receipt): REDs NOW
// at collection on the greenfield import — `src/server/debate-view/quote.ts`
// does not exist until slice 2 lands — and GREENs the moment it does.
//
// PINNED PUBLIC-API CONTRACT (the implementer matches these names EXACTLY):
//
//   type QuoteDTO =
//     | { kind: "buy";  side: "YES" | "NO"; stake: string; clamped: boolean;
//         shares: string; p0: string; pEff: string; p1: string;
//         impact: string }
//     | { kind: "sell"; side: "YES" | "NO"; shares: string; proceeds: string;
//         p0: string; pEff: string; p1: string; impact: string };
//
//   buildBuyQuote({ reserves, side, stake }): QuoteDTO
//     — applies `clampStakeToMax` BEFORE `computeBuy` (cpmm.md §6.4: on a
//       clamped buy the figures reflect the CLAMPED stake). DTO `stake` = the
//       EFFECTIVE stake; `clamped` = true iff the submitted stake was STRICTLY
//       above BET_MAX_STAKE; stake ≤ max passes through BYTE-IDENTICAL — no
//       re-quantization (plan §3.1/§6). `shares` = computeBuy shares (To-win).
//   buildSellQuote({ reserves, side, shares }): QuoteDTO
//     — NEVER clamps (SG-2: a sell-side clamp anywhere in the diff is a defect
//       by definition); `shares` echoed as submitted; ZERO position coupling —
//       any s > 0 computes (bounds are the composer's + execute path's job).
//   deriveUnitToWin(reserves): { yes: string; no: string }
//     — per-side `computeBuy({ reserves, side, stake: "1" }).shares` — the
//       strip's `TO WIN Đ1 → Đx` substrate (values-log §6 ruling 1 consumer).
//
// Case translation lives IN the quote builder: the DTO `side` is the wire-side
// UPPERCASE "YES" | "NO"; cpmm's `Side` is lowercase (cpmm.md §13) — callers of
// computeBuy/computeSell below translate explicitly. Expected values: the
// E4/E3/unitToWin headline numbers are pinned as cpmm.md §12 / plan §6
// literals; everything else derives via computeBuy/computeSell on the same
// inputs (a hand-pinned string would be fragile). `toEqual` is EXACT-KEY deep
// equality — it also pins the CLOSED wire shape (ratified OQ-2): no reserves
// echo (plan §3.2: "the raw pool pair stays server-side"), no extra fields.

/** cpmm.md §12 E4 pool — p_yes = 0.25, the skewed no-dust vector. */
const E4_RESERVES: Reserves = { yes: "150", no: "50" };
/** cpmm.md §12 E3 pool — E2's post-buy state, the round-trip vector. */
const E3_RESERVES: Reserves = { yes: "90.909090909090909091", no: "110" };
const E3_SHARES = "19.090909090909090909";
/** The plan §6 unitToWin pool — fresh symmetric seed. */
const SYMMETRIC: Reserves = { yes: "100", no: "100" };

// BET_MAX_STAKE re-expressed at exactly 18 dp: numerically EQUAL to the max,
// byte-DIFFERENT from the constant (integer-formed "10000" today) — the
// passthrough byte-identity probe (clamp is STRICTLY `>`, plan §6).
const [maxInt, maxFrac = ""] = BET_MAX_STAKE.split(".");
const AT_MAX_18DP = `${maxInt}.${(maxFrac + "0".repeat(18)).slice(0, 18)}`;

describe("buildBuyQuote — E4 vector (cpmm.md §12: (150,50) buy YES S=10)", () => {
	it("quote-buy::e4-headline-figures-verbatim-clamped-false", () => {
		const dto = buildBuyQuote({
			reserves: E4_RESERVES,
			side: "YES",
			stake: "10",
		});
		// Exact-key equality — pins the full CLOSED buy wire shape plus the §12
		// literals (s = 35 exact, pEff = 2/7, p1 = 12/37, impact = 12/37 − 1/4).
		expect(dto).toEqual({
			kind: "buy",
			side: "YES",
			stake: "10", // echoed byte-identical — ≤ max is never re-quantized
			clamped: false,
			shares: "35.000000000000000000", // To-win: payout if YES wins
			p0: "0.250000000000000000",
			pEff: "0.285714285714285714", // = 2/7, half-even 18 dp
			p1: "0.324324324324324324", // = 12/37
			impact: "0.074324324324324324", // 7.43 points
		});
	});
});

describe("buildBuyQuote — §16.1 clamp surface (plan §3.2/§6; cpmm.md §6.4)", () => {
	it("quote-buy::over-max-clamps-stake-and-figures-reflect-the-clamped-stake", () => {
		// "15000" is strictly above the ratified BET_MAX_STAKE ("10000", OQ-1).
		// §6.4: the caller applies the cap BEFORE computeBuy — every figure in
		// the DTO must be the max-stake computation, never the submitted one.
		const dto = buildBuyQuote({
			reserves: E4_RESERVES,
			side: "YES",
			stake: "15000",
		});
		const atMax = computeBuy({
			reserves: E4_RESERVES,
			side: "yes",
			stake: BET_MAX_STAKE,
		});
		expect(dto).toEqual({
			kind: "buy",
			side: "YES",
			stake: BET_MAX_STAKE, // the EFFECTIVE stake, not the submitted one
			clamped: true, // §16.1: "surfaced in the non-blocking preview"
			shares: atMax.shares,
			p0: atMax.p0,
			pEff: atMax.pEff,
			p1: atMax.p1,
			impact: atMax.impact,
		});
	});

	it("quote-buy::over-max-equals-the-at-max-quote-except-the-clamped-flag", () => {
		// buildBuyQuote(15000) ≡ buildBuyQuote(BET_MAX_STAKE) in every figure;
		// ONLY `clamped` may differ (true vs false).
		const over = buildBuyQuote({
			reserves: E4_RESERVES,
			side: "YES",
			stake: "15000",
		});
		const atMax = buildBuyQuote({
			reserves: E4_RESERVES,
			side: "YES",
			stake: BET_MAX_STAKE,
		});
		expect({ ...over, clamped: false }).toEqual(atMax);
	});

	it("quote-buy::at-max-boundary-not-clamped-stake-echoed-byte-identical", () => {
		// Exactly AT the max is NOT above it (`>` strictly, plan §6) — clamped
		// false, input echoed untouched.
		const atMax = buildBuyQuote({
			reserves: E4_RESERVES,
			side: "YES",
			stake: BET_MAX_STAKE,
		});
		expect(atMax).toMatchObject({
			kind: "buy",
			clamped: false,
			stake: BET_MAX_STAKE,
		});

		// A numerically-equal-but-byte-different 18-dp form ALSO passes through
		// untouched: "byte-identical" means no re-quantization / normalization,
		// not string equality with the constant (plan §3.1 passthrough law).
		const atMax18 = buildBuyQuote({
			reserves: E4_RESERVES,
			side: "YES",
			stake: AT_MAX_18DP,
		});
		expect(atMax18).toMatchObject({ clamped: false, stake: AT_MAX_18DP });
	});
});

describe("buildSellQuote — E3 round-trip (cpmm.md §12: full sell-back of E2)", () => {
	it("quote-sell::e3-figures-are-computeSell-verbatim", () => {
		const raw = computeSell({
			reserves: E3_RESERVES,
			side: "yes",
			shares: E3_SHARES,
		});
		const dto = buildSellQuote({
			reserves: E3_RESERVES,
			side: "YES",
			shares: E3_SHARES,
		});
		// Exact-key equality — pins the full CLOSED sell wire shape; figures are
		// computeSell VERBATIM (no clamp, no adjustment, no reserves echo).
		expect(dto).toEqual({
			kind: "sell",
			side: "YES",
			shares: E3_SHARES, // echoed as submitted
			proceeds: raw.proceeds,
			p0: raw.p0,
			pEff: raw.pEff,
			p1: raw.p1,
			impact: raw.impact,
		});

		// The E3 headline literals (cpmm.md §12) — so the derived tie above
		// cannot drift from the spec vector silently.
		if (dto.kind !== "sell") throw new Error("expected a sell quote");
		expect(dto.proceeds).toBe("9.999999999999999999"); // M = S − 1 ulp
		expect(dto.p1).toBe("0.500000000000000000"); // back to spot 0.5
	});
});

describe("buildSellQuote — SG-2: sell is NEVER clamped", () => {
	it("quote-sell::shares-above-max-echoed-uncapped-proceeds-computeSell-verbatim", () => {
		// "15000" > BET_MAX_STAKE — a BUY at this magnitude clamps; the sell
		// quote MUST NOT (SG-2 / SPEC.1 §7/§16.1 verbatim). Zero position
		// coupling: s exceeding any real holding still computes (pure math over
		// public reserves; I-NO-OVERSELL enforcement lives on the execute path).
		const raw = computeSell({
			reserves: SYMMETRIC,
			side: "yes",
			shares: "15000",
		});
		const dto = buildSellQuote({
			reserves: SYMMETRIC,
			side: "YES",
			shares: "15000",
		});
		expect(dto).toEqual({
			kind: "sell",
			side: "YES",
			shares: "15000", // echoed byte-identical — no cap anywhere
			proceeds: raw.proceeds,
			p0: raw.p0,
			pEff: raw.pEff,
			p1: raw.p1,
			impact: raw.impact,
		});
		// No clamp surface EXISTS on the sell variant (greppable SG-2 pin).
		expect("clamped" in dto).toBe(false);
	});
});

describe("deriveUnitToWin — per-side computeBuy(stake: '1').shares (plan §3.2)", () => {
	it("unit-to-win::symmetric-100-100-pins-the-plan-vector", () => {
		// Plan §6 pinned vector: fresh symmetric pool (100,100) →
		// computeBuy(stake "1").shares = 1.990099009900990099 on BOTH sides.
		expect(deriveUnitToWin(SYMMETRIC)).toEqual({
			yes: "1.990099009900990099",
			no: "1.990099009900990099",
		});
	});

	it("unit-to-win::asymmetric-matches-per-side-computeBuy-stake-1", () => {
		const yes = computeBuy({
			reserves: E4_RESERVES,
			side: "yes",
			stake: "1",
		}).shares;
		const no = computeBuy({
			reserves: E4_RESERVES,
			side: "no",
			stake: "1",
		}).shares;
		expect(deriveUnitToWin(E4_RESERVES)).toEqual({ yes, no });
		// (150,50): YES is the cheap side (p_yes = 0.25) — its Đ1 buys MORE
		// shares than NO's Đ1. Equal values would mean a side-swap bug.
		expect(yes).not.toBe(no);
	});
});
