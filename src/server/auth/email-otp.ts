import * as Sentry from "@sentry/nextjs";
import { Resend } from "resend";
import { isSandboxFrom } from "@/server/auth/resend-from";

// Resend `sendVerificationOTP` callback body for the Better Auth email-OTP
// plugin per SCAFFOLD.3 plan §3 + SPEC.2 §8.2. Sandbox-mode caveat per
// SCAFFOLD.14 close-out: `onboarding@resend.dev` only delivers to
// `zugzwangworld@proton.me` until Resend domain verification ships
// (tracked in docs/parked.md under the Resend `RESEND_FROM_EMAIL` flip
// follow-up). AUDIT-FIX-B7b A35 + AUTH-OTP-DELIVERY (ADR-0033): in prod AND
// staging (OQ-1 S2) an unset OR sandbox (`resend.dev`) RESEND_FROM_EMAIL throws
// at send time (mirroring the RESEND_API_KEY fail-fast below) as the backstop to
// the boot-time gate in instrumentation.ts; only `preview` (local dev + CI)
// keeps the sandbox fallback.

export type SendVerificationOTPArgs = {
	email: string;
	otp: string;
	type: "sign-in" | "email-verification" | "forget-password" | "change-email";
};

export async function sendVerificationOTP(
	args: SendVerificationOTPArgs,
): Promise<void> {
	const apiKey = process.env.RESEND_API_KEY;
	if (!apiKey) {
		throw new Error("RESEND_API_KEY not set; cannot send verification OTP");
	}
	// A35 + AUTH-OTP-DELIVERY (ADR-0033) send-time backstop to the boot gate in
	// instrumentation.ts (LD-10). In a delivery-expecting env (prod OR staging,
	// OQ-1 S2) an unset OR Resend-sandbox (`resend.dev`) from-address → throw
	// rather than silently deliver only to the operator inbox. `preview` (local
	// dev + CI) stays exempt — the sandbox fallback below is theirs.
	const fromEnv = process.env.RESEND_FROM_EMAIL;
	const env = process.env.ZUGZWANG_ENV;
	if (
		(env === "prod" || env === "staging") &&
		(!fromEnv || isSandboxFrom(fromEnv))
	) {
		throw new Error(
			`RESEND_FROM_EMAIL must be a real verified sender in ${env}; refusing an unset or Resend-sandbox (resend.dev) sender — cannot send verification OTP`,
		);
	}
	const resend = new Resend(apiKey);
	const from = fromEnv || "onboarding@resend.dev";

	// AUTH-OTP-DELIVERY OQ-2: Better Auth 1.6.11 swallows a sender throw inside
	// runInBackgroundOrAwait and returns HTTP 200 regardless (ADR-0033), so a
	// delivery failure is otherwise invisible to operators. Capture both the
	// network-throw and the Resend API-error paths to Sentry, then propagate the
	// throw — the send contract (and the client-visible 200) are unchanged.
	const result = await resend.emails
		.send({
			from,
			to: args.email,
			subject: `Zugzwang verification code: ${args.otp}`,
			text: `Your Zugzwang verification code is: ${args.otp}\n\nThis code expires in 5 minutes.\n\nIf you didn't request this, you can ignore this email.`,
		})
		.catch((err: unknown) => {
			Sentry.captureException(err);
			throw err;
		});

	if (result.error) {
		Sentry.captureException(result.error);
		throw new Error(`Resend send failed: ${result.error.message}`);
	}
}
