import { describe, expect, it, vi } from "vitest";
import {
	attachImage,
	type ImageAttachResult,
	validateImageFile,
} from "@/components/debate/composer/image-attach";
import {
	IMAGE_UPLOADS_ALLOWED_MIME,
	IMAGE_UPLOADS_MAX_BYTES,
} from "@/server/config/limits";
import { IDEMPOTENCY_HEADER_NAME } from "@/server/idempotency/types";

// UI.A3 §5.6 tests-first, slice 5 — the greenfield image-attach client
// orchestrator (plan §3.2 place-body `imageUploadsId` + §4 image-codes row +
// §9 slice 5 "REDs → sign → PUT → attach id in payload → image error
// states"). PURE / DB-INDEPENDENT: the module under test DOES NOT EXIST yet —
// this file collection-FAILS NOW on the unresolvable
// `@/components/debate/composer/image-attach` import (the verified RED) and
// GREENs when the implementer lands the module against the contract below.
//
// Law asserted here (the sign route src/app/api/uploads/sign/route.ts +
// AUDIT-FIX-A1 write-once client contract + limits.ts LIVE constants):
//   - validateImageFile binds the REAL whitelist + byte cap (SCAFFOLD.15
//     Q5/Q6): every live IMAGE_UPLOADS_ALLOWED_MIME member at size ≤
//     IMAGE_UPLOADS_MAX_BYTES passes; "image/svg+xml" (the named XSS
//     exclusion) rejects "mime"; size EXACTLY the cap passes (mirrors the
//     route's `byteSize <= MAX` CHECK); cap + 1 rejects "oversize".
//   - attachImage pre-validates LOCALLY first (the T3 posture — an invalid
//     file never fires a network request), then: POST /api/uploads/sign with
//     EXACTLY {contentType, byteSize} and NO Idempotency-Key header (the
//     route is idempotency-EXEMPT per SCAFFOLD.15 Q2 — sending the header
//     would be contract drift); on 200 {ok:true,data:{uploadId,putUrl,key}}
//     PUT the Blob bytes to the EXACT putUrl carrying `content-type:
//     file.type` AND `If-None-Match: *` (byte-exact `*` — the AUDIT-FIX-A1
//     write-once header is SigV4-SIGNED via `IfNoneMatch: "*"` in
//     src/server/storage/r2.ts:136; omitting or altering it fails the
//     signature). PUT 2xx → attached; PUT 412 → ALSO attached (write-once
//     repeat = idempotent already-uploaded success — the named client
//     contract). Sign-route rejections surface as the §4 states: 400
//     error_image_mime_rejected → rejected "mime" (WIRE message surfaced);
//     400 error_image_oversize → rejected "oversize"; 503
//     error_storage_unavailable / 429 → failed transient; PUT
//     non-2xx-non-412 (expired/forged URL 403) → failed terminal; network
//     rejection → failed transient; malformed sign body → failed (SG-5:
//     off-shape input renders a state, never a crash).
//
// PINNED PUBLIC-API CONTRACT (the implementer matches these names exactly):
//   export type ImageAttachResult =
//     | { kind: "attached"; uploadId: string }
//     | { kind: "rejected"; reason: "mime" | "oversize"; message: string }
//     | { kind: "failed"; transient: boolean };
//   export function validateImageFile(file: { type: string; size: number }):
//     | { ok: true }
//     | { ok: false; reason: "mime" | "oversize" };
//   export async function attachImage(args: {
//     file: Blob; // .type/.size drive validation; its bytes are the PUT body
//     fetchFn?: typeof fetch;
//   }): Promise<ImageAttachResult>;
//
// The fetch double returns REAL Response objects carrying the sign route's
// OWN envelope shapes ({ok:true,data} | {ok:false,error:{code,message,
// retry_after?}}) and the route's own display messages — never invented
// shapes. Blob fixtures are REAL Blobs (new Blob([bytes], {type})).

const UPLOAD_ID = "0190b3a0-1111-7000-8000-000000000001";
const R2_KEY = `u/0190b3a0-8888-7000-8000-00000000000e/${UPLOAD_ID}.png`;
const PUT_URL = `https://uploads.r2.example/${R2_KEY}?X-Amz-Signature=abc123`;

const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);

function pngBlob(): Blob {
	return new Blob([PNG_BYTES], { type: "image/png" });
}

function svgBlob(): Blob {
	// The named XSS exclusion (SCAFFOLD.15 Q5) — markup, not argument prose.
	return new Blob(["<svg/>"], { type: "image/svg+xml" });
}

/** One-call-per-step fetch double; an Error step rejects (network outcome). */
function scriptedFetch(...steps: Array<Response | Error>) {
	const queue = [...steps];
	return vi.fn(
		async (
			_input: RequestInfo | URL,
			_init?: RequestInit,
		): Promise<Response> => {
			const step = queue.shift();
			if (step === undefined) {
				throw new Error("fetch double exhausted: unexpected extra fetch call");
			}
			if (step instanceof Error) {
				throw step;
			}
			return step;
		},
	);
}

function jsonResponse(status: number, body: unknown): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "content-type": "application/json" },
	});
}

/** The sign route's happy envelope (route.ts:204-207). */
function signOkResponse(): Response {
	return jsonResponse(200, {
		ok: true,
		data: { uploadId: UPLOAD_ID, putUrl: PUT_URL, key: R2_KEY },
	});
}

/** The sign route's §4.4 error envelope (retry_after on 429/503 only). */
function signErrorResponse(
	status: number,
	code: string,
	message: string,
	retryAfter?: number,
): Response {
	const error: Record<string, unknown> = { code, message };
	if (retryAfter !== undefined) {
		error.retry_after = retryAfter;
	}
	return jsonResponse(status, { ok: false, error });
}

/** Narrow a recorded fetch call to the (url string, init) contract shape. */
function requestCall(
	fetchFn: ReturnType<typeof scriptedFetch>,
	index: number,
): { url: string; init: RequestInit } {
	const call = fetchFn.mock.calls[index];
	if (call === undefined) {
		throw new Error(`fetch call ${index} was never made`);
	}
	const [input, init] = call;
	if (typeof input !== "string") {
		throw new Error("contract violation: fetch input must be the URL string");
	}
	if (init === undefined) {
		throw new Error("contract violation: fetch init must be provided");
	}
	return { url: input, init };
}

function expectAttached(
	result: ImageAttachResult,
): Extract<ImageAttachResult, { kind: "attached" }> {
	if (result.kind !== "attached") {
		throw new Error(`expected attached, got ${result.kind}`);
	}
	return result;
}

function expectRejected(
	result: ImageAttachResult,
): Extract<ImageAttachResult, { kind: "rejected" }> {
	if (result.kind !== "rejected") {
		throw new Error(`expected rejected, got ${result.kind}`);
	}
	return result;
}

function expectFailed(
	result: ImageAttachResult,
): Extract<ImageAttachResult, { kind: "failed" }> {
	if (result.kind !== "failed") {
		throw new Error(`expected failed, got ${result.kind}`);
	}
	return result;
}

describe("validateImageFile — LIVE limits.ts constants (T3 local bound)", () => {
	it("image-attach::every-live-allowed-mime-within-cap-ok", () => {
		// EVERY member of the LIVE whitelist — never a copied literal list, so
		// a limits.ts drift (mime added/removed) re-binds this test for free.
		for (const mime of IMAGE_UPLOADS_ALLOWED_MIME) {
			expect(validateImageFile({ type: mime, size: 1 })).toEqual({
				ok: true,
			});
		}
	});

	it("image-attach::size-exactly-cap-ok-mirrors-lte-check", () => {
		// The route's CHECK is `byteSize <= IMAGE_UPLOADS_MAX_BYTES` (0006 SQL +
		// sign-upload semantic validate): exactly-at-cap is LEGAL. A client `<`
		// would wrongly reject the boundary byte.
		for (const mime of IMAGE_UPLOADS_ALLOWED_MIME) {
			expect(
				validateImageFile({ type: mime, size: IMAGE_UPLOADS_MAX_BYTES }),
			).toEqual({ ok: true });
		}
	});

	it("image-attach::svg-rejected-mime-the-named-xss-exclusion", () => {
		expect(validateImageFile({ type: "image/svg+xml", size: 1 })).toEqual({
			ok: false,
			reason: "mime",
		});
	});

	it("image-attach::cap-plus-one-rejected-oversize", () => {
		expect(
			validateImageFile({
				type: "image/png",
				size: IMAGE_UPLOADS_MAX_BYTES + 1,
			}),
		).toEqual({ ok: false, reason: "oversize" });
	});
});

describe("attachImage — sign → PUT orchestration (injected fetch double)", () => {
	it("image-attach::local-invalid-rejects-without-any-fetch", async () => {
		// T3 posture: the LOCAL pre-validate fires FIRST — an invalid file
		// resolves rejected and the network is NEVER touched (an empty double
		// would throw on any call: double signal).
		const fetchFn = scriptedFetch();
		const result = await attachImage({ file: svgBlob(), fetchFn });
		const rejected = expectRejected(result);
		expect(rejected.reason).toBe("mime");
		expect(typeof rejected.message).toBe("string");
		expect(fetchFn).not.toHaveBeenCalled();
	});

	it("image-attach::sign-then-put-wire-contract-attached", async () => {
		const file = pngBlob();
		const fetchFn = scriptedFetch(
			signOkResponse(),
			new Response(null, { status: 200 }),
		);
		const result = await attachImage({ file, fetchFn });
		expect(fetchFn).toHaveBeenCalledTimes(2);

		// --- Call 0: the sign hop ---
		const sign = requestCall(fetchFn, 0);
		expect(sign.url).toBe("/api/uploads/sign");
		expect(sign.init.method).toBe("POST");
		const signHeaders = new Headers(sign.init.headers);
		expect(signHeaders.get("content-type")).toBe("application/json");
		// The sign route is idempotency-EXEMPT (SCAFFOLD.15 Q2 + SPEC.2 §11
		// amendment): the header must be ABSENT — looked up under the REAL
		// server constant, never a duplicated literal.
		expect(signHeaders.get(IDEMPOTENCY_HEADER_NAME)).toBeNull();
		// Body EXACTLY {contentType, byteSize} from the Blob's own props —
		// nothing extra rides the wire (the route's parseBody shape).
		if (typeof sign.init.body !== "string") {
			throw new Error("contract violation: sign body must be a JSON string");
		}
		const signBody: unknown = JSON.parse(sign.init.body);
		expect(signBody).toEqual({ contentType: file.type, byteSize: file.size });
		expect(Object.keys(signBody as Record<string, unknown>).sort()).toEqual([
			"byteSize",
			"contentType",
		]);

		// --- Call 1: the PUT hop ---
		const put = requestCall(fetchFn, 1);
		// The EXACT presigned putUrl — any rewrite breaks the SigV4 signature.
		expect(put.url).toBe(PUT_URL);
		expect(put.init.method).toBe("PUT");
		// The Blob ITSELF is the body — its bytes are what R2 stores and what
		// moderation later reads (moderated bytes ≡ rendered bytes).
		expect(put.init.body).toBe(file);
		const putHeaders = new Headers(put.init.headers);
		expect(putHeaders.get("content-type")).toBe(file.type);
		// AUDIT-FIX-A1 write-once: `If-None-Match: *` — byte-exact `*` (the
		// value r2.ts signs via `IfNoneMatch: "*"`); it is a SigV4-SIGNED
		// header, so omitting or altering it fails signature validation.
		expect(putHeaders.get("if-none-match")).toBe("*");

		// --- Outcome ---
		const attached = expectAttached(result);
		expect(attached.uploadId).toBe(UPLOAD_ID);
	});

	it("image-attach::put-412-write-once-repeat-is-attached", async () => {
		// The AUDIT-FIX-A1 client contract: the FIRST PUT creates the object; a
		// repeat PUT to the same URL/key → HTTP 412, which the client treats as
		// idempotent success (already-uploaded) — NEVER a failure state.
		const fetchFn = scriptedFetch(
			signOkResponse(),
			new Response(null, { status: 412 }),
		);
		const result = await attachImage({ file: pngBlob(), fetchFn });
		const attached = expectAttached(result);
		expect(attached.uploadId).toBe(UPLOAD_ID);
	});

	it("image-attach::sign-400-mime-rejected-surfaces-wire-message", async () => {
		// The server belt (a locally-valid file the server still rejects —
		// whitelist drift): 400 error_image_mime_rejected → rejected "mime"
		// carrying the WIRE message (the route's own display string).
		const fetchFn = scriptedFetch(
			signErrorResponse(
				400,
				"error_image_mime_rejected",
				"unsupported image type",
			),
		);
		const result = await attachImage({ file: pngBlob(), fetchFn });
		const rejected = expectRejected(result);
		expect(rejected.reason).toBe("mime");
		expect(rejected.message).toBe("unsupported image type");
		// The PUT hop never fires after a sign rejection.
		expect(fetchFn).toHaveBeenCalledTimes(1);
	});

	it("image-attach::sign-400-oversize-surfaces-wire-message", async () => {
		const fetchFn = scriptedFetch(
			signErrorResponse(400, "error_image_oversize", "image too large"),
		);
		const result = await attachImage({ file: pngBlob(), fetchFn });
		const rejected = expectRejected(result);
		expect(rejected.reason).toBe("oversize");
		expect(rejected.message).toBe("image too large");
		expect(fetchFn).toHaveBeenCalledTimes(1);
	});

	it("image-attach::sign-503-storage-unavailable-failed-transient", async () => {
		// Fail-CLOSED R2 outage (Retry-After 5 per the route): a retry can
		// succeed — transient, never terminal.
		const fetchFn = scriptedFetch(
			signErrorResponse(
				503,
				"error_storage_unavailable",
				"storage unavailable",
				5,
			),
		);
		const result = await attachImage({ file: pngBlob(), fetchFn });
		const failed = expectFailed(result);
		expect(failed.transient).toBe(true);
	});

	it("image-attach::sign-429-rate-limited-failed-transient", async () => {
		const fetchFn = scriptedFetch(
			signErrorResponse(
				429,
				"error_rate_limit_exceeded",
				"rate limit exceeded",
				30,
			),
		);
		const result = await attachImage({ file: pngBlob(), fetchFn });
		const failed = expectFailed(result);
		expect(failed.transient).toBe(true);
	});

	it("image-attach::put-403-non-2xx-non-412-failed-terminal", async () => {
		// A PUT rejection that is NOT the 412 write-once arm (e.g. the 60s
		// presign TTL expired → SigV4 403): terminal — retrying the SAME dead
		// URL cannot succeed; the affordance re-signs on the next attempt.
		const fetchFn = scriptedFetch(
			signOkResponse(),
			new Response(null, { status: 403 }),
		);
		const result = await attachImage({ file: pngBlob(), fetchFn });
		const failed = expectFailed(result);
		expect(failed.transient).toBe(false);
	});

	it("image-attach::network-rejection-failed-transient", async () => {
		const fetchFn = scriptedFetch(new TypeError("fetch failed"));
		const result = await attachImage({ file: pngBlob(), fetchFn });
		const failed = expectFailed(result);
		expect(failed.transient).toBe(true);
	});

	it("image-attach::malformed-sign-body-failed", async () => {
		// SG-5 posture: an off-shape 200 (no ok/data envelope) renders a failed
		// state — never a crash, never a PUT against an unknown URL.
		const fetchFn = scriptedFetch(jsonResponse(200, { unexpected: true }));
		const result = await attachImage({ file: pngBlob(), fetchFn });
		expect(result.kind).toBe("failed");
		expect(fetchFn).toHaveBeenCalledTimes(1);
	});
});
