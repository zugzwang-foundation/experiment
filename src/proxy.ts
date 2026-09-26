import { type NextRequest, NextResponse } from "next/server";
import {
	isWritesPaused,
	writesPausedRetryAfterSeconds,
} from "@/server/config/writes-paused";

// Layer 2 admin session validator per CVE-2025-29927 + SPEC.2 §8.4 +
// AWS-MIGRATION-3's write-pause. Two jobs, both cheap and both before any
// handler runs:
//
//   1. /admin/* without the admin cookie → /admin/login (unchanged).
//   2. While ZUGZWANG_WRITES_PAUSED === "paused", every WRITE is answered
//      503 + Retry-After here, before any Redis reservation, idempotency
//      sentinel or transaction can start. Reads, health and readiness pass.
//
// "Write" is decided structurally, and the structure FAILS CLOSED:
//   - the matcher covers every route except static assets, so a page nobody
//     listed still runs through here (`@security-auditor` H-2: `/legal` owns
//     a registered Server Action worker and the first version's allowlist
//     never matched it);
//   - any request carrying the `Next-Action` header is a write (a Server
//     Action is a POST to a page URL — ToS accept, onboarding, the admin
//     market actions and moderation all travel that way);
//   - under `/api/auth/` EVERY method is a write except the one read that is
//     known to be a read, because Better Auth's OAuth callback is a GET that
//     consumes an identity-pool tuple and inserts users/accounts/sessions
//     (`@security-auditor` H-1) — a method gate alone lets it through;
//   - cron routes are GETs that write, so they are paused by path;
//   - everything else non-GET/HEAD/OPTIONS under the write prefixes.
const ADMIN_COOKIE = "zugzwang_admin_session";
const READ_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const AUTH_PREFIX = "/api/auth/";
const AUTH_READS = new Set(["/api/auth/get-session", "/api/auth/ok"]);
const CRON_PREFIX = "/api/cron/";
const WRITE_PATH_PREFIXES = [
	"/api/bets/",
	"/api/uploads/",
	"/api/visits",
	"/admin",
];

function isPausedWrite(request: NextRequest): boolean {
	const { pathname } = request.nextUrl;
	if (pathname.startsWith(CRON_PREFIX)) return true;
	if (request.headers.has("next-action")) return true;
	if (pathname.startsWith(AUTH_PREFIX)) {
		return !(READ_METHODS.has(request.method) && AUTH_READS.has(pathname));
	}
	if (READ_METHODS.has(request.method)) return false;
	return WRITE_PATH_PREFIXES.some((p) => pathname.startsWith(p));
}

export function proxy(request: NextRequest): NextResponse {
	const { pathname } = request.nextUrl;

	if (isWritesPaused() && isPausedWrite(request)) {
		const retryAfter = writesPausedRetryAfterSeconds();
		return NextResponse.json(
			{
				ok: false,
				error: {
					code: "error_writes_paused",
					message: "writes are paused for maintenance; retry shortly",
					retry_after: retryAfter,
				},
			},
			{
				status: 503,
				headers: {
					"Retry-After": String(retryAfter),
					"Cache-Control": "no-store",
				},
			},
		);
	}

	if (pathname.startsWith("/admin") && pathname !== "/admin/login") {
		const adminCookie = request.cookies.get(ADMIN_COOKIE);
		if (!adminCookie?.value) {
			const url = request.nextUrl.clone();
			url.pathname = "/admin/login";
			return NextResponse.redirect(url);
		}
	}
	return NextResponse.next();
}

// Everything except Next's static output and files with an extension (the
// public assets). An allowlist of routes is the shape that fails OPEN on the
// next route somebody adds; this one fails closed. `/admin/:path*` is still
// reached by it, so the cookie gate above keeps matching.
export const config = {
	matcher: ["/((?!_next/static|_next/image|favicon\\.ico|.*\\..*).*)"],
};
