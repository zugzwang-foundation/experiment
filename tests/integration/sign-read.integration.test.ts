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
import { signRead } from "@/server/storage/sign-read";

beforeEach(() => {
	mockMintReadUrl.mockReset();
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

		const url = await signRead("u/u1/abc.jpg", 60);

		expect(mockMintReadUrl).toHaveBeenCalledTimes(1);
		expect(mockMintReadUrl).toHaveBeenCalledWith("uploads", "u/u1/abc.jpg", 60);
		expect(url).toBe(scripted);
	});

	it("sign-read::passes-caller-ttl-verbatim-3600", async () => {
		// Caller-chosen TTL is passed verbatim (no clamp / no override).
		// DEBATE.4 will use 3600 (1h) for render; this wrapper is the seam.
		mockMintReadUrl.mockResolvedValueOnce("https://r2.example/render?sig");
		await signRead("u/u2/long.png", 3600);
		expect(mockMintReadUrl).toHaveBeenCalledWith(
			"uploads",
			"u/u2/long.png",
			3600,
		);
	});

	it("sign-read::passes-caller-ttl-verbatim-moderation-60s", async () => {
		// SCAFFOLD.15 moderation path uses the 60s read TTL via the named
		// constant READ_URL_TTL_SECONDS_MODERATION = 60. Test asserts both
		// the constant value AND that signRead forwards it untouched (so
		// the precommit moderate path's signed-URL TTL matches the spec).
		mockMintReadUrl.mockResolvedValueOnce("https://r2.example/mod?sig");

		await signRead("u/u3/moderate.jpg", READ_URL_TTL_SECONDS_MODERATION);

		expect(mockMintReadUrl).toHaveBeenCalledWith(
			"uploads",
			"u/u3/moderate.jpg",
			READ_URL_TTL_SECONDS_MODERATION,
		);
		// Sanity floor: 60s for moderation (matches Q3 ratification +
		// SPEC.2 §10.10).
		expect(READ_URL_TTL_SECONDS_MODERATION).toBe(60);
	});

	it("sign-read::returns-mintReadUrl-result-unchanged", async () => {
		// Pure pass-through; no URL post-processing.
		const scripted = "https://example.r2.cloudflarestorage.com/x?a=1&b=2";
		mockMintReadUrl.mockResolvedValueOnce(scripted);
		const out = await signRead("u/u4/photo.webp", 60);
		expect(out).toBe(scripted);
	});

	it("sign-read::bubbles-mintReadUrl-throw", async () => {
		// If mintReadUrl throws (R2 unavailable), the wrapper does NOT
		// catch — the caller (precommitModerate) decides posture. SCAFFOLD.15
		// caller fails CLOSED via ModerationUnavailableError.
		const networkError = new Error("ECONNREFUSED to R2");
		mockMintReadUrl.mockRejectedValueOnce(networkError);

		await expect(signRead("u/u5/x.jpg", 60)).rejects.toBe(networkError);
	});
});
