import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
	formatPercentUnpaired,
	formatPricePercent,
} from "@/components/debate/format";
import { getPrices } from "@/server/cpmm/calculate";

import { NUM_RUNS, reservesArb, SEED } from "../cpmm/_arbitraries";

// PCT.ROUND (SPEC.1 §10.8) property suite — the complement rule holds for EVERY
// price pair the engine can actually produce, not just the hand-picked fixtures.
//
// This drives `getPrices` over the same `reservesArb` the ENGINE.3 charter suite
// uses, so the inputs are real engine output rather than invented strings. That
// matters here specifically: the charter guarantees only
// `|p_yes + p_no − 1| ≤ 1 ulp` (cpmm §10.2, `invariants.property.test.ts` line
// 5), so a display rule that read BOTH price strings would be asserting an
// exactness the engine never promised. Deriving NO as `100 − YES` is immune,
// and these properties prove it across the whole reserve space.

function pct(value: string): number {
	return Number(value.replace("%", ""));
}

describe("formatPricePercent — properties over the engine's own prices", () => {
	it("YES% + NO% === 100 for any valid reserve pair", () => {
		fc.assert(
			fc.property(reservesArb, (reserves) => {
				const pricing = getPrices(reserves);
				const yes = pct(formatPricePercent(pricing, "YES"));
				const no = pct(formatPricePercent(pricing, "NO"));
				expect(yes + no).toBe(100);
			}),
			{ seed: SEED, numRuns: NUM_RUNS },
		);
	});

	it("both sides land in [0, 100] and are whole integers", () => {
		fc.assert(
			fc.property(reservesArb, (reserves) => {
				const pricing = getPrices(reserves);
				for (const side of ["YES", "NO"] as const) {
					const rendered = formatPricePercent(pricing, side);
					expect(rendered).toMatch(/^\d+%$/);
					const value = pct(rendered);
					expect(value).toBeGreaterThanOrEqual(0);
					expect(value).toBeLessThanOrEqual(100);
				}
			}),
			{ seed: SEED, numRuns: NUM_RUNS },
		);
	});

	it("the YES side agrees with the single-side hatch on the same price", () => {
		// The chart's opening/current YES readouts must never disagree with the
		// price bar rendering the same YES price a few pixels below — they share
		// one integer core.
		fc.assert(
			fc.property(reservesArb, (reserves) => {
				const pricing = getPrices(reserves);
				expect(formatPricePercent(pricing, "YES")).toBe(
					formatPercentUnpaired(pricing.yes),
				);
			}),
			{ seed: SEED, numRuns: NUM_RUNS },
		);
	});
});
