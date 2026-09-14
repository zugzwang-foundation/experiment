# MOBILE-2h — the profile's positions become tiles; the sell sheet grows up

**Lane** `feat/mobile-2-market-detail` · **ground tip** `9e12fb0d` (= `origin/main`
= `origin/staging`, fast-forwarded from `7166b4b1` so the morning staging push is a
fast-forward) · **ADR** 0051 A5 (appended verbatim from the brief; A4 D-3 superseded).

Scope: `/u/[pseudonym]` **below 640px only**. `/m/[slug]` is untouched. Desktop is
pixel-identical at ≥640 on both routes (B1-p = 0/0/0), which is structural — every
token added is `max-mobile:`-prefixed and cannot match at or above the tier boundary
— and is measured anyway.

## The measurement that decided the shape

The brief says the snap goes "on the page's EXISTING scroller". Measured at the ground
tip, at 360/390/430, signed in:

| release applied | a tile's nearest scroll container | snap landing |
|---|---|---|
| none (tiles made viewport-tall) | `positions-panel-body` | 1058 / 1103 ✗ |
| + `positions-panel-body` overflow visible | `positions-panel` | 1058 / 1103 ✗ |
| + `positions-panel` overflow visible | **VIEWPORT** | **1103 / 1103, tile top = 62 ✓** |

So the page's scroller IS the document, and reaching it needs BOTH overflow releases.
A fourth release was found the same way: the panel resolved to exactly three tiles'
height because `PositionsTable`'s `ROW_WINDOW` `max-height` cap has no tier gate and
its own `ResizeObserver` re-applied it the moment the tiles grew.

## Items

- **R-1 · the positions head on one line.** Measured defect at 360 with a market
  selected: the filter button is **301px inside a 45px wrapper** and overflows the
  panel by 91px, painting under the pills so `Closed (1)` is unreadable. Cause: the
  wrapper is `display:block`, so the button is an INLINE-level box, not a flex item —
  `max-mobile:shrink` on it reaches nothing and `truncate` inside measures against
  301px. Fix: cap the button to its wrapper (`max-mobile:max-w-full`) so the shipped
  truncate bites, and step the type down so all four clear at 360.
- **R-2 · the tile.** `<tr>` becomes a `max-mobile:grid` of `[auto 1fr auto] / [auto 1fr]`
  — side col 1, value col 2 (`justify-self-end`), SELL col 3, argument spanning row 2
  and stretching. Grid rather than flex because the four `<td>`s are fixed in DOM order
  and only grid can place them without opening the markup. Height
  `max-mobile:min-h-[calc(100dvh-60px-2px)]` — `<main>`'s own shipped expression, the
  viewport minus the sticky header's 60px row and 2px border; a `min-h`, so a long
  question grows the tile instead of clamping it. The ONE GAP is `mt-auto` on the market
  line inside the argument cell, so the leftover height has exactly one place to live.
- **R-3 · no selected visual below 640.** `max-mobile:bg-transparent` +
  `max-mobile:hover:bg-transparent` beside the existing `max-mobile:[outline:none]`.
  Selection STATE is untouched — `aria-current`, `tabIndex` and the sell sheet's target
  all still read it.
- **R-4/R-5 · the sheet.** `InlineSellAmount` gains a `variant` prop defaulting to
  `"row"`, so the desktop instance is byte-identical and the sheet gets 32px. Label
  above value, both centred; CONFIRM keeps `w-full` and goes `h-11` → `h-12`.
  `useInlineSell`, the wire figure and the ceiling are not touched.

## What stands down at phone width

| mechanism | how |
|---|---|
| `useEqualRowThirds` | its `enabled` option — already `!isPhoneTable` at the ground tip |
| the `ROW_WINDOW` `max-height` cap | new tier gate, clearing on the way out |
| `positions-panel` / `positions-panel-body` scroll containers | `max-mobile:overflow-visible` |

## Guards rewritten

`profile-mobile-reflow` (the tile-is-a-row row, the cell-share row), `phone-round-five`
(the tile-row row, the Open-tab cell shares, the Closed-tab cell shares — DELETED per
the brief, the layout it patched is gone). Every rewrite is reversal-verified.
