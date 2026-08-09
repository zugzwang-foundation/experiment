# DISCOVERY-COMPLETE — everything remaining on Discovery, one plan, one PR

> **Status:** drafted
> **Date:** 2026-08-10
> **Author:** Hrishikesh + Claude Code (plan session)
> **Critical-path?** **no** — nothing under CLAUDE.md §1. `src/server/discovery/` is not a listed critical path, and there is no DDL, migration, auth, bet, dharma, resolution or moderation write. The full ritual is *not* triggered; §5.14 **SC-1 fires** (Group 2 edits a read over `comments`) and is treated as binding.
> **Plan PR / commit:** this plan lands as its own commit before execution opens.

---

## Context

Discovery (`/`) is built and live but incomplete against its ratified mockup. POLISH.2's machine pass produced 50 deltas; 24 shipped, and the remainder either **halted on a read-model gap**, **halted on a shared primitive**, or **halted pending a founder ruling**. PERF-1 then closed the only GO-LIVE BLOCKER — Discovery went **35.07 s → 0.692 s p50** on staging by applying ADR-0006's ratified `bom1` function region (PR #307/#308), so the surface is now inspectable and POLISH.1–.8 are unblocked.

This task clears **all of it in one pass** so the founder's visual refinement runs **once** against a complete surface rather than against six partial states. Two founder rulings are ratified inputs: **R9** (empty/error reconcile to W2.11 P1's one shape) and **R8** (T1 superseded — skeletons are correct; mint a **P7** loading primitive, canon edit in the **same commit** as the code).

**Branch off `origin/main` = `0983d99`** — verified (`docs(runbook,parked): §2.5 is NOT vacuous… (#309)`, 2026-08-10 01:15 +0530).

⚠ **The current primary tree is NOT at `origin/main`.** `chore/post-perf-1-docket` is at `1b7f37f` with **two commits that are not on main**: `746a469` (the pre-squash of #309 — already landed as `0983d99`) and **`1b7f37f` `docs(adr): ADR-0006 §4 — back-reference ADR-0026's third R2 bucket`, which is UNPUSHED and belongs to ADR-0006-DISCIPLINE — explicitly out of scope**. Branching from HEAD would drag it into this PR. Branch from `origin/main` explicitly, and launch from a fresh worktree at `origin/main` so `.claude/agents/*` model pins are current.

---

## Approach

Three commit groups in one PR, twelve commits, built in dependency order. **Group 1** opens with a **static pole-binding guard committed RED**, then adds Discovery-scoped **size presets** to three shared primitives (`PriceBar`, `ui/avatar`, `SideBadge`) and greens the guard by *adopting* those primitives on the two surfaces that render the side encoding inverted; every preset **defaults to the render that ships today**, so no un-inspected surface moves. **Group 2** extends the `HeroPost` DTO with four fields that are **already loaded and discarded** at `hero.ts:73` — reply counts, Support/Counter Dharma, entry price — plus an image URL obtained by a **column join on an existing query**, so the whole group is **+0 new queries**. **Group 3** reconciles Empty/Error to the P1 shape and replaces the hard-coded skeleton with a **P7** primitive, landing the canon amendment in the same commit.

---

## Tracker context

No tracker row exists for `DISCOVERY-COMPLETE` — it is minted by this kickoff and consolidates ten open `POLISH-register.md` rows. Register rows verified against `origin/main` (only `PD-2-31`/PERF-1 differs from the local tree; every row below is byte-identical on main):

| Register row | Delta | Register disposition at plan time |
|---|---|---|
| PD-2-20 | V10 V11 | `open` · **FOUNDER-RULED → SIDEBADGE-PRICE** |
| PD-2-21 | V29 V30 | `open` · **PRICEBAR-GEOMETRY** |
| PD-2-22 | V13 | `open` · **HALT — read-model.** Sized **L**, HALT SET 5 |
| PD-2-23 | V15 | `open` · **HALT — DTO field (ADR-0034 D-1 discipline)** |
| PD-2-24 | V16 | `open` · **HALT — DTO field.** "data already loaded and discarded… **zero new queries**" |
| PD-2-25 | V17 | `open` · **HALT — DTO field.** ⚠ display-only, **never buttons** |
| PD-2-27 | V46 | `open` · **pending R9** — now ruled |
| PD-2-28 | — | `pending R8 — no default` — now ruled |
| PD-2-30 | V50 | `open` · **Shared-primitive docket** |
| PD-0-10 (partial) | BookmarkCard side chip + marker | `pending R12` — the **INV-3 arm only** is absorbed here per kickoff |

**Dependencies:** PERF-1 — **CLOSED** (#307/#308). W2.11 P1 — **locked** 06-27. R8/R9 — **ratified in this kickoff**. No blocked dependency.

---

## Pushback — four kickoff corrections, stated once

**1. `chart/MarketPriceChartCard.tsx` does not consume `PriceBar`.** The kickoff (and register row PD-2-21) name it as a `PriceBar` consumer. It is not one: it imports `MarketPriceChart` and `formatPercentUnpaired` and renders its own `sr-only` readout (`MarketPriceChartCard.tsx:1-7`, `:23-27`). Grep for `PriceBar` returns exactly **three** render sites:

| Consumer | Line | Surface | V-item |
|---|---|---|---|
| `components/debate/MarketHeader.tsx` | `:96` | `/m/[slug]` | — (not V29/V30) |
| `components/discovery/HeroPanels.tsx` | `:78` | Discovery hero | **V29** (22px) |
| `components/discovery/MarketCard.tsx` | `:68` | Discovery grid | **V30** (16px) |

The omitted one — `MarketCard.tsx` — **is** the 16px card consumer V30 names. The plan uses this corrected list.

**2. "Mockup geometry" cannot be applied primitive-wide, on any of the three primitives.** Each mockup specifies *different* numbers for the same chip class:

| Primitive | Discovery mockup | d5 (`/m/[slug]`) mockup | Profile mockup |
|---|---|---|---|
| `.sidechip` | base 8.5px / 2px 6px / .1em; **`.md` 9px / 2px 7px / .06em** (`:115-116`) | `.lg` 13px/6px 16px · **`.md` 10px/3px 9px** · `.sm` 8.5px/2px 7px/.08em (`:538-541`) | `.sm` 8.5px/2px 7px/.08em (`:278-279`) |
| `.barrow .bar` | **`.f` 22px** / `.m` 16px / `.r` 16px (`:109-111`) | **`.f` 14px** / `.r` 16px (`:508-509`) | — |
| `.avatar` | **16px** (`:84`) | 26px base; `.argprofile` **18px**; `.rcardhead` 18px (`:437`, `:576`, `:836`) | `.pauthor` 20px (`:795`) |

`.sidechip.md` means 9px on Discovery and 10px on d5. `.barrow.f` means 22px on Discovery and 14px on d5. **Applying one surface's numbers to a shared primitive imports them onto surfaces that have their own ratified numbers** — worse than leaving them. So all three primitives get a **Discovery-scoped preset with the default pinned to today's built render**. This is forced by the mockups, not a preference. The d5/Profile presets are POLISH.3/.6 rows, not this task's.

**3. The mockups are LIGHT-THEME; the build ramp is INVERTED. Never port a colour token by name where it encodes a SIDE.** Mockup `:root` is `--n0:#FFFFFF … --n7:#171717, --ink:#0A0A0A` (`surface_discovery_v1_0.html:45-47`); the build is `--color-n0:#212121 … --color-n7:#e4e4e4, --color-ink:#fafafa` (`globals.css:139-147`). Consequences:

- `.sidechip.yes{background:var(--ink)}` and `.bar .fill{background:var(--ink)}` mean **black** in the mockup. `bg-ink` in the build is **`#fafafa` — white**. Porting either by name **inverts the pole** — the *identical* defect as the BookmarkCard bug below.
- **Rule for this whole task:** where a mockup token encodes a SIDE, substitute `--color-yes` / `--color-no`. Never `bg-ink` for a YES fill. Elsewhere (text emphasis: `.argstake{color:var(--n6)}` → `text-n6`) copy by **name/index**, per AGENTS.md §8 "inverted vs the retired light ramp — never copy by lightness".

**4. V13 is not L for the reason the register gives, and it is achievable at +0 new queries — but it carries a semantic decision only the founder can settle.** See §6 and Open Decision **OD-1**. This is the one item I recommend does not build until ruled.

---

## 1. Thesis invariants touched

| Invariant | Touched? | How the plan preserves it | Test assertion |
|---|---|---|---|
| **INV-1** bet ↔ comment atomicity | **no** | Read-only task. No write path, no transaction, no insert anywhere in scope. | n/a |
| **INV-2** Dharma non-transferable / no overdraft | **no** (display only) | V13/V16/V17 render Dharma **magnitudes**; no ledger write, no transfer surface. All values stay canonical 18-dp strings through `formatDharma`; **no JS float arithmetic** — V13's only math is `computeSell` (decimal.js via `CpmmDecimal`). | `tests/unit/discovery/render/hero-panels.test.tsx` — figure strings asserted through the shared formatter |
| **INV-3** comments side-bound at post-time | **YES — a live defect is being fixed, on TWO surfaces** | `/bookmarks` **and `/u/[pseudonym]`** both render the frozen side through shadcn semantic variants that resolve **backwards** (§4 C4 / C4b). Fixes adopt the pole-bound `SideBadge`, and a static guard (C0) makes the whole defect class un-writable. V10/V11 add the entry **price** beside the side; the SIDE stays frozen, pole-bound, and is never derived from a semantic variant. | `tests/unit/design/side-pole-binding.test.ts` (new, C0) + `tests/unit/bookmarks/render/side-encoding.test.tsx` (new) — assert `bg-yes`/`bg-no` present and `bg-primary`/`bg-secondary` **absent** |
| **INV-4** resolutions append-only | **no** | No `resolution_events` / `payout_events` read or write. Discovery lists **Open** markets only (`list.ts:55`). | n/a |

**Not critical-path**, so the per-invariant failure-mode drill is not required. INV-3 gets one anyway because it is a shipped defect: *if the C4/C4b assertions are omitted, `/bookmarks` and `/u/[pseudonym]` continue to render YES as near-white and NO as near-black — the exact inverse of the ratified binding — and a founder visual pass on either surface would read the side encoding backwards on every card. And if C0's static guard is omitted, the next surface to port from the light-theme mockups (POLISH.3/.5/.6 all do) reintroduces it by a third route, because nothing at the call site shows that `bg-primary` and `bg-ink` are near-white.*

### 1a. §5.14 SC-1 — quoted verbatim, then discharged clause by clause

A cited rule is not a satisfied one, so the rule is reproduced in full from `CLAUDE.md` and each clause is answered against this diff.

> **SC-1 · Masking is a property of every body read, not of rows.** Removal masking is **not** a property of ROWS — it is a property of **every code path that reads `comments.body`** (or any user argument text / teaser / snippet). **Fires on any PR that adds or edits a read over `comments`, on any surface, participant or admin.** Two obligations: (1) the read **must** intersect `loadRemovedSet` or the equivalent `mod_actions.reason='content_removed'` predicate before a body can reach a DTO — prefer a union type whose removed variant carries no body field, so it is un-renderable by construction; (2) its test **must assert the BODY's absence, not the row's** (`expect(JSON.stringify(rows)).not.toContain(theBody)`, not only `expect(ids).not.toContain(theRow)`) — row-level exclusion assertions do not catch a second body-read path. *Minted from a live leak: the review-feed's main query anti-joined `content_removed` at row level, and a second read path in the same file (the parent-snippet fetch) read the body without the predicate and leaked a removed parent's body onto staging. Promoted here from `docs/parked.md` at SYNC-1 — a standing check filed in the docket is a standing check nobody reads, and one that is never read never fires.*

**Does it fire?** **Yes.** C7 edits a read over `comments` — the picked-posts select at `hero.ts:96-104` gains a `LEFT JOIN image_uploads` and a column. The trigger is "adds or edits a read over `comments`", which this is. It fires whether or not a body is involved.

**Obligation (1) — the read intersects the predicate before a body reaches a DTO.** Satisfied, and by the *stronger* of the two forms the rule offers. Discovery does not mask a body **after** reading it; it never reads it. Order in `selectHeroTopPosts`: substrate (`:73`) → `loadRemovedSet` (`:78-81`) → `pick()` **excludes** `removedSet` members (`:85`) → **only then** is `pickedIds` used for the body select (`:93-104`). So a removed post's body, author, title, teaser — and, after C7, its `r2_object_key` — are never in a result set at all. This is why `HeroPost` needs no removed union variant, and `hero.ts:32-38` says exactly that: *"a Track-B-hidden post is ineligible and skipped entirely, so no masked union variant exists on this DTO (there is nothing to mask; the removed post's body/author are never even read)."*

**What C7 must not break — the specific hazard.** SC-1's minting story is *"a second read path in the same file"*. C7 adds a join to the **existing, already-filtered** read; it must **not** introduce a second read over `comments` or `image_uploads` keyed on anything wider than `pickedIds`. Concretely forbidden: fetching keys for all of `substrate`, or for `ordinalRows` (`:115-121`, which deliberately spans **all** top-level comments **including removed ones** — that read selects `id` **only** and must keep selecting `id` only. Adding `body` or `image_uploads_id` there would be the leak SC-1 was minted from, in the same shape, in this file).

**Obligation (2) — the test asserts the BODY's absence, not the row's.** Already the shape on disk: `tests/server/discovery/hero.test.ts:482-522` runs a `JSON.stringify` **never-echo sweep** over the whole returned DTO, asserting the removed post's distinctive body marker, pseudonym, id and stake are all absent — and re-asserts it after a ban to prove masking keys on `content_removed` only, never `banned_at` (`:497-522`). **Group 2 extends that same sweep to every field it adds**: the removed post's image URL, `entryPrice`, `replyCount`, `replyDharma`, `supportDharma`, `counterDharma`, and (if built) `currentValue`. A row-level assertion is not accepted for any of them.

**Reviewer line.** Both obligations are named items in the `@security-auditor` question list under *Overnight execution mode* — (c) covers obligation 1 across every path, and the test-plan row covers obligation 2.

---

## 2. Data model changes

**None.** No new table, column, index, FK, constraint, enum value, migration, partition, or event type. Migration head stays `0024_bookmarks`; `EVENT_TYPES` stays 24. Every datum Group 2 renders is already selected or reachable as a column on an existing query.

---

## 3. API surface

**None.** No new endpoint, route handler or Server Action. `selectHeroTopPosts(client, marketId)` keeps its signature and stays viewer-independent (no session parameter). `listOpenMarkets(client)` unchanged.

### 3a. Query-count proof — the binding constraint

Counted by reading every call site, not by counting call *sites*. `N = min(open markets, DISCOVERY_GRID_SIZE = 8)`.

**Before (= after).** Per Discovery render:

| Source | Round-trips | Where |
|---|---|---|
| `listOpenMarkets` outer market list | **1** | `list.ts:48-57` |
| `getMarketPricing` (pools) | **N** | `market-pricing.ts:28-35` |
| `getMarketTotals` (execute) | **N** | `market-totals.ts:34` |
| `getDefaultMarketMediaUrl` (market_media) | **N** | `media.ts:44-50` |
| `loadPriceSeries` — events(opened) · bets · events(bet.*) · pools | **4N** | `price-series.ts:58, 90, 110, 178` |
| `selectHeroTopPosts` — substrate · removedSet · picked comments · authors · ordinals | **5N** | `hero.ts:73, 78, 96, 106, 115` |
| **Total** | **1 + 12N** | **= 97 at N=8** |

**Independently corroborated:** register row PD-2-31 states "the *41 round-trips* figure counts **calls**, not statements; the true count is **97**." My count derives 97 from the source. AGENTS.md's "1 + 3N … a further 2N" counts *calls* and is the low figure — worth correcting at the close-out, not here.

**After Group 2: 1 + 12N. Delta = 0.**

| Item | Query delta | Mechanism |
|---|---|---|
| **V16** reply count + total staked | **+0** | `supportCount + counterCount`, `supportDharma + counterDharma` — already in the `PostSubstrate` returned at `hero.ts:73` and thrown away by `toHeroPost` |
| **V17** Support/Counter split bar | **+0** | same four already-loaded aggregates |
| **V10/V11** entry price on the chip | **+0** | `PostSubstrate.priceAtBet` (`ranking.ts:50`), selected by `ranking-substrate.ts:74` (`pb.price_at_bet`), discarded today |
| **V15** hero post image | **+0** | `LEFT JOIN image_uploads` onto the **existing** picked-posts select (`hero.ts:96-104`) → `r2_object_key` as a **column**. Then `signRead(key, 3600)` — `getSignedUrl` from `@aws-sdk/s3-request-presigner` is a **local HMAC**, no network call and no DB hit (`r2.ts:154-170`) |
| **V13** position-value progression | **+0 *if* OD-1 resolves to Option B** | `LEFT JOIN positions` as a column on the same picked-posts select, + reserves threaded from the pool read `listOpenMarkets` already performs (new `getMarketPricingAndReserves`, one more field on the same read). Full mechanism and its client-boundary trap in §6 |

**Why V15 is a column join and not a second read.** `load-debate-view.ts` does this as a **separate** batched key read (`mintImageUrls`, `:357-390`) because it mints for *many* comments. The hero mints for **≤2 known ids**, so the key rides the same `WHERE id IN (…)` as the body. `mintImageUrls` is **module-private and must stay that way** — exporting it would put a diff on `load-debate-view.ts` and break the §4 binding guard. The presign seam itself (`signRead`) is already shared and exported, so nothing is re-implemented; precedent for a discovery-local presign orchestration is `media.ts:40-63`.

**No new N+1 is introduced anywhere.** PERF-1 bought latency by flipping the function region; it bought no permission for per-market reads, and this plan adds none.

### 3b. ADR-0034 D-1 — the type-graph trace

The kickoff asks for a trace, not a restatement. Two independent limbs; either alone is sufficient.

**Limb 1 — D-1 is not engaged, because nothing here is viewer-scoped.** D-1 reads (`0034-viewer-scoped-debate-reads.md:62`): *"**No viewer-scoped state** may enter `DebateViewModel` or any type it transitively contains — not bookmark state, not ownership flags, not per-viewer permissions, not read receipts, not any future per-viewer affordance."* Every field Group 2 adds is **viewer-independent**: reply counts, Support/Counter Dharma, `price_at_bet`, an `r2_object_key` presign, and (V13) the **post author's** position value. Each is identical for every viewer including anonymous. `selectHeroTopPosts(client, marketId)` takes **no session parameter** and reads none — same posture `loadDebateView` holds. D-1 forbids viewer-scoped state; there is none to forbid.

**Limb 2 — `HeroPost` is not in the closure. The transitive set, enumerated:**

```
DebateViewModel                       load-debate-view.ts:124
├── market: DebateMarketHeader        :117
│   ├── MarketSummary                 @/server/markets/get-by-slug
│   └── pricing · unitToWin · totals  inline primitives
├── posts: DebatePost[]               :85  (2-variant union)
│   ├── ReplyAggregate                :56  (4 primitives)
│   ├── ReplyGroups                   :79
│   │   └── DebateReply               :63  (2-variant union)
│   │       ├── AuthorIdentity        ./resolve-authors
│   │       ├── Marker                @/server/positions/compute
│   │       └── Side                  @/lib/ranking
│   ├── Marker · Badge · Side · AuthorIdentity
└── priceChart: { series: PricePoint[]; nodes: ChartNode[] } | null
    ├── PricePoint                    @/server/discovery/price-series
    └── ChartNode                     ./price-chart
```

Closure = `{DebateViewModel, DebateMarketHeader, MarketSummary, DebatePost, ReplyAggregate, ReplyGroups, DebateReply, PricePoint, ChartNode, AuthorIdentity, Marker, Badge, Side}` + primitives. **`HeroPost` ∉ closure. `HeroTopPosts` ∉ closure.**

**Edge direction, verified by grep.** `hero.ts` imports *from* `load-debate-view.ts` (`deriveTitleTeaser`, `loadRemovedSet`) — one direction. Nothing in `src/server/debate-view/**` or `src/components/debate/**` imports `discovery/hero`; the **only** debate-view → discovery edge is `PricePoint` from `price-series.ts` (`load-debate-view.ts:17`, `price-chart.ts:11`), a different module. `discovery/hero` is imported by exactly: `(public)/page.tsx:8`, `DiscoveryCarousel.tsx:5`, `HeroPanels.tsx:7`, and five test files. **Adding a field to `HeroPost` is unreachable from `DebateViewModel` by construction.**

**The one way this could break — and the guard for it.** The closure and `HeroPost` share leaf types (`AuthorIdentity`, `Side`) and shared machinery (`PostSubstrate`). Mutating a *shared leaf* would reach the closure. Nothing in this plan does; the guard below makes that mechanical.

**Binding guard (three clauses, verified at every commit):**
1. `git diff origin/main -- src/server/debate-view/load-debate-view.ts` is **EMPTY**.
2. No field added to `DebatePost`, `DebateReply`, or `DebateViewModel`.
3. **(added by this plan)** No field added to the shared leaves — `AuthorIdentity` (`resolve-authors.ts:16`), `Marker`, `PostSubstrate` (`ranking.ts:27`) — nor to `src/server/debate-view/ranking-substrate.ts`. Clause 3 is what makes clauses 1–2 airtight rather than local.

### 3c. No vote affordance — invariant, restated as a build rule

V17's bar is **display-only**. The mockup (`surface_discovery_v1_0.html:195-199`, `:248-251`) contains `<span class="blab2">`, `<div class="bar">`, `<div class="fill">` — **no `<button>`, no `<a>`, no handler, no `cursor:pointer`**. Support/Counter are read-time aggregates over reply-bets (ADR-0017/0018); there is no friendly-fire vote and `friendly_fire_events` was dropped at DEBATE.9. The V17 element renders as a `<div>` with `role="img"` + an `aria-label` carrying both figures (the `PriceBar.tsx:26-29` precedent) and **must never** be a button, link, `onClick`, or hover target. A test asserts the absence.

---

## 4. UI / user flow — the ten commits

One PR. Group 1 first (Group 2 depends on `SideBadge`'s new prop). Each item its own commit so a regression bisects at commit granularity.

### GROUP 1 · Primitives

**Design principle for the whole group:** each shared primitive gains a **Discovery-scoped size preset**; the **default preserves today's built render exactly**, so `/m/[slug]` and the shell have a **zero pixel delta**. Pattern copied from the shipped `StatLine` (`StatLine.tsx:40-46` — a `SIZE` const map, a `size` prop, `data-size` for tests). Rationale in Pushback §2.

---

**C0 · `test(design): pole-inversion guard — a side value may resolve only to a pole token` — FIRST, and COMMITTED RED**

⚠ **The survey that specified this guard found a SECOND inverted surface. Read `OD-4` before executing C0.**

**Why a static guard at all.** Two *independent* routes now produce YES = white, and POLISH.3/.5/.6 port from the same light-theme mockups:
- **Route 1 — semantic indirection.** `side === "YES" ? "default" : "secondary"` → `bg-primary` → `--primary: var(--color-n7)` = `#e4e4e4`. The call site names no colour, so the inversion is invisible where it is written.
- **Route 2 — name-porting from the mockup.** `.sidechip.yes{background:var(--ink)}` is black in a light mockup; `bg-ink` in the build is `--color-ink: #fafafa`.

**Same root cause, stated once:** a side value resolved to a colour through **anything other than a pole token**. Pole tokens (`--color-yes`/`--color-no`, and the deliberately-separate graph family `--graph-yes`/`--graph-no`) name the pole at the call site and cannot invert silently. Semantic variants and neutral-ramp tokens can, and did — twice.

**The guard, precisely.** In the participant view layer, **any expression keyed on a side value (`=== "YES"` / `=== "NO"`, or a `side`/`parentSide`/`resultingSide` discriminant) that resolves to a colour must resolve to a POLE-FAMILY token.** An offender is a side-keyed expression whose branches contain a shadcn variant name (`default` · `secondary` · `destructive` · `outline` · `ghost` · `link`) or a semantic/neutral colour (`bg-primary` · `bg-secondary` · `bg-muted` · `bg-accent` · `bg-foreground` · `bg-background` · `bg-ink` · `border-ink` · `text-ink` · `bg-n0…n7`).

**Why not the literal ban the kickoff phrased** ("no file outside `badges.tsx` maps a side value to a colour class"). It would redden **six legitimate files on the day it lands** — the precision problem the footer ban's own comment names (*"why not simply ban `<footer>`: two legitimate NESTED footers exist today, so a name ban turns RED on correct markup the moment it lands"*). The legitimate set, enumerated from the survey:

| File | Site | Verdict |
|---|---|---|
| `debate/badges.tsx` | `:23` `side === "YES" ? "bg-yes text-no" : "bg-no text-yes"` | **the reference implementation** |
| `debate/composer/ReplySplitBar.tsx` | `:118-122` — derives `resultingSide` via `deriveReplySide(postSide, relation)`, keys the pole on the **SIDE**, names the variable `pole` | **correct, and exemplary.** Keys on the side, never the Support/Counter relation — the pole law applied exactly. Permitted |
| `debate/PriceBar.tsx` | `:33-34` `bg-yes` / `bg-no` | **not side-keyed** — the two fixed segments of a proportion bar. Permitted |
| `debate/composer/ReplySplitBar.tsx` | `:64,67` `bg-no` track + `bg-yes` fill | **not side-keyed** — proportion bar. Permitted |
| `debate/chart/MarketPriceChart.tsx` | `:110` `node.side === "YES" ? "var(--graph-yes)" : "var(--graph-no)"` | side-keyed → **graph pole family.** Permitted. `:24-25` documents why the family is separate: `--color-yes` *is* the ground, so a value-copy would be invisible |
| `profile/graph/ProfileChart.tsx` | `:181-183`, `:271` (`--color-yes`/`--color-no`) | side-keyed → pole / graph family. Permitted |

So **SideBadge is the only component permitted to render a side-bearing colour CHIP** — that is the founder's intent, stated at the precision the code supports. Proportion bars and graph series legitimately render side colour and are not chips; they are pinned as a **closed inventory with a count**, so a seventh cannot appear silently.

**Guard shape — the `not-found.test.ts:165` pattern, feature for feature.** New file `tests/unit/design/side-pole-binding.test.ts`:
- `readdirSync(join(process.cwd(), "src"), { recursive: true, withFileTypes: true })` filtered to `.tsx`/`.ts`.
- `stripComments` — reused verbatim from `not-found.test.tsx:45-50` (itself the shape from `no-raw-hex-view-layer.test.ts`): **prose about a pole is not a pole.** Load-bearing here, because `PriceBar.tsx:5-6`, `PositionStrip.tsx:90` and `CountdownDigits.tsx:12` all *discuss* `--color-yes`/`bg-yes` in comments.
- **The alive check, non-negotiable:** `expect(files.length).toBeGreaterThanOrEqual(<count at commit>)` **and** `expect(sideKeyedExpressions.length).toBeGreaterThanOrEqual(6)`. *"A glob that silently matched nothing would pass vacuously — the POLISH.1 z-index failure."* A guard that finds no side-keyed expressions at all must fail, not pass.
- `offenders: string[]` collected with `file:line`, `expect(offenders).toEqual([])`.
- **Declared exclusions, each with its reason in the source:** `src/app/(admin)/**` — `ReviewFeed.tsx:102-104` hand-rolls a side chip whose mapping is **currently CORRECT** (`bg-yes` for YES), so it is duplication, not inversion. Importing a participant debate primitive into admin chrome is an admin-surface decision (admin is a structurally separate path — CLAUDE.md §3), not this task's. Recorded, not hidden: **`ReviewFeed` is the third surviving side-chip implementation after this PR.**

**Proving it RED — the ordered obligation.** C0 is committed **before** any fix, with the RED run output pasted into the commit body naming its offenders by `file:line`. **The RED must be captured before the fix is written**, not reconstructed after. Expected offenders at C0:

| Offender | Surface | Fixed by |
|---|---|---|
| `bookmarks/BookmarkCard.tsx:91` | `/bookmarks` | **C4** |
| `profile/ArgumentList.tsx:96` | **`/u/[pseudonym]`** | **C4b — gated on OD-4** |

**C4b · `fix(profile): INV-3 — adopt SideBadge in ArgumentList (the same inversion, second surface)` — ⚠ GATED ON OD-4**

The survey found `src/components/profile/ArgumentList.tsx:94-97` is a **byte-identical clone** of the BookmarkCard defect — same local function name `SideChip`, same signature, same `variant={side === "YES" ? "default" : "secondary"}`, therefore the same inversion. It is **live**: rendered at `:49` and `:59`, mounted at `(public)/u/[pseudonym]/page.tsx:95`.

⚠ **And this surface is NOT auth-gated.** `(public)/u/[pseudonym]/page.tsx:73-74` reads the session **only** to compute `owner` for the Sell affordance — there is no `redirect`, no gate. An anonymous visitor gets the page. So of the two inverted surfaces, the one the kickoff scoped **out** is the **publicly reachable** one: `/bookmarks` requires a login to see the inversion, `/u/<pseudonym>` does not. That reverses the intuition about which is the lower-severity site, and it is the strongest argument for **OD-4 Option A**.

Fix is the identical one-line adoption of `SideBadge`; `:61`'s `<Badge variant="outline">{item.marker}</Badge>` also adopts `PositionMarker`, gaining the missing `aria-label`.

---

**C1 · `feat(discovery): V29 V30 — PriceBar size presets (hero 22px / card 16px)`**

`PriceBar.tsx` gains `size: "hero" | "card" | "detail"`, **required — no default**. A missing required argument is a compile error; a defaulted one is a silent wrong render (**O-1: structural beats procedural**).

| Preset | Bar | Labels | Layout | Consumer |
|---|---|---|---|---|
| `hero` | 22px (`:109`) | 12px (`:101`) | labels **outside**, flex row, gap 9px (`:99`) | `HeroPanels.tsx:78` |
| `card` | 16px (`:110`) | 10.5px (`:102`) | labels outside, same row | `MarketCard.tsx:68` |
| `detail` | **today's exact classes** — `h-1.5`, `rounded-full`, labels below in `text-[11px]` | — | unchanged | `MarketHeader.tsx:96` |

- Bar: `rounded-[var(--r)]`, border stays the built `[border:var(--hairline)]`. **The mockup's `border:1px solid var(--ink)` is NOT ported** — `--color-ink` is `#fafafa` in the build (Pushback §3).
- Fill: stays `bg-yes` + `flex-1 bg-no`. **The mockup's `background:var(--ink)` is NOT ported.**
- `PCT.ROUND` untouched: `formatPricePercent` stays the source, YES canonical / NO derived, pair sums to 100 (`PriceBar.tsx:20-23`). Percentages stay non-controls (R10 / PD-0-11).
- `role="img"` + paired `aria-label` preserved verbatim — `tests/unit/debate/render/price-percent-pair.test.tsx` and `price-chart.test.tsx:239` both assert through it.
- **Zero-delta proof for `detail`:** capture `MarketHeader`'s rendered `class` attribute + DOM shape before, assert byte-identical after.
- ⚠ `detail` is a **named transitional preset**, not the ratified answer: d5 specifies 14px bar / 10px labels (`surface_d5_v1_0.html:507-508`). Reconciling it is **POLISH.3's** row. Recorded in the commit body and the close-out. See **OD-2**.

**C2 · `feat(ui): V50 — Avatar xs (16px) preset`**

`ui/avatar.tsx:20` carries `data-[size=sm]:size-6` in the base `cn()` string. A consumer `className="size-4"` **cannot win**: Tailwind compiles the data-variant to `&[data-size=sm]`, giving specificity `(0,2,0)` against a bare `.size-4`'s `(0,1,0)`, so `size-6` wins **regardless of twMerge order** — this is the trap POLISH-1a item 4 documents, and the reason PD-2-30 routes to the primitive.

Fix: add `xs` to the size union → `data-[size=xs]:size-4` (16px) + `group-data-[size=xs]/avatar:text-[9px]` on the fallback. `HeroPanels.tsx:117` becomes `size="xs"`. The three `size="sm"` instances (`IdentityCluster.tsx:48,62`, `ArgProfile.tsx:51`) are **untouched → zero delta**. Ring stays `--avatar-ring`. Mockup `.avatar` also carries `border-radius:50%` + `1.5px solid var(--ink)` — the built ring already covers this; **not** ported by token name.

**C3 · `feat(discovery): V10 V11 — SideBadge carries entry price; hero chip geometry`**

Two independent changes to `badges.tsx:14-29`, both **additive and opt-in**:

1. `price?: string` — when present renders `YES @ 27%`, when absent renders `YES` (today). Formatted with `formatPercentUnpaired` (`MarketPriceChartCard.tsx:23-27` precedent — a genuinely single-side percentage, the SPEC.1 §10.8 escape hatch, `pctround-allow` comment required). `aria-label` extends to `"YES side, entry price 27%"`.
2. `size?: "hero"` — the Discovery chip geometry: `text-[9px]`, `px-[7px] py-[2px]`, `tracking-[0.06em]`, `rounded-[var(--r)]`, `font-extrabold` (`:116`). Default = today's `rounded-sm px-1.5 font-mono text-[10px] tracking-wide`.

**The SIDE stays frozen and pole-bound.** `side === "YES" ? "bg-yes text-no" : "bg-no text-yes"` is **not touched**. No shadcn semantic variant is introduced. That line is the invariant; the price is a sibling.

**All 9 files containing `SideBadge`, with the render delta for each:**

| # | File | Site | Delta |
|---|---|---|---|
| 1 | `debate/badges.tsx` | `:14` (definition) | signature +2 optional props; default branch byte-identical |
| 2 | `discovery/HeroPanels.tsx` | `:136` | **CHANGED** → `size="hero" price={post.entryPrice}` ⇒ `YES @ 27%` at 9px |
| 3 | `debate/PostCard.tsx` | `:52` | **none** — bare `side` |
| 4 | `debate/PostFocusHeader.tsx` | `:67` | **none** |
| 5 | `debate/ReplyCard.tsx` | `:41`, `:49` (**two sites**) | **none** |
| 6 | `debate/ArgProfile.tsx` | `:62` | **none** |
| 7 | `debate/DebateColumn.tsx` | `:53` | **none** — column header; no post, no price exists |
| 8 | `debate/composer/BetComposer.tsx` | `:404` | **none** — pre-commit, no entry price exists yet |
| 9 | `debate/composer/SellModule.tsx` | `:262` | **none** |

**8 consumer files + the definition = 9**, matching PD-2-20's count. Exactly one changes.

**Why the price is optional rather than required.** Sites 7–9 have **no entry price in existence** (a column header and two pre-commit composers). A required prop would force a lie. And `DebatePost.entryPrice` / `DebateReply.entryPrice` *already exist* (`load-debate-view.ts:112`, `:75`), so sites 3–6 can adopt at POLISH.3 with **no further primitive change** — d5's own mockup renders `YES @ <e>%` on its chip (`surface_d5_v1_0.html:1701`), confirming this is a product-wide pattern and the optional prop is the right seam.

**Read-model note.** V10/V11 needs `HeroPost.entryPrice`, sourced from the already-loaded `PostSubstrate.priceAtBet`. This is a **DTO field, not a query change** — the kickoff's "NO read-model change" holds in the sense that matters (§3a: +0 queries). Because it is a `HeroPost` field it is bound by the §3b guard and reviewed by `@code-reviewer` like the Group-2 fields.

**C4 · `fix(bookmarks): INV-3 — adopt SideBadge + PositionMarker; the side encoding rendered inverted`**

**The inversion, derived to the token — CONFIRMED at source, with the one honest limit stated.**

`BookmarkCard.tsx:89-93` hand-rolls `SideChip` as `<Badge variant={side === "YES" ? "default" : "secondary"}>`, and `:47-49` hand-rolls the marker as `<Badge variant="outline">`. Resolution chain:

| Side | Variant | Badge class (`badge.tsx:12-14`) | `:root` alias (`globals.css:59-62`) | Hex | Renders |
|---|---|---|---|---|---|
| **YES** | `default` | `bg-primary text-primary-foreground` | `--primary: var(--color-n7)` / fg `var(--color-ground)` | **`#e4e4e4`** bg, dark text | **near-WHITE** |
| **NO** | `secondary` | `bg-secondary text-secondary-foreground` | `--secondary: var(--color-n1)` / fg `var(--color-n7)` | **`#2a2a2a`** bg, light text | **near-BLACK** |

Ratified binding (`globals.css:151-152`, pinned by `tests/unit/design/tokens-monochrome.test.ts`): `--color-yes: #181818` (**YES = black**) · `--color-no: #fafafa` (**NO = white**). The built `SideBadge` renders YES as `bg-yes text-no` = `#181818` bg + `#fafafa` text. **BookmarkCard renders the exact inverse, on both poles, background and text.**

**Cascade-defeat check — nothing rescues it:**
- `SideChip` passes **no `className`** (`:91`), so `cn(badgeVariants({variant}), undefined)` leaves `bg-primary` unopposed.
- `bg-primary` is generated: `--color-primary: var(--primary)` (`globals.css:34`).
- No `[data-variant]` selector exists for badges anywhere — `grep data-variant src/` returns only `button.tsx:64`.
- The `.dark` block *does* redefine `--primary` (`:96-99`) but is **never applied**: `grep '"dark"|className="dark"|classList.*dark' src/` returns **nothing**, confirming AGENTS.md §8's "descoped-inert". `:root` is the live value.
- `/bookmarks` renders `BookmarkCard` for every non-empty item (`bookmarks/page.tsx:53-55`).

**⚠ Honest limit — this is a source derivation, and the kickoff asked me to say so.** A component test in jsdom can assert the resolved **class names** (`bg-primary` present, `bg-yes` absent), but jsdom does **not** evaluate the `@theme` cascade, so it cannot prove the *pixel*. The pixel proof needs a browser, and `/bookmarks` is **auth-gated** (`page.tsx:27-31` → `redirect("/sign-in")`), so it requires a signed-in session against staging. **Execution order is therefore fixed: C0's RED plus the class-level assertion — and a staging browser capture if a session is available — are captured BEFORE the fix is written.** If the browser capture cannot be obtained, the class-level derivation above stands as the finding and the commit body says exactly that — it does not get upgraded to "observed". **`/u/[pseudonym]` is NOT auth-gated**, so C4b's counterpart *is* browser-verifiable without a session — and it renders the identical chip, which makes it the cheaper pixel proof of the same defect. **Capture it first.**

**Fix = ADOPT, never patch the hand-roll.** Delete the local `SideChip` (`:89-93`); import `SideBadge` + `PositionMarker` from `@/components/debate/badges`; replace `:46` and `:32` with `<SideBadge side={item.side} />` and `:47-49` with `<PositionMarker marker={item.marker} />`. Net effect: side encoding corrected, and the marker gains the `aria-label="Author Flipped"` it lacks today (the PD-0-10 root cause — primitive duplication).

**Bounded:** `BookmarkCard.tsx` only. **PD-0-10's other site (`profile/ArgumentList.tsx`) is OUT** per the kickoff. Two of PD-0-10's three implementations remain after this commit; recorded in the close-out so the row is not mistaken for closed.

---

### GROUP 2 · Hero read-model — the four POLISH.2 halted

All four extend `HeroPost` in `src/server/discovery/hero.ts` and render in `HeroPanels.tsx`'s `HeroPostPanel`. §3b's three-clause guard is asserted at each commit. **`@code-reviewer` runs inside the run on every commit here**; `@security-auditor` runs on the ADR-0034 boundary + SC-1 after `@code-reviewer` passes.

**C5 · `feat(discovery): V16 — hero reply head (Replies · N | Đ X staked)`**
`HeroPost` += `replyCount: number`, `replyDharma: string`. Both from the substrate already at `hero.ts:73`: `supportCount + counterCount`; `supportDharma + counterDharma` summed with `CpmmDecimal` (**never JS `+` on the strings** — CLAUDE.md §2) and emitted via `toFixed18`. Renders per `:194` / `:94-98`: flex row, `justify-between`, 9.5px, `font-bold`, `text-n6`; `Replies · 24` left, `Đ 10,000 staked` right, `formatDharma` for the figure. V48's singular/plural rule applies — `1 reply`, not `1 replies` (the `StatLine.tsx:48-51` `noun` helper). **+0 queries.**

**C6 · `feat(discovery): V17 — hero Support/Counter split bar (display-only)`**
`HeroPost` += `supportDharma: string`, `counterDharma: string` (verbatim from the substrate — no arithmetic). Renders per `:195-199` / `:99-113`: `.barrow.r` = 16px bar, gap 9px, `mt-[9px]`; stacked `.blab2` labels — `SUPPORT` at 8.5px/800/`.12em`/`text-ink`, the Đ figure at 9.5px/700/`text-n6`; right label `items-end`. Fill width = `supportDharma / (support + counter)`, computed with `CpmmDecimal` as a **percentage string**, never a float. Both-zero → 50/50 (the mockup's `tot?…:50`, `:458`). **Fill colour: `bg-yes`, NOT `bg-ink`** (Pushback §3). `<div role="img" aria-label="Support Đ 3,800, Counter Đ 6,200">`. **No button, no link, no handler, no hover target** (§3c) — asserted. **+0 queries.**

**C7 · `feat(discovery): V15 — hero post image attachment`**
`HeroPost` += `imageUrl: string | null`. The existing picked-posts select (`hero.ts:96-104`) gains `LEFT JOIN image_uploads ON image_uploads.id = comments.image_uploads_id` and selects `r2_object_key` — **a column on an existing query, +0 round-trips**. Then `signRead(key, 3600)` per picked post that has one, `try/catch` degrading to `null` (`load-debate-view.ts:381-386` / `media.ts:56-62` posture: one unavailable object must never 500 the render). TTL const mirrors the D9 seam.
Renders per `:193` / `:91-93`: `flex-1`, `min-height:40px`, `bg-n1`, `[border:var(--hairline)]`, `rounded-[var(--imgr)]`, `object-cover`; `alt=""` (the argument text carries the meaning, and the post title is adjacent). Null → the existing `IMG` placeholder idiom (`HeroPanels.tsx:52-58`). `biome-ignore lint/performance/noImgElement` with the CommentImage-precedent reason — presigned R2 GETs cannot go through `next/image`'s loader.
**Masking:** the join rides the **already-removed-filtered** `pickedIds`, so a removed post's `r2_object_key` is never selected and its URL never minted. `mintImageUrls` is **not** exported (guard clause 1).

**C8 · `feat(discovery): V13 — hero argstake progression` — ⚠ GATED ON OD-1, does not build until ruled**
See §6 for the full sizing, the mechanism, and the decision. If OD-1 = **Option B**: `HeroPost` += `currentValue: string | null`; touches `hero.ts` (the `positions` LEFT JOIN + `computeSell`), `market-pricing.ts` (**new** `getMarketPricingAndReserves`, `getMarketPricing` untouched), `list.ts` + `page.tsx` (thread reserves server-side only), `HeroPanels.tsx`. Renders `Đ 1,000 → Đ 1,407` per `:190` / `:86-88` (`text-n6`, `font-bold`; arrow `text-n4`, `font-normal`, `mx-[2px]`); no held position on the frozen side ⇒ the single figure, no arrow. **+0 queries.** If OD-1 = **Option A** or unresolved: **not built**; C5–C7 land without it and V13 carries to its own task — the kickoff's "if separable and still L, its own commit" provision, exercised.

---

### GROUP 3 · States

**C9 · `feat(discovery): V46 — Empty + Error reconcile to the W2.11 P1 shape (R9)`**
Both `EmptyState.tsx` and `ErrorState.tsx` adopt P1's **one** shape (`DESIGN_W2_11_state-kit_mockup-v0_1.html:80-84`, markup `:186-193`): hairline panel, `rounded-[var(--r)]`, `bg-n0`, `min-h-[148px]`, centred column, `gap-[10px]`, `p-6`; `.msg` 13.5px `text-n6` `max-w-[320px]`; `.sub` 12px `text-n4`; **optional single CTA** — `.cta` 12px/600, `bg-n0`, `1px solid` ink-role border, `rounded-(--r-chip)`, `px-[14px] py-2`.
- **All three OQ-6 copy consts are carried VERBATIM and unchanged.** `EMPTY_COPY.title`/`.body` map to `.msg`/`.sub`; `ERROR_COPY.title`/`.body` likewise; `ERROR_COPY.action` becomes the single CTA. Tests keep asserting **through the imported consts, never re-typing a string** (`surface-states.test.tsx:26-50`). No copy is invented — that would cross §3 social-content invention.
- `ErrorState` stays the `"use client"` leaf with the live `window.location.reload()` (R4, 2026-07-18). **V47's ratified interaction-state slots are preserved** on the CTA — `--state-hover-fill`, `--state-focus-ring`, `--state-pressed-fill`, `[transition:all_var(--dur-hover)]` (`ErrorState.tsx:56` and its comment: `--dur-hover` is a **compound** value, so it must ride the arbitrary `[transition:…]` form, never `duration-*`).
- `data-testid="discovery-empty"` / `"discovery-error"` **unchanged** — existing tests keep passing.
- ⚠ Recorded, not silently resolved: W2.11 also lists **"empty-Discovery"** and **"per-surface error panels" (T2)** under *Killed by ruling* (`:463`). SPEC.1 §22 mandates the empty state and the surface ships an error panel, so R9 — which reconciles both **to P1** rather than deleting them — supersedes that line for Discovery in the same motion R8 supersedes T1. Stated in the canon amendment (C10) so the register is not left holding a contradiction.

**C10 · `feat(discovery): PD-2-28 — mint the P7 loading primitive; amend canon for R8 (T1 superseded)`**
**Code + canon in ONE commit** (§5.12 / same-commit doctrine — R8 amends a *ratified* W2.11 decision and the locked P1–P6 kit, so this is a doc change planned as a first-class deliverable, not a side-effect).

*Code.* New `src/components/ui/loading-block.tsx` — the **P7** primitive, wrapping the shadcn `Skeleton` and taking the shape it fills. `LoadingSkeleton.tsx:18-23` replaces its four hard-coded `["a","b","c","d"]` blocks with `DISCOVERY_GRID_SIZE`-shaped output (`@/server/config/limits`, = 8) — one hero block + N card blocks. `LOADING_COPY` carried verbatim; `data-testid="discovery-loading"` and the `[data-slot="skeleton"]` marker preserved so `surface-states.test.tsx:37-48` keeps passing.

*Canon amendment — `docs/design/design-canon.md`.* Following the **§10 "Đ cluster — state authority"** precedent (`:177-197`: a named ruling, a table, a `Ratified <date> from <source>` line):

> **P7 · Loading block — R8, ratified 2026-08-10 from DISCOVERY-COMPLETE.**
> **T1 is SUPERSEDED.** W2.11 ruled *"no first-load skeletons; pages are server-rendered (populated HTML)"* (`DESIGN_W2_11_CLOSE-OUT.md:48`; `state-kit mockup:15`, `:463`). That premise does not hold: Discovery mounts a **React `Suspense` boundary** (`(public)/page.tsx:44`) around an async server read, so the first paint is the fallback, not populated HTML. A ruling that assumed populated HTML cannot govern a streamed surface. **Skeletons are correct.** The kit becomes **P1–P7**; P7 is the loading block — a `Skeleton`-based placeholder shaped like the content it replaces, sized from the surface's own constant (Discovery: `DISCOVERY_GRID_SIZE`), never market-shaped fake content. Host: any surface with a `Suspense` boundary over a server read.
> **Same ruling, second clause (R9):** W2.11's *Killed by ruling* line also lists **empty-Discovery** and **per-surface error panels (T2)**. SPEC.1 §22 mandates the Discovery empty state and the surface ships an error panel; R9 **reconciles both to the P1 shape** rather than removing them. P1's placement table gains Discovery empty + Discovery error.

Also amended: the §1 phase-state row (`:32`) and the §8 mockup-index row (`:146`) — both read "state kit (P1–P6)" → "**P1–P7 (P7 minted at R8; T1 superseded)**". The §12 forward-contract line (`:215`) "state kit P1–P6 placements per W2.11" likewise.

*Values-log — `ZUGZWANG-BRAND_agenda-and-values-log_v0_3.md` §3 item 5 ("Component specs set this session", `:217`).* Append the P7 geometry: panel `--r` / `bg-n0` / hairline; hero block height, card block height, grid gap; copy line 12px `text-n5` centred. **No new colour token, no new `--*` custom property** — P7 composes existing tokens, so `tests/unit/design/tokens-monochrome.test.ts` (11-token census, exact hex pins, string bans) stays green untouched.

---

## 5. Failure modes

| Failure | Detection | Recovery |
|---|---|---|
| R2 unavailable when minting a V15 hero image | `signRead` throws `StorageUnavailableError` (`r2.ts:166-169`) | `try/catch` → `imageUrl: null` → the `IMG` placeholder. The panel and the whole surface still serve. Never a 500. |
| A hero post has `image_uploads_id` but the join finds no row | `r2_object_key` is `null` from the LEFT JOIN | `imageUrl: null`. No throw. |
| `computeSell` receives a non-positive quantity (V13) | `requirePositive` throws (`calculate.ts:126`) | Guard **before** the call: no held row, or `quantity <= 0`, or held side ≠ post side ⇒ `currentValue: null`, render the single figure. **Never** let a throw reach `DiscoveryContent`'s catch — that would flip the whole surface to `ErrorState`. |
| A missing pool row on an Open market (V13) | `reserves === undefined` | `currentValue: null`. Do **not** copy `figures.ts:130`'s `throw` — that function runs under a held-position precondition this one does not have. |
| Any read-model throw anywhere | `DiscoveryContent`'s ONE whole-surface `try/catch` (`page.tsx:77-82`) | Renders `ErrorState`. **Do not narrow this catch and do not add a per-market or per-call catch** — the Slice-3 `@security-auditor` catch-granularity law: a narrower catch that defaulted the removed-set would flip Track-B masking **fail-open**. |
| A new query sneaks in (regression against §3a) | Round-trip count asserted in the integration layer | Halt item 3. |
| `load-debate-view.ts` acquires a diff | `git diff origin/main -- <path>` non-empty at any commit | Halt item 2. |
| Divergent formatter introduced for a percentage or a Đ figure | Review + the shared-formatter assertions | Reuse `formatDharma` / `formatPricePercent` / `formatPercentUnpaired`. **No new formatter** — SPEC.1 §10.8 mandates one. |

---

## 6. Edge cases · V13's sizing and separability (constraint 6, answered)

**Why the register sized V13 "L".** PD-2-22's root cause reads *"Current position value is in no loaded read."* True. The only existing implementation of that figure is `computeBookmarkFigures` (`bookmarks/figures.ts:83-125`), and its inputs cost **five** reads per (author, market) — pools (Q6), positions (Q7), `payout_events` (Q8), `bets` (Q9), `events`/`bet.sold` (Q10) — plus an episode walk (`mergeTradeStream` + `computeEpisodes`) whose parity against `loadProfilePositions` is locked by an identity test. Replicating that on the hero is 5N new queries — a **flat violation of constraint 1** — and duplicating an identity-tested walk is a real correctness liability. **That is a correct L.**

**Why it is smaller than L here, on two specific grounds:**
1. **Discovery lists Open markets only** (`list.ts:55`). Settlement cannot have occurred, so `settledNet` is *always* undefined and the settled branch of `computeBookmarkFigures` is **unreachable**. Đb collapses to `computeSell({reserves, side, shares: held.quantity}).proceeds` — one pure call, no episode walk, no `payout_events`, no `bets`, no `events`.
2. Both remaining inputs are obtainable at **+0 queries**: `reserves` are **already read and discarded** by `getMarketPricing` (`market-pricing.ts:28-35` selects `yesReserves`/`noReserves`, returns only prices), and `held.quantity` is a **LEFT JOIN** onto the existing picked-posts select on `(user_id, market_id, side_at_post_time)`, served by `positions_user_market_side_idx`.

**The reserves-threading detail, stated precisely because an overnight run will hit it.** `selectHeroTopPosts` reads **no pool row today**, so it cannot obtain reserves without a new read (+1N — a constraint-1 violation). The +0 path is to thread them from the read that already has them:
- Add a **new** `getMarketPricingAndReserves` beside `getMarketPricing` — *the same one pool read with one more return field*, exactly the shipped `getMarketPricingAndUnitToWin` precedent (`market-pricing.ts:52-77`). **Do not modify `getMarketPricing`**: its shape is pinned by `tests/server/debate-view/market-pricing.integration.test.ts` and its docstring says so at `:47`.
- `listOpenMarkets` uses the new function and returns reserves on a **server-only** field, then `DiscoveryContent` passes them into `selectHeroTopPosts` as a parameter.
- ⚠ **Reserves must NOT land on `DiscoveryCard` or `DiscoveryMarketView`.** `DiscoveryCarousel` is a `"use client"` component, so anything on those types is serialized to the browser. Reserves stay in a server-local variable inside `DiscoveryContent` (`page.tsx:67-76`) and are never a client prop — AGENTS.md §6 "don't expose Drizzle/internal row shapes in DTOs".

**Is it separable?** **Yes, completely** — its own `HeroPost` field, its own render line, its own read plumbing, no dependency from C5–C7. **Its own commit (C8), last in Group 2, so the other three land without it.**

**⚠ But it carries a semantic decision that is not mine.** The mockup's `.argstake` is `Đ 1,000 → Đ 1,407` — *one* element (`:190`), currently rendering `Đ {authorStake}` (`HeroPanels.tsx:137-139`). The two numbers must be commensurable, and the cheap path makes them **not**:

- Left = `post.authorStake` — **this post's own entry bet**, post-scoped.
- Right = `computeSell(reserves, side, held.quantity).proceeds` — the value of the author's **entire held position in that market**, market-scoped, which may span several bets across several posts.

For a single-bet author they agree. For a multi-bet author the pair reads as a gain that isn't one. `BookmarkCard` avoids this by taking **both** numbers episode-scoped (`figures.ts:38-42`: Đa = the final `SideEpisode`'s `stakedBasis`, Đb = its value) — which is why the register's L sizing was pointing somewhere real. Hence **OD-1** below. **C8 does not build until it is ruled.**

**Other edge cases:**
- Hero author has **exited** the side they argued (`quantity = 0`, or held on ¬S): no Đb exists. → render the single figure, no arrow. The mockup has no such state; this is the honest degradation, and it is the *common* case for an older post.
- Hero author has **flipped**: held row exists on the opposite side. → treated as "no Đb on S". Same as exited.
- **Zero replies** (V16/V17): `Replies · 0` + `Đ 0 staked`; bar 50/50 with both figures `Đ 0`. Never hidden — `Đ 0` is data *available*, matching the canon's ratified Đ-cluster rule (`design-canon.md:186`).
- **One reply**: `1 reply`, singular (V48).
- **Both hero sides empty**: `HeroPostPanel` returns the OQ-6 per-side empty copy (`HeroPanels.tsx:97-107`) — no new field renders. Copy is identical whether a side has zero posts **or masked ones**, so it can never hint that hidden content exists (F-DISC-2). **Unchanged.**
- **Removed hero candidate**: skipped entirely at pick time; no body, author, image, price or aggregate is read for it.
- `pricing === null` (unpooled market): `PriceBar`'s "Pricing unavailable" stub survives in all three presets.
- **Long pseudonym + long price** on one 9.5px `whitespace-nowrap` row (`HeroPanels.tsx:116`): the chip grows by ~5 characters. Verify at 1440 that `overflow-hidden` still truncates the pseudonym and does not clip the chip.

---

## 7. Test plan

Component tests use the **existing** jsdom harness: `// @vitest-environment jsdom` docblock on line 1, `@testing-library/react`. **There is no `jest-dom`** — `toBeInTheDocument()` / `toBeDisabled()` are unavailable; assert with `getAttribute`, `textContent`, `querySelector`, `toBeTruthy()` (AGENTS.md §9).

| Layer | Scenarios | Asserts |
|---|---|---|
| **Unit / render** `tests/unit/discovery/render/hero-panels.test.tsx` (extend) | V16 reply head (incl. `1 reply` singular + zero) · V17 bar geometry, figures, 50/50 both-zero · **V17 has NO button/link/handler** (`querySelectorAll("button, a")` inside the bar element is empty; no `onClick`) · V15 image + null placeholder · V13 progression + the exited single-figure case · V10/V11 `YES @ 27%` at the hero preset | §3c no-vote-affordance · INV-3 frozen pole classes |
| **Unit / render** `tests/unit/discovery/render/price-bar-presets.test.tsx` (new) | `hero` 22px/12px labels-outside · `card` 16px/10.5px · **`detail` byte-identical to the pre-change class string** · paired `aria-label` in all three · null-pricing stub in all three | PCT.ROUND pair sums to 100 |
| **Unit / static** `tests/unit/design/side-pole-binding.test.ts` (**new — C0, committed RED with its offender list in the commit body**) | Every side-keyed colour expression under `src/` resolves to a pole-family token · offenders reported `file:line` · **two alive checks** (file count ≥ pinned; side-keyed-expression count ≥ 6, so a vacuous pass is impossible) · comments stripped, so prose about a pole is not a pole · `(admin)/**` excluded with its reason in source | **INV-3** — the whole defect class |
| **Unit / render** `tests/unit/bookmarks/render/side-encoding.test.tsx` (**new — the RED, written and failing FIRST**) | YES chip carries `bg-yes` + `text-no`; NO chip carries `bg-no` + `text-yes`; **`bg-primary` / `bg-secondary` absent from both** · `PositionMarker` renders `aria-label="Author Flipped"` · removed-item variant still renders chip + author head + active un-bookmark and **no body** | **INV-3** |
| **Unit / render** `tests/unit/profile/render/argument-list-side.test.tsx` (**new — C4b, gated on OD-4**) | the same three assertions against `ArgumentList`'s two `SideChip` sites (`:49`, `:59`) | **INV-3** |
| **Unit / render** `tests/unit/discovery/render/surface-states.test.tsx` (extend) | P1 shape on Empty + Error (panel, min-height, msg/sub tiers, single CTA) · copy still equals the imported consts · reload still fires · P7: block count == `DISCOVERY_GRID_SIZE`, `[data-slot="skeleton"]` present, `LOADING_COPY` verbatim | R9 · R8 |
| **Unit** `tests/unit/ui/avatar-sizes.test.tsx` (new) | `xs` → `data-size="xs"` and `size-4` reachable · **`sm` unchanged** (regression guard for `IdentityCluster` ×2 + `ArgProfile`) | V50 twMerge trap |
| **Integration** `tests/server/discovery/hero.test.ts` (extend) | New fields correct against seeded reply-bets, images and positions · **the `JSON.stringify` never-echo sweep extended to EVERY new field** — a removed post's image URL, entry price, reply counts and Support/Counter Dharma must all be absent (`:482-522` pattern) · `content_removed` masks, **`banned_at` does not** (ADR-0021 §4) | **SC-1 both obligations** |
| **Integration** `tests/server/discovery/page-wiring.test.ts` (extend) | **Round-trip count == 1 + 12N before and after** (count statements via a client spy, not call sites) · guard clause 1: `load-debate-view.ts` diff empty · guard clauses 2–3: no field on `DebatePost`/`DebateReply`/`DebateViewModel`/`AuthorIdentity`/`Marker`/`PostSubstrate` | Constraint 1 · ADR-0034 §3b |
| **E2E** | **None** — no Playwright installed (AGENTS.md §1/§9). The visual pass is the founder's, at 1440 desktop. | — |

**Gates.** `ZUGZWANG_ENV=preview just verify` at every commit (bare `just verify` fails the `getRedisKey` build-env gate). Full `pnpm vitest run` **direct, not via `just`** (which points at the cloud DB), against the local Postgres on `:54322` — `docker ps` first; the stack is usually already up. Gate commands run **unpiped to a log + `echo exit=$?`** — never `| tail`, which returns tail's 0. Budget ~35 min for the full suite; run it backgrounded. `just clean` before pushing (stale `.next/types/validator.ts` fails pre-push `tsc`).

**`@test-writer` is NOT invoked.** The kickoff names `@code-reviewer` and `@security-auditor` only, and a kickoff's reviewer sequence is ratified scope — an omission may be a deliberate waiver, so it is not silently added. RED-first is still honoured **by hand** for C4 (the INV-3 fix) and for each Group-2 field. **Flagged here as a PR deviation** for the founder to overrule if `@test-writer` was intended, given C4 touches an invariant.

---

## 8. Out of scope

Named so the overnight run cannot absorb them:

- **ADR-0006-DISCIPLINE in full** — `close-due-markets`, the CI lint, the partition alarm, the ADR-0026 bucket back-reference. ⚠ **The unpushed local commit `1b7f37f` is part of this.** Branch from `origin/main`; do not carry it.
- **Anything from the post-audit relay.**
- **PD-2-26 / V45** — `--elev-*` absent from discovery. Open in the register, **not in this kickoff**. Do not fix while adjacent.
- **PD-0-01** — `<Plus /> Full` vs the ratified `Read more` text link.
- **PD-0-10's other sites** — ⚠ **partially reclassified.** `profile/ArgumentList.tsx`'s hand-rolled **SideChip** carries the same live inversion and is now **C4b, gated on OD-4** (the C0 guard reddens on it, so it cannot be left out and have an honest guard). `(admin)/…/ReviewFeed.tsx:102-104` **stays out**: its mapping is *correct*, so it is duplication not inversion, and consolidating admin chrome onto a participant primitive is an admin-surface decision. Under OD-4 Option A, `ReviewFeed` is the **one** surviving side-chip implementation after this PR.
- **`/m/[slug]` and `/bookmarks` visual reconciliation** — POLISH.3 / POLISH.6. This task touches those files only where a shared primitive or the INV-3 fix requires it, and pins the default so their pixels do not move (except C4, which is the point).
- **The `detail` PriceBar preset's own numbers** (d5 14px/10px) — POLISH.3's row. See OD-2.
- **Batching / query consolidation.** PERF-1 cleared the exit bar by 2.9× without it and it was explicitly dropped. `+0 queries` here is a ceiling, not an invitation to optimise.
- **No DDL, no migration, no new event type, no ADR, no SPEC edit.** The only doc edits are `design-canon.md` + the values-log, both in C10, both R8/R9 consequences.
- **Responsive work.** Desktop **1440 only** (G1).
- Correcting AGENTS.md's "1 + 3N … a further 2N" round-trip figure (calls, not statements — true count 97). A one-line doc fix; belongs to the close-out sweep, not here.

---

## Corrections to carry — NOT this PR

Recorded here so they are not lost and not absorbed. Each has a named owner elsewhere.

**CC-1 · `POLISH-register.md` PD-2-21 names a non-consumer and omits the real one.** The row's Root-cause cell reads *"`PriceBar` is consumed by `MarketHeader.tsx` and `chart/MarketPriceChartCard.tsx` — both `/m/[slug]`"*. `MarketPriceChartCard.tsx` does **not** import or render `PriceBar` (it imports `MarketPriceChart` + `formatPercentUnpaired` and renders its own `sr-only` readout). And the row **omits `discovery/MarketCard.tsx:68`**, which *is* V30's 16px card consumer. Correct the row to: `MarketHeader.tsx:96` (`/m/[slug]`) · `HeroPanels.tsx:78` (V29) · `MarketCard.tsx:68` (V30). **Owner:** the register sweep. **Why it matters:** the row as written sends a build session to a file with nothing to change and past the one that mattered — the same failure mode as PD-2-29's own recorded correction.

**CC-2 · `POLISH-register.md` PD-2-31's round-trip figure has a third form worth pinning.** The row correctly records *"the true count is **97**"*. This plan derives 97 independently from source as **`1 + 12N` at N=8** (§3a), which is the reusable form — a count that survives `DISCOVERY_GRID_SIZE` changing. `AGENTS.md`'s Discovery warning still says *"1 + 3N … a further 2N"*, which counts **calls**. **Owner:** the register / AGENTS.md sweep. One line each.

**CC-3 · `1b7f37f` is UNPUSHED and did NOT land in #309.** `docs(adr): ADR-0006 §4 — back-reference ADR-0026's third R2 bucket` is on the local `chore/post-perf-1-docket` only; `git merge-base --is-ancestor 1b7f37f origin/main` returns false. It belongs to **ADR-0006-DISCIPLINE**. *(This plan has recorded it that way since first draft — see the Context section: "two commits that are not on main: `746a469` (the pre-squash of #309 — already landed as `0983d99`) and **`1b7f37f` … which is UNPUSHED and belongs to ADR-0006-DISCIPLINE**." The relay truncated at Pushback item 3, above where that reads.)* **Owner:** ADR-0006-DISCIPLINE. **Action for this PR:** none beyond having branched from `origin/main`, which is what keeps it out.

**CC-4 · `POLISH-register.md` PD-0-10's root cause is broader than its row.** The row reads *"Three `PositionMarker` implementations… Side chips likewise hand-rolled"*. The survey establishes the side-chip half is not cosmetic duplication — **two of the three hand-rolls invert the pole on live participant surfaces** (`BookmarkCard.tsx:91`, `ArgumentList.tsx:96`), and the third (`ReviewFeed.tsx:102-104`, admin) is correct. Re-class the side-chip half from `V` to **`F` functional**, and note that C0's guard closes the class. **Owner:** the register sweep, after this PR lands.

---

## Open decisions — founder-owned, surfaced not asked

Per the ratified relay model these are recorded here for web review rather than raised in-session; an in-CLI question would short-circuit the review path.

**OD-1 · V13's two numbers — are they commensurable?** *(blocks C8 only)*
- **Option A · episode parity.** Both numbers episode-scoped, as `BookmarkCard` does. Correct and consistent with the shipped Đa/Đb semantics, but the left number **changes from today's `authorStake`** (a visible regression on a surface about to be inspected), and it needs `bets` + `events`/`bet.sold` → **+2 reads**, batchable to O(1) at the page but **not +0**. Sizing: **L**.
- **Option B · post-anchored (recommended).** Left stays `authorStake` (unchanged), right = the author's held-side value via `computeSell`. **+0 queries**, no episode walk, no parity liability. Cost: the pair is post-scoped vs market-scoped and disagrees for a multi-bet author. Sizing: **M**.
- **Option C · defer.** C5–C7 land; V13 becomes its own task with OD-1 as its first question.
- **Resolve with:** founder ruling at plan ratification. **If unresolved when the run opens, C8 is not built** and the run proceeds through C7 + Group 3.

**OD-2 · Does `MarketHeader`'s PriceBar keep today's geometry?**
- **Recommended: yes** — the `detail` preset pins the current render, `/m/[slug]` has a zero pixel delta, and reconciling to d5's own 14px/10px is POLISH.3's row.
- **Alternative:** apply d5's 14px/10px now. The kickoff *does* pre-accept touching `/m/[slug]`, so this is permitted — but it spends POLISH.3's decision without POLISH.3's inspection.
- **Resolve with:** this plan's ratification. Default if silent: recommended.

**OD-3 · Is `@test-writer`'s absence a waiver?** C4 touches INV-3. The named sequence is `@code-reviewer` → `@security-auditor`. Proceeding as a waiver with hand-written RED-first tests unless corrected. **Resolve with:** plan ratification.

**OD-4 · The pole inversion is on TWO surfaces. Does C4b land here?** *(blocks C4b, and determines whether C0 can be honestly green)*
The kickoff scoped `/bookmarks` in and put "PD-0-10's other **PositionMarker** sites" out. But `profile/ArgumentList.tsx:96` is not only a PositionMarker site — it is a **SideChip** site carrying the identical `default`/`secondary` inversion, live on `/u/[pseudonym]`. The C0 guard reddens on it by construction.
- **Option A · fix both (recommended).** Add C4b. Identical one-line adoption of the same primitive. C0 goes green on real correctness. Cost: ~15 lines on POLISH.5's surface, which the kickoff did not open. Also collapses PD-0-10 from three implementations to one (`ReviewFeed`, admin, correct).
- **Option B · guard with a dated exception for `ArgumentList.tsx`.** C0 lands green, `/bookmarks` is fixed, `/u/[pseudonym]` keeps rendering YES as near-white. **Not recommended:** a guard whose allowlist contains a known live inversion is the antipattern the guard exists to prevent, and PD-0-10's row would read `pending` while the register says the root cause is primitive duplication.
- **Option C · guard is RED-listed and left failing.** Rejected — a knowingly-red suite on `main` trains everyone to ignore it.
- **Resolve with:** founder ruling at plan ratification. **Default if silent: Option A**, because Option B requires the founder to accept a divergence and only the founder may do that (POLISH-0 §5 P12) — so silence cannot authorise it.

---

## ADRs needed

**None.** Nothing here changes a CLAUDE.md default, commits to a vendor, or sets a pattern another module must copy. The two decisions that *look* ADR-shaped are already governed: R8/R9 land as a **canon amendment** (design-canon + values-log, C10) because the canon — not an ADR — is the authority for the state-primitive kit; and the shared-primitive preset pattern is the **already-shipped** `StatLine` convention, not a new one. ADR-0034 is **cited and proven**, not amended. Next free ADR number stays **0037**.

---

## Overnight execution mode

**Ultracode / dynamic workflows: PERMITTED for C2, C9, C10 only. FORBIDDEN for C0, C1, C3, C4, C4b, C5, C6, C7, C8.**

**C0 and C4b are added to the FORBIDDEN list.** C0 is *definitionally* an ordered proof obligation — a RED that must be captured before any fix exists — which is the exact condition-4 exclusion CLAUDE.md §6 names. C4b is downstream of that same RED.

Checked against CLAUDE.md §6's four conditions rather than accepting the kickoff's grant wholesale:

| Condition | C2 · C9 · C10 | C1 (PriceBar) | C3 · C4 · C5–C8 |
|---|---|---|---|
| Off critical paths, no DDL/migration | ✅ `src/components/**` + docs | ✅ | ✅ but read-model / invariant |
| Fully reversible, no published artifact | ✅ | ✅ | ✅ |
| ≥3 genuinely independent parallel units | ✅ Avatar · states · P7+canon | — single file + 3 call sites | — sequential dependency chain |
| **No ordered proof obligation** | ✅ | ❌ **`detail` requires a before/after zero-delta baseline** | ❌ C4 is RED-before-fix; C5–C8 each carry the §3b guard + the extended masking sweep |

**Therefore:** the kickoff grants "the geometry half of GROUP 1" — I am **narrowing** that to C2 (Avatar) and excluding **C1 (PriceBar)**, because pinning `detail` byte-identical *is* a before/after baseline, which trips condition 4. C1 is small (one primitive, three call sites) and runs in the ordinary sequential lane. Flagged rather than assumed; overrule at ratification if the baseline is considered incidental.

**Reviewers — inside the run, sequentially, one DB-touching reviewer at a time** (concurrent subagent `pnpm vitest` saturates local PG and manufactures "Hook timed out" flakiness):
1. `@code-reviewer` after **each** of C3, C4, C5, C6, C7, C8 — directed scope naming the exact diff and the §3b guard clauses. A generic scope has previously missed a fail-open.
2. `@security-auditor` after `@code-reviewer` passes on Group 2 — scoped to the **ADR-0034 boundary** and **SC-1**.
3. **Both must answer as SEPARATELY-STATED POINTS, never a bare PASS.** Required, each addressed individually: (a) the three-clause ADR-0034 guard, per clause; (b) whether any added field is viewer-scoped; (c) whether a removed post's body, author, image URL, entry price or aggregate can reach a DTO on any path — **SC-1 obligation (1), and specifically whether any read wider than `pickedIds` now touches a body or an image id**; (d) the round-trip count before/after; (e) whether V17 exposes any interactive element; (f) whether any Đ or percentage value passes through a JS float; (g) **whether any side-keyed expression resolves to a non-pole colour, and whether C0's allowlist grew during the run** (it must not — halt item 14). A bare PASS is re-run with directed scope; a second bare PASS is halt item 7.
4. **Pass `@docs/plans/DISCOVERY-COMPLETE.md` on every invocation** — subagents start from zero context.
5. **Launch from a worktree at `origin/main`.** Agent definitions load from the session's working directory **at launch** and are not hot-reloaded; a tree on a branch predating a repin runs stale pins, and a subagent dying at 0 tool_uses is that symptom.

**HALT LIST — these stop the run rather than proceeding:**

1. **The BookmarkCard inversion does not reproduce** — a cascade layer, a `.dark` application, or a className defeats the variant resolution. **Do not "fix" a non-bug.** Report the defeating layer and stop C4.
2. **`load-debate-view.ts` needs any diff** — including a one-word `export` to reach `mintImageUrls`. Guard clause 1 is binding; stop and surface.
3. **Any Group-2 item cannot be done at +0 new per-market queries.** Stop *that item*, land the others, report the true delta.
4. **OD-1 unresolved** ⇒ C8 not built (not a halt for the rest).
5. **`tests/unit/design/tokens-monochrome.test.ts` goes red** — a new colour token or a changed hex. No new colour token is in scope.
6. **Any DDL, migration, new `EVENT_TYPES` value, ADR, or SPEC edit turns out to be required.**
7. **A required reviewer returns a bare PASS twice.**
8. **`just verify` or the full suite red at a commit boundary** — stop at that boundary, do not stack commits on red. **One declared exception, and only one:** C0 is committed RED by design, and stays red until C4 (+ C4b under OD-4 Option A) green it. Its RED output must be **captured before any fix is written** and pasted into C0's commit body. Any *other* red, and any red still present at the PR head, is a halt.
9. **A mockup colour token is about to be ported by NAME where it encodes a SIDE** (`bg-ink` for a YES fill, `border-ink` on a bar). Stop — that is the C4 defect class reproducing.
10. **Scope creep** into PD-2-26/V45, PD-0-01, PD-0-10's other sites, or ADR-0006-DISCIPLINE.
11. **`git rev-parse --verify` shows the branch name already exists** — a colliding `checkout -b` is a no-op that silently leaves HEAD on `main` and lands the next commit there. Assert `git branch --show-current` after.
12. **A second `vitest` runner is detected** (`ps`) — concurrent runs truncate each other's fixtures into a false RED of ~94 failures in untouched suites. Do not believe any red without checking.
13. **Pool reserves, a position quantity, or any other internal row value is about to land on `DiscoveryCard` / `DiscoveryMarketView`** (C8). Those cross to the `"use client"` carousel. Server-local only.
14. **C0's guard finds an offender NOT in its predicted list** (`BookmarkCard.tsx:91`, `ArgumentList.tsx:96`). A third inverted site means the survey was incomplete — stop and report it rather than widening the allowlist to make the suite green. Widening an allowlist to silence a guard is the failure the guard exists to prevent.
15. **C0's guard is green on first run.** It must be RED. A green first run means the predicate is wrong (most likely `stripComments` eating live code, or the side-keyed matcher missing the `variant={…}` form) — a vacuous pass, the POLISH.1 z-index failure. Stop and fix the predicate before writing any fix.
16. **A body, teaser, or `image_uploads_id` is about to be added to the `ordinalRows` read** (`hero.ts:115-121`). That read deliberately spans **all** top-level comments including removed ones and must select `id` only — widening it is SC-1's minting scenario reproduced in this file (§1a).

**Per-commit close:** `ZUGZWANG_ENV=preview just verify` unpiped → `echo exit=$?`. **Pre-PR:** full `pnpm vitest run` direct, backgrounded, `just clean`, then §5.9's session log at `docs/logs/DISCOVERY-COMPLETE.md` in its **own commit before the PR**. Multi-line commit messages via `git commit -F /tmp/discovery-complete-msg.txt` (never multi-line `-m`; never a `Co-authored-by` trailer). §5.10's pre-PR self-audit is **not** required (non-critical-path) but the §3b guard clauses and the round-trip count are verified item-by-item regardless.

---

## Honest size estimate

| Group | Commits | Size | Note |
|---|---|---|---|
| **1 · Primitives** | **C0**, C1–C4, **C4b** | **L** (was M–L before the guard) | 3 primitives + 4 consumer files + a static guard + the INV-3 fix **on two surfaces**. C0 is the ordered obligation (RED before fix); C4/C4b are each a one-line-per-site adoption once the RED is captured. The guard is what makes this group L rather than M — and it is the highest-leverage thing in the PR, because it forecloses the class for POLISH.3/.5/.6. |
| **2 · Hero read-model** | C5–C8 | **M** at +0 queries (**L** if OD-1 = Option A) | C5/C6 are near-pure plumbing. C7 is a join + a presign, and carries the SC-1 obligations. C8 is the only real thinking, and it is gated. |
| **3 · States** | C9–C10 | **M** | Mostly mechanical; the canon amendment is the substance and must not be rushed. |
| **Total** | **12 commits, 1 PR** (10 if OD-4 = B and OD-1 ≠ B) | **L** | Realistically a full overnight run. ~16 source files + 2 docs + ~9 test files. If the run must be cut, **cut C8 first** (gated anyway), then C10's P7 code. **Never cut C0, C4 or C4b** — the guard and the two fixes are one unit; landing the guard without the fixes leaves a red suite, and landing the fixes without the guard leaves the class open. **Never** separate the canon amendment from its code. |

---

## Self-critique

| # | Severity | Finding | Resolution |
|---|---|---|---|
| 1 | **high** | I initially accepted the kickoff's V13 "sized L" and was going to recommend deferral. Reading `list.ts:55` (Open-only ⇒ no settlement) and `market-pricing.ts:52-77` (the shipped one-read-plus-a-field precedent) collapses it to +0 queries. | Rewritten as §6 with both grounds; **OD-1** carries the part that is genuinely the founder's. |
| 2 | **high** | The kickoff names `MarketPriceChartCard.tsx` as a `PriceBar` consumer and omits `MarketCard.tsx`. Building to the kickoff would have missed V30's actual 16px consumer. | Pushback §1, corrected table, C1 built to it. |
| 3 | **high** | I nearly planned V11's geometry as a primitive-wide change. d5 and Profile specify *different* numbers for the same chip classes — it would have imported Discovery's px onto two un-inspected surfaces. | Pushback §2; preset-with-pinned-default on all three primitives. |
| 4 | **high** | Porting `.bar .fill{background:var(--ink)}` and `.sidechip.yes{background:var(--ink)}` by token name would have **reproduced the exact BookmarkCard inversion** — the mockups are light-theme, `--color-ink` is `#fafafa`. | Pushback §3 as a task-wide rule; halt item 9. |
| 5 | **medium** | V15's natural implementation is to reuse `mintImageUrls`, which is module-private — exporting it breaks the zero-line-diff guard. Not obvious until the guard is read against the code. | C7 uses a LEFT JOIN + the already-exported `signRead`, precedent `media.ts:40-63`. Halt item 2 names the trap. |
| 6 | **medium** | Group 2 edits a read over `comments`, so **SC-1 fires** — the kickoff does not mention it. Row-level masking already holds, but V15 adds a *new* leakable field (an image URL). | §1 SC-1 paragraph; the extended `JSON.stringify` sweep is a named test-plan line, not an afterthought. |
| 7 | **medium** | The kickoff grants ultracode for "the geometry half of GROUP 1", which includes C1 — but C1's `detail` preset needs a before/after baseline, tripping §6 condition 4. | Narrowed to C2 + Group 3, stated as a deviation to overrule rather than silently obeyed or silently widened. |
| 8 | **medium** | The working tree is **not** at `origin/main` and carries an unpushed **out-of-scope** ADR-0006 commit that a `checkout -b` from HEAD would drag into this PR. | Called out at the top and in §8; halt item 11 guards the branch creation. |
| 9 | **low** | R9/R8 collide with W2.11's *Killed by ruling* line, which also killed **empty-Discovery** and **T2 per-surface error panels** — leaving the register self-contradictory if unaddressed. | C9's note + the canon amendment's second clause make the supersession explicit. |
| 10 | **low** | The register cites `HeroPanels.tsx:112` / `:127` / `:128-130`; the live file has those at `:117` / `:136` / `:137-139` (drift since the V18/A5 comments landed). | Every reference in this plan is to **live** line numbers, verified this session. **O-2.** |
| 11 | **low** | "Verify the inversion renders" cannot be fully discharged: jsdom does not evaluate the `@theme` cascade, and `/bookmarks` is auth-gated so a browser proof needs a staging session. | Stated as an explicit limit in C4 rather than quietly claimed as observed. **O-3: a true finding reported with a misleading cause is a defect.** |
| 12 | **HIGH — found while specifying the C0 guard** | The pole inversion is on **two** live participant surfaces, not one. `profile/ArgumentList.tsx:94-97` is a byte-identical clone of the BookmarkCard defect, rendered twice (`:49`, `:59`) and mounted at `(public)/u/[pseudonym]/page.tsx:95`. The kickoff scoped only `/bookmarks` in. **The guard cannot be honestly green while it exists**, which is precisely how the guard earned its keep before a line of it was written. | New **C4b**, gated on **OD-4** with Option A recommended. Not silently absorbed — the kickoff put the adjacent row OUT, so it needs ratification. |
| 13 | **high** | The kickoff's literal guard phrasing — "no file outside `badges.tsx` maps a side value to a colour class" — would go RED on **six legitimate files** on the day it landed: `ReplySplitBar`'s correct pole derivation, `PriceBar`'s proportion segments, and the four graph-family files. A guard that reddens on correct code gets suppressed within a week. | C0 sharpened to the actual defect class — *a side value resolved to a colour through a **non-pole** token (semantic variant or neutral ramp)*. Both routes the founder named are instances; the six legitimate files are enumerated as a **closed, counted** inventory. Precedent for sharpening is the footer ban's own comment. |
| 14 | **medium** | I nearly wrote the guard without an alive check. A regex sweep that matches nothing passes vacuously — the recorded POLISH.1 z-index failure. | **Two** alive checks in C0 (file count **and** side-keyed-expression count ≥ 6), plus **halt item 15**: a green first run is a halt, not a pass. |
| 15 | **medium** | The `ordinalRows` read at `hero.ts:115-121` deliberately spans **all** top-level comments **including removed ones**. Adding `body` or `image_uploads_id` there while implementing V15 would reproduce SC-1's exact minting scenario — a second, unfiltered body-read path in the same file. Not obvious from the diff C7 describes. | Named in §1a as the specific hazard and as **halt item 16**. |

---

## References

- `CLAUDE.md` §1 (critical paths) · §2 (INV-2/INV-3, no JS floats) · §3 (no vote affordance) · §5.3 surgical · §5.12 same-commit ADR/canon · **§5.14 SC-1** · §6 ultracode conditions · §8 O-1/O-2/O-3
- `AGENTS.md` §6 (schema/append-only) · §8 (branded dark tokens, "never copy by lightness") · §9 (jsdom harness, no jest-dom)
- `docs/adr/0034-viewer-scoped-debate-reads.md` **D-1** (`:62`) — cited and proven, not amended
- `docs/adr/0017` / `0018` — reply-as-bet; Support/Counter as read-time aggregates
- `docs/polish/POLISH-register.md` PD-2-20…PD-2-30, PD-0-10 · `docs/polish/POLISH-0.md` §4/§5, P12
- `docs/design/mockups/surface_discovery_v1_0.html` — `:45-47` tokens · `:84` avatar · `:86-88` argstake · `:91-93` argimg · `:94-98` replyhead · `:99-117` barrow/blab2/sidechip · `:175-265` hero markup
- `docs/design/mockups/surface_d5_v1_0.html` `:505-519`, `:538-545` · `surface_profile_v1_0.html` `:278-281` — the per-surface geometry that forces presets
- `docs/design/mockups/DESIGN_W2_11_state-kit_mockup-v0_1.html` `:79-87` (P1), `:178-215`, `:463` · `DESIGN_W2_11_CLOSE-OUT.md` `:29`, `:48`
- `docs/design/design-canon.md` `:32`, `:146`, `:177-197` (the §10 amendment precedent), `:215` · `ZUGZWANG-BRAND_agenda-and-values-log_v0_3.md` §3 item 5
- `docs/parked.md` §PERF-1 (closed) + N6 (Layer-2, out of scope) · `docs/logs/POOL-1.md` §6
- Plan template: `docs/plans/_template.md`
