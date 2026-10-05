import { describe, expect, it } from "vitest";

import {
	fillFontSize,
	fitFontSize,
	textWidthEm,
} from "@/components/ui/fit-text";

describe("fit-text — autosize from measured Geist widths", () => {
	it("measures a string by summing the table, conservatively wide", () => {
		// Chrome's own measure of this title at 700 is 29.079em; the table sums
		// single glyphs (no kerning), so it must come out a little WIDER, never
		// narrower — a string it says fits has to fit.
		const em = textWidthEm(
			"Bitcoin · Will BTC ever go below $60,000 by 5th November?",
			"titleBold",
		);
		expect(em).toBeGreaterThanOrEqual(29.079);
		expect(em).toBeLessThan(29.079 * 1.03);
	});

	it("labels are measured uppercase with their 0.14em tracking", () => {
		// "Resolution" renders as RESOLUTION at 800 with tracking; the table
		// alone is 6.583em, plus 10 × 0.14em of tracking.
		expect(textWidthEm("Resolution", "labelCaps")).toBeCloseTo(6.583 + 1.4, 3);
	});

	it("an unknown glyph (emoji) counts generously, never as zero", () => {
		expect(textWidthEm("👍", "titleBold")).toBeGreaterThanOrEqual(1.3);
	});

	it("emits a clamp between the floor and the designed size", () => {
		expect(fitFontSize("CoinMarketCap", "value", 12, 9)).toBe(
			`clamp(9px, calc(100cqi / ${textWidthEm("CoinMarketCap", "value").toFixed(3)}), 12px)`,
		);
	});

	it("Geist Mono is 0.6em a glyph, with the fallback arrow wider", () => {
		// "Đ 25→Đ 49": eight mono glyphs plus the arrow, which Geist Mono lacks.
		expect(textWidthEm("Đ 25→Đ 49", "mono")).toBeCloseTo(8 * 0.6 + 1.346, 3);
	});

	it("the side chip counts its 0.06em tracking on every glyph", () => {
		// Chrome measured "YES @ 10%" at 800 as 5.364em of glyphs; with nine
		// trackings it must come out at or above 5.364 + 0.54.
		expect(textWidthEm("YES @ 10%", "chip")).toBeGreaterThanOrEqual(
			5.364 + 0.54,
		);
	});

	it("a line's fill term subtracts its fixed px before dividing by its em", () => {
		expect(fillFontSize(27.8921, 31.504)).toBe(
			"((100cqi - 31.504px) / 27.892)",
		);
	});

	it("at the 1440 layout's 91px card column, CoinMarketCap keeps its 12px", () => {
		// The big display must not change: 12px × the string's em width fits the
		// 91px column measured at 1440, so the clamp resolves to its maximum.
		expect(12 * textWidthEm("CoinMarketCap", "value")).toBeLessThanOrEqual(91);
	});
});
