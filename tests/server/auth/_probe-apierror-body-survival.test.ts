import { describe, expect, it } from "vitest";

// Empirical probe per kickoff Item #4: when a Better Auth hook throws an
// APIError with a custom body field (e.g., `onboardingRef`), does the field
// survive Better Auth's HTTP response serialization?
//
// Source-level evidence in
// node_modules/.pnpm/better-call@1.3.5/.../to-response.mjs:117-121:
//
//   if (isAPIError(data)) return toResponse(data.body, {
//     status: init?.status ?? data.statusCode,
//     statusText: data.status.toString(),
//     headers: init?.headers || data.headers
//   });
//
// → recursive call with `data.body` (whole object) → hits
//   `isJSONSerializable` → `safeStringify(data)` → full JSON of the body.
//
// This test confirms the source reading empirically. It also serves as a
// REGRESSION GUARD: if a future Better Auth upgrade changes APIError
// serialization to strip non-`message` fields, this test fails and
// surfaces the change — at which point session-gate's `onboardingRef`
// attachment becomes unsound and the AsyncLocalStorage fallback (kickoff
// Item #4 option 1) becomes necessary.

import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import { APIError, createAuthMiddleware } from "better-auth/api";

describe("Better Auth APIError body serialization probe", () => {
	it("apierror-body-probe::custom-body-fields-survive-http-response", async () => {
		// Minimal Better Auth instance with a top-level hooks.before that
		// always throws an APIError with an extra `onboardingRef` field.
		const probe = betterAuth({
			database: memoryAdapter({}),
			secret: "probe-secret-for-apierror-body-survival-test-not-for-prod-use",
			baseURL: "http://localhost:3000",
			hooks: {
				before: createAuthMiddleware(async () => {
					throw new APIError("FORBIDDEN", {
						message: "PROBE_ONBOARDING_REQUIRED",
						onboardingRef: "PROBE_REF_TOKEN_BASE64URL_VALUE",
					});
				}),
			},
		});

		// Any auth endpoint works — top-level hooks.before fires before every
		// endpoint. /get-session is always present and accepts GET without
		// extra setup.
		const request = new Request("http://localhost:3000/api/auth/get-session", {
			method: "GET",
		});

		const response = await probe.handler(request);
		const bodyText = await response.text();
		const bodyJson = JSON.parse(bodyText) as Record<string, unknown>;

		// Diagnostic log so the actual response shape is visible in the test
		// run (CI + local). The assertions below are the regression guard.
		console.log(
			"[apierror-body-probe] status=%d headers.content-type=%s",
			response.status,
			response.headers.get("content-type"),
		);
		console.log("[apierror-body-probe] body=%s", bodyText);

		// HTTP 403 (FORBIDDEN → 403 per better-call's statusCodes map).
		expect(response.status).toBe(403);

		// Both fields present in the JSON body — the contract that
		// session-gate.ts depends on for passing the onboarding ref through
		// to the catch-all route at src/app/api/auth/[...all]/route.ts.
		expect(bodyJson.message).toBe("PROBE_ONBOARDING_REQUIRED");
		expect(bodyJson.onboardingRef).toBe("PROBE_REF_TOKEN_BASE64URL_VALUE");
	});
});
