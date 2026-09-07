import { eq } from "drizzle-orm";
import { v7 as uuidv7 } from "uuid";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@sentry/nextjs", () => ({
	captureMessage: vi.fn(),
	addBreadcrumb: vi.fn(),
	captureException: vi.fn(),
}));

// ENGINE.15 S1 wire-surface session-mock recipe (charter §SESSION-MOCK) — see
// markets.test.ts for the rationale. Inert at S1, load-bearing for S2-green.
const { mockCookiesGet, mockHeadersGet } = vi.hoisted(() => ({
	mockCookiesGet: vi.fn(),
	mockHeadersGet: vi.fn(),
}));

vi.mock("next/headers", () => ({
	cookies: () => ({
		get: mockCookiesGet,
		set: vi.fn(),
		delete: vi.fn(),
	}),
	headers: () => ({
		get: mockHeadersGet,
	}),
}));

vi.mock("next/cache", () => ({
	revalidatePath: vi.fn(),
	revalidateTag: vi.fn(),
}));

import { events, markets, pools } from "@/db/schema";
import { seedPoolAction } from "@/server/admin/markets/seed";
import { canonicalizeAmount18 } from "@/server/admin/wire";
import { CpmmDecimal } from "@/server/cpmm/decimal";
import {
	MarketDeadlineInPastError,
	MarketLifecycleStateError,
	MarketSeedInvalidError,
} from "@/server/markets/errors";
import { openMarket } from "@/server/markets/open";

import { testClient, testDb } from "../../db/_fixtures/db";
import { truncateTables } from "../../db/_fixtures/truncate";

const ADMIN_COOKIE_NAME = "zugzwang_admin_session";

async function withAdminSession(): Promise<string> {
	const sessionId = uuidv7();
	await testClient.unsafe(
		`INSERT INTO admin_sessions (session_id, issued_at, last_seen_at) VALUES ($1, now(), now())`,
		[sessionId],
	);
	mockCookiesGet.mockReturnValue({
		name: ADMIN_COOKIE_NAME,
		value: sessionId,
	});
	return sessionId;
}

function withoutAdminSession(): void {
	mockCookiesGet.mockReturnValue(undefined);
}

// ENGINE.14 §5.6 tests-first (S1, plan §Test plan charter) — the F-ADMIN-2
// seed/open acceptance home (P1–P5). DB-BACKED (local Postgres :54322).
//
// ⚠ AMENDED BY LIQ-1 PHASE 1 · T3b (ADR-0047 §B; plan §4 T3/T3b). ENGINE.14's
// carry-forward 2 — "y₀ = n₀, symmetric by code shape" — is SUPERSEDED. The
// admin no longer names one seed scalar; it names an OPENING PRICE and a TANK,
// and `openMarket` writes two DIFFERENT reserves:
//
//     yes = (1 − p) · T ,  no = p · T        p = openingPriceYes ∈ (0,1)
//
// The two symmetric assertions ENGINE.14 left behind (the `:185` exact payload
// equality and the P4 "Carry-forward 2 (Y₀ = N₀)" block) are INVERTED here
// rather than deleted, per plan §4 T3 — a regression to symmetric reserves must
// REDDEN, and a deleted assertion cannot redden.
//
// ⚠ DIRECTION. A side's price is proportional to the OPPOSITE reserve
// (calculate.ts:36-37), so p_yes = 0.10 means the YES reserve is the LARGE one:
// 90,000 / 10,000 at T = 100,000. Both orderings type-check and both make a
// valid pool; getting it backwards opens every market on the platform at 90%
// YES with nothing to error on (plan §9 R2).
//
// Contract pins (plan §Flows + R-14.1 + D-14.c/f + L-E9.3 + contract §4):
//   - W-4 locked branch, expectedStatus ['Draft']: ONE tx inserts the
//     ASYMMETRIC pools row, flips Draft → Open, and emits market.opened with
//     the SEVEN-key payload { marketId, yesReserves, noReserves,
//     openingPriceYes, backingMinted, discardedYes, discardedNo };
//   - NO eventId parameter — minted internally ONCE at service entry;
//   - `tank` keeps SEED_RE / ZERO_SEED_RE; a new PRICE_RE rejects any
//     openingPriceYes outside the OPEN interval (0,1) at the BOUNDARY — 0 and 1
//     each produce a zero reserve, and requirePositive would then throw from
//     INSIDE the transaction instead;
//   - every quantity is an exact-decimal STRING end to end (numericString > 0,
//     scale ≤ 18); string identity asserted with toBe, never closeness;
//   - openMarket rejects now ≥ resolution_deadline (D-14.c);
//   - NO dharma_ledger row, ever (R-14.1 / R-2 — not re-asserted here; the
//     conservation suites own it).

const SEED = "100.000000000000000000";

// D-14's own open, and the numbers plan §2 tabulates.
const OPENING_PRICE_YES = "0.100000000000000000";
const TANK = "100000.000000000000000000";
const YES_RESERVES = "90000.000000000000000000";
const NO_RESERVES = "10000.000000000000000000";
const BACKING_MINTED = "90000.000000000000000000";
const DISCARDED_YES = "0.000000000000000000";
const DISCARDED_NO = "80000.000000000000000000";

// A second, differently-skewed open for P4 — so the inverted pin is not
// satisfiable by a hardcoded 90,000/10,000.
const TANK_1000 = "1000.000000000000000000";
const P4_PRICE = "0.250000000000000000";
const P4_YES = "750.000000000000000000";
const P4_NO = "250.000000000000000000";
const P4_BACKING = "750.000000000000000000";
const P4_DISCARDED_NO = "500.000000000000000000";
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
		await truncateTables(testClient, ["events", "pools", "markets"]);
		vi.clearAllMocks();
	});

	it("pool-seed::P1-seed-flow-and-state-transition", async () => {
		const marketId = await seedMarket("placeholder-p1-seed", "Draft");

		const result = await openMarket({
			marketId,
			openingPriceYes: OPENING_PRICE_YES,
			tank: TANK,
			now: NOW,
			metadata: adminMetadata("F-ADMIN-2"),
		});

		// Status flipped Draft → Open.
		expect(await marketStatus(marketId)).toBe("Open");

		// Exactly ONE pools row; ASYMMETRIC reserves — (1−p)·T on YES, p·T on
		// NO, summing to the tank exactly.
		const poolRows = await poolRowsFor(marketId);
		expect(poolRows.length).toBe(1);
		expect(poolRows[0]?.yesReserves).toBe(YES_RESERVES);
		expect(poolRows[0]?.noReserves).toBe(NO_RESERVES);
		// THE INVERSION of ENGINE.14 carry-forward 2. Left as a standalone
		// assertion on purpose: the two `toBe`s above would still pass if a
		// future edit made both constants equal, and this one would not.
		expect(poolRows[0]?.yesReserves).not.toBe(poolRows[0]?.noReserves);

		// Exactly ONE market.opened events row; payload EXACT — the SEVEN-key
		// new variant (ADR-0047 §B / contract §2). `toEqual` on the whole object
		// is the pin: an extra key, a missing key, or a lingering `seedAmount`
		// all redden. Admin actor metadata (R-14.5).
		const eventRows = await testDb
			.select({
				eventId: events.eventId,
				payload: events.payload,
				metadata: events.metadata,
			})
			.from(events)
			.where(eq(events.eventType, "market.opened"));
		expect(eventRows.length).toBe(1);
		expect(eventRows[0]?.payload).toEqual({
			marketId,
			yesReserves: YES_RESERVES,
			noReserves: NO_RESERVES,
			openingPriceYes: OPENING_PRICE_YES,
			backingMinted: BACKING_MINTED,
			discardedYes: DISCARDED_YES,
			discardedNo: DISCARDED_NO,
		});
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
			yesReserves: YES_RESERVES,
			noReserves: NO_RESERVES,
			openingPriceYes: OPENING_PRICE_YES,
			backingMinted: BACKING_MINTED,
			discardedYes: DISCARDED_YES,
			discardedNo: DISCARDED_NO,
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
			openingPriceYes: OPENING_PRICE_YES,
			tank: TANK,
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
			openingPriceYes: OPENING_PRICE_YES,
			tank: TANK,
			now: NOW,
			metadata: adminMetadata("F-ADMIN-2"),
		}).catch((e: unknown) => e);
		expect(caught).toBeInstanceOf(MarketLifecycleStateError);

		expect((await poolRowsFor(marketId)).length).toBe(0);
		expect((await allEventRows()).length).toBe(0);
	});

	it("pool-seed::P3-rejects-invalid-tank", async () => {
		// Four invalid tanks in sequence on ONE Draft fixture: zero, negative,
		// 19-dp scale, malformed — each MarketSeedInvalidError, nothing written.
		// SEED_RE / ZERO_SEED_RE keep guarding this argument; only its NAME moves.
		const marketId = await seedMarket("placeholder-p3-tank", "Draft");

		for (const bad of ["0", "-5", "1.0000000000000000001", "abc"]) {
			const caught = await openMarket({
				marketId,
				openingPriceYes: OPENING_PRICE_YES,
				tank: bad,
				now: NOW,
				metadata: adminMetadata("F-ADMIN-2"),
			}).catch((e: unknown) => e);
			expect(caught).toBeInstanceOf(MarketSeedInvalidError);
		}

		expect((await poolRowsFor(marketId)).length).toBe(0);
		expect((await allEventRows()).length).toBe(0);
		expect(await marketStatus(marketId)).toBe("Draft");

		// ⛔ POSITIVE CONTROL, and it is the whole reason this test is not
		// vacuous. Every rejection above is ALSO produced by an `openMarket` that
		// simply does not know what a `tank` is — so without an accept case the
		// four `toBeInstanceOf`s certify a guard they never exercised. A VALID
		// tank must OPEN.
		const control = await seedMarket("placeholder-p3-tank-ok", "Draft");
		await openMarket({
			marketId: control,
			openingPriceYes: OPENING_PRICE_YES,
			tank: TANK,
			now: NOW,
			metadata: adminMetadata("F-ADMIN-2"),
		});
		expect(await marketStatus(control)).toBe("Open");
	});

	it("pool-seed::P3b-rejects-opening-price-outside-the-open-interval", async () => {
		// PRICE_RE + the zero check (contract §4): p ∈ (0,1), OPEN at both ends.
		// `0` and `1` are rejected because either produces a ZERO reserve, and
		// `requirePositive` throughout calculate.ts would then throw from INSIDE
		// the W-4 transaction rather than at the boundary — an economics bug
		// wearing a lifecycle error's clothes.
		const marketId = await seedMarket("placeholder-p3b-price", "Draft");

		for (const bad of ["0", "1", "1.0", "2", "0.000000000000000000"]) {
			const caught = await openMarket({
				marketId,
				openingPriceYes: bad,
				tank: TANK,
				now: NOW,
				metadata: adminMetadata("F-ADMIN-2"),
			}).catch((e: unknown) => e);
			expect(caught).toBeInstanceOf(MarketSeedInvalidError);
		}

		expect((await poolRowsFor(marketId)).length).toBe(0);
		expect((await allEventRows()).length).toBe(0);
		expect(await marketStatus(marketId)).toBe("Draft");

		// The guard is at the BOUNDARY, not inside the transaction — proved by
		// ORDERING rather than asserted. This market's deadline has already
		// passed, so the in-transaction D-14.c guard would answer
		// MarketDeadlineInPastError; a boundary guard answers
		// MarketSeedInvalidError first and never opens the transaction at all.
		const expired = await seedMarket("placeholder-p3b-expired", "Draft");
		const caughtExpired = await openMarket({
			marketId: expired,
			openingPriceYes: "1",
			tank: TANK,
			now: new Date("2026-08-02T00:00:00.000Z"),
			metadata: adminMetadata("F-ADMIN-2"),
		}).catch((e: unknown) => e);
		expect(caughtExpired).toBeInstanceOf(MarketSeedInvalidError);
		expect(caughtExpired).not.toBeInstanceOf(MarketDeadlineInPastError);

		// ⛔ POSITIVE CONTROLS at BOTH open-interval edges — the assertions that
		// stop the five rejections above from passing vacuously, and the pin that
		// the interval is OPEN rather than closed at 18-dp resolution.
		const nearZero = await seedMarket("placeholder-p3b-near-zero", "Draft");
		await openMarket({
			marketId: nearZero,
			openingPriceYes: "0.000000000000000001",
			tank: TANK,
			now: NOW,
			metadata: adminMetadata("F-ADMIN-2"),
		});
		expect(await marketStatus(nearZero)).toBe("Open");

		const nearOne = await seedMarket("placeholder-p3b-near-one", "Draft");
		await openMarket({
			marketId: nearOne,
			openingPriceYes: "0.999999999999999999",
			tank: TANK,
			now: NOW,
			metadata: adminMetadata("F-ADMIN-2"),
		});
		expect(await marketStatus(nearOne)).toBe("Open");
	});

	it("pool-seed::P4-asymmetric-seed-pin", async () => {
		// ⚠ THE INVERSION of ENGINE.14's "Carry-forward 2 (Y₀ = N₀)" pin, kept in
		// place rather than deleted so that a regression to symmetric reserves
		// REDDENS here (plan §4 T3). Different price and tank from P1 so the pin
		// cannot be satisfied by a hardcoded 90,000/10,000:
		//   p = 0.25, T = 1,000  ⇒  yes = 750, no = 250, backing = 750, D_no = 500.
		// Both numeric(38,18) reserve readbacks and the market.opened payload are
		// STRING-IDENTICAL at 18 dp (toBe — never numeric closeness).
		const marketId = await seedMarket("placeholder-p4-asym", "Draft");

		await openMarket({
			marketId,
			openingPriceYes: P4_PRICE,
			tank: TANK_1000,
			now: NOW,
			metadata: adminMetadata("F-ADMIN-2"),
		});

		const [poolRow] = await poolRowsFor(marketId);
		expect(poolRow?.yesReserves).toBe(P4_YES);
		expect(poolRow?.noReserves).toBe(P4_NO);
		expect(poolRow?.yesReserves).not.toBe(poolRow?.noReserves);

		const [eventRow] = await testDb
			.select({ payload: events.payload })
			.from(events)
			.where(eq(events.eventType, "market.opened"));
		const payload = eventRow?.payload as {
			seedAmount?: unknown;
			yesReserves?: unknown;
			noReserves?: unknown;
			openingPriceYes?: unknown;
			backingMinted?: unknown;
			discardedYes?: unknown;
			discardedNo?: unknown;
		};
		expect(payload.yesReserves).toBe(P4_YES);
		expect(payload.noReserves).toBe(P4_NO);
		expect(payload.openingPriceYes).toBe(P4_PRICE);
		expect(payload.backingMinted).toBe(P4_BACKING);
		expect(payload.discardedYes).toBe(DISCARDED_YES);
		expect(payload.discardedNo).toBe(P4_DISCARDED_NO);
		// The superseded field is GONE, not merely unread — a payload still
		// carrying `seedAmount` beside the new keys would satisfy every
		// assertion above and quietly keep the legacy reader alive.
		expect(payload.seedAmount).toBeUndefined();

		// The backing identity at open (ADR-0047 §E), read off the row that
		// actually landed: yes + D_yes == no + D_no == backingMinted.
		expect(new CpmmDecimal(P4_YES).plus(DISCARDED_YES).toFixed(18)).toBe(
			P4_BACKING,
		);
		expect(new CpmmDecimal(P4_NO).plus(P4_DISCARDED_NO).toFixed(18)).toBe(
			P4_BACKING,
		);
	});

	it("pool-seed::P5-rejects-expired-deadline-open", async () => {
		// D-14.c: opening a market the sweep would close on its next tick is
		// surfaced, not allowed — now === deadline AND now > deadline reject.
		const marketId = await seedMarket("placeholder-p5-expired", "Draft");

		const caughtEq = await openMarket({
			marketId,
			openingPriceYes: OPENING_PRICE_YES,
			tank: TANK,
			now: FIXTURE_DEADLINE,
			metadata: adminMetadata("F-ADMIN-2"),
		}).catch((e: unknown) => e);
		expect(caughtEq).toBeInstanceOf(MarketDeadlineInPastError);

		const caughtGt = await openMarket({
			marketId,
			openingPriceYes: OPENING_PRICE_YES,
			tank: TANK,
			now: new Date("2026-08-02T00:00:00.000Z"),
			metadata: adminMetadata("F-ADMIN-2"),
		}).catch((e: unknown) => e);
		expect(caughtGt).toBeInstanceOf(MarketDeadlineInPastError);

		expect((await poolRowsFor(marketId)).length).toBe(0);
		expect((await allEventRows()).length).toBe(0);
		expect(await marketStatus(marketId)).toBe("Draft");
	});
});

// ENGINE.15 S1 tests-first (charter file 2) — the `seedPoolAction` wire surface
// (F-ADMIN-2; seed rides Draft → Open, R-14.1, via the `openMarket` service).
// DB-BACKED (:54322).
//
// ⚠ AMENDED BY LIQ-1 PHASE 1 · T4b (plan §4 T4; contract §5). The form now
// posts TWO fields — `openingPriceYes` and `tank` — and BOTH go through
// `canonicalizeAmount18` before the service, exactly as `seedAmount` did
// (CR-3/SA-I-3), so an over-precision value still throws
// MarketSeedInvalidError → `seed_invalid` at the wire with NO silent rounding.
// The ActionResult now reports the two reserves that LANDED rather than the
// value that was typed, so the admin sees the pool, not the input.

// Far-future deadline so the S2-injected `now: new Date()` never trips
// openMarket's `now >= deadline` reject on the wire happy path.
const WIRE_DEADLINE = new Date("2099-01-01T00:00:00.000Z");

async function seedDraftFixture(slug: string): Promise<string> {
	const [market] = await testDb
		.insert(markets)
		.values({
			slug,
			title: "PLACEHOLDER — not a real market",
			description: "PLACEHOLDER criterion — not a real criterion",
			status: "Draft",
			resolutionDeadline: WIRE_DEADLINE,
		})
		.returning({ id: markets.id });
	return market?.id ?? "";
}

async function seedOpenFixtureWithPool(slug: string): Promise<string> {
	const [market] = await testDb
		.insert(markets)
		.values({
			slug,
			title: "PLACEHOLDER — not a real market",
			description: "PLACEHOLDER criterion — not a real criterion",
			status: "Open",
			resolutionDeadline: WIRE_DEADLINE,
		})
		.returning({ id: markets.id });
	const marketId = market?.id ?? "";
	await testDb.insert(pools).values({
		marketId,
		yesReserves: SEED,
		noReserves: SEED,
	});
	return marketId;
}

function seedFormData(
	marketId: string,
	openingPriceYes: string,
	tank: string,
): FormData {
	const fd = new FormData();
	fd.append("marketId", marketId);
	fd.append("openingPriceYes", openingPriceYes);
	fd.append("tank", tank);
	return fd;
}

async function openedEventRows() {
	return testDb
		.select({ eventId: events.eventId, payload: events.payload })
		.from(events)
		.where(eq(events.eventType, "market.opened"));
}

describe("seedPoolAction wire surface", () => {
	beforeEach(() => {
		mockCookiesGet.mockReset();
		mockHeadersGet.mockReset();
	});

	afterEach(async () => {
		await truncateTables(testClient, [
			"events",
			"pools",
			"markets",
			"admin_sessions",
		]);
		vi.clearAllMocks();
	});

	it("seed-pool::happy-path-draft-to-open-canonical-payload", async () => {
		await withAdminSession();
		const marketId = await seedDraftFixture("wire-seed-happy");

		// Loose forms "0.1" and "100000" must BOTH canonicalize to 18 dp before
		// openMarket — one canonicalizer, two fields.
		const result = await seedPoolAction(
			seedFormData(marketId, "0.1", "100000"),
		);

		expect(result.ok).toBe(true);
		if (!result.ok) throw new Error("unreachable — asserted ok above");
		expect(typeof result.data.poolId).toBe("string");
		// The DTO reports what LANDED — the two reserves — not the two numbers
		// the admin typed. Seeing 90,000/10,000 come back is the admin's only
		// confirmation that the direction is the one they meant.
		expect(result.data.yesReserves).toBe(YES_RESERVES);
		expect(result.data.noReserves).toBe(NO_RESERVES);

		// Market flipped Draft → Open.
		expect(await marketStatus(marketId)).toBe("Open");

		// market.opened payload carries the CANONICAL 18-dp strings (CR-3).
		const eventRows = await openedEventRows();
		expect(eventRows.length).toBe(1);
		expect(eventRows[0]?.payload).toEqual({
			marketId,
			yesReserves: YES_RESERVES,
			noReserves: NO_RESERVES,
			openingPriceYes: OPENING_PRICE_YES,
			backingMinted: BACKING_MINTED,
			discardedYes: DISCARDED_YES,
			discardedNo: DISCARDED_NO,
		});

		// …and the pool row matches the DTO exactly (the DTO is a report of the
		// row, never a second derivation of it).
		const poolRows = await poolRowsFor(marketId);
		expect(poolRows[0]?.yesReserves).toBe(result.data.yesReserves);
		expect(poolRows[0]?.noReserves).toBe(result.data.noReserves);
	});

	it("seed-pool::rejects-double-seed-with-market-not-draft", async () => {
		await withAdminSession();
		// An Open fixture already carries its pool — double-seed must reject.
		const marketId = await seedOpenFixtureWithPool("wire-seed-double");

		const result = await seedPoolAction(
			seedFormData(marketId, "0.1", "100000"),
		);

		expect(result.ok).toBe(false);
		if (result.ok) throw new Error("unreachable — asserted not-ok above");
		expect(result.error.code).toBe("market_not_draft");

		// Still exactly the ONE pre-seeded pool; no new opened event.
		expect((await poolRowsFor(marketId)).length).toBe(1);
		expect((await openedEventRows()).length).toBe(0);
	});

	it("seed-pool::rejects-over-18dp-seed-with-seed-invalid", async () => {
		await withAdminSession();
		const marketId = await seedDraftFixture("wire-seed-19dp");

		// 19 fractional digits on the TANK — rejected at the wire (pre-service),
		// seed_invalid, no rounding (money never rounds at the wire).
		const tankResult = await seedPoolAction(
			seedFormData(marketId, "0.1", "1.2345678901234567891"),
		);
		expect(tankResult.ok).toBe(false);
		if (tankResult.ok) throw new Error("unreachable — asserted not-ok above");
		expect(tankResult.error.code).toBe("seed_invalid");

		// …and the SAME on the PRICE. Both fields go through
		// canonicalizeAmount18; a wire that canonicalizes one and passes the
		// other through raw would land an un-canonicalized price in an
		// append-only event row.
		const priceResult = await seedPoolAction(
			seedFormData(marketId, "0.1234567890123456789", "100000"),
		);
		expect(priceResult.ok).toBe(false);
		if (priceResult.ok) throw new Error("unreachable — asserted not-ok above");
		expect(priceResult.error.code).toBe("seed_invalid");

		// Nothing written by either: still Draft, no pool, no event.
		expect(await marketStatus(marketId)).toBe("Draft");
		expect((await poolRowsFor(marketId)).length).toBe(0);
		expect((await openedEventRows()).length).toBe(0);
	});

	it("seed-pool::tiny-tank-is-seed-invalid-not-an-internal-error", async () => {
		// ⛔ THE POINT IS THE ERROR CODE, NOT THE REFUSAL. `p = 1e-18` over a
		// tank of 0.5 floors the NO reserve to zero, so `openingReserves` throws
		// `CpmmInputError` — correctly. But that pair passes EVERY guard above it:
		// `canonicalizeAmount18`, `PRICE_RE` and `SEED_RE` all accept both values.
		// Before the `CpmmInputError` arm in `toActionError` the throw fell
		// through to `error_internal` AND fired the Sentry capture reserved for
		// unrecognised errors, reporting a valid-shaped admin input as a wire bug.
		// O-3: a true refusal reported with a false cause is a defect.
		await withAdminSession();
		const marketId = await seedDraftFixture("wire-seed-tiny-tank");

		const result = await seedPoolAction(
			seedFormData(marketId, "0.000000000000000001", "0.5"),
		);

		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error.code).toBe("seed_invalid");
		expect(result.error.code).not.toBe("error_internal");

		// The market must be untouched — the throw happens before the W-4
		// transaction opens, so there is no partial write to roll back.
		expect(await marketStatus(marketId)).toBe("Draft");
		expect((await poolRowsFor(marketId)).length).toBe(0);
		expect((await openedEventRows()).length).toBe(0);
	});

	it("seed-pool::rejects-without-admin-session", async () => {
		withoutAdminSession();
		const marketId = await seedDraftFixture("wire-seed-no-session");

		const result = await seedPoolAction(
			seedFormData(marketId, "0.1", "100000"),
		);

		expect(result.ok).toBe(false);
		if (result.ok) throw new Error("unreachable — asserted not-ok above");
		expect(result.error.code).toBe("admin_session_required");

		expect(await marketStatus(marketId)).toBe("Draft");
		expect((await poolRowsFor(marketId)).length).toBe(0);
		expect((await openedEventRows()).length).toBe(0);
	});
});

// ENGINE.15 S1 tests-first (charter file 2) — `canonicalizeAmount18` DIRECT
// unit (no DB, no session). Encodes EVERY row of the §State×Action
// `canonicalizeAmount18` worked table LITERALLY. The S1 stub returns its input
// UNCHANGED and never throws, so: valid rows are RED on the wrong (un-
// canonicalized) output; reject rows are RED on the missing throw. S2
// implements the real canonicalizer (returns `^[0-9]+\.[0-9]{18}$`; throws
// MarketSeedInvalidError on invalid — no rounding, money never rounds at the
// wire).
describe("canonicalizeAmount18", () => {
	it("canonicalize-amount18::pads-integer-to-18-dp", () => {
		expect(canonicalizeAmount18("100")).toBe("100.000000000000000000");
	});

	it("canonicalize-amount18::pads-fraction-to-18-dp", () => {
		expect(canonicalizeAmount18("0.5")).toBe("0.500000000000000000");
	});

	it("canonicalize-amount18::strips-leading-zeros-and-pads", () => {
		expect(canonicalizeAmount18("01.50")).toBe("1.500000000000000000");
	});

	it("canonicalize-amount18::passes-exact-18-dp-unchanged", () => {
		expect(canonicalizeAmount18("1.234567890123456789")).toBe(
			"1.234567890123456789",
		);
	});

	it("canonicalize-amount18::rejects-19-dp-no-rounding", () => {
		expect(() => canonicalizeAmount18("1.2345678901234567891")).toThrow(
			MarketSeedInvalidError,
		);
	});

	for (const bad of ["-5", "0", "", "1e3", "1."]) {
		it(`canonicalize-amount18::rejects-${bad === "" ? "empty" : bad}`, () => {
			expect(() => canonicalizeAmount18(bad)).toThrow(MarketSeedInvalidError);
		});
	}
});
