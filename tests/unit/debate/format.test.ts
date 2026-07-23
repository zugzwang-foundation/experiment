import { describe, expect, it } from "vitest";

import { formatDharmaGrouped } from "@/components/debate/composer/copy";
import { formatDharma, formatDharmaExact } from "@/components/debate/format";

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
