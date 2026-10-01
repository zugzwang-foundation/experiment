/**
 * Autosize ("fit text") for a single-line label: its font size steps DOWN so
 * the whole string fits the width of its nearest `@container`, and never
 * grows past its designed size. Everything else stays where it is — only the
 * text gets smaller, and only when the box is too narrow for it, so a window
 * wide enough for the text renders exactly as designed.
 *
 * It is a DATA rule, not a runtime measurement (AGENTS.md §8): the string is
 * known on the server before a pixel is painted, so the size is right on first
 * paint with no flash and no ResizeObserver. The string's width comes from
 * `GEIST_WIDTHS` below; the box's width comes from CSS container units
 * (`100cqi`), so the browser redoes the arithmetic as the window changes.
 *
 * `GEIST_WIDTHS` holds each printable character's advance in 1/1000 em,
 * measured 2026-10-01 in Chrome (canvas `measureText`) against the shipped
 * Geist at 400 / 700 / 800. Summing single glyphs ignores kerning, which only
 * ever tightens a pair, so the sum runs 1–2% WIDE: a string this says fits
 * does fit. A character outside the table (an emoji, a rare accent) counts as
 * `UNKNOWN_EM`, deliberately generous. `minPx` is where readability wins;
 * below it the element keeps its `truncate` as the last resort.
 *
 * ⚠ The element must sit inside an ancestor carrying `@container`
 * (`container-type: inline-size`) whose width is set by its layout, never by
 * its content — inline-size containment makes a content-sized box collapse.
 * Where container units are unsupported the whole `clamp()` is invalid and
 * the element falls back to its class font size, i.e. the designed rendering.
 */

/** Printable ASCII (U+0020–U+007E) in order, then these extras. */
const EXTRA_CHARS = "·éő’—–…";

const GEIST_WIDTHS = {
	w400: [
		250, 213, 346, 478, 629, 802, 620, 178, 274, 274, 430, 558, 201, 419, 201,
		480, 663, 384, 619, 613, 615, 626, 593, 524, 604, 593, 297, 297, 544, 540,
		544, 559, 906, 668, 680, 703, 694, 603, 590, 700, 713, 270, 597, 640, 580,
		877, 743, 739, 650, 733, 672, 640, 552, 689, 667, 945, 606, 576, 544, 347,
		455, 347, 426, 557, 248, 551, 595, 546, 595, 561, 395, 594, 581, 244, 260,
		590, 267, 877, 581, 573, 595, 595, 379, 520, 392, 575, 536, 819, 585, 537,
		537, 389, 264, 389, 523, 201, 561, 573, 203, 907, 591, 571,
	],
	w700: [
		228, 257, 390, 589, 670, 825, 706, 203, 323, 323, 422, 570, 236, 417, 236,
		522, 693, 449, 653, 650, 656, 671, 627, 544, 664, 631, 311, 311, 550, 552,
		550, 591, 962, 730, 703, 734, 716, 622, 604, 738, 721, 300, 627, 689, 589,
		915, 750, 776, 672, 769, 697, 681, 599, 703, 730, 1015, 688, 631, 594, 390,
		501, 390, 461, 561, 278, 594, 634, 598, 634, 605, 447, 634, 611, 281, 331,
		647, 313, 900, 611, 618, 634, 634, 425, 570, 445, 607, 609, 849, 650, 586,
		583, 408, 294, 408, 523, 236, 605, 618, 247, 911, 595, 695,
	],
	w800: [
		221, 272, 405, 626, 683, 833, 734, 212, 339, 339, 419, 574, 248, 417, 248,
		536, 703, 470, 665, 662, 670, 686, 638, 551, 684, 643, 315, 315, 552, 556,
		552, 602, 981, 750, 710, 745, 723, 628, 609, 751, 724, 310, 637, 705, 592,
		927, 753, 788, 679, 781, 706, 695, 615, 708, 751, 1038, 715, 650, 610, 404,
		516, 404, 473, 563, 288, 609, 647, 615, 647, 620, 464, 647, 621, 294, 355,
		666, 328, 907, 621, 633, 647, 647, 440, 586, 462, 618, 633, 859, 671, 603,
		598, 414, 304, 414, 523, 248, 620, 633, 261, 913, 597, 737,
	],
} as const;

const UNKNOWN_EM = 1.3;

/**
 * Geist Mono: every glyph in the face is 0.6em. `→` is not in it and falls
 * back to a wider one (measured the same day, same browser).
 */
const MONO_EM = 0.6;
const MONO_FALLBACK_EM: Record<string, number> = { "→": 1.346 };

/** Each autosized type style: its weight, case and letter-spacing. */
const FIT_STYLES = {
	/** Geist 700 — the market question and the Discovery hero title. Also
	 * stands in for 650 (the author pseudonym): a little wider, never narrower. */
	titleBold: { widths: GEIST_WIDTHS.w700, upper: false, trackingEm: 0 },
	/** Geist 800 uppercase, 0.14em tracking — resolver-card labels. */
	labelCaps: { widths: GEIST_WIDTHS.w800, upper: true, trackingEm: 0.14 },
	/** Geist 800, 0.06em tracking — the hero side chip (`YES @ 10%`). */
	chip: { widths: GEIST_WIDTHS.w800, upper: false, trackingEm: 0.06 },
	/** Geist 400 — resolver-card values, the argument age. */
	value: { widths: GEIST_WIDTHS.w400, upper: false, trackingEm: 0 },
	/** Geist Mono — the Đ stake figures. */
	mono: { widths: null, upper: false, trackingEm: 0 },
} as const;

export type FitStyle = keyof typeof FIT_STYLES;

function glyphEm(ch: string, widths: readonly number[] | null): number {
	if (widths === null) return MONO_FALLBACK_EM[ch] ?? MONO_EM;
	const code = ch.codePointAt(0) ?? 0;
	if (code >= 0x20 && code <= 0x7e) return widths[code - 0x20] / 1000;
	const extra = EXTRA_CHARS.indexOf(ch);
	return extra >= 0 ? widths[95 + extra] / 1000 : UNKNOWN_EM;
}

/** The string's rendered width in em for the given style (conservative). */
export function textWidthEm(text: string, style: FitStyle): number {
	const { widths, upper, trackingEm } = FIT_STYLES[style];
	const chars = [...(upper ? text.toUpperCase() : text)];
	return chars.reduce((sum, ch) => sum + glyphEm(ch, widths) + trackingEm, 0);
}

/**
 * For a LINE of mixed pieces: the font-size at which it exactly fills its
 * container, unclamped. `em` is everything whose size follows the line's own
 * font-size, summed in em; `fixedPx` is what does not (an avatar, a border).
 * The caller clamps it — it is a term, not a whole `font-size`.
 */
export function fillFontSize(em: number, fixedPx: number): string {
	return `((100cqi - ${fixedPx.toFixed(3)}px) / ${Math.max(0.5, em).toFixed(3)})`;
}

/**
 * The CSS `font-size` that fits `text` on one line in its container: the
 * designed `maxPx` whenever it fits, smaller only as far as it must, and
 * never below `minPx`.
 */
export function fitFontSize(
	text: string,
	style: FitStyle,
	maxPx: number,
	minPx: number,
): string {
	const em = Math.max(0.5, textWidthEm(text, style));
	return `clamp(${minPx}px, calc(100cqi / ${em.toFixed(3)}), ${maxPx}px)`;
}
