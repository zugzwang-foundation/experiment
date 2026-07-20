import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
	type BuyTrade,
	computeEpisodes,
	type EpisodeSide,
	type SellTrade,
	type Trade,
} from "@/server/profile/episodes";

// UI-A5 Slice 1 §5.6 tests-first (TDD RED) — fast-check properties for the
// SideEpisode + Đa module `src/server/profile/episodes.ts` (greenfield; the
// import WILL fail to resolve until the Slice 1 implementation lands — plan
// §2 Slice 1, §13 item 7: Đa is new money-adjacent arithmetic).
//
// Streams are generated VALID by construction — the INV-C4 resolve-against-
// live-state pattern from tests/unit/cpmm/_arbitraries.ts: a sell's size is
// resolved against the running held quantity (never exceeding it; a flat
// state forces a buy; full exit iff frac = 1), so ProfileTradeStreamError is
// unreachable over the generated domain and every property exercises the
// happy walk. All quantities are scaled bigints of 1e-18 units → 18-dp
// decimal strings; JS float arithmetic never constructs a value (CLAUDE.md
// §2). The bigint helpers are duplicated locally — _arbitraries.ts is the
// CPMM suite's private harness, not a shared fixture module.

// ─── bigint ↔ 18-dp helpers (ES2017 target ⇒ no bigint literal syntax) ──────

const pow10 = (n: number): bigint => BigInt(`1${"0".repeat(n)}`);
const SCALE = pow10(18);
const ZERO = BigInt(0);
const ONE = BigInt(1);
const ZERO18 = "0.000000000000000000";

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

function bigMax(a: bigint, b: bigint): bigint {
	return a > b ? a : b;
}

function bigMin(a: bigint, b: bigint): bigint {
	return a < b ? a : b;
}

/** |a − b| in 1e-18 units. */
function ulpDiff(a: bigint, b: bigint): bigint {
	const d = a - b;
	return d < ZERO ? -d : d;
}

// ─── fixed fast-check config (the cpmm-suite OQ-4/A8 pattern) ───────────────
// A fixed literal seed pins the fast-check 4.8.0 generation/shrink stream;
// NUM_RUNS matches the cpmm property suite.
const SEED = 20260720;
const NUM_RUNS = 1000;

// ─── generated trade domain ─────────────────────────────────────────────────
// Stakes/shares ∈ [0.01 Đ, 1000 Đ] — Σ over ≤ 16 trades stays comfortably
// inside the NUMERIC(38,18) envelope.
const TRADE_MIN = pow10(16);
const TRADE_MAX = pow10(21);

const BASE_MS = Date.parse("2026-09-15T00:00:00.000Z");

/** Strictly increasing instants — 1 s apart, so episode boundaries never tie. */
function tradeAt(i: number): Date {
	return new Date(BASE_MS + i * 1000);
}

/** UUIDv7-shaped id, lexicographically monotone in `n`. */
function tradeId(n: number): string {
	return `01991a2b-0000-7000-8000-${String(n).padStart(12, "0")}`;
}

function buyTrade(
	i: number,
	side: EpisodeSide,
	stake: bigint,
	shares: bigint,
): BuyTrade {
	return {
		source: "buy",
		id: tradeId(i),
		at: tradeAt(i),
		side,
		stake: decimalString(stake),
		shares: decimalString(shares),
	};
}

function sellTrade(i: number, side: EpisodeSide, shares: bigint): SellTrade {
	return {
		source: "sell",
		id: tradeId(i),
		at: tradeAt(i),
		side,
		shares: decimalString(shares),
	};
}

// A command is resolved against the LIVE walk state (the INV-C4 pattern):
// while flat, every command opens with a buy (side re-drawn, so flips across
// episodes are generated); while holding, "buy" adds on the held side and
// "sell" resolves max(1 unit, floor(held × frac)) — full exit iff frac = 1 —
// so a sell never exceeds the held quantity and the stream is always valid.
const KINDS = ["buy", "sell"] as const;

type Cmd = {
	kind: (typeof KINDS)[number];
	sideBit: boolean;
	stakeNum: bigint;
	sharesNum: bigint;
	fracNum: bigint; // sell fraction: frac = fracNum / SCALE ∈ (0, 1]
};

const cmdArb: fc.Arbitrary<Cmd> = fc.record({
	kind: fc.constantFrom(...KINDS),
	sideBit: fc.boolean(),
	stakeNum: fc.bigInt({ min: TRADE_MIN, max: TRADE_MAX }),
	sharesNum: fc.bigInt({ min: TRADE_MIN, max: TRADE_MAX }),
	fracNum: fc.bigInt({ min: ONE, max: SCALE }),
});

function resolveStream(cmds: Cmd[]): Trade[] {
	const trades: Trade[] = [];
	let side: EpisodeSide = "YES";
	let held = ZERO;
	for (const [i, cmd] of cmds.entries()) {
		if (held === ZERO) {
			// Flat — every command opens a fresh episode with a buy.
			side = cmd.sideBit ? "YES" : "NO";
			trades.push(buyTrade(i, side, cmd.stakeNum, cmd.sharesNum));
			held = held + cmd.sharesNum;
			continue;
		}
		if (cmd.kind === "buy") {
			trades.push(buyTrade(i, side, cmd.stakeNum, cmd.sharesNum));
			held = held + cmd.sharesNum;
			continue;
		}
		// floor(held × frac) < held whenever frac < 1; clamp to ≥ 1 unit.
		const floor = (held * cmd.fracNum) / SCALE;
		const sold = cmd.fracNum === SCALE ? held : bigMax(floor, ONE);
		trades.push(sellTrade(i, side, sold));
		held = held - sold;
	}
	return trades;
}

const streamArb: fc.Arbitrary<Trade[]> = fc
	.array(cmdArb, { maxLength: 16 })
	.map(resolveStream);

// Commutation domain (§10.3 identity): ONE episode — 1..4 buys on a single
// side, then either [sell q1, sell q2] or [sell (q1+q2)], with
// q1 ∈ [1, held−1] and q2 ∈ [1, held−q1] resolved from live state (full exit
// iff f2 = 1, and then in BOTH paths).
type CommutationBuy = { stakeNum: bigint; sharesNum: bigint };
type CommutationCase = {
	sideBit: boolean;
	buys: CommutationBuy[];
	f1: bigint;
	f2: bigint;
};

const commutationArb: fc.Arbitrary<CommutationCase> = fc.record({
	sideBit: fc.boolean(),
	buys: fc.array(
		fc.record({
			stakeNum: fc.bigInt({ min: TRADE_MIN, max: TRADE_MAX }),
			sharesNum: fc.bigInt({ min: TRADE_MIN, max: TRADE_MAX }),
		}),
		{ minLength: 1, maxLength: 4 },
	),
	f1: fc.bigInt({ min: ONE, max: SCALE }),
	f2: fc.bigInt({ min: ONE, max: SCALE }),
});

function lastBasis(trades: Trade[]): string {
	const walk = computeEpisodes(trades);
	return walk.steps[walk.steps.length - 1].basisAfter;
}

describe("episodes.property — SideEpisode/Đa laws over valid streams (SPEC.1 §23)", () => {
	it("basis ∈ [0, Σ episode gross stakes] at every step — never negative, never above the episode's gross", () => {
		fc.assert(
			fc.property(streamArb, (trades) => {
				const walk = computeEpisodes(trades);
				expect(walk.steps).toHaveLength(trades.length);
				const gross: bigint[] = walk.episodes.map(() => ZERO);
				for (const step of walk.steps) {
					if (step.trade.source === "buy") {
						gross[step.episodeIndex] =
							gross[step.episodeIndex] + toUnits(step.trade.stake);
					}
					const basis = toUnits(step.basisAfter);
					expect(basis).toBeGreaterThanOrEqual(ZERO);
					expect(basis).toBeLessThanOrEqual(gross[step.episodeIndex]);
				}
			}),
			{ seed: SEED, numRuns: NUM_RUNS },
		);
	});

	it("full exit ⇒ basis is exactly canonical zero — string-exact, never epsilon", () => {
		fc.assert(
			fc.property(streamArb, (trades) => {
				const walk = computeEpisodes(trades);
				for (const step of walk.steps) {
					if (toUnits(step.quantityAfter) === ZERO) {
						expect(step.quantityAfter).toBe(ZERO18);
						expect(step.basisAfter).toBe(ZERO18);
					}
				}
				for (const episode of walk.episodes) {
					if (episode.closedAt !== null) {
						expect(episode.stakedBasis).toBe(ZERO18);
						expect(episode.quantity).toBe(ZERO18);
					}
				}
			}),
			{ seed: SEED, numRuns: NUM_RUNS },
		);
	});

	it("pro-rata commutation — sell q1 then q2 ≡ sell (q1+q2), within one 1e-18 quantization per sell (§10.3 identity)", () => {
		fc.assert(
			fc.property(commutationArb, ({ sideBit, buys, f1, f2 }) => {
				const side: EpisodeSide = sideBit ? "YES" : "NO";
				const prefix = buys.map((b, i) =>
					buyTrade(i, side, b.stakeNum, b.sharesNum),
				);
				const held = buys.reduce((acc, b) => acc + b.sharesNum, ZERO);
				const q1 = bigMin(
					bigMax((held * f1) / SCALE / BigInt(2), ONE),
					held - ONE,
				);
				const rest = held - q1;
				const q2 = f2 === SCALE ? rest : bigMax((rest * f2) / SCALE, ONE);
				const n = buys.length;

				const split = [
					...prefix,
					sellTrade(n, side, q1),
					sellTrade(n + 1, side, q2),
				];
				const merged = [...prefix, sellTrade(n, side, q1 + q2)];

				const splitFinal = lastBasis(split);
				const mergedFinal = lastBasis(merged);
				if (q1 + q2 === held) {
					// Both paths are full exits — exact canonical zero, no tolerance.
					expect(splitFinal).toBe(ZERO18);
					expect(mergedFinal).toBe(ZERO18);
				} else {
					// ≤ (number of sells on the split path) × 1e-18: at most one
					// boundary quantization per sell (ROUND_HALF_EVEN ≤ 0.5 ulp each).
					expect(
						ulpDiff(toUnits(splitFinal), toUnits(mergedFinal)),
					).toBeLessThanOrEqual(BigInt(2));
				}
			}),
			{ seed: SEED, numRuns: NUM_RUNS },
		);
	});

	it("pro-rata commutation — exactly-divisible fixture is string-exact", () => {
		// stake 100 → 40 shares; split (8, 12) vs merged 20:
		// 100 × 32/40 = 80, then 80 × 20/32 = 50 | 100 × 20/40 = 50 — exact.
		const side: EpisodeSide = "YES";
		const prefix = [buyTrade(0, side, BigInt(100) * SCALE, BigInt(40) * SCALE)];
		const split = [
			...prefix,
			sellTrade(1, side, BigInt(8) * SCALE),
			sellTrade(2, side, BigInt(12) * SCALE),
		];
		const merged = [...prefix, sellTrade(1, side, BigInt(20) * SCALE)];
		expect(lastBasis(split)).toBe("50.000000000000000000");
		expect(lastBasis(merged)).toBe("50.000000000000000000");
	});

	it("quantityAfter ≡ Σ buy shares − Σ sell shares at every step (add/sub exact at 18 dp)", () => {
		fc.assert(
			fc.property(streamArb, (trades) => {
				const walk = computeEpisodes(trades);
				expect(walk.steps).toHaveLength(trades.length);
				let running = ZERO;
				for (const step of walk.steps) {
					running =
						step.trade.source === "buy"
							? running + toUnits(step.trade.shares)
							: running - toUnits(step.trade.shares);
					expect(toUnits(step.quantityAfter)).toBe(running);
				}
			}),
			{ seed: SEED, numRuns: NUM_RUNS },
		);
	});

	it("episodes partition the stream — monotone episodeIndex; episode i+1 opens strictly after episode i closes", () => {
		fc.assert(
			fc.property(streamArb, (trades) => {
				const walk = computeEpisodes(trades);
				expect(walk.steps).toHaveLength(trades.length);
				if (walk.steps.length === 0) {
					expect(walk.episodes).toHaveLength(0);
					return;
				}
				expect(walk.steps[0].episodeIndex).toBe(0);
				let prev = 0;
				for (const step of walk.steps) {
					// Monotone non-decreasing; a partition has no empty part, so
					// the index never skips.
					expect(step.episodeIndex).toBeGreaterThanOrEqual(prev);
					expect(step.episodeIndex - prev).toBeLessThanOrEqual(1);
					prev = step.episodeIndex;
				}
				expect(prev).toBe(walk.episodes.length - 1);
				for (let i = 0; i + 1 < walk.episodes.length; i++) {
					const current = walk.episodes[i];
					const next = walk.episodes[i + 1];
					expect(current.closedAt).not.toBeNull();
					if (current.closedAt !== null) {
						expect(next.openedAt.getTime()).toBeGreaterThan(
							current.closedAt.getTime(),
						);
					}
				}
			}),
			{ seed: SEED, numRuns: NUM_RUNS },
		);
	});
});
