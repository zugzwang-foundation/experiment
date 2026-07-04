import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@sentry/nextjs", () => ({
	captureMessage: vi.fn(),
	addBreadcrumb: vi.fn(),
	captureException: vi.fn(),
}));

import { events, markets } from "@/db/schema";
import { closeDueMarkets, closeMarket } from "@/server/markets/close";
import {
	MarketDeadlineNotReachedError,
	MarketLifecycleStateError,
} from "@/server/markets/errors";

import { testClient, testDb } from "../../db/_fixtures/db";
import { truncateTables } from "../../db/_fixtures/truncate";

// ENGINE.14 §5.6 tests-first (S1, plan §Test plan charter) — the clock-driven
// Open → Closed cutoff (C1–C5): closeMarket (W-4 locked, expectedStatus
// ['Open'], gated through the pure `closeOnDeadline`) + the closeDueMarkets
// sweep. Greenfield VALUE imports from `@/server/markets/close` (+ the
// lifecycle error taxonomy in `@/server/markets/errors`) RED at collection
// until S2 lands. DB-BACKED (local Postgres :54322).
//
// Contract pins (plan §Flows + R-14.3 + D-14.d/e/f + L-E9.3):
//   - the clock is an ARGUMENT (`now: Date`) all the way up — no flow reads
//     Date.now(); `now == deadline` closes (the transitions.ts `==` edge);
//   - NO eventId parameter — minted internally ONCE at service entry; each
//     sweep candidate's close mints its OWN id via closeMarket;
//   - market.closed payload EXACTLY { marketId }; the sweep emits as
//     actor_id 'admin-singleton' / user_id null (D-14.d);
//   - closeDueMarkets → { closed, skipped, closedMarketIds } with ids ordered
//     by id ASCENDING; re-running is idempotent ({ closed: 0, … }).

const DEADLINE = new Date("2026-08-01T00:00:00.000Z");
const AFTER = new Date("2026-08-02T00:00:00.000Z");
const SWEEP_NOW = new Date("2026-08-15T00:00:00.000Z");

function adminMetadata(flowId: string) {
	return {
		request_id: "test-engine14-close",
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
	status: "Draft" | "Open" | "Closed" | "Resolved",
	resolutionDeadline: Date,
): Promise<string> {
	const [market] = await testDb
		.insert(markets)
		.values({
			slug,
			title: "PLACEHOLDER — not a real market",
			description: "PLACEHOLDER criterion — not a real criterion",
			status,
			resolutionDeadline,
		})
		.returning({ id: markets.id });
	return market?.id ?? "";
}

async function marketStatus(marketId: string): Promise<string | undefined> {
	const [row] = await testDb
		.select({ status: markets.status })
		.from(markets)
		.where(eq(markets.id, marketId));
	return row?.status;
}

async function closedEventRows() {
	return testDb
		.select({ eventId: events.eventId, payload: events.payload })
		.from(events)
		.where(eq(events.eventType, "market.closed"));
}

async function eventRowsForAggregate(aggregateId: string) {
	return testDb
		.select({ eventId: events.eventId })
		.from(events)
		.where(eq(events.aggregateId, aggregateId));
}

describe("ENGINE.14 — closeMarket + closeDueMarkets (W-4, Open → Closed)", () => {
	afterEach(async () => {
		await truncateTables(testClient, ["events", "markets"]);
		vi.clearAllMocks();
	});

	it("market-close::C1-closes-at-deadline", async () => {
		// now == deadline closes (the transitions.ts `==` edge, D-14.e clock).
		const marketId = await seedMarket("placeholder-c1-at", "Open", DEADLINE);

		const result = await closeMarket({
			marketId,
			now: DEADLINE,
			metadata: adminMetadata("W-4-close"),
		});

		expect(await marketStatus(marketId)).toBe("Closed");

		const eventRows = await closedEventRows();
		expect(eventRows.length).toBe(1);
		expect(eventRows[0]?.payload).toEqual({ marketId });

		// D-14.f response — key-set EXACT; closedEventId semantic (L-E9.3).
		expect(result).toEqual({
			marketId,
			status: "Closed",
			closedEventId: eventRows[0]?.eventId,
		});
		expect(result.closedEventId).not.toBe(marketId);
	});

	it("market-close::C1-closes-after-deadline", async () => {
		const marketId = await seedMarket("placeholder-c1-after", "Open", DEADLINE);

		const result = await closeMarket({
			marketId,
			now: AFTER,
			metadata: adminMetadata("W-4-close"),
		});

		expect(await marketStatus(marketId)).toBe("Closed");

		const eventRows = await closedEventRows();
		expect(eventRows.length).toBe(1);
		expect(eventRows[0]?.payload).toEqual({ marketId });

		expect(result).toEqual({
			marketId,
			status: "Closed",
			closedEventId: eventRows[0]?.eventId,
		});
		expect(result.closedEventId).not.toBe(marketId);
	});

	it("market-close::C2-rejects-before-deadline", async () => {
		const marketId = await seedMarket("placeholder-c2-early", "Open", DEADLINE);

		const caught = await closeMarket({
			marketId,
			now: new Date("2026-07-31T00:00:00.000Z"),
			metadata: adminMetadata("W-4-close"),
		}).catch((e: unknown) => e);
		expect(caught).toBeInstanceOf(MarketDeadlineNotReachedError);

		// Zero writes: status untouched, zero events.
		expect(await marketStatus(marketId)).toBe("Open");
		expect((await closedEventRows()).length).toBe(0);
		expect((await eventRowsForAggregate(marketId)).length).toBe(0);
	});

	for (const status of ["Draft", "Closed", "Resolved"] as const) {
		it(`market-close::C3-rejects-non-open-${status.toLowerCase()}`, async () => {
			// expectedStatus ['Open'] is the gate — the deadline is long past, so
			// ONLY the status precondition rejects.
			const marketId = await seedMarket(
				`placeholder-c3-${status.toLowerCase()}`,
				status,
				DEADLINE,
			);

			const caught = await closeMarket({
				marketId,
				now: AFTER,
				metadata: adminMetadata("W-4-close"),
			}).catch((e: unknown) => e);
			expect(caught).toBeInstanceOf(MarketLifecycleStateError);

			expect(await marketStatus(marketId)).toBe(status);
			expect((await eventRowsForAggregate(marketId)).length).toBe(0);
		});
	}

	it("market-close::C4-sweep-mixed-batch", async () => {
		// {2 due-Open, 1 future-Open, 1 Closed-with-PAST-deadline}: the Closed
		// fixture's deadline already passed, so ONLY the status filter can
		// exclude it from the candidate SELECT.
		const dueA = await seedMarket("placeholder-c4-due-a", "Open", DEADLINE);
		const dueB = await seedMarket("placeholder-c4-due-b", "Open", SWEEP_NOW);
		const future = await seedMarket(
			"placeholder-c4-future",
			"Open",
			new Date("2026-09-01T00:00:00.000Z"),
		);
		const alreadyClosed = await seedMarket(
			"placeholder-c4-closed",
			"Closed",
			DEADLINE,
		);

		const result = await closeDueMarkets({
			now: SWEEP_NOW,
			metadata: adminMetadata("W-4-sweep"),
		});

		// Ids ordered by id ascending — sorted equality, key-set EXACT.
		expect(result).toEqual({
			closed: 2,
			skipped: 0,
			closedMarketIds: [dueA, dueB].sort(),
		});

		// Exactly 2 market.closed events; both due markets Closed.
		expect((await closedEventRows()).length).toBe(2);
		expect(await marketStatus(dueA)).toBe("Closed");
		expect(await marketStatus(dueB)).toBe("Closed");

		// future-Open untouched: still Open, zero events.
		expect(await marketStatus(future)).toBe("Open");
		expect((await eventRowsForAggregate(future)).length).toBe(0);

		// The Closed fixture untouched: never selected, zero events.
		expect(await marketStatus(alreadyClosed)).toBe("Closed");
		expect((await eventRowsForAggregate(alreadyClosed)).length).toBe(0);
	});

	it("market-close::C5-sweep-idempotent", async () => {
		const marketId = await seedMarket("placeholder-c5-due", "Open", DEADLINE);

		const first = await closeDueMarkets({
			now: SWEEP_NOW,
			metadata: adminMetadata("W-4-sweep"),
		});
		expect(first).toEqual({
			closed: 1,
			skipped: 0,
			closedMarketIds: [marketId],
		});

		// Immediate re-run: nothing due, nothing skipped, no new event.
		const second = await closeDueMarkets({
			now: SWEEP_NOW,
			metadata: adminMetadata("W-4-sweep"),
		});
		expect(second).toEqual({ closed: 0, skipped: 0, closedMarketIds: [] });

		expect((await closedEventRows()).length).toBe(1);
	});
});
