import { describe, expect, it } from "vitest";
import { clampStakeToMax } from "@/server/bets/floors";
import {
	BET_MAX_STAKE,
	BET_MIN_STAKE_POST,
	BET_MIN_STAKE_REPLY,
} from "@/server/config/limits";
import { CpmmDecimal } from "@/server/cpmm/decimal";

// UI.A2 §9 slice 1 §5.6 tests-first — the BET_MAX_STAKE clamp (plan §3.1 +
// §6 edge cases + §7 test-plan row 1; SPEC.1 §16.1 / F-BET-9 clamp rider,
// buy/add only — sell is NEVER clamped, SG-2, pinned in the DB-backed suite).
//
// PURE / DB-INDEPENDENT (locally-RED → the real RED→GREEN receipt). Touches
// no Postgres; it REDs NOW purely on the greenfield value imports —
// `clampStakeToMax` (floors.ts) and `BET_MAX_STAKE` (limits.ts) don't exist
// on disk until slice 1 lands — and GREENs the moment they do. This is the
// local executable receipt the parent runs to capture RED.
//
// PINNED PUBLIC-API CONTRACT (the implementer matches these names exactly):
//   BET_MAX_STAKE: string — "10000" (ratified OQ-1; 10× the initial grant,
//     economically inert by design), a NUMERIC(38,18) DECIMAL STRING in
//     src/server/config/limits.ts; PLACEHOLDER JSDoc naming SPEC.1 §16.1 +
//     number-tuning ~2026-09-01 (HARDEN.5) as the value owner.
//
//   clampStakeToMax(stake: string): string   // src/server/bets/floors.ts
//     stake >  BET_MAX_STAKE (STRICT `>`)   → returns the BET_MAX_STAKE
//                                             constant string
//     stake <= BET_MAX_STAKE (boundary      → returns the ORIGINAL input
//       INCLUSIVE, incl. exactly-at-max)      string BYTE-IDENTICAL — no
//                                             re-quantization, no
//                                             normalization
//     comparison: exact decimal via CpmmDecimal (precision 50) — NEVER a
//     JS float (CLAUDE.md §2). A float compare would collapse
//     "10000.000000000000000001" onto 10000 and wrongly pass it through.
//
// The clamp's single call site is the place route's step 5d (clamp-then-
// floor, plan §3.1); this file pins the pure function + the config-coherence
// chain (plan §5 "broken cap config") that makes a max < floor misconfig
// unshippable through CI.

// String forms derived from the LIVE constant so a future tuning pass doesn't
// stale the suite (the floors.test.ts precedent). Integer-string arithmetic
// only — BigInt(1), NOT the `1n` literal: tsconfig targets ES2017, where
// bigint literals are a TS2737 error (project memory: es2017-bigint-literals).
const ONE = BigInt(1);
function below(bound: string): string {
	return String(BigInt(bound.split(".")[0] ?? bound) - ONE);
}
function above(bound: string): string {
	return String(BigInt(bound.split(".")[0] ?? bound) + ONE);
}
// Several fixtures below are constructible only while the constant is
// integer-formed (no "."). The OQ-1 pin at the bottom holds that true today;
// the guard mirrors floors.test.ts's defensive-skip precedent so a future
// fractional retuning degrades to a skip, never a bogus fixture.
const MAX_IS_INTEGER_FORMED = !BET_MAX_STAKE.includes(".");

describe("clampStakeToMax — passthrough (stake <= BET_MAX_STAKE)", () => {
	it("bet-clamp::below-max-passes-through-byte-identical", () => {
		// Strictly below the max → the ORIGINAL string comes back byte-identical.
		const stake = below(BET_MAX_STAKE);
		expect(clampStakeToMax(stake)).toBe(stake);
	});

	it("bet-clamp::fractional-below-max-no-requantization", () => {
		// A fractional below-max stake returns AS SUBMITTED — "9999.5" is NOT
		// expanded to 18 dp, not trimmed, not re-serialized. Conforming clients
		// see zero behavior change (plan §3.1 byte-identical passthrough).
		if (!MAX_IS_INTEGER_FORMED) return;
		const stake = `${below(BET_MAX_STAKE)}.5`;
		expect(clampStakeToMax(stake)).toBe(stake);
	});

	it("bet-clamp::dust-stake-passes-through-byte-identical", () => {
		// The 18-dp dust quantum is far below the max (coherence chain below
		// guarantees max > 50) → unchanged, byte-identical.
		const stake = "0.000000000000000001";
		expect(clampStakeToMax(stake)).toBe(stake);
	});

	it("bet-clamp::exactly-at-max-not-clamped-byte-identical", () => {
		// EXACTLY at the max → NOT clamped (STRICT `>` semantics — the boundary
		// is inclusive passthrough, SPEC.1 §16.1 / plan §6 edge 1).
		expect(clampStakeToMax(BET_MAX_STAKE)).toBe(BET_MAX_STAKE);
	});

	it("bet-clamp::at-max-trailing-zero-form-returned-as-submitted", () => {
		// "10000.0"-style at-boundary value: numerically == max → passthrough,
		// and the return is the SUBMITTED spelling ("10000.0"), NOT the constant
		// ("10000") — the sharp proof that passthrough returns the input string,
		// never a normalized/re-quantized form.
		if (!MAX_IS_INTEGER_FORMED) return;
		const stake = `${BET_MAX_STAKE}.0`;
		expect(clampStakeToMax(stake)).toBe(stake);
	});
});

describe("clampStakeToMax — clamp (stake > BET_MAX_STAKE)", () => {
	it("bet-clamp::integer-above-max-returns-the-constant", () => {
		// Strictly above → returns EXACTLY the BET_MAX_STAKE constant string.
		expect(clampStakeToMax(above(BET_MAX_STAKE))).toBe(BET_MAX_STAKE);
	});

	it("bet-clamp::fractional-dust-above-max-is-clamped", () => {
		// "10000.000000000000000001" IS strictly above the max — only an EXACT
		// decimal compare (CpmmDecimal) sees it; a JS-float compare collapses it
		// onto 10000 and would wrongly pass it through (CLAUDE.md §2 money law).
		if (!MAX_IS_INTEGER_FORMED) return;
		const stake = `${BET_MAX_STAKE}.000000000000000001`;
		expect(clampStakeToMax(stake)).toBe(BET_MAX_STAKE);
	});
});

describe("config coherence — BET_MAX_STAKE > BET_MIN_STAKE_REPLY > BET_MIN_STAKE_POST > 0 (plan §5 broken cap config)", () => {
	it("bet-clamp::max-above-reply-floor-above-post-floor-above-zero", () => {
		// Exact-decimal-compare chain over the LIVE constants (ratified values:
		// "10000" > "50" > "10") so a tuning pass can't stale the test. Clamp-
		// then-floor (plan §3.1) means a misconfigured max < floor rejects every
		// affected bet loudly (below_*_floor) instead of executing below floor —
		// this pin makes that broken config unshippable through CI at all.
		expect(
			new CpmmDecimal(BET_MAX_STAKE).greaterThan(BET_MIN_STAKE_REPLY),
		).toBe(true);
		expect(
			new CpmmDecimal(BET_MIN_STAKE_REPLY).greaterThan(BET_MIN_STAKE_POST),
		).toBe(true);
		expect(new CpmmDecimal(BET_MIN_STAKE_POST).greaterThan(0)).toBe(true);
	});

	it("bet-clamp::max-is-pinned-10000", () => {
		// Ratified OQ-1: BET_MAX_STAKE = "10000" is the PLACEHOLDER value owned
		// by number-tuning (~2026-09-01, HARDEN.5). If a future PR moves it off
		// 10000, this surfaces loud (mirrors the reply-floor-is-pinned-50
		// precedent in floors.test.ts).
		expect(BET_MAX_STAKE).toBe("10000");
	});
});
