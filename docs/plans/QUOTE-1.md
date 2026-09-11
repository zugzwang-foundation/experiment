# QUOTE-1 — the title-as-quotation well

> **Status:** executing · **Date:** 2026-09-11 · **Author:** web Claude (brief) / Claude Code (execution) · **Plan commit:** PLANSHA
> **Criticality:** ORDINARY (OPERATING.md §4: surfaces). Carried proof obligation: SC-1 — a removed post renders no well.

## 1 · Approach

An imageless top-level post renders its derived title as a fixed 545 × 272 picture — an inline SVG whose `foreignObject` carries the HTML — mounted in `PostCard`'s `.argimg` cell, scaling like an attachment. The plain title row does not render on such posts; `Know more` moves under the well. The title's size is a pure function of its length against measured font metrics, fitted to the canvas; the quotation marks are decoration sized off the title. QUOTE-1 A (PR #513) stripped the mockup placeholder; this is kind 2's permanent exit on the card. `ReplyCard` keeps the null arm by ruling; the post-focus hero is owed at C2.

## 5 · Failure modes

- Short viewport → the canvas scales (`max-width`/`max-height` 100%), verified at 1440 × 900 and 1440 × 1400 on the preview.
- Title taller than the estimate (wide glyph runs, non-Latin fallback faces) → clips inside the canvas at the last full line; nothing escapes; recorded in C-QUOTE-1 §6.
- Well on a removed post → the SC-1 guard reds.
- Title rendered twice (row + well) → the single-occurrence assertion reds.
- `text-wrap: balance` unsupported → greedy wrapping, same sizes, within the estimate's slack.
- Hydration → the well is server-rendered from `post.title` only; no state, no effects, no client directive.
- No preview → local `next start` against `stg`, read-only.

## 7 · Out of scope

Post-focus hero (C2) · ReplyCard · the pop-up · the composer · the export · any server change · any token mint · script-aware sizing for non-Latin titles (parked) · the `__PROBE_TEMP__` probes in the shared checkout (another session's) · the stale prose in zz_QUOTE-1_AB §E.3 (close-out).

---

## 8 · Execution addenda (Claude Code, 2026-09-11)

Recorded here rather than only in the report, because each is a thing a later reader
of this plan would otherwise have to re-derive. **None changes §1's approach.**

**A · The two font constants, measured.** `GEIST_UPPER_ADV = 0.6015` (mean of
0.6064 at 75 chars and 0.59656 at 125, `scrollWidth / (chars × 100)` at 100px/700
with 0.02em tracking) · `GEIST_QUOTE_INK = 0.311` · `GEIST_QUOTE_TOP = 0.129` for
`“` and **0.145** for `”`. Read off the deployed Geist latin subset in headless
Chrome 152, gated on `document.fonts.status === "loaded"` in the same evaluation
as the geometry, and checked scale-invariant at 100 / 200 / 1000 px. ⚠ §1's
approach assumed ADV ≈ 0.70; the shipped face is 14% narrower, so the size table
runs **56 · 53 · 41 · 33 · 28 · 27** at 10 / 25 / 50 / 75 / 100 / 125 chars rather
than the brief's illustrative figures. The two marks needing two constants is §5's
"wide glyph runs" concern arriving at 0.016 em rather than as a clipped title.

**B · §5's `text-wrap: balance` row is the wrong way round about the clamp.** It
reads *"`text-wrap: balance` unsupported → greedy wrapping, same sizes"*, which is
true and is not the live failure. Measured: balance IS supported, and a
`-webkit-line-clamp` belt **silently disables it** while `getComputedStyle` keeps
reporting `balance` — and only when the clamp actually bites, so an A/B at the
natural line count looks clean. The clamp is therefore not shipped; the well's
`overflow: hidden` is what §5's clipping row rests on.

**C · §5's hydration row is half true, and the half that is false is the reassuring
half.** `PostCard` is `"use client"`, so the well renders on BOTH passes, not only
the server's. Everything the row depends on still holds — no state, no effects, no
client directive, a pure function of `title` — which is precisely why the client
pass is identical. Stated because "server-rendered only" would be read as a
guarantee that the client never re-renders it.

**D · The composition costs an imageless card its `onEnter` control, and §1 does
not say so.** Row 23 had already deleted `Open debate →` from the present branch
*because* the title carried that destination, so deleting the title row leaves the
footer's Support/Counter pills — themselves gated on `marketOpen`/`suspended` — as
the only way in. The build wraps the well in the same `onEnter` button the row
used. ⛔ **The pre-existing suite arbitrates this.** Every test in
`post-arm-headers`, `history-ladder` and `posted-jump` that enters a post by
clicking the title heading's enclosing button reds on the literal composition and
greens on this one, and not one of them is about the title row. **22 failing
tests — 15 / 6 / 1 by file**, reproducible by reverting the button and re-running
those three files. ⚠ Counted as failing TESTS: a `@code-reviewer` pass counted
CALL SITES instead (8 / 7 / 1 = 16, an upper bound, since one site can serve
several tests) and read the figure as unsupported. Both are right about different
quantities; the one that matters is what goes red. Pending founder ratification —
QUOTE-1 C report §7 OD-1.

**E · `pad: 24` is the total inset, border included.** `border: 1px` +
`padding: 23px`. Read as 24px of padding inside the border, the content box is
495 × 222 and every budget in §1 is optimistic by 2px on an `overflow: hidden`
box — i.e. wrong in the direction that clips ink.

**F · Scope: one file beyond §7's list.** `tests/unit/debate/render/post-card.test.tsx`
pins the title row against an imageless fixture, so two of its tests were
re-pointed at the image arm (a change of FIXTURE, not of claim — both assertions
are unchanged). Report §3.2 enumerates it.
