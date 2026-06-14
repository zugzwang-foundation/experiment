import { eq } from "drizzle-orm";
import { v7 as uuidv7 } from "uuid";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@sentry/nextjs", () => ({
	captureMessage: vi.fn(),
	addBreadcrumb: vi.fn(),
	captureException: vi.fn(),
}));

import { markets, pools, users } from "@/db/schema";
import { place } from "@/server/bets/place";
import { runBetTransaction } from "@/server/bets/transaction";
import { correctResolution } from "@/server/resolution/correct";
import { settleMarket } from "@/server/resolution/settle";
import { voidMarket } from "@/server/resolution/void";

import { testClient, testDb } from "../../db/_fixtures/db";

// ENGINE.16 §5.6 tests-first (charter row (d)) — the §20.3 admin-exemption
// regression guard. SPEC.2 §20.3 deliberately leaves admin paths UNGATED ("admin
// Server Actions do NOT call isFrozen()"): the conclusion-event work — finalizing
// resolutions, last-mile moderation — MUST run post-freeze. The ENGINE.15 auditor
// finding that named the W-3/W-4 admin paths as a freeze gap was OVER-BROAD; this
// test encodes the exemption with TEETH.
//
// DB-BACKED (local Postgres :54322). With `frozen_at` COMMITTED on the 'system'
// row, the production resolve / correct / void paths MUST still succeed. This is
// GREEN at S1 (those paths never read `isFrozen`) and must STAY GREEN — it fails
// ONLY if a future change wrongly gates the admin path on freeze.
//
// FIX-1 reset: the §6.3 once-only trigger rejects `frozen_at timestamp→NULL` and
// `timestamp→timestamp`, so the per-test reset of system_state is TRUNCATE +
// reseed (BEFORE TRUNCATE has no trigger). The other tables reset via the
// resolution-convention TRUNCATE … CASCADE.

const SEED = "100.000000000000000000";
const REASON = "Admin conclusion-event finalization (post-freeze, §20.3).";

function adminMetadata(flowId: string) {
	return {
		request_id: "test-freeze-exemption",
		flow_id: flowId,
		user_id: null,
		actor_id: "admin-singleton",
		idempotency_key: null,
		ip: "test",
		user_agent: "vitest",
	};
}

function userMetadata(userId: string) {
	return {
		request_id: "test-freeze-exemption-fixture",
		flow_id: "F-BET-1",
		user_id: userId,
		actor_id: userId,
		idempotency_key: null,
		ip: "test",
		user_agent: "vitest",
	};
}

async function seedUser(emailTag: string, grant: string): Promise<string> {
	const [user] = await testDb
		.insert(users)
		.values({
			name: "Freeze Exemption User",
			email: `${emailTag}@example.com`,
			pseudonym: emailTag,
			tosAcceptedAt: new Date("2026-01-01T00:00:00Z"),
			lastAllowanceAccruedAt: new Date(), // suppress the Daily Credit
		})
		.returning({ id: users.id });
	const userId = user?.id ?? "";
	const { appendLedgerRow } = await import("@/server/dharma/persist");
	await testDb.transaction((tx) =>
		appendLedgerRow(tx, { userId, amount: grant, entryType: "initial_grant" }),
	);
	return userId;
}

async function seedOpenMarketWithPool(slug: string): Promise<string> {
	const [market] = await testDb
		.insert(markets)
		.values({
			slug,
			title: "Freeze Exemption Market",
			status: "Open",
			resolutionDeadline: new Date("2026-11-01T00:00:00Z"),
		})
		.returning({ id: markets.id });
	const marketId = market?.id ?? "";
	await testDb.insert(pools).values({
		marketId,
		yesReserves: SEED,
		noReserves: SEED,
	});
	return marketId;
}

async function placeBet(args: {
	userId: string;
	marketId: string;
	side: "YES" | "NO";
	stake: string;
}): Promise<string> {
	const result = await runBetTransaction(
		{ marketId: args.marketId, flow: "F-BET-1" },
		(ctx) =>
			place(ctx, {
				userId: args.userId,
				marketId: args.marketId,
				side: args.side,
				stake: args.stake,
				body: `fixture argument ${uuidv7()}`,
				parentCommentId: null,
				idempotencyKey: uuidv7(),
				betEventId: uuidv7(),
				commentEventId: uuidv7(),
				creditEventId: uuidv7(),
				metadata: userMetadata(args.userId),
			}),
	);
	return result.betId;
}

async function setStatus(marketId: string, status: string): Promise<void> {
	await testClient.unsafe(`UPDATE markets SET status = $1 WHERE id = $2`, [
		status,
		marketId,
	]);
}

/** Commit the conclusion freeze: a single NULL→timestamp on the 'system' row. */
async function freezeSystem(): Promise<void> {
	await testClient.unsafe(
		`UPDATE system_state SET frozen_at = '2026-11-05T23:59:00Z' WHERE id = 'system'`,
	);
}

describe("ENGINE.16 (d) — admin resolution paths stay LIVE post-freeze (§20.3)", () => {
	afterEach(async () => {
		await testClient.unsafe(
			`TRUNCATE events, payout_events, resolution_events, dharma_ledger, bets, comments, positions, pools, markets, users CASCADE`,
		);
		// FIX-1: system_state cannot reset via UPDATE (once-only trigger) — TRUNCATE
		// bypasses it, then reseed the pre-freeze singleton.
		await testClient.unsafe(`TRUNCATE system_state`);
		await testClient.unsafe(
			`INSERT INTO system_state (id, frozen_at) VALUES ('system', NULL)`,
		);
		vi.clearAllMocks();
	});

	it("freeze-exemption::settle-succeeds-with-frozen-system", async () => {
		const userA = await seedUser("exempt-settle-a", "1000");
		const userB = await seedUser("exempt-settle-b", "1000");
		const marketId = await seedOpenMarketWithPool("exempt-settle");
		await placeBet({ userId: userA, marketId, side: "YES", stake: "100" });
		await placeBet({ userId: userB, marketId, side: "NO", stake: "50" });
		await setStatus(marketId, "Resolving");

		// The freeze is COMMITTED before the admin acts — §20.3 keeps admin live.
		await freezeSystem();

		const result = await settleMarket({
			marketId,
			winningSide: "YES",
			reason: REASON,
			settleEventId: uuidv7(),
			metadata: adminMetadata("F-RESOLVE-1"),
		});
		expect(result.winningSide).toBe("YES");
		expect(result.resolutionEventId).toBeDefined();

		const [marketRow] = await testDb
			.select({ status: markets.status })
			.from(markets)
			.where(eq(markets.id, marketId));
		expect(marketRow?.status).toBe("Resolved");
	});

	it("freeze-exemption::correct-succeeds-with-frozen-system", async () => {
		const userA = await seedUser("exempt-correct-a", "1000");
		const userB = await seedUser("exempt-correct-b", "1000");
		const marketId = await seedOpenMarketWithPool("exempt-correct");
		await placeBet({ userId: userA, marketId, side: "YES", stake: "100" });
		await placeBet({ userId: userB, marketId, side: "NO", stake: "50" });
		await setStatus(marketId, "Resolving");

		// Resolve first (pre-freeze admin action), then freeze, then correct.
		await settleMarket({
			marketId,
			winningSide: "YES",
			reason: REASON,
			settleEventId: uuidv7(),
			metadata: adminMetadata("F-RESOLVE-1"),
		});

		await freezeSystem();

		const result = await correctResolution({
			marketId,
			correctedSide: "NO",
			reason: REASON,
			correctEventId: uuidv7(),
			metadata: adminMetadata("F-RESOLVE-2"),
		});
		expect(result.correctionEventId).toBeDefined();

		const [marketRow] = await testDb
			.select({ resolutionOutcome: markets.resolutionOutcome })
			.from(markets)
			.where(eq(markets.id, marketId));
		expect(marketRow?.resolutionOutcome).toBe("NO");
	});

	it("freeze-exemption::void-succeeds-with-frozen-system", async () => {
		const userA = await seedUser("exempt-void-a", "1000");
		const marketId = await seedOpenMarketWithPool("exempt-void");
		await placeBet({ userId: userA, marketId, side: "YES", stake: "100" });

		// Void is a PRE-resolution exit (Open|Closed → Voided); freeze first.
		await freezeSystem();

		const result = await voidMarket({
			marketId,
			reason: REASON,
			voidEventId: uuidv7(),
			metadata: adminMetadata("F-RESOLVE-3"),
		});
		expect(result.voidResolutionEventId).toBeDefined();

		const [marketRow] = await testDb
			.select({ status: markets.status })
			.from(markets)
			.where(eq(markets.id, marketId));
		expect(marketRow?.status).toBe("Voided");
	});
});
