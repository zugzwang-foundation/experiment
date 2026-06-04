import { describe, expect, it } from "vitest";

import { computeBuy, computeSell, seedPool } from "@/server/cpmm/calculate";
import { CpmmInputError } from "@/server/cpmm/errors";

// ENGINE.2 §5.6 tests-first (TDD RED) — the CPMM input-validation error
// contract. Greenfield imports WILL fail to resolve until ENGINE.2 lands the
// module; that unresolved-import RED state is the goal (plan OQ-B).
//
// validate.ts is INTERNAL (not exported) — the contract is exercised THROUGH
// the public functions per cpmm.md §10.5 / §13. We pin the THROWN TYPE with
// `.toThrow(CpmmInputError)` (not just a substring), so a regression that
// throws a bare Error or a product-error code fails the suite.
//
// One subject per file: this file = the error contract; calculate.test.ts =
// the five functions' spot vectors.
//
// Two rejection mechanisms, both surfacing as CpmmInputError (plan
// "Validation semantics"):
//   1. `numericString` safeParse failure — malformed strings.
//      The boundary regex /^-?\d{1,20}(?:\.\d{1,18})?$/ rejects:
//        ".5"  (no leading integer digit)
//        "1e5" (no exponent form)
//        "+1"  (no leading "+")
//        ""    (empty)
//   2. strict positivity (> 0) layered on top — `numericString` is SIGNED and
//      allows "0", so these pass the regex but fail positivity:
//        "-1"  (negative)
//        "0"   (zero)
//
// Coverage spans all four quantity slots the plan enumerates: seed, stake,
// shares, and a reserve (INV-C3 domain gate, cpmm.md §11).

const MALFORMED = [".5", "1e5", "+1", ""];
const NON_POSITIVE = ["-1", "0"];
const BAD_INPUTS = [...MALFORMED, ...NON_POSITIVE];

describe("CpmmInputError — seed (seedPool)", () => {
	for (const bad of BAD_INPUTS) {
		it(`rejects seed ${JSON.stringify(bad)}`, () => {
			expect(() => seedPool(bad)).toThrow(CpmmInputError);
		});
	}
});

describe("CpmmInputError — stake (computeBuy)", () => {
	for (const bad of BAD_INPUTS) {
		it(`rejects stake ${JSON.stringify(bad)}`, () => {
			expect(() =>
				computeBuy({
					reserves: { yes: "100", no: "100" },
					side: "yes",
					stake: bad,
				}),
			).toThrow(CpmmInputError);
		});
	}
});

describe("CpmmInputError — shares (computeSell)", () => {
	for (const bad of BAD_INPUTS) {
		it(`rejects shares ${JSON.stringify(bad)}`, () => {
			expect(() =>
				computeSell({
					reserves: { yes: "100", no: "100" },
					side: "yes",
					shares: bad,
				}),
			).toThrow(CpmmInputError);
		});
	}
});

describe("CpmmInputError — reserve (computeBuy)", () => {
	for (const bad of BAD_INPUTS) {
		it(`rejects a reserve ${JSON.stringify(bad)}`, () => {
			expect(() =>
				computeBuy({
					reserves: { yes: bad, no: "100" },
					side: "yes",
					stake: "10",
				}),
			).toThrow(CpmmInputError);
		});
	}
});
