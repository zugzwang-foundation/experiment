import { eq } from "drizzle-orm";
import { v7 as uuidv7 } from "uuid";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@sentry/nextjs", () => ({
	captureMessage: vi.fn(),
	addBreadcrumb: vi.fn(),
	captureException: vi.fn(),
}));

// ENGINE.15 S1 wire-surface session-mock recipe (charter §SESSION-MOCK). The
// S2 wire's `requireAdminSession()` = `validateAdminSession(await cookies())`
// reads cookie `zugzwang_admin_session`, then `@/db` SELECTs `admin_sessions`.
// These mocks are INERT at S1 (the stubs return immediately) but MUST be
// present so S2 turns green without rewriting the tests. The valid-session
// arm seeds an `admin_sessions` row via testClient so the REAL `@/db` SELECT
// (the service tests share the same local Postgres) finds it.
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

import { events, markets } from "@/db/schema";
import { AdminActorError } from "@/server/admin/actor";
import { closeMarketAction } from "@/server/admin/markets/close";
import { createMarketAction } from "@/server/admin/markets/create";
import {
	MARKET_DESCRIPTION_MAX_CHARS,
	MARKET_TITLE_MAX_CHARS,
} from "@/server/config/limits";
import { createMarket } from "@/server/markets/create";
import {
	MarketDeadlineCeilingError,
	MarketDeadlineInPastError,
	MarketSlugTakenError,
} from "@/server/markets/errors";

import { testClient, testDb } from "../../db/_fixtures/db";

const ADMIN_COOKIE_NAME = "zugzwang_admin_session";

/** Seed an admin_sessions row + point the cookie mock at it (valid session). */
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

/** No admin cookie present → the session gate must reject (no DB row). */
function withoutAdminSession(): void {
	mockCookiesGet.mockReturnValue(undefined);
}

// ENGINE.14 §5.6 tests-first (S1, plan §Test plan charter) — the F-ADMIN-1
// createMarket acceptance home (M1–M4). Greenfield VALUE imports from
// `@/server/markets/create` + `@/server/admin/actor` + the lifecycle error
// taxonomy RED at collection until S2 lands. DB-BACKED (:54322).
//
// Pins (plan §Flows + D-14.b/f + R-14.1/R-14.5/R-14.6 + L-E9.3): `eventId?`
// is OPTIONAL — supplied → used VERBATIM (M1 boundary pass); absent → minted
// ONCE at service entry, closed over across SERIALIZABLE retries (M2).
// Ceiling rejects deadline > FREEZE_INSTANT_UTC, `==` PASSES (SPEC.1 §12.1
// "≤"); deadline ≤ now rejects (D-14.b). Payload EXACTLY
// { marketId, resolutionDeadline } — NO seedAmount key (the R-14.1 move).
// Returned event ids pinned SEMANTICALLY (=== the inserted events row's
// event_id, ≠ marketId) — never toBeDefined().

const FREEZE_INSTANT_UTC = new Date("2026-11-05T23:59:00.000Z");
const NOW = new Date("2026-09-15T00:00:00.000Z");
const DEADLINE = new Date("2026-10-01T00:00:00.000Z");
const TITLE = "PLACEHOLDER — not a real market";
const DESCRIPTION = "PLACEHOLDER criterion — not a real criterion";

function adminMetadata(flowId: string) {
	return {
		request_id: "test-engine14-create",
		flow_id: flowId,
		user_id: null,
		actor_id: "admin-singleton",
		idempotency_key: null,
		ip: "test",
		user_agent: "vitest",
	};
}

function createArgs(slug: string, resolutionDeadline: Date) {
	return {
		slug,
		title: TITLE,
		description: DESCRIPTION,
		resolutionDeadline,
		now: NOW,
		metadata: adminMetadata("F-ADMIN-1"),
	};
}

async function marketRowsBySlug(slug: string) {
	return testDb
		.select({ id: markets.id })
		.from(markets)
		.where(eq(markets.slug, slug));
}

async function allEventRows() {
	return testDb.select({ eventId: events.eventId }).from(events);
}

async function createdEventRows() {
	return testDb
		.select({
			eventId: events.eventId,
			payload: events.payload,
			metadata: events.metadata,
		})
		.from(events)
		.where(eq(events.eventType, "market.created"));
}

describe("ENGINE.14 F-ADMIN-1 — createMarket (W-4 create branch)", () => {
	afterEach(async () => {
		await testClient.unsafe(`TRUNCATE events, pools, markets CASCADE`);
		vi.clearAllMocks();
	});

	it("admin-markets::M1-deadline-form-validation-ceiling-reject", async () => {
		// One millisecond past the freeze instant → MarketDeadlineCeilingError;
		// NOTHING written (asserted, not assumed).
		const caught = await createMarket(
			createArgs(
				"placeholder-m1-ceiling",
				new Date("2026-11-05T23:59:00.001Z"),
			),
		).catch((e: unknown) => e);
		expect(caught).toBeInstanceOf(MarketDeadlineCeilingError);

		expect((await marketRowsBySlug("placeholder-m1-ceiling")).length).toBe(0);
		expect((await allEventRows()).length).toBe(0);
	});

	it("admin-markets::M1-deadline-form-validation-boundary-pass", async () => {
		// deadline == FREEZE passes ("≤" per SPEC.1 §12.1). The supplied-eventId
		// round-trip rides this boundary call: the explicit uuidv7() is used
		// VERBATIM (createdEventId === supplied === the events row's event_id).
		const suppliedEventId = uuidv7();
		const result = await createMarket({
			...createArgs("placeholder-m1-boundary", FREEZE_INSTANT_UTC),
			eventId: suppliedEventId,
		});

		expect(result.status).toBe("Draft");
		expect(result.createdEventId).toBe(suppliedEventId);
		expect(result.createdEventId).not.toBe(result.marketId);

		const eventRows = await createdEventRows();
		expect(eventRows.length).toBe(1);
		expect(eventRows[0]?.eventId).toBe(suppliedEventId);
	});

	it("admin-markets::M1-deadline-form-validation-past-reject", async () => {
		// Both halves of D-14.b: deadline === now AND deadline < now reject.
		const caughtEq = await createMarket(
			createArgs("placeholder-m1-past-eq", NOW),
		).catch((e: unknown) => e);
		expect(caughtEq).toBeInstanceOf(MarketDeadlineInPastError);

		const caughtLt = await createMarket(
			createArgs(
				"placeholder-m1-past-lt",
				new Date("2026-09-14T00:00:00.000Z"),
			),
		).catch((e: unknown) => e);
		expect(caughtLt).toBeInstanceOf(MarketDeadlineInPastError);

		expect((await marketRowsBySlug("placeholder-m1-past-eq")).length).toBe(0);
		expect((await marketRowsBySlug("placeholder-m1-past-lt")).length).toBe(0);
		expect((await allEventRows()).length).toBe(0);
	});

	it("admin-markets::M2-create-happy-draft-and-event", async () => {
		// NO eventId supplied — the mint-if-absent path: the service mints ONCE
		// at entry (closed over across W-4 retries) and returns it.
		const result = await createMarket(
			createArgs("placeholder-m2-happy", DEADLINE),
		);

		// D-14.f response shape — key-set EXACT.
		expect(result).toEqual({
			marketId: result.marketId,
			slug: "placeholder-m2-happy",
			status: "Draft",
			createdEventId: result.createdEventId,
		});

		// Row: Draft, created_by admin-singleton, content round-trips.
		const [row] = await testDb
			.select({
				id: markets.id,
				slug: markets.slug,
				title: markets.title,
				description: markets.description,
				status: markets.status,
				createdBy: markets.createdBy,
			})
			.from(markets)
			.where(eq(markets.id, result.marketId));
		expect(row).toEqual({
			id: result.marketId,
			slug: "placeholder-m2-happy",
			title: TITLE,
			description: DESCRIPTION,
			status: "Draft",
			createdBy: "admin-singleton",
		});

		// Exactly ONE market.created events row; payload EXACT — NO seedAmount
		// key (R-14.1: the seed instant is Draft → Open, not creation).
		const eventRows = await createdEventRows();
		expect(eventRows.length).toBe(1);
		expect(eventRows[0]?.payload).toEqual({
			marketId: result.marketId,
			resolutionDeadline: DEADLINE.toISOString(),
		});
		const metadata = eventRows[0]?.metadata as {
			actor_id?: unknown;
			user_id?: unknown;
		};
		expect(metadata.actor_id).toBe("admin-singleton");
		expect(metadata.user_id).toBeNull();

		// Semantic id pins (L-E9.3) — never toBeDefined().
		expect(result.createdEventId).toBe(eventRows[0]?.eventId);
		expect(result.createdEventId).not.toBe(result.marketId);
	});

	it("admin-markets::M3-slug-taken-typed", async () => {
		await createMarket(createArgs("placeholder-m3-taken", DEADLINE));

		const caught = await createMarket(
			createArgs("placeholder-m3-taken", DEADLINE),
		).catch((e: unknown) => e);
		expect(caught).toBeInstanceOf(MarketSlugTakenError);

		// Exactly ONE markets row persists; the second create wrote NOTHING —
		// exactly ONE market.created event.
		expect((await marketRowsBySlug("placeholder-m3-taken")).length).toBe(1);
		expect((await createdEventRows()).length).toBe(1);
	});

	it("admin-markets::M4-actor-rejects-nonnull-user-id", async () => {
		// R-14.5: metadata.user_id must be null for lifecycle flows.
		const caught = await createMarket({
			...createArgs("placeholder-m4-user", DEADLINE),
			metadata: { ...adminMetadata("F-ADMIN-1"), user_id: uuidv7() },
		}).catch((e: unknown) => e);
		expect(caught).toBeInstanceOf(AdminActorError);

		expect((await marketRowsBySlug("placeholder-m4-user")).length).toBe(0);
		expect((await allEventRows()).length).toBe(0);
	});

	it("admin-markets::M4-actor-rejects-wrong-actor-id", async () => {
		// R-14.5: metadata.actor_id must be EXACTLY 'admin-singleton'.
		const caught = await createMarket({
			...createArgs("placeholder-m4-actor", DEADLINE),
			metadata: { ...adminMetadata("F-ADMIN-1"), actor_id: "not-the-admin" },
		}).catch((e: unknown) => e);
		expect(caught).toBeInstanceOf(AdminActorError);

		expect((await marketRowsBySlug("placeholder-m4-actor")).length).toBe(0);
		expect((await allEventRows()).length).toBe(0);
	});
});

// ENGINE.15 S1 tests-first (charter file 2) — the `createMarketAction` wire
// surface (D-15.a step sequence: requireAdminSession → zod-validate FormData →
// metadata → createMarket → map → revalidatePath). VALUE import from
// `@/server/admin/markets/create` resolves against the S1 stub, which returns
// `{ ok: false, error: { code: "stub_not_implemented", … } }` for every call —
// so every assertion below is RED on the ASSERTION (wrong code / wrong ok),
// never on collection. S2 wires the real action. DB-BACKED (:54322).
//
// FormData shape (plan §Flows): slug, title (≤MARKET_TITLE_MAX_CHARS),
// description (≤MARKET_DESCRIPTION_MAX_CHARS), resolutionDeadline (a
// datetime-local string → Date). Success → { marketId, slug }.

const WIRE_NOW_DEADLINE = new Date("2027-01-01T00:00:00.000Z");
const PAST_DEADLINE = new Date("2020-01-01T00:00:00.000Z");
// One millisecond past the §12.1 freeze ceiling (FREEZE_INSTANT_UTC).
const CEILING_BREACH = new Date("2026-11-05T23:59:00.001Z");

/** A datetime-local string (no seconds/zone) the browser form would submit. */
function datetimeLocal(d: Date): string {
	return d.toISOString().slice(0, 16);
}

function createFormData(fields: {
	slug: string;
	title: string;
	description: string;
	resolutionDeadline: Date;
}): FormData {
	const fd = new FormData();
	fd.append("slug", fields.slug);
	fd.append("title", fields.title);
	fd.append("description", fields.description);
	fd.append("resolutionDeadline", datetimeLocal(fields.resolutionDeadline));
	return fd;
}

describe("createMarketAction wire surface", () => {
	beforeEach(() => {
		mockCookiesGet.mockReset();
		mockHeadersGet.mockReset();
	});

	afterEach(async () => {
		await testClient.unsafe(
			`TRUNCATE events, pools, markets, admin_sessions CASCADE`,
		);
		vi.clearAllMocks();
	});

	it("create-market::happy-path-draft-and-event", async () => {
		await withAdminSession();

		const result = await createMarketAction(
			createFormData({
				slug: "wire-create-happy",
				title: "PLACEHOLDER — not a real market",
				description: "PLACEHOLDER criterion — not a real criterion",
				resolutionDeadline: WIRE_NOW_DEADLINE,
			}),
		);

		// Lead with the envelope assertion so RED is clean (got
		// { ok: false, error: { code: "stub_not_implemented" } }).
		expect(result.ok).toBe(true);
		if (!result.ok) throw new Error("unreachable — asserted ok above");
		expect(result.data.slug).toBe("wire-create-happy");
		expect(typeof result.data.marketId).toBe("string");

		// Exactly ONE markets row in Draft.
		const marketRows = await testDb
			.select({ id: markets.id, status: markets.status })
			.from(markets)
			.where(eq(markets.slug, "wire-create-happy"));
		expect(marketRows.length).toBe(1);
		expect(marketRows[0]?.status).toBe("Draft");

		// Exactly ONE market.created events row; canonical payload
		// { marketId, resolutionDeadline } (no seedAmount — R-14.1).
		const eventRows = await createdEventRows();
		expect(eventRows.length).toBe(1);
		expect(eventRows[0]?.payload).toEqual({
			marketId: result.data.marketId,
			resolutionDeadline: WIRE_NOW_DEADLINE.toISOString(),
		});
	});

	it("create-market::rejects-without-admin-session", async () => {
		withoutAdminSession();

		const result = await createMarketAction(
			createFormData({
				slug: "wire-create-no-session",
				title: "PLACEHOLDER — not a real market",
				description: "PLACEHOLDER criterion — not a real criterion",
				resolutionDeadline: WIRE_NOW_DEADLINE,
			}),
		);

		expect(result.ok).toBe(false);
		if (result.ok) throw new Error("unreachable — asserted not-ok above");
		expect(result.error.code).toBe("admin_session_required");

		// Zero writes: no market, no event.
		expect((await marketRowsBySlug("wire-create-no-session")).length).toBe(0);
		expect((await allEventRows()).length).toBe(0);
	});

	it("create-market::rejects-title-over-max", async () => {
		await withAdminSession();

		const result = await createMarketAction(
			createFormData({
				slug: "wire-create-long-title",
				title: "x".repeat(MARKET_TITLE_MAX_CHARS + 1),
				description: "PLACEHOLDER criterion — not a real criterion",
				resolutionDeadline: WIRE_NOW_DEADLINE,
			}),
		);

		expect(result.ok).toBe(false);
		if (result.ok) throw new Error("unreachable — asserted not-ok above");
		expect(result.error.code).toBe("validation_error");
		expect(result.error.field_errors?.title).toBeDefined();

		expect((await marketRowsBySlug("wire-create-long-title")).length).toBe(0);
		expect((await allEventRows()).length).toBe(0);
	});

	it("create-market::rejects-description-over-max", async () => {
		await withAdminSession();

		const result = await createMarketAction(
			createFormData({
				slug: "wire-create-long-desc",
				title: "PLACEHOLDER — not a real market",
				description: "x".repeat(MARKET_DESCRIPTION_MAX_CHARS + 1),
				resolutionDeadline: WIRE_NOW_DEADLINE,
			}),
		);

		expect(result.ok).toBe(false);
		if (result.ok) throw new Error("unreachable — asserted not-ok above");
		expect(result.error.code).toBe("validation_error");
		expect(result.error.field_errors?.description).toBeDefined();

		expect((await marketRowsBySlug("wire-create-long-desc")).length).toBe(0);
		expect((await allEventRows()).length).toBe(0);
	});

	it("create-market::rejects-deadline-in-past", async () => {
		await withAdminSession();

		const result = await createMarketAction(
			createFormData({
				slug: "wire-create-past",
				title: "PLACEHOLDER — not a real market",
				description: "PLACEHOLDER criterion — not a real criterion",
				resolutionDeadline: PAST_DEADLINE,
			}),
		);

		expect(result.ok).toBe(false);
		if (result.ok) throw new Error("unreachable — asserted not-ok above");
		expect(result.error.code).toBe("deadline_in_past");

		expect((await marketRowsBySlug("wire-create-past")).length).toBe(0);
		expect((await allEventRows()).length).toBe(0);
	});

	it("create-market::rejects-deadline-over-ceiling", async () => {
		await withAdminSession();

		const result = await createMarketAction(
			createFormData({
				slug: "wire-create-ceiling",
				title: "PLACEHOLDER — not a real market",
				description: "PLACEHOLDER criterion — not a real criterion",
				resolutionDeadline: CEILING_BREACH,
			}),
		);

		expect(result.ok).toBe(false);
		if (result.ok) throw new Error("unreachable — asserted not-ok above");
		expect(result.error.code).toBe("deadline_ceiling");

		expect((await marketRowsBySlug("wire-create-ceiling")).length).toBe(0);
		expect((await allEventRows()).length).toBe(0);
	});
});

// ENGINE.15 S1 tests-first (charter file 2) — the `closeMarketAction` wire
// surface (manual close, W-4-CLOSE). VALUE import from
// `@/server/admin/markets/close` resolves against the S1 stub. Per the
// §State×Action matrix: Open + past-deadline → ok → Closed; Open + pre-deadline
// → deadline_not_reached; Draft → market_not_open. DB-BACKED (:54322).

const CLOSE_DEADLINE = new Date("2026-08-01T00:00:00.000Z");

async function seedMarketFixture(
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
			resolutionDeadline: CLOSE_DEADLINE,
		})
		.returning({ id: markets.id });
	return market?.id ?? "";
}

function closeFormData(marketId: string): FormData {
	const fd = new FormData();
	fd.append("marketId", marketId);
	return fd;
}

async function closedEventRows() {
	return testDb
		.select({ eventId: events.eventId, payload: events.payload })
		.from(events)
		.where(eq(events.eventType, "market.closed"));
}

describe("closeMarketAction wire surface", () => {
	beforeEach(() => {
		mockCookiesGet.mockReset();
		mockHeadersGet.mockReset();
	});

	afterEach(async () => {
		await testClient.unsafe(
			`TRUNCATE events, pools, markets, admin_sessions CASCADE`,
		);
		vi.clearAllMocks();
	});

	it("close-market::happy-path-open-past-deadline", async () => {
		await withAdminSession();
		// now (S2 injects new Date()) is well past CLOSE_DEADLINE (2026-08-01).
		const marketId = await seedMarketFixture("wire-close-happy", "Open");

		const result = await closeMarketAction(closeFormData(marketId));

		expect(result.ok).toBe(true);
		if (!result.ok) throw new Error("unreachable — asserted ok above");
		expect(result.data.status).toBe("Closed");

		const [marketRow] = await testDb
			.select({ status: markets.status })
			.from(markets)
			.where(eq(markets.id, marketId));
		expect(marketRow?.status).toBe("Closed");

		const eventRows = await closedEventRows();
		expect(eventRows.length).toBe(1);
		expect(eventRows[0]?.payload).toEqual({ marketId });
	});

	it("close-market::rejects-pre-deadline-with-deadline-not-reached", async () => {
		await withAdminSession();
		// A future deadline so now < deadline → MarketDeadlineNotReachedError.
		const [market] = await testDb
			.insert(markets)
			.values({
				slug: "wire-close-early",
				title: "PLACEHOLDER — not a real market",
				description: "PLACEHOLDER criterion — not a real criterion",
				status: "Open",
				resolutionDeadline: new Date("2099-01-01T00:00:00.000Z"),
			})
			.returning({ id: markets.id });
		const marketId = market?.id ?? "";

		const result = await closeMarketAction(closeFormData(marketId));

		expect(result.ok).toBe(false);
		if (result.ok) throw new Error("unreachable — asserted not-ok above");
		expect(result.error.code).toBe("deadline_not_reached");

		const [marketRow] = await testDb
			.select({ status: markets.status })
			.from(markets)
			.where(eq(markets.id, marketId));
		expect(marketRow?.status).toBe("Open");
		expect((await closedEventRows()).length).toBe(0);
	});

	it("close-market::rejects-draft-with-market-not-open", async () => {
		await withAdminSession();
		const marketId = await seedMarketFixture("wire-close-draft", "Draft");

		const result = await closeMarketAction(closeFormData(marketId));

		expect(result.ok).toBe(false);
		if (result.ok) throw new Error("unreachable — asserted not-ok above");
		expect(result.error.code).toBe("market_not_open");

		const [marketRow] = await testDb
			.select({ status: markets.status })
			.from(markets)
			.where(eq(markets.id, marketId));
		expect(marketRow?.status).toBe("Draft");
		expect((await closedEventRows()).length).toBe(0);
	});

	it("close-market::rejects-without-admin-session", async () => {
		withoutAdminSession();
		const marketId = await seedMarketFixture("wire-close-no-session", "Open");

		const result = await closeMarketAction(closeFormData(marketId));

		expect(result.ok).toBe(false);
		if (result.ok) throw new Error("unreachable — asserted not-ok above");
		expect(result.error.code).toBe("admin_session_required");

		const [marketRow] = await testDb
			.select({ status: markets.status })
			.from(markets)
			.where(eq(markets.id, marketId));
		expect(marketRow?.status).toBe("Open");
		expect((await closedEventRows()).length).toBe(0);
	});
});
