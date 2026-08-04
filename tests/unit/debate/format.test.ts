import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
	displayNetProfitLoss,
	formatDharma,
	formatDharmaExact,
	formatPercentUnpaired,
	formatPricePercent,
	round0Dharma,
} from "@/components/debate/format";

// DROUND (SPEC.1 §10.8) — every Đ value rendered to a user displays at 0 dp,
// ROUND_HALF_UP (round half AWAY FROM ZERO), and a zero magnitude renders "0",
// never "-0". `formatDharma` is the single shared rounding display formatter;
// `formatDharmaExact` preserves the legacy trim-only behaviour for the two
// non-render consumers (the ADR-0025 `.md` export + the sell-module input seed).
//
// PRIMITIVES-1 C3 (SPEC.1 §10.8, 1.0.29) — that single shared formatter now
// GROUPS as well as rounds, product-wide. Grouping is a property of the
// formatter, not a choice made at a call site: `composer/copy.ts`'s parallel
// `formatDharmaGrouped` is deleted and its call sites re-pointed here, so no
// ungrouped display variant survives to be selected by mistake. The rounding
// primitive `round0Dharma` is exported for DISPLAYED-SPACE ARITHMETIC only
// (the §10.8 aggregate identities, which must add before they group) and is
// never itself rendered — guarded by tests/unit/design/no-raw-dharma-render.

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
		["1000", "1,000"], // grouped from four digits up (1.0.29)
		["999.999999999999999999", "1,000"],
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

describe("formatDharma — rounds, THEN thousands-groups (SPEC.1 §10.8, 1.0.29)", () => {
	it.each([
		// Moved verbatim off the deleted `composer/copy.ts::formatDharmaGrouped`:
		// the behaviour did not change, its OWNER did.
		["1234.6", "1,235"],
		["14260.000000000000000000", "14,260"],
		["999.999999999999999999", "1,000"],
		["20.666666666666666666", "21"],
		["560.000000000000000000", "560"],
		// Two groups — the case no surface exercised before.
		["1234567.000000000000000000", "1,234,567"],
		// The boundary: grouping starts at four digits, not three.
		["999", "999"],
		["1000", "1,000"],
		// Negatives group on the magnitude and keep the sign.
		["-1234", "-1,234"],
		["-1234567.4", "-1,234,567"],
	])("groups %s -> %s", (input, expected) => {
		expect(formatDharma(input)).toBe(expected);
	});

	it("degrades UNGROUPED on a malformed value — a bad value is not dressed up", () => {
		expect(formatDharma("not-a-number")).toBe("not-a-number");
		expect(formatDharma("—")).toBe("—");
	});

	it("uses a LITERAL comma, never a locale-derived separator", () => {
		// SPEC.1 §10.8: Đ figures render in BOTH the server and client trees, so a
		// locale-derived separator resolves differently in the two — a hydration
		// mismatch, and `1.234` for one thousand two hundred and thirty-four Đ
		// under a de-DE runtime. Asserted against the SOURCE, not the output: an
		// `en-US`-pinned `toLocaleString` would produce identical strings here and
		// still be the defect. Comments are stripped first — the docblock NAMES
		// both forbidden APIs in order to forbid them, which is documentation,
		// not a call.
		const source = readFileSync(
			join(process.cwd(), "src/components/debate/format.ts"),
			"utf8",
		)
			.replace(/\/\*[\s\S]*?\*\//g, "")
			.replace(/^\s*\/\/.*$/gm, "");
		expect(source).not.toMatch(/toLocaleString|Intl\./);
		expect(formatDharma("1234")).toBe("1,234");
	});
});

describe("displayNetProfitLoss — the SECOND grouping site (SPEC.1 §10.8, 1.0.29)", () => {
	// THE SECOND GROUPING SITE (SPEC.1 §10.8, 1.0.29). Everywhere else in the
	// tree groups because `formatDharma` groups — grouping is a property of the
	// single shared formatter, not a choice made at a call site.
	// `displayNetProfitLoss` is the ONE place where it IS a call-site choice, and
	// it has to be: the §23 tile identity must be summed in UNGROUPED displayed
	// space first (`new Decimal("1,234")` throws and `Number("1,234")` is NaN), so
	// the function cannot route its result through `formatDharma` and instead
	// groups itself with a terminal `groupInteger(...)` on its final return. That
	// wrapper is the only thing standing between the §23 row and
	// `Đ 14,260` / `Đ 3,225` / `Đ -1234` — Wallet and Positions grouped, Net P/L
	// not — which is the defect its own docblock names. This test exists because
	// that wrapper is a call-site choice: nothing else in the suite pins it.
	//
	// Every row below is finite and well-formed, so every one lands on that
	// terminal return. None reaches the two `formatDharma(netProfitLoss)` degrade
	// exits (the non-finite guard and the catch), which group through the shared
	// formatter and would still pass with the wrapper deleted.
	//
	// A trailing `""` in the last column means "no negative assertion".
	it.each([
		// Positive result >= 1000 groups. issuance = 10000 + 4260 - 14260 = 0.
		["positive >= 1000 groups", "10000", "4260", "14260", "14,260", ""],
		// Negative result <= -1000 groups AND keeps its sign. Issued 2000, now
		// holding 766: issuance = 500 + 266 - (-1234) = 2000.
		[
			"negative <= -1000 groups and keeps its sign",
			"500",
			"266",
			"-1234",
			"-1,234",
			"",
		],
		// A zero result renders "0" — the intermediate here is -0.4, so the
		// `isZero()` guard is what is under test. `toBe("0")` forbids a stray
		// comma as well; the "-0" pin is stated explicitly because it is the
		// named rule.
		["zero renders 0, never -0", "1000", "0", "-0.4", "0", "-0"],
		// The identity holds WITH grouping on, and the sum is taken BEFORE the
		// grouping. Both operands sit on a .5 tie, so round-then-sum and
		// sum-then-round disagree. The two operand rows pin each displayed figure
		// through the same function, so the §23 row is checked as a ROW: displayed
		// Wallet 1,001 + displayed Positions 1,001 - issuance 0 = 2,002. Rounding
		// the EXACT sum (2001.0) would render 2,001 instead — asserting 2,002 and
		// NOT 2,001 is what proves the addition happened in ungrouped displayed
		// space and was grouped once at the end.
		//
		// THAT ONE ASSERTION CATCHES A SECOND DEFECT, AND ONLY BECAUSE netPL IS
		// 2001 — do not "simplify" this fixture. Besides sum-then-round, it also
		// catches GROUP-BEFORE-SUM: group an operand first and the re-read throws
		// (`new DisplayDecimal("1,001")` is a SyntaxError, the same hazard the
		// split bar's `ComposerDecimal` carries), which lands on the CATCH exit and
		// returns `formatDharma(netProfitLoss)` = `formatDharma("2001")` = "2,001"
		// — the identical string sum-then-round produces. The two failure modes
		// coincide on "2,001" only at this netPL; change it and `not.toBe("2,001")`
		// silently stops covering the group-before-sum half.
		["displayed Wallet operand alone", "1000.5", "0", "1000.5", "1,001", ""],
		["displayed Positions operand alone", "0", "1000.5", "1000.5", "1,001", ""],
		[
			"sum precedes the grouping: 1,001 + 1,001 - 0 = 2,002",
			"1000.5",
			"1000.5",
			"2001",
			"2,002",
			"2,001",
		],
	])("%s", (_label, wallet, positions, netProfitLoss, expected, neverRenders) => {
		const actual = displayNetProfitLoss(wallet, positions, netProfitLoss);
		expect(actual).toBe(expected);
		if (neverRenders !== "") {
			expect(actual).not.toBe(neverRenders);
		}
	});
});

describe("round0Dharma — the UNGROUPED displayed-space arithmetic primitive", () => {
	it.each([
		// Identical rounding to `formatDharma`, WITHOUT the grouping: this is what
		// makes the §10.8 aggregate identities addable. `new Decimal("1,234")` is
		// a throw and `Number("1,234")` is NaN, so a displayed-space sum must read
		// back an ungrouped string.
		["9.5", "10"],
		["1000", "1000"],
		["1234.6", "1235"],
		["14260.000000000000000000", "14260"],
		["1234567.000000000000000000", "1234567"],
		["-0.000000000000000001", "0"], // never "-0"
		["-2.5", "-3"],
	])("rounds %s -> %s (ungrouped)", (input, expected) => {
		expect(round0Dharma(input)).toBe(expected);
	});

	it("is what formatDharma composes over", () => {
		expect(formatDharma("1234567.6")).toBe("1,234,568");
		expect(round0Dharma("1234567.6")).toBe("1234568");
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
