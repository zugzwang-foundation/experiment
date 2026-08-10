# POLISH — Defect Register

> **Doc:** `POLISH-register.md` · web-authored from operator captures. Committed 2026-08-05. GitHub is canonical; PK is the mirror.
> **Status:** scaffolded 2026-07-30 IST at POLISH.0. **No surface has had a founder VISUAL inspection.** POLISH.2 · Discovery has had a **CC machine pass** (2026-08-09, §9 as amended) — mockup-against-source, which cannot see what only a render shows. The two are different events and the surface is closed by neither alone. *(Through 2026-08-08 this line read "No surface has been inspected", which was already stale: it was committed on 2026-08-05, two days after POLISH-1a shipped ten deltas against the shell.)*
> **Governed by:** `POLISH-0.md` §4 (schema) and §5 (routing). Read those first.

---

## How to use this

One row per defect. Web authors rows from the operator's captures; the operator ratifies dispositions; **only the founder may set `accepted-divergence`** (P12).

**ID:** `PD-<surface>-<nn>` — surface is the POLISH number (`3`, `7a`, `7b`). Stable forever. Never renumbered, never reused.

**The `baseline` field is the gate.** If you cannot name the tier and the document a thing violates, it is **not** a visual defect — it is class **S**. That test is what keeps this register from becoming taste.

**Class:** V visual · F functional · B backend gap · S spec gap · R ruling needed.
**Disposition:** `routed` · `superseded` · `data-blocked` · `duplicate-of-known` · `accepted-divergence`.
**Status:** `open` · `routed` · `fixed` · `verified` · `closed`.

⚠ **Schema is binding — see POLISH-0 §4.1.** `class` takes exactly one letter; `status` takes exactly one of five values; a row is **NEVER** appended below a blank line.

**At each surface close:** emit a batched summary row into the tracker. Never row-by-row.

**Row template — copy this:**

```
| PD-n-01 | <one-line title> | V | tier-2 · canon §10 R-5 | POLISH-n_<surface>_<state>.png | routed | open | — | <PR / tracker row / halt> |
```

---

## POLISH.1 · Shell + branded header/nav

*Not yet inspected. Gates: B4 · B8 · B10.*

| ID | Title | Class | Baseline | Evidence | Disposition | Status | Root cause | Routed to |
|---|---|---|---|---|---|---|---|---|
| — | — | — | — | — | — | — | — | — |

## POLISH.7a · Auth surfaces

*Not yet inspected. No gates — ships now.*

| ID | Title | Class | Baseline | Evidence | Disposition | Status | Root cause | Routed to |
|---|---|---|---|---|---|---|---|---|
| — | — | — | — | — | — | — | — | — |

## POLISH.2 · Discovery

***BUILD HALF COMPLETE — SURFACE STAYS OPEN.** CC machine pass 2026-08-09; every routed delta built and merged at **DISCOVERY-COMPLETE (PR #311, squash `71f4d42`, staging advanced 2026-08-10)**. ⚠ **POLISH.2 IS NOT CLOSED.** The §7 exit bar has seven criteria and **criterion 1 — parity by eye at 1440 — is the founder's and has NOT run.** A surface is not closed on its build half. *Original note follows.* **CC machine pass complete, 2026-08-09. Founder visual inspection NOT yet run** — the pass reads the tier-4 mockup against the source, so it cannot see what only a render shows. Gate: B2 (**met** — `a27f2bf` / PR #276 is an ancestor of `main` and `formatPricePercent` is the single percent path). Deltas are numbered `Vn` per the POLISH-1-D convention (`docs/logs/POLISH-1a.md:5`).*

**Row grouping, stated so the count is not misread.** 50 deltas (`V1`–`V50`) → **31 rows**. The **24 shipped class-A geometry/type deltas** are grouped **one row per commit** (PD-2-01…06) with their `Vn` enumerated in the title: the disposition is identical inside each group, and 24 near-identical lines would bury the 25 rows that carry a real decision. **Every B, C and D delta gets its own row.** Two rows carry no `Vn` — PD-2-19 (an SCL-1 supersession the `Vn` list folded into V14) and PD-2-31 (PERF-1, not a parity delta). `V24` appears in two groups because it spans two files.

*Three closed rows (PD-2-02, PD-2-06, CC-4) carry dual class values predating POLISH-0 §4.1. Grandfathered — not split, because splitting a closed row is churn. §4.1 binds every row minted after 2026-08-10.*

| ID | Title | Class | Baseline | Evidence | Disposition | Status | Root cause | Routed to |
|---|---|---|---|---|---|---|---|---|
| **PD-2-01** | **V2** — no page inset; the grid ran to the viewport edge | V | tier-4 · `.content{padding:16px 28px 12px}` `:67-68` | `(public)/page.tsx` | routed | fixed | Full-bleed was read as "no inset"; the mockup is full-bleed **with** a 28px inset | POLISH.2 C1 |
| **PD-2-02** | **V26 V27 V28 V48** — stat line: emphasis dimmer than its label, separator on an opacity hack, one size for two surfaces, `1 posts` | V · F | tier-4 `:133-135` `:157-159` `:212` | `StatLine.tsx` | routed | fixed | One component serving two mockup rules that were never distinguished | POLISH.2 C2 |
| **PD-2-03** | **V5 V6 V8 V9 V12 V14 V19 V21 V22 V24** — hero geometry, padding, type, clamps, thumb, graph border | V | tier-4 `:71-72` `:82-93` `:123-131` | `HeroPanels.tsx` | routed | fixed | — | POLISH.2 C3 |
| **PD-2-04** | **V4 V33 V34 V35** — carousel rhythm, dot shapes, arrow glyph | V | tier-4 `:138-145` | `DiscoveryCarousel.tsx` | routed | fixed | Every dot rendered as the ACTIVE pill, so the rail read as eight identical bars | POLISH.2 C4 |
| **PD-2-05** | **V20 V24 V39 V40 V41** — grid gap, card padding + `space-between`, title, thumb, sparkline border | V | tier-4 `:148-159` | `MarketCard.tsx` · `DiscoveryGrid.tsx` | routed | fixed | — | POLISH.2 C5 |
| **PD-2-06** | **V47** — the Reload button had **no focus ring**, the only keyboard-reachable control on the surface | V · F | tier-2 · values-log v0.3 §3 item 3 (states) | `ErrorState.tsx` | routed | fixed | Hand-rolled `hover:text-ink` instead of the ratified state slots | POLISH.2 C6 |
| **PD-2-07** | **V7 V44** — hero panels and grid cards shared one hairline, so the hero carried no emphasis | V | tier-4 `:78` vs `:150`; BRIDGE retired ink-emphasis (`globals.css:51-53`) | `HeroPanels.tsx` | routed | fixed | Mockup rings both in `--ink`; the dark ramp has no equivalent | **FOUNDER-RULED** — brighter neutral step, `--ink` never mapped by name |
| **PD-2-08** | **V42** — the active carousel ring was the **same value** as every card's resting hairline (both n2) | R | tier-4 · `.mcard.athero` `:152` | `DiscoveryGrid.tsx` | routed | fixed | `--border-strong` aliased to n2 at BRIDGE, collapsing the emphasis it named | **Gate C.** Built to the V7 ladder: n2 grid < n3 hero < **n4 ring** · **Ruling requested.** |
| **PD-2-09** | **V18** — only the title+teaser box was clickable; the mockup's whole `.argbody` is the post target | F | tier-4 `:402-407` `:395` | `HeroPanels.tsx` | routed | fixed | Anchors cannot nest, so the panel was never wrapped | POLISH.2 C3 — stretched link |
| **PD-2-10** | **V37** — **no keyboard handler at all**; ArrowLeft/ArrowRight did nothing | F | **tier-2 · design-canon §5 Discovery** (not a11y-deferred) | `DiscoveryCarousel.tsx` | routed | fixed | Canon's key binding was never built and no suite covered it | POLISH.2 C4 |
| **PD-2-11** | **V3** — mockup locks the viewport (`overflow:hidden`, `100vh`); the build scrolls | V | tier-4 `:53-56` | — | **superseded** | closed | — | **ADR-0023 §Patch 2026-08-03:229** — sticky header on all `(public)` routes; its Context `:222-225` states the mockups "cannot answer" scroll. **DO NOT PORT** |
| **PD-2-12** | **V23 V25** — mockup sizes both graphs `flex:1`; the build uses fixed heights | V | tier-4 `:130` `:155` | — | **superseded** | closed | The flex sizing only resolves inside the viewport lock PD-2-11 supersedes | Rides PD-2-11 |
| **PD-2-13** | **V1** — the mockup's whole `:root` is the light era; the shipped ramp is dark **and inverted** | V | tier-4 `:44-47` | `globals.css:133-148` | **superseded** | closed | — | **values-log v0.3 §2 R-1 + §1 item 8.** Never map mockup greys by name or lightness |
| **PD-2-14** | **V31** — graph strokes hard-coded `#A3A3A3` / `#0A0A0A` | V | tier-4 `:218` `:220` | `PriceSparkline.tsx:58,65` | **superseded** | closed | — | **values-log v0.3 §1 item 1** (O1/WI-3): `--graph-yes` `#737373` / `--graph-no` `#fafafa`. Build already correct |
| **PD-2-15** | **V32** — mockup hard-codes 8 dots; the build renders `markets.length` | V | tier-4 `:262` | `DiscoveryCarousel.tsx:83` | **superseded** | closed | — | **SPEC.1 §22** sparse-market rule. Build correct |
| **PD-2-16** | **V36** — mockup always shows arrows; the build hides them at `n <= 1` | V | tier-4 `:261,263` | `DiscoveryCarousel.tsx:73,93` | **superseded** | closed | — | **SPEC.1 §22 F-DISC-2** single-market static. Build correct |
| **PD-2-17** | **V38** — dot fill is `@keyframes` width in the mockup, `scaleX` transition in the build | V | tier-4 `:144-145` | `DiscoveryCarousel.tsx:118-136` | **superseded** | closed | — | UI.A4 code-review LOW — bound to `ADVANCE_MS` so it cannot desync. Keep |
| **PD-2-18** | **V43** — mockup's system sans stack vs Geist | V | tier-4 `:50` | `globals.css:154-155` | **superseded** | closed | — | **values-log item 2 / WI-13** — Geist ratified FINAL |
| **PD-2-19** | Mockup post panels show **body only**; the build renders title + teaser | V | tier-4 `:192`, and the mockup's OWN header note `:11-13` | `HeroPanels.tsx` | **superseded** | closed | — | **SPEC.1 §2/§8 SCL-1** (`SPEC.1.md:384`). The mockup self-declares this its "Known render gap" |
| **PD-2-20** | **V10 V11** — side chip renders the bare side; mockup carries entry price (`YES @ 27%`) + its own geometry | R | tier-4 `:188` `:241` `:115-116` | `HeroPanels.tsx:137` · `badges.tsx` | routed | fixed | `SideBadge` spans **11 files / 13 render sites** (was 9 — C4/C4b adopted it, see CC-6) | **DISCOVERY-COMPLETE C3 + C3a.** ⚠ C3 first rendered the entry price through the PAIRED formatter, printing `NO @ 45%` for a 55% NO entry; `bets.price_at_bet` is ALREADY the bought side's price (`place.ts:162` → `calculate.ts:73-97`). C3a renders it RAW via `formatPercentUnpaired`; `EXPECTED_ALLOW_MARKERS` 2 → 3, argued in source |
| **PD-2-21** | **V29 V30** — price-bar geometry: labels outside the bar, 22px hero / 16px card | V | tier-4 `:223-227` `:99-113` | `PriceBar.tsx` | routed | fixed | Row named a NON-consumer and omitted the real one — see **CC-1** | **DISCOVERY-COMPLETE C1.** `size` REQUIRED, no default (O-1). Three consumers: `HeroPanels.tsx:79` hero · `MarketCard.tsx:68` card · `MarketHeader.tsx:96` **`detail`, pinned byte-identical (385 bytes) — OD-2**. PCT.ROUND untouched. ⚠ `detail`'s own numbers are **POLISH.3's row** below |
| **PD-2-22** | **V13** — `argstake` is a progression `Đ 1,000 → Đ 1,407`; the build shows one value | B | tier-4 `:190` `:243` | `HeroPanels.tsx` · `hero.ts` | routed | fixed | Sized L on "current value is in no loaded read" — TRUE for the market-scoped figure, and Discovery lists Open markets only, so it collapses to one `computeSell` | **DISCOVERY-COMPLETE C8 + the Gate C V13 fix.** ⚠ C8 shipped MARKET-scoped under a ruling (OD-1) that said POST-scoped: an author with three Đ1,000 posts read `Đ 1,000 → Đ 4,221` on every panel. Now `min(betShares, heldQuantity)` via a `leftJoinLateral` ordered IDENTICALLY to the substrate's earliest-bet LATERAL, so both figures provably come from the same bet. **+0 queries** |
| **PD-2-23** | **V15** — `argimg` image attachment absent from the hero post | B | tier-4 `:193` `:246` | `HeroPanels.tsx` · `hero.ts` | routed | fixed | No image field on `HeroPost` | **DISCOVERY-COMPLETE C7.** `LEFT JOIN image_uploads` as a COLUMN on the existing picked-posts select — **+0 round-trips**; `mintImageUrls` stayed module-private so ADR-0034 clause 1 held. SC-1 both obligations discharged: the join rides the already-removed-filtered `pickedIds`, and the never-echo sweep asserts a removed post's R2 key absent |
| **PD-2-24** | **V16** — `replyhead` (`Replies · 24` │ `Đ 10,000 staked`) absent | B | tier-4 `:194` `:247` | `HeroPanels.tsx` · `hero.ts` | routed | fixed | The data was already loaded and discarded | **DISCOVERY-COMPLETE C5.** `replyCount` + `replyDharma` from the substrate, summed with `CpmmDecimal` (never JS `+`). **+0 queries.** V48 singular/plural honoured. ⚠ Built to the mockup's `text-n4` (`:97-98`), not the plan's `text-n6` — **OQ-2, founder-held for the 1440 pass** |
| **PD-2-25** | **V17** — SUPPORT/COUNTER split bar absent from hero posts | B | tier-4 `:195-199` `:248-252` | `HeroPanels.tsx` | routed | fixed | Same discarded data as PD-2-24 | **DISCOVERY-COMPLETE C6 + the Gate C V17 pole fix.** Display-only: no button/link/handler, asserted. ⚠ C6 shipped a FIXED `bg-yes` fill over a FIXED `bg-no` track, so the **NO panel painted the NO-side share in the YES pole**. Segments are now SIDE-KEYED per canon; `HeroPanels.tsx` is C0's **seventh** inventory entry, added deliberately. This is **route 3/4** — see CC-7 |
| **PD-2-26** | **V45** — no `--elev-*` anywhere in discovery | V | tier-2 · values-log §1 item 10 (O3) names "Sparkline wrapper; Discovery HeroPost card + hero market panel" | `HeroPanels.tsx` · `MarketCard.tsx` | **duplicate-of-known** | open | — | **POLISH.1** — pre-recorded at `POLISH-0.md:117` (`--elev-2` has no live consumer). Do **not** open a second row |
| **PD-2-27** | **V46** — Empty/Error states do not conform to the W2.11 P1 locked shape | V | tier-2 · W2.11 P1 | `EmptyState.tsx` · `ErrorState.tsx` | routed | fixed | ≥5 distinct implementations product-wide | **DISCOVERY-COMPLETE C9, founder ruling R9.** Both adopt P1's ONE shape; all three OQ-6 copy consts VERBATIM; `data-testid`s unchanged; V47's state slots preserved on the CTA. R9 also supersedes W2.11's *Killed by ruling* line for Discovery (empty-Discovery + T2), recorded in the canon amendment |
| **PD-2-28** | `LoadingSkeleton` renders 4 hard-coded card blocks, not `DISCOVERY_GRID_SIZE`-shaped | R | tier-2 · W2.11 T1 ratified **no** loading primitive | `LoadingSkeleton.tsx` | routed | fixed | T1 assumed populated HTML; Discovery mounts a `Suspense` boundary, so first paint IS the fallback | **DISCOVERY-COMPLETE C10, founder ruling R8 — T1 SUPERSEDED.** P7 minted at `ui/loading-block.tsx`; canon amended in the SAME commit (§10 + §1/§8/§12 P1–P6 → P1–P7) + values-log geometry. Count now from `DISCOVERY_GRID_SIZE`: it reserved space for **4** cards against an **8**-slot grid |
| **PD-2-29** | **V49** — `POLISH-0` §3's POLISH.2 row omitted `StatLine` (carries six deltas) and listed `scrollers`, which belongs to the **debate** surface | S | tier-2 · the method document is wrong | `POLISH-0.md:138`; `src/components/debate/scrollers.tsx` | routed | fixed | `StatLine`'s omission sends an inspector past the component that matters. `scrollers` was mis-copied from POLISH.3's row, where it is correct and stays | POLISH.2 docs commit. ⚠ **This row first read "`scrollers` does not exist anywhere under `src/`" — false.** It was asserted from a `src/components/discovery/`-scoped grep and stated as a repo-wide negative. Corrected at Gate C. **O-2: verify against the live repo, and never widen a directory-scoped negative into a tree-wide one** |
| **PD-2-30** | **V50 (new)** — hero avatar renders at the primitive's 24px; mockup `.avatar` is **16px** | V | tier-4 `:84` | `HeroPanels.tsx:118` · `ui/avatar.tsx` | routed | fixed | `data-[size=sm]:size-6` out-specifies a consumer override — the twMerge trap | **DISCOVERY-COMPLETE C2.** `xs` added to the primitive (`data-[size=xs]:size-4`). Exactly **4** `<Avatar>` mounts in `src/`; the three `size="sm"` sites (IdentityCluster ×2, ArgProfile) are untouched — zero delta, guarded |
| **PD-2-31** | **PERF-1** — `/` served in ~35 s cold | B | tier-1 · was the only go-live blocker | `list.ts:48-63` · `page.tsx:59-65` | routed | closed | **Functions ran in `iad1` against a Mumbai DB.** ADR-0006 ratified `bom1` on 2026-05-05 and it was never applied — `vercel.json` had no `regions` key, and a SILENT config surface is indistinguishable from a correct one in every diff, CI run and review | **FIXED**, PR #307 + close-out. **361.6 → 5.34 ms/trip**; Discovery **35.07 → 0.584 s p50** (exit bar 2.0 s, met by 3.4×); Profile **6.2 → 0.189 s p50**. ⚠ The recon's *"41 round-trips"* was **97** (calls, not statements) and its *"warm p50 1.1 s"* **was TTFB — no warm regime exists**. **Batching NOT required** and not done. **POLISH.1–.8 unblocked** · **Closed 2026-08-10.** |
| **CC-1** | `PD-2-21` named a NON-consumer and omitted the real one | S | the register is wrong | `chart/MarketPriceChartCard.tsx` · `MarketCard.tsx:68` | routed | fixed | Row said `PriceBar` is consumed by `MarketHeader` + `MarketPriceChartCard` — the latter names `PriceBar` only in a COMMENT (`:25`) and renders its own `sr-only` readout; the row omitted `MarketCard.tsx:68`, which IS V30's 16px consumer | **Corrected in PD-2-21 above.** Same failure mode as PD-2-29's own recorded correction: a row that sends a build session to a file with nothing to change and past the one that mattered |
| **CC-2** | Round-trip figure has a third, reusable form | S | — | `AGENTS.md` Discovery warning | routed | open | The row records `97`; AGENTS.md still says "1 + 3N … a further 2N", which counts CALLS not statements | **AGENTS.md sweep.** The reusable form is **`1 + 12N`** — survives `DISCOVERY_GRID_SIZE` changing. Now MACHINE-PINNED at `tests/server/discovery/round-trip-budget.test.ts` (25 at N=2; hero read exactly 5) |
| **CC-3** | `1b7f37f` was UNPUSHED and did not land in #309 | S | — | local `chore/post-perf-1-docket` | routed | closed | — | **ADR-0006-DISCIPLINE.** DISCOVERY-COMPLETE branched from `origin/main` explicitly; `git merge-base --is-ancestor` confirmed it absent. No action was needed beyond that |
| **CC-4** | `PD-0-10`'s root cause is broader than its row | S · **F** | — | `BookmarkCard.tsx` · `ArgumentList.tsx` · `ReviewFeed.tsx` | routed | fixed | Row read "three `PositionMarker` implementations … side chips likewise hand-rolled" as cosmetic duplication. **TWO of the three INVERTED the pole on live participant surfaces** | **Re-class the side-chip half V → F.** Both fixed at DISCOVERY-COMPLETE C4/C4b; C0's guard closes the class for routes 1–2. PD-0-10 goes three implementations → **one** (admin, correct — see CC-9) |
| **CC-5** | Spec↔code drift on `price_at_bet` | S | `debate-export.md:177` · `SPEC.2.md:2721` | `place.ts:162` · `calculate.ts:73-97` | routed | open | Both docs say entry price is "the market **YES-probability** … the same basis for YES and NO bets". The engine stores `computeBuy(...).pEff` for the side **BOUGHT**, so a NO bet stores the NO price | ⚠ **SPEC.2 is web-authored — CC must NOT draft it.** The shipped `.md` export is numerically CORRECT; only the prose is wrong. This is the misreading C3 inherited and C3a corrected. **Doc sweep, founder-authored** |
| **CC-6** | `SideBadge`'s counted inventory went stale WITHIN this PR | S | — | `badges.tsx` · `side-badge.test.tsx` | routed | fixed | Docstrings said "9 files / 8 consumers" — true when the plan was written, stale once C4/C4b adopted the primitive four commits later | Now **13 render sites across 10 consumer files + the definition**; 8 pass neither new prop and are the zero-delta set. Counted inventories are load-bearing here (C0's whole premise), so a stale one in the primitive's own docblock is the same failure in miniature |
| **CC-7** | **The FOUR routes to a wrong pole** — one place | S | — | `side-pole-binding.test.ts` docstring · `docs/logs/DISCOVERY-COMPLETE.md` | routed | routed | C0 catches routes **1 and 2 only**, and a green C0 was reading as completeness | ⚠ **POLISH.3/.4/.5/.6 ALL port from these same light-theme mockups.** (1) semantic indirection — caught · (2) name-porting across the inverted ramp — caught · (3) **fixed pole on a per-side element** — UNCAUGHT, no side-keyed expression exists to match · (4) **porting the fill colour WITHOUT the anchor rule** — UNCAUGHT, and it is HOW route 3 gets written. Rule: when a mockup expresses a binding through POSITION or ANCHORING as well as colour, port the **binding**, never the property |
| **RR-3** | `composer/ReplySplitBar.tsx:64,67` — **live pole inversion on `/m/[slug]`** | **F** | tier-2 · values-log §3 "left = Support share in the SUPPORT SIDE'S POLE COLOUR" | `ReplySplitBar.tsx:64,67` | routed | open | The file carries **BOTH**: a CORRECT side-keyed pole at `:118-122` (why C0 permits it) **and** a separate FIXED `bg-no` track + `bg-yes` fill at `:64,:67` rendering the Support/Counter split with no side keying, while `postSide` is a prop of the same component | ⚠ **INV-3, class F — founder-ruled NOT a styling item.** Same treatment `BookmarkCard`/`ArgumentList` got. On a NO post the Support share renders black where canon says white. **Owner: POLISH.3/.4.** Verified, deliberately NOT fixed at DISCOVERY-COMPLETE (pre-existing; `/m/[slug]` is another task's surface) · **PRE-EXISTING.** |
| **RR-4** | `PositionMarker` outline → filled on `/bookmarks` + `/u/[pseudonym]` | V | — | `BookmarkCard.tsx` · `ArgumentList.tsx` | routed | closed | C4/C4b replaced a hand-rolled `<Badge variant="outline">` with the shared `PositionMarker` (`variant="secondary"`) | **Founder-ACCEPTED known delta.** It is the adoption the plan mandated (adopt, never patch) and what delivered the missing `aria-label="Author Flipped"` — PD-0-10's actual root cause. Recorded so **POLISH.5/.6 inspect the CONSOLIDATED state instead of re-filing it** |
| **CC-9** | `(admin)/…/ReviewFeed.tsx:102-104` — the surviving third side-chip hand-roll | S | — | `ReviewFeed.tsx:102-104` | routed | open | Mapping is **CORRECT today** (`bg-yes` for YES) — duplication, not inversion. **EXCLUDED from C0's guard BY DIRECTORY** (`src/app/(admin)/**`), deliberately | ⚠ **This is the chip the operator reads sides from WHILE MODERATING.** It is unguarded and can drift with nothing on disk going red, because the only guard that would catch it excludes its directory by design. **Route to an ADMIN PASS — not PRIMITIVES-2.** Consolidating admin chrome onto a participant primitive is an admin-surface decision (CLAUDE.md §3) |
| **PD-2-32** | **Broken market thumbnails on every grid card + the hero market panel** — the broken-image glyph renders and its alt text overflows into the metadata row | **F** | observed on staging 2026-08-10, post-advance | `MarketCard.tsx:47-56` · `HeroPanels.tsx:58-66` | routed | open | **A minted URL that later 404s has NO degradation path.** `getDefaultMarketMediaUrl` (`media.ts:56-62`) handles R2 unavailable AT MINT TIME — presign throws → `null` → the `IMG` placeholder. But presigning is a LOCAL HMAC that never checks existence, so a key pointing at a missing object mints a perfectly valid URL and the failure surfaces only at browser LOAD, where nothing catches it | **⚠ NOT staging-only — a production defect.** R2 objects can 404 in prod too (deleted, swept, replication lag). Both sites are inside the `"use client"` carousel (`DiscoveryCarousel` → `DiscoveryGrid` → `MarketCard`; `HeroPanels` likewise), so **`onError` IS available** — confirmed. **Recommended shape: one shared `MarketThumb` owning three states (null · error · loaded), used by BOTH sites.** Size **S** (~30 lines + render tests). Do NOT patch two `<img>`s independently — that is how PD-0-10 happened |
| **PD-2-33** | Market-thumb `alt` is the market TITLE, redundant with the title rendered beside it — and it is what makes the failure OVERFLOW | V | tier-2 · WCAG 1.1.1 | `MarketCard.tsx:53` · `HeroPanels.tsx:64` | routed | open | Both thumbs carry `alt={card.title}` while the same title renders in the adjacent `<h3>`. A screen reader hears it twice; a broken image prints it as visible text | **Should match V15.** The hero POST image is deliberately `alt=""` (`HeroPanels.tsx:189`) — decorative, because the argument text carries the meaning and the title is adjacent. **The identical reasoning applies to the market thumb**, and `alt=""` is also what stops the overflow. ⚠ Fixing (c) alone hides the symptom while PD-2-32's real gap remains — land them together The a11y half (alt duplication, WCAG 1.1.1) routes to **A11Y.0**; the overflow half is POLISH.2's. |
| **PD-2-34** | Staging's `market_media` rows point at R2 objects that **DO NOT EXIST** — 8/8 | S | — | `curl` of all 8 minted URLs, 2026-08-10 | routed | open | Every one returns **HTTP 404 `<Code>NoSuchKey</Code>`**, 127 bytes. Rows present in the DB, objects never uploaded | **FIXTURE GAP — see `STAGING-FIXTURE-DISCOVERY-SHAPE` in `docs/parked.md`.** This is WHY the defect is visible on staging; it is not the defect itself (PD-2-32 is). ⚠ The STAGING-PARITY set is **md5-pinned** — changing it is a deliberate fixture change WITH a re-pin, never an edit |


## POLISH.3 · Market Detail

*Not yet inspected. Gates: B1 · B2 · B3 · C3.*

| ID | Title | Class | Baseline | Evidence | Disposition | Status | Root cause | Routed to |
|---|---|---|---|---|---|---|---|---|
| **PD-3-01** | `PriceBar`'s **`detail`** preset is a NAMED TRANSITIONAL value, not the ratified one | V | tier-4 · `surface_d5_v1_0.html:507-508` — **14px bar / 10px labels** | `PriceBar.tsx` · `MarketHeader.tsx:96` | **inherited** | open | DISCOVERY-COMPLETE pinned `detail` byte-identical (385 bytes) to the pre-preset render so `/m/[slug]` had a ZERO pixel delta — founder ruling **OD-2** | **POLISH.3's row, inherited from DISCOVERY-COMPLETE C1.** Applying d5's numbers there would have spent POLISH.3's decision without POLISH.3's inspection. The preset seam exists; only the numbers are open |
| **PD-3-02** | `SideBadge` can carry the entry price on d5's chips with **no further primitive change** | V | tier-4 · `surface_d5_v1_0.html:1701` renders `YES @ <e>%` | `badges.tsx` · `DebatePost.entryPrice` | **inherited** | open | `price` was made OPTIONAL at C3 precisely so d5 could adopt it later | `DebatePost.entryPrice` / `DebateReply.entryPrice` ALREADY exist (`load-debate-view.ts`), so adoption is a call-site change. ⚠ Render it **RAW** — see **CC-5**; it is already the bought side's price |
| **RR-3** | ⚠ **INV-3 — live pole inversion at `composer/ReplySplitBar.tsx:64,67`** | **F** | tier-2 · values-log §3 | `ReplySplitBar.tsx:64,67` | **inherited** | open | See the RR-3 row under POLISH.2 for the full evidence | **OWNED HERE (POLISH.3/.4).** Class F, INV-3, live on `/m/[slug]`. Not a styling item |

## POLISH.4 · Composers + Sell module

*Not yet inspected. Gate: B1.*

| ID | Title | Class | Baseline | Evidence | Disposition | Status | Root cause | Routed to |
|---|---|---|---|---|---|---|---|---|
| — | — | — | — | — | — | — | — | — |

## POLISH.5 · Profile

*Not yet inspected. Gate: B1.*

| ID | Title | Class | Baseline | Evidence | Disposition | Status | Root cause | Routed to |
|---|---|---|---|---|---|---|---|---|
| — | — | — | — | — | — | — | — | — |

## POLISH.6 · Bookmarks

*Not yet inspected. Gate: B1.*

| ID | Title | Class | Baseline | Evidence | Disposition | Status | Root cause | Routed to |
|---|---|---|---|---|---|---|---|---|
| — | — | — | — | — | — | — | — | — |

## POLISH.8 · Admin Centre

*Not yet inspected. No gates — pullable forward.*

| ID | Title | Class | Baseline | Evidence | Disposition | Status | Root cause | Routed to |
|---|---|---|---|---|---|---|---|---|
| — | — | — | — | — | — | — | — | — |

## POLISH.7b · Onboarding deck + coach-marks

*⛔ Blocked on O1.*

| ID | Title | Class | Baseline | Evidence | Disposition | Status | Root cause | Routed to |
|---|---|---|---|---|---|---|---|---|
| — | — | — | — | — | — | — | — | — |

---

## Pre-recorded — found at POLISH.0, before any inspection

These were found by recon, not by a polish pass. **If an inspection re-discovers one, it takes disposition `duplicate-of-known` and cites the ID here — it does not become a second row.** IDs are `PD-0-nn` because POLISH.0 found them.

| ID | Title | Class | Baseline | Surfaces | Disposition | Status | Routed to |
|---|---|---|---|---|---|---|---|
| **PD-0-01** | `<Plus /> Full` where CD-A ratified a **"Read more"** text link. `Read more` has zero occurrences repo-wide | V | tier-2 · CD-A close-out, 2026-07-14 | .3 · .5 · .6 | routed | open | R4 · SCHEDULED — see POLISH-0 §0. B11 · CC-LIGHT |
| **PD-0-02** | `PostCard` `Đ BET` and `Support / Counter` are **literal `disabled`** — no auth prop reaches the component. Signed-in participants see *"sign in to bet"* | F | tier-4 · d5 mockup `:1099-1103`, `:1246-1250` (live handlers) | .3 | routed | open | R1 · SCHEDULED — see POLISH-0 §0. B6 · CC-HEAVY. **ADR-0034 D-1 constraint applies** |
| **PD-0-03** | `PostPopup` at `max-w-lg` (~512px) vs CD-A's 720px; `max-h-[80vh]` vs 90vh; **no `SideBadge` at all** — bare interpolated text; CD-A header row absent | V | tier-2 · CD-A | .3 | routed | open | R5 · SCHEDULED — see POLISH-0 §0. B7a · CC-LIGHT. **C3 CLOSED at `54b0b2a` (#278, 2026-07-31).** |
| **PD-0-04** | CD-A's Support/Counter footer + stake bar, and the reply-variant pop-up, are unbuilt. `ReplyPopup` → zero matches | B | tier-2 · CD-A | .3 | routed | open | R6 · SCHEDULED — see POLISH-0 §0. **Deferred.** |
| **PD-0-05** | No global banner anywhere. The **2026-11-05 freeze** has no site-wide surface — freeze copy is composer-scoped and surfaces only after a failed write | F | tier-2 · W2.11 **P4**, *"the one loud participant read-only event"* | .1 | routed | open | R2 · SCHEDULED — see POLISH-0 §0. B8 · CC-HEAVY |
| **PD-0-06** | `not-found.tsx` exists nowhere; no `global-error.tsx`. `notFound()` fires from six live sites incl. `/m/[slug]` on unknown **or Draft** slugs | F | tier-1 · the routes throw it | .1 | routed | closed | **BUILT at `acc2e03` (#283, 2026-08-02):** `src/app/not-found.tsx`, `src/app/global-error.tsx`, `src/app/(public)/not-found.tsx`. **R3 discharged.** |
| **PD-0-07** | `text-white` at `audit/page.tsx:75` — the only Tailwind palette colour class in `src/`, bypassing the `--color-*` layer | V | tier-2 · token contract v0.4 | .8 | routed | open | R7 · SCHEDULED — see POLISH-0 §0. B12 · CC-LIGHT |
| **PD-0-08** | Five loading skeletons shipped; **W2.11 T1 ratified none**, and the locked kit P1–P6 has no loading primitive | R | tier-2 · W2.11 T1 | .1 · .2 · .5 · .6 | — | closed | **R8 RULED — T1 SUPERSEDED.** P7 minted at `ui/loading-block.tsx`, canon amended in the same commit (DISCOVERY-COMPLETE C10, `e5827dc`). Kit is **P1–P7**. |
| **PD-0-09** | At least five distinct empty-state implementations; **W2.11 P1 locked one shape** | V | tier-2 · W2.11 P1 | .2 · .5 · .6 | routed | open | R9 · SCHEDULED — see POLISH-0 §0. per-surface V batch |
| **PD-0-10** | Three `PositionMarker` implementations — `badges.tsx` (`secondary` + `aria-label`) vs hand-rolled `outline`, no `aria-label`, in `ArgumentList` and `BookmarkCard`. Side chips likewise hand-rolled | F | tier-2 · one component, one treatment | .5 · .6 | routed | open | R12 · SCHEDULED — see POLISH-0 §0. **root cause: primitive duplication.** Check at B1's PR whether it rewrote `BookmarkCard`; do **not** add scope to B1 **Re-classed V → F per CC-4.** Both INV-3 arms FIXED at DISCOVERY-COMPLETE C4/C4b; one implementation survives, `(admin)` `ReviewFeed` — correct, owned by POLISH.8. |
| **PD-0-11** | Price-bar percentage labels are non-interactive (`role="img"`); the mockup wires them to `pick()` | R | tier-4 · d5 `:1038`/`:1040` | .3 | **accepted-divergence** *(proposed)* | open | R10 · SCHEDULED — see POLISH-0 §0. canon §10 |
| **PD-0-12** | Sell button is **hidden** when ineligible, not disabled. W2.10 Option A never specified which | R | — (unspecified) | .5 | **accepted-divergence** *(proposed)* | open | R11 · SCHEDULED — see POLISH-0 §0. canon §10 |
| **PD-0-13** | `design-language.md:178`, `:227` still describe the debate mode selector as real — **known-stale**, flagged at `DEBATE.4.md:44`, never corrected | S | tier-2 · a baseline document is wrong | all | routed | closed | **R19 discharged at `54b0b2a` (#278, 2026-07-31).** THREE sites corrected, not two — `:178`, `:227`, and the §6 ranking clause. |
| **PD-0-14** | Turnstile is not wired — placeholder token, staging on always-pass test keys. W2.1's three ratified Turnstile states cannot be exercised | — | tier-2 · W2.1 | .7a | **data-blocked** | open | AUTH-TURNSTILE-WIRE |
| **PD-0-15** | Raw error codes (`otp_invalid`, `rate_limited`) render to users | V | tier-2 · canon §6 copy | .7a | routed | open | AUTH-ERROR-COPY |
| **PD-0-16** | The chart's **expanded-overlay** variant has no tier-2 or tier-4 baseline; values-log branded three renders, four exist | S | — (no baseline of any tier) | .3 | — | open | R13 · SCHEDULED — see POLISH-0 §0. verify SPEC.CHART covers it; if not, SPEC-FIRST halt |
| **PD-0-17** | **Header Balance and the composer's spendable figure legitimately differ by `DAILY_CREDIT_DHARMA` (10 Đ) on any unclaimed day.** A user can correctly render **1,000** in the header and **1,010** in the composer at the same instant | — | tier-1 · the two reads are correct as built | .1 · .3 · .5 | **superseded** | closed | **NOT A DEFECT. Do not open a row.** `accrueDailyCredit` fires *inside* `place()`, so an unspent daily credit is spendable but not yet in the ledger. `header-balance.ts` pins a BALANCE-FIRST / CURSOR-SECOND statement order precisely so the worst case is a one-credit UNDERSTATEMENT rather than an overstatement — a header that promised capacity the composer rejected would be the real bug. Recorded at STAGING-PARITY Slice C/D, citing the **SHELL-COMPLETE close-out** (where a test that pinned the two equal was caught as the near-miss) and Ratification Record **W-D** |
| **PD-0-18** | **The profile Dharma graph renders empty (or near-empty) for ALL generated staging data** | — | tier-1 · the x-domain is correct as specified | .5 | **superseded** | closed | **NOT A REGRESSION, and not fixed by STAGING-PARITY.** The §23 graph x-domain is **hard-pinned 2026-09-15 → 2026-11-05** as module-private consts at `src/server/profile/graph-series.ts:31–34`, with no env or config override. Everything the generator produces is stamped *now* (August), and **backdating `created_at` is forbidden** — it would mean writing timestamps the engine cannot produce (P-10). Manifest §3. Remedy is **GRAPH-WINDOW-OVERRIDE**, a separate task behind a SPEC.1 §23 rider. ⚠ Slice B removed the *other* cause (staging had no event-backed data at all); an inspector seeing an empty graph now is seeing the domain, not missing rows · **data-blocked** — qualifier moved from the status cell. |

---

## Staging fixture coverage — the standing reference

> **Emitted by gate 4**, per rebuild, to `docs/polish/staging-coverage.json`. That file is the machine-readable copy and carries the SQL probe behind every row; this table is the human one. **Regenerate with `pnpm staging:rebuild`** — the list is byte-identical across cold rebuilds (md5 `2b6b0bc4`), and gate 4 **fails RED** if a rebuild emits anything different, so a change here is always a deliberate fixture change rather than run-to-run noise.
>
> **48 entries · 46 reachable · 2 unreachable.** Every reachable entry was confirmed present by a targeted query at emit time; every unreachable one names a manifest §3 reason. Pseudonyms are pool-allocated FIFO and stable across rebuilds, so these URLs do not rot.

**Markets (§2.1)** — all under `https://staging.zugzwangworld.com`

| Row | URL | What to look at |
|---|---|---|
| M1 Draft | `/m/sp-m1-draft` | **must 404** for a participant — Draft is admin-only |
| M2 Open, heavily active | `/m/sp-m2-active` | the primary POLISH.3 subject; carries all of §2.3 |
| M3 Open, lightly active | `/m/sp-m3-light` | **no badge renders** — Top falls back to closest-to-landslide |
| M4 Open, brand new | `/m/sp-m4-new` | both `EmptySideCTA` slots |
| M5 Closed | `/m/sp-m5-closed` | read-only; write affordances gated |
| M6 Resolving | `/m/sp-m6-resolving` | read-only; distinct badge |
| M7 Resolved (YES) | `/m/sp-m7-resolved` | settled positions; the four-digit P/L carrier |
| M8 Voided | `/m/sp-m8-voided` | the void path differs from resolve |
| M10–M16 filler | `/m/sp-m10-fill` … `/m/sp-m16-fill` | Discovery hero + full grid (`DISCOVERY_GRID_SIZE + 1`) |
| ~~M9 Frozen~~ | — | **unreachable, permanent** — manifest §1.8/§3. Never attempt it on staging |

**Participants (§2.2)** — `/u/<pseudonym>`

| Role | Pseudonym | What it proves |
|---|---|---|
| P-owner | `RedFox000` | owner arm of Profile / positions / bookmarks; holds YES on M2 |
| P-visitor-target | `RedWolf001` | a populated profile viewed as a **visitor** — the DTO split |
| P-empty | `RedOtter002` | every empty state at once; balance is **exactly 1000** |
| P-flipped | `RedBadger003` | the `Flipped` marker; its pre-flip YES comment is still YES (INV-3) |
| P-exited | `RedLynx004` | the `Exited` marker; position at zero, never re-entered |
| P-removed | `RedHare005` | one removed comment, one surviving — masking without a ban |
| P-banned | `RedOwl006` | banned, **past content intact** (ADR-0021) |
| P-crowd-1/2/3 | `RedHawk007` · `RedStoat008` · `RedPine009` | lane volume, reply counts, the interleave |

**Content, positions, bookmarks, moderation (§2.3–§2.5)**

| Row | URL | What to look at |
|---|---|---|
| C1 both sides | `/m/sp-m2-active` | both YES and NO columns carry posts |
| C2 interleave | `/m/sp-m2-active` | 12 posts — a newest-post injection after every 10 ranked |
| C3 three badges | `/m/sp-m2-active` | **one per lane** — Most Debated, Highest Stakes, Contested |
| C4 majority unbadged | `/m/sp-m2-active` | **9 of 12 carry no badge** — the criterion, not an omission |
| C5 many replies | `/m/sp-m2-active` | `ReplySplitBar`, expand, stake ordering within side |
| C6 zero replies | `/m/sp-m2-active` | the empty reply state inside a populated market |
| C7 image | `/m/sp-m2-active` | in-card clip, then the whole-render pop-up |
| C8 truncation | `/m/sp-m2-active` | the "Read more" affordance |
| C9 removed post | `/m/sp-m2-active` | body masked, **its two replies still readable** |
| C10 removed reply | `/m/sp-m2-active` | reply-level masked variant, parent untouched |
| C11 chart | `/m/sp-m2-active` | multi-point chart with post nodes |
| Q1 sellable | `/u/RedWolf001` | the Sell affordance on an Open market |
| Q2 terminal | `/u/RedStoat008` | Sell is **hidden**, not disabled |
| Q3 settled | `/u/RedFox000` | net P/L on the winning side |
| Q4 opposite-slot | `/m/sp-m2-active` | as **P-owner**, the NO composer is `oppositeHeld`-disabled |
| Q5 zero positions | `/u/RedOtter002` | empty `PositionsTable`, owner and visitor copy |
| B1 bookmarks | `/bookmarks` | as **P-owner** — one post + one reply, both others' |
| B2 zero bookmarks | `/bookmarks` | as **P-empty** — the empty page |
| X1 · X2 removals | `/m/sp-m2-active` | the masked cards, and their rows in the audit feed |
| X3 ban | `/admin/moderation/audit` | the ban is logged; the author's past content still renders |
| ~~X4 pagination~~ | — | **unreachable** — a product gap needing a POLISH.8 ruling |

---

## Duplicate-of-known — Phase B defects, already owned

Do **not** open register rows for these. They are being fixed before their surfaces are inspected.

| Known defect | Surfaces | Owner |
|---|---|---|
| **BOOKMARK-ADD-WIRE** — the add path is inert across Market Detail, Profile and Bookmarks | .3 · .5 · .6 | B1, plan phase live; ADR-0034 is its execute gate |
| **PCT.ROUND** — YES% + NO% can render **101** | .2 · .3 | B2 |
| **F-DEBATE-4** — interval polling on `/m/[slug]` | .3 | **B3 — CLOSED.** Plan and log both on `main`; behaviour pinned at `tests/unit/debate/render/poll.test.tsx` (`:144` cadence · `:196` suspension · `:280` stop rule) |
| **UI.11** — no AGPL source offer exists anywhere in the shell | .1 | **B4 — WITHDRAWN, not open.** SPEC.1 v1.0.26 `:1498`, 2026-08-02: *"B4 (UI.11) is withdrawn, not rescoped."* The AGPL §13 obligation survives, relocated to the ToS body |

---

*Extended at POLISH.2 (2026-08-09) and at DISCOVERY-COMPLETE's post-staging pass (2026-08-10): **thirty-four** `PD-2-nn` rows allocated under POLISH.2 · Discovery — the first inspection-derived rows in this register. **(Recounted at POLISH-TEMPLATE: the figure read "thirty-one" because PD-2-32/33/34 sat below a blank line and outside the table body, so the stale count and the broken parse agreed with each other. The blank line is gone; the count is read off the file.)** The POLISH.2 table body is **44** rows — 34 `PD-2-nn` plus eight `CC-n` and two `RR-n`, which share the table. `PD-0-18` remains the pre-recorded high-water mark; `PD-2` is a fresh per-surface series per the `PD-<surface>-<nn>` scheme above. **The thirteen `POLISH-register-ADDITIONS.md` rows are still unapplied** and are NOT among these — that file's apply-checklist is untouched and still owed.*

*Scaffolded by web Claude, 2026-07-30 IST. **Eighteen** pre-recorded rows, none from an inspection. Ruling state for every `Rn` lives in `POLISH-0.md` §0, the ruling index. There is no standalone ruling register. Extended at STAGING-PARITY Slice C/D (2026-08-06): PD-0-17 and PD-0-18 pre-recorded as `superseded` so POLISH.5 does not spend a founder review-hour re-deriving two known-correct behaviours, plus the standing staging coverage reference above.*
