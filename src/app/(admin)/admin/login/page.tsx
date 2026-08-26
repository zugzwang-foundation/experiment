import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { adminLoginAction } from "@/server/auth/admin/login";

// F-AUTH-ADMIN login page per plan §4 + SPEC.1 §13 + SPEC.2 §8.4.
// Single password field, no Turnstile (Q1 — SPEC.1 line 609). URL not
// linked from any public surface; robots.txt Disallow + noindex below.
//
// S-4 Phase B — `instant = false` (below): this page never carried a
// `dynamic` export (Phase A's T7 grep-based inventory couldn't see it — it
// was dynamic only implicitly, via the unwrapped `searchParams` read below,
// same shape as `/u/[pseudonym]` and `/bookmarks`). Under `cacheComponents`
// that unwrapped read errors the prerender build. Deferred, not restructured
// — admin is outside S-4's scope (CLAUDE.md §1).
export const instant = false;

export const metadata: Metadata = {
	robots: {
		index: false,
		follow: false,
	},
};

// R-15.6 (ENGINE.15 S4): surface the failure code instead of discarding it. On
// success `adminLoginAction` redirects to /admin (throws NEXT_REDIRECT), so
// reaching the redirect below means a failure envelope — render its code on the
// login page via the ?error param (the D-15.e redirect-param pattern). The
// `submitAdminLogin` export build-survival is the separate S6 gate (R-15-2).
export async function submitAdminLogin(formData: FormData): Promise<void> {
	"use server";
	const result = await adminLoginAction(formData);
	redirect(`/admin/login?error=${result.code}`);
}

export default async function AdminLoginPage(props: {
	searchParams: Promise<{ error?: string }>;
}): Promise<React.ReactElement> {
	const { error } = await props.searchParams;
	return (
		<main>
			<h1>Admin sign-in</h1>
			{error ? <p>Error: {error}</p> : null}
			<form action={submitAdminLogin}>
				<label>
					Password:
					<input
						type="password"
						name="password"
						required
						autoComplete="current-password"
					/>
				</label>
				<button type="submit">Sign in</button>
			</form>
		</main>
	);
}
