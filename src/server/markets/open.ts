import "server-only";

import { and, eq } from "drizzle-orm";
import { v7 as uuidv7 } from "uuid";

import { markets, pools } from "@/db/schema";
import { assertAdminActor } from "@/server/admin/actor";
import { insertEvent } from "@/server/events/insert";

import { MarketDeadlineInPastError, MarketSeedInvalidError } from "./errors";
import {
	type LifecycleEventMetadata,
	runLifecycleTransaction,
} from "./transaction";
import { transition } from "./transitions";

/**
 * F-ADMIN-2 seed validation: a POSITIVE NUMERIC(38,18) decimal string —
 * ≤20 integer digits, ≤18 fractional digits, no sign, no exponent (the
 * `numericString` bounds, positive-only). Pure string math: no float, no
 * parse — the value flows to both reserve columns verbatim.
 */
const SEED_RE = /^\d{1,20}(?:\.\d{1,18})?$/;
const ZERO_SEED_RE = /^0+(?:\.0+)?$/;

/**
 * F-ADMIN-2 — the seeded `Draft → Open` commit (SPEC.1 §15 :869-875 +
 * cpmm.md §7.1 "symmetric initialisation, exactly once"). ONE W-4 locked
 * transaction (`expectedStatus ['Draft']`): lock markets → D-14.c expiry
 * guard on the LOCKED row's deadline → defensive pure-graph consult →
 * INSERT the `pools` row with y₀ = n₀ = seedAmount (THE one production
 * pools INSERT — both columns from the SAME string binding, carry-forward 2
 * preserved by construction) → UPDATE status 'Open' → emit `market.opened`
 * carrying `seedAmount` (R-14.1). NO `dharma_ledger` row — R-2 stands;
 * `pool_seed` stays dormant (`POOL_DORMANT_TAGS` untouched). Seed magnitude
 * is a service input; `POOL_SEED_PER_MARKET_DEFAULT` stays TBD (R-14.1).
 */
export async function openMarket(args: {
	marketId: string;
	seedAmount: string;
	/** D-14.e: the clock is an argument — never read internally. */
	now: Date;
	metadata: LifecycleEventMetadata;
}): Promise<{
	marketId: string;
	poolId: string;
	status: "Open";
	seedAmount: string;
	openedEventId: string;
}> {
	// Validation order per plan §Flows: actor → seed; D-14.c rides the tx.
	assertAdminActor(args.metadata);
	if (!SEED_RE.test(args.seedAmount) || ZERO_SEED_RE.test(args.seedAmount)) {
		throw new MarketSeedInvalidError(
			`invalid seed amount ${JSON.stringify(args.seedAmount)} (positive NUMERIC(38,18) string required)`,
		);
	}

	// Minted internally ONCE at entry (gate ruling), closed over (ADR-0016 D1).
	const openedEventId = uuidv7();

	return runLifecycleTransaction(
		{ marketId: args.marketId, flow: "F-ADMIN-2", expectedStatus: ["Draft"] },
		async ({ tx, market }) => {
			if (market === null) {
				throw new Error("openMarket: market lock missing (wrapper bug)");
			}

			// D-14.c on the LOCKED row — not a separate pre-read: opening a
			// market the sweep would close on its next tick is surfaced.
			if (args.now.getTime() >= market.resolutionDeadline.getTime()) {
				throw new MarketDeadlineInPastError(
					`market deadline ${market.resolutionDeadline.toISOString()} is not after now ${args.now.toISOString()} (D-14.c)`,
				);
			}

			// Defensive consult of the pure §6.1 graph — illegal_edge is
			// unreachable here (expectedStatus ['Draft'] already gated).
			const edge = transition(market.status, "Open");
			if (!edge.ok) {
				throw new Error(
					`openMarket: unreachable illegal edge ${market.status} → Open (${edge.reason})`,
				);
			}

			// THE one production pools INSERT: symmetric by code shape — both
			// columns bind the SAME string (cpmm.md §7.1; carry-forward 2).
			const insertedPool = await tx
				.insert(pools)
				.values({
					marketId: args.marketId,
					yesReserves: args.seedAmount,
					noReserves: args.seedAmount,
				})
				.returning({ id: pools.id });
			const poolId = insertedPool[0]?.id;
			if (poolId === undefined) {
				throw new Error("openMarket: pools INSERT returned no row");
			}

			const updated = await tx
				.update(markets)
				.set({ status: "Open" })
				.where(and(eq(markets.id, args.marketId), eq(markets.status, "Draft")))
				.returning({ id: markets.id });
			if (updated.length !== 1) {
				throw new Error(
					`openMarket: status UPDATE matched ${updated.length} rows for ${args.marketId}`,
				);
			}

			await insertEvent(tx, {
				eventId: openedEventId,
				eventType: "market.opened",
				aggregateType: "market",
				aggregateId: args.marketId,
				payload: { marketId: args.marketId, seedAmount: args.seedAmount },
				metadata: args.metadata,
			});

			return {
				marketId: args.marketId,
				poolId,
				status: "Open" as const,
				seedAmount: args.seedAmount,
				openedEventId,
			};
		},
	);
}
