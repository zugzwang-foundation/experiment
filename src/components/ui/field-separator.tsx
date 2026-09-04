import { cn } from "@/lib/utils";

/**
 * **The author row's upright field separator — the `.vsep` pipe, lifted (SEP-1).**
 *
 * One element behind every author row in the product: the debate post card, the
 * post-focus header, the post pop-up, the reply card and the reply pop-up (all
 * via `debate/ArgProfile`), the Discovery hero panels (`discovery/HeroPanels`)
 * and the profile argument list (`profile/ArgumentList`). Before this it was
 * three private copies with three different renderings, which is exactly how
 * the surfaces came to disagree about whether the row had a separator before
 * its timestamp at all.
 *
 * ⚠ **LIFTED ON THE THIRD OCCURRENCE, WHICH IS WHERE ITS OWN DOCBLOCK SAID TO
 * LIFT IT.** `profile/ArgumentList.tsx` carried the rule in terms — "attributed
 * duplication, routed not absorbed … the third occurrence would be the moment
 * to lift it" — against a second copy in `discovery/HeroPanels.tsx` and a third
 * in `debate/ArgProfile.tsx`. This is that moment; the three copies are gone.
 *
 * ⛔ **THE GLYPH IS BYTE-CARRIED, NOT TYPED.** U+007C VERTICAL LINE, `0x7C`,
 * plain ASCII — the byte `hexdump` returns for `surface_discovery_v1_0.html`'s
 * `.vsep` markup, and the byte two shipped guards assert by code point
 * (`profile/render/arrangement`, `discovery/render/hero-panels`). ⛔ NOT U+2502
 * and no box-drawing look-alike.
 *
 * ⚠ **THE COLOUR COMES FROM SHIPPED CODE, NEVER FROM THE MOCKUP.** `text-n3` is
 * what `discovery/StatLine.tsx` already ships for this exact glyph in this exact
 * separator role. The mockup's `.vsep{color:var(--n3)}` is NOT the source: the
 * ramps are inverted between the light prototype and the shipped dark system,
 * and porting a neutral BY NAME across them is the failure `side-pole-binding`
 * and the V7/V42 rulings exist to prevent. Same value, arrived at properly.
 *
 * ⚠⚠ **THE SIZE IS STATED HERE AND IS NOT THE CALLER'S, WHICH INVERTS
 * `RelativeTime`'s SPLIT — deliberately, and this is the decision the task
 * turned on.** That leaf takes its size from the caller because the three rows
 * it mounts on run at three sizes (`text-xs`, `text-[9.5px]`, sibling-declared
 * `text-xs`) and a baked size would be wrong on two of them. A separator is the
 * opposite kind of thing: it is not a field, it is the seam BETWEEN fields, and
 * a seam that changes size per surface is the drift this component exists to
 * end. So it declares `text-xs` and inherits nothing — one computed font-size
 * on all five author rows.
 *
 * ⚠ **AND THE LEADING IS STATED WITH IT.** An arbitrary or inherited size keeps
 * whatever line-height was in scope (AGENTS.md §8), so the bare inheriting span
 * this replaces had a box height set by an ancestor it never named — on
 * Discovery, by an ancestor three levels up. `leading-none` makes the box the
 * glyph's own size and nothing else's.
 *
 * ⚠ **WHY THAT IS THE ALIGNMENT FIX, AND WHY IT IS NOT A MARGIN.** Under
 * `items-center` — which all three parent rows use — a blockified inline's
 * baseline sits `(ascent − descent) / 2` above its box centre, a quantity that
 * scales with FONT-SIZE and is entirely independent of line-height. So leading
 * never moved this glyph and a margin would only have cancelled the symptom at
 * one size. Pinning the font-size is what fixes it, because it is the only
 * input that was varying. The pipe's ink is centred on the lowercase band by
 * the typeface itself, which is why the typeset glyph stays typeset here rather
 * than becoming a drawn 1px rule: a box-centred rule ignores the font's
 * metrics, and lands about `0.11em` BELOW the optical centre of the text it
 * divides. Measured values are in the SEP-1 report.
 *
 * ⚠ `aria-hidden` — it is punctuation. Announcing "vertical line" between every
 * field would make the row unlistenable. ⛔ Two of the three copies this
 * replaces LACKED it, so Discovery and Profile were reading the pipes aloud;
 * that is fixed here by convergence rather than by three edits.
 *
 * `data-field-separator` is its OWN marker, never an override of `data-slot`
 * (`ui/loading-block.tsx` records the failure that minted that rule). It is
 * what a browser measurement selects on across five surfaces in one pass —
 * a selector keyed on a styling class changes meaning the moment a neighbour
 * is restyled, and does so silently.
 */
export function FieldSeparator({ className }: { className?: string }) {
	return (
		<span
			aria-hidden="true"
			data-field-separator=""
			className={cn("shrink-0 text-xs leading-none text-n3", className)}
		>
			|
		</span>
	);
}
