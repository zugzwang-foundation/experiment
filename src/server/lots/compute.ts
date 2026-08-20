import "server-only";

import { CpmmDecimal, halfEven18 } from "@/server/cpmm/decimal";
import { canonicalize } from "@/server/dharma/canonical";
import { DharmaInputError } from "@/server/dharma/errors";

import { LotInputError, LotOversellError } from "./errors";

/**
 * LOTS-1 — the lot core (ADR-0039 D-1/D-3/D-4). Pure: no IO, no clock, no
 * randomness. Every quantity in and out is a canonical NUMERIC(38,18) decimal
 * STRING; never a JS float (CLAUDE.md §2).
 *
 * Four operations, which is the whole of it:
 *   • `mintLot`         — R1: a bet becomes a lot, wholly intact.
 *   • `sellFromLot`     — R3/R6/R9: reduce ONE lot; a full sale zeroes BY LAW.
 *   • `allocateProRata` — D-3 shape 2: split a position-level sell across lots.
 *   • `sumLots`         — D-4: Đa (Σ surviving basis) and the R2 share total.
 *
 * **Two arithmetics, deliberately.** Share allocation is done in exact BIGINT
 * units of 1e-18, because it is a partition problem: Σ of the parts must equal
 * the whole to the last place or the R2 invariant is false, and no rounding
 * mode gives that for free. Basis reduction is done in `CpmmDecimal`
 * (precision 50, half-even at the 18-dp boundary) because it is a genuine
 * division — and because that is expression-for-expression what
 * `computeEpisodes` already does, so the shipped Đa arithmetic is inherited
 * rather than re-derived.
 *
 * `CpmmDecimal` is not used for the allocation because it cannot be: at
 * precision 50 the intermediate `surviving × sharesToSell` overflows for
 * quantities the `numericString` domain permits (two 20-integer-digit values
 * multiply to ~1e76). BigInt has no such ceiling.
 */

/** A lot as the `lots` table stores it — the four money columns. */
export type LotState = {
	/** `bets.share_quantity` at mint. Immutable — the R9 monotone anchor. */
	originalShares: string;
	/** `bets.stake` at mint. Immutable — the R9 monotone anchor. */
	originalBasis: string;
	/** Mutable, monotone non-increasing. The R2 summand. */
	survivingShares: string;
	/** Mutable, monotone non-increasing. Σ over surviving lots IS Đa. */
	survivingBasis: string;
};

const SCALE_DIGITS = 18;
const ZERO_UNITS = BigInt(0);
const ONE_UNIT = BigInt(1);
/**
 * 1e18 as a bigint. Built from a string rather than an `n`-suffixed literal:
 * the repo tsconfig targets ES2017, under which TS rejects BigInt literals
 * (TS2737). The `bigint` TYPE and the `BigInt` global come from `lib: esnext`,
 * so exact integer arithmetic is unaffected — only the literal syntax is gated.
 */
const SCALE = BigInt(`1${"0".repeat(SCALE_DIGITS)}`);

export const CANONICAL_ZERO = "0.000000000000000000";

/**
 * Gate a value through the shared NUMERIC(38,18) authority
 * (`dharma/canonical`), translating its module-local `DharmaInputError` into
 * this module's sentinel. Without this the dharma error leaks across the lot
 * boundary — the `positions/compute.ts` pattern, and its tests assert the
 * translated type.
 */
function toCanonical(value: string, label: string): string {
	try {
		return canonicalize(value);
	} catch (e) {
		if (e instanceof DharmaInputError) {
			throw new LotInputError(
				`not a NUMERIC(38,18) decimal string: ${label}=${JSON.stringify(value)}`,
			);
		}
		throw e;
	}
}

/**
 * Canonical 18-dp string → exact bigint units of 1e-18. Exact for every input
 * this module handles, because `canonicalize` guarantees exactly 18 fractional
 * digits — so this is string surgery, never a parse through a float.
 */
function unitsOf(canonical: string): bigint {
	const negative = canonical.startsWith("-");
	const body = negative ? canonical.slice(1) : canonical;
	const [int = "0", frac = ""] = body.split(".");
	const units =
		BigInt(int) * SCALE + BigInt(frac.padEnd(SCALE_DIGITS, "0").slice(0, 18));
	return negative ? -units : units;
}

/** Exact bigint units of 1e-18 → canonical 18-dp string. */
function fromUnits(units: bigint): string {
	const negative = units < ZERO_UNITS;
	const abs = negative ? -units : units;
	const int = abs / SCALE;
	const frac = abs % SCALE;
	return `${negative ? "-" : ""}${int}.${frac.toString().padStart(SCALE_DIGITS, "0")}`;
}

/** Canonicalize and require strictly positive. */
function positiveUnits(value: string, label: string): bigint {
	const units = unitsOf(toCanonical(value, label));
	if (units <= ZERO_UNITS) {
		throw new LotInputError(`${label} must be positive, got ${value}`);
	}
	return units;
}

/**
 * R1 — a bet becomes a lot. `surviving` equals `original` because a
 * freshly-placed argument is wholly intact; there is no partially-born lot.
 *
 * Both floors are rejections rather than clamps: ADR-0018 already guarantees a
 * positive stake and the CPMM a positive share count, so a non-positive value
 * arriving here means the caller is wrong, and silently accepting it would put
 * a row in the table that its own CHECK constraints forbid.
 */
export function mintLot(args: { shares: string; stake: string }): LotState {
	const shares = fromUnits(positiveUnits(args.shares, "shares"));
	const basis = fromUnits(positiveUnits(args.stake, "stake"));
	return {
		originalShares: shares,
		originalBasis: basis,
		survivingShares: shares,
		survivingBasis: basis,
	};
}

/**
 * R3/R6/R9 — sell `sharesToSell` out of ONE lot.
 *
 * A FULL sale sets both surviving columns to canonical zero **by law, not by
 * arithmetic**. That is the whole reason `Sold` is exact: the pro-rata
 * expression at a full sale is `basis × 0 / shares`, and while that evaluates
 * to zero it invites a reader to believe zero is a rounding outcome. It is not
 * — it is the rule. (`computeEpisodes` sets its full-exit basis the same way,
 * and this inherits that stance.)
 *
 * A PARTIAL sale reduces the basis by the lot's own surviving fraction:
 * `basis' = basis × (shares − sold) / shares`, precision-50 intermediates
 * quantized half-even at 18 dp — the R-9.8 surviving-fraction mechanic scoped
 * to one argument instead of to a whole holding.
 *
 * The ceiling is the SURVIVING quantity. A half-sold lot is not sellable back
 * up to its mint size, and a Sold lot is not sellable at all — which is R9
 * ("Sold is permanent") expressed where it can actually be enforced.
 */
export function sellFromLot(args: {
	lot: LotState;
	sharesToSell: string;
}): LotState {
	const sold = positiveUnits(args.sharesToSell, "sharesToSell");
	const surviving = unitsOf(
		toCanonical(args.lot.survivingShares, "survivingShares"),
	);

	if (sold > surviving) {
		throw new LotOversellError(
			`lot oversell: ${args.sharesToSell} requested, ${args.lot.survivingShares} surviving`,
		);
	}

	if (sold === surviving) {
		return {
			...args.lot,
			survivingShares: CANONICAL_ZERO,
			survivingBasis: CANONICAL_ZERO,
		};
	}

	const remaining = surviving - sold;
	const basis = new CpmmDecimal(
		toCanonical(args.lot.survivingBasis, "survivingBasis"),
	);
	// Exactly `computeEpisodes`' partial-sell expression, scoped to one lot.
	const reduced = basis
		.times(new CpmmDecimal(fromUnits(remaining)))
		.dividedBy(new CpmmDecimal(fromUnits(surviving)));

	return {
		...args.lot,
		survivingShares: fromUnits(remaining),
		survivingBasis: halfEven18(reduced),
	};
}

/**
 * D-3 shape 2 — split a POSITION-level sell across the holding's lots, in
 * proportion to what each still holds.
 *
 * ⚠ **This is the one mechanic R1–R10 does not state**, and pro-rata is chosen
 * because it changes nothing: Σ(basis × f) = (Σ basis) × f, so the
 * position-level sell's observable Đa behaviour is what it was before lots
 * existed. FIFO and LIFO would each silently assert an ordering claim the
 * participant never made — and the position-level control is precisely the one
 * that names no argument. See ADR-0039 §D-3.
 *
 * **Largest remainder, because R2 is an equality.** Proportional shares almost
 * never land on whole 1e-18 units, and rounding each independently loses or
 * gains a few units — which would make Σ surviving lot shares differ from
 * `positions.quantity` and falsify the invariant this table exists to keep. So:
 * floor every share, then hand the shortfall out one unit at a time to the
 * largest fractional remainders (ties broken by index, so the result is
 * deterministic and independent of any map ordering).
 *
 * The residual can always be placed. Σ(surviving − floor) ≥ sharesToSell −
 * Σfloor = residual, because `sharesToSell ≤ total`; so if the
 * largest-remainder lot is already at capacity, a later one is not.
 *
 * Returns one 18-dp string per input lot, positionally aligned. Sold lots
 * receive canonical zero — they have nothing left to give.
 */
export function allocateProRata(args: {
	lots: readonly LotState[];
	sharesToSell: string;
}): string[] {
	const target = unitsOf(toCanonical(args.sharesToSell, "sharesToSell"));
	if (target < ZERO_UNITS) {
		throw new LotInputError(
			`sharesToSell must not be negative, got ${args.sharesToSell}`,
		);
	}

	const surviving = args.lots.map((l) =>
		unitsOf(toCanonical(l.survivingShares, "survivingShares")),
	);
	const total = surviving.reduce((acc, s) => acc + s, ZERO_UNITS);

	if (target > total) {
		throw new LotOversellError(
			`holding oversell: ${args.sharesToSell} requested, ${fromUnits(total)} surviving across ${args.lots.length} lot(s)`,
		);
	}
	if (target === ZERO_UNITS) {
		return args.lots.map(() => CANONICAL_ZERO);
	}
	// Sell-all: allocate each lot's whole surviving quantity. Exact by
	// construction — no division, so no residual to place.
	if (target === total) {
		return surviving.map(fromUnits);
	}

	// floor_i = ⌊surviving_i × target / total⌋, and remainder_i is the discarded
	// numerator — comparing numerators avoids a second division entirely.
	const allocated: bigint[] = [];
	const remainders: bigint[] = [];
	for (const s of surviving) {
		const numerator = s * target;
		allocated.push(numerator / total);
		remainders.push(numerator % total);
	}

	let residual = target - allocated.reduce((acc, a) => acc + a, ZERO_UNITS);
	const order = allocated
		.map((_, i) => i)
		.sort((a, b) => {
			const ra = remainders[a] as bigint;
			const rb = remainders[b] as bigint;
			if (ra !== rb) {
				return ra > rb ? -1 : 1;
			}
			return a - b;
		});

	for (const i of order) {
		if (residual === ZERO_UNITS) {
			break;
		}
		if ((allocated[i] as bigint) < (surviving[i] as bigint)) {
			allocated[i] = (allocated[i] as bigint) + ONE_UNIT;
			residual -= ONE_UNIT;
		}
	}

	return allocated.map(fromUnits);
}

/**
 * D-4 — the holding's aggregate. `survivingBasis` IS Đa; `survivingShares` is
 * the left-hand side of the R2 invariant and must equal `positions.quantity`.
 *
 * Both sums are exact: adding 18-dp values at 18 dp introduces no rounding, so
 * this is a plain integer sum in units, and the empty holding is canonical zero
 * rather than `"0"` or `NaN`.
 */
export function sumLots(
	// Only the two surviving columns are read, so the parameter asks for only
	// those two. That lets a DB read hand its rows straight in without carrying
	// the immutable originals along, and keeps ONE summation in the tree rather
	// than a tested one here and an untested re-implementation at the read.
	lots: readonly Pick<LotState, "survivingShares" | "survivingBasis">[],
): {
	survivingShares: string;
	survivingBasis: string;
} {
	let shares = ZERO_UNITS;
	let basis = ZERO_UNITS;
	for (const l of lots) {
		shares += unitsOf(toCanonical(l.survivingShares, "survivingShares"));
		basis += unitsOf(toCanonical(l.survivingBasis, "survivingBasis"));
	}
	return {
		survivingShares: fromUnits(shares),
		survivingBasis: fromUnits(basis),
	};
}
