# HTML-FINISH · DISCOVERY · PARITY — session log

**Branch** `htmlfinish/discovery-parity` · **base** `b7c2a380cb465e4905dc7ccbd98d24c0f497663d`
**Ran unsupervised**, 2026-08-15. Plan authored before any JSX: `~/Downloads/HF-DISCOVERY-PLAN.md`.
⛔ **DO NOT MERGE** — a human reads the diff.

---

## What landed

Three implementation commits + this one. 12 files, **all inside the §2 allow-list; zero outside**.

| Commit | Rows | Files |
|---|---|---|
| `08e138b` | **C1 · THE GRID** — 1, 4, 5 | `MarketCard.tsx` · `DiscoveryGrid.tsx` + 4 test files |
| `bb080da` | **C2 · THE HERO PANELS** — 2, 6, 7 | `HeroPanels.tsx` + 2 test files |
| `7ec0cc9` | **C3 · THE HEIGHT CHAIN** — 8, 9 | `layout.tsx` *(fenced)* · `page.tsx` · `DiscoveryCarousel.tsx` · `DiscoveryGrid.tsx` · `HeroPanels.tsx` + 1 test file |
| *this* | **C4 · GUARD + DOCS** — 10 | `POLISH-register.md` (PD-2-35) · this log |

Per-row outcome: **9 implemented · 1 struck (row 3) · 0 halted · 0 anchors lost.**

---

## Decisions made

**1 · The recon was stale in its premise, not its content.** The kickoff warned line numbers had
moved under PR #333. They had not: `git diff --stat 9be5d1c b7c2a38` shows #333 touched 15 files and
**not one is a Discovery file**. All ten anchors re-resolved at their recorded coordinates. Verified
by opening each file, not by trusting the diffstat.

**2 · Row 4 moved two guard hooks. Both carried; neither dropped.**
- `emphasis-ladder-tokens` CONSUMERS census re-pointed `DiscoveryGrid.tsx` → `MarketCard.tsx`. A
  **census update, not a weakening** — the block documents itself as *"re-measured at this commit's
  head"*, and every assertion is preserved: exact count 1, literal still banned, whole-tree
  `the-literals-survive-nowhere-in-src` scan untouched and still reaching the new file.
- `data-testid="grid-ring"` is **retired, not dropped**. Its element no longer exists and the tile
  that replaces it already carries `data-testid="market-card"` (one element, one testid). Every
  guarantee is carried verbatim into `expectActive`. It is now **strictly stronger**: it proves the
  ring is *on the tile*, where the old form could pass with the outline on a different box from the
  `data-active` attribute.

**3 · Row 2's colour and glyph provenance.** `text-n3` on the row-6 separator is taken from
**shipped code** — `StatLine.tsx` already ships `<span className="… text-n3">|</span>` for this exact
glyph in this exact role ("V27 — an explicit n3 separator"). The mockup's `.vsep{color:var(--n3)}` is
**not** the source: the ramps are inverted and name-porting across them is the failure `side-pole-
binding` and V7/V42 exist to prevent.

**4 · Canon §3 item 6, quoted as instructed and not re-litigated:** *"**Pick / carousel-select is
view-only** — never mutates a position."* It governs **position mutation**. Navigating to `/m/[slug]`
mutates nothing.

**5 · Row 2 built as a real `<Link>`, not a stretched link.** The side panels' `after:inset-0`
workaround exists **only** because those panels contain a second, independent author anchor and
anchors cannot nest. The market panel contains none — thumb, `<h2>`, `StatLine`, `PriceSparkline`,
`PriceBar` all grepped anchor-free — so the simple whole-element form is available and used, matching
`MarketCard`. The side panels are untouched.

**6 · Row 10 filed as `routed`/`open`, deliberately NOT `accepted-divergence`.** The register's own
§"How to use this" reserves that value to the founder (P12). Recording a divergence as deliberate is
not the same act as ratifying it. **PD-2-35**, founder ratification requested.

---

## Row 3 — STRUCK, and the strike is sound

> "Drop the bold headline above the argument in the side panels."

Ground **verified against the mockup, not accepted on assertion**: its own header declares the gap —
*"Known render gap: post panels show body only — the title+body post structure (SCL-1) patches the
post primitive at the DESIGN.5 lock and back-propagates here at refine"* (`:11-13`). The build renders
real `post.title` data. Deleting shipped information to match a prototype that documents itself as
behind is backwards. **The strike does not look wrong to me — no halt.** Not implemented in any form;
row 7 quotes the teaser only, and a test asserts the headline is **not** wrapped so row 7 cannot be
over-applied to it.

---

## Surprises caught + fixed in-session

**S-1 · The "green baseline" was a false receipt — my own gate command lied.**
I opened with `just verify` backgrounded as `cmd > log; echo EXIT=$? >> log; tail -3 log`. The harness
reported **exit 0** and I stated the baseline was green. It was **254**: `node_modules` was empty in
this worktree and `tsc` was never found. The 0 was `tail`'s. This is `feedback_gate_commands_never_
pipe_to_tail` one variant over — the trailing command owns the compound exit code, whether it is a
pipe or a `;`. Fixed: `CI=true pnpm install --frozen-lockfile`, then every gate run as its own
statement with `echo EXIT=$?` immediately after and **no** trailing command.

**S-2 · A fresh worktree has no `.env.local`, so `next build` cannot collect page data.**
`Error: DATABASE_URL is not set` at `/m/[slug]/export`. Resolved with the placeholder env
`tests/_setup/env.ts` already ships (vars **set**, not connected). ⛔ No real `.env*` was read, copied
or written. True baseline then measured: **`just verify` exit 0**, vitest 18 files / 133 tests green.

**S-3 · Row 8's first subtrahend was wrong by exactly two pixels — a permanent scrollbar.**
`calc(100vh-60px)` assumed the header is its `h-[60px]` inner row. Its **border-box is 62px**:
`h-[60px]` + `border-y` (1px top + 1px bottom). The page overflowed by 2px, so a page that *fits*
would have shipped with a scrollbar on every load. **Caught only by measuring the real compiled CSS
in a browser** — invisible in the diff, invisible to every test, and invisible to my own first
(hand-mapped) probe. Corrected to `calc(100vh-60px-2px)`, written as its two shipped contributors so
the provenance is legible; Tailwind folds it to `calc(100vh - 62px)`.

**S-4 · `min-h-full` on the `(public)` wrapper is inert.** `min-height:100%` against a parent whose
own height is min-height-driven resolves to `auto`. Measured: in a 777px viewport that column was
**510px**. So `flex-1` on `<main>` had no slack to divide — row 8's clause 1 could not be delivered by
flex alone, which is why the viewport-derived floor is on `<main>` and why row 8 still fits its fence.

---

## Verification

`just verify` run **before each commit**, unpiped, exit code captured directly.

| Gate | Result |
|---|---|
| `just verify` (typecheck → biome → next build) | **PASS** before C1, C2, C3, C4 |
| `vitest tests/unit/ tests/server/discovery/` | **126 files / 1687 tests PASS** |
| `side-pole-binding` · `pct-round-render` · `no-raw-hex-view-layer` · `tokens-monochrome` · `emphasis-ladder-tokens` | **all green, none weakened or skipped** |

**Row 8/9 measured live against the real compiled Tailwind CSS**, 971px viewport:
- **Fits:** col 971 = viewport · main 910 · hero 611 (absorbed the slack) · graph 485 (floor 96px) ·
  rail 18 (fixed) · grid 236 (content) · `scrolls: false`.
- **RULED A1, tiles forced past the viewport:** `docScrollH` 1197 > 971, `scrolls: true`, last tile
  fully laid out at its full 420px, hero correctly giving the slack back (611 → 221), `overflow-y`
  computed `visible` on `html` and `body`, and **zero** elements in the chain carrying
  `overflow:hidden`. **The page scrolls; it never clips.**
- Row 9 invents nothing: compiled CSS proves `h-24` and `min-h-24` both emit
  `calc(var(--spacing) * 24)` = **96px**. Same number, different property.

**VALUES — confirmed: zero colours, px, rem, font sizes or durations taken from the mockup.**
Every number introduced traces to shipped code: `60px` + `2px` = `GlobalHeader.tsx`'s `h-[60px]` and
its `border-y`; `min-h-24` = the pre-existing `h-24`; `text-n3` = `StatLine.tsx`'s shipped separator.
The only bytes carried from the mockup are the two **glyphs** rows 6 and 7 explicitly require, both
hexdumped: `0x7C` (U+007C) and `0x22` (U+0022) — not colours or measurements.

---

## Open questions

1. **PD-2-35 needs a founder disposition.** Filed `routed`/`open`; only the founder may set
   `accepted-divergence` (P12).
2. **PD-2-08 is unchanged and still awaits its Gate C ruling.** The active-ring colour call (n4) moved
   files with row 4; the ruling it is waiting on did not move with it.
3. **Was the rationale comment in `layout.tsx` inside the fence?** The fence permits the `<main>`
   element's className "AND NOTHING ELSE IN THAT FILE". I added a JSX comment *attached to that same
   element*, on the reading that documenting the one permitted change is not "a second thing" — and
   that shipping a bare `calc(100vh-60px-2px)` with no provenance would be worse and against this
   repo's documentation discipline. **Flagged rather than assumed; object if that reading is wrong.**
   Nothing else in the file was touched — the diff is one removed line and one replaced element.

---

## Widenings — RECORDED, NOT IMPLEMENTED

1. **A `--header-h` token** would remove the `60px-2px` coupling between `layout.tsx` and
   `GlobalHeader.tsx`. Needs `globals.css`, outside the allow-list.
2. **`PriceSparkline`'s `size="card"` preset has no consumer** now that row 1 removed the tile chart —
   the hero is the only caller. `price-sparkline.test.tsx` still exercises the preset directly, so
   nothing is red. Removing it is a separate cleanup.
3. **`market-thumb.test.tsx`'s docblock coordinates** (`MarketCard.tsx:51-55`) drift by row 1's
   deletion. Per **O-8** fences are by symbol; these are prose evidence lines, not fences. Not chased.

---

## PERF-1 — observation only, no server file touched

⛔ **No `src/server/**` file was read into this diff.** Observed while removing the tile chart: the
grid's series fetch is **unchanged and still runs**. `DiscoveryMarketView.series` is still populated
per market by `loadPriceSeries` in `page.tsx`'s `DiscoveryContent` loop, and is still consumed — by
the **hero**, which renders one series per carousel position. So row 1 removed **eight renders** of
that data but **zero reads**: the 1 + 12N round-trip shape is untouched, exactly as the kickoff
fenced. A future PERF-1 pass should note that the series is now needed for **one** market at a time
(whichever the carousel is showing) while it is still fetched for **all eight** up-front — but the
carousel is client-side motion over pre-loaded props (§22, "no re-fetch"), so making that lazy is a
**data-loading architecture change**, not a tidy-up. Recorded, not acted on.

---

## Next session starts at

**Human review of the diff** (`~/Downloads/HF-DISCOVERY-DIFF.patch`), then the founder rulings on
**PD-2-35** and **open question 3**. ⛔ Do not merge before that read.

## Context to preserve

- `just verify` in this worktree needs the placeholder env (S-2) **and** `pnpm install` — a fresh
  worktree has neither. Gate commands must not end in `tail` (S-1).
- Row 8/9 are only provable in a **browser against compiled CSS**; the render suites structurally
  cannot see a 2px overflow (S-3).
- The mockup is `485` lines, md5 `68c65bd781df4fb564727d2f0ed83e77`, verified unchanged at both
  `9be5d1c` and `b7c2a38`.

## Time

One unsupervised session, 2026-08-15.
