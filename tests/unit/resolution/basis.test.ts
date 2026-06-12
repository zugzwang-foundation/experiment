import { describe, expect, it } from "vitest";
import { prorate } from "@/server/resolution/basis";

// ENGINE.9 §5.6 tests-first (U1, plan §Test plan) — the pure pro-rata basis
// (R-9.8). Greenfield value import from `@/server/resolution/basis` WILL fail
// to resolve until ENGINE.9 lands; that unresolved-import RED state is the
// goal. DB-FREE unit suite — REDs locally.
//
// Contract (plan §The basis module):
//   - rows sorted by `id` ascending (UUID lexicographic — stable,
//     deterministic; NOT chronological);
//   - rows 1..n−1: amount_i = floor18(total × weight_i / Σ weights), the
//     division computed exactly at CpmmDecimal precision 50 per row (never a
//     rounded scalar f);
//   - row n: amount_n = total − Σ amount_{1..n−1} — the deterministic
//     last-row remainder; floors under-allocate, so amount_n ≥ its exact
//     share ≥ 0;
//   - Σ amounts == total EXACTLY (string-decimal); every amount ≥ 0;
//   - total = 0 ⇒ all zeros; empty rows ⇒ requires total = 0 (else throw —
//     caller bug);
//   - all outputs canonical 18-dp strings (CLAUDE.md §2 — never JS floats).

// Pinned lexicographically-ordered ids (valid uuid format; ordering by
// design — plan R-9.8 last-row-remainder determinism).
const ID_1 = "00000000-0000-7000-8000-000000000001";
const ID_2 = "00000000-0000-7000-8000-000000000002";
const ID_3 = "00000000-0000-7000-8000-000000000003";

describe("prorate — exact-sum splitting (R-9.8)", () => {
	it("basis::awkward-thirds-exact-sum-with-last-row-remainder", () => {
		// Three equal weights, total 1: exact share = 0.333… repeating. Rows
		// 1..n−1 floor to 0.333333333333333333; the last row absorbs the
		// remainder (0.333333333333333334) so the sum is EXACTLY the total.
		const out = prorate({
			rows: [
				{ id: ID_1, weight: "1" },
				{ id: ID_2, weight: "1" },
				{ id: ID_3, weight: "1" },
			],
			total: "1",
		});
		expect(out).toEqual([
			{ id: ID_1, amount: "0.333333333333333333" },
			{ id: ID_2, amount: "0.333333333333333333" },
			{ id: ID_3, amount: "0.333333333333333334" },
		]);
	});

	it("basis::floor18-on-non-last-rows-sevenths", () => {
		// The S3 fixture shape: weights (150, 60), total 150 — f = 5/7.
		// Non-last row: floor18(150 × 150 / 210) = 107.142857142857142857;
		// last row: 150 − that = 42.857142857142857143 (> its floored
		// 42.857142857142857142 — the 1e-18 remainder lands on the LAST row).
		const out = prorate({
			rows: [
				{ id: ID_1, weight: "150" },
				{ id: ID_2, weight: "60" },
			],
			total: "150",
		});
		expect(out).toEqual([
			{ id: ID_1, amount: "107.142857142857142857" },
			{ id: ID_2, amount: "42.857142857142857143" },
		]);
	});

	it("basis::remainder-assignment-follows-id-order-not-input-order", () => {
		// Same rows, reversed input order — output is sorted by id ascending
		// and the remainder STILL lands on the max-id row (deterministic under
		// input permutation; the U2 property pins it ∀).
		const out = prorate({
			rows: [
				{ id: ID_2, weight: "60" },
				{ id: ID_1, weight: "150" },
			],
			total: "150",
		});
		expect(out).toEqual([
			{ id: ID_1, amount: "107.142857142857142857" },
			{ id: ID_2, amount: "42.857142857142857143" },
		]);
	});

	it("basis::last-row-remainder-non-negative-and-sum-exact", () => {
		// Awkward weights: every floored share under-allocates; the last row's
		// remainder must be ≥ its exact share, hence ≥ 0, and the sum exact.
		const out = prorate({
			rows: [
				{ id: ID_1, weight: "1" },
				{ id: ID_2, weight: "1" },
				{ id: ID_3, weight: "1" },
			],
			total: "0.000000000000000001",
		});
		// Exact shares are 0.000…00033 (sub-18dp) → rows 1..2 floor to zero;
		// the single indivisible unit lands on the last row.
		expect(out).toEqual([
			{ id: ID_1, amount: "0.000000000000000000" },
			{ id: ID_2, amount: "0.000000000000000000" },
			{ id: ID_3, amount: "0.000000000000000001" },
		]);
	});

	it("basis::zero-total-yields-all-zeros", () => {
		const out = prorate({
			rows: [
				{ id: ID_1, weight: "150" },
				{ id: ID_2, weight: "60" },
			],
			total: "0",
		});
		expect(out).toEqual([
			{ id: ID_1, amount: "0.000000000000000000" },
			{ id: ID_2, amount: "0.000000000000000000" },
		]);
	});

	it("basis::single-row-passthrough-gets-the-whole-total", () => {
		// n = 1: the single row IS the last row — amount = total exactly,
		// canonical 18-dp, regardless of its weight.
		const out = prorate({
			rows: [{ id: ID_1, weight: "7" }],
			total: "5",
		});
		expect(out).toEqual([{ id: ID_1, amount: "5.000000000000000000" }]);
	});

	it("basis::zero-weight-row-among-positive-weights-gets-zero", () => {
		// A fully-sold bet contributes weight but the per-row floor of
		// 0-weight is 0 — the R-9.8 f = 0 corollary at the row level.
		const out = prorate({
			rows: [
				{ id: ID_1, weight: "0" },
				{ id: ID_2, weight: "100" },
			],
			total: "100",
		});
		expect(out).toEqual([
			{ id: ID_1, amount: "0.000000000000000000" },
			{ id: ID_2, amount: "100.000000000000000000" },
		]);
	});

	it("basis::empty-rows-with-zero-total-yields-empty", () => {
		expect(prorate({ rows: [], total: "0" })).toEqual([]);
	});

	it("basis::empty-rows-with-non-zero-total-throws", () => {
		// Caller bug — there is nothing to allocate the total onto.
		expect(() => prorate({ rows: [], total: "5" })).toThrow();
	});
});
