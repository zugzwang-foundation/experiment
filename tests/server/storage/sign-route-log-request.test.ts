import { v7 as uuidv7 } from "uuid";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// AUDIT-FIX-B1 A17 (rulings #6, #7) tests-first — `logRequest` wiring on POST
// /api/uploads/sign. Fires ONCE with the response status + userId =
// session.user.id at the step-5+ returns (400 invalid-json / 400 invalid-body /
// 400 mime / 400 oversize / 503 storage-unavailable / 200 happy); NEVER for the
// origin/auth/onboarding/429 prefix rejections; the final unrecognized-error
// re-throw stays UNLOGGED (crash path → Next onRequestError → Sentry).
//
// RED reason (extension of an EXISTING route): the route imports fine →
// ASSERTION-RED. Pre-impl the route does not import/call logRequest, so the
// "logged once" assertions fail (0 calls); the not-logged negatives are GREEN
// regression guards. Prelude cloned from sign-route-write-once.test.ts (no
// Postgres — auth / origin / rate-limit / the `@/db` user lookup + the
// signUploadAndInsert tx seam + `@/server/storage/r2` are all mocked).

const {
	mockGetSession,
	mockFindFirst,
	mockMintPutUrl,
	mockSignUploadAndInsert,
	mockCheckOrigin,
	mockCheckRateLimit,
	mockLogRequest,
} = vi.hoisted(() => ({
	mockGetSession: vi.fn(),
	mockFindFirst: vi.fn(),
	mockMintPutUrl: vi.fn(),
	mockSignUploadAndInsert: vi.fn(),
	mockCheckOrigin: vi.fn(),
	mockCheckRateLimit: vi.fn(),
	mockLogRequest: vi.fn(),
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
	checkOrigin: mockCheckOrigin,
}));
vi.mock("@/server/middleware/rate-limit", () => ({
	checkRateLimit: mockCheckRateLimit,
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
vi.mock("@/server/middleware/logging", () => ({ logRequest: mockLogRequest }));

import { POST } from "@/app/api/uploads/sign/route";
import {
	ImageMimeRejectedError,
	ImageOversizeError,
	StorageUnavailableError,
} from "@/lib/errors";
import { IMAGE_UPLOADS_ALLOWED_MIME } from "@/server/config/limits";

const USER_ID = "0190b3a0-8888-7000-8000-000000000088";

function signRequest(body: unknown, opts?: { raw?: string }): Request {
	return new Request("https://prd.example.com/api/uploads/sign", {
		method: "POST",
		headers: {
			"content-type": "application/json",
			origin: "https://prd.example.com",
			"x-forwarded-for": "203.0.113.7",
			"user-agent": "vitest",
		},
		body: opts?.raw ?? JSON.stringify(body),
	});
}

describe("AUDIT-FIX-B1 A17 — POST /api/uploads/sign logRequest wiring", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockCheckOrigin.mockReturnValue(true);
		mockCheckRateLimit.mockResolvedValue({
			allowed: true,
			remaining: 9,
			reset: 0,
		});
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

	// === Handler-body outcomes (step 5+) — logged ONCE with userId + startedAt ==

	it("uploads-sign-log::happy-200-logs-once-with-user-and-started-at", async () => {
		const res = await POST(
			signRequest({ contentType: "image/png", byteSize: 4096 }),
		);
		expect(res.status).toBe(200);
		expect(mockLogRequest).toHaveBeenCalledTimes(1);
		expect(mockLogRequest).toHaveBeenCalledWith(
			expect.objectContaining({
				status: 200,
				userId: USER_ID,
				startedAt: expect.any(Number),
			}),
		);
	});

	it("uploads-sign-log::invalid-json-400-logs-once", async () => {
		const res = await POST(signRequest(null, { raw: "not-json{" }));
		expect(res.status).toBe(400);
		expect(mockLogRequest).toHaveBeenCalledTimes(1);
		expect(mockLogRequest).toHaveBeenCalledWith(
			expect.objectContaining({ status: 400, userId: USER_ID }),
		);
	});

	it("uploads-sign-log::invalid-body-400-logs-once", async () => {
		const res = await POST(signRequest({ nope: true }));
		expect(res.status).toBe(400);
		expect(mockLogRequest).toHaveBeenCalledTimes(1);
		expect(mockLogRequest).toHaveBeenCalledWith(
			expect.objectContaining({ status: 400, userId: USER_ID }),
		);
	});

	it("uploads-sign-log::mime-rejected-400-logs-once", async () => {
		mockSignUploadAndInsert.mockRejectedValueOnce(
			new ImageMimeRejectedError("application/pdf", IMAGE_UPLOADS_ALLOWED_MIME),
		);
		const res = await POST(
			signRequest({ contentType: "application/pdf", byteSize: 4096 }),
		);
		expect(res.status).toBe(400);
		expect(mockLogRequest).toHaveBeenCalledTimes(1);
		expect(mockLogRequest).toHaveBeenCalledWith(
			expect.objectContaining({ status: 400, userId: USER_ID }),
		);
	});

	it("uploads-sign-log::oversize-400-logs-once", async () => {
		mockSignUploadAndInsert.mockRejectedValueOnce(
			new ImageOversizeError(999, 100),
		);
		const res = await POST(
			signRequest({ contentType: "image/png", byteSize: 999 }),
		);
		expect(res.status).toBe(400);
		expect(mockLogRequest).toHaveBeenCalledTimes(1);
	});

	it("uploads-sign-log::storage-unavailable-503-logs-once", async () => {
		mockMintPutUrl.mockRejectedValueOnce(
			new StorageUnavailableError(new Error("r2 down")),
		);
		const res = await POST(
			signRequest({ contentType: "image/png", byteSize: 4096 }),
		);
		expect(res.status).toBe(503);
		expect(mockLogRequest).toHaveBeenCalledTimes(1);
		expect(mockLogRequest).toHaveBeenCalledWith(
			expect.objectContaining({ status: 503, userId: USER_ID }),
		);
	});

	// === Prefix rejections — NEVER logged ======================================

	it("uploads-sign-log::origin-403-not-logged", async () => {
		mockCheckOrigin.mockReturnValue(false);
		const res = await POST(
			signRequest({ contentType: "image/png", byteSize: 4096 }),
		);
		expect(res.status).toBe(403);
		expect(mockLogRequest).not.toHaveBeenCalled();
	});

	it("uploads-sign-log::no-session-401-not-logged", async () => {
		mockGetSession.mockResolvedValue(null);
		const res = await POST(
			signRequest({ contentType: "image/png", byteSize: 4096 }),
		);
		expect(res.status).toBe(401);
		expect(mockLogRequest).not.toHaveBeenCalled();
	});

	it("uploads-sign-log::onboarding-403-not-logged", async () => {
		mockFindFirst.mockResolvedValue({ pseudonym: null, tosAcceptedAt: null });
		const res = await POST(
			signRequest({ contentType: "image/png", byteSize: 4096 }),
		);
		expect(res.status).toBe(403);
		expect(mockLogRequest).not.toHaveBeenCalled();
	});

	it("uploads-sign-log::rate-limited-429-not-logged", async () => {
		mockCheckRateLimit.mockResolvedValue({ allowed: false, retryAfter: 30 });
		const res = await POST(
			signRequest({ contentType: "image/png", byteSize: 4096 }),
		);
		expect(res.status).toBe(429);
		expect(mockLogRequest).not.toHaveBeenCalled();
	});

	it("uploads-sign-log::unrecognized-error-rethrow-not-logged", async () => {
		// A non-Domain error from the tx seam → the route re-throws (crash path);
		// logRequest must NOT fire (Next onRequestError → Sentry owns it).
		mockSignUploadAndInsert.mockRejectedValueOnce(new Error("unexpected"));
		await expect(
			POST(signRequest({ contentType: "image/png", byteSize: 4096 })),
		).rejects.toThrow();
		expect(mockLogRequest).not.toHaveBeenCalled();
	});
});
