"use client";

import { Button } from "@/components/ui/button";

/**
 * UI-QUICK change set 1 — the `Know more` control. ONE implementation, two
 * mounts: the resolution criterion (`ResolutionCriterion`, where it toggles the
 * clamp in place) and the post card (`PostCard`, where it opens the full-body
 * pop-up). The two mounts differ in what they DO; the affordance the reader
 * learns is the same object in both places, which is the whole point of hoisting
 * it out of either one.
 *
 * ⚠⚠ `label` MUST CONTAIN THE STRING `Know more`, and that is WCAG 2.5.3 (Label
 * in Name), not a style preference. The visible text IS `Know more`, so an
 * accessible name that omits it — "Read the full argument", say — makes the
 * control unspeakable to anyone driving by voice. This is the exact trap the
 * superseded `+` glyph was allowed to dodge: a glyph has no visible label, so
 * 2.5.3 did not apply to it and a free-form `aria-label` was correct there. The
 * moment the control carries visible text the rule switches on. Each call site
 * therefore passes a name that EXTENDS `Know more` rather than replacing it.
 *
 * ⚠ THE VISIBLE LABEL DOES NOT CHANGE WHEN EXPANDED — `aria-expanded` carries
 * the state instead. A control whose text flipped to `Show less` would have to
 * flip its accessible name with it to stay 2.5.3-compliant, and the kickoff
 * ruled the control reads `Know more`. `aria-expanded` is the mechanism the
 * platform already has for exactly this.
 *
 * ⚠ `text-n5 hover:text-ink` is CARRIED FROM THE CONTROL THIS REPLACES — the
 * `+`'s own ported recipe (CD-A `#989898`/`#FAFAFA` BY TOKEN, Ruling A / H-HEX),
 * pinned by `post-card.test.tsx`. No new colour enters.
 */
export function KnowMore({
	label,
	expanded,
	onClick,
}: {
	/** Full accessible name. MUST contain `Know more` — see the docblock. */
	label: string;
	/** Omitted where the control navigates rather than toggles (the pop-up mount). */
	expanded?: boolean;
	onClick: () => void;
}) {
	return (
		<Button
			type="button"
			variant="ghost"
			size="xs"
			onClick={onClick}
			aria-label={label}
			aria-expanded={expanded}
			className="text-n5 hover:text-ink"
		>
			Know more
		</Button>
	);
}
