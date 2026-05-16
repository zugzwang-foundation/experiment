import { auth } from "@/server/auth";

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

async function handleAuth(request: Request): Promise<Response> {
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

	return new Response(null, {
		status: 302,
		headers: {
			location: "/onboarding",
			"set-cookie": setCookie,
		},
	});
}

export const GET = handleAuth;
export const POST = handleAuth;
