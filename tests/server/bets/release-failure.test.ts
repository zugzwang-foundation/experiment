import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// AUDIT-FIX-B3 A4 (kickoff RED c) — `release-failure::committed-response-survives`.
// The endpoint's finally runs an UNGUARDED `await release(completed)`. An Upstash
// blip at completion-write time throws IN the finally, superseding the already-
// built (committed) 200 → a landed bet returns a raw 500, no alarm, sentinel
// dangling. The fix wraps the finally in try/catch → `safeCaptureException(err,
// { tags: { kind: "upstash_unavailable_idempotency", site: "endpoint_finally" } })`
// → swallow, so the response always reaches the client.
//
// The module mock replaces `@/server/idempotency/cache` wholesale with a miss-arm
// whose `release` THROWS — the layer the guarded finally must absorb.
//
// Load-bearing properties (both place AND sell):
//   - the request returns 200 despite the release throw (today: the finally throw
//     escapes → the awaited POST rejects / 500);
//   - the committed rows are present (the tx committed BEFORE the finally);
//   - `captureException` fired with tag kind `upstash_unavailable_idempotency`
//     (the ADR-0015 §3 completion-write alarm half, previously unimplemented).
//
// Invariant/contract: plan §3.6 row 12 (release failure after commit → the already-
// built response + alarm 6b). No invariant weakened — the money tx already
// committed; only the cache write-back failed.
//
// RED posture: assertion-RED (the release throw escapes today) AND teardown-RED
// until 0022. Route-backed against local Postgres. Decimal STRINGS.

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
// The completion-write failure: a miss whose release ALWAYS throws (Upstash blip).
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

import { POST as placePOST } from "@/app/api/bets/place/route";
import { POST as sellPOST } from "@/app/api/bets/sell/route";
import {
	bets,
	dharmaLedger,
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
			"x-forwarded-for": "203.0.113.34",
		},
		body: JSON.stringify(body),
	});
}

async function seedUser(emailTag: string, pseudonym: string): Promise<string> {
	const [user] = await testDb
		.insert(users)
		.values({
			name: "Release Failure User",
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
			title: "Release Failure Market",
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

function expectUpstashAlarmFired() {
	// The completion-write alarm (tag kind `upstash_unavailable_idempotency`);
	// `site` is an execution detail (release | endpoint_finally) — match tolerantly.
	expect(mockCaptureException).toHaveBeenCalledWith(
		expect.anything(),
		expect.objectContaining({
			tags: expect.objectContaining({
				kind: "upstash_unavailable_idempotency",
			}),
		}),
	);
}

describe("AUDIT-FIX-B3 A4 — guarded release: committed response survives a release throw", () => {
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

	it("release-failure::place-returns-200-and-alarms-when-release-throws", async () => {
		const userId = await seedUser("rel-place", "rel-place");
		const marketId = await seedOpenMarketWithPool("rel-place-market");
		await seedDharmaGrant(userId);
		mockGetSession.mockResolvedValue({ user: { id: userId } });

		// Today RED — the release throw escapes the unguarded finally → this rejects.
		const res = await placePOST(
			req(
				"/api/bets/place",
				{ marketId, side: "YES", stake: "10", body: "committed argument" },
				"rel-place-key",
			),
		);
		expect(res.status).toBe(200);

		// The bet committed BEFORE the finally — the row is present.
		const betRows = await testDb
			.select({ id: bets.id })
			.from(bets)
			.where(eq(bets.marketId, marketId));
		expect(betRows.length).toBe(1);

		expectUpstashAlarmFired();
	});

	it("release-failure::sell-returns-200-and-alarms-when-release-throws", async () => {
		const userId = await seedUser("rel-sell", "rel-sell");
		const marketId = await seedOpenMarketWithPool("rel-sell-market");
		// Direct position seed (Bucket C) — a comment-free sell needs no grant
		// (it only CREDITS proceeds).
		await testDb.insert(positions).values({
			userId,
			marketId,
			side: "YES",
			quantity: "10.000000000000000000",
		});
		mockGetSession.mockResolvedValue({ user: { id: userId } });

		const res = await sellPOST(
			req("/api/bets/sell", { marketId, shares: "4" }, "rel-sell-key"),
		);
		expect(res.status).toBe(200);

		// The sell committed BEFORE the finally — the proceeds credit is present.
		const sellCredit = (
			await testDb
				.select({
					entryType: dharmaLedger.entryType,
					betId: dharmaLedger.betId,
				})
				.from(dharmaLedger)
				.where(eq(dharmaLedger.userId, userId))
		).find((r) => r.entryType === "bet_stake" && r.betId === null);
		expect(sellCredit).toBeDefined();

		expectUpstashAlarmFired();
	});
});
