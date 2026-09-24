// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	attachImage,
	type ImageAttachResult,
	MAX_LONGEST_EDGE_PX,
	RESAVE_TIMEOUT_MS,
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

const GIF_BYTES = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);

/**
 * The orchestration tests below are about the WIRE (sign → PUT → outcome), so
 * they pick a GIF: since RF-10 (MIRROR-2) it is the one type that goes up
 * exactly as picked, which lets them say "the PUT body IS the file". Every
 * other type is re-saved first; that is tested in its own section further down.
 */
function gifBlob(): Blob {
	return new Blob([GIF_BYTES], { type: "image/gif" });
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
		const file = gifBlob();
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
		const result = await attachImage({ file: gifBlob(), fetchFn });
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
		const result = await attachImage({ file: gifBlob(), fetchFn });
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
		const result = await attachImage({ file: gifBlob(), fetchFn });
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
		const result = await attachImage({ file: gifBlob(), fetchFn });
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
		const result = await attachImage({ file: gifBlob(), fetchFn });
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
		const result = await attachImage({ file: gifBlob(), fetchFn });
		const failed = expectFailed(result);
		expect(failed.transient).toBe(false);
	});

	it("image-attach::network-rejection-failed-transient", async () => {
		const fetchFn = scriptedFetch(new TypeError("fetch failed"));
		const result = await attachImage({ file: gifBlob(), fetchFn });
		const failed = expectFailed(result);
		expect(failed.transient).toBe(true);
	});

	it("image-attach::malformed-sign-body-failed", async () => {
		// SG-5 posture: an off-shape 200 (no ok/data envelope) renders a failed
		// state — never a crash, never a PUT against an unknown URL.
		const fetchFn = scriptedFetch(jsonResponse(200, { unexpected: true }));
		const result = await attachImage({ file: gifBlob(), fetchFn });
		expect(result.kind).toBe("failed");
		expect(fetchFn).toHaveBeenCalledTimes(1);
	});
});

// ---------------------------------------------------------------------------
// RF-10 (MIRROR-2) — every image but a GIF is re-saved before it is signed,
// and a re-save that fails REFUSES the image. It replaces T3's rule that an
// optimisation failure uploads the original, which is how every image under
// the edge cap reached storage with its EXIF (measured in a real browser: a
// GPS-tagged 1200×800 JPEG uploaded byte-for-byte). jsdom has no raster
// pipeline, so `createImageBitmap`, the 2D context and `toBlob` are stubbed at
// the call boundary below. These tests assert what was REQUESTED of the canvas
// (dimensions, output type, quality), what reaches the wire, and — the point
// of RF-10 — that nothing reaches it when the re-save fails. They cannot prove
// that metadata is gone from real bytes; that is measured end to end in a real
// browser (MIRROR-2 run report).
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

/**
 * The jsdom pipeline the test setup installs (`tests/_setup/jsdom-image-pipeline.ts`),
 * captured so each test here can replace it and `afterEach` can put it back.
 */
const setupPipeline = {
	decode: (globalThis as unknown as { createImageBitmap: unknown })
		.createImageBitmap,
	getContext: HTMLCanvasElement.prototype.getContext,
	toBlob: HTMLCanvasElement.prototype.toBlob,
};

/** Stubs `createImageBitmap` to resolve one bitmap, or throw one error. */
function stubDecode(outcome: FakeBitmap | Error): ReturnType<typeof vi.fn> {
	const decode = vi.fn(async () => {
		if (outcome instanceof Error) {
			throw outcome;
		}
		return outcome;
	});
	(globalThis as unknown as { createImageBitmap: unknown }).createImageBitmap =
		decode;
	return decode;
}

interface ToBlobCall {
	type: string | undefined;
	quality: number | undefined;
}

/**
 * Stubs the canvas 2D context (recording `drawImage` calls) and `toBlob`
 * (recording the requested type/quality, resolving with `result`).
 * `result: null` simulates the encoder producing nothing.
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

/** A GIF by its bytes as well as its type: the `GIF89a` signature, then padding. */
function realGif(size: number): Blob {
	const bytes = new Uint8Array(size);
	bytes.set([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);
	return new Blob([bytes], { type: "image/gif" });
}

function okFetch() {
	return scriptedFetch(signOkResponse(), new Response(null, { status: 200 }));
}

describe("attachImage — RF-10 re-save (mocked canvas boundary)", () => {
	afterEach(() => {
		(
			globalThis as unknown as { createImageBitmap: unknown }
		).createImageBitmap = setupPipeline.decode;
		HTMLCanvasElement.prototype.getContext = setupPipeline.getContext;
		HTMLCanvasElement.prototype.toBlob = setupPipeline.toBlob;
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

	// --- what goes up: the re-saved bytes, never the picked file -------------

	it("image-attach::rf10-an-image-under-the-edge-cap-is-re-saved-at-its-own-size", async () => {
		// Before RF-10 this was "uploads the original untouched" — the path that
		// carried a phone photo's location to storage.
		stubDecode(fakeBitmap(1200, 800));
		const resaved = fakeFile("image/jpeg", 4000);
		const { drawImage, toBlobCalls } = stubCanvasEncode(resaved);
		const file = fakeFile("image/jpeg", 5000);
		const fetchFn = okFetch();
		const result = await attachImage({ file, fetchFn });
		expect(result.kind).toBe("attached");
		expect(drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 1200, 800);
		expect(toBlobCalls).toEqual([{ type: "image/jpeg", quality: 0.8 }]);
		const put = requestCall(fetchFn, 1);
		expect(put.init.body).toBe(resaved);
		expect(put.init.body).not.toBe(file);
	});

	it("image-attach::rf10-exactly-at-the-edge-cap-is-re-saved-at-its-own-size", async () => {
		stubDecode(fakeBitmap(MAX_LONGEST_EDGE_PX, MAX_LONGEST_EDGE_PX));
		const resaved = fakeFile("image/jpeg", 100);
		const { drawImage } = stubCanvasEncode(resaved);
		const fetchFn = okFetch();
		await attachImage({ file: fakeFile("image/jpeg", 5000), fetchFn });
		expect(drawImage).toHaveBeenCalledWith(
			expect.anything(),
			0,
			0,
			MAX_LONGEST_EDGE_PX,
			MAX_LONGEST_EDGE_PX,
		);
		expect(requestCall(fetchFn, 1).init.body).toBe(resaved);
	});

	it("image-attach::rf10-the-re-save-runs-before-the-sign-and-the-sign-describes-the-re-saved-bytes", async () => {
		const decode = stubDecode(fakeBitmap(800, 600));
		const resaved = fakeFile("image/png", 321);
		stubCanvasEncode(resaved);
		const fetchFn = okFetch();
		await attachImage({ file: fakeFile("image/png", 5000), fetchFn });
		// Order: the decode (the re-save) happened before the first network call.
		expect(decode.mock.invocationCallOrder[0]).toBeLessThan(
			fetchFn.mock.invocationCallOrder[0] as number,
		);
		const sign = requestCall(fetchFn, 0);
		expect(JSON.parse(sign.init.body as string)).toEqual({
			contentType: "image/png",
			byteSize: 321,
		});
		const put = requestCall(fetchFn, 1);
		expect(put.init.body).toBe(resaved);
		expect(new Headers(put.init.headers).get("content-type")).toBe("image/png");
	});

	it("image-attach::rf10-a-re-save-larger-than-the-original-is-still-what-goes-up", async () => {
		// T3 shipped the original when the re-encode was not smaller. That is an
		// upload of the picked bytes, which RF-10 forbids.
		stubDecode(fakeBitmap(3200, 1600));
		const larger = fakeFile("image/jpeg", 500);
		stubCanvasEncode(larger);
		const file = fakeFile("image/jpeg", 100);
		const fetchFn = okFetch();
		const result = await attachImage({ file, fetchFn });
		expect(result.kind).toBe("attached");
		expect(requestCall(fetchFn, 1).init.body).toBe(larger);
	});

	it("image-attach::rf10-every-allowed-type-but-gif-is-re-saved", async () => {
		// Positive control for the pass-through below: the decode runs for every
		// other type the allow-list admits.
		for (const mime of IMAGE_UPLOADS_ALLOWED_MIME) {
			if (mime === "image/gif") continue;
			const decode = stubDecode(fakeBitmap(400, 300));
			stubCanvasEncode(
				fakeFile(mime === "image/avif" ? "image/png" : mime, 10),
			);
			await attachImage({ file: fakeFile(mime, 5000), fetchFn: okFetch() });
			expect(decode, mime).toHaveBeenCalledTimes(1);
		}
	});

	it("image-attach::rf10-a-gif-goes-up-byte-identical-and-is-never-decoded", async () => {
		const decode = stubDecode(fakeBitmap(10, 10));
		const { toBlobCalls } = stubCanvasEncode(fakeFile("image/png", 10));
		const file = realGif(5000);
		const fetchFn = okFetch();
		const result = await attachImage({ file, fetchFn });
		expect(result.kind).toBe("attached");
		expect(decode).not.toHaveBeenCalled();
		expect(toBlobCalls).toEqual([]);
		expect(requestCall(fetchFn, 1).init.body).toBe(file);
	});

	it("image-attach::rf10-a-file-named-gif-without-the-gif-signature-is-re-saved-not-passed-through", async () => {
		// `File.type` comes from the extension, so a phone photo saved as
		// `photo.gif` declares `image/gif`. Passing it through on its name would
		// upload its location data untouched (`@code-reviewer`, MIRROR-2).
		const decode = stubDecode(fakeBitmap(1200, 800));
		const resaved = fakeFile("image/png", 64);
		const { toBlobCalls } = stubCanvasEncode(resaved);
		const jpegBytes = new Uint8Array(5000);
		jpegBytes.set([0xff, 0xd8, 0xff, 0xe1]); // a JPEG with an APP1 (EXIF) segment
		const file = new Blob([jpegBytes], { type: "image/gif" });
		const fetchFn = okFetch();
		const result = await attachImage({ file, fetchFn });
		expect(result.kind).toBe("attached");
		expect(decode).toHaveBeenCalledTimes(1);
		// Its real format is unknown to its name: re-saved losslessly.
		expect(toBlobCalls).toEqual([{ type: "image/png", quality: undefined }]);
		expect(requestCall(fetchFn, 1).init.body).toBe(resaved);
		expect(requestCall(fetchFn, 1).init.body).not.toBe(file);
	});

	// --- each type keeps the format it went up in before RF-10 ---------------

	it("image-attach::rf10-a-png-at-its-own-size-stays-a-png-and-keeps-its-alpha", async () => {
		stubDecode(fakeBitmap(800, 600));
		const { toBlobCalls, fillRect } = stubCanvasEncode(
			fakeFile("image/png", 10),
		);
		await attachImage({
			file: fakeFile("image/png", 5000),
			fetchFn: okFetch(),
		});
		expect(toBlobCalls).toEqual([{ type: "image/png", quality: undefined }]);
		// Nothing painted under it: transparency survives.
		expect(fillRect).not.toHaveBeenCalled();
	});

	it("image-attach::rf10-a-png-over-the-cap-still-goes-to-lossless-webp", async () => {
		// T3 Change 2, unchanged: PNG sources here are overwhelmingly screenshots,
		// so this MUST be quality 1 — a silent regression to 0.8 would blur text.
		stubDecode(fakeBitmap(3200, 1600));
		const { toBlobCalls, fillRect } = stubCanvasEncode(
			fakeFile("image/webp", 100),
		);
		await attachImage({
			file: fakeFile("image/png", 5000),
			fetchFn: okFetch(),
		});
		expect(toBlobCalls).toEqual([{ type: "image/webp", quality: 1 }]);
		expect(fillRect).not.toHaveBeenCalled();
	});

	it("image-attach::rf10-the-png-format-switch-is-exactly-at-the-edge-cap", async () => {
		// 1600 stays a PNG at its own size; 1601 is over the cap and goes to WebP.
		stubDecode(fakeBitmap(MAX_LONGEST_EDGE_PX, 800));
		const at = stubCanvasEncode(fakeFile("image/png", 10));
		await attachImage({
			file: fakeFile("image/png", 5000),
			fetchFn: okFetch(),
		});
		expect(at.toBlobCalls).toEqual([{ type: "image/png", quality: undefined }]);
		stubDecode(fakeBitmap(MAX_LONGEST_EDGE_PX + 1, 800));
		const over = stubCanvasEncode(fakeFile("image/webp", 10));
		await attachImage({
			file: fakeFile("image/png", 5000),
			fetchFn: okFetch(),
		});
		expect(over.toBlobCalls).toEqual([{ type: "image/webp", quality: 1 }]);
	});

	it("image-attach::rf10-jpeg-stays-jpeg-at-0.8", async () => {
		stubDecode(fakeBitmap(3200, 1600));
		const smaller = fakeFile("image/jpeg", 100);
		const { toBlobCalls } = stubCanvasEncode(smaller);
		const fetchFn = okFetch();
		const result = await attachImage({
			file: fakeFile("image/jpeg", 5000),
			fetchFn,
		});
		expect(toBlobCalls).toEqual([{ type: "image/jpeg", quality: 0.8 }]);
		expect(result.kind).toBe("attached");
		expect(requestCall(fetchFn, 1).init.body).toBe(smaller);
	});

	it("image-attach::rf10-webp-stays-webp-at-0.8", async () => {
		stubDecode(fakeBitmap(640, 480));
		const { toBlobCalls } = stubCanvasEncode(fakeFile("image/webp", 100));
		await attachImage({
			file: fakeFile("image/webp", 5000),
			fetchFn: okFetch(),
		});
		expect(toBlobCalls).toEqual([{ type: "image/webp", quality: 0.8 }]);
	});

	it("image-attach::rf10-an-avif-is-asked-for-as-avif-and-the-real-returned-type-is-signed", async () => {
		// No engine's canvas encodes AVIF today; the HTML spec's fallback is PNG
		// (measured in Chromium). The re-save asks for AVIF, gets PNG, and the
		// wire carries what it GOT.
		stubDecode(fakeBitmap(800, 600));
		const png = fakeFile("image/png", 77);
		const { toBlobCalls } = stubCanvasEncode(png);
		const fetchFn = okFetch();
		const result = await attachImage({
			file: fakeFile("image/avif", 5000),
			fetchFn,
		});
		expect(result.kind).toBe("attached");
		expect(toBlobCalls).toEqual([{ type: "image/avif", quality: 0.8 }]);
		expect(JSON.parse(requestCall(fetchFn, 0).init.body as string)).toEqual({
			contentType: "image/png",
			byteSize: 77,
		});
		expect(requestCall(fetchFn, 1).init.body).toBe(png);
	});

	it("image-attach::rf10-a-browser-that-cannot-encode-webp-returns-png-and-png-is-signed", async () => {
		// Per the HTML Living Standard: a browser that can't encode the
		// requested type silently returns image/png instead — no exception.
		stubDecode(fakeBitmap(3200, 1600));
		const downgraded = fakeFile("image/png", 100); // requested webp, got png
		stubCanvasEncode(downgraded);
		const fetchFn = okFetch();
		await attachImage({ file: fakeFile("image/png", 5000), fetchFn });
		expect(JSON.parse(requestCall(fetchFn, 0).init.body as string)).toEqual({
			contentType: "image/png",
			byteSize: downgraded.size,
		});
		const put = requestCall(fetchFn, 1);
		expect(new Headers(put.init.headers).get("content-type")).toBe("image/png");
		expect(put.init.body).toBe(downgraded);
	});

	it("image-attach::rf10-jpeg-output-flattens-onto-WHITE-before-drawing", async () => {
		// JPEG has no alpha channel, so transparency is discarded on encode and
		// SOMETHING is behind it. A 2D canvas starts transparent-BLACK, so
		// without an explicit fill the discarded alpha composites to black.
		// Asserted as WHITE, and painted BEFORE the image is drawn.
		stubDecode(fakeBitmap(3200, 1600));
		const { fillRect, fillStyleAtFill, drawImage } = stubCanvasEncode(
			fakeFile("image/jpeg", 100),
		);
		await attachImage({
			file: fakeFile("image/jpeg", 5000),
			fetchFn: okFetch(),
		});
		expect(fillStyleAtFill).toHaveLength(1);
		expect(isWhite(fillStyleAtFill[0] ?? "")).toBe(true);
		expect(fillRect).toHaveBeenCalledWith(0, 0, 1600, 800);
		expect(fillRect.mock.invocationCallOrder[0]).toBeLessThan(
			drawImage.mock.invocationCallOrder[0] as number,
		);
	});

	// --- the dimension rules T3 set, unchanged ------------------------------

	it("image-attach::rf10-large-megapixels-proceed-without-a-pixel-guard", async () => {
		// Ruling 1 (HO-FINISH v1.0 §5): no pixel guard; 48 MP scales to 1600.
		stubDecode(fakeBitmap(8000, 6000));
		const { drawImage, toBlobCalls } = stubCanvasEncode(
			fakeFile("image/jpeg", 100),
		);
		await attachImage({
			file: fakeFile("image/jpeg", 5000),
			fetchFn: okFetch(),
		});
		expect(drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 1600, 1200);
		expect(toBlobCalls).toEqual([{ type: "image/jpeg", quality: 0.8 }]);
	});

	it("image-attach::rf10-a-tall-png-screenshot-is-re-saved-native-size-lossless-webp", async () => {
		// Ruling 2: 2228 × 12941 scaled to 1600 would crush the width to 275px.
		// Below the legibility floor the size is kept.
		stubDecode(fakeBitmap(2228, 12941));
		const smaller = fakeFile("image/webp", 100);
		const { toBlobCalls, drawImage } = stubCanvasEncode(smaller);
		const fetchFn = okFetch();
		const result = await attachImage({
			file: fakeFile("image/png", 5_975_654),
			fetchFn,
		});
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

	it("image-attach::rf10-below-the-floor-a-jpeg-is-re-saved-at-its-own-size-not-sent-as-is", async () => {
		// T3 sent a below-the-floor JPEG untouched, to spare it a lossy re-encode.
		// RF-10 re-saves it at 1:1: one re-encode is the price of no metadata.
		stubDecode(fakeBitmap(2228, 12941));
		const resaved = fakeFile("image/jpeg", 500);
		const { drawImage, toBlobCalls } = stubCanvasEncode(resaved);
		const file = fakeFile("image/jpeg", 5000);
		const fetchFn = okFetch();
		await attachImage({ file, fetchFn });
		expect(drawImage).toHaveBeenCalledWith(
			expect.anything(),
			0,
			0,
			2228,
			12941,
		);
		expect(toBlobCalls).toEqual([{ type: "image/jpeg", quality: 0.8 }]);
		expect(requestCall(fetchFn, 1).init.body).toBe(resaved);
	});

	it("image-attach::rf10-the-legibility-floor-binds-on-the-SHORTER-edge-only", async () => {
		// Longest edge 3200 → scale 0.5 in both cases; the shorter edge decides.
		//   1200 x 3200 → short lands at 600 == floor → resized to 600 x 1600.
		//   1100 x 3200 → short lands at 550 < floor  → kept at 1100 x 3200.
		stubDecode(fakeBitmap(1200, 3200));
		const atFloor = stubCanvasEncode(fakeFile("image/webp", 100));
		await attachImage({
			file: fakeFile("image/png", 5000),
			fetchFn: okFetch(),
		});
		expect(atFloor.drawImage).toHaveBeenCalledWith(
			expect.anything(),
			0,
			0,
			600,
			1600,
		);
		stubDecode(fakeBitmap(1100, 3200));
		const belowFloor = stubCanvasEncode(fakeFile("image/webp", 100));
		await attachImage({
			file: fakeFile("image/png", 5000),
			fetchFn: okFetch(),
		});
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

	it("image-attach::rf10-resize-targets-are-computed-from-the-longest-edge", async () => {
		// 4000x2000 at MAX_LONGEST_EDGE_PX=1600 -> scale 0.4 -> 1600x800.
		stubDecode(fakeBitmap(4000, 2000));
		const canvases: HTMLCanvasElement[] = [];
		const originalCreateElement = document.createElement.bind(document);
		vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
			const el = originalCreateElement(tag);
			if (tag === "canvas") canvases.push(el as HTMLCanvasElement);
			return el;
		});
		stubCanvasEncode(fakeFile("image/jpeg", 100));
		await attachImage({
			file: fakeFile("image/jpeg", 5000),
			fetchFn: okFetch(),
		});
		expect(canvases).toHaveLength(1);
		expect(canvases[0]?.width).toBe(1600);
		expect(canvases[0]?.height).toBe(800);
	});

	it("image-attach::rf10-the-re-saved-upload-adds-NO-new-PUT-header", async () => {
		// `If-None-Match` is SigV4-signed; an extra or altered header fails
		// signature validation.
		stubDecode(fakeBitmap(3200, 1600));
		stubCanvasEncode(fakeFile("image/jpeg", 100));
		const fetchFn = okFetch();
		await attachImage({ file: fakeFile("image/jpeg", 5000), fetchFn });
		expect(
			[...new Headers(requestCall(fetchFn, 1).init.headers).keys()].sort(),
		).toEqual(["content-type", "if-none-match"]);
	});

	// --- a re-save that fails refuses the image; nothing reaches the wire ----

	it("image-attach::rf10-a-decode-that-throws-refuses-the-image-and-signs-nothing", async () => {
		stubDecode(new Error("decode failed"));
		const fetchFn = scriptedFetch();
		const result = await attachImage({
			file: fakeFile("image/jpeg", 5000),
			fetchFn,
		});
		expect(expectFailed(result).transient).toBe(false);
		expect(fetchFn).not.toHaveBeenCalled();
	});

	it("image-attach::rf10-an-encoder-that-returns-nothing-refuses-the-image", async () => {
		stubDecode(fakeBitmap(1200, 800));
		stubCanvasEncode(null);
		const fetchFn = scriptedFetch();
		const result = await attachImage({
			file: fakeFile("image/jpeg", 5000),
			fetchFn,
		});
		expect(result.kind).toBe("failed");
		expect(fetchFn).not.toHaveBeenCalled();
	});

	it("image-attach::rf10-no-2d-context-refuses-the-image", async () => {
		stubDecode(fakeBitmap(1200, 800));
		HTMLCanvasElement.prototype.getContext = vi.fn(
			() => null,
		) as unknown as typeof HTMLCanvasElement.prototype.getContext;
		const fetchFn = scriptedFetch();
		const result = await attachImage({
			file: fakeFile("image/jpeg", 5000),
			fetchFn,
		});
		expect(result.kind).toBe("failed");
		expect(fetchFn).not.toHaveBeenCalled();
	});

	it("image-attach::rf10-a-zero-byte-re-save-refuses-with-the-attach-error-not-oversize", async () => {
		// An encoder that produced nothing is a failure, not an "image too large".
		stubDecode(fakeBitmap(1200, 800));
		stubCanvasEncode(fakeFile("image/jpeg", 0));
		const fetchFn = scriptedFetch();
		const result = await attachImage({
			file: fakeFile("image/jpeg", 5000),
			fetchFn,
		});
		expect(result.kind).toBe("failed");
		expect(fetchFn).not.toHaveBeenCalled();
	});

	it("image-attach::rf10-a-re-save-over-the-byte-cap-is-refused-as-too-large", async () => {
		// A re-encode is not always smaller than its source. One that breaks the
		// cap is refused with today's message, before any sign.
		stubDecode(fakeBitmap(1200, 800));
		stubCanvasEncode(fakeFile("image/png", IMAGE_UPLOADS_MAX_BYTES + 1));
		const fetchFn = scriptedFetch();
		const result = await attachImage({
			file: fakeFile("image/png", 5000),
			fetchFn,
		});
		const rejected = expectRejected(result);
		expect(rejected.reason).toBe("oversize");
		expect(rejected.message).toBe("image too large");
		expect(fetchFn).not.toHaveBeenCalled();
	});

	it("image-attach::rf10-a-hung-decode-refuses-after-the-budget-and-signs-nothing", async () => {
		// A `try/catch` catches a throw; it cannot recover a HANG, and a
		// decompression bomb hangs the decode rather than throwing.
		vi.useFakeTimers();
		(
			globalThis as unknown as { createImageBitmap: unknown }
		).createImageBitmap = vi.fn(() => new Promise(() => {})); // never settles
		stubCanvasEncode(null);
		const fetchFn = scriptedFetch();
		const pending = attachImage({
			file: fakeFile("image/jpeg", 5000),
			fetchFn,
		});
		await vi.advanceTimersByTimeAsync(RESAVE_TIMEOUT_MS - 1);
		expect(fetchFn).not.toHaveBeenCalled();
		await vi.advanceTimersByTimeAsync(2);
		const result = await pending;
		expect(result.kind).toBe("failed");
		expect(fetchFn).not.toHaveBeenCalled();
	});

	it("image-attach::rf10-a-type-with-no-encoder-is-refused-never-sent-as-is", async () => {
		// Every type the allow-list admits has an encoder today, so the refusal
		// for "no encoder" is reached by a file whose declared type changes after
		// validation — standing in for a type added to the allow-list later.
		stubDecode(fakeBitmap(400, 300));
		const { toBlobCalls } = stubCanvasEncode(fakeFile("image/png", 10));
		const file = fakeFile("image/png", 5000);
		let reads = 0;
		Object.defineProperty(file, "type", {
			get: () => (reads++ === 0 ? "image/png" : "image/x-unencodable"),
		});
		const fetchFn = scriptedFetch();
		const result = await attachImage({ file, fetchFn });
		expect(result.kind).toBe("failed");
		expect(toBlobCalls).toEqual([]);
		expect(fetchFn).not.toHaveBeenCalled();
	});

	it("image-attach::rf10-no-re-save-failure-ever-uploads-the-original", async () => {
		// T3's invariant 4 — "optimisation must never block a valid argument" —
		// inverted by RF-10: every failure mode now refuses the image, and the
		// picked file never becomes a request body.
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
				stubDecode(fakeBitmap(800, 600));
				stubCanvasEncode(fakeFile("image/jpeg", 0));
			},
			() => {
				stubDecode(fakeBitmap(800, 600));
				HTMLCanvasElement.prototype.getContext = vi.fn(
					() => null,
				) as unknown as typeof HTMLCanvasElement.prototype.getContext;
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
			expect(result.kind).not.toBe("attached");
			expect(fetchFn).not.toHaveBeenCalled();
		}
	});
});
