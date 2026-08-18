// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ONBOARDING_CARDS, reshowCards } from "@/components/onboarding/cards";
import { OnboardingDeck } from "@/components/onboarding/OnboardingDeck";

/**
 * O1-DECK — SPEC.1 §17 rows 4, 5, 6 and 8: the two dismissal policies and the
 * completion call. These four ARE render assertions — the behaviour under test
 * is what the DOM does to a keystroke and a click — so they run under jsdom,
 * per SPEC.1 §21.9's Acceptance paragraph.
 *
 * ⛔ NO `jest-dom` IN THIS REPO (AGENTS.md §9). `toBeInTheDocument()` and
 * `toBeDisabled()` are unavailable; every assertion below is plain DOM.
 *
 * ⚠ RADIX PORTALS TO `document.body`, so the deck is NOT inside `render()`'s
 * container and every query here goes through `document.body`. A query scoped
 * to the container would find nothing and read as "the deck did not render".
 *
 * ⚠ EVERY "DOES NOT CLOSE" ASSERTION IS PAIRED WITH A POSITIVE CONTROL in the
 * re-show block below. A dismissal that jsdom cannot trigger at all would make
 * the first-login assertions pass without the guard clauses being present —
 * a test structurally incapable of failing reads as a receipt. The re-show
 * proves the mechanism fires; the first-login block then proves it is refused.
 */

afterEach(cleanup);

const content = () =>
	document.body.querySelector('[data-slot="dialog-content"]');
const closeControl = () =>
	document.body.querySelector('[data-slot="dialog-close"]');
const overlay = () =>
	document.body.querySelector('[data-slot="dialog-overlay"]');
const nextButton = () => {
	const el = document.body.querySelector('[data-slot="onboarding-next"]');
	if (!(el instanceof HTMLButtonElement)) {
		throw new Error("the deck's Next control is not a <button>");
	}
	return el;
};
const backButton = () => {
	const el = document.body.querySelector('[data-slot="onboarding-back"]');
	if (!(el instanceof HTMLButtonElement)) {
		throw new Error("the deck's Back control is not a <button>");
	}
	return el;
};
const activeCard = () =>
	document.body.querySelector(
		'[data-slot="onboarding-card"][data-active="true"]',
	);

/** Walk forward to the final card by pressing Next, deriving the count. */
function advanceToFinalCard(cardCount: number): void {
	for (let i = 0; i < cardCount - 1; i++) {
		fireEvent.click(nextButton());
	}
}

describe("O1-DECK — first login: the deck cannot be dismissed", () => {
	it("onboarding-deck::first-login-has-no-dismissal", () => {
		render(
			<OnboardingDeck
				context="first-login"
				initialOpen
				pseudonym="umber-falcon-31"
			/>,
		);

		expect(content()).not.toBeNull();

		// 1 · NO CLOSE CONTROL IN THE DOM — absent, not hidden.
		// `showCloseButton={false}` removes the node entirely (ui/dialog.tsx:67),
		// which is what §21.9's "no close control" asks for literally.
		expect(closeControl()).toBeNull();

		// 2 · ESCAPE IS INERT. The handler stays BOUND and refuses to act —
		// `onEscapeKeyDown` + `preventDefault()`, which is the typed version of
		// the locked W2.1 shell's own guard rather than a removal.
		fireEvent.keyDown(document, { key: "Escape" });
		expect(content()).not.toBeNull();

		// 3 · THE BACKDROP IS INERT, same mechanism via `onInteractOutside`.
		const backdrop = overlay();
		expect(backdrop, "the dialog renders an overlay").not.toBeNull();
		if (backdrop) {
			fireEvent.pointerDown(backdrop);
			fireEvent.mouseDown(backdrop);
			fireEvent.click(backdrop);
		}
		expect(content()).not.toBeNull();
	});

	it("onboarding-deck::marker-not-written-on-open", () => {
		const onComplete = vi.fn();
		render(
			<OnboardingDeck
				context="first-login"
				initialOpen
				pseudonym="umber-falcon-31"
				onComplete={onComplete}
			/>,
		);

		// Opening writes nothing. ADR-0037: the marker is written when the
		// participant reaches the END of the deck, never when it opens — which
		// is what makes abandonment safe by construction.
		expect(onComplete).not.toHaveBeenCalled();

		// And still nothing after moving through the deck but stopping short.
		fireEvent.click(nextButton());
		fireEvent.click(nextButton());
		expect(onComplete).not.toHaveBeenCalled();
		expect(content()).not.toBeNull();
	});

	it("onboarding-deck::first-login-final-card-closes", () => {
		const onComplete = vi.fn();
		render(
			<OnboardingDeck
				context="first-login"
				initialOpen
				pseudonym="umber-falcon-31"
				onComplete={onComplete}
			/>,
		);

		// Back is disabled on the first card — the deck is forward-only into the
		// sequence, and there is nothing behind card 1.
		expect(backButton().disabled).toBe(true);

		advanceToFinalCard(ONBOARDING_CARDS.length);

		// The final-step label is the locked W2.1 shell's own first-login
		// variant. No new copy is authored for it.
		expect(nextButton().textContent).toBe("Enter Zugzwang");

		fireEvent.click(nextButton());

		// Closes optimistically on the client AND fires the completion once.
		expect(content()).toBeNull();
		expect(onComplete).toHaveBeenCalledTimes(1);
	});
});

describe("O1-DECK — the re-show: dismissible at every card", () => {
	it("onboarding-deck::reshow-is-dismissible", () => {
		const onOpenChange = vi.fn();
		render(
			<OnboardingDeck
				context="reshow"
				initialOpen
				onOpenChange={onOpenChange}
			/>,
		);

		// THE POSITIVE CONTROL FOR ASSERTION 1 ABOVE: here the close control IS
		// in the DOM, so its absence on first login is a property of the deck's
		// context rather than of the harness.
		expect(closeControl()).not.toBeNull();

		// THE POSITIVE CONTROL FOR ASSERTION 2: Escape actually closes here, so
		// the first-login "Escape is inert" assertion is testing the guard and
		// not the absence of a working mechanism.
		fireEvent.keyDown(document, { key: "Escape" });
		expect(content()).toBeNull();
		// The controlled parent — `RulesControl` in production — is told.
		expect(onOpenChange).toHaveBeenCalledWith(false);
	});

	it("escape closes the re-show at a LATER card index too, not only the first", () => {
		render(<OnboardingDeck context="reshow" initialOpen />);

		fireEvent.click(nextButton());
		fireEvent.click(nextButton());
		expect(content()).not.toBeNull();

		fireEvent.keyDown(document, { key: "Escape" });
		expect(content()).toBeNull();
	});

	it("the re-show's backdrop closes it (positive control for assertion 3)", () => {
		render(<OnboardingDeck context="reshow" initialOpen />);

		const backdrop = overlay();
		expect(backdrop).not.toBeNull();
		if (backdrop) {
			fireEvent.pointerDown(backdrop);
			fireEvent.mouseDown(backdrop);
			fireEvent.click(backdrop);
		}
		expect(content()).toBeNull();
	});

	it("omits the WELCOME card and derives its own step count", () => {
		render(<OnboardingDeck context="reshow" initialOpen />);

		const step = document.body.querySelector('[data-slot="onboarding-step"]');
		expect(step?.textContent).toBe(`Step 1 of ${reshowCards().length}`);
		expect(activeCard()?.textContent).not.toContain("WELCOME");
	});

	it("D-4 — the re-show NEVER writes the marker, even handed a completion", () => {
		// ⛔ In production `RulesControl` does not pass `onComplete` at all and
		// does not import the action, so D-4 is a compile-time fact rather than a
		// runtime branch. This asserts the STRONGER property: even when the
		// completion is handed to it, the re-show context refuses to call it —
		// so a future edit that wires the prop through still cannot write the
		// marker from a signed-out `/sign-in` visit.
		const onComplete = vi.fn();
		render(
			<OnboardingDeck context="reshow" initialOpen onComplete={onComplete} />,
		);

		advanceToFinalCard(reshowCards().length);

		// The re-show's final-step label, carried by the locked W2.1 shell.
		expect(nextButton().textContent).toBe("Done");

		fireEvent.click(nextButton());

		expect(content()).toBeNull();
		expect(onComplete).not.toHaveBeenCalled();
	});
});
