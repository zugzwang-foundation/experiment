import "server-only";

import { and, asc, eq, inArray, sql } from "drizzle-orm";

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
import { transition } from "@/server/markets/transitions";

import { assertStrictlyPositive, refundBasis } from "./basis";
import { ResolutionStateError } from "./errors";
import {
	type ResolutionEventMetadata,
	runResolutionTransaction,
} from "./transaction";

/**
 * W-3d — F-RESOLVE-3 void: the pre-resolution exit (`Open|Closed → Voided`,
 * R-9.3 — no `Resolving → Voided` edge). Refunds `f × stake` per bet (R-9.8
 * — sale proceeds STAND; a full-stake refund would over-refund sellers) and
 * records the residual cash as `poolUnwindAmount` on the terminal
 * `market.voided` events row (R-9.5/R-9.5e). The pool lock is LOAD-BEARING
 * on Open (§Wrapper b): the refunded-bet set is exactly the committed set
 * under the lock — no bet can commit unrefunded after void commits.
 */
export async function voidMarket(args: {
	marketId: string;
	reason: string;
	/** Minted at handler entry, closed over (retry-purity, ADR-0016 D1). */
	voidEventId: string;
	metadata: ResolutionEventMetadata;
}): Promise<{
	/** The `resolution_events` row id — NOT the caller-minted events id. */
	voidResolutionEventId: string;
	betsRefunded: number;
	poolUnwindAmount: string;
}> {
	// CF-6 belt (ENGINE.15 S4): admin-actor assert at entry — mirrors W-4.
	assertAdminActor(args.metadata);
	if (args.reason.trim() === "") {
		throw new Error("voidMarket: reason is mandatory (R-9.1)");
	}

	return runResolutionTransaction(
		{
			marketId: args.marketId,
			flow: "F-RESOLVE-3",
			expectedStatus: ["Open", "Closed"],
			lockPool: true,
			statementTimeoutMs: 5_000,
		},
		async ({ tx, market, pool }) => {
			if (pool === null) {
				throw new Error("voidMarket: pool lock missing (wrapper bug)");
			}

			// The §6.1 graph stays the single legality source (the wrapper gate
			// is the fence, the graph is the law).
			const edge = transition(market.status, "Voided");
			if (!edge.ok) {
				throw new ResolutionStateError({
					flow: "F-RESOLVE-3",
					expected: ["Open", "Closed"],
					observed: market.status,
				});
			}

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

			// Refund basis (R-9.8): per (user, held side) T_u distributed per-bet
			// by stake weights; sold-out sides refund 0 — sale proceeds stand.
			const refundByBet = refundBasis({
				bets: betRows,
				positions: positionRows,
			});

			const inserted = await tx
				.insert(resolutionEvents)
				.values({
					marketId: args.marketId,
					eventKind: "void",
					outcome: "VOID",
					correctsEventId: null,
					reason: args.reason,
				})
				.returning({ id: resolutionEvents.id });
			const voidRowId = inserted[0]?.id;
			if (voidRowId === undefined) {
				throw new Error("voidMarket: resolution_events INSERT returned no row");
			}

			// One void_refund payout row per bet (zero legs included), ordered
			// (user_id, bet id).
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
						resolutionEventId: voidRowId,
						payoutType: "void_refund" as const,
						amount: refundByBet.get(bet.id) ?? "0",
					})),
				);
			}

			// Ledger: per user ordered by user id, chained void_refund rows per
			// non-zero bet (betId = the bet; strictly positive — §Sign table).
			let totalRefunds = new CpmmDecimal(0);
			let betsRefunded = 0;
			const refundsByUser = new Map<
				string,
				{ betId: string; amount: string }[]
			>();
			for (const bet of orderedBets) {
				const amount = refundByBet.get(bet.id) ?? "0";
				totalRefunds = totalRefunds.plus(amount);
				if (new CpmmDecimal(amount).isZero()) continue;
				betsRefunded += 1;
				const rows = refundsByUser.get(bet.userId) ?? [];
				rows.push({ betId: bet.id, amount });
				refundsByUser.set(bet.userId, rows);
			}
			for (const [userId, rows] of refundsByUser) {
				let previousBalance = await readBalance(tx, userId);
				for (const row of rows) {
					assertStrictlyPositive(row.amount, "voidMarket void_refund");
					const appended = await appendLedgerRow(tx, {
						userId,
						amount: row.amount,
						entryType: "void_refund",
						betId: row.betId,
						previousBalance,
					});
					previousBalance = appended.balanceAfter;
				}
			}

			// Unwind: cash = Y + Σ(YES positions) — cross-asserted against
			// N + Σ(NO positions) EXACTLY (both equal seed + Σ stakes − Σ
			// proceeds, (♦); assumes the symmetric seed Y₀ = N₀ — an asymmetric
			// ENGINE.14 seed breaks this loudly, never silently).
			let yesHeld = new CpmmDecimal(0);
			let noHeld = new CpmmDecimal(0);
			for (const position of positionRows) {
				if (position.side === "YES") {
					yesHeld = yesHeld.plus(position.quantity);
				} else {
					noHeld = noHeld.plus(position.quantity);
				}
			}
			const cash = new CpmmDecimal(pool.yesReserves).plus(yesHeld);
			const crossCash = new CpmmDecimal(pool.noReserves).plus(noHeld);
			if (!cash.equals(crossCash)) {
				throw new Error(
					`voidMarket: cash cross-assert failed (economics bug): Y+H_yes=${cash.toFixed(18)} != N+H_no=${crossCash.toFixed(18)}`,
				);
			}
			const unwind = cash.minus(totalRefunds);
			if (unwind.lessThan(0)) {
				throw new Error(
					`voidMarket: negative unwind ${unwind.toFixed(18)} (economics bug)`,
				);
			}
			const poolUnwindAmount = unwind.toFixed(18);

			const updated = await tx
				.update(markets)
				.set({
					status: "Voided",
					resolutionOutcome: "VOID",
					resolvedAt: sql`now()`,
				})
				.where(
					and(
						eq(markets.id, args.marketId),
						inArray(markets.status, ["Open", "Closed"]),
					),
				)
				.returning({ id: markets.id });
			if (updated.length !== 1) {
				throw new Error(
					`voidMarket: status UPDATE matched ${updated.length} rows for ${args.marketId}`,
				);
			}

			await insertEvent(tx, {
				eventId: args.voidEventId,
				eventType: "market.voided",
				aggregateType: "market",
				aggregateId: args.marketId,
				payload: {
					marketId: args.marketId,
					voidReason: args.reason,
					poolUnwindAmount,
				},
				metadata: args.metadata,
			});

			return {
				voidResolutionEventId: voidRowId,
				betsRefunded,
				poolUnwindAmount,
			};
		},
	);
}
