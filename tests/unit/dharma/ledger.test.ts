import { describe, expect, it } from "vitest";

import { dharmaEntryTypeEnum } from "@/db/schema/dharma";
import {
	DharmaInputError,
	DharmaOverdraftError,
	DharmaPoolTagError,
} from "@/server/dharma/errors";
import { computeLedgerRow } from "@/server/dharma/ledger";
import type { DharmaEntryType } from "@/server/dharma/tags";
import { LEDGER_WRITABLE_TAGS, POOL_DORMANT_TAGS } from "@/server/dharma/tags";

// ENGINE.5 §5.6 tests-first (TDD RED) — INV-2 (Dharma no-overdraft + the
// tag-policy half of non-transferable). Greenfield value imports from
// `@/server/dharma/{ledger,tags,errors}` WILL fail to resolve until ENGINE.5
// lands; that unresolved-import RED state is the goal (plan §7). DB-FREE unit
// suite — REDs locally; the DB-backed INV-2 twins (non-transferable,
// I-NO-OVERDRAFT-001) are CI-gated.
//
// One subject per file: this file = `computeLedgerRow` (the pure core) + the
// tag-set classification exports. `import type { DharmaEntryType }` is stripped
// by esbuild and does NOT soften the RED — the value imports fire it.
//
// The 10-tag universe is taken from `dharmaEntryTypeEnum.enumValues` (single
// source of truth, after the R-1 `initial_grant` append). The 8-accept /
// 2-reject classification + FLOW set are HAND-TRANSCRIBED as INDEPENDENT
// ground truth (markets/transitions.test.ts precedent) — expectations are NOT
// derived from the implementation, which would be circular.

// Independent ground truth — plan tag-policy table (8 accept / 2 reject, R-2).
// HAND-TRANSCRIBED, not read from the impl.
const EXPECTED_WRITABLE: readonly DharmaEntryType[] = [
	"initial_grant",
	"daily_allowance",
	"bet_stake",
	"bet_payout",
	"void_refund",
	"correction_reverse",
	"correction_apply",
	"uncollectable",
];
const EXPECTED_POOL_DORMANT: readonly DharmaEntryType[] = [
	"pool_seed",
	"pool_unwind",
];

// === Tag classification (independent ground truth) =========================

describe("tag sets", () => {
	it("the enum universe is the 10-set (9 built + R-1 initial_grant)", () => {
		// Locks the test's universe to the built pgEnum so it cannot drift.
		expect([...dharmaEntryTypeEnum.enumValues].sort()).toEqual(
			[...EXPECTED_WRITABLE, ...EXPECTED_POOL_DORMANT].sort(),
		);
	});

	it("LEDGER_WRITABLE_TAGS is exactly the 8 user-side tags", () => {
		expect(LEDGER_WRITABLE_TAGS.length).toBe(8);
		expect([...LEDGER_WRITABLE_TAGS].sort()).toEqual(
			[...EXPECTED_WRITABLE].sort(),
		);
	});

	it("POOL_DORMANT_TAGS is exactly pool_seed + pool_unwind", () => {
		expect(POOL_DORMANT_TAGS.length).toBe(2);
		expect([...POOL_DORMANT_TAGS].sort()).toEqual(
			[...EXPECTED_POOL_DORMANT].sort(),
		);
	});
});

// === Exact balance math (no rounding) ======================================

describe("computeLedgerRow — exact prev + amount", () => {
	it("integer add", () => {
		expect(
			computeLedgerRow({
				previousBalance: "100",
				amount: "25",
				entryType: "bet_payout",
			}),
		).toEqual({
			amount: "25.000000000000000000",
			balanceAfter: "125.000000000000000000",
		});
	});

	it("18-dp-precision add is exact (no rounding)", () => {
		expect(
			computeLedgerRow({
				previousBalance: "0.000000000000000001",
				amount: "0.000000000000000002",
				entryType: "bet_payout",
			}),
		).toEqual({
			amount: "0.000000000000000002",
			balanceAfter: "0.000000000000000003",
		});
	});

	it("subtraction (a buy stake) is exact", () => {
		expect(
			computeLedgerRow({
				previousBalance: "100",
				amount: "-10",
				entryType: "bet_stake",
			}),
		).toEqual({
			amount: "-10.000000000000000000",
			balanceAfter: "90.000000000000000000",
		});
	});
});

// === Overdraft floor (INV-2 advisory mirror of the storage CHECK) ==========

describe("computeLedgerRow — overdraft → DharmaOverdraftError", () => {
	it("balance-moving tag driving balanceAfter < 0 throws", () => {
		expect(() =>
			computeLedgerRow({
				previousBalance: "5",
				amount: "-10",
				entryType: "bet_stake",
			}),
		).toThrow(DharmaOverdraftError);
	});

	it("exact-zero balanceAfter is allowed (boundary, not overdraft)", () => {
		expect(
			computeLedgerRow({
				previousBalance: "10",
				amount: "-10",
				entryType: "bet_stake",
			}),
		).toEqual({
			amount: "-10.000000000000000000",
			balanceAfter: "0.000000000000000000",
		});
	});
});

// === Input gate (R-CP1-A): both previousBalance AND amount canonicalized ====

describe("computeLedgerRow — input gate (R-CP1-A)", () => {
	it("invalid amount → DharmaInputError", () => {
		expect(() =>
			computeLedgerRow({
				previousBalance: "100",
				amount: "1e5",
				entryType: "bet_payout",
			}),
		).toThrow(DharmaInputError);
	});

	it("invalid previousBalance → DharmaInputError (not assumed pre-canonical)", () => {
		expect(() =>
			computeLedgerRow({
				previousBalance: ".5",
				amount: "10",
				entryType: "bet_payout",
			}),
		).toThrow(DharmaInputError);
	});
});

// === 8-accept / 2-reject tag policy ========================================

describe("computeLedgerRow — 8 writable tags accepted", () => {
	// Each writable tag with a VALID amount returns a computation (no throw).
	// uncollectable is special-cased below (its amount must be ≤ 0), so it is
	// driven with a negative amount here.
	const ACCEPT_CASES: ReadonlyArray<{
		entryType: DharmaEntryType;
		previousBalance: string;
		amount: string;
		expected: { amount: string; balanceAfter: string };
	}> = [
		{
			entryType: "initial_grant",
			previousBalance: "0.000000000000000000",
			amount: "100",
			expected: {
				amount: "100.000000000000000000",
				balanceAfter: "100.000000000000000000",
			},
		},
		{
			entryType: "daily_allowance",
			previousBalance: "50",
			amount: "10",
			expected: {
				amount: "10.000000000000000000",
				balanceAfter: "60.000000000000000000",
			},
		},
		{
			entryType: "bet_stake",
			previousBalance: "50",
			amount: "-10",
			expected: {
				amount: "-10.000000000000000000",
				balanceAfter: "40.000000000000000000",
			},
		},
		{
			entryType: "bet_payout",
			previousBalance: "50",
			amount: "25",
			expected: {
				amount: "25.000000000000000000",
				balanceAfter: "75.000000000000000000",
			},
		},
		{
			entryType: "void_refund",
			previousBalance: "50",
			amount: "10",
			expected: {
				amount: "10.000000000000000000",
				balanceAfter: "60.000000000000000000",
			},
		},
		{
			entryType: "correction_reverse",
			previousBalance: "50",
			amount: "-5",
			expected: {
				amount: "-5.000000000000000000",
				balanceAfter: "45.000000000000000000",
			},
		},
		{
			entryType: "correction_apply",
			previousBalance: "50",
			amount: "15",
			expected: {
				amount: "15.000000000000000000",
				balanceAfter: "65.000000000000000000",
			},
		},
		{
			entryType: "uncollectable",
			previousBalance: "0",
			amount: "-20",
			// special case: balanceAfter = previousBalance (unchanged).
			expected: {
				amount: "-20.000000000000000000",
				balanceAfter: "0.000000000000000000",
			},
		},
	];

	for (const c of ACCEPT_CASES) {
		it(`accepts ${c.entryType}`, () => {
			expect(
				computeLedgerRow({
					previousBalance: c.previousBalance,
					amount: c.amount,
					entryType: c.entryType,
				}),
			).toEqual(c.expected);
		});
	}
});

describe("computeLedgerRow — 2 pool tags rejected", () => {
	for (const tag of EXPECTED_POOL_DORMANT) {
		it(`rejects ${tag} with DharmaPoolTagError`, () => {
			expect(() =>
				computeLedgerRow({
					previousBalance: "100",
					amount: "10",
					entryType: tag,
				}),
			).toThrow(DharmaPoolTagError);
		});
	}
});

// === Note-4 sell-vs-buy (same tag, sign-distinguished) =====================

describe("computeLedgerRow — bet_stake buy vs sell (Note-4)", () => {
	it("buy is a negative bet_stake", () => {
		expect(
			computeLedgerRow({
				previousBalance: "100",
				amount: "-10",
				entryType: "bet_stake",
			}),
		).toEqual({
			amount: "-10.000000000000000000",
			balanceAfter: "90.000000000000000000",
		});
	});

	it("sell is a positive bet_stake (proceeds credited)", () => {
		expect(
			computeLedgerRow({
				previousBalance: "100",
				amount: "5",
				entryType: "bet_stake",
			}),
		).toEqual({
			amount: "5.000000000000000000",
			balanceAfter: "105.000000000000000000",
		});
	});
});

// === bet_payout loss = 0 (OQ-4: zero accepted) =============================

describe("computeLedgerRow — bet_payout loss is 0", () => {
	it("amount 0 leaves balanceAfter = previousBalance", () => {
		expect(
			computeLedgerRow({
				previousBalance: "40",
				amount: "0",
				entryType: "bet_payout",
			}),
		).toEqual({
			amount: "0.000000000000000000",
			balanceAfter: "40.000000000000000000",
		});
	});
});

// === uncollectable special case (OQ-1 model A) + A9 sign guard =============

describe("computeLedgerRow — uncollectable special case", () => {
	it("balanceAfter = previousBalance (unchanged — the one row breaking prev+amount)", () => {
		expect(
			computeLedgerRow({
				previousBalance: "0",
				amount: "-20",
				entryType: "uncollectable",
			}),
		).toEqual({
			amount: "-20.000000000000000000",
			// NOT prev + amount (which would be -20 and overdraw) — it is prev.
			balanceAfter: "0.000000000000000000",
		});
	});

	it("preserves a nonzero previousBalance unchanged", () => {
		expect(
			computeLedgerRow({
				previousBalance: "7.5",
				amount: "-3",
				entryType: "uncollectable",
			}),
		).toEqual({
			amount: "-3.000000000000000000",
			balanceAfter: "7.500000000000000000",
		});
	});

	it("amount 0 is accepted (≤ 0 boundary), balanceAfter = previousBalance", () => {
		expect(
			computeLedgerRow({
				previousBalance: "7.5",
				amount: "0",
				entryType: "uncollectable",
			}),
		).toEqual({
			amount: "0.000000000000000000",
			balanceAfter: "7.500000000000000000",
		});
	});

	it("A9 sign guard: positive uncollectable amount → DharmaInputError", () => {
		// uncollectable bypasses balance arithmetic AND the storage CHECK, so
		// the core's amount ≤ 0 guard is the ONLY defense (plan A9).
		expect(() =>
			computeLedgerRow({
				previousBalance: "0",
				amount: "5",
				entryType: "uncollectable",
			}),
		).toThrow(DharmaInputError);
	});
});

// === First-row grant shape (R-1) ===========================================

describe("computeLedgerRow — first-row initial_grant (R-1)", () => {
	it("prev = canonical zero, amount = +grant ⇒ balanceAfter = amount", () => {
		expect(
			computeLedgerRow({
				previousBalance: "0.000000000000000000",
				amount: "100",
				entryType: "initial_grant",
			}),
		).toEqual({
			amount: "100.000000000000000000",
			balanceAfter: "100.000000000000000000",
		});
	});
});
