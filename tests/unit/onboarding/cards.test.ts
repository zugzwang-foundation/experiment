// SPDX-License-Identifier: AGPL-3.0-or-later

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { ONBOARDING_CARDS, reshowCards } from "@/components/onboarding/cards";

/**
 * O1-DECK — SPEC.1 §17 rows 7 and 9.
 *
 * Both are properties of the CARD MODULE rather than of any render, so they
 * are asserted against it directly (SPEC.1 §21.9 Acceptance). Row 9 in
 * particular cannot be a render assertion: a rendered "Step 1 of 7" passes
 * against a hard-coded `7` on a seven-card array, which is precisely the
 * defect the row exists to forbid. The strongest available form is an arity
 * assertion plus a source scan of the stepper.
 */

const DECK_SOURCE = join(
	process.cwd(),
	"src/components/onboarding/OnboardingDeck.tsx",
);

describe("O1-DECK — the card set", () => {
	it("onboarding-deck::reshow-omits-welcome-card", () => {
		const full = ONBOARDING_CARDS;
		const reshow = reshowCards();

		// Exactly one card is dropped, and it is the WELCOME card.
		expect(reshow.length).toBe(full.length - 1);
		expect(full.filter((c) => c.eyebrow === "WELCOME").length).toBe(1);
		expect(reshow.filter((c) => c.eyebrow === "WELCOME").length).toBe(0);

		// ONE ARRAY, ONE FILTER — not two arrays, which drift (copy register §3).
		// The surviving cards keep their order AND their identity: a re-show
		// built by re-declaring six cards would pass a length check and fail
		// this one.
		expect(reshow).toEqual(full.filter((c) => c.eyebrow !== "WELCOME"));

		// The pseudonym interpolation is the WELCOME card's alone, so the
		// re-show has no viewer dependency at all — that is what makes it safe
		// to mount for a signed-out visitor on `/sign-in` (plan Q5).
		// `?? ""` covers Card 1's withdrawn title (O1-DECK-R2) without weakening
		// the claim: a card with no title string cannot carry the token, and
		// every card that HAS one is still checked for it.
		expect(reshow.some((c) => (c.title ?? "").includes("{pseudonym}"))).toBe(
			false,
		);
	});

	it("onboarding-deck::step-count-derives-from-array", () => {
		// Arity: change the array and the counts follow. Seven on first login,
		// six on the re-show (copy register §3).
		expect(ONBOARDING_CARDS.length).toBe(7);
		expect(reshowCards().length).toBe(6);

		const source = readFileSync(DECK_SOURCE, "utf8");

		// The stepper reads the array. `N = CARDS.length` is what the mockup
		// already does correctly and what the build inherits.
		expect(source).toMatch(/\.length\b/);

		// ⛔ AND NO LITERAL COUNT ANYWHERE IN THE STEPPER. The copy register is
		// explicit: "A literal `7` or `6` anywhere in the stepper is a defect."
		// Matching `of <n>` rather than a bare digit keeps the scan off the
		// arbitrary Tailwind sizes (`text-[9px]`, `p-[13px]`) that legitimately
		// carry numbers in this file.
		expect(source).not.toMatch(/\bof\s+\d+\b/);
	});
});
