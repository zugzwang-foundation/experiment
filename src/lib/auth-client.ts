import { emailOTPClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
	// In browser, derive baseURL from current origin (matches the catch-all
	// mount at /api/auth/[...all]). In Node test env, fall back to the same
	// origin shimmed by tests/_setup/env.ts so better-fetch can construct
	// absolute URLs synchronously. Per §15 Amendment 1.3 SURPRISE 2.
	baseURL:
		typeof window !== "undefined"
			? window.location.origin
			: "http://localhost:3000",
	plugins: [emailOTPClient()],
});
