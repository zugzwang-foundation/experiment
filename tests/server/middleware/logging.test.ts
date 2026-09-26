import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Per SCAFFOLD.7 + SPEC.1 §16.3 H3 — substrate-only test for the structured
// request-log emitter. No external transport, no DB, no Upstash; the helper
// shells out to `console.log(JSON.stringify(row))` so the test spies on
// console.log, parses the row, and verifies the field set.
//
// S-1 / ADR-0061 — the ip column comes from the shared trusted-IP helper
// (`src/server/middleware/client-ip.ts`); the derivation matrix is pinned in
// `tests/unit/middleware/client-ip.test.ts`. Requests here carry a single
// X-Forwarded-For hop — what the ALB appends — rather than mocking a platform.

import { logRequest } from "@/server/middleware/logging";

const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});

beforeEach(() => {
	consoleLogSpy.mockClear();
	vi.stubEnv("VERCEL", "");
});

afterEach(() => {
	// clearAllMocks (not restoreAllMocks) — restoreAllMocks would detach the
	// module-level spy after the first test, breaking subsequent assertions.
	vi.clearAllMocks();
	vi.unstubAllEnvs();
});

describe("logRequest", () => {
	it("emits the SPEC.1 §16.3 seven-field shape", () => {
		const request = new Request("https://example.com/api/markets/abc?x=1", {
			headers: {
				"user-agent": "Mozilla/5.0 (test)",
				"x-forwarded-for": "203.0.113.42",
			},
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

/**
 * S-1 / ADR-0061 — the IP column behind Cloudflare + the ALB, and on Vercel.
 *
 * This file used to pin "falls back to the FIRST hop of x-forwarded-for" —
 * the exact behaviour S-1 removes: the first hop is whatever the client sent.
 * The column now carries the same trusted value the per-IP limits use.
 */
describe("S-1 — client IP column", () => {
	const read = (): Record<string, unknown> =>
		JSON.parse(consoleLogSpy.mock.calls[0]?.[0] as string) as Record<
			string,
			unknown
		>;

	it("takes the ALB-appended LAST hop, never a client-sent first hop", () => {
		const request = new Request("https://example.com/api/x", {
			headers: { "x-forwarded-for": "198.51.100.7, 10.0.0.5, 203.0.113.9" },
		});
		logRequest({ request, status: 200, userId: null, startedAt: Date.now() });
		expect(read().ip).toBe("203.0.113.9");
	});

	it("takes CF-Connecting-IP when the ALB peer is a Cloudflare edge", () => {
		const request = new Request("https://example.com/api/x", {
			headers: {
				"x-forwarded-for": "6.6.6.6, 198.51.100.7, 162.158.1.2",
				"cf-connecting-ip": "198.51.100.7",
			},
		});
		logRequest({ request, status: 200, userId: null, startedAt: Date.now() });
		expect(read().ip).toBe("198.51.100.7");
	});

	it("ignores a client-sent x-real-ip off Vercel", () => {
		const request = new Request("https://example.com/api/x", {
			headers: { "x-real-ip": "198.51.100.9" },
		});
		logRequest({ request, status: 200, userId: null, startedAt: Date.now() });
		expect(read().ip).toBeNull();
	});

	it("reads Vercel's x-real-ip on Vercel", () => {
		vi.stubEnv("VERCEL", "1");
		const request = new Request("https://example.com/api/x", {
			headers: { "x-real-ip": "198.51.100.9", "x-forwarded-for": "6.6.6.6" },
		});
		logRequest({ request, status: 200, userId: null, startedAt: Date.now() });
		expect(read().ip).toBe("198.51.100.9");
	});

	it("is null when no header carries one — never a fabricated address", () => {
		const request = new Request("https://example.com/api/x");
		logRequest({ request, status: 200, userId: null, startedAt: Date.now() });
		expect(read().ip).toBeNull();
	});
});
