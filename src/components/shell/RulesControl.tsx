"use client";

import { useState } from "react";

import { OnboardingDeck } from "@/components/onboarding/OnboardingDeck";

/**
 * The header's `RULES` control, and the re-show deck it opens (SPEC.1 §21.9).
 *
 * WHY THE DECK IS RENDERED HERE AND NOT BESIDE THE LAYOUT'S. The button and the
 * dialog have to share one piece of state, and a control that opened a dialog
 * mounted by a sibling layout would need a context provider or a store to reach
 * it. Owning both is the smaller answer, and it buys two things that are not
 * merely tidy:
 *
 *   · `GlobalHeader` already mounts in the `(auth)` layout, so the control
 *     reaches `/sign-in`, `/sign-in/otp` and `/onboarding` with no second mount
 *     point and no edit to that layout at all. §21.9 is unconditional — the
 *     control "is present for every viewer, authenticated or not" — and a
 *     signed-out visitor on `/sign-in` is precisely the person with the most
 *     reason to ask what the rules are before creating an account.
 *   · ⛔ IT MAKES THE `(auth)` SAFETY STRUCTURAL. This component reads no
 *     cookie, renders no gate, and does not import
 *     `completeOnboardingDeckAction`. A non-dismissible modal over `/sign-in`
 *     would trap someone inside the sign-in page, and a marker written from a
 *     signed-out visit would suppress that person's own first-login deck once
 *     they signed up. Neither is prevented by remembering not to do it: there
 *     is no import here that could.
 *
 * ⚠ IT OPENS A MODAL RATHER THAN NAVIGATING, because there is nowhere to
 * navigate to. §21.6 keeps the feature-guide page deferred and §21.9 calls the
 * deck "a modal card sequence… not a route and not a page", so minting a
 * `/rules` route to hang this off would contradict both.
 *
 * ⚠ PLACED IN THE LEFT ZONE, AFTER RADIO — a named tier-4 deviation from the
 * locked mockup, which puts the tab in the centre zone beside the wordmark.
 * The reason is measured and is recorded in `GlobalHeader`'s own deviation
 * register: the mockup's placement moves the brand cluster 41.57px off true
 * centre, and the left zone costs 0.00px.
 */

/**
 * The mockup's `.tab` composition — 13px x-padding, 12px/700/.1em uppercase —
 * on the repo's 34px control register and in the left zone's own idiom, so it
 * reads as a sibling of Back, Home and Radio rather than as an import. The
 * mockup is the LIGHT-theme prototype, so its colours are matched BY ROLE and
 * never by lightness: this build's ramp is inverted against that one.
 */
const RULES_TAB =
	"inline-flex h-[34px] shrink-0 items-center rounded-(--r) bg-(--btn-fill) px-[13px] text-[12px] leading-[1.2] font-bold tracking-[0.1em] text-ink uppercase outline-none select-none [border:var(--hairline)] [transition:all_var(--dur-hover)] hover:[border:1px_solid_var(--ring)] active:bg-(--state-pressed-fill) focus-visible:shadow-(--state-focus-ring)";

export function RulesControl() {
	const [open, setOpen] = useState(false);

	return (
		<>
			<button
				type="button"
				onClick={() => setOpen(true)}
				title="Rules — how it works"
				className={RULES_TAB}
			>
				Rules
			</button>
			<OnboardingDeck context="reshow" open={open} onOpenChange={setOpen} />
		</>
	);
}
