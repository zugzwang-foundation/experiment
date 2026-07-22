import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// AUTH-OTP-DELIVERY fix (a) — the send-time backstop guard on
// `sendVerificationOTP` (email-otp.ts), EXTENDED from the AUDIT-FIX-B7b A35
// prod+unset gate to the ratified S2 rule (§0·R OQ-1 = S2): reject
// `unset(from) || isSandbox(from)` when ZUGZWANG_ENV ∈ {prod, staging}.
// `preview` stays EXEMPT (local dev + CI ride preview → the sandbox
// `onboarding@resend.dev` fallback stays usable there). The sandbox sender
// delivers only to the operator inbox, so in prod/staging it silently breaks
// every real participant OTP — the guard throws before any Resend call
// (mirroring the RESEND_API_KEY fail-fast); it is the send backstop to the
// boot-time instrumentation.ts gate (LD-10 two-lines-of-defense).
//
// RED reasons:
//   ASSERTION-RED (guard extension missing pre-impl):
//     · prod + SANDBOX (bare + angle) → today `from` is truthy so NO throw and
//       resend.emails.send IS called → both `rejects(/RESEND_FROM_EMAIL/)` and
//       `send not called` fail for the RIGHT reason (sandbox not yet checked).
//     · staging + UNSET → today env !== "prod" so NO throw → resolves + send
//       called → the flipped `staging-without-from-throws` fails (staging not
//       yet in scope).
//     · staging + SANDBOX → same (staging not in scope + sandbox not checked).
//   GREEN control cases (green pre- AND post-impl):
//     · prod + unset (existing) throws; preview + unset falls back to sandbox;
//       prod + REAL (bare + angle) sends with that `from` — the angle-form real
//       address is the guard-misfire canary (must NOT be read as sandbox).
//
// `resend` is mocked (the Resend class → { emails: { send } }); RESEND_API_KEY
// is defaulted by tests/_setup/env.ts. BOTH ZUGZWANG_ENV and RESEND_FROM_EMAIL
// are saved/deleted/restored per the env.ts caution (env.ts defaults both —
// use `delete`, never `= undefined`).

const { mockSend, mockCapture } = vi.hoisted(() => ({
	mockSend: vi.fn(),
	mockCapture: vi.fn(),
}));
vi.mock("resend", () => ({
	Resend: class {
		emails = { send: mockSend };
	},
}));
// OQ-2 observability: once the sender wires it, email-otp.ts will
// `import * as Sentry from "@sentry/nextjs"` and captureException on a failed
// send. Stub it file-wide so the (soon-to-exist) transitive import resolves and
// the capture calls are observable. The mock is inert until the impl adds the
// import. mockCapture is reset by the vi.clearAllMocks() in before/afterEach.
vi.mock("@sentry/nextjs", () => ({ captureException: mockCapture }));

import { sendVerificationOTP } from "@/server/auth/email-otp";

const SANDBOX_FROM = "onboarding@resend.dev";
const SANDBOX_ANGLE_FROM = "Zugzwang <onboarding@resend.dev>";
const REAL_FROM = "no-reply@mail.zugzwangworld.com";
const REAL_ANGLE_FROM = "Zugzwang <no-reply@mail.zugzwangworld.com>";
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

describe("AUTH-OTP-DELIVERY fix (a) — sendVerificationOTP sandbox-rejection guard (S2)", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockSend.mockResolvedValue({ data: { id: "stub" }, error: null });
	});
	afterEach(() => {
		restoreVar("ZUGZWANG_ENV", SAVED_ENV);
		restoreVar("RESEND_FROM_EMAIL", SAVED_FROM);
		vi.clearAllMocks();
	});

	// ── GREEN control: prod + unset still throws (existing A35 case) ──
	it("email-otp-from::prod-without-from-throws-before-send", async () => {
		process.env.ZUGZWANG_ENV = "prod";
		delete process.env.RESEND_FROM_EMAIL;
		await expect(sendVerificationOTP(OTP_ARGS)).rejects.toThrow(
			/RESEND_FROM_EMAIL/,
		);
		expect(mockSend).not.toHaveBeenCalled();
	});

	// ── RED: prod + SANDBOX from (bare) → throw, no send ──
	it("email-otp-from::prod-with-sandbox-from-throws", async () => {
		process.env.ZUGZWANG_ENV = "prod";
		process.env.RESEND_FROM_EMAIL = SANDBOX_FROM;
		await expect(sendVerificationOTP(OTP_ARGS)).rejects.toThrow(
			/RESEND_FROM_EMAIL/,
		);
		expect(mockSend).not.toHaveBeenCalled();
	});

	// ── RED: prod + SANDBOX from ("Name <addr>" form) → throw, no send ──
	it("email-otp-from::prod-with-sandbox-angle-from-throws", async () => {
		process.env.ZUGZWANG_ENV = "prod";
		process.env.RESEND_FROM_EMAIL = SANDBOX_ANGLE_FROM;
		await expect(sendVerificationOTP(OTP_ARGS)).rejects.toThrow(
			/RESEND_FROM_EMAIL/,
		);
		expect(mockSend).not.toHaveBeenCalled();
	});

	// ── GREEN control: prod + REAL from (bare) sends with that from ──
	it("email-otp-from::prod-with-real-from-sends", async () => {
		process.env.ZUGZWANG_ENV = "prod";
		process.env.RESEND_FROM_EMAIL = REAL_FROM;
		await expect(sendVerificationOTP(OTP_ARGS)).resolves.toBeUndefined();
		expect(mockSend).toHaveBeenCalledWith(
			expect.objectContaining({ from: REAL_FROM }),
		);
	});

	// ── GREEN control (angle-misfire canary): prod + REAL from (angle) sends ──
	it("email-otp-from::prod-with-real-angle-from-sends", async () => {
		process.env.ZUGZWANG_ENV = "prod";
		process.env.RESEND_FROM_EMAIL = REAL_ANGLE_FROM;
		await expect(sendVerificationOTP(OTP_ARGS)).resolves.toBeUndefined();
		expect(mockSend).toHaveBeenCalledWith(
			expect.objectContaining({ from: REAL_ANGLE_FROM }),
		);
	});

	// ── RED (FLIPPED — was staging-without-from-uses-sandbox-sender): under S2,
	//    staging is IN scope, so an unset sender now throws ──
	it("email-otp-from::staging-without-from-throws", async () => {
		process.env.ZUGZWANG_ENV = "staging";
		delete process.env.RESEND_FROM_EMAIL;
		await expect(sendVerificationOTP(OTP_ARGS)).rejects.toThrow(
			/RESEND_FROM_EMAIL/,
		);
		expect(mockSend).not.toHaveBeenCalled();
	});

	// ── RED: staging + SANDBOX from → throw, no send ──
	it("email-otp-from::staging-with-sandbox-from-throws", async () => {
		process.env.ZUGZWANG_ENV = "staging";
		process.env.RESEND_FROM_EMAIL = SANDBOX_FROM;
		await expect(sendVerificationOTP(OTP_ARGS)).rejects.toThrow(
			/RESEND_FROM_EMAIL/,
		);
		expect(mockSend).not.toHaveBeenCalled();
	});

	// ── GREEN control: preview stays EXEMPT — unset falls back to sandbox ──
	it("email-otp-from::preview-without-from-uses-sandbox-sender", async () => {
		process.env.ZUGZWANG_ENV = "preview";
		delete process.env.RESEND_FROM_EMAIL;
		await expect(sendVerificationOTP(OTP_ARGS)).resolves.toBeUndefined();
		expect(mockSend).toHaveBeenCalledWith(
			expect.objectContaining({ from: SANDBOX_FROM }),
		);
	});

	// ── GREEN control: existing prod-with-real-from case (kept verbatim) ──
	it("email-otp-from::prod-with-from-uses-that-sender", async () => {
		process.env.ZUGZWANG_ENV = "prod";
		process.env.RESEND_FROM_EMAIL = "no-reply@zugzwang.world";
		await expect(sendVerificationOTP(OTP_ARGS)).resolves.toBeUndefined();
		expect(mockSend).toHaveBeenCalledWith(
			expect.objectContaining({ from: "no-reply@zugzwang.world" }),
		);
	});

	// ── OQ-2 observability: the sender must Sentry.captureException on a failed
	//    send (delivery failures are otherwise near-invisible — Better Auth
	//    swallows the throw → 200). Client-visible behavior is UNCHANGED (still
	//    throws). RED = capture not wired: the `rejects` half is already GREEN on
	//    today's code (the sender already throws on both paths); the `mockCapture`
	//    assertion is the RED (0 calls pre-impl). env is prod + a REAL from so the
	//    from-guard passes and the send path is actually reached. ──

	it("email-otp-from::send-api-error-captures-to-sentry", async () => {
		// API-error path: result.error set → rethrown as "Resend send failed: …".
		process.env.ZUGZWANG_ENV = "prod";
		process.env.RESEND_FROM_EMAIL = "no-reply@zugzwang.world";
		mockSend.mockResolvedValue({ data: null, error: { message: "boom" } });
		await expect(sendVerificationOTP(OTP_ARGS)).rejects.toThrow(
			/Resend send failed/,
		);
		expect(mockCapture).toHaveBeenCalledTimes(1);
		expect(mockCapture).toHaveBeenCalledWith({ message: "boom" });
	});

	it("email-otp-from::send-network-throw-captures-to-sentry", async () => {
		// Network-throw path: resend.emails.send(...) rejects → caught, captured,
		// rethrown (message preserved).
		process.env.ZUGZWANG_ENV = "prod";
		process.env.RESEND_FROM_EMAIL = "no-reply@zugzwang.world";
		const networkErr = new Error("network down");
		mockSend.mockRejectedValue(networkErr);
		await expect(sendVerificationOTP(OTP_ARGS)).rejects.toThrow(/network down/);
		expect(mockCapture).toHaveBeenCalledTimes(1);
		expect(mockCapture).toHaveBeenCalledWith(networkErr);
	});
});
