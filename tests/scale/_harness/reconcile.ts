// ENGINE.10 reconciler (BUILD — wired). The surfaces the scale tests + their
// negative controls call.
//
// Amendment E: the GLOBAL "Dharma in == out" identity is proven by TWO
// INDEPENDENT DERIVATIONS, cross-checked equal:
//   #1  composes the per-market checkers (`checkMarketConservation` /
//       `checkCorrectedMarketConservation`, src/server/dharma/conservation.ts)
//       over all markets — route A: per-market FLOW rows vs each market's net
//       admin pool injection (seed − unwind for terminal markets; reserves-delta
//       for open ones).
//   #2  an INDEPENDENT re-derivation (route B, NEVER the per-market flow rows of
//       #1): the global signed flow sum read off the running-balance tautology —
//       Σ latest `balance_after` minus Σ issuance (`initial_grant` +
//       `daily_allowance`) minus Σ `uncollectable`, using ONLY global ledger
//       aggregates.
// The HEADLINE ASSERTION is the cross-check: the two INDEPENDENT totals must
// AGREE (Amendment E — the non-vacuous core, proven by the leaked-snapshot
// negative control). Route A also catches a per-market leak directly (a double
// `bet_payout` inflates that market's Σ FLOW past its injection → its checker
// fails); the cross-check catches a global balances-vs-flows inconsistency.
//
// `reconcile` is PURE over a `ConservationSnapshot` so a deliberately-leaked
// SYNTHETIC snapshot can be injected by the negative control (no live DB).
// `gatherSnapshot` does the live-DB gathering. `walkLedgerChain` is the pure
// per-user ledger-chain walk, likewise injectable with a synthetic broken chain.

import { and, eq, inArray } from "drizzle-orm";

import {
	bets,
	dharmaLedger,
	events,
	markets,
	payoutEvents,
	pools,
	positions,
	resolutionEvents,
} from "@/db/schema";
import { CpmmDecimal } from "@/server/cpmm/decimal";
import {
	type ConservationResult,
	checkCorrectedMarketConservation,
	checkMarketConservation,
} from "@/server/dharma/conservation";
import { type DharmaEntryType, FLOW_TAGS } from "@/server/dharma/tags";

import { testClient, testDb } from "../../db/_fixtures/db";
import { SYNTHETIC_SEED_RESERVES } from "../_fixtures/markets";

/** A bet-tied flow row, as the per-market conservation checker consumes it. */
export interface LedgerFlow {
	amount: string;
	entryType: DharmaEntryType;
}

/** Per-market operands for derivation #1 (one entry per synthetic market). */
export interface MarketSnapshot {
	marketId: string;
	/** Bet-tied FLOW rows (betId-keyed) PLUS sell `bet_stake` flows attributed
	 *  via the `bet.sold` event (Amendment D — sells carry no market_id/bet_id
	 *  on the ledger row). */
	ledgerFlows: readonly LedgerFlow[];
	/** seed − poolUnwindAmount for a terminal market; (Y₀+N₀) − (Y+N) for an
	 *  open one (the reserves-delta the pool absorbed) — the conservation
	 *  `expected`. */
	netAdminPoolInjection: string;
	/** Correction operands — present only for a corrected market; the checker
	 *  degenerates to (★) when all three are zero/absent. */
	reverseRecordedTotal?: string;
	applyRecordedTotal?: string;
	uncollectableTotal?: string;
}

/** Global operands for derivation #2 — the attribution-INDEPENDENT identity. */
export interface GlobalSnapshot {
	/** Σ over users of each user's latest `balance_after`. */
	sumLatestBalances: string;
	/** Σ `initial_grant` ledger amounts (issuance faucet in). */
	sumInitialGrants: string;
	/** Σ `daily_allowance` ledger amounts (issuance faucet in). */
	sumDailyAllowances: string;
	/** Σ `poolUnwindAmount` over terminal (resolve/void) events — Dharma that
	 *  exits to the pool residual, never credited to a user. Reported diagnostic
	 *  + a non-negativity guard in derivation #2 (an unwind exit is admin↔pool,
	 *  outside the user ledger, so it is NOT subtracted from the balance
	 *  tautology). */
	sumPoolUnwindExits: string;
	/** Σ `uncollectable` ledger amounts (SIGNED) — forgiven (never-collected)
	 *  Dharma. Zero unless a correction floored a user at 0. */
	sumUncollectable: string;
}

export interface ConservationSnapshot {
	markets: readonly MarketSnapshot[];
	global: GlobalSnapshot;
}

export interface ReconcileResult {
	ok: boolean;
	derivation1: { ok: boolean; failingMarketIds: string[] };
	derivation2: { ok: boolean; expected: string; actual: string };
	crossCheck: {
		ok: boolean;
		derivation1Total: string;
		derivation2Total: string;
	};
}

const FLOW_SET = new Set<DharmaEntryType>(FLOW_TAGS);

/** True when any correction operand is present (corrected market → sibling checker). */
function isCorrected(m: MarketSnapshot): boolean {
	return (
		m.reverseRecordedTotal !== undefined ||
		m.applyRecordedTotal !== undefined ||
		m.uncollectableTotal !== undefined
	);
}

/**
 * Run derivation #1 (per-market checkers, route A) ⊕ derivation #2 (independent
 * global re-derivation, route B) ⊕ the headline cross-check. PURE over the
 * snapshot. `ok` is the AND of all three.
 */
export function reconcile(snapshot: ConservationSnapshot): ReconcileResult {
	// ── Derivation #1 — per-market conservation checkers (route A) ──────────────
	// d1Total accumulates each market's `expected` (== that market's Σ FLOW when
	// its checker passes), so a passing #1 sums to the global FLOW total.
	const failingMarketIds: string[] = [];
	let d1Total = new CpmmDecimal(0);
	for (const m of snapshot.markets) {
		let res: ConservationResult;
		let expected: InstanceType<typeof CpmmDecimal>;
		if (isCorrected(m)) {
			const reverseRecordedTotal = m.reverseRecordedTotal ?? "0";
			const applyRecordedTotal = m.applyRecordedTotal ?? "0";
			const uncollectableTotal = m.uncollectableTotal ?? "0";
			res = checkCorrectedMarketConservation({
				ledgerFlows: m.ledgerFlows,
				netAdminPoolInjection: m.netAdminPoolInjection,
				reverseRecordedTotal,
				applyRecordedTotal,
				uncollectableTotal,
			});
			expected = new CpmmDecimal(m.netAdminPoolInjection)
				.minus(reverseRecordedTotal)
				.plus(applyRecordedTotal)
				.plus(uncollectableTotal);
		} else {
			res = checkMarketConservation({
				ledgerFlows: m.ledgerFlows,
				netAdminPoolInjection: m.netAdminPoolInjection,
			});
			expected = new CpmmDecimal(m.netAdminPoolInjection);
		}
		if (!res.ok) failingMarketIds.push(m.marketId);
		d1Total = d1Total.plus(expected);
	}
	const d1ok = failingMarketIds.length === 0;

	// ── Derivation #2 — INDEPENDENT global re-derivation (route B) ──────────────
	// The global signed flow sum read off the running-balance tautology
	// (Σ latest balance == Σ issuance + Σ FLOW + Σ uncollectable), using ONLY
	// global ledger aggregates — never the per-market flow rows of #1. When
	// conservation holds this equals Σ per-market injection (#1).
	const g = snapshot.global;
	const issuance = new CpmmDecimal(g.sumInitialGrants).plus(
		g.sumDailyAllowances,
	);
	const uncollectable = new CpmmDecimal(g.sumUncollectable);
	const latestBalances = new CpmmDecimal(g.sumLatestBalances);
	const d2Total = latestBalances.minus(issuance).minus(uncollectable);
	// #2's internal identity: reconstruct Σ balances from issuance + the
	// independently-derived flow sum + forgiveness, and confirm it round-trips,
	// with the non-negativity guards the live economy must satisfy (an unwind
	// exit / a total balance can never be negative). The non-vacuous LEAK
	// detection is the cross-check below (Amendment E).
	const reconstructed = issuance.plus(d2Total).plus(uncollectable);
	const d2ok =
		reconstructed.equals(latestBalances) &&
		latestBalances.greaterThanOrEqualTo(0) &&
		new CpmmDecimal(g.sumPoolUnwindExits).greaterThanOrEqualTo(0);

	// ── Headline cross-check (Amendment E): the two INDEPENDENT totals agree ────
	const crossOk = d1Total.equals(d2Total);

	return {
		ok: d1ok && d2ok && crossOk,
		derivation1: { ok: d1ok, failingMarketIds },
		derivation2: {
			ok: d2ok,
			expected: reconstructed.toFixed(18),
			actual: latestBalances.toFixed(18),
		},
		crossCheck: {
			ok: crossOk,
			derivation1Total: d1Total.toFixed(18),
			derivation2Total: d2Total.toFixed(18),
		},
	};
}

/** The `poolUnwindAmount` recorded on a terminal market event's payload (settle:
 *  `market.resolved`; void: `market.voided`) — R-9.5e, the audit source. "0" if
 *  no such event (open market). */
async function poolUnwindFromEvent(
	marketId: string,
	eventType: "market.resolved" | "market.voided",
): Promise<string> {
	const rows = await testDb
		.select({ payload: events.payload })
		.from(events)
		.where(
			and(eq(events.eventType, eventType), eq(events.aggregateId, marketId)),
		);
	const payload = rows[0]?.payload as { poolUnwindAmount?: string } | undefined;
	return payload?.poolUnwindAmount ?? "0";
}

/** A market's bet-tied FLOW rows (betId-keyed) + sell `bet_stake` flows
 *  attributed via the `bet.sold` event (Amendment D). */
async function gatherMarketFlows(marketId: string): Promise<LedgerFlow[]> {
	const betRows = await testDb
		.select({ id: bets.id })
		.from(bets)
		.where(eq(bets.marketId, marketId));
	const betIds = betRows.map((b) => b.id);
	const betTied: LedgerFlow[] = [];
	if (betIds.length > 0) {
		const rows = await testDb
			.select({
				amount: dharmaLedger.amount,
				entryType: dharmaLedger.entryType,
			})
			.from(dharmaLedger)
			.where(inArray(dharmaLedger.betId, betIds));
		for (const r of rows) {
			if (FLOW_SET.has(r.entryType)) {
				betTied.push({ amount: r.amount, entryType: r.entryType });
			}
		}
	}
	// Sells write a bet_id-NULL `bet_stake` POSITIVE ledger row (sell.ts:71-76);
	// the per-market attribution rides the `bet.sold` event payload (Amendment D).
	const soldRows = await testDb
		.select({ payload: events.payload })
		.from(events)
		.where(
			and(eq(events.eventType, "bet.sold"), eq(events.aggregateId, marketId)),
		);
	const sellFlows: LedgerFlow[] = soldRows.map((e) => ({
		amount: (e.payload as { proceeds: string }).proceeds,
		entryType: "bet_stake" as const,
	}));
	return [...betTied, ...sellFlows];
}

/**
 * Gather a `ConservationSnapshot` from the live DB (all markets + global). Each
 * market's net admin pool injection is computed from its TERMINAL state:
 *  - resolve/correct → SEED − poolUnwindAmount (the `market.resolved` payload);
 *  - void           → SEED − poolUnwindAmount (the `market.voided` payload);
 *  - open           → (Y₀+N₀) − (Y+N), the reserves the pool absorbed from net
 *                     stakes (the hot-row identity).
 * Sells are attributed per-market via the `bet.sold` event (Amendment D). The
 * global aggregates (derivation #2) come from independent ledger/event reads.
 * Tolerant of `image_uploads` existing (empty, non-Dharma) — it queries
 * only the Dharma ledger + resolution/event rows.
 */
export async function gatherSnapshot(): Promise<ConservationSnapshot> {
	const marketRows = await testDb.select({ id: markets.id }).from(markets);

	const marketSnapshots: MarketSnapshot[] = [];
	let sumPoolUnwindExits = new CpmmDecimal(0);
	const seed = new CpmmDecimal(SYNTHETIC_SEED_RESERVES);

	for (const mkt of marketRows) {
		const marketId = mkt.id;
		const ledgerFlows = await gatherMarketFlows(marketId);

		const resKinds = await testDb
			.select({ eventKind: resolutionEvents.eventKind })
			.from(resolutionEvents)
			.where(eq(resolutionEvents.marketId, marketId));
		const kinds = new Set(resKinds.map((r) => r.eventKind));

		if (kinds.has("correct")) {
			// Corrected: injection from the original settle's market.resolved event;
			// reverse/apply recorded operands from the correction's payout legs;
			// uncollectable from the ledger (R-9.6 explicit operand).
			const unwind = await poolUnwindFromEvent(marketId, "market.resolved");
			sumPoolUnwindExits = sumPoolUnwindExits.plus(unwind);
			const legs = await testDb
				.select({
					payoutType: payoutEvents.payoutType,
					amount: payoutEvents.amount,
				})
				.from(payoutEvents)
				.where(eq(payoutEvents.marketId, marketId));
			let reverseRec = new CpmmDecimal(0);
			let applyRec = new CpmmDecimal(0);
			for (const leg of legs) {
				if (leg.payoutType === "correction_reverse") {
					reverseRec = reverseRec.plus(new CpmmDecimal(leg.amount).abs());
				} else if (leg.payoutType === "correction_apply") {
					applyRec = applyRec.plus(leg.amount);
				}
			}
			// NOTE (single-correction scope): `uncollectable` rows carry bet_id NULL
			// + no market_id, so they are not market-attributable (R-2, deferred) —
			// gathered GLOBALLY here. Correct while AT MOST ONE market is corrected
			// per snapshot (the battery's case). With two corrected markets this
			// would assign the global total to each, INFLATING d1Total — which trips
			// the headline cross-check as a FALSE FAILURE, never a silent pass. Scope
			// per-market when multi-correction coverage lands.
			const uncollectableRows = await testDb
				.select({ amount: dharmaLedger.amount })
				.from(dharmaLedger)
				.where(eq(dharmaLedger.entryType, "uncollectable"));
			const uncollectableTotal = uncollectableRows
				.reduce(
					(acc, r) => acc.plus(new CpmmDecimal(r.amount).abs()),
					new CpmmDecimal(0),
				)
				.toFixed(18);
			marketSnapshots.push({
				marketId,
				ledgerFlows,
				netAdminPoolInjection: seed.minus(unwind).toFixed(18),
				reverseRecordedTotal: reverseRec.toFixed(18),
				applyRecordedTotal: applyRec.toFixed(18),
				uncollectableTotal,
			});
		} else if (kinds.has("resolve")) {
			const unwind = await poolUnwindFromEvent(marketId, "market.resolved");
			sumPoolUnwindExits = sumPoolUnwindExits.plus(unwind);
			marketSnapshots.push({
				marketId,
				ledgerFlows,
				netAdminPoolInjection: seed.minus(unwind).toFixed(18),
			});
		} else if (kinds.has("void")) {
			const unwind = await poolUnwindFromEvent(marketId, "market.voided");
			sumPoolUnwindExits = sumPoolUnwindExits.plus(unwind);
			marketSnapshots.push({
				marketId,
				ledgerFlows,
				netAdminPoolInjection: seed.minus(unwind).toFixed(18),
			});
		} else {
			// Open: the pool's CASH backing = Y + Σ(YES positions) = seed + Σstakes
			// − Σproceeds (the void.ts:187 cash measure). A constant-product buy
			// barely moves Y+N (Δ(Y+N) ≈ 0.099 for a stake of 10), so the
			// reserve-SUM delta is NOT the Dharma the pool absorbed; the cash value
			// is. injection = seed − cash == Σ FLOW (bet_stake), proving no Dharma
			// leaked pre-resolution.
			const poolRow = await testDb
				.select({ yesReserves: pools.yesReserves })
				.from(pools)
				.where(eq(pools.marketId, marketId));
			const cash = new CpmmDecimal(
				poolRow[0]?.yesReserves ?? SYNTHETIC_SEED_RESERVES,
			).plus(await sumYesPositions(marketId));
			marketSnapshots.push({
				marketId,
				ledgerFlows,
				netAdminPoolInjection: seed.minus(cash).toFixed(18),
			});
		}
	}

	// ── Global aggregates (derivation #2) — independent ledger/event reads ──────
	const sumLatestBalances = await sumLatestBalancesPerUser();
	const sumInitialGrants = await sumLedgerByType("initial_grant");
	const sumDailyAllowances = await sumLedgerByType("daily_allowance");
	const sumUncollectable = await sumLedgerByType("uncollectable");

	return {
		markets: marketSnapshots,
		global: {
			sumLatestBalances,
			sumInitialGrants,
			sumDailyAllowances,
			sumPoolUnwindExits: sumPoolUnwindExits.toFixed(18),
			sumUncollectable,
		},
	};
}

/** Σ of each user's MOST-RECENT `balance_after` in the `seq` total order
 *  (ADR-0029) — DISTINCT ON the same key the chain walk uses. The former
 *  `(created_at, id)` key could pick a chain-earlier row on a same-ms tie
 *  (uuidv7 trailing bits are random) and report false conservation drift. */
async function sumLatestBalancesPerUser(): Promise<string> {
	const rows = (await testClient.unsafe(
		`SELECT DISTINCT ON (user_id) balance_after
		   FROM dharma_ledger
		  ORDER BY user_id, seq DESC`,
	)) as unknown as Array<{ balance_after: string }>;
	return rows
		.reduce((acc, r) => acc.plus(r.balance_after), new CpmmDecimal(0))
		.toFixed(18);
}

/** Σ quantity of the YES positions for a market — the held-shares half of the
 *  pool cash value `Y + Σ(YES positions)` (void.ts:178-187). */
async function sumYesPositions(marketId: string): Promise<string> {
	const rows = await testDb
		.select({ side: positions.side, quantity: positions.quantity })
		.from(positions)
		.where(eq(positions.marketId, marketId));
	return rows
		.filter((r) => r.side === "YES")
		.reduce((acc, r) => acc.plus(r.quantity), new CpmmDecimal(0))
		.toFixed(18);
}

/** Σ (signed) of all `dharma_ledger.amount` for one entry type. */
async function sumLedgerByType(entryType: DharmaEntryType): Promise<string> {
	const rows = await testDb
		.select({ amount: dharmaLedger.amount })
		.from(dharmaLedger)
		.where(eq(dharmaLedger.entryType, entryType));
	return rows
		.reduce((acc, r) => acc.plus(r.amount), new CpmmDecimal(0))
		.toFixed(18);
}

/**
 * Per-user ledger-chain walk over `(created_at, id)`-ordered rows:
 * `balance_after[i] === balance_after[i-1] + amount[i]` (implicit start balance
 * 0), and `balance_after >= 0` at every row. Returns `{ ok: true }` for an intact
 * chain, or `{ ok: false, brokenAtIndex }` at the first violating row. PURE so the
 * negative control can feed a synthetic broken chain.
 */
export function walkLedgerChain(
	rows: ReadonlyArray<{ amount: string; balanceAfter: string }>,
): { ok: boolean; brokenAtIndex?: number } {
	let prev = new CpmmDecimal(0);
	for (let i = 0; i < rows.length; i++) {
		const row = rows[i];
		if (row === undefined) continue;
		const actual = new CpmmDecimal(row.balanceAfter);
		const expected = prev.plus(row.amount);
		if (!actual.equals(expected) || actual.lessThan(0)) {
			return { ok: false, brokenAtIndex: i };
		}
		prev = actual;
	}
	return { ok: true };
}
