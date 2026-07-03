import { eq } from "drizzle-orm";
import { v7 as uuidv7 } from "uuid";

import { db } from "@/db";
import { users } from "@/db/schema";
import {
	ImageMimeRejectedError,
	ImageOversizeError,
	StorageUnavailableError,
} from "@/lib/errors";
import { auth } from "@/server/auth";
import { PUT_URL_TTL_SECONDS } from "@/server/config/limits";
import { checkOrigin } from "@/server/middleware/origin-allowlist";
import { checkRateLimit, ipIdentifier } from "@/server/middleware/rate-limit";
import { mintPutUrl } from "@/server/storage/r2";
import { signUploadAndInsert } from "@/server/storage/sign-upload";

// POST /api/uploads/sign — SCAFFOLD.15 plan §5.6 + ENGINE.6 §D.1
// (SURPRISE-A absorption: separates the tx-bound INSERT+emit from the
// R2 HTTP hop per CLAUDE.md §3 + ADR-0014).
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
//   6. Handler body       (db.transaction wraps signUploadAndInsert;
//                          image_uploads INSERT + image_upload.sign_requested
//                          events row commit atomically inside the tx)
//   7. Events row         (folded into step 6 — emitted inside the helper
//                          tx; the tx commit IS the surface)
//
// `mintPutUrl` runs AFTER the tx commits — HTTP-outside-tx per CLAUDE.md §3.
// `eventId` is generated at handler entry per ADR-0016 D1; a retry with the
// same body would re-enter with a fresh eventId (idempotency exempt here),
// while a retry within the same handler invocation would reuse the captured
// id and the composite-PK ON CONFLICT dedupes on retry.
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

	// 6. Handler body — tx wraps signUploadAndInsert (INSERT + sync emit).
	// `eventId` generated here at handler entry per ADR-0016 D1 + ENGINE.6
	// plan V6. `metadata` carries the 7-field set per SPEC.2 §3.7;
	// `request_id`/`user_agent` placeholders 'unknown' pending HARDEN.*
	// request-context middleware (S-C deferral).
	const eventId = uuidv7();
	const metadata = {
		request_id: "unknown",
		flow_id: "F-COMMENT-3",
		user_id: session.user.id,
		actor_id: session.user.id,
		idempotency_key: null,
		ip,
		user_agent: request.headers.get("user-agent") ?? "unknown",
	};

	try {
		const result = await db.transaction(async (tx) =>
			signUploadAndInsert(tx, {
				userId: session.user.id,
				contentType: parsed.contentType,
				byteSize: parsed.byteSize,
				eventId,
				metadata,
			}),
		);
		// mintPutUrl AFTER tx commits — HTTP outside the DB transaction per
		// CLAUDE.md §3 + ADR-0014. A failure here returns 503 to the client
		// but leaves the image_uploads row + events row committed; the
		// orphan-sweep cron (SCAFFOLD.15) cleans the unused row within ≤2h.
		//
		// AUDIT-FIX-A1: `{ ifNoneMatch: true }` arms write-once. CLIENT CONTRACT:
		// the PUT MUST send header `If-None-Match: *` (it is a SigV4-signed header
		// — omitting it fails signature validation). The FIRST PUT creates the
		// object; a repeat PUT to the same URL/key → HTTP 412, which the client
		// treats as idempotent success (already-uploaded). This makes the object
		// physically immutable so the moderated bytes ≡ the rendered bytes.
		const putUrl = await mintPutUrl(
			"uploads",
			result.key,
			parsed.contentType,
			PUT_URL_TTL_SECONDS,
			{ ifNoneMatch: true },
		);
		return jsonResponse(
			{ uploadId: result.uploadId, putUrl, key: result.key },
			{ status: 200 },
		);
	} catch (err) {
		if (err instanceof ImageMimeRejectedError) {
			return jsonResponse(err.toEnvelope(), { status: 400 });
		}
		if (err instanceof ImageOversizeError) {
			return jsonResponse(err.toEnvelope(), { status: 400 });
		}
		if (err instanceof StorageUnavailableError) {
			// Retry-After per SPEC.2 §11 fail-CLOSED convention. 5s matches the
			// idempotency-cache 503 surface; tunable in HARDEN.5 if needed.
			return jsonResponse(err.toEnvelope(), {
				status: 503,
				headers: { "retry-after": "5" },
			});
		}
		throw err;
	}
}
