import { describe, expect, it, vi } from "vitest";

// §18 Amendment 1.6 Resolution 3 — contract probe for the catch-all
// wrapper's ONBOARDING_REQUIRED branch. Pre-Amendment 1.6, the wrapper
// returned 403 JSON universally per §17 — but the OAuth callback path
// at `/api/auth/callback/<provider>` is a BROWSER-NAVIGATION consumer
// (Google redirects the user-agent post-consent), not an SDK consumer.
// A 403 JSON response strands users on a JSON-displaying page AND
// leaks the HMAC onboardingRef token in the visible body. Amendment
// 1.6 introduces a path discriminator: SDK paths return 403 JSON;
// OAuth callback paths return 302 + Set-Cookie with null body (token
// rides ONLY in the HttpOnly cookie).
//
// Mocking: vi.mock hoists before module imports so the wrapper at
// `src/app/api/auth/[...all]/route.ts` sees the synthetic
// auth.handler that returns the upstream 403 + APIError body shape
// our wrapper expects to intercept.

vi.mock("@/server/auth", () => ({
	auth: {
		handler: vi.fn(
			async (): Promise<Response> =>
				new Response(
					JSON.stringify({
						message: "ONBOARDING_REQUIRED",
						onboardingRef: "synthetic-onboarding-ref-token-base64url",
					}),
					{
						status: 403,
						headers: { "content-type": "application/json" },
					},
				),
		),
	},
}));

import { GET, POST } from "@/app/api/auth/[...all]/route";

describe("Catch-all wrapper ONBOARDING_REQUIRED branch (§18 path discriminator)", () => {
	// TDD-driver for §18: RED against `main` (pre-§18 returned 302
	// universally, so status would be 302 not 403).
	it("403-json-on-sdk-path::email-otp-verify-onboarding-required", async () => {
		const request = new Request(
			"http://localhost:3000/api/auth/sign-in/email-otp",
			{
				method: "POST",
				body: JSON.stringify({ email: "new@example.com", otp: "123456" }),
				headers: { "Content-Type": "application/json" },
			},
		);
		const response = await POST(request);
		expect(response.status).toBe(403);
		expect(response.headers.get("content-type")).toContain("application/json");
		expect(response.headers.get("set-cookie")).toContain("onboarding_ref=");
		const body = (await response.json()) as {
			message: string;
			onboardingRef: string;
		};
		expect(body.message).toBe("ONBOARDING_REQUIRED");
		expect(body.onboardingRef).toEqual(expect.any(String));
	});

	// Regression guard: PASSES against both `main` and post-§18 (both
	// produce 302 for the OAuth callback path). Locks the contract so a
	// future change cannot accidentally flip the callback path to 403.
	it("302-redirect-on-oauth-callback-path::google-callback-onboarding-required", async () => {
		const request = new Request(
			"http://localhost:3000/api/auth/callback/google?code=fake",
			{ method: "GET" },
		);
		const response = await GET(request);
		expect(response.status).toBe(302);
		expect(response.headers.get("location")).toBe("/onboarding");
		expect(response.headers.get("set-cookie")).toContain("onboarding_ref=");
		expect(await response.text()).toBe("");
	});

	// Privilege-escalation regression guard per §18 CRITICAL finding:
	// the 302 branch MUST have a null body so the HMAC onboardingRef
	// token is never visible. If a future change accidentally puts the
	// token in the body (e.g., a developer adds it for debugging), this
	// guard fires.
	it("no-cookie-token-in-302-response-body", async () => {
		const request = new Request(
			"http://localhost:3000/api/auth/callback/google?code=fake",
			{ method: "GET" },
		);
		const response = await GET(request);
		const bodyText = await response.text();
		expect(bodyText).not.toContain("onboarding_ref=");
		// Any base64url-shaped token ≥20 chars would trip this — the
		// synthetic token in the mock is 40 chars, so a body leak would
		// match. Empty body short-circuits to PASS.
		expect(bodyText).not.toMatch(/[A-Za-z0-9_-]{20,}/);
	});
});
