import { describe, expect, it } from "vitest";
import { ComposerDecimal } from "@/components/debate/composer/sell-convert";
import { computeSplitBar } from "@/components/debate/composer/split-bar";

// UI.A3 §5.6 tests-first, slice 3 — the focused-post split-bar math (plan §4
// post-focus view: `SUPPORT Đ 3,800 ─ Đ 10,000 STAKED ─ Đ 6,200 COUNTER`,
// canon §6 grammar + the d5 bar fill). PURE / DB-INDEPENDENT: the module
// under test DOES NOT EXIST yet — this file collection-FAILS NOW on the
// unresolvable `@/components/debate/composer/split-bar` import (the verified
// RED — the slice-3 RED seam) and GREENs when the implementer lands the
// module against the contract below.
//
// Plan-§1 adjacency: the bar aggregates Support/Counter Dharma (read-time
// aggregates over reply-bets, ADR-0017) — CLAUDE.md §2 money law applies:
// NUMERIC(38,18) decimal strings, EXACT arithmetic via the composer decimal
// clone (ComposerDecimal — the client mirror of CpmmDecimal), never JS
// floats.
//
// PINNED PUBLIC-API CONTRACT (the implementer matches these names exactly):
//   export function computeSplitBar(args: {
//     supportDharma: string; // NUMERIC(38,18) decimal string
//     counterDharma: string;
//   }): { totalDharma: string; supportPct: string };
//
// Law:
//   - totalDharma = the EXACT decimal sum (asserted decimal-equal via
//     ComposerDecimal canonical form — value exact; byte form unpinned).
//   - supportPct = the d5 bar-fill width: support ÷ total × 100 as an
//     INTEGER-TRUNCATED string with a trailing "%". Zero total → "0%"
//     (NEVER a division-by-zero crash — plan-adjacent belt); all-support →
//     "100%"; truncation NEVER rounds up past 100 (a full bar must mean
//     literally zero counter Dharma).
//
// Numeric fixtures are the canon §6 register's own figures (3,800 / 6,200 /
// 10,000) + NUMERIC(38,18) quanta — no invented market content (plan §8).

/** Decimal-equality (value, not bytes) with a readable canonical-form diff. */
function expectDecimalEqual(actual: string, expected: string): void {
	expect(new ComposerDecimal(actual).toFixed()).toBe(
		new ComposerDecimal(expected).toFixed(),
	);
}

describe("computeSplitBar — exact decimal totals (money law)", () => {
	it("split-bar::canon-example-3800-6200-totals-10000-fill-38pct", () => {
		const out = computeSplitBar({
			supportDharma: "3800",
			counterDharma: "6200",
		});
		// The contract emits decimal STRINGS end-to-end.
		expect(typeof out.totalDharma).toBe("string");
		expect(typeof out.supportPct).toBe("string");
		expectDecimalEqual(out.totalDharma, "10000");
		// 3800 / 10000 → 38 exactly; trailing "%" rides the string.
		expect(out.supportPct).toBe("38%");
	});

	it("split-bar::18dp-tails-sum-exactly-never-floats", () => {
		const out = computeSplitBar({
			supportDharma: "0.000000000000000001",
			counterDharma: "0.000000000000000002",
		});
		// f64 would surface ~3.0000000000000004e-18 — decimal-equality to the
		// exact quantum sum is the float-poison discriminator (CLAUDE.md §2).
		expectDecimalEqual(out.totalDharma, "0.000000000000000003");
		// 1/3 → 33.33… → integer-truncated.
		expect(out.supportPct).toBe("33%");
	});
});

describe("computeSplitBar — fill truncation + degenerate bars", () => {
	it("split-bar::zero-zero-renders-0pct-no-division-crash", () => {
		// A post with no reply-bets yet: total 0 — the division-by-zero belt.
		const out = computeSplitBar({ supportDharma: "0", counterDharma: "0" });
		expectDecimalEqual(out.totalDharma, "0");
		expect(out.supportPct).toBe("0%");
	});

	it("split-bar::all-support-fills-100pct", () => {
		const out = computeSplitBar({ supportDharma: "500", counterDharma: "0" });
		expectDecimalEqual(out.totalDharma, "500");
		expect(out.supportPct).toBe("100%");
	});

	it("split-bar::all-counter-fills-0pct", () => {
		const out = computeSplitBar({ supportDharma: "0", counterDharma: "6200" });
		expectDecimalEqual(out.totalDharma, "6200");
		expect(out.supportPct).toBe("0%");
	});

	it("split-bar::dust-counter-truncates-99-never-rounds-past-100", () => {
		// One share quantum of counter Dharma against a large support:
		// 10000 / 10000.000000000000000001 × 100 = 99.999…% — INTEGER
		// truncation reads 99; a round-up to "100%" would render a full bar
		// over a live counter stake (the named never-rounds-past-100 law).
		const out = computeSplitBar({
			supportDharma: "10000",
			counterDharma: "0.000000000000000001",
		});
		expectDecimalEqual(out.totalDharma, "10000.000000000000000001");
		expect(out.supportPct).toBe("99%");
	});
});
