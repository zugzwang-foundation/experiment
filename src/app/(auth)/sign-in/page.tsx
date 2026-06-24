"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, type ReactElement, useState } from "react";
import {
	buttonClass,
	buttonSecondaryClass,
	CenteredShell,
	cardClass,
	FormField,
	inputClass,
} from "@/components/internal-ui";
import { authClient } from "@/lib/auth-client";

// F-AUTH-1 + F-AUTH-2 sign-in landing per plan §4 page inventory.
// Client component (per SCAFFOLD.3-FOLLOWUP-1 §2) — Better Auth's
// better-call enforces JSON-only on /sign-in/social and the email-OTP
// endpoints, so native form POSTs return 415. The SDK wraps fetch with
// the correct Content-Type and surface-specific transport (Q6: header
// `x-turnstile-token` for the Turnstile gate, not body).
//
// UI.6 polish: STYLE-ONLY internal-tooling treatment via the shared
// `@/components/internal-ui` primitives (stable shadcn semantic tokens; no
// placeholder brand tokens). Handlers, state, form field names, and the hidden
// turnstile-token anchor are unchanged. Final brand visuals: DESIGN.7.

export default function SignInPage(): ReactElement {
	const router = useRouter();
	const [emailLoading, setEmailLoading] = useState(false);
	const [emailError, setEmailError] = useState<string | null>(null);
	const [googleLoading, setGoogleLoading] = useState(false);
	const [googleError, setGoogleError] = useState<string | null>(null);

	async function handleGoogle(
		event: FormEvent<HTMLFormElement>,
	): Promise<void> {
		event.preventDefault();
		setGoogleError(null);
		setGoogleLoading(true);
		try {
			// Per §5 exit criterion #2 (LOW-2 correction): the route returns
			// HTTP 200 JSON `{url, redirect: true}`; the SDK's redirectPlugin
			// then assigns window.location.href to data.url, navigating the
			// browser to Google's consent screen.
			await authClient.signIn.social({
				provider: "google",
				callbackURL: "/",
			});
		} catch (err) {
			setGoogleError(err instanceof Error ? err.message : "sign_in_failed");
		} finally {
			setGoogleLoading(false);
		}
	}

	async function handleEmailOtp(
		event: FormEvent<HTMLFormElement>,
	): Promise<void> {
		event.preventDefault();
		setEmailError(null);
		setEmailLoading(true);
		const formData = new FormData(event.currentTarget);
		const email = String(formData.get("email") ?? "");
		const turnstileToken = String(formData.get("turnstileToken") ?? "");
		try {
			// Plan-Q6 + §15 MEDIUM-1: Form A SDK call shape — second
			// positional arg is `FetchOptions` directly (NOT wrapped in
			// `{ fetchOptions: ... }`). The header lands on the wire as
			// `x-turnstile-token`; the hand-rolled hook reads it from
			// `ctx.request.headers` per src/server/auth/index.ts.
			const { error } = await authClient.emailOtp.sendVerificationOtp(
				{ email, type: "sign-in" },
				{ headers: { "x-turnstile-token": turnstileToken } },
			);
			if (error) {
				setEmailError(error.message ?? "send_failed");
				return;
			}
			router.push(`/sign-in/otp?email=${encodeURIComponent(email)}`);
		} catch (err) {
			setEmailError(err instanceof Error ? err.message : "send_failed");
		} finally {
			setEmailLoading(false);
		}
	}

	return (
		<CenteredShell>
			<div className={`${cardClass} p-6`}>
				<header className="mb-5">
					<h1 className="text-xl font-semibold tracking-tight">
						Sign in to Zugzwang
					</h1>
					<p className="mt-1 text-sm text-muted-foreground">
						Continue with Google, or get a one-time code by email.
					</p>
				</header>

				{/* F-AUTH-1 — Google OAuth. */}
				<form onSubmit={handleGoogle}>
					<button
						type="submit"
						disabled={googleLoading}
						className={`${buttonSecondaryClass} w-full`}
					>
						{googleLoading ? "Redirecting…" : "Continue with Google"}
					</button>
					{googleError ? (
						<p className="mt-2 text-sm text-destructive">{googleError}</p>
					) : null}
				</form>

				<div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
					<span className="h-px flex-1 bg-border" />
					or
					<span className="h-px flex-1 bg-border" />
				</div>

				{/* F-AUTH-2 — Email + OTP. Hidden `turnstileToken` input retained
				    per Plan-Q7 sub-verdict (anchor for the future Cloudflare
				    Turnstile widget once DESIGN.* lands). The onSubmit handler
				    reads it from form data and passes the value as the
				    `x-turnstile-token` HEADER on the SDK call. */}
				<form onSubmit={handleEmailOtp} className="space-y-4">
					<FormField
						label="Email"
						htmlFor="email"
						helper="We'll email you a one-time code to finish signing in."
					>
						<input
							id="email"
							type="email"
							name="email"
							required
							placeholder="you@example.com"
							className={inputClass}
						/>
					</FormField>
					{/* TODO(DESIGN.*): Cloudflare Turnstile widget client-side. */}
					<input
						type="hidden"
						name="turnstileToken"
						value="placeholder-token"
					/>
					<button
						type="submit"
						disabled={emailLoading}
						className={`${buttonClass} w-full`}
					>
						{emailLoading ? "Sending…" : "Send code"}
					</button>
					{emailError ? (
						<p className="text-sm text-destructive">{emailError}</p>
					) : null}
				</form>
			</div>
		</CenteredShell>
	);
}
