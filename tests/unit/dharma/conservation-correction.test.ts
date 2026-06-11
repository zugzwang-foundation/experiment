import { describe, expect, it } from "vitest";
import {
	checkCorrectedMarketConservation,
	checkMarketConservation,
} from "@/server/dharma/conservation";
import { DharmaInputError, DharmaPoolTagError } from "@/server/dharma/errors";

// ENGINE.9 §5.6 tests-first (U3, plan §Test plan) — the conservation
// correction-variant (identity (ii), plan §Conservation; S2 option b / C-5).
// `checkCorrectedMarketConservation` is a NEW named export on the EXISTING
// `@/server/dharma/conservation` module (the shipped (★) body untouched) —
// the missing export is the intended RED. DB-FREE unit suite.
//
// Identity (ii), from RECORDED rows only:
//   Σ FLOW == netAdminPoolInjection − reverseRecordedTotal
//                                   + applyRecordedTotal + uncollectableTotal
// where Σ FLOW sums the FLOW_TAGS ledger rows (uncollectable rows are NOT
// flows here — they THROW; the loss is the EXPLICIT `uncollectableTotal`
// operand, never an absorbed row — R-9.6 explicitness over tolerance).
//
// Worked numbers are the S4 fixture (plan §Conservation (ii) shape, re-derived
// for the suite's seed-100 economy): stakes −100 (R) −100 (P) −50 (L);
// resolve-YES payouts +150 (R) +150 (P); correction YES→NO ledger legs:
// reverse −150 (R, full) −40 (P, floored at zero), apply +150 (L);
// uncollectable −110 (P, model A — NOT in flows). unwind = 50 ⇒ injection =
// seed − unwind = 50. reverseRec = Σ|reverse payout legs| = 300 (RECORDED,
// not the floored ledger sum); applyRec = 150; U = 110.
//   Σ FLOW = −250 + 300 − 190 + 150 = 10
//   RHS    = 50 − 300 + 150 + 110  = 10 ✓

const S4_FLOWS = [
	{ amount: "-100", entryType: "bet_stake" },
	{ amount: "-100", entryType: "bet_stake" },
	{ amount: "-50", entryType: "bet_stake" },
	{ amount: "150", entryType: "bet_payout" },
	{ amount: "150", entryType: "bet_payout" },
	{ amount: "-150", entryType: "correction_reverse" },
	{ amount: "-40", entryType: "correction_reverse" },
	{ amount: "150", entryType: "correction_apply" },
] as const;

describe("checkCorrectedMarketConservation — identity (ii) closes", () => {
	it("conservation-correction::s4-worked-example-closes-exactly", () => {
		expect(
			checkCorrectedMarketConservation({
				ledgerFlows: S4_FLOWS,
				netAdminPoolInjection: "50",
				reverseRecordedTotal: "300",
				applyRecordedTotal: "150",
				uncollectableTotal: "110",
			}),
		).toEqual({ ok: true });
	});

	it("conservation-correction::uncollectable-term-is-visible-and-load-bearing", () => {
		// Drop U to zero with everything else fixed: the identity breaks by
		// EXACTLY U (discrepancy = actual − expected = +110 — the over-issuance
		// the floor created, visible as a named operand, R-9.6).
		expect(
			checkCorrectedMarketConservation({
				ledgerFlows: S4_FLOWS,
				netAdminPoolInjection: "50",
				reverseRecordedTotal: "300",
				applyRecordedTotal: "150",
				uncollectableTotal: "0",
			}),
		).toEqual({
			ok: false,
			expected: "-100.000000000000000000",
			actual: "10.000000000000000000",
			discrepancy: "110.000000000000000000",
		});
	});

	it("conservation-correction::numeric-mismatch-reports-exact-discrepancy", () => {
		// Tamper one flow (−40 → −41): Σ FLOW = 9, expected stays 10.
		expect(
			checkCorrectedMarketConservation({
				ledgerFlows: [
					...S4_FLOWS.filter((f) => f.amount !== "-40"),
					{ amount: "-41", entryType: "correction_reverse" },
				],
				netAdminPoolInjection: "50",
				reverseRecordedTotal: "300",
				applyRecordedTotal: "150",
				uncollectableTotal: "110",
			}),
		).toEqual({
			ok: false,
			expected: "10.000000000000000000",
			actual: "9.000000000000000000",
			discrepancy: "-1.000000000000000000",
		});
	});

	it("conservation-correction::degenerates-to-star-when-correction-operands-zero", () => {
		// With reverseRec = applyRec = U = 0 the identity IS (★): same verdict
		// as the shipped checker on the same flows (no correction happened).
		const flows = [
			{ amount: "-10", entryType: "bet_stake" },
			{ amount: "25", entryType: "bet_payout" },
		] as const;
		expect(
			checkCorrectedMarketConservation({
				ledgerFlows: flows,
				netAdminPoolInjection: "15",
				reverseRecordedTotal: "0",
				applyRecordedTotal: "0",
				uncollectableTotal: "0",
			}),
		).toEqual(
			checkMarketConservation({
				ledgerFlows: flows,
				netAdminPoolInjection: "15",
			}),
		);
		expect(
			checkCorrectedMarketConservation({
				ledgerFlows: flows,
				netAdminPoolInjection: "15",
				reverseRecordedTotal: "0",
				applyRecordedTotal: "0",
				uncollectableTotal: "0",
			}),
		).toEqual({ ok: true });
	});
});

describe("checkCorrectedMarketConservation — tag violations THROW", () => {
	it("conservation-correction::uncollectable-row-in-flows-throws", () => {
		// Explicitness over tolerance (R-9.6): the loss is the named operand —
		// an `uncollectable` row inside `ledgerFlows` is a gathering bug.
		expect(() =>
			checkCorrectedMarketConservation({
				ledgerFlows: [
					{ amount: "-10", entryType: "bet_stake" },
					{ amount: "-110", entryType: "uncollectable" },
				],
				netAdminPoolInjection: "0",
				reverseRecordedTotal: "0",
				applyRecordedTotal: "0",
				uncollectableTotal: "110",
			}),
		).toThrow(DharmaInputError);
	});

	for (const tag of ["pool_seed", "pool_unwind"] as const) {
		it(`conservation-correction::stray-${tag}-throws-pool-tag-error`, () => {
			expect(() =>
				checkCorrectedMarketConservation({
					ledgerFlows: [
						{ amount: "-10", entryType: "bet_stake" },
						{ amount: "100", entryType: tag },
					],
					netAdminPoolInjection: "0",
					reverseRecordedTotal: "0",
					applyRecordedTotal: "0",
					uncollectableTotal: "0",
				}),
			).toThrow(DharmaPoolTagError);
		});
	}

	it("conservation-correction::stray-issuance-tag-throws-input-error", () => {
		// bet_id-NULL issuance rows the gathering must exclude (shipped (★)
		// mirror).
		expect(() =>
			checkCorrectedMarketConservation({
				ledgerFlows: [{ amount: "100", entryType: "initial_grant" }],
				netAdminPoolInjection: "100",
				reverseRecordedTotal: "0",
				applyRecordedTotal: "0",
				uncollectableTotal: "0",
			}),
		).toThrow(DharmaInputError);
	});
});

describe("checkCorrectedMarketConservation — A9 defensive canonicalization", () => {
	it("conservation-correction::non-canonical-operands-accepted-and-compared-exactly", () => {
		// DB-sourced strings are NOT assumed canonical: "10" / "-40" /
		// "50.0" forms canonicalize inside the checker (shipped A9 mirror).
		expect(
			checkCorrectedMarketConservation({
				ledgerFlows: [
					{ amount: "-250.0", entryType: "bet_stake" },
					{ amount: "300", entryType: "bet_payout" },
					{
						amount: "-190.000000000000000000",
						entryType: "correction_reverse",
					},
					{ amount: "150", entryType: "correction_apply" },
				],
				netAdminPoolInjection: "50.0",
				reverseRecordedTotal: "300.000000000000000000",
				applyRecordedTotal: "150",
				uncollectableTotal: "110.0",
			}),
		).toEqual({ ok: true });
	});

	it("conservation-correction::invalid-operand-throws-input-error", () => {
		expect(() =>
			checkCorrectedMarketConservation({
				ledgerFlows: [{ amount: "-10", entryType: "bet_stake" }],
				netAdminPoolInjection: "0",
				reverseRecordedTotal: "1e5",
				applyRecordedTotal: "0",
				uncollectableTotal: "0",
			}),
		).toThrow(DharmaInputError);
	});
});
