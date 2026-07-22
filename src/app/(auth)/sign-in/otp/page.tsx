"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, type ReactElement, Suspense, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";

// F-AUTH-2 OTP code entry per plan §4 page inventory.
// Client component (per SCAFFOLD.3-FOLLOWUP-1 §2 + Plan-Q5 +
// Plan-Q5-bis). Endpoint corrected from
// `/api/auth/email-otp/verify-email` (email-verification side-effect)
// to `/api/auth/sign-in/email-otp` (session-issuing) per SPEC.1 §13
// F-AUTH-2 contract. DESIGN.* owns the visual treatment.
//
// §18 Amendment 1.6 structural split: OtpForm holds `useSearchParams`
// + form state + submit handler; OtpPage (default export) is just a
// Suspense wrap. Next.js 16 production-build requirement —
// `useSearchParams()` inside a client component MUST be inside a
// Suspense boundary or `next build` fails with `Missing Suspense
// boundary with useSearchParams`. `tsc --noEmit` and `vitest` do not
// catch the build-time failure, so the Suspense boundary lives in
// source as documentation of the constraint.

function OtpForm(): ReactElement {
	const router = useRouter();
	const searchParams = useSearchParams();
	const initialEmail = searchParams?.get("email") ?? "";

	const [email, setEmail] = useState(initialEmail);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [resendLoading, setResendLoading] = useState(false);
	const [resent, setResent] = useState(false);

	async function handleSubmit(
		event: FormEvent<HTMLFormElement>,
	): Promise<void> {
		event.preventDefault();
		setError(null);
		setResent(false);
		setLoading(true);
		const formData = new FormData(event.currentTarget);
		const otp = String(formData.get("otp") ?? "");
		try {
			// Plan-Q5-bis: SDK call hits /api/auth/sign-in/email-otp (the
			// session-issuing endpoint), NOT /api/auth/email-otp/verify-email
			// (the email-verification side-effect endpoint).
			const { error: sdkError } = await authClient.signIn.emailOtp({
				email,
				otp,
			});

			// ONBOARDING_REQUIRED detection per §17 Amendment 1.5 + §18
			// Amendment 1.6 path discriminator: catch-all wrapper at
			// /api/auth/[...all]/route.ts returns 403 JSON with
			// `error.message === "ONBOARDING_REQUIRED"` on the SDK path
			// (POSTs to /api/auth/sign-in/email-otp). The `onboarding_ref`
			// cookie is stored by the browser from the 403's Set-Cookie;
			// /onboarding reads it server-side. The OAuth callback path
			// still returns 302 + Set-Cookie (browser-navigation contract
			// preserved per §18 Resolution 1).
			if (sdkError?.message === "ONBOARDING_REQUIRED") {
				router.push("/onboarding");
				return;
			}
			if (sdkError) {
				setError(sdkError.message ?? "otp_invalid");
				return;
			}
			router.push("/");
		} catch (err) {
			setError(err instanceof Error ? err.message : "otp_invalid");
		} finally {
			setLoading(false);
		}
	}

	// AUTH-OTP-DELIVERY fix (b): resend recourse for the optimistic-navigation
	// gap — Better Auth returns 200 even when delivery fails (ADR-0033), so a
	// stranded user needs a way to retry / go back. Replicates the sign-in page's
	// send call verbatim, incl. the placeholder Turnstile token (real widget:
	// AUTH-TURNSTILE-WIRE). Any returned {error} (rate_limited, turnstile_*) reuses
	// the shared error surface below — no new error branch; humanized copy deferred
	// to AUTH-ERROR-COPY.
	async function handleResend(): Promise<void> {
		setError(null);
		setResent(false);
		setResendLoading(true);
		try {
			const { error: sendError } =
				await authClient.emailOtp.sendVerificationOtp(
					{ email, type: "sign-in" },
					{ headers: { "x-turnstile-token": "placeholder-token" } },
				);
			if (sendError) {
				setError(sendError.message ?? "resend_failed");
				return;
			}
			setResent(true);
		} catch (err) {
			setError(err instanceof Error ? err.message : "resend_failed");
		} finally {
			setResendLoading(false);
		}
	}

	return (
		<Card className="my-auto w-full">
			<CardHeader className="text-center">
				<CardTitle className="text-lg">Enter your verification code</CardTitle>
				<CardDescription>Check your email for a 6-digit code.</CardDescription>
			</CardHeader>
			<CardContent>
				<form onSubmit={handleSubmit} className="flex flex-col gap-3">
					<Input
						type="email"
						name="email"
						value={email}
						onChange={(e) => setEmail(e.target.value)}
						required
						aria-label="Email address"
						placeholder="Email address"
					/>
					<Input
						type="text"
						name="otp"
						inputMode="numeric"
						pattern="[0-9]{6}"
						maxLength={6}
						required
						aria-label="6-digit code"
						className="text-center text-lg tracking-[0.5em]"
					/>
					<Button type="submit" disabled={loading} className="w-full">
						{loading ? "Verifying…" : "Verify"}
					</Button>
					{/* W2.11 invalid-OTP / error treatment (§5): the existing `error`
					    message flows through unchanged into a role="alert" callout. */}
					{error ? (
						<p
							role="alert"
							className="rounded-(--r) bg-n1 px-3 py-2 text-sm text-ink [border:var(--hairline)]"
						>
							{error}
						</p>
					) : null}
				</form>
				{/* AUTH-OTP-DELIVERY fix (b): resend + back recourse. The resend
				    reuses the shared `error` alert above; success shows a role="status"
				    note (never a second alert). */}
				<div className="mt-4 flex flex-col items-center gap-1">
					<Button
						type="button"
						variant="ghost"
						size="sm"
						onClick={handleResend}
						disabled={resendLoading}
					>
						{resendLoading ? "Resending…" : "Resend code"}
					</Button>
					{resent ? (
						<p role="status" className="text-xs text-n5">
							Code re-sent.
						</p>
					) : null}
					<Link
						href="/sign-in"
						className="text-xs text-n5 underline-offset-4 hover:text-ink hover:underline"
					>
						Back to sign in
					</Link>
				</div>
			</CardContent>
			<CardFooter className="justify-center">
				{/* Phishing-safety note (W2.1 .otp-safety, design-source copy). The
				    "Secured by Cloudflare Turnstile" line is deliberately omitted —
				    Turnstile is not wired yet (plan §8; anchor only). */}
				<p className="text-center text-xs text-n5">
					Zugzwang will never ask you for this code. If someone does, it's a
					scam — don't share it.
				</p>
			</CardFooter>
		</Card>
	);
}

export default function OtpPage(): ReactElement {
	return (
		<Suspense fallback={null}>
			<OtpForm />
		</Suspense>
	);
}
