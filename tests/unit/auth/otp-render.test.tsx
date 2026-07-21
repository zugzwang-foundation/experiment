// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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
}));

vi.mock("next/navigation", () => ({
	useRouter: () => ({ push: mocks.push }),
	useSearchParams: () => ({ get: () => "you@example.com" }),
}));

vi.mock("@/lib/auth-client", () => ({
	authClient: {
		signIn: { emailOtp: mocks.emailOtp },
	},
}));

import OtpPage from "@/app/(auth)/sign-in/otp/page";

beforeEach(() => {
	mocks.emailOtp.mockResolvedValue({ error: null });
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
