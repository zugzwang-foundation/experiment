import { afterEach, describe, expect, it, vi } from "vitest";

// UI.13 — the server visitor-counter module (SPEC.1 §21.1). Mocks the Upstash
// singleton so we assert the env-namespaced key + read semantics without a live
// Redis. The key is the founder-pinned `visits:total:${ZUGZWANG_ENV}` (env-LAST,
// deliberately unlike getRedisKey's env-first): staging traffic must never land
// in the production number. counter.ts reads ZUGZWANG_ENV at CALL time (like
// getRedisKey), so per-test overrides take effect.

const hoisted = vi.hoisted(() => ({
	incr: vi.fn(),
	get: vi.fn(),
}));

vi.mock("@/server/upstash/redis", () => ({
	redis: { incr: hoisted.incr, get: hoisted.get },
}));

import { incrementAndRead, read } from "@/server/visitors/counter";

const ORIGINAL_ENV = process.env.ZUGZWANG_ENV;
afterEach(() => {
	process.env.ZUGZWANG_ENV = ORIGINAL_ENV;
	vi.clearAllMocks();
});

describe("UI.13 visitor counter — env-namespaced key + read/increment", () => {
	it("increments the env-namespaced key visits:total:<env>", async () => {
		process.env.ZUGZWANG_ENV = "preview";
		hoisted.incr.mockResolvedValue(42);
		const n = await incrementAndRead();
		expect(hoisted.incr).toHaveBeenCalledWith("visits:total:preview");
		expect(n).toBe(42);
	});

	it("namespaces the key by env — prod and preview never collide", async () => {
		hoisted.incr.mockResolvedValue(1);
		process.env.ZUGZWANG_ENV = "prod";
		await incrementAndRead();
		process.env.ZUGZWANG_ENV = "preview";
		await incrementAndRead();
		const keys = hoisted.incr.mock.calls.map((c) => c[0]);
		expect(keys).toEqual(["visits:total:prod", "visits:total:preview"]);
		expect(new Set(keys).size).toBe(2);
	});

	it("read() returns the parsed integer for the current env key", async () => {
		process.env.ZUGZWANG_ENV = "prod";
		hoisted.get.mockResolvedValue("12480");
		expect(await read()).toBe(12480);
		expect(hoisted.get).toHaveBeenCalledWith("visits:total:prod");
	});

	it("read() returns 0 when the key is unset (null)", async () => {
		process.env.ZUGZWANG_ENV = "prod";
		hoisted.get.mockResolvedValue(null);
		expect(await read()).toBe(0);
	});

	it("read() returns 0 on a non-numeric stored value", async () => {
		process.env.ZUGZWANG_ENV = "prod";
		hoisted.get.mockResolvedValue("not-a-number");
		expect(await read()).toBe(0);
	});

	it("throws on an invalid ZUGZWANG_ENV — never writes an unnamespaced key", async () => {
		process.env.ZUGZWANG_ENV = "unknown";
		await expect(incrementAndRead()).rejects.toThrow(/ZUGZWANG_ENV/);
		expect(hoisted.incr).not.toHaveBeenCalled();
	});
});
