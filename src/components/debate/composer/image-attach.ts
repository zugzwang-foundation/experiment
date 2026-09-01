import {
	IMAGE_UPLOADS_ALLOWED_MIME,
	IMAGE_UPLOADS_MAX_BYTES,
} from "@/server/config/limits";
import { parseWireResponse } from "./envelope";

/**
 * T3 — client-side downscale, applied before the upload, never after.
 * Eligibility is exactly `jpeg`/`png`/`webp`, checked by explicit MIME
 * comparison below. `gif` and `avif` are never eligible: both are commonly
 * animated, and a canvas re-encode keeps only the frame the decoder hands
 * back.
 *
 * ⚠ THAT RULE IS MIME-DEEP, AND ANIMATION IS NOT. An animated WebP declares
 * `image/webp` and an APNG declares `image/png`, so BOTH are eligible here
 * and both are silently reduced to a single frame when they exceed the edge
 * cap. Telling them apart needs byte-sniffing (a WebP `ANMF` chunk, a PNG
 * `acTL` chunk before `IDAT`), which this does not do. So the honest
 * statement of the rule is "the two formats that are ALWAYS animated are
 * excluded", not "animation is preserved" — and the residual is recorded
 * rather than left for someone to discover from a frozen reaction image.
 * (docs/plans/T3.md carries the full design; this is the enforcement.)
 *
 * Invariants this holds regardless of anything below: one object, one set
 * of bytes — what the encoder produces is what is uploaded, moderated, and
 * rendered; no second stored variant, ever; the signed `contentType` and
 * `byteSize` are always the POST-encode values; no new header on the
 * signed PUT; the existing 8 MiB server-side cap is untouched.
 *
 * Documented residual: `gif`/`avif` pass through completely untouched, so
 * the largest images on the platform may be exactly the ones this does not
 * optimize. Correct trade — breaking animation to save bytes would be
 * worse — recorded here rather than left to be rediscovered.
 */
const RESIZE_ELIGIBLE_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);

/** Stated implementation defaults (docs/plans/T3.md) — not ratified spec values. */
export const MAX_LONGEST_EDGE_PX = 1600;
export const MAX_DECODE_PIXELS = 40_000_000;
/**
 * The legibility floor, and the reason it exists is a measured failure.
 *
 * Capping the LONGEST edge says nothing about the shorter one, and on an
 * extreme aspect ratio that is exactly the wrong control. Measured through
 * the real code in a real browser: a 2228 × 12941 screenshot (1 : 5.8, the
 * shape a full-page capture always has) scales by 1600/12941 ≈ 0.124 and
 * lands at **275 × 1600** — 12% of its original width. Bytes fell 96.7%,
 * which reads like a triumph until you look at it: the text is gone.
 *
 * ⚠ NOTE WHAT THAT MEANS ABOUT CHANGE 2. Encoding PNG losslessly protects
 * text from the ENCODER and does nothing about the RESIZE. Lossless WebP
 * faithfully preserves pixels that were already destroyed. So the
 * text-legibility requirement is not satisfied by quality 1 alone; it needs
 * this floor as well.
 *
 * Below the floor the image is shipped UNRESIZED rather than mangled — the
 * per-image form of "measured, and not worth doing". Tall screenshots stay
 * big; they also stay readable, which is the property that was actually
 * asked for.
 */
export const MIN_SHORTER_EDGE_PX = 600;
/**
 * The decode has no abort and no ceiling of its own, so a hostile image can
 * hang it rather than throw — and a `try/catch` cannot recover a hang. This
 * bounds the whole attempt: on expiry the ORIGINAL file is uploaded, exactly
 * as if the optimization had never run. Without it the composer sits in
 * `attaching` forever and never reaches an error state, which is strictly
 * worse for the user than not optimizing at all.
 */
export const DOWNSCALE_TIMEOUT_MS = 10_000;
const JPEG_QUALITY = 0.8;
const WEBP_QUALITY = 0.8;
/**
 * ⚠ CHROMIUM-SPECIFIC, and the guarantee does not survive off it. The HTML
 * spec defines `quality` only as "the desired quality level" with no lossless
 * contract; selecting the lossless encoder at 1 is a Blink implementation
 * detail. On another engine this same call yields q100 LOSSY WebP — the exact
 * outcome the text-legibility requirement forbids, with no signal that it
 * happened. Nothing better is reachable through the canvas API; the honest
 * position is that this is a strong default on the dominant engine, not a
 * cross-browser guarantee.
 */
const PNG_TO_WEBP_LOSSLESS_QUALITY = 1;

/**
 * T3 Change 2 — PNG sources on this product are overwhelmingly screenshots
 * and diagrams; lossy WebP at 0.8 would blur text the same way JPEG at 0.8
 * does. PNG re-encodes to WebP at quality 1 (Chromium's lossless encoder
 * selection). JPEG and WebP sources stay lossy at 0.8 — photographic
 * sources are what lossy is for, and a lossless re-encode of a JPEG would
 * only grow it.
 */
function encodeTargetFor(sourceType: string): {
	outputType: string;
	quality: number;
	/**
	 * True only where the output format cannot carry alpha, so transparency
	 * is about to be discarded and SOMETHING has to be behind it. A 2D canvas
	 * starts transparent-black, so without an explicit fill the discarded
	 * alpha composites to BLACK — the original draft's defect.
	 *
	 * ⚠ This is reachable even though PNG and WebP route to alpha-capable
	 * WebP: `File.type` is derived from the file's EXTENSION, so a transparent
	 * PNG saved as `photo.jpg` declares `image/jpeg` and lands here. White is
	 * the conventional flatten ground and is what an image editor would do.
	 */
	flattenOntoWhite: boolean;
} | null {
	if (sourceType === "image/png") {
		return {
			outputType: "image/webp",
			quality: PNG_TO_WEBP_LOSSLESS_QUALITY,
			flattenOntoWhite: false,
		};
	}
	if (sourceType === "image/webp") {
		return {
			outputType: "image/webp",
			quality: WEBP_QUALITY,
			flattenOntoWhite: false,
		};
	}
	if (sourceType === "image/jpeg") {
		return {
			outputType: "image/jpeg",
			quality: JPEG_QUALITY,
			flattenOntoWhite: true,
		};
	}
	// ⛔ NO DEFAULT ARM, deliberately. A fallthrough returning JPEG would
	// silently black-flatten alpha for anything later added to
	// `RESIZE_ELIGIBLE_MIME`. Null means "no encode target I can name", and
	// the caller ships the original untouched rather than guessing.
	return null;
}

/**
 * Downscales an eligible image whose longest edge exceeds
 * `MAX_LONGEST_EDGE_PX`. Every failure path — decode, canvas acquisition,
 * encode — falls back to the original file unmodified: optimization must
 * never block a valid attachment. The whole sequence is wrapped, not just
 * the final encode step, and the browser's real returned blob (never the
 * requested type) is what downstream code trusts — not every browser
 * encodes WebP from canvas, and per the HTML Living Standard an
 * unsupported requested type silently returns `image/png` instead, with
 * no exception. A silently-downgraded PNG is still valid: still
 * alpha-preserving, still on the allowlist.
 *
 * ⚠ WHAT THE `MAX_DECODE_PIXELS` GUARD DOES AND DOES NOT BUY. It cannot
 * prevent the decode: `width`/`height` are unknowable until the image is
 * decoded, and `createImageBitmap(file)` IS the decode — the full bitmap is
 * already resident by the time this check can run. Nor does it save "half
 * the peak memory": the canvas below is created only AFTER the longest-edge
 * early return and is sized to the TARGET, so it can never exceed
 * `MAX_LONGEST_EDGE_PX²` (~10 MB of RGBA) whatever the source was. Against a
 * ~160 MB decode at the guard's own threshold, it saves single-digit
 * percent. What it actually buys is skipping a `drawImage` that must sample
 * an enormous source surface, which is a real hazard on low-memory mobile
 * even though the allocation it avoids is small.
 *
 * ⛔ ITS COST IS THE MIRROR OF THAT: an image past the threshold is uploaded
 * at FULL resolution, so the largest files — exactly the ones this feature
 * exists for — are the ones it declines to optimize. That trade was ratified
 * on the premise of a ~50% memory saving which does not hold; whether to
 * keep, move or drop the guard is an open decision, recorded rather than
 * quietly resolved here.
 */
async function downscaleForUpload(file: Blob): Promise<Blob> {
	try {
		const bitmap = await createImageBitmap(file);
		try {
			if (bitmap.width * bitmap.height > MAX_DECODE_PIXELS) {
				return file;
			}
			const longestEdge = Math.max(bitmap.width, bitmap.height);
			if (longestEdge <= MAX_LONGEST_EDGE_PX) {
				return file;
			}
			const target = encodeTargetFor(file.type);
			if (!target) {
				return file;
			}

			const scale = MAX_LONGEST_EDGE_PX / longestEdge;

			// The legibility floor. A cap on the longest edge is silent about
			// the shorter one, and on a tall screenshot the shorter edge is
			// where the text lives. If honouring the cap would take it below
			// the floor, ship the original untouched rather than return an
			// unreadable image that happens to be small.
			if (Math.min(bitmap.width, bitmap.height) * scale < MIN_SHORTER_EDGE_PX) {
				return file;
			}

			const targetWidth = Math.round(bitmap.width * scale);
			const targetHeight = Math.round(bitmap.height * scale);

			const canvas = document.createElement("canvas");
			canvas.width = targetWidth;
			canvas.height = targetHeight;
			const ctx = canvas.getContext("2d");
			if (!ctx) {
				return file;
			}
			if (target.flattenOntoWhite) {
				// ⚠ `rgb()` RATHER THAN A HEX LITERAL, and not by preference:
				// `tests/unit/design/no-raw-hex-view-layer.test.ts` bans raw hex
				// anywhere under `src/components`, so every colour arrives
				// through the token layer. This one cannot — it is the ground
				// under a JPEG that has no alpha channel, not a themeable
				// surface — and that guard's own docblock names `rgb()` as the
				// allowed spelling for exactly these untokenized white values.
				ctx.fillStyle = "rgb(255, 255, 255)";
				ctx.fillRect(0, 0, targetWidth, targetHeight);
			}
			ctx.drawImage(bitmap, 0, 0, targetWidth, targetHeight);

			const resized = await new Promise<Blob | null>((resolve) => {
				canvas.toBlob(resolve, target.outputType, target.quality);
			});
			// ⛔ EVERY REJECTION HERE RETURNS THE ORIGINAL, never an error.
			// A zero-size blob is checked explicitly: `0 >= file.size` is
			// FALSE, so a size-only comparison would let an empty blob
			// through, and the server would then reject it as "image too
			// large" — a wrong message for an empty file.
			if (!resized || resized.size === 0 || resized.size >= file.size) {
				return file;
			}
			// The candidate must independently satisfy the same bound the
			// original did. Checking it HERE — rather than in the caller —
			// is what makes "validated == uploaded" true by construction:
			// anything that fails simply never becomes the upload blob.
			if (!validateImageFile(resized).ok) {
				return file;
			}
			return resized;
		} finally {
			bitmap.close();
		}
	} catch {
		return file;
	}
}

/**
 * Bounds the whole downscale attempt in wall-clock time and falls back to
 * the original on expiry. A `try/catch` catches a throw; it cannot recover
 * a HANG, and `createImageBitmap` on a decompression bomb hangs rather than
 * throwing. Without this the composer stays in `attaching` forever and
 * never reaches an error state — worse for the user than never optimizing.
 */
async function downscaleWithinBudget(file: Blob): Promise<Blob> {
	let timer: ReturnType<typeof setTimeout> | undefined;
	const budget = new Promise<Blob>((resolve) => {
		timer = setTimeout(() => resolve(file), DOWNSCALE_TIMEOUT_MS);
	});
	try {
		return await Promise.race([downscaleForUpload(file), budget]);
	} finally {
		clearTimeout(timer);
	}
}

/**
 * UI.A3 slice 5 — the image-attach client orchestrator (plan §9 slice 5:
 * sign → PUT → attach id in payload). Pure logic over an injected fetch; the
 * affordance component renders the states.
 *
 * The sign route (`/api/uploads/sign`) is idempotency-EXEMPT (SCAFFOLD.15
 * Q2) — no Idempotency-Key header rides the sign hop. The PUT carries the
 * AUDIT-FIX-A1 write-once contract: `If-None-Match: *` is SigV4-SIGNED
 * (omitting/altering it fails signature validation); a repeat PUT to the
 * same URL/key returns 412 = idempotent already-uploaded success. Error
 * messages surfaced to the affordance are the route's OWN wire display
 * strings — never invented copy.
 */

export type ImageAttachResult =
	| { kind: "attached"; uploadId: string }
	| { kind: "rejected"; reason: "mime" | "oversize"; message: string }
	| { kind: "failed"; transient: boolean };

/** The route's own display strings (sign/route.ts) — reused locally (T3).
 * IMAGE_OVERSIZE_MESSAGE is exported for the PLACE-time p3_image arm: the
 * bets wire carries the raw error-class message there, which is never
 * rendered (security-audit LOW — internal diagnostics stay internal). */
const MIME_MESSAGE = "unsupported image type";
export const IMAGE_OVERSIZE_MESSAGE = "image too large";
const OVERSIZE_MESSAGE = IMAGE_OVERSIZE_MESSAGE;

/**
 * The T3 local bound — the LIVE whitelist + byte cap (SCAFFOLD.15 Q5/Q6;
 * `<=` mirrors the route's CHECK: exactly-at-cap is legal).
 */
export function validateImageFile(file: {
	type: string;
	size: number;
}): { ok: true } | { ok: false; reason: "mime" | "oversize" } {
	if (!(IMAGE_UPLOADS_ALLOWED_MIME as readonly string[]).includes(file.type)) {
		return { ok: false, reason: "mime" };
	}
	if (file.size > IMAGE_UPLOADS_MAX_BYTES) {
		return { ok: false, reason: "oversize" };
	}
	return { ok: true };
}

/** Local pre-validate → sign → PUT. Never throws (SG-5 posture). */
export async function attachImage(args: {
	file: Blob;
	fetchFn?: typeof fetch;
}): Promise<ImageAttachResult> {
	const fetchFn = args.fetchFn ?? fetch;
	const local = validateImageFile(args.file);
	if (!local.ok) {
		return {
			kind: "rejected",
			reason: local.reason,
			message: local.reason === "mime" ? MIME_MESSAGE : OVERSIZE_MESSAGE,
		};
	}

	// T3: resize-eligible types only; gif/avif skip straight through. The
	// result — original or re-encoded — is what every step below uses; the
	// pre-resize `args.file` is never referenced again past this point.
	//
	// ⛔ THIS CANNOT REJECT. `downscaleWithinBudget` returns either a
	// candidate that has already passed `validateImageFile` inside it, or
	// the original — which passed at the top of this function. So the blob
	// below is valid by construction, and there is deliberately no second
	// check that could turn an optimization failure into a REJECTED
	// attachment. Optimization must never block a valid argument; a
	// rejection here would have inverted exactly that.
	const uploadBlob = RESIZE_ELIGIBLE_MIME.has(args.file.type)
		? await downscaleWithinBudget(args.file)
		: args.file;

	let signRes: Response;
	try {
		signRes = await fetchFn("/api/uploads/sign", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({
				contentType: uploadBlob.type,
				byteSize: uploadBlob.size,
			}),
		});
	} catch {
		return { kind: "failed", transient: true };
	}
	const outcome = await parseWireResponse(signRes);
	if (outcome.kind === "malformed") {
		return { kind: "failed", transient: false };
	}
	if (outcome.kind === "error") {
		if (outcome.code === "error_image_mime_rejected") {
			return { kind: "rejected", reason: "mime", message: outcome.message };
		}
		if (outcome.code === "error_image_oversize") {
			return { kind: "rejected", reason: "oversize", message: outcome.message };
		}
		return {
			kind: "failed",
			transient:
				outcome.status >= 500 || outcome.code === "error_rate_limit_exceeded",
		};
	}
	const data =
		typeof outcome.data === "object" && outcome.data !== null
			? (outcome.data as Record<string, unknown>)
			: null;
	if (
		data === null ||
		typeof data.uploadId !== "string" ||
		typeof data.putUrl !== "string"
	) {
		return { kind: "failed", transient: false };
	}

	let putRes: Response;
	try {
		putRes = await fetchFn(data.putUrl, {
			method: "PUT",
			body: uploadBlob,
			headers: {
				"content-type": uploadBlob.type,
				// Write-once (AUDIT-FIX-A1): SigV4-signed — byte-exact `*`.
				"If-None-Match": "*",
			},
		});
	} catch {
		return { kind: "failed", transient: true };
	}
	// 412 = the write-once repeat: the object already exists → idempotent
	// success (the named client contract).
	if (putRes.ok || putRes.status === 412) {
		return { kind: "attached", uploadId: data.uploadId };
	}
	// e.g. the 60s presign TTL expired (403): the SAME URL is dead — the
	// affordance re-signs on the next attempt.
	return { kind: "failed", transient: false };
}
