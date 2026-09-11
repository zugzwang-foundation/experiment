/**
 * QUOTE-1 C — the title-as-quotation well's geometry (design-canon `C-QUOTE-1`,
 * SPEC.1 2.0.2). Pure arithmetic, no DOM, no React: the well is a FIXED picture
 * and the only thing that varies inside it is how big the title can be, so the
 * size question is a function of the title's length and nothing else.
 *
 * ⚠⚠ THE FONT CONSTANTS ARE MEASURED, NOT CHOSEN, AND THEY DATE. All three were
 * read off the **deployed** Geist latin subset
 * (`caa3a2e1cccd8315-s.p.0zr6hhvz-h9nw.woff2`, the file staging actually serves)
 * in headless Chrome **152.0.7977.83 on 2026-09-11**, gated on
 * `document.fonts.status === "loaded"` and
 * `document.fonts.check('700 100px "Geist-local"')` in the same evaluation as the
 * geometry — a width taken against a fallback face is a number shaped exactly
 * like the right answer. ⛔ THEY ARE PROPERTIES OF A FACE, so a change of face,
 * of weight, or of `letter-spacing` invalidates them and the sizes below go
 * quietly wrong rather than loudly. `quote-well-size.test.ts` pins the named
 * points as literals for exactly that reason: move a constant and the pins red.
 *
 * Measurement method, so it is repeatable rather than merely recorded:
 *   · ADV — two nowrap spans at `font-size: 100px`, weight 700, uppercase,
 *     `letter-spacing: 0.02em`; `scrollWidth / (chars × 100)`, averaged. Raw:
 *     4548 px / 75 and 7457 px / 125 → 0.6064 and 0.59656.
 *     ⚠⚠ THE EXACT STRINGS ARE PART OF THE METHOD, because the character mix
 *     moves this number by a factor of THREE and an unnamed "75-char string" is
 *     not a repeatable instruction. They are:
 *         "A position in which every legal move makes things worse is called
 *          zugzwang."                                    — 75 chars, 16.0% spaces
 *         "In chess, zugzwang is the obligation to move when every legal move
 *          worsens your position and passing is not an option at all."
 *                                                       — 125 chars, 17.6% spaces
 *     ⛔ IT IS A SPACES-INCLUSIVE PROSE AVERAGE, AND THAT IS THE RIGHT KIND OF
 *     AVERAGE HERE rather than a looseness in the measurement. The estimate asks
 *     "how many CHARACTERS of a title fit on a line", and a title is prose — a
 *     letters-only figure would understate chars-per-line and shrink every title
 *     to pay for a space fraction that is really there. Measured on the same face,
 *     same run: the same 75-char string with its spaces deleted is **0.6711**;
 *     25 × `M` is **0.9212**; 25 × `i` is **0.3064**; the fixture title used
 *     throughout the tests is **0.593**.
 *     ⇒ **The estimate is safe for any title whose mean advance is ≤ 0.7076 em**
 *     (= ADV / WRAP_SLACK). Letters-only prose at 0.6711 clears it with ~5%
 *     margin, so even a title with no spaces at all still fits. A run of wide
 *     caps does not — which is canon clause 6's degradation with an actual number
 *     on it, and the reason the well clips rather than reflows.
 *     *(The naming gap was found by `@code-reviewer`, who re-ran the method as
 *     written with different strings and got 0.6921 — a correct measurement of a
 *     different mix, and the proof that the instruction was under-specified.)*
 *   · INK / TOP — each mark alone in a `line-height: 1` block at
 *     `font-size: 1000px` (so one device pixel is 0.001 em and no
 *     device-pixel-ratio arithmetic enters), white on a black box pinned at
 *     `top: 0`, raster-scanned for the first and last row carrying ink. Checked
 *     scale-invariant at 100 px and 200 px: agreement to ±0.0013 across 10×.
 */

/**
 * The canvas. ⚠ `pad` is the TOTAL INSET from the canvas edge to the content
 * box, which is why `QuoteWell` ships `border: 1px` + `padding: 23px` rather
 * than the 24 px padding the canon clause reads as. The alternative — 24 px of
 * padding INSIDE a 1 px border — makes the content 495 × 222, and every budget
 * below would then be optimistic by 2 px on an `overflow: hidden` box, i.e. it
 * would clip ink in exactly the cases the budget exists to prevent. One pixel of
 * visual padding is invisible; two pixels of arithmetic error are not.
 */
export const QUOTE_CANVAS = { w: 545, h: 272, pad: 24 } as const;

/** Content box: 545 − 2×24 = 497 wide, 272 − 2×24 = 224 tall. */
export const QUOTE_CONTENT_W = QUOTE_CANVAS.w - 2 * QUOTE_CANVAS.pad;
export const QUOTE_CONTENT_H = QUOTE_CANVAS.h - 2 * QUOTE_CANVAS.pad;

export const QUOTE_TYPE = {
	min: 24,
	max: 56,
	lineHeight: 1.15,
	tracking: 0.02,
	/** Between each mark and the title — two gaps in the column, never three. */
	gap: 8,
} as const;

export const QUOTE_MARK = { mult: 2.5, min: 60, max: 140 } as const;

/**
 * ⚠ THE ESTIMATE IS DELIBERATELY PESSIMISTIC AND THIS IS THE KNOB THAT MAKES IT
 * SO. `QUOTE_CONTENT_W / (ADV × size)` is the chars-per-line a line would hold if
 * text broke mid-word at the average advance; real text breaks at SPACES, so a
 * greedy line ends short of that bound by however much the next word overruns.
 * 0.85 is the allowance. Raise it and long titles overflow their estimate; lower
 * it and every title ships smaller than it needed to.
 */
export const WRAP_SLACK = 0.85;

/** Mean uppercase advance per character, in em, at weight 700 + 0.02em tracking. */
export const GEIST_UPPER_ADV = 0.6015;

/**
 * Ink height of a quotation mark, in em. Measured IDENTICAL for `“` and `”`
 * (311/1000 both), so "the larger" is not a choice here.
 */
export const GEIST_QUOTE_INK = 0.311;

/**
 * Distance from a `line-height: 1` box's top to the mark's ink top, in em.
 *
 * ⚠⚠ THE TWO MARKS DO NOT SIT AT THE SAME HEIGHT, which is why there are two
 * constants and not one. `“` starts at 0.129 em, `”` at 0.145 em — a 0.016 em
 * difference, 2.2 px at the 140 px mark ceiling. Placing both off one constant
 * leaves the other that far out of position, and since the ink is what the
 * budget accounts for, the error lands on the one axis the well clips. Each mark
 * is therefore placed off its own figure.
 */
export const GEIST_QUOTE_TOP = 0.129;
export const GEIST_QUOTE_TOP_CLOSE = 0.145;

/** Decoration sized off the title, floored and capped so it stays a mark. */
export function quoteMarkSize(titlePx: number): number {
	return Math.max(
		QUOTE_MARK.min,
		Math.min(QUOTE_MARK.mult * titlePx, QUOTE_MARK.max),
	);
}

/**
 * The largest integer size in [24, 56] px whose estimated wrapped height, plus
 * both marks' INK and both gaps, fits the 224 px content height.
 *
 * ⚠ `len` is `title.length` — UTF-16 units, which is what the composer's
 * `TITLE_MAX_CHARS` counter counts (`composer/payload.ts`). Not grapheme
 * clusters, and deliberately not: two definitions of "how long is this title"
 * would let the card size a string the composer measured differently.
 *
 * ⛔ IT ACCOUNTS FOR THE MARKS' INK, NOT THEIR LINE BOXES. A mark's layout box
 * at `line-height: 1` is a full em tall while its ink is 0.311 em — reserving
 * the em would cost 137 px of the 224 at the size ceiling and shrink every
 * title to pay for whitespace. `QuoteWell` makes each mark's layout footprint
 * equal its ink precisely so this arithmetic is the truth about the render.
 */
export function quoteTitleSize(len: number): number {
	for (let s = QUOTE_TYPE.max; s >= QUOTE_TYPE.min; s--) {
		const cpl =
			Math.floor(QUOTE_CONTENT_W / (GEIST_UPPER_ADV * s)) * WRAP_SLACK;
		const lines = Math.ceil(len / cpl);
		const need =
			lines * QUOTE_TYPE.lineHeight * s +
			2 * GEIST_QUOTE_INK * quoteMarkSize(s) +
			2 * QUOTE_TYPE.gap;
		if (need <= QUOTE_CONTENT_H) {
			return s;
		}
	}
	return QUOTE_TYPE.min;
}

/**
 * How many full lines of `size` fit between the two marks' ink.
 *
 * ⛔ NOT CONSUMED BY THE RENDER, AND THAT IS A MEASURED DECISION RATHER THAN AN
 * OVERSIGHT. It was to drive a `-webkit-line-clamp` belt on `.qtitle`, and the
 * belt is dropped because **`text-wrap: balance` stops applying the moment the
 * clamp actually clamps** — measured in Chrome 152 on the shipped face: a
 * 4-line title at a 2-line clamp reports `text-wrap: balance` from
 * `getComputedStyle` while laying out the GREEDY line set
 * (483.4 / 483.1 / 308.1 / 201.5 px) instead of the balanced one
 * (364.5 / 336.6 / 392.2 / 382.9 px). The computed style says the rule is on and
 * the layout says it is off, so keeping the clamp would have silently traded the
 * ratified centred-balanced wrap for ragged text. ⚠ It also only reproduces when
 * the clamp BITES: at a clamp equal to the line count, balance survives and the
 * A/B looks clean. The well's own `overflow: hidden` is the backstop instead.
 * Kept exported because it is the bound the budget respects, and
 * `quote-well-size.test.ts` asserts it stays ≥ 1 at every legal size.
 */
export function quoteMaxLines(size: number): number {
	return Math.floor(
		(QUOTE_CONTENT_H -
			2 * GEIST_QUOTE_INK * quoteMarkSize(size) -
			2 * QUOTE_TYPE.gap) /
			(QUOTE_TYPE.lineHeight * size),
	);
}
