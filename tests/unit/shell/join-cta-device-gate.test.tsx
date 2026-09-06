// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { IdentityCluster } from "@/components/shell/IdentityCluster";

/**
 * MOBILE-1 · Phase B — THE GLOBAL JOIN CTA HIDES ON A PHONE AND ON ANY
 * TOUCH-PRIMARY DEVICE; THE SIGNED-IN IDENTITY CHIP DOES NOT.
 *
 * WHAT THIS PROVES, AND WHERE IT COMES FROM. `docs/plans/MOBILE-1.md` §4
 * "Client-side CTA hides (Phase B)" names three CTA surfaces and TWO
 * INDEPENDENT hide conditions applied to each — `max-mobile:hidden` (the 640px
 * phone-width rule minted in Phase A) AND `touch-primary:hidden` (a new,
 * viewport-width-INDEPENDENT rule keyed on `(hover: none) and (pointer:
 * coarse)`). This file covers the first of the three surfaces:
 * `IdentityCluster.tsx`'s `<Link href="/sign-in">` JOIN button inside the
 * `if (!viewer)` branch — ADR-0045's "global JOIN, mounted via `GlobalHeader`
 * on every route".
 *
 * ⛔⛔ THE NEGATIVE IS THE LOAD-BEARING HALF. A SIGNED-IN MOBILE PARTICIPANT
 * KEEPS THEIR IDENTITY AFFORDANCE. ADR-0045 and the plan gate JOIN/LOGIN, and
 * nothing else: plan §3 "Scope" is explicit that "a signed-in mobile session —
 * whether pre-dating this feature or established via a spoofed/desktop-mode UA
 * — is therefore UNAFFECTED", and §6 "Existing/pre-existing mobile sessions:
 * completely unaffected". Hiding the identity chip would take a real
 * participant's link to their own profile away on their own phone, for a gate
 * that was never about them. The two chip branches must carry NEITHER token.
 *
 * ⛔ AND THE HIDE IS DELIBERATELY **UNGATED** BY `mobileResponsive` — DO NOT
 * ADD THE PROP HERE. Phase A's rule (ADR-0045: auth/join surfaces are "gated,
 * not made responsive") is what the `mobileResponsive` prop chain enforces for
 * REFLOW classes, which must not reach `(auth)`. This hide is not a reflow —
 * it IS the gate, and ADR-0045 wants it on every route, `(public)` and `(auth)`
 * alike, because `GlobalHeader` mounts `IdentityCluster` on both. Conditioning
 * it on the prop would leave the JOIN button visible on `/sign-in` at phone
 * width, i.e. exactly where a blocked device is sent. The Phase A guard
 * `tests/unit/shell/global-header-mobile-reflow.test.ts` records the same
 * ruling from the opposite side.
 *
 * ⚠ jsdom RESOLVES NO MEDIA QUERY AND PERFORMS NO LAYOUT (AGENTS.md §9), so
 * "hidden below 640px" is not observable here — the CLASS BINDING is the
 * assertion, exactly as `identity-cluster-link.test.tsx`'s avatar-ring row
 * already reasons. Whether the compiled variant actually matches
 * `(hover: none) and (pointer: coarse)` is a browser measurement and a
 * `globals.css` source scan (`tests/unit/design/touch-primary-variant.test.ts`).
 *
 * ⚠ NO jest-dom (AGENTS.md §9) — plain DOM only: `getAttribute`, `textContent`,
 * `querySelector`.
 *
 * ⚠ EACH ABSENCE ASSERTION CARRIES ITS OWN POSITIVE CONTROL, IN THE SAME TEST.
 * "The chip does not carry these classes" is vacuously true of a tree where
 * nothing carries them — which is today's tree — so every negative row also
 * renders the signed-out branch and asserts the tokens ARE findable by the
 * identical reading method. If both halves fail, the tokens do not exist yet;
 * if only the negative fails, the hide leaked onto the chip. Same technique as
 * `tests/unit/art/art-layer-guards.test.ts`'s mount-scan control.
 *
 * ⚠ TDD DRIVER, NOT A `_probe-*` REGRESSION GUARD (CLAUDE.md §5.6).
 */

afterEach(cleanup);

/** The 640px phone-width rule, minted at Phase A (`--breakpoint-mobile`). */
const WIDTH_HIDE = "max-mobile:hidden";
/** The width-independent touch-primary rule, minted at Phase B. */
const TOUCH_HIDE = "touch-primary:hidden";
const BOTH = [WIDTH_HIDE, TOUCH_HIDE] as const;

const PSEUDONYM = "RedFox001";
const PFP = "/pfp-placeholder.svg";

/** The JOIN anchor, rendered fresh. Throws rather than returning null. */
function renderJoinAnchor(): HTMLElement {
	const { container } = render(<IdentityCluster viewer={null} />);
	const join = container.querySelector<HTMLElement>('a[href="/sign-in"]');
	if (!join) {
		throw new Error(
			"IdentityCluster's signed-out branch no longer renders an " +
				'`a[href="/sign-in"]`. That anchor IS the JOIN CTA this gate hides — ' +
				"re-derive this guard against whatever replaced it rather than " +
				"deleting it.",
		);
	}
	return join;
}

function classesOf(el: Element): string[] {
	return (el.getAttribute("class") ?? "").split(/\s+/).filter(Boolean);
}

/**
 * The control every absence row runs: the tokens are findable, by this exact
 * reading method, on the element that is supposed to carry them.
 */
function expectTokensAreFindable(): void {
	const classes = classesOf(renderJoinAnchor());
	for (const token of BOTH) {
		expect(
			classes,
			`CONTROL FAILED: the JOIN anchor does not carry \`${token}\`, so the ` +
				`absence assertion in this test proved nothing — nothing in this ` +
				`component carries the token for it to be absent from. Fix the JOIN ` +
				`hide first (MOBILE-1 §4), then re-read the negative.`,
		).toContain(token);
	}
	cleanup();
}

describe("join-cta-device-gate::the-signed-out-JOIN-button", () => {
	it("join-cta-device-gate::JOIN-carries-BOTH-hide-conditions", () => {
		const join = renderJoinAnchor();
		const classes = classesOf(join);

		// ⛔ BOTH, ALWAYS. Plan §4 mints two INDEPENDENT conditions and the
		// second is not redundant: for the default-mode iPad — the majority of
		// real iPad traffic — the server-side layer provides no enforcement at
		// all (plan §3 "Consequence", Self-critique #1, rated HIGH), so
		// `touch-primary:hidden` is not a cosmetic backup on top of a working
		// server check. It is the ONLY layer for that device class.
		expect(
			classes,
			`the JOIN CTA does not carry \`${WIDTH_HIDE}\`. This is Phase A's ` +
				`640px phone-width rule (MOBILE-1 §4 condition 1).`,
		).toContain(WIDTH_HIDE);
		expect(
			classes,
			`the JOIN CTA does not carry \`${TOUCH_HIDE}\`. This is the ` +
				`viewport-width-INDEPENDENT touch-primary rule (MOBILE-1 §4 ` +
				`condition 2) — the only deterrent that reaches a default-mode iPad, ` +
				`which the server-side gate cannot see at all.`,
		).toContain(TOUCH_HIDE);

		// The CTA is otherwise untouched: still the JOIN link to /sign-in, still
		// carrying its label. A hide that quietly became a removal would pass a
		// class assertion and fail every real user.
		expect(join.tagName).toBe("A");
		expect(join.textContent).toBe("JOIN");
	});

	it("join-cta-device-gate::the-hide-is-UNGATED-no-mobileResponsive-prop", () => {
		// ⛔ `IdentityCluster` takes exactly one prop — `viewer`. It must not grow
		// a `mobileResponsive` gate: `GlobalHeader` mounts it on `(public)` AND
		// `(auth)`, and a gated hide would leave JOIN visible at phone width on
		// `/sign-in` — the page a blocked device is redirected to. This asserts
		// the rendered result is prop-free by rendering with `viewer` alone and
		// requiring the tokens anyway.
		const classes = classesOf(renderJoinAnchor());
		expect(classes).toContain(WIDTH_HIDE);
		expect(classes).toContain(TOUCH_HIDE);
	});
});

describe("join-cta-device-gate::the-signed-in-identity-chip-is-untouched", () => {
	it("join-cta-device-gate::the-chip-link-carries-NEITHER-token", () => {
		// ⛔⛔ THE LOAD-BEARING NEGATIVE. A signed-in mobile participant keeps
		// their identity affordance — the chip is their link to their own
		// `/u/[pseudonym]`. Plan §3/§6: existing mobile sessions are "completely
		// unaffected"; the gate only blocks NEW sign-in attempts.
		expectTokensAreFindable();

		render(<IdentityCluster viewer={{ pseudonym: PSEUDONYM, pfpUrl: PFP }} />);
		const chip = screen.getByTestId("identity-chip-link");
		const classes = classesOf(chip);

		for (const token of BOTH) {
			expect(
				classes,
				`the signed-in identity chip carries \`${token}\`. ADR-0045 and ` +
					`MOBILE-1 §4 gate the JOIN/LOGIN CTAs and nothing else — a ` +
					`participant who signed in on a computer and opens the site on ` +
					`their phone must keep their own identity link. Move the hide back ` +
					`inside the \`if (!viewer)\` branch.`,
			).not.toContain(token);
		}

		// …and the chip is still the chip: an anchor onto the viewer's own
		// profile, carrying the pseudonym.
		expect(chip.getAttribute("href")).toBe(`/u/${PSEUDONYM}`);
		expect(chip.textContent).toContain(PSEUDONYM);
	});

	it("join-cta-device-gate::the-null-pseudonym-chip-carries-NEITHER-token", () => {
		// The `identity-cluster-link.test.tsx` edge: a null pseudonym keeps the
		// NON-LINKED chip (no profile URL exists). It is still identity, still
		// not a CTA, and still must not hide.
		expectTokensAreFindable();

		const { container } = render(
			<IdentityCluster viewer={{ pseudonym: null, pfpUrl: PFP }} />,
		);
		const chip = container.firstElementChild;
		if (!chip) {
			throw new Error(
				"IdentityCluster's null-pseudonym branch rendered nothing. It is a " +
					"chip, not an empty branch — see identity-cluster-link.test.tsx.",
			);
		}
		expect(chip.tagName).not.toBe("A");

		for (const token of BOTH) {
			expect(
				classesOf(chip),
				`the null-pseudonym identity chip carries \`${token}\`. Only the ` +
					`\`if (!viewer)\` JOIN branch is gated (MOBILE-1 §4).`,
			).not.toContain(token);
		}
	});
});
