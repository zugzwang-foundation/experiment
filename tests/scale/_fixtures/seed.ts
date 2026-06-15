// ENGINE.10 shared seed + driver helpers for the scale battery.
//
// Preconditions (markets Open, seeded pools, granted balances, suppressed daily
// credit) are established by DIRECT INSERT through `testDb` — seeding is never
// the subject of an assertion (plan §2). The writes UNDER TEST (every bet,
// sell, resolution in a storm) go through the REAL engine entry points
// (`runBetTransaction` → `place`/`sell`, `settleMarket`/`voidMarket`/
// `correctResolution`), which use the `@/db` singleton pool (max:10) — that is
// where the append-only triggers, the `CHECK (balance_after >= 0)`, the unique
// partial indexes, the SERIALIZABLE wrappers, and the FKs all fire.

import { v7 as uuidv7 } from "uuid";

import { markets, pools, users } from "@/db/schema";
import type { BetEventMetadata } from "@/server/bets/endpoint";

import { testDb } from "../../db/_fixtures/db";
import {
	SYNTHETIC_MARKETS,
	SYNTHETIC_RESOLUTION_DEADLINE,
	SYNTHETIC_SEED_RESERVES,
} from "./markets";

/** Admin-actor metadata (resolution flows: `assertAdminActor` requires this). */
export function adminMetadata(flowId: string): BetEventMetadata {
	return {
		request_id: `scale-${flowId}`,
		flow_id: flowId,
		user_id: null,
		actor_id: "admin-singleton",
		idempotency_key: null,
		ip: "test",
		user_agent: "vitest-scale",
	};
}

/** Participant-actor metadata (bet flows: actor_id = user_id). */
export function userMetadata(userId: string, flowId: string): BetEventMetadata {
	return {
		request_id: `scale-${flowId}`,
		flow_id: flowId,
		user_id: userId,
		actor_id: userId,
		idempotency_key: null,
		ip: "test",
		user_agent: "vitest-scale",
	};
}

/**
 * Seed a user with an `initial_grant` of `grant` Dharma. `lastAllowanceAccruedAt
 * = now()` SUPPRESSES the lazy Daily Credit (so a generic storm's balances are
 * the grant alone — the daily-credit axis arms its own user with a NULL cursor).
 */
export async function seedUser(tag: string, grant: string): Promise<string> {
	const [user] = await testDb
		.insert(users)
		.values({
			name: "Scale User",
			email: `${tag}-${uuidv7()}@example.com`,
			pseudonym: `${tag}-${uuidv7()}`,
			tosAcceptedAt: new Date("2026-01-01T00:00:00Z"),
			lastAllowanceAccruedAt: new Date(),
		})
		.returning({ id: users.id });
	const userId = user?.id ?? "";
	const { appendLedgerRow } = await import("@/server/dharma/persist");
	await testDb.transaction((tx) =>
		appendLedgerRow(tx, { userId, amount: grant, entryType: "initial_grant" }),
	);
	return userId;
}

/**
 * Seed a user whose Daily-Credit cursor is NULL (unpaid) — the first commented
 * bet of the storm will accrue exactly one `daily_allowance` (the daily-credit
 * race vehicle).
 */
export async function seedUserUnpaidCursor(
	tag: string,
	grant: string,
): Promise<string> {
	const [user] = await testDb
		.insert(users)
		.values({
			name: "Scale User",
			email: `${tag}-${uuidv7()}@example.com`,
			pseudonym: `${tag}-${uuidv7()}`,
			tosAcceptedAt: new Date("2026-01-01T00:00:00Z"),
			lastAllowanceAccruedAt: null,
		})
		.returning({ id: users.id });
	const userId = user?.id ?? "";
	const { appendLedgerRow } = await import("@/server/dharma/persist");
	await testDb.transaction((tx) =>
		appendLedgerRow(tx, { userId, amount: grant, entryType: "initial_grant" }),
	);
	return userId;
}

/** Seed one Open market + its seeded (symmetric) pool. Returns the market id. */
export async function seedOpenMarketWithPool(slug: string): Promise<string> {
	const [market] = await testDb
		.insert(markets)
		.values({
			slug,
			title: "Synthetic Market",
			status: "Open",
			resolutionDeadline: SYNTHETIC_RESOLUTION_DEADLINE,
		})
		.returning({ id: markets.id });
	const marketId = market?.id ?? "";
	await testDb.insert(pools).values({
		marketId,
		yesReserves: SYNTHETIC_SEED_RESERVES,
		noReserves: SYNTHETIC_SEED_RESERVES,
	});
	return marketId;
}

/** Seed all 8 synthetic Open markets + pools. Returns the market ids in order. */
export async function seedAllSyntheticMarkets(): Promise<string[]> {
	const ids: string[] = [];
	for (const spec of SYNTHETIC_MARKETS) {
		ids.push(await seedOpenMarketWithPool(spec.slug));
	}
	return ids;
}
