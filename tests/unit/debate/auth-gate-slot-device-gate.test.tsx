// @vitest-environment jsdom

import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { AuthGateSlot } from "@/components/debate/composer/AuthGateSlot";
import { AUTH_GATE_COPY } from "@/components/debate/composer/copy";

/**
 * MOBILE-1 · Phase B — THE DEBATE COMPOSER'S AUTH-GATE SLOT LOSES ITS TWO
 * ACTIONS ON A PHONE AND ON ANY TOUCH-PRIMARY DEVICE.
 *
 * WHAT THIS PROVES, AND WHERE IT COMES FROM. `docs/plans/MOBILE-1.md` §4
 * "Client-side CTA hides (Phase B)", surface 2 of 3, fenced by JSX element
 * rather than by the ADR's now-stale line citations: "[AuthGateSlot.tsx] — the
 * two `<Button>` elements wrapping `AUTH_GATE_COPY.signUp` / `.signIn`". Both
 * independent hide conditions apply, exactly as on the global JOIN CTA:
 * `max-mobile:hidden` (Phase A's 640px phone-width rule) AND
 * `touch-primary:hidden` (the new, viewport-width-independent
 * `(hover: none) and (pointer: coarse)` rule).
 *
 * ⛔ THE ACTIONS GO; THE EXPLANATION STAYS — AND THAT LEAVES AN ACTIONLESS
 * PANEL ON MOBILE. This is a KNOWN, FLAGGED WART and it is deliberately NOT
 * fixed here. The plan scopes the "computer only" message copy to the two
 * sign-in pages alone (Decisions received #5: the exact string
 * "Sign-up only works on a computer right now." belongs to `sign-in/page.tsx`
 * and `sign-in/otp/page.tsx`), and CLAUDE.md §3 forbids inventing
 * participant-facing copy — so writing a mobile variant of `AUTH_GATE_COPY`
 * here would be minting founder copy a subagent has no authority to mint. The
 * heading, body and micro line therefore keep rendering below the breakpoint,
 * explaining a thing the reader can no longer act on. Recorded here so a later
 * reader finds a decision rather than an oversight.
 *
 * ⚠ jsdom RESOLVES NO MEDIA QUERY AND PERFORMS NO LAYOUT (AGENTS.md §9) — the
 * CLASS BINDING is the assertion. The compiled variant's actual match
 * condition is a `globals.css` source scan
 * (`tests/unit/design/touch-primary-variant.test.ts`) plus a browser
 * measurement.
 *
 * ⚠ NO jest-dom (AGENTS.md §9) — plain DOM only.
 *
 * ⚠ THE ABSENCE ROW CARRIES ITS OWN POSITIVE CONTROL, IN THE SAME TEST: "the
 * heading does not carry these classes" is vacuously true of a tree where
 * nothing carries them, which is today's tree.
 *
 * ⚠ TDD DRIVER, NOT A `_probe-*` REGRESSION GUARD (CLAUDE.md §5.6).
 */

afterEach(cleanup);

const WIDTH_HIDE = "max-mobile:hidden";
const TOUCH_HIDE = "touch-primary:hidden";
const BOTH = [WIDTH_HIDE, TOUCH_HIDE] as const;

function classesOf(el: Element): string[] {
	return (el.getAttribute("class") ?? "").split(/\s+/).filter(Boolean);
}

function renderSlot() {
	return render(<AuthGateSlot side="YES" onClose={() => {}} />);
}

/**
 * The element WRAPPING the two action links — located structurally (the shared
 * parent of both `/sign-in` anchors) rather than by a class string, so the
 * lookup cannot drift with the very className this file asserts on.
 */
function actionsWrapper(container: HTMLElement): HTMLElement {
	const links = [
		...container.querySelectorAll<HTMLElement>('a[href="/sign-in"]'),
	];
	if (links.length !== 2) {
		throw new Error(
			`AuthGateSlot no longer renders exactly two \`a[href="/sign-in"]\` ` +
				`actions (found ${links.length}). Those two ARE the CTA pair this ` +
				`gate hides — re-derive this guard rather than deleting it.`,
		);
	}
	const [first, second] = links;
	const parent = first?.parentElement;
	if (!parent || parent !== second?.parentElement) {
		throw new Error(
			"AuthGateSlot's two actions no longer share one parent element. The " +
				"hide belongs on the single wrapper that holds both; two separate " +
				"wrappers are two class strings that can drift apart.",
		);
	}
	return parent;
}

describe("auth-gate-slot-device-gate::the-two-actions", () => {
	it("auth-gate-slot-device-gate::the-actions-wrapper-carries-BOTH-hide-conditions", () => {
		const { container } = renderSlot();
		const wrapper = actionsWrapper(container);
		const classes = classesOf(wrapper);

		expect(
			classes,
			`the Sign up / Sign in action wrapper does not carry \`${WIDTH_HIDE}\` ` +
				`(MOBILE-1 §4 condition 1, the 640px phone-width rule).`,
		).toContain(WIDTH_HIDE);
		expect(
			classes,
			`the Sign up / Sign in action wrapper does not carry \`${TOUCH_HIDE}\` ` +
				`(MOBILE-1 §4 condition 2, the width-independent touch-primary rule — ` +
				`the only deterrent that reaches a default-mode iPad, which the ` +
				`server-side gate cannot see at all).`,
		).toContain(TOUCH_HIDE);

		// ⛔ ONE WRAPPER, and the actions still exist inside it. A "hide" that
		// removed the pair outright would pass a class assertion on nothing at
		// all — and would also break the desktop surface it must not touch.
		const links = [...wrapper.querySelectorAll('a[href="/sign-in"]')];
		expect(links.length).toBe(2);
		expect(links.map((a) => a.textContent)).toEqual([
			AUTH_GATE_COPY.signUp,
			AUTH_GATE_COPY.signIn,
		]);
	});
});

describe("auth-gate-slot-device-gate::the-explanatory-copy-stays", () => {
	it("auth-gate-slot-device-gate::heading-body-and-micro-carry-NEITHER-token", () => {
		const { container } = renderSlot();

		// CONTROL: the tokens are findable, by this exact reading method, on the
		// element that is supposed to carry them. Without it, "the heading does
		// not carry them" and "nothing carries them" are the same green.
		const wrapperClasses = classesOf(actionsWrapper(container));
		for (const token of BOTH) {
			expect(
				wrapperClasses,
				`CONTROL FAILED: the action wrapper does not carry \`${token}\`, so ` +
					`the absence assertions below proved nothing. Fix the wrapper hide ` +
					`first (MOBILE-1 §4), then re-read the negatives.`,
			).toContain(token);
		}

		const heading = container.querySelector("h3");
		const body = container.querySelector("p");
		if (!heading || !body) {
			throw new Error(
				"AuthGateSlot no longer renders its <h3> heading and <p> body — " +
					"re-derive this guard against the current copy surface.",
			);
		}
		const micro = [...container.querySelectorAll("div")].find(
			(el) => el.textContent === AUTH_GATE_COPY.micro,
		);
		if (!micro) {
			throw new Error(
				`AuthGateSlot no longer renders its micro line ` +
					`("${AUTH_GATE_COPY.micro}").`,
			);
		}

		// ⚠ THE ACTIONLESS PANEL IS THE ACCEPTED OUTCOME, NOT A BUG TO FIX HERE.
		// See this file's docblock: replacing this copy on mobile would mint
		// participant-facing copy, which is founder-owned (CLAUDE.md §3) and is
		// scoped by the plan to the two sign-in pages only (Decisions #5).
		for (const [name, el] of [
			["heading", heading],
			["body", body],
			["micro", micro],
		] as const) {
			for (const token of BOTH) {
				expect(
					classesOf(el),
					`AuthGateSlot's ${name} carries \`${token}\`. MOBILE-1 §4 hides the ` +
						`two ACTIONS on this surface and nothing else — the explanatory ` +
						`copy keeps rendering below the breakpoint. Hiding it here would ` +
						`be a copy decision, and copy is founder-owned (CLAUDE.md §3).`,
				).not.toContain(token);
			}
		}

		// …and the copy is still the copy it was.
		expect(heading.textContent).toBe(AUTH_GATE_COPY.heading("YES"));
		expect(body.textContent).toBe(AUTH_GATE_COPY.body);
	});

	it("auth-gate-slot-device-gate::the-section-root-carries-NEITHER-token", () => {
		// ⛔ THE ONE-CHARACTER VERSION OF THIS CHANGE THAT LOOKS IDENTICAL IN A
		// DIFF: putting the hide on the `<section>` instead of the inner wrapper
		// removes the whole panel, so a signed-out phone reader clicking `Đ BET`
		// gets an empty slot with no explanation at all — a worse outcome than
		// the accepted actionless panel, and invisible to every assertion above.
		const { container } = renderSlot();

		const wrapperClasses = classesOf(actionsWrapper(container));
		for (const token of BOTH) {
			expect(
				wrapperClasses,
				`CONTROL FAILED: the action wrapper does not carry \`${token}\`.`,
			).toContain(token);
		}

		const section = container.querySelector("section");
		if (!section) {
			throw new Error("AuthGateSlot no longer renders a <section> root.");
		}
		for (const token of BOTH) {
			expect(
				classesOf(section),
				`AuthGateSlot's <section> root carries \`${token}\`, so the entire ` +
					`auth-gate panel disappears below the breakpoint. The hide belongs ` +
					`on the wrapper around the two actions (MOBILE-1 §4).`,
			).not.toContain(token);
		}
	});
});
