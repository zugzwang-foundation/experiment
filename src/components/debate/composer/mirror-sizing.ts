/**
 * MIRROR-2 · RF-4 — the Mirror title's size rule and its counter, as pure
 * arithmetic (`docs/design/composer-mirror.md`, amended MIRROR-2).
 *
 * The title block is FIXED at 54px: a 53px box above its 1px underline. The
 * type takes the LARGEST size from 28px down to 13px, half a pixel at a time,
 * at which the text — or, while the field is empty, its placeholder — fits that
 * box in at most two lines, with the line height held at size × 1.25; the lines
 * are then centred in the box. So a short title is one big line, a filling line
 * eases the size down, and past one line the text flows into two. The block
 * never changes height while someone types; only the type inside it moves.
 *
 * ⚠ THE MEASUREMENT IS NOT HERE, AND THAT IS WHY THIS FILE CAN BE TESTED. How
 * many lines a string occupies at a size depends on the font, the field's width
 * and the browser's wrapping — facts only a laid-out element has. The caller
 * passes a `linesAt(size)` it measured; this module owns only the rule of which
 * size to choose from those answers. `MirrorComposer` measures on a hidden copy
 * of the field.
 */

/** RF-4 — the largest size the type starts from. */
export const TITLE_SIZE_MAX_PX = 28;
/** RF-4 — the floor. Below it the text centres if it can and scrolls if not. */
export const TITLE_SIZE_MIN_PX = 13;
/** RF-4 — 0.5px steps. Halves are exact in binary, so the loop lands on 13 exactly. */
export const TITLE_SIZE_STEP_PX = 0.5;
/** RF-4 — the block holds at most two lines. */
export const TITLE_LINES = 2;
/** RF-4 — the block is 54px; its 1px underline leaves 53 for the text. */
export const TITLE_BOX_PX = 53;
/** RF-4 — the counter appears only in the last ten characters. */
export const TITLE_LEFT_WINDOW = 10;

/** RF-4 — "line height = size × 1.25": 28 → 35, 16 → 20, 13 → 16.25. */
export function titleLineHeightPx(sizePx: number): number {
	return sizePx * 1.25;
}

/** A chosen size and the number of lines the text takes at it. */
export type TitleFit = { sizePx: number; lines: number };

/**
 * Before anything has been measured — the first render, and jsdom, which lays
 * nothing out: one line at full size, which is where an empty field's
 * placeholder sits at every width the register was drawn for.
 */
export const TITLE_FIT_AT_REST: TitleFit = {
	sizePx: TITLE_SIZE_MAX_PX,
	lines: 1,
};

/**
 * The largest size in 28, 27.5, 27 … 13 at which the title takes no more than
 * two lines AND those lines fit the 53px box — or the floor, with however many
 * lines the text takes there, when nothing fits.
 *
 * ⚠ BOTH CONDITIONS, AND THE SECOND IS THE ONE THAT BITES ABOVE 21px. Two lines
 * of 21.5px are 2 × 26.875 = 53.75px, taller than the box, so from 21.5 up only
 * a single line fits; two lines first fit at 21px. That is what makes a filling
 * line shrink toward 21 before it breaks, rather than breaking at 28.
 *
 * ⛔ IT STARTS AT 28 EVERY TIME, never from the size in use. Deleting characters
 * must let the type grow back, and a search that began at the current size
 * could only ever shrink.
 */
export function fitTitle(linesAt: (sizePx: number) => number): TitleFit {
	let lines = 1;
	for (
		let size = TITLE_SIZE_MAX_PX;
		size >= TITLE_SIZE_MIN_PX;
		size -= TITLE_SIZE_STEP_PX
	) {
		// A measurement can read 0 for an element with no layout; a field always
		// holds at least one line.
		lines = Math.max(1, linesAt(size));
		if (
			lines <= TITLE_LINES &&
			lines * titleLineHeightPx(size) <= TITLE_BOX_PX
		) {
			return { sizePx: size, lines };
		}
	}
	// The loop's last probe was the floor itself, so `lines` is its count.
	return { sizePx: TITLE_SIZE_MIN_PX, lines };
}

/**
 * RF-4 — "padding-top = (53 − lines × line height) / 2": the lines centred in
 * the box. At the floor, text that is taller than the box (four lines of 13px)
 * cannot be centred; it starts at the top and the field scrolls, as it did
 * before MIRROR-2.
 */
export function titlePaddingTopPx(fit: TitleFit): number {
	return Math.max(
		0,
		(TITLE_BOX_PX - fit.lines * titleLineHeightPx(fit.sizePx)) / 2,
	);
}

/**
 * RF-4 — `{n} left`, and only inside the last ten characters. `null` means "show
 * no counter", which is every length up to `max − 11`. Counted over the field's
 * raw value — the same length its `maxLength` bounds.
 */
export function titleCharsLeft(length: number, max: number): number | null {
	const left = max - length;
	return left <= TITLE_LEFT_WINDOW ? Math.max(0, left) : null;
}
