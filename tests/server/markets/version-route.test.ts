import { beforeEach, describe, expect, it, vi } from "vitest";

// CACHE-COALESCE-3 — the version route's outcomes on the wire.
//
// `DebatePoll` treats any non-200 as "no change this tick", so what a status
// code decides here is what the edge caches and what a load test counts. A
// fresh token is edge-cached as before; a stale token gets a SHORT edge life
// so the next tick asks again; nothing to serve is a 503 the edge must not
// cache; and the route never answers 500.

const { getVersionToken, notFound } = vi.hoisted(() => ({
	getVersionToken: vi.fn(),
	notFound: vi.fn(() => {
		throw new Error("NEXT_NOT_FOUND");
	}),
}));
vi.mock("@/server/markets/version-token", () => ({ getVersionToken }));
vi.mock("next/navigation", () => ({ notFound }));

import { GET } from "@/app/(public)/m/[slug]/version/route";

const call = () =>
	GET(new Request("http://localhost/m/x/version"), {
		params: Promise.resolve({ slug: "bitcoin-price-50k" }),
	});

beforeEach(() => {
	getVersionToken.mockReset();
	notFound.mockClear();
});

describe("GET /m/[slug]/version", () => {
	it("a fresh token: 200, edge-cached as before", async () => {
		getVersionToken.mockResolvedValue({ kind: "token", token: "abc" });
		const res = await call();
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ v: "abc" });
		expect(res.headers.get("cache-control")).toBe(
			"public, s-maxage=5, stale-while-revalidate=25",
		);
	});

	it("database unavailable, earlier token known: 200 with that token and a short edge life", async () => {
		getVersionToken.mockResolvedValue({
			kind: "unavailable",
			lastToken: "old",
		});
		const res = await call();
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ v: "old" });
		expect(res.headers.get("cache-control")).toBe("public, s-maxage=2");
	});

	it("database unavailable, nothing to serve: 503, not cached, never 500", async () => {
		getVersionToken.mockResolvedValue({
			kind: "unavailable",
			lastToken: null,
		});
		const res = await call();
		expect(res.status).toBe(503);
		expect(res.headers.get("cache-control")).toBe("no-store");
		expect(res.headers.get("retry-after")).toBe("5");
	});

	it("an unknown market: notFound()", async () => {
		getVersionToken.mockResolvedValue({ kind: "not-found" });
		await expect(call()).rejects.toThrow("NEXT_NOT_FOUND");
		expect(notFound).toHaveBeenCalledTimes(1);
	});

	it("passes the slug from the path, untouched", async () => {
		getVersionToken.mockResolvedValue({ kind: "token", token: "abc" });
		await call();
		expect(getVersionToken).toHaveBeenCalledWith("bitcoin-price-50k");
	});
});
