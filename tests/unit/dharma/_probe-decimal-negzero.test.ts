import { describe, expect, it } from "vitest";

import { CpmmDecimal } from "@/server/cpmm/decimal";
import { canonicalize } from "@/server/dharma/canonical";

// ENGINE.5 — VENDOR-PIN regression guard (`_probe-*`, AGENTS.md §9): pins the
// decimal.js 10.6.0 behaviour that ENGINE.5's canonicalization RELIES on (the
// PROBE-1 finding that `toFixed(18)` alone normalizes -0 / 0.0 / leading
// zeros, so the explicit isZero() step-4 branch was DROPPED — plan D-1). This
// is NOT a TDD driver; it is a contract guard. A future decimal.js bump that
// regresses -0 handling, or a canonicalize() refactor that loses the
// normalization, goes RED here.
//
// Two layers asserted:
//   1. canonicalize() (greenfield — REDs locally on the unresolved import,
//      same as the DB-free unit twins) — the module-level contract.
//   2. The RAW vendor behaviour through the EXISTING `CpmmDecimal` (the cloned
//      constructor exported from @/server/cpmm/decimal that ENGINE.5 reuses) —
//      isolates that the normalization is the vendor's, not canonicalize's own.
//      This half does NOT depend on the greenfield module.

describe("canonicalize — vendor -0 / leading-zero pin (decimal.js 10.6.0)", () => {
	it("-0, 0.0, and the canonical literal all collapse to unsigned zero", () => {
		expect(canonicalize("-0")).toBe(canonicalize("0.0"));
		expect(canonicalize("-0")).toBe("0.000000000000000000");
	});

	it("007 collapses leading zeros to 7", () => {
		expect(canonicalize("007")).toBe("7.000000000000000000");
	});
});

describe("CpmmDecimal — raw vendor behaviour (decimal.js 10.6.0)", () => {
	it('new CpmmDecimal("-0").toFixed(18) is unsigned zero', () => {
		// PROBE-1: toFixed(18) is the full canonicalizer for -0 — no explicit
		// isZero() branch needed. This is the load-bearing vendor fact.
		expect(new CpmmDecimal("-0").toFixed(18)).toBe("0.000000000000000000");
	});

	it('new CpmmDecimal("0.0").toFixed(18) is unsigned zero', () => {
		expect(new CpmmDecimal("0.0").toFixed(18)).toBe("0.000000000000000000");
	});

	it('new CpmmDecimal("007").toFixed(18) collapses leading zeros', () => {
		expect(new CpmmDecimal("007").toFixed(18)).toBe("7.000000000000000000");
	});
});
