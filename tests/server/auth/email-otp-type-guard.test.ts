import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// AUTH-TURNSTILE-WIRE (Q1 = A) — the shared email-OTP sender sends SIGN-IN codes
// and nothing else. Better Auth's plugin also mounts
// `/email-otp/request-password-reset` and `/forget-password/email-otp`, which
// call the same sender with `type: "forget-password"`, need no session, and are
// outside the Turnstile gate. This product has no passwords, so those emails
// have no legitimate recipient; refusing at the sender closes them without
// depending on which routes the library happens to expose.
//
// Two halves: the sender refuses (and never reaches Resend), and the plugin the
// app actually builds is wired to THIS sender — otherwise the refusal would be
// guarding a function the password-reset endpoints never call.

const { mockSend, mockCapture, captured } = vi.hoisted(() => ({
	mockSend: vi.fn(),
	mockCapture: vi.fn(),
	captured: { sendVerificationOTP: null as unknown },
}));

vi.mock("resend", () => ({
	Resend: class {
		emails = { send: mockSend };
	},
}));
vi.mock("@sentry/nextjs", () => ({ captureException: mockCapture }));

// Record the options the app hands the real plugin, then build the real plugin.
vi.mock("better-auth/plugins/email-otp", async (importOriginal) => {
	const actual =
		await importOriginal<typeof import("better-auth/plugins/email-otp")>();
	return {
		...actual,
		emailOTP: (options: Parameters<typeof actual.emailOTP>[0]) => {
			captured.sendVerificationOTP = options.sendVerificationOTP;
			return actual.emailOTP(options);
		},
	};
});

import { sendVerificationOTP } from "@/server/auth/email-otp";
import "@/server/auth/index";

const ARGS = { email: "participant@example.com", otp: "123456" };
const REAL_FROM = "no-reply@mail.zugzwangworld.com";
const SAVED_ENV = process.env.ZUGZWANG_ENV;
const SAVED_FROM = process.env.RESEND_FROM_EMAIL;

function restore(name: string, value: string | undefined): void {
	if (value === undefined) delete process.env[name];
	else process.env[name] = value;
}

beforeEach(() => {
	vi.clearAllMocks();
	mockSend.mockResolvedValue({ data: { id: "stub" }, error: null });
	// Production-shaped, so the from-address guard passes and the only thing
	// that can stop a send is the type check under test.
	process.env.ZUGZWANG_ENV = "prod";
	process.env.RESEND_FROM_EMAIL = REAL_FROM;
});

afterEach(() => {
	restore("ZUGZWANG_ENV", SAVED_ENV);
	restore("RESEND_FROM_EMAIL", SAVED_FROM);
});

describe("sendVerificationOTP — sign-in only", () => {
	it("email-otp-type::sign-in-otp-is-sent", async () => {
		await expect(
			sendVerificationOTP({ ...ARGS, type: "sign-in" }),
		).resolves.toBeUndefined();
		expect(mockSend).toHaveBeenCalledTimes(1);
		expect(mockSend).toHaveBeenCalledWith(
			expect.objectContaining({ to: ARGS.email, from: REAL_FROM }),
		);
	});

	it("email-otp-type::password-reset-otp-is-refused-before-resend", async () => {
		await expect(
			sendVerificationOTP({ ...ARGS, type: "forget-password" }),
		).rejects.toThrow(/refusing OTP type "forget-password"/);
		expect(mockSend).not.toHaveBeenCalled();
	});

	it("email-otp-type::other-library-types-are-refused", async () => {
		for (const type of ["email-verification", "change-email"] as const) {
			await expect(sendVerificationOTP({ ...ARGS, type })).rejects.toThrow(
				new RegExp(`refusing OTP type "${type}"`),
			);
		}
		expect(mockSend).not.toHaveBeenCalled();
	});

	it("email-otp-type::an-unknown-type-is-refused-fail-closed", async () => {
		// A type the library might add later, or a malformed call: the check is an
		// allow-list of one, so anything unrecognised is refused, not delivered.
		const unknown = { ...ARGS, type: "magic-link" } as unknown as Parameters<
			typeof sendVerificationOTP
		>[0];
		await expect(sendVerificationOTP(unknown)).rejects.toThrow(
			/refusing OTP type "magic-link"/,
		);
		expect(mockSend).not.toHaveBeenCalled();
	});

	it("email-otp-type::refusal-does-not-depend-on-environment-configuration", async () => {
		// Checked before the Resend key and from-address, so a password-reset
		// request is refused for what it is even where sending is misconfigured.
		delete process.env.RESEND_FROM_EMAIL;
		await expect(
			sendVerificationOTP({ ...ARGS, type: "forget-password" }),
		).rejects.toThrow(/refusing OTP type/);
	});
});

describe("the auth instance's email-OTP plugin uses the guarded sender", () => {
	it("email-otp-type::plugin-sender-is-the-guarded-function", () => {
		expect(captured.sendVerificationOTP).toBe(sendVerificationOTP);
	});

	it("email-otp-type::password-reset-through-the-plugin-sender-is-refused", async () => {
		const pluginSender =
			captured.sendVerificationOTP as typeof sendVerificationOTP;
		// Exactly the call `/email-otp/request-password-reset` and
		// `/forget-password/email-otp` make (better-auth 1.6.11 routes.mjs).
		await expect(
			pluginSender({ ...ARGS, type: "forget-password" }),
		).rejects.toThrow(/refusing OTP type "forget-password"/);
		expect(mockSend).not.toHaveBeenCalled();
	});
});
