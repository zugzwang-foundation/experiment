import { describe, expect, it } from "vitest";

import { sellSharesFor } from "@/components/debate/composer/sell-convert";
import { formatDharma, formatDharmaExact } from "@/components/debate/format";

// DROUND R8 (SPEC.1 §10.8 named exception) — the sell module's editable amount
// INPUT seeds from the EXACT Đb string (`formatDharmaExact`), NOT the displayed
// (rounded) one. The full-exit byte-identity check in sell-convert.ts reads that
// field back; a rounded seed would make "sell all" under-sell and strand dust.
// These pins guard the property the carve-out depends on.

describe("sell seed — exact input drives a byte-identity full exit (R8)", () => {
	// A non-terminating Đb value: DISPLAYED it rounds to "10", but the seed must
	// stay exact so the whole position exits.
	const position = {
		quantity: "12.500000000000000000",
		currentValue: "9.999999999999999999",
	};

	it("the seed decimal-equals currentValue (exact, not the rounded display)", () => {
		const seed = formatDharmaExact(position.currentValue);
		expect(seed).toBe("9.999999999999999999");
		// The rounding formatter would have produced the WRONG seed.
		expect(formatDharma(position.currentValue)).toBe("10");
	});

	it("the exact seed yields a FULL exit — byte-identical held quantity", () => {
		const seed = formatDharmaExact(position.currentValue);
		expect(
			sellSharesFor({
				quantity: position.quantity,
				currentValue: position.currentValue,
				dharmaIn: seed,
			}),
		).toBe(position.quantity);
	});

	it("a ROUNDED seed would under-sell (this is why the carve-out exists)", () => {
		// currentValue whose rounded form is strictly LESS than exact → under-sell.
		const pos = { quantity: "100.000000000000000000", currentValue: "10.4" };
		const roundedSeed = formatDharma(pos.currentValue); // "10"
		expect(roundedSeed).toBe("10");
		// 100 × 10 / 10.4 ≈ 96.15 < 100 → strands ~3.85 shares. NOT a full exit.
		expect(
			sellSharesFor({
				quantity: pos.quantity,
				currentValue: pos.currentValue,
				dharmaIn: roundedSeed,
			}),
		).not.toBe(pos.quantity);
	});
});
