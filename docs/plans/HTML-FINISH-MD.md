# HTML-FINISH · MARKET DETAIL (`/m/[slug]`) — EXECUTION PLAN

**Mode:** PLAN ONLY. Nothing was branched, committed, or written to a tracked file.
The only write this session made is this file.

---

## §0 · GROUND — re-verified, not assumed

```
$ git rev-parse HEAD
fd4b357044f569027750d1b4a576a51bd54373bb        ✅ == required fd4b357
$ git rev-parse origin/main
fd4b357044f569027750d1b4a576a51bd54373bb        ✅ identical
$ git status --porcelain                        → (empty)
$ git branch --show-current                     → main

$ md5 docs/design/mockups/surface_d5_v1_0.html
34619dacee472a245cb6e8678b509219                ✅ == required
$ wc -l docs/design/mockups/surface_d5_v1_0.html
    1929                                        ✅ == required
```

**Registers, verified against the live repo (O-2 — read, never recalled):**

| Register | Kickoff says | Live repo says | Verdict |
|---|---|---|---|
| SPEC.1 | 1.0.30 | `SPEC.1.md:14` → **1.0.30** | ✅ |
| SPEC.2 | 1.0.22 | `SPEC.2.md:3` → **1.0.22** | ✅ |
| ADR next free | 0037 | `ls docs/adr/` highest = **0036** ⇒ next free 0037 | ✅ |

⚠ **One drift, noted once and not blocking (CLAUDE.md §1 posture):** `CLAUDE.md` §1
still names SPEC.1 as **1.0.29**. The live file is **1.0.30**. The kickoff is right and
the contract file is one behind. Not fixed here — this plan writes no tracked file. It
is carried into §12 as a closing-ritual item.

**The 42-row instrument.** The kickoff names it but does not carry it. It was located
and read in full, and it is the **merge of two files**, neither on `main`:

| File | md5 | Lines | Carries |
|---|---|---|---|
| `~/Downloads/RECON-A-composition.md` | `701f85286bf60b7c590066aed4127f4f` | 323 | A1 rows **1–41** + A2 cross-owner + A3 guards + A4 (F1–F5, empty) |
| `~/Downloads/RECON-B-interaction.md` | `9b643d1eac5af2c439bd0eba1ead8c46` | 252 | B1 interaction #1–72 + B2 live-value + the read-count baseline |

Both re-verify the same ground SHA and the same mockup md5. **Row 42 is not in A1.**
It is the one B-side item A explicitly hands forward — `B2.1 #13` / `B1 #60`,
*"Clickable pseudonyms → Profile … (B1 #60 — no A1 row; add as a founder row if
wanted)"*. It is the only such hand-forward, it costs **0 reads**, and it belongs to
phase 3's file set (`ArgProfile`, `ReplyCard`, `dialogs`). **⇒ Row 42 = clickable
pseudonyms → Profile.** It is also **spec-supported**, not merely mockup-supported:
`SPEC.1.md:1628` already rules *"an author pseudonym click navigates to that author's
**Profile (§23)**"* for the Discovery hero. If that identification is wrong, this is
the one row to strike before execute — everything else is row-numbered from A1
directly.

---

## §1 · WHAT THIS PLAN DELIVERS

**30 rows build. 5 rows are ruled to no code change. 3 rows are out of the task.**

The founder ruling of 2026-08-16 reverses all nine recon strikes. This plan does not
re-argue R1, R4, the criterion clamp, or the `Đ BET` brand form, and does not cite them
as grounds to deviate. The four docblocks that record them are corrected by the commits
that reverse them (§9).

**⛔ THE ONE RULE THAT SURVIVES IS HELD ABSOLUTELY.** No colour, radius, px, type size
or duration is taken from `surface_d5_v1_0.html`. Every number below is either already
on `main`, already in an `@theme` token, or a topology declaration (`flex-1`,
`min-h-0`, `grid-cols-*`, sibling order, nesting). Where a row needs a value that does
not already exist on `main` — d5's `.sidechip.sm` geometry is the one case — the row is
delivered **without** the value and that is stated in-row (§4, row 13).

**⛔ No copy is authored.** Every new visible string is either byte-carried from the
mockup, already on `main`, or is an `aria-label` on a control whose visible glyph
carries the same meaning (row 24, ruled by the kickoff).

---

## §2 · FINDINGS — read these before the commit table

Seven. Three change the shape of the work; four are ruling requests. None is a halt as
written — the founder's override stands and this plan executes it — but §2.1 and §2.2
change *what gets built*, and §2.3 is a money-truth question I will not silently guess.

### F-1 · ⛔⛔ THE HEADER IS NOT SHARED IN d5. IT SWAPS. Row 1 is a bigger change than "split into two columns".

Every element inside d5's `.headzone` carries an arm class:

| `.hleft` | `.hright` |
|---|---|
| `.mmedia **vm**` `:949` · `.question **vm**` `:958` · `.attrs **vm**` `:973` · `.criterion **vm**` `:974` · `.rescards **vm**` `:986` | `.graph **vm**` `:1007` · `.barrow f **vm**` `:1037` |
| `.hpimg **vp**` `:956` · `.pauthor **vp**` `:960` · `.ptitle **vp**` `:970` · `.tease **vp**` `:971` · `.pfoot **vp**` `:979` | `.mcard **vp**` `:1021` |

⇒ **The whole headzone's CONTENTS swap between market view (`vm`) and post view
(`vp`); only the two-column FRAME persists.**

The build does the opposite: `MarketHeader` is rendered **outside** the ternary
(`DebateView.tsx:206`) and `PostFocusHeader` **stacks underneath it** in the post arm.
Rows 11, 12, 15, 16, 17 are all `vp` rows the recon places *inside the header columns* —
they cannot land there while the header is arm-blind.

**⇒ Row 1 moves `MarketHeader` INSIDE the ternary and introduces one shared frame.**
This is why the kickoff calls row 1 "the spine". Concretely:

- **NEW** `src/components/debate/HeadZone.tsx` — `<HeadZone left={…} right={…} />`,
  the two-column grid and nothing else. One frame, two consumers, no duplicated grid
  class-set to drift.
- `MarketHeader` renders the **market arm** through it. `PostFocusHeader` renders the
  **post arm** through it. `DebateView`'s existing ternary picks one.
- `DebatePoll` stays **outside** the ternary, untouched — `DebateView.tsx:197-201`
  states why and that reason is unaffected.

**Consequence for row 9 (unruled).** `LifecycleBadge` + `Download .md` live at
`MarketHeader.tsx:66-77`. They become **market-arm only**, exactly like every other
`vm` element beside them. ⛔ **Neither is deleted** — row 9 is not in any phase list and
is not ruled, so nothing is removed; the ADR-0025 export stays reachable and the INV-4
read-only marker stays rendered wherever the market itself is the subject. In post-focus
the reader's market context is the row-17 market card, one click from exit.

### F-2 · ⛔ EXITING POST-FOCUS BECOMES UNREACHABLE IF ROW 17 IS BUILT NAÏVELY

`DebateView.tsx:155-163` syncs `?post=` with **`history.replaceState`, never
`pushState`** — deliberately (`:154`). So **browser Back does not leave post view.**
The only exit is `PostFocusHeader`'s `Back to market` button, which row 17 replaces
with the market card.

d5 contradicts itself here: the comment at `:1020` says *"context only — no click, exit
lives on the ↙ arrows"*, while `:1021` is `<div class="mcard vp" onclick="exitPost()"
style="cursor:pointer">`. **There are no ↙ arrows in the build.**

**⇒ Ruled in-plan: the market card IS the exit control** — interactive, keyboard-
reachable, carrying the existing accessible name `Back to the market` (byte-carried from
`PostFocusHeader.tsx:60`, not authored). Building it inert would make post-focus a trap.

### F-3 · ⛔ ROWS 23 + 24 STRAND EVERY REMOVED POST

Row 23 deletes `Open debate` and gives the **title** to `enterPost`. A **removed** post
has no title — `PostCard.tsx:52-75`'s removed branch renders a side badge, the
placeholder, the aggregate, the reply preview, and `Open debate →` (`:66-73`). d5 has no
removed state at all, so the mockup cannot answer this.

Compounding it: `page.tsx:81` makes `?post=` **fall back silently for a removed target**.
So with `Open debate →` gone, a removed post would be reachable by no path at all — and
its surviving replies (ADR-0020/0021 thread integrity, §6) would become unreachable with
it.

**⇒ Ruled in-plan: row 23 deletes `Open debate` on the PRESENT branch only. The removed
branch keeps `Open debate →` verbatim.** Row 40's placeholder stays (kickoff-ruled) and
the thread stays navigable.

### F-4 · ⛔ ROW 14's "now" HALF CANNOT BE COMPUTED INSIDE THE FENCE AS WRITTEN — and there is a 0-cost way out

`computeSell` needs `{reserves, side, shares}`. The reserves **are** read on this route —
`market-pricing.ts:96-103` — and then **discarded**: `getMarketPricingAndUnitToWin`
returns `{pricing, unitToWin}` only (`:110-113`). Exposing them means editing
`market-pricing.ts`, a **fourth** `src/server/**` file ⇒ **⛔ RUN-STOP**.

The recon's *"the pool reserves are already in hand from statement 6"* (B2.1 #4) is true
of the **read** and false of the **returned shape**. Corrected here.

**⇒ The way out, entirely inside the fence and at +0 statements:** `load-debate-view.ts`
calls the **already-exported** `getMarketPricingAndReserves` (`market-pricing.ts:57`)
instead of `getMarketPricingAndUnitToWin`, and derives `unitToWin` locally with the
**already-exported** `deriveUnitToWin` from `./quote` (the exact call
`market-pricing.ts:112` makes today). **Same one pool SELECT. Same DTO. Same values.
No fourth file.**

⚠ **This is a third edit to `load-debate-view.ts` beyond the two the fence's note
enumerates.** The fence's RUN-STOP is defined over the **file allow-list**
(*"THREE files, and only these"* / *"An edit outside it is ⛔ RUN-STOP"*), and this edit
is inside it. Declared here rather than absorbed. **If the founder reads the per-file
notes as exhaustive, this is the one line to strike — and then row 14 costs +1 statement
instead of +0** (see §7).

### F-5 · ⛔⛔ ROW 14 RENDERS A PER-POST NUMBER ARROWING INTO A PER-MARKET NUMBER — A MONEY-TRUTH QUESTION (⇒ **OD-1**)

- `sub.authorStake` (`load-debate-view.ts:266`) is the stake on **that post's** bet.
- `positions.quantity` is the author's **net holding in the whole market** — one row per
  `(user, market)`, guaranteed single-side by `I-SINGLE-SIDE-001`.

So `Đ 1,000 → Đ 1,407` puts a per-comment figure on the left of the arrow and a
per-market figure on the right. **An author with two posts sees two different staked
figures both arrowing into the same total** — each implying that post alone grew to it.

Three build facts make this a spec question, not a taste question:

1. `viewer-context.ts:36-43` fixes the **ratified Đb basis** — `computeSell(quantity).proceeds` —
   and states the **inheritance law**: *"one holding never shows two different current
   values."* Two cards showing the same holding beside two different Đa is that law
   inverted.
2. `SlotHeader.tsx:101` and `PositionStrip.tsx:16-18` **both** record the `Đa → Đb`
   grammar as **HELD** pending *"the Đa staked-basis ruling … as its SPEC.1 line
   (OQ-1)"*; `viewer-context.ts:18-20` records the same as ratified-absent.
3. A `Flipped` / `Exited` author's holding is on the **other side** or gone — a "now"
   under a YES post would contradict the marker chip rendered inches away.

**⇒ Plan default (0 extra reads, exactly true whenever shown):** the arrow half renders
**iff** `marker === "none"` **and** the author has exactly **one stake-bearing comment in
this market** (counted in-memory over the `comments` array `loadDebateView` already
holds). Otherwise **Đa alone** — today's render, unchanged. Đb is
`computeSell({reserves, side: post side, shares: quantity}).proceeds`, memoised **per
author** (not per post — ≤ one `computeSell` per distinct author per render).

**⇒ OD-1, for the founder:** widen to *"render whenever `marker === "none"`"* and accept
the multi-post overlap? It is a **one-predicate change**, and it is the founder's call
because it is a claim about money, not about layout. **I will not widen it unruled.**

### F-6 · ROW 3 — "structural slot, render no content" resolves to `null`, not to an empty box

Verified: `markets` carries `id · slug · title · description · status ·
resolution_deadline · resolved_at · resolution_outcome · media_video_url · created_by ·
created_at` (`src/db/schema/markets.ts:37-56`). **No resolver name, logo, source, or X
handle. No migration in this task** (kickoff-ruled).

Rendering the two card shells with empty fields would reproduce **`PD-3-09` / `OD-6`
exactly** — the ruling `MarketHeader.tsx:49-53` records, where a placeholder box *"rendered
a build-time note about unbuilt work to every participant"* and was deleted for it.

**⇒ `ResolverCards.tsx` occupies the grid position and returns `null` while it has no
data.** The slot is real in the composition and in the DOM contract; **row 3 produces
zero visual change today.** Its coverage is a structural render test, never a visual one.
**⇒ OD-2:** if the founder means visible empty chrome, say so and it is a two-line change.

### F-7 · ROW 25 CONTRADICTS SPEC.1 §9 IN THREE OPERATIVE PLACES, NOT ONE (O-4)

`ReplyPreview` is spec-mandated at:

- `SPEC.1.md:440` — §9 *"Reply ordering"* preamble: *"The debate-view **two-slot
  default** surfaces each parent's best Support reply and best Counter reply; a 'show
  all replies' affordance expands each side's full stake-sorted list."*
- `SPEC.1.md:447` — F-DEBATE-1 **System**: *"Under each post, the two-slot reply rule
  renders…"*
- `SPEC.1.md:449` — F-DEBATE-1 **Acceptance**, citing
  `replies.test.ts::two-slot-best-support-and-counter` and `::expansion-stake-sorted-within-side`
- `SPEC.1.md:1204-1205` — the two §17 acceptance rows.

**O-4 is explicit: the correction is written INTO each operative section.** An
amendments block at §0 reverses nothing a reader reaches first.

**⇒ Scope of the amendment, and its limit.** The amendment moves **where the two-slot
default surfaces**, never **whether the rule exists**. `ReplyGroups.twoSlot` stays on
the read model (`load-debate-view.ts:82,422,428`); `rankReplies`/`twoSlot` in
`src/lib/ranking` are untouched; `tests/unit/ranking/replies.test.ts` stays green. Only
the **market-view card render** goes, and post-focus already renders each side's full
stake-sorted list — which *is* the expansion the spec names.

**⇒ No ADR.** This is surface composition over an unchanged read model and an unchanged
ordering rule. Precedent is §22/§23 (`SPEC.1.md:1489-1490`): *"No new ADR: the selection
rule applies ADR-0017 Driver 2 … and is recorded here."* SPEC.1 **1.0.30 → 1.0.31**.

⚠ `ReplyPreview.tsx` is **not deleted**: `tests/unit/debate/render/reply-preview.test.tsx`
and `bookmark-toggle.test.tsx:577` render it directly, and its ADR-0032 remount defect
record (`:20-51`) is live docket. Its docblock claim *"A post card's reply section"*
becomes false and is corrected in the same commit (§9).

---

## §3 · ROW DISPOSITION — all 42, plus the reverse deltas

| Row | Disposition | Phase | Commit |
|---|---|---|---|
| 1 | BUILD — the two-column headzone, arm-scoped (F-1) | 1 | C1 (+C1B conditional) |
| 2 | BUILD — market media panel + outbound video | 2 | C11 |
| 3 | BUILD — structural slot, renders `null` (F-6) | 3 | C17 |
| 4 | BUILD — graph into the right rail | 1 | C4 |
| 5 | BUILD — collapsed-chart x ticks + labels | 1 | C5 |
| 6 | BUILD — question → attrs → criterion | 1 | C3 |
| 7 | BUILD — one-row detail price bar | 1 | C6 |
| 8 | BUILD — price-bar labels open the composer (`detail`-scoped) | 1 | C7 |
| **9** | **NO CODE CHANGE — unruled, unphased. Nothing deleted; becomes market-arm-scoped by F-1** | — | — |
| 10 | BUILD — criterion clamps to two lines (strike reversed) | 3 | C18 |
| 11 | BUILD — focused post's image into the header rail | 1 | C8 |
| 12 | BUILD — one-line author row, **both** consumers (no variant prop) | 3 | C21 |
| 13 | BUILD — entry price on the chip; `detail` at ONE site (§4) | 3 | C21 |
| 14 | BUILD — `staked → now`, gated (F-5 / OD-1) | 2 | C13 |
| 15 | BUILD — focused post teaser + `+` | 3 | C22 |
| 16 | BUILD — split bar pins to the stack foot | 1 | C9 |
| 17 | BUILD — market card replaces `Back to market`; **it is the exit** (F-2) | 2 | C11 |
| 18 | BUILD — vertical carousel rail, posts | 3 | C23 |
| 19 | BUILD — vertical carousel rail, replies | 3 | C23 |
| 20 | BUILD — `Đ BET` → `Buy` (strike reversed) | 3 | C24 |
| 21 | BUILD — `Sell` takes button shape, keeps navigation (strike reversed) | 3 | C25 |
| 22 | BUILD — Support/Counter trigger pills on the card footer (strike reversed) | 3 | C20 |
| 23 | BUILD — title enters post-focus; `Open debate` deleted on the **present branch only** (F-3) | 3 | C19 |
| 24 | BUILD — `+` glyph replaces `Read more`, `aria-label` retained (strike reversed) | 3 | C19 |
| 25 | BUILD — teaser + reply preview leave the card; **SPEC.1 amendment first** (F-7) | 3 | C15 → C16 |
| 26 | BUILD — reply-card anatomy (image half rides phase 2) | 2 + 3 | C12 → C26 |
| 27 | BUILD — `+` pop-up trigger on reply cards | 3 | C27 |
| **28** | **OMIT — kickoff-ruled. `REPLY_DEPTH_MAX = 1`; the quantity has no referent** | — | — |
| **29** | **NO SEPARATE CODE — kickoff-ruled. Rail = row 19; ⛔ paged per-side list NOT regressed** | — | (C23) |
| **30** | **⛔ OUT — POLISH.4. Not planned, not scaffolded for** | — | — |
| **31** | **⛔ OUT — POLISH.4. Not planned, not scaffolded for** | — | — |
| **32** | **⛔ OUT — bet engine, CLAUDE.md §1. Its own gated daytime PR** | — | — |
| 33 | BUILD — pop-up head cluster | 3 | C28 |
| 34 | BUILD — lightbox on reply images | 3 | C27 |
| 35 | BUILD — pop-up scroll resets on open | 3 | C28 |
| 36 | BUILD — page scroll resets on entering a post | 3 | C29 |
| **37** | **NO CODE CHANGE — reverse delta, unruled. `LaneBadge` kept** | — | — |
| **38** | **NO CODE CHANGE — reverse delta, unruled. `PositionMarker` kept** | — | — |
| **39** | **NO CODE CHANGE — reverse delta, unruled. `EmptySideCTA` kept** | — | — |
| **40** | **NO CODE CHANGE — kickoff-ruled: the placeholder STAYS (ADR-0020/0021)** | — | — |
| **41** | **NO CODE CHANGE — reverse delta, unruled. F-DEBATE-4 poll kept** | — | — |
| 42 | BUILD — pseudonyms link to Profile (§23; `SPEC.1.md:1628`) | 3 | C30 |

**Rows 9, 37, 38, 39, 41 are reverse deltas the founder has not ruled and the kickoff
does not phase.** Every one of them would DELETE a shipped feature. Row 40's explicit
ruling — *"the placeholder STAYS"* — is the precedent for all five, and "the layout
should exactly mimic the HTML" is a statement about arrangement, not a licence to delete
ADR-0025's export, the INV-4 marker, or the F-DEBATE-4 poll. **⇒ OD-3:** rule them if
you want them gone; otherwise they stand and this plan touches none of them.

---

## §4 · TWO ROWS THE KICKOFF ASKED THE PLAN TO DECIDE

### Row 13 — `detail` vs `base`

**Decision: wire `size="detail"` at exactly ONE site — the post-focus author row. Card
and reply chips stay on `base` and gain only the `price` prop.**

Grounds, all on `main`:

- `CHIP.detail` (`badges.tsx:67-68`) **was authored from d5's `.sidechip.md`**
  (`badges.tsx:65-66` says so, citing `:540`). d5's only `.md` chip in scope is
  **`:964`, the post-focus author row**.
- d5's card (`:1071`) and reply (`:1547`) chips are `.sm`, and `badges.tsx:73-81` warns
  in terms that d5's `.sm` carries **contextual radius overrides** (`:882`, `:911`) a
  flattened preset cannot express — so `profile` is *wrong* there despite the identical
  modifier, and a new d5-`.sm` preset would be **taking a value from the mockup**, which
  the one surviving rule forbids.
- **Row 13's substance — `YES @ 27%` — lands at all three sites regardless**, via the
  already-shipped optional `price` prop (`badges.tsx:127`, `entryPrice` already on the
  DTO at `:112` / `:456`, **0 extra reads**). Only the geometry preset is site-scoped.

⚠ `badges.tsx:118-125` — **render RAW, never `100 − x`.** `bets.price_at_bet` is already
the bought side's price. Held.

### Row 12 — variant prop, or does the market card change too?

**Decision: no variant prop. `ArgProfile` becomes one line for BOTH consumers.**

d5 renders the **identical** pipe-separated row at `:960-968` (post-focus `.pauthor`)
and `:1067-1074` (card `.argprofile`) — avatar · pseudonym `|` chip `|` staked→now `|`
`Replies · N` · card actions. The mockup does not ask for two shapes, so a variant prop
would be an abstraction for a difference that does not exist (§5.2). `showActions`
semantics are untouched (`ArgProfile.tsx:24-30`).

---

## §5 · THE COMMIT TABLE

One concern per commit, so a regression bisects in one step.
Every commit is preceded by `ZUGZWANG_ENV=preview just verify` then `echo EXIT=$?` (§10).

### PHASE 1 · FRAME — ⛔ a halt here stops the ENTIRE run

| # | Subject | Rows | Files | Guards touched |
|---|---|---|---|---|
| **C1** | `feat(debate): the headzone becomes a two-column, arm-scoped frame` | 1 | **+**`HeadZone.tsx` · `MarketHeader.tsx` · `PostFocusHeader.tsx` · `DebateView.tsx` · **+**`tests/unit/design/debate-height-chain.test.ts` · `tests/unit/debate/render/market-header.test.tsx` | height-chain (**new, authored here**), market-header |
| **C1B** | `feat(shell): /m/[slug] takes the wide container — HTML-FINISH-MD-1` | 1 | `DebateView.tsx` · `tests/unit/shell/page-container.test.ts` · `tests/unit/design/debate-height-chain.test.ts` | **page-container (`movedBy`)**, height-chain |
| **C2** | `test(debate): pin the headzone arm split` | 1 | `tests/unit/debate/render/market-header.test.tsx` · **+**`tests/unit/debate/render/head-zone.test.tsx` | new |
| **C3** | `feat(debate): the left column reorders to question → attrs → criterion` | 6 | `MarketHeader.tsx` · market-header test | market-header |
| **C4** | `feat(debate): the price chart moves into the header's right rail` | 4 | `MarketHeader.tsx` · market-header test | market-header |
| **C5** | `feat(debate): the collapsed chart gains its x ticks and date labels` | 5 | `chart/MarketPriceChart.tsx` · `chart/MarketPriceChartCard.tsx` · price-chart test · chart-overlay-a11y test | price-chart, chart-overlay-a11y, **pct-round** |
| **C6** | `feat(debate): the detail price bar collapses to one row` | 7 | `PriceBar.tsx` · price-percent-pair test · market-header test | price-percent-pair, **side-pole-binding**, **pct-round** |
| **C7** | `feat(debate): the detail price-bar labels open their side's composer` | 8 | `PriceBar.tsx` · `MarketHeader.tsx` · `DebateView.tsx` · price-percent-pair test | price-percent-pair |
| **C8** | `feat(debate): the focused post's image moves into the header rail` | 11 | `PostFocusHeader.tsx` · comment-image test | comment-image |
| **C9** | `feat(debate): the focused post's split bar pins to the stack foot` | 16 | `PostFocusHeader.tsx` · reply-split-bar test | reply-split-bar |
| **C10** | `chore(debate): log session — phase 1 frame complete` | — | `docs/logs/HTML-FINISH-MD.md` · `docs/plans/HTML-FINISH-MD.md` | — |

⚠ **C1B is CONDITIONAL and its trigger is a MEASUREMENT, not a preference.** See §6.

### PHASE 2 · SERVER — the three fenced files · ⛔ a halt here stops phase 2 only

| # | Subject | Rows | Files | Guards touched |
|---|---|---|---|---|
| **C11** | `feat(debate-view): market media + outbound video reach the header` | 2, 17 | **`server/markets/get-by-slug.ts`** · **`server/debate-view/load-debate-view.ts`** · **+**`MarketMediaPanel.tsx` · **+**`FocusMarketCard.tsx` · `MarketHeader.tsx` · `PostFocusHeader.tsx` · `tests/integration/market-by-slug.integration.test.ts` | no-raw-hex, emphasis-ladder, **side-pole-binding** (row 17's bar/thumb), no-raw-dharma |
| **C12** | `feat(debate-view): reply images ride the existing batched presign` | 26-image | **`server/debate-view/load-debate-view.ts`** · `ReplyCard.tsx` · `tests/unit/debate-export/_fixtures/mumbai-metro.input.ts` · `tests/unit/debate-export/serialize.test.ts` · comment-image test | debate-export fixtures (**compile**) |
| **C13** | `feat(debate-view): the author's current value rides the held-sides read` | 14 | **`server/debate-view/list-comments.ts`** · **`server/debate-view/load-debate-view.ts`** · `ArgProfile.tsx` · export fixtures · dharma-spacing test | **no-raw-dharma**, dharma-spacing, debate-export fixtures |
| **C14** | `chore(debate): log session — phase 2 server complete` | — | `docs/logs/HTML-FINISH-MD.md` | — |

**Reviewer cascade (no commit), run SEQUENTIALLY, one at a time:**
`@code-reviewer` over the three server files → then `@security-auditor` over the same
three. Directed scope, `@docs/plans/HTML-FINISH-MD.md` passed to each. ⛔ Never
concurrent — concurrent subagent `vitest` runs saturate local Postgres and manufacture
false reds.

### PHASE 3 · CARDS + OVERLAYS — ⛔ halts DO NOT cascade; one row's halt never suppresses another

| # | Subject | Rows | Files | Guards touched |
|---|---|---|---|---|
| **C15** | `docs(spec): SPEC.1 §9 — the two-slot preview leaves the market-view card` | 25 (spec) | `docs/specs/SPEC.1.md` (§0, §9 `:440`, F-DEBATE-1 `:447`+`:449`, §17 `:1204-1205`) | — |
| **C16** | `feat(debate): the teaser and reply preview leave the market-view card` | 25 | `PostCard.tsx` · `ReplyPreview.tsx` (**docblock**) · post-card test · reply-preview test (**docblock**) | post-card, reply-preview |
| **C17** | `feat(debate): the resolver-card structural slot` | 3 | **+**`ResolverCards.tsx` · `MarketHeader.tsx` · **+** its render test | new |
| **C18** | `feat(debate): the resolution criterion clamps to two lines` | 10 | `MarketHeader.tsx` (**docblock reversal**) · market-header test | market-header |
| **C19** | `feat(debate): the title enters post-focus and a + glyph opens the pop-up` | 23, 24 | `PostCard.tsx` (**docblock reversal**) · post-card test | post-card |
| **C20** | `feat(debate): Support/Counter triggers return to the card footer` | 22 | `AggregateFooter.tsx` (**docblock reversal**) · `PostCard.tsx` · `DebateView.tsx` · aggregate-footer test | aggregate-footer, **side-pole-binding** |
| **C21** | `feat(debate): the author row becomes one line and the chip carries entry price` | 12, 13 | `ArgProfile.tsx` · `badges.tsx` · `PostFocusHeader.tsx` · **`tests/unit/debate/render/side-badge.test.tsx`** · avatar-ring test | **side-badge (`wiredDetail`)**, avatar-ring, pct-round, dharma-spacing |
| **C22** | `feat(debate): the focused post shows a teaser and a + expand` | 15 | `PostFocusHeader.tsx` · new render test | — |
| **C23** | `feat(debate): the scrollers take a vertical rail` | 18, 19, 29 | **+**`ScrollRail.tsx` · `scrollers.tsx` · `DebateColumn.tsx` · new render test | — |
| **C24** | `feat(debate): the market-arm entry trigger reads Buy` | 20 | `composer/SlotHeader.tsx` ⚠ cross-owner | — |
| **C25** | `feat(debate): the held-side Sell affordance takes button shape` | 21 | `composer/SlotHeader.tsx` ⚠ cross-owner | — |
| **C26** | `feat(debate): the reply card takes the mockup's anatomy` | 26 | `ReplyCard.tsx` · reply-card render test · dharma-spacing test | dharma-spacing, avatar-ring, **side-pole-binding** |
| **C27** | `feat(debate): reply cards open a pop-up and their images open the lightbox` | 27, 34 | `ReplyCard.tsx` · `dialogs.tsx` · `scrollers.tsx` · `DebateView.tsx` · post-popup test | post-popup |
| **C28** | `feat(debate): the pop-up head takes the mockup's cluster and resets its scroll` | 33, 35 | `dialogs.tsx` · post-popup test · dharma-spacing test | post-popup, dharma-spacing, avatar-ring |
| **C29** | `feat(debate): entering a post resets the page scroll` | 36 | `DebateView.tsx` | — |
| **C30** | `feat(debate): author pseudonyms link to their profile` | 42 | `ArgProfile.tsx` · `ReplyCard.tsx` · `dialogs.tsx` · render tests | — |
| **C31** | `chore(debate): log session — HTML-FINISH · MARKET DETAIL close-out` | — | `docs/logs/HTML-FINISH-MD.md` | — |

---

## §6 · C1B — THE CONTAINER MOVE, AND WHY IT IS CONDITIONAL

`CONTAINER_PRESETS.wide` (`max-w-[1440px] px-6 py-6`) **already exists** on `main`
(`PageContainer.tsx:69`), minted at HTML-FINISH · PROFILE row 20. Sites 2 and 5 already
use it. `/m/[slug]` is **site 9**, on `debate` (`max-w-5xl` = 1024).

**⛔ I will not assert that row 1 needs it, because I cannot measure it in plan mode.**
A hand-mapped probe reproduces the author's own assumption; resolved geometry is proven
in a browser against the **compiled `.next` CSS**, which is not a thing CI does.

**The named trigger for C1B — the Profile row-20 defect signature:** build C1 on
`debate`, serve, and measure at **1440 and 768**. C1B fires **iff** the headzone's right
rail or the arena columns measure the **same width at 1440 as at 768** — i.e. the
container, not the content, is the binding constraint. That is the exact defect
`page-container.test.ts:118-121` records for Profile (*"two 356px columns at 1440 —
IDENTICAL to its 768 rendering"*).

**On the standing evidence, C1B is EXPECTED to fire.** Profile and Bookmarks both hit
this wall with two-column arenas, and `/m/[slug]` will have a two-column header **above**
a two-column arena. The conditional exists so the ruling carries a measurement rather
than an expectation.

**C1B's mechanics, if it fires:**

1. `DebateView.tsx` — `preset="debate"` → `preset="wide"`. ⛔ `PageContainer.tsx` is
   **read-only**: the preset is **consumed, never re-minted** (site 2's precedent,
   `page-container.test.ts:97-98`).
2. `page-container.test.ts` site 9 gains `now:` + `movedBy:` — the guard's **own
   first-class mechanism** (`:56-73`: *"`before` stays the historical baseline, `now`
   states the ruled current value, and `movedBy` says who ruled it"*). `adds: "w-full"`
   is **kept**, not folded in — the "exactly one site adds a class" row at `:335-341`
   still expects `[9]` / `"w-full"`.
3. The enumeration at `:310` moves `[2, 5]` → `[2, 5, 9]`.
4. `movedBy` string names the ruling: **`HTML-FINISH-MD-1`** + the measurement.

**⇒ This is USING the guard, not fixing it.** The guard states in terms that a wiring
change *"reddens and the wiring becomes a DECISION"*; `#337` and `#338` each used the
same mechanism. The measurement goes in the commit body as its ground.

⛔ **Never quote a full `<PageContainer …>` tag in a comment under `src/`** — the guard
slurps whole files with `/<PageContainer\b[^>]*>/` and a prose match is a **false RED**
(`page-container.test.ts:221-224`).

---

## §7 · THE MEASURED STATEMENT-COUNT DELTA — **+1 per render** ✅

**Method (stated so it is checkable).** Not a grep. Each module reached from
`page.tsx` was read and the statements it actually issues on one render were counted,
file:line by file:line. Baseline reproduced from RECON-B §B2.0 and independently
re-read: **13** signed-out · **20** signed-in without a position · **22** signed-in,
holding, with `?post=`. One explicit transaction (`viewer-context.ts:114`).

| Phase-2 edit | File:line touched | Statements | Why |
|---|---|---|---|
| `mediaVideoUrl` added to the projection | `get-by-slug.ts:39-45` | **+0** | Same `SELECT`, one more column on the row already read |
| `market_media` default image read | `load-debate-view.ts` (new call to the **already-exported** `getDefaultMarketMediaUrl`, `discovery/media.ts:40`) | **+1** | The one genuinely new statement. Read-only reuse — no `discovery/**` file is written |
| Row 17's market thumbnail | — | **+0** | Same URL as the line above (RECON-B B2.1 #5) |
| Reply images | `load-debate-view.ts:196-199` — drop `.filter(c => c.parentCommentId === null)` | **+0** | `mintImageUrls` already issues **one** batched `image_uploads` SELECT (`:368`); the `inArray` widens. Cost is **+N local HMAC presigns** (`signRead` — no network, no DB) |
| Author held quantity | `list-comments.ts:90-99` — add `quantity` to the projection | **+0** | Read 2 already runs for every author in this market; one more column |
| Pool **reserves** for `computeSell` | `load-debate-view.ts` — `getMarketPricingAndReserves` (`market-pricing.ts:57`) replaces `getMarketPricingAndUnitToWin`; `unitToWin` derived locally via `deriveUnitToWin` | **+0** | **Identical one-row pool SELECT.** See **F-4** |

### **TOTAL: +1 statement per render. Budget met exactly.**

⚠ **The multiplier is the point, and it is why the +0s were hunted.** `DebatePoll.tsx:107-110`
× `POLL_INTERVAL_MS_DEBATE_VIEW = 15000` (`limits.ts:262`) ⇒ **4 renders/minute/viewer**.
So **+1 read = +4 statements/minute/viewer**, against `src/db/index.ts:15` `max: 10` and
a 15-slot session pooler. A naive row 14 — `getHeldPosition` per post — would have been
**+4N statements/minute/viewer** on the app's hottest route. ⛔ **Never loop
`getHeldPosition`.** `list-comments.ts:83-88` already states this in terms.

**⇒ REPORTED, per the kickoff's instruction:** the plan does **not** exceed +1 — but it
reaches +1 only via the **F-4** helper swap. Strike that swap and the delta is **+2**
(a second pool read for the reserves). That is the finding the budget line asked for.

**CPU, stated because it is not free:** `computeSell` is decimal.js at precision 50.
Memoised **per author**, so ≤ (distinct authors) executions per render, not per post.

---

## §8 · THE GUARD MAP — ⛔ FIX THE CODE, NEVER THE GUARD

| Guard | Reddened by | How the CODE greens it |
|---|---|---|
| `design/no-raw-hex-view-layer.test.ts` (`SCAN_DIRS = src/components, src/app/(public)`) | C11, C17, C26 — any ported colour | **Port no hex.** Every new surface uses `@theme` tokens. d5 is light-theme; a name-copy inverts poles (`PriceBar.tsx:40-46`) |
| `design/side-pole-binding.test.ts` (recursive over `src/`, `(admin)` excluded, 8-entry inventory) | C6, C7, C11, C20, C26 — new pole-bearing expressions | Resolve side → pole token **AT the call site** (the `AggregateFooter.tsx:71-72` shape, which is the shape that cannot invert silently). ⛔ **The PREDICATE is never relaxed** (`:340-344`); if a new file must enter, it enters the **inventory** by that file's own documented process, with grounds |
| `design/pct-round-render.test.ts` | C5, C6, C7, C21 | Route every percent through `format.ts`. A genuinely single-side, single-point-in-time value takes a `pctround-allow` marker **with grounds** — the `MarketPriceChartCard.tsx:21-22` pattern |
| `design/no-raw-dharma-render.test.ts` | C11, C13, C26, C28 | Every `Đ` quantity through `formatDharma`; canon §107 **spaced** grammar |
| `design/emphasis-ladder-tokens.test.ts` | C11, C17 — new panels | New panel edges use **`--hairline`**. ⛔ **NOT `--border-strong`** — pinned at **zero** consumers (`:216`) |
| `design/avatar-ring-token.test.ts` | C21, C26, C28 — each adds an avatar | Ring binds by token |
| `design/tokens-monochrome.test.ts` | **should not fire** | No row adds a token. If it fires, a value was taken from the mockup — **halt the row** |
| **`design/debate-height-chain.test.ts`** (**NEW**, C1) | authored RED-adjacent in C1; extended in C1B | Declares the chain by NAME, node by node, modelled on `profile-height-chain.test.ts`: `<main>` (source, `(public)/layout.tsx:108`, out of scope) → container → **headzone band, declared, does NOT grow** → **arena band `flex-1 min-h-0`** → columns `min-h-0`. ⚠ `min-h-0` is the link everyone drops and dropping it is invisible. ⚠ Source-scan, not render — jsdom performs no layout |
| **`shell/page-container.test.ts`** | **C1B only** | `now` + `movedBy` on site 9 + `[2,5]`→`[2,5,9]`. **The guard's own mechanism** (§6). ⛔ `PageContainer.tsx` stays read-only |
| **`debate/render/side-badge.test.tsx`** | **C21** | `wiredDetail` moves `[]` → an enumerated one-site set, mirroring exactly what POLISH.5 did for `profile` (`:484-510`). The guard's stated design: *"If a later PR wires one, this reddens and the wiring becomes a DECISION"* |
| `debate/render/market-header.test.tsx` | C1, C3, C4, C18 | The component's arrangement changed; the assertions describe the new arrangement. ⛔ **Assert on `innerHTML`, never `textContent`** (O-7) |
| `debate/render/post-card.test.tsx` | C16, C19 | New card composition |
| `debate/render/aggregate-footer.test.tsx` | C20 | Four assertions (two poles × two post sides) **extended**, never relaxed — the pills are pole-bearing |
| `debate/render/reply-preview.test.tsx` | **C16 — docblock only** | The component is unchanged and stays green. Its `:28` claim *"`PostCard` renders `ReplyPreview` at TWO call sites"* goes **false** and is corrected in C16 |
| `debate/render/post-popup.test.tsx` | C27, C28 | New head cluster + reply variant |
| `debate/render/reply-split-bar.test.tsx` | C9 | Pinned-foot placement |
| `debate/render/comment-image.test.tsx` | C8, C12 | New mount sites |
| `debate/render/dharma-spacing.test.tsx` | C13, C26, C28 | Spaced `Đ ` grammar on every new site |
| `debate/render/price-chart.test.tsx` · `chart-overlay-a11y.test.tsx` | C5 | Collapsed mode gains ticks + labels; the `sr-only` summary shape is **unchanged** |
| `debate/render/price-percent-pair.test.tsx` | C6, C7 | One-row detail render |
| **`unit/debate-export/_fixtures/mumbai-metro.input.ts` + `serialize.test.ts`** | **C12, C13** | ⚠ **COMPILE break, not an assertion break.** Adding `imageUrl` to `DebateReply`'s non-removed variant (and any author-value field) invalidates every fixture literal — **6 reply sites** in `mumbai-metro.input.ts` plus `serialize.test.ts:270,343,504`. Fixed **by hand, file by file**, ⛔ never by a bulk-rewrite script. ADR-0025's export is text-only, so `serialize.ts` emits no image — **verify that at build, do not assume it** |
| `tests/server/debate-view/*`, `tests/integration/market-by-slug.integration.test.ts` | C11, C12, C13 | DTO projections widened |

**Not reddened, asserted:** `tests/unit/ranking/replies.test.ts` (`twoSlot` untouched),
`tests/invariants/**` (no invariant surface is touched), `tests/db/**`,
`tests/staging/**`.

---

## §9 · DOCBLOCK UPDATES — each corrected in the commit that reverses it

| File:line | What it records | Reversed by | Correction |
|---|---|---|---|
| `PostCard.tsx:110-121` | R4 (2026-08-12): adopt `Read more`; *"the Plus glyph is REMOVED rather than relabelled"*, with the WCAG 2.5.3 argument | **C19** (row 24) | Rewrite to record the **2026-08-16 founder override**: the `+` glyph returns and **carries an `aria-label`**, so the accessible name survives — the WCAG concern is answered rather than dismissed. ⛔ Do not delete the R4 record; supersede it in place (O-4) |
| `PostCard.tsx:21-24` | *"the disabled `Đ BET` and `Support / Counter` write triggers were REMOVED at POLISH.3 PR 2 rows 1-2 (`PD-0-02`, R1)"* | **C20** (row 22) | Same treatment — record the override |
| `AggregateFooter.tsx:14-20` | *"⛔ THE MOCKUP'S TRIGGERS ARE DELIBERATELY ABSENT"* + the R1 thesis ground | **C20** (row 22) | Rewrite. ⛔ **`:22-51` — the pole-keying paragraph — is NOT touched.** It is not a ruling being reversed; it is the correctness rule the new pills must obey |
| `MarketHeader.tsx:86-96` | *"⛔ NO CLAMP, AND THAT IS A RULING, NOT AN OMISSION (§17 H-T1(c))"* + three grounds | **C18** (row 10) | Rewrite to record the override. ⚠ **O-9 FIRES HERE** — this docblock cites `§17 H-T1(c)`, `PD-0-01`/`R4`, and `U3`. Editing it changes what those citations assert ⇒ **read each at HEAD before saving**, and if the clamp contradicts a live §-text, that contradiction rides a rider in the **same commit** |
| `ReplyPreview.tsx:117-119` | *"The two-slot default is SPEC-MANDATED and §2 explicitly does NOT remove it"* | **C16** (row 25) | Rewrite: the rule **survives on the read model and in post-focus**; only the **market-view card render** goes. ⚠ **O-9 FIRES** — a SPEC.1 §9 claim. Its correction is exactly why **C15 (the amendment) is commit ONE of phase 3** |
| `ReplyPreview.tsx:11-18` | *"A post card's reply section"* | **C16** | Becomes false when `PostCard` stops rendering it |
| `reply-preview.test.tsx:28` | *"`PostCard` renders `ReplyPreview` at TWO call sites"* | **C16** | Becomes false |
| `PriceBar.tsx:16-20` | D-J: the one-row divergence *"recorded and NOT actioned"* | **C6** (row 7) | Now actioned — `detail` moves **into** the `ROW` map and the early return is deleted, which is precisely what the docblock says adopting it would mean |
| `MarketPriceChartCard.tsx:9-11` | *"the two lines only (no axis, no nodes)"* | **C5** (row 5) | Collapsed now carries **ticks + date labels**; **nodes stay expanded-only** |
| `SlotHeader.tsx:78`, `:73` · `COMPOSER_COPY` | `Đ BET` brand string | **C24** (row 20) | Relabelled to `Buy`; the `aria-label` moves with it |

---

## §10 · THE VERIFY PROTOCOL

Before **every** commit, exactly these two statements, in this order, **unpiped, each its
own statement, nothing trailing**:

```
ZUGZWANG_ENV=preview just verify
echo EXIT=$?
```

⚠ `ZUGZWANG_ENV=preview` is required or `next build` fails on
`invalid ZUGZWANG_ENV ("unknown")` — env-only, never a regression.
⚠ ANY trailing command owns the compound exit. The echo is **last**.
⚠ `just verify` runs **no tests** and checks **no markdown** — Biome 2.4.13 has no
markdown support and `ignoreUnknown: true`, so C15 (spec-only) will check **0 files**.
A green `just verify` on C15 is **not** a receipt about that diff.

**At each phase boundary, and before the PR:**

```
pnpm vitest run
```

run **backgrounded to a log** — the full suite is ~35 min and a foreground Bash call
dies at the 10-min cap. Gauge liveness by log growth. ⛔ Check `ps` for a second runner
before believing any red: concurrent `vitest` runs truncate each other's fixtures into a
false RED across untouched suites.

**Critical path (§5.7)** — phase 2 touches `src/server/**`, so additionally:
`pnpm test:invariants` and `pnpm test:integration`. Local Postgres on `:54322` is
usually already up and migrated (`docker ps` first; run `pnpm vitest` **directly**, not
via `just`, which points at the cloud DB).

**Pre-PR (§5.10):** the self-audit against this plan, item by item —
**PASS** / **FAIL** (fix in-session) / **SURPRISE** (surface, don't absorb). Surprises
are documented as wins in the close-out log, not buried.

---

## §11 · THE FILE ALLOW-LIST — complete. An edit outside it is ⛔ RUN-STOP

### `src/server/**` — THE FENCE. Three files. No fourth, ever.
```
src/server/debate-view/list-comments.ts
src/server/debate-view/load-debate-view.ts
src/server/markets/get-by-slug.ts
```
Read-only reuse (imported, **never written**): `server/discovery/media.ts` ·
`server/debate-view/market-pricing.ts` · `server/debate-view/quote.ts` ·
`server/cpmm/calculate.ts` · `server/storage/sign-read.ts`.

### `src/components/**`
```
debate/HeadZone.tsx              (NEW, C1)
debate/MarketMediaPanel.tsx      (NEW, C11)
debate/FocusMarketCard.tsx       (NEW, C11)
debate/ResolverCards.tsx         (NEW, C17)
debate/ScrollRail.tsx            (NEW, C23)
debate/DebateView.tsx            debate/MarketHeader.tsx      debate/PostFocusHeader.tsx
debate/PriceBar.tsx              debate/PostCard.tsx          debate/ReplyCard.tsx
debate/ReplyPreview.tsx (docblock only)                       debate/ArgProfile.tsx
debate/AggregateFooter.tsx       debate/scrollers.tsx         debate/DebateColumn.tsx
debate/dialogs.tsx               debate/badges.tsx            debate/CommentImage.tsx
debate/chart/MarketPriceChart.tsx      debate/chart/MarketPriceChartCard.tsx
debate/composer/SlotHeader.tsx   ⚠ CROSS-OWNER — rows 20, 21
```

### `tests/**`
```
tests/unit/design/debate-height-chain.test.ts        (NEW)
tests/unit/debate/render/head-zone.test.tsx          (NEW)
tests/unit/debate/render/{resolver-cards,market-media-panel,focus-market-card,
                          scroll-rail,reply-card}.test.tsx   (NEW)
tests/unit/shell/page-container.test.ts              (C1B ONLY, movedBy mechanism)
tests/unit/debate/render/{market-header,post-card,aggregate-footer,reply-preview,
                          side-badge,post-popup,reply-split-bar,comment-image,
                          dharma-spacing,price-chart,price-percent-pair,
                          chart-overlay-a11y}.test.tsx
tests/unit/design/{side-pole-binding,pct-round-render}.test.ts   ⚠ INVENTORY / ALLOW-MARKER
                                                                    ENTRIES ONLY, WITH GROUNDS.
                                                                    ⛔ PREDICATES NEVER RELAXED
tests/unit/debate-export/serialize.test.ts
tests/unit/debate-export/_fixtures/mumbai-metro.input.ts
tests/server/debate-view/**                          (phase 2 DTO)
tests/integration/market-by-slug.integration.test.ts (phase 2 DTO)
```

### `docs/**`
```
docs/specs/SPEC.1.md            (C15 — §0, §9:440, F-DEBATE-1 :447/:449, §17 :1204-1205)
docs/plans/HTML-FINISH-MD.md    (this plan, committed before phase 1 ends — §5.1)
docs/logs/HTML-FINISH-MD.md     (C10 · C14 · C31 — §5.9)
```

### ⛔ EXPLICITLY OUT — an edit here is a RUN-STOP
```
src/db/**                              drizzle/**                      supabase/**
any src/server/** not the three        src/app/(public)/layout.tsx     src/components/ui/**
src/components/shell/PageContainer.tsx   ← the `wide` preset is CONSUMED, never re-minted
src/components/debate/composer/**  EXCEPT SlotHeader.tsx    ← POLISH.4 territory
src/components/debate/composer/BetComposer.tsx · ReplySplitBar.tsx · PositionStrip.tsx
src/components/discovery/**            src/components/profile/**       src/components/bookmarks/**
tracker files of any kind              claude-progress.md (gitignored — never `git add`)
```

⚠ **`ReplySplitBar.tsx` is OUT even though row 16 concerns the split bar.** Row 16 is
*placement* — pinning the bar to the foot of the stack — and that is `PostFocusHeader`'s
container, not the bar's internals. If row 16 turns out to require editing
`ReplySplitBar.tsx`, that is a **HALT**, not an edit.

---

## §12 · HALT CONDITIONS — per phase, and what each halt does NOT stop

### PHASE 1 — ⛔ A HALT STOPS THE ENTIRE RUN. Phases 2 and 3 do not attempt.

| H | Condition | Why it is fatal |
|---|---|---|
| **H1-a** | Row 1 cannot express the arm swap without moving `DebatePoll` inside the ternary | `DebateView.tsx:197-201` — inside the ternary, entering a post resets `stopped`/`wasSuspended` and "stopped permanently" lasts until the next post open |
| **H1-b** | Row 1 or C1B requires an edit to `PageContainer.tsx` or `(public)/layout.tsx` | Both are allow-list-excluded. The preset is consumed, never re-minted |
| **H1-c** | Any phase-1 row needs a **value** from d5 — colour, radius, px, type size, duration | The one surviving rule |
| **H1-d** | `tokens-monochrome.test.ts` reddens | Nothing in phase 1 adds a token; if it fires, a value was taken |
| **H1-e** | Row 8's `onPick` handler makes `next build` fail on a server/client boundary via Discovery's two `PriceBar` sites (`MarketCard.tsx:103`, `HeroPanels.tsx:142`) | Fallback is a separate `"use client"` detail component — but it changes the file set, so it is **ruled, not improvised** |
| **H1-f** | Row 16 requires editing `ReplySplitBar.tsx` | Allow-list |

⚠ **Halting phase 1 is halting everything, so H1-e in particular is checked EARLY** —
build C6/C7 and run `ZUGZWANG_ENV=preview just verify` before investing in C8/C9.

### PHASE 2 — ⛔ A halt stops PHASE 2 ONLY. Phase 3 proceeds without the flagged values.

| H | Condition | Phase 3 proceeds by |
|---|---|---|
| **H2-a** | Any edit needed in a **fourth** `src/server/**` file | Halt phase 2 whole. Rows 2, 14, 17, 26-image do not land; phase 3 builds every other row against today's DTO |
| **H2-b** | The measured delta exceeds **+1** and cannot be brought back inside the fence | Same |
| **H2-c** | **OD-1** must be answered before row 14 can render a true number and no answer has arrived | **Row 14 alone halts.** Rows 2, 17, 26-image still land — they are independent |
| **H2-d** | `@code-reviewer` or `@security-auditor` returns CRITICAL/HIGH in scope | Fix in-session before the PR (§5.11). Out of scope ⇒ `claude-progress.md` + STOP |
| **H2-e** | Any `tests/invariants/**` red | ⛔ Absolute. Never proceed past an invariant red |
| **H2-f** | The export-fixture compile sweep cannot be completed by hand | Halt C12/C13. ⛔ No bulk-rewrite script |

⚠ **Phase 3's rows 12, 13, 26, 33 do NOT depend on phase 2.** Row 12 renders the
one-line author row with whatever `ArgProfile` has; if phase 2 halted, that is Đa alone,
exactly as it ships today. Row 26 rebuilds the reply card's anatomy with no image slot.
**No phase-3 row is suppressed by a phase-2 halt.**

### PHASE 3 — ⛔ HALTS DO NOT CASCADE. ⛔ NO PARTIAL SHIPS.

| H | Condition | Scope of the halt |
|---|---|---|
| **H3-a** | **C15's SPEC.1 amendment cannot be written without authoring decision text the web owns** | **Row 25 only.** ⛔ Never author web-owned spec decision text — block and re-request. Rows 3, 10, 12, 13, 15, 18–24, 26, 27, 33–36, 42 all proceed |
| **H3-b** | A row needs a **value** from d5 | **That row only.** Reported whole, built not at all |
| **H3-c** | A row can only be made green by relaxing a guard **predicate** | **That row only.** ⛔ Fix the code, never the guard. Inventory/allow-marker entries with grounds are the guard's own mechanism and are not this |
| **H3-d** | Row 21 cannot keep navigation while taking button shape | **Row 21 only.** d5 itself navigates (`:1909-1911` → `nav('profile')`); a button that does not navigate would be a regression, not a port |
| **H3-e** | Row 27's reply pop-up requires widening `PostPopup`'s union in a way that would let a **removed** reply reach it | **Row 27 only.** ⛔ **SC-1 fires** — see §13 |
| **H3-f** | Row 3 cannot be made to render `null` without dead code a reviewer would reject | **Row 3 only** ⇒ escalate as **OD-2** |

**⛔ NO PARTIAL SHIPS.** A row lands whole or is reported whole. A half-built row is
reverted out of the branch before the phase closes, not left behind a flag.

---

## §13 · SC-1 — THE STANDING MASKING CHECK, AND IT FIRES ON THIS TASK

CLAUDE.md §5.14 SC-1: *"Masking is a property of every body read, not of rows … Fires on
any PR that adds or edits a read over `comments`, on any surface."* **This PR edits two.**

| Where | Obligation |
|---|---|
| **C12** — `mintImageUrls` widened to replies (`load-debate-view.ts:196-199`) | It is fed **`visible`**, which is `comments.filter(c => !removedSet.has(c.id))` (`:188`). ⛔ **Only the `parentCommentId === null` filter is dropped. The `visible` derivation is NOT touched** — a removed reply's image URL must never be minted, exactly as a removed post's never is |
| **C13** — `list-comments.ts` read 2 widened | `positions` carries no body. No masking surface. Stated so the check is discharged, not skipped |
| **C26/C27** — reply card body + reply pop-up | `DebateReply`'s removed variant carries **no `body`** (`load-debate-view.ts:64`), so the client cannot render one. ⛔ The `+` trigger and the pop-up must live on the **non-removed branch only** — the `ReplyCard.tsx:24-29` placement rule, which that file records is **not** type-enforced |
| **Every new test** | ⛔ Assert the **BODY's absence, not the row's**: `expect(JSON.stringify(rows)).not.toContain(theBody)`. A row-level exclusion assertion does not catch a second body-read path — which is the live leak SC-1 was minted from |

---

## §14 · OPEN DECISIONS — surfaced for the relay, not asked in-CLI

Per the relay model, these flow web → founder → CC. **None blocks the start of phase 1.**

| OD | Question | Plan default if unruled | Cost to flip |
|---|---|---|---|
| **OD-1** | **Row 14 / F-5.** May `Đ staked → Đ now` render when the author has **more than one** stake-bearing comment in this market — i.e. when the right half is a per-market figure beside a per-post figure? | **No.** Pair renders only when `marker === "none"` **and** the author has exactly one stake-bearing comment here. Otherwise Đa alone (today's render) | **One predicate.** Nothing else moves |
| **OD-2** | **Row 3 / F-6.** "Render no content" = `null` (zero visual change), or visible empty card chrome? | **`null`.** Visible empty chrome reproduces `PD-3-09`/`OD-6` verbatim | Two lines |
| **OD-3** | **Rows 9, 37, 38, 39, 41.** Five reverse deltas, unruled and unphased. Delete `Download .md` / the lifecycle badge / `LaneBadge` / `PositionMarker` / `EmptySideCTA` / the F-DEBATE-4 poll? | **Keep all.** Row 40's ruling is the precedent; "mimic the layout" is not a licence to delete ADR-0025, an INV-4 marker, or a spec'd poll | Per-row, small — except the poll, which is `SPEC.1 §9 F-DEBATE-4` and would need an amendment |
| **OD-4** | **F-4.** Is the fence's per-file note exhaustive, or is the **file list** the fence? The `getMarketPricingAndReserves` swap is a third edit inside `load-debate-view.ts` | **File list is the fence.** The swap lands; delta stays **+1** | Strike it ⇒ delta becomes **+2**, reported as an overage |
| **OD-5** | **Row 42.** Confirm the identification: row 42 = clickable pseudonyms → Profile (`RECON-B B2.1 #13` / `B1 #60`) | Build it — `SPEC.1.md:1628` already rules the same behaviour for Discovery | Strike the row |

---

## §15 · CLOSING RITUAL

*Should CLAUDE.md / AGENTS.md / the workflow / the tracker change as a result of this
session?*

**Three candidates, all deferred to the execute session's own close-out** (this plan
writes no tracked file):

1. **CLAUDE.md §1 — SPEC.1 version stale.** Reads **1.0.29**; live is **1.0.30**, and
   C15 takes it to **1.0.31**. The correction rides C15's commit, not a follow-up.
2. **AGENTS.md §3** — the `src/components/debate/` file list gains five components
   (`HeadZone`, `MarketMediaPanel`, `FocusMarketCard`, `ResolverCards`, `ScrollRail`)
   and `tests/unit/design/` gains a fourth height chain. Descriptive drift; folds at the
   next SYNC, **unless** the execute session's own close-out is the natural place — it
   is, because §3 explicitly enumerates the tree.
3. **⛔ No O-space mint is proposed.** F-1 through F-7 are task findings, not durable
   operating disciplines. If any becomes one it is the founder's mint at close-out —
   O-space carries no CC-only mint clause, and the ceiling is **O-9**.

⛔ **No tracker file is touched.** The tracker is operator-maintained external HTML.

---

## §16 · WHAT THIS PLAN DOES NOT CONTAIN

- ⛔ **No `ultracode`. No dynamic workflow. No subagent fan-out** beyond the two §5.11
  reviewers phase 2 names, run **sequentially**.
- ⛔ **No migration, no DDL, no `src/db/**`, no `drizzle/**`.**
- ⛔ **No slippage modal (row 32), no composer hosting (rows 30, 31).** Not planned, and
  nothing in §5 scaffolds for them.
- ⛔ **No value read off `surface_d5_v1_0.html`.**
- ⛔ **No copy authored.**

---

**Recon method:** one sequential read-only pass. No fan-out, no subagent re-derivation.
Every `file:line` above was read at `fd4b357`, not recalled and not taken from either
recon document without re-reading the source. Where a recon claim proved wrong against
the live file — **RECON-B B2.1 #4's "the pool reserves are already in hand"** — it is
corrected in **F-4** and the correction changes the plan.
