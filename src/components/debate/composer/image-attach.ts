import {
	IMAGE_UPLOADS_ALLOWED_MIME,
	IMAGE_UPLOADS_MAX_BYTES,
} from "@/server/config/limits";
import { parseWireResponse } from "./envelope";

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

/** frontend-optimization-notes item 4 — the longest-edge cap for the
 * client-side downscale below. Every `IMAGE_UPLOADS_ALLOWED_MIME` entry
 * (jpeg/png/webp — no animated formats) is safe to re-encode. */
const IMAGE_ATTACH_MAX_EDGE_PX = 1600;
const IMAGE_ATTACH_JPEG_QUALITY = 0.8;

/**
 * Best-effort downscale/re-encode of an accepted image before upload
 * (frontend-optimization-notes item 4) — caps the longest edge at
 * `IMAGE_ATTACH_MAX_EDGE_PX` and re-encodes as JPEG at
 * `IMAGE_ATTACH_JPEG_QUALITY`. The server-side `IMAGE_UPLOADS_MAX_BYTES` cap
 * stays the hard backstop regardless of what this produces.
 *
 * Never throws (SG-5 posture, matching `attachImage` below): returns the
 * ORIGINAL file unchanged if the image is already within the cap on both
 * axes, or if decode/encode fails for any reason — a client-side
 * optimization must never block an upload.
 */
async function downscaleForUpload(file: Blob): Promise<Blob> {
	try {
		const bitmap = await createImageBitmap(file);
		const longestEdge = Math.max(bitmap.width, bitmap.height);
		if (longestEdge <= IMAGE_ATTACH_MAX_EDGE_PX) {
			bitmap.close();
			return file;
		}
		const scale = IMAGE_ATTACH_MAX_EDGE_PX / longestEdge;
		const width = Math.round(bitmap.width * scale);
		const height = Math.round(bitmap.height * scale);

		const canvas = document.createElement("canvas");
		canvas.width = width;
		canvas.height = height;
		const ctx = canvas.getContext("2d");
		if (!ctx) {
			bitmap.close();
			return file;
		}
		ctx.drawImage(bitmap, 0, 0, width, height);
		bitmap.close();

		const resized = await new Promise<Blob | null>((resolve) => {
			canvas.toBlob(resolve, "image/jpeg", IMAGE_ATTACH_JPEG_QUALITY);
		});
		return resized ?? file;
	} catch {
		return file;
	}
}

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

	// frontend-optimization-notes item 4 — accept/reject above ran against the
	// ORIGINAL file (unchanged decision); everything below uploads the
	// (possibly re-encoded) `uploadBlob` instead. Its `type`/`size` — not the
	// original's — are what the sign request and the PUT's `content-type`
	// header must agree on, since the header rides the SigV4 signature.
	const uploadBlob = await downscaleForUpload(args.file);

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
