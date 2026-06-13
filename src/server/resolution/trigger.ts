import "server-only";

import { and, eq } from "drizzle-orm";

import { markets } from "@/db/schema";
import { assertAdminActor } from "@/server/admin/actor";
import { insertEvent } from "@/server/events/insert";
import { transition } from "@/server/markets/transitions";

import { ResolutionStateError } from "./errors";
import {
	type ResolutionEventMetadata,
	runResolutionTransaction,
} from "./transaction";

/**
 * W-3a — the F-ADMIN-3 trigger: `Closed → Resolving` + the `market.resolving`
 * mint (C-1: payload is marketId ONLY — outcome/evidence live on
 * `resolution_events` per R-9.1, never duplicated). One tx, no pool lock (the
 * trigger writes nothing the fence protects, and the `Closed` precondition
 * means no W-1 traffic gates open).
 *
 * The trigger is irreversible (no `Resolving → Voided` edge — R-9.3);
 * stranded-`Resolving` recovery = invoke `settleMarket` (a double-trigger
 * fails the gate). F-ADMIN-3's "Response: Resolution event ID" is produced by
 * the COMPOSED admin endpoint (trigger → settle, two txs back-to-back —
 * ENGINE.10); the winning side + evidence pass through to `settleMarket`,
 * not to this tx.
 */
export async function triggerResolution(args: {
	marketId: string;
	/** Minted at handler entry, closed over (retry-purity, ADR-0016 D1). */
	triggerEventId: string;
	metadata: ResolutionEventMetadata;
}): Promise<{ marketId: string; status: "Resolving" }> {
	// CF-6 belt (ENGINE.15 S4): admin-actor assert at entry — mirrors W-4.
	assertAdminActor(args.metadata);
	return runResolutionTransaction(
		{
			marketId: args.marketId,
			flow: "F-ADMIN-3",
			expectedStatus: ["Closed"],
			lockPool: false,
		},
		async ({ tx, market }) => {
			// The §6.1 graph stays the single legality source — the wrapper gate
			// is the fence, the graph is the law.
			const edge = transition(market.status, "Resolving");
			if (!edge.ok) {
				throw new ResolutionStateError({
					flow: "F-ADMIN-3",
					expected: ["Closed"],
					observed: market.status,
				});
			}

			const updated = await tx
				.update(markets)
				.set({ status: "Resolving" })
				.where(and(eq(markets.id, args.marketId), eq(markets.status, "Closed")))
				.returning({ id: markets.id });
			if (updated.length !== 1) {
				// Impossible under the markets lock — the belt stays loud.
				throw new Error(
					`triggerResolution: status UPDATE matched ${updated.length} rows for ${args.marketId}`,
				);
			}

			await insertEvent(tx, {
				eventId: args.triggerEventId,
				eventType: "market.resolving",
				aggregateType: "market",
				aggregateId: args.marketId,
				payload: { marketId: args.marketId },
				metadata: args.metadata,
			});

			return { marketId: args.marketId, status: "Resolving" as const };
		},
	);
}
