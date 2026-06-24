import type { Metadata } from "next";
import { redirect } from "next/navigation";

import {
	buttonClass,
	CenteredShell,
	cardClass,
	FormField,
	inputClass,
} from "@/components/internal-ui";
import { adminLoginAction } from "@/server/auth/admin/login";

// F-AUTH-ADMIN login page per plan §4 + SPEC.1 §13 + SPEC.2 §8.4.
// Single password field, no Turnstile (Q1 — SPEC.1 line 609). URL not
// linked from any public surface; robots.txt Disallow + noindex below.
// UI.6 polish: STYLE-ONLY via the shared internal-ui primitives — the action +
// field name are unchanged.

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
		<CenteredShell>
			<div className={`${cardClass} p-6`}>
				<header className="mb-5">
					<h1 className="text-xl font-semibold tracking-tight">
						Admin sign-in
					</h1>
					<p className="mt-1 text-sm text-muted-foreground">
						Restricted — operator access only.
					</p>
				</header>

				{error ? (
					<div
						role="status"
						className="mb-4 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
					>
						Sign-in failed: {error}
					</div>
				) : null}

				<form action={submitAdminLogin} className="space-y-4">
					<FormField label="Password" htmlFor="password">
						<input
							id="password"
							type="password"
							name="password"
							required
							autoComplete="current-password"
							className={inputClass}
						/>
					</FormField>
					<button type="submit" className={`${buttonClass} w-full`}>
						Sign in
					</button>
				</form>
			</div>
		</CenteredShell>
	);
}
