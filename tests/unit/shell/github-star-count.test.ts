import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { readStarCount } from "@/server/github/star-count";

/**
 * GH-STAR — the read. Two things are pinned here, and the second is the one that
 * would otherwise be invisible.
 *
 * 1. Every failure resolves to `null` and none of them throws. A thrown error
 *    from this call would take the whole global header down on every route.
 * 2. ⛔ THE CACHE DIRECTIVE AND THE ABSENT `authorization` HEADER. At 15-minute
 *    revalidation this is 4 requests/hour against GitHub's 60/hour
 *    unauthenticated per-IP budget. Drop the directive, or add a PAT — which
 *    disables the Data Cache via Next's `hasUnCacheableHeader` branch — and
 *    every render hits `api.github.com`, the budget burns within minutes, and
 *    the failure path becomes the permanent path.
 *
 *    That regression is silent by construction: the failure path is a SUPPORTED
 *    state, the component renders it correctly, and nothing goes red. This test
 *    is the only thing in the repository that can see it, which is why the
 *    header object is pinned by exact equality rather than by `objectContaining`
 *    — an added header must fail, not pass.
 */

const GITHUB_API_URL =
	"https://api.github.com/repos/zugzwang-foundation/experiment";

const fetchMock = vi.fn();

beforeEach(() => {
	vi.stubGlobal("fetch", fetchMock);
	fetchMock.mockReset();
	// The failure paths log deliberately; keep the suite output readable.
	vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

function jsonResponse(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), { status });
}

describe("GH-STAR readStarCount — 0 is a value, everything else is null", () => {
	it("⭐ stargazers_count: 0 returns 0, NOT null", async () => {
		fetchMock.mockResolvedValue(jsonResponse({ stargazers_count: 0 }));

		const stars = await readStarCount();

		// `toBe(0)` and `not.toBeNull()` are both stated: a `?? null` coercion
		// would fail the first, a `|| null` would fail both.
		expect(stars).toBe(0);
		expect(stars).not.toBeNull();
	});

	it("a real count comes back unchanged", async () => {
		fetchMock.mockResolvedValue(jsonResponse({ stargazers_count: 1234 }));

		expect(await readStarCount()).toBe(1234);
	});

	it("403 (the rate limit) returns null", async () => {
		fetchMock.mockResolvedValue(
			jsonResponse({ message: "API rate limit exceeded" }, 403),
		);

		expect(await readStarCount()).toBeNull();
	});

	it("a rejected fetch (timeout / network) returns null and does not throw", async () => {
		const abort = new Error("The operation was aborted due to timeout");
		abort.name = "TimeoutError";
		fetchMock.mockRejectedValue(abort);

		// `.resolves` is the assertion: a rejection here would fail the test
		// rather than merely returning something unexpected.
		await expect(readStarCount()).resolves.toBeNull();
	});

	it("a body with no usable stargazers_count returns null", async () => {
		for (const body of [
			{},
			{ stargazers_count: null },
			{ stargazers_count: "42" },
			{ stargazers_count: Number.NaN },
			[],
			"not json at all",
		]) {
			fetchMock.mockResolvedValue(jsonResponse(body));
			expect(await readStarCount(), JSON.stringify(body)).toBeNull();
		}
	});

	it("malformed JSON returns null (res.json() throws)", async () => {
		fetchMock.mockResolvedValue(
			new Response("<html>502</html>", { status: 200 }),
		);

		await expect(readStarCount()).resolves.toBeNull();
	});

	it("⭐ the request carries revalidate 900 + a signal + NO authorization header", async () => {
		fetchMock.mockResolvedValue(jsonResponse({ stargazers_count: 0 }));

		await readStarCount();

		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(fetchMock).toHaveBeenCalledWith(
			GITHUB_API_URL,
			expect.objectContaining({
				// The Data Cache directive. Without it, force-dynamic drags this
				// fetch to revalidate: 0 and every render hits GitHub.
				next: { revalidate: 900 },
				// The header never waits on GitHub indefinitely.
				signal: expect.any(AbortSignal),
			}),
		);

		// EXACT equality on the header bag — an added `authorization` (or any
		// other header) fails here rather than slipping through.
		const [, init] = fetchMock.mock.calls[0];
		expect(init.headers).toEqual({ accept: "application/vnd.github+json" });
		expect(
			Object.keys(init.headers).map((k: string) => k.toLowerCase()),
		).not.toContain("authorization");
	});
});
