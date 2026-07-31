import { describe, expect, it } from "vitest";

import { formatDharmaGrouped } from "@/components/debate/composer/copy";
import {
	formatDharma,
	formatDharmaExact,
	formatPercentUnpaired,
	formatPricePercent,
} from "@/components/debate/format";

// DROUND (SPEC.1 §10.8) — every Đ value rendered to a user displays at 0 dp,
// ROUND_HALF_UP (round half AWAY FROM ZERO), and a zero magnitude renders "0",
// never "-0". `formatDharma` is the single shared rounding display formatter;
// `formatDharmaExact` preserves the legacy trim-only behaviour for the two
// non-render consumers (the ADR-0025 `.md` export + the sell-module input seed).

describe("formatDharma — 0-dp ROUND_HALF_UP display rounding", () => {
	it.each([
		["9.4", "9"],
		["9.5", "10"],
		["9.6", "10"],
		["9.999999999999999999", "10"],
		["20.666666666666666666", "21"],
		["-0.000000000000000001", "0"], // never "-0"
		["0", "0"],
		["-9.5", "-10"], // half away from zero
		["1000", "1000"],
		["999.999999999999999999", "1000"],
		// HALF_UP (away from zero) at the .5 boundary, both signs.
		["0.5", "1"],
		["2.5", "3"],
		["-0.5", "-1"],
		["-2.5", "-3"],
		["0.4", "0"],
		["-0.4", "0"], // rounds to zero magnitude → "0", never "-0"
	])("rounds %s -> %s", (input, expected) => {
		expect(formatDharma(input)).toBe(expected);
	});

	it("never renders a signed zero", () => {
		expect(formatDharma("-0.000000000000000001")).not.toBe("-0");
		expect(formatDharma("-0.4")).not.toBe("-0");
		expect(formatDharma("-0")).toBe("0");
	});

	it("falls back to trim-only (never throws) on a non-finite / malformed value", () => {
		// A render must never crash on a bad value — degrade to the exact trim.
		expect(formatDharma("—")).toBe("—");
		expect(formatDharma("NaN")).toBe("NaN");
		expect(formatDharma("not-a-number")).toBe("not-a-number");
	});
});

describe("formatDharmaExact — UNCHANGED trim-only behaviour", () => {
	it.each([
		["150.000000000000000000", "150"],
		["0.500000000000000000", "0.5"],
		["9.999999999999999999", "9.999999999999999999"],
		["20.666666666666666666", "20.666666666666666666"],
		["0", "0"],
		["-30.000000000000000000", "-30"],
		["560", "560"],
		["1234.560000000000000000", "1234.56"],
	])("trims %s -> %s", (input, expected) => {
		expect(formatDharmaExact(input)).toBe(expected);
	});
});

describe("formatDharmaGrouped — inherits rounding, then thousands-groups", () => {
	it.each([
		["1234.6", "1,235"],
		["14260.000000000000000000", "14,260"],
		["999.999999999999999999", "1,000"],
		["20.666666666666666666", "21"],
		["560.000000000000000000", "560"],
	])("groups %s -> %s", (input, expected) => {
		expect(formatDharmaGrouped(input)).toBe(expected);
	});
});

// ── PCT.ROUND (SPEC.1 §10.8) — the complement rule ───────────────────────────
// YES canonical, NO derived as 100 − YES. The pair always sums to exactly 100.
// This assertion was written FIRST, against the pre-fix `formatPercent`, and
// failed reporting `'53% + 48% = 101'` — the defect it now guards.

const TIE = { yes: "0.525000000000000000", no: "0.475000000000000000" };

function pairSum(pricing: { yes: string; no: string }): string {
	const yes = formatPricePercent(pricing, "YES");
	const no = formatPricePercent(pricing, "NO");
	const sum = Number(yes.replace("%", "")) + Number(no.replace("%", ""));
	return `${yes} + ${no} = ${sum}`;
}

describe("formatPricePercent — the complement rule", () => {
	it("sums to exactly 100 at the .525/.475 tie that used to render 101", () => {
		expect(pairSum(TIE)).toBe("53% + 47% = 100");
	});

	it.each([
		// [yes, no, expected "YES% + NO% = sum"]
		["0.500000000000000000", "0.500000000000000000", "50% + 50% = 100"],
		["0.380000000000000000", "0.620000000000000000", "38% + 62% = 100"],
		["0.540000000000000000", "0.460000000000000000", "54% + 46% = 100"],
		// Ties on the other side of the midpoint — still exactly 100.
		["0.475000000000000000", "0.525000000000000000", "48% + 52% = 100"],
		["0.005000000000000000", "0.995000000000000000", "1% + 99% = 100"],
		["0.995000000000000000", "0.005000000000000000", "100% + 0% = 100"],
		// Near-degenerate pools, approaching 0 and 1.
		["0.999999999999999999", "0.000000000000000001", "100% + 0% = 100"],
		["0.000000000000000001", "0.999999999999999999", "0% + 100% = 100"],
		// The exact ends.
		["1.000000000000000000", "0.000000000000000000", "100% + 0% = 100"],
		["0.000000000000000000", "1.000000000000000000", "0% + 100% = 100"],
	])("pairs %s / %s -> %s", (yes, no, expected) => {
		expect(pairSum({ yes, no })).toBe(expected);
	});

	it("NEVER reads pricing.no — engine slack cannot reach a render", () => {
		// cpmm §10.2 pins |p_yes + p_no − 1| ≤ 1 ulp, NOT exact equality. A rule
		// that read both strings would assert more than the engine promises.
		// A poisoned NO must be structurally unreachable.
		const poisoned = { yes: "0.525000000000000000", no: "not-a-price" };
		expect(formatPricePercent(poisoned, "NO")).toBe("47%");
		expect(formatPricePercent(poisoned, "YES")).toBe("53%");
	});
});

describe("formatPercentUnpaired — the single-side escape hatch", () => {
	// Byte-identical to the pre-PCT.ROUND `formatPercent`; the rename is the
	// point (a call site must announce that it is unpaired), not a behaviour
	// change.
	it.each([
		["0.523000000000000000", "52%"],
		["0.525000000000000000", "53%"], // ROUND_HALF_UP on the third digit
		["0.475000000000000000", "48%"],
		["0.500000000000000000", "50%"],
		["1.000000000000000000", "100%"],
		["0.000000000000000000", "0%"],
		["0.999999999999999999", "100%"],
	])("renders %s -> %s", (price, expected) => {
		expect(formatPercentUnpaired(price)).toBe(expected);
	});

	it("is exactly why it is never used for a pair: the two sides render 101", () => {
		// The historical defect, pinned. Independently rounding both complements
		// at a .xx5 tie overshoots — the pair can overshoot but never undershoot.
		const yes = formatPercentUnpaired(TIE.yes);
		const no = formatPercentUnpaired(TIE.no);
		const sum = Number(yes.replace("%", "")) + Number(no.replace("%", ""));
		expect(`${yes} + ${no} = ${sum}`).toBe("53% + 48% = 101");
	});
});
