import { describe, expect, it } from "vitest";
import { checkMarketConservation } from "@/server/dharma/conservation";
import { DharmaInputError, DharmaPoolTagError } from "@/server/dharma/errors";
import type { DharmaEntryType } from "@/server/dharma/tags";
import { FLOW_TAGS } from "@/server/dharma/tags";

// ENGINE.5 §5.6 tests-first (TDD RED) — the per-market conservation identity
// (★, plan R-2/A1/A2/A8). Greenfield value imports from
// `@/server/dharma/{conservation,tags,errors}` WILL fail to resolve until
// ENGINE.5 lands; that unresolved-import RED state is the goal (plan §7).
// DB-FREE unit suite — REDs locally.
//
// One subject per file: this file = `checkMarketConservation` + the FLOW_TAGS
// export.
//
// (★)  actual = Σ amount WHERE entryType ∈ FLOW_TAGS (the 5)  ==  netAdminPoolInjection
//   - `uncollectable` is PRESENT-BUT-IGNORED (the audit/forgiveness record,
//     EXCLUDED from the flow sum — plan A1, independently re-derived).
//   - stray pool_seed/pool_unwind in `ledgerFlows` → THROW DharmaPoolTagError
//     (A8, same sentinel as the write path).
//   - stray initial_grant/daily_allowance in `ledgerFlows` → THROW
//     DharmaInputError (bet_id-NULL rows the gathering query MUST exclude).
//   - ok:false is returned ONLY on a numeric mismatch — NEVER on a tag
//     violation (those throw).
//   - all inputs (flow amounts + netAdminPoolInjection) are canonicalized
//     DEFENSIVELY inside the checker (DB strings are NOT assumed canonical),
//     so non-canonical inputs like "-10" / "25" are accepted and compared
//     correctly (plan A9).

// Independent ground truth — the 5 conservation flow tags (plan ★).
// HAND-TRANSCRIBED, not derived from the impl.
const EXPECTED_FLOW_TAGS: readonly DharmaEntryType[] = [
	"bet_stake",
	"bet_payout",
	"void_refund",
	"correction_reverse",
	"correction_apply",
];

describe("FLOW_TAGS", () => {
	it("is exactly the 5 conservation flow tags", () => {
		expect(FLOW_TAGS.length).toBe(5);
		expect([...FLOW_TAGS].sort()).toEqual([...EXPECTED_FLOW_TAGS].sort());
	});
});

describe("checkMarketConservation — happy path (★ holds)", () => {
	it("flows summing to the injection → { ok: true }", () => {
		// (-10) + (+25) + (-5) + (+15) = 25 == injection 25.
		expect(
			checkMarketConservation({
				ledgerFlows: [
					{ amount: "-10", entryType: "bet_stake" },
					{ amount: "25", entryType: "bet_payout" },
					{ amount: "-5", entryType: "correction_reverse" },
					{ amount: "15", entryType: "correction_apply" },
				],
				netAdminPoolInjection: "25",
			}),
		).toEqual({ ok: true });
	});

	it("empty flows balance against a zero injection", () => {
		expect(
			checkMarketConservation({
				ledgerFlows: [],
				netAdminPoolInjection: "0",
			}),
		).toEqual({ ok: true });
	});
});

describe("checkMarketConservation — uncollectable EXCLUDED (worked example, A1)", () => {
	it("the -20 uncollectable is ignored; the 5 flows still balance to 25", () => {
		// Plan worked example: {bet_stake -10, bet_payout +25,
		// correction_reverse -5, uncollectable -20 (IGNORED), correction_apply
		// +15}, injection 25. Σ(flow tags) = (-10)+25+(-5)+15 = 25 == 25.
		// Including the -20 would give 5 ≠ 25 — the exclusion is load-bearing.
		expect(
			checkMarketConservation({
				ledgerFlows: [
					{ amount: "-10", entryType: "bet_stake" },
					{ amount: "25", entryType: "bet_payout" },
					{ amount: "-5", entryType: "correction_reverse" },
					{ amount: "-20", entryType: "uncollectable" },
					{ amount: "15", entryType: "correction_apply" },
				],
				netAdminPoolInjection: "25",
			}),
		).toEqual({ ok: true });
	});
});

describe("checkMarketConservation — numeric mismatch → { ok: false }", () => {
	it("reports pinned expected / actual / discrepancy", () => {
		// Σ(flow tags) = (-10) + 25 = 15 (actual); injection = 20 (expected).
		// discrepancy convention: canonicalize(actual − expected) = 15 - 20 = -5
		// (signed, actual-minus-expected). RATIFIED at CP-1: discrepancy =
		// canonicalize(actual − expected); positive ⇒ user-side flows exceed
		// injection (over-issuance direction).
		expect(
			checkMarketConservation({
				ledgerFlows: [
					{ amount: "-10", entryType: "bet_stake" },
					{ amount: "25", entryType: "bet_payout" },
				],
				netAdminPoolInjection: "20",
			}),
		).toEqual({
			ok: false,
			expected: "20.000000000000000000",
			actual: "15.000000000000000000",
			discrepancy: "-5.000000000000000000",
		});
	});
});

describe("checkMarketConservation — stray pool tag → throws (A8)", () => {
	for (const tag of ["pool_seed", "pool_unwind"] as const) {
		it(`throws DharmaPoolTagError on a stray ${tag}`, () => {
			expect(() =>
				checkMarketConservation({
					ledgerFlows: [
						{ amount: "-10", entryType: "bet_stake" },
						{ amount: "100", entryType: tag },
					],
					netAdminPoolInjection: "25",
				}),
			).toThrow(DharmaPoolTagError);
		});
	}
});

describe("checkMarketConservation — stray bet_id-NULL tag → throws", () => {
	for (const tag of ["initial_grant", "daily_allowance"] as const) {
		it(`throws DharmaInputError on a stray ${tag} (gathering query must exclude it)`, () => {
			expect(() =>
				checkMarketConservation({
					ledgerFlows: [
						{ amount: "-10", entryType: "bet_stake" },
						{ amount: "100", entryType: tag },
					],
					netAdminPoolInjection: "25",
				}),
			).toThrow(DharmaInputError);
		});
	}
});

describe("checkMarketConservation — defensive canonicalization gate (R-CP1-A)", () => {
	it("throws DharmaInputError on an invalid flow amount (DB strings not assumed canonical)", () => {
		expect(() =>
			checkMarketConservation({
				ledgerFlows: [{ amount: "1e5", entryType: "bet_stake" }],
				netAdminPoolInjection: "0",
			}),
		).toThrow(DharmaInputError);
	});
});
