# MOBILE-2j — the tile goes back to a list; the sell sheet's number becomes the input

**Lane** `feat/mobile-2-market-detail` · **ground tip** `0bf77e28` (7 commits ahead of
`origin/main` = `9e12fb0d`, 0 behind, clean) · **ADR** 0051 **A6**, appended verbatim
from the brief; A5 D-1 withdrawn, A5 D-2 and D-3 stand.

Scope: `/u/[pseudonym]` **below 640px only**. `/m/[slug]` untouched. Desktop
pixel-identical at ≥640, which is structural — every token this round adds or removes
is `max-mobile:`-prefixed and cannot match at or above the tier boundary — and is
measured anyway.

## The ruling this reverses, and why the guards are INVERTED rather than deleted

MOBILE-2h made each position one visual viewport tall and snapped through them. The
founder walked that build and rejected it. So this round is mostly a **deletion**: the
height, the snap alignment, the scroll margin, the distributed gap inside the argument
cell, and the page-level snap type on `<html>`.

⛔ **A deleted guard lets the withdrawn shape come back in silence.** Every row that
required one of those tokens now FORBIDS it — `phone-position-tile.test.ts` and
`profile-mobile-reflow.test.ts` both. That is the only way a withdrawal holds: the
revert is what reddens.

⚠ **The grid survives all of it**, because its reason was never height. The four
`<td>`s are fixed in DOM order at side · argument · value · Sell and the composition
wants the argument BELOW the other three; `flex-wrap` cannot (a wrapped line's cross
size comes from `align-content`, which stretches every line equally) and `order` moves
items within lines, not lines.

## The measurement that set the one new constant

The long-value rule needed a number, and the brief says to measure it. At the finished
tree, signed in, against the local QA database:

```
360px   tile content width 278   side 58   SELL 59.7   column gap 8
  money line needed, chip forced to its widest plausible label (`1000%`):
    3 chars (Đ 999)     242.1 ✓      6 chars (Đ 14,260)   269.3 ✓
    5 chars (Đ 9,999)   257.8 ✓      7 chars (Đ 100,000)  280.7 ✗
  with the chip AS RENDERED (`<1%`, 36.1px) the answer is 7; with the widest, 6.
  6 ships — a rule keyed on the VALUE cannot see the label, and conservative is the
  only direction in which the error is safe.
```

⇒ `PHONE_MONEY_LINE_MAX_VALUE_CHARS = 6`, in `src/components/profile/money-line.ts`.

⚠⚠ **IT DOES NOT FIRE AT THE VALUES THE BRIEF PREDICTED, AND THE TYPE STEP-DOWN IS
WHY.** The brief expected `Đ 9,999` and `Đ 14,260` to lose their chip. Both keep it.
That prediction was formed against MOBILE-2h's 24/24/13px money line inside the same
278px, where `Đ 14,260` genuinely did not fit and was the measured cause of a page-wide
horizontal scroll. At this round's 18/18/11px it clears by 8.7px. The rule is built as
ruled and is correct; the width at which it engages moved because the type did.

## Items

- **R-1 · the tile returns to a list.** Deleted: `max-mobile:min-h-[calc(100dvh-60px-2px)]`,
  `snap​-start`, `snap​-always`, `scroll​-mt-[62px]` on the `<tr>`; `snap​-y snap​-proximity`
  on `<html>` (which is now byte-identical to its pre-2h form); `mt-auto` + `pt-3` on
  the market line; `self-stretch` on the argument `<td>`; `h-full` on both argument
  spans. Kept: the grid and both track lists, the hairline, `py-2.5`, the no-selected-
  visual rule, and the section's `overflow: clip` + `min-w-0`.
  Type steps down with the height: side 24 → 18 (and its glyph with it), value 24 → 18,
  movement 13 → 11, SELL 16 → 12 (its 44px floor untouched), argument title 18 → 15
  medium, Closed tab's Staked 24 → 18 and its two eyebrows 13 → 11. The row gap becomes
  the ruled `gap-y-[7px]` and is the tile's ONLY gap — the question sits directly under
  the title, where it sits at every width above 640.
- **R-1a · the long-value rule.** A DATA rule, not a layout observer: the movement chip
  renders only while `formatDharma(value).length <= 6`. Decided on the server from the
  formatted string, applied as `max-mobile:hidden` so the desktop keeps its chip at
  every value by construction and nothing flips on hydration.
- **R-2 · the sheet's amount.** The bordered chip is gone: no border, no radius, no
  padding, no focus ring, in either state. `Đ` and digits both 48px `font-mono`
  `text-ink` — one visual unit. Left-aligned, width tracking content in `ch` with a 2ch
  floor, so the caret sits after the last digit. `inputMode="numeric"` + `pattern="[0-9]*"`
  in the sheet only. The ceiling is stated beneath it as `of Đ <holding>`, and the
  `Current` overline above it goes.
- **R-3 · the sheet's type.** Argument title 15 → 17px, market question 11 → 13px, both
  clamps unchanged. CONFIRM unchanged.

## The panel's two boxes part company

| box | MOBILE-2h | MOBILE-2j | why |
|---|---|---|---|
| `positions-panel` (section) | `max-mobile:overflow-clip` + `min-w-0` | **unchanged** | the clip was never about snapping — it is what stops a long money line reaching the document as horizontal scroll |
| `positions-panel-body` | `max-mobile:overflow-visible` + `min-w-0` | **reverted to plain `overflow-y-auto`** | its only purpose was to leave the snap chain, and there is no snap chain. Nothing gives it a definite height below 640, so it cannot overflow itself and the list scrolls with the PAGE |

⚠ With the snap withdrawn, `clip` and the inherited `overflow-hidden` are equivalent on
the section. The override is kept because A6 D-1 names the containment, and the file
says in terms that it is belt rather than mechanism — a token carrying a dead reason is
the defect this codebase records most often.

⚠ The three-tile `max-height` cap and `useEqualRowThirds` both KEEP their tier gates.
What makes the cap fire was never the tile's height but that the page SCROLLS, and a
list of three-line tiles under an identity card scrolls at every phone width too.
