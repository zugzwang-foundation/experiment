"use client";

import { Button } from "@/components/ui/button";

/**
 * UI-QUICK — the `Know more` control. ONE implementation, now THREE live mounts:
 * the post card (`PostCard`), the focused post (`PostFocusHeader`) and the reply
 * card (`ReplyCard`). The affordance the reader learns is the same object in all
 * three, which is the whole point of hoisting it out of any one of them.
 *
 * ⚠ THIS SAID "FOUR" AND NAMED `ResolutionCriterion` FIRST, until the
 * main→staging merge left that component with zero importers (see
 * `dialogs.tsx`). The count is corrected rather than the name merely struck,
 * because the sentences below reason FROM it — "the same object in all four"
 * and the frame breakdown were both arithmetic on a mount that is no longer
 * mounted. Restore the fourth here if and when the criterion regains a surface.
 *
 * ⚠⚠ MOST MOUNTS OPEN A DIALOG, so `aria-haspopup="dialog"` is declared HERE
 * rather than at each call site. The component briefly carried an `expanded`
 * prop for the criterion's in-place toggle; ruling R3 = c made that mount a
 * dialog too, which left `aria-expanded` describing a state no mount had, and it
 * was removed — an ARIA attribute that does not match the widget's behaviour is
 * worse than none, because a screen reader announces "collapsed" about something
 * that never expands.
 *
 * ⚠⚠ AND IT IS BACK, FOR A MOUNT THAT REALLY DOES EXPAND (UI-OVERNIGHT entry 3).
 * The profile's argument panel renders the body IN PLACE — there is no dialog
 * to open there, and reusing the debate pop-up would mean constructing a
 * `PresentPost` out of fields that surface does not hold, i.e. fabricating data
 * to satisfy a type (`ArgumentBody` records the same finding). So the prop
 * returns, and the two attributes are mutually exclusive by construction: a
 * mount that passes `expanded` announces a disclosure, a mount that omits it
 * announces a dialog. ⛔ THE VISIBLE CONTROL IS IDENTICAL EITHER WAY — same
 * text, same tokens, same size — which is the whole reason this is one
 * component. Only the promise it makes to a screen reader follows the mount.
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
 * ⚠ `text-n5 hover:text-ink` is CARRIED FROM THE CONTROL THIS REPLACES — the
 * `+`'s own ported recipe (CD-A `#989898`/`#FAFAFA` BY TOKEN, Ruling A / H-HEX),
 * pinned by `post-card.test.tsx`. No new colour enters.
 *
 * ⚠ `className` EXISTS FOR LAYOUT ONLY. The four mounts sit in different frames
 * — one absolutely positioned in a reserved gutter, two as `shrink-0` flex
 * siblings — so the call site owns POSITION while this component owns identity.
 * ⛔ It is not a hook for re-styling the control per mount; a `Know more` that
 * looked different in the reply column than on the card would defeat the reason
 * all four share one component.
 */
export function KnowMore({
	label,
	onClick,
	className,
	expanded,
}: {
	/** Full accessible name. MUST contain `Know more` — see the docblock. */
	label: string;
	onClick: () => void;
	/** Layout only — positioning at the mount. Never a restyle. */
	className?: string;
	/**
	 * Present ⇒ this mount reveals content IN PLACE and announces
	 * `aria-expanded`; absent ⇒ it opens a dialog and announces
	 * `aria-haspopup`. Never both — see the docblock for why the second form
	 * came back.
	 */
	expanded?: boolean;
}) {
	return (
		<Button
			type="button"
			variant="ghost"
			size="xs"
			onClick={onClick}
			aria-label={label}
			aria-haspopup={expanded === undefined ? "dialog" : undefined}
			aria-expanded={expanded}
			className={`text-n5 hover:text-ink${className ? ` ${className}` : ""}`}
		>
			Know more
		</Button>
	);
}
