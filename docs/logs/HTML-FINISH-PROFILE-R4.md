# HTML-FINISH · PROFILE — ROUND 4 · LAYOUT REPLICATION

Branch `htmlfinish/profile-parity` · PR #337 · ⛔ DO NOT MERGE
Base `422c81f` (round 3 head) → `b21604e`
Preview **https://experiment-o8xraa9np-zugzwang-worlds-projects.vercel.app**
Patch `~/Downloads/HF-PROFILE-4.patch` · 2997 lines · md5 `acf35bf3d72f34580418c9807c5b1bb6`

---

## 1 · What landed

Five commits, one per the dispatch's C1–C5 order. Pushed after C2 and again at the end.

| SHA | Item(s) | State |
|---|---|---|
| `a68975b` | 1 | shipped |
| `8d845cc` | 3 (revert) · 3 (height) · 4 | shipped / **refused** / **refused** |
| `90ed16d` | 5, 6 | shipped |
| `d917e12` | 7 | shipped |
| `b21604e` | 8 | shipped |

Files: `src/app/(public)/u/[pseudonym]/page.tsx` · `src/components/debate/format.ts` ·
`src/components/profile/{ArgumentList,IdentityCard,PositionsTable,ProfileTiles}.tsx` ·
`src/components/profile/{ProfileArena.tsx,selection.ts}` (new) ·
`tests/unit/design/profile-height-chain.test.ts` ·
`tests/unit/profile/tile-identity.test.ts` ·
`tests/unit/profile/render/{arrangement,panel-filter,row-window,selection}.test.tsx`
(three new). +2016 / −243 across 14 files.

Every write is inside the §1 allow-list. `format.ts` used its one-addition fence and
nothing else.

---

## 2 · Per item

### 1 · Đ on all six tiles, including Net P/L — **SHIPPED**

Round 3's block was route (a): the sign must precede the glyph, and that needed
`format.ts`, which was read-only. Round 4's allow-list opened it for one addition.

`displayNetProfitLossSigned` returns the SAME displayed-space figure as
`displayNetProfitLoss`, split into sign + magnitude. The identity now lives once, in a
shared private `netProfitLossDisplayed`, so the two exports cannot drift.

- The sign is `Decimal.isNegative()` on the numeric identity, taken **before** grouping.
  The displayed string is never read back — SPEC.1 §10.8's ban is respected by
  construction, not by care.
- Zero carries no sign: `Đ 0`, never `+Đ 0` / `−Đ 0`.
- The Arguments tile still takes no Đ (a count; SPEC.1 §23 pins `N (P Posts | R Replies)`).

**Verified live on the preview at 1440:**
`Đ 690` · `Đ 307` · `−Đ 13` · `8 (4 Posts | 4 Replies)` · `Đ 0` · `Đ 0`,
with the Net P/L tile's first three code points **U+2212, U+0110, U+0020**.

### 2 · Open/Closed selected state — **already shipped at `422c81f`, untouched**

Its positive control (that `default` and `outline` render identically) stays green.

### 3 · The band — **REVERTED as ordered; the declared height REFUSED on measurement**

`lg:grid-cols-[3fr_2fr]` → `lg:grid-cols-2`. Done, unconditionally.

The declared height is refused, and the refusal is about the GRAPH, not about the guard.
Measured live against real compiled CSS with `1fr 1fr` restored, the identity card's
height taken with the grid stretch removed (`align-self:start`):

| vw | identity needs | graph needs | overflow if the band is declared at what identity needs |
|---|---|---|---|
| 1024 | 258 | 258 | **0** |
| 1280 | 258 | 318 | 60 |
| 1440 | **218** | **358** | **140** |

Declared at 218, the graph card does not shrink: it measures **684 × 358** in a band whose
`clientHeight` is 218 and `scrollHeight` 358 — 140px of chart painting over the arena
(graph bottom 444, arena top 328). The graph's height is `(columnWidth − 32)/2 + 32`,
owned by `graph/ProfileGraphCard.tsx`'s `aspect-[2/1] w-full`, which §1 puts out of
bounds. The only lever from outside that file is capping the graph's **width** to
`2H − 32` = 404px inside a 684px column — which is the column-narrowing lever this revert
undoes, moved from the template into the cell. So no height is declared, no
`overflow-hidden` hides the spill, nothing clips.

⚠ **Note for the next round.** At 1024 the band is ALREADY tile-derived — 258 = 258,
exactly. The dead space the founder marked is a **≥1280 phenomenon** and is entirely the
2:1 aspect on a wide column, so the fix has to land **inside** the graph card.

### 4 · The big square PFP — **REFUSED on its own clause**

"If the tile column still collapses, ⛔ REFUSE ITEM 4 ONLY and report the numbers."
It collapses. The equal split is the fairest test this row has had — at `1fr 1fr` the
identity column's WIDTH no longer depends on the PFP — and it closes through the row
HEIGHT anyway:

| vw | item 3 revert only | + item 4 PFP |
|---|---|---|
| 1024 | band 258 · PFP 56 · idcol 370 · tiles 370×184 · tile 115×86 | band 378 · PFP 360 · idcol **66** · tiles 66×344 · tile **26×166** · ⛔ **CLIPPED** |
| 1440 | band 358 · PFP 56 · idcol 578 · tiles 578×144 · tile 185×66 | band 358 · PFP 340 · idcol 294 · tiles 294×224 · tile 90×106 |

At 1024 each tile is 26px wide and the grid clips — round 1's collapse at a viewport two
and a half times wider. `h-full` resolves against the grid ROW; the row is
`max(identity content, graph)`; a taller card widens the square → narrows the column →
heightens the tiles → heightens the card.

⇒ Both halves of items 3 and 4 now trace to **one symbol**: `ProfileGraphCard`'s
`aspect-[2/1]`. The guard asserting the refusal (`arrangement.test.tsx` row 16) is kept
and re-derived onto round 4's numbers, not re-inverted.

### 5 · Row selection — **SHIPPED**

`pick()` / `stepRow()` / `onKey()` reimplemented as behaviour, with the mockup's own
arithmetic: `(at + dir + len) % len` and `at < 0 ? 0`. Click toggles; Up/Down wrap
through the currently VISIBLE rows; the stepped-to row is scrolled in at
`block:"nearest"` (guarded exactly as the mockup guards it) and takes focus. Roving
tabindex, so the keys are reachable without a click.

Three departures, each because the mockup's premise is absent:

- **Keyed by `marketId`, not by index** — the mockup's row array never changes; ours is
  re-filtered by two controls, so an index would drift onto a different row.
- **Nothing selected at mount** — the mockup auto-selects (`:571`); the founder ruled the
  full argument list the empty state.
- **The key handler is on the table, not on `document`** — the mockup binds
  document-level with `preventDefault`, safe there because its html/body are
  `overflow:hidden`, a fixed-viewport affordance recon A-5 struck. Here the page grows and
  scrolls (RULED A1), so a document-level ArrowDown would kill keyboard scrolling of the
  whole route.

`aria-current`, not `aria-selected`: the latter is only defined inside a grid or listbox,
and Biome's a11y rule rejects `role="grid"` on a `<table>` as redundant — silencing a
Biome rule is ask-first (AGENTS.md §11).

### 6 · Row borders and row layout — **SHIPPED**

Unselected `[border:var(--hairline)]` (rung 1); selected `[border:var(--ring-active)]` +
`bg-n1` (rung 3, `globals.css:178` — the same token item 2 used).
⛔ Not one value from `.prow.sel`, whose 2px `--ink` outline is near-WHITE in the shipped
dark system.

**Measured in the browser, not assumed:** Tailwind preflight sets
`border-collapse: collapse`, so `<tr>` borders paint and conflict resolution gives the
wider edge to the selected row. That is also why the two border classes are one
conditional and never both — two arbitrary `[border:…]` utilities resolve by stylesheet
order, not by the order they are written.

**Verified live at 1440, on the real rows:**

| | border | background | height |
|---|---|---|---|
| unselected | `1px solid rgb(64,64,64)` | transparent | 73 |
| **selected** | **`1.5px solid rgb(116,116,116)`** | **`rgb(42,42,42)`** | 74 |
| unselected neighbour | `1px solid rgb(64,64,64)` | transparent | 73 |

⛔ No `rounded-[var(--r)]` on the rows run: the collapsing model ignores `border-radius`,
so it would be a class that does nothing. Square corners are the cost of keeping a real
`<table>` — and row 3 already recorded why the table stays.
The reserved sell host takes no border: an empty bordered band would draw an empty card
under every sellable row.

The other four halves of item 6 — five columns, arrow track 4th of 5, centred headers,
market question under the argument title — shipped at rows 14 / 17 / 10.

### 7 · The right panel filters — **SHIPPED**

New `ProfileArena.tsx` holds the shared selection and renders a **fragment**, so both
panels stay direct children of the arena band and the band keeps its className in
`page.tsx` where the height chain reads it. New `selection.ts` carries the market
question and the opener's comment id — and no argument content, so nothing can cross that
the list has not already masked.

Replica: head cluster · title · body · image slot · footer/split bar · the reply
"Replied to …" line. **Every part is already loaded** — `body` is on
`ProfileArgumentItem` and had simply never been rendered here — so item 7 issues **no new
read**.

- Panel header when filtered = the row's market question. ⛔ No percentage.
- ⛔ No `+` on the title (A-6 struck its shape, R4 ruled "Read more", duplicate of
  PD-0-01). The body renders in full, which is what the pop-up existed to reach.
- The landmark keeps `aria-label="Arguments"` while the visible title moves.
- Deselect returns the full list; a filter that hides the picked row returns the panel to
  the list too (the selection is derived against the visible set, and is remembered
  rather than destroyed).

### 8 · The three-row window — **SHIPPED**

⛔ The mockup's CSS rule cannot be ported, and that is measured. `.rows .prow{flex:0 0
calc(100% / 3)}` (`:273`) needs a DEFINITE panel height, which its fixed-100vh page has
and this one does not: measured at 1440 the arena is 1187 and the panel body 1135, so a
one-third basis renders three rows at ~378px each.

⇒ The mechanism is **the mockup's own earlier one**, from its changelog rather than its
stylesheet — v0.11: *"the rows container is height-capped to exactly the first three rows
(JS measures the 3rd row's bottom) … No row content is clipped."*

**Verified live at 1440 with the row set grown to six:**

| | body clientH | body scrollH | scrolls |
|---|---|---|---|
| uncapped | 1135 | 1135 | **no** (round 3's finding) |
| capped at the measured 276 | 276 | 495 | **yes** |

The sixth row is reachable by scrolling; `<thead>` computes `position: sticky` and stays
visible at the bottom of the scroll — the column-header row is out of the scroll. A bound
with a scroll container is not a clip, which is the A1 distinction.

---

## 3 · The live-value flag — §3's deliverable

Elements that would need a value the page does not already have, i.e. a **new server read
per render** on a surface served by a 15-slot pooler. Named, nothing rendered, none built.

| Element | Field | Loader that would have to change |
|---|---|---|
| The replica card's argument IMAGE | `comments.image_uploads_id` (never selected) | `src/server/profile/arguments.ts` — and the R2 URL resolution behind it |
| The panel header's LIVE PRICE | the market's current side price | a new pool/price read; ⛔ `priceAtBet` is the FROZEN entry price, a different quantity, never a substitute |
| The per-row entry % under Staked | `bets.price_at_bet` for the episode opener | `src/server/profile/positions.ts` (`ProfilePositionRow` carries no entry price) |
| The per-row live % under Current | the market's current side price | `src/server/profile/positions.ts` |
| **NEW — the replica's card-actions cluster** (bookmark/download, mockup `:628`) | a `BookmarkAffordance` per argument | `loadViewerMarketContext` is MARKET-scoped while this list is cross-market; every reachable substitute lies |
| **NEW — the reply footer's parent AUTHOR** (mockup `:606`: "Replied to {author}'s argument") | the parent comment's author pseudonym | `src/server/profile/arguments.ts` — only `repliedToTitle` is carried, so the shipped `Replied to {title}` line is used verbatim instead |

The image SLOT is built and renders nothing — no background, no border, no label.
⛔ Deliberately not a permanent grey box: that states "an image is missing" on every
argument, most of which have none.

---

## 4 · Measurement — method and results

⛔ **The prescribed fixed-width iframe does not lay this surface out, and neither does a
plain page load.** On the deployed preview the route's Suspense boundary never resolves in
this browser: the real subtree sits in a hidden `#S:0` under `<body>` with every node at
0×0 while `profile-loading` paints at 736×776 — the exact failure round 3 recorded.
`$RC('B:0','S:0')` does not swap it (the boundary carries the `$~` postponed marker).

**The method used, stated plainly:** navigate to the preview, then splice the streamed
subtree out of `#S:0` into `<main>` in place of the fallback, and **gate every reading on
the measured node having a box**. The CSS is the real compiled CSS and the data is the
real staging data (`/u/RedWolf001` — the well-populated visitor profile).
Widths below 1440 are simulated by constraining the container and, below `lg`, dropping
the two-column template — the two things the breakpoint controls — because the automation
host pins the viewport at 1440 (`screen.width` 1440, `resize_window` reports success but
`innerWidth` does not move).

| vw | container | band | identity card | graph | arena | positions panel | arguments panel | tiles clipped | table clipped |
|---|---|---|---|---|---|---|---|---|---|
| 1920 | 1920 | 478 | 924×478 | 924×478 | 1872×1023 | 924×1023 | 924×1023 | no | no |
| 1440 | 1440 | 358 | 684×358 | 684×358 | 1392×1187 | 684×1187 | 684×1187 | no | no |
| 1024 | 1024 | 258 | 476×258 | 476×258 | 976×1247 | 476×1247 | 476×1247 | no | no |
| 768 (stacked) | 768 | 618 | 720×218 | 720×376 | 720×1540 | 720×329 | 720×1187 | no | no |
| 390 (stacked) | 390 | 549 | 342×338 | 342×187 | 342×2472 | 342×949 | 342×1499 | no | no |

Nothing clips at any width. Both filter controls and the market popover trigger are
reachable at all five.

**The one finding, at 390:** the positions panel body scrolls HORIZONTALLY — content 354
against a 340 client box, `overflow-x: auto`, so it scrolls rather than clips.
**12 of those 14px are pre-existing** (measured by stripping the row borders: 352 vs 340);
item 6's borders add 2. The table's min-content is the 329px the row-1 docblock already
records, and a 390 column cannot hold it. Not introduced here, and not a clip.

**The three-row window, in both panel states at 1440:**

| state | arena | positions panel | body (capped) | slack under the rows |
|---|---|---|---|---|
| a row picked (item 7 filtered) | 329 | 329 | 276 | **1px** |
| nothing picked (the full list) | 1187 | 1187 | 276 | **859px** |

⚠ **Reported, not absorbed.** In the FILTERED state the three rows fill the panel exactly —
the mockup's composition, and the state the mockup is drawn in, since it always has a row
selected. In the DESELECTED state the argument LIST is 1187 tall and drags the positions
panel with it, leaving 859px of empty panel below the rows. That slack is not new — before
item 8 the same panel held a 248px table in a 1135px body — but the founder's own ruling
(no auto-select; the list is the empty state) is what makes the tall state the default.
Closing it needs a decision about which half sets the arena's height, which is not one of
the eight items.

**Keyboard.** ⛔ Not verifiable in the browser: the manual subtree splice leaves React
unhydrated, so no handler is live on that page. It is verified instead by 42 jsdom
assertions across `selection.test.tsx` and `panel-filter.test.tsx` — Up/Down step and
wrap in both directions, both directions enter at index 0 from nothing, focus moves with
the selection, non-arrow keys pass through, the arrows step only through what the filter
left, and **the panel follows** (`arena::THE-PANEL-FOLLOWS-THE-ARROW-KEYS`, including the
wrap). The founder should confirm it by hand on the preview.

---

## 5 · Values and strings — every one traced

| Thing | Source |
|---|---|
| `Đ` U+0110 (`c4 90`) | byte-carried from `ArgumentList.tsx`'s shipped `Đ {formatDharma(…)}`; hexdumped |
| `−` U+2212 (`e2 88 92`) | byte-carried from the mockup's `pl()` (`surface_profile_v1_0.html:672`); hexdumped. Also the founder's own mark |
| `+` U+002B | same source, same line |
| `[border:var(--hairline)]` | rung 1, `globals.css:166`; this file's own panel edge |
| `[border:var(--ring-active)]` | rung 3, `globals.css:178`; `discovery/MarketCard.tsx:74` and item 2's selected filter half |
| `bg-n1` | the shipped raised surface, already `hover:bg-n1` on this file's `PopoverOption` |
| `focus-visible:shadow-(--state-focus-ring)` | `ui/button.tsx:8`, `shell/BrandCluster.tsx:58` |
| `text-sm whitespace-pre-line` (replica body) | `debate/PostFocusHeader.tsx:90`, the shipped focused-post body |
| `min-h-0 flex-1` (image slot) | mockup `.rimg{flex:1 1 auto; min-height:0}` — topology, not a value |
| `ROW_WINDOW = 3` | founder-supplied ("three rows fill the panel"); the mockup's `calc(100%/3)` is the same three |
| the 3-row cap in px | measured off the rendered third row + the body's own computed padding; no literal |
| `Arguments` (panel title) | byte-carried from the shipped tile label, canon §6 verbatim |
| the market question (panel title) | DATA — `markets.title`, not copy |
| `Replied to {title}` | the shipped list-card line, verbatim; ⛔ the mockup's `Replied to {author}'s argument — "{body}"` needs a live value |
| `REMOVED_STUB_TEXT` | the shipped constant, `debate/placeholders` |

**No copy authored.** No colour, radius, px, type size or duration taken from the mockup.

### `format.ts` — every consumer proven unchanged

`displayNetProfitLoss` keeps its exact output; only its body moved into a shared private
helper. The four consumers, named:

1. `src/components/profile/ProfileTiles.tsx` — **re-pointed** to the new signed variant
   (the intended change).
2. `tests/unit/debate/format.test.ts` (`describe` at :127, assertion at :194) — green,
   untouched.
3. `tests/unit/profile/tile-identity.test.ts` — 6 existing assertions green, untouched;
   6 new ones added for the signed variant.
4. Its own docblock and the `format.property.test.ts` property suite — green.

The new test `is the SAME figure as the plain variant, magnitude for magnitude` asserts
`magnitude === plain.replace(/^-/, "")` across five operand sets, so the two exports
cannot drift apart later.

`round0Dharma`, `formatDharma`, `formatDharmaExact`, `formatPricePercent`,
`formatPercentUnpaired` and the private `groupInteger` / `wholePercent` are byte-identical.

---

## 6 · Guards

`just verify` EXIT=0 before every one of the five commits. Full unit suite
**1829 / 1829 green** (128 → 129 files; +51 assertions this round).

| Guard | State |
|---|---|
| `profile-height-chain` | green; **extended** with the item-8 panel-scoped bound |
| `arrangement` (rows 1–20 + eye-pass) | green; item 1 and item 3 pins re-inverted, row 16 re-derived |
| `tokens-monochrome` · `no-raw-hex-view-layer` · `side-pole-binding` | green, untouched |
| `no-raw-dharma-render` · `pct-round-render` | green, untouched |
| `emphasis-ladder-tokens` · `avatar-ring-token` | green, untouched |
| `page-container` | green, untouched |
| `side-badge` census | **went red mid-round — fixed in the code**, see §7 |

**Rows with no test:** none of the eight. Items 3 and 4 are pinned by their refusals.
The one thing with no automated coverage is the RESOLVED GEOMETRY — jsdom performs no
layout, so the 3-row cap's height, the collapsing-border resolution and the band's
measured values are proven in a browser and recorded here, not in CI. That split is the
same one `profile-height-chain.test.ts` has always documented.

---

## 7 · Surprises caught and fixed in-session

**The `side-badge` census went red, and it was right.** Copying the head cluster into
item 7's replica took `SideBadge size="profile"` in `ArgumentList.tsx` from 2 call sites
to 4, reddening `tests/unit/debate/render/side-badge.test.tsx` — a file **outside this
task's write allow-list**. Two assertions failed
(`the-sized-sites-are-…` and `detail-stays-unwired-and-profile-is-wired-only-where-ruled`).

The guard exists to catch a duplicated primitive call site, and that is exactly what had
happened. ⇒ **Fixed the code, never the guard.** The head cluster is now extracted into
`RemovedHead` / `PresentHead`, shared by the list card and the replica: the census is back
at two — one per union variant — the forbidden file was never touched, and the two
renderings can no longer drift in what they show. The extraction is strictly better than
the copy it replaced.

**The height-chain guard threw on a comment, not on a defect.** A long explanatory comment
inserted between `data-testid="arguments-panel"` and its `className` pushed the pair past
the guard's 400-character read window, and the guard correctly reported a restructure.
Fixed by moving the commentary into the component docblock — the guard's window is
unchanged — and the docblock now carries a ⛔ telling the next author why commentary must
stay out of that attribute list.

---

## 8 · Decisions made

1. **Item 3's revert ships even though its height half is refused.** "No partial ships"
   governs construction; "⛔ REVERT IT" is an unconditional order with no measurement
   dependency. Keeping `3fr 2fr` to protect a rule about partial construction would have
   disobeyed a direct instruction. Reported as reverted + refused, not as shipped.
2. **A filtered-away selection is remembered, not destroyed.** While hidden it stops
   counting (the panel returns to the list); switching the filter back restores it. A
   filter is a lens over the selection, not an eraser. Asserted both ways.
3. **`aria-current` over `aria-selected` + `role="grid"`** — Biome rejects the role and
   disabling a Biome rule is ask-first.
4. **`onSelect` is optional on `PositionsTable`** — a departure from O-1 taken on purpose:
   omitting it drops nothing the component renders, so a required prop would buy no
   guarantee and would churn fifteen render-test call sites for it.
5. **The replica renders title AND the whole body**, which repeats the title line, because
   `deriveTitleTeaser` takes the title from the body's first line and
   `PostFocusHeader.tsx:84-90` already ships exactly that shape. Diverging would make one
   comment read differently on two surfaces.

---

## 9 · Open questions for the founder

1. **The graph card owns both blocked items.** Items 3 and 4 need
   `ProfileGraphCard.tsx`'s `aspect-[2/1]` to yield — either the card fills a given box,
   or the band accepts a width-capped graph. POLISH.5 PR C owns that symbol. Which?
2. **859px of empty positions panel in the deselected state** (§4). Closing it means
   deciding which arena half sets the row height, or reinstating the mockup's auto-select
   — which the round-4 ruling ("the list is the empty state") deliberately removed.
3. **The reserved 50px sell host** still renders a blank band under every sellable row
   (round 3's flag, unchanged). The mockup puts Sell in the replica footer; moving it
   there is an F-PROF-3 change and was not one of the eight items.

---

## 10 · Next session starts at

The founder's eye pass over
**https://experiment-o8xraa9np-zugzwang-worlds-projects.vercel.app/u/RedWolf001** —
specifically: confirm the keyboard by hand (click a row, then Up/Down; the panel must
follow and wrap), and rule on the three open questions above. ⛔ PR #337 DOES NOT MERGE.

## 11 · Context to preserve

- The Suspense boundary never resolves under browser automation on this route. Measure by
  splicing `#S:0` into `<main>` and gate on the node having a box. React does **not**
  hydrate after that splice, so no interaction can be verified that way.
- The automation host pins the viewport at 1440; narrower widths are simulated by
  constraining the container and dropping the two-column template below `lg`.
- This worktree has no `.env.local`. `next build` needs the `tests/_setup/env.ts`
  placeholder set exported first, and `just` needs `~/.local/share/mise/shims` on PATH
  (`mise trust` was run for this directory).

## 12 · Time

One session, 2026-08-15. Five commits, two pushes (after C2 and at the end).

---

## SEALED SELF-ASSESSMENT — written last, unamendable

Six of eight items shipped whole; two refused with numbers. I believe the refusals are
correct and I believe the six are honest, but three things in this round deserve to be
said plainly rather than left to be discovered.

**The dispatch caused one thing, and I will name the line.** §2 item 3 says *"The graph
slot FILLS its cell at that height instead of driving it."* That sentence assumes the
graph card can be made shorter from outside itself. It cannot: its height is
`(width − 32)/2 + 32`, written inside a file §1 forbids me to touch, and the only external
lever is the column width the same item orders reverted. So item 3 was internally
unsatisfiable from the moment both clauses were written together, and item 4 — whose
stated precondition is item 3's declaration — was unsatisfiable with it. That is not a
complaint; the measurement is what surfaced it, and I would rather have measured it than
argued it. But two of the eight were closed before I started, and the closing line is that
one.

**The thing I am least sure of is item 8's mechanism.** I shipped a JS-measured cap
because the mockup's CSS rule provably produces 378px rows on this build, and because the
mockup's own changelog documents the measured mechanism as its earlier answer. That is a
defensible port, but it is machinery — an effect and a ResizeObserver — on a surface the
founder is reviewing for layout, and it is the only thing this round that has no CI
coverage of its actual output. The jsdom tests prove its gates, not its geometry; the
browser proves its geometry once, by hand, on six cloned rows. If it misbehaves on a
viewport I did not measure, nothing in the suite will say so.

**The thing I most nearly got wrong** was the `side-badge` census. My first instinct on
seeing a red guard in a file I may not edit was to look for an exemption. The guard was
telling me I had duplicated a primitive call site, which is precisely what it exists to
catch, and the fix took ten minutes and left the code better than the copy would have. I
record that because the instinct came first and the correct reading came second.

**One place where I chose the founder's order over the letter of a rule.** Item 3's revert
shipped while item 3's height was refused, against "an item ships whole or is reported
whole". I judged that keeping `3fr 2fr` — a composition the dispatch calls the wrong lever
and orders reverted — in order to honour a rule about partial construction would have been
obedience to the wrong instruction. If that reading is wrong, the revert is one line to
undo and the measurement stands either way.

**What I did not verify.** Keyboard interaction in a real browser, at any width. The
splice that makes measurement possible is the same thing that makes hydration impossible,
and I did not find a way to have both. Forty-two jsdom assertions is not the same as one
press of the Down arrow on the preview, and the founder should not read this log as
though it were.
