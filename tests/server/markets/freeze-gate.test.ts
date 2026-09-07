import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@sentry/nextjs", () => ({
	captureMessage: vi.fn(),
	addBreadcrumb: vi.fn(),
	captureException: vi.fn(),
}));

// `openMarket` calls `revalidateTag` post-commit. ONLY the framework shell is
// mocked (ADR-0036 primitive 3): the W-4 transaction, the pools INSERT, the
// status flip and the event emission are all REAL, which is the whole point of
// the "writes nothing" half below.
vi.mock("next/cache", () => ({
	revalidatePath: vi.fn(),
	revalidateTag: vi.fn(),
	cacheTag: vi.fn(),
	cacheLife: vi.fn(),
}));

import { events, markets, pools } from "@/db/schema";
import { openMarket } from "@/server/markets/open";
import type { LifecycleEventMetadata } from "@/server/markets/transaction";

import { testClient, testDb } from "../../db/_fixtures/db";
import { truncateTables } from "../../db/_fixtures/truncate";

// LIQ-1 Phase 2 · T11 — the `openMarket` freeze gate (plan §3 T11;
// `docs/parked.md` LIQ-1 L-4, ruled; ADR-0047 §Acceptance row "Freeze").
//
// SPEC.2 §20.3 leaves the ADMIN paths ungated on purpose, and
// `tests/server/resolution/freeze-exemption.test.ts` encodes that exemption
// with teeth: the conclusion-event work — finalizing resolutions, last-mile
// moderation — MUST run post-freeze, because a market in flight has to be able
// to finish. `openMarket` is the one admin path where the opposite is true. It
// does not FINISH anything; it STARTS a market, on a system that has declared
// itself read-only, and every consequence of it — a pool, a status, a genesis
// event, and from Phase 2 an injector that will start topping that pool up
// every 60 seconds — outlives the freeze it was created after.
//
// ⚠ SCOPE IS `openMarket` ONLY, and that is a ruling, not an oversight. L-4
// observes that `createMarket` and `closeMarket` are also ungated; neither was
// ruled, and the parked row's owner column says "LIQ-1 Phase 2 — lands with it"
// for L-4 and nothing else. Widening this to the other lifecycle flows would
// also catch the resolution paths' DELIBERATE exemption, which is why
// `freeze-exemption.test.ts` is this file's negative control: it must stay green
// untouched, and if it reds the gate went in one layer too low (in
// `runLifecycleTransaction`, say, instead of in `openMarket`).
//
// ⚠ PLACEMENT IS PART OF THE CONTRACT AND IS ASSERTED BEHAVIOURALLY. Plan §3
// T11: the read is `system_state` on `tx`, INSIDE the W-4 transaction, after
// the markets lock — never `isFrozen()`, whose own docblock says it is "a
// plain, NON-LOCKING read … must NOT enter the W-1/W-3/W-4 lock order" because
// it opens its own connection off the top-level `db`. The "writes nothing"
// assertions below are what make that testable from the outside: a gate placed
// correctly leaves no pool row, no status flip and no event, and so does a gate
// placed at entry — but only a gate inside the transaction can also be correct
// under a concurrent freeze, and the rollback assertions are what a later
// reader checks that against.
//
// ⛔ THE ERROR IS ASSERTED BY `name`, NOT BY AN IMPORTED CLASS, AND THAT IS
// DELIBERATE. `MarketFrozenError` does not exist on `@/server/markets/errors`
// yet. Importing it would make this file fail at COLLECTION — the repo's usual
// greenfield-import posture — and the collection error would then MASK the
// behavioural RED that is the actual finding: today `openMarket` succeeds with
// `frozen_at` committed. `name` is a first-class pin here anyway, because every
// error class in `markets/errors.ts` sets `this.name` explicitly (the ES2017
// subclassing note in that file), so this is as strong as `instanceof` for the
// property being claimed and it keeps the diagnosis visible. Surfaced in the
// test-writer return rather than silently chosen.
//
// DB-BACKED (local Postgres :54322). FIX-1 reset: the §6.3 once-only trigger
// rejects `frozen_at timestamp→NULL`, so the per-test reset of `system_state`
// is TRUNCATE + reseed, exactly as `freeze-exemption.test.ts` does it.

const OPENING_PRICE_YES = "0.1";
const TANK = "100000.000000000000000000";
/** D-14's own open at that price and tank — 90,000 / 10,000. */
const EXPECTED_YES = "90000.000000000000000000";
const EXPECTED_NO = "10000.000000000000000000";

const NOW = new Date("2026-07-01T00:00:00.000Z");
const DEADLINE = new Date("2026-08-01T00:00:00.000Z");
/** The conclusion freeze instant (CLAUDE.md §3 / SPEC.2 §20.3). */
const FROZEN_AT = "2026-11-05T23:59:00Z";

function adminMetadata(): LifecycleEventMetadata {
	return {
		request_id: "test-liq1-freeze-gate",
		flow_id: "F-ADMIN-2",
		user_id: null,
		actor_id: "admin-singleton",
		idempotency_key: null,
		ip: "test",
		user_agent: "vitest",
	};
}

async function seedDraftMarket(slug: string): Promise<string> {
	const [market] = await testDb
		.insert(markets)
		.values({
			slug,
			title: "PLACEHOLDER — not a real market",
			description: "PLACEHOLDER criterion — not a real criterion",
			status: "Draft",
			resolutionDeadline: DEADLINE,
		})
		.returning({ id: markets.id });
	return market?.id ?? "";
}

/** Commit the conclusion freeze — a single NULL→timestamp on the singleton,
 * which is the ONE transition Bucket B permits on this column. */
async function freezeSystem(): Promise<void> {
	await testClient.unsafe(
		`UPDATE system_state SET frozen_at = $1 WHERE id = 'system'`,
		[FROZEN_AT],
	);
}

/** The three writes `openMarket` makes, read back as one post-state. */
async function writesFor(marketId: string): Promise<{
	status: string | undefined;
	poolRows: number;
	openedEvents: number;
}> {
	const [marketRow] = await testDb
		.select({ status: markets.status })
		.from(markets)
		.where(eq(markets.id, marketId));
	const poolRows = await testDb
		.select({ id: pools.id })
		.from(pools)
		.where(eq(pools.marketId, marketId));
	const openedEvents = await testDb
		.select({ eventId: events.eventId })
		.from(events)
		.where(eq(events.aggregateId, marketId));
	return {
		status: marketRow?.status,
		poolRows: poolRows.length,
		openedEvents: openedEvents.length,
	};
}

describe("markets/open — the conclusion-freeze gate (LIQ-1 T11 / L-4)", () => {
	afterEach(async () => {
		await truncateTables(testClient, ["events", "pools", "markets"]);
		// `frozen_at` cannot go back to NULL by UPDATE (the §6.3 once-only
		// trigger), so the singleton is TRUNCATEd — BEFORE TRUNCATE carries no
		// trigger on this column — and reseeded pre-freeze.
		await truncateTables(testClient, ["system_state"]);
		await testClient.unsafe(
			`INSERT INTO system_state (id, frozen_at) VALUES ('system', NULL)`,
		);
		vi.clearAllMocks();
	});

	it("freeze-gate::open-refuses-and-writes-nothing-when-frozen", async () => {
		const marketId = await seedDraftMarket("freeze-gate-refused");
		expect(marketId).not.toBe("");

		// Control: the market is a clean Draft with nothing attached BEFORE the
		// call, so every absence asserted afterwards is a fact about the refusal
		// and not the resting state of the tables.
		expect(await writesFor(marketId)).toEqual({
			status: "Draft",
			poolRows: 0,
			openedEvents: 0,
		});

		await freezeSystem();
		// The freeze is really committed — asserted, because a silently-failed
		// UPDATE would make the rejection below unreachable and the whole case
		// would pass by never testing anything.
		const frozen = await testClient.unsafe(
			`SELECT frozen_at FROM system_state WHERE id = 'system'`,
		);
		expect(frozen[0]?.frozen_at).not.toBeNull();

		// THE assertion: it refuses.
		await expect(
			openMarket({
				marketId,
				openingPriceYes: OPENING_PRICE_YES,
				tank: TANK,
				now: NOW,
				metadata: adminMetadata(),
			}),
		).rejects.toMatchObject({ name: "MarketFrozenError" });

		// ⛔ AND THE HALF THAT IS THE POINT: IT WROTE NOTHING. A gate that threw
		// after the pools INSERT — or one placed post-commit beside
		// `revalidateTag`, four lines down in a function that already does
		// exactly that with a different call, so it reads as tidying — would
		// satisfy "it throws" while leaving a market at `Open` with a pool
		// behind it and no way back: `Draft → Open` has no reverse edge, and the
		// genesis event is append-only. The refusal has to be a rollback, not an
		// apology.
		expect(await writesFor(marketId)).toEqual({
			status: "Draft",
			poolRows: 0,
			openedEvents: 0,
		});
	});

	it("freeze-gate::open-succeeds-when-not-frozen", async () => {
		// ⭐ THE POSITIVE CONTROL. Everything in the case above is an absence, and
		// absences are also what a broken fixture produces: a bad tank, a deadline
		// in the past, a missing admin actor, a wedged connection. This is the arm
		// that proves the refusal above was caused by the FREEZE and by nothing
		// else about this fixture.
		const marketId = await seedDraftMarket("freeze-gate-allowed");

		const frozen = await testClient.unsafe(
			`SELECT frozen_at FROM system_state WHERE id = 'system'`,
		);
		expect(frozen[0]?.frozen_at).toBeNull();

		const result = await openMarket({
			marketId,
			openingPriceYes: OPENING_PRICE_YES,
			tank: TANK,
			now: NOW,
			metadata: adminMetadata(),
		});

		expect(result.status).toBe("Open");
		// D-14's reserves, pinned — a gate wired into the wrong branch could
		// leave the market openable and change what it opens WITH.
		expect(result.yesReserves).toBe(EXPECTED_YES);
		expect(result.noReserves).toBe(EXPECTED_NO);

		expect(await writesFor(marketId)).toEqual({
			status: "Open",
			poolRows: 1,
			openedEvents: 1,
		});
	});

	it("freeze-gate::the-gate-reads-committed-state-not-a-cached-flag", async () => {
		// The same market, both sides of the freeze, in ONE test. The gate is a
		// read of `system_state` on the transaction handle (plan §3 T11), so it
		// must observe a freeze committed by another session between two calls —
		// which is the production shape: the freeze lands once, out of band, and
		// nothing redeploys after it.
		//
		// ⛔ WHAT THIS CATCHES THAT THE TWO CASES ABOVE DO NOT: a gate read at
		// MODULE LOAD, or memoised on first call, passes both of them (they run
		// in separate tests with a fresh reset between) and fails here. It also
		// catches `isFrozen()` being used after all, since that helper opens its
		// own connection off the top-level `db` — which would still see the
		// commit, but is the call plan §3 T11 forbids for lock-order reasons, and
		// a session that reaches for it will have to explain this case's presence.
		const first = await seedDraftMarket("freeze-gate-before");
		const second = await seedDraftMarket("freeze-gate-after");

		const opened = await openMarket({
			marketId: first,
			openingPriceYes: OPENING_PRICE_YES,
			tank: TANK,
			now: NOW,
			metadata: adminMetadata(),
		});
		expect(opened.status).toBe("Open");

		await freezeSystem();

		await expect(
			openMarket({
				marketId: second,
				openingPriceYes: OPENING_PRICE_YES,
				tank: TANK,
				now: NOW,
				metadata: adminMetadata(),
			}),
		).rejects.toMatchObject({ name: "MarketFrozenError" });

		// The already-open market is UNTOUCHED — the gate refuses new opens, it
		// does not reach back. INV-4's neighbourhood: nothing about a market that
		// opened legitimately changes because the system later froze.
		expect(await writesFor(first)).toEqual({
			status: "Open",
			poolRows: 1,
			openedEvents: 1,
		});
		expect(await writesFor(second)).toEqual({
			status: "Draft",
			poolRows: 0,
			openedEvents: 0,
		});
	});
});
