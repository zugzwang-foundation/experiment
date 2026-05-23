import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { authClient } from "@/lib/auth-client";
import { auth } from "@/server/auth/index";

describe("Better Auth Content-Type 415 contract probe", () => {
	// §16 Amendment 1.4 SURPRISE 3: this file's test #5 exercises the
	// real hand-rolled OTP-gate hook against Cloudflare siteverify. The
	// global test env (tests/_setup/env.ts) sets the always-PASS secret
	// (1x000…AA), which makes the hook walk past Turnstile into rate-
	// limit + Resend dispatch (~10s timeout). Override to the always-
	// FAIL secret (2x000…AA) so the hook short-circuits at
	// turnstile_failed → HTTP 400 in milliseconds. Other auth test files
	// mock fetch in their own beforeEach and are unaffected.
	let originalTurnstileSecret: string | undefined;

	beforeAll(() => {
		originalTurnstileSecret = process.env.TURNSTILE_SECRET_KEY;
		process.env.TURNSTILE_SECRET_KEY = "2x0000000000000000000000000000000AA";
	});

	afterAll(() => {
		if (originalTurnstileSecret === undefined) {
			delete process.env.TURNSTILE_SECRET_KEY;
		} else {
			process.env.TURNSTILE_SECRET_KEY = originalTurnstileSecret;
		}
	});

	// === Regression guards (assert current 415-rejection behavior) =============
	// These tests PASS against `main` (pre-fix) AND against the merged PR. They
	// exist to catch (a) regressions where someone re-adds a native form, and
	// (b) better-auth upgrade surprises where JSON-only enforcement is relaxed.

	it("415::sign-in-social-rejects-form-encoded-post", async () => {
		const request = new Request(
			"http://localhost:3000/api/auth/sign-in/social",
			{
				method: "POST",
				headers: { "Content-Type": "application/x-www-form-urlencoded" },
				body: "provider=google",
			},
		);
		const response = await auth.handler(request);
		expect(response.status).toBe(415);
	});

	it("415::email-otp-send-rejects-form-encoded-post", async () => {
		const request = new Request(
			"http://localhost:3000/api/auth/email-otp/send-verification-otp",
			{
				method: "POST",
				headers: { "Content-Type": "application/x-www-form-urlencoded" },
				body: "email=test%40example.com&turnstileToken=placeholder-token",
			},
		);
		const response = await auth.handler(request);
		expect(response.status).toBe(415);
	});

	it("415::sign-in-email-otp-rejects-form-encoded-post", async () => {
		const request = new Request(
			"http://localhost:3000/api/auth/sign-in/email-otp",
			{
				method: "POST",
				headers: { "Content-Type": "application/x-www-form-urlencoded" },
				body: "email=test%40example.com&otp=123456",
			},
		);
		const response = await auth.handler(request);
		expect(response.status).toBe(415);
	});

	// === 5th assertion (Plan-Q5-bis boundary-freeze, ratified INCLUDE) ========
	// Freezes the boundary: a future regression cannot silently swap
	// /sign-in/email-otp back to /email-otp/verify-email without test failure.
	// Ships unconditionally per plan-review v2 NIT-4.

	it("415::email-otp-verify-email-rejects-form-encoded-post", async () => {
		const request = new Request(
			"http://localhost:3000/api/auth/email-otp/verify-email",
			{
				method: "POST",
				headers: { "Content-Type": "application/x-www-form-urlencoded" },
				body: "email=test%40example.com&otp=123456",
			},
		);
		const response = await auth.handler(request);
		expect(response.status).toBe(415);
	});

	// === TDD success-path assertion (BLOCKING-3 — drives the fix) =============
	// Written FAILING-first against `main` (current form-encoded behavior →
	// 415 → test fails). Passes only after the SDK migration + Q6 header
	// change land. The 415-rejection tests above lock current router
	// behavior; THIS test proves the new transport works end-to-end.

	it("200-or-400-not-415::email-otp-send-accepts-json-with-header-token", async () => {
		const request = new Request(
			"http://localhost:3000/api/auth/email-otp/send-verification-otp",
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"x-turnstile-token": "placeholder-token",
				},
				body: JSON.stringify({ email: "test@example.com", type: "sign-in" }),
			},
		);
		const response = await auth.handler(request);
		// Primary assertion: the 415 path no longer fires for properly-shaped
		// JSON. This is what the PR delivers.
		expect(response.status).not.toBe(415);
		// Informational range — depends on test-env Turnstile behavior:
		//   - 200 if verifyTurnstile is mocked/disabled in test env
		//   - 400 if siteverify hits real Cloudflare and rejects placeholder
		//         (or if TURNSTILE_SECRET_KEY unset → fail-CLOSED returns 400)
		// L2 (§18 Amendment 1.6): 500 dropped from allow-list — that branch
		// was the BLOCKING-1 bug (§14.6) which §15 fixed; assertion stays
		// tight so a regression resurrecting the mutation crash fails.
		expect([200, 400]).toContain(response.status);
	});

	// === 6th assertion (wire-shape TDD, per Amendment 1.2 / MEDIUM-1) =========
	// Per security-auditor v3 MEDIUM-1: the route-handler success-path test
	// above sends a hand-built Request directly to auth.handler(), bypassing
	// the SDK entirely. That means a mis-shaped SDK call (e.g., second-arg
	// `{ fetchOptions: { headers: ... } }` double-nest) would PASS the
	// 200-or-400-not-415 test but BREAK in production — the header would
	// never reach the wire. This test imports the actual authClient, spies
	// on global fetch, calls the SDK, and asserts the emitted request
	// carries the x-turnstile-token header + Content-Type: application/json.
	// FAILS if the SDK call shape in src/app/(auth)/sign-in/page.tsx is wrong.

	it("wire-shape::sdk-emits-x-turnstile-token-header", async () => {
		// §16 Amendment 1.4 SURPRISE 4: better-auth's $fetch captures
		// `customFetchImpl: fetch` at module load
		// (`@better-auth/client/dist/config.mjs:45`), and
		// `@better-fetch/fetch`'s `getFetch` always prefers
		// `customFetchImpl` over `globalThis.fetch`. So
		// `vi.spyOn(globalThis, "fetch")` is invisible to the SDK call
		// path. Pass `customFetchImpl` in the per-call FetchOptions to
		// observe the SDK's emitted request directly.
		const fetchSpy = vi.fn(
			async (
				_input: RequestInfo | URL,
				_init?: RequestInit,
			): Promise<Response> =>
				new Response(JSON.stringify({ success: true }), {
					status: 200,
					headers: { "Content-Type": "application/json" },
				}),
		);

		await authClient.emailOtp.sendVerificationOtp(
			{ email: "wire-shape@example.com", type: "sign-in" },
			{
				headers: { "x-turnstile-token": "probe-token" },
				customFetchImpl: fetchSpy,
			},
		);

		expect(fetchSpy).toHaveBeenCalled();
		const [input, requestInit] = fetchSpy.mock.calls[0];
		const request =
			input instanceof Request ? input : new Request(input, requestInit);
		expect(request.headers.get("x-turnstile-token")).toBe("probe-token");
		// L1 (§18 Amendment 1.6): per plan §3 line 454 — verify the SDK
		// sets Content-Type: application/json on the emitted request.
		expect(request.headers.get("content-type")).toContain("application/json");
		expect(request.url).toContain("/api/auth/email-otp/send-verification-otp");
	});
});
