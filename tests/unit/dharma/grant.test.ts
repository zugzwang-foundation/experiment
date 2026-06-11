import { describe, expect, it } from "vitest";

// GREENFIELD VALUE IMPORTS (the RED drivers): `@/server/dharma/grant` and
// the `INITIAL_USER_DHARMA` export land with ENGINE.13 — until then this
// suite fails to resolve. That unresolved-import RED state is the goal
// (accrual.test.ts / ledger.test.ts precedent).
import { INITIAL_USER_DHARMA } from "@/server/config/limits";
import { DharmaInputError } from "@/server/dharma/errors";
import { validateGrantAmount } from "@/server/dharma/grant";

// ENGINE.13 T6 — sign discipline (@docs/plans/ENGINE.13.md §"Test plan").
// Pure unit, no IO. `validateGrantAmount` is the producer guard mirroring
// `validateCreditAmount` (accrual.ts) exactly: `numericString` parse →
// `DharmaInputError`; strictly positive via `CpmmDecimal` →
// `DharmaInputError`. It discharges ledger.ts's "signup" sign-discipline
// assignment (per-tag sign is producer-owned, never core-enforced) and is
// the T6 leg of the INV-2 contact row (plan §"Thesis invariants touched").

describe("validateGrantAmount — the strictly-positive producer guard (T6)", () => {
	it("accepts the live constant (R3a — the value HARDEN.5 retunes)", () => {
		// The constant is a decimal STRING (never a JS float — CLAUDE.md §2).
		expect(typeof INITIAL_USER_DHARMA).toBe("string");
		expect(() => validateGrantAmount(INITIAL_USER_DHARMA)).not.toThrow();
	});

	it('accepts "1000" (the R3a placeholder value)', () => {
		expect(() => validateGrantAmount("1000")).not.toThrow();
	});

	it('rejects zero ("0") — not strictly positive', () => {
		expect(() => validateGrantAmount("0")).toThrow(DharmaInputError);
	});

	it('rejects negatives ("-1") — a negative grant would be a debit faucet', () => {
		expect(() => validateGrantAmount("-1")).toThrow(DharmaInputError);
	});

	it("rejects the negative-zero landmine (numericString admits '-0'; the sign guard must not)", () => {
		// _probe-decimal-negzero precedent: "-0" is not strictly positive.
		expect(() => validateGrantAmount("-0")).toThrow(DharmaInputError);
	});

	it('rejects exponent notation ("10.5e2") — canonical-form gate', () => {
		expect(() => validateGrantAmount("10.5e2")).toThrow(DharmaInputError);
	});

	it("rejects the empty string", () => {
		expect(() => validateGrantAmount("")).toThrow(DharmaInputError);
	});

	it("rejects non-numeric strings", () => {
		expect(() => validateGrantAmount("abc")).toThrow(DharmaInputError);
	});
});
