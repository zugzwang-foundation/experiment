import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// AUTH-OTP-GATE §7 tests-first — RED-first regression guard for the
// email-OTP send short-circuit bug. Unlike tests/server/auth/otp.test.ts
// (which calls the `zugzwang-otp-gate` before-hook handler in ISOLATION and
// only asserts it resolves), this drives the REAL
// `auth.api.sendVerificationOTP` endpoint THROUGH Better Auth's hook
// aggregator. That is the exact gap that let the bug ship.
//
// THE BUG (root-caused in the plan's Evidence block, verified against
// node_modules/better-auth@1.6.11): the gate's success-path returns a bare
// `{}`. The aggregator (`to-auth-endpoints.mjs` runBeforeHooks L222-232 +
// main flow L74-93) treats an object returned WITHOUT a truthy `context`
// key as a deliberate SHORT-CIRCUIT response — it returns `200 {}` and the
// real send endpoint (`email-otp/routes.mjs` resolveOTP +
// sendVerificationOTP) NEVER runs. So no OTP is generated, no verification
// row is stored, and the Resend dispatch callback is never invoked.
//
// DISCRIMINATOR = side effects, NOT a throw. Under the bug the call RESOLVES
// to `{}` with zero side effects. Under the fix (`return { context: {} }`)
// it resolves WITH side effects: a `verifications` row is created (the OTP is
// generated/stored) and the Resend `emails.send` callback fires once with a
// 6-digit code (the OTP is dispatched). Both assertions below fail RED on the
// unfixed code and pass GREEN after the fix.

const { mockCheckRateLimit, mockOtpEmailIdentifier, mockIpIdentifier } =
	vi.hoisted(() => ({
		mockCheckRateLimit: vi.fn(),
		mockOtpEmailIdentifier: vi.fn((email: string) => email),
		mockIpIdentifier: vi.fn((ip: string) => ip),
	}));

vi.mock("@/server/middleware/rate-limit", () => ({
	checkRateLimit: mockCheckRateLimit,
	otpEmailIdentifier: mockOtpEmailIdentifier,
	ipIdentifier: mockIpIdentifier,
}));

const { mockResendSend } = vi.hoisted(() => ({
	mockResendSend: vi.fn(),
}));

vi.mock("resend", () => ({
	Resend: vi.fn().mockImplementation(() => ({
		emails: { send: mockResendSend },
	})),
}));

// Spy on global.fetch so the Turnstile siteverify call (POST to
// challenges.cloudflare.com) returns a success body without hitting the
// network. mockResolvedValue (not Once) so it is robust to any extra fetch.
const fetchSpy = vi.spyOn(globalThis, "fetch");

import { verifications } from "@/db/schema";
import { auth } from "@/server/auth/index";
import { testDb } from "../db/_fixtures/db";

const EMAIL = "otp-send-red@example.com";
// Better Auth email-OTP identifier format is `${type}-otp-${email}`
// (email-otp/utils.mjs L4 toOTPIdentifier). type="sign-in" here. The route
// lowercases the email (routes.mjs `ctx.body.email.toLowerCase()`) before
// composing the identifier, so mirror that here — robust even if EMAIL ever
// gains uppercase (code-reviewer LOW).
const IDENTIFIER = `sign-in-otp-${EMAIL.toLowerCase()}`;

async function deleteVerificationRows(): Promise<void> {
	await testDb
		.delete(verifications)
		.where(eq(verifications.identifier, IDENTIFIER));
}

beforeEach(async () => {
	mockCheckRateLimit.mockReset();
	mockOtpEmailIdentifier.mockClear();
	mockIpIdentifier.mockClear();
	mockResendSend.mockReset();
	fetchSpy.mockReset();

	// Gate passes: rate-limit allows; Turnstile siteverify succeeds.
	mockCheckRateLimit.mockResolvedValue({
		allowed: true,
		remaining: 4,
		reset: 0,
	});
	fetchSpy.mockResolvedValue(
		new Response(JSON.stringify({ success: true }), { status: 200 }),
	);
	// Resend dispatch succeeds.
	mockResendSend.mockResolvedValue({ data: { id: "msg-1" }, error: null });

	// Idempotent: clear any prior OTP row for this identifier before the run.
	await deleteVerificationRows();
});

afterEach(async () => {
	await deleteVerificationRows();
	vi.clearAllMocks();
});

describe("Email-OTP send through the real endpoint (AUTH-OTP-GATE)", () => {
	it("email-otp-send::generates-stores-and-dispatches-otp", async () => {
		// ACT — drive the REAL server API through the hook aggregator. Under
		// the bug this resolves to `{}` (no throw, no side effects); under the
		// fix it resolves and runs the real send endpoint.
		await auth.api.sendVerificationOTP({
			body: { email: EMAIL, type: "sign-in" },
			headers: {
				"x-turnstile-token": "tok",
				"x-forwarded-for": "1.2.3.4",
			},
		});

		// ASSERT (a) — the OTP was GENERATED/STORED: a verifications row exists
		// for identifier `sign-in-otp-<email>` (resolveOTP →
		// internalAdapter.createVerificationValue). Fails RED on the bug (the
		// endpoint never runs, so no row is written).
		const rows = await testDb
			.select()
			.from(verifications)
			.where(eq(verifications.identifier, IDENTIFIER));
		expect(rows.length).toBeGreaterThanOrEqual(1);

		// ASSERT (b) — the OTP was DISPATCHED: the Resend `emails.send` callback
		// fired exactly once, to the requesting email, with a 6-digit code in
		// the subject/text body. Fails RED on the bug (sendVerificationOTP is
		// never invoked).
		expect(mockResendSend).toHaveBeenCalledTimes(1);
		const call = mockResendSend.mock.calls[0]?.[0] as {
			to: string | string[];
			subject?: string;
			text?: string;
		};
		const to = Array.isArray(call?.to) ? call.to.join(",") : call?.to;
		expect(to).toBe(EMAIL);
		const body = `${call?.subject ?? ""} ${call?.text ?? ""}`;
		expect(body).toMatch(/\d{6}/);
	});
});
