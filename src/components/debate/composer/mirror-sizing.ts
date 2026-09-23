/**
 * MIRROR-1 · RF-4 — the Mirror title's two-line guarantee and its counter, as
 * pure arithmetic (`docs/design/composer-mirror.md`).
 *
 * The title block is FIXED at two lines of the 16px / 22px type. A title that
 * would need a third line does not grow the block — the TYPE steps down, half a
 * pixel at a time, to a 13px floor, with the line height held at size × 1.375
 * (which is 16 → 22). The block therefore never changes height while someone
 * types; only the text inside it shrinks.
 *
 * ⚠ THE MEASUREMENT IS NOT HERE, AND THAT IS WHY THIS FILE CAN BE TESTED. How
 * many lines a string occupies at a size depends on the font, the field's width
 * and the browser's wrapping — facts only a laid-out element has. The caller
 * passes a `linesAt(size)` it measured; this module owns only the rule of which
 * size to choose from those answers. `MirrorComposer` measures the real field.
 */

/** RF-4 — the block's type at rest. */
export const TITLE_SIZE_MAX_PX = 16;
/** RF-4 — the floor. Below it the field scrolls inside the fixed block. */
export const TITLE_SIZE_MIN_PX = 13;
/** RF-4 — "steps down 0.5px at a time". Halves are exact in binary, so the loop hits 13 exactly. */
export const TITLE_SIZE_STEP_PX = 0.5;
/** RF-4 — the block holds two lines. */
export const TITLE_LINES = 2;
/** RF-4 — the counter appears only in the last ten characters. */
export const TITLE_LEFT_WINDOW = 10;

/** RF-4 — "line height = size × 1.375": 16 → 22, 13 → 17.875. */
export function titleLineHeightPx(sizePx: number): number {
	return sizePx * 1.375;
}

/**
 * The largest size in 16, 15.5, 15 … 13 at which the title needs no more than
 * two lines — or the floor, when even 13 needs more.
 *
 * ⛔ IT STARTS AT 16 EVERY TIME, never from the size in use. Deleting characters
 * must let the type grow back, and a search that began at the current size could
 * only ever shrink.
 */
export function fitTitleSize(linesAt: (sizePx: number) => number): number {
	for (
		let size = TITLE_SIZE_MAX_PX;
		size >= TITLE_SIZE_MIN_PX;
		size -= TITLE_SIZE_STEP_PX
	) {
		if (linesAt(size) <= TITLE_LINES) {
			return size;
		}
	}
	return TITLE_SIZE_MIN_PX;
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
