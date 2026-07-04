import { eq } from "drizzle-orm";
import { v7 as uuidv7 } from "uuid";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// FIX-AUTH-LOGIN §"End-to-end test" — RED-first end-to-end integration guard
// for the returning/onboarded-user sign-in 500. Every existing auth test
// either stops at the create-path (signup-create-path.integration.test.ts:
// internalAdapter.createOAuthUser, which never reaches setSessionCookie) or
// drives the OTP *send* path (email-otp-send.integration.test.ts, which never
// issues a session). No test drives a real session-issuance through to the
// session-COOKIE write. That gap let this bug ship; this closes it.
//
// THE BUG (root-caused in the kickoff Evidence chain, verified against
// node_modules @ better-auth 1.6.11 + better-call 1.3.5):
//
//   src/server/auth/index.ts:48 sets ONE_HUNDRED_YEARS_SEC = 60*60*24*365*100
//   = 3_153_600_000s, fed into session.expiresIn (index.ts:208). On any real
//   session-issuance, Better Auth's setSessionCookie
//   (better-auth/dist/cookies/index.mjs:126-127) passes that value AS the
//   session cookie's `maxAge`:
//       const maxAge = dontRememberMe ? void 0 : ctx.context.sessionConfig.expiresIn;
//   better-call's cookie serializer `_serialize`
//   (better-call/dist/cookies.mjs:54-55) then THROWS:
//       if (opt.maxAge > 3456e4) throw new Error(
//         "Cookies Max-Age SHOULD NOT be greater than 400 days
//          (34560000 seconds) in duration.");
//   3456e4 = 34_560_000s (400 days). 3_153_600_000 > 34_560_000 → throw.
//
// That throw is a PLAIN Error, not an APIError. better-call's endpoint
// wrapper (endpoint.mjs:31-37) and Better Auth's api wrapper
// (api/to-auth-endpoints.mjs:100-143) both re-throw any non-APIError from the
// handler (`if (isAPIError(e)) {...} throw e`), so it propagates straight out
// of `auth.api.signInEmailOTP` and — in the live catch-all route — surfaces as
// an uncaught 500. First-time signup never reaches it: the
// `session.create.before` gate (session-gate.ts) throws
// APIError("FORBIDDEN","ONBOARDING_REQUIRED") first, short-circuiting before
// setSessionCookie. The bug is reachable ONLY once a user is onboarded
// (pseudonym + tos_accepted_at both set), so the gate PASSES → createSession →
// setSessionCookie → throw.
//
// DRIVING PATH = email-OTP sign-in (`auth.api.signInEmailOTP`), the kickoff's
// "acceptable fallback". The throw lives in the SHARED setSessionCookie path,
// so it is FLOW-AGNOSTIC: the Google OAuth callback hits the identical
// setSessionCookie maxAge throw via the same createSession → setSessionCookie
// sequence (routes.mjs signInEmailOTP:413-417 and the OAuth callback both call
// `setSessionCookie(ctx, { session, user })`). We pick email-OTP because it is
// deterministically drivable WITHOUT a stored OAuth `state` + mocked Google
// token/userinfo exchange — we seed a plaintext `verifications` row directly
// and verify against it (the default `storeOTP` is "plain"; otp-token.mjs
// verifyStoredOTP does `constantTimeEqual(otp, storedOtp)`), so no `send`,
// Resend, or Turnstile round-trip is needed. NO mocking of better-auth's
// cookie layer, the session-gate, the adapter, or setSessionCookie — the throw
// must be reached for real, which IS the RED.
//
// RED on the current (unfixed) 100y code: ACT throws the verbatim
// `Cookies Max-Age SHOULD NOT be greater than 400 days (34560000 seconds) in
// duration.` GREEN after the kickoff's fix caps expiresIn at 34_560_000.

// The session-cookie name carries the `__Secure-` prefix ONLY when Better Auth
// computes secure cookies on — which it derives from `baseURL` starting with
// `https://` (cookies/index.mjs:20). The shared test env (tests/_setup/env.ts)
// seeds BETTER_AUTH_URL = "http://localhost:3000" via `??=`, which would yield
// the bare `zugzwang_session` name. `auth` reads BETTER_AUTH_URL ONCE at
// module-eval (index.ts:205 baseURL). A vi.hoisted block runs BEFORE the
// `import { auth }` below is evaluated, so overriding the var to https here
// makes the SPEC.2 §8.5 production cookie name `__Secure-zugzwang_session`
// deterministic in-test (this is the name the live deploy emits; the unfixed
// throw is independent of the prefix). This sets only this file's process.env;
// fileParallelism:false (vitest.config.ts) means no cross-file env race.
vi.hoisted(() => {
	process.env.BETTER_AUTH_URL = "https://localhost:3000";
});

import { sessions, users, verifications } from "@/db/schema";
import { auth } from "@/server/auth/index";
import { testClient, testDb } from "../db/_fixtures/db";
import { truncateTables } from "../db/_fixtures/truncate";

// SPEC.2 §8.5 cookie table — participant session cookie. `secure:true` (set in
// auth/index.ts advanced.cookies.session_token.attributes) + the https baseURL
// override above ⇒ Better Auth prepends `__Secure-` to the configured name.
const SESSION_COOKIE_NAME = "__Secure-zugzwang_session";
const FOUR_HUNDRED_DAYS_SEC = 34_560_000; // 3456e4 — better-call's ceiling.

const EMAIL = "onboarded-login-red@example.com";
// Better Auth email-OTP identifier format is `${type}-otp-${email}`
// (email-otp/utils.mjs toOTPIdentifier); the sign-in route lowercases the
// email before composing it (routes.mjs signInEmailOTP `rawEmail.toLowerCase()`
// → toOTPIdentifier("sign-in", email)). type = "sign-in".
const OTP_IDENTIFIER = `sign-in-otp-${EMAIL.toLowerCase()}`;
// Plaintext OTP. Default `storeOTP` ("plain") stores the bare code; the
// verifier (otp-token.mjs verifyStoredOTP) does constantTimeEqual(provided,
// stored). The stored `value` carries no colon, so splitAtLastColon yields
// [otp, ""] — attempts="" (falsy), no attempt-cap trip.
const OTP_CODE = "424242";

// An already-onboarded user: pseudonym AND tos_accepted_at BOTH set so
// createSessionGate (session-gate.ts:37) PASSES and execution reaches
// setSessionCookie. emailVerified:true so signInEmailOTP takes the existing-
// user branch (routes.mjs:401-426) without an emailVerified UPDATE detour.
const SEEDED_PSEUDONYM = "OnboardedHawk777";

// truncateTables (not DELETE): users/sessions/verifications are append-only or
// FK-anchored; identity_pool carries a Bucket-B no-delete trigger
// (0003_append_only_triggers.sql) and, since 0021, a no-truncate guard — the
// fixture disables the guards for exactly one teardown transaction.
// CASCADE clears FK dependents of users (sessions, accounts, dharma_ledger,
// …). Mirrors signup-create-path.integration.test.ts verbatim.
async function truncateAll(): Promise<void> {
	await truncateTables(testClient, [
		"users",
		"accounts",
		"sessions",
		"identity_pool",
		"verifications",
	]);
}

let seededUserId: string;

beforeEach(async () => {
	await truncateAll();

	// Seed the onboarded user directly (no signup flow — we are testing LOGIN,
	// not signup). pseudonym is NOT NULL + UNIQUE; tos_accepted_at non-null +
	// pseudonym non-null ⇒ the gate passes.
	seededUserId = uuidv7();
	await testDb.insert(users).values({
		id: seededUserId,
		name: "Onboarded Hawk",
		email: EMAIL,
		emailVerified: true,
		pseudonym: SEEDED_PSEUDONYM,
		tosAcceptedAt: new Date("2026-01-01T00:00:00.000Z"),
	});

	// Seed a valid, unexpired sign-in OTP verification row so atomicVerifyOTP
	// (routes.mjs:777) passes WITHOUT a send round-trip. expiresAt 10 min out.
	await testDb.insert(verifications).values({
		identifier: OTP_IDENTIFIER,
		value: OTP_CODE,
		expiresAt: new Date(Date.now() + 10 * 60 * 1000),
	});
});

afterEach(async () => {
	await truncateAll();
	vi.clearAllMocks();
});

// Parses the Max-Age (seconds) from the `Set-Cookie` line for a given cookie
// name out of a getSetCookie() array. Returns the integer, or null if the
// cookie/attribute is absent. Set-Cookie shape (better-call cookies.mjs:56):
//   `__Secure-zugzwang_session=...; Max-Age=<n>; Path=/; HttpOnly; Secure; ...`
function maxAgeForCookie(
	setCookies: string[],
	cookieName: string,
): number | null {
	const line = setCookies.find((c) => c.startsWith(`${cookieName}=`));
	if (!line) return null;
	const match = line.match(/(?:^|;)\s*Max-Age=(-?\d+)/i);
	if (!match) return null;
	return Number.parseInt(match[1] as string, 10);
}

describe("Onboarded-user email-OTP sign-in through Better Auth (FIX-AUTH-LOGIN)", () => {
	it("onboarded-login-session::issues-session-cookie-without-500", async () => {
		// ACT — drive the REAL session-issuance: signInEmailOTP verifies the
		// seeded OTP → findUserByEmail returns the onboarded user → createSession
		// (fires session.create.before gate, which PASSES) → setSessionCookie.
		// `returnHeaders: true` makes the wrapper return { response, headers }
		// (api/to-auth-endpoints.mjs:175-181) so we can read the emitted
		// Set-Cookie header on the GREEN path. On the unfixed 100y code,
		// setSessionCookie throws BEFORE the wrapper returns — the rejection
		// propagates here (the throw is a plain Error, re-thrown by both the
		// better-call and better-auth wrappers).
		const act = () =>
			auth.api.signInEmailOTP({
				body: { email: EMAIL, otp: OTP_CODE },
				returnHeaders: true,
			});

		// ASSERT (a) — the session-issuance call resolves WITHOUT throwing.
		// RED on unfixed code: rejects with
		//   `Cookies Max-Age SHOULD NOT be greater than 400 days (34560000
		//    seconds) in duration.`
		// We capture the resolved value to read its headers in (b). Using a
		// resolves-assertion (not bare await) so the RED surfaces as a clean
		// assertion failure quoting the throw rather than an unhandled rejection.
		const result = await act();
		expect(result).toBeTruthy();

		// ASSERT (b) — the participant session cookie is present in the response
		// Set-Cookie, and its Max-Age is a number ≤ 34_560_000 (400 days). This
		// is the post-fix expectation; on the unfixed code execution never gets
		// here (a) threw first. The wrapper returns a Headers object;
		// getSetCookie() yields one entry per Set-Cookie line.
		const setCookies = (result as { headers: Headers }).headers.getSetCookie();
		const sessionLine = setCookies.find((c) =>
			c.startsWith(`${SESSION_COOKIE_NAME}=`),
		);
		expect(sessionLine).toBeDefined();

		const maxAge = maxAgeForCookie(setCookies, SESSION_COOKIE_NAME);
		expect(maxAge).not.toBeNull();
		expect(typeof maxAge).toBe("number");
		expect(maxAge as number).toBeLessThanOrEqual(FOUR_HUNDRED_DAYS_SEC);

		// ASSERT (c, strengthener) — a real sessions row was issued for the
		// onboarded user. Most meaningful post-fix; on the unfixed path the gate
		// passes and createSession writes the row BEFORE setSessionCookie throws,
		// so this is not the RED discriminator — (a)/(b) are.
		const sessionRows = await testDb
			.select()
			.from(sessions)
			.where(eq(sessions.userId, seededUserId));
		expect(sessionRows.length).toBeGreaterThanOrEqual(1);
	});
});
