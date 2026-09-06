import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Per SCAFFOLD.15 plan §5.1 — substrate test for `signRead(key, ttlSeconds)`.
// `signRead` is a thin wrapper around `mintReadUrl("uploads", key,
// ttlSeconds)` (no DB hit, no validation — caller decides TTL). This file
// proves the wrapper composes correctly so DEBATE.4 (render path, 3600s)
// and SCAFFOLD.15-internal moderation (60s) hit the same seam.
//
// Mocks:
//   - `@/server/storage/r2` `mintReadUrl` — scripted return; assert args
//     verbatim. No real R2.
//
// NOT a DB-touching test — sign-read doesn't touch Postgres. Lives under
// tests/integration/ to match the SCAFFOLD.15 plan §9.1 file layout
// directive (all five test files in tests/integration/).

const { mockMintReadUrl } = vi.hoisted(() => ({
	mockMintReadUrl: vi.fn(),
}));

vi.mock("@/server/storage/r2", () => ({
	mintReadUrl: mockMintReadUrl,
	mintPutUrl: vi.fn(),
	headObject: vi.fn(),
	deleteObject: vi.fn(),
}));

import { READ_URL_TTL_SECONDS_MODERATION } from "@/server/config/limits";
import {
	__resetReadUrlMemo,
	DOWNSTREAM_NONE,
} from "@/server/storage/read-url-memo";
import { signRead } from "@/server/storage/sign-read";

beforeEach(() => {
	mockMintReadUrl.mockReset();
	// ⚠ The memo outlives a single `it()`. Without this, a second case reusing
	// an object key would be served the FIRST case's URL against a reset mock —
	// a green that proves nothing. These cases happen to use distinct keys
	// (u1…u5), so the suite passed on a coincidence; this makes it not one.
	__resetReadUrlMemo();
});

afterEach(() => {
	vi.clearAllMocks();
});

describe("signRead (SCAFFOLD.15 §5.1)", () => {
	it("sign-read::wraps-mintReadUrl-with-uploads-bucket", async () => {
		// Wrapper always targets the "uploads" bucket (NOT "pfp"). SCAFFOLD.15
		// doesn't ship a pfp-bucket render path; that's SCAFFOLD.17 + DEBATE.4.
		const scripted = "https://r2.example/u/u1/abc.jpg?X-Amz-Signature=read";
		mockMintReadUrl.mockResolvedValueOnce(scripted);

		const url = await signRead("u/u1/abc.jpg", 60, DOWNSTREAM_NONE, null);

		expect(mockMintReadUrl).toHaveBeenCalledTimes(1);
		// `null` (no caching directive) forwards as `undefined`, so the
		// GetObjectCommand carries no `ResponseCacheControl` at all rather than an
		// empty one.
		expect(mockMintReadUrl).toHaveBeenCalledWith(
			"uploads",
			"u/u1/abc.jpg",
			60,
			undefined,
			expect.any(Date),
		);
		expect(url).toBe(scripted);
	});

	it("sign-read::passes-caller-ttl-verbatim-3600", async () => {
		// Caller-chosen TTL is passed verbatim (no clamp / no override).
		// The render path uses 7200 (ADR-0041 D-6, raised from 3600 so a URL
		// survives its cache entry's serve window); 3600 here is simply an
		// arbitrary caller value, which is the whole point of "verbatim".
		mockMintReadUrl.mockResolvedValueOnce("https://r2.example/render?sig");
		await signRead("u/u2/long.png", 3600, DOWNSTREAM_NONE, null);
		expect(mockMintReadUrl).toHaveBeenCalledWith(
			"uploads",
			"u/u2/long.png",
			3600,
			undefined,
			expect.any(Date),
		);
	});

	it("sign-read::passes-caller-ttl-verbatim-moderation-60s", async () => {
		// ⚠ The moderation PATH now calls `signReadSingleUse`, not this — see
		// sign-read.ts for why a fail-closed CSAM gate must not be memoised.
		// The 60s forwarding contract asserted here is still `signRead`'s, and
		// review-feed.ts still uses it at that TTL.
		// SCAFFOLD.15 moderation path uses the 60s read TTL via the named
		// constant READ_URL_TTL_SECONDS_MODERATION = 60. Test asserts both
		// the constant value AND that signRead forwards it untouched (so
		// the precommit moderate path's signed-URL TTL matches the spec).
		mockMintReadUrl.mockResolvedValueOnce("https://r2.example/mod?sig");

		await signRead(
			"u/u3/moderate.jpg",
			READ_URL_TTL_SECONDS_MODERATION,
			DOWNSTREAM_NONE,
			// `null` is the admin feed's real argument: a 60s URL must not carry a
			// year-long browser caching directive. See sign-read.ts.
			null,
		);

		expect(mockMintReadUrl).toHaveBeenCalledWith(
			"uploads",
			"u/u3/moderate.jpg",
			READ_URL_TTL_SECONDS_MODERATION,
			undefined,
			expect.any(Date),
		);
		// Sanity floor: 60s for moderation (matches Q3 ratification +
		// SPEC.2 §10.10).
		expect(READ_URL_TTL_SECONDS_MODERATION).toBe(60);
	});

	it("sign-read::returns-mintReadUrl-result-unchanged", async () => {
		// Pure pass-through; no URL post-processing.
		const scripted = "https://example.r2.cloudflarestorage.com/x?a=1&b=2";
		mockMintReadUrl.mockResolvedValueOnce(scripted);
		const out = await signRead("u/u4/photo.webp", 60, DOWNSTREAM_NONE, null);
		expect(out).toBe(scripted);
	});

	it("sign-read::bubbles-mintReadUrl-throw", async () => {
		// If mintReadUrl throws (R2 unavailable), the wrapper does NOT
		// catch — the caller (precommitModerate) decides posture. SCAFFOLD.15
		// caller fails CLOSED via ModerationUnavailableError.
		const networkError = new Error("ECONNREFUSED to R2");
		mockMintReadUrl.mockRejectedValueOnce(networkError);

		await expect(
			signRead("u/u5/x.jpg", 60, DOWNSTREAM_NONE, null),
		).rejects.toBe(networkError);
	});
});
