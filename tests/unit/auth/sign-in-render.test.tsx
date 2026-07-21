// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// UI-A7 — Auth skin (§9 TEST PLAN, surface 1). Tests-FIRST driver for the
// `/sign-in` skin, modeled on tests/unit/composer/render/preserved-inputs.
//
// This file carries TWO assertion classes:
//   GUARDRAIL — the §3.1 seam contract. GREEN before AND after the skin;
//     proves the presentation swap never broke a logic binding.
//   DRIVER    — the branded W2.1-card presentation (§2 Vertical 1 / §5). RED
//     against today's unstyled scaffold (zero classNames, plain <main>/
//     <section>/<button>/<input>), GREEN once the skin lands. Markers are
//     STABLE, non-brittle hooks — shadcn `data-slot` attributes, the "or"
//     divider label, and `role="alert"` error callouts — never class strings.
//
// The page's imports resolve today, so `render()` succeeds; only the branded
// assertions fail. That is the RED-for-the-right-reason bar (§9): an
// assertion miss, never a collection/import/harness error.

const mocks = vi.hoisted(() => ({
	push: vi.fn(),
	signInSocial: vi.fn(),
	sendVerificationOtp: vi.fn(),
}));

vi.mock("next/navigation", () => ({
	useRouter: () => ({ push: mocks.push }),
}));

vi.mock("@/lib/auth-client", () => ({
	authClient: {
		signIn: { social: mocks.signInSocial },
		emailOtp: { sendVerificationOtp: mocks.sendVerificationOtp },
	},
}));

import SignInPage from "@/app/(auth)/sign-in/page";

beforeEach(() => {
	// Sane defaults so a bare render never rejects on destructuring the SDK
	// result. Individual tests override as needed.
	mocks.signInSocial.mockResolvedValue(undefined);
	mocks.sendVerificationOtp.mockResolvedValue({ error: null });
});

afterEach(() => {
	cleanup();
	vi.clearAllMocks();
});

describe("UI-A7 sign-in skin — seam contract (§3.1 GUARDRAIL, green both ways)", () => {
	it("sign-in-skin::preserves-the-email-and-turnstile-bindings-and-both-buttons", () => {
		const { container } = render(<SignInPage />);

		// F-AUTH-2 email binding survives the swap.
		const email = container.querySelector('input[name="email"]');
		expect(email).not.toBeNull();

		// The hidden Turnstile anchor MUST survive with its placeholder value
		// (future Cloudflare widget mounts here; handleEmailOtp reads it).
		const turnstile = container.querySelector<HTMLInputElement>(
			'input[name="turnstileToken"]',
		);
		expect(turnstile).not.toBeNull();
		expect(turnstile?.value).toBe("placeholder-token");

		// Both submit paths render with their labels intact.
		expect(
			screen.getByRole("button", { name: "Continue with Google" }),
		).toBeTruthy();
		expect(screen.getByRole("button", { name: "Send code" })).toBeTruthy();
	});
});

describe("UI-A7 sign-in skin — branded presentation (DRIVER, RED pre-skin)", () => {
	it("sign-in-skin::renders-the-card-primitive", () => {
		const { container } = render(<SignInPage />);
		// The unstyled scaffold uses a bare <main>/<section>; the skin swaps
		// to <Card> (data-slot="card"). Absent today → RED.
		expect(container.querySelector('[data-slot="card"]')).not.toBeNull();
	});

	it("sign-in-skin::renders-the-button-primitive", () => {
		const { container } = render(<SignInPage />);
		// Plain <button> today; the skin swaps to <Button> (data-slot="button").
		expect(container.querySelector('[data-slot="button"]')).not.toBeNull();
	});

	it("sign-in-skin::renders-the-input-primitive", () => {
		const { container } = render(<SignInPage />);
		// Plain <input> today; the skin swaps to <Input> (data-slot="input").
		expect(container.querySelector('[data-slot="input"]')).not.toBeNull();
	});

	it("sign-in-skin::renders-the-or-divider-between-google-and-email", () => {
		render(<SignInPage />);
		// The W2.1 divider is an "or"-divider (word "or" flanked by hairlines).
		// No "or" text exists on the scaffold → getByText throws → RED.
		expect(screen.getByText("or")).toBeTruthy();
	});

	it("sign-in-skin::rate-limited-error-renders-an-alert-callout", async () => {
		// The rate-limited code already flows through the emailError <p> slot
		// (§5). The skin reframes that slot as a role="alert" callout. The
		// scaffold renders a bare <p> with no role → findByRole times out → RED.
		mocks.sendVerificationOtp.mockResolvedValue({
			error: { message: "rate_limited" },
		});
		const { container } = render(<SignInPage />);

		const email = container.querySelector<HTMLInputElement>(
			'input[name="email"]',
		);
		if (!email) throw new Error("seam broken: email input missing");
		fireEvent.change(email, { target: { value: "you@example.com" } });

		const form = email.closest("form");
		if (!form) throw new Error("seam broken: email form missing");
		fireEvent.submit(form);

		const alert = await screen.findByRole("alert");
		expect(alert.textContent).toContain("rate_limited");
	});
});
