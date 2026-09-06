import { auth } from "@/server/auth";
import {
	classifyDevice,
	isAuthBlockedDevice,
} from "@/server/auth/device-class";
import { logDeviceGateReject } from "@/server/middleware/logging";

// Better Auth catch-all mount per SPEC.2 §8.10 + plan §3 step 11.
//
// On a `session.create.before` throw of APIError("FORBIDDEN",
// "ONBOARDING_REQUIRED"), the hook attaches a signed `onboardingRef` token
// to the APIError body (per createSessionGate at src/server/auth/session-
// gate.ts). Empirical probe at
// `tests/server/auth/_probe-apierror-body-survival.test.ts` confirms that
// Better Auth's better-call HTTP serialization (to-response.mjs:117-121)
// preserves arbitrary body fields verbatim through APIError → Response.
//
// This route wrapper intercepts the 403 ONBOARDING_REQUIRED response,
// lifts the `onboardingRef` into a `Set-Cookie` header (matching plan §3
// onboarding-ref attributes — Path=/onboarding, HttpOnly, Secure, SameSite
// =Lax, Max-Age=600), and converts to a 302 redirect to `/onboarding`.
// Any other 403 (or any other status) passes through unchanged.

const ONBOARDING_REF_MAX_AGE_SEC = 600;

// MOBILE-1 · Phase B — ADR-0045's Join/Login exclusion, call site 1 (plan §3).
// The short-code convention is this file's own: `admin_login_invalid`,
// `oauth_email_not_verified`, `identity_pool_exhausted`.
const MOBILE_AUTH_UNAVAILABLE = "mobile_auth_unavailable";

async function handleAuth(request: Request): Promise<Response> {
	// Hoisted from the ONBOARDING_REQUIRED branch below, where this pair used to
	// be computed AFTER `auth.handler` had already run. The device gate needs the
	// same discriminator BEFORE that call, and the alternative was a second copy
	// of the `/api/auth/callback/` literal — two strings that decide the same
	// thing and can disagree. One computation, two readers, zero behaviour change
	// to the branch below.
	const url = new URL(request.url);
	const isOAuthCallback = url.pathname.startsWith("/api/auth/callback/");

	// ⛔ THE DEVICE GATE IS THE FIRST THING IN THIS FUNCTION, AND THAT POSITION
	// IS THE POINT (ADR-0045; plan §3 call site 1). A blocked request must not
	// reach `auth.handler` at all — no session created, no OTP sent, no OAuth
	// state minted, none of the ONBOARDING_REQUIRED machinery below. "Rejected
	// after Better Auth did the work" and "rejected" look identical from outside
	// and are not the same guarantee.
	//
	// ⚠ IT DOES NOT AFFECT A SIGNED-IN PARTICIPANT ON A PHONE, and that is
	// verified rather than assumed (plan §3 Scope, re-checked against the tree
	// this session): the Better Auth React client is this route's ONLY HTTP
	// consumer in the whole tree and appears in exactly two files, both of them
	// the sign-in pages this task also gates. Every session READ is
	// `auth.api.getSession({ headers })` in-process, sign-out is an in-process
	// Server Action, and `disableSessionRefresh: true` means no background
	// refresh traffic. Nothing an existing mobile session does while browsing,
	// betting or commenting ever arrives here.
	const userAgent = request.headers.get("user-agent");
	if (isAuthBlockedDevice(userAgent)) {
		logDeviceGateReject({
			callSite: "auth-route",
			deviceClass: classifyDevice(userAgent),
			userAgent,
			route: url.pathname,
		});

		// Two response shapes, one per consumer type — the same distinction this
		// file already draws for ONBOARDING_REQUIRED, reused rather than a third
		// shape invented for the gate (plan §3, M1-6). An OAuth callback is a
		// BROWSER NAVIGATION: answering it with a JSON blob strands the visitor
		// staring at one, so it goes to `/sign-in`, which renders the "computer
		// only" message below the breakpoint.
		//
		// ⛔ NO `Set-Cookie` ON EITHER ARM. The block runs before any session or
		// onboarding-ref exists, so there is nothing to set — and setting
		// something on a rejected request is how a half-issued session is born.
		// ⚠ `no-store` + `vary` ARE LOAD-BEARING ON THESE TWO ARMS SPECIFICALLY.
		// A shared cache that stored a phone's reject and replayed it to a laptop
		// would produce the single failure plan §5 says is the one that matters:
		// a real desktop signup wrongly blocked, with nothing in the logs to show
		// it, because the request never reached us. `no-store` closes that
		// direction outright.
		//
		// ⚠ THE HEADERS ARE HERE AND THE VARIANCE IS NOT — say it precisely,
		// because the tempting version of this comment is wrong. Every other
		// response this route emits is Better Auth's or is derived from one and
		// inherits its HEADERS; what it no longer inherits is the fact that this
		// whole route's behaviour is now User-Agent-dependent. The reverse
		// direction — a cached desktop pass-through replayed to a phone — is
		// therefore not covered here, and is deliberately left alone: it lands in
		// ADR-0045's already-ratified bypass class, and auth traffic is POST and
		// Set-Cookie-bearing, so nothing shared caches it in practice.
		const rejectCacheHeaders = {
			"cache-control": "no-store",
			vary: "user-agent",
		};

		if (isOAuthCallback) {
			return new Response(null, {
				status: 302,
				headers: { location: "/sign-in", ...rejectCacheHeaders },
			});
		}

		return new Response(JSON.stringify({ code: MOBILE_AUTH_UNAVAILABLE }), {
			status: 403,
			headers: {
				"content-type": "application/json",
				...rejectCacheHeaders,
			},
		});
	}

	const response = await auth.handler(request);

	// Only intercept FORBIDDEN responses (where ONBOARDING_REQUIRED can fire).
	if (response.status !== 403) return response;

	// Clone so the original response body can still be returned on
	// pass-through (response body is consumable once).
	const cloned = response.clone();
	let parsed: { message?: unknown; onboardingRef?: unknown };
	try {
		parsed = (await cloned.json()) as typeof parsed;
	} catch {
		// Body wasn't JSON (e.g. plain text 403). Pass through.
		return response;
	}

	if (
		parsed.message !== "ONBOARDING_REQUIRED" ||
		typeof parsed.onboardingRef !== "string" ||
		parsed.onboardingRef.length === 0
	) {
		// 403 from somewhere else (e.g. moderation rejection) — pass through.
		return response;
	}

	const setCookie = [
		`onboarding_ref=${parsed.onboardingRef}`,
		"Path=/onboarding",
		"HttpOnly",
		"Secure",
		"SameSite=Lax",
		`Max-Age=${ONBOARDING_REF_MAX_AGE_SEC}`,
	].join("; ");

	// §18 Amendment 1.6 path discriminator: the OAuth callback path is
	// a browser-navigation consumer (Google redirects the user-agent
	// here post-consent); the SDK email-OTP-verify path is a
	// programmatic JSON consumer. Two response shapes, one per
	// consumer-type. The token rides only in the HttpOnly cookie either
	// way; the 302 branch has a null body so the HMAC onboardingRef is
	// never visible in the response (screenshot-leak surface closed).
	//
	// `url` / `isOAuthCallback` are computed once at the top of this function
	// (MOBILE-1 Phase B) because the device gate needs the same discriminator
	// before `auth.handler` runs. Same values, same names, unchanged meaning
	// here.
	if (isOAuthCallback) {
		return new Response(null, {
			status: 302,
			headers: {
				location: "/onboarding",
				"set-cookie": setCookie,
			},
		});
	}

	// SDK consumer path. FLAT JSON body matches better-fetch's
	// error-spread at @better-fetch/fetch/dist/index.js:676-680 + Better
	// Auth's APIError serialization convention per
	// tests/server/auth/_probe-apierror-body-survival.test.ts. Detection
	// at src/app/(auth)/sign-in/otp/page.tsx via
	// `sdkError?.message === "ONBOARDING_REQUIRED"`.
	return new Response(
		JSON.stringify({
			message: parsed.message,
			onboardingRef: parsed.onboardingRef,
		}),
		{
			status: 403,
			headers: {
				"content-type": "application/json",
				"set-cookie": setCookie,
			},
		},
	);
}

export const GET = handleAuth;
export const POST = handleAuth;
