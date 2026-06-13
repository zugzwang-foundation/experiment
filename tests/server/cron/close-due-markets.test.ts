import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ENGINE.15 S1 tests-first (charter file 4 — mints the `tests/server/cron/`
// convention, B-9). The GET /api/cron/close-due-markets route handler is the
// A-2 mirror (Bearer CRON_SECRET → distributed lock → closeDueMarkets →
// in-body status; D-15.g). VALUE import from
// `@/app/api/cron/close-due-markets/route` resolves against the S1 stub, which
// returns HTTP 501 + { status: "stub" } for EVERY call — so every status
// assertion below is RED on the ASSERTION (got 501), never on collection. S2
// wires the A-2 mirror per src/app/api/cron/r2-orphan-sweep/route.ts.
//
// Wire-only: `closeDueMarkets` is already ENGINE.14-tested, so it is MOCKED —
// this file covers the new route logic (auth gate, lock, status mapping,
// Sentry capture) and nothing else. No DB.

const { mockCloseDueMarkets } = vi.hoisted(() => ({
	mockCloseDueMarkets: vi.fn(),
}));

vi.mock("@/server/markets/close", () => ({
	closeDueMarkets: mockCloseDueMarkets,
}));

const { mockAcquireLock, mockReleaseLock } = vi.hoisted(() => ({
	mockAcquireLock: vi.fn(),
	mockReleaseLock: vi.fn(),
}));

vi.mock("@/server/upstash/lock", () => ({
	acquireLock: mockAcquireLock,
	releaseLock: mockReleaseLock,
}));

vi.mock("@/server/upstash/keys", () => ({
	getRedisKey: (...parts: string[]) => ["test", ...parts].join(":"),
}));

const { mockCaptureException } = vi.hoisted(() => ({
	mockCaptureException: vi.fn(),
}));

vi.mock("@sentry/nextjs", () => ({
	captureException: mockCaptureException,
	captureMessage: vi.fn(),
	addBreadcrumb: vi.fn(),
}));

import { GET } from "@/app/api/cron/close-due-markets/route";

const CRON_SECRET = "test-cron-secret-32-bytes-minimum-xxxxx";

function cronRequest(authHeader?: string): Request {
	const headers = new Headers();
	if (authHeader !== undefined) {
		headers.set("authorization", authHeader);
	}
	return new Request("http://localhost/api/cron/close-due-markets", {
		method: "GET",
		headers,
	});
}

describe("GET /api/cron/close-due-markets wire surface", () => {
	beforeEach(() => {
		mockCloseDueMarkets.mockReset();
		mockAcquireLock.mockReset();
		mockReleaseLock.mockReset();
		mockCaptureException.mockReset();
		process.env.CRON_SECRET = CRON_SECRET;
		// Default: lock acquired, release succeeds — individual tests override.
		mockAcquireLock.mockResolvedValue({ token: "lock-token" });
		mockReleaseLock.mockResolvedValue(true);
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	it("close-due-cron::bad-bearer-returns-401", async () => {
		const res = await GET(cronRequest("Bearer wrong-secret"));
		expect(res.status).toBe(401);
		// No work was done.
		expect(mockAcquireLock).not.toHaveBeenCalled();
		expect(mockCloseDueMarkets).not.toHaveBeenCalled();
	});

	it("close-due-cron::missing-bearer-returns-401", async () => {
		const res = await GET(cronRequest(undefined));
		expect(res.status).toBe(401);
		expect(mockCloseDueMarkets).not.toHaveBeenCalled();
	});

	it("close-due-cron::missing-secret-env-returns-500", async () => {
		const original = process.env.CRON_SECRET;
		try {
			process.env.CRON_SECRET = undefined;
			const res = await GET(cronRequest(`Bearer ${CRON_SECRET}`));
			expect(res.status).toBe(500);
			expect(mockCloseDueMarkets).not.toHaveBeenCalled();
		} finally {
			process.env.CRON_SECRET = original;
		}
	});

	it("close-due-cron::held-lock-returns-200-locked", async () => {
		mockAcquireLock.mockResolvedValueOnce(null);

		const res = await GET(cronRequest(`Bearer ${CRON_SECRET}`));
		expect(res.status).toBe(200);
		const body = (await res.json()) as { status: string };
		expect(body.status).toBe("locked");
		// Sweep never ran under contention.
		expect(mockCloseDueMarkets).not.toHaveBeenCalled();
	});

	it("close-due-cron::happy-path-returns-200-ok-with-closed-count", async () => {
		mockCloseDueMarkets.mockResolvedValueOnce({
			closed: 1,
			skipped: 0,
			closedMarketIds: ["01234567-89ab-7def-8123-456789abcdef"],
		});

		const res = await GET(cronRequest(`Bearer ${CRON_SECRET}`));
		expect(res.status).toBe(200);
		const body = (await res.json()) as { status: string; closed: number };
		expect(body.status).toBe("ok");
		expect(body.closed).toBe(1);

		expect(mockCloseDueMarkets).toHaveBeenCalledTimes(1);
		// Lock released after the sweep.
		expect(mockReleaseLock).toHaveBeenCalled();
	});

	it("close-due-cron::sweep-throws-returns-200-error-with-capture", async () => {
		mockCloseDueMarkets.mockRejectedValueOnce(new Error("sweep blew up"));

		const res = await GET(cronRequest(`Bearer ${CRON_SECRET}`));
		expect(res.status).toBe(200);
		const body = (await res.json()) as { status: string };
		expect(body.status).toBe("error");
		// The handler-failure is Sentry-captured (A-2 alarm posture).
		expect(mockCaptureException).toHaveBeenCalled();
		// Lock still released in the finally.
		expect(mockReleaseLock).toHaveBeenCalled();
	});

	it("close-due-cron::lock-acquire-throws-returns-503", async () => {
		mockAcquireLock.mockRejectedValueOnce(new Error("upstash unreachable"));

		const res = await GET(cronRequest(`Bearer ${CRON_SECRET}`));
		expect(res.status).toBe(503);
		expect(mockCloseDueMarkets).not.toHaveBeenCalled();
	});
});
