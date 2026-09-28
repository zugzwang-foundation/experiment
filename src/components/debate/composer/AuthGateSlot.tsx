"use client";

import Link from "next/link";

import { ONBOARDING_CARDS } from "@/components/onboarding/cards";
import { GoalFigure } from "@/components/onboarding/figures";
import { DECK_EYEBROW_CLASS } from "@/components/onboarding/OnboardingDeck";
import { Button } from "@/components/ui/button";
import type { Side } from "../types";
import { AUTH_GATE_COPY } from "./copy";

/**
 * UIR-6 — the O-1 deck's Card 3, whose eyebrow and title are read from the deck
 * rather than restated here, so the panel and the deck cannot disagree.
 */
const GOAL_CARD = ONBOARDING_CARDS.find((card) => card.figure === "goal");

/**
 * The d5 signed-out auth-gate slot variant (plan §4): clicking `Đ BET` while
 * signed out opens THIS in the opposite slot instead of the composer. Copy is
 * d5-verbatim; both actions link to the existing unstyled auth route (A7 owns
 * the auth skin — no auth-route edits here, §8).
 *
 * ⚠ UIR-6 — THE GOAL IS DESKTOP-ONLY, AND THE GATE IS A CLASS. The phone sheet
 * mounts this same component, and the phone layout is not part of this change,
 * so the block carries `max-mobile:hidden`: at 640px and up it shows, below it
 * the sheet renders exactly as before. The desktop tree is hidden below 640px
 * anyway, so the class only ever acts on the phone mount.
 * A panel taller than its column scrolls inside the column: the slot centres
 * with `safe center` and the column body is the scroller, so nothing is clipped.
 */
export function AuthGateSlot({
	side,
	onClose,
}: {
	side: Side;
	onClose: () => void;
}) {
	return (
		<section
			aria-label={AUTH_GATE_COPY.heading(side)}
			className="flex flex-col items-center gap-3 rounded-(--r) px-6 py-10 text-center shadow-(--elev-1) [border:var(--hairline)]"
		>
			<div className="flex w-full justify-end">
				<button
					type="button"
					onClick={onClose}
					aria-label="Close"
					className="rounded-(--r-chip) px-1 text-sm text-n4 transition-all hover:text-ink focus-visible:shadow-(--state-focus-ring)"
				>
					×
				</button>
			</div>
			{/* UIR-6 — figure 120px, 12px to the eyebrow, 6px to the line, 20px to
			    the title (`mb-[8px]` + the section's 12px gap). The line is 22px /
			    700 in `ink` (#fafafa) and holds one line wherever the column is
			    wider than it (~372px); in a narrower column it wraps rather than
			    overflowing. */}
			<div className="mb-[8px] flex flex-col items-center max-mobile:hidden">
				<GoalFigure className="block h-[120px] w-auto max-w-full font-sans" />
				<div className={`mt-[12px] ${DECK_EYEBROW_CLASS}`}>
					{GOAL_CARD?.eyebrow}
				</div>
				<p className="mt-[6px] text-[22px] leading-[1.2] font-bold text-balance text-ink">
					{GOAL_CARD?.title}
				</p>
			</div>
			<h3 className="text-base font-semibold text-ink">
				{AUTH_GATE_COPY.heading(side)}
			</h3>
			<p className="max-w-sm text-sm text-n5">{AUTH_GATE_COPY.body}</p>
			<div className="flex items-center gap-2">
				<Button asChild size="sm">
					<Link href="/sign-in" prefetch={false}>
						{AUTH_GATE_COPY.signUp}
					</Link>
				</Button>
				<Button asChild variant="ghost" size="sm">
					<Link href="/sign-in" prefetch={false}>
						{AUTH_GATE_COPY.signIn}
					</Link>
				</Button>
			</div>
			<div className="text-xs font-medium tracking-wide text-n4 uppercase">
				{AUTH_GATE_COPY.micro}
			</div>
		</section>
	);
}
