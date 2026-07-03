import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// AUDIT-FIX-A1 §7.E (#4/#5/#6) — the place route runs `verifyUploadedObject`
// PRE-MODERATION (right after resolveImageAttachment) and FAILS CLOSED: any throw
// blocks the request and the W-1 bet transaction NEVER opens (plan §3.4). The
// three fail-closed rows of plan §5, mapped by toWireError (plan §3.7):
//   ImageOversizeError        → 400 error_image_oversize
//   StorageObjectMissingError → 409 error_storage_object_missing
//   StorageUnavailableError   → 503 error_storage_unavailable (Retry-After 5)
//
// RED (double signal): today the route never calls verifyUploadedObject (the
// module doesn't exist + there is no route wire), so control reaches
// runBetTransaction and the route returns 200 — BOTH the status assertion AND
// `runBetTransaction not called` fail. (Post-impl toWireError also gains the three
// maps; today those three @/lib/errors classes fall through to 500 error_internal.)
//
// REAL place route; externals mocked. `resolveImageAttachment` mocked benign so
// control REACHES verify. `runBetTransaction` STUBBED to prove it is NEVER ENTERED
// (and to keep the RED clean — the pre-impl 200 path performs no DB write). The
// auth+ban users lookup + the isFrozen read hit local Postgres (unseeded USER_ID →
// no row → not banned; system_state → not frozen), mirroring
// moderation-outside-transaction.test.ts.

const {
	mockGetSession,
	mockPrecommit,
	mockResolveImageAttachment,
	mockVerifyUploadedObject,
	mockRunBetTransaction,
} = vi.hoisted(() => ({
	mockGetSession: vi.fn(),
	mockPrecommit: vi.fn(async () => ({
		outcome: "pass",
		categories: [],
		categoryScores: {},
	})),
	mockResolveImageAttachment: vi.fn(),
	mockVerifyUploadedObject: vi.fn(),
	// Stub — records the (dis)entry. If wrongly entered pre-impl it returns a
	// benign shape so the RED is a clean 200, not a DB crash.
	mockRunBetTransaction: vi.fn(async () => ({
		betId: "0190b3a0-6666-7000-8000-000000000006",
		commentId: "0190b3a0-7777-7000-8000-000000000007",
		side: "YES",
		sharesBought: "9.090909090909090909",
		newPrice: "0.523809523809523810",
		parentCommentId: null,
	})),
}));

vi.mock("@sentry/nextjs", () => ({
	captureMessage: vi.fn(),
	addBreadcrumb: vi.fn(),
	captureException: vi.fn(),
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
		remaining: 99,
		reset: 0,
	})),
	ipIdentifier: (ip: string) => ip,
}));
vi.mock("@/server/idempotency/cache", () => ({
	computeBodyFingerprint: vi.fn(async () => "fp"),
	idempotencyLookupOrReserve: vi.fn(async () => ({
		kind: "miss",
		release: vi.fn(async () => {}),
	})),
}));
vi.mock("@/server/moderation/precommit", () => ({
	precommitModerate: mockPrecommit,
}));
vi.mock("@/server/comments/image-attach", () => ({
	resolveImageAttachment: mockResolveImageAttachment,
}));
vi.mock("@/server/storage/verify-object", () => ({
	verifyUploadedObject: mockVerifyUploadedObject,
}));
vi.mock("@/server/bets/transaction", () => ({
	runBetTransaction: mockRunBetTransaction,
}));

import { POST as placePOST } from "@/app/api/bets/place/route";
import {
	ImageOversizeError,
	StorageObjectMissingError,
	StorageUnavailableError,
} from "@/lib/errors";
import { IMAGE_UPLOADS_MAX_BYTES } from "@/server/config/limits";

const USER_ID = "0190b3a0-8888-7000-8000-00000000000e";
const MARKET_ID = "0190b3a0-9999-7000-8000-00000000000f";
const UPLOAD_ID = "0190b3a0-aaaa-7000-8000-00000000000a";

function placeRequest(idempotencyKey: string): Request {
	return new Request("https://prd.example.com/api/bets/place", {
		method: "POST",
		headers: {
			"content-type": "application/json",
			origin: "https://prd.example.com",
			"Idempotency-Key": idempotencyKey,
			"x-forwarded-for": "203.0.113.44",
		},
		body: JSON.stringify({
			marketId: MARKET_ID,
			side: "YES",
			stake: "10",
			body: "argument with a to-be-verified image",
			imageUploadsId: UPLOAD_ID,
		}),
	});
}

describe("POST /api/bets/place — verifyUploadedObject fails closed pre-tx", () => {
	beforeEach(() => {
		mockGetSession.mockResolvedValue({ user: { id: USER_ID } });
		mockResolveImageAttachment.mockResolvedValue({
			uploadId: UPLOAD_ID,
			r2ObjectKey: `u/${USER_ID}/${UPLOAD_ID}.png`,
		});
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	it("place-image-verify::oversize-real-bytes-blocks-400-no-tx", async () => {
		// A10 via the route: verify throws ImageOversizeError ⇒ 400
		// error_image_oversize, and the bet tx never opens.
		mockVerifyUploadedObject.mockRejectedValue(
			new ImageOversizeError(
				IMAGE_UPLOADS_MAX_BYTES + 1,
				IMAGE_UPLOADS_MAX_BYTES,
			),
		);
		const res = await placePOST(placeRequest("verify-oversize-key"));
		expect(res.status).toBe(400);
		const payload = await res.json();
		expect(payload.error.code).toBe("error_image_oversize");
		expect(mockRunBetTransaction).not.toHaveBeenCalled();
	});

	it("place-image-verify::missing-object-blocks-400-no-tx", async () => {
		// HeadObject 404 ⇒ StorageObjectMissingError propagates ⇒ 400
		// error_storage_object_missing (ADR-0028 §9 #4 RULING: bad request, not 409);
		// the tx never opens.
		mockVerifyUploadedObject.mockRejectedValue(
			new StorageObjectMissingError(`u/${USER_ID}/${UPLOAD_ID}.png`),
		);
		const res = await placePOST(placeRequest("verify-missing-key"));
		expect(res.status).toBe(400);
		const payload = await res.json();
		expect(payload.error.code).toBe("error_storage_object_missing");
		expect(mockRunBetTransaction).not.toHaveBeenCalled();
	});

	it("place-image-verify::storage-unavailable-blocks-503-no-tx", async () => {
		// HeadObject 5xx ⇒ StorageUnavailableError ⇒ 503 error_storage_unavailable
		// (Retry-After 5, NOT cached); the tx never opens.
		mockVerifyUploadedObject.mockRejectedValue(
			new StorageUnavailableError(new Error("R2 5xx")),
		);
		const res = await placePOST(placeRequest("verify-unavail-key"));
		expect(res.status).toBe(503);
		const payload = await res.json();
		expect(payload.error.code).toBe("error_storage_unavailable");
		expect(res.headers.get("retry-after")).toBe("5");
		expect(mockRunBetTransaction).not.toHaveBeenCalled();
	});
});
