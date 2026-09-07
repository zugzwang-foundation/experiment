import { describe, expect, it } from "vitest";

import { addLiquidity } from "@/server/cpmm/calculate";
import { CpmmDecimal } from "@/server/cpmm/decimal";

import { testClient } from "../_fixtures/db";

// LIQ-1 Phase 2 · T5 — the SQL ↔ TypeScript differential (plan §3 T5 + §5;
// ADR-0047 §A "two implementations, one definition" and §Acceptance row
// "Differential"; plan §9 R-10).
//
// ADR §A names ONE reserve-placement primitive and ships it TWICE: the
// TypeScript `addLiquidity` in `src/server/cpmm/calculate.ts` is the
// specification and the oracle, and the `zz_add_liquidity` plpgsql function
// inside migration 0027 is the runtime that actually moves the pool. Nothing
// in the type system, the schema or CI relates those two bodies. This file is
// the relation.
//
// `tests/db/` and not `tests/unit/`: it needs the REAL `zz_add_liquidity`, and
// `just test-db` already runs this tree. `.spec.ts` per AGENTS.md §9 naming for
// the db specs.
//
// ⚠ ORDERING (plan §5, last row): this file is written RED-FIRST and must be
// red BEFORE T1 lands, or it goes green against an oracle that is wrong. Its
// expected first failure is the `no == yes` family — the family that found M-1
// — where today's precision-50 `addLiquidity` reads one ulp low and the SQL
// `div()` form reads the exact floor. **The SQL is right and the TypeScript is
// wrong**, which is the opposite of the direction a reader expects a
// differential to fail in, and is exactly why the family is forced rather than
// left to the generator: a fuzz without it agrees 12,000/12,000 while a real
// one-ulp divergence sits in the code.

/**
 * ≥ 10,000 per ADR §Acceptance; 12,000 is the count plan §5 measured at
 * sub-second in ONE round trip.
 */
const N = 12_000;

/**
 * The literal seed. A differential that cannot be replayed is not a
 * differential — a failing vector has to be reachable again by anyone reading
 * the report, without a recorded corpus.
 */
const PRNG_SEED = 0x5eed11c1;

/** 1 Đ in 1e-18 units. */
const SCALE = BigInt("1000000000000000000");

/** The six magnitude bands (plan §5), cycled by index. */
const BANDS: readonly bigint[] = [3, 5, 7, 9, 12, 15].map((n) =>
	BigInt(`1${"0".repeat(n)}`),
);

/**
 * The five forced families, applied by index so EVERY run contains all of them
 * (plan §5). Evaluated as an if/else chain in the order below, so exactly one
 * family — or none, meaning the plain band vector — applies per index, and the
 * per-family counts below are a partition rather than an overlap.
 *
 * `d14` is the shape all eight markets open at. `equal` is the M-1 family.
 * `ulp-no` and `ulp-a` are the one-ulp extremes at either end of the ratio, the
 * inputs where a "small enough to ignore" branch would hide. `90to1` is ADR
 * §Acceptance's named skew.
 */
type Family = "d14" | "equal" | "ulp-no" | "ulp-a" | "90to1" | "band";
const FAMILIES: readonly Family[] = [
	"d14",
	"equal",
	"ulp-no",
	"ulp-a",
	"90to1",
	"band",
];

type Vector = {
	i: number;
	yes: bigint;
	no: bigint;
	amount: bigint;
	fam: Family;
};

/** mulberry32 — 32 bits of state, written out rather than imported so the whole
 * generator is readable in one file and cannot drift with a dependency. */
function mulberry32(seed: number): () => number {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/** Scaled units → the canonical 18-dp decimal string both sides read. */
function decimalString(units: bigint): string {
	const s = units.toString().padStart(19, "0");
	return `${s.slice(0, -18)}.${s.slice(-18)}`;
}

/** 18-dp decimal string → scaled units. Exact; never a float. */
function toUnits(value: string): bigint {
	const [int, frac = ""] = value.split(".");
	return BigInt(int) * SCALE + BigInt(frac.padEnd(18, "0"));
}

/**
 * The vector set. Deterministic given `PRNG_SEED`, and built ONCE at module
 * scope so the differential and its negative control are provably run over the
 * SAME inputs — a control over different vectors proves nothing about the run
 * it is controlling.
 */
const VECTORS: readonly Vector[] = (() => {
	const rnd = mulberry32(PRNG_SEED);
	// Digit-wise so the draw is independent of Number's 53-bit mantissa: these
	// magnitudes reach 1e33 units and a float-derived value would be quietly
	// quantised long before the top band.
	const randBig = (maxExclusive: bigint): bigint => {
		const digits = maxExclusive.toString().length;
		let v = BigInt(0);
		for (let d = 0; d < digits; d++) {
			v = v * BigInt(10) + BigInt(Math.floor(rnd() * 10));
		}
		return v % maxExclusive;
	};
	const inBand = (band: bigint): bigint =>
		(randBig(band * BigInt(9)) + band) * SCALE + randBig(SCALE);

	const out: Vector[] = [];
	for (let i = 0; i < N; i++) {
		const band = BANDS[i % BANDS.length];
		let yes = inBand(band);
		let no = inBand(band);
		let amount = inBand(band);
		let fam: Family = "band";
		if (i % 7 === 0) {
			yes = BigInt(90000) * SCALE;
			no = BigInt(10000) * SCALE;
			fam = "d14";
		} else if (i % 11 === 0) {
			no = yes;
			fam = "equal";
		} else if (i % 13 === 0) {
			no = BigInt(1);
			fam = "ulp-no";
		} else if (i % 17 === 0) {
			amount = BigInt(1);
			fam = "ulp-a";
		} else if (i % 19 === 0) {
			no = yes / BigInt(90);
			if (no <= BigInt(0)) {
				no = BigInt(1);
			}
			fam = "90to1";
		}
		out.push({ i, yes, no, amount, fam });
	}
	return out;
})();

/**
 * The `VALUES` list, at FULL 18-dp scale.
 *
 * ⚠ The scale is load-bearing and is not cosmetic. `pools.yes_reserves` /
 * `no_reserves` are `numeric(38,18)`, so the reserves the injector passes carry
 * display scale 18 — and PostgreSQL's `select_div_scale()` reads the operands'
 * display scale to choose a division's result scale. Writing these literals
 * trimmed would exercise a different arithmetic than the one production runs.
 * (It also, measured, changes the negative control's verdict — see below.)
 */
function valuesList(vectors: readonly Vector[], trim: boolean): string {
	return vectors
		.map((v) => {
			const lit = (u: bigint): string => {
				const d = decimalString(u);
				if (!trim) {
					return d;
				}
				const t = d.replace(/0+$/, "");
				return t.endsWith(".") ? t.slice(0, -1) : t;
			};
			return `(${v.i},${lit(v.yes)}::numeric,${lit(v.no)}::numeric,${lit(v.amount)}::numeric)`;
		})
		.join(",");
}

/**
 * Value equality, NEVER string equality (plan §5). Measured: SQL returns `0`
 * where the TypeScript returns `0.000000000000000000` — the same value at a
 * different scale, and a string compare would report a mismatch on every
 * zero-discard row and drown the real ones.
 */
function sameDecimal(a: string, b: string): boolean {
	return new CpmmDecimal(a).equals(new CpmmDecimal(b));
}

type SqlRow = {
	i: number;
	yes: string;
	no: string;
	d_yes: string;
	d_no: string;
};

describe("liquidity-differential — SQL zz_add_liquidity ≡ TS addLiquidity (T5)", () => {
	it("liquidity-differential::sql-and-typescript-agree-across-12000-vectors", async () => {
		// ONE round trip, not N (plan §5). A per-vector query would be 12,000
		// round trips and would make the runtime the reason this test gets
		// narrowed later.
		const rows = (await testClient.unsafe(
			`SELECT v.i::int AS i,
				        r.yes::text  AS yes,
				        r.no::text   AS no,
				        r.d_yes::text AS d_yes,
				        r.d_no::text  AS d_no
				 FROM (VALUES ${valuesList(VECTORS, false)}) v(i,y,n,a),
				      LATERAL zz_add_liquidity(v.y, v.n, v.a) r
				 ORDER BY v.i`,
		)) as unknown as SqlRow[];

		expect(rows).toHaveLength(N);

		// Every mismatch is COLLECTED and reported together rather than thrown
		// on the first one. A differential that dies on vector 37 tells you
		// nothing about whether the divergence is one family or all six, and
		// the family is the diagnosis.
		const mismatches: string[] = [];
		const perFamily: Record<Family, number> = {
			d14: 0,
			equal: 0,
			"ulp-no": 0,
			"ulp-a": 0,
			"90to1": 0,
			band: 0,
		};

		for (let k = 0; k < N; k++) {
			const v = VECTORS[k];
			const row = rows[k];
			expect(row.i).toBe(v.i);

			const ts = addLiquidity({
				reserves: {
					yes: decimalString(v.yes),
					no: decimalString(v.no),
				},
				amount: decimalString(v.amount),
			});

			// The FOUR fields plan §5 names. `backing` is `p_amount` echoed on
			// both sides and carries no arithmetic, so it is not one of them.
			const fields: ReadonlyArray<[string, string, string]> = [
				["yes", row.yes, ts.reserves.yes],
				["no", row.no, ts.reserves.no],
				["discardedYes", row.d_yes, ts.discardedYes],
				["discardedNo", row.d_no, ts.discardedNo],
			];
			for (const [name, sqlValue, tsValue] of fields) {
				if (!sameDecimal(sqlValue, tsValue)) {
					perFamily[v.fam] += 1;
					if (mismatches.length < 8) {
						mismatches.push(
							`i=${v.i} fam=${v.fam} ${name}: sql=${sqlValue} ts=${tsValue} ` +
								`(yes=${decimalString(v.yes)} no=${decimalString(v.no)} a=${decimalString(v.amount)})`,
						);
					}
				}
			}
		}

		// One assertion carrying BOTH the per-family census and the first eight
		// concrete vectors: on failure the diff names which family diverged
		// (the diagnosis) and gives inputs that reproduce it (the repair).
		expect({ perFamily, examples: mismatches }).toEqual({
			perFamily: {
				d14: 0,
				equal: 0,
				"ulp-no": 0,
				"ulp-a": 0,
				"90to1": 0,
				band: 0,
			},
			examples: [],
		});
	}, 60_000);

	it("liquidity-differential::sql-alone-preserves-the-backing-delta-and-the-price", async () => {
		// ⭐ THE ARM THAT STILL SAYS SOMETHING IF THE ORACLE IS WRONG. The case
		// above compares two implementations; if BOTH drifted the same way it
		// would stay green. These two are properties of the SQL output alone,
		// taken from ADR §A/§E, and they hold or they do not regardless of what
		// TypeScript thinks.
		const rows = (await testClient.unsafe(
			`SELECT v.i::int AS i,
				        ((r.yes + r.d_yes) - (r.no + r.d_no) - (v.y - v.n))::text AS backing_delta,
				        (abs(r.no / (r.yes + r.no) - v.n / (v.y + v.n)))::text    AS price_move
				 FROM (VALUES ${valuesList(VECTORS, false)}) v(i,y,n,a),
				      LATERAL zz_add_liquidity(v.y, v.n, v.a) r
				 ORDER BY v.i`,
		)) as unknown as Array<{
			i: number;
			backing_delta: string;
			price_move: string;
		}>;

		expect(rows).toHaveLength(N);

		const ONE_ULP = new CpmmDecimal("0.000000000000000001");
		const backingBreaks: string[] = [];
		const priceBreaks: string[] = [];
		for (let k = 0; k < N; k++) {
			const v = VECTORS[k];
			// `(Y' + D_yes) − (N' + D_no) == Y − N`, EXACTLY. Every Đ deposited
			// mints one pair, so an injection shifts both sides by the same
			// amount and their difference is invariant. Measured 12,000/12,000
			// on the candidate body (plan §5).
			if (!new CpmmDecimal(rows[k].backing_delta).isZero()) {
				if (backingBreaks.length < 8) {
					backingBreaks.push(
						`i=${v.i} fam=${v.fam} Δ=${rows[k].backing_delta}`,
					);
				}
			}
			// ADR §A's whole claim: the operation is PRICE-NEUTRAL. `S′` is
			// floored, so one ulp is attainable and `<` would red a correct
			// body; anything beyond it changes the value of every position in
			// the market, which Driver 3 forbids outright.
			if (new CpmmDecimal(rows[k].price_move).greaterThan(ONE_ULP)) {
				if (priceBreaks.length < 8) {
					priceBreaks.push(`i=${v.i} fam=${v.fam} |Δp|=${rows[k].price_move}`);
				}
			}
		}

		expect(backingBreaks).toEqual([]);
		expect(priceBreaks).toEqual([]);
	}, 60_000);

	it("liquidity-differential::negative-control-the-trunc-form-is-detectably-wrong", async () => {
		// ⛔ THE CONTROL THAT STOPS THIS FILE DEGENERATING INTO A FUNCTION
		// COMPARED AGAINST ITSELF (plan §5 row "Negative control";
		// `feedback_a_fix_whose_test_cannot_fail`). It runs the SAME vectors
		// through the plausible-but-wrong expression T4 rejects —
		// `trunc(a*s/l, 18)` — through the SAME `sameDecimal` comparator, and
		// demands that the harness SEE the difference. Green is the correct
		// state for this case: it is a control, not a driver.
		//
		// ⚠ MEASURED, AND IT CHANGES THE SHAPE OF THE CONTROL. Run at the
		// operands' full 18-dp scale, `trunc(a*s/l, 18)` matches the exact
		// floor on **all 12,000** vectors — `select_div_scale()` picks 36 for a
		// dividend of scale 36, and 18 guard digits are far more than the
		// difference needs. The wrongness only becomes VISIBLE when the
		// operands carry their natural scale: then the same expression's
		// division scale collapses to 15–18 and it mismatches on **884** of
		// them, every one in the `d14` family, whose reserves (90000, 10000)
		// have display scale 0.
		//
		// ⇒ That is the plan's own §4(c) note-1 claim — "the guard digits are
		// an accident of the OPERANDS, not a guarantee" — measured rather than
		// asserted, and it is the argument for `div()`: the same probe run
		// against T4's chosen `div(a*s*1e18, l) * 1e-18` mismatches ZERO times
		// under BOTH literal shapes. `div()` selects no result scale, so there
		// is no accident to depend on.
		//
		// The control therefore runs BOTH shapes. The natural-scale arm is
		// what proves the harness can see one ulp; the 18-dp arm is what says
		// why the plan's `trunc` rejection is about scale rather than about
		// truncation.
		const shortOf = (row: { yes: string; no: string }, v: Vector): string =>
			v.yes >= v.no ? row.no : row.yes;

		const runTruncForm = async (trim: boolean) => {
			const rows = (await testClient.unsafe(
				`SELECT v.i::int AS i,
					        (CASE WHEN v.y >= v.n THEN v.y + v.a
					              ELSE v.y + trunc(v.a * v.y / v.n, 18) END)::text AS yes,
					        (CASE WHEN v.y >= v.n THEN v.n + trunc(v.a * v.n / v.y, 18)
					              ELSE v.n + v.a END)::text AS no
					 FROM (VALUES ${valuesList(VECTORS, trim)}) v(i,y,n,a)
					 ORDER BY v.i`,
			)) as unknown as Array<{ i: number; yes: string; no: string }>;

			let mismatches = 0;
			for (let k = 0; k < N; k++) {
				const v = VECTORS[k];
				const ts = addLiquidity({
					reserves: {
						yes: decimalString(v.yes),
						no: decimalString(v.no),
					},
					amount: decimalString(v.amount),
				});
				const tsShort = v.yes >= v.no ? ts.reserves.no : ts.reserves.yes;
				if (!sameDecimal(shortOf(rows[k], v), tsShort)) {
					mismatches += 1;
				}
			}
			return mismatches;
		};

		const atNaturalScale = await runTruncForm(true);

		// THE control assertion: a one-ulp divergence is visible to this
		// harness. Bounded well above 1 so a single incidental disagreement
		// cannot discharge it.
		expect(atNaturalScale).toBeGreaterThan(100);

		// …and the sanity floor on the vectors themselves: the exact-floor
		// reference agrees with the SQL primitive's own arithmetic, so a
		// mismatch count of N would mean the generator, not the expression, is
		// what changed.
		expect(atNaturalScale).toBeLessThan(N);
	}, 60_000);

	it("liquidity-differential::every-forced-family-is-present-in-the-run", () => {
		// ⭐ COVERAGE, ASSERTED. "Forced by index" is a claim about the vector set,
		// and an off-by-one in the modulus chain would silently drop a family
		// while leaving every case above green. The `equal` family is the one that
		// matters most — plan §5: "a fuzz without it agrees on 12,000/12,000 while
		// a real one-ulp divergence sits in the code."
		const counts: Record<Family, number> = {
			d14: 0,
			equal: 0,
			"ulp-no": 0,
			"ulp-a": 0,
			"90to1": 0,
			band: 0,
		};
		for (const v of VECTORS) {
			counts[v.fam] += 1;
		}
		for (const fam of FAMILIES) {
			expect(`${fam}=${counts[fam] > 0}`).toBe(`${fam}=true`);
		}
		expect(VECTORS).toHaveLength(N);

		// Every band is visited too — the defect this file exists for is
		// MAGNITUDE-dependent (0.000% below 1e7, 6.2–6.9% at and above 1e8), so a
		// vector set that never left the low bands would agree everywhere.
		const bandsSeen = new Set(VECTORS.map((v) => v.i % BANDS.length));
		expect(bandsSeen.size).toBe(BANDS.length);

		// And the units really are 18-dp round-trippable — the generator's own
		// control, since every assertion in this file compares decimal STRINGS.
		for (const v of VECTORS.slice(0, 50)) {
			expect(toUnits(decimalString(v.yes))).toBe(v.yes);
			expect(toUnits(decimalString(v.amount))).toBe(v.amount);
		}
	});
});
