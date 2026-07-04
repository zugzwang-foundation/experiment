import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// AUDIT-FIX-B1 A7 (rulings #5, #10-OVERRIDE, #11) tests-first — the GREENFIELD
// GET /api/cron/alarms-drain route handler. Mirrors close-due-markets/route.ts
// (the tests/server/cron anchor) MINUS the freeze gate: ops-hygiene crons don't
// gate on freeze (r2-orphan-sweep has none; the drain writes only processed_at),
// so there is NO `isFrozen` import to mock here.
//
// RED reason: GREENFIELD route — `@/app/api/cron/alarms-drain/route` is not on
// disk, so this file is COLLECTION-RED ("Cannot find module") until the
// implementer lands it. Wire-only: `drainCronAlarms` is unit/integration-tested
// separately, so it is MOCKED here — this file covers auth gate, lock, status
// mapping, the crash arm + Sentry tag, and lock-release-in-finally. No DB.

const { mockDrain } = vi.hoisted(() => ({ mockDrain: vi.fn() }));
vi.mock("@/server/observability/drain-cron-alarms", () => ({
	drainCronAlarms: mockDrain,
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

import { GET } from "@/app/api/cron/alarms-drain/route";

const CRON_SECRET = "test-cron-secret-32-bytes-minimum-xxxxx";

function cronRequest(authHeader?: string): Request {
	const headers = new Headers();
	if (authHeader !== undefined) {
		headers.set("authorization", authHeader);
	}
	return new Request("http://localhost/api/cron/alarms-drain", {
		method: "GET",
		headers,
	});
}

describe("GET /api/cron/alarms-drain wire surface (A7)", () => {
	beforeEach(() => {
		mockDrain.mockReset();
		mockAcquireLock.mockReset();
		mockReleaseLock.mockReset();
		mockCaptureException.mockReset();
		process.env.CRON_SECRET = CRON_SECRET;
		// Default: lock acquired, release succeeds, drain returns an empty result.
		mockAcquireLock.mockResolvedValue({ token: "lock-token" });
		mockReleaseLock.mockResolvedValue(true);
		mockDrain.mockResolvedValue({
			selected: 0,
			emitted: 0,
			stamped: 0,
			defaultPartitionCount: 0,
			flushed: true,
		});
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	it("alarms-drain-cron::missing-secret-env-returns-500", async () => {
		const original = process.env.CRON_SECRET;
		try {
			// `delete`, not `= undefined` (which coerces to the STRING "undefined",
			// truthy) — the close-due-markets S3 correction.
			delete process.env.CRON_SECRET;
			const res = await GET(cronRequest(`Bearer ${CRON_SECRET}`));
			expect(res.status).toBe(500);
			const body = (await res.json()) as { error: string };
			expect(body.error).toBe("error_cron_misconfigured");
			expect(mockDrain).not.toHaveBeenCalled();
		} finally {
			process.env.CRON_SECRET = original;
		}
	});

	it("alarms-drain-cron::bad-bearer-returns-401", async () => {
		const res = await GET(cronRequest("Bearer wrong-secret"));
		expect(res.status).toBe(401);
		const body = (await res.json()) as { error: string };
		expect(body.error).toBe("error_unauthenticated");
		// No work under a bad secret.
		expect(mockAcquireLock).not.toHaveBeenCalled();
		expect(mockDrain).not.toHaveBeenCalled();
	});

	it("alarms-drain-cron::missing-bearer-returns-401", async () => {
		const res = await GET(cronRequest(undefined));
		expect(res.status).toBe(401);
		expect(mockDrain).not.toHaveBeenCalled();
	});

	it("alarms-drain-cron::lock-acquire-throws-returns-503", async () => {
		mockAcquireLock.mockRejectedValueOnce(new Error("upstash unreachable"));
		const res = await GET(cronRequest(`Bearer ${CRON_SECRET}`));
		expect(res.status).toBe(503);
		const body = (await res.json()) as { error: string };
		expect(body.error).toBe("error_lock_unavailable");
		expect(mockDrain).not.toHaveBeenCalled();
	});

	it("alarms-drain-cron::held-lock-returns-200-locked", async () => {
		mockAcquireLock.mockResolvedValueOnce(null);
		const res = await GET(cronRequest(`Bearer ${CRON_SECRET}`));
		expect(res.status).toBe(200);
		const body = (await res.json()) as { status: string };
		expect(body.status).toBe("locked");
		// Drain never ran under contention.
		expect(mockDrain).not.toHaveBeenCalled();
	});

	it("alarms-drain-cron::happy-path-returns-200-ok-with-drain-counts", async () => {
		mockDrain.mockResolvedValueOnce({
			selected: 3,
			emitted: 3,
			stamped: 3,
			defaultPartitionCount: 0,
			flushed: true,
		});
		const res = await GET(cronRequest(`Bearer ${CRON_SECRET}`));
		expect(res.status).toBe(200);
		const body = (await res.json()) as {
			status: string;
			selected: number;
			emitted: number;
			stamped: number;
			defaultPartitionCount: number;
		};
		expect(body.status).toBe("ok");
		expect(body.selected).toBe(3);
		expect(body.emitted).toBe(3);
		expect(body.stamped).toBe(3);
		expect(body.defaultPartitionCount).toBe(0);

		expect(mockDrain).toHaveBeenCalledTimes(1);
		// Lock released after the drain.
		expect(mockReleaseLock).toHaveBeenCalled();
	});

	it("alarms-drain-cron::drain-throws-returns-200-error-with-capture-and-lock-release", async () => {
		const drainErr = new Error("drain blew up");
		mockDrain.mockRejectedValueOnce(drainErr);
		const res = await GET(cronRequest(`Bearer ${CRON_SECRET}`));
		expect(res.status).toBe(200);
		const body = (await res.json()) as { status: string };
		expect(body.status).toBe("error");
		// Handler-failure captured with the tag-matched container (naming precedent:
		// close_due_markets_handler_failure / orphan_sweep_handler_failure).
		expect(mockCaptureException).toHaveBeenCalledWith(drainErr, {
			tags: { kind: "alarms_drain_handler_failure" },
		});
		// Lock still released in the finally (crash path).
		expect(mockReleaseLock).toHaveBeenCalled();
	});
});
