import { describe, expect, it } from "vitest";

import {
	allocateProRata,
	mintLot,
	sellFromLot,
	sumLots,
} from "@/server/lots/compute";
import { LotInputError, LotOversellError } from "@/server/lots/errors";

/**
 * LOTS-1 Slice 3 — the lot core (ADR-0039 D-1/D-3/D-4). Pure: no IO, no clock,
 * no randomness. Written BEFORE the implementation (CLAUDE.md §5.6 — this is
 * thesis-touching accounting logic, not a type declaration).
 *
 * Every quantity here is an exact 18-dp decimal string. A JS float anywhere in
 * this file would be a defect in the test, not a convenience.
 */

const d18 = (v: string): string => {
	const [int, frac = ""] = v.split(".");
	return `${int}.${frac.padEnd(18, "0")}`;
};
const ZERO18 = d18("0");

/** A lot as the table stores it, at mint. */
const lot = (shares: string, basis: string) => ({
	originalShares: d18(shares),
	originalBasis: d18(basis),
	survivingShares: d18(shares),
	survivingBasis: d18(basis),
});

describe("LOTS-1 Slice 3 — lot core (ADR-0039)", () => {
	describe("mintLot", () => {
		it("mints a wholly-intact lot — surviving equals original (R1)", () => {
			const minted = mintLot({ shares: "40", stake: "100" });
			expect(minted).toEqual({
				originalShares: d18("40"),
				originalBasis: d18("100"),
				survivingShares: d18("40"),
				survivingBasis: d18("100"),
			});
		});

		it("canonicalizes to exactly 18 dp", () => {
			const minted = mintLot({ shares: "40.5", stake: "100.25" });
			expect(minted.originalShares).toBe("40.500000000000000000");
			expect(minted.survivingBasis).toBe("100.250000000000000000");
		});

		it("rejects non-positive shares or stake (the ADR-0018 floors mirror)", () => {
			expect(() => mintLot({ shares: "0", stake: "100" })).toThrow(
				LotInputError,
			);
			expect(() => mintLot({ shares: "40", stake: "0" })).toThrow(
				LotInputError,
			);
			expect(() => mintLot({ shares: "-1", stake: "100" })).toThrow(
				LotInputError,
			);
		});

		it("rejects a malformed decimal string rather than coercing it", () => {
			expect(() => mintLot({ shares: "NaN", stake: "100" })).toThrow(
				LotInputError,
			);
			expect(() => mintLot({ shares: "40", stake: "Infinity" })).toThrow(
				LotInputError,
			);
		});
	});

	describe("sellFromLot", () => {
		it("reduces a partial sale pro-rata WITHIN the lot", () => {
			// 100 basis / 40 shares; sell 10 ⇒ 30 remain ⇒ 100 × 30/40 = 75.
			// The same arithmetic computeEpisodes applies to a whole position,
			// now scoped to one argument.
			const after = sellFromLot({
				lot: lot("40", "100"),
				sharesToSell: d18("10"),
			});
			expect(after.survivingShares).toBe(d18("30"));
			expect(after.survivingBasis).toBe(d18("75"));
		});

		it("leaves the originals untouched — they are the R9 monotone anchors", () => {
			const after = sellFromLot({
				lot: lot("40", "100"),
				sharesToSell: d18("10"),
			});
			expect(after.originalShares).toBe(d18("40"));
			expect(after.originalBasis).toBe(d18("100"));
		});

		it("zeroes BOTH columns BY LAW on a full-lot sale (R6/R10 — Sold is exact)", () => {
			const after = sellFromLot({
				lot: lot("40", "100"),
				sharesToSell: d18("40"),
			});
			expect(after.survivingShares).toBe(ZERO18);
			expect(after.survivingBasis).toBe(ZERO18);
		});

		it("zeroes by law even where division would NOT have landed on zero", () => {
			// 1/3-style basis: a pro-rata division to zero shares is 0/0. The full
			// sale must not go near that expression — it is set, not computed.
			const after = sellFromLot({
				lot: lot("3", "1"),
				sharesToSell: d18("3"),
			});
			expect(after.survivingShares).toBe(ZERO18);
			expect(after.survivingBasis).toBe(ZERO18);
		});

		it("sells the REMAINDER of an already-partially-sold lot to zero", () => {
			const once = sellFromLot({
				lot: lot("40", "100"),
				sharesToSell: d18("10"),
			});
			const twice = sellFromLot({ lot: once, sharesToSell: d18("30") });
			expect(twice.survivingShares).toBe(ZERO18);
			expect(twice.survivingBasis).toBe(ZERO18);
		});

		it("is path-independent across successive partial sales", () => {
			// 100/40: sell 10 then 10, vs sell 20 at once. Both leave 20 shares and
			// basis 50 — the surviving fraction composes.
			const stepwise = sellFromLot({
				lot: sellFromLot({ lot: lot("40", "100"), sharesToSell: d18("10") }),
				sharesToSell: d18("10"),
			});
			const atOnce = sellFromLot({
				lot: lot("40", "100"),
				sharesToSell: d18("20"),
			});
			expect(stepwise.survivingShares).toBe(atOnce.survivingShares);
			expect(stepwise.survivingBasis).toBe(atOnce.survivingBasis);
			expect(atOnce.survivingBasis).toBe(d18("50"));
		});

		it("throws LotOversellError above the SURVIVING quantity, not the original", () => {
			// The distinction matters: a half-sold lot must not be sellable again
			// up to its original size.
			const half = sellFromLot({
				lot: lot("40", "100"),
				sharesToSell: d18("20"),
			});
			expect(() => sellFromLot({ lot: half, sharesToSell: d18("21") })).toThrow(
				LotOversellError,
			);
			// …and exactly the surviving amount is still legal.
			expect(
				sellFromLot({ lot: half, sharesToSell: d18("20") }).survivingShares,
			).toBe(ZERO18);
		});

		it("refuses to sell from a Sold lot — Sold is permanent (R9)", () => {
			const sold = sellFromLot({
				lot: lot("40", "100"),
				sharesToSell: d18("40"),
			});
			expect(() => sellFromLot({ lot: sold, sharesToSell: d18("1") })).toThrow(
				LotOversellError,
			);
		});

		it("rejects a non-positive sale rather than treating it as a no-op", () => {
			expect(() =>
				sellFromLot({ lot: lot("40", "100"), sharesToSell: ZERO18 }),
			).toThrow(LotInputError);
			expect(() =>
				sellFromLot({ lot: lot("40", "100"), sharesToSell: d18("-1") }),
			).toThrow(LotInputError);
		});
	});

	describe("sumLots — Đa and the R2 aggregate", () => {
		it("sums surviving basis and surviving shares", () => {
			const sum = sumLots([lot("40", "100"), lot("20", "100")]);
			expect(sum.survivingShares).toBe(d18("60"));
			expect(sum.survivingBasis).toBe(d18("200"));
		});

		it("ignores Sold lots' zeroes without special-casing them", () => {
			const sold = sellFromLot({
				lot: lot("40", "100"),
				sharesToSell: d18("40"),
			});
			const sum = sumLots([sold, lot("20", "100")]);
			expect(sum.survivingShares).toBe(d18("20"));
			expect(sum.survivingBasis).toBe(d18("100"));
		});

		it("is canonical zero for an empty holding (never NaN, never '0')", () => {
			expect(sumLots([])).toEqual({
				survivingShares: ZERO18,
				survivingBasis: ZERO18,
			});
		});

		it("reproduces the POSCHK-1 subject's Đa = 680 exactly", () => {
			// The four measured bets on bitcoin-price-50k, zero sells: Đa is a plain
			// sum of the stakes, and it must land on 680 to all 18 places.
			const sum = sumLots([
				lot("79.840637450199203187", "40"),
				lot("101.353189699791112326", "50"),
				lot("996.092000275904005590", "500"),
				lot("174.222121154166260264", "90"),
			]);
			expect(sum.survivingBasis).toBe("680.000000000000000000");
			expect(sum.survivingShares).toBe("1351.507948580060581367");
		});
	});

	describe("allocateProRata — the position-level sell (ADR-0039 D-3 shape 2)", () => {
		it("splits a partial sell proportionally to surviving shares", () => {
			const alloc = allocateProRata({
				lots: [lot("40", "100"), lot("20", "100")],
				sharesToSell: d18("30"), // half of 60
			});
			expect(alloc).toEqual([d18("20"), d18("10")]);
		});

		it("allocates EXACTLY the requested total — the R2 guarantee", () => {
			// 3 lots that do not divide evenly: 1/3 of 10 each. Naive rounding
			// would lose or gain units; largest-remainder must not.
			const alloc = allocateProRata({
				lots: [lot("10", "10"), lot("10", "10"), lot("10", "10")],
				sharesToSell: d18("10"),
			});
			const total = alloc.reduce(
				(acc, a) => acc + BigInt(a.replace(".", "")),
				BigInt(0),
			);
			expect(total).toBe(BigInt(d18("10").replace(".", "")));
		});

		it("allocates the whole of every lot on a sell-all (f = 0 remains)", () => {
			const lots = [lot("40", "100"), lot("20", "100")];
			const alloc = allocateProRata({ lots, sharesToSell: d18("60") });
			expect(alloc).toEqual([d18("40"), d18("20")]);
			// …and applying it Sells every lot.
			const after = lots.map((l, i) =>
				sellFromLot({ lot: l, sharesToSell: alloc[i] as string }),
			);
			expect(sumLots(after)).toEqual({
				survivingShares: ZERO18,
				survivingBasis: ZERO18,
			});
		});

		it("never allocates more than a lot's surviving shares", () => {
			const lots = [lot("40", "100"), lot("0.000000000000000001", "0.01")];
			const alloc = allocateProRata({
				lots,
				sharesToSell: d18("40"),
			});
			alloc.forEach((a, i) => {
				expect(BigInt(a.replace(".", ""))).toBeLessThanOrEqual(
					BigInt(
						(lots[i] as { survivingShares: string }).survivingShares.replace(
							".",
							"",
						),
					),
				);
			});
		});

		it("skips Sold lots entirely — they have nothing left to give", () => {
			const sold = sellFromLot({
				lot: lot("40", "100"),
				sharesToSell: d18("40"),
			});
			const alloc = allocateProRata({
				lots: [sold, lot("20", "100")],
				sharesToSell: d18("10"),
			});
			expect(alloc[0]).toBe(ZERO18);
			expect(alloc[1]).toBe(d18("10"));
		});

		it("throws LotOversellError above the holding's surviving total", () => {
			expect(() =>
				allocateProRata({
					lots: [lot("40", "100"), lot("20", "100")],
					sharesToSell: d18("61"),
				}),
			).toThrow(LotOversellError);
		});

		it("preserves the shipped single-lot Đa arithmetic byte-for-byte", () => {
			// `staked-episode-basis-post-partial-sell` asserts staked === "75" for
			// buy 100 → 40 shares, sell 10. With one lot the lot model and the
			// episode model are the same expression, and this pins that.
			const lots = [lot("40", "100")];
			const alloc = allocateProRata({ lots, sharesToSell: d18("10") });
			const after = lots.map((l, i) =>
				sellFromLot({ lot: l, sharesToSell: alloc[i] as string }),
			);
			expect(sumLots(after).survivingBasis).toBe(d18("75"));
			expect(sumLots(after).survivingShares).toBe(d18("30"));
		});
	});
});
