// @vitest-environment jsdom

import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// UI-A7 — Auth skin (§9 TEST PLAN, surface 2). Tests-FIRST driver for the
// `/sign-in/otp` skin, modeled on tests/unit/composer/render/preserved-inputs.
//
// Rendering the DEFAULT export (OtpPage = <Suspense fallback={null}>
// <OtpForm/></Suspense>) is the faithful check of §3.2's build-time hard
// requirement: the useSearchParams read must sit inside a Suspense boundary.
//
//   GUARDRAIL (§3.2, green both ways): the `name="otp"` field keeps
//     pattern/maxLength/inputMode/name; the controlled email binding shows the
//     ?email= value; the Verify button renders; the default export renders
//     through the Suspense boundary.
//   DRIVER (RED pre-skin): the branded shadcn primitives (data-slot) and the
//     W2.11 invalid-OTP error callout (role="alert"). Absent on today's
//     unstyled scaffold → RED; present after the skin → GREEN.

const mocks = vi.hoisted(() => ({
	push: vi.fn(),
	emailOtp: vi.fn(),
	sendVerificationOtp: vi.fn(),
}));

vi.mock("next/navigation", () => ({
	useRouter: () => ({ push: mocks.push }),
	useSearchParams: () => ({ get: () => "you@example.com" }),
}));

vi.mock("@/lib/auth-client", () => ({
	authClient: {
		signIn: { emailOtp: mocks.emailOtp },
		// Fix (b)'s Resend affordance calls a DIFFERENT method than Verify —
		// `authClient.emailOtp.sendVerificationOtp(...)`, the same send the
		// sign-in page uses (NOT signIn.emailOtp, which VERIFIES a code).
		emailOtp: { sendVerificationOtp: mocks.sendVerificationOtp },
	},
}));

import OtpPage from "@/app/(auth)/sign-in/otp/page";

beforeEach(() => {
	mocks.emailOtp.mockResolvedValue({ error: null });
	mocks.sendVerificationOtp.mockResolvedValue({ error: null });
});

afterEach(() => {
	cleanup();
	vi.clearAllMocks();
});

describe("UI-A7 otp skin — seam contract (§3.2 GUARDRAIL, green both ways)", () => {
	it("otp-skin::preserves-the-otp-field-attributes-email-binding-and-suspense", () => {
		// Rendering the default export exercises the required <Suspense> wrap.
		const { container } = render(<OtpPage />);

		const otp = container.querySelector<HTMLInputElement>('input[name="otp"]');
		expect(otp).not.toBeNull();
		expect(otp?.getAttribute("pattern")).toBe("[0-9]{6}");
		expect(otp?.maxLength).toBe(6);
		expect(otp?.getAttribute("inputmode")).toBe("numeric");

		// Controlled email binding shows the ?email= value from useSearchParams.
		const email = container.querySelector<HTMLInputElement>(
			'input[name="email"]',
		);
		expect(email?.value).toBe("you@example.com");

		// Verify button renders (label intact) — and its presence proves the
		// OtpForm resolved through the Suspense boundary in the default export.
		expect(screen.getByRole("button", { name: "Verify" })).toBeTruthy();
		expect(container.querySelector("form")).not.toBeNull();
	});
});

describe("UI-A7 otp skin — branded presentation (DRIVER, RED pre-skin)", () => {
	it("otp-skin::renders-the-card-primitive", () => {
		const { container } = render(<OtpPage />);
		expect(container.querySelector('[data-slot="card"]')).not.toBeNull();
	});

	it("otp-skin::renders-the-input-primitive", () => {
		const { container } = render(<OtpPage />);
		expect(container.querySelector('[data-slot="input"]')).not.toBeNull();
	});

	it("otp-skin::renders-the-button-primitive", () => {
		const { container } = render(<OtpPage />);
		expect(container.querySelector('[data-slot="button"]')).not.toBeNull();
	});

	it("otp-skin::invalid-otp-renders-an-alert-callout", async () => {
		// An SDK error whose message is NOT "ONBOARDING_REQUIRED" (which would
		// route to /onboarding) lands in the `error` <p> slot (§5 invalid-OTP).
		// The skin reframes that slot as a role="alert" callout; the scaffold's
		// bare <p> has no role → findByRole times out → RED.
		mocks.emailOtp.mockResolvedValue({ error: { message: "otp_invalid" } });
		const { container } = render(<OtpPage />);

		const otp = container.querySelector<HTMLInputElement>('input[name="otp"]');
		if (!otp) throw new Error("seam broken: otp input missing");
		fireEvent.change(otp, { target: { value: "000000" } });

		const form = otp.closest("form");
		if (!form) throw new Error("seam broken: otp form missing");
		fireEvent.submit(form);

		const alert = await screen.findByRole("alert");
		expect(alert.textContent).toContain("otp_invalid");
	});
});

describe("AUTH-OTP-DELIVERY fix (b) — resend + back affordance (DRIVER, RED pre-impl)", () => {
	// The /sign-in/otp page pre-impl is verify-only (no resend, no back link).
	// Better Auth structurally swallows the sender's throw → the OTP-request
	// endpoint always returns 200, so a delivery failure is invisible to the
	// client (plan §2). Fix (b) is defense-in-depth: a Resend control + a
	// "Back to sign in" link give the stranded user AGENCY — the resend
	// re-triggers the send; it can NOT confirm delivery. Neither control renders
	// today → behavior-missing RED until the affordance lands.

	it("otp-resend::renders-the-resend-control", () => {
		render(<OtpPage />);
		// A button whose accessible name matches /resend/i (distinct from Verify).
		expect(screen.getByRole("button", { name: /resend/i })).toBeTruthy();
	});

	it("otp-resend::renders-the-back-to-sign-in-link", () => {
		render(<OtpPage />);
		const link = screen.getByRole("link", { name: /back to sign in/i });
		expect(link.getAttribute("href")).toBe("/sign-in");
	});

	it("otp-resend::clicking-resend-calls-send-verification-otp-with-turnstile-header", async () => {
		render(<OtpPage />);
		fireEvent.click(screen.getByRole("button", { name: /resend/i }));

		await waitFor(() =>
			expect(mocks.sendVerificationOtp).toHaveBeenCalledTimes(1),
		);
		// First arg: the { email, type } body (email from ?email= via
		// useSearchParams). Second arg: FetchOptions carrying the x-turnstile-token
		// header (the OTP gate rejects a missing token) — the same non-empty
		// placeholder the sign-in page sends until Turnstile is wired.
		const [body, opts] = mocks.sendVerificationOtp.mock.calls[0] as [
			{ email: string; type: string },
			{ headers?: Record<string, string> },
		];
		expect(body).toEqual({ email: "you@example.com", type: "sign-in" });
		const token = opts.headers?.["x-turnstile-token"];
		expect(typeof token).toBe("string");
		expect((token ?? "").length).toBeGreaterThan(0);
	});

	it("otp-resend::resend-error-renders-in-the-shared-alert", async () => {
		// A resend that returns { error } surfaces in the EXISTING role="alert"
		// slot (no new error branch). Turnstile/validation only — NOT delivery
		// (which the plugin swallows to 200, per §2).
		mocks.sendVerificationOtp.mockResolvedValue({
			error: { message: "rate_limited" },
		});
		render(<OtpPage />);
		fireEvent.click(screen.getByRole("button", { name: /resend/i }));

		const alert = await screen.findByRole("alert");
		expect(alert.textContent).toContain("rate_limited");
	});

	it("otp-resend::successful-resend-confirms-via-status-not-a-second-alert", async () => {
		// beforeEach sets sendVerificationOtp → { error: null }. A success
		// confirmation must be role="status" (NOT a second role="alert"), so the
		// invalid-OTP findByRole("alert") test above stays unambiguous.
		render(<OtpPage />);
		fireEvent.click(screen.getByRole("button", { name: /resend/i }));

		expect(await screen.findByRole("status")).toBeTruthy();
		expect(screen.queryByRole("alert")).toBeNull();
	});
});
