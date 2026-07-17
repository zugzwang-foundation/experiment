import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
	ComposerDecimal,
	sellSharesFor,
} from "@/components/debate/composer/sell-convert";
import { CpmmDecimal } from "@/server/cpmm/decimal";

// UI.A3 §5.6 tests-first — the sell Đ→shares conversion (plan §3.2 "Sell
// conversion" + §1 I-NO-OVERSELL row + §6 edges + SG-2). PURE /
// DB-INDEPENDENT: REDs NOW on the unresolvable greenfield import and GREENs
// when the module lands. CpmmDecimal IS importable here (server-only is
// shimmed in vitest) and serves as the decimal-equality oracle.
//
// Plan-§1 invariant row asserted here:
//   - I-NO-OVERSELL / I-SINGLE-SIDE — shares derived as
//     quantity × (Đin / currentValue) exact-decimal, CAPPED at quantity
//     (result ≤ quantity always; the server pre-check + storage CHECK stay
//     authoritative). Full exit is BYTE-IDENTICAL passthrough — zero
//     arithmetic, zero rounding drift on the sell-to-zero path (§6 edge).
//   - SG-2 — sell is NEVER clamped: the module carries NO BET_MAX_STAKE /
//     clampStakeToMax code at all (grep-asserted on the module source text).
//
// PINNED PUBLIC-API CONTRACT (the implementer matches these names exactly):
//   ComposerDecimal: unknown
//     — a decimal.js clone: precision 50, ROUND_HALF_EVEN — the CLIENT-side
//       mirror of CpmmDecimal (which is server-only); config parity is
//       asserted against the real CpmmDecimal so the clone can never drift
//       from cpmm.md §10.2.
//   sellSharesFor(args: { quantity: string; currentValue: string;
//     dharmaIn: string }): string
//     — dharmaIn DECIMAL-EQUAL currentValue → returns `quantity`
//       BYTE-IDENTICAL (full exit, zero arithmetic). Partial: shares =
//       quantity × dharmaIn ÷ currentValue via ComposerDecimal exact strings
//       (NEVER JS floats), output at ≤18 decimal places, capped ≤ quantity,
//       and > 0 whenever dharmaIn > 0. THROWS on dharmaIn ≤ 0 / non-numeric
//       (caller bug).
//
// Decimal assertions compare via CpmmDecimal equality where bytes aren't
// pinned; byte-equality (toBe) where the law says byte-identical.

/**
 * Trust-boundary read of the untyped `ComposerDecimal: unknown` export
 * (AGENTS.md §4: the cast is paired with runtime typeof validation). A
 * decimal.js clone constructor carries its config as static `precision` /
 * `rounding` numbers.
 */
function decimalCtorConfig(ctor: unknown): {
	precision: number;
	rounding: number;
} {
	const candidate = ctor as { precision?: unknown; rounding?: unknown };
	if (
		typeof candidate.precision !== "number" ||
		typeof candidate.rounding !== "number"
	) {
		throw new Error(
			"ComposerDecimal is not a decimal.js clone with precision/rounding statics",
		);
	}
	return { precision: candidate.precision, rounding: candidate.rounding };
}

/** Fractional-digit count of a plain decimal string. */
function fracDigits(value: string): number {
	const dot = value.indexOf(".");
	return dot === -1 ? 0 : value.length - dot - 1;
}

describe("ComposerDecimal — config parity with CpmmDecimal (cpmm.md §10.2)", () => {
	it("sell-convert::composer-decimal-matches-cpmm-decimal-config", () => {
		expect(decimalCtorConfig(ComposerDecimal)).toEqual({
			precision: CpmmDecimal.precision,
			rounding: CpmmDecimal.rounding,
		});
	});
});

describe("sellSharesFor — full exit (byte-identical passthrough)", () => {
	it("sell-convert::full-exit-returns-quantity-byte-identical", () => {
		// §6 sell-to-zero edge: shares = quantity EXACTLY — zero conversion
		// rounding. The 18-dp tail bytes must survive untouched.
		expect(
			sellSharesFor({
				quantity: "123.400000000000000000",
				currentValue: "77",
				dharmaIn: "77",
			}),
		).toBe("123.400000000000000000");
	});

	it("sell-convert::full-exit-triggers-on-DECIMAL-equality", () => {
		// dharmaIn "80" is decimal-equal to currentValue
		// "80.000000000000000000" — still the full-exit path, still the
		// quantity's exact bytes.
		expect(
			sellSharesFor({
				quantity: "50",
				currentValue: "80.000000000000000000",
				dharmaIn: "80",
			}),
		).toBe("50");
	});
});

describe("sellSharesFor — partial conversion (exact decimal, capped)", () => {
	it("sell-convert::exact-half-check", () => {
		// 10 × 4 ÷ 8 = 5, decimal-equal.
		const result = sellSharesFor({
			quantity: "10",
			currentValue: "8",
			dharmaIn: "4",
		});
		expect(new CpmmDecimal(result).eq("5")).toBe(true);
	});

	it("sell-convert::over-ask-caps-at-exactly-quantity", () => {
		// dharmaIn > currentValue (uncapped 50 × 100 ÷ 80 = 62.5) → capped to
		// the held quantity — the I-NO-OVERSELL client bound.
		const result = sellSharesFor({
			quantity: "50",
			currentValue: "80",
			dharmaIn: "100",
		});
		expect(new CpmmDecimal(result).lte("50")).toBe(true);
		expect(new CpmmDecimal(result).eq("50")).toBe(true);
	});

	it("sell-convert::dust-input-yields-positive-shares-within-quantity", () => {
		// §6 dust edge: Đ 1e-18 in → shares > 0 (positivity holds) and never
		// above the held quantity.
		const result = sellSharesFor({
			quantity: "100",
			currentValue: "80",
			dharmaIn: "0.000000000000000001",
		});
		expect(new CpmmDecimal(result).gt("0")).toBe(true);
		expect(new CpmmDecimal(result).lte("100")).toBe(true);
	});

	it("sell-convert::output-is-a-plain-decimal-string-at-most-18dp", () => {
		// A repeating-decimal partial (10 × 1 ÷ 3) must serialize as a plain
		// fixed-notation decimal string with ≤18 fractional digits — never
		// exponent notation, never a float artifact.
		const result = sellSharesFor({
			quantity: "10",
			currentValue: "3",
			dharmaIn: "1",
		});
		expect(result).toMatch(/^\d+(\.\d{1,18})?$/);
		expect(fracDigits(result)).toBeLessThanOrEqual(18);
		expect(new CpmmDecimal(result).gt("0")).toBe(true);
		expect(new CpmmDecimal(result).lte("10")).toBe(true);
	});
});

describe("sellSharesFor — caller-bug throws", () => {
	it("sell-convert::throws-on-non-positive-dharma-in", () => {
		expect(() =>
			sellSharesFor({ quantity: "10", currentValue: "8", dharmaIn: "0" }),
		).toThrow();
		expect(() =>
			sellSharesFor({ quantity: "10", currentValue: "8", dharmaIn: "-1" }),
		).toThrow();
	});

	it("sell-convert::throws-on-non-numeric-dharma-in", () => {
		expect(() =>
			sellSharesFor({ quantity: "10", currentValue: "8", dharmaIn: "abc" }),
		).toThrow();
		expect(() =>
			sellSharesFor({ quantity: "10", currentValue: "8", dharmaIn: "" }),
		).toThrow();
	});
});

describe("sell-convert — SG-2: no clamp code exists on the sell path", () => {
	it("sell-convert::module-source-carries-no-cap-imports (grep pin)", () => {
		// W2.10 rulings 2+3 / SPEC.1 §16.1: sell is NEVER clamped. The module
		// must not even MENTION the cap — a seller is never blocked from
		// exiting risk (plan §1 corruption scenario A).
		const source = readFileSync(
			join(process.cwd(), "src/components/debate/composer/sell-convert.ts"),
			"utf8",
		);
		expect(source).not.toContain("BET_MAX_STAKE");
		expect(source).not.toContain("clampStakeToMax");
	});
});
