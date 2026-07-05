import { beforeEach, describe, expect, it, vi } from "vitest";

// AUDIT-FIX-B1 A5 (rulings #1, #2) tests-first — the money-path 500 capture at the
// shared bet-endpoint catch (`src/server/bets/endpoint.ts`, the :307 catch serving
// BOTH /api/bets/place and /api/bets/sell). When `toWireError(err)` yields the 500
// `error_internal` envelope, EXACTLY ONE
// `captureException(err, { tags: { kind: "bet_handler_internal_error" } })` fires
// with the ORIGINAL err object (no rewrap) — the caught append-only RAISE message
// survives verbatim (ruling #1). The 503 arms (serialization / storage /
// moderation) and the 4xx product arms are captured at THEIR OWN sources, so the
// endpoint catch does NOT capture them (ruling #2).
//
// RED reason (extension of an EXISTING module): `runBetEndpoint` imports fine →
// ASSERTION-RED, not collection-RED. Pre-impl the catch never calls
// captureException, so (a)/(b) fail `toHaveBeenCalledTimes(1)`; the 500 envelope
// itself is already byte-identical (that sub-assertion is green — the
// zero-behaviour-change proof). Negatives (c)-(f) are GREEN regression guards both
// pre- and post-impl (the additive capture must never reach the non-500 arms).
//
// `runBetEndpoint` is invoked DIRECTLY with a controlled `inner` (the kickoff's
// "inner is reachable"); the shared §3.1 prefix is fully mocked so no DB/network
// is touched. `@sentry/nextjs` is the mocked vendor boundary (NOT safe-capture,
// which post-impl runs for real and routes its captureException call here).

const { mockGetSession, mockFindFirst, mockLookupOrReserve, mockRelease } =
	vi.hoisted(() => ({
		mockGetSession: vi.fn(),
		mockFindFirst: vi.fn(),
		mockRelease: vi.fn(),
		mockLookupOrReserve: vi.fn(),
	}));
const { mockCaptureException, mockCaptureMessage } = vi.hoisted(() => ({
	mockCaptureException: vi.fn(),
	mockCaptureMessage: vi.fn(),
}));

vi.mock("@sentry/nextjs", () => ({
	captureException: mockCaptureException,
	captureMessage: mockCaptureMessage,
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
vi.mock("@/server/system/is-frozen", () => ({
	isFrozen: vi.fn(async () => false),
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
	idempotencyLookupOrReserve: mockLookupOrReserve,
}));
// Post-impl the endpoint also logs via this module; mock it so the capture test
// stays focused (logRequest wiring is proven in endpoint-log-request.test.ts).
vi.mock("@/server/middleware/logging", () => ({ logRequest: vi.fn() }));

import {
	ModerationUnavailableError,
	StorageUnavailableError,
} from "@/lib/errors";
import { runBetEndpoint } from "@/server/bets/endpoint";
import {
	BetSerializationExhaustedError,
	InsufficientDharmaError,
} from "@/server/bets/errors";

const USER_ID = "0190b3a0-1111-7000-8000-000000000011";

// The EXACT RAISE text from drizzle/migrations/0003_append_only_triggers.sql:24
// for a `bets` UPDATE (TG_TABLE_SCHEMA.TG_TABLE_NAME = public.bets). Load-bearing:
// the original err's message must survive verbatim into the capture (ruling #1).
const APPEND_ONLY_MSG =
	"append-only violation on table public.bets: UPDATE not permitted";

class FakePostgresError extends Error {
	code = "P0001";
	constructor(message: string) {
		super(message);
		this.name = "error";
	}
}

function betRequest(): Request {
	return new Request("https://prd.example.com/api/bets/place", {
		method: "POST",
		headers: {
			"content-type": "application/json",
			origin: "https://prd.example.com",
			"Idempotency-Key": "endpoint-cap-key",
			"x-forwarded-for": "203.0.113.50",
			"user-agent": "vitest",
		},
		body: JSON.stringify({
			marketId: "0190b3a0-3333-7000-8000-000000000033",
			side: "YES",
			stake: "10",
			body: "endpoint-capture argument body",
		}),
	});
}

describe("AUDIT-FIX-B1 A5 — bet endpoint money-path 500 capture", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockGetSession.mockResolvedValue({ user: { id: USER_ID } });
		mockFindFirst.mockResolvedValue({
			pseudonym: "bettor",
			tosAcceptedAt: new Date("2026-01-01T00:00:00Z"),
			bannedAt: null,
		});
		mockRelease.mockResolvedValue(undefined);
		mockLookupOrReserve.mockResolvedValue({
			kind: "miss",
			release: mockRelease,
		});
	});

	it("bet-endpoint-capture::append-only-500-captures-original-err-verbatim", async () => {
		const err = new FakePostgresError(APPEND_ONLY_MSG);
		const res = await runBetEndpoint(betRequest(), async () => {
			throw err;
		});
		expect(res.status).toBe(500);
		// Byte-identical to today's 500 envelope (no retry_after on a 500).
		expect(await res.json()).toEqual({
			ok: false,
			error: { code: "error_internal", message: "internal error" },
		});
		// Exactly one capture, the SAME object (no rewrap), verbatim message, tag.
		expect(mockCaptureException).toHaveBeenCalledTimes(1);
		expect(mockCaptureException.mock.calls[0]?.[0]).toBe(err);
		expect((mockCaptureException.mock.calls[0]?.[0] as Error).message).toBe(
			APPEND_ONLY_MSG,
		);
		expect(mockCaptureException.mock.calls[0]?.[1]).toEqual({
			tags: { kind: "bet_handler_internal_error" },
		});
	});

	it("bet-endpoint-capture::plain-error-500-captures-once", async () => {
		const err = new Error("boom");
		const res = await runBetEndpoint(betRequest(), async () => {
			throw err;
		});
		expect(res.status).toBe(500);
		expect(await res.json()).toEqual({
			ok: false,
			error: { code: "error_internal", message: "internal error" },
		});
		expect(mockCaptureException).toHaveBeenCalledTimes(1);
		expect(mockCaptureException.mock.calls[0]?.[0]).toBe(err);
		expect(mockCaptureException.mock.calls[0]?.[1]).toEqual({
			tags: { kind: "bet_handler_internal_error" },
		});
	});

	// Negatives — the additive capture MUST NOT reach the non-500 arms (zero
	// endpoint captures). Green regression guards both pre- and post-impl; byte-
	// identical statuses/codes are the zero-behaviour-change proof.
	it("bet-endpoint-capture::product-400-no-capture", async () => {
		const res = await runBetEndpoint(betRequest(), async () => {
			throw new InsufficientDharmaError({ balance: "5", required: "10" });
		});
		expect(res.status).toBe(400);
		expect((await res.json()).error.code).toBe("insufficient_dharma");
		expect(mockCaptureException).not.toHaveBeenCalled();
	});

	it("bet-endpoint-capture::serialization-exhausted-503-no-endpoint-capture", async () => {
		const res = await runBetEndpoint(betRequest(), async () => {
			throw new BetSerializationExhaustedError({
				sqlstate: "40001",
				flow: "F-BET-1",
			});
		});
		expect(res.status).toBe(503);
		expect((await res.json()).error.code).toBe(
			"error_bet_serialization_exhausted",
		);
		expect(mockCaptureException).not.toHaveBeenCalled();
	});

	it("bet-endpoint-capture::storage-unavailable-503-no-capture", async () => {
		const res = await runBetEndpoint(betRequest(), async () => {
			throw new StorageUnavailableError(new Error("r2 down"));
		});
		expect(res.status).toBe(503);
		expect((await res.json()).error.code).toBe("error_storage_unavailable");
		expect(mockCaptureException).not.toHaveBeenCalled();
	});

	it("bet-endpoint-capture::moderation-unavailable-503-no-capture", async () => {
		const res = await runBetEndpoint(betRequest(), async () => {
			throw new ModerationUnavailableError(new Error("openai down"));
		});
		expect(res.status).toBe(503);
		expect((await res.json()).error.code).toBe("error_moderation_unavailable");
		expect(mockCaptureException).not.toHaveBeenCalled();
	});
});
