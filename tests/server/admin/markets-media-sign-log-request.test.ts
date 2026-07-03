import { v7 as uuidv7 } from "uuid";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// AUDIT-FIX-B1 A17 (ruling #7 + execute-gate confirm #2) tests-first — `logRequest`
// wiring on POST /admin/markets/media/sign. Fires ONCE from the step-4 body-
// validate onward (400 invalid-json / 400 invalid-body / 400 invalid-marketId /
// 400 mime / 400 oversize / 503 storage-unavailable / 200 happy) with
// userId: null (the admin has no `users` row — refusal trigger §3 forbids
// inventing one); NEVER for origin (403) / admin-session-401 / 429; the final
// unrecognized-error re-throw stays UNLOGGED.
//
// RED reason (extension of an EXISTING route): ASSERTION-RED — the route does not
// import/call logRequest pre-impl, so the "logged once" assertions fail; the
// not-logged negatives are GREEN regression guards. Mirrors
// tests/server/admin/markets-media-sign.test.ts (cookies mock + real admin_sessions
// seed via testClient + r2 + rate-limit mocks); origin-allowlist is mocked
// settable (per the participant sign-route anchor) for a deterministic 403.

vi.mock("@sentry/nextjs", () => ({
	captureException: vi.fn(),
	captureMessage: vi.fn(),
	addBreadcrumb: vi.fn(),
}));

const { mockCookiesGet, mockHeadersGet } = vi.hoisted(() => ({
	mockCookiesGet: vi.fn(),
	mockHeadersGet: vi.fn(),
}));
vi.mock("next/headers", () => ({
	cookies: () => ({ get: mockCookiesGet, set: vi.fn(), delete: vi.fn() }),
	headers: () => ({ get: mockHeadersGet }),
}));

const { mockMintPutUrl } = vi.hoisted(() => ({ mockMintPutUrl: vi.fn() }));
vi.mock("@/server/storage/r2", () => ({
	mintPutUrl: mockMintPutUrl,
	mintReadUrl: vi.fn(),
	headObject: vi.fn(),
	deleteObject: vi.fn(),
}));

const { mockCheckOrigin, mockCheckRateLimit } = vi.hoisted(() => ({
	mockCheckOrigin: vi.fn(),
	mockCheckRateLimit: vi.fn(),
}));
vi.mock("@/server/middleware/origin-allowlist", () => ({
	checkOrigin: mockCheckOrigin,
}));
vi.mock("@/server/middleware/rate-limit", () => ({
	checkRateLimit: mockCheckRateLimit,
	ipIdentifier: (ip: string) => ip,
}));

const { mockLogRequest } = vi.hoisted(() => ({ mockLogRequest: vi.fn() }));
vi.mock("@/server/middleware/logging", () => ({ logRequest: mockLogRequest }));

import { POST } from "@/app/(admin)/admin/markets/media/sign/route";
import { StorageUnavailableError } from "@/lib/errors";
import { IMAGE_UPLOADS_MAX_BYTES } from "@/server/config/limits";
import { testClient } from "../../db/_fixtures/db";

const ADMIN_COOKIE_NAME = "zugzwang_admin_session";
const STUB_PUT_URL = "https://r2.example.test/market-media/put?sig=stub";

async function withAdminSession(): Promise<void> {
	const sessionId = uuidv7();
	await testClient.unsafe(
		`INSERT INTO admin_sessions (session_id, issued_at, last_seen_at) VALUES ($1, now(), now())`,
		[sessionId],
	);
	mockCookiesGet.mockReturnValue({ name: ADMIN_COOKIE_NAME, value: sessionId });
}
function withoutAdminSession(): void {
	mockCookiesGet.mockReturnValue(undefined);
}

function signRequest(body: unknown, opts?: { raw?: string }): Request {
	return new Request("http://localhost:3000/admin/markets/media/sign", {
		method: "POST",
		headers: {
			"content-type": "application/json",
			origin: "http://localhost:3000",
			"x-forwarded-for": "9.9.9.9",
			"user-agent": "vitest",
		},
		body: opts?.raw ?? JSON.stringify(body),
	});
}

describe("AUDIT-FIX-B1 A17 — POST /admin/markets/media/sign logRequest wiring", () => {
	beforeEach(() => {
		mockCookiesGet.mockReset();
		mockHeadersGet.mockReset();
		mockMintPutUrl.mockReset();
		mockCheckOrigin.mockReset();
		mockCheckRateLimit.mockReset();
		mockLogRequest.mockReset();
		mockCheckOrigin.mockReturnValue(true);
		mockCheckRateLimit.mockResolvedValue({
			allowed: true,
			remaining: 9,
			reset: Date.now() + 60_000,
		});
		mockMintPutUrl.mockResolvedValue(STUB_PUT_URL);
	});
	afterEach(async () => {
		await testClient.unsafe(`TRUNCATE admin_sessions CASCADE`);
		vi.clearAllMocks();
	});

	// === Step-4+ outcomes — logged ONCE with userId: null ======================

	it("admin-media-sign-log::happy-200-logs-once-with-null-user", async () => {
		await withAdminSession();
		const res = await POST(
			signRequest({
				marketId: uuidv7(),
				contentType: "image/jpeg",
				byteSize: 102_400,
			}),
		);
		expect(res.status).toBe(200);
		expect(mockLogRequest).toHaveBeenCalledTimes(1);
		expect(mockLogRequest).toHaveBeenCalledWith(
			expect.objectContaining({
				status: 200,
				userId: null,
				startedAt: expect.any(Number),
			}),
		);
	});

	it("admin-media-sign-log::invalid-json-400-logs-once", async () => {
		await withAdminSession();
		const res = await POST(signRequest(null, { raw: "not-json{" }));
		expect(res.status).toBe(400);
		expect(mockLogRequest).toHaveBeenCalledTimes(1);
		expect(mockLogRequest).toHaveBeenCalledWith(
			expect.objectContaining({ status: 400, userId: null }),
		);
	});

	it("admin-media-sign-log::invalid-body-400-logs-once", async () => {
		await withAdminSession();
		const res = await POST(signRequest({ nope: true }));
		expect(res.status).toBe(400);
		expect(mockLogRequest).toHaveBeenCalledTimes(1);
	});

	it("admin-media-sign-log::invalid-market-id-400-logs-once", async () => {
		await withAdminSession();
		const res = await POST(
			signRequest({
				marketId: "not-a-uuidv7",
				contentType: "image/jpeg",
				byteSize: 1024,
			}),
		);
		expect(res.status).toBe(400);
		expect(mockLogRequest).toHaveBeenCalledTimes(1);
	});

	it("admin-media-sign-log::mime-rejected-400-logs-once", async () => {
		await withAdminSession();
		const res = await POST(
			signRequest({
				marketId: uuidv7(),
				contentType: "application/pdf",
				byteSize: 1024,
			}),
		);
		expect(res.status).toBe(400);
		expect(mockLogRequest).toHaveBeenCalledTimes(1);
	});

	it("admin-media-sign-log::oversize-400-logs-once", async () => {
		await withAdminSession();
		const res = await POST(
			signRequest({
				marketId: uuidv7(),
				contentType: "image/jpeg",
				byteSize: IMAGE_UPLOADS_MAX_BYTES + 1,
			}),
		);
		expect(res.status).toBe(400);
		expect(mockLogRequest).toHaveBeenCalledTimes(1);
	});

	it("admin-media-sign-log::storage-unavailable-503-logs-once", async () => {
		await withAdminSession();
		mockMintPutUrl.mockRejectedValueOnce(
			new StorageUnavailableError(new Error("r2 down")),
		);
		const res = await POST(
			signRequest({
				marketId: uuidv7(),
				contentType: "image/jpeg",
				byteSize: 102_400,
			}),
		);
		expect(res.status).toBe(503);
		expect(mockLogRequest).toHaveBeenCalledTimes(1);
		expect(mockLogRequest).toHaveBeenCalledWith(
			expect.objectContaining({ status: 503, userId: null }),
		);
	});

	// === Prefix rejections — NEVER logged ======================================

	it("admin-media-sign-log::origin-403-not-logged", async () => {
		await withAdminSession();
		mockCheckOrigin.mockReturnValue(false);
		const res = await POST(
			signRequest({
				marketId: uuidv7(),
				contentType: "image/jpeg",
				byteSize: 1024,
			}),
		);
		expect(res.status).toBe(403);
		expect(mockLogRequest).not.toHaveBeenCalled();
	});

	it("admin-media-sign-log::admin-session-401-not-logged", async () => {
		withoutAdminSession();
		const res = await POST(
			signRequest({
				marketId: uuidv7(),
				contentType: "image/jpeg",
				byteSize: 1024,
			}),
		);
		expect(res.status).toBe(401);
		expect(mockLogRequest).not.toHaveBeenCalled();
	});

	it("admin-media-sign-log::rate-limited-429-not-logged", async () => {
		await withAdminSession();
		mockCheckRateLimit.mockResolvedValueOnce({
			allowed: false,
			retryAfter: 30,
		});
		const res = await POST(
			signRequest({
				marketId: uuidv7(),
				contentType: "image/jpeg",
				byteSize: 1024,
			}),
		);
		expect(res.status).toBe(429);
		expect(mockLogRequest).not.toHaveBeenCalled();
	});

	it("admin-media-sign-log::unrecognized-error-rethrow-not-logged", async () => {
		await withAdminSession();
		mockMintPutUrl.mockRejectedValueOnce(new Error("unexpected"));
		await expect(
			POST(
				signRequest({
					marketId: uuidv7(),
					contentType: "image/jpeg",
					byteSize: 102_400,
				}),
			),
		).rejects.toThrow();
		expect(mockLogRequest).not.toHaveBeenCalled();
	});
});
