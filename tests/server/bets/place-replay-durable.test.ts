import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// AUDIT-FIX-B3 A9 (kickoff RED b) — `place-replay-durable::returns-original-result`.
// The always-miss idempotency mock IS the Redis-lost simulation (release is a
// no-op, so the fast path never repopulates): every request is a genuine miss.
// Today a same-key place REPLAY re-runs moderation, then 23505s on
// `bets_idempotency_key_idx` → unmapped → an UNCACHED 500 (the client retries
// forever against a bet that already landed). The fix adds a DURABLE `bet_receipts`
// pre-check (before moderation) + a 23505 catch, both answering the ORIGINAL 200.
//
// Load-bearing properties (happy replay, same key + same body):
//   - both requests → 200, the second body DEEPLY EQUALS the first (today: 500);
//   - exactly ONE bets row + ONE comments row (the replay never re-executes the tx);
//   - `precommitModerate` runs EXACTLY ONCE across both (the durable pre-check
//     short-circuits BEFORE step-6 moderation — the verdict-flip shield);
//   - ledger + pool reserves are UNCHANGED by the replay (single money mutation).
//
// Variant (same key, DIFFERENT body): → 409 `error_idempotency_key_reused`, and the
// release mock receives `null` (the 409 is NEVER cached — caching it would poison
// the original body's rightful replay).
//
// Invariant/contract: plan §3.6 rows 3/4/10 (durable replay 200 + fingerprint-
// mismatch 409) + I-IDEM-ONCE-001 (one commit per idempotency key). INV-1 holds
// throughout (bet ↔ comment atomicity — one bets, one comments).
//
// RED posture: assertion-RED (today the replay is a 500; moderation runs twice)
// AND teardown-RED until migration 0022 lands `bet_receipts` (the afterEach
// truncate references it). Route-backed against local Postgres. Decimal STRINGS.

const { mockGetSession, mockPrecommit, mockRelease } = vi.hoisted(() => ({
	mockGetSession: vi.fn(),
	mockPrecommit: vi.fn(),
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
// The fingerprint mock must be BODY-SENSITIVE (JSON.stringify) so the durable
// pre-check can distinguish the happy replay (match) from the reused-key attack
// (mismatch). `release` is a shared hoisted spy (asserts release(null) on 409).
vi.mock("@/server/idempotency/cache", () => ({
	computeBodyFingerprint: vi.fn(async (body: unknown) => JSON.stringify(body)),
	idempotencyLookupOrReserve: vi.fn(async () => ({
		kind: "miss",
		release: mockRelease,
	})),
}));
vi.mock("@/server/moderation/precommit", () => ({
	precommitModerate: mockPrecommit,
}));

import { POST as placePOST } from "@/app/api/bets/place/route";
import {
	bets,
	comments,
	dharmaLedger,
	markets,
	pools,
	users,
} from "@/db/schema";

import { testClient, testDb } from "../../db/_fixtures/db";
import { truncateTables } from "../../db/_fixtures/truncate";

const SEED_RESERVES = "100.000000000000000000";

function placeReq(body: unknown, idempotencyKey: string) {
	return new Request("https://prd.example.com/api/bets/place", {
		method: "POST",
		headers: {
			"content-type": "application/json",
			origin: "https://prd.example.com",
			"Idempotency-Key": idempotencyKey,
			"x-forwarded-for": "203.0.113.32",
		},
		body: JSON.stringify(body),
	});
}

async function seedUser(emailTag: string, pseudonym: string): Promise<string> {
	const [user] = await testDb
		.insert(users)
		.values({
			name: "Durable Replay User",
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
			title: "Durable Replay Market",
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

describe("AUDIT-FIX-B3 A9 — place durable idempotency replay", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockPrecommit.mockResolvedValue({ outcome: "pass", categories: [] });
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

	it("place-replay-durable::returns-original-result-executes-once", async () => {
		const userId = await seedUser("dur-place", "dur-place");
		const marketId = await seedOpenMarketWithPool("dur-place-market");
		await seedDharmaGrant(userId);
		mockGetSession.mockResolvedValue({ user: { id: userId } });

		const body = {
			marketId,
			side: "YES",
			stake: "10",
			body: "durable replay argument",
		};

		// First place: idem MISS → moderation + tx → 200 + writes + durable receipt.
		const first = await placePOST(placeReq(body, "dur-place-key"));
		expect(first.status).toBe(200);
		const firstBody = await first.json();
		expect(firstBody.ok).toBe(true);

		// Snapshot the committed money state after the FIRST place.
		const ledgerAfterFirst = await testDb
			.select({ id: dharmaLedger.id })
			.from(dharmaLedger)
			.where(eq(dharmaLedger.userId, userId));
		const [poolAfterFirst] = await testDb
			.select({
				yesReserves: pools.yesReserves,
				noReserves: pools.noReserves,
			})
			.from(pools)
			.where(eq(pools.marketId, marketId));

		// Second place: IDENTICAL key + body. Today RED — miss → moderation re-runs
		// → tx 23505 on bets_idempotency_key_idx → uncached 500.
		const second = await placePOST(placeReq(body, "dur-place-key"));
		expect(second.status).toBe(200);
		const secondBody = await second.json();

		// The replay returns the ORIGINAL result byte-for-byte (decimal strings
		// round-trip stably through the jsonb receipt).
		expect(secondBody).toEqual(firstBody);

		// The durable pre-check short-circuits BEFORE moderation → precommitModerate
		// ran exactly ONCE across both requests (today: twice).
		expect(mockPrecommit).toHaveBeenCalledTimes(1);

		// Exactly ONE bets + ONE comments row — the replay never re-executed the tx.
		const betRows = await testDb
			.select({ id: bets.id })
			.from(bets)
			.where(eq(bets.marketId, marketId));
		expect(betRows.length).toBe(1);
		const commentRows = await testDb
			.select({ id: comments.id })
			.from(comments)
			.where(eq(comments.marketId, marketId));
		expect(commentRows.length).toBe(1);

		// Ledger + pool reserves UNCHANGED by the replay (single money mutation).
		const ledgerAfterReplay = await testDb
			.select({ id: dharmaLedger.id })
			.from(dharmaLedger)
			.where(eq(dharmaLedger.userId, userId));
		expect(ledgerAfterReplay.length).toBe(ledgerAfterFirst.length);
		const [poolAfterReplay] = await testDb
			.select({
				yesReserves: pools.yesReserves,
				noReserves: pools.noReserves,
			})
			.from(pools)
			.where(eq(pools.marketId, marketId));
		expect(poolAfterReplay?.yesReserves).toBe(poolAfterFirst?.yesReserves);
		expect(poolAfterReplay?.noReserves).toBe(poolAfterFirst?.noReserves);
	});

	it("place-replay-durable::same-key-different-body-rejected-409-not-cached", async () => {
		const userId = await seedUser("dur-mismatch", "dur-mismatch");
		const marketId = await seedOpenMarketWithPool("dur-mismatch-market");
		await seedDharmaGrant(userId);
		mockGetSession.mockResolvedValue({ user: { id: userId } });

		// First place lands + writes the receipt (fingerprint of body A).
		const first = await placePOST(
			placeReq(
				{ marketId, side: "YES", stake: "10", body: "original body A" },
				"dur-mismatch-key",
			),
		);
		expect(first.status).toBe(200);

		// Same key, DIFFERENT body B → the durable pre-check finds the receipt but
		// the fingerprint mismatches → 409 error_idempotency_key_reused.
		const second = await placePOST(
			placeReq(
				{ marketId, side: "YES", stake: "25", body: "mutated body B" },
				"dur-mismatch-key",
			),
		);
		expect(second.status).toBe(409);
		const secondBody = await second.json();
		expect(secondBody.ok).toBe(false);
		expect(secondBody.error.code).toBe("error_idempotency_key_reused");

		// The 409 is NEVER cached (caching it under the key would poison the
		// original body's rightful replay): the endpoint hands release `null`.
		expect(mockRelease).toHaveBeenLastCalledWith(null);

		// The mismatched request wrote NOTHING new — still exactly one bet.
		const betRows = await testDb
			.select({ id: bets.id })
			.from(bets)
			.where(eq(bets.marketId, marketId));
		expect(betRows.length).toBe(1);
	});
});
