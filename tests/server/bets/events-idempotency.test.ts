import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ENGINE.8 events-idempotency [R3/R4] — the retry-purity acceptance tests
// (plan §"Test plan" + §"Retry-purity (load-bearing)"). Two facts:
//   [R3] A successful PLACE writes EXACTLY TWO event rows — bet.placed
//        (aggregateType "bet", aggregateId = bet.id) + comment.placed
//        (aggregateType "comment", aggregateId = comment.id) — and each row's
//        created_at is STABLE across a forced retry (the two event_ids are
//        generated ONCE at handler entry + closed over; insertEvent derives
//        created_at from the UUIDv7 prefix + dedupes on
//        ON CONFLICT (event_id, created_at)). A per-attempt-regenerated event_id
//        would drift created_at and leak a second row.
//   [R4] A successful SELL writes EXACTLY ONE — bet.sold (aggregateType
//        "market", aggregateId = marketId; payload.betId = a synthetic fresh
//        UUIDv7; no bets/comments row).
//   [ENGINE.12] The day's FIRST commented place ALSO pays the Daily Credit —
//        a THIRD event row, dharma.credited (aggregateType "dharma_account",
//        aggregateId = userId), whose event_id (`creditEventId`) is minted at
//        handler entry per P1 — so its created_at too is STABLE across the
//        forced retry. The comment-free sell never adds a second one.
//
// Fault injection (mirrors concurrency.test.ts::retry-on-40001 / ::concurrency-
// retry-events-idempotent): partial-mock the FIRST spine write
// (`upsertPositionDelta`) so it throws a synthetic 40001 on attempt 1 (BEFORE
// delegating to the real impl), then delegates on attempt 2. The wrapper's
// retry loop re-runs the WHOLE callback; the whole attempt-1 tx (incl. its event
// inserts) rolls back, and attempt 2 re-runs with the SAME closed-over event_ids.
//
// CI-RED (DB/route-backed): Postgres :54322 DOWN + greenfield route imports. The
// REAL wrapper + REAL DB do the retrying; only the externals + the one-shot
// position-fault are mocked. Money/share values are decimal STRINGS.

const { mockGetSession, positionFault } = vi.hoisted(() => ({
	mockGetSession: vi.fn(),
	positionFault: { remaining: 0 },
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
		release: vi.fn(async () => {}),
	})),
}));
vi.mock("@/server/moderation/precommit", () => ({
	precommitModerate: vi.fn(async () => ({ outcome: "pass", categories: [] })),
}));

// Partial-mock the positions persist module: wrap upsertPositionDelta so it
// throws ONE synthetic 40001 (consuming `positionFault.remaining`) before
// delegating to the real implementation. The real spine writes still happen on
// the retried attempt — so the committed end-state is genuine.
vi.mock("@/server/positions/persist", async (importOriginal) => {
	const actual =
		await importOriginal<typeof import("@/server/positions/persist")>();
	return {
		...actual,
		upsertPositionDelta: vi.fn(
			async (...args: Parameters<typeof actual.upsertPositionDelta>) => {
				if (positionFault.remaining > 0) {
					positionFault.remaining -= 1;
					throw Object.assign(new Error("serialization_failure"), {
						code: "40001",
					});
				}
				return actual.upsertPositionDelta(...args);
			},
		),
	};
});

import { POST as placePOST } from "@/app/api/bets/place/route";
import { POST as sellPOST } from "@/app/api/bets/sell/route";
import { events, markets, pools, users } from "@/db/schema";
import { upsertPositionDelta } from "@/server/positions/persist";

import { createdAtFromUuidV7, testClient, testDb } from "../../db/_fixtures/db";
import { truncateTables } from "../../db/_fixtures/truncate";

const SEED_RESERVES = "100.000000000000000000";

function req(path: string, body: unknown, idempotencyKey: string) {
	return new Request(`https://prd.example.com${path}`, {
		method: "POST",
		headers: {
			"content-type": "application/json",
			origin: "https://prd.example.com",
			"Idempotency-Key": idempotencyKey,
			"x-forwarded-for": "203.0.113.24",
		},
		body: JSON.stringify(body),
	});
}

async function seedUser(emailTag: string, pseudonym: string): Promise<string> {
	const [user] = await testDb
		.insert(users)
		.values({
			name: "Events-Idem User",
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
			title: "Events-Idem Market",
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

describe("ENGINE.8 events-idempotency [R3/R4]", () => {
	beforeEach(() => {
		positionFault.remaining = 0;
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
		]);
	});

	it("bet-place::two-events-stable-created-at-across-retry [R3]", async () => {
		const userId = await seedUser("ev-place", "ev-place");
		const marketId = await seedOpenMarketWithPool("ev-place-market");
		await seedDharmaGrant(userId);
		mockGetSession.mockResolvedValue({ user: { id: userId } });

		// Inject ONE 40001 on the first spine write → the wrapper retries; the
		// whole attempt-1 tx (incl. its two event inserts) rolls back; attempt 2
		// re-runs with the SAME two closed-over event_ids.
		positionFault.remaining = 1;

		const res = await placePOST(
			req(
				"/api/bets/place",
				{ marketId, side: "YES", stake: "10", body: "retry-purity argument" },
				"ev-place-key",
			),
		);
		expect(res.status).toBe(200);

		// EXACTLY TWO event rows: bet.placed "bet" + comment.placed "comment".
		const betEvents = await testDb
			.select({
				eventId: events.eventId,
				createdAt: events.createdAt,
				aggregateType: events.aggregateType,
			})
			.from(events)
			.where(eq(events.eventType, "bet.placed"));
		const commentEvents = await testDb
			.select({
				eventId: events.eventId,
				createdAt: events.createdAt,
				aggregateType: events.aggregateType,
			})
			.from(events)
			.where(eq(events.eventType, "comment.placed"));

		// No leaked duplicate from the rolled-back attempt 1 — exactly one of each.
		expect(betEvents.length).toBe(1);
		expect(commentEvents.length).toBe(1);
		expect(betEvents[0]?.aggregateType).toBe("bet");
		expect(commentEvents[0]?.aggregateType).toBe("comment");

		// created_at is the UUIDv7-derived timestamp — STABLE across the retry
		// (insertEvent derives it from the event_id prefix, never now()).
		const betId = betEvents[0]?.eventId ?? "";
		const commentEventId = commentEvents[0]?.eventId ?? "";
		expect(betEvents[0]?.createdAt.getTime()).toBe(
			createdAtFromUuidV7(betId).getTime(),
		);
		expect(commentEvents[0]?.createdAt.getTime()).toBe(
			createdAtFromUuidV7(commentEventId).getTime(),
		);

		// ENGINE.12 (RC9): the first commented place of the day pays the Daily
		// Credit in the SAME tx — exactly ONE dharma.credited row (aggregate
		// "dharma_account", aggregateId = userId), created_at UUIDv7-derived and
		// STABLE across the retry (P1: creditEventId minted ONCE at handler
		// entry, closed over — never per attempt).
		const creditEvents = await testDb
			.select({
				eventId: events.eventId,
				createdAt: events.createdAt,
				aggregateType: events.aggregateType,
				aggregateId: events.aggregateId,
			})
			.from(events)
			.where(eq(events.eventType, "dharma.credited"));
		expect(creditEvents.length).toBe(1);
		expect(creditEvents[0]?.aggregateType).toBe("dharma_account");
		expect(creditEvents[0]?.aggregateId).toBe(userId);
		const creditEventId = creditEvents[0]?.eventId ?? "";
		expect(creditEvents[0]?.createdAt.getTime()).toBe(
			createdAtFromUuidV7(creditEventId).getTime(),
		);

		// Per-type counts: the committed place wrote EXACTLY three event rows —
		// bet.placed + comment.placed + dharma.credited; nothing leaked from the
		// rolled-back attempt 1.
		const allEvents = await testDb
			.select({ eventType: events.eventType })
			.from(events);
		expect(allEvents.length).toBe(3);

		// Prove the retry ACTUALLY fired (not a zero-retry happy path): positions is
		// the FIRST spine write [R1], so a 2nd invocation = a genuine top-of-callback
		// re-run. clearAllMocks() in beforeEach zeroes the counter; this is the only
		// op in the test, so 2 = attempt-1 throw + attempt-2 success.
		expect(vi.mocked(upsertPositionDelta)).toHaveBeenCalledTimes(2);
		// The synthetic 40001 was actually consumed (guards a silently no-op'd fault).
		expect(positionFault.remaining).toBe(0);
	});

	it("bet-sell::one-bet-sold-event-market-aggregate [R4]", async () => {
		const userId = await seedUser("ev-sell", "ev-sell");
		const marketId = await seedOpenMarketWithPool("ev-sell-market");
		await seedDharmaGrant(userId);
		mockGetSession.mockResolvedValue({ user: { id: userId } });

		// Entry (no fault) so there is a position to sell.
		const entry = await placePOST(
			req(
				"/api/bets/place",
				{ marketId, side: "YES", stake: "10", body: "entry before sell" },
				"ev-sell-place",
			),
		);
		expect(entry.status).toBe(200);

		const { getHeldPosition } = await import("@/server/positions/read");
		const held = await getHeldPosition(testDb, { userId, marketId });
		const heldQuantity = held?.quantity ?? "0";

		// The unfaulted ENTRY placePOST above called upsertPositionDelta ONCE. Reset
		// the call counter so toHaveBeenCalledTimes(2) isolates the SELL's invocations.
		vi.mocked(upsertPositionDelta).mockClear();

		// Force ONE retry on the SELL too, to prove the single sell event is stable.
		positionFault.remaining = 1;

		const sell = await sellPOST(
			req("/api/bets/sell", { marketId, shares: heldQuantity }, "ev-sell-sell"),
		);
		expect(sell.status).toBe(200);

		// EXACTLY ONE bet.sold event, aggregate "market", aggregateId = marketId,
		// created_at stable (no leaked duplicate from the rolled-back attempt 1).
		const soldEvents = await testDb
			.select({
				eventId: events.eventId,
				createdAt: events.createdAt,
				aggregateType: events.aggregateType,
				aggregateId: events.aggregateId,
			})
			.from(events)
			.where(eq(events.eventType, "bet.sold"));
		expect(soldEvents.length).toBe(1);
		expect(soldEvents[0]?.aggregateType).toBe("market");
		expect(soldEvents[0]?.aggregateId).toBe(marketId);
		const sellEventId = soldEvents[0]?.eventId ?? "";
		expect(soldEvents[0]?.createdAt.getTime()).toBe(
			createdAtFromUuidV7(sellEventId).getTime(),
		);

		// Prove the SELL callback ACTUALLY re-ran (not a zero-retry happy path):
		// counter cleared after the entry, so 2 = attempt-1 throw + attempt-2 success.
		expect(vi.mocked(upsertPositionDelta)).toHaveBeenCalledTimes(2);
		// The synthetic 40001 was actually consumed (guards a silently no-op'd fault).
		expect(positionFault.remaining).toBe(0);

		// ENGINE.12 (RC9): the ENTRY paid the day's credit; the comment-free
		// SELL — even retried — never pays a second one. Still exactly ONE
		// dharma.credited row.
		const creditEvents = await testDb
			.select({ eventId: events.eventId })
			.from(events)
			.where(eq(events.eventType, "dharma.credited"));
		expect(creditEvents.length).toBe(1);
	});
});
