import { describe, expect, it } from "vitest";

import {
	type BuyTrade,
	computeEpisodes,
	type EpisodeSide,
	mergeTradeStream,
	ProfileTradeStreamError,
	type SellTrade,
	type Trade,
} from "@/server/profile/episodes";

// UI-A5 Slice 1 §5.6 tests-first (TDD RED) — the SideEpisode + Đa pure math
// module `src/server/profile/episodes.ts` (greenfield; these imports WILL fail
// to resolve until the Slice 1 implementation lands — that unresolved-import
// RED state is the goal, per @docs/plans/UI-A5.md §2 Slice 1).
//
// Law under test — SPEC.1 1.0.18 §2 "SideEpisode" + §23 "The Đa staked basis":
// a SideEpisode is a maximal same-side holding interval in one market (opens
// when position quantity first rises from zero on a side; closes when it
// returns to zero). Đa = the cost basis of the still-held shares within the
// current episode — Σ of the episode's bet stakes, reduced pro-rata on every
// partial sell (basis′ = basis × (q − q_sold)/q); a full exit closes the
// episode and zeroes the basis; re-entry opens a fresh episode — prior-episode
// prices never blend.
//
// N-3 deterministic merge law (plan §2 Slice 1 verbatim; §13 item 10): merge
// key = `created_at` ascending across both sources (buys from `bets` rows,
// sells from `bet.sold` events); cross-source same-timestamp tiebreak = buy
// before sell (the only interleave that keeps the running quantity
// non-negative); within-source tiebreak = `id` ascending (UUIDv7,
// time-ordered).
//
// Money-as-string (CLAUDE.md §2): every expected value is an exact 18-dp
// decimal-string literal built by pad-only construction — JS float arithmetic
// never produces an expected quantity. Fixtures are exactly-divisible so every
// pro-rata expectation is exact, never tolerance-based.

const ZERO18 = "0.000000000000000000";

/** "153.5" → "153.500000000000000000" — decimal-point padding, no math. */
function dp18(value: string): string {
	const [int, frac = ""] = value.split(".");
	return `${int}.${frac.padEnd(18, "0")}`;
}

// ─── fixture builders ───────────────────────────────────────────────────────

const T0 = Date.parse("2026-09-20T10:00:00.000Z");

/** Fixture instant: T0 + `ms`. Identical `ms` ⇒ identical timestamp (a tie). */
function at(ms: number): Date {
	return new Date(T0 + ms);
}

/** UUIDv7-shaped id, lexicographically monotone in `n` (time-ordered). */
function uid(n: number): string {
	return `01991a2b-0000-7000-8000-${String(n).padStart(12, "0")}`;
}

function buy(t: {
	id: string;
	at: Date;
	stake: string;
	shares: string;
	side?: EpisodeSide;
}): BuyTrade {
	return {
		source: "buy",
		id: t.id,
		at: t.at,
		side: t.side ?? "YES",
		stake: dp18(t.stake),
		shares: dp18(t.shares),
	};
}

function sell(t: {
	id: string;
	at: Date;
	shares: string;
	side?: EpisodeSide;
}): SellTrade {
	return {
		source: "sell",
		id: t.id,
		at: t.at,
		side: t.side ?? "YES",
		shares: dp18(t.shares),
	};
}

function pick<T>(items: T[], order: number[]): T[] {
	return order.map((i) => items[i]);
}

describe("mergeTradeStream — the N-3 deterministic merge law", () => {
	it("same-timestamp-interleave (N-3 fixture) — cross-source tie = buy before sell; within-source tie = id ascending; the cross-source tie is broken by source, never by id", () => {
		// (a) A buy and a sell at the IDENTICAL instant where sell-first would
		// drive the running quantity negative: held 40; at t1 a buy of 10
		// shares and a sell of 45 shares. Sell-first ⇒ 40 − 45 < 0 (invalid);
		// the N-3 order (buy first) ⇒ 40 + 10 − 45 = 5 ≥ 0.
		const open = buy({ id: uid(1), at: at(0), stake: "100", shares: "40" });
		const buyAtT1 = buy({
			id: uid(3),
			at: at(1000),
			stake: "30",
			shares: "10",
		});
		const sellAtT1 = sell({ id: uid(4), at: at(1000), shares: "45" });

		const merged = mergeTradeStream([open, buyAtT1], [sellAtT1]);
		expect(merged.map((t) => t.id)).toEqual([uid(1), uid(3), uid(4)]);
		expect(merged.map((t) => t.source)).toEqual(["buy", "buy", "sell"]);

		const walk = computeEpisodes(merged);
		expect(walk.steps[2].quantityAfter).toBe(dp18("5"));

		// The rejected interleave (sell before the same-instant buy) is exactly
		// the stream computeEpisodes refuses — buy-before-sell is the only
		// quantity-non-negative order.
		expect(() => computeEpisodes([open, sellAtT1, buyAtT1])).toThrowError(
			ProfileTradeStreamError,
		);

		// (b) Within-source same-instant tie → id ascending: two same-instant
		// buys presented in reversed array order come out id-sorted.
		const bEarly = buy({ id: uid(6), at: at(5000), stake: "10", shares: "4" });
		const bLate = buy({ id: uid(7), at: at(5000), stake: "10", shares: "4" });
		expect(mergeTradeStream([bLate, bEarly], []).map((t) => t.id)).toEqual([
			uid(6),
			uid(7),
		]);

		// (c) A JS-Date millisecond tie ACROSS sources is broken by SOURCE
		// (buy first), never by id across sources: the sell's UUIDv7 sorts
		// BELOW the buy's, yet the buy still merges first.
		const buyHiId = buy({
			id: uid(9),
			at: at(1000),
			stake: "30",
			shares: "10",
		});
		const sellLoId = sell({ id: uid(2), at: at(1000), shares: "20" });
		const mergedC = mergeTradeStream([open, buyHiId], [sellLoId]);
		expect(mergedC.map((t) => t.id)).toEqual([uid(1), uid(9), uid(2)]);
		expect(computeEpisodes(mergedC).steps[2].quantityAfter).toBe(dp18("30"));
	});

	it("mergeTradeStream determinism — shuffled input array order never changes the output order", () => {
		const b0 = buy({ id: uid(1), at: at(0), stake: "100", shares: "40" });
		const s0 = sell({ id: uid(2), at: at(1000), shares: "10" });
		// t2 carries a within-source buy tie (uid 4 < uid 5) AND a cross-source
		// tie with a lower-id sell (uid 3) that must still sort after the buys.
		const s1 = sell({ id: uid(3), at: at(2000), shares: "20" });
		const b1 = buy({ id: uid(4), at: at(2000), stake: "25", shares: "10" });
		const b2 = buy({ id: uid(5), at: at(2000), stake: "25", shares: "10" });

		const expected = [uid(1), uid(2), uid(4), uid(5), uid(3)];
		const buyOrders = [
			[0, 1, 2],
			[2, 0, 1],
			[1, 2, 0],
			[2, 1, 0],
		];
		const sellOrders = [
			[0, 1],
			[1, 0],
		];
		for (const buyOrder of buyOrders) {
			for (const sellOrder of sellOrders) {
				const merged = mergeTradeStream(
					pick([b0, b1, b2], buyOrder),
					pick([s0, s1], sellOrder),
				);
				expect(merged.map((t) => t.id)).toEqual(expected);
			}
		}
	});
});

describe("computeEpisodes — SideEpisode walk + the Đa staked basis (SPEC.1 §23)", () => {
	it("no-sell = Σ stakes — multiple buys, no sells: Đa is the exact stake sum", () => {
		const trades: Trade[] = [
			buy({ id: uid(1), at: at(0), stake: "100", shares: "40" }),
			buy({ id: uid(2), at: at(1000), stake: "50", shares: "10" }),
			buy({ id: uid(3), at: at(2000), stake: "3.5", shares: "0.7" }),
		];
		const walk = computeEpisodes(trades);

		expect(walk.episodes).toHaveLength(1);
		const episode = walk.episodes[0];
		expect(episode.side).toBe("YES");
		expect(episode.openedAt).toEqual(at(0));
		expect(episode.closedAt).toBeNull();
		expect(episode.openingTradeId).toBe(uid(1));
		expect(episode.stakedBasis).toBe(dp18("153.5"));
		expect(episode.quantity).toBe(dp18("50.7"));
		expect(walk.steps.map((s) => s.basisAfter)).toEqual([
			dp18("100"),
			dp18("150"),
			dp18("153.5"),
		]);
	});

	it("partial-sell pro-rata — basis′ = basis × (q − q_sold)/q, exactly divisible", () => {
		// stake 100 buys 40 shares; selling 10 of 40 leaves basis
		// 100 × 30/40 = 75 exactly.
		const trades: Trade[] = [
			buy({ id: uid(1), at: at(0), stake: "100", shares: "40" }),
			sell({ id: uid(2), at: at(1000), shares: "10" }),
		];
		const walk = computeEpisodes(trades);

		expect(walk.episodes).toHaveLength(1);
		const episode = walk.episodes[0];
		expect(episode.closedAt).toBeNull();
		expect(episode.stakedBasis).toBe(dp18("75"));
		expect(episode.quantity).toBe(dp18("30"));
		expect(walk.steps[1].quantityAfter).toBe(dp18("30"));
		expect(walk.steps[1].basisAfter).toBe(dp18("75"));
	});

	it("full-exit-zeroes — sell-all closes the episode; basis and quantity are canonical zero", () => {
		const exitAt = at(1000);
		const trades: Trade[] = [
			buy({ id: uid(1), at: at(0), stake: "100", shares: "40" }),
			sell({ id: uid(2), at: exitAt, shares: "40" }),
		];
		const walk = computeEpisodes(trades);

		expect(walk.episodes).toHaveLength(1);
		const episode = walk.episodes[0];
		expect(episode.closedAt).toEqual(exitAt);
		expect(episode.stakedBasis).toBe(ZERO18);
		expect(episode.quantity).toBe(ZERO18);
		expect(walk.steps[1].quantityAfter).toBe(ZERO18);
		expect(walk.steps[1].basisAfter).toBe(ZERO18);
	});

	it("re-entry-fresh-basis — a fresh episode after a full exit carries only the new stake", () => {
		const trades: Trade[] = [
			buy({ id: uid(1), at: at(0), stake: "100", shares: "40" }),
			sell({ id: uid(2), at: at(1000), shares: "40" }),
			buy({ id: uid(3), at: at(2000), stake: "60", shares: "20" }),
		];
		const walk = computeEpisodes(trades);

		expect(walk.episodes).toHaveLength(2);
		const [first, second] = walk.episodes;
		expect(first.closedAt).toEqual(at(1000));
		expect(first.stakedBasis).toBe(ZERO18);
		expect(first.openingTradeId).toBe(uid(1));
		expect(second.side).toBe("YES");
		expect(second.openedAt).toEqual(at(2000));
		expect(second.closedAt).toBeNull();
		// Prior-episode prices never blend: only the new stake counts.
		expect(second.stakedBasis).toBe(dp18("60"));
		expect(second.quantity).toBe(dp18("20"));
		expect(second.openingTradeId).toBe(uid(3));
		expect(second.openingTradeId).not.toBe(first.openingTradeId);
		expect(walk.steps[2].episodeIndex).toBe(1);
	});

	it("multi-episode stream — YES → full exit → NO flip carries sides in order; an opposite-side buy while held throws", () => {
		const trades: Trade[] = [
			buy({ id: uid(1), at: at(0), side: "YES", stake: "100", shares: "40" }),
			sell({ id: uid(2), at: at(1000), side: "YES", shares: "40" }),
			buy({ id: uid(3), at: at(2000), side: "NO", stake: "80", shares: "32" }),
		];
		const walk = computeEpisodes(trades);

		expect(walk.episodes.map((e) => e.side)).toEqual(["YES", "NO"]);
		expect(walk.episodes[0].closedAt).toEqual(at(1000));
		expect(walk.episodes[1].closedAt).toBeNull();
		expect(walk.episodes[1].stakedBasis).toBe(dp18("80"));
		expect(walk.episodes[1].quantity).toBe(dp18("32"));

		// One-held-side: buying NO while YES is still held is invalid (the
		// positions one-held-side invariant makes it unreachable in real data).
		const invalid: Trade[] = [
			buy({ id: uid(1), at: at(0), side: "YES", stake: "100", shares: "40" }),
			buy({ id: uid(2), at: at(1000), side: "NO", stake: "50", shares: "20" }),
		];
		expect(() => computeEpisodes(invalid)).toThrowError(
			ProfileTradeStreamError,
		);
	});

	it("mid-episode additional buy — basis = stake1 + stake2; no pro-rata until a sell", () => {
		const trades: Trade[] = [
			buy({ id: uid(1), at: at(0), stake: "100", shares: "40" }),
			buy({ id: uid(2), at: at(1000), stake: "60", shares: "20" }),
			sell({ id: uid(3), at: at(2000), shares: "30" }),
		];
		const walk = computeEpisodes(trades);

		expect(walk.steps.map((s) => s.basisAfter)).toEqual([
			dp18("100"),
			dp18("160"), // additive on buy — pro-rata applies only to sells
			dp18("80"), // 160 × 30/60 exactly
		]);
		expect(walk.steps.map((s) => s.quantityAfter)).toEqual([
			dp18("40"),
			dp18("60"),
			dp18("30"),
		]);
	});

	it("sell-exceeding-held throws ProfileTradeStreamError with kind profile_trade_stream_invalid", () => {
		const trades: Trade[] = [
			buy({ id: uid(1), at: at(0), stake: "100", shares: "40" }),
			sell({ id: uid(2), at: at(1000), shares: "41" }),
		];
		expect(() => computeEpisodes(trades)).toThrowError(ProfileTradeStreamError);

		let caught: unknown;
		try {
			computeEpisodes(trades);
		} catch (err) {
			caught = err;
		}
		expect(caught).toBeInstanceOf(ProfileTradeStreamError);
		if (caught instanceof ProfileTradeStreamError) {
			expect(caught.kind).toBe("profile_trade_stream_invalid");
		}
	});

	it("sell-while-flat throws ProfileTradeStreamError", () => {
		expect(() =>
			computeEpisodes([sell({ id: uid(1), at: at(0), shares: "5" })]),
		).toThrowError(ProfileTradeStreamError);

		// Flat again after a full exit — a further sell is equally invalid.
		const afterExit: Trade[] = [
			buy({ id: uid(1), at: at(0), stake: "100", shares: "40" }),
			sell({ id: uid(2), at: at(1000), shares: "40" }),
			sell({ id: uid(3), at: at(2000), shares: "1" }),
		];
		expect(() => computeEpisodes(afterExit)).toThrowError(
			ProfileTradeStreamError,
		);
	});

	it("empty stream → { episodes: [], steps: [] }", () => {
		expect(computeEpisodes([])).toEqual({ episodes: [], steps: [] });
	});

	it("opposite-side sell while holding throws ProfileTradeStreamError", () => {
		const trades: Trade[] = [
			buy({ id: uid(1), at: at(0), side: "YES", stake: "100", shares: "40" }),
			sell({ id: uid(2), at: at(1000), side: "NO", shares: "10" }),
		];
		expect(() => computeEpisodes(trades)).toThrowError(ProfileTradeStreamError);
	});

	it("non-positive shares or stake throws ProfileTradeStreamError", () => {
		expect(() =>
			computeEpisodes([
				buy({ id: uid(1), at: at(0), stake: "100", shares: "0" }),
			]),
		).toThrowError(ProfileTradeStreamError);
		expect(() =>
			computeEpisodes([
				buy({ id: uid(1), at: at(0), stake: "0", shares: "40" }),
			]),
		).toThrowError(ProfileTradeStreamError);
	});

	it("malformed quantity strings (NaN / Infinity / exponent) fail loud, never poison the walk", () => {
		// Bypass the dp18 fixture builder — the malformed string IS the subject.
		const nanStake: Trade[] = [
			{
				source: "buy",
				id: uid(1),
				at: at(0),
				side: "YES",
				stake: "NaN",
				shares: dp18("40"),
			},
		];
		expect(() => computeEpisodes(nanStake)).toThrowError(
			ProfileTradeStreamError,
		);

		const infShares: Trade[] = [
			{
				source: "buy",
				id: uid(1),
				at: at(0),
				side: "YES",
				stake: dp18("100"),
				shares: "Infinity",
			},
		];
		expect(() => computeEpisodes(infShares)).toThrowError(
			ProfileTradeStreamError,
		);

		const expShares: Trade[] = [
			buy({ id: uid(1), at: at(0), stake: "100", shares: "40" }),
			{ source: "sell", id: uid(2), at: at(1000), side: "YES", shares: "1e2" },
		];
		expect(() => computeEpisodes(expShares)).toThrowError(
			ProfileTradeStreamError,
		);
	});

	it("steps[] — per-trade quantityAfter/basisAfter with correct episodeIndex across a two-episode walk", () => {
		const trades: Trade[] = [
			buy({ id: uid(1), at: at(0), side: "YES", stake: "100", shares: "40" }),
			buy({ id: uid(2), at: at(1000), side: "YES", stake: "60", shares: "20" }),
			sell({ id: uid(3), at: at(2000), side: "YES", shares: "15" }),
			sell({ id: uid(4), at: at(3000), side: "YES", shares: "45" }),
			buy({ id: uid(5), at: at(4000), side: "NO", stake: "25", shares: "10" }),
		];
		const walk = computeEpisodes(trades);

		expect(walk.steps).toHaveLength(trades.length);
		expect(walk.steps.map((s) => s.trade.id)).toEqual(trades.map((t) => t.id));
		expect(
			walk.steps.map((s) => ({
				episodeIndex: s.episodeIndex,
				quantityAfter: s.quantityAfter,
				basisAfter: s.basisAfter,
			})),
		).toEqual([
			{ episodeIndex: 0, quantityAfter: dp18("40"), basisAfter: dp18("100") },
			{ episodeIndex: 0, quantityAfter: dp18("60"), basisAfter: dp18("160") },
			// 160 × 45/60 = 120 exactly
			{ episodeIndex: 0, quantityAfter: dp18("45"), basisAfter: dp18("120") },
			{ episodeIndex: 0, quantityAfter: ZERO18, basisAfter: ZERO18 },
			{ episodeIndex: 1, quantityAfter: dp18("10"), basisAfter: dp18("25") },
		]);
		expect(walk.episodes).toHaveLength(2);
		expect(walk.episodes[0].closedAt).toEqual(at(3000));
		expect(walk.episodes[1].openedAt).toEqual(at(4000));
	});
});
