import { v7 as uuidv7 } from "uuid";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// AUDIT-FIX-B7b A29 (RED-first) — POST /admin/markets/media/sign adopts the
// SPEC.2 §4.4 wire envelope. Success → { ok: true, data: { mediaId, putUrl, key } };
// every rejection → { ok: false, error: { code, message, retry_after? } } with the
// error CODE kept VERBATIM (shape-only fix). `retry_after` rides the response BODY
// only on 429/503 (the `retry-after` HEADER stays). EVERY response (success + all
// rejections) carries an `X-Request-Id` header: a safe inbound `x-request-id`
// (/^[A-Za-z0-9_-]{1,200}$/) is echoed verbatim; an unsafe one is replaced by a
// minted UUIDv7.
//
// RED reason (extension of the EXISTING route): the route imports fine →
// ASSERTION-RED. Pre-impl the route returns the FLAT { error: "<code>" } shape, a
// bare { mediaId, putUrl, key } on success, and emits NO X-Request-Id header — so
// every envelope / header assertion fails for the RIGHT reason (shape/header
// missing, not import/setup). Mirrors tests/server/admin/markets-media-sign.test.ts:
// real admin_sessions seed via testClient (@/db NOT mocked → the real DB-backed
// session validator), next/headers cookie mock, controllable rate-limit + r2
// mocks, TRUNCATE admin_sessions in afterEach. checkOrigin is REAL (not mocked) —
// origin "http://localhost:3000" passes the BETTER_AUTH_URL-derived allowlist; a
// mismatched origin fails.

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

const { mockCheckRateLimit } = vi.hoisted(() => ({
	mockCheckRateLimit: vi.fn(),
}));
vi.mock("@/server/middleware/rate-limit", () => ({
	checkRateLimit: mockCheckRateLimit,
	ipIdentifier: (ip: string) => ip,
}));

import { POST } from "@/app/(admin)/admin/markets/media/sign/route";
import { StorageUnavailableError } from "@/lib/errors";
import {
	IMAGE_UPLOADS_MAX_BYTES,
	PUT_URL_TTL_SECONDS,
} from "@/server/config/limits";

import { testClient } from "../../db/_fixtures/db";

const ADMIN_COOKIE_NAME = "zugzwang_admin_session";
const STUB_PUT_URL = "https://r2.example.test/market-media/put?sig=stub";
// Copied from tests/server/admin/markets-media-sign.test.ts.
const UUID_V7_RE =
	/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
// Matches the §4.4 REQUEST_ID_SAFE token class (/^[A-Za-z0-9_-]{1,200}$/).
const SAFE_REQUEST_ID = "trace-b7b-admin_9";

type ErrorEnvelope = {
	ok: false;
	error: { code: string; message: string; retry_after?: number };
};
type SuccessEnvelope = {
	ok: true;
	data: { mediaId: string; putUrl: string; key: string };
};

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

function signRequest(
	body: unknown,
	opts?: { raw?: string; origin?: string; requestId?: string },
): Request {
	const headers: Record<string, string> = {
		"content-type": "application/json",
		origin: opts?.origin ?? "http://localhost:3000",
		"x-forwarded-for": "9.9.9.9",
		"user-agent": "vitest",
	};
	if (opts?.requestId !== undefined) headers["x-request-id"] = opts.requestId;
	return new Request("http://localhost:3000/admin/markets/media/sign", {
		method: "POST",
		headers,
		body: opts?.raw ?? JSON.stringify(body),
	});
}

function assertErrorEnvelope(body: ErrorEnvelope, code: string): void {
	expect(body.ok).toBe(false);
	expect(body.error.code).toBe(code);
	expect(typeof body.error.message).toBe("string");
	expect(body.error.message.length).toBeGreaterThan(0);
}

const VALID_BODY = {
	marketId: uuidv7(),
	contentType: "image/jpeg",
	byteSize: 102_400,
};

describe("AUDIT-FIX-B7b A29 — POST /admin/markets/media/sign §4.4 envelope", () => {
	beforeEach(() => {
		mockCookiesGet.mockReset();
		mockHeadersGet.mockReset();
		mockMintPutUrl.mockReset();
		mockCheckRateLimit.mockReset();
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

	// === success ==============================================================

	it("admin-media-sign-envelope::success-ok-true-data-shape", async () => {
		await withAdminSession();
		const res = await POST(signRequest(VALID_BODY));
		expect(res.status).toBe(200);
		const body = (await res.json()) as SuccessEnvelope;
		expect(body.ok).toBe(true);
		expect(body.data.mediaId).toMatch(UUID_V7_RE);
		expect(body.data.putUrl).toBe(STUB_PUT_URL);
		expect(body.data.key).toBe(
			`m/${VALID_BODY.marketId}/${body.data.mediaId}.jpg`,
		);
		expect(res.headers.get("x-request-id")).toBeTruthy();
		expect(mockMintPutUrl).toHaveBeenCalledWith(
			"market-media",
			`m/${VALID_BODY.marketId}/${body.data.mediaId}.jpg`,
			"image/jpeg",
			PUT_URL_TTL_SECONDS,
		);
	});

	// === rejection sites (verbatim code + message string + X-Request-Id) ======

	it("admin-media-sign-envelope::origin-rejected-403-envelope", async () => {
		// checkOrigin is REAL — a mismatched origin fails the allowlist (checked
		// before the admin-session gate, so no session is needed).
		const res = await POST(
			signRequest(VALID_BODY, { origin: "https://evil.example.com" }),
		);
		expect(res.status).toBe(403);
		assertErrorEnvelope(
			(await res.json()) as ErrorEnvelope,
			"error_origin_rejected",
		);
		expect(res.headers.get("x-request-id")).toBeTruthy();
	});

	it("admin-media-sign-envelope::admin-session-required-401-envelope", async () => {
		withoutAdminSession();
		const res = await POST(signRequest(VALID_BODY));
		expect(res.status).toBe(401);
		assertErrorEnvelope(
			(await res.json()) as ErrorEnvelope,
			"admin_session_required",
		);
		expect(res.headers.get("x-request-id")).toBeTruthy();
	});

	it("admin-media-sign-envelope::rate-limited-429-envelope-and-retry-after", async () => {
		await withAdminSession();
		mockCheckRateLimit.mockResolvedValueOnce({
			allowed: false,
			retryAfter: 30,
		});
		const res = await POST(signRequest(VALID_BODY));
		expect(res.status).toBe(429);
		const body = (await res.json()) as ErrorEnvelope;
		assertErrorEnvelope(body, "error_rate_limit_exceeded");
		expect(body.error.retry_after).toBe(30);
		expect(res.headers.get("retry-after")).toBe("30");
		expect(res.headers.get("x-request-id")).toBeTruthy();
	});

	it("admin-media-sign-envelope::invalid-json-400-envelope", async () => {
		await withAdminSession();
		const res = await POST(signRequest(null, { raw: "not-json{" }));
		expect(res.status).toBe(400);
		assertErrorEnvelope(
			(await res.json()) as ErrorEnvelope,
			"error_invalid_json",
		);
		expect(res.headers.get("x-request-id")).toBeTruthy();
	});

	it("admin-media-sign-envelope::invalid-body-400-envelope", async () => {
		await withAdminSession();
		const res = await POST(signRequest({ nope: true }));
		expect(res.status).toBe(400);
		assertErrorEnvelope(
			(await res.json()) as ErrorEnvelope,
			"error_invalid_request_body",
		);
		expect(res.headers.get("x-request-id")).toBeTruthy();
	});

	it("admin-media-sign-envelope::invalid-market-id-400-envelope", async () => {
		await withAdminSession();
		const res = await POST(
			signRequest({
				marketId: "not-a-uuidv7",
				contentType: "image/jpeg",
				byteSize: 1024,
			}),
		);
		expect(res.status).toBe(400);
		assertErrorEnvelope(
			(await res.json()) as ErrorEnvelope,
			"error_invalid_market_id",
		);
		expect(res.headers.get("x-request-id")).toBeTruthy();
	});

	it("admin-media-sign-envelope::mime-rejected-400-envelope", async () => {
		await withAdminSession();
		const res = await POST(
			signRequest({
				marketId: uuidv7(),
				contentType: "application/pdf",
				byteSize: 1024,
			}),
		);
		expect(res.status).toBe(400);
		assertErrorEnvelope(
			(await res.json()) as ErrorEnvelope,
			"error_image_mime_rejected",
		);
		expect(res.headers.get("x-request-id")).toBeTruthy();
	});

	it("admin-media-sign-envelope::oversize-400-envelope", async () => {
		await withAdminSession();
		const res = await POST(
			signRequest({
				marketId: uuidv7(),
				contentType: "image/jpeg",
				byteSize: IMAGE_UPLOADS_MAX_BYTES + 1,
			}),
		);
		expect(res.status).toBe(400);
		assertErrorEnvelope(
			(await res.json()) as ErrorEnvelope,
			"error_image_oversize",
		);
		expect(res.headers.get("x-request-id")).toBeTruthy();
	});

	it("admin-media-sign-envelope::zero-byte-400-envelope", async () => {
		await withAdminSession();
		const res = await POST(
			signRequest({
				marketId: uuidv7(),
				contentType: "image/jpeg",
				byteSize: 0,
			}),
		);
		expect(res.status).toBe(400);
		assertErrorEnvelope(
			(await res.json()) as ErrorEnvelope,
			"error_image_oversize",
		);
		expect(res.headers.get("x-request-id")).toBeTruthy();
	});

	it("admin-media-sign-envelope::storage-unavailable-503-envelope-and-retry-after", async () => {
		await withAdminSession();
		mockMintPutUrl.mockRejectedValueOnce(
			new StorageUnavailableError(new Error("r2 down")),
		);
		const res = await POST(signRequest(VALID_BODY));
		expect(res.status).toBe(503);
		const body = (await res.json()) as ErrorEnvelope;
		assertErrorEnvelope(body, "error_storage_unavailable");
		expect(body.error.retry_after).toBe(5);
		expect(res.headers.get("retry-after")).toBe("5");
		expect(res.headers.get("x-request-id")).toBeTruthy();
	});

	// === X-Request-Id echo / mint ============================================

	it("admin-media-sign-envelope::echoes-safe-inbound-request-id-on-success", async () => {
		await withAdminSession();
		const res = await POST(
			signRequest(VALID_BODY, { requestId: SAFE_REQUEST_ID }),
		);
		expect(res.status).toBe(200);
		expect(res.headers.get("x-request-id")).toBe(SAFE_REQUEST_ID);
	});

	it("admin-media-sign-envelope::mints-uuidv7-for-unsafe-inbound-request-id", async () => {
		await withAdminSession();
		const res = await POST(signRequest(VALID_BODY, { requestId: "bad!id" }));
		expect(res.status).toBe(200);
		const echoed = res.headers.get("x-request-id");
		expect(echoed).toBeTruthy();
		expect(echoed).not.toBe("bad!id");
		expect(echoed).toMatch(UUID_V7_RE);
	});
});
