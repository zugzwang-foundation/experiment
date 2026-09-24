import {
	IMAGE_UPLOADS_ALLOWED_MIME,
	IMAGE_UPLOADS_MAX_BYTES,
} from "@/server/config/limits";
import { parseWireResponse } from "./envelope";

/**
 * RF-10 (MIRROR-2) — EVERY IMAGE EXCEPT A GIF IS RE-SAVED IN THE BROWSER BEFORE
 * IT IS SIGNED, so what goes up carries no hidden metadata: no location, no
 * camera, no date. A phone photo's EXIF block rides inside the file's bytes,
 * and those bytes are served as stored (ADR-0028), so an unmodified upload
 * publishes where the author stood when they took it. Drawing the decoded
 * pixels onto a canvas and encoding them again keeps the picture and drops
 * everything else.
 *
 * ⛔ A RE-SAVE THAT FAILS REFUSES THE IMAGE. It is never uploaded as-is. Before
 * RF-10 this step was an optimisation (T3) and every failure fell back to the
 * original file — decode, canvas, encode, a result that was not smaller, and a
 * timeout alike — which is precisely how location data reached storage for
 * every image already under the edge cap. Now the original is never an upload
 * candidate at all: `attachImage` refers to the picked file only to validate
 * it and to hand it to the re-save.
 *
 * ⚠ GIF IS THE ONE PASS-THROUGH, AND IT IS NAMED RATHER THAN IMPLIED. A GIF is
 * commonly animated and a canvas keeps one frame. Every other type the
 * allow-list admits is re-saved, and a type this file has no encoder for is
 * REFUSED — so a format added to the allow-list later is refused until someone
 * decides how to re-save it, never silently uploaded with its metadata.
 * ⛔ AND "A GIF" MEANS THE BYTES, NOT THE NAME. `File.type` is derived from the
 * file's EXTENSION, so a phone photo saved as `photo.gif` declares
 * `image/gif`; passing it through on its name would upload its location data
 * untouched (`@code-reviewer`, MIRROR-2). The pass-through also requires the
 * GIF signature (`isGif`); a declared GIF without it is re-saved like any
 * other image.
 *
 * ⚠ ANIMATION IS LOST FOR EVERY OTHER FORMAT. An animated WebP, an APNG and an
 * animated AVIF declare `image/webp`, `image/png` and `image/avif`, so they are
 * re-saved and keep a single frame — at any size now, where T3 froze only the
 * ones above the edge cap. Telling them apart needs byte-sniffing (a WebP `ANMF`
 * chunk, a PNG `acTL` chunk before `IDAT`), which this does not do. Recorded
 * rather than left for someone to discover from a frozen reaction image.
 *
 * Invariants this holds regardless of anything below: one object, one set
 * of bytes — what the encoder produces is what is uploaded, moderated, and
 * rendered; no second stored variant, ever; the re-save runs BEFORE the sign
 * call, so the signed `contentType` and `byteSize` are always the re-saved
 * blob's own; no new header on the signed PUT; the existing 8 MiB server-side
 * cap is untouched. (docs/plans/T3.md carries T3's original design; the
 * fallback-to-original it describes is superseded by RF-10.)
 */
const GIF_MIME = "image/gif";

/**
 * A GIF by its first six bytes — `GIF87a` or `GIF89a` — as well as by its
 * declared type. Reading six bytes is the whole cost; a file that cannot be
 * read is not treated as a GIF, so it goes through the re-save (and is refused
 * there if it cannot be decoded either).
 */
async function isGif(file: Blob): Promise<boolean> {
	if (file.type !== GIF_MIME) {
		return false;
	}
	try {
		const head = new Uint8Array(await file.slice(0, 6).arrayBuffer());
		return (
			head.length === 6 &&
			head[0] === 0x47 && // G
			head[1] === 0x49 && // I
			head[2] === 0x46 && // F
			head[3] === 0x38 && // 8
			(head[4] === 0x37 || head[4] === 0x39) && // 7 | 9
			head[5] === 0x61 // a
		);
	} catch {
		return false;
	}
}

/** Stated implementation defaults (docs/plans/T3.md) — not ratified spec values. */
export const MAX_LONGEST_EDGE_PX = 1600;
/**
 * ⛔ THERE IS NO PIXEL-COUNT GUARD, and its absence is a ruling rather than
 * an omission. A 40 MP ceiling was implemented and then dropped once it was
 * measured: it cannot prevent the decode (`createImageBitmap` IS the decode,
 * and width/height are unknowable until it completes), and it does not cap
 * the canvas either — the canvas is sized to the TARGET, which for a scaled
 * image is at most 1600px on its long edge, a few MB. (Below the legibility
 * floor the target IS the native size — a 2228 × 12941 screenshot is ~115 MB
 * of RGBA — which T3 did for PNG and RF-10 now does for every type; see
 * `MIN_SHORTER_EDGE_PX`.) It bounded roughly single-digit
 * percent of a ~160 MB peak while claiming to halve it, and its cost was
 * inverted: the largest files, the ones this feature exists for, got the
 * least help. Code claiming a protection it does not provide is the same
 * class of defect as the false docblock this task began by correcting.
 *
 * ⚠ RESIDUAL, STATED PLAINLY: a decompression bomb — a small file that
 * decodes to an enormous bitmap — can still exhaust memory in the
 * UPLOADER'S OWN TAB. Nothing here prevents that; `RESAVE_TIMEOUT_MS`
 * bounds how long it can hang, not how much it can allocate. The blast
 * radius is one browser tab: this runs entirely client-side, before any
 * network call, so no server resource and no other user is reachable. That
 * is the honest description of what is and is not defended.
 */
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
 * Below the floor the image is never RESIZED. It is still re-saved, at its
 * own size (RF-10) — which for a JPEG or WebP source now means one lossy
 * re-encode at 1:1 that T3 used to skip, the price of carrying no metadata.
 *
 * ⚠ A native-size canvas is bounded by the engine's canvas limit (WebKit caps
 * the area near 16.7 MP). A below-the-floor image larger than that cannot be
 * drawn there, so the re-save fails and the image is refused rather than
 * uploaded with its metadata.
 */
export const MIN_SHORTER_EDGE_PX = 600;
/**
 * The decode has no abort and no ceiling of its own, so a hostile image can
 * hang it rather than throw — and a `try/catch` cannot recover a hang. This
 * bounds the whole attempt: on expiry the image is REFUSED (RF-10), exactly
 * as a decode that threw would be. Without it the composer sits in
 * `attaching` forever and never reaches an error state.
 */
export const RESAVE_TIMEOUT_MS = 10_000;
const JPEG_QUALITY = 0.8;
const WEBP_QUALITY = 0.8;
const AVIF_QUALITY = 0.8;
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
 * What each source type is re-saved as. RF-10: "keep each type's current output
 * format — a PNG stays a PNG, so transparency survives". Read as: every file
 * goes up in the format it went up in before RF-10.
 *
 * - PNG at or under the edge cap went up UNTOUCHED, as a PNG — so it is
 *   re-saved as PNG (lossless; alpha kept).
 * - PNG over the cap has gone up as lossless WebP since T3 (Change 2 — PNG
 *   sources here are overwhelmingly screenshots and diagrams, and lossy
 *   encoding blurs text) — so it still does. WebP keeps alpha too.
 * - JPEG → JPEG 0.8, WebP → WebP 0.8, as T3 encoded them.
 * - AVIF went up untouched, as AVIF. The encoder is asked for AVIF, which no
 *   engine's canvas currently produces (measured in Chromium: the blob comes
 *   back `image/png`, the HTML spec's fallback) — so in practice an AVIF is
 *   re-saved as a lossless, alpha-keeping PNG, and the REAL returned type is
 *   what is signed.
 */
function encodeTargetFor(
	sourceType: string,
	overEdgeCap: boolean,
): {
	outputType: string;
	/** `undefined` for PNG, whose encoder takes no quality. */
	quality: number | undefined;
	/**
	 * True only where the output format cannot carry alpha, so transparency
	 * is about to be discarded and SOMETHING has to be behind it. A 2D canvas
	 * starts transparent-black, so without an explicit fill the discarded
	 * alpha composites to BLACK — the original draft's defect.
	 *
	 * ⚠ This is reachable even though PNG and WebP keep alpha: `File.type` is
	 * derived from the file's EXTENSION, so a transparent PNG saved as
	 * `photo.jpg` declares `image/jpeg` and lands here. White is the
	 * conventional flatten ground and is what an image editor would do.
	 */
	flattenOntoWhite: boolean;
} | null {
	if (sourceType === "image/png") {
		return overEdgeCap
			? {
					outputType: "image/webp",
					quality: PNG_TO_WEBP_LOSSLESS_QUALITY,
					flattenOntoWhite: false,
				}
			: {
					outputType: "image/png",
					quality: undefined,
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
	if (sourceType === GIF_MIME) {
		// Reached only by a file that DECLARES `image/gif` without being one
		// (`isGif` said no): its real format is unknown to its name, so it is
		// re-saved losslessly, keeping any alpha.
		return {
			outputType: "image/png",
			quality: undefined,
			flattenOntoWhite: false,
		};
	}
	if (sourceType === "image/avif") {
		return {
			outputType: "image/avif",
			quality: AVIF_QUALITY,
			flattenOntoWhite: false,
		};
	}
	// ⛔ NO DEFAULT ARM, deliberately. A fallthrough returning JPEG would
	// silently black-flatten alpha for any type added later. Null means "no
	// encode target I can name", and the caller REFUSES the image (RF-10).
	return null;
}

type Resave =
	| { kind: "resaved"; blob: Blob }
	| { kind: "failed" }
	| { kind: "rejected"; reason: "mime" | "oversize" };

/**
 * Re-saves an image: decode, draw onto a canvas — at its own size, or scaled
 * so its longest edge is `MAX_LONGEST_EDGE_PX` when it is over that cap and the
 * legibility floor allows — and encode. Every failure path returns `failed`,
 * and the caller refuses the image; nothing here can hand back the original.
 * The browser's real returned blob (never the requested type) is what
 * downstream code trusts — per the HTML Living Standard an unsupported
 * requested type silently returns `image/png`, with no exception.
 *
 * ⚠ The re-saved blob must satisfy the same bound the picked file did. It
 * usually does, but a re-encode is not always smaller than its source (a
 * canvas PNG is rarely as tight as an optimised one), so one that breaks the
 * byte cap comes back `rejected` — today's `image too large` — instead of
 * reaching the sign route. Checking it HERE is what makes "validated ==
 * uploaded" true by construction.
 *
 * ⚠ OOM RESIDUAL DOCUMENTED (HO-FINISH v1.0 §5 Ruling 1): The pixel guard was
 * dropped because the canvas allocation is target-sized (~10 MB for a scaled
 * image; the full bitmap again for a native-size re-save below the legibility
 * floor) and cannot prevent the initial bitmap decode (~160 MB RGBA at 40 MP). The
 * decode is bounded against hangs by `RESAVE_TIMEOUT_MS`.
 */
async function resaveForUpload(file: Blob): Promise<Resave> {
	try {
		const bitmap = await createImageBitmap(file);
		try {
			const longestEdge = Math.max(bitmap.width, bitmap.height);
			const overEdgeCap = longestEdge > MAX_LONGEST_EDGE_PX;
			const target = encodeTargetFor(file.type, overEdgeCap);
			if (!target) {
				return { kind: "failed" };
			}

			// At its own size unless it is over the cap — and even then, not
			// below the legibility floor (HO-FINISH v1.0 §5 Ruling 2): capping the
			// longest edge crushes extreme aspect ratios (a 1:6 full-page
			// screenshot) to a ribbon whose text cannot be read.
			let targetWidth = bitmap.width;
			let targetHeight = bitmap.height;
			if (overEdgeCap) {
				const scale = MAX_LONGEST_EDGE_PX / longestEdge;
				const shortestEdge = Math.min(bitmap.width, bitmap.height);
				if (shortestEdge * scale >= MIN_SHORTER_EDGE_PX) {
					targetWidth = Math.round(bitmap.width * scale);
					targetHeight = Math.round(bitmap.height * scale);
				}
			}

			const canvas = document.createElement("canvas");
			canvas.width = targetWidth;
			canvas.height = targetHeight;
			const ctx = canvas.getContext("2d");
			if (!ctx) {
				return { kind: "failed" };
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

			const resaved = await new Promise<Blob | null>((resolve) => {
				canvas.toBlob(resolve, target.outputType, target.quality);
			});
			// ⛔ A zero-size blob is checked explicitly: it is an encoder that
			// produced nothing, and the sign route would reject it with a wrong
			// message ("image too large").
			if (!resaved || resaved.size === 0) {
				return { kind: "failed" };
			}
			const bound = validateImageFile(resaved);
			if (!bound.ok) {
				return { kind: "rejected", reason: bound.reason };
			}
			return { kind: "resaved", blob: resaved };
		} finally {
			bitmap.close();
		}
	} catch {
		return { kind: "failed" };
	}
}

/**
 * Bounds the whole re-save in wall-clock time; on expiry the image is refused.
 * A `try/catch` catches a throw; it cannot recover a HANG, and
 * `createImageBitmap` on a decompression bomb hangs rather than throwing.
 */
async function resaveWithinBudget(file: Blob): Promise<Resave> {
	let timer: ReturnType<typeof setTimeout> | undefined;
	const budget = new Promise<Resave>((resolve) => {
		timer = setTimeout(() => resolve({ kind: "failed" }), RESAVE_TIMEOUT_MS);
	});
	try {
		return await Promise.race([resaveForUpload(file), budget]);
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

	// RF-10: every image but a GIF is re-saved HERE — before the sign call,
	// so the signed type and size, the PUT, the screening and the served
	// object are all the re-saved bytes. The picked file itself is never an
	// upload candidate past this point.
	//
	// ⛔ A RE-SAVE THAT FAILS OR TIMES OUT REFUSES THE IMAGE with today's attach
	// error (`failed` — the retry line), and no request is made. One that
	// breaks the byte cap is today's `image too large`. Neither falls back to
	// the original; that fallback is how metadata used to reach storage.
	let uploadBlob: Blob;
	if (await isGif(args.file)) {
		uploadBlob = args.file;
	} else {
		const resaved = await resaveWithinBudget(args.file);
		if (resaved.kind === "failed") {
			return { kind: "failed", transient: false };
		}
		if (resaved.kind === "rejected") {
			return {
				kind: "rejected",
				reason: resaved.reason,
				message: resaved.reason === "mime" ? MIME_MESSAGE : OVERSIZE_MESSAGE,
			};
		}
		uploadBlob = resaved.blob;
	}

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
