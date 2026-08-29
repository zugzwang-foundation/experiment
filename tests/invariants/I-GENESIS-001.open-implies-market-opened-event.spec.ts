import { v7 as uuidv7 } from "uuid";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@sentry/nextjs", () => ({
	captureMessage: vi.fn(),
	addBreadcrumb: vi.fn(),
	captureException: vi.fn(),
}));

// `openMarket` calls `revalidateTag` post-commit and `assertAdminActor` up
// front. Only the framework shell is mocked — the transaction, the pools INSERT,
// the status flip and the event emission are all REAL, which is the whole point
// of arm 3 below (ADR-0036 primitive 3: never mock anything that writes a row).
const { mockCookiesGet } = vi.hoisted(() => ({ mockCookiesGet: vi.fn() }));
vi.mock("next/headers", () => ({
	cookies: () => ({ get: mockCookiesGet, set: vi.fn(), delete: vi.fn() }),
	headers: () => ({ get: vi.fn() }),
}));
vi.mock("next/cache", () => ({
	revalidatePath: vi.fn(),
	revalidateTag: vi.fn(),
}));

import { events, markets } from "@/db/schema";
import { openMarket } from "@/server/markets/open";

import { testClient, testDb } from "../db/_fixtures/db";
import { truncateTables } from "../db/_fixtures/truncate";

// I-GENESIS-001 canonical (MINTED by CHART-3): EVERY market in status `Open`
// carries a `market.opened` event.
//
// SPEC.1 §17 row proved here:
//   markets::open-implies-market-opened-event
//
// ⭐ WHY THIS EXISTS, AND WHY IT IS WORTH MORE THAN THE FEATURE IT CAME FROM.
// The §9 price chart replays a market's reserve walk from the `seedAmount` on
// its `market.opened` event. No event, no seed, no walk — `replayReserveSeries`
// returns `[]` and the surface renders NOTHING. That is the entire failure
// signature: a blank rectangle, which is indistinguishable from a market nobody
// has bet on. It cost two diagnostic sessions to name, on staging, where all
// eight markets are in exactly this state because they reached `Open` outside
// the product — hand-authored, by a generator that is not in this repository.
//
// The product cannot produce this state: `createMarketAction` emits
// `market.created` and leaves a `Draft`; `seedPoolAction` → `openMarket` is the
// ONLY path to `Open`, and it emits `market.opened` inside the same W-4
// transaction that flips the status. So the property is true by construction —
// and a property that is true by construction, with no test, is a property that
// stays true until someone writes a migration, restores a snapshot, or fixes a
// status by hand at 2am. Then it is false, and the only thing that reports it is
// a missing picture.
//
// ⇒ This spec converts an operational hazard nobody can see into a named test.
// CHART-GATE-1 called it the single highest-value pre-launch item, ahead of the
// chart it was found through, and that ranking is right: the chart is one
// surface, and the genesis event is the seed of every reserve derivation the
// product has.
//
// ⛔ THERE IS NO STORAGE-LAYER BACKSTOP, AND THAT IS A DELIBERATE ABSENCE.
// Unlike I-GRANT-ONCE-001 (a unique partial index) or I-APPEND-ONLY-001 (a
// trigger), nothing in Postgres enforces this: a cross-row, cross-table
// implication over an append-only partitioned ledger is not expressible as a
// CHECK, and a trigger that read `events` on every `markets` UPDATE would put a
// partition scan on the lifecycle write path. CHART-3 was also fenced from DDL.
// So this spec IS the enforcement, and it is a RULE test in the I-LOT-SUM-001
// sense: it seeds its own rows into the local ephemeral Postgres and proves the
// PREDICATE, observing no live environment. ⚠ A live-database run of the same
// predicate is OWED and belongs with the staging gates, which already carry a
// broader sibling (`gates.staging.test.ts` G1.4, non-Draft ⇒ market.opened) —
// but that runner is excluded from `vitest run` and points at staging, so it
// guards nothing in CI. This does.

const FIXTURE_DEADLINE = new Date("2026-12-01T00:00:00.000Z");
const NOW = new Date("2026-07-01T00:00:00.000Z");
const SEED = "1000.000000000000000000";

/**
 * ⭐ THE INVARIANT, as one storage-layer predicate. Every arm below runs THIS
 * query — the violating arm, the two clean arms and the scope arm — so no arm
 * can pass against a differently-worded check than the one that failed.
 */
async function openMarketsMissingGenesis(): Promise<string[]> {
	const rows = await testClient.unsafe(`
		SELECT m.slug
		  FROM markets m
		 WHERE m.status = 'Open'
		   AND NOT EXISTS (
			SELECT 1 FROM events e
			 WHERE e.aggregate_type = 'market'
			   AND e.aggregate_id = m.id
			   AND e.event_type = 'market.opened'
		   )
		 ORDER BY m.slug`);
	return rows.map((r) => String(r.slug));
}

async function seedMarketRow(
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

async function attachGenesisEvent(marketId: string): Promise<void> {
	await testDb.insert(events).values({
		eventType: "market.opened",
		aggregateType: "market",
		aggregateId: marketId,
		payload: { marketId, seedAmount: SEED },
		payloadVersion: 1,
		metadata: {},
		createdAt: NOW,
	});
}

function adminMetadata() {
	return {
		request_id: "test-chart3-genesis",
		flow_id: uuidv7(),
		user_id: null,
		actor_id: "admin-singleton",
		idempotency_key: null,
		ip: "test",
		user_agent: "vitest",
	};
}

describe("I-GENESIS-001: every Open market carries a market.opened event", () => {
	beforeEach(async () => {
		const sessionId = uuidv7();
		await testClient.unsafe(
			`INSERT INTO admin_sessions (session_id, issued_at, last_seen_at) VALUES ($1, now(), now())`,
			[sessionId],
		);
		mockCookiesGet.mockReturnValue({
			name: "zugzwang_admin_session",
			value: sessionId,
		});
	});

	afterEach(async () => {
		vi.clearAllMocks();
		await truncateTables(testClient, [
			"events",
			"pools",
			"markets",
			"admin_sessions",
		]);
	});

	it("open-implies-market-opened::the-predicate-catches-a-market-that-reached-Open-without-its-event", async () => {
		// ⛔ THE LOAD-BEARING ARM — staging's exact state, reproduced. A
		// fixture-bypass INSERT goes straight past `openMarket`, which is the only
		// way to reach `Open` without the event and is precisely how staging's
		// eight markets got there.
		const marketId = await seedMarketRow("genesis-missing", "Open");
		expect(marketId).not.toBe("");

		// Non-vacuity: the market row really exists and really is Open.
		const status = await testClient.unsafe(
			`SELECT status FROM markets WHERE id = $1`,
			[marketId],
		);
		expect(status[0]?.status).toBe("Open");

		// And it carries NO genesis event — the condition under test, asserted
		// rather than assumed.
		const genesis = await testClient.unsafe(
			`SELECT count(*)::int AS n FROM events
			  WHERE aggregate_id = $1 AND event_type = 'market.opened'`,
			[marketId],
		);
		expect(genesis[0]?.n).toBe(0);

		// THE ASSERTION: the invariant's own predicate reports it, by name.
		expect(await openMarketsMissingGenesis()).toEqual(["genesis-missing"]);
	});

	it("open-implies-market-opened::a-market-opened-through-the-PRODUCT-satisfies-it", async () => {
		// ⭐ THE POSITIVE CONTROL THAT MATTERS. RF-3 requires "a correctly seeded
		// market must pass, or the test proves nothing" — and the strongest form
		// of that is not a hand-built fixture with an event stapled on, it is the
		// real production path. `openMarket` IS `seedPoolAction`'s callee and the
		// only route to `Open`; if it ever stopped emitting the event inside its
		// own transaction, THIS is the arm that reddens.
		const marketId = await seedMarketRow("genesis-through-product", "Draft");

		// Control: a Draft market is not yet in scope, so the predicate is empty
		// BEFORE the call. Without this the assertion after it could be green
		// because the predicate never reports anything at all.
		expect(await openMarketsMissingGenesis()).toEqual([]);

		const result = await openMarket({
			marketId,
			seedAmount: SEED,
			now: NOW,
			metadata: adminMetadata(),
		});
		expect(result.status).toBe("Open");

		// The market really did reach Open — otherwise the predicate is empty for
		// the wrong reason, which is the failure mode this whole file is about.
		const status = await testClient.unsafe(
			`SELECT status FROM markets WHERE id = $1`,
			[marketId],
		);
		expect(status[0]?.status).toBe("Open");

		// THE ASSERTION: no violation, and the event carries the seed the walk
		// needs. A genesis event with the wrong payload would satisfy the
		// predicate and still leave the chart unrenderable.
		expect(await openMarketsMissingGenesis()).toEqual([]);
		const payload = await testClient.unsafe(
			`SELECT payload FROM events
			  WHERE aggregate_id = $1 AND event_type = 'market.opened'`,
			[marketId],
		);
		expect(payload).toHaveLength(1);
		expect(payload[0]?.payload).toMatchObject({ marketId, seedAmount: SEED });
	});

	it("open-implies-market-opened::a-fixture-market-WITH-its-event-is-clean", async () => {
		// The second control, isolating the predicate from `openMarket` entirely:
		// the same violating fixture as arm 1, plus the event, must go clean. This
		// is what proves arm 1's red comes from the MISSING EVENT and not from
		// something else about a hand-inserted market row.
		const marketId = await seedMarketRow("genesis-present", "Open");
		await attachGenesisEvent(marketId);

		expect(await openMarketsMissingGenesis()).toEqual([]);
	});

	it("open-implies-market-opened::the-rule-is-scoped-to-Open-and-is-not-over-broad", async () => {
		// Negative space. The rule is `Open ⇒ market.opened`, not "every market
		// carries one". A `Draft` market legitimately has no genesis event — that
		// is the state `createMarketAction` leaves — and a predicate that flagged
		// it would fire on every correctly-created market and be turned off within
		// a week.
		await seedMarketRow("still-a-draft", "Draft");
		expect(await openMarketsMissingGenesis()).toEqual([]);

		// Carrier: with a violating Open market added alongside, the predicate
		// reports THAT one and only that one. Without this the assertion above is
		// equally consistent with a predicate that reports nothing, ever.
		await seedMarketRow("open-and-broken", "Open");
		expect(await openMarketsMissingGenesis()).toEqual(["open-and-broken"]);
	});
});
