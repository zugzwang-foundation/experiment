# BLOCK-5b — the resolution-block glyph gets a render path

**PR #461**, open and unmerged. Branch `feat/block-5b-resolution-glyphs`, cut off
`origin/main` @ `073f65e`. Implementation commit `6c8bb76`.

---

## What landed

**Assets — 13 transparent PNGs at `public/brand/blocks/`** (400 KB on disk,
373 KB of PNG payload, from 56.18 MB of sources — 99.35% reduction):
`callout` · `closes-on` · `coinmarketcap` · `consumption` · `feedback` ·
`github` · `innovation` · `oktoberfest` · `petition` · `pressure` ·
`response-on-x` · `sentiment` · `showcase`.

**Code**
- `src/components/debate/resolution-block-glyphs.ts` — NEW. `MARKET_GLYPHS`
  (`Record<KnownMarketSlug, string>`), `FLAVOUR_GLYPHS`
  (`Record<FlavourName, string>`), `CLOSES_GLYPH`, `getResolutionBlockGlyphs()`,
  `ALL_GLYPH_FILES`.
- `src/components/debate/resolution-block-data.ts` — `FLAVOUR_NAMES` /
  `FlavourName` / `FlavourBlockEntry` added; `ResolutionBlockSet.flavour`
  narrowed from `ResolutionBlockEntry` to `FlavourBlockEntry`.
- `src/components/debate/ResolverCards.tsx` — the glyph `<span>` gains
  `overflow-hidden` and an `<img>` child; `glyph` threaded as a REQUIRED prop;
  glyph lookup added inside the existing `try`.

**Tests**
- `tests/unit/debate/_png.ts` — NEW. Minimal `node:zlib` PNG decode + RGBA
  encode. No new dependency.
- `tests/unit/debate/resolution-block-glyphs.test.ts` — NEW. G-a / G-b / G-c /
  G-e / G-f / G-g / G-h, 76 tests.
- `tests/unit/debate/render/resolver-cards.test.tsx` — G-d appended, +5 tests.

**Docs**
- `AGENTS.md` §9 — the Suspense-reveal remedy named only `<!--$?-->` as the
  pending marker. Corrected to the SET `{"$?", "$~"}` (see Context below).

Full suite **4464 passed** / 1 skipped / 4 todo. `tsc`, `biome`, `next build`
green. **CI run `33607161816` — `success`, every step.** Preview
`experiment-nnx657j8a-…`, `/api/health` canary `6c8bb769…` = `6c8bb76`.

---

## Decisions made

**1 · The plate is keyed to alpha, not repainted.** *(Founder-ruled at the
resumed kickoff; the measurement behind it is BLOCK-5b's halt.)* Sources were
opaque marks on a baked plate measured per file at `#232323`–`#2E2E2E` — an
11-level spread straddling the `#2A2A2A` the span itself paints, visible as a
square inside the block's own frame on 8 of 13. Keying it out means the span's
`bg-n1` IS the plate and there is no second copy of the colour to drift.
⇒ **`bg-n1` on the glyph span is now load-bearing, not a loading fallback.**

**2 · Ink normalised to 70% of canvas BY HEIGHT.** BLOCK-5a's measured house
convention. Widths now vary 208–504px and that is asserted, not tolerated —
convergent widths would mean someone had started normalising by the wrong
dimension.

**3 · Plain `<img>`, not `next/image`.** A build-time-constant 512px asset
rendered at 36px must stay crisp at 3× DPR (108px); the optimizer's fixed-size
1x/2x srcset would not deliver that, and per-request optimization buys nothing
for an immutable pre-sized asset. `biome-ignore` carries that reason.

**4 · Decorative twice over.** `aria-hidden` stays on the span (BLOCK-1 put it
there to keep the glyph out of the RESOLVER anchor's accessible name) AND the
image carries `alt=""`. The first is a subtree removal, the second is this
element's own contract; neither is redundant.

**5 · `overflow-hidden` on the SPAN, not a radius on the image.** The span is
`border-box` with a 1px hairline, so its padding box needs `calc(6px - 1px)` to
agree — which would disagree again the moment the border or `--imgr` moves.

**6 · Assets ship RGBA, not greyscale.** A greyscale PNG cannot represent
colour, so `R == G == B` would hold by construction and G-b would be testing the
container instead of the artwork.

**7 · The achromatic positive control is SYNTHETIC and in-repo.** The previous
kickoff proposed `~/Downloads/thumbnails/Oktoberfest.png`. Rejected on two
counts: it is not the artifact under test, and a control outside the repo can
vanish between runs and take its evidence with it.

---

## Guards — all 15 mutations verified

Each guard's fix was reverted against the **committed** tree, the guard required
to go RED, then restored and required to go GREEN. Harness ran to a clean tree.

| mutation | guard | red | green |
|---|---|---|---|
| bake an opaque plate back in | corner patches fully transparent | ✓ | ✓ |
| delete an asset | file exists, non-empty | ✓ | ✓ |
| recolour a mark to `#FBA70C` | all 13 achromatic | ✓ | ✓ |
| blind the chroma checker | synthetic fixture is rejected | ✓ | ✓ |
| drop a slug from the market map | exhaustive (tsc) | ✓ | ✓ |
| drop a flavour from the flavour map | exhaustive (tsc) | ✓ | ✓ |
| drop `src` off every image | 32 images resolve to real PNGs | ✓ | ✓ |
| point the glyph dir at a typo | src resolves to a file on disk | ✓ | ✓ |
| rescale one asset's ink to ~55% | ink height 70% ± 2 | ✓ | ✓ |
| remove `overflow-hidden` | image clipped to the 6px radius | ✓ | ✓ |
| move the row floor 54 → 64px | BLOCK-4 row geometry | ✓ | ✓ |
| move a headzone gap `gap-5` → `gap-4` | both gaps stay 20px | ✓ | ✓ |
| unhide the glyph below 640px | `hidden sm:block` intact | ✓ | ✓ |
| change oktoberfest's close date | existing **G3** still bites | ✓ | ✓ |
| truncate the github href | existing **G5** still bites | ✓ | ✓ |

**Browser-measured on the deployed preview**, all three named markets:
4 images each, 0 broken, `naturalWidth = 512`; span 36×36, `border-radius: 6px`,
`overflow: hidden`, `bg rgb(42,42,42)`; row `666.67 × 54.00`, every block
`54.00px`; headzone gaps `20px / 20px`. G-f verified at 9× on a red field —
clean rounded corners, no overhang. G-h verified at 1440/700/639/390: `block`
above the `sm` breakpoint, `display: none` at and below 639px.

---

## Open questions

1. **`ResolutionBlockKey` is exported but consumed only as
   `getResolutionBlockGlyphs`' return type.** `ResolverCards` still types its own
   `blockKey` off `(typeof BLOCKS)[number]["key"]`. Two spellings of one union;
   worth collapsing, deliberately not done here (out of the fenced scope).
2. **Optical size was normalised, semantic weight was not.** `oktoberfest`'s mark
   was 97.4% of the short side by MAX dimension before normalisation (69.4% by
   height) — it is a wide mark, so at equal ink height it still carries more
   visual mass than e.g. `innovation` (208px wide). Ruled acceptable by the
   by-height convention; flagging in case the founder reads it differently on
   the deployed page.
3. **`pressure.png` is a protest/banner mark**, not a "pressure gauge" reading.
   Correct for `mumbai-bmc-pink-october-disclosure`'s flavour as I read it, but
   it is the one asset whose subject is furthest from its label.

---

## Next session starts at

**Review PR #461 and merge, or return notes.** Nothing is blocked on CC. If it
merges, the standing O-4 step applies — push `staging` BEFORE any branch (O-10
dedup) and confirm `/api/health` canary moves.

---

## Context to preserve

⚠ **`AGENTS.md` §9's Suspense-reveal remedy named only `<!--$?-->`, and
Discovery uses `<!--$~-->`.** Measured at BLOCK-5a: a reveal written to that
paragraph verbatim matched zero boundaries and returned `0×0` for every element
on `/` — the exact failure the paragraph exists to prevent, reached *by
following its own fix*. Corrected in place this session to the set
`{"$?", "$~"}`. **The `stillHidden === 0` and non-zero-box assertions are what
caught it**; without them the run reports a clean measurement of an un-revealed
page.

⚠ **The previous kickoff's two wrong premises are worth remembering as a shape,
not just as facts.** Both came from reading a *neighbouring artifact*: the gold
Oktoberfest was a Finder thumbnail of a file in a different directory
(`~/Downloads/thumbnails/`, the Discovery set), and the plate was assumed
uniform because the marks looked uniform. Neither would have survived one
measurement, and both would have shipped a defect that looked deliberate.

⚠ **`git checkout --` is the mutation harness's restore, so it must run against
COMMITTED work.** Run it on an uncommitted slice and the restore *deletes* the
work, after which every subsequent "control" runs against a void tree and the
harness reports a full column of passes.

⚠ **The heredoc / compound-shell path is blocked in this worktree.** Appending
to a file needs `Edit`, not `cat >> … << EOF`, and multi-step shell needs a
script file invoked as one command.

**Not changed, deliberately:** `markets` is still 11 columns — no migration, no
schema touch. `market_media` / R2 is untouched; these are static `public/`
assets keyed to a taxonomy, which is why they do not go through the sign route.

---

## Time

2026-09-02, ~13:00–14:00 IST. One session, resumed from the BLOCK-5b halt.
