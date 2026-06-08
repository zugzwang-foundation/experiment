import { describe, expect, it } from "vitest";

import {
	applyPositionDelta,
	computeMarker,
	type Marker,
} from "@/server/positions/compute";
import {
	PositionInputError,
	PositionOversellError,
} from "@/server/positions/errors";

// ENGINE.11 §5.6 tests-first (TDD RED) — the position pure-core contract.
// Greenfield value imports from `@/server/positions/compute` + `.../errors`
// WILL fail to resolve until the module lands; that unresolved-import RED state
// is the goal (plan §7, execute step 2 / CP-1). `import type { Marker }` is
// stripped by esbuild, so it does not soften the RED — the value imports
// (`applyPositionDelta`, `computeMarker`, `PositionOversellError`,
// `PositionInputError`) are what fire it.
//
// DB-FREE: this is the local-RED twin of the four-file suite (the three
// DB-backed files cannot RED locally — PROBE-P2, :54322 ECONNREFUSED is infra,
// not assertion-red). This file covers the pure oversell floor (the app half of
// I-NO-OVERSELL-001) + the F-DEBATE-2 marker truth table (which consumes the
// INV-3 frozen `side_at_post_time`, never writes it).
//
// One subject per file: this file = the `compute.ts` pure core (AGENTS.md §9).
//
// Float-free (CLAUDE.md §2): every quantity is asserted as its EXACT canonical
// 18-dp string literal. `applyPositionDelta` returns canonical 18-dp.

describe("applyPositionDelta › exact arithmetic (canonical 18-dp)", () => {
	it("position-delta::exact-add", () => {
		// previousQuantity 80 + shareDelta +40 (a buy of 40 cpmm shares) → 120.
		expect(
			applyPositionDelta({
				previousQuantity: "80.000000000000000000",
				shareDelta: "40",
			}),
		).toBe("120.000000000000000000");
	});

	it("position-delta::exact-sub", () => {
		// previousQuantity 90 + shareDelta -30 (a sell of 30 shares) → 60.
		expect(
			applyPositionDelta({
				previousQuantity: "90",
				shareDelta: "-30",
			}),
		).toBe("60.000000000000000000");
	});

	it("position-delta::canonical-pad-from-zero", () => {
		// New (user,market,side): previousQuantity "0.000…0" → first add pads to
		// canonical 18-dp.
		expect(
			applyPositionDelta({
				previousQuantity: "0.000000000000000000",
				shareDelta: "5",
			}),
		).toBe("5.000000000000000000");
	});

	it("position-delta::fractional-exact", () => {
		// Sub-unit shares stay exact at 18-dp (no float drift).
		expect(
			applyPositionDelta({
				previousQuantity: "0.000000000000000000",
				shareDelta: "0.5",
			}),
		).toBe("0.500000000000000000");
	});
});

describe("applyPositionDelta › sell-to-zero boundary (≥ 0, allowed)", () => {
	it("position-delta::sell-exactly-to-zero", () => {
		// newQuantity == 0 is allowed (≥ 0); the held side becomes non-held and
		// drops out of the partial unique index (drives the F-BET-3 flip path).
		expect(
			applyPositionDelta({
				previousQuantity: "10",
				shareDelta: "-10",
			}),
		).toBe("0.000000000000000000");
	});
});

describe("applyPositionDelta › oversell guard (R-3 app floor)", () => {
	it("position-delta::oversell-by-one-ulp-throws", () => {
		// newQuantity = -1e-18 → PositionOversellError. The app mirror of the
		// storage CHECK (quantity >= 0); 1 ULP below zero is still < 0.
		expect(() =>
			applyPositionDelta({
				previousQuantity: "0",
				shareDelta: "-0.000000000000000001",
			}),
		).toThrow(PositionOversellError);
	});

	it("position-delta::gross-oversell-throws", () => {
		// Selling 11 against a 10 holding → -1 → PositionOversellError.
		expect(() =>
			applyPositionDelta({
				previousQuantity: "10",
				shareDelta: "-11",
			}),
		).toThrow(PositionOversellError);
	});
});

describe("applyPositionDelta › input validation", () => {
	it("position-delta::rejects-non-numeric-string", () => {
		// A malformed decimal string fails the numericString gate.
		expect(() =>
			applyPositionDelta({
				previousQuantity: "0",
				shareDelta: "not-a-number",
			}),
		).toThrow(PositionInputError);
	});
});

describe("computeMarker › F-DEBATE-2 truth table (emergent; INV-3 frozen)", () => {
	// `sideAtPostTime` is `comments.side_at_post_time` — frozen at post-time,
	// INV-3. `computeMarker` only READS it; the marker is the live overlay and
	// NEVER moves the frozen badge. Full truth table (plan §"Marker truth table"
	// / SPEC.1 F-DEBATE-2): same → "none"; opposite → "Flipped"; null → "Exited".
	const cases: ReadonlyArray<{
		sideAtPostTime: "YES" | "NO";
		heldSide: "YES" | "NO" | null;
		expected: Marker;
	}> = [
		{ sideAtPostTime: "YES", heldSide: "YES", expected: "none" },
		{ sideAtPostTime: "YES", heldSide: "NO", expected: "Flipped" },
		{ sideAtPostTime: "YES", heldSide: null, expected: "Exited" },
		{ sideAtPostTime: "NO", heldSide: "NO", expected: "none" },
		{ sideAtPostTime: "NO", heldSide: "YES", expected: "Flipped" },
		{ sideAtPostTime: "NO", heldSide: null, expected: "Exited" },
	];

	for (const { sideAtPostTime, heldSide, expected } of cases) {
		it(`marker::${sideAtPostTime}-held-${heldSide ?? "null"}-is-${expected}`, () => {
			expect(computeMarker({ sideAtPostTime, heldSide })).toBe(expected);
		});
	}
});
