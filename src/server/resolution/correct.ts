import "server-only";

import type Decimal from "decimal.js";
import { and, asc, eq, gt } from "drizzle-orm";

import {
	bets,
	markets,
	payoutEvents,
	positions,
	resolutionEvents,
} from "@/db/schema";
import { CpmmDecimal } from "@/server/cpmm/decimal";
import { appendLedgerRow, readBalance } from "@/server/dharma/persist";
import { insertEvent } from "@/server/events/insert";

import {
	applySideBasis,
	assertStrictlyNegative,
	assertStrictlyPositive,
} from "./basis";
import { CorrectionOutcomeError } from "./errors";
import {
	type ResolutionEventMetadata,
	runResolutionTransaction,
} from "./transaction";

const CANONICAL_ZERO = "0.000000000000000000";

/**
 * W-3c — F-RESOLVE-2 correct: reverses the chain tip's RECORDED positive
 * payout legs per user FLOORED AT ZERO (R-9.6 — one `correction_reverse` row
 * of `−min(R,B)` plus the model-A `uncollectable` remainder, the documented
 * pair), applies the corrected side per-bet at the R-9.8 basis, appends the
 * `corrects_event_id` chain (INV-4: corrections are NEW rows, never UPDATEs),
 * and projects `markets.resolution_outcome` to the chain tip (OQ-2 — status
 * and `resolved_at` untouched, so the emergent comment lock holds).
 *
 * Reversal amounts are read from the RECORDED `payout_events` rows of the
 * corrected event — never a recomputation (R-9.8 corollary).
 */
export async function correctResolution(args: {
	marketId: string;
	correctedSide: "YES" | "NO";
	reason: string;
	/** Minted at handler entry, closed over (retry-purity, ADR-0016 D1). */
	correctEventId: string;
	metadata: ResolutionEventMetadata;
}): Promise<{
	correctionEventId: string;
	betsAffected: number;
	uncollectableTotal: string;
}> {
	// R-9.3 hard constraint: corrected outcomes are YES/NO only — checked
	// before any IO (a JS caller can bypass the TS union).
	if (args.correctedSide !== "YES" && args.correctedSide !== "NO") {
		throw new CorrectionOutcomeError({
			correctedSide: String(args.correctedSide),
			tipOutcome: null,
		});
	}
	if (args.reason.trim() === "") {
		throw new Error("correctResolution: reason is mandatory (R-9.1)");
	}

	return runResolutionTransaction(
		{
			marketId: args.marketId,
			flow: "F-RESOLVE-2",
			expectedStatus: ["Resolved"],
			lockPool: true,
			statementTimeoutMs: 5_000,
		},
		async ({ tx }) => {
			// Chain tip (order-free): the market's resolution_events row whose id
			// appears in no other row's corrects_event_id — under the 0014
			// corrects-link CHECK and the Resolved gate, exactly one exists and
			// its kind ∈ {resolve, correct} (a `void` tip is unreachable).
			const chainRows = await tx
				.select({
					id: resolutionEvents.id,
					eventKind: resolutionEvents.eventKind,
					outcome: resolutionEvents.outcome,
					correctsEventId: resolutionEvents.correctsEventId,
				})
				.from(resolutionEvents)
				.where(eq(resolutionEvents.marketId, args.marketId));
			const correctedIds = new Set(
				chainRows.map((row) => row.correctsEventId).filter(Boolean),
			);
			const tips = chainRows.filter((row) => !correctedIds.has(row.id));
			const tip = tips[0];
			if (tips.length !== 1 || tip === undefined) {
				throw new Error(
					`correctResolution: expected exactly one chain tip for ${args.marketId}, found ${tips.length}`,
				);
			}
			if (tip.eventKind !== "resolve" && tip.eventKind !== "correct") {
				throw new Error(
					`correctResolution: illegal chain tip kind ${tip.eventKind} under a Resolved gate`,
				);
			}

			// OQ-3 (RATIFIED): same-as-tip corrected outcome is rejected.
			if (args.correctedSide === tip.outcome) {
				throw new CorrectionOutcomeError({
					correctedSide: args.correctedSide,
					tipOutcome: tip.outcome,
				});
			}

			// Recorded entitlements (R-9.8 corollary — never recomputed): the
			// tip's strictly-positive payout legs (bet_payout rows for a resolve
			// tip, correction_apply rows for a correction tip).
			const recordedLegs = await tx
				.select({
					betId: payoutEvents.betId,
					userId: payoutEvents.userId,
					amount: payoutEvents.amount,
				})
				.from(payoutEvents)
				.where(
					and(
						eq(payoutEvents.resolutionEventId, tip.id),
						gt(payoutEvents.amount, "0"),
					),
				);
			const recordedByBet = new Map(
				recordedLegs.map((leg) => [leg.betId, leg.amount]),
			);
			const recordedByUser = new Map<string, Decimal>();
			for (const leg of recordedLegs) {
				recordedByUser.set(
					leg.userId,
					(recordedByUser.get(leg.userId) ?? new CpmmDecimal(0)).plus(
						leg.amount,
					),
				);
			}

			// Read bets + positions; apply basis for the corrected side via the
			// same prorate.
			const betRows = await tx
				.select({
					id: bets.id,
					userId: bets.userId,
					side: bets.side,
					shareQuantity: bets.shareQuantity,
				})
				.from(bets)
				.where(eq(bets.marketId, args.marketId))
				.orderBy(asc(bets.id));
			const positionRows = await tx
				.select({
					userId: positions.userId,
					side: positions.side,
					quantity: positions.quantity,
				})
				.from(positions)
				.where(eq(positions.marketId, args.marketId));
			const applyByBet = applySideBasis({
				bets: betRows,
				positions: positionRows,
				payingSide: args.correctedSide,
			});

			const inserted = await tx
				.insert(resolutionEvents)
				.values({
					marketId: args.marketId,
					eventKind: "correct",
					outcome: args.correctedSide,
					correctsEventId: tip.id,
					reason: args.reason,
				})
				.returning({ id: resolutionEvents.id });
			const correctionEventId = inserted[0]?.id;
			if (correctionEventId === undefined) {
				throw new Error(
					"correctResolution: resolution_events INSERT returned no row",
				);
			}

			// TWO payout legs per bet (C-7, zero legs included): the reverse leg
			// records −recorded (NEVER the floored ledger value); the apply leg
			// records the corrected-side basis. Ordered (user_id, bet id).
			const orderedBets = [...betRows].sort((a, b) =>
				a.userId === b.userId
					? a.id < b.id
						? -1
						: 1
					: a.userId < b.userId
						? -1
						: 1,
			);
			if (orderedBets.length > 0) {
				await tx.insert(payoutEvents).values(
					orderedBets.flatMap((bet) => {
						const recorded = recordedByBet.get(bet.id);
						const reverseAmount =
							recorded === undefined
								? CANONICAL_ZERO
								: new CpmmDecimal(recorded).negated().toFixed(18);
						return [
							{
								betId: bet.id,
								userId: bet.userId,
								marketId: args.marketId,
								resolutionEventId: correctionEventId,
								payoutType: "correction_reverse" as const,
								amount: reverseAmount,
							},
							{
								betId: bet.id,
								userId: bet.userId,
								marketId: args.marketId,
								resolutionEventId: correctionEventId,
								payoutType: "correction_apply" as const,
								amount: applyByBet.get(bet.id) ?? CANONICAL_ZERO,
							},
						];
					}),
				);
			}

			// Ledger — the documented reverse+uncollectable pair (C-4), per user
			// ordered by user id, fully chained via `previousBalance`. The
			// per-user aggregate −min(R,B) is the only chain-safe floored form
			// (per-bet reverse rows would walk the balance through intermediate
			// negatives and trip the overdraft guard mid-walk).
			const userIds = [
				...new Set([
					...recordedByUser.keys(),
					...orderedBets
						.filter(
							(bet) => !new CpmmDecimal(applyByBet.get(bet.id) ?? "0").isZero(),
						)
						.map((bet) => bet.userId),
				]),
			].sort();
			let uncollectableTotal = new CpmmDecimal(0);
			for (const userId of userIds) {
				let previousBalance = await readBalance(tx, userId);
				const recorded = recordedByUser.get(userId) ?? new CpmmDecimal(0);

				if (recorded.greaterThan(0)) {
					// Anchor betId = the user's earliest affected bet id (min UUID)
					// in this market (C-4 — per-market conservation gathering keys
					// on bet_id; a NULL anchor would be invisible).
					const anchor = orderedBets
						.filter((bet) => bet.userId === userId && recordedByBet.has(bet.id))
						.map((bet) => bet.id)
						.sort()[0];
					if (anchor === undefined) {
						throw new Error(
							`correctResolution: recorded entitlement with no anchoring bet for user ${userId}`,
						);
					}

					const balance = new CpmmDecimal(previousBalance);
					const collectable = CpmmDecimal.min(recorded, balance);
					if (collectable.greaterThan(0)) {
						const reverseAmount = collectable.negated().toFixed(18);
						assertStrictlyNegative(
							reverseAmount,
							"correctResolution correction_reverse",
						);
						const appended = await appendLedgerRow(tx, {
							userId,
							amount: reverseAmount,
							entryType: "correction_reverse",
							betId: anchor,
							previousBalance,
						});
						previousBalance = appended.balanceAfter;
					}
					if (recorded.greaterThan(balance)) {
						// Model A (ENGINE.5): amount ≤ 0, balance_after = previous —
						// the shipped ledger guard is the only defense (A9).
						const remainder = recorded.minus(balance);
						uncollectableTotal = uncollectableTotal.plus(remainder);
						const appended = await appendLedgerRow(tx, {
							userId,
							amount: remainder.negated().toFixed(18),
							entryType: "uncollectable",
							betId: anchor,
							previousBalance,
						});
						previousBalance = appended.balanceAfter;
					}
				}

				// Apply legs: chained positive rows per non-zero corrected-side
				// bet, betId = that bet.
				for (const bet of orderedBets) {
					if (bet.userId !== userId) continue;
					const amount = applyByBet.get(bet.id) ?? CANONICAL_ZERO;
					if (new CpmmDecimal(amount).isZero()) continue;
					assertStrictlyPositive(amount, "correctResolution correction_apply");
					const appended = await appendLedgerRow(tx, {
						userId,
						amount,
						entryType: "correction_apply",
						betId: bet.id,
						previousBalance,
					});
					previousBalance = appended.balanceAfter;
				}
			}

			// OQ-2 (RATIFIED): the read-model projection of the chain tip —
			// status and resolved_at untouched.
			const updated = await tx
				.update(markets)
				.set({ resolutionOutcome: args.correctedSide })
				.where(eq(markets.id, args.marketId))
				.returning({ id: markets.id });
			if (updated.length !== 1) {
				throw new Error(
					`correctResolution: outcome UPDATE matched ${updated.length} rows for ${args.marketId}`,
				);
			}

			await insertEvent(tx, {
				eventId: args.correctEventId,
				eventType: "market.corrected",
				aggregateType: "market",
				aggregateId: args.marketId,
				payload: {
					marketId: args.marketId,
					correctsEventId: tip.id,
					correctedWinningSide: args.correctedSide,
					resolutionNote: args.reason,
				},
				metadata: args.metadata,
			});

			return {
				correctionEventId,
				betsAffected: betRows.length,
				uncollectableTotal: uncollectableTotal.toFixed(18),
			};
		},
	);
}
