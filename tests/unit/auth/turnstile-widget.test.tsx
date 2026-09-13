// @vitest-environment jsdom

import {
	act,
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// AUTH-TURNSTILE-WIRE — the client half of the F-AUTH-2 Turnstile gate. The
// server half (siteverify, fail-closed) is `tests/server/auth/otp.test.ts`.
//
// Cloudflare's script cannot run under jsdom, so `window.turnstile` is a stub
// that records each `render` call and lets a test hand a token up through the
// captured callback — which is exactly the seam the real widget uses.

const mocks = vi.hoisted(() => ({
	push: vi.fn(),
	signInSocial: vi.fn(),
	sendVerificationOtp: vi.fn(),
	emailOtp: vi.fn(),
}));

vi.mock("next/navigation", () => ({
	useRouter: () => ({ push: mocks.push }),
	useSearchParams: () => ({ get: () => "you@example.com" }),
}));

vi.mock("@/lib/auth-client", () => ({
	authClient: {
		signIn: { social: mocks.signInSocial, emailOtp: mocks.emailOtp },
		emailOtp: { sendVerificationOtp: mocks.sendVerificationOtp },
	},
}));

import OtpPage from "@/app/(auth)/sign-in/otp/page";
import SignInPage from "@/app/(auth)/sign-in/page";

type RenderOptions = {
	sitekey: string;
	callback: (token: string) => void;
	"expired-callback": () => void;
	"error-callback": () => void;
};

let renders: Array<{ el: HTMLElement; opts: RenderOptions }>;
let removed: string[];
const SITE_KEY = "1x00000000000000000000AA";

beforeEach(() => {
	renders = [];
	removed = [];
	process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = SITE_KEY;
	window.turnstile = {
		render: (el, opts) => {
			renders.push({ el, opts: opts as RenderOptions });
			return `widget-${renders.length}`;
		},
		remove: (id) => {
			removed.push(id);
		},
	};
	mocks.sendVerificationOtp.mockResolvedValue({ error: null });
	mocks.emailOtp.mockResolvedValue({ error: null });
	vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
	cleanup();
	vi.clearAllMocks();
	vi.restoreAllMocks();
	delete window.turnstile;
	process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = SITE_KEY;
});

async function solve(index: number, token: string): Promise<void> {
	await waitFor(() => expect(renders.length).toBeGreaterThan(index));
	act(() => {
		renders[index]?.opts.callback(token);
	});
}

function emailForm(container: HTMLElement): HTMLFormElement {
	const email = container.querySelector<HTMLInputElement>(
		'input[name="email"]',
	);
	if (!email) throw new Error("email input missing");
	fireEvent.change(email, { target: { value: "you@example.com" } });
	const form = email.closest("form");
	if (!form) throw new Error("email form missing");
	return form;
}

describe("sign-in — Turnstile widget", () => {
	it("turnstile::widget-mounts-inside-the-email-form-with-the-environment-site-key", async () => {
		const { container } = render(<SignInPage />);
		await waitFor(() => expect(renders).toHaveLength(1));
		const mount = container.querySelector('[data-testid="turnstile-widget"]');
		expect(mount).not.toBeNull();
		expect(renders[0]?.el).toBe(mount);
		expect(
			mount?.closest("form")?.querySelector('input[name="email"]'),
		).not.toBeNull();
		expect(renders[0]?.opts.sitekey).toBe(SITE_KEY);
	});

	it("turnstile::token-required-no-request-without-a-solved-challenge", async () => {
		const { container } = render(<SignInPage />);
		await waitFor(() => expect(renders).toHaveLength(1));
		fireEvent.submit(emailForm(container));

		expect((await screen.findByRole("alert")).textContent).toBe(
			"turnstile_required",
		);
		expect(mocks.sendVerificationOtp).not.toHaveBeenCalled();
	});

	it("turnstile::expired-token-is-withdrawn-and-blocks-the-send", async () => {
		const { container } = render(<SignInPage />);
		await solve(0, "token-that-expires");
		act(() => {
			renders[0]?.opts["expired-callback"]();
		});
		fireEvent.submit(emailForm(container));

		expect((await screen.findByRole("alert")).textContent).toBe(
			"turnstile_required",
		);
		expect(mocks.sendVerificationOtp).not.toHaveBeenCalled();
	});

	it("turnstile::success-sends-the-widget-token-as-the-header-then-navigates", async () => {
		const { container } = render(<SignInPage />);
		await solve(0, "token-from-widget");
		expect(
			container.querySelector<HTMLInputElement>('input[name="turnstileToken"]')
				?.value,
		).toBe("token-from-widget");

		fireEvent.submit(emailForm(container));

		await waitFor(() =>
			expect(mocks.sendVerificationOtp).toHaveBeenCalledTimes(1),
		);
		const [body, opts] = mocks.sendVerificationOtp.mock.calls[0] as [
			{ email: string; type: string },
			{ headers: Record<string, string> },
		];
		expect(body).toEqual({ email: "you@example.com", type: "sign-in" });
		expect(opts.headers["x-turnstile-token"]).toBe("token-from-widget");
		await waitFor(() =>
			expect(mocks.push).toHaveBeenCalledWith(
				"/sign-in/otp?email=you%40example.com",
			),
		);
	});

	it("turnstile::verification-failure-surfaces-and-remounts-for-a-fresh-token", async () => {
		mocks.sendVerificationOtp.mockResolvedValue({
			error: { message: "turnstile_failed" },
		});
		const { container } = render(<SignInPage />);
		await solve(0, "rejected-token");
		fireEvent.submit(emailForm(container));

		expect((await screen.findByRole("alert")).textContent).toBe(
			"turnstile_failed",
		);
		// The spent token is dropped and the widget is re-rendered for a new one.
		await waitFor(() => expect(renders).toHaveLength(2));
		expect(removed).toEqual(["widget-1"]);
		expect(
			container.querySelector<HTMLInputElement>('input[name="turnstileToken"]')
				?.value,
		).toBe("");
		expect(mocks.push).not.toHaveBeenCalled();

		// A second attempt without solving the new widget is refused client-side.
		fireEvent.submit(emailForm(container));
		await waitFor(() =>
			expect(screen.getByRole("alert").textContent).toBe("turnstile_required"),
		);
		expect(mocks.sendVerificationOtp).toHaveBeenCalledTimes(1);
	});

	it("turnstile::missing-site-key-renders-no-challenge-and-fails-closed", async () => {
		delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
		const { container } = render(<SignInPage />);
		fireEvent.submit(emailForm(container));

		expect((await screen.findByRole("alert")).textContent).toBe(
			"turnstile_required",
		);
		expect(renders).toHaveLength(0);
		expect(mocks.sendVerificationOtp).not.toHaveBeenCalled();
	});

	it("turnstile::loads-cloudflare-explicit-render-script-when-absent", async () => {
		delete window.turnstile;
		render(<SignInPage />);
		const script = await waitFor(() => {
			const found = document.head.querySelector<HTMLScriptElement>(
				'script[src^="https://challenges.cloudflare.com/turnstile/v0/api.js"]',
			);
			if (!found) throw new Error("script not injected");
			return found;
		});
		expect(script.src).toContain("render=explicit");
		expect(renders).toHaveLength(0);

		// The script arriving is what makes the widget render.
		window.turnstile = {
			render: (el, opts) => {
				renders.push({ el, opts: opts as RenderOptions });
				return "widget-late";
			},
			remove: () => {},
		};
		act(() => {
			script.dispatchEvent(new Event("load"));
		});
		await waitFor(() => expect(renders).toHaveLength(1));
		script.remove();
	});
});

describe("otp resend — Turnstile widget", () => {
	it("turnstile::otp-page-mounts-its-own-widget", async () => {
		const { container } = render(<OtpPage />);
		await waitFor(() => expect(renders).toHaveLength(1));
		expect(
			container.querySelector('[data-testid="turnstile-widget"]'),
		).not.toBeNull();
	});

	it("turnstile::resend-without-a-token-is-refused", async () => {
		render(<OtpPage />);
		await waitFor(() => expect(renders).toHaveLength(1));
		fireEvent.click(screen.getByRole("button", { name: /resend/i }));

		expect((await screen.findByRole("alert")).textContent).toBe(
			"turnstile_required",
		);
		expect(mocks.sendVerificationOtp).not.toHaveBeenCalled();
	});

	it("turnstile::resend-sends-its-widget-token-and-remounts-after", async () => {
		render(<OtpPage />);
		await solve(0, "resend-token");
		fireEvent.click(screen.getByRole("button", { name: /resend/i }));

		await waitFor(() =>
			expect(mocks.sendVerificationOtp).toHaveBeenCalledTimes(1),
		);
		const [, opts] = mocks.sendVerificationOtp.mock.calls[0] as [
			unknown,
			{ headers: Record<string, string> },
		];
		expect(opts.headers["x-turnstile-token"]).toBe("resend-token");
		await waitFor(() => expect(renders).toHaveLength(2));
	});
});
