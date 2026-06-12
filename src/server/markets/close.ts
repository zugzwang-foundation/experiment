import "server-only";

import { and, asc, eq, lte } from "drizzle-orm";
import { v7 as uuidv7 } from "uuid";

import { db } from "@/db";
import { markets } from "@/db/schema";
import { assertAdminActor } from "@/server/admin/actor";
import { insertEvent } from "@/server/events/insert";

import {
	MarketDeadlineNotReachedError,
	MarketLifecycleStateError,
} from "./errors";
import {
	type LifecycleEventMetadata,
	runLifecycleTransaction,
} from "./transaction";
import { closeOnDeadline } from "./transitions";

/**
 * The clock-driven `Open → Closed` cutoff (R-14.3; SPEC.1 §6.1 — the server
 * clock crossing `resolution_deadline`, not an admin action). ONE W-4
 * locked transaction (`expectedStatus ['Open']`), gated through the pure
 * `closeOnDeadline` with the caller-supplied `now` (D-14.e) evaluated
 * against the LOCKED row's deadline. `now == deadline` closes; earlier is
 * the typed `MarketDeadlineNotReachedError` (zero writes). Emits ONE
 * `market.closed` row, payload `{ marketId }`. The HTTP/cron invocation is
 * ENGINE.10's; the deadline-to-sweep-tick stale-`Open` window is the
 * founder-accepted carry-forward 1 (W-1 untouched — no bet-path deadline
 * check this stratum).
 */
export async function closeMarket(args: {
	marketId: string;
	now: Date;
	metadata: LifecycleEventMetadata;
}): Promise<{ marketId: string; status: "Closed"; closedEventId: string }> {
	assertAdminActor(args.metadata);

	// Minted internally ONCE at entry (gate ruling), closed over (ADR-0016 D1).
	const closedEventId = uuidv7();

	return runLifecycleTransaction(
		{ marketId: args.marketId, flow: "W-4-CLOSE", expectedStatus: ["Open"] },
		async ({ tx, market }) => {
			if (market === null) {
				throw new Error("closeMarket: market lock missing (wrapper bug)");
			}

			const edge = closeOnDeadline({
				status: market.status,
				now: args.now,
				resolutionDeadline: market.resolutionDeadline,
			});
			if (!edge.ok) {
				if (edge.reason === "deadline_not_reached") {
					throw new MarketDeadlineNotReachedError(
						`market deadline ${market.resolutionDeadline.toISOString()} not reached at ${args.now.toISOString()}`,
					);
				}
				// illegal_edge: pre-gated by expectedStatus ['Open'] — defensive.
				throw new Error(
					`closeMarket: unreachable illegal edge from ${market.status}`,
				);
			}

			const updated = await tx
				.update(markets)
				.set({ status: "Closed" })
				.where(and(eq(markets.id, args.marketId), eq(markets.status, "Open")))
				.returning({ id: markets.id });
			if (updated.length !== 1) {
				throw new Error(
					`closeMarket: status UPDATE matched ${updated.length} rows for ${args.marketId}`,
				);
			}

			await insertEvent(tx, {
				eventId: closedEventId,
				eventType: "market.closed",
				aggregateType: "market",
				aggregateId: args.marketId,
				payload: { marketId: args.marketId },
				metadata: args.metadata,
			});

			return {
				marketId: args.marketId,
				status: "Closed" as const,
				closedEventId,
			};
		},
	);
}

/**
 * The sweep iterator (R-14.3): one UNLOCKED candidate SELECT
 * (`markets_status_idx` + `markets_resolution_deadline_idx`, ORDER BY id
 * ascending), then ONE W-4 transaction per market via `closeMarket` — a
 * single failure never poisons the batch. A candidate raced into another
 * state between SELECT and lock surfaces as `MarketLifecycleStateError`,
 * is counted in `skipped`, and the sweep continues; any other error is a
 * real fault and propagates loud. Re-running is idempotent
 * (`{ closed: 0, … }`). Each close mints its OWN event id (gate ruling).
 * Emits as `admin-singleton` per D-14.d — the clock executes the admin's
 * standing instruction (no `'system'` actor — carry-forward 5).
 */
export async function closeDueMarkets(args: {
	now: Date;
	metadata: LifecycleEventMetadata;
}): Promise<{ closed: number; skipped: number; closedMarketIds: string[] }> {
	assertAdminActor(args.metadata);

	const candidates = await db
		.select({ id: markets.id })
		.from(markets)
		.where(
			and(
				eq(markets.status, "Open"),
				lte(markets.resolutionDeadline, args.now),
			),
		)
		.orderBy(asc(markets.id));

	let closed = 0;
	let skipped = 0;
	const closedMarketIds: string[] = [];
	for (const candidate of candidates) {
		try {
			const result = await closeMarket({
				marketId: candidate.id,
				now: args.now,
				metadata: args.metadata,
			});
			closed += 1;
			closedMarketIds.push(result.marketId);
		} catch (err) {
			if (err instanceof MarketLifecycleStateError) {
				skipped += 1;
				continue;
			}
			throw err;
		}
	}

	return { closed, skipped, closedMarketIds };
}
