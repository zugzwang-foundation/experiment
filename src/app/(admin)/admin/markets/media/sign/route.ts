import { v7 as uuidv7 } from "uuid";

import { StorageUnavailableError } from "@/lib/errors";
import { requireAdminSession } from "@/server/admin/wire";
import {
	IMAGE_UPLOADS_ALLOWED_MIME,
	IMAGE_UPLOADS_EXT_BY_MIME,
	IMAGE_UPLOADS_MAX_BYTES,
	PUT_URL_TTL_SECONDS,
} from "@/server/config/limits";
import { isUuidV7 } from "@/server/markets/media";
import { logRequest } from "@/server/middleware/logging";
import { checkOrigin } from "@/server/middleware/origin-allowlist";
import { checkRateLimit, ipIdentifier } from "@/server/middleware/rate-limit";
import { mintPutUrl } from "@/server/storage/r2";

// POST /admin/markets/media/sign — MEDIA.1 (OD-4 / ADR-0026 / ADR-0027).
// The greenfield admin signed-PUT mint, FORKED from the participant
// `/api/uploads/sign` (NOT reused — that route is hard-bound to a `users` row;
// the admin has no `users` row per F-AUTH-ADMIN). ADR-0027: market-media is
// operator-curated trusted content — written directly, NOT moderated; this
// route does not import or touch `src/server/moderation/**`.
//
// URL placement (load-bearing): this handler lives under the `(admin)/admin/`
// route group so its URL is `/admin/markets/media/sign`, NOT `/api/admin/...`.
// The `zugzwang_admin_session` cookie is scoped `Path=/admin` (HttpOnly, set in
// auth/admin/login.ts), so the browser only attaches it to `/admin/*` URLs — a
// route under `/api/admin/...` would never receive the cookie and the admin gate
// would 401 the legitimate admin. Keeping the route under `/admin/` matches the
// tight cookie path WITHOUT broadening the cookie scope (broadening to `/` would
// leak the admin cookie to every participant route — §8.7 isolation).
//
// Differences from the participant route:
//   - Admin session gate (`requireAdminSession`, the CVE-2025-29927 Layer-2
//     boundary) instead of a Better Auth participant session.
//   - DB-FREE: no `market_media` row is written here — the row is written in
//     the create transaction (`createMarket`). The mint only returns a signed
//     PUT URL + the server-generated key.
//   - The `mediaId` is SERVER-generated (Q3 R2 facet): the client supplies only
//     `{ marketId, contentType, byteSize }` and can NEVER supply or target the
//     `mediaId` / object key, so a signed PUT cannot be aimed at an existing
//     object's key. Combined with row-driven display (an unreferenced object
//     never surfaces in any market's carousel), a PUT minted under an arbitrary
//     `marketId` can at worst create a harmless unreferenced orphan.
//
// Handler order: origin allowlist → admin session → per-IP rate cap → body
// validate (UUIDv7 marketId + MIME/size upload hygiene — validation, NOT
// moderation) → mint. Returns `{ mediaId, putUrl, key }` HTTP 200 on success.

type AllowedMime = (typeof IMAGE_UPLOADS_ALLOWED_MIME)[number];

function isAllowedMime(mime: string): mime is AllowedMime {
	return (IMAGE_UPLOADS_ALLOWED_MIME as readonly string[]).includes(mime);
}

interface SignRequestBody {
	marketId: string;
	contentType: string;
	byteSize: number;
}

function parseBody(raw: unknown): SignRequestBody | null {
	if (!raw || typeof raw !== "object") return null;
	const b = raw as Record<string, unknown>;
	if (typeof b.marketId !== "string") return null;
	if (typeof b.contentType !== "string") return null;
	if (typeof b.byteSize !== "number") return null;
	// Any extra fields (a smuggled `mediaId` / `key`) are deliberately ignored —
	// the server generates the mediaId + key (Q3 R2 facet).
	return {
		marketId: b.marketId,
		contentType: b.contentType,
		byteSize: b.byteSize,
	};
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
	const startedAt = Date.now();

	// 1. Origin allowlist (CSRF defense per SPEC.2 §4.1).
	if (!checkOrigin(request)) {
		return jsonResponse({ error: "error_origin_rejected" }, { status: 403 });
	}

	// 2. Admin session gate (Layer-2, SA-I-1). Zero side effects on reject.
	if (!(await requireAdminSession())) {
		return jsonResponse({ error: "admin_session_required" }, { status: 401 });
	}

	// 3. Per-IP rate cap on the URL mint (anti-abuse, NOT moderation).
	const ip = extractIp(request);
	const rl = await checkRateLimit("adminMediaPutUrlPerIp", ipIdentifier(ip));
	if (!rl.allowed) {
		return jsonResponse(
			{ error: "error_rate_limit_exceeded" },
			{ status: 429, headers: { "retry-after": String(rl.retryAfter) } },
		);
	}

	// AUDIT-FIX-B1 A17 (§16.3): handler-body outcomes only — step 4 onward
	// logs; origin/admin-session/429 rejections above never do. `userId: null`
	// — the admin has no `users` row (refusal trigger §3); the `route` field
	// marks the row as the admin surface in the dataset.
	const log = (status: number): void =>
		logRequest({ request, status, userId: null, startedAt });

	// 4. Body validate (shape + UUIDv7 marketId + MIME/size upload hygiene).
	let raw: unknown;
	try {
		raw = await request.json();
	} catch {
		log(400);
		return jsonResponse({ error: "error_invalid_json" }, { status: 400 });
	}
	const parsed = parseBody(raw);
	if (!parsed) {
		log(400);
		return jsonResponse(
			{ error: "error_invalid_request_body" },
			{ status: 400 },
		);
	}
	// The client-supplied marketId is the pre-generated PK (a trust boundary,
	// Q3) — reject anything not a well-formed UUIDv7.
	if (!isUuidV7(parsed.marketId)) {
		log(400);
		return jsonResponse({ error: "error_invalid_market_id" }, { status: 400 });
	}
	if (!isAllowedMime(parsed.contentType)) {
		log(400);
		return jsonResponse(
			{ error: "error_image_mime_rejected" },
			{ status: 400 },
		);
	}
	if (
		!Number.isInteger(parsed.byteSize) ||
		parsed.byteSize <= 0 ||
		parsed.byteSize > IMAGE_UPLOADS_MAX_BYTES
	) {
		log(400);
		return jsonResponse({ error: "error_image_oversize" }, { status: 400 });
	}

	// 5. Mint — server-generated mediaId + key in the `m/<marketId>/` namespace
	// of the third R2 bucket arm. DB-FREE (the market_media row is written in
	// the create tx, not here).
	const mediaId = uuidv7();
	const ext = IMAGE_UPLOADS_EXT_BY_MIME[parsed.contentType];
	const key = `m/${parsed.marketId}/${mediaId}.${ext}`;
	try {
		const putUrl = await mintPutUrl(
			"market-media",
			key,
			parsed.contentType,
			PUT_URL_TTL_SECONDS,
		);
		log(200);
		return jsonResponse({ mediaId, putUrl, key }, { status: 200 });
	} catch (err) {
		if (err instanceof StorageUnavailableError) {
			log(503);
			return jsonResponse(err.toEnvelope(), {
				status: 503,
				headers: { "retry-after": "5" },
			});
		}
		// Crash path — unlogged (Next onRequestError → Sentry owns it).
		throw err;
	}
}
