import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Per SCAFFOLD.3 plan §4 step 4 + §5 failure-modes #2 + #4 + §7 — Email-
// OTP flow through Better Auth's emailOTP plugin + Cloudflare Turnstile
// gate on the send path + per-email / per-IP rate-limits + Resend email
// delivery callback.
//
// The Turnstile siteverify is configured via `hooks.before` MATCHED ONLY
// to `/email-otp/send-verification-otp` per plan-review feedback (§5
// failure-mode #2: Google callback path explicitly excluded). The matcher
// scope is critical — a Cloudflare outage must not take BOTH auth paths
// down.

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

// Spy on global.fetch so we can assert Turnstile siteverify calls.
const fetchSpy = vi.spyOn(globalThis, "fetch");

import { sendVerificationOTP } from "@/server/auth/email-otp";
import { auth } from "@/server/auth/index";

beforeEach(() => {
	mockCheckRateLimit.mockReset();
	mockOtpEmailIdentifier.mockClear();
	mockIpIdentifier.mockClear();
	mockResendSend.mockReset();
	fetchSpy.mockReset();
	// Set required env vars for Resend + Turnstile config.
	process.env.RESEND_API_KEY = "test-resend-key";
	process.env.TURNSTILE_SECRET_KEY = "test-turnstile-secret";
});

afterEach(() => {
	vi.clearAllMocks();
});

describe("Email-OTP send + verify (F-AUTH-2)", () => {
	// === Plan §3 + §4 step 4 — Resend callback ==============================

	it("otp::send-verification-otp-calls-resend", async () => {
		// Plan §3 file map: `src/server/auth/email-otp.ts` owns the Resend
		// `sendVerificationOTP` callback body. The callback receives
		// `({ email, otp, type })` and dispatches via Resend's email API.
		mockResendSend.mockResolvedValueOnce({
			data: { id: "msg-1" },
			error: null,
		});

		await sendVerificationOTP({
			email: "user@example.com",
			otp: "123456",
			type: "sign-in",
		});

		expect(mockResendSend).toHaveBeenCalledTimes(1);
		const call = mockResendSend.mock.calls[0]?.[0] as {
			to: string | string[];
			subject?: string;
			text?: string;
			html?: string;
		};
		// The OTP code is delivered in the email body.
		const body = `${call?.text ?? ""} ${call?.html ?? ""}`;
		expect(body).toContain("123456");
		// Recipient is the requested email.
		const to = Array.isArray(call?.to) ? call.to.join(",") : call?.to;
		expect(to).toBe("user@example.com");
	});

	// === Plan §5 failure-mode #4 ============================================

	it("otp::resend-failure-throws", async () => {
		// Plan §5 failure-mode #4: Resend send failure → throws →
		// catch-all surfaces HTTP 503 `error_otp_send_failed`.
		mockResendSend.mockResolvedValueOnce({
			data: null,
			error: { message: "API rate limit exceeded", name: "rate_limit" },
		});

		await expect(
			sendVerificationOTP({
				email: "user@example.com",
				otp: "123456",
				type: "sign-in",
			}),
		).rejects.toBeDefined();
	});

	// === Plan §5 failure-mode #2 + §3 — Turnstile scope =====================

	it("otp::turnstile-hook-scope-excludes-google-callback", () => {
		// Plan §5 failure-mode #2 line: "Google path remains available —
		// confirmed by scoping `hooks.before` matcher to `/email-otp/send-
		// verification-otp` ONLY". The Better Auth `hooks.before` config is
		// an array of `{ matcher, handler }` pairs; the Turnstile-running
		// handler's matcher must reject the Google callback path.
		//
		// Verifier: walk the registered hooks.before entries, find the
		// Turnstile-handler entry, run its matcher against both paths.
		const opts = (
			auth as {
				options?: {
					hooks?: {
						before?: Array<{
							matcher: (ctx: { path?: string }) => boolean;
							handler: unknown;
						}>;
					};
				};
			}
		).options;

		const beforeHooks = opts?.hooks?.before ?? [];
		expect(beforeHooks.length).toBeGreaterThan(0);

		// At least one before-hook entry must match the OTP send path AND
		// reject the Google callback path. Plan §3 wording: matched ONLY to
		// `/email-otp/send-verification-otp`.
		const otpHook = beforeHooks.find((h) =>
			h.matcher({ path: "/email-otp/send-verification-otp" }),
		);
		expect(otpHook).toBeDefined();
		// Same hook must NOT match the Google callback.
		expect(otpHook?.matcher({ path: "/callback/google" })).toBe(false);
	});

	// === Plan §4 step 4 — Turnstile siteverify (mocked pass) ================

	it("otp::turnstile-pass-allows-otp-send", async () => {
		// Plan §4 step 4: hooks.before runs siteverify; on pass, rate-limit
		// checks run; on pass, plugin generates the code + dispatches via
		// sendVerificationOTP. Mock siteverify success + rate-limit pass.
		fetchSpy.mockResolvedValueOnce(
			new Response(JSON.stringify({ success: true }), { status: 200 }),
		);
		mockCheckRateLimit.mockResolvedValue({
			allowed: true,
			remaining: 4,
			reset: 0,
		});

		const opts = (
			auth as {
				options?: {
					hooks?: {
						before?: Array<{
							matcher: (ctx: { path?: string }) => boolean;
							handler: (ctx: unknown) => Promise<unknown>;
						}>;
					};
				};
			}
		).options;

		const beforeHooks = opts?.hooks?.before ?? [];
		const otpHook = beforeHooks.find((h) =>
			h.matcher({ path: "/email-otp/send-verification-otp" }),
		);
		expect(otpHook).toBeDefined();
		if (!otpHook) return;

		// Run the handler with a synthetic context: body.email +
		// turnstileToken + ip. The handler must call siteverify + rate-
		// limit; on pass, it returns normally (no throw).
		await expect(
			otpHook.handler({
				path: "/email-otp/send-verification-otp",
				body: {
					email: "user@example.com",
					turnstileToken: "test-token-passing",
				},
				request: { headers: new Headers({ "x-forwarded-for": "1.2.3.4" }) },
			}),
		).resolves.toBeDefined();

		// Turnstile siteverify hit.
		expect(fetchSpy).toHaveBeenCalledWith(
			expect.stringContaining("challenges.cloudflare.com"),
			expect.any(Object),
		);
		// Rate-limit checks ran AFTER turnstile (in order).
		expect(mockCheckRateLimit).toHaveBeenCalled();
	});

	// === Plan §5 failure-mode #2 — Turnstile fail-closed ====================

	it("otp::turnstile-fail-rejects-otp-send", async () => {
		// Plan §5 failure-mode #2: Cloudflare Turnstile siteverify fails →
		// fail-CLOSED → `error_turnstile_failed` HTTP 400 OR
		// `error_turnstile_unavailable` HTTP 503. Email-OTP send blocked.
		// Google path remains available (asserted in scope test above).
		fetchSpy.mockResolvedValueOnce(
			new Response(JSON.stringify({ success: false }), { status: 200 }),
		);

		const opts = (
			auth as {
				options?: {
					hooks?: {
						before?: Array<{
							matcher: (ctx: { path?: string }) => boolean;
							handler: (ctx: unknown) => Promise<unknown>;
						}>;
					};
				};
			}
		).options;

		const beforeHooks = opts?.hooks?.before ?? [];
		const otpHook = beforeHooks.find((h) =>
			h.matcher({ path: "/email-otp/send-verification-otp" }),
		);
		if (!otpHook) throw new Error("OTP turnstile hook not registered");

		await expect(
			otpHook.handler({
				path: "/email-otp/send-verification-otp",
				body: {
					email: "user@example.com",
					turnstileToken: "test-token-failing",
				},
				request: { headers: new Headers({ "x-forwarded-for": "1.2.3.4" }) },
			}),
		).rejects.toBeDefined();

		// Rate-limit was NOT called because Turnstile gate rejected first.
		expect(mockCheckRateLimit).not.toHaveBeenCalled();
	});

	// === Plan §5 failure-mode #2 — Turnstile unavailable ===================

	it("otp::turnstile-unavailable-fails-closed", async () => {
		// Plan §5 failure-mode #2: siteverify down or 5xx → fail-CLOSED. The
		// 5xx arm is symmetric to the success:false arm — also reject.
		fetchSpy.mockResolvedValueOnce(
			new Response("server error", { status: 503 }),
		);

		const opts = (
			auth as {
				options?: {
					hooks?: {
						before?: Array<{
							matcher: (ctx: { path?: string }) => boolean;
							handler: (ctx: unknown) => Promise<unknown>;
						}>;
					};
				};
			}
		).options;

		const beforeHooks = opts?.hooks?.before ?? [];
		const otpHook = beforeHooks.find((h) =>
			h.matcher({ path: "/email-otp/send-verification-otp" }),
		);
		if (!otpHook) throw new Error("OTP turnstile hook not registered");

		await expect(
			otpHook.handler({
				path: "/email-otp/send-verification-otp",
				body: {
					email: "user@example.com",
					turnstileToken: "anything",
				},
				request: { headers: new Headers({ "x-forwarded-for": "1.2.3.4" }) },
			}),
		).rejects.toBeDefined();
	});

	// === Plan §4 step 4 — rate-limit: per-email + per-IP ===================

	it("otp::rate-limit-per-email-rejects-when-exceeded", async () => {
		// Plan §4 step 4: on Turnstile pass, run
		// `checkRateLimit('otpRequestPerEmail', email)` +
		// `checkRateLimit('otpRequestPerIpBurst', ip)`. Either deny → 429
		// `error_otp_rate_limited`.
		fetchSpy.mockResolvedValueOnce(
			new Response(JSON.stringify({ success: true }), { status: 200 }),
		);
		// Per-email check returns DENIED.
		mockCheckRateLimit.mockResolvedValueOnce({
			allowed: false,
			retryAfter: 3600,
		});

		const opts = (
			auth as {
				options?: {
					hooks?: {
						before?: Array<{
							matcher: (ctx: { path?: string }) => boolean;
							handler: (ctx: unknown) => Promise<unknown>;
						}>;
					};
				};
			}
		).options;

		const beforeHooks = opts?.hooks?.before ?? [];
		const otpHook = beforeHooks.find((h) =>
			h.matcher({ path: "/email-otp/send-verification-otp" }),
		);
		if (!otpHook) throw new Error("OTP turnstile hook not registered");

		await expect(
			otpHook.handler({
				path: "/email-otp/send-verification-otp",
				body: {
					email: "user@example.com",
					turnstileToken: "test-token-passing",
				},
				request: { headers: new Headers({ "x-forwarded-for": "1.2.3.4" }) },
			}),
		).rejects.toBeDefined();

		// Per-email check fired with the correct surface key.
		expect(mockCheckRateLimit).toHaveBeenCalledWith(
			"otpRequestPerEmail",
			"user@example.com",
		);
	});

	it("otp::rate-limit-per-ip-burst-rejects-when-exceeded", async () => {
		// Same shape, but per-IP burst is the denying one. Per plan §3 +
		// SPEC.2 §11: both checks gate the send; either denial blocks.
		fetchSpy.mockResolvedValueOnce(
			new Response(JSON.stringify({ success: true }), { status: 200 }),
		);
		// First check (per-email): allowed
		mockCheckRateLimit.mockResolvedValueOnce({
			allowed: true,
			remaining: 4,
			reset: 0,
		});
		// Second check (per-IP burst): denied
		mockCheckRateLimit.mockResolvedValueOnce({
			allowed: false,
			retryAfter: 60,
		});

		const opts = (
			auth as {
				options?: {
					hooks?: {
						before?: Array<{
							matcher: (ctx: { path?: string }) => boolean;
							handler: (ctx: unknown) => Promise<unknown>;
						}>;
					};
				};
			}
		).options;

		const beforeHooks = opts?.hooks?.before ?? [];
		const otpHook = beforeHooks.find((h) =>
			h.matcher({ path: "/email-otp/send-verification-otp" }),
		);
		if (!otpHook) throw new Error("OTP turnstile hook not registered");

		await expect(
			otpHook.handler({
				path: "/email-otp/send-verification-otp",
				body: {
					email: "user@example.com",
					turnstileToken: "test-token-passing",
				},
				request: { headers: new Headers({ "x-forwarded-for": "1.2.3.4" }) },
			}),
		).rejects.toBeDefined();

		// Second check fired with the IP surface key.
		expect(mockCheckRateLimit).toHaveBeenCalledWith(
			"otpRequestPerIpBurst",
			"1.2.3.4",
		);
	});

	// === Plan §6 — OTP single-use semantics =================================

	it("otp::email-otp-plugin-registered", () => {
		// Plan §3 + SPEC.2 §8.2 line 805: Better Auth email-OTP plugin
		// configured on the instance. The plugin enforces single-use
		// (verifications row deleted on use) + expiry checks per its
		// internal contract.
		const opts = (auth as { options?: { plugins?: Array<{ id?: string }> } })
			.options;

		const plugins = opts?.plugins ?? [];
		const hasEmailOtp = plugins.some(
			(p) => p.id === "email-otp" || p.id === "emailOTP",
		);
		expect(hasEmailOtp).toBe(true);
	});
});
