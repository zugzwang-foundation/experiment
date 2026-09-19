"use client";

import { useState } from "react";

import { OnboardingDeck } from "@/components/onboarding/OnboardingDeck";
import { HEADER_GLOSSARY } from "@/lib/copy/glossary";
import { cn } from "@/lib/utils";

import { HEADER_PILL_BUTTON } from "./header-control";

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
 * ⛔⛔ PLACED FIRST IN THE **RIGHT** ZONE SINCE MKT-ROSTER-1-P3 — FOUNDER-RULED,
 * AND THIS PARAGRAPH SAID "LEFT ZONE, AFTER RADIO" UNTIL THEN. The control now
 * opens the identity side: `RULES · Đ cluster · avatar` signed in, `RULES ·
 * JOIN` signed out. The tier-4 deviation it recorded is unchanged in substance
 * — the tab is still NOT in the centre zone beside the wordmark, which is where
 * the locked mockup puts it, and the measured reason still holds (the mockup's
 * placement moves the brand cluster 41.57px off true centre). What changed is
 * which side zone hosts it.
 *
 * ⚠ THE PHONE ROW ORDER MOVES WITH IT, AND THAT SUPERSEDES ADR-0051 A13 D-1.
 * That decision rules the sub-640 row `home · rules · logo · countdown ·
 * identity`; RULES now lands between the countdown and identity, because below
 * 640 the LEFT zone flattens to `contents` and the right zone does not. §21.9
 * is untouched — the control renders at every width, on every route, for every
 * viewer, and is not inside any hidden wrapper. Only its position moved.
 */

/**
 * The mockup's `.tab` composition — 13px x-padding, 12px/700/.1em uppercase —
 * on the repo's 34px control register. The mockup is the LIGHT-theme prototype,
 * so its colours are matched BY ROLE and never by lightness: this build's ramp
 * is inverted against that one.
 *
 * ⚠ MKT-ROSTER-1-P3 — THE REGISTER MOVED OUT OF THIS FILE AND THE ALIAS STAYS,
 * exactly as `HeaderNav`'s `ICON_BUTTON` did at MOBILE-2n. `header-control.ts`
 * owns the string now, because the X link wears the same pill and "the same
 * pill" has to be one literal to stay true. The value is byte-identical, which
 * is what keeps RULES unmoved at 1440 through a task that also relocates it.
 */
const RULES_TAB = HEADER_PILL_BUTTON;

export function RulesControl({
	mobileResponsive = false,
}: {
	/**
	 * MOBILE-1 Phase A — passed straight through to `OnboardingDeck` and used
	 * for nothing else here. This component is the ONLY seam between the two
	 * `GlobalHeader` mounts and the deck: the chain
	 * `GlobalHeader → RulesControl → OnboardingDeck` is three static hops with
	 * no conditional, so a breakpoint class left unconditional in the deck
	 * reaches `/sign-in`, `/sign-in/otp` and `/onboarding` — which ADR-0045
	 * leaves gated rather than responsive. Threading the flag is what keeps the
	 * `(auth)` reach byte-identical; the deck cannot tell the two apart on its
	 * own, because `context="reshow"` is what BOTH groups pass.
	 */
	mobileResponsive?: boolean;
}) {
	const [open, setOpen] = useState(false);

	return (
		<>
			{/* INFO-1: NOT wired to `InfoTip`, measured rather than by default —
			    the only site in that task's wiring map this held true for.
			    Opening this button ALSO opens `OnboardingDeck` below, a Radix
			    `Dialog`; Dialog `aria-hide`s the rest of the page (including this
			    trigger) the instant it opens, which leaves the gloss no window to
			    coexist in — confirmed empirically: the popover never reaches an
			    open state on tap. The register string stays centralized here via
			    `title` rather than duplicated, and the modal itself explains the
			    product far more completely than a one-line gloss would, so a
			    touch user loses nothing real — they get the deck instead. */}
			{/* ⛔ ADR-0051 A13 D-4, rung four — the tab's side padding drops 3px
			    BELOW 640 ONLY, and it is the last lever the ladder reaches for
			    because RULES is the one control here that is neither an icon at a
			    fixed register nor a countdown whose cells are already at the floor.
			    ⚠ THIS CONTROL NOW CONSUMES THE PROP FOR ITSELF, WHICH IT DID NOT
			    BEFORE. Until A13 it took `mobileResponsive` only to hand on to
			    `OnboardingDeck` — `GlobalHeader`'s docblock said so in those words —
			    so a reader who remembers that sentence will find it changed there
			    too. The threading is unchanged; what is new is that this file is
			    also a consumer. */}
			<button
				type="button"
				onClick={() => setOpen(true)}
				title={HEADER_GLOSSARY.rules}
				/* ⚠ `mr-3.5` IS THE RIGHT ZONE'S OWN RHYTHM, NOT A NUMBER PICKED HERE.
				   That zone is a bare `flex` with NO `gap`: every separation in it is
				   a margin on the control that owns it (`DharmaCluster`'s `mr-3.5`,
				   the §21.1 divider's `mx-3`). Adding a `gap` to the zone instead
				   would compound with all three and move Đ, the chip and the counter
				   at 1440 — the one thing this task must not do. */
				className={cn(
					RULES_TAB,
					"mr-3.5",
					mobileResponsive && "max-mobile:px-[10px]",
				)}
			>
				Rules
			</button>
			<OnboardingDeck
				context="reshow"
				open={open}
				onOpenChange={setOpen}
				mobileResponsive={mobileResponsive}
			/>
		</>
	);
}
