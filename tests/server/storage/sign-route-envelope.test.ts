import { v7 as uuidv7 } from "uuid";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// AUDIT-FIX-B7b A29 (RED-first) — POST /api/uploads/sign adopts the SPEC.2 §4.4
// wire envelope. Success → { ok: true, data: { uploadId, putUrl, key } }; every
// rejection → { ok: false, error: { code, message, retry_after? } } with the
// error CODE kept VERBATIM (shape-only fix). `retry_after` rides the response
// BODY only on 429/503 (the `retry-after` HEADER stays). EVERY response (success
// + all rejections) carries an `X-Request-Id` header: a safe inbound
// `x-request-id` (/^[A-Za-z0-9_-]{1,200}$/) is echoed verbatim; an unsafe one is
// replaced by a minted UUIDv7. OD-1 (ratified INCLUDE): the resolved request id
// is wired into the events `metadata.request_id` (today the literal "unknown").
//
// RED reason (extension of the EXISTING route): the route imports fine →
// ASSERTION-RED. Pre-impl the route returns the FLAT { error: "<code>" } shape,
// a bare { uploadId, putUrl, key } on success, emits NO X-Request-Id header, and
// hardcodes metadata.request_id = "unknown" — so every envelope / header / OD-1
// assertion fails for the RIGHT reason (shape/header missing, not import/setup).
// Mock set cloned from sign-route-write-once.test.ts, with checkOrigin +
// checkRateLimit promoted to controllable vi.hoisted fns to drive the 403-origin
// and 429 arms.

const {
	mockGetSession,
	mockFindFirst,
	mockMintPutUrl,
	mockSignUploadAndInsert,
	mockCheckOrigin,
	mockCheckRateLimit,
} = vi.hoisted(() => ({
	mockGetSession: vi.fn(),
	mockFindFirst: vi.fn(),
	mockMintPutUrl: vi.fn(),
	mockSignUploadAndInsert: vi.fn(),
	mockCheckOrigin: vi.fn(),
	mockCheckRateLimit: vi.fn(),
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

import { POST } from "@/app/api/uploads/sign/route";
import {
	ImageMimeRejectedError,
	ImageOversizeError,
	StorageUnavailableError,
} from "@/lib/errors";
import { IMAGE_UPLOADS_ALLOWED_MIME } from "@/server/config/limits";

const USER_ID = "0190b3a0-8888-7000-8000-00000000b70b";
// Copied from tests/server/admin/markets-media-sign.test.ts.
const UUID_V7_RE =
	/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
// Matches the §4.4 REQUEST_ID_SAFE token class (/^[A-Za-z0-9_-]{1,200}$/).
const SAFE_REQUEST_ID = "trace-b7b-abc_123";

type ErrorEnvelope = {
	ok: false;
	error: { code: string; message: string; retry_after?: number };
};
type SuccessEnvelope = {
	ok: true;
	data: { uploadId: string; putUrl: string; key: string };
};

function signRequest(
	body: unknown,
	opts?: { raw?: string; requestId?: string },
): Request {
	const headers: Record<string, string> = {
		"content-type": "application/json",
		origin: "https://prd.example.com",
		"x-forwarded-for": "203.0.113.7",
		"user-agent": "vitest",
	};
	if (opts?.requestId !== undefined) headers["x-request-id"] = opts.requestId;
	return new Request("https://prd.example.com/api/uploads/sign", {
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

const VALID_BODY = { contentType: "image/png", byteSize: 4096 };

describe("AUDIT-FIX-B7b A29 — POST /api/uploads/sign §4.4 envelope", () => {
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

	// === success ==============================================================

	it("uploads-sign-envelope::success-ok-true-data-shape", async () => {
		const res = await POST(signRequest(VALID_BODY));
		expect(res.status).toBe(200);
		const body = (await res.json()) as SuccessEnvelope;
		expect(body.ok).toBe(true);
		expect(body.data).toMatchObject({
			uploadId: expect.any(String),
			putUrl: expect.any(String),
			key: expect.any(String),
		});
		expect(res.headers.get("x-request-id")).toBeTruthy();
	});

	// === rejection sites (verbatim code + message string + X-Request-Id) ======

	it("uploads-sign-envelope::origin-rejected-403-envelope", async () => {
		mockCheckOrigin.mockReturnValue(false);
		const res = await POST(signRequest(VALID_BODY));
		expect(res.status).toBe(403);
		assertErrorEnvelope(
			(await res.json()) as ErrorEnvelope,
			"error_origin_rejected",
		);
		expect(res.headers.get("x-request-id")).toBeTruthy();
	});

	it("uploads-sign-envelope::unauthenticated-401-envelope", async () => {
		mockGetSession.mockResolvedValue(null);
		const res = await POST(signRequest(VALID_BODY));
		expect(res.status).toBe(401);
		assertErrorEnvelope(
			(await res.json()) as ErrorEnvelope,
			"error_unauthenticated",
		);
		expect(res.headers.get("x-request-id")).toBeTruthy();
	});

	it("uploads-sign-envelope::onboarding-required-403-envelope", async () => {
		mockFindFirst.mockResolvedValue({ pseudonym: null, tosAcceptedAt: null });
		const res = await POST(signRequest(VALID_BODY));
		expect(res.status).toBe(403);
		assertErrorEnvelope(
			(await res.json()) as ErrorEnvelope,
			"error_onboarding_required",
		);
		expect(res.headers.get("x-request-id")).toBeTruthy();
	});

	it("uploads-sign-envelope::rate-limited-429-envelope-and-retry-after", async () => {
		mockCheckRateLimit.mockResolvedValue({ allowed: false, retryAfter: 30 });
		const res = await POST(signRequest(VALID_BODY));
		expect(res.status).toBe(429);
		const body = (await res.json()) as ErrorEnvelope;
		assertErrorEnvelope(body, "error_rate_limit_exceeded");
		// §4.4: retry_after in the BODY on 429, and the retry-after HEADER stays.
		expect(body.error.retry_after).toBe(30);
		expect(res.headers.get("retry-after")).toBe("30");
		expect(res.headers.get("x-request-id")).toBeTruthy();
	});

	it("uploads-sign-envelope::invalid-json-400-envelope", async () => {
		const res = await POST(signRequest(null, { raw: "not-json{" }));
		expect(res.status).toBe(400);
		assertErrorEnvelope(
			(await res.json()) as ErrorEnvelope,
			"error_invalid_json",
		);
		expect(res.headers.get("x-request-id")).toBeTruthy();
	});

	it("uploads-sign-envelope::invalid-body-400-envelope", async () => {
		const res = await POST(signRequest({ nope: true }));
		expect(res.status).toBe(400);
		assertErrorEnvelope(
			(await res.json()) as ErrorEnvelope,
			"error_invalid_request_body",
		);
		expect(res.headers.get("x-request-id")).toBeTruthy();
	});

	it("uploads-sign-envelope::mime-rejected-400-envelope", async () => {
		mockSignUploadAndInsert.mockRejectedValueOnce(
			new ImageMimeRejectedError("application/pdf", IMAGE_UPLOADS_ALLOWED_MIME),
		);
		const res = await POST(
			signRequest({ contentType: "application/pdf", byteSize: 4096 }),
		);
		expect(res.status).toBe(400);
		assertErrorEnvelope(
			(await res.json()) as ErrorEnvelope,
			"error_image_mime_rejected",
		);
		expect(res.headers.get("x-request-id")).toBeTruthy();
	});

	it("uploads-sign-envelope::oversize-400-envelope", async () => {
		mockSignUploadAndInsert.mockRejectedValueOnce(
			new ImageOversizeError(999, 100),
		);
		const res = await POST(
			signRequest({ contentType: "image/png", byteSize: 999 }),
		);
		expect(res.status).toBe(400);
		assertErrorEnvelope(
			(await res.json()) as ErrorEnvelope,
			"error_image_oversize",
		);
		expect(res.headers.get("x-request-id")).toBeTruthy();
	});

	it("uploads-sign-envelope::storage-unavailable-503-envelope-and-retry-after", async () => {
		mockMintPutUrl.mockRejectedValueOnce(
			new StorageUnavailableError(new Error("r2 down")),
		);
		const res = await POST(signRequest(VALID_BODY));
		expect(res.status).toBe(503);
		const body = (await res.json()) as ErrorEnvelope;
		assertErrorEnvelope(body, "error_storage_unavailable");
		// §4.4: retry_after in the BODY on 503, and the retry-after HEADER "5".
		expect(body.error.retry_after).toBe(5);
		expect(res.headers.get("retry-after")).toBe("5");
		expect(res.headers.get("x-request-id")).toBeTruthy();
	});

	// === X-Request-Id echo / mint ============================================

	it("uploads-sign-envelope::echoes-safe-inbound-request-id-on-success", async () => {
		const res = await POST(
			signRequest(VALID_BODY, { requestId: SAFE_REQUEST_ID }),
		);
		expect(res.status).toBe(200);
		expect(res.headers.get("x-request-id")).toBe(SAFE_REQUEST_ID);
	});

	it("uploads-sign-envelope::echoes-safe-inbound-request-id-on-rejection", async () => {
		mockCheckOrigin.mockReturnValue(false);
		const res = await POST(
			signRequest(VALID_BODY, { requestId: SAFE_REQUEST_ID }),
		);
		expect(res.status).toBe(403);
		expect(res.headers.get("x-request-id")).toBe(SAFE_REQUEST_ID);
	});

	it("uploads-sign-envelope::mints-uuidv7-for-unsafe-inbound-request-id", async () => {
		const res = await POST(signRequest(VALID_BODY, { requestId: "bad!id" }));
		expect(res.status).toBe(200);
		const echoed = res.headers.get("x-request-id");
		expect(echoed).toBeTruthy();
		expect(echoed).not.toBe("bad!id");
		expect(echoed).toMatch(UUID_V7_RE);
	});

	// === OD-1: resolved request id is wired into events metadata ==============

	it("uploads-sign-envelope::wires-resolved-request-id-into-event-metadata", async () => {
		await POST(signRequest(VALID_BODY, { requestId: SAFE_REQUEST_ID }));
		expect(mockSignUploadAndInsert).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({
				metadata: expect.objectContaining({ request_id: SAFE_REQUEST_ID }),
			}),
		);
	});
});
