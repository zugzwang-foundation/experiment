import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// AUDIT-FIX-B1 A17 (ruling #6) — SPEC.1 §16.3 byte-stable request-log shape lock.
// `logRequest` emits EXACTLY the seven locked keys (timestamp, user_id, route,
// status_code, ip, user_agent, latency_ms) and NOTHING else. The public-dataset
// extractor relies on this shape staying byte-stable.
//
// This is a SHAPE-LOCK REGRESSION GUARD, NOT a TDD driver: logRequest already
// exists and B1 does NOT change its shape (the §16.3⇄§17.6 field reconciliation is
// B8/G2, out of this batch), so this file is GREEN by design. It fails only if
// A17's wiring perturbs the locked field set — which is exactly what it guards.
// (The A17 wiring itself is RED-tested in the endpoint / sign-route log-request
// files.) `@vercel/functions` ipAddress is mocked for a deterministic `ip`.

vi.mock("@vercel/functions", () => ({ ipAddress: () => "203.0.113.9" }));

import { logRequest } from "@/server/middleware/logging";

const LOCKED_KEYS = [
	"timestamp",
	"user_id",
	"route",
	"status_code",
	"ip",
	"user_agent",
	"latency_ms",
].sort();

let logSpy: ReturnType<typeof vi.spyOn>;

describe("logRequest — SPEC.1 §16.3 byte-stable 7-field shape (A17 lock)", () => {
	beforeEach(() => {
		logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
	});
	afterEach(() => {
		logSpy.mockRestore();
		vi.clearAllMocks();
	});

	it("log-request-shape::emits-exactly-the-seven-locked-keys", () => {
		const request = new Request("https://prd.example.com/api/bets/place", {
			method: "POST",
			headers: { "user-agent": "vitest-ua" },
		});
		logRequest({
			request,
			status: 200,
			userId: "0190b3a0-7777-7000-8000-000000000077",
			startedAt: Date.now() - 12,
		});

		expect(logSpy).toHaveBeenCalledTimes(1);
		const line = logSpy.mock.calls[0]?.[0] as string;
		const parsed = JSON.parse(line) as Record<string, unknown>;

		// EXACTLY the seven locked keys — no more, no less.
		expect(Object.keys(parsed).sort()).toEqual(LOCKED_KEYS);
		// Load-bearing field values.
		expect(parsed.route).toBe("/api/bets/place");
		expect(parsed.status_code).toBe(200);
		expect(parsed.user_id).toBe("0190b3a0-7777-7000-8000-000000000077");
		expect(parsed.user_agent).toBe("vitest-ua");
		expect(typeof parsed.latency_ms).toBe("number");
		expect(typeof parsed.timestamp).toBe("string");
	});

	it("log-request-shape::null-user-still-seven-keys", () => {
		const request = new Request(
			"https://prd.example.com/admin/markets/media/sign",
			{ method: "POST", headers: { "user-agent": "vitest-ua" } },
		);
		logRequest({ request, status: 503, userId: null, startedAt: Date.now() });

		const line = logSpy.mock.calls[0]?.[0] as string;
		const parsed = JSON.parse(line) as Record<string, unknown>;
		expect(Object.keys(parsed).sort()).toEqual(LOCKED_KEYS);
		expect(parsed.user_id).toBeNull();
		expect(parsed.route).toBe("/admin/markets/media/sign");
	});
});
