import { afterEach, describe, expect, it, vi } from "vitest";

import { GET } from "@/app/api/dataset/manifest/route";

/**
 * DATASET.3 Slice 6 · `GET /api/dataset/manifest` (SPEC.2 §19.7).
 *
 * ## Why this route was built rather than deferred
 *
 * The brief admitted it **conditionally**: only if §19.7 states unambiguously
 * what the endpoint is for, given that the archive is published through a
 * GitHub release. §19.7 says so directly — *"a thin static-file pointer; it
 * does not serve the tarball itself … the endpoint exists to make programmatic
 * discovery possible"* — and names the pre-release behaviour too. So the
 * condition is met on the text, not on a reading of it.
 *
 * ## What has to be true of a PUBLIC route six weeks before the freeze
 *
 * It touches no database, holds no secret, requires no session, and cannot be
 * made to do work. Each of those is asserted below rather than argued, because
 * "it obviously doesn't" is what every unaudited public route has said.
 */

afterEach(() => {
	vi.useRealTimers();
});

describe("§19.7 · the pre-release state", () => {
	it("returns 503 error_dataset_not_yet_released before the release date", async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-09-01T20:41:00.000Z"));

		const res = await GET(
			new Request("https://zugzwang.world/api/dataset/manifest"),
		);
		expect(res.status).toBe(503);

		const body = (await res.json()) as { ok: boolean; error: { code: string } };
		// ⚠ The CODE, verbatim from §19.7 — not merely "some 503". A researcher's
		// tooling branches on this string, and a route that returned 503 with a
		// different code would satisfy a status-only assertion while breaking
		// every client the section exists to enable.
		expect(body.error.code).toBe("error_dataset_not_yet_released");
		expect(body.ok).toBe(false);
	});

	it("⚠ is still 503 AFTER the date while nothing has been published", async () => {
		// ⚠ **Fail-closed, and the second condition is not redundant.** The date
		// passing is a fact about the calendar; the manifest existing is a fact
		// about whether the operator's build finished. Serving on the date alone
		// would answer 200 with an empty body on the morning of 6 November — the
		// one morning this route is actually read.
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-11-06T06:00:00.000Z"));

		const res = await GET(
			new Request("https://zugzwang.world/api/dataset/manifest"),
		);
		expect(res.status).toBe(503);
		const body = (await res.json()) as { error: { code: string } };
		expect(body.error.code).toBe("error_dataset_not_yet_released");
	});

	it("the date comparison is UTC, not the server's local day", async () => {
		// ⚠ The freeze is 2026-11-05 23:59 UTC and the dataset is dated
		// 2026-11-06. A server in a positive offset comparing local days would
		// flip this route hours early — invisible in every test that runs in
		// UTC, and visible exactly once, on the day.
		vi.useFakeTimers();
		// 2026-11-05 23:00 UTC is already 2026-11-06 in IST (+05:30).
		vi.setSystemTime(new Date("2026-11-05T23:00:00.000Z"));
		const res = await GET(
			new Request("https://zugzwang.world/api/dataset/manifest"),
		);
		expect(res.status).toBe(503);
	});
});

describe("§19.7 · what this route must NOT do", () => {
	it("carries an X-Request-Id on every response (§4.4)", async () => {
		const res = await GET(
			new Request("https://zugzwang.world/api/dataset/manifest", {
				headers: { "x-request-id": "trace-abc-123" },
			}),
		);
		expect(res.headers.get("X-Request-Id")).toBe("trace-abc-123");
	});

	it("mints a request id rather than reflecting an unsafe one", async () => {
		// A reflected CR/LF-poisoned header throws in the `Response`
		// constructor and self-500s the request — the reason `resolveRequestId`
		// echoes only a safe token.
		const res = await GET(
			new Request("https://zugzwang.world/api/dataset/manifest", {
				headers: { "x-request-id": "unsafe/token$1" },
			}),
		);
		const id = res.headers.get("X-Request-Id");
		expect(id).toBeTruthy();
		expect(id).not.toContain("unsafe");
		// …and what it minted is a UUID, not an empty string.
		expect(id).toMatch(
			/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
		);
	});

	it("the pre-release answer carries Retry-After, and does NOT claim to be cached", async () => {
		// ⚠ **This test was named "is CACHEABLE" and asserted `Retry-After`**
		// (`@security-auditor` L-5). It passed, and it certified a property
		// nothing implemented: the constant was called `CACHE_BEFORE`, its
		// docblock described caching behaviour, and it was being handed to
		// `jsonResponse` as the `retryAfterHeader` argument — so no
		// `Cache-Control` was ever emitted. A test whose NAME and whose
		// ASSERTION disagree is a false receipt for whichever of the two a
		// reader happens to trust, and the name is the half that gets read.
		//
		// `Retry-After` is the right header for a 503 that flips once, so the
		// behaviour stayed and the name and the constant moved to match it.
		const res = await GET(
			new Request("https://zugzwang.world/api/dataset/manifest"),
		);
		expect(res.status).toBe(503);
		expect(res.headers.get("Retry-After")).toBe("300");
		// …and it is NOT advertised as cacheable, because a cached 503 outlives
		// the state it describes — on the one morning this route is read.
		expect(res.headers.get("Cache-Control")).toBeNull();
	});

	it("the module imports NO database and NO build path", async () => {
		// ⚠ A source scan, and it is the right shape here: the claim is about
		// the module's import graph, which is a property of the text. A runtime
		// assertion would only prove that THIS request did not reach the
		// database, not that no request could.
		//
		// ⚠ Comments are stripped first. This project has recorded six
		// occasions where a negative source scan matched the comment explaining
		// the absence rather than the code — including in this very file's
		// docblock, which names `@/db` while asserting it is not imported.
		const { readFileSync } = await import("node:fs");
		const src = readFileSync("src/app/api/dataset/manifest/route.ts", "utf8")
			.replace(/\/\*[\s\S]*?\*\//g, "")
			.replace(/\/\/.*$/gm, "");

		for (const forbidden of [
			"@/db",
			"drizzle",
			"buildDataset",
			"drizzleSource",
			"getSession",
			"requireAdminSession",
			"process.env",
		]) {
			expect(
				src,
				`${forbidden} must not be reachable from this route`,
			).not.toContain(forbidden);
		}

		// POSITIVE CONTROL — the scan can find things, and the comment strip
		// did not eat the file. Without this, every assertion above is
		// satisfied by an empty string.
		expect(src).toContain("export async function GET");
		expect(src).toContain("error_dataset_not_yet_released");
		expect(src.length).toBeGreaterThan(400);
	});

	it("no runtime = 'edge' export (ADR-0003)", async () => {
		const { readFileSync } = await import("node:fs");
		const src = readFileSync("src/app/api/dataset/manifest/route.ts", "utf8");
		expect(src).not.toMatch(/export\s+const\s+runtime\s*=\s*["']edge["']/);
	});
});
