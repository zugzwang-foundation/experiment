import { v7 as uuidv7 } from "uuid";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// MEDIA.1 §3/§7 tests-first — the greenfield admin signed-PUT route
// POST /admin/markets/media/sign (OD-4). The route lives under the `(admin)/`
// group (URL `/admin/...`, not `/api/admin/...`) so the `Path=/admin`-scoped
// admin session cookie actually reaches it. Forked from /api/uploads/sign but:
// admin-gated (no
// users row), DB-FREE (no market_media row at upload time), and the `mediaId`
// is SERVER-generated (the client never supplies or targets the object key —
// the Q3 R2 facet). Origin allowlist + per-IP rate cap + MIME/size upload
// hygiene reused from the participant path (validation, NOT moderation —
// ADR-0027). No moderation surface is imported or exercised here.

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
	cookies: () => ({
		get: mockCookiesGet,
		set: vi.fn(),
		delete: vi.fn(),
	}),
	headers: () => ({
		get: mockHeadersGet,
	}),
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
import {
	IMAGE_UPLOADS_MAX_BYTES,
	PUT_URL_TTL_SECONDS,
} from "@/server/config/limits";

import { testClient } from "../../db/_fixtures/db";

const ADMIN_COOKIE_NAME = "zugzwang_admin_session";
const STUB_PUT_URL = "https://r2.example.test/market-media/put?sig=stub";
const UUID_V7_RE =
	/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function withAdminSession(): Promise<string> {
	const sessionId = uuidv7();
	await testClient.unsafe(
		`INSERT INTO admin_sessions (session_id, issued_at, last_seen_at) VALUES ($1, now(), now())`,
		[sessionId],
	);
	mockCookiesGet.mockReturnValue({ name: ADMIN_COOKIE_NAME, value: sessionId });
	return sessionId;
}

function withoutAdminSession(): void {
	mockCookiesGet.mockReturnValue(undefined);
}

function signRequest(body: unknown): Request {
	return new Request("http://localhost:3000/admin/markets/media/sign", {
		method: "POST",
		headers: {
			"content-type": "application/json",
			origin: "http://localhost:3000",
			"x-forwarded-for": "9.9.9.9",
			"user-agent": "vitest",
		},
		body: JSON.stringify(body),
	});
}

async function marketMediaCount(marketId: string): Promise<number> {
	const rows = (await testClient.unsafe(
		`SELECT count(*)::int AS n FROM market_media WHERE market_id = $1`,
		[marketId],
	)) as unknown as Array<{ n: number }>;
	return rows[0]?.n ?? 0;
}

describe("POST /admin/markets/media/sign", () => {
	beforeEach(() => {
		mockCookiesGet.mockReset();
		mockHeadersGet.mockReset();
		mockMintPutUrl.mockReset();
		mockCheckRateLimit.mockReset();
		// Default: rate cap ADMITS + mintPutUrl returns a stub (DB-free + R2-env
		// free). Individual tests override.
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

	it("admin-media-sign::rejects-without-admin-session", async () => {
		withoutAdminSession();
		const res = await POST(
			signRequest({
				marketId: uuidv7(),
				contentType: "image/jpeg",
				byteSize: 1024,
			}),
		);
		expect(res.status).toBe(401);
		const body = (await res.json()) as { error: { code: string } };
		expect(body.error.code).toBe("admin_session_required");
		expect(mockMintPutUrl).not.toHaveBeenCalled();
	});

	it("admin-media-sign::per-ip-rate-cap-429", async () => {
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
		const body = (await res.json()) as { error: { code: string } };
		expect(body.error.code).toBe("error_rate_limit_exceeded");
		expect(res.headers.get("retry-after")).toBe("30");
		expect(mockMintPutUrl).not.toHaveBeenCalled();
	});

	it("admin-media-sign::rejects-non-uuidv7-marketId", async () => {
		await withAdminSession();
		// A non-UUIDv7 client PK is a trust-boundary breach → 400, no URL minted.
		// (The brief does not pin the error code for this case; behaviour pinned.)
		const res = await POST(
			signRequest({
				marketId: "not-a-uuidv7",
				contentType: "image/jpeg",
				byteSize: 1024,
			}),
		);
		expect(res.status).toBe(400);
		expect(mockMintPutUrl).not.toHaveBeenCalled();
	});

	it("admin-media-sign::rejects-disallowed-mime", async () => {
		await withAdminSession();
		const res = await POST(
			signRequest({
				marketId: uuidv7(),
				contentType: "application/pdf",
				byteSize: 1024,
			}),
		);
		expect(res.status).toBe(400);
		const body = (await res.json()) as { error: { code: string } };
		expect(body.error.code).toBe("error_image_mime_rejected");
		expect(mockMintPutUrl).not.toHaveBeenCalled();
	});

	it("admin-media-sign::rejects-oversize", async () => {
		await withAdminSession();
		const res = await POST(
			signRequest({
				marketId: uuidv7(),
				contentType: "image/jpeg",
				byteSize: IMAGE_UPLOADS_MAX_BYTES + 1,
			}),
		);
		expect(res.status).toBe(400);
		const body = (await res.json()) as { error: { code: string } };
		expect(body.error.code).toBe("error_image_oversize");
		expect(mockMintPutUrl).not.toHaveBeenCalled();
	});

	it("admin-media-sign::rejects-zero-byte", async () => {
		await withAdminSession();
		const res = await POST(
			signRequest({
				marketId: uuidv7(),
				contentType: "image/jpeg",
				byteSize: 0,
			}),
		);
		expect(res.status).toBe(400);
		const body = (await res.json()) as { error: { code: string } };
		expect(body.error.code).toBe("error_image_oversize");
		expect(mockMintPutUrl).not.toHaveBeenCalled();
	});

	it("admin-media-sign::happy-path-mints-server-generated-mediaId", async () => {
		await withAdminSession();
		const marketId = uuidv7();

		// The client tries to smuggle a mediaId/key — the route MUST ignore both
		// and generate the mediaId server-side (Q3 R2 facet: a signed PUT cannot
		// be aimed at an existing object's key).
		const res = await POST(
			signRequest({
				marketId,
				contentType: "image/jpeg",
				byteSize: 102_400,
				mediaId: "attacker-supplied-id",
				key: "m/attacker/evil.jpg",
			}),
		);
		expect(res.status).toBe(200);
		const body = (await res.json()) as {
			data: { mediaId: string; putUrl: string; key: string };
		};

		// mediaId is a SERVER-generated UUIDv7, never the client-smuggled value.
		expect(body.data.mediaId).not.toBe("attacker-supplied-id");
		expect(body.data.mediaId).toMatch(UUID_V7_RE);
		// key is m/<marketId>/<mediaId>.<ext> with the SERVER mediaId.
		expect(body.data.key).toBe(`m/${marketId}/${body.data.mediaId}.jpg`);
		expect(body.data.putUrl).toBe(STUB_PUT_URL);

		// Bound to the third R2 arm + the server key + the SPEC TTL.
		expect(mockMintPutUrl).toHaveBeenCalledWith(
			"market-media",
			`m/${marketId}/${body.data.mediaId}.jpg`,
			"image/jpeg",
			PUT_URL_TTL_SECONDS,
		);

		// DB-FREE: no market_media row is written at upload time.
		expect(await marketMediaCount(marketId)).toBe(0);
	});
});
