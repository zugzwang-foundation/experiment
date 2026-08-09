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

***CC machine pass complete, 2026-08-09 (POLISH.2, PR pending Gate C). Founder visual inspection NOT yet run** — the pass reads the tier-4 mockup against the source, so it cannot see what only a render shows. Gate: B2 (**met** — `a27f2bf` / PR #276 is an ancestor of `main` and `formatPricePercent` is the single percent path). Deltas are numbered `Vn` per the POLISH-1-D convention (`docs/logs/POLISH-1a.md:5`).*

**Row grouping, stated so the count is not misread.** 50 deltas (`V1`–`V50`) → **31 rows**. The **24 shipped class-A geometry/type deltas** are grouped **one row per commit** (PD-2-01…06) with their `Vn` enumerated in the title: the disposition is identical inside each group, and 24 near-identical lines would bury the 25 rows that carry a real decision. **Every B, C and D delta gets its own row.** Two rows carry no `Vn` — PD-2-19 (an SCL-1 supersession the `Vn` list folded into V14) and PD-2-31 (PERF-1, not a parity delta). `V24` appears in two groups because it spans two files.

| ID | Title | Class | Baseline | Evidence | Disposition | Status | Root cause | Routed to |
|---|---|---|---|---|---|---|---|---|
| **PD-2-01** | **V2** — no page inset; the grid ran to the viewport edge | V | tier-4 · `.content{padding:16px 28px 12px}` `:67-68` | `(public)/page.tsx` | routed | **fixed** | Full-bleed was read as "no inset"; the mockup is full-bleed **with** a 28px inset | POLISH.2 C1 |
| **PD-2-02** | **V26 V27 V28 V48** — stat line: emphasis dimmer than its label, separator on an opacity hack, one size for two surfaces, `1 posts` | V · F | tier-4 `:133-135` `:157-159` `:212` | `StatLine.tsx` | routed | **fixed** | One component serving two mockup rules that were never distinguished | POLISH.2 C2 |
| **PD-2-03** | **V5 V6 V8 V9 V12 V14 V19 V21 V22 V24** — hero geometry, padding, type, clamps, thumb, graph border | V | tier-4 `:71-72` `:82-93` `:123-131` | `HeroPanels.tsx` | routed | **fixed** | — | POLISH.2 C3 |
| **PD-2-04** | **V4 V33 V34 V35** — carousel rhythm, dot shapes, arrow glyph | V | tier-4 `:138-145` | `DiscoveryCarousel.tsx` | routed | **fixed** | Every dot rendered as the ACTIVE pill, so the rail read as eight identical bars | POLISH.2 C4 |
| **PD-2-05** | **V20 V24 V39 V40 V41** — grid gap, card padding + `space-between`, title, thumb, sparkline border | V | tier-4 `:148-159` | `MarketCard.tsx` · `DiscoveryGrid.tsx` | routed | **fixed** | — | POLISH.2 C5 |
| **PD-2-06** | **V47** — the Reload button had **no focus ring**, the only keyboard-reachable control on the surface | V · F | tier-2 · values-log v0.3 §3 item 3 (states) | `ErrorState.tsx` | routed | **fixed** | Hand-rolled `hover:text-ink` instead of the ratified state slots | POLISH.2 C6 |
| **PD-2-07** | **V7 V44** — hero panels and grid cards shared one hairline, so the hero carried no emphasis | V | tier-4 `:78` vs `:150`; BRIDGE retired ink-emphasis (`globals.css:51-53`) | `HeroPanels.tsx` | routed | **fixed** | Mockup rings both in `--ink`; the dark ramp has no equivalent | **FOUNDER-RULED** — brighter neutral step, `--ink` never mapped by name |
| **PD-2-08** | **V42** — the active carousel ring was the **same value** as every card's resting hairline (both n2) | R | tier-4 · `.mcard.athero` `:152` | `DiscoveryGrid.tsx` | routed | **fixed, ruling requested** | `--border-strong` aliased to n2 at BRIDGE, collapsing the emphasis it named | **Gate C.** Built to the V7 ladder: n2 grid < n3 hero < **n4 ring** |
| **PD-2-09** | **V18** — only the title+teaser box was clickable; the mockup's whole `.argbody` is the post target | F | tier-4 `:402-407` `:395` | `HeroPanels.tsx` | routed | **fixed** | Anchors cannot nest, so the panel was never wrapped | POLISH.2 C3 — stretched link |
| **PD-2-10** | **V37** — **no keyboard handler at all**; ArrowLeft/ArrowRight did nothing | F | **tier-2 · design-canon §5 Discovery** (not a11y-deferred) | `DiscoveryCarousel.tsx` | routed | **fixed** | Canon's key binding was never built and no suite covered it | POLISH.2 C4 |
| **PD-2-11** | **V3** — mockup locks the viewport (`overflow:hidden`, `100vh`); the build scrolls | V | tier-4 `:53-56` | — | **superseded** | closed | — | **ADR-0023 §Patch 2026-08-03:229** — sticky header on all `(public)` routes; its Context `:222-225` states the mockups "cannot answer" scroll. **DO NOT PORT** |
| **PD-2-12** | **V23 V25** — mockup sizes both graphs `flex:1`; the build uses fixed heights | V | tier-4 `:130` `:155` | — | **superseded** | closed | The flex sizing only resolves inside the viewport lock PD-2-11 supersedes | Rides PD-2-11 |
| **PD-2-13** | **V1** — the mockup's whole `:root` is the light era; the shipped ramp is dark **and inverted** | V | tier-4 `:44-47` | `globals.css:133-148` | **superseded** | closed | — | **values-log v0.3 §2 R-1 + §1 item 8.** Never map mockup greys by name or lightness |
| **PD-2-14** | **V31** — graph strokes hard-coded `#A3A3A3` / `#0A0A0A` | V | tier-4 `:218` `:220` | `PriceSparkline.tsx:58,65` | **superseded** | closed | — | **values-log v0.3 §1 item 1** (O1/WI-3): `--graph-yes` `#737373` / `--graph-no` `#fafafa`. Build already correct |
| **PD-2-15** | **V32** — mockup hard-codes 8 dots; the build renders `markets.length` | V | tier-4 `:262` | `DiscoveryCarousel.tsx:83` | **superseded** | closed | — | **SPEC.1 §22** sparse-market rule. Build correct |
| **PD-2-16** | **V36** — mockup always shows arrows; the build hides them at `n <= 1` | V | tier-4 `:261,263` | `DiscoveryCarousel.tsx:73,93` | **superseded** | closed | — | **SPEC.1 §22 F-DISC-2** single-market static. Build correct |
| **PD-2-17** | **V38** — dot fill is `@keyframes` width in the mockup, `scaleX` transition in the build | V | tier-4 `:144-145` | `DiscoveryCarousel.tsx:118-136` | **superseded** | closed | — | UI.A4 code-review LOW — bound to `ADVANCE_MS` so it cannot desync. Keep |
| **PD-2-18** | **V43** — mockup's system sans stack vs Geist | V | tier-4 `:50` | `globals.css:154-155` | **superseded** | closed | — | **values-log item 2 / WI-13** — Geist ratified FINAL |
| **PD-2-19** | Mockup post panels show **body only**; the build renders title + teaser | V | tier-4 `:192`, and the mockup's OWN header note `:11-13` | `HeroPanels.tsx` | **superseded** | closed | — | **SPEC.1 §2/§8 SCL-1** (`SPEC.1.md:384`). The mockup self-declares this its "Known render gap" |
| **PD-2-20** | **V10 V11** — side chip renders the bare side; mockup carries entry price (`YES @ 27%`) + its own geometry | R | tier-4 `:188` `:241` `:115-116` | `HeroPanels.tsx:127` · `badges.tsx:14-29` | routed | **open** | `SideBadge` is shared across **9** files | **FOUNDER-RULED → `SIDEBADGE-PRICE`**, ships immediately after POLISH.2. §5.4 forbids a V batch spanning surfaces. Data exists unused: `PostSubstrate.priceAtBet` (`ranking.ts:50`) |
| **PD-2-21** | **V29 V30** — price-bar geometry: labels outside the bar, 22px hero / 16px card | V | tier-4 `:223-227` `:99-113` | `PriceBar.tsx:26-39` | routed | **open** | `PriceBar` is consumed by `MarketHeader.tsx` and `chart/MarketPriceChartCard.tsx` — both `/m/[slug]` | **`PRICEBAR-GEOMETRY`** — carved out on the PD-2-20 precedent. **PCT.ROUND untouched**; percentages stay non-controls (R10 / PD-0-11) |
| **PD-2-22** | **V13** — `argstake` is a progression `Đ 1,000 → Đ 1,407`; the build shows one value | B | tier-4 `:190` `:243` | `HeroPanels.tsx:128-130` | routed | **open** | Current position value is in no loaded read | **HALT — read-model.** Sized L, carved out per HALT SET 5 |
| **PD-2-23** | **V15** — `argimg` image attachment absent from the hero post | B | tier-4 `:193` `:246` | `HeroPanels.tsx` | routed | **open** | No image field on `HeroPost` | **HALT — DTO field (ADR-0034 D-1 discipline).** `image_uploads` + `CommentImage` already exist |
| **PD-2-24** | **V16** — `replyhead` (`Replies · 24` │ `Đ 10,000 staked`) absent | B | tier-4 `:194` `:247` | `HeroPanels.tsx` | routed | **open** | **The data is already loaded and discarded** — `PostSubstrate.supportCount/…Dharma` at `hero.ts:73`. **Zero new queries** | **HALT — DTO field.** `HeroPost` is NOT in `DebateViewModel`'s closure, so D-1 is not tripped; scope extension only |
| **PD-2-25** | **V17** — SUPPORT/COUNTER split bar absent from hero posts | B | tier-4 `:195-199` `:248-252` | `HeroPanels.tsx` | routed | **open** | Same discarded data as PD-2-24 | **HALT — DTO field.** ⚠ Display-only in the mockup (**no buttons**) — a read-time aggregate, not a vote affordance. **The build must never add buttons here** |
| **PD-2-26** | **V45** — no `--elev-*` anywhere in discovery | V | tier-2 · values-log §1 item 10 (O3) names "Sparkline wrapper; Discovery HeroPost card + hero market panel" | `HeroPanels.tsx` · `MarketCard.tsx` | **duplicate-of-known** | open | — | **POLISH.1** — pre-recorded at `POLISH-0.md:117` (`--elev-2` has no live consumer). Do **not** open a second row |
| **PD-2-27** | **V46** — Empty/Error states do not conform to the W2.11 P1 locked shape | V | tier-2 · W2.11 P1 | `EmptyState.tsx` · `ErrorState.tsx` | **duplicate-of-known** | open | ≥5 distinct implementations product-wide | **PD-0-09 / pending R9.** Guessing the shape here would create a sixth |
| **PD-2-28** | `LoadingSkeleton` renders 4 hard-coded card blocks, not `DISCOVERY_GRID_SIZE`-shaped | R | tier-2 · W2.11 T1 ratified **no** loading primitive | `LoadingSkeleton.tsx:19-23` | — | **pending R8 — no default** | — | **PD-0-08.** UNRULED. Reported, **changed nothing** |
| **PD-2-29** | **V49** — `POLISH-0` §3 listed `scrollers` (**does not exist**) and omitted `StatLine` (carries six deltas) | S | tier-2 · the method document is wrong | `POLISH-0.md:138` | routed | **fixed** | An inspector working the list hunts a phantom and never opens the component that matters | POLISH.2 docs commit |
| **PD-2-30** | **V50 (new)** — hero avatar renders at the primitive's 24px; mockup `.avatar` is **16px** | V | tier-4 `:84` | `HeroPanels.tsx:112` · `ui/avatar.tsx:20` | routed | **open** | `data-[size=sm]:size-6` out-specifies a consumer override — the twMerge trap POLISH-1a documented | **Shared-primitive docket** — same treatment POLISH-1a gave `ui/avatar.tsx` (its Open Question 1). Out of `src/components/shell/`-adjacent scope |
| **PD-2-31** | **PERF-1** — `/` serves in ~35 s cold; the round-trip trace does not explain it | B | tier-1 · go-live blocker | `list.ts:48-63` · `page.tsx:59-65` | routed | **open** | See the log — the "41 round-trips" figure counts **calls**, not statements; the true count is **97** | **FORKED** per the PERF-1 pre-ruling: cold cost **not identified**, only candidate-ranked. Own plan-then-execute task |

## POLISH.3 · Market Detail

*Not yet inspected. Gates: B1 · B2 · B3 · C3.*

| ID | Title | Class | Baseline | Evidence | Disposition | Status | Root cause | Routed to |
|---|---|---|---|---|---|---|---|---|
| — | — | — | — | — | — | — | — | — |

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
| **PD-0-01** | `<Plus /> Full` where CD-A ratified a **"Read more"** text link. `Read more` has zero occurrences repo-wide | V | tier-2 · CD-A close-out, 2026-07-14 | .3 · .5 · .6 | routed | **pending R4** | B11 · CC-LIGHT |
| **PD-0-02** | `PostCard` `Đ BET` and `Support / Counter` are **literal `disabled`** — no auth prop reaches the component. Signed-in participants see *"sign in to bet"* | F | tier-4 · d5 mockup `:1099-1103`, `:1246-1250` (live handlers) | .3 | routed | **pending R1** | B6 · CC-HEAVY. **ADR-0034 D-1 constraint applies** |
| **PD-0-03** | `PostPopup` at `max-w-lg` (~512px) vs CD-A's 720px; `max-h-[80vh]` vs 90vh; **no `SideBadge` at all** — bare interpolated text; CD-A header row absent | V | tier-2 · CD-A | .3 | routed | **pending R5** | B7a · CC-LIGHT. **Blocked on C3** |
| **PD-0-04** | CD-A's Support/Counter footer + stake bar, and the reply-variant pop-up, are unbuilt. `ReplyPopup` → zero matches | B | tier-2 · CD-A | .3 | routed | **pending R6 — deferred** | — |
| **PD-0-05** | No global banner anywhere. The **2026-11-05 freeze** has no site-wide surface — freeze copy is composer-scoped and surfaces only after a failed write | F | tier-2 · W2.11 **P4**, *"the one loud participant read-only event"* | .1 | routed | **pending R2** | B8 · CC-HEAVY |
| **PD-0-06** | `not-found.tsx` exists nowhere; no `global-error.tsx`. `notFound()` fires from six live sites incl. `/m/[slug]` on unknown **or Draft** slugs | F | tier-1 · the routes throw it | .1 | routed | **pending R3** | B10 · CC-HEAVY |
| **PD-0-07** | `text-white` at `audit/page.tsx:75` — the only Tailwind palette colour class in `src/`, bypassing the `--color-*` layer | V | tier-2 · token contract v0.4 | .8 | routed | **pending R7** | B12 · CC-LIGHT |
| **PD-0-08** | Five loading skeletons shipped; **W2.11 T1 ratified none**, and the locked kit P1–P6 has no loading primitive | R | tier-2 · W2.11 T1 | .1 · .2 · .5 · .6 | — | **pending R8 — no default** | founder |
| **PD-0-09** | At least five distinct empty-state implementations; **W2.11 P1 locked one shape** | V | tier-2 · W2.11 P1 | .2 · .5 · .6 | routed | **pending R9** | per-surface V batch |
| **PD-0-10** | Three `PositionMarker` implementations — `badges.tsx` (`secondary` + `aria-label`) vs hand-rolled `outline`, no `aria-label`, in `ArgumentList` and `BookmarkCard`. Side chips likewise hand-rolled | V | tier-2 · one component, one treatment | .5 · .6 | routed | **pending R12** | **root cause: primitive duplication.** Check at B1's PR whether it rewrote `BookmarkCard`; do **not** add scope to B1 |
| **PD-0-11** | Price-bar percentage labels are non-interactive (`role="img"`); the mockup wires them to `pick()` | R | tier-4 · d5 `:1038`/`:1040` | .3 | **accepted-divergence** *(proposed)* | **pending R10** | canon §10 |
| **PD-0-12** | Sell button is **hidden** when ineligible, not disabled. W2.10 Option A never specified which | R | — (unspecified) | .5 | **accepted-divergence** *(proposed)* | **pending R11** | canon §10 |
| **PD-0-13** | `design-language.md:178`, `:227` still describe the debate mode selector as real — **known-stale**, flagged at `DEBATE.4.md:44`, never corrected | S | tier-2 · a baseline document is wrong | all | routed | **pending R19** | correct at C3, same commit as CD-A |
| **PD-0-14** | Turnstile is not wired — placeholder token, staging on always-pass test keys. W2.1's three ratified Turnstile states cannot be exercised | — | tier-2 · W2.1 | .7a | **data-blocked** | open | AUTH-TURNSTILE-WIRE |
| **PD-0-15** | Raw error codes (`otp_invalid`, `rate_limited`) render to users | V | tier-2 · canon §6 copy | .7a | routed | open | AUTH-ERROR-COPY |
| **PD-0-16** | The chart's **expanded-overlay** variant has no tier-2 or tier-4 baseline; values-log branded three renders, four exist | S | — (no baseline of any tier) | .3 | — | **pending R13** | verify SPEC.CHART covers it; if not, SPEC-FIRST halt |
| **PD-0-17** | **Header Balance and the composer's spendable figure legitimately differ by `DAILY_CREDIT_DHARMA` (10 Đ) on any unclaimed day.** A user can correctly render **1,000** in the header and **1,010** in the composer at the same instant | — | tier-1 · the two reads are correct as built | .1 · .3 · .5 | **superseded** | closed | **NOT A DEFECT. Do not open a row.** `accrueDailyCredit` fires *inside* `place()`, so an unspent daily credit is spendable but not yet in the ledger. `header-balance.ts` pins a BALANCE-FIRST / CURSOR-SECOND statement order precisely so the worst case is a one-credit UNDERSTATEMENT rather than an overstatement — a header that promised capacity the composer rejected would be the real bug. Recorded at STAGING-PARITY Slice C/D, citing the **SHELL-COMPLETE close-out** (where a test that pinned the two equal was caught as the near-miss) and Ratification Record **W-D** |
| **PD-0-18** | **The profile Dharma graph renders empty (or near-empty) for ALL generated staging data** | — | tier-1 · the x-domain is correct as specified | .5 | **superseded** | **data-blocked** | **NOT A REGRESSION, and not fixed by STAGING-PARITY.** The §23 graph x-domain is **hard-pinned 2026-09-15 → 2026-11-05** as module-private consts at `src/server/profile/graph-series.ts:31–34`, with no env or config override. Everything the generator produces is stamped *now* (August), and **backdating `created_at` is forbidden** — it would mean writing timestamps the engine cannot produce (P-10). Manifest §3. Remedy is **GRAPH-WINDOW-OVERRIDE**, a separate task behind a SPEC.1 §23 rider. ⚠ Slice B removed the *other* cause (staging had no event-backed data at all); an inspector seeing an empty graph now is seeing the domain, not missing rows |

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
| **F-DEBATE-4** — interval polling on `/m/[slug]`, unverified | .3 | B3, pending RECON-2 |
| **UI.11** — no AGPL source offer exists anywhere in the shell | .1 | B4 |

---

*Extended at POLISH.2 (2026-08-09): **thirty-one** `PD-2-nn` rows allocated under POLISH.2 · Discovery — the first inspection-derived rows in this register. `PD-0-18` remains the pre-recorded high-water mark; `PD-2` is a fresh per-surface series per the `PD-<surface>-<nn>` scheme above. **The thirteen `POLISH-register-ADDITIONS.md` rows are still unapplied** and are NOT among these — that file's apply-checklist is untouched and still owed.*

*Scaffolded by web Claude, 2026-07-30 IST. **Eighteen** pre-recorded rows, none from an inspection. Rows marked "pending Rn" resolve when `POLISH-0_ruling-register_r2.md` is ratified. Extended at STAGING-PARITY Slice C/D (2026-08-06): PD-0-17 and PD-0-18 pre-recorded as `superseded` so POLISH.5 does not spend a founder review-hour re-deriving two known-correct behaviours, plus the standing staging coverage reference above.*
