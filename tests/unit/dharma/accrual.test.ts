import { describe, expect, it } from "vitest";

// GREENFIELD VALUE IMPORTS (the RED drivers): `@/server/dharma/accrual` and
// the `DAILY_CREDIT_DHARMA` export land with ENGINE.12 — until then this
// suite fails to resolve. That unresolved-import RED state is the goal
// (ledger.test.ts precedent).
import { DAILY_CREDIT_DHARMA } from "@/server/config/limits";
import { utcDayOf, validateCreditAmount } from "@/server/dharma/accrual";
import { DharmaInputError } from "@/server/dharma/errors";

// ENGINE.12 T10 — the accrual unit's PURE exports (@docs/plans/ENGINE.12.md
// §"The accrual unit"). No IO, no DB — the local RED proxy for the stratum.
//
//   - `utcDayOf(d: Date): string` — `toISOString().slice(0, 10)`; the day
//     math both decision operands (cursor + tx now()) flow through. UTC
//     boundary behavior is load-bearing: the accrual key is the UTC calendar
//     day, never a local-tz day.
//   - the accrue decision (plan pin): unpaid ⇔ `cursor IS NULL ||
//     utcDayOf(cursor) !== utcDayOf(txNow)`. The decision itself is internal
//     to `accrueDailyCredit` (one locked-snapshot read) — tested here via the
//     pinned utcDayOf-equality semantics, transcribed as independent ground
//     truth (markets/transitions.test.ts precedent).
//   - `validateCreditAmount(amount)` — the P2 producer guard: throws
//     `DharmaInputError` (module-local, `@/server/dharma/errors`) unless the
//     amount is a strictly positive `numericString` (the core enforces only
//     the overdraft floor per ledger.ts:38-39 — sign is producer-owned).

describe("utcDayOf — UTC calendar-day extraction", () => {
	it("end-of-day instant stays on its day (23:59:59.999Z)", () => {
		expect(utcDayOf(new Date("2026-06-10T23:59:59.999Z"))).toBe("2026-06-10");
	});

	it("midnight instant belongs to the NEW day (00:00:00.000Z)", () => {
		expect(utcDayOf(new Date("2026-06-11T00:00:00.000Z"))).toBe("2026-06-11");
	});

	it("month rollover: Jan 31 → Feb 1", () => {
		expect(utcDayOf(new Date("2026-01-31T23:59:59.999Z"))).toBe("2026-01-31");
		expect(utcDayOf(new Date("2026-02-01T00:00:00.000Z"))).toBe("2026-02-01");
	});

	it("year rollover: Dec 31 → Jan 1", () => {
		expect(utcDayOf(new Date("2026-12-31T23:59:59.999Z"))).toBe("2026-12-31");
		expect(utcDayOf(new Date("2027-01-01T00:00:00.000Z"))).toBe("2027-01-01");
	});

	it("an offset-notation instant maps to its UTC day, not the local day", () => {
		// 2026-06-11T01:30+05:30 = 2026-06-10T20:00Z — the UTC day is the 10th.
		expect(utcDayOf(new Date("2026-06-11T01:30:00+05:30"))).toBe("2026-06-10");
	});
});

describe("accrue decision — unpaid ⇔ cursor NULL || utcDayOf(cursor) !== utcDayOf(txNow)", () => {
	// The plan-pinned rule, transcribed verbatim as independent ground truth.
	// Exercised through the real exported `utcDayOf` so the day-equality
	// semantics under test are the implementation's own.
	const unpaidUnderPinnedRule = (cursor: Date | null, txNow: Date): boolean =>
		cursor === null || utcDayOf(cursor) !== utcDayOf(txNow);

	const txNow = new Date("2026-06-10T12:00:00.000Z");

	it("NULL cursor (never paid) → unpaid", () => {
		expect(unpaidUnderPinnedRule(null, txNow)).toBe(true);
	});

	it("same-UTC-day cursor → already paid (any time within the day)", () => {
		expect(
			unpaidUnderPinnedRule(new Date("2026-06-10T00:00:00.000Z"), txNow),
		).toBe(false);
		expect(
			unpaidUnderPinnedRule(new Date("2026-06-10T23:59:59.999Z"), txNow),
		).toBe(false);
	});

	it("prior-day cursor → unpaid", () => {
		expect(
			unpaidUnderPinnedRule(new Date("2026-06-09T23:59:59.999Z"), txNow),
		).toBe(true);
	});

	it("midnight straddle: 1ms across the boundary → unpaid", () => {
		expect(
			unpaidUnderPinnedRule(
				new Date("2026-06-09T23:59:59.999Z"),
				new Date("2026-06-10T00:00:00.000Z"),
			),
		).toBe(true);
	});

	it("year straddle: Dec 31 cursor vs Jan 1 tx → unpaid", () => {
		expect(
			unpaidUnderPinnedRule(
				new Date("2026-12-31T23:59:59.999Z"),
				new Date("2027-01-01T00:00:00.000Z"),
			),
		).toBe(true);
	});
});

describe("validateCreditAmount — the P2 strictly-positive producer guard", () => {
	it("accepts the live constant (P3 — the value HARDEN.5 retunes)", () => {
		// The constant is a decimal STRING (never a JS float — CLAUDE.md §2).
		expect(typeof DAILY_CREDIT_DHARMA).toBe("string");
		expect(() => validateCreditAmount(DAILY_CREDIT_DHARMA)).not.toThrow();
	});

	it('accepts "10" and positive decimals', () => {
		expect(() => validateCreditAmount("10")).not.toThrow();
		expect(() => validateCreditAmount("0.5")).not.toThrow();
		expect(() => validateCreditAmount("12.345678901234567890")).not.toThrow();
		expect(() => validateCreditAmount("0.000000000000000001")).not.toThrow();
	});

	it('rejects zero ("0" and its 18-dp form) — not strictly positive', () => {
		expect(() => validateCreditAmount("0")).toThrow(DharmaInputError);
		expect(() => validateCreditAmount("0.000000000000000000")).toThrow(
			DharmaInputError,
		);
	});

	it("rejects negatives (a negative credit would be a debit faucet)", () => {
		expect(() => validateCreditAmount("-1")).toThrow(DharmaInputError);
		expect(() => validateCreditAmount("-0.000000000000000001")).toThrow(
			DharmaInputError,
		);
	});

	it("rejects the negative-zero landmine (numericString allows '-0'; sign guard must not)", () => {
		// _probe-decimal-negzero precedent: "-0" is not strictly positive.
		expect(() => validateCreditAmount("-0")).toThrow(DharmaInputError);
	});

	it("rejects non-numericStrings", () => {
		expect(() => validateCreditAmount("abc")).toThrow(DharmaInputError);
		expect(() => validateCreditAmount("")).toThrow(DharmaInputError);
		expect(() => validateCreditAmount("1.2.3")).toThrow(DharmaInputError);
		// Canonical-form gate (schemas.ts numericString): no bare-dot leading
		// form, no exponent notation.
		expect(() => validateCreditAmount(".5")).toThrow(DharmaInputError);
		expect(() => validateCreditAmount("1e5")).toThrow(DharmaInputError);
	});
});
