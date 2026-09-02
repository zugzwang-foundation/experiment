# BLOCK-3 — session log

Attended. Branch `feat/block-3-resolution-refinements`, PR #452 (open,
unmerged per the task's own instruction). Per MKT-SLATE content-block
manifest v1.1 (founder-ratified 2026-09-01).

**What landed** — 6 commits, in dependency order rather than the prompt's
literal §1→§2→§3→§4 listing (§4 landed second, §3 landed before §2, for
reasons recorded below):

1. `921cc30` — §1, the enabler: `MarketMediaPanel`'s frame moved from
   `h-full w-auto` (width derived from the header band's height) to
   `w-1/3 self-start` (width derived from the row). Fixed the root cause —
   text column was a function of viewport HEIGHT, not width, and collapsed
   to zero at 390×844.
2. `60463ed` — §4, strings: `resolution-block-data.ts` updated per v1.1's
   redefinition of RESOLUTION. Landed before §3 because §3 needed real
   content in the map to measure font sizes against.
3. `0a60996` — §2+§3 combined: §3's per-block ink font-sizing (measured
   against §1's fixed column) and §2's block-height reduction landed in one
   commit because they touch the same three dimensions (glyph size, padding,
   text column width) and each needed to cite the other's reasoning.
4. `d6fb879` — an emergent fix found during §2's browser verification, not
   requested by name in the brief: at ≤640px viewports the glyph (36px) plus
   the block's own padding already exceeded the block's total width, driving
   every value/label to `scrollWidth 0` — invisible, not truncated. Fixed by
   hiding the decorative glyph below `sm`.
5. `d3e74f0` — §2 widened the block's text column (79px→91px) as a side
   effect of shrinking the glyph; re-measured every §3 font size against the
   new column before shipping rather than leaving the first pass's numbers
   in place. Every "Response on X" RESOLUTION moved 11→13px, and the one
   entry that had been sitting at the 11px floor and still truncating
   (`math-erdos-contribution-response`'s `@thomasfbloom`) now fits cleanly
   at 12px. No entry ships at the floor.
6. `00d6c50` — §5 guards: two gaps found during the revert-to-red pass, both
   fixes that had landed with only a browser measurement behind them and no
   class-level regression test — the §1 enabler's own `w-1/3 self-start`
   mechanism, and a DOM-level (not just data-level) guard for FLAVOUR
   sentence case surviving to render.

**Decisions made**:
- Execution order deviated from the prompt's literal 1→2→3→4 listing
  (actual: 1→4→3→2) — §4 needed to land before §3 (font-fitting needs real
  content), and §3 before §2 was a judgment call that turned out to create
  rework (§2 widened the column §3 had already fit against) but never broke
  anything, since a wider column can only let more sizes fit, never fewer.
  Corrected by re-measuring before shipping (commit 5) rather than leaving
  the first pass's now-suboptimal numbers in place.
- Two `AskUserQuestion` decisions from the founder, both during §1/§2's
  browser verification: (1) the global header's own pre-existing 390px
  overflow (from `visitor-counter`, `GlobalHeader.tsx`) — ruled to leave
  alone, report only, once its own docblock surfaced that "no responsive
  breakpoints" is a ratified design decision, not a bug; (2) a price-chart
  rail crowding the resolver row at narrow stacked viewports (166.4px of a
  204.2px band, unreachable at BLOCK-1's time since no market had a
  renderable chart then, real now that two of eight do) — ruled to fix in
  this PR, done by extending the chart's existing hide-below-`lg` pattern.
- The glyph-hide-below-`sm` fix and the fontSize re-optimization were both
  self-directed (task said "mechanism is your call" for §1's spirit, and
  neither had a founder ruling to cite) — found and fixed in-session per
  CLAUDE.md's "same-commit doctrine: fixes to guardrail mechanisms are
  absorbed in-session, never deferred," not flagged as open questions.

**Open questions** — none. The two `AskUserQuestion` items above are the
only genuine forks this task hit, and both are resolved and shipped.

**Next session starts at** — nothing queued against this branch. PR #452 is
open, unmerged (per the task's explicit instruction), CI in progress at
close of this session — verify its conclusion before merging, not just that
it was triggered (CLAUDE.md §5.13: CI green is a thing to check, not a gate
to lean on).

**Context to preserve**:
- The text column at 1440×777/900 is now 91px (was 79px pre-§2) — any
  future font-size measurement against this row should start from that
  number, not the stale 79px still cited in a few historical docblock
  paragraphs (deliberately left as dated history, not corrected in place,
  per O-4).
- Three split-bar surfaces are now coupled by an existing test
  (`split-bar-parity.test.ts`) reading the canonical thickness off
  `PriceBar.tsx`'s `detail.bar` rather than a copied literal: `PriceBar`
  itself, `AggregateFooter`'s Support/Counter track, and
  `ReplySplitBar`'s copy. A future resize of `detail` should redden that
  test first and move the other two deliberately, not by accident.
- `min-h-[78px]` on the resolver-block row is a re-derived floor (was 84px)
  against the current padding/glyph recipe; if §2's recipe changes again,
  re-derive it rather than trusting the number (its own docblock has the
  arithmetic).

**Time** — single attended session, 2026-09-01.
