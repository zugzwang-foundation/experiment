import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
	allocateProRata,
	type LotState,
	mintLot,
	sellFromLot,
	sumLots,
} from "@/server/lots/compute";
import { LotOversellError } from "@/server/lots/errors";

import {
	decimalString,
	holdingAndSellArb,
	holdingArb,
	type LotSeed,
	lotSeedArb,
	NUM_RUNS,
	ONE_UNIT,
	SCALE,
	SEED,
	totalShares,
	toUnits,
	ZERO,
} from "./_arbitraries";

/**
 * LOTS-1 Slice 3 — the two properties the kickoff names by hand, plus the ones
 * that have to hold for those two to MEAN anything (ADR-0039 R2/R6/R9).
 *
 * The headline pair:
 *   • surviving basis ∈ [0, original stake]  — R9's monotonicity, the thing the
 *     `lots_surviving_basis_monotone` CHECK also enforces in storage;
 *   • Σ surviving lot shares == positions.quantity — R2, the invariant this
 *     whole table exists to keep true. Asserted here at the arithmetic layer;
 *     `I-LOT-SUM-001` asserts the same statement against a live database.
 *
 * Every assertion is on exact 18-dp decimal strings compared as scaled bigints.
 * A tolerance anywhere in this file would defeat its purpose.
 */

const CONFIG = { seed: SEED, numRuns: NUM_RUNS } as const;

/** A minted lot from a generated seed. */
function mint(seed: LotSeed): LotState {
	return mintLot({
		shares: decimalString(seed.shares),
		stake: decimalString(seed.basis),
	});
}

/** Apply a pro-rata allocation across a holding — the D-3 shape-2 path. */
function applyAllocation(lots: LotState[], alloc: string[]): LotState[] {
	return lots.map((l, i) => {
		const units = toUnits(alloc[i] as string);
		if (units === ZERO) {
			return l;
		}
		return sellFromLot({ lot: l, sharesToSell: alloc[i] as string });
	});
}

describe("LOTS-1 Slice 3 — lot core properties (ADR-0039)", () => {
	it("surviving basis stays within [0, original stake] — always (R9)", () => {
		fc.assert(
			fc.property(holdingAndSellArb, ({ lots: seeds, fracNum }) => {
				const lots = seeds.map(mint);
				const q = totalShares(seeds);
				const toSell = (q * fracNum) / SCALE;
				if (toSell === ZERO) {
					return; // f rounded below one ulp — nothing to sell, nothing to assert
				}
				const after = applyAllocation(
					lots,
					allocateProRata({ lots, sharesToSell: decimalString(toSell) }),
				);
				after.forEach((l) => {
					const basis = toUnits(l.survivingBasis);
					expect(basis >= ZERO).toBe(true);
					expect(basis <= toUnits(l.originalBasis)).toBe(true);
				});
			}),
			CONFIG,
		);
	});

	it("surviving shares stay within [0, original shares] — always (R9)", () => {
		fc.assert(
			fc.property(holdingAndSellArb, ({ lots: seeds, fracNum }) => {
				const lots = seeds.map(mint);
				const q = totalShares(seeds);
				const toSell = (q * fracNum) / SCALE;
				if (toSell === ZERO) {
					return;
				}
				const after = applyAllocation(
					lots,
					allocateProRata({ lots, sharesToSell: decimalString(toSell) }),
				);
				after.forEach((l) => {
					const shares = toUnits(l.survivingShares);
					expect(shares >= ZERO).toBe(true);
					expect(shares <= toUnits(l.originalShares)).toBe(true);
				});
			}),
			CONFIG,
		);
	});

	it("Σ surviving lot shares == positions.quantity — the R2 invariant, exactly", () => {
		fc.assert(
			fc.property(holdingAndSellArb, ({ lots: seeds, fracNum }) => {
				const lots = seeds.map(mint);
				// Under R2 the position quantity IS the Σ of its lots' shares.
				const q = totalShares(seeds);
				expect(toUnits(sumLots(lots).survivingShares)).toBe(q);

				const toSell = (q * fracNum) / SCALE;
				if (toSell === ZERO) {
					return;
				}
				const after = applyAllocation(
					lots,
					allocateProRata({ lots, sharesToSell: decimalString(toSell) }),
				);
				// positions.quantity after the sell is q − toSell (applyPositionDelta
				// is exact add/sub). The lots must land on the SAME number, to the
				// last of the 18 places — not close to it.
				expect(toUnits(sumLots(after).survivingShares)).toBe(q - toSell);
			}),
			CONFIG,
		);
	});

	it("allocates exactly the requested total — the mechanism R2 rests on", () => {
		fc.assert(
			fc.property(holdingAndSellArb, ({ lots: seeds, fracNum }) => {
				const lots = seeds.map(mint);
				const q = totalShares(seeds);
				const toSell = (q * fracNum) / SCALE;
				if (toSell === ZERO) {
					return;
				}
				const alloc = allocateProRata({
					lots,
					sharesToSell: decimalString(toSell),
				});
				const allocated = alloc.reduce((acc, a) => acc + toUnits(a), ZERO);
				expect(allocated).toBe(toSell);
			}),
			CONFIG,
		);
	});

	it("never allocates more than a lot has left", () => {
		fc.assert(
			fc.property(holdingAndSellArb, ({ lots: seeds, fracNum }) => {
				const lots = seeds.map(mint);
				const q = totalShares(seeds);
				const toSell = (q * fracNum) / SCALE;
				if (toSell === ZERO) {
					return;
				}
				const alloc = allocateProRata({
					lots,
					sharesToSell: decimalString(toSell),
				});
				alloc.forEach((a, i) => {
					expect(
						toUnits(a) <= toUnits((lots[i] as LotState).survivingShares),
					).toBe(true);
				});
			}),
			CONFIG,
		);
	});

	it("selling the whole holding Sells every lot and zeroes Đa (R6/R10)", () => {
		fc.assert(
			fc.property(holdingArb, (seeds) => {
				const lots = seeds.map(mint);
				const q = totalShares(seeds);
				const after = applyAllocation(
					lots,
					allocateProRata({ lots, sharesToSell: decimalString(q) }),
				);
				after.forEach((l) => {
					expect(toUnits(l.survivingShares)).toBe(ZERO);
					expect(toUnits(l.survivingBasis)).toBe(ZERO);
				});
				const sum = sumLots(after);
				expect(toUnits(sum.survivingShares)).toBe(ZERO);
				expect(toUnits(sum.survivingBasis)).toBe(ZERO);
			}),
			CONFIG,
		);
	});

	it("a full-lot sale zeroes BOTH columns by law, at any lot size", () => {
		fc.assert(
			fc.property(lotSeedArb, (seed) => {
				const l = mint(seed);
				const after = sellFromLot({
					lot: l,
					sharesToSell: l.survivingShares,
				});
				expect(toUnits(after.survivingShares)).toBe(ZERO);
				expect(toUnits(after.survivingBasis)).toBe(ZERO);
			}),
			CONFIG,
		);
	});

	it("holds the lots_sold_zeroes_basis CHECK for every reachable state", () => {
		// The storage CHECK is `surviving_shares > 0 OR surviving_basis = 0`. If
		// the pure core can produce a state that violates it, every write path
		// inherits a 23514 waiting to happen — so it is asserted here, where a
		// counterexample shrinks to something readable.
		fc.assert(
			fc.property(holdingAndSellArb, ({ lots: seeds, fracNum }) => {
				const lots = seeds.map(mint);
				const q = totalShares(seeds);
				const toSell = (q * fracNum) / SCALE;
				if (toSell === ZERO) {
					return;
				}
				const after = applyAllocation(
					lots,
					allocateProRata({ lots, sharesToSell: decimalString(toSell) }),
				);
				after.forEach((l) => {
					const shares = toUnits(l.survivingShares);
					const basis = toUnits(l.survivingBasis);
					expect(shares > ZERO || basis === ZERO).toBe(true);
				});
			}),
			CONFIG,
		);
	});

	it("is monotone — no sale ever increases a surviving column (R9)", () => {
		fc.assert(
			fc.property(holdingAndSellArb, ({ lots: seeds, fracNum }) => {
				const lots = seeds.map(mint);
				const q = totalShares(seeds);
				const toSell = (q * fracNum) / SCALE;
				if (toSell === ZERO) {
					return;
				}
				const after = applyAllocation(
					lots,
					allocateProRata({ lots, sharesToSell: decimalString(toSell) }),
				);
				after.forEach((l, i) => {
					const before = lots[i] as LotState;
					expect(
						toUnits(l.survivingShares) <= toUnits(before.survivingShares),
					).toBe(true);
					expect(
						toUnits(l.survivingBasis) <= toUnits(before.survivingBasis),
					).toBe(true);
				});
			}),
			CONFIG,
		);
	});

	it("refuses to oversell a holding, at any size", () => {
		fc.assert(
			fc.property(holdingArb, (seeds) => {
				const lots = seeds.map(mint);
				const q = totalShares(seeds);
				expect(() =>
					allocateProRata({
						lots,
						sharesToSell: decimalString(q + ONE_UNIT),
					}),
				).toThrow(LotOversellError);
			}),
			CONFIG,
		);
	});

	it("Sold is permanent — a zeroed lot never yields shares again (R9)", () => {
		fc.assert(
			fc.property(lotSeedArb, (seed) => {
				const sold = sellFromLot({
					lot: mint(seed),
					sharesToSell: decimalString(seed.shares),
				});
				expect(() =>
					sellFromLot({ lot: sold, sharesToSell: decimalString(ONE_UNIT) }),
				).toThrow(LotOversellError);
				// It also contributes nothing to a later allocation.
				const alloc = allocateProRata({
					lots: [sold],
					sharesToSell: decimalString(ZERO),
				});
				expect(toUnits(alloc[0] as string)).toBe(ZERO);
			}),
			CONFIG,
		);
	});
});
