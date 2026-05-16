import { type NextRequest, NextResponse } from "next/server";

// Next.js 16 edge middleware. File named `proxy.ts` per the
// middleware-to-proxy rename (see
// `node_modules/next/dist/lib/constants.js:PROXY_FILENAME`). Function MUST
// be named `proxy` (matching filename) per Next.js's static-info detector
// at `node_modules/next/dist/build/analysis/get-page-static-info.js:299`.
//
// Layer 1 (UX) admin-redirect per SPEC.2 §8.4 + SPEC.2 §8.10 file map.
// NOT a security boundary — middleware is bypassable in some deployment
// configurations (CVE-2025-29927 documented the bypass class). The actual
// admin authority check is Layer 2 at `src/server/auth/admin/validate.ts`,
// called at every admin handler entry.
//
// TODO(SCAFFOLD.5+): `request_id` / `ip` / `user_agent` header injection
// per SPEC.2 §3.7 + plan §3 file map — deferred until observability
// substrate (Sentry, Vercel logs) lands.

const ADMIN_COOKIE = "zugzwang_admin_session";

export function proxy(request: NextRequest): NextResponse {
	const { pathname } = request.nextUrl;

	// `/admin/*` without admin cookie → redirect to `/admin/login`.
	// `/admin/login` is excluded to avoid a redirect loop on the login
	// page itself; the route is intentionally unprotected.
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

// Matcher per Next.js 16 convention. Limit middleware to `/admin/*` so the
// rest of the app doesn't pay the middleware-pass cost on every request.
export const config = {
	matcher: ["/admin/:path*"],
};
