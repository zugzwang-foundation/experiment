import { beforeEach, describe, expect, it, vi } from "vitest";

// UI.13 — POST /api/visits (SPEC.1 §21.1). Uses the REAL `isbot` (the bot
// filter IS the acceptance criterion — real crawler UA strings in, no
// increment out); mocks the counter module + the module-local Ratelimit so no
// live Redis is touched. A vanity counter never renders an error: bot / cap /
// Redis-down all return HTTP 200, never a 429 or an error body.

const hoisted = vi.hoisted(() => ({
	limit: vi.fn(),
	incrementAndRead: vi.fn(),
	read: vi.fn(),
}));

vi.mock("@upstash/ratelimit", () => {
	const Ratelimit = vi.fn(() => ({ limit: hoisted.limit }));
	Object.assign(Ratelimit, {
		slidingWindow: vi.fn(() => "sliding-window-mock"),
	});
	return { Ratelimit };
});
vi.mock("@/server/upstash/redis", () => ({ redis: {} }));
vi.mock("@/server/visitors/counter", () => ({
	incrementAndRead: hoisted.incrementAndRead,
	read: hoisted.read,
}));

import { POST } from "@/app/api/visits/route";

const HUMAN_UA =
	"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36";

function req(ua: string, ip = "1.2.3.4"): Request {
	return new Request("http://localhost/api/visits", {
		method: "POST",
		headers: { "user-agent": ua, "x-forwarded-for": ip },
	});
}

beforeEach(() => {
	vi.clearAllMocks();
	hoisted.limit.mockResolvedValue({ success: true, remaining: 59, reset: 0 });
	hoisted.incrementAndRead.mockResolvedValue(101);
	hoisted.read.mockResolvedValue(100);
});

describe("UI.13 POST /api/visits — bot filter, per-IP cap, P5 fallback", () => {
	const BOTS = [
		"Googlebot/2.1 (+http://www.google.com/bot.html)",
		"Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)",
	];
	for (const ua of BOTS) {
		it(`bot UA returns current total WITHOUT incrementing: ${ua.slice(0, 20)}`, async () => {
			const res = await POST(req(ua));
			expect(res.status).toBe(200);
			expect(await res.json()).toEqual({ total: 100 });
			expect(hoisted.incrementAndRead).not.toHaveBeenCalled();
			expect(hoisted.read).toHaveBeenCalledTimes(1);
		});
	}

	it("human under the cap increments and returns the new total", async () => {
		const res = await POST(req(HUMAN_UA));
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ total: 101 });
		expect(hoisted.incrementAndRead).toHaveBeenCalledTimes(1);
		expect(hoisted.read).not.toHaveBeenCalled();
	});

	it("cap exceeded returns current total WITHOUT incrementing (200, not 429)", async () => {
		hoisted.limit.mockResolvedValue({
			success: false,
			reset: Date.now() + 1000,
		});
		const res = await POST(req(HUMAN_UA));
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ total: 100 });
		expect(hoisted.incrementAndRead).not.toHaveBeenCalled();
	});

	it("Redis unreachable on the increment path → { total: null }, 200, never throws", async () => {
		hoisted.incrementAndRead.mockRejectedValue(new Error("redis down"));
		const res = await POST(req(HUMAN_UA));
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ total: null });
	});

	// The "never errors" guarantee holds for a throw from ANY branch, not just
	// the increment path (code-reviewer LOW): the bot/cap read() and the cap
	// check itself are inside the same try → the P5 fallback (code-reviewer L1).
	it("Redis throw on the bot-path read() → { total: null }, 200", async () => {
		hoisted.read.mockRejectedValue(new Error("redis down"));
		const res = await POST(
			req("Googlebot/2.1 (+http://www.google.com/bot.html)"),
		);
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ total: null });
	});

	it("Redis throw on the cap-path read() → { total: null }, 200", async () => {
		hoisted.limit.mockResolvedValue({ success: false, reset: 0 });
		hoisted.read.mockRejectedValue(new Error("redis down"));
		const res = await POST(req(HUMAN_UA));
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ total: null });
	});

	it("Redis throw from the rate-limit check itself → { total: null }, 200", async () => {
		hoisted.limit.mockRejectedValue(new Error("redis down"));
		const res = await POST(req(HUMAN_UA));
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ total: null });
		expect(hoisted.incrementAndRead).not.toHaveBeenCalled();
	});
});
