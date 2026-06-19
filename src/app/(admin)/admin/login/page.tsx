import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { adminLoginAction } from "@/server/auth/admin/login";
import { adminButtonClass, adminInputClass, adminLabelClass } from "../_ui";

// F-AUTH-ADMIN login page per plan §4 + SPEC.1 §13 + SPEC.2 §8.4.
// Single password field, no Turnstile (Q1 — SPEC.1 line 609). URL not
// linked from any public surface; robots.txt Disallow + noindex below.
// UI.6 admin-fixes: legibility pass (STYLE-ONLY — the action + field unchanged).

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
		<main className="grid min-h-dvh place-items-center bg-background px-6 text-foreground">
			<div className="w-full max-w-sm rounded-lg border border-border bg-card p-6 shadow-sm">
				<h1 className="text-xl font-semibold tracking-tight">Admin sign-in</h1>
				<p className="mt-1 text-sm text-muted-foreground">
					Restricted — operator access only.
				</p>

				{error ? (
					<div
						role="status"
						className="mt-4 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
					>
						Sign-in failed: {error}
					</div>
				) : null}

				<form action={submitAdminLogin} className="mt-5 space-y-4">
					<div className="space-y-1.5">
						<label htmlFor="password" className={adminLabelClass}>
							Password
						</label>
						<input
							id="password"
							type="password"
							name="password"
							required
							autoComplete="current-password"
							className={adminInputClass}
						/>
					</div>
					<button type="submit" className={`${adminButtonClass} w-full`}>
						Sign in
					</button>
				</form>
			</div>
		</main>
	);
}
