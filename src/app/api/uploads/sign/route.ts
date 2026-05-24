import { eq } from "drizzle-orm";

import { db } from "@/db";
import { users } from "@/db/schema";
import {
	ImageMimeRejectedError,
	ImageOversizeError,
	StorageUnavailableError,
} from "@/lib/errors";
import { auth } from "@/server/auth";
import { checkOrigin } from "@/server/middleware/origin-allowlist";
import { checkRateLimit, ipIdentifier } from "@/server/middleware/rate-limit";
import { signUploadAndInsert } from "@/server/storage/sign-upload";

// POST /api/uploads/sign — SCAFFOLD.15 plan §5.6.
//
// Seven-step handler stack per AGENTS.md §7 / SPEC.2 §3.1, with one
// documented exemption (Idempotency-Key per SCAFFOLD.15 Q2 + SPEC.2 §11
// amendment — orphan-sweep cleans duplicate-mint within ≤2h):
//
//   1. Origin allowlist  (checkOrigin → 403 error_origin_rejected)
//   2. Auth gate          (auth.api.getSession → 401; pseudonym/tos → 403)
//   3. Idempotency lookup: EXEMPT
//   4. Rate-limit         (imagePutUrlPerIp per IP, 1m sliding window)
//   5. Body validate      (hand-rolled shape; semantic via signUploadAndInsert)
//   6. Handler body       (signUploadAndInsert — DB INSERT + R2 PUT-URL mint)
//   7. Events row + cache: STUB (ENGINE.6 fills via insertEvent helper)
//
// Returns `{ uploadId, putUrl, key }` JSON HTTP 200 on the happy path.

interface SignRequestBody {
	contentType: string;
	byteSize: number;
}

function parseBody(raw: unknown): SignRequestBody | null {
	if (!raw || typeof raw !== "object") return null;
	const b = raw as Record<string, unknown>;
	if (typeof b.contentType !== "string") return null;
	if (typeof b.byteSize !== "number") return null;
	return { contentType: b.contentType, byteSize: b.byteSize };
}

function extractIp(request: Request): string {
	const fwd = request.headers.get("x-forwarded-for");
	if (fwd) {
		const first = fwd.split(",")[0]?.trim();
		if (first) return first;
	}
	return "unknown";
}

function jsonResponse(body: unknown, init: ResponseInit): Response {
	return new Response(JSON.stringify(body), {
		...init,
		headers: {
			"content-type": "application/json",
			...(init.headers ?? {}),
		},
	});
}

export async function POST(request: Request): Promise<Response> {
	// 1. Origin allowlist (per SPEC.2 §4.1 amendment)
	if (!checkOrigin(request)) {
		return jsonResponse({ error: "error_origin_rejected" }, { status: 403 });
	}

	// 2. Auth gate — session presence + onboarding-complete
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session?.user?.id) {
		return jsonResponse({ error: "error_unauthenticated" }, { status: 401 });
	}
	const user = await db.query.users.findFirst({
		where: eq(users.id, session.user.id),
		columns: { pseudonym: true, tosAcceptedAt: true },
	});
	if (!user?.pseudonym || !user?.tosAcceptedAt) {
		return jsonResponse(
			{ error: "error_onboarding_required" },
			{ status: 403 },
		);
	}

	// 3. Idempotency: EXEMPT (per SCAFFOLD.15 Q2 + SPEC.2 §11 amendment).

	// 4. Rate-limit per IP (imagePutUrlPerIp / 1m sliding window)
	const ip = extractIp(request);
	const rl = await checkRateLimit("imagePutUrlPerIp", ipIdentifier(ip));
	if (!rl.allowed) {
		return jsonResponse(
			{ error: "error_rate_limit_exceeded" },
			{
				status: 429,
				headers: { "retry-after": String(rl.retryAfter) },
			},
		);
	}

	// 5. Body validate (shape only; semantic checks in signUploadAndInsert)
	let raw: unknown;
	try {
		raw = await request.json();
	} catch {
		return jsonResponse({ error: "error_invalid_json" }, { status: 400 });
	}
	const parsed = parseBody(raw);
	if (!parsed) {
		return jsonResponse(
			{ error: "error_invalid_request_body" },
			{ status: 400 },
		);
	}

	// 6. Handler body
	try {
		const result = await signUploadAndInsert({
			db,
			userId: session.user.id,
			contentType: parsed.contentType,
			byteSize: parsed.byteSize,
		});
		// 7. TODO(ENGINE.6): insertEvent(tx, { eventType: "image_upload.sign_requested", ... })
		return jsonResponse(result, { status: 200 });
	} catch (err) {
		if (err instanceof ImageMimeRejectedError) {
			return jsonResponse(err.toEnvelope(), { status: 400 });
		}
		if (err instanceof ImageOversizeError) {
			return jsonResponse(err.toEnvelope(), { status: 400 });
		}
		if (err instanceof StorageUnavailableError) {
			// Retry-After per SPEC.2 §11 fail-CLOSED convention. 5s matches the
			// idempotency-cache 503 surface; tunable in HARDEN.6 if needed.
			return jsonResponse(err.toEnvelope(), {
				status: 503,
				headers: { "retry-after": "5" },
			});
		}
		throw err;
	}
}
