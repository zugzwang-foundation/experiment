"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, type ReactElement, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { authClient } from "@/lib/auth-client";
import { AuthAlert } from "../AuthAlert";

// F-AUTH-1 + F-AUTH-2 sign-in landing per plan §4 page inventory.
// Client component (per SCAFFOLD.3-FOLLOWUP-1 §2) — Better Auth's
// better-call enforces JSON-only on /sign-in/social and the email-OTP
// endpoints, so native form POSTs return 415. The SDK wraps fetch with
// the correct Content-Type and surface-specific transport (Q6: header
// `x-turnstile-token` for the Turnstile gate, not body). Visual
// treatment (typography, spacing, brand colors) deferred to DESIGN.1
// + DESIGN.7 per plan §8 out-of-scope.

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
		<Card className="my-auto w-full">
			<CardHeader className="text-center">
				{/* POLISH.7a D01 — the W2.1 `.mhead` copy (mockup `:313`). "Sign in
				    to Zugzwang" named only one of the two paths this card serves:
				    the picker is also the SIGN-UP entry, and new-vs-returning is
				    server-side and silent (`DESIGN_W2_1_CLOSE-OUT.md:55`). */}
				<CardTitle className="text-lg">Continue to Zugzwang</CardTitle>
			</CardHeader>
			<CardContent className="flex flex-col gap-4">
				{/* F-AUTH-1 — Google OAuth. */}
				<form onSubmit={handleGoogle}>
					<Button type="submit" disabled={googleLoading} className="w-full">
						{googleLoading ? "Redirecting…" : "Continue with Google"}
					</Button>
					{googleError ? (
						<AuthAlert className="mt-3">{googleError}</AuthAlert>
					) : null}
				</form>

				{/* "or"-divider (W2.1 .ordiv) — the word flanked by two hairline
				    rules; the rules are the branded Separator (bg-border ≡ the
				    --hairline neutral, WI-1: never the mockup's raw var(--n2)). */}
				<div className="flex items-center gap-3">
					<Separator className="flex-1" />
					<span className="text-xs font-medium tracking-wider text-n5">or</span>
					<Separator className="flex-1" />
				</div>

				{/* F-AUTH-2 — Email + OTP. Hidden `turnstileToken` input retained
				    per Plan-Q7 sub-verdict (anchor for future Cloudflare Turnstile
				    widget mount once DESIGN.* lands). The onSubmit handler reads
				    it from form data and passes the value as the
				    `x-turnstile-token` HEADER on the SDK call. */}
				<form onSubmit={handleEmailOtp} className="flex flex-col gap-3">
					{/* POLISH.7a D03 — the W2.1 `.emailrow`: the field and its submit
					    share ONE row (mockup `:318-322`, CSS `:154`
					    `display:flex;gap:9px`), not the stacked full-width pair this
					    shipped as. The 9px is a hardcoded LAYOUT value, which
					    POLISH-SURFACE-TEMPLATE §6 puts in the fair-game half — it is not
					    a colour and F2/H13 do not reach it. The field takes the slack
					    (`.email{flex:1 1 auto;min-width:0}`) and the submit stays
					    intrinsic (`.econt{flex:0 0 auto}`). */}
					<div className="flex gap-[9px]">
						<Input
							type="email"
							name="email"
							required
							placeholder="Email address"
							aria-label="Email address"
							className="min-w-0 flex-1"
						/>
						<Button type="submit" disabled={emailLoading} className="shrink-0">
							{emailLoading ? "Sending…" : "Send code"}
						</Button>
					</div>
					{/* TODO(DESIGN.*): Cloudflare Turnstile widget client-side. */}
					{/* ⚠ SEAM CONTRACT (UI-A7 §3.1): this hidden anchor MUST SURVIVE —
					    `handleEmailOtp` reads `formData.get("turnstileToken")`. It sits
					    beside the row rather than in it because a hidden input is not a
					    flex child worth laying out; it is still inside the same <form>,
					    which is what `new FormData(event.currentTarget)` reads. */}
					<input
						type="hidden"
						name="turnstileToken"
						value="placeholder-token"
					/>
					{emailError ? <AuthAlert>{emailError}</AuthAlert> : null}
				</form>
			</CardContent>
		</Card>
	);
}
