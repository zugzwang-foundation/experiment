# BLOCK-4 — session log

Attended. Branch `feat/block-4-single-line-blocks` off `origin/main` at
`7155cf1` (BLOCK-3, merged as #452). PR #454, open and unmerged per the
task's own instruction. Desktop only — nothing below 1024px was measured,
changed or reported, per the brief's permanent scope ruling.

**What landed** — one commit, `db3a897`, six files.

`src/components/debate/resolution-block-data.ts` · `ResolverCards.tsx` ·
`MarketHeader.tsx` · `tests/unit/debate/resolution-block-data.test.ts` ·
`tests/unit/debate/render/resolver-cards.test.tsx` ·
`tests/unit/debate/render/market-header.test.tsx`.

⚠ **ONE COMMIT RATHER THAN BLOCK-3's SIX, AND IT IS A CONSTRAINT RATHER
THAN A PREFERENCE.** §1 (content) and §2/§3 (geometry) both edit
`resolver-cards.test.tsx`, so splitting them means either a RED
intermediate commit or hand-reconstructing a half-edited test file.
Neither is worth a tidier history. BLOCK-3's six commits reflected work
that genuinely arrived in stages; this arrived together.

- **§1 · data.** Every `line2` in the map is `null` — 32 entries, eight
  markets × four blocks. `oktoberfest` RESOLUTION → `oktoberfest.de` (loses
  `report`), RESOLVER → `Oktoberfest` (loses `management`); `github`
  RESOLVER → `GitHub` (was `Zugzwang` / `repo`, href byte-unchanged);
  CLOSES loses `23:45Z` on seven and `21:59Z` on oktoberfest. FLAVOUR:
  `claude-bundle-response` `Suggestion` → `Feedback`,
  `bitcoin-price-50k` `Barrier` → `Sentiment`. Every date untouched.
- **§2 · height.** The block row stops being `flex-1`; floor re-derived
  `min-h-[78px]` → `min-h-[54px]`; `mt-4` dropped. **122.76px → 54.00px**
  at 1440×900.
- **§3 · spacing.** `headzone-stack` `gap-[5px]` → `gap-5`. **5px / 21px →
  20px / 20px.**
- **§4 · type.** Measured; **no size moved**. See "Surprises".
- **§5 · guards.** Two new tests, thirteen revert-to-red confirmations.

**Measured, on deployed builds, canary-asserted in every call**
(`7155cf1` before, `db3a897` after — 24 before-readings and 24
after-readings, all eight markets × three viewports):

| | 1440×900 | 1440×777 | 1920×1080 |
|---|---|---|---|
| band | 217.80 | 188.03 | 261.36 |
| block height, before | 122.76 | 92.99 | 166.32 |
| block height, after | **54.00** | **54.00** | **54.00** |
| gap A→B, before → after | 5 → **20** | 5 → **20** | 5 → **20** |
| gap B→C, before → after | 21 → **20** | 21 → **20** | 21 → **20** |
| residue below the row | 39.76 | 9.99 | 83.32 |

Uniform across all four blocks and all eight markets at every viewport —
the probe's `NOT-UNIFORM` branch never fired. Zero truncation of any value
or label; zero second lines; `headzone-stack` overflows nowhere.

**Font table (unchanged by this task, re-measured against the 90.672px
column, real Geist 400, sub-pixel).** Headroom in px at the shipped size.

| market | RESOLUTION | RESOLVER | CLOSES | FLAVOUR |
|---|---|---|---|---|
| mumbai | 13 (2.80) | 14 (30.86) | 14 (14.54) | 14 (34.32) |
| oktoberfest | 13 (4.22) | 14 (14.14) | 14 (16.89) | 14 (5.44) |
| chess | 13 (2.80) | 14 (2.77) | 14 (14.54) | 14 (41.85) |
| bitcoin | 12 (4.87) | 12 (4.87) | 14 (14.54) | 14 (24.57) |
| math | 13 (2.80) | **12 (0.37)** | 14 (14.54) | 14 (24.54) |
| claude | 13 (2.80) | 14 (24.07) | 14 (14.54) | 14 (27.57) |
| yc | 13 (2.80) | 13 (4.71) | 14 (14.54) | 14 (24.47) |
| github | 14 (46.87) | 14 (46.87) | 14 (14.54) | 14 (45.03) |

**Decisions made**

- **One `AskUserQuestion`, and it was the whole shape of §2/§3.** The
  block row was `flex-1` inside a band fixed at `basis-[24.2dvh]`, so its
  height was leftover rather than content. §2 therefore frees 69.5px at
  1440×900 — far more than two gaps on the spacing scale can absorb, so
  the residue had to land somewhere visible and the choice was the
  founder's. Ruled: **fixed 20px gaps, residue as empty band.** The
  alternative offered was `justify-between`, which fills the band exactly
  and leaves no dead space but makes the gap a computed per-viewport
  number (33.25 / 23.33 / 47.77) rather than a scale step.
- **A third option was ruled out before asking rather than offered:**
  shrinking the band so the arena takes the space. The media panel is
  width-driven (`aspect-[16/9] w-1/3`) at 191.99px against a 188.03px band
  at 1440×777, so it is *already* clipped there; a shorter band would
  worsen a pre-existing defect. Not this task's to fix, and not this
  task's to make worse.
- **`gap-5` rather than `gap-3` or `gap-6`.** `gap-6` (24px) overflows the
  1440×777 band by 2px and puts the stack into its scroll backstop at a
  target viewport. `gap-3` (12px) would have *shrunk* B→C from 21px and
  left 63.76px of residue at 1440×900. `gap-5` is 20px — d5's own
  `.headzone{gap:20px}`, already shipping one level up.

**Surprises caught + fixed in-session**

1. **§4 is a no-op, and the brief expected the opposite.** "Several values
   should size up now." They cannot: the fit is a function of the
   column's WIDTH, this task moved only HEIGHT, and the three dimensions
   that set the column (`px-[11px]`, the 36px glyph, `gap-2.5`) are all
   untouched — so it is still 90.672px and BLOCK-3 had already fitted
   every value to it. Dropping `line2` frees nothing either: the shared
   size was always the largest fitting BOTH lines, and `line1` was the
   binding line on every two-line entry ("oktoberfest.de" over "report",
   "5 Nov 2026" over "23:45Z"). Reported as a measured negative rather
   than skipped.
2. **`oktoberfest.de` is not the tightest string.** The brief predicted it
   would need to sit a step below its neighbours, and it does (13 against
   its own RESOLVER's 14) — but `@thomasfbloom` at 12px clears the column
   by **0.37px** against `oktoberfest.de`'s 4.22px. The guess and the
   measurement agreed on the conclusion and disagreed on the reason, which
   is the case measuring exists for.
3. **A false claim in `ResolverCards.tsx`, corrected in place.** Its
   docblock still said `@thomasfbloom` "does not fit even at the
   `fontSize` floor" and leans on `truncate` to degrade. True of BLOCK-3's
   FIRST fitting pass against a 79px column; BLOCK-3's second pass moved
   it to 12px and updated the data file while leaving this copy behind.
   Nothing in the shipped map truncates. `truncate` is now documented as
   the pure backstop it is.
4. **A live `getComputedStyle` nearly produced a false defect report.**
   The focus-ring check captured `getComputedStyle(a)` into a variable,
   called `a.blur()`, then read `.boxShadow` from it — the declaration is
   LIVE, so it reported `none` for a ring that was rendering, and the
   first reading looked like a real accessibility regression. Re-run with
   every value snapshotted to a string at the instant it is valid. ⚠ The
   composed `box-shadow` shorthand ALSO under-reports here — it prints
   `rgba(0,0,0,0) 0px 0px 0px 0px inset` while `--tw-shadow` correctly
   holds `inset 0 0 0 2px #747474`. **The paint is the arbiter**: a zoom
   capture with the block focused shows the ring drawn and unclipped.

**Open questions** — none.

**Next session starts at** — nothing queued against this branch. PR #454
is open and unmerged by instruction; CI run `33508050332` is `completed` /
`success` on `db3a897`, every step green, verified by
`gh run view --json status,conclusion,jobs` rather than `gh pr checks`.

**Context to preserve**

- **The block row is no longer the band's shock absorber.** It was the
  only `flex-1` child of a fixed band; nothing is now, so the band's
  leftover is visible as empty ground (39.76 / 9.99 / 83.32px). Any
  future change that adds a fixed-height sibling to `headzone-stack`
  spends that residue rather than squeezing the block row, and at
  1440×777 there is only **9.99px** of it before the stack starts
  scrolling.
- **The text column is still 90.672px** and is set by `px-[11px]`, the
  36px glyph and `gap-2.5` — none of which BLOCK-4 touched. Any future
  font-size measurement starts from that number. A glyph or padding change
  invalidates all twenty sizes.
- **The two-line render path has exactly one consumer, and it is a test.**
  `resolution-block-data.ts` keeps `line2` nullable as the U-3 seam;
  no market exercises it. `resolver-cards.test.tsx`'s
  `a-SYNTHETIC-two-line-entry-still-renders-BOTH-lines` mocks the map via
  `vi.doMock` + `resetModules` + a dynamic import (a top-level `vi.mock`
  would replace the real map for the ~30 tests in that file that exist to
  assert against it). Delete that test and the branch rots.
- **The media panel already clips at two of the three target viewports**
  (191.99px against a 188.03px band at 1440×777; 281.99 against 261.36 at
  1920×1080). Pre-existing, not BLOCK-4's, not reported as a defect here —
  recorded because it is the reason the band cannot shrink.

**Time** — single attended session, 2026-09-01.
