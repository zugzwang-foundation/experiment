// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * MOBILE-1 · Phase B — THE TWO SIGN-IN PAGES SWAP THE FORM FOR A PLAIN
 * MESSAGE, AS A PURE-CSS TOGGLE BETWEEN TWO SIBLINGS THAT ARE **BOTH** IN THE
 * SERVER-RENDERED HTML.
 *
 * WHAT THIS PROVES, AND WHERE IT COMES FROM. `docs/plans/MOBILE-1.md` §4
 * "Sign-in destination pages (Phase B)": below the breakpoint both pages render
 * the plain message **"Sign-up only works on a computer right now."** in place
 * of the real form, reusing the `Card`/`CardHeader`/`CardContent` primitives
 * already imported in both files — no new component. The exact string is
 * founder-ratified (Decisions received #5) and is asserted BYTE-FOR-BYTE below:
 * copy is founder-owned (CLAUDE.md §3) and a test that matched loosely would
 * let a paraphrase through.
 *
 * ⛔⛔ "IMPLEMENTED AS A PURE-CSS TOGGLE... NEVER A CLIENT-SIDE JS-COMPUTED
 * CONDITIONAL RENDER" IS A CORRECTNESS REQUIREMENT, NOT A STYLE PREFERENCE
 * (plan §4, stated in those words). Both pages are already `"use client"` and
 * fully dependent on JS to submit anything — but a CSS-only toggle means the
 * correct state renders BEFORE HYDRATION, with zero flash and zero dependency
 * on `window.innerWidth` / `matchMedia` at runtime. A JS conditional would show
 * a phone user the full form for the duration of hydration, on the one surface
 * this whole task exists to keep them off.
 *
 * ⇒ THE ASSERTION THAT ENFORCES IT is "both blocks are present in the SAME
 * render". If either block is conditionally rendered by JS, one of them is
 * missing here and this file reddens. There is no viewport in jsdom to satisfy
 * such a conditional, so the test cannot be talked out of it by resizing
 * anything.
 *
 * ⚠ jsdom RESOLVES NO MEDIA QUERY AND PERFORMS NO LAYOUT (AGENTS.md §9), so
 * which of the two siblings actually PAINTS is not observable here — the class
 * binding is. The compiled variant's real match condition is a `globals.css`
 * source scan (`tests/unit/design/touch-primary-variant.test.ts`) plus a
 * browser measurement.
 *
 * ⚠ NO jest-dom (AGENTS.md §9) — plain DOM only.
 *
 * ⚠ TDD DRIVER, NOT A `_probe-*` REGRESSION GUARD (CLAUDE.md §5.6).
 */

const mocks = vi.hoisted(() => ({
	push: vi.fn(),
	signInSocial: vi.fn(),
	signInEmailOtp: vi.fn(),
	sendVerificationOtp: vi.fn(),
}));

vi.mock("next/navigation", () => ({
	useRouter: () => ({ push: mocks.push }),
	useSearchParams: () => ({ get: () => "you@example.com" }),
}));

vi.mock("@/lib/auth-client", () => ({
	authClient: {
		signIn: { social: mocks.signInSocial, emailOtp: mocks.signInEmailOtp },
		emailOtp: { sendVerificationOtp: mocks.sendVerificationOtp },
	},
}));

import OtpPage from "@/app/(auth)/sign-in/otp/page";
import SignInPage from "@/app/(auth)/sign-in/page";

/** Founder-ratified, verbatim (plan §4 + Decisions received #5). */
const MESSAGE = "Sign-up only works on a computer right now.";

const WIDTH_HIDE = "max-mobile:hidden";
const TOUCH_HIDE = "touch-primary:hidden";
const HIDE_TOKENS = [WIDTH_HIDE, TOUCH_HIDE] as const;

/** The message block's reveal half — `flex` or `block`, either is fine. */
const WIDTH_REVEAL = /^max-mobile:(flex|block)$/;
const TOUCH_REVEAL = /^touch-primary:(flex|block)$/;

const MESSAGE_TESTID = "mobile-auth-unavailable";

const PAGES = [
	{
		name: "/sign-in",
		Page: SignInPage,
		formTestId: "sign-in-form-block",
	},
	{
		name: "/sign-in/otp",
		Page: OtpPage,
		formTestId: "otp-form-block",
	},
] as const;

beforeEach(() => {
	mocks.signInSocial.mockResolvedValue(undefined);
	mocks.signInEmailOtp.mockResolvedValue({ error: null });
	mocks.sendVerificationOtp.mockResolvedValue({ error: null });
});

afterEach(() => {
	cleanup();
	vi.clearAllMocks();
});

function classesOf(el: Element): string[] {
	return (el.getAttribute("class") ?? "").split(/\s+/).filter(Boolean);
}

for (const { name, Page, formTestId } of PAGES) {
	describe(`sign-in-device-gate::${name}`, () => {
		it(`sign-in-device-gate::${name}-form-block-hides-under-BOTH-conditions`, () => {
			render(<Page />);
			const form = screen.getByTestId(formTestId);
			const classes = classesOf(form);

			for (const token of HIDE_TOKENS) {
				expect(
					classes,
					`${name}: the \`${formTestId}\` block does not carry \`${token}\`. ` +
						`MOBILE-1 §4 hides the real form under BOTH the 640px ` +
						`phone-width rule and the width-independent touch-primary rule ` +
						`— the second is the only layer that reaches a default-mode ` +
						`iPad, which the server-side gate cannot see at all (plan §3, ` +
						`Self-critique #1).`,
				).toContain(token);
			}
		});

		it(`sign-in-device-gate::${name}-shows-the-verbatim-message-block`, () => {
			render(<Page />);
			const message = screen.getByTestId(MESSAGE_TESTID);

			// ⛔ BYTE-FOR-BYTE. Copy is founder-owned (CLAUDE.md §3) and this exact
			// string is Decisions received #5. `toBe`, never `toContain`: a
			// substring match would pass a paraphrase that merely embeds it.
			expect(
				message.textContent,
				`${name}: the mobile message is not the ratified string. It is ` +
					`founder copy (MOBILE-1 Decisions received #5) and may not be ` +
					`reworded here.`,
			).toBe(MESSAGE);

			const classes = classesOf(message);

			// Hidden by default — desktop is the unprefixed base state everywhere
			// (plan §4 "Discipline"), so the message must start hidden and be
			// REVEALED by an override, never the other way round. A base-visible
			// message with a desktop hide would flash on every desktop load.
			expect(
				classes,
				`${name}: the message block is not \`hidden\` by default. Desktop is ` +
					`the unprefixed base state (MOBILE-1 §4) — the message is revealed ` +
					`by an override, not hidden by one.`,
			).toContain("hidden");

			expect(
				classes.some((c) => WIDTH_REVEAL.test(c)),
				`${name}: the message block carries no \`max-mobile:flex\`/` +
					`\`max-mobile:block\` reveal, so it never appears at phone width. ` +
					`Classes: ${classes.join(" ")}`,
			).toBe(true);
			expect(
				classes.some((c) => TOUCH_REVEAL.test(c)),
				`${name}: the message block carries no \`touch-primary:flex\`/` +
					`\`touch-primary:block\` reveal, so it never appears on a ` +
					`touch-primary device — including every default-mode iPad, the one ` +
					`device class with no server-side backstop at all. Classes: ` +
					`${classes.join(" ")}`,
			).toBe(true);
		});

		it(`sign-in-device-gate::${name}-renders-BOTH-blocks-in-one-pass-CSS-toggle-only`, () => {
			// ⛔⛔ THE REQUIREMENT THIS FILE EXISTS FOR (plan §4). Both siblings are
			// in the markup at once; CSS decides which paints. If either is
			// rendered behind a JS conditional — `useState`, `matchMedia`,
			// `window.innerWidth` — one of these lookups throws here and the test
			// reddens.
			const { container } = render(<Page />);

			const form = screen.getByTestId(formTestId);
			const message = screen.getByTestId(MESSAGE_TESTID);

			expect(container.contains(form)).toBe(true);
			expect(container.contains(message)).toBe(true);

			// Exactly one of each — two message blocks would be two copies of
			// founder copy that can drift.
			expect(
				container.querySelectorAll(`[data-testid="${formTestId}"]`).length,
			).toBe(1);
			expect(
				container.querySelectorAll(`[data-testid="${MESSAGE_TESTID}"]`).length,
			).toBe(1);

			// …and neither contains the other: they are SIBLING blocks, so the
			// hide on one can never take the other with it.
			expect(form.contains(message)).toBe(false);
			expect(message.contains(form)).toBe(false);
		});

		it(`sign-in-device-gate::${name}-keeps-the-brand-CardHeader-at-every-width`, () => {
			// ⛔ THE CARD HEADER IS NOT PART OF THE SWAP. The message replaces the
			// FORM, inside the same Card — plan §4: "reusing the existing
			// `Card`/`CardHeader`/`CardContent` primitives already imported in both
			// files — no new component". A hide on the header would leave a phone
			// reader an unbranded, unnamed box carrying a bare sentence.
			const { container } = render(<Page />);

			// CONTROL first: the tokens are findable by this reading method on the
			// element that is supposed to carry them. Without it, "the header does
			// not carry them" and "nothing carries them" are the same green.
			const formClasses = classesOf(screen.getByTestId(formTestId));
			for (const token of HIDE_TOKENS) {
				expect(
					formClasses,
					`CONTROL FAILED (${name}): the \`${formTestId}\` block does not ` +
						`carry \`${token}\`, so the absence assertion below proved ` +
						`nothing.`,
				).toContain(token);
			}

			const headers = [
				...container.querySelectorAll('[data-slot="card-header"]'),
			];
			expect(
				headers.length,
				`${name}: no \`[data-slot="card-header"]\` found. Both pages render ` +
					`the brand/title header inside a Card — if that changed, re-derive ` +
					`this guard rather than deleting it.`,
			).toBeGreaterThan(0);

			for (const header of headers) {
				const classes = classesOf(header);
				for (const token of [
					...HIDE_TOKENS,
					"mobile:hidden",
					"max-mobile:hidden",
				]) {
					expect(
						classes,
						`${name}: the CardHeader carries \`${token}\`. The message ` +
							`replaces the FORM, not the card it sits in.`,
					).not.toContain(token);
				}
			}
		});
	});
}

describe("sign-in-device-gate::both-pages-carry-the-identical-message", () => {
	it("sign-in-device-gate::the-two-pages-do-not-drift-apart", () => {
		// One ratified string, two surfaces. Read from the rendered DOM on both,
		// so a copy edit on one page and not the other is caught here rather than
		// by a reader on a phone.
		render(<SignInPage />);
		const onSignIn = screen.getByTestId(MESSAGE_TESTID).textContent;
		cleanup();

		render(<OtpPage />);
		const onOtp = screen.getByTestId(MESSAGE_TESTID).textContent;

		expect(onSignIn).toBe(MESSAGE);
		expect(onOtp).toBe(MESSAGE);
		expect(onOtp).toBe(onSignIn);
	});
});

describe("sign-in-device-gate::the-two-headers-differ-because-they-say-different-things", () => {
	// ⛔⛔ THE ASYMMETRY IS THE POINT, AND IT IS NOT AN INCONSISTENCY.
	// `header-stays-at-every-width` above passes on BOTH pages because it reads
	// the `card-header` BOX. What differs is what that box CONTAINS.
	//
	// `/sign-in`'s header is a brand lockup — a mark plus an `sr-only` name. It
	// is not part of what the gate refuses, so it stays whole.
	//
	// `/sign-in/otp`'s header is an INSTRUCTION. Left visible it renders
	// "Enter your verification code" / "Check your email for a 6-digit code"
	// directly above "Sign-up only works on a computer right now." — telling a
	// blocked visitor to do the thing the same card just refused. That is the
	// identical argument the page already applies to the code FIELD, one element
	// up, and it was caught in review rather than by a reader on a phone.
	//
	// Minted with the fix so the fix cannot silently regress: without this row,
	// restoring the contradiction reddens nothing.

	it("sign-in-device-gate::the-sign-in-brand-lockup-survives-the-gate", () => {
		const { container } = render(<SignInPage />);
		const title = container.querySelector('[data-slot="card-title"]');
		const mark = container.querySelector('img[src="/brand/zugzwang-mark.svg"]');
		if (!title || !mark) {
			throw new Error(
				"/sign-in: no card-title or brand mark found. The header is the " +
					"reason this page's trio is NOT hidden — re-derive this guard.",
			);
		}
		for (const el of [title, mark]) {
			for (const token of HIDE_TOKENS) {
				expect(
					classesOf(el),
					`/sign-in: the brand lockup carries \`${token}\`. A card whose form ` +
						`is hidden is still a named card; one with no name is worse.`,
				).not.toContain(token);
			}
		}
	});

	it("sign-in-device-gate::the-otp-instructional-trio-hides-with-the-form", () => {
		const { container } = render(<OtpPage />);

		const title = container.querySelector('[data-slot="card-title"]');
		const description = container.querySelector(
			'[data-slot="card-description"]',
		);
		if (!title || !description) {
			throw new Error(
				"/sign-in/otp: no card-title or card-description found. Those two ARE " +
					"the instruction this row exists to keep off a blocked device — " +
					"re-derive the guard rather than deleting it.",
			);
		}

		for (const el of [title, description]) {
			for (const token of HIDE_TOKENS) {
				expect(
					classesOf(el),
					`/sign-in/otp: \`${el.getAttribute("data-slot")}\` does not carry ` +
						`\`${token}\`, so it renders above the "computer only" message — ` +
						`an instruction the same card refuses to let anyone follow.`,
				).toContain(token);
			}
		}

		// ⛔ AND THE WAY OUT STAYS. The back link is not an instruction to do
		// anything impossible, and it is the only exit from this route that is
		// not browser chrome.
		const back = container.querySelector('a[href="/sign-in"]');
		if (!back) {
			throw new Error("/sign-in/otp: the `Back to sign in` link is gone.");
		}
		for (const token of HIDE_TOKENS) {
			expect(
				classesOf(back),
				`/sign-in/otp: the back link carries \`${token}\`, leaving a blocked ` +
					`visitor on a dead-end route with no in-app way off it.`,
			).not.toContain(token);
		}
	});
});
