import { and, eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// AUDIT-FIX-B3 A9 (kickoff RED d) — `sell-replay-durable::no-double-proceeds`. The
// sell tx persists its idempotency key NOWHERE (it writes no bets row and mints a
// fresh sellEventId per request), so nothing durable dedupes a retry. The
// always-miss idempotency mock (Redis-lost) means the contract-mandated retry
// re-runs the WHOLE sell → DOUBLE proceeds today. The fix writes a `bet_receipts`
// row inside the sell W-1 callback; its unique key 23505s (rollback = no double
// proceeds) and the stored result answers the replay 200.
//
// Setup is a PARTIAL sell so the double actually executes today (a full sell would
// drain the position → the retry would 400 `position_not_held`, masking the bug).
//
// Load-bearing properties:
//   - place, then sell 5 of a large held position → 200 with proceeds P;
//   - sell the SAME key again → 200 with proceeds EXACTLY EQUAL to P (today: a
//     second, different proceeds at moved reserves — double-sell succeeds);
//   - exactly ONE sell-credit ledger row (`bet_stake` POSITIVE, bet_id NULL) and
//     ONE `bet.sold` event across both sells;
//   - pool reserves + held position are UNCHANGED by the replay.
//
// Invariant/contract: plan §3.6 row 11 (sell replay 23505 → cached original 200);
// I-IDEM-ONCE-001. INV-2 preserved (no phantom proceeds credit).
//
// RED posture: assertion-RED (double proceeds today) AND teardown-RED until 0022.
// Route-backed against local Postgres; sell SKIPS moderation. Decimal STRINGS.

const { mockGetSession } = vi.hoisted(() => ({ mockGetSession: vi.fn() }));

vi.mock("@sentry/nextjs", () => ({
	captureMessage: vi.fn(),
	addBreadcrumb: vi.fn(),
	captureException: vi.fn(),
}));
vi.mock("@/server/auth", () => ({
	auth: { api: { getSession: mockGetSession } },
}));
vi.mock("@/server/middleware/origin-allowlist", () => ({
	checkOrigin: () => true,
}));
vi.mock("@/server/middleware/rate-limit", () => ({
	checkRateLimit: vi.fn(async () => ({
		allowed: true,
		remaining: 99,
		reset: 0,
	})),
	ipIdentifier: (ip: string) => ip,
}));
vi.mock("@/server/idempotency/cache", () => ({
	computeBodyFingerprint: vi.fn(async () => "fp"),
	idempotencyLookupOrReserve: vi.fn(async () => ({
		kind: "miss",
		release: vi.fn(async () => {}),
	})),
}));
vi.mock("@/server/moderation/precommit", () => ({
	precommitModerate: vi.fn(async () => ({ outcome: "pass", categories: [] })),
}));

import { POST as placePOST } from "@/app/api/bets/place/route";
import { POST as sellPOST } from "@/app/api/bets/sell/route";
import {
	dharmaLedger,
	events,
	markets,
	pools,
	positions,
	users,
} from "@/db/schema";

import { testClient, testDb } from "../../db/_fixtures/db";
import { truncateTables } from "../../db/_fixtures/truncate";

const SEED_RESERVES = "100.000000000000000000";

function req(path: string, body: unknown, idempotencyKey: string) {
	return new Request(`https://prd.example.com${path}`, {
		method: "POST",
		headers: {
			"content-type": "application/json",
			origin: "https://prd.example.com",
			"Idempotency-Key": idempotencyKey,
			"x-forwarded-for": "203.0.113.33",
		},
		body: JSON.stringify(body),
	});
}

async function seedUser(emailTag: string, pseudonym: string): Promise<string> {
	const [user] = await testDb
		.insert(users)
		.values({
			name: "Sell Replay User",
			email: `${emailTag}@example.com`,
			pseudonym,
			tosAcceptedAt: new Date("2026-01-01T00:00:00Z"),
		})
		.returning({ id: users.id });
	return user?.id ?? "";
}

async function seedOpenMarketWithPool(slug: string): Promise<string> {
	const [market] = await testDb
		.insert(markets)
		.values({
			slug,
			title: "Sell Replay Market",
			status: "Open",
			resolutionDeadline: new Date("2027-01-01T00:00:00Z"),
		})
		.returning({ id: markets.id });
	const marketId = market?.id ?? "";
	await testDb.insert(pools).values({
		marketId,
		yesReserves: SEED_RESERVES,
		noReserves: SEED_RESERVES,
	});
	return marketId;
}

async function seedDharmaGrant(userId: string): Promise<void> {
	const { appendLedgerRow } = await import("@/server/dharma/persist");
	await testDb.transaction((tx) =>
		appendLedgerRow(tx, {
			userId,
			amount: "1000",
			entryType: "initial_grant",
		}),
	);
}

describe("AUDIT-FIX-B3 A9 — sell durable idempotency replay (no double proceeds)", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});
	afterEach(async () => {
		await truncateTables(testClient, [
			"events",
			"dharma_ledger",
			"bets",
			"comments",
			"positions",
			"pools",
			"markets",
			"users",
			"bet_receipts",
		]);
	});

	it("sell-replay-durable::retry-returns-original-proceeds-once", async () => {
		const userId = await seedUser("sell-replay", "sell-replay");
		const marketId = await seedOpenMarketWithPool("sell-replay-market");
		await seedDharmaGrant(userId);
		mockGetSession.mockResolvedValue({ user: { id: userId } });

		// Entry: buy a LARGE YES position (stake 50 → shares ≥ 50, since pEff ≤ 1)
		// so a partial sell of 5 leaves plenty for the today-double to execute.
		const entry = await placePOST(
			req(
				"/api/bets/place",
				{ marketId, side: "YES", stake: "50", body: "entry for sell replay" },
				"sell-replay-place",
			),
		);
		expect(entry.status).toBe(200);

		// First sell: partial 5. Read the proceeds the client is told.
		const firstSell = await sellPOST(
			req("/api/bets/sell", { marketId, shares: "5" }, "sell-replay-key"),
		);
		expect(firstSell.status).toBe(200);
		const firstSellBody = await firstSell.json();
		expect(firstSellBody.ok).toBe(true);
		const proceeds1: string = firstSellBody.data.dharmaReturned;

		// Snapshot committed state after the FIRST sell.
		const sellCredits = async () =>
			(
				await testDb
					.select({
						betId: dharmaLedger.betId,
						entryType: dharmaLedger.entryType,
					})
					.from(dharmaLedger)
					.where(eq(dharmaLedger.userId, userId))
			).filter((r) => r.entryType === "bet_stake" && r.betId === null);
		const soldEvents = async () =>
			await testDb
				.select({ eventId: events.eventId })
				.from(events)
				.where(eq(events.eventType, "bet.sold"));
		const readPosition = async () =>
			(
				await testDb
					.select({ quantity: positions.quantity })
					.from(positions)
					.where(
						and(eq(positions.userId, userId), eq(positions.marketId, marketId)),
					)
			)[0]?.quantity ?? null;
		const readPool = async () =>
			(
				await testDb
					.select({
						yesReserves: pools.yesReserves,
						noReserves: pools.noReserves,
					})
					.from(pools)
					.where(eq(pools.marketId, marketId))
			)[0];

		expect((await sellCredits()).length).toBe(1);
		expect((await soldEvents()).length).toBe(1);
		const positionAfterFirst = await readPosition();
		const poolAfterFirst = await readPool();

		// Second sell: SAME key + body. Today RED — a genuine miss re-runs the sell
		// → a SECOND proceeds credit (double proceeds) at moved reserves.
		const secondSell = await sellPOST(
			req("/api/bets/sell", { marketId, shares: "5" }, "sell-replay-key"),
		);
		expect(secondSell.status).toBe(200);
		const secondSellBody = await secondSell.json();
		const proceeds2: string = secondSellBody.data.dharmaReturned;

		// Equal proceeds — the replay returns the cached original, not a re-computed
		// value at the reserves the first sell moved.
		expect(proceeds2).toBe(proceeds1);

		// Single execution: exactly ONE sell-credit + ONE bet.sold across both sells.
		expect((await sellCredits()).length).toBe(1);
		expect((await soldEvents()).length).toBe(1);

		// The replay left the position + pool reserves UNTOUCHED.
		expect(await readPosition()).toBe(positionAfterFirst);
		const poolAfterReplay = await readPool();
		expect(poolAfterReplay?.yesReserves).toBe(poolAfterFirst?.yesReserves);
		expect(poolAfterReplay?.noReserves).toBe(poolAfterFirst?.noReserves);
	});
});
