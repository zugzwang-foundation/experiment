import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@sentry/nextjs", () => ({
	captureMessage: vi.fn(),
	addBreadcrumb: vi.fn(),
	captureException: vi.fn(),
}));

import { events, markets, pools } from "@/db/schema";
import {
	MarketDeadlineInPastError,
	MarketLifecycleStateError,
	MarketSeedInvalidError,
} from "@/server/markets/errors";
import { openMarket } from "@/server/markets/open";

import { testClient, testDb } from "../../db/_fixtures/db";

// ENGINE.14 §5.6 tests-first (S1, plan §Test plan charter) — the F-ADMIN-2
// seed/open acceptance home (P1–P5). Greenfield VALUE imports from
// `@/server/markets/open` (+ the lifecycle error taxonomy in
// `@/server/markets/errors`) RED at collection until S2 lands. DB-BACKED
// (local Postgres :54322).
//
// Contract pins (plan §Flows + R-14.1 + D-14.c/f + carry-forward 2 + L-E9.3):
//   - W-4 locked branch, expectedStatus ['Draft']: ONE tx inserts the
//     symmetric pools row (y₀ = n₀ = seedAmount), flips Draft → Open, and
//     emits market.opened with payload EXACTLY { marketId, seedAmount };
//   - NO eventId parameter — minted internally ONCE at service entry;
//   - seedAmount is an exact-decimal STRING end to end (numericString > 0,
//     scale ≤ 18); string identity asserted with toBe, never closeness;
//   - openMarket rejects now ≥ resolution_deadline (D-14.c);
//   - NO dharma_ledger row, ever (R-14.1 / R-2 — not re-asserted here; the
//     conservation suites own it).

const SEED = "100.000000000000000000";
const SEED_1000 = "1000.000000000000000000";
const NOW = new Date("2026-07-01T00:00:00.000Z");
const FIXTURE_DEADLINE = new Date("2026-08-01T00:00:00.000Z");

function adminMetadata(flowId: string) {
	return {
		request_id: "test-engine14-open",
		flow_id: flowId,
		user_id: null,
		actor_id: "admin-singleton",
		idempotency_key: null,
		ip: "test",
		user_agent: "vitest",
	};
}

async function seedMarket(
	slug: string,
	status: "Draft" | "Open" | "Closed",
): Promise<string> {
	const [market] = await testDb
		.insert(markets)
		.values({
			slug,
			title: "PLACEHOLDER — not a real market",
			description: "PLACEHOLDER criterion — not a real criterion",
			status,
			resolutionDeadline: FIXTURE_DEADLINE,
		})
		.returning({ id: markets.id });
	return market?.id ?? "";
}

async function attachPool(marketId: string): Promise<void> {
	await testDb.insert(pools).values({
		marketId,
		yesReserves: SEED,
		noReserves: SEED,
	});
}

async function poolRowsFor(marketId: string) {
	return testDb
		.select({
			id: pools.id,
			yesReserves: pools.yesReserves,
			noReserves: pools.noReserves,
		})
		.from(pools)
		.where(eq(pools.marketId, marketId));
}

async function allEventRows() {
	return testDb.select({ eventId: events.eventId }).from(events);
}

async function marketStatus(marketId: string): Promise<string | undefined> {
	const [row] = await testDb
		.select({ status: markets.status })
		.from(markets)
		.where(eq(markets.id, marketId));
	return row?.status;
}

describe("ENGINE.14 F-ADMIN-2 — openMarket (W-4 locked, Draft → Open)", () => {
	afterEach(async () => {
		await testClient.unsafe(`TRUNCATE events, pools, markets CASCADE`);
		vi.clearAllMocks();
	});

	it("pool-seed::P1-seed-flow-and-state-transition", async () => {
		const marketId = await seedMarket("placeholder-p1-seed", "Draft");

		const result = await openMarket({
			marketId,
			seedAmount: SEED,
			now: NOW,
			metadata: adminMetadata("F-ADMIN-2"),
		});

		// Status flipped Draft → Open.
		expect(await marketStatus(marketId)).toBe("Open");

		// Exactly ONE pools row; symmetric reserves equal the seed.
		const poolRows = await poolRowsFor(marketId);
		expect(poolRows.length).toBe(1);
		expect(poolRows[0]?.yesReserves).toBe(SEED);
		expect(poolRows[0]?.noReserves).toBe(SEED);

		// Exactly ONE market.opened events row; payload EXACT
		// { marketId, seedAmount } (R-14.1 — the seed rides opened, not
		// created); admin actor metadata (R-14.5).
		const eventRows = await testDb
			.select({
				eventId: events.eventId,
				payload: events.payload,
				metadata: events.metadata,
			})
			.from(events)
			.where(eq(events.eventType, "market.opened"));
		expect(eventRows.length).toBe(1);
		expect(eventRows[0]?.payload).toEqual({ marketId, seedAmount: SEED });
		const metadata = eventRows[0]?.metadata as {
			actor_id?: unknown;
			user_id?: unknown;
		};
		expect(metadata.actor_id).toBe("admin-singleton");
		expect(metadata.user_id).toBeNull();

		// D-14.f response — key-set EXACT; poolId === the pools row id and
		// openedEventId === the events row id (semantic, L-E9.3).
		expect(result).toEqual({
			marketId,
			poolId: poolRows[0]?.id,
			status: "Open",
			seedAmount: SEED,
			openedEventId: eventRows[0]?.eventId,
		});
		expect(result.openedEventId).not.toBe(marketId);
		expect(result.openedEventId).not.toBe(result.poolId);
	});

	it("pool-seed::P2-rejects-open", async () => {
		// An Open fixture already carries its pool — the reject must add NO new
		// pools row (count stays exactly 1) and write NO event.
		const marketId = await seedMarket("placeholder-p2-open", "Open");
		await attachPool(marketId);

		const caught = await openMarket({
			marketId,
			seedAmount: SEED,
			now: NOW,
			metadata: adminMetadata("F-ADMIN-2"),
		}).catch((e: unknown) => e);
		expect(caught).toBeInstanceOf(MarketLifecycleStateError);

		expect((await poolRowsFor(marketId)).length).toBe(1);
		expect((await allEventRows()).length).toBe(0);
	});

	it("pool-seed::P2-rejects-closed", async () => {
		const marketId = await seedMarket("placeholder-p2-closed", "Closed");

		const caught = await openMarket({
			marketId,
			seedAmount: SEED,
			now: NOW,
			metadata: adminMetadata("F-ADMIN-2"),
		}).catch((e: unknown) => e);
		expect(caught).toBeInstanceOf(MarketLifecycleStateError);

		expect((await poolRowsFor(marketId)).length).toBe(0);
		expect((await allEventRows()).length).toBe(0);
	});

	it("pool-seed::P3-rejects-invalid-seed", async () => {
		// Four invalid seeds in sequence on ONE Draft fixture: zero, negative,
		// 19-dp scale, malformed — each MarketSeedInvalidError, nothing written.
		const marketId = await seedMarket("placeholder-p3-seed", "Draft");

		for (const bad of ["0", "-5", "1.0000000000000000001", "abc"]) {
			const caught = await openMarket({
				marketId,
				seedAmount: bad,
				now: NOW,
				metadata: adminMetadata("F-ADMIN-2"),
			}).catch((e: unknown) => e);
			expect(caught).toBeInstanceOf(MarketSeedInvalidError);
		}

		expect((await poolRowsFor(marketId)).length).toBe(0);
		expect((await allEventRows()).length).toBe(0);
		expect(await marketStatus(marketId)).toBe("Draft");
	});

	it("pool-seed::P4-symmetric-seed-pin", async () => {
		// Carry-forward 2 (Y₀ = N₀): the input seedAmount, BOTH numeric(38,18)
		// reserve readbacks, and the market.opened payload seedAmount are
		// STRING-IDENTICAL at 18 dp (toBe — never numeric closeness).
		const marketId = await seedMarket("placeholder-p4-sym", "Draft");

		await openMarket({
			marketId,
			seedAmount: SEED_1000,
			now: NOW,
			metadata: adminMetadata("F-ADMIN-2"),
		});

		const [poolRow] = await poolRowsFor(marketId);
		expect(poolRow?.yesReserves).toBe(SEED_1000);
		expect(poolRow?.noReserves).toBe(SEED_1000);

		const [eventRow] = await testDb
			.select({ payload: events.payload })
			.from(events)
			.where(eq(events.eventType, "market.opened"));
		const payload = eventRow?.payload as { seedAmount?: unknown };
		expect(payload.seedAmount).toBe(SEED_1000);
	});

	it("pool-seed::P5-rejects-expired-deadline-open", async () => {
		// D-14.c: opening a market the sweep would close on its next tick is
		// surfaced, not allowed — now === deadline AND now > deadline reject.
		const marketId = await seedMarket("placeholder-p5-expired", "Draft");

		const caughtEq = await openMarket({
			marketId,
			seedAmount: SEED,
			now: FIXTURE_DEADLINE,
			metadata: adminMetadata("F-ADMIN-2"),
		}).catch((e: unknown) => e);
		expect(caughtEq).toBeInstanceOf(MarketDeadlineInPastError);

		const caughtGt = await openMarket({
			marketId,
			seedAmount: SEED,
			now: new Date("2026-08-02T00:00:00.000Z"),
			metadata: adminMetadata("F-ADMIN-2"),
		}).catch((e: unknown) => e);
		expect(caughtGt).toBeInstanceOf(MarketDeadlineInPastError);

		expect((await poolRowsFor(marketId)).length).toBe(0);
		expect((await allEventRows()).length).toBe(0);
		expect(await marketStatus(marketId)).toBe("Draft");
	});
});
