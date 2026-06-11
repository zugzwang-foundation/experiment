import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { prorate } from "@/server/resolution/basis";

// ENGINE.9 §5.6 tests-first (U2, plan §Test plan) — fast-check property suite
// for the pure pro-rata basis (R-9.8). Greenfield value import REDs until
// ENGINE.9 lands. DB-FREE — REDs locally.
//
// Properties (plan §The basis module, "Property-tested (fast-check) for the
// exact-sum and non-negativity invariants"):
//   ∀ (weights, total): Σ amounts == total EXACTLY (string-decimal);
//   ∀ (weights, total): every amount ≥ 0;
//   ∀ permutations of the input rows: the output is IDENTICAL (sorted by id,
//     remainder on the max-id row — deterministic under input order).
//
// Exact-decimal-string-native (CLAUDE.md §2): every generated quantity is a
// scaled bigint of 1e-18 units → 18-dp decimal string; NO JS float ever
// constructs a value. Local helpers (≈10 lines) rather than importing the
// cpmm suite's `_arbitraries.ts` — that module is the ENGINE.3 CPMM domain
// (its docstring scopes it to `tests/unit/cpmm/`); cross-suite coupling for
// two one-liners loses more than it saves.

const SCALE = BigInt(`1${"0".repeat(18)}`);

/** Scaled bigint units → canonical 18-dp decimal string (non-negative). */
function decimalString(units: bigint): string {
	const int = units / SCALE;
	const frac = units % SCALE;
	return `${int}.${frac.toString().padStart(18, "0")}`;
}

/** 18-dp decimal string → scaled bigint units (exact). */
function toUnits(value: string): bigint {
	const [int, frac = ""] = value.split(".");
	return BigInt(int) * SCALE + BigInt(frac.padEnd(18, "0"));
}

// Deterministic & reproducible (the ENGINE.3 fixed-config convention).
const SEED = 20260612;
const NUM_RUNS = 1000;

// Weight rows: 1..8 distinct uuid ids, weights ∈ [0, 1e9 Đ] in 1e-18 units
// with at least one strictly positive weight (Σw > 0 — the division is
// defined). total ∈ [0, Σw] — the basis domain: the position-level truth
// never exceeds the bet-level share sum (sells only shrink positions).
const WEIGHT_MAX = BigInt(`1${"0".repeat(27)}`); // 1e9 Đ in units

const scenarioArb = fc
	.uniqueArray(fc.uuid(), { minLength: 1, maxLength: 8 })
	.chain((ids) =>
		fc
			.tuple(...ids.map(() => fc.bigInt({ min: BigInt(0), max: WEIGHT_MAX })))
			.filter((ws) => ws.some((w) => w > BigInt(0)))
			.chain((ws) => {
				const sum = ws.reduce((a, b) => a + b, BigInt(0));
				return fc.bigInt({ min: BigInt(0), max: sum }).map((totalUnits) => ({
					rows: ids.map((id, i) => ({
						id,
						weight: decimalString(ws[i] ?? BigInt(0)),
					})),
					total: decimalString(totalUnits),
				}));
			}),
	);

describe("prorate — properties (R-9.8)", () => {
	it("basis::property-sum-equals-total-exactly", () => {
		fc.assert(
			fc.property(scenarioArb, ({ rows, total }) => {
				const out = prorate({ rows, total });
				const sum = out.reduce((acc, r) => acc + toUnits(r.amount), BigInt(0));
				expect(sum).toBe(toUnits(total));
			}),
			{ seed: SEED, numRuns: NUM_RUNS },
		);
	});

	it("basis::property-every-amount-non-negative", () => {
		fc.assert(
			fc.property(scenarioArb, ({ rows, total }) => {
				const out = prorate({ rows, total });
				for (const r of out) {
					expect(toUnits(r.amount) >= BigInt(0)).toBe(true);
				}
			}),
			{ seed: SEED, numRuns: NUM_RUNS },
		);
	});

	it("basis::property-deterministic-under-input-permutation", () => {
		fc.assert(
			fc.property(
				scenarioArb.chain((s) =>
					fc
						.shuffledSubarray(s.rows, {
							minLength: s.rows.length,
							maxLength: s.rows.length,
						})
						.map((shuffled) => ({ ...s, shuffled })),
				),
				({ rows, shuffled, total }) => {
					expect(prorate({ rows: shuffled, total })).toEqual(
						prorate({ rows, total }),
					);
				},
			),
			{ seed: SEED, numRuns: NUM_RUNS },
		);
	});
});
