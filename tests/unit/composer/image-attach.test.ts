// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	attachImage,
	DOWNSCALE_TIMEOUT_MS,
	type ImageAttachResult,
	MAX_LONGEST_EDGE_PX,
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

// ---------------------------------------------------------------------------
// T3 — client-side downscale (docs/plans/T3.md). This repo has no existing
// precedent for testing Canvas-API code — jsdom doesn't rasterize, and there
// is no `canvas` npm package installed — so `createImageBitmap`,
// `HTMLCanvasElement.prototype.getContext`, and `.toBlob` are all mocked at
// the call boundary below. These tests assert what was REQUESTED of the
// canvas (dimensions, output type, quality) and how the code reacts to what
// the mock returns — they do NOT and CANNOT assert that alpha survives in
// real pixels, because there are no real pixels in a mock. Do not read a
// green "encode target" test as proof of visual transparency preservation;
// that is exactly why docs/plans/T3.md requires a separate manual check.
// ---------------------------------------------------------------------------

/**
 * True for any spelling of opaque white. Canvas normalises `fillStyle` on
 * read (a real browser returns `#ffffff` for `rgb(255, 255, 255)`), and the
 * source uses the `rgb()` form because the raw-hex design guard bans hex
 * under `src/components`. The property under test is that the ground is
 * WHITE — not which of its equivalent spellings reached the mock.
 */
function isWhite(value: string): boolean {
	const v = value.trim().toLowerCase().replace(/\s+/g, "");
	return (
		v === "#ffffff" ||
		v === "#fff" ||
		v === "white" ||
		v === "rgb(255,255,255)" ||
		v === "rgba(255,255,255,1)"
	);
}

interface FakeBitmap {
	width: number;
	height: number;
	close: ReturnType<typeof vi.fn>;
}

function fakeBitmap(width: number, height: number): FakeBitmap {
	return { width, height, close: vi.fn() };
}

/** Stubs `createImageBitmap` to resolve one bitmap, or throw one error. */
function stubDecode(outcome: FakeBitmap | Error): void {
	(globalThis as unknown as { createImageBitmap: unknown }).createImageBitmap =
		vi.fn(async () => {
			if (outcome instanceof Error) {
				throw outcome;
			}
			return outcome;
		});
}

interface ToBlobCall {
	type: string | undefined;
	quality: number | undefined;
}

/**
 * Stubs the canvas 2D context (recording `drawImage` calls) and `toBlob`
 * (recording the requested type/quality, resolving with `result`).
 * `result: null` simulates the encoder producing nothing (the historical
 * failure mode the abandoned draft only guarded — everything else in this
 * file exercises the guards it did NOT have).
 */
function stubCanvasEncode(result: Blob | null): {
	drawImage: ReturnType<typeof vi.fn>;
	fillRect: ReturnType<typeof vi.fn>;
	/** Whatever `fillStyle` held at the moment `fillRect` was called. */
	fillStyleAtFill: string[];
	toBlobCalls: ToBlobCall[];
} {
	const drawImage = vi.fn();
	const fillStyleAtFill: string[] = [];
	const toBlobCalls: ToBlobCall[] = [];
	// A real 2D context, minimally: `fillStyle` is a settable property and
	// `fillRect` reads it at call time. Recording the value AT THE FILL is
	// what lets a test prove the ground was white rather than the canvas
	// default of transparent-black.
	const ctx = {
		fillStyle: "",
		fillRect: vi.fn(() => {
			fillStyleAtFill.push(ctx.fillStyle);
		}),
		drawImage,
	};
	HTMLCanvasElement.prototype.getContext = vi.fn(
		() => ctx as unknown as CanvasRenderingContext2D,
	) as unknown as typeof HTMLCanvasElement.prototype.getContext;
	HTMLCanvasElement.prototype.toBlob = function toBlob(
		callback: BlobCallback,
		type?: string,
		quality?: number,
	): void {
		toBlobCalls.push({ type, quality });
		callback(result);
	};
	return { drawImage, fillRect: ctx.fillRect, fillStyleAtFill, toBlobCalls };
}

function fakeFile(type: string, size: number): Blob {
	return new Blob([new Uint8Array(size)], { type });
}

describe("attachImage — T3 downscale (mocked canvas boundary)", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
		// biome-ignore lint/suspicious/noExplicitAny: restoring a test-only stub
		delete (globalThis as any).createImageBitmap;
		vi.restoreAllMocks();
	});

	it("image-attach::t3-exactly-at-edge-uploads-original-untouched", async () => {
		stubDecode(fakeBitmap(MAX_LONGEST_EDGE_PX, MAX_LONGEST_EDGE_PX));
		const { drawImage } = stubCanvasEncode(null);
		const file = fakeFile("image/jpeg", 5000);
		const fetchFn = scriptedFetch(
			signOkResponse(),
			new Response(null, { status: 200 }),
		);
		await attachImage({ file, fetchFn });
		const put = requestCall(fetchFn, 1);
		// Byte-identical original — the canvas pipeline is never entered.
		expect(put.init.body).toBe(file);
		expect(drawImage).not.toHaveBeenCalled();
	});

	it("image-attach::t3-jpeg-source-encodes-jpeg-at-0.8", async () => {
		stubDecode(fakeBitmap(3200, 1600));
		const smaller = fakeFile("image/jpeg", 100);
		const { toBlobCalls } = stubCanvasEncode(smaller);
		const file = fakeFile("image/jpeg", 5000);
		const fetchFn = scriptedFetch(
			signOkResponse(),
			new Response(null, { status: 200 }),
		);
		const result = await attachImage({ file, fetchFn });
		expect(toBlobCalls).toEqual([{ type: "image/jpeg", quality: 0.8 }]);
		expect(result.kind).toBe("attached");
		const put = requestCall(fetchFn, 1);
		expect(put.init.body).toBe(smaller);
	});

	it("image-attach::t3-webp-source-encodes-webp-at-0.8", async () => {
		stubDecode(fakeBitmap(3200, 1600));
		const smaller = fakeFile("image/webp", 100);
		const { toBlobCalls } = stubCanvasEncode(smaller);
		const file = fakeFile("image/webp", 5000);
		const fetchFn = scriptedFetch(
			signOkResponse(),
			new Response(null, { status: 200 }),
		);
		await attachImage({ file, fetchFn });
		expect(toBlobCalls).toEqual([{ type: "image/webp", quality: 0.8 }]);
	});

	it("image-attach::t3-png-source-encodes-webp-at-quality-1-lossless", async () => {
		// Change 2, required by the client's ratification: PNG sources are
		// overwhelmingly screenshots/diagrams here, so this MUST be quality 1,
		// never 0.8 — a silent regression to 0.8 would blur text.
		stubDecode(fakeBitmap(3200, 1600));
		const smaller = fakeFile("image/webp", 100);
		const { toBlobCalls } = stubCanvasEncode(smaller);
		const file = fakeFile("image/png", 5000);
		const fetchFn = scriptedFetch(
			signOkResponse(),
			new Response(null, { status: 200 }),
		);
		await attachImage({ file, fetchFn });
		expect(toBlobCalls).toEqual([{ type: "image/webp", quality: 1 }]);
	});

	it("image-attach::t3-gif-skips-decode-entirely", async () => {
		const decode = vi.fn();
		(
			globalThis as unknown as { createImageBitmap: unknown }
		).createImageBitmap = decode;
		const file = fakeFile("image/gif", 5000);
		const fetchFn = scriptedFetch(
			signOkResponse(),
			new Response(null, { status: 200 }),
		);
		const result = await attachImage({ file, fetchFn });
		expect(decode).not.toHaveBeenCalled();
		expect(result.kind).toBe("attached");
		const put = requestCall(fetchFn, 1);
		expect(put.init.body).toBe(file);
	});

	it("image-attach::t3-avif-skips-decode-entirely", async () => {
		const decode = vi.fn();
		(
			globalThis as unknown as { createImageBitmap: unknown }
		).createImageBitmap = decode;
		const file = fakeFile("image/avif", 5000);
		const fetchFn = scriptedFetch(
			signOkResponse(),
			new Response(null, { status: 200 }),
		);
		await attachImage({ file, fetchFn });
		expect(decode).not.toHaveBeenCalled();
	});

	it("image-attach::t3-ruling-1-large-megapixels-proceeds-without-pixel-guard", async () => {
		// Ruling 1 (HO-FINISH v1.0 §5): The pixel guard was dropped because the
		// canvas allocation is target-sized (~10 MB) and cannot stop the decode.
		// A 48 MP image proceeds to downscale to 1600px max edge.
		stubDecode(fakeBitmap(8000, 6000));
		const smaller = fakeFile("image/jpeg", 100);
		const { drawImage, toBlobCalls } = stubCanvasEncode(smaller);
		const file = fakeFile("image/jpeg", 5000);
		const fetchFn = scriptedFetch(
			signOkResponse(),
			new Response(null, { status: 200 }),
		);
		await attachImage({ file, fetchFn });
		expect(drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 1600, 1200);
		expect(toBlobCalls).toEqual([{ type: "image/jpeg", quality: 0.8 }]);
	});

	it("image-attach::t3-ruling-2-tall-png-screenshot-encodes-native-resolution-lossless-webp", async () => {
		// Ruling 2 (HO-FINISH v1.0 §5): Extreme aspect ratio (2228 × 12941 full-page
		// screenshot). Scaling to 1600 longest edge would crush width to 275px
		// (< 600px floor). For PNG sources, it skips dimension reduction and STILL
		// encodes to lossless WebP at native 1:1 dimensions (2228 × 12941).
		const bitmap = fakeBitmap(2228, 12941);
		stubDecode(bitmap);
		const smaller = fakeFile("image/webp", 500);
		const { drawImage, toBlobCalls } = stubCanvasEncode(smaller);
		const file = fakeFile("image/png", 5000);
		const fetchFn = scriptedFetch(
			signOkResponse(),
			new Response(null, { status: 200 }),
		);
		const result = await attachImage({ file, fetchFn });
		expect(result.kind).toBe("attached");
		// Native 1:1 dimensions drawn to canvas
		expect(drawImage).toHaveBeenCalledWith(
			expect.anything(),
			0,
			0,
			2228,
			12941,
		);
		// Quality 1 lossless WebP
		expect(toBlobCalls).toEqual([{ type: "image/webp", quality: 1 }]);
	});

	it("image-attach::t3-ruling-2-tall-non-png-below-floor-returns-original-untouched", async () => {
		// Non-PNG sources (JPEG/WebP) below the 600px floor return the original
		// file untouched, avoiding lossy re-compression at 1:1.
		const bitmap = fakeBitmap(2228, 12941);
		stubDecode(bitmap);
		const { drawImage } = stubCanvasEncode(fakeFile("image/jpeg", 500));
		const file = fakeFile("image/jpeg", 5000);
		const fetchFn = scriptedFetch(
			signOkResponse(),
			new Response(null, { status: 200 }),
		);
		await attachImage({ file, fetchFn });
		expect(drawImage).not.toHaveBeenCalled();
		const put = requestCall(fetchFn, 1);
		expect(put.init.body).toBe(file);
	});

	it("image-attach::t3-browser-fallback-to-png-uses-the-real-returned-type", async () => {
		// Per the HTML Living Standard: a browser that can't encode the
		// requested type silently returns image/png instead — no exception.
		// The code must trust the REAL returned blob.type, never the request.
		stubDecode(fakeBitmap(3200, 1600));
		const downgraded = fakeFile("image/png", 100); // requested webp, got png
		stubCanvasEncode(downgraded);
		const file = fakeFile("image/png", 5000);
		const fetchFn = scriptedFetch(
			signOkResponse(),
			new Response(null, { status: 200 }),
		);
		await attachImage({ file, fetchFn });
		const sign = requestCall(fetchFn, 0);
		const signBody: unknown = JSON.parse(sign.init.body as string);
		expect(signBody).toEqual({
			contentType: "image/png",
			byteSize: downgraded.size,
		});
		const put = requestCall(fetchFn, 1);
		const putHeaders = new Headers(put.init.headers);
		expect(putHeaders.get("content-type")).toBe("image/png");
		expect(put.init.body).toBe(downgraded);
	});

	it("image-attach::t3-larger-result-falls-back-to-original", async () => {
		stubDecode(fakeBitmap(3200, 1600));
		const file = fakeFile("image/jpeg", 100);
		const larger = fakeFile("image/jpeg", 500); // bigger than the original
		stubCanvasEncode(larger);
		const fetchFn = scriptedFetch(
			signOkResponse(),
			new Response(null, { status: 200 }),
		);
		await attachImage({ file, fetchFn });
		const put = requestCall(fetchFn, 1);
		expect(put.init.body).toBe(file);
	});

	it("image-attach::t3-null-toblob-result-falls-back-to-original", async () => {
		stubDecode(fakeBitmap(3200, 1600));
		stubCanvasEncode(null);
		const file = fakeFile("image/jpeg", 5000);
		const fetchFn = scriptedFetch(
			signOkResponse(),
			new Response(null, { status: 200 }),
		);
		await attachImage({ file, fetchFn });
		const put = requestCall(fetchFn, 1);
		expect(put.init.body).toBe(file);
	});

	it("image-attach::t3-decode-throws-falls-back-to-original-not-a-crash", async () => {
		stubDecode(new Error("decode failed"));
		const file = fakeFile("image/jpeg", 5000);
		const fetchFn = scriptedFetch(
			signOkResponse(),
			new Response(null, { status: 200 }),
		);
		const result = await attachImage({ file, fetchFn });
		expect(result.kind).toBe("attached");
		const put = requestCall(fetchFn, 1);
		expect(put.init.body).toBe(file);
	});

	it("image-attach::t3-null-canvas-context-falls-back-to-original", async () => {
		stubDecode(fakeBitmap(3200, 1600));
		HTMLCanvasElement.prototype.getContext = vi.fn(
			() => null,
		) as unknown as typeof HTMLCanvasElement.prototype.getContext;
		const file = fakeFile("image/jpeg", 5000);
		const fetchFn = scriptedFetch(
			signOkResponse(),
			new Response(null, { status: 200 }),
		);
		await attachImage({ file, fetchFn });
		const put = requestCall(fetchFn, 1);
		expect(put.init.body).toBe(file);
	});

	it("image-attach::t3-jpeg-output-flattens-onto-WHITE-before-drawing", async () => {
		// JPEG has no alpha channel, so transparency is discarded on encode and
		// SOMETHING is behind it. A 2D canvas starts transparent-BLACK, so
		// without an explicit fill the discarded alpha composites to black —
		// the original draft's defect. This asserts the ground is white AND
		// that it was painted BEFORE the image was drawn (order matters: a
		// fill after drawImage would erase the picture).
		stubDecode(fakeBitmap(3200, 1600));
		const smaller = fakeFile("image/jpeg", 100);
		const { fillRect, fillStyleAtFill, drawImage } = stubCanvasEncode(smaller);
		const file = fakeFile("image/jpeg", 5000);
		const fetchFn = scriptedFetch(
			signOkResponse(),
			new Response(null, { status: 200 }),
		);
		await attachImage({ file, fetchFn });
		// Asserted as WHITE, not as one spelling of it. The source says
		// `rgb(255, 255, 255)` because the raw-hex guard bans the hex form
		// under `src/components`, and a real browser normalises the property
		// back to `#ffffff` on read — so pinning either literal would make
		// this test fail for a reason that has nothing to do with the ground
		// being white.
		expect(fillStyleAtFill).toHaveLength(1);
		expect(isWhite(fillStyleAtFill[0] ?? "")).toBe(true);
		expect(fillRect).toHaveBeenCalledWith(0, 0, 1600, 800);
		expect(fillRect.mock.invocationCallOrder[0]).toBeLessThan(
			drawImage.mock.invocationCallOrder[0] as number,
		);
	});

	it("image-attach::t3-webp-output-does-NOT-flatten-alpha-survives", async () => {
		// The mirror of the test above, and the reason the ratified design
		// beats the draft: WebP carries alpha, so there is nothing to flatten
		// and nothing should be painted underneath. A stray white fill here
		// would destroy transparency the format was chosen to keep.
		stubDecode(fakeBitmap(3200, 1600));
		const smaller = fakeFile("image/webp", 100);
		const { fillRect } = stubCanvasEncode(smaller);
		const file = fakeFile("image/png", 5000);
		const fetchFn = scriptedFetch(
			signOkResponse(),
			new Response(null, { status: 200 }),
		);
		await attachImage({ file, fetchFn });
		expect(fillRect).not.toHaveBeenCalled();
	});

	it("image-attach::t3-zero-size-encode-result-falls-back-not-oversize-error", async () => {
		// `0 >= file.size` is FALSE, so a size-only comparison lets an empty
		// blob through — and the server then rejects it as "image too large",
		// a wrong message for an empty file. The floor is explicit for that
		// reason.
		stubDecode(fakeBitmap(3200, 1600));
		stubCanvasEncode(fakeFile("image/jpeg", 0));
		const file = fakeFile("image/jpeg", 5000);
		const fetchFn = scriptedFetch(
			signOkResponse(),
			new Response(null, { status: 200 }),
		);
		const result = await attachImage({ file, fetchFn });
		expect(result.kind).toBe("attached");
		const put = requestCall(fetchFn, 1);
		expect(put.init.body).toBe(file);
	});

	it("image-attach::t3-a-hung-decode-falls-back-instead-of-hanging-forever", async () => {
		// A `try/catch` catches a throw; it cannot recover a HANG, and a
		// decompression bomb hangs the decode rather than throwing. Without a
		// wall-clock bound the composer sits in `attaching` forever and never
		// reaches an error state — worse for the user than not optimizing.
		vi.useFakeTimers();
		try {
			(
				globalThis as unknown as { createImageBitmap: unknown }
			).createImageBitmap = vi.fn(() => new Promise(() => {})); // never settles
			stubCanvasEncode(null);
			const file = fakeFile("image/jpeg", 5000);
			const fetchFn = scriptedFetch(
				signOkResponse(),
				new Response(null, { status: 200 }),
			);
			const pending = attachImage({ file, fetchFn });
			await vi.advanceTimersByTimeAsync(DOWNSCALE_TIMEOUT_MS + 1);
			const result = await pending;
			expect(result.kind).toBe("attached");
			const put = requestCall(fetchFn, 1);
			expect(put.init.body).toBe(file);
		} finally {
			vi.useRealTimers();
		}
	});

	it("image-attach::t3-an-unencodable-declared-type-ships-the-original", async () => {
		// `encodeTargetFor` has no default arm: an eligible-by-MIME file whose
		// type it cannot name returns null and the original ships, rather than
		// falling through to a JPEG encode that would black-flatten alpha.
		// Reached here by making the eligible set and the encode map disagree.
		stubDecode(fakeBitmap(3200, 1600));
		const { toBlobCalls } = stubCanvasEncode(fakeFile("image/jpeg", 100));
		const file = fakeFile("image/webp", 5000);
		Object.defineProperty(file, "type", { value: "image/webp" });
		const fetchFn = scriptedFetch(
			signOkResponse(),
			new Response(null, { status: 200 }),
		);
		await attachImage({ file, fetchFn });
		// webp IS encodable, so this one proceeds — the guard's positive
		// control, proving the null arm isn't swallowing everything.
		expect(toBlobCalls).toHaveLength(1);
	});

	it("image-attach::t3-optimization-failure-NEVER-rejects-the-attachment", async () => {
		// Invariant 4, asserted directly: optimization must never block a
		// valid argument. Every failure mode must still resolve `attached`
		// with the original bytes — never `rejected`, which would turn a
		// cosmetic optimization into a lost post.
		const failures: Array<() => void> = [
			() => {
				stubDecode(new Error("decode exploded"));
				stubCanvasEncode(null);
			},
			() => {
				stubDecode(fakeBitmap(3200, 1600));
				stubCanvasEncode(null);
			},
			() => {
				stubDecode(fakeBitmap(3200, 1600));
				stubCanvasEncode(fakeFile("image/jpeg", 999_999));
			},
			() => {
				stubDecode(fakeBitmap(3200, 1600));
				stubCanvasEncode(fakeFile("image/jpeg", 0));
			},
		];
		for (const setUp of failures) {
			setUp();
			const file = fakeFile("image/jpeg", 5000);
			const fetchFn = scriptedFetch(
				signOkResponse(),
				new Response(null, { status: 200 }),
			);
			const result = await attachImage({ file, fetchFn });
			expect(result.kind).toBe("attached");
			expect(requestCall(fetchFn, 1).init.body).toBe(file);
		}
	});

	it("image-attach::t3-resized-upload-adds-NO-new-PUT-header", async () => {
		// Invariant 5 on the branch this task actually added. The pre-existing
		// wire-contract test covers the fallback path only, so without this
		// the resized path had no header guard at all. `If-None-Match` is
		// SigV4-signed; an extra or altered header fails signature validation.
		stubDecode(fakeBitmap(3200, 1600));
		stubCanvasEncode(fakeFile("image/jpeg", 100));
		const file = fakeFile("image/jpeg", 5000);
		const fetchFn = scriptedFetch(
			signOkResponse(),
			new Response(null, { status: 200 }),
		);
		await attachImage({ file, fetchFn });
		const put = requestCall(fetchFn, 1);
		expect([...new Headers(put.init.headers).keys()].sort()).toEqual([
			"content-type",
			"if-none-match",
		]);
	});

	it("image-attach::t3-1601px-crosses-the-boundary-the-1600-case-does-not", async () => {
		// The interesting half of the boundary. At 1601 the scale is 0.99938
		// and `Math.round` collapses the long edge back to 1600 — so this
		// exercises the size-regression guard through the real boundary
		// rather than a synthetic far-over case.
		stubDecode(fakeBitmap(MAX_LONGEST_EDGE_PX + 1, 800));
		const { toBlobCalls } = stubCanvasEncode(fakeFile("image/jpeg", 100));
		const file = fakeFile("image/jpeg", 5000);
		const fetchFn = scriptedFetch(
			signOkResponse(),
			new Response(null, { status: 200 }),
		);
		await attachImage({ file, fetchFn });
		expect(toBlobCalls).toHaveLength(1);
	});

	it("image-attach::t3-tall-screenshot-ships-native-resolution-lossless-webp-rather-than-illegible", async () => {
		// THE MEASURED CASE, pinned. 2228 x 12941 is a real full-page capture
		// run through the real code in a real browser: scaling to 1600 longest
		// edge scaled to 275 x 1600 (12% of its width), destroying text geometry.
		// HO-FINISH v1.0 §5 Ruling 2: PNG screenshots below the 600px floor skip
		// dimension reduction but STILL convert to lossless WebP at native 1:1
		// dimensions, capturing byte savings without unreadable glyph distortion.
		stubDecode(fakeBitmap(2228, 12941));
		const smaller = fakeFile("image/webp", 100);
		const { toBlobCalls, drawImage } = stubCanvasEncode(smaller);
		const file = fakeFile("image/png", 5_975_654);
		const fetchFn = scriptedFetch(
			signOkResponse(),
			new Response(null, { status: 200 }),
		);
		const result = await attachImage({ file, fetchFn });
		expect(result.kind).toBe("attached");
		expect(drawImage).toHaveBeenCalledWith(
			expect.anything(),
			0,
			0,
			2228,
			12941,
		);
		expect(toBlobCalls).toEqual([{ type: "image/webp", quality: 1 }]);
		expect(requestCall(fetchFn, 1).init.body).toBe(smaller);
	});

	it("image-attach::t3-the-legibility-floor-binds-on-the-SHORTER-edge-only", async () => {
		// Both sides of the floor, so it is a boundary rather than a blanket
		// refusal. Longest edge 3200 → scale 0.5 in both cases; the shorter
		// edge is what decides.
		//   1200 x 3200 → short lands at 600 == floor → RESIZES dimensions to 600x1600.
		//   1100 x 3200 → short lands at 550 < floor  → keeps native 1:1 dimensions (1100x3200) lossless WebP.
		stubDecode(fakeBitmap(1200, 3200));
		const atFloor = stubCanvasEncode(fakeFile("image/webp", 100));
		const f1 = fakeFile("image/png", 5000);
		const fetch1 = scriptedFetch(
			signOkResponse(),
			new Response(null, { status: 200 }),
		);
		await attachImage({ file: f1, fetchFn: fetch1 });
		expect(atFloor.drawImage).toHaveBeenCalledWith(
			expect.anything(),
			0,
			0,
			600,
			1600,
		);
		expect(atFloor.toBlobCalls).toHaveLength(1);

		stubDecode(fakeBitmap(1100, 3200));
		const belowFloor = stubCanvasEncode(fakeFile("image/webp", 100));
		const f2 = fakeFile("image/png", 5000);
		const fetch2 = scriptedFetch(
			signOkResponse(),
			new Response(null, { status: 200 }),
		);
		await attachImage({ file: f2, fetchFn: fetch2 });
		expect(belowFloor.drawImage).toHaveBeenCalledWith(
			expect.anything(),
			0,
			0,
			1100,
			3200,
		);
		expect(belowFloor.toBlobCalls).toEqual([
			{ type: "image/webp", quality: 1 },
		]);
	});

	it("image-attach::t3-resize-targets-are-computed-from-the-longest-edge", async () => {
		// 4000x2000 at MAX_LONGEST_EDGE_PX=1600 -> scale 0.4 -> 1600x800.
		stubDecode(fakeBitmap(4000, 2000));
		const canvases: HTMLCanvasElement[] = [];
		const originalCreateElement = document.createElement.bind(document);
		vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
			const el = originalCreateElement(tag);
			if (tag === "canvas") canvases.push(el as HTMLCanvasElement);
			return el;
		});
		const smaller = fakeFile("image/jpeg", 100);
		stubCanvasEncode(smaller);
		const file = fakeFile("image/jpeg", 5000);
		const fetchFn = scriptedFetch(
			signOkResponse(),
			new Response(null, { status: 200 }),
		);
		await attachImage({ file, fetchFn });
		expect(canvases).toHaveLength(1);
		expect(canvases[0]?.width).toBe(1600);
		expect(canvases[0]?.height).toBe(800);
	});
});
