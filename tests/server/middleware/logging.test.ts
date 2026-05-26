import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Per SCAFFOLD.7 + SPEC.1 §16.3 H3 — substrate-only test for the structured
// request-log emitter. No external transport, no DB, no Upstash; the helper
// shells out to `console.log(JSON.stringify(row))` so the test spies on
// console.log, parses the row, and verifies the field set.
//
// Vercel `ipAddress()` is mocked so the test environment (no x-real-ip /
// x-forwarded-for headers) returns a deterministic value rather than the
// undefined the helper would otherwise see locally.

const { mockIpAddress } = vi.hoisted(() => ({
	mockIpAddress: vi.fn(),
}));

vi.mock("@vercel/functions", () => ({
	ipAddress: mockIpAddress,
}));

import { logRequest } from "@/server/middleware/logging";

const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});

beforeEach(() => {
	consoleLogSpy.mockClear();
	mockIpAddress.mockReset();
});

afterEach(() => {
	// clearAllMocks (not restoreAllMocks) — restoreAllMocks would detach the
	// module-level spy after the first test, breaking subsequent assertions.
	vi.clearAllMocks();
});

describe("logRequest", () => {
	it("emits the SPEC.1 §16.3 seven-field shape", () => {
		mockIpAddress.mockReturnValue("203.0.113.42");
		const request = new Request("https://example.com/api/markets/abc?x=1", {
			headers: { "user-agent": "Mozilla/5.0 (test)" },
		});

		logRequest({
			request,
			status: 200,
			userId: "user-123",
			startedAt: Date.now() - 250,
		});

		expect(consoleLogSpy).toHaveBeenCalledTimes(1);
		const payload = consoleLogSpy.mock.calls[0]?.[0];
		expect(typeof payload).toBe("string");
		const row = JSON.parse(payload as string);

		// Field set locked at seven keys, no additions, no missing.
		expect(Object.keys(row).sort()).toEqual([
			"ip",
			"latency_ms",
			"route",
			"status_code",
			"timestamp",
			"user_agent",
			"user_id",
		]);

		expect(row.user_id).toBe("user-123");
		expect(row.route).toBe("/api/markets/abc");
		expect(row.status_code).toBe(200);
		expect(row.ip).toBe("203.0.113.42");
		expect(row.user_agent).toBe("Mozilla/5.0 (test)");
		expect(typeof row.timestamp).toBe("string");
		expect(new Date(row.timestamp).toISOString()).toBe(row.timestamp);
		expect(row.latency_ms).toBeGreaterThanOrEqual(0);
	});

	it("emits null user_id, ip, user_agent when the request lacks them", () => {
		mockIpAddress.mockReturnValue(undefined);
		const request = new Request("https://example.com/api/health");

		logRequest({
			request,
			status: 200,
			userId: null,
			startedAt: Date.now(),
		});

		const payload = consoleLogSpy.mock.calls[0]?.[0];
		const row = JSON.parse(payload as string);

		expect(row.user_id).toBeNull();
		expect(row.ip).toBeNull();
		expect(row.user_agent).toBeNull();
	});

	it("strips query string from route (path-only per §16.3)", () => {
		mockIpAddress.mockReturnValue("198.51.100.7");
		const request = new Request(
			"https://example.com/api/dataset/manifest?since=2026-05-01",
		);

		logRequest({
			request,
			status: 200,
			userId: null,
			startedAt: Date.now(),
		});

		const payload = consoleLogSpy.mock.calls[0]?.[0];
		const row = JSON.parse(payload as string);
		expect(row.route).toBe("/api/dataset/manifest");
	});
});
