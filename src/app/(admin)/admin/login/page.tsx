import { LockKeyhole } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { adminLoginAction } from "@/server/auth/admin/login";

// F-AUTH-ADMIN login page per plan §4 + SPEC.1 §13 + SPEC.2 §8.4.
// Single password field, no Turnstile (Q1 — SPEC.1 line 609). URL not
// linked from any public surface; robots.txt Disallow + noindex below.
//
// ADMIN-UI — presentation only. `submitAdminLogin`, its redirect, the single
// `password` field and the `?error=` read are unchanged; the two codes the
// action returns are mapped to operator copy, and any other value still shows
// itself rather than vanishing.
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

const ERROR_COPY: Record<string, string> = {
	admin_login_invalid: "That password is not correct.",
	admin_login_serialization_conflict:
		"Sign-in is briefly unavailable — please try again.",
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
		<main className="flex min-h-dvh items-center justify-center bg-ground px-6 py-12 text-ink">
			<div className="w-full max-w-sm rounded-(--r) border border-n2 bg-n0 p-6 shadow-(--elev-2)">
				<div className="mb-5 flex items-center gap-2.5">
					<span className="flex size-9 items-center justify-center rounded-(--r) border border-n2 bg-n1">
						<LockKeyhole aria-hidden className="size-4 text-n6" />
					</span>
					<div>
						<p className="font-medium text-n5 text-xs uppercase tracking-wider">
							Zugzwang · Admin Control Centre
						</p>
						<h1 className="font-semibold text-ink text-xl tracking-tight">
							Admin sign-in
						</h1>
					</div>
				</div>
				{error ? (
					<div
						role="alert"
						className="mb-4 rounded-(--r) border border-n5 bg-n1 px-3 py-2 text-ink text-sm"
					>
						{ERROR_COPY[error] ?? "Sign-in failed."}
						{ERROR_COPY[error] ? null : (
							<span className="mt-0.5 block font-mono text-n4 text-xs">
								code: {error}
							</span>
						)}
					</div>
				) : null}
				<form action={submitAdminLogin} className="flex flex-col gap-4">
					<label
						htmlFor="admin-password"
						className="flex flex-col gap-1.5 text-sm"
					>
						<span className="font-medium text-ink">Password</span>
						<Input
							id="admin-password"
							type="password"
							name="password"
							required
							autoComplete="current-password"
							className="h-9"
						/>
					</label>
					<Button type="submit" size="lg" className="w-full">
						Sign in
					</Button>
				</form>
			</div>
		</main>
	);
}
