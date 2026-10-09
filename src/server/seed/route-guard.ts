import "server-only";

import { requireAdminSession } from "@/server/admin/wire";
import { envelope, jsonResponse } from "@/server/middleware/envelope";
import { checkOrigin } from "@/server/middleware/origin-allowlist";

import { isSeedToolsEnabled } from "./gate";

// SEED-STAGING-1 — the shared front door of the two seeding Route Handlers.
//
// Order is deliberate. The environment check comes FIRST and answers 404, so
// wherever the tool is off (no ZUGZWANG_SEED_TOOLS on the task) these URLs
// behave exactly like URLs that do not exist — no
// origin check, no session lookup, nothing that would confirm the tool is
// there. Then the CSRF origin allowlist (SPEC.2 §4.1), then the admin session
// (the Layer-2 boundary; the cookie is scoped `Path=/admin`, which is why the
// handlers live under /admin and not /api). `runSeedChunk` re-asserts the
// environment itself, so a future caller that skips this function still
// cannot write.

export async function guardSeedRequest(
	request: Request,
	requestId: string,
): Promise<Response | null> {
	if (!isSeedToolsEnabled()) {
		// A BARE 404 — no §4.4 envelope, no X-Request-Id. The envelope's shape
		// alone told a caller "a handler lives here", which is exactly what this
		// arm exists not to say (security audit, LOW). An absent route answers
		// with no JSON body either.
		return new Response(null, { status: 404 });
	}
	if (!checkOrigin(request)) {
		return jsonResponse(
			requestId,
			403,
			envelope("error_origin_rejected", "origin not allowed"),
		);
	}
	if (!(await requireAdminSession())) {
		return jsonResponse(
			requestId,
			401,
			envelope("admin_session_required", "admin session required"),
		);
	}
	return null;
}
