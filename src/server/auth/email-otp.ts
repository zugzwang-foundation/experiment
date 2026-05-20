import { Resend } from "resend";

// Resend `sendVerificationOTP` callback body for the Better Auth email-OTP
// plugin per SCAFFOLD.3 plan §3 + SPEC.2 §8.2. Sandbox-mode caveat per
// SCAFFOLD.14 close-out: `onboarding@resend.dev` only delivers to
// `zugzwangworld@proton.me` until Resend domain verification ships
// (tracked in docs/parked.md under the Resend `RESEND_FROM_EMAIL` flip
// follow-up).

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
	const resend = new Resend(apiKey);
	const from = process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev";

	const result = await resend.emails.send({
		from,
		to: args.email,
		subject: `Zugzwang verification code: ${args.otp}`,
		text: `Your Zugzwang verification code is: ${args.otp}\n\nThis code expires in 5 minutes.\n\nIf you didn't request this, you can ignore this email.`,
	});

	if (result.error) {
		throw new Error(`Resend send failed: ${result.error.message}`);
	}
}
