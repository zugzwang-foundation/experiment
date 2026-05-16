import { beforeAll, describe, expect, it } from "vitest";

// Per SCAFFOLD.3 plan §7 + §3 + §4 step 6 — the signed pre-session
// `onboarding_ref` cookie helpers at `src/server/auth/onboarding-ref.ts`.
// HMAC-SHA256 over `${userId}.${exp}` with `BETTER_AUTH_SECRET`, base64url
// encoded. Payload `{ userId, exp }` carries the session-gate-throw userId
// across the redirect to `/onboarding` so the ToS page + acceptTosAction
// can identify the pre-session user without trusting client-side state.
//
// Real `node:crypto` primitives are exercised — these are the security
// primitives themselves. No mocking; controlled inputs only.
//
// Note: this test file pre-loads `BETTER_AUTH_SECRET` in `beforeAll` because
// `onboarding-ref.ts` reads `process.env.BETTER_AUTH_SECRET` at call time.

beforeAll(() => {
	// Test secret — any constant value works for the round-trip property.
	process.env.BETTER_AUTH_SECRET = "test-secret-for-onboarding-ref-32bytes";
});

import {
	signOnboardingRef,
	verifyOnboardingRef,
} from "@/server/auth/onboarding-ref";

describe("onboarding-ref signed cookie", () => {
	it("onboarding-ref::sign-then-verify-round-trips", () => {
		// Round-trip property: signOnboardingRef({ userId, exp }) → token;
		// verifyOnboardingRef(token) → { userId }. The signer + verifier are
		// the contract; if either side drifts (e.g., delimiter change, base64
		// vs base64url, HMAC key rotation), the round-trip breaks.
		const userId = "01234567-89ab-cdef-0123-456789abcdef";
		const exp = Math.floor(Date.now() / 1000) + 600; // 10 min from now

		const token = signOnboardingRef({ userId, exp });
		expect(typeof token).toBe("string");
		expect(token.length).toBeGreaterThan(0);

		const verified = verifyOnboardingRef(token);
		expect(verified).not.toBeNull();
		expect(verified?.userId).toBe(userId);
	});

	it("onboarding-ref::token-is-base64url", () => {
		// Plan §3 + §4 step 6: HMAC-SHA256 signed payload in base64url. The
		// emitted string MUST contain only base64url alphabet
		// `[A-Za-z0-9_-]` plus an internal payload/signature separator (`.`).
		// Specifically: no `+`, no `/`, no `=` padding — those would be
		// classic base64 (not URL-safe) and break cookie value rules.
		const userId = "01234567-89ab-cdef-0123-456789abcdef";
		const exp = Math.floor(Date.now() / 1000) + 600;
		const token = signOnboardingRef({ userId, exp });

		// Cookie-safe characters only. The implementation may use a `.`
		// payload-signature separator (JWT-style) or another inner shape;
		// either way the outer alphabet must stay URL-safe.
		expect(token).toMatch(/^[A-Za-z0-9_.-]+$/);
		expect(token).not.toMatch(/[+/=]/);
	});

	it("onboarding-ref::verify-expired-returns-null", () => {
		// Plan §3: 10-min TTL via `Max-Age=600` on the cookie. The verifier
		// MUST also reject expired tokens server-side (the cookie attribute
		// is browser-side; an attacker replaying a stale cookie out-of-band
		// would otherwise bypass the TTL). Implementation reads `exp` from
		// the signed payload, rejects if `exp < now`.
		const userId = "01234567-89ab-cdef-0123-456789abcdef";
		const expiredAt = Math.floor(Date.now() / 1000) - 60; // 60s ago

		const token = signOnboardingRef({ userId, exp: expiredAt });
		const verified = verifyOnboardingRef(token);
		expect(verified).toBeNull();
	});

	it("onboarding-ref::verify-tampered-returns-null", () => {
		// Plan §5 failure-mode #13: cookie signature invalid (tampering) →
		// HMAC verify fails. Tamper by flipping a single character in the
		// payload portion; the signature won't match the modified payload.
		const userId = "01234567-89ab-cdef-0123-456789abcdef";
		const exp = Math.floor(Date.now() / 1000) + 600;
		const token = signOnboardingRef({ userId, exp });

		// Mutate one char in the middle. If implementation uses `payload.sig`
		// shape, this either lands in payload (sig won't match) or sig (sig
		// invalid). Either way verify must reject.
		const mid = Math.floor(token.length / 2);
		const tampered = `${token.slice(0, mid)}${token[mid] === "A" ? "B" : "A"}${token.slice(mid + 1)}`;
		expect(tampered).not.toBe(token);

		const verified = verifyOnboardingRef(tampered);
		expect(verified).toBeNull();
	});

	it("onboarding-ref::verify-wrong-secret-returns-null", () => {
		// HMAC-SHA256 with `BETTER_AUTH_SECRET` per plan §3. If the secret
		// rotates between sign + verify (or an attacker holds a token from a
		// pre-rotation epoch), the signature on the still-valid payload bytes
		// must fail to verify. Confirms the binding to the secret env var,
		// not to a static constant.
		const userId = "01234567-89ab-cdef-0123-456789abcdef";
		const exp = Math.floor(Date.now() / 1000) + 600;
		const token = signOnboardingRef({ userId, exp });

		// Swap the secret then re-verify the SAME token. The verifier reads
		// `process.env.BETTER_AUTH_SECRET` at call time per plan §3.
		const originalSecret = process.env.BETTER_AUTH_SECRET;
		process.env.BETTER_AUTH_SECRET = "different-secret-rotation-32bytes";
		const verified = verifyOnboardingRef(token);
		process.env.BETTER_AUTH_SECRET = originalSecret;

		expect(verified).toBeNull();
	});

	it("onboarding-ref::verify-malformed-returns-null", () => {
		// Robustness: malformed inputs (empty string, non-base64 chars,
		// missing delimiter) MUST return null — not throw. A throw at the
		// catch-all route's onboarding-page render would 500 the request
		// instead of redirecting to `/sign-in`.
		expect(verifyOnboardingRef("")).toBeNull();
		expect(verifyOnboardingRef("not-a-valid-token")).toBeNull();
		expect(verifyOnboardingRef("{}")).toBeNull();
		expect(verifyOnboardingRef("a.b.c.d")).toBeNull();
	});
});
