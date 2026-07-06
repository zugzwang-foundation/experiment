import "server-only";

import { v7 as uuidv7 } from "uuid";

// SPEC.2 §4.4 wire-envelope helpers for Route Handlers OUTSIDE the bet stack
// (AUDIT-FIX-B7b A29; first consumers: the two upload-sign routes).
// DELIBERATELY DUPLICATED from the module-private implementations in
// src/server/bets/endpoint.ts (envelope / jsonResponse / REQUEST_ID_SAFE
// echo-or-mint) rather than exported from there — exporting would pull the
// bets critical path into every upload surface's import graph for three
// small pure functions. Unification (plus the §15.1 metadata fields and the
// error_origin_rejected → error_origin_not_allowed rename) rides the forward
// ENGINE error-envelope deliverable (ENGINE.8 Q4); the bets stack keeps its
// private copies until then.

/**
 * A client-supplied `x-request-id` is echoed for trace correlation ONLY if it
 * is a safe token; otherwise the handler mints a fresh UUIDv7. Reflecting a
 * raw value (e.g. a CR/LF-poisoned header) would throw in `new Response(...)`
 * and self-500 the request (security-auditor MEDIUM, ENGINE.8 cascade).
 */
const REQUEST_ID_SAFE = /^[A-Za-z0-9_-]{1,200}$/;

/** Resolve the §4.4 request id once at handler entry: echo-or-mint. */
export function resolveRequestId(request: Request): string {
	const inbound = request.headers.get("x-request-id");
	return inbound && REQUEST_ID_SAFE.test(inbound) ? inbound : uuidv7();
}

/** §4.4 error envelope. `retry_after` (body) is present only for 429 / 503. */
export function envelope(
	code: string,
	message: string,
	retryAfterBody?: number,
): {
	ok: false;
	error: { code: string; message: string; retry_after?: number };
} {
	const error: { code: string; message: string; retry_after?: number } = {
		code,
		message,
	};
	if (retryAfterBody !== undefined) {
		error.retry_after = retryAfterBody;
	}
	return { ok: false, error };
}

/** JSON response carrying `X-Request-Id` on EVERY response per §4.4. */
export function jsonResponse(
	requestId: string,
	status: number,
	body: unknown,
	retryAfterHeader?: number,
): Response {
	const headers: Record<string, string> = {
		"content-type": "application/json",
		"X-Request-Id": requestId,
	};
	if (retryAfterHeader !== undefined) {
		headers["retry-after"] = String(retryAfterHeader);
	}
	return new Response(JSON.stringify(body), { status, headers });
}
