"use client";

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

	async function handleSubmit(
		event: FormEvent<HTMLFormElement>,
	): Promise<void> {
		event.preventDefault();
		setError(null);
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
