import "server-only";

import { and, eq } from "drizzle-orm";
import { revalidateTag } from "next/cache";
import { v7 as uuidv7 } from "uuid";

import { markets, pools } from "@/db/schema";
import { assertAdminActor } from "@/server/admin/actor";
import { openingReserves } from "@/server/cpmm/calculate";
import { insertEvent } from "@/server/events/insert";

import { MarketDeadlineInPastError, MarketSeedInvalidError } from "./errors";
import {
	type LifecycleEventMetadata,
	runLifecycleTransaction,
} from "./transaction";
import { transition } from "./transitions";

/**
 * F-ADMIN-2 open validation. `tank` is a POSITIVE NUMERIC(38,18) decimal string
 * — ≤20 integer digits, ≤18 fractional digits, no sign, no exponent (the
 * `numericString` bounds, positive-only). Pure string math: no float, no parse.
 *
 * `openingPriceYes` is stricter: it must sit strictly INSIDE (0,1), so the
 * regex admits only a leading `0.` — which excludes 1 and everything above by
 * construction — and the all-zeros form is rejected on top of it. BOTH
 * endpoints are excluded because either produces a zero reserve, at which point
 * `requirePositive` inside `openingReserves` throws from within the W-4
 * transaction instead of at the boundary: an admin typo would arrive as a
 * rolled-back transaction and a 500 rather than a `seed_invalid`.
 */
const SEED_RE = /^\d{1,20}(?:\.\d{1,18})?$/;
const ZERO_SEED_RE = /^0+(?:\.0+)?$/;
const PRICE_RE = /^0\.\d{1,18}$/;
const ZERO_PRICE_RE = /^0\.0+$/;

/**
 * F-ADMIN-2 — the seeded `Draft → Open` commit (SPEC.1 §15 :869-875 +
 * cpmm.md §7.1 "asymmetric initialisation at a chosen price, exactly once,
 * with the excess discarded"). ONE W-4 locked transaction (`expectedStatus
 * ['Draft']`): lock markets → D-14.c expiry guard on the LOCKED row's
 * deadline → defensive pure-graph consult → INSERT the `pools` row with the
 * TWO DISTINCT reserves `openingReserves` computes (THE one production pools
 * INSERT) → UPDATE status 'Open' → emit `market.opened` carrying both
 * reserves, the price, the backing and both discards (R-14.1, ADR-0047 §B).
 * NO `dharma_ledger` row — R-2 stands; `pool_seed` stays dormant
 * (`POOL_DORMANT_TAGS` untouched). Tank magnitude is a service input;
 * `POOL_SEED_PER_MARKET_DEFAULT` is retired (ADR-0047 §Consequences).
 *
 * ⚠ THE RESERVES ARE ASYMMETRIC AND THE DIRECTION IS THE WHOLE POINT. A side's
 * price is proportional to the OPPOSITE reserve, so `openingPriceYes = 0.10`
 * over a tank of 100,000 writes yes = 90,000 and no = 10,000. The former
 * "symmetric by code shape — both columns bind the SAME string" property
 * (carry-forward 2) is GONE BY DESIGN; `max(y₀,n₀) − min(y₀,n₀)` shares are
 * discarded on the short side, 88.9% of the mint at a 10% open. The discards
 * ride the payload because they are the term that keeps the backing identity
 * closing for the rest of the market's life — `markets/backing.ts` reads them
 * back, and `void.ts` and `settle.ts` cannot balance their books without them.
 */
export async function openMarket(args: {
	marketId: string;
	/** p_yes at open, strictly inside (0,1). */
	openingPriceYes: string;
	/** T — the Đ committed to the pool. */
	tank: string;
	/** D-14.e: the clock is an argument — never read internally. */
	now: Date;
	metadata: LifecycleEventMetadata;
}): Promise<{
	marketId: string;
	poolId: string;
	status: "Open";
	yesReserves: string;
	noReserves: string;
	openingPriceYes: string;
	backingMinted: string;
	discardedYes: string;
	discardedNo: string;
	openedEventId: string;
}> {
	// Validation order per plan §Flows: actor → tank → price; D-14.c rides
	// the tx. Both amount guards run BEFORE `openingReserves`, so a malformed
	// input is a typed product error rather than a CpmmInputError escaping the
	// pure module.
	assertAdminActor(args.metadata);
	if (!SEED_RE.test(args.tank) || ZERO_SEED_RE.test(args.tank)) {
		throw new MarketSeedInvalidError(
			`invalid tank ${JSON.stringify(args.tank)} (positive NUMERIC(38,18) string required)`,
		);
	}
	if (
		!PRICE_RE.test(args.openingPriceYes) ||
		ZERO_PRICE_RE.test(args.openingPriceYes)
	) {
		throw new MarketSeedInvalidError(
			`invalid opening price ${JSON.stringify(args.openingPriceYes)} (NUMERIC(38,18) string strictly inside (0,1) required)`,
		);
	}
	const opening = openingReserves({
		openingPriceYes: args.openingPriceYes,
		tank: args.tank,
	});

	// Minted internally ONCE at entry (gate ruling), closed over (ADR-0016 D1).
	const openedEventId = uuidv7();

	const result = await runLifecycleTransaction(
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

			// THE one production pools INSERT. Two DISTINCT values now, computed
			// outside the transaction by the pure primitive (cpmm.md §7.1).
			const insertedPool = await tx
				.insert(pools)
				.values({
					marketId: args.marketId,
					yesReserves: opening.reserves.yes,
					noReserves: opening.reserves.no,
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
				payload: {
					marketId: args.marketId,
					yesReserves: opening.reserves.yes,
					noReserves: opening.reserves.no,
					openingPriceYes: args.openingPriceYes,
					backingMinted: opening.backingMinted,
					discardedYes: opening.discardedYes,
					discardedNo: opening.discardedNo,
				},
				metadata: args.metadata,
			});

			return {
				marketId: args.marketId,
				poolId,
				status: "Open" as const,
				yesReserves: opening.reserves.yes,
				noReserves: opening.reserves.no,
				openingPriceYes: args.openingPriceYes,
				backingMinted: opening.backingMinted,
				discardedYes: opening.discardedYes,
				discardedNo: opening.discardedNo,
				openedEventId,
			};
		},
	);

	// S-4 Phase C, post-commit (mirrors the `emitSignedInEvent` posture in
	// `src/server/auth/index.ts` — never inside the transaction, ADR-0014's
	// no-external-work-in-tx discipline; `revalidateTag` is in-process, not
	// HTTP, but the ordering still only makes sense after the state is real).
	// A newly-Open market changes the Discovery-eligible SET, not any one
	// market's content, so this busts the LISTING tag, not a `market:` one.
	//
	// Gate C CRITICAL fix — `{ expire: 0 }`, not `"max"` (non-evicting; see
	// close.ts's identical fix and act.ts's measured proof). `openMarket` is
	// `server-only`, not itself a Server Action — its only production caller
	// today (`seedPoolAction`) happens to be one, but the function doesn't
	// know that, and `updateTag` throws outside a Server Action. Matching
	// `closeMarket`'s form rather than relying on today's one caller.
	revalidateTag("discovery", { expire: 0 });

	return result;
}
