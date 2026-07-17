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

/** The route's own display strings (sign/route.ts) — reused locally (T3). */
const MIME_MESSAGE = "unsupported image type";
const OVERSIZE_MESSAGE = "image too large";

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

	let signRes: Response;
	try {
		signRes = await fetchFn("/api/uploads/sign", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({
				contentType: args.file.type,
				byteSize: args.file.size,
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
			body: args.file,
			headers: {
				"content-type": args.file.type,
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
