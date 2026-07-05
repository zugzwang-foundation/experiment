import { and, eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// AUDIT-FIX-B3 A3 (kickoff RED a) — `sell-oversell::rejects-oversell-400`. The
// sell path never checks `shares ≤ held.quantity`; the ceiling falls to
// `applyPositionDelta`'s `PositionOversellError` (`extends Error`, NOT
// `BetProductError`) → `toWireError` fall-through → an UNCACHED 500
// `error_internal` for ordinary user input (the finding). The fix adds a product
// pre-check in sell() throwing `InsufficientSharesError` → 400 `insufficient_shares`.
//
// Load-bearing properties:
//   - oversell (hold 5, sell 10) → 400 `insufficient_shares` (today: 500);
//   - the release mock receives a `completed` with status 400 (a `<500` terminal
//     error IS cached → retry-safe / deterministic re-check);
//   - ZERO deltas: no new ledger row, no `bet.sold` event, pool reserves untouched
//     (the tx rolls back — no partial state leak);
//   - the boundary `shares == held` (5) → 200 (sell-to-zero is legal; the
//     pre-check is `>`, not `>=`).
//
// Invariant/contract: plan §3.6 row 7 (oversell product pre-check → cached 400);
// I-NO-OVERSELL-001 (position quantity never negative — the storage backstop the
// pre-check front-runs).
//
// RED posture: assertion-RED (today the oversell yields 500, and the release mock
// is handed `null` not a 400). Route-backed against local Postgres; externals
// mocked (sell SKIPS moderation). Money/share values are decimal STRINGS.

const { mockGetSession, mockRelease } = vi.hoisted(() => ({
	mockGetSession: vi.fn(),
	// Hoisted so the test can inspect the completed response the endpoint's
	// finally hands to release (proves the 400 is cached, not dropped as a crash).
	mockRelease: vi.fn(async (_response: unknown) => {}),
}));

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
		release: mockRelease,
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
			"x-forwarded-for": "203.0.113.31",
		},
		body: JSON.stringify(body),
	});
}

async function seedUser(emailTag: string, pseudonym: string): Promise<string> {
	const [user] = await testDb
		.insert(users)
		.values({
			name: "Oversell User",
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
			title: "Oversell Market",
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

/** Seed a HELD position directly (Bucket C, fixture bypass) — no entry bet. */
async function seedHeldPosition(
	userId: string,
	marketId: string,
	quantity: string,
): Promise<void> {
	await testDb.insert(positions).values({
		userId,
		marketId,
		side: "YES",
		quantity,
	});
}

describe("AUDIT-FIX-B3 A3 — sell oversell → cached 400 (not uncached 500)", () => {
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
			// Post-0022: the boundary 200 sell commits a receipt as its last write.
			"bet_receipts",
		]);
	});

	it("sell-oversell::rejects-oversell-400-insufficient-shares", async () => {
		const userId = await seedUser("oversell", "oversell");
		const marketId = await seedOpenMarketWithPool("oversell-market");
		await seedHeldPosition(userId, marketId, "5.000000000000000000");
		mockGetSession.mockResolvedValue({ user: { id: userId } });

		// Sell 10 against a held 5 → oversell. Today: uncached 500 error_internal.
		const res = await sellPOST(req({ marketId, shares: "10" }, "oversell-key"));

		expect(res.status).toBe(400);
		const payload = await res.json();
		expect(payload.ok).toBe(false);
		expect(payload.error.code).toBe("insufficient_shares");

		// The completed response handed to release is a 400 → CACHED (a `<500`
		// terminal error), so a retry replays the deterministic 400 rather than
		// re-executing. Today the endpoint sees a 500 → release(null) (not cached).
		expect(mockRelease).toHaveBeenCalledWith(
			expect.objectContaining({ status: 400 }),
		);

		// ── ZERO deltas: the tx rolled back, nothing leaked ────────────────────
		// No sell-credit ledger row (the position seed wrote none; the rejected
		// sell wrote none).
		const ledgerRows = await testDb
			.select({ id: dharmaLedger.id })
			.from(dharmaLedger)
			.where(eq(dharmaLedger.userId, userId));
		expect(ledgerRows.length).toBe(0);

		// No bet.sold event.
		const soldEvents = await testDb
			.select({ eventId: events.eventId })
			.from(events)
			.where(eq(events.eventType, "bet.sold"));
		expect(soldEvents.length).toBe(0);

		// Pool reserves untouched.
		const [poolRow] = await testDb
			.select({
				yesReserves: pools.yesReserves,
				noReserves: pools.noReserves,
			})
			.from(pools)
			.where(eq(pools.marketId, marketId));
		expect(poolRow?.yesReserves).toBe(SEED_RESERVES);
		expect(poolRow?.noReserves).toBe(SEED_RESERVES);

		// The held position is UNCHANGED (still 5) — the oversell never debited it.
		const positionRows = await testDb
			.select({ quantity: positions.quantity })
			.from(positions)
			.where(
				and(eq(positions.userId, userId), eq(positions.marketId, marketId)),
			);
		expect(positionRows.length).toBe(1);
		expect(positionRows[0]?.quantity).toBe("5.000000000000000000");
	});

	it("sell-oversell::boundary-sell-full-held-quantity-succeeds-200", async () => {
		// `shares == held` is legal (sell-to-zero): the pre-check is strict `>`, and
		// applyPositionDelta allows `== 0`. Selling exactly 5 of 5 → 200, position
		// flat.
		const userId = await seedUser("boundary", "boundary");
		const marketId = await seedOpenMarketWithPool("boundary-market");
		await seedHeldPosition(userId, marketId, "5.000000000000000000");
		mockGetSession.mockResolvedValue({ user: { id: userId } });

		const res = await sellPOST(
			req({ marketId, shares: "5.000000000000000000" }, "boundary-key"),
		);

		expect(res.status).toBe(200);
		const payload = await res.json();
		expect(payload.ok).toBe(true);

		// Position sold to zero → no held row remains.
		const { heldSideOrNull } = await import("@/server/positions/read");
		expect(await heldSideOrNull(testDb, { userId, marketId })).toBeNull();
	});
});
