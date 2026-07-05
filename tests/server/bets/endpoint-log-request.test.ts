import { beforeEach, describe, expect, it, vi } from "vitest";

// AUDIT-FIX-B1 A17 (rulings #6, #7) tests-first — `logRequest` wiring on the shared
// bet endpoint (`runBetEndpoint`, serving both /api/bets/place + /api/bets/sell).
// Honors logging.ts's locked contract: ONLY handler-body outcomes log — the
// `inner` result status and the catch's wire status. The §3.1 PREFIX rejections
// (origin 403 / auth 401 / ban 403 / onboarding 403 / freeze 410 / missing idem
// key 400 / idem hit / rate-limit 429) never reached the handler body → NEVER
// logged. The 429 arm specifically is NOT logged (set before `inner`).
//
// RED reason (extension of an EXISTING module): `runBetEndpoint` imports fine →
// ASSERTION-RED. Pre-impl the endpoint does not import/call logRequest, so the
// "logged once" assertions fail (0 calls); the not-logged negatives are GREEN
// regression guards. Each logged call carries `userId` (the session user) + a
// numeric `startedAt`.
//
// `runBetEndpoint` is invoked DIRECTLY with a controlled `inner`; the prefix is
// mocked (no DB/network). `@/server/middleware/logging` is the seam under test.

const {
	mockGetSession,
	mockFindFirst,
	mockIsFrozen,
	mockCheckOrigin,
	mockCheckRateLimit,
	mockLookupOrReserve,
	mockRelease,
	mockLogRequest,
} = vi.hoisted(() => ({
	mockGetSession: vi.fn(),
	mockFindFirst: vi.fn(),
	mockIsFrozen: vi.fn(),
	mockCheckOrigin: vi.fn(),
	mockCheckRateLimit: vi.fn(),
	mockLookupOrReserve: vi.fn(),
	mockRelease: vi.fn(),
	mockLogRequest: vi.fn(),
}));

vi.mock("@sentry/nextjs", () => ({
	captureException: vi.fn(),
	captureMessage: vi.fn(),
	addBreadcrumb: vi.fn(),
}));
vi.mock("@/server/auth", () => ({
	auth: { api: { getSession: mockGetSession } },
}));
vi.mock("@/db", () => ({
	db: {
		query: { users: { findFirst: mockFindFirst } },
		// AUDIT-FIX-B3 A9 — the durable pre-check runs db.select(bet_receipts) on the
		// miss arm; a fresh key finds no receipt → the chain resolves to [] → the
		// pre-check returns null and execution proceeds to `inner` unchanged.
		select: () => ({
			from: () => ({ where: () => ({ limit: async () => [] }) }),
		}),
	},
}));
vi.mock("@/server/system/is-frozen", () => ({ isFrozen: mockIsFrozen }));
vi.mock("@/server/middleware/origin-allowlist", () => ({
	checkOrigin: mockCheckOrigin,
}));
vi.mock("@/server/middleware/rate-limit", () => ({
	checkRateLimit: mockCheckRateLimit,
	ipIdentifier: (ip: string) => ip,
}));
vi.mock("@/server/idempotency/cache", () => ({
	computeBodyFingerprint: vi.fn(async () => "fp"),
	idempotencyLookupOrReserve: mockLookupOrReserve,
}));
vi.mock("@/server/middleware/logging", () => ({ logRequest: mockLogRequest }));

import { runBetEndpoint } from "@/server/bets/endpoint";
import { InsufficientDharmaError } from "@/server/bets/errors";

const USER_ID = "0190b3a0-2222-7000-8000-000000000022";

function betRequest(opts?: { idemKey?: string | null; raw?: string }): Request {
	const headers = new Headers({
		"content-type": "application/json",
		origin: "https://prd.example.com",
		"x-forwarded-for": "203.0.113.51",
		"user-agent": "vitest",
	});
	const idemKey =
		opts?.idemKey === undefined ? "endpoint-log-key" : opts.idemKey;
	if (idemKey !== null) headers.set("Idempotency-Key", idemKey);
	return new Request("https://prd.example.com/api/bets/place", {
		method: "POST",
		headers,
		body:
			opts?.raw ??
			JSON.stringify({
				marketId: "0190b3a0-3333-7000-8000-000000000033",
				side: "YES",
				stake: "10",
				body: "endpoint-log argument body",
			}),
	});
}

const okInner = async () => ({
	status: 200,
	body: { ok: true, data: { betId: "b1" } },
});

describe("AUDIT-FIX-B1 A17 — runBetEndpoint logRequest wiring", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockCheckOrigin.mockReturnValue(true);
		mockGetSession.mockResolvedValue({ user: { id: USER_ID } });
		mockFindFirst.mockResolvedValue({
			pseudonym: "bettor",
			tosAcceptedAt: new Date("2026-01-01T00:00:00Z"),
			bannedAt: null,
		});
		mockIsFrozen.mockResolvedValue(false);
		mockCheckRateLimit.mockResolvedValue({
			allowed: true,
			remaining: 99,
			reset: 0,
		});
		mockRelease.mockResolvedValue(undefined);
		mockLookupOrReserve.mockResolvedValue({
			kind: "miss",
			release: mockRelease,
		});
	});

	// === Handler-body outcomes — logged ONCE with the response status ==========

	it("endpoint-log::happy-200-logs-once-with-user-and-started-at", async () => {
		const res = await runBetEndpoint(betRequest(), okInner);
		expect(res.status).toBe(200);
		expect(mockLogRequest).toHaveBeenCalledTimes(1);
		expect(mockLogRequest).toHaveBeenCalledWith(
			expect.objectContaining({
				status: 200,
				userId: USER_ID,
				startedAt: expect.any(Number),
			}),
		);
	});

	it("endpoint-log::product-4xx-via-catch-logs-once", async () => {
		const res = await runBetEndpoint(betRequest(), async () => {
			throw new InsufficientDharmaError({ balance: "5", required: "10" });
		});
		expect(res.status).toBe(400);
		expect(mockLogRequest).toHaveBeenCalledTimes(1);
		expect(mockLogRequest).toHaveBeenCalledWith(
			expect.objectContaining({ status: 400, userId: USER_ID }),
		);
	});

	it("endpoint-log::internal-500-via-catch-logs-once", async () => {
		const res = await runBetEndpoint(betRequest(), async () => {
			throw new Error("boom");
		});
		expect(res.status).toBe(500);
		expect(mockLogRequest).toHaveBeenCalledTimes(1);
		expect(mockLogRequest).toHaveBeenCalledWith(
			expect.objectContaining({ status: 500, userId: USER_ID }),
		);
	});

	// === Prefix rejections — NEVER logged (never reached the handler body) ======

	it("endpoint-log::origin-403-not-logged", async () => {
		mockCheckOrigin.mockReturnValue(false);
		const res = await runBetEndpoint(betRequest(), okInner);
		expect(res.status).toBe(403);
		expect(mockLogRequest).not.toHaveBeenCalled();
	});

	it("endpoint-log::no-session-401-not-logged", async () => {
		mockGetSession.mockResolvedValue(null);
		const res = await runBetEndpoint(betRequest(), okInner);
		expect(res.status).toBe(401);
		expect(mockLogRequest).not.toHaveBeenCalled();
	});

	it("endpoint-log::banned-403-not-logged", async () => {
		mockFindFirst.mockResolvedValue({
			pseudonym: "bettor",
			tosAcceptedAt: new Date("2026-01-01T00:00:00Z"),
			bannedAt: new Date("2026-02-01T00:00:00Z"),
		});
		const res = await runBetEndpoint(betRequest(), okInner);
		expect(res.status).toBe(403);
		expect(mockLogRequest).not.toHaveBeenCalled();
	});

	it("endpoint-log::frozen-410-not-logged", async () => {
		mockIsFrozen.mockResolvedValue(true);
		const res = await runBetEndpoint(betRequest(), okInner);
		expect(res.status).toBe(410);
		expect(mockLogRequest).not.toHaveBeenCalled();
	});

	it("endpoint-log::missing-idem-key-400-not-logged", async () => {
		const res = await runBetEndpoint(betRequest({ idemKey: null }), okInner);
		expect(res.status).toBe(400);
		expect(mockLogRequest).not.toHaveBeenCalled();
	});

	it("endpoint-log::idem-hit-not-logged", async () => {
		mockLookupOrReserve.mockResolvedValue({
			kind: "hit",
			cachedResponse: {
				status: 200,
				body: { ok: true, data: { betId: "cached" } },
				bodyFingerprint: "fp",
			},
		});
		const res = await runBetEndpoint(betRequest(), okInner);
		expect(res.status).toBe(200);
		// The cache hit returns BEFORE the try/finally → logStatus never set.
		expect(mockLogRequest).not.toHaveBeenCalled();
	});

	it("endpoint-log::rate-limited-429-not-logged", async () => {
		mockCheckRateLimit.mockResolvedValue({ allowed: false, retryAfter: 3 });
		const res = await runBetEndpoint(betRequest(), okInner);
		expect(res.status).toBe(429);
		// The 429 arm sits before `inner` — explicitly NOT logged (ruling #7).
		expect(mockLogRequest).not.toHaveBeenCalled();
	});

	// Adversarial-verify fold-in (B1 workflow, a17Contract INFO): pin the four
	// remaining unlogged prefix arms the first pass omitted.

	it("endpoint-log::onboarding-403-not-logged", async () => {
		mockFindFirst.mockResolvedValue({
			pseudonym: null,
			tosAcceptedAt: null,
			bannedAt: null,
		});
		const res = await runBetEndpoint(betRequest(), okInner);
		expect(res.status).toBe(403);
		expect(mockLogRequest).not.toHaveBeenCalled();
	});

	it("endpoint-log::malformed-idem-key-400-not-logged", async () => {
		const res = await runBetEndpoint(
			betRequest({ idemKey: "bad key with spaces!" }),
			okInner,
		);
		expect(res.status).toBe(400);
		expect(mockLogRequest).not.toHaveBeenCalled();
	});

	it("endpoint-log::invalid-json-400-not-logged", async () => {
		// Plan §A17 item 1 pins endpoint logging to inner-result + catch-wire
		// only: the body parse is hoisted into the §3.1 prefix (it feeds the
		// idempotency fingerprint), so — unlike the two sign routes, where the
		// parse IS the handler body — a malformed bet body does not log.
		const res = await runBetEndpoint(betRequest({ raw: "not-json{" }), okInner);
		expect(res.status).toBe(400);
		expect(mockLogRequest).not.toHaveBeenCalled();
	});

	it("endpoint-log::idem-mismatch-pending-unavailable-not-logged", async () => {
		mockLookupOrReserve.mockResolvedValueOnce({ kind: "mismatch" });
		expect((await runBetEndpoint(betRequest(), okInner)).status).toBe(409);
		mockLookupOrReserve.mockResolvedValueOnce({ kind: "pending" });
		expect((await runBetEndpoint(betRequest(), okInner)).status).toBe(409);
		mockLookupOrReserve.mockResolvedValueOnce({ kind: "unavailable" });
		expect((await runBetEndpoint(betRequest(), okInner)).status).toBe(503);
		expect(mockLogRequest).not.toHaveBeenCalled();
	});
});
