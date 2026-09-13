import { formatDharma } from "@/components/debate/format";

/**
 * MOBILE-2j · R-1 / ADR-0051 A6 D-1 — **THE MONEY LINE'S ONE CONCESSION.**
 *
 * Below `--breakpoint-mobile` a position tile's first line carries four things in
 * one row: the side, the value, the value's movement, and SELL. Three of them are
 * `whitespace-nowrap` in grid tracks that cannot shrink below their own
 * min-content, and `formatDharma` never abbreviates — so a long enough figure
 * makes row 1 wider than the tile, and the panel's `overflow: clip` is what stops
 * that reaching the document (measured at MOBILE-2h: 328px of row against 278px
 * available at 360, and with the clip released the layout viewport widened
 * 360 → 369).
 *
 * The ruling is that **the movement chip is the element that yields, and the side,
 * the value and SELL never do.** A value is the figure the reader came for; SELL
 * is the action; the side is what the position IS. The movement is the only one of
 * the four that can be read from the figures on the other tabs.
 *
 * ⛔⛔ **A DATA RULE, NOT A LAYOUT OBSERVER, AND THE DIFFERENCE IS LOAD-BEARING.**
 * The obvious implementation measures the rendered row and drops the chip when it
 * does not fit. That needs a `ResizeObserver` — which ADR-0051 A6's brief forbids
 * on this surface by name — and it is a mechanism that can only act AFTER a frame
 * in which the row was already too wide. Keying on the formatted STRING decides on
 * the server, in the first frame, with no observer, no measurement at runtime and
 * no hydration flip: the length of `formatDharma(value)` is known before a pixel
 * is painted.
 *
 * ⚠ **AND THE TIER GATE IS CSS, NOT THE HOOK.** The rule decides WHETHER the chip
 * can be hidden; `max-mobile:hidden` decides WHERE. Using `useIsPhoneTier()` to
 * decide the markup instead would render the chip on the server (the hook's server
 * snapshot is `false`) and remove it on hydration — a visible flicker on the one
 * line the reader is looking at. A `max-mobile:` class cannot match at or above
 * 640px, so the desktop keeps its chip at every value BY CONSTRUCTION.
 *
 * ⚠ **`tabular-nums` IS WHAT MAKES A CHARACTER COUNT AN HONEST PROXY FOR WIDTH.**
 * The value renders with it, so every digit has the same advance and a string's
 * length maps to its width linearly. The grouping comma is narrower than a digit,
 * which makes the count CONSERVATIVE — it never under-estimates the width — and
 * that is the safe direction for a threshold.
 */
/**
 * The longest `formatDharma` output that still fits on one line at 360px **with
 * the movement chip beside it**. MEASURED on the live page at MOBILE-2j, not
 * chosen; the run is in `docs/plans/MOBILE-2j.md` and the numbers are:
 *
 * ```
 * 360px   tile content width 278   side 58   SELL 59.7   column gap 8
 *   money line needed, at the widest plausible chip label (`1000%`):
 *     3 chars (Đ 999)      242.1  ✓        6 chars (Đ 14,260)   269.3  ✓
 *     5 chars (Đ 9,999)    257.8  ✓        7 chars (Đ 100,000)  280.7  ✗
 * ```
 *
 * ⛔ MEASURED AGAINST THE WIDEST CHIP, NOT THE ONE ON SCREEN, AND THAT IS THE ONLY
 * DIRECTION THE ERROR CAN SAFELY GO. `move.label` is `<1%` or `<n>%` and its width
 * varies — the fixture's `<1%` is 36.1px and a `1000%` is 51.1px — but a rule keyed
 * on the VALUE cannot see it. With the chip as rendered the answer is 7; with the
 * widest it is 6, and 6 is what ships. ⚠ THE RESIDUAL IS NAMED RATHER THAN HIDDEN:
 * each extra character of label costs 7.5px, so a SIX-character label (`99900%`, a
 * thousandfold gain) beside a six-character value needs 276.8 against 278 — it
 * fits, by 1.2px. A seven-character label would not, and would be clipped at the
 * SELL edge. `docs/parked.md` 2j-1.
 *
 * ⛔ MEASURED AT THE NARROWEST WIDTH THE LANE SUPPORTS AND APPLIED AT ALL OF THEM.
 * That is what "data rule" means: the same value renders the same way on a 360px
 * phone and a 430px one. At 412 the tile has 330px and every realizable length
 * fits with the chip — a per-width answer would be a layout observer wearing a
 * constant, and would make the same position look different on two phones.
 *
 * ⚠⚠ **IT DOES NOT FIRE AT THE VALUES THE RULING PREDICTED, AND THE STEP-DOWN IS
 * WHY.** MOBILE-2j's brief expected `Đ 9,999` and `Đ 14,260` to lose their chip;
 * both keep it. That prediction was formed against MOBILE-2h's tile, whose money
 * line was 24/24/13px inside the same 278px — where `Đ 14,260` genuinely did not
 * fit and was the measured cause of a page-wide horizontal scroll. At the list's
 * 18/18/11px it clears by 8.7px. The rule is unchanged and correct; the width at
 * which it engages moved, because the type did.
 *
 * ⚠ RE-MEASURE IT IF ANY OF FOUR THINGS MOVES: the money line's type sizes, the
 * SELL trigger's padding, the tile's horizontal padding, or the panel's own. It is
 * a number about a specific composition, and nothing in the type system knows that.
 *
 * ⚠ ONLY SEVEN LENGTHS ARE REACHABLE AT ALL, which is worth knowing before tuning
 * this by one. `groupInteger` always groups, so an output is 1–3 characters
 * (Đ 1–999), 5 (Đ 1,000–9,999), 6, 7, then 9 — never 4 and never 8.
 */
export const PHONE_MONEY_LINE_MAX_VALUE_CHARS = 6;

/**
 * Does the movement chip fit beside this value at phone width?
 *
 * `true` ⇒ render it. `false` ⇒ it is the thing that yields.
 *
 * ⚠ `<=`, NOT `<`. The constant is the longest length MEASURED TO FIT, so the
 * comparison that matches the measurement includes it. Reading the ruling's
 * "shorter than that" as a strict `<` would drop the chip from a value proven to
 * have room for it.
 */
export function phoneMoneyLineFitsMovement(valueDisplay: string): boolean {
	return formatDharma(valueDisplay).length <= PHONE_MONEY_LINE_MAX_VALUE_CHARS;
}
