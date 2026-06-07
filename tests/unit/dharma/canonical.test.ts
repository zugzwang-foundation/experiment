import { describe, expect, it } from "vitest";

import { canonicalize } from "@/server/dharma/canonical";
import { DharmaInputError } from "@/server/dharma/errors";

// ENGINE.5 §5.6 tests-first (TDD RED) — the Dharma canonicalization contract.
// Greenfield value imports from `@/server/dharma/canonical` + `errors` WILL
// fail to resolve until ENGINE.5 lands those modules; that unresolved-import
// RED state is the goal (plan §7 RED-limitation line — this is a DB-FREE unit
// suite that REDs locally, the DB-backed twins are CI-gated).
//
// One subject per file: this file = `canonicalize` (AGENTS.md §9
// `<subject>.test.ts`). The thrown type is pinned with
// `.toThrow(DharmaInputError)` (not a substring), mirroring
// cpmm/validate.test.ts — a regression that throws a bare Error fails.
//
// Contract (plan "Canonicalization spec (D-1 simplified)"):
//   canonicalize(value) = numericString gate (reused VERBATIM from
//   @/server/events/schemas) → new CpmmDecimal(value).toFixed(18). Output is
//   ALWAYS exactly 18 fractional digits, leading zeros collapsed, -0 / 0.0
//   normalized to unsigned zero (PROBE-1, decimal.js 10.6.0). Inputs with
//   ≤18 fractional digits are exact pad-only (no rounding).
//
// `numericString` regex /^-?\d{1,20}(?:\.\d{1,18})?$/ admits the distinct
// strings "-0", "0", "0.0", "007" (one value, many spellings) — canonicalize
// collapses them. It REJECTS ".5" (no leading int digit), "1e5" (exponent),
// "+1" (leading "+"), "" (empty), "abc" (non-numeric), and a 19-fractional-
// digit string (over the ≤18 bound) — each → DharmaInputError.

describe("canonicalize — zero normalization", () => {
	it("-0 → unsigned zero", () => {
		expect(canonicalize("-0")).toBe("0.000000000000000000");
	});

	it("0.0 → unsigned zero", () => {
		expect(canonicalize("0.0")).toBe("0.000000000000000000");
	});

	it("0 → unsigned zero", () => {
		expect(canonicalize("0")).toBe("0.000000000000000000");
	});
});

describe("canonicalize — leading-zero collapse", () => {
	it("007 → 7", () => {
		expect(canonicalize("007")).toBe("7.000000000000000000");
	});

	it("00.5 → 0.5", () => {
		expect(canonicalize("00.5")).toBe("0.500000000000000000");
	});
});

describe("canonicalize — sign preserved on nonzero", () => {
	it("-1.5 stays negative", () => {
		expect(canonicalize("-1.5")).toBe("-1.500000000000000000");
	});

	it("positive integer pads to 18 dp", () => {
		expect(canonicalize("100")).toBe("100.000000000000000000");
	});
});

describe("canonicalize — pad-only at ≤18 dp (no rounding)", () => {
	it("an exact-18-dp fraction is preserved verbatim", () => {
		// 18 fractional digits already — must round-trip unchanged.
		expect(canonicalize("1.234567890123456789")).toBe("1.234567890123456789");
	});

	it("a short fraction is right-padded to 18 dp", () => {
		expect(canonicalize("0.5")).toBe("0.500000000000000000");
	});
});

describe("canonicalize — invalid input → DharmaInputError", () => {
	const INVALID = [
		".5", // no leading integer digit
		"1e5", // exponent form
		"+1", // leading "+"
		"", // empty
		"abc", // non-numeric
		"1.1234567890123456789", // 19 fractional digits — over the ≤18 bound
		"123456789012345678901", // 21 integer digits — over the ≤20 bound
	];

	for (const bad of INVALID) {
		it(`rejects ${JSON.stringify(bad)}`, () => {
			expect(() => canonicalize(bad)).toThrow(DharmaInputError);
		});
	}
});
