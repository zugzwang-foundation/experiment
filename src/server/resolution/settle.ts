import "server-only";

import { and, asc, eq, sql } from "drizzle-orm";

import {
	bets,
	markets,
	payoutEvents,
	positions,
	resolutionEvents,
} from "@/db/schema";
import { assertAdminActor } from "@/server/admin/actor";
import { CpmmDecimal } from "@/server/cpmm/decimal";
import { appendLedgerRow, readBalance } from "@/server/dharma/persist";
import { insertEvent } from "@/server/events/insert";

import { applySideBasis, assertStrictlyPositive } from "./basis";
import {
	type ResolutionEventMetadata,
	runResolutionTransaction,
} from "./transaction";

/**
 * W-3b — F-RESOLVE-1 settle: `Resolving → Resolved`, gross winner payouts at
 * the R-9.8 pro-rata basis, losers' 0-amount settlement records (R-9.2), the
 * pool unwind recorded as the `poolUnwindAmount` payload field on the
 * terminal `market.resolved` events row (R-9.5/R-9.5e — no `pools` write, no
 * ledger row, no admin account; the untouched winning-side reserve IS the
 * audit source). Positions are NEVER touched (drift-D1 derived constraint);
 * comments are never touched (the lock is emergent).
 */
export async function settleMarket(args: {
	marketId: string;
	winningSide: "YES" | "NO";
	/** R-9.1: the mandatory, immutable criterion-met evidence note. */
	reason: string;
	/** Minted at handler entry, closed over (retry-purity, ADR-0016 D1). */
	settleEventId: string;
	metadata: ResolutionEventMetadata;
}): Promise<{
	resolutionEventId: string;
	winningSide: "YES" | "NO";
	totalPaidOut: string;
	poolUnwindAmount: string;
}> {
	// CF-6 belt (ENGINE.15 S4): admin-actor assert at entry — mirrors W-4.
	assertAdminActor(args.metadata);
	if (args.winningSide !== "YES" && args.winningSide !== "NO") {
		throw new Error(
			`settleMarket: winningSide must be YES or NO: ${String(args.winningSide)}`,
		);
	}
	if (args.reason.trim() === "") {
		throw new Error("settleMarket: reason is mandatory (R-9.1)");
	}

	return runResolutionTransaction(
		{
			marketId: args.marketId,
			flow: "F-RESOLVE-1",
			expectedStatus: ["Resolving"],
			lockPool: true,
			statementTimeoutMs: 5_000,
		},
		async ({ tx, pool }) => {
			if (pool === null) {
				throw new Error("settleMarket: pool lock missing (wrapper bug)");
			}

			// Read the full bet set + positions AFTER the locks (the fence).
			const betRows = await tx
				.select({
					id: bets.id,
					userId: bets.userId,
					side: bets.side,
					stake: bets.stake,
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

			// Pure basis (R-9.8): per-bet surviving payout; losers and f = 0 → 0.
			const amountByBet = applySideBasis({
				bets: betRows,
				positions: positionRows,
				payingSide: args.winningSide,
			});

			const inserted = await tx
				.insert(resolutionEvents)
				.values({
					marketId: args.marketId,
					eventKind: "resolve",
					outcome: args.winningSide,
					correctsEventId: null,
					reason: args.reason,
				})
				.returning({ id: resolutionEvents.id });
			const resolutionEventId = inserted[0]?.id;
			if (resolutionEventId === undefined) {
				throw new Error(
					"settleMarket: resolution_events INSERT returned no row",
				);
			}

			// One payout_events row per bet (R-9.2 + §3.6 uniformity), batched,
			// ordered (user_id, bet id). Zero legs are real settlement records.
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
					orderedBets.map((bet) => ({
						betId: bet.id,
						userId: bet.userId,
						marketId: args.marketId,
						resolutionEventId,
						payoutType: "bet_payout" as const,
						amount: amountByBet.get(bet.id) ?? "0",
					})),
				);
			}

			// Ledger (C-4): per user ordered by user id, one chained POSITIVE
			// bet_payout row per NON-ZERO bet — the persist.ts >1-row-per-user
			// chaining contract via `previousBalance` threading.
			let totalPaidOut = new CpmmDecimal(0);
			const winnersByUser = new Map<
				string,
				{ betId: string; amount: string }[]
			>();
			for (const bet of orderedBets) {
				const amount = amountByBet.get(bet.id) ?? "0";
				totalPaidOut = totalPaidOut.plus(amount);
				if (new CpmmDecimal(amount).isZero()) continue;
				const rows = winnersByUser.get(bet.userId) ?? [];
				rows.push({ betId: bet.id, amount });
				winnersByUser.set(bet.userId, rows);
			}
			for (const [userId, rows] of winnersByUser) {
				let previousBalance = await readBalance(tx, userId);
				for (const row of rows) {
					assertStrictlyPositive(row.amount, "settleMarket bet_payout");
					const appended = await appendLedgerRow(tx, {
						userId,
						amount: row.amount,
						entryType: "bet_payout",
						betId: row.betId,
						previousBalance,
					});
					previousBalance = appended.balanceAfter;
				}
			}

			const updated = await tx
				.update(markets)
				.set({
					status: "Resolved",
					resolvedAt: sql`now()`,
					resolutionOutcome: args.winningSide,
				})
				.where(
					and(eq(markets.id, args.marketId), eq(markets.status, "Resolving")),
				)
				.returning({ id: markets.id });
			if (updated.length !== 1) {
				throw new Error(
					`settleMarket: status UPDATE matched ${updated.length} rows for ${args.marketId}`,
				);
			}

			// Unwind (R-9.5/R-9.5e): the winning-side reserve of the LOCKED pool
			// row — by (♦) exactly the residual, with zero rounding gap.
			const poolUnwindAmount =
				args.winningSide === "YES" ? pool.yesReserves : pool.noReserves;
			if (new CpmmDecimal(poolUnwindAmount).lessThan(0)) {
				throw new Error(
					`settleMarket: negative unwind ${poolUnwindAmount} (economics bug)`,
				);
			}

			await insertEvent(tx, {
				eventId: args.settleEventId,
				eventType: "market.resolved",
				aggregateType: "market",
				aggregateId: args.marketId,
				payload: {
					marketId: args.marketId,
					winningSide: args.winningSide,
					resolutionNote: args.reason,
					poolUnwindAmount,
				},
				metadata: args.metadata,
			});

			return {
				resolutionEventId,
				winningSide: args.winningSide,
				totalPaidOut: totalPaidOut.toFixed(18),
				poolUnwindAmount,
			};
		},
	);
}
