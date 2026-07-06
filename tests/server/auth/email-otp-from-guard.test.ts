import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// AUDIT-FIX-B7b A35 (RED-first) — the send-time backstop guard on
// `sendVerificationOTP`. The audited line resolves `from` via
// `process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev"` — a SILENT sandbox
// fallback that in prod delivers only to the operator inbox, so every real
// participant OTP fails. A35 backstops the boot-time instrumentation gate: unset
// (or empty) + ZUGZWANG_ENV === "prod" → THROW before any Resend call (mirrors
// the existing RESEND_API_KEY fail-fast); staging/preview keep the sandbox
// fallback (deliberate, parked SCAFFOLD.12 §10.b); a set value is used verbatim.
//
// RED reason (ASSERTION-RED): pre-impl the function has NO env-scoped guard, so
// prod + unset RESOLVES and CALLS resend.emails.send (with the sandbox from) —
// both the `rejects(/RESEND_FROM_EMAIL/)` and the `send not called` assertions
// fail for the RIGHT reason (guard missing). staging/preview + unset and prod +
// set are GREEN control cases (green pre- and post-impl).
//
// `resend` is mocked (the Resend class → { emails: { send } }); RESEND_API_KEY is
// defaulted by tests/_setup/env.ts, left as-is. BOTH ZUGZWANG_ENV and
// RESEND_FROM_EMAIL are saved/deleted/restored per the env.ts caution (env.ts
// defaults both — `delete`, never `= undefined`).

const { mockSend } = vi.hoisted(() => ({ mockSend: vi.fn() }));
vi.mock("resend", () => ({
	Resend: class {
		emails = { send: mockSend };
	},
}));

import { sendVerificationOTP } from "@/server/auth/email-otp";

const SANDBOX_FROM = "onboarding@resend.dev";
const OTP_ARGS = {
	email: "participant@example.com",
	otp: "123456",
	type: "sign-in" as const,
};

const SAVED_ENV = process.env.ZUGZWANG_ENV;
const SAVED_FROM = process.env.RESEND_FROM_EMAIL;

function restoreVar(name: string, saved: string | undefined): void {
	if (saved === undefined) delete process.env[name];
	else process.env[name] = saved;
}

describe("AUDIT-FIX-B7b A35 — sendVerificationOTP RESEND_FROM_EMAIL guard", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockSend.mockResolvedValue({ data: { id: "stub" }, error: null });
	});
	afterEach(() => {
		restoreVar("ZUGZWANG_ENV", SAVED_ENV);
		restoreVar("RESEND_FROM_EMAIL", SAVED_FROM);
		vi.clearAllMocks();
	});

	it("email-otp-from::prod-without-from-throws-before-send", async () => {
		process.env.ZUGZWANG_ENV = "prod";
		delete process.env.RESEND_FROM_EMAIL;
		await expect(sendVerificationOTP(OTP_ARGS)).rejects.toThrow(
			/RESEND_FROM_EMAIL/,
		);
		expect(mockSend).not.toHaveBeenCalled();
	});

	it("email-otp-from::staging-without-from-uses-sandbox-sender", async () => {
		process.env.ZUGZWANG_ENV = "staging";
		delete process.env.RESEND_FROM_EMAIL;
		await expect(sendVerificationOTP(OTP_ARGS)).resolves.toBeUndefined();
		expect(mockSend).toHaveBeenCalledWith(
			expect.objectContaining({ from: SANDBOX_FROM }),
		);
	});

	it("email-otp-from::preview-without-from-uses-sandbox-sender", async () => {
		process.env.ZUGZWANG_ENV = "preview";
		delete process.env.RESEND_FROM_EMAIL;
		await expect(sendVerificationOTP(OTP_ARGS)).resolves.toBeUndefined();
		expect(mockSend).toHaveBeenCalledWith(
			expect.objectContaining({ from: SANDBOX_FROM }),
		);
	});

	it("email-otp-from::prod-with-from-uses-that-sender", async () => {
		process.env.ZUGZWANG_ENV = "prod";
		process.env.RESEND_FROM_EMAIL = "no-reply@zugzwang.world";
		await expect(sendVerificationOTP(OTP_ARGS)).resolves.toBeUndefined();
		expect(mockSend).toHaveBeenCalledWith(
			expect.objectContaining({ from: "no-reply@zugzwang.world" }),
		);
	});
});
