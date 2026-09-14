import { describe, expect, it } from "vitest";

import { formatDharma } from "@/components/debate/format";
import {
	PHONE_MONEY_LINE_MAX_VALUE_CHARS,
	phoneMoneyLineFitsMovement,
} from "@/components/profile/money-line";

/**
 * MOBILE-2j · R-1 / ADR-0051 A6 D-1 — the money line's one concession, tested as
 * a RULE rather than as a regex over a render.
 *
 * ⛔⛔ WHY THIS IS A UNIT TEST AND NOT ANOTHER SOURCE SCAN. The design guards in
 * `tests/unit/design/` can only assert that the rule REACHES the markup; jsdom
 * performs no layout, so nothing there can see a width. What a unit test can hold
 * is the rule's BEHAVIOUR at the boundary — which is the part a future edit gets
 * wrong, because the boundary is a measured number and the obvious mistakes are
 * off-by-one in either direction.
 *
 * ⚠ THE NUMBER ITSELF IS NOT ASSERTED AGAINST A LITERAL, and that is deliberate.
 * `PHONE_MONEY_LINE_MAX_VALUE_CHARS` is a MEASUREMENT: it is 6 today because at
 * 360px a six-character figure needs 269.3px of a 278px line and a seven-character
 * one needs 280.7px, and it will move the day the money line's type moves. A test
 * that pinned `6` would have to be edited in the same commit as the constant and
 * would therefore never catch anything. What is pinned instead is that the rule
 * AGREES WITH ITS OWN CONSTANT at the boundary in both directions, and that the
 * constant stays inside the range any real measurement could produce.
 */
describe("MOBILE-2j — the phone money line's fit rule", () => {
	it("money-line::it-agrees-with-its-own-constant-on-BOTH-sides", () => {
		// A control on the fixture itself before anything is concluded from it.
		const admits = "9".repeat(PHONE_MONEY_LINE_MAX_VALUE_CHARS);
		expect(admits.length, "the fixture is not the length it claims to be").toBe(
			PHONE_MONEY_LINE_MAX_VALUE_CHARS,
		);
		// ⚠ THE RULE IS APPLIED TO THE *FORMATTED* STRING, so the input has to be
		// something `formatDharma` leaves at that length. A bare run of 9s is grouped
		// with commas and gets longer, so the boundary is probed through the formatter
		// rather than around it — which is also what the component does.
		const atBoundary = probeLengthExactly(PHONE_MONEY_LINE_MAX_VALUE_CHARS);
		const overBoundary = probeLengthExactly(
			PHONE_MONEY_LINE_MAX_VALUE_CHARS + 1,
		);
		expect(
			atBoundary,
			`no Đ value formats to exactly ${PHONE_MONEY_LINE_MAX_VALUE_CHARS} ` +
				`characters, so the constant names a length the formatter cannot ` +
				`produce. Only 1, 2, 3, 5, 6, 7, 9 … are reachable — never 4, never 8 — ` +
				`because groupInteger always groups.`,
		).not.toBeNull();
		expect(
			phoneMoneyLineFitsMovement(atBoundary as string),
			`the rule refuses a value formatting to exactly ` +
				`${PHONE_MONEY_LINE_MAX_VALUE_CHARS} characters, which is the length the ` +
				`constant was MEASURED to fit. The comparison must be <=, not < — ` +
				`reading the ruling's "shorter than that" as strict drops the chip from a ` +
				`value proven to have room for it.`,
		).toBe(true);
		if (overBoundary !== null) {
			expect(
				phoneMoneyLineFitsMovement(overBoundary),
				`the rule admits a value one character longer than the measured ` +
					`maximum. That character is 11.45px at 18px tabular figures and the ` +
					`line has none to give — the overflow is taken from SELL's edge, and ` +
					`A6 D-1 says SELL never yields.`,
			).toBe(false);
		}
	});

	it("money-line::the-chip-survives-every-value-a-participant-plausibly-holds", () => {
		// ⛔ THE ROW THAT WOULD CATCH AN OVER-TIGHT CONSTANT. A threshold of 3 would
		// satisfy the boundary row above perfectly and would silently drop the
		// movement from every four-figure holding — information removed from a line
		// with 20px to spare. The measured answer admits four figures; if a future
		// measurement genuinely does not, this row is the place to say so and why.
		for (const held of ["1", "999", "1000", "9999", "14260", "99999"]) {
			expect(
				phoneMoneyLineFitsMovement(held),
				`Đ ${formatDharma(held)} lost its movement chip. At MOBILE-2j's 18px ` +
					`money line that figure fits with the chip beside it at 360px, ` +
					`measured — dropping it removes a fact the line has room for.`,
			).toBe(true);
		}
	});

	it("money-line::it-DOES-yield-once-the-figure-is-long-enough", () => {
		// ⛔ THE OPPOSITE CONTROL, and without it the row above is satisfied by a
		// rule that returns `true` unconditionally — which is exactly what the
		// implementation looked like before the measurement landed.
		const long = ["100000", "1000000", "123456789"];
		const yielded = long.filter((v) => !phoneMoneyLineFitsMovement(v));
		expect(
			yielded,
			`the rule never yields. A6 D-1 makes the movement chip the one element ` +
				`that gives way when the money line cannot fit; a rule that always ` +
				`returns true is not that rule, and the line overflows into SELL.`,
		).toEqual(long);
	});

	it("money-line::the-constant-is-inside-the-range-a-real-measurement-can-give", () => {
		// ⚠ A SANITY BAND, NOT A PIN. 278px of line at 360px, minus the side marker
		// (58), SELL (59.7) and two 8px gaps, leaves 144.3px for `Đ ` + digits + a 6px
		// gap + the chip. At 11.45px per tabular digit nothing above ten characters is
		// arithmetically possible, and anything at or below two would drop the chip
		// from Đ 100 — a figure with 100px of slack. A constant outside that band is
		// a typo or a measurement taken against the wrong composition.
		expect(
			PHONE_MONEY_LINE_MAX_VALUE_CHARS,
			"the threshold is outside the range 360px of line can produce. Re-measure " +
				"it rather than nudging it: the run is in docs/plans/MOBILE-2j.md.",
		).toBeGreaterThanOrEqual(3);
		expect(PHONE_MONEY_LINE_MAX_VALUE_CHARS).toBeLessThanOrEqual(10);
	});
});

/**
 * The shortest whole-Đ value whose `formatDharma` output is exactly `n`
 * characters, or `null` when no such value exists.
 *
 * ⚠ IT SEARCHES RATHER THAN COMPUTES, because the mapping from magnitude to
 * formatted length is the formatter's business and duplicating its grouping rule
 * here would be a second implementation free to disagree with the first — which is
 * the whole failure mode this file's `formatDharma` import avoids.
 */
function probeLengthExactly(n: number): string | null {
	for (let digits = 1; digits <= n + 2; digits += 1) {
		const candidate = `1${"0".repeat(digits - 1)}`;
		if (formatDharma(candidate).length === n) return candidate;
		const nines = "9".repeat(digits);
		if (formatDharma(nines).length === n) return nines;
	}
	return null;
}
