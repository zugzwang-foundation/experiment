import { v7 as uuidv7 } from "uuid";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// AUDIT-FIX-A1 §7.D (#3) — the participant sign route OPTS INTO write-once. After
// plan §3.3, POST /api/uploads/sign passes `{ ifNoneMatch: true }` as the final
// `mintPutUrl` arg so every participant upload URL is write-once-armed.
//
// RED: today the route calls mintPutUrl("uploads", key, contentType, TTL) with NO
// 5th arg → the `toHaveBeenCalledWith` 5-arg matcher (ending in { ifNoneMatch:
// true }) fails.
//
// Externals mocked (NO Postgres): auth (valid + onboarded), origin, rate-limit,
// the `@/db` user lookup + the `signUploadAndInsert` tx seam, and `@/server/
// storage/r2` (mintPutUrl spy). Mirrors the admin markets-media-sign route test's
// mintPutUrl-call assertion pattern.

const {
	mockGetSession,
	mockFindFirst,
	mockMintPutUrl,
	mockSignUploadAndInsert,
} = vi.hoisted(() => ({
	mockGetSession: vi.fn(),
	mockFindFirst: vi.fn(),
	mockMintPutUrl: vi.fn(),
	mockSignUploadAndInsert: vi.fn(),
}));

vi.mock("@sentry/nextjs", () => ({
	captureException: vi.fn(),
	captureMessage: vi.fn(),
	addBreadcrumb: vi.fn(),
}));
vi.mock("@/server/auth", () => ({
	auth: { api: { getSession: mockGetSession } },
}));
vi.mock("@/server/middleware/origin-allowlist", () => ({
	checkOrigin: () => true,
}));
vi.mock("@/server/middleware/rate-limit", () => ({
	checkRateLimit: vi.fn(async () => ({
		allowed: true,
		remaining: 9,
		reset: 0,
	})),
	ipIdentifier: (ip: string) => ip,
}));
vi.mock("@/db", () => ({
	db: {
		query: { users: { findFirst: mockFindFirst } },
		transaction: vi.fn(async (cb: (tx: unknown) => unknown) => cb({})),
	},
}));
vi.mock("@/server/storage/sign-upload", () => ({
	signUploadAndInsert: mockSignUploadAndInsert,
}));
vi.mock("@/server/storage/r2", () => ({
	mintPutUrl: mockMintPutUrl,
	mintReadUrl: vi.fn(),
	headObject: vi.fn(),
	deleteObject: vi.fn(),
}));

import { POST } from "@/app/api/uploads/sign/route";
import { PUT_URL_TTL_SECONDS } from "@/server/config/limits";

const USER_ID = "0190b3a0-8888-7000-8000-000000000008";

function signRequest(body: unknown): Request {
	return new Request("https://prd.example.com/api/uploads/sign", {
		method: "POST",
		headers: {
			"content-type": "application/json",
			origin: "https://prd.example.com",
			"x-forwarded-for": "203.0.113.7",
		},
		body: JSON.stringify(body),
	});
}

describe("POST /api/uploads/sign — opts into write-once (If-None-Match)", () => {
	beforeEach(() => {
		mockGetSession.mockResolvedValue({ user: { id: USER_ID } });
		mockFindFirst.mockResolvedValue({
			pseudonym: "signer",
			tosAcceptedAt: new Date("2026-01-01T00:00:00Z"),
		});
		const uploadId = uuidv7();
		mockSignUploadAndInsert.mockResolvedValue({
			uploadId,
			key: `u/${USER_ID}/${uploadId}.png`,
		});
		mockMintPutUrl.mockResolvedValue("https://stub.r2/put?X-Amz-Signature=x");
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	it("uploads-sign::passes-if-none-match-true-to-mint-put-url", async () => {
		const res = await POST(
			signRequest({ contentType: "image/png", byteSize: 4096 }),
		);
		expect(res.status).toBe(200);

		// THE load-bearing assertion: the participant PUT URL is minted write-once,
		// i.e. `{ ifNoneMatch: true }` is the final mintPutUrl arg (after the SPEC TTL).
		expect(mockMintPutUrl).toHaveBeenCalledWith(
			"uploads",
			expect.any(String),
			"image/png",
			PUT_URL_TTL_SECONDS,
			{ ifNoneMatch: true },
		);
	});
});
