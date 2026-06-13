import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
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
}));

import { events, markets, pools, resolutionEvents } from "@/db/schema";
import { correctResolutionAction } from "@/server/admin/markets/correct";
import { resolveMarketAction } from "@/server/admin/markets/resolve";
import { voidMarketAction } from "@/server/admin/markets/void";
import { ResolutionStateError } from "@/server/resolution/errors";
import { settleMarket } from "@/server/resolution/settle";
import { triggerResolution } from "@/server/resolution/trigger";

import { testClient, testDb } from "../../db/_fixtures/db";

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

// ENGINE.9 §5.6 tests-first (S1, plan §Test plan) — the F-ADMIN-3 trigger
// suite (`resolving-state-then-resolved`). Greenfield value imports from
// `@/server/resolution/{trigger,settle,errors}` RED at collection until
// ENGINE.9 lands. DB-BACKED (local Postgres :54322).
//
// W-3a contract (plan §The four flows):
//   - one tx, expectedStatus ["Closed"], lockPool false;
//   - UPDATE markets → 'Resolving' + ONE `market.resolving` events row,
//     payload = { marketId } ONLY (C-1 — outcome/evidence live on
//     `resolution_events` per R-9.1, never duplicated);
//   - metadata.actor_id 'admin-singleton', metadata.user_id NULL (§3.7);
//   - the trigger writes NO `resolution_events` row (F-ADMIN-3's "Response:
//     Resolution event ID" belongs to the COMPOSED trigger→settle endpoint,
//     ENGINE.10);
//   - off-Closed → ResolutionStateError (the §6.1 graph is the law); the
//     trigger is irreversible (no Resolving→Voided edge — R-9.3).

const SEED_RESERVES = "100.000000000000000000";

type FixtureStatus =
	| "Draft"
	| "Open"
	| "Closed"
	| "Resolving"
	| "Resolved"
	| "Voided"
	| "Frozen";

function adminMetadata(flowId: string) {
	return {
		request_id: "test-admin-resolution",
		flow_id: flowId,
		user_id: null,
		actor_id: "admin-singleton",
		idempotency_key: null,
		ip: "test",
		user_agent: "vitest",
	};
}

async function seedMarketWithPool(
	slug: string,
	status: FixtureStatus,
): Promise<string> {
	const [market] = await testDb
		.insert(markets)
		.values({
			slug,
			title: "Trigger Market",
			status,
			resolutionDeadline: new Date("2026-11-01T00:00:00Z"),
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

describe("ENGINE.9 F-ADMIN-3 — triggerResolution (W-3a)", () => {
	afterEach(async () => {
		await testClient.unsafe(
			`TRUNCATE events, payout_events, resolution_events, dharma_ledger, bets, comments, positions, pools, markets, users CASCADE`,
		);
		vi.clearAllMocks();
	});

	it("admin-resolution::resolving-state-then-resolved", async () => {
		const marketId = await seedMarketWithPool("trigger-happy", "Closed");
		const triggerEventId = uuidv7();

		const result = await triggerResolution({
			marketId,
			triggerEventId,
			metadata: adminMetadata("F-ADMIN-3"),
		});
		expect(result).toEqual({ marketId, status: "Resolving" });

		// Status flipped Closed → Resolving.
		const [marketRow] = await testDb
			.select({ status: markets.status })
			.from(markets)
			.where(eq(markets.id, marketId));
		expect(marketRow?.status).toBe("Resolving");

		// Exactly ONE market.resolving events row; payload is marketId ONLY
		// (C-1); admin actor metadata (§3.7).
		const eventRows = await testDb
			.select({
				eventId: events.eventId,
				eventType: events.eventType,
				aggregateType: events.aggregateType,
				aggregateId: events.aggregateId,
				payload: events.payload,
				metadata: events.metadata,
			})
			.from(events)
			.where(eq(events.eventType, "market.resolving"));
		expect(eventRows.length).toBe(1);
		expect(eventRows[0]?.eventId).toBe(triggerEventId);
		expect(eventRows[0]?.aggregateType).toBe("market");
		expect(eventRows[0]?.aggregateId).toBe(marketId);
		expect(eventRows[0]?.payload).toEqual({ marketId });
		const metadata = eventRows[0]?.metadata as {
			actor_id?: unknown;
			user_id?: unknown;
		};
		expect(metadata.actor_id).toBe("admin-singleton");
		expect(metadata.user_id).toBeNull();

		// The trigger writes NO resolution_events row.
		const resolutionRows = await testDb
			.select({ id: resolutionEvents.id })
			.from(resolutionEvents)
			.where(eq(resolutionEvents.marketId, marketId));
		expect(resolutionRows.length).toBe(0);

		// …then resolved: settle (a SECOND tx, the composed F-ADMIN-3 shape —
		// trigger → settle back-to-back) succeeds from the trigger's Resolving.
		await settleMarket({
			marketId,
			winningSide: "YES",
			reason: "Criterion met; trigger→settle composition.",
			settleEventId: uuidv7(),
			metadata: adminMetadata("F-RESOLVE-1"),
		});
		const [settled] = await testDb
			.select({ status: markets.status })
			.from(markets)
			.where(eq(markets.id, marketId));
		expect(settled?.status).toBe("Resolved");
	});

	for (const status of [
		"Draft",
		"Open",
		"Resolving",
		"Resolved",
		"Voided",
		"Frozen",
	] as const) {
		it(`admin-resolution::trigger-rejected-on-${status.toLowerCase()}`, async () => {
			const marketId = await seedMarketWithPool(
				`trigger-neg-${status.toLowerCase()}`,
				status,
			);

			const caught = await triggerResolution({
				marketId,
				triggerEventId: uuidv7(),
				metadata: adminMetadata("F-ADMIN-3"),
			}).catch((e: unknown) => e);

			expect(caught).toBeInstanceOf(ResolutionStateError);

			// Nothing written: status unchanged, zero events, zero
			// resolution_events.
			const [marketRow] = await testDb
				.select({ status: markets.status })
				.from(markets)
				.where(eq(markets.id, marketId));
			expect(marketRow?.status).toBe(status);
			const eventRows = await testDb
				.select({ eventId: events.eventId })
				.from(events)
				.where(eq(events.aggregateId, marketId));
			expect(eventRows.length).toBe(0);
			const resolutionRows = await testDb
				.select({ id: resolutionEvents.id })
				.from(resolutionEvents)
				.where(eq(resolutionEvents.marketId, marketId));
			expect(resolutionRows.length).toBe(0);
		});
	}

	it("admin-resolution::double-trigger-fails-illegal-edge", async () => {
		// The trigger is irreversible (R-9.3): a second trigger observes
		// Resolving and fails the gate — stranded-Resolving recovery is
		// `settleMarket`, never a re-trigger.
		const marketId = await seedMarketWithPool("trigger-double", "Closed");

		await triggerResolution({
			marketId,
			triggerEventId: uuidv7(),
			metadata: adminMetadata("F-ADMIN-3"),
		});

		const caught = await triggerResolution({
			marketId,
			triggerEventId: uuidv7(),
			metadata: adminMetadata("F-ADMIN-3"),
		}).catch((e: unknown) => e);
		expect(caught).toBeInstanceOf(ResolutionStateError);

		// Still exactly ONE market.resolving event; status still Resolving.
		const eventRows = await testDb
			.select({ eventId: events.eventId })
			.from(events)
			.where(eq(events.eventType, "market.resolving"));
		expect(eventRows.length).toBe(1);
		const [marketRow] = await testDb
			.select({ status: markets.status })
			.from(markets)
			.where(eq(markets.id, marketId));
		expect(marketRow?.status).toBe("Resolving");
	});
});

// ENGINE.15 S1 tests-first (charter file 1) — the composed `resolveMarketAction`
// wire surface (F-ADMIN-3 + F-RESOLVE-1; D-15.c trigger → settle, with the
// Resolving-resume recovery). VALUE import from `@/server/admin/markets/resolve`
// resolves against the S1 stub, which returns { ok: false, error: { code:
// "stub_not_implemented" } } — every envelope assertion below is RED on the
// ASSERTION. S2 wires the composed path. Empty-bet fixtures keep payout/ledger
// math trivial (orderedBets.length === 0 → no payout rows, totalPaidOut 0),
// isolating the WIRE concern (the ENGINE.9 services own the money math).
// DB-BACKED (:54322).

const RESOLVE_REASON = "Criterion met: wire-surface resolve evidence.";
const CORRECT_REASON = "Corrected after review: wire-surface evidence.";
const VOID_REASON = "Voided: wire-surface evidence.";

function resolveFormData(
	marketId: string,
	winningSide: "YES" | "NO",
	reason: string,
): FormData {
	const fd = new FormData();
	fd.append("marketId", marketId);
	fd.append("winningSide", winningSide);
	fd.append("reason", reason);
	return fd;
}

async function eventTypesFor(marketId: string): Promise<string[]> {
	const rows = await testDb
		.select({ eventType: events.eventType })
		.from(events)
		.where(eq(events.aggregateId, marketId));
	return rows.map((r) => r.eventType);
}

async function marketStatusOf(marketId: string): Promise<string | undefined> {
	const [row] = await testDb
		.select({ status: markets.status })
		.from(markets)
		.where(eq(markets.id, marketId));
	return row?.status;
}

describe("resolveMarketAction wire surface", () => {
	beforeEach(() => {
		mockCookiesGet.mockReset();
		mockHeadersGet.mockReset();
	});

	afterEach(async () => {
		await testClient.unsafe(
			`TRUNCATE events, payout_events, resolution_events, dharma_ledger, bets, comments, positions, pools, markets, users, admin_sessions CASCADE`,
		);
		vi.clearAllMocks();
	});

	it("resolve-market::closed-resolves-with-two-events", async () => {
		await withAdminSession();
		const marketId = await seedMarketWithPool("wire-resolve-closed", "Closed");

		const result = await resolveMarketAction(
			resolveFormData(marketId, "YES", RESOLVE_REASON),
		);

		// Lead with the envelope assertion so RED is clean.
		expect(result.ok).toBe(true);
		if (!result.ok) throw new Error("unreachable — asserted ok above");
		expect(result.data.winningSide).toBe("YES");
		expect(typeof result.data.resolutionEventId).toBe("string");

		// Status walk Closed → Resolving → Resolved.
		expect(await marketStatusOf(marketId)).toBe("Resolved");

		// TWO market events on the composed path: market.resolving + resolved.
		const types = await eventTypesFor(marketId);
		expect(types).toContain("market.resolving");
		expect(types).toContain("market.resolved");
	});

	it("resolve-market::resolving-resume-settles-only", async () => {
		// D-15.c recovery proof: a market already in Resolving (entered via a
		// DIRECT triggerResolution call) is completed to Resolved by the action —
		// the action skips the trigger (observed === 'Resolving') and settles.
		await withAdminSession();
		const marketId = await seedMarketWithPool("wire-resolve-resume", "Closed");
		await triggerResolution({
			marketId,
			triggerEventId: uuidv7(),
			metadata: adminMetadata("F-ADMIN-3"),
		});
		expect(await marketStatusOf(marketId)).toBe("Resolving");

		const result = await resolveMarketAction(
			resolveFormData(marketId, "NO", RESOLVE_REASON),
		);

		expect(result.ok).toBe(true);
		if (!result.ok) throw new Error("unreachable — asserted ok above");
		expect(result.data.winningSide).toBe("NO");
		expect(await marketStatusOf(marketId)).toBe("Resolved");

		// Exactly ONE market.resolving event (from the direct trigger — the
		// resume branch did NOT mint a second one) + the new market.resolved.
		const resolvingRows = await testDb
			.select({ eventId: events.eventId })
			.from(events)
			.where(eq(events.eventType, "market.resolving"));
		expect(resolvingRows.length).toBe(1);
		const resolvedRows = await testDb
			.select({ eventId: events.eventId })
			.from(events)
			.where(eq(events.eventType, "market.resolved"));
		expect(resolvedRows.length).toBe(1);
	});

	it("resolve-market::resolved-double-submit-illegal-edge", async () => {
		// The natural-key dedupe: a second resolve on an already-Resolved market
		// fails the trigger gate (off-Closed) → illegal_edge.
		await withAdminSession();
		const marketId = await seedMarketWithPool("wire-resolve-double", "Closed");
		const first = await resolveMarketAction(
			resolveFormData(marketId, "YES", RESOLVE_REASON),
		);
		// (At S1 the first also returns stub_not_implemented; the second-submit
		// assertion is what this test pins. `first` is read only to drive the
		// realistic two-call sequence.)
		void first;

		const result = await resolveMarketAction(
			resolveFormData(marketId, "YES", RESOLVE_REASON),
		);

		expect(result.ok).toBe(false);
		if (result.ok) throw new Error("unreachable — asserted not-ok above");
		expect(result.error.code).toBe("illegal_edge");
	});

	it("resolve-market::no-standalone-trigger-export-under-admin", () => {
		// STRUCTURAL GUARD (NOT a RED driver — labeled in the @test-writer
		// return). R-15.3: there is NO standalone trigger surface under
		// `src/server/admin/`; the resolve surface is the ONE composed action.
		// This PASSES at S1 (the stubs export no trigger) and must stay passing.
		const adminDir = join(process.cwd(), "src", "server", "admin");
		const tsFiles: string[] = [];
		const walk = (dir: string): void => {
			for (const entry of readdirSync(dir)) {
				const full = join(dir, entry);
				if (statSync(full).isDirectory()) {
					walk(full);
				} else if (entry.endsWith(".ts")) {
					tsFiles.push(full);
				}
			}
		};
		walk(adminDir);

		// No export named `triggerResolution` or a `trigger*Action` anywhere.
		const offenders: string[] = [];
		for (const file of tsFiles) {
			const src = readFileSync(file, "utf8");
			if (/export\s+(?:async\s+)?function\s+triggerResolution\b/.test(src)) {
				offenders.push(`${file}: triggerResolution`);
			}
			if (/export\s+(?:async\s+)?function\s+trigger\w*Action\b/.test(src)) {
				offenders.push(`${file}: trigger*Action`);
			}
		}
		expect(offenders).toEqual([]);
	});

	it("resolve-market::rejects-without-admin-session", async () => {
		withoutAdminSession();
		const marketId = await seedMarketWithPool(
			"wire-resolve-no-session",
			"Closed",
		);

		const result = await resolveMarketAction(
			resolveFormData(marketId, "YES", RESOLVE_REASON),
		);

		expect(result.ok).toBe(false);
		if (result.ok) throw new Error("unreachable — asserted not-ok above");
		expect(result.error.code).toBe("admin_session_required");

		// Zero writes: status unchanged, no market events.
		expect(await marketStatusOf(marketId)).toBe("Closed");
		expect((await eventTypesFor(marketId)).length).toBe(0);
	});
});

// ENGINE.15 S1 tests-first (charter file 1) — `correctResolutionAction` wire
// surface (F-RESOLVE-2). VALUE import from `@/server/admin/markets/correct`
// resolves against the S1 stub. Resolved-with-resolve-tip fixtures are built by
// driving the market through the real services (trigger → settle on an
// empty-bet pool). DB-BACKED (:54322).

function correctFormData(
	marketId: string,
	correctedSide: "YES" | "NO",
	reason: string,
): FormData {
	const fd = new FormData();
	fd.append("marketId", marketId);
	fd.append("correctedSide", correctedSide);
	fd.append("reason", reason);
	return fd;
}

/** Drive an empty-bet market to Resolved with a `resolve` tip outcome YES. */
async function seedResolvedMarket(slug: string): Promise<string> {
	const marketId = await seedMarketWithPool(slug, "Closed");
	await triggerResolution({
		marketId,
		triggerEventId: uuidv7(),
		metadata: adminMetadata("F-ADMIN-3"),
	});
	await settleMarket({
		marketId,
		winningSide: "YES",
		reason: RESOLVE_REASON,
		settleEventId: uuidv7(),
		metadata: adminMetadata("F-RESOLVE-1"),
	});
	return marketId;
}

describe("correctResolutionAction wire surface", () => {
	beforeEach(() => {
		mockCookiesGet.mockReset();
		mockHeadersGet.mockReset();
	});

	afterEach(async () => {
		await testClient.unsafe(
			`TRUNCATE events, payout_events, resolution_events, dharma_ledger, bets, comments, positions, pools, markets, users, admin_sessions CASCADE`,
		);
		vi.clearAllMocks();
	});

	it("correct-resolution::happy-path-flips-outcome", async () => {
		await withAdminSession();
		const marketId = await seedResolvedMarket("wire-correct-happy");

		// Tip outcome is YES → correcting to NO is legal.
		const result = await correctResolutionAction(
			correctFormData(marketId, "NO", CORRECT_REASON),
		);

		expect(result.ok).toBe(true);
		if (!result.ok) throw new Error("unreachable — asserted ok above");
		expect(typeof result.data.correctionEventId).toBe("string");
	});

	it("correct-resolution::same-outcome-rejected", async () => {
		await withAdminSession();
		const marketId = await seedResolvedMarket("wire-correct-same");

		// Tip outcome is YES → correcting to YES is the OQ-3 no-op → reject.
		const result = await correctResolutionAction(
			correctFormData(marketId, "YES", CORRECT_REASON),
		);

		expect(result.ok).toBe(false);
		if (result.ok) throw new Error("unreachable — asserted not-ok above");
		expect(result.error.code).toBe("correction_same_outcome");
	});

	it("correct-resolution::illegal-edge-from-open", async () => {
		await withAdminSession();
		// An Open market has no Resolved gate → correct rejects illegal_edge.
		const marketId = await seedMarketWithPool("wire-correct-open", "Open");

		const result = await correctResolutionAction(
			correctFormData(marketId, "NO", CORRECT_REASON),
		);

		expect(result.ok).toBe(false);
		if (result.ok) throw new Error("unreachable — asserted not-ok above");
		expect(result.error.code).toBe("illegal_edge");
	});
});

// ENGINE.15 S1 tests-first (charter file 1) — `voidMarketAction` wire surface
// (F-RESOLVE-3; gate expectedStatus ['Open','Closed']). VALUE import from
// `@/server/admin/markets/void` resolves against the S1 stub. DB-BACKED
// (:54322).

function voidFormData(marketId: string, reason: string): FormData {
	const fd = new FormData();
	fd.append("marketId", marketId);
	fd.append("reason", reason);
	return fd;
}

describe("voidMarketAction wire surface", () => {
	beforeEach(() => {
		mockCookiesGet.mockReset();
		mockHeadersGet.mockReset();
	});

	afterEach(async () => {
		await testClient.unsafe(
			`TRUNCATE events, payout_events, resolution_events, dharma_ledger, bets, comments, positions, pools, markets, users, admin_sessions CASCADE`,
		);
		vi.clearAllMocks();
	});

	it("void-market::happy-path-from-open", async () => {
		await withAdminSession();
		const marketId = await seedMarketWithPool("wire-void-open", "Open");

		const result = await voidMarketAction(voidFormData(marketId, VOID_REASON));

		expect(result.ok).toBe(true);
		if (!result.ok) throw new Error("unreachable — asserted ok above");
		expect(typeof result.data.voidResolutionEventId).toBe("string");
		expect(await marketStatusOf(marketId)).toBe("Voided");
	});

	it("void-market::happy-path-from-closed", async () => {
		await withAdminSession();
		const marketId = await seedMarketWithPool("wire-void-closed", "Closed");

		const result = await voidMarketAction(voidFormData(marketId, VOID_REASON));

		expect(result.ok).toBe(true);
		if (!result.ok) throw new Error("unreachable — asserted ok above");
		expect(await marketStatusOf(marketId)).toBe("Voided");
	});

	it("void-market::illegal-edge-from-resolving", async () => {
		// R-9.3: no Resolving → Voided edge.
		await withAdminSession();
		const marketId = await seedMarketWithPool("wire-void-resolving", "Closed");
		await triggerResolution({
			marketId,
			triggerEventId: uuidv7(),
			metadata: adminMetadata("F-ADMIN-3"),
		});
		expect(await marketStatusOf(marketId)).toBe("Resolving");

		const result = await voidMarketAction(voidFormData(marketId, VOID_REASON));

		expect(result.ok).toBe(false);
		if (result.ok) throw new Error("unreachable — asserted not-ok above");
		expect(result.error.code).toBe("illegal_edge");
		expect(await marketStatusOf(marketId)).toBe("Resolving");
	});
});
