import { and, eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// AUDIT-FIX-B3 A4+A9 (kickoff RED e, E2E) — `double-sell-chain::single-execution`.
// The full interlock the three findings compose into: a sell commits, the
// completion-write (release) throws (A4), and — because the sell persists its key
// nowhere (A9) — the client's contract-mandated retry re-runs the whole sell →
// DOUBLE proceeds. The fix closes the chain end-to-end: the guarded release lets
// the first 200 through and alarms; the durable `bet_receipts` row answers the
// retry with the ORIGINAL 200 instead of re-executing.
//
// The always-miss idempotency mock (release THROWS) simulates BOTH the completion-
// write failure AND the expired/lost sentinel on the retry (a fresh miss each time)
// — so ONLY the durable backstop can dedupe the second request.
//
// Load-bearing properties:
//   - first sell → 200 despite the release throw (today: the throw escapes / 500);
//   - second sell (same key, fresh miss) → 200 answered by the durable backstop,
//     the sell NEVER re-executes (today: double-sell succeeds → double proceeds);
//   - single execution: exactly ONE sell-credit + ONE `bet.sold`; the position
//     dropped by exactly 5 (10 → 5), pool moved once;
//   - the completion-write alarm fired.
//
// Invariant/contract: plan §3.6 rows 11 + 12 (durable sell replay + release-failure
// survival). INV-2 preserved (no phantom proceeds).
//
// RED posture: assertion-RED (release throw escapes + double execution today) AND
// teardown-RED until 0022. Route-backed against local Postgres. Decimal STRINGS.

const { mockGetSession, mockCaptureException } = vi.hoisted(() => ({
	mockGetSession: vi.fn(),
	mockCaptureException: vi.fn(),
}));

vi.mock("@sentry/nextjs", () => ({
	captureMessage: vi.fn(),
	addBreadcrumb: vi.fn(),
	captureException: mockCaptureException,
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
// Every request is a fresh miss (sentinel lost), and every completion-write throws.
vi.mock("@/server/idempotency/cache", () => ({
	computeBodyFingerprint: vi.fn(async () => "fp"),
	idempotencyLookupOrReserve: vi.fn(async () => ({
		kind: "miss",
		release: vi.fn(async () => {
			throw new Error("upstash unavailable at completion-write");
		}),
	})),
}));
vi.mock("@/server/moderation/precommit", () => ({
	precommitModerate: vi.fn(async () => ({ outcome: "pass", categories: [] })),
}));

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

function req(body: unknown, idempotencyKey: string) {
	return new Request("https://prd.example.com/api/bets/sell", {
		method: "POST",
		headers: {
			"content-type": "application/json",
			origin: "https://prd.example.com",
			"Idempotency-Key": idempotencyKey,
			"x-forwarded-for": "203.0.113.35",
		},
		body: JSON.stringify(body),
	});
}

async function seedUser(emailTag: string, pseudonym: string): Promise<string> {
	const [user] = await testDb
		.insert(users)
		.values({
			name: "Double Sell User",
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
			title: "Double Sell Market",
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

describe("AUDIT-FIX-B3 A4+A9 — double-sell chain closed end-to-end", () => {
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

	it("double-sell-chain::retry-after-release-throw-executes-once", async () => {
		const userId = await seedUser("double-sell", "double-sell");
		const marketId = await seedOpenMarketWithPool("double-sell-market");
		// Direct held position (Bucket C) — a comment-free sell needs no grant.
		await testDb.insert(positions).values({
			userId,
			marketId,
			side: "YES",
			quantity: "10.000000000000000000",
		});
		mockGetSession.mockResolvedValue({ user: { id: userId } });

		// First sell 5: commits, then the completion-write throws. The guarded
		// finally must still return the committed 200 (today: the throw escapes).
		const first = await sellPOST(req({ marketId, shares: "5" }, "double-key"));
		expect(first.status).toBe(200);

		// Retry with the SAME key (a fresh miss — the sentinel is gone). ONLY the
		// durable backstop can dedupe it → 200 replay, no re-execution.
		const second = await sellPOST(req({ marketId, shares: "5" }, "double-key"));
		expect(second.status).toBe(200);

		// ── Single execution across the whole chain ────────────────────────────
		// Exactly ONE sell-credit ledger row (bet_stake POSITIVE, bet_id NULL).
		const sellCredits = (
			await testDb
				.select({
					entryType: dharmaLedger.entryType,
					betId: dharmaLedger.betId,
				})
				.from(dharmaLedger)
				.where(eq(dharmaLedger.userId, userId))
		).filter((r) => r.entryType === "bet_stake" && r.betId === null);
		expect(sellCredits.length).toBe(1);

		// Exactly ONE bet.sold event.
		const soldEvents = await testDb
			.select({ eventId: events.eventId })
			.from(events)
			.where(eq(events.eventType, "bet.sold"));
		expect(soldEvents.length).toBe(1);

		// The position dropped by EXACTLY 5 (10 → 5) — a single sell, not two.
		const positionRows = await testDb
			.select({ quantity: positions.quantity })
			.from(positions)
			.where(
				and(eq(positions.userId, userId), eq(positions.marketId, marketId)),
			);
		expect(positionRows.length).toBe(1);
		expect(positionRows[0]?.quantity).toBe("5.000000000000000000");

		// The pool moved off the seed (one sell happened) — but only once, which
		// the ledger/event/position counts above pin.
		const [poolRow] = await testDb
			.select({ yesReserves: pools.yesReserves })
			.from(pools)
			.where(eq(pools.marketId, marketId));
		expect(poolRow?.yesReserves).not.toBe(SEED_RESERVES);

		// The completion-write alarm fired (kind upstash_unavailable_idempotency).
		expect(mockCaptureException).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({
				tags: expect.objectContaining({
					kind: "upstash_unavailable_idempotency",
				}),
			}),
		);
	});
});
