# HTML-FINISH · BOOKMARKS — layout parity with Profile

**Branch** `htmlfinish/bookmarks-parity` · **base** `origin/htmlfinish/profile-parity` @ `ae06eea` ("Merge remote-tracking branch 'origin/main' into htmlfinish/profile-parity") · **PR** draft, base `main`, stacked on #337.

---

## §0 · Gate — read live, never from a tracker cell, close-out, plan or memory

| Reading | Value |
|---|---|
| base `origin/htmlfinish/profile-parity` | `ae06eea5fadb1a1e410b57627c4295144cd847eb` |
| this branch at start | `ae06eea…` — **0 ahead / 0 behind** the base |
| porcelain at start | clean |
| `pgrep -f 'node.*vitest'` | none |
| `pnpm install --frozen-lockfile` | exit 0 (fresh worktree: no `node_modules`, no `.env.local`) |

⛔ **No real `.env*` was read, copied or written.** The gate runs under the placeholder env `tests/_setup/env.ts` already ships (its lines 8–38, byte-carried into a scratchpad runner), with `ZUGZWANG_ENV=preview` per AGENTS.md §2. The first baseline attempt failed `EXIT=1` on `DATABASE_URL is not set` — the known fresh-worktree case — and that is an env fact, not a regression; with the placeholders the baseline is `EXIT=0`.

### Halt conditions — none fired

- **0.1 POLISH.6 merged on `origin/main`.** ✅ **PR #336**, MERGED, squash SHA **`ea1795e8e69d6937bfbde2d7ef301de261133b7d`**, read from `gh pr list --state all` — and `origin/main` is at exactly that SHA. `POLISH-TRACKER.md` was not consulted.
- **0.2 This branch carries #337's wide preset AND the finished height chain.** ✅ The branch IS #337's head (`gh pr view 337` → `htmlfinish/profile-parity@ae06eea…`, OPEN, not draft).
  - **Preset, named:** `wide` — `mx-auto w-full max-w-[1440px] px-6 py-6` (`src/components/shell/PageContainer.tsx:69`), the fifth preset, minted additively.
  - **Chain, quoted** (`tests/unit/design/profile-height-chain.test.ts:19-25`):
    ```
    <main>            min-h-[calc(100vh-60px-2px)] flex-1 flex-col   ← the SOURCE
    PageContainer     flex-1 min-h-0 flex-col       ← takes the floor, passes it on
    headzone band     (no flex-1)                   ← deliberately does NOT grow
    arena band        flex-1 min-h-0                ← the growing element
    both panels       min-h-0 flex-col              ← may be shorter than content
    both panel bodies flex-1 min-h-0 overflow-y-auto ← where the scroll happens
    ```
- **0.3 Open PRs touching `src/components/bookmarks/**` or `src/app/(public)/bookmarks/**`.** ✅ None. Open PRs are **#337** (14 files: profile, PageContainer, canon, tests) and **#335** (`CLAUDE.md` only). Neither names a bookmarks path.

### Live ceilings — each read directly (O-2), never counted from a document

| Register | Ceiling at head | How read |
|---|---|---|
| ADR | **0036** (`0036-vitest-context-operational-runners.md`) | highest number in `ls docs/adr/`, not the file count (34) |
| SPEC.1 | **1.0.30** | `docs/specs/SPEC.1.md:15` |
| SPEC.2 | **1.0.22** | `docs/specs/SPEC.2.md:14` |
| migration head | **`0024_bookmarks`** | highest in `drizzle/migrations/` |
| V- | **V-10** | `POLISH-0_data-manifest.md:226` states it in terms: *"High-water read off this register at head: `V-10`"*, and explicitly refuses to number the row below it |
| O- | **O-8** | `CLAUDE.md` §8. ⚠ #335 is OPEN and mints `O-9`; it is **not** on `main`, so the ceiling at head is 8 |
| PD-6- | **PD-6-06** | `docs/plans/POLISH-6.md`, `docs/polish/POLISH-register.md` |
| `ls tests/unit/design/` | avatar-ring-token · discovery-height-chain · emphasis-ladder-tokens · no-raw-dharma-render · no-raw-hex-view-layer · pct-round-render · profile-height-chain · side-pole-binding · tokens-monochrome — **9 files, now 10** |

---

## §1 · Recon

### 1.1 Every component `/bookmarks` renders, from the route file down, by path

Read from **return statements**, not docblocks.

```
src/app/(public)/bookmarks/page.tsx          (RSC, default export)
├─ @/components/shell/PageContainer          preset="reading" className="flex flex-col gap-4"
├─ <h1>Bookmarks</h1> + @/components/ui/badge (variant="outline") "Your bookmarks"   ← page-level header row
├─ items.length === 0 → @/components/ui/empty-block   (P1 leaf; msg + sub)
└─ else  div[data-testid=bookmark-list]
   └─ @/components/bookmarks/BookmarkCard  × N
      ├─ removed arm → @/components/ui/card
      │  ├─ @/components/debate/badges     SideBadge(side, size="profile")   ⛔ no price on this arm
      │  ├─ AuthorHead (file-private span) "by {authorPseudonym}"
      │  ├─ @/components/bookmarks/UnbookmarkButton  ("use client"; @/components/ui/button, lucide Bookmark)
      │  └─ @/components/debate/placeholders REMOVED_STUB_TEXT
      └─ present arm → @/components/ui/card
         ├─ SideBadge(side, size="profile", price=priceAtBet)
         ├─ PositionMarker(marker)                    (returns null for "none")
         ├─ AuthorHead
         ├─ UnbookmarkButton
         ├─ next/link → /m/{marketSlug}?post={ordinal}   (the title)
         ├─ kind==="reply" ∧ repliedToTitle !== null → "Replied to …"
         ├─ kind==="post" → Support/Counter running text (@/components/debate/format formatDharma)
         └─ "Staked Đ … · Current Đ …"
src/app/(public)/bookmarks/loading.tsx  → PageContainer(reading) → @/components/bookmarks/states BookmarksLoading → ui/loading-block × 3
src/app/(public)/bookmarks/error.tsx    → PageContainer(reading) → ui/error-block
```

### 1.2 What POLISH.6 shipped

**PR #336**, squash `ea1795e`, five commits, seven files. `src/server/**` untouched; no schema, no migration, no read model.

| # | Item | Where it landed |
|---|---|---|
| 2 | figures column reads `Current`, not `Value` | `BookmarkCard.tsx` |
| 3 | both `SideBadge` sites adopt the `profile` preset | `BookmarkCard.tsx` (+ the census in `tests/unit/debate/render/side-badge.test.tsx`, admitted as allow-list row 8) |
| 1 | live side chip renders the entry price (`YES @ 38%`) | `BookmarkCard.tsx` — a PROP PASS; no formatting at the call site |
| 4 | empty state adopts `ui/empty-block.tsx` (P1) | `page.tsx` |
| 5 | loading state adopts `ui/loading-block.tsx` (P7) | `components/bookmarks/states.tsx` |
| 6 | error boundary adopts `ui/error-block.tsx` (family) | `app/(public)/bookmarks/error.tsx` |

**Copy constants:** exactly one — `BOOKMARKS_EMPTY_COPY = { msg: "No bookmarks yet.", sub: "Saved arguments will appear here." }`, exported from `page.tsx`. **Tests:** `tests/unit/bookmarks/render/surface-states.test.tsx` (297 lines, the three states) and `side-encoding.test.tsx` (130 lines, `BookmarkCard` direct). **Guards it rides:** the `SideBadge` tree census (exact per-file map, `BookmarkCard.tsx: 2`), `side-pole-binding`'s `PERMITTED_FILES` (from which `BookmarkCard.tsx` is deliberately ABSENT), `pct-round-render`'s exact allow-marker count of 3.

### 1.3 ⚠ THE BOOKMARKS DTO — every field the read model returns

`loadBookmarks(client, { viewerId }): Promise<BookmarkItem[]>` — `src/server/bookmarks/list.ts:99`. `BookmarkItem` (`:43-53`) is `ProfileArgumentItem` (four variants) **intersected with** `{ authorPseudonym }`, and the two present variants additionally with `{ staked, current }`.

**Four variants. Every field, named.**

| | removed post | removed reply | present post | present reply |
|---|---|---|---|---|
| `removed` | `true` | `true` | `false` | `false` |
| `kind` | `"post"` | `"reply"` | `"post"` | `"reply"` |
| `id` | ✓ | ✓ | ✓ | ✓ |
| `side` (`side_at_post_time`, INV-3 frozen) | ✓ | ✓ | ✓ | ✓ |
| `marketSlug` | ✓ | ✓ | ✓ | ✓ |
| `marketTitle` | ✓ | ✓ | ✓ | ✓ |
| `ordinal` | ✓ | ✓ | ✓ | ✓ |
| `createdAt` | ✓ | ✓ | ✓ | ✓ |
| `aggregate` `{supportCount, counterCount, supportDharma, counterDharma}` | ✓ | — | ✓ | — |
| `title` | — | — | ✓ | ✓ |
| `teaser` | — | — | ✓ | ✓ |
| `body` | — | — | ✓ | ✓ |
| `marker` (`Marker`) | — | — | ✓ | ✓ |
| `authorStake` | — | — | ✓ | — |
| `stake` (the reply ruler) | — | — | — | ✓ |
| `priceAtBet` | — | — | ✓ | ✓ |
| `repliedToTitle` (`string \| null`) | — | — | — | ✓ |
| `authorPseudonym` | ✓ | ✓ | ✓ | ✓ |
| `staked` (Đa) | — | — | ✓ | ✓ |
| `current` (Đb) | — | — | ✓ | ✓ |

**That is the whole list. Nothing else crosses.** Three measurements about it are load-bearing for §1.6:

1. **`staked`/`current` are the bookmarked AUTHOR's figures, not the viewer's** — and they are `0.000000000000000000` unless that author currently holds a position **on the card's frozen side S** (`src/server/bookmarks/figures.ts:99-102`: `if (held === undefined || held.side !== side) return { staked: ZERO, current: ZERO }`).
2. **There is no viewer position anywhere on the DTO** — no `quantity`, no `statusLabel`, no `marketStatus`, no `settled`, no `sellEligible`, no owner flag. `BookmarkCard.tsx:16-18` already states the consequence: *"NO Sell mount ever — the DTO carries no owner field, so a Sell affordance is structurally impossible here."*
3. **There is no author PFP.** `resolveAuthors` supplies `pseudonym` only; Profile's avatar comes from `ProfileUser.pfpUrl`, which this read model never produces.

### 1.4 ⚠ C-BOOKMARKS-1, quoted verbatim from `docs/design/design-canon.md` at head

> ### C-BOOKMARKS-1 · The `/bookmarks` fork is an accepted divergence — §3 item 9 is satisfied by mode-of-the-CARD, not mode-of-the-SURFACE
>
> **Ruled 2026-08-14 IST at POLISH.5/.6 commit 0.** `BOOKMARKS` is a new topic under the `C-<TOPIC>-<n>` form ruled at §10's head on 2026-08-12, and this is its first member. Measured at this commit, §10 carried `CHART` and `STATES` and no surface/bookmarks topic.
>
> Three tiers say *reuse the profile surface in forced-visitor mode*, and `design-canon.md` §3 item 9 puts *"not a fork"* inside the invariant spine. The build renders `PageContainer` → `<h1>` + `<Badge>` + a card list.
>
> **The divergence is ACCEPTED. §3 item 9 is satisfied by mode-of-the-CARD, not mode-of-the-SURFACE.**
>
> **Grounds — three, independent:**
>
> 1. **The DTO difference is structural, not incidental.** `BookmarkItem` is **author-keyed** (ADR-0032 D-5: each item shows the bookmarked author's Đa/Đb and marker, never the viewer's). `ProfileArgumentItem` is **viewer-keyed**. These are different read models, not two renderings of one.
> 2. **Mode-of-the-surface would be wrong on its face.** It would put an identity card, six wallet tiles and a Dharma graph on a route that spans **many** authors — attributing one person's figures to a list of other people's arguments.
> 3. **The tier-4 artifact anticipates the divergence in its own comment:** *"Mockup reuses the demo rows; production loads the user's bookmarked posts/replies here."* The shell's `FRAMES.bookmark = 'profile'` is **source reuse in a mockup**, not a specification that bookmarks carries profile's chrome.
>
> ⚠ **SCOPE — this row ratifies the CURRENT build and nothing beyond it.** A founder ruling of **2026-08-13** directs `/bookmarks` toward the Profile page's structure **before go-live**, under its own surface spec. **This row records why the fork is not a defect today. It does not fix, freeze, or forbid the surface's future shape.**

**VERDICT: it does NOT foreclose, and this round proceeds.** The SCOPE rider says so in terms, and it names the 2026-08-13 founder ruling that directs `/bookmarks` toward the Profile structure — i.e. this task.

⚠ **But ground 2 is load-bearing on §1.6 and is reported, not absorbed.** It states that an identity card, six wallet tiles and a Dharma graph on this route would be *"wrong on its face."* That is a canon-recorded ground, independent of the DTO measurement, reaching the same verdict for the whole top band. **Two independent reasons, one answer.** ⛔ Ground 3 additionally strikes the tier-4 shell's `FRAMES.bookmark = 'profile'` as *"source reuse in a mockup"* — consistent with this round's own exclusion of `DESIGN_integration-shell_v1_0.html` (canon §8 keeps it PK-only; §8 row 16: *"🔒 v1.0 — **PK-only by rule**"*, ✕ stays PK).

### 1.5 The mockup's bookmark mode, verbatim

`docs/design/mockups/surface_profile_v1_0.html` (canon §8 row 3, `🔒 v1.0 (blob-verified output)`, ✅ in-repo).

`:203`
```
  body.bookmarks #bmgo{color:var(--ink);background:var(--n1);}   /* active state on the bookmark page */
```

`:690`
```
      if(document.body.classList.contains('bookmarks')) return;   /* bookmark mode is locked to visitor */
```

`:762-771`
```
    /* Bookmark page = this same blob, entered via setsub:'bookmark'. It is the visitor view
       (Open, never Sell) with the list titled "Bookmarks". (Mockup reuses the demo rows;
       production loads the user's bookmarked posts/replies here.) */
    else if(d.type==='setsub' && d.sub==='bookmark'){
      document.body.classList.add('bookmarks','visitor');
      var t=document.querySelector('.chttl:not(.mkt)'); if(t) t.textContent='Bookmarks';
      var vc=document.getElementById('viewchip'); if(vc) vc.textContent='Your bookmarks';
      if(typeof closeSell==='function') closeSell();
      if(typeof refresh==='function') refresh();
    }
```

**Exactly which properties bookmark mode mutates, and nothing more — four:**

1. **`.chttl:not(.mkt)`.textContent → `Bookmarks`.** Resolved: `:457` `<span class="chttl">Positions</span>` — **the LEFT panel's header title**.
2. **`#viewchip`.textContent → `Your bookmarks`.** Resolved: `:425` — and `#viewchip` lives in **`.nav > .navright`**, the GLOBAL HEADER, not the page body.
3. **body classes `bookmarks` + `visitor`** — the visitor lock, reinforced at `:690` (the `V` key toggle returns early), so Sell is unreachable.
4. **`:203`** — the nav bookmark button `#bmgo`'s active-state **colour/background**. ⛔ A **VALUE**, and refused under §4: `var(--ink)` / `var(--n1)` are the light prototype's ramp; the shipped system is inverted dark true-neutral.

⛔ **Nothing else.** No layout property, no width, no breakpoint, no filter, no column.

**The filter label — measured, not assumed.** `#mfilter` (`:458`, `Select market ▾`) is **not touched by bookmark mode at all**: it appears in none of the four mutations. So it differs from Profile's by **NEITHER text NOR state** — it is the identical control in the identical state. Reported as asked.

### 1.6 ⚠⚠ THE MAPPING TABLE

Verdict is one of **CARRIES** / **DATA-BLOCKED** (missing field named) / **NOT APPLICABLE** (why).

| Profile region (as shipped) | Bookmarks counterpart | DTO field(s) | Verdict |
|---|---|---|---|
| **Identity card** (`IdentityCard.tsx`: PFP · pseudonym · view chip · Banned · Scrubbed · owner-only bookmark link) | **None as a card.** The VIEW CHIP alone has one — the shipped `Your bookmarks` badge | none. `authorPseudonym` is **per item, many authors**; no subject user, no `pfpUrl`, no `banned`, no `scrubbed` | **NOT APPLICABLE** (canon ground 2 — one route, many authors) **+ DATA-BLOCKED**. Renders **NOTHING**; the chip survives, relocated into the panel bar |
| **Tile 1 — Wallet value** | none | `walletValue` absent | **DATA-BLOCKED** — `walletValue` |
| **Tile 2 — Positions value** | none | `positionsValue` absent | **DATA-BLOCKED** — `positionsValue` |
| **Tile 3 — Net profit / loss** | none | `netProfitLoss`, `walletValue`, `positionsValue` all absent | **DATA-BLOCKED** — all three |
| **Tile 4 — Arguments (`N (P Posts \| R Replies)`)** | none | `argumentsCount` absent. ⚠ `items.length` + a `kind` split IS derivable — but it counts what the VIEWER SAVED, a different quantity from Profile's "arguments the subject AUTHORED" | **NOT APPLICABLE** — a derivable number under a label that means something else is a lying tile, not a carried one |
| **Tile 5 — Total Support received** | none | `supportReceived` absent (per-item `aggregate.supportDharma` is one post's, not a user total) | **DATA-BLOCKED** — `supportReceived` |
| **Tile 6 — Total Counter received** | none | `counterReceived` absent | **DATA-BLOCKED** — `counterReceived` |
| **Graph slot** (`ProfileGraph` → card + overlay) | none | no series field; `loadProfileGraphSeries` is user-keyed and is not called here | **DATA-BLOCKED** — `ProfileGraphSeries` **+ NOT APPLICABLE** (canon ground 2) |
| **Left panel header — title `Positions`** | **`Bookmarks`** | n/a (copy) | **CARRIES · BUILT** (mockup `:767`, byte-verified) |
| **Left panel header — market filter** (`Select market ▾` + popover, keyed by `marketId`) | possible in principle | `marketTitle` ✓, `marketSlug` ✓ — but **no `marketId`**, and the control is `PositionsTable`-private client state | **CARRIES (fields) / NOT BUILT** — recorded as widening **W-1**; ⛔ §4 forbids authoring a new control |
| **Left panel header — Open/Closed segmented filter** | none | `statusLabel`, `marketStatus`, `settled` all absent | **DATA-BLOCKED** — `statusLabel` |
| **Left column — Position cell** (side word + `ThumbGlyph` + status `Badge` + owner Sell trigger) | **none** | `positions.side` / `quantity` / `statusLabel` / `sellEligible` all absent. `side` exists but is `side_at_post_time` — a **different field** (INV-3 frozen, the argument's side) already rendered by `SideBadge` | **DATA-BLOCKED** — see §1.7 |
| **Left column — Argument cell** (title deep-link · market-question sub-line · "Replied to …") | the card's title + reply context | `title` ✓ `ordinal` ✓ `marketSlug` ✓ `repliedToTitle` ✓ `marketTitle` ✓ | **CARRIES.** Title + "Replied to …" already ship. ⚠ The **market-question sub-line is on the DTO and unrendered** — a card-content gap, recorded (**W-3**), not built this round |
| **Left column — Staked** | the card's `Staked Đ …` | `staked` ✓ — but **author-keyed**, and `0` unless the author holds on side S | **CARRIES a same-named field with a different SUBJECT.** Already shipped |
| **Left column — the arrow track (U+2192)** | none | n/a | **NOT APPLICABLE** — it is a `<td>` between two value columns; there is no table. The relation renders as the card's `Staked … · Current …` line |
| **Left column — Current** | the card's `Current Đ …` | `current` ✓, same subject caveat | **CARRIES.** Already shipped |
| **Right panel header — title `Arguments`** | **none** | n/a | **NOT APPLICABLE** — there is no second collection to title (see below) |
| **Right panel — argument cards** | **`BookmarkCard`** | the whole present/removed union | **CARRIES** — it IS this card in forced-visitor mode. Now inside the panel body |
| **Card head — avatar** | none | **no author PFP URL** on `BookmarkItem`; `resolveAuthors` returns `pseudonym` only | **DATA-BLOCKED** — the author `pfpUrl` |
| **Card head — pseudonym** | `by {authorPseudonym}` | `authorPseudonym` ✓ | **CARRIES.** Already shipped |
| **Card head — `\|` separators** | — | n/a | composition; carry wherever their neighbours do |
| **Card head — `SideBadge` SIDE @ entry%** | same | `side` ✓ `priceAtBet` ✓ | **CARRIES.** Shipped at POLISH.6 item 1/3 |
| **Card head — `PositionMarker`** | same | `marker` ✓ | **CARRIES.** Already shipped |
| **Card head — `Đ authorStake`** | not rendered | `authorStake` ✓ (post variant) | **CARRIES / NOT BUILT** — card-content, **W-3** |
| **Card head — `Replies · N`** | rendered as running text, not a head chip | `aggregate.supportCount + counterCount` ✓ | **CARRIES / NOT BUILT** — **W-3** |
| **Card body — split bar** | rendered as running text | `aggregate.supportDharma` / `counterDharma` ✓ | **CARRIES / NOT BUILT** — **W-3** |
| **Card body — clamped teaser** | not rendered | `teaser` ✓ | **CARRIES / NOT BUILT** — **W-3** |
| **Card head — `CardActions` cluster** (DATA-BLOCKED on Profile) | **`UnbookmarkButton`** | n/a — the surface's own write | **CARRIES here where Profile is blocked.** Already shipped |

⚠ **THE TRAP, and what the DTO says about it.** The mockup's bookmark-mode rows are profile position data reused — its own comment says so (`:763-764`) — so column semantics were taken **only** from §1.3. The result: three of the five left-panel columns (`Position`, and the *subject* of `Staked`/`Current`) do not mean on `/bookmarks` what they mean on Profile, and the arrow track has no host at all.

⚠⚠ **AND THE MEASUREMENT THAT RESHAPED C3 — reported under §6's CONDITIONALS clause.** Profile's arena is two halves because that surface loads **two collections** (`loadProfilePositions` + `loadProfileArguments`). `/bookmarks` loads **one**: `loadBookmarks` returns a single `BookmarkItem[]`. No second collection is derivable without inventing one — splitting by `item.kind` is a region no authority asks for. **C3's "bordered panel + header bar per half" therefore rests on a premise the DTO invalidates, and it is REFUSED as written:** the arena carries **ONE** panel, and the absent half is absent rather than an empty bordered box held open. That is the safety rule applied, not a shortcut round it.

### 1.7 ⚠ THE POSITION CELL — what should it contain?

**Nothing the DTO supports. It renders nothing, and there is no Position cell at all.** Four independent reasons:

1. **No host.** Profile's Position cell is a `<td>` in a five-column table over position ROWS. `/bookmarks` has one collection of argument CARDS. There is no table and no row.
2. **No position on the DTO** (§1.3 measurement 2): no `quantity`, no `statusLabel`, no `marketStatus`, no `settled`, no `sellEligible`, no owner flag.
3. **`side` is not the Position.** `BookmarkItem.side` is `comments.side_at_post_time` — INV-3 frozen, the ARGUMENT's side — whereas Profile's Position cell renders `positions.side`, a **Bucket-C mutable** value. `PositionsTable.tsx:325-335` records exactly this distinction and warns against conflating them. The frozen side already renders, correctly, through `SideBadge`.
4. **The Open button is struck twice over.** A-2 struck it on Profile against SPEC.1's payload law. The mockup's bookmark rows show OPEN only because bookmark mode **locks to visitor** (`:690`) *and* the rows are profile position demo data (`:763-764`). Neither is authority for a control here — and no field would drive one.

⇒ **No Position cell, no Open button, no Sell.** `BookmarkCard.tsx:16-18` already ships the same conclusion for Sell, reached from the same fact.

---

## §2 · What was built

| File | Change |
|---|---|
| `src/components/bookmarks/BookmarksPanel.tsx` | **new** — the arena panel: bordered/rounded section, header bar, panel-scoped body |
| `src/app/(public)/bookmarks/page.tsx` | the header row MOVES into the panel bar; the list and the empty block become the panel body's children; the container tag is **untouched** |
| `tests/unit/bookmarks/render/arrangement.test.tsx` | **new** — 6 arrangement guards |
| `tests/unit/design/bookmarks-height-chain.test.ts` | **new** — the chain links this surface owns, the byte-carry parity, and the HALTED first link asserted |

**Nothing else was written.** `src/server/**`, `src/db/**`, `drizzle/**`, `src/components/profile/**`, `src/components/ui/**`, `src/components/shell/**`, `docs/design/design-canon.md` — all untouched.

### ⛔⛔ C1 AND THE CHAIN'S FIRST LINK — REFUSED ON A PIN, NOT SKIPPED

**This is the top finding of the round.** C1 ("consume #337's wide preset at the bookmarks route") and C5's first chain link both require changing exactly one JSX tag — the container tag at `src/app/(public)/bookmarks/page.tsx`. That tag is pinned:

`tests/unit/shell/page-container.test.ts` declares it as **SITE 2** with
`before: "mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-6"` and asserts **class-set EQUALITY** of `cn(CONTAINER_PRESETS[preset], extras)` against it (`:245-256`); a separate row pins the enumeration of ruled moves at **exactly `[5]`** (`:270`) — profile's, and only profile's.

- Changing `preset="reading"` → `preset="wide"` ⇒ **RED**.
- Adding `flex-1 min-h-0` to the className ⇒ **RED**.
- Moving the tag into a component under `src/components/bookmarks/` ⇒ **RED twice** (an undeclared tree call site *and* "site 2 declared but renders no call site on disk").

**That file is outside §2's write allow-list.** Its own `now` / `movedBy` fields are the documented mechanism for recording a deliberate move — the same mechanism #337 used for site 5, in the same commit as the move. §5 of the dispatch says *"a red guard is a finding about the change — FIX THE CODE, NEVER THE GUARD"*; §2 says a write outside the allow-list is a HALT. The intersection is that **the tag cannot move this round**.

⇒ **Refused and reported, not worked around.** Reshaping the tag to dodge the guard's regex would defeat the exact regression the guard exists to catch.

**The two-part edit a ruling would authorise**, so it is one commit when it lands:
```ts
// tests/unit/shell/page-container.test.ts, SITES entry site 2:
  now: "mx-auto flex min-h-0 w-full max-w-[1440px] flex-1 flex-col gap-4 px-6 py-6",
  movedBy: "HTML-FINISH · BOOKMARKS C1 (founder-ruled <date>)",
// …and :270
  expect(SITES.filter((s) => s.now).map((s) => s.site)).toEqual([2, 5]);
```
`tests/unit/design/bookmarks-height-chain.test.ts`'s last `describe` asserts the halted state by name, so the day the container moves that guard goes RED and the record must move with it — a halt recorded as an assertion rather than as prose.

### §4 · Every value, traced to its source `file:line`

⛔ Nothing is read off any mockup. Every class below is byte-carried from the Profile implementation **on this branch**.

| Value | Source |
|---|---|
| `flex min-h-0 flex-col overflow-hidden rounded-[var(--r)] bg-n0 [border:var(--hairline)]` | `src/components/profile/ArgumentList.tsx:280` (twin of `PositionsTable.tsx:540`) |
| `flex flex-wrap items-center gap-2 p-3 [border-bottom:var(--hairline)]` | `src/components/profile/ArgumentList.tsx:284`. ⚠ Its first four tokens are ALSO the class string the replaced header row already carried at the pre-change `page.tsx:46` — the same string from both directions, so nothing moves |
| `text-xs font-medium text-ink` (panel title) | `src/components/profile/ArgumentList.tsx:286` (twin of `PositionsTable.tsx:550`) |
| `flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3` (panel body) | `src/components/profile/ArgumentList.tsx:292` |
| `flex flex-col gap-3` (the list) | unchanged from `page.tsx`; identical to `ArgumentList.tsx:93` |
| `Badge variant="outline"` | unchanged from the pre-change `page.tsx:48` |
| container `preset="reading" className="flex flex-col gap-4"` | **unchanged** — the pinned baseline |

⚠ **The per-token provenance of the panel shell itself** (why `[border:var(--hairline)]` and not a 1px-solid-ink, why `p-3`, why no uppercase micro-label tier) is recorded once at `PositionsTable.tsx:505-519` and is not restated here; this round consumes it.

### §4 · Every string, with which of the three sources it came from

| String | Source | Evidence |
|---|---|---|
| `Bookmarks` (panel title) | **⑶ mockup bookmark-mode, byte-carried** — and simultaneously the literal `page.tsx` has shipped since UI-A6 | hexdump of mockup `:767` → `… 27 42 6f 6f 6b 6d 61 72 6b 73 27` ; hexdump of the shipped `>Bookmarks<` → `3e 42 6f 6f 6b 6d 61 72 6b 73 3c`. **Identical bytes**, plain ASCII, no curly forms |
| `Your bookmarks` (view chip) | **⑶**, likewise doubled by the shipped literal | mockup `:768` → `59 6f 75 72 20 62 6f 6f 6b 6d 61 72 6b 73` ; shipped → identical |
| `aria-label="Bookmarks"` on the section | ⑶ (it is the panel title), mirroring Profile's `aria-label="Positions"` / `"Arguments"` | `PositionsTable.tsx:535`, `ArgumentList.tsx:275` |
| `No bookmarks yet.` / `Saved arguments will appear here.` | ⑴ `BOOKMARKS_EMPTY_COPY` | unchanged, POLISH.6's |

⛔ **No string was authored.** The `Select market ▾` label was measured and **not** used (§1.5): bookmark mode does not touch it, so it differs by neither text nor state — and the control it labels is not built.

---

## §6 · Measurement — fixed-width same-origin iframe, five widths

`next dev` on `:3210` under the placeholder env. **`resize_window` was not used** — it resizes the OS window and leaves `innerWidth` alone; the layout viewport is pinned by a fixed-width same-origin iframe.

⚠ **Two harness corrections, both caught by control rather than by assumption:**
1. The first pass measured the **Suspense fallback**: `onload` + a fixed sleep returned while the real subtree was still inside a streamed `<template>` with a 0×0 rect and `offsetParent === null`. Gating on the panel being **laid out** fixed the readiness signal.
2. In this dev environment the fallback is **never** swapped for the real subtree — on `/bookmarks` **and on `/` (Discovery)**, so it is environmental, not the diff. Removing the route's `loading.tsx` for the measurement window (restored byte-exact, md5 verified) made the real page paint.

### Results — WITH the panel

| viewport | container | panel W × H | bar H | body client/scroll | body scrolls | doc scrolls Y / X | `<main>` H | offscreen controls |
|---|---|---|---|---|---|---|---|---|
| **390** | 390 | 358 × 1752 | 45 | 1707 / 1707 | **no** | yes / **yes (570)** | 1800 | **2** |
| **768** | 768 | 736 × 1752 | 45 | 1707 / 1707 | **no** | yes / no | 1800 | 0 |
| **1024** | **768** | 736 × 1752 | 45 | 1707 / 1707 | **no** | yes / no | 1800 | 0 |
| **1440** | **768** | 736 × 1752 | 45 | 1707 / 1707 | **no** | yes / no | 1800 | 0 |
| **1920** | **768** | 736 × 1752 | 45 | 1707 / 1707 | **no** | yes / no | 1800 | 0 |

**Stacked or two-column:** one column at every width, by construction — one panel, one collection. No breakpoint is declared and none is invented.

**Clipping:** none introduced. `overflow-hidden` appears once in the chain, on the panel — the token that keeps the bar's background off the rounded corner — and nothing is clipped by it at any width (`clientHeight === scrollHeight` on the panel at all five).

**Every control reachable:** yes inside the panel at all five widths (0 offscreen controls in the panel subtree at every width).

**The chain, resolved (1920):**
```
bookmarks-panel-body   overflow-y auto   height 1706.52px  min-height 0     flex-grow 1
bookmarks-panel        overflow   hidden  height 1752.38px  min-height 0     flex-grow 0
div.mx-auto (container) overflow visible  height 1800.37px  min-height AUTO  ← ⛔ THE HALTED LINK
main.flex              overflow visible   height 1800.37px  min-height 838px (the calc floor)
```
⇒ **Measured confirmation of the halt:** the container carries `min-height: auto` and no `flex-1`, so no definite height reaches the panel; the panel sits at content height and `overflow-y: auto` cannot engage. The page **grows and scrolls** instead (`docScrollsY: true` at every width) — RULED A1 preserved, and the same posture `profile-height-chain.test.ts` records for Profile even with its chain complete.

⇒ **Measured confirmation of the missing width:** the container caps at **768px** at 1024 / 1440 / 1920 — identical at all three, which is exactly the class of defect #337's row 20 minted `wide` to fix. It is present here because C1 is refused, not because anything regressed.

### Control — the SAME harness on the pre-change page (`git show ae06eea:…`), panel absent

| viewport | container | card W | `<main>` H | doc scrolls X | overflow nodes in `<header>` | overflow nodes elsewhere |
|---|---|---|---|---|---|---|
| **390** WITHOUT | 390 | 358 | 1775 | **yes (570)** | **20** | **0** |
| **390** WITH | 390 | 333 | 1800 | **yes (570)** | **20** | **0** |
| **1440** WITHOUT | 768 | 736 | 1775 | no | 0 | 0 |
| **1440** WITH | 768 | 711 | 1800 | no | 0 | 0 |

**Attributed by control, not by inference:** the panel's only deltas are **card width −25px** (the body's `p-3` ×2 = 24px + hairline ×2 = 2px) and **page height +25px** (the 45px bar, less the removed `gap-4`). **Zero new overflow, zero new clipping, doc-scroll behaviour unchanged.**

---

## §7 · Findings

### ⛔ Pre-existing defects — recorded, routed, LEFT

**P-1 · `GlobalHeader`'s wordmark lockup overflows the viewport at 390.** `document.scrollWidth` **570** against `innerWidth` **390**; **20** overflowing nodes, **all inside `<header>`**, **zero** in the page subtree; two controls are pushed off-screen and unreachable — the home link (`aria-label="Zugzwang — home. 82 days 14 hours 21 minutes until market freeze."`) and **`JOIN`**. Measured **with and without** this change: byte-identical (570 / 20 / 0 both ways). ⇒ **Not this diff.** Owner `src/components/shell/GlobalHeader.tsx` — POLISH.1's shell, forbidden here. **ROUTED.**

**P-2 · Every Suspense-bounded `(public)` route paints its fallback permanently in this dev environment.** The real subtree stays inside the streamed `<template>`; reproduced on `/` (Discovery) as well as `/bookmarks`; no console errors; the SSR response is complete (109,998 bytes, closed `</html>`). Environmental, not the diff — recorded because **any future in-browser measurement of these routes will silently read the loading state** unless the boundary is removed first, which is exactly what happened on this round's first pass.

### ⚠ Widenings — RECORDED, NEVER IMPLEMENTED

**W-1 · A market filter on `/bookmarks`.** The fields carry (`marketTitle`, `marketSlug`); `marketId` does not, so the popover's key would have to change. The control is `PositionsTable`-private client state, and §4 forbids authoring a new control. Not built.

**W-2 · The panel shell is now its THIRD byte-identical copy.** `PositionsPanel` · `ArgumentsPanel` · `BookmarksPanel`. `ArgumentList.tsx:267-269` already filed the second as *"attributed duplication, routed not absorbed… lifting the shared shell into `ui/**` would mint a new primitive, which this task forbids."* The third occurrence is the moment that note names for lifting. ⛔ Still not done — `ui/**` mints no new primitive this round either.

**W-3 · Card-content parity with Profile's argument card.** Five items whose fields all CARRY and which this round did not build, because C1–C5 govern the frame (C4 = *panel header contents and row cells*) and there are no rows: the market-question sub-line (`marketTitle`), the clamped teaser (`teaser`), `Đ authorStake` in the head, `Replies · N` as a head chip, and the Support/Counter **split bar** replacing the running-text line. Plus one that is genuinely blocked: the head **avatar**, for want of an author PFP URL on the DTO.

### Rows with NO test, named explicitly

- **The five W-3 card-content items** — not built, so not tested.
- **The market-question sub-line gap** — recorded only.
- **Browser-resolved geometry** (container width, panel/body boxes, overflow, scroll engagement) — **structurally untestable in CI**: jsdom performs no layout, resolves no `calc()`, no `100vh`, no percentage height and no Tailwind utility. Proven in a browser against real compiled CSS and recorded in §6; the two new guards prove the DECLARATIONS, never the composition.
- **P-1 and P-2** — outside the allow-list; no guard added.

### Gates

| Gate | Result |
|---|---|
| `just verify` (baseline, before any write) | **EXIT=0** |
| `just verify` before the commit | **EXIT=0** (one intervening **EXIT=1**, pure Biome formatting in the two new test files, fixed by formatting **only** the four files of this diff — a repo-wide `--write` would have applied fixes to out-of-allow-list files) |
| targeted: `tests/unit/bookmarks/` + `tests/unit/design/` + `tests/unit/shell/` + the `SideBadge` census | **23 files / 178 tests, exit 0** |
| working tree after the measurement harness | **clean**; `page.tsx` and `loading.tsx` md5-identical to their committed forms |

---

## §8 · Session log fields

**What landed** — `src/components/bookmarks/BookmarksPanel.tsx` (new), `src/app/(public)/bookmarks/page.tsx`, `tests/unit/bookmarks/render/arrangement.test.tsx` (new), `tests/unit/design/bookmarks-height-chain.test.ts` (new). One commit, one draft PR, base `main`.

**Decisions made** — (1) C1 + the chain's first link REFUSED on the `page-container.test.ts` site-2 pin, with the authorising edit written out. (2) C3's two-panel arena REFUSED on the one-collection measurement; one panel ships. (3) The whole top band renders NOTHING, on two independent grounds. (4) The page header row MOVES into the panel bar rather than being duplicated. (5) The `<h1>` keeps heading semantics while taking Profile's panel-title tier.

**Open questions** — the C1 allow-list ruling; whether the absent arena half should ever be filled and by what; W-1/W-2/W-3 disposition; P-1's owner.

**Next session starts at** — the founder's ruling on the one-file allow-list extension. With it: move the container to `wide` + `flex min-h-0 flex-1 flex-col`, add the site-2 `now`/`movedBy` row, and replace the halted-link `describe` with the two links added to `chainLinks()`.

**Context to preserve** — this file's §1.3 DTO table and §1.6 mapping table are the measurement any follow-on round must start from.

**Time** — 2026-08-15.

---

## §9 · ⚠ SEALED SELF-ASSESSMENT

Written last. Unamendable.

**What the loop missed.** I wrote a doc comment containing a full `<PageContainer …>` opening tag inside `src/components/bookmarks/BookmarksPanel.tsx` and turned `page-container.test.ts` red — a **false** red, on correct code. That failure mode is documented in three places I had already read in full, in this session, before I typed it: the guard's own docblock names it (*"a doc comment quoting a full tag … would still match and would produce a FALSE RED"*, @security-auditor POLISH.3 S-L3); `bookmarks/error.tsx` carries a dedicated ⚠ block saying *"EVERY MENTION ABOVE IS UNBRACKETED, DELIBERATELY"*; and I had read the walk's regex line by line ten minutes earlier while proving that same guard blocks C1. I had the warning, the precedent, and the mechanism in context, and I still wrote the tag.

**Where it was cheapest to catch.** At write time — one keystroke, zero cost. Instead it cost a full targeted run to surface and a second read of the guard to diagnose. Nothing downstream was harmed, which is the only reason this is a process finding rather than a defect: the guard did its job. But a guard catching a mistake it had already told me how to avoid is not a win, it is the cheapest possible instance of not reading what I had just read.

**A second, smaller miss.** I ran the first browser pass against `onload` + a 450 ms sleep and measured the Suspense fallback — reporting a 0×0 panel as though it were a layout fact. I caught it by dumping the DOM instead of trusting the number, which is right, but the readiness gate should have been written as "the node I am measuring has a box" from the start rather than as "the frame loaded." Measuring before proving the thing is on screen is the same error class as asserting on `textContent`.

**One dispatch change.** §2's allow-list enumerates the new design guard to the exact path — `tests/unit/design/bookmarks-height-chain.test.ts (new)` — while omitting `tests/unit/shell/page-container.test.ts`, which pins the single JSX tag that **C1 and C5 both have to change**. That precision-next-to-omission is the line. It made the dispatch's own first build step unexecutable, and the executor had to derive the refusal from §6's CONDITIONALS clause rather than being told which of two contradicting rules wins. Either §2 should carry that file, or §3 C1 should state the fallback in one sentence: *"if a guard outside the allow-list pins the call site, HALT C1 and report the authorising edit."* The round would have reached the same outcome an hour earlier and with no ambiguity about whether refusing was compliance or evasion.

**What I would not change.** Refusing C1 and refusing C3's second panel were both correct and both cost most of the round's visible output. The deliverable is thinner than the dispatch imagined because the surface's read model is thinner than the dispatch imagined, and the honest response to that was to say so with the measurement attached rather than to fill the shapes.

---

# ROUND 2 — the surface is the Profile arrangement

**Commit** `5f0352a` · **preview** https://experiment-eybntq0sh-zugzwang-worlds-projects.vercel.app

## §1.1 · Does SPEC.1 speak to /bookmarks? — **NO HALT**

Three hits for `bookmark|BookmarkItem|saved` in `docs/specs/SPEC.1.md`:

- `:1406` — *"no user-defined or **saved** custom sorts in v1"*. About sort variants; unrelated.
- `:1490` — the §0 changelog row for the Profile amendment, which mentions *"one forward sentence to A6 bookmarks"*.
- `:1665`, the sentence itself, verbatim:
  > **Forward (A6).** This surface hosts a **bookmark mode at A6** (design-canon ruling 1) — specified by A6's own ADR, not here.

⇒ **SPEC.1 does not enumerate this route.** A-1's strike was taken on §23's enumeration of the **profile** page, so it is surface-bound and **does not travel**. The founder's ruling stands.

⚠ **But the test as posed was incomplete, and following the delegation strengthens the ruling rather than voiding it.** SPEC.1 hands governance to A6's ADR, and **ADR-0032 §Context** accepts it: *"SPEC.1 §23 defers them entirely to this ADR … **this ADR must serve as the A6 build spec, not a thin storage-choice record.**"* Its **D-5** then enumerates the surface:
> The bookmark page **reuses the Profile surface in forced-visitor mode** (canon §2 *Bookmark*): the list is retitled **"Bookmarks,"** every card renders **without owner affordances** (there is never a Sell mount…), and the **Staked/Current shown are the bookmarked author's** figures…

Canon §6 carries a dedicated **Bookmark** line saying the same in copy terms. Two binding constraints follow and are honoured: **order is `bookmarks.created_at DESC`** (D-8), not RANKING §3.6; and **never a Sell mount**.

## §1.2 · The top band, under the corrected question

**E1's proof, verified at source:** `src/app/(public)/layout.tsx:67-74` calls `auth.api.getSession()` then `getHeaderBalance(db, session.user.id)` and `getHeaderPortfolio(db, session.user.id)`; the viewer's pseudonym is read at `:69` as `session.user?.pseudonym`. That is where the header's PORTFOLIO / BALANCE come from on this route today.

| Region | Existing loader | Signature | viewerId satisfies? | Profile page already calls it? |
|---|---|---|---|---|
| Identity card | `resolveProfileUser` | `(client, pseudonym)` | ⚠ **No — it takes a PSEUDONYM.** Satisfied instead by `session.user.pseudonym`, which the layout already reads | yes (`u/[pseudonym]/page.tsx:54`) |
| Tiles 1–6 | `loadProfileTiles` | `(client, { userId, positions })` | **Yes**, plus `positions` from `loadProfilePositions(client, { userId })` | yes (`:67-70`) |
| Graph slot | `loadProfileGraphSeries` | `(client, { userId })` | **Yes** | yes (`:65`) |

**Tile 4 (Arguments):** `loadProfileTiles` counts `argumentsCount` by `userId`. With viewer-as-subject that is the viewer's own authored count — correct, as the dispatch anticipated.

⇒ **All three regions are buildable. None renders nothing.**

## §1.3 · Table and replica, field by field

**Table columns** — Position: the argument's frozen `side` **carries** (rendered as Profile's word + `ThumbGlyph`, *not* a chip — R12); its **status token is DATA-BLOCKED (`statusLabel`)** and Sell is ruled out by D-5. Argument: `title` · `marketTitle` · `marketSlug` · `ordinal` · `repliedToTitle` **carry**. Staked: `staked` **carries** (the AUTHOR's Đa). Arrow: topology. Current: `current` **carries**.

**Header bar** — market filter **carries**; ⚠ **the key becomes `marketSlug`**, because `BookmarkItem` has no `marketId`. Open/Closed pair: **DATA-BLOCKED (`statusLabel`)**.

**Replica parts** — pseudonym · side · `priceAtBet` (as entry %) · stake (`authorStake` / `stake`) · `Replies · N` · card actions (`UnbookmarkButton`) · title · **body** · split bar · "Replied to …" · panel-header market title: **all carry**.

**The three predicted blocks — all CONFIRMED at source, none accepted on faith:**
1. **Author avatar** — `debate-view/resolve-authors.ts:48` selects `{ id, pseudonym }` only. Missing: the author's `pfp_filename`/`pfpUrl`.
2. **Argument image** — `comments.image_uploads_id` **does exist** (`db/schema/comments.ts:48`), but no bookmarks DTO field carries it and surfacing it means editing `src/server/**`. Missing: `comments.image_uploads_id` on the DTO.
3. **Live price** — `BookmarkItem` carries only `priceAtBet`, the frozen entry price. ⛔ Never substituted.

**A fourth block the dispatch did not predict:** the Open/Closed filter and the Position cell's status token, both on `statusLabel`.

**And one element halted on a GUARD, not on data:** the replica head's side chip. `side` and `priceAtBet` both carry, but `tests/unit/debate/render/side-badge.test.tsx:182` pins the sized `SideBadge` call sites as an exact per-file `toEqual` map, and that file is outside this round's allow-list. Renders nothing pending a one-file ruling — the same shape as R1's `page-container.test.ts` extension, and the same precedent POLISH.6 recorded.

## §5 · Measurement — fixed-width same-origin iframe, five widths

| viewport | container | arena | left panel | right panel | body scrolls | doc X-overflow | offscreen in arena |
|---|---|---|---|---|---|---|---|
| 390 | 390 | stacked | 342 | 342 | no | yes (570) — `<header>` only, P-1 | 0 |
| 768 | 768 | stacked | 720 | 720 | no | no | 0 |
| 1024 | 1024 | **stacked** | 976 | 976 | no | no | 0 |
| 1440 | 1440 | **two-column** | 684 | 684 | no | no | 0 |
| 1920 | **1440** | **two-column** | 684 | 684 | no | no | 0 |

⚠ **The `lg` boundary is 1025, not 1024** — measured: at a 1024 layout width `matchMedia('(min-width: 64rem)')` is **false** and the arena stacks; at 1025 it is **true** and the arena is 476 + 476. Inherited from Profile's ruled breakpoint, not chosen here. ⚠ I could not run the Profile control locally — `/u/[pseudonym]` hits the stuck-Suspense environment defect — so the parity claim rests on the shared class string, not on a side-by-side measurement.

**Clipping:** none. `overflow-hidden` appears once per panel (the token that keeps the bar's background off the rounded corner); zero overflowing nodes inside the arena at any width. **Every control reachable:** yes, 0 offscreen in the arena at all five. **Panel scroll:** does not engage at any width — the known A1 asymmetry (`<main>` is `max(floor, content)`), identical to Profile's own recorded control.

## Values, strings, widenings, untested rows

**Every value byte-carried**, each traced in-file: panel section/body ← `ArgumentList.tsx:280,292`; panel head ← `PositionsTable.tsx:548` (the `relative` one, for the popover context); panel title ← `ArgumentList.tsx:286`; table head + arrow track + value cells ← `PositionsTable.tsx:300-308,396-431`; Position cell word+thumb ← `PositionsTable.tsx:357-364`; head cluster, separators, split bar ← `ArgumentList.tsx:41-43,143-205,371-425`; bands ← `u/[pseudonym]/page.tsx:134,156-159`.

**Every string sourced** (`copy.ts` names each): `Bookmarks` and `Your bookmarks` ← ⑵ canon §6 **Bookmark** line, hexdumped; `Select market ▾` ← ⑵ canon §6 **Profile** line, hexdumped against canon *and* `PositionsTable.tsx` (identical, caret `e2 96 be`); `All markets` ← ⑶ mockup + shipped popover; empty msg/sub ← ⑴ `BOOKMARKS_EMPTY_COPY`, moved byte-unchanged. **Two mockup strings deliberately NOT carried**, each with its reason recorded in `copy.ts`: the no-selection line (its second sentence promises Sell, which D-5 forbids, and the state is unreachable here) and the `Market title` placeholder.

**Widenings recorded, not implemented:** the `HeadSeparator` third copy (still not lifted into `ui/**`); the split bar's side-pole residual (inherited from `ArgumentList`); the market filter's mockup relabel to `All markets ▾` (canon §6 outranks it).

**Rows with no test:** the browser-resolved geometry (jsdom performs no layout — proven in a browser, recorded above); the `lg`-boundary behaviour at 1024/1025; the halted side chip.

## ⚠ SEALED SELF-ASSESSMENT — R2

**What the loop missed.** I put a `SideBadge` in the table's Position cell on the first draft. Profile's Position cell is not a chip — its own source says `⛔ NOT a chip (R12)` eight lines above the code I was copying from — and I had that file open. The census caught it, and only then did I read the cell properly and find that byte-carrying the *real* thing (word + `ThumbGlyph`) was simultaneously more faithful and census-free. I reached for the primitive that looked right instead of copying the cell I was told to copy. Cheapest catch: reading the eight lines of `PositionsTable.tsx` immediately above the block I was byte-carrying.

**Second miss, same family as R1's.** I asserted `expect(...length).toBe(1)` on `[data-empty-block]` in R1 and it broke the moment a second, unrelated P1 consumer (the graph card) joined the page. A page-wide count was never the right instrument for "did THIS component adopt the primitive"; scoping it to the block containing `bookmarks-empty` is what I should have written the first time.

**What this dispatch caused — the line.** §1.1 reads *"⛔ DOES SPEC.1 SPEAK TO /bookmarks AT ALL?"* and makes the whole shape turn on that one document. But SPEC.1's answer is *"specified by A6's own ADR, not here"* — it hands governance elsewhere, and the test as written stops one document short of the authority it points at. Had ADR-0032 D-5 said "a card list" instead of "reuses the Profile surface", following the dispatch literally would have shipped the table anyway, against the ratified spec, with a green §1.1 verdict as cover. The fix is one clause: *"and if SPEC.1 delegates, read what it delegates to."* I read it regardless — but a halt gate that can be satisfied without reading the governing document is not a gate.

**What I would not change.** Halting the side chip rather than hand-rolling one, and refusing to substitute `priceAtBet` for a live price. Both cost visible completeness; both would have been silent and plausible defects.
