# HTML-FINISH · MARKET DETAIL (`/m/[slug]`) — SESSION LOG

Branch `htmlfinish/market-detail`, cut from `origin/main` = `fd4b357`.
Plan: `@docs/plans/HTML-FINISH-MD.md` (committed verbatim at C0, md5
`079df6560c1d6fa668ee6eb97e3028f2`, 770 lines).
Run report (out of tree, operator-held): `~/Downloads/HTML-FINISH-MD-RUN.md`.

---

## PHASE 1 · FRAME — complete

### What landed

| # | Commit | SHA | Rows |
|---|---|---|---|
| C0 | `docs(plans): commit the ratified HTML-FINISH · MARKET DETAIL plan` | `3b8de11` | — |
| C1 | `feat(debate): the headzone becomes a two-column, arm-scoped frame` | `1279064` | 1 |
| C2 | `test(debate): pin the headzone arm split` | `9efd18a` | 1 (guard) |
| C3 | `feat(debate): the left column reorders to question → attrs → criterion` | `8ab395a` | 6 |
| C4 | `feat(debate): the price chart moves into the header's right rail` | `c4b465a` | 4 |
| C6 | `feat(debate): the detail price bar collapses to one row` | `eef4cde` | 7 + rail placement |
| C6b | `revert(debate): row 7 backs out — the one-row bar needs an out-of-fence guard` | `157804f` | ✗ 7 |
| C8 | `feat(debate): the focused post's image moves into the header rail` | `0c447bd` | 11 |
| C9 | `feat(debate): the focused post's split bar pins to the stack foot` | `09b3231` | 16 |

**Files:** `+src/components/debate/HeadZone.tsx` · `MarketHeader.tsx` ·
`PostFocusHeader.tsx` · `DebateView.tsx` · `DebateColumn.tsx` · `PriceBar.tsx`
(reverted) · `+tests/unit/design/debate-height-chain.test.ts` ·
`+tests/unit/debate/render/head-zone.test.tsx` · `market-header.test.tsx` ·
`price-percent-pair.test.tsx` · `comment-image.test.tsx`.

**Rows landed: 1, 4, 6, 11, 16** (+ the rail placement half of 7).
**Rows halted: 5, 7, 8.** PR# — not yet opened at the time of writing.

### Decisions made

1. **The rail is a FRACTION (`lg:w-1/4`), never d5's `flex:0 0 340px`.** A fixed
   track is exactly the defect `shell/page-container.test.ts` records for the
   profile ("two 356px columns at 1440 — IDENTICAL to its 768 rendering"), and
   the mockup declares no breakpoint at all.
2. **The rail is not rendered when it has nothing to hold** (`right={null}`),
   rather than rendered empty — PD-3-09 / OD-6, the ruling that deleted the
   deferred-work placeholder box from `MarketHeader`.
3. **Each ternary arm is a FRAGMENT, not a wrapper div**, so the headzone and
   arena bands are sibling children of the container. Otherwise the arena's
   `flex-1 min-h-0` resolves against a wrapper and the height chain breaks
   invisibly. Cost: the post arm's band gap moves from `gap-4` to the
   container's `gap-5`.
4. **The debate height chain is NOT the profile's.** `(public)/layout.tsx` rules
   `min-h-*`, never `h-*`; `/m/[slug]` carries no founder ruling making it a
   one-screen design, so no definite height is added and the new guard forbids
   `h-full` / `h-screen` / `h-[…]` on its band nodes.
5. **`CommentImage` is untouched by row 11.** `.hpimg`'s `aspect-ratio:16/9` +
   `overflow:hidden` CROP, against T2 (§17 H-T2) and canon §107's "shown whole ·
   any orientation". d5 agrees — `:955` marks that rule "flag 1 paused".
6. **C1B (the `wide` container swap) did NOT land.** See Open questions.

### Surprises caught + fixed in-session

- **The C4 comment went stale one commit later.** C6 moved the price bar into
  the rail, which falsified C4's in-code note ("and so no rail at all"). It was
  corrected AT THE SITE rather than annotated below — an amendment a reader
  reaches second is not an amendment (**O-4**).
- **A guard the plan did not know about.** `tests/unit/discovery/render/
  price-bar-presets.test.tsx` byte-pins the `detail` render; §8's guard map
  lists none of it. Rows 7 and 8 were built, verified green, and then **backed
  out** rather than editing an out-of-fence file. See Open questions.

### Open questions — all three need a founder ruling

- **OQ-MD-1 · Row 5 is blocked at SPEC.1 §9.** The collapsed chart is pinned
  "lines only, no axis, no nodes" at `SPEC.1.md:490` and `:515`, with a §17
  acceptance row at `:1260` and F-DEBATE-5's cite at `:517`. `:492` scopes the
  canon-owned escape hatch to EXPANDED mode only. The 1.0.30 Discovery
  precedent does not reach it: that one turns on the sparkline being
  DECORATIVE, and §9 says this chart is explicitly not `aria-hidden`.
  ⇒ Needs a **web-authored** §9 amendment at four sites, or the row is struck.
  ⚠ The natural implementation would have gone GREEN past the existing test
  (d5 puts its ticks outside the `<svg>`, so different testids) — the block is
  on the SPEC, deliberately, not on the guard.
- **OQ-MD-2 · Rows 7 + 8 need one line of allow-list.**
  `tests/unit/discovery/render/price-bar-presets.test.tsx` must re-capture
  `DETAIL_BASELINE`, which is that guard's own documented mechanism (its
  docblock records the POLISH.3 re-capture in terms) — so this is **not** a
  predicate relaxation and not H3-c. It is an edit §11 does not authorise.
  Its second assertion, `detail-carries-no-data-size-attribute`, justifies
  itself as *"a surface this task is not opening"* — a ground this task spends.
  ⇒ Rule the allow-list line and both rows land as already built.
- **OQ-MD-3 · C1B is UNMEASURED, so it did not land.** The plan's trigger is a
  browser measurement at 1440 and 768 against the compiled CSS. It could not be
  taken: the local database holds **zero markets and zero comments**, so
  `/m/[slug]` cannot be served, and seeding it means driving the engine
  (users → identity pool → TOS → market → open → bets-with-comments), which is
  out of this task's fence.
  ⚠ **What CAN be said: the named trigger cannot fire by construction.** It
  detects a FIXED track ("same width at 1440 as at 768"). Both the rail
  (`lg:w-1/4`) and the arena columns (`flex-1`) are PROPORTIONAL, so they track
  the container, and the container tracks the viewport up to `max-w-5xl`.
  ⚠ **What remains genuinely open** is the separate question the trigger was a
  proxy for: whether 1024px is too narrow for a two-column header ABOVE a
  two-column arena. At the cap the rail is ~244px and each arena column ~480px.
  That is a design judgement, and the plan was explicit that it would not be
  asserted without a browser. ⇒ Founder's call, or re-run the measurement once
  staging carries data.

### Next session starts at

**Phase 2, C11** — `feat(debate-view): market media + outbound video reach the
header`, the first of the three fenced `src/server/**` files. ⛔ Read plan §7
(the +1 statement budget) and §11 (the three-file fence) before the first edit;
a fourth `src/server/**` file is **H2-a** and halts phase 2 whole.

### Context to preserve

- **Build env.** This worktree has no `.env.local`. `next build` runs with the
  `tests/_setup/env.ts` placeholder values plus `ZUGZWANG_ENV=preview`. No
  `.env*` file is read or written.
- **`just` is not on a bash subshell's PATH** — it lives on the mise shims path,
  which only the interactive zsh has.
- ⚠ **Never pipe a gate command to `tail`.** The first verify attempt reported
  `EXIT=0` while failing on `exec: just: not found`; any trailing command owns
  the compound exit.
- **`pnpm vitest run` directly**, never via `just` (which points at the cloud DB).
- **H1-e is DISCHARGED** — measured, not assumed. Row 8's `onPick` was fully
  wired and `next build` compiled with both Discovery `PriceBar` sites intact.
  `MarketHeader`'s only consumer is `DebateView`, which is `"use client"`. If
  OQ-MD-2 is ruled, row 8 needs no re-measurement.

### Time

Phase 1: 2026-08-15 23:58 UTC → 2026-08-16 00:32 UTC (C0 `3b8de11` → C10 `7e45d94`).

---

## PHASE 2 · SERVER — complete, with row 14 halted

### What landed

| # | Commit | SHA | Rows |
|---|---|---|---|
| C11 | `feat(debate-view): market media + outbound video reach the header` | `e2fdfcb` | 2, 17 |
| C12 | `feat(debate-view): reply images ride the existing batched presign` | `2184822` | 26-image (+34) |
| C13 | `feat(debate-view): the author's current value rides the held-sides read` | `d8b8885` | 14 — **reverted** |
| — | `fix(debate-view): no phantom "now" on a terminal market` | `f2ac776` | reviewer fixes — **reverted** |
| C13c | `revert(debate-view): row 14 halts — @security-auditor HIGH, a removal oracle` | `969a4a0` | ✗ 14 |

**Rows landed: 2, 17, 26-image** (and row 34, the reply-image lightbox, one
commit early — `CommentImage` IS the lightbox affordance, so splitting it would
have shipped a dead click target).
**Rows halted: 14.**

### The read budget — **+1 exactly**

`get-by-slug`'s `mediaVideoUrl` is +0 (one more column on a row already read).
C11's `getDefaultMarketMediaUrl` is the **one** new statement, and it serves
BOTH row 2 and row 17 — the same image at two zoom levels. C12 is +0 in the
general case.

⚠ **One exception, stated because the budget is a halt condition.**
`mintImageUrls` early-returns when no input comment carries an image, so a
market whose images are all on **replies** and none on posts goes 0 → 1 and that
render's delta is **+2**. That statement is the ratified row's own irreducible
cost — a reply's image key cannot be read without reading it — not an overage
that could be brought back inside the fence. `@code-reviewer` MEDIUM-2; plan §7's
table row carries the same unconditional wording and should be read with this
correction.

⚠ **H2-a never fired.** Exactly three `src/server/**` files, verified per commit
by both reviewers. The F-4 swap that existed to avoid a fourth file went out
with row 14, so `getMarketPricingAndUnitToWin` is un-orphaned again.

### Decisions made

1. **`FocusMarketCard` carries NO sparkline** — the locked market-card
   composition (design-language §3.2) struck it at HTML-FINISH · DISCOVERY with
   the paired SPEC.1 1.0.30 amendment, which deliberately RETAINED "must be
   identical everywhere" as its load-bearing half. d5's `.mcard` still draws one.
   Applying an existing ruling, not making a new one.
2. **The market card IS the exit** (F-2). `?post=` syncs with
   `history.replaceState`, never `pushState`, so browser Back does not leave post
   view; this card replaced the only other way out. Its accessible name is
   byte-carried from the button it supersedes.
3. **The mockup's `.mmedia .cap` placeholder caption is not shipped** — it is the
   mockup describing itself, and rendering it is PD-3-09 / OD-6 verbatim.
4. **Row 14 halted rather than re-ruled.** See Open questions.

### Surprises caught + fixed in-session

- **`@code-reviewer` HIGH-1 — a phantom "now" on terminal markets.** Row 14's
  gate tested `marker` and the comment count but never market STATUS. Resolution
  writes neither `positions` nor `pools`, so a holder-to-settlement keeps
  `quantity > 0` and `marker: "none"` forever — a losing author would have read
  `Đ 100 → Đ 55` for a holding worth nothing, while Profile showed the settled
  net for the same holding. Fixed in-session (`Open` only), then went out with
  the row-14 revert. The rule is `header-portfolio.ts`'s, stated in terms.
- **MEDIUM-4 reproduced itself.** The new market-media test FAILED on its first
  run because that read signs through `mintReadUrl("market-media", …)`, a
  different bucket arm from the `signRead("uploads")` seam the suite mocks — the
  uncovered arm the finding was about.
- **A guard re-derived, not relaxed.** `head-zone::the-two-arms-are-DISJOINT`
  asserted the market TITLE was absent from the post arm; row 17 puts it there
  on purpose. It now pins the market HEADER's absence and the card's presence.
  Pinning the title's absence would have forbidden row 17 rather than guarded
  row 1.

### Open questions

- **OQ-MD-4 · Row 14 needs OD-1 re-ruled, with a cost that was not in the
  record.** `@security-auditor` HIGH: the ruled NARROW predicate counts over the
  removal-INCLUSIVE comment list, and publishing its nullness makes
  `authorValue === null` a deterministic oracle for *"this author has a comment
  you cannot see."* The other two conjuncts are both readable off the same
  payload, pseudonyms are unique and ride every visible entry, and removed
  entries ship structurally — so on a market with one removal, an unauthenticated
  GET attributes the moderation action completely.
  ⚠ Every fix is the founder's ruled decision: widen OD-1 (the kickoff forbids
  it in terms), count over `visible` (re-opens F-5's false money claim), or make
  the right half a per-post figure (changes what the arrow means).
  ⚠ **The plan's own SC-1 discharge for C13 was incomplete** — it cleared
  `positions` ("carries no body"), and the masking surface was never
  `positions`; it was the derived per-author COUNT over the comments read. SC-1's
  own framing catches it: a count is a read.
- **OQ-MD-5 · Presigned-URL scope (MEDIUM, reported not fixed).** Every visible
  comment's image URL is now minted per render at 3600s and ships to the client,
  so one request hands a visitor hour-valid GET credentials for every image in
  the market — including replies they never open — and removal does not revoke
  within the TTL. Candidate fixes (lazy per-focused-post minting, or a shorter
  reply TTL) are design calls, and `limits.ts` already flags that a cap on
  `listMarketComments` is a HARDEN.6 **prerequisite**.
- **OQ-MD-6 · The `.md` export pays for media work it discards (MEDIUM).**
  `GET /m/[slug]/export` is public, unauthenticated, `force-dynamic`, `no-store`
  and not rate-limited (`proxy.ts` matches `/admin/:path*` only), and it now runs
  the `market_media` read plus N+1 presigns whose output `serializeDebateExport`
  throws away. Candidate fix: make media minting opt-in on the aggregator.
- **OQ-MD-7 · SURPRISE, pre-existing, explicitly out of fence.** Presigned
  comment-image URLs embed the raw `users.id` (`u/<userId>/<uploadId>`), so a
  page load yields a `pseudonym → users.id` map for every author who attached an
  image. Pre-existing for posts; this task widens it to replies. Not exploitable
  today, but it survives pseudonym retirement unless objects are re-keyed.

### Next session starts at

**Phase 3, C15** — the SPEC.1 §9 amendment (the kickoff supplies the ruled text
verbatim; apply it at all four operative sites per O-4, bump to 1.0.31, and
correct CLAUDE.md §1's stale 1.0.29 in the SAME commit).
⛔ Phase-3 halts do NOT cascade — one row's halt never suppresses another.

### Context to preserve

- **The reviewer cascade ran SEQUENTIALLY**, `@code-reviewer` then
  `@security-auditor`, each with directed scope and the plan passed in. Neither
  ran a DB-touching command, per the false-red hazard.
- **Out-of-fence findings live in `claude-progress.md`** (gitignored, never
  staged): the `limits.ts` / `BookmarkToggle.tsx` stale round-trip counts — ⚠ the
  INVERSE of O-9, a code change that falsifies a prose measurement under a fence
  that forbids correcting it.

### Time

Phase 2: 2026-08-16 00:42 → 01:26 UTC (C11 `e2fdfcb` → C14 `9016af9`), including the sequential reviewer cascade.

---

## PHASE 3 · CARDS + OVERLAYS — complete

### What landed

| # | Commit | SHA | Rows |
|---|---|---|---|
| C15 | `docs(spec): SPEC.1 §9 — the two-slot preview leaves the market-view card` | `5b09ef2` | 25 (spec) |
| C16 | `feat(debate): the teaser and reply preview leave the market-view card` | `2cbd1c7` | 25 |
| C17 | `feat(debate): the resolver-card structural slot` | `e6268f0` | 3 |
| C18 | `feat(debate): the resolution criterion clamps to two lines` | `af87d65` | 10 |
| C19 | `feat(debate): the title enters post-focus and a + glyph opens the pop-up` | `b8bd20b` | 23, 24 |
| C20 | `feat(debate): Support/Counter triggers return to the card footer` | `aa9f5b9` | 22 |
| C21 | `feat(debate): the author row becomes one line and the chip carries entry price` | `3ea43e4` | 12, 13 |
| C22 | `feat(debate): the focused post shows a teaser and a + expand` | `f811151` | 15 |
| C23 | `feat(debate): the scrollers take a vertical rail` | `3ac25ce` | 18, 19, 29 |
| C24 | `feat(debate): the market-arm entry trigger reads Buy` | `a24bbbf` | 20 |
| C25 | `feat(debate): the held-side Sell affordance takes button shape` | `883b514` | 21 |
| C26 | `feat(debate): the reply card takes the mockup's anatomy` | `b66018e` | 26 |
| C27 | `feat(debate): reply cards open a pop-up and their images open the lightbox` | `bc9404b` | 27, 34 |
| C28 | `feat(debate): the pop-up head takes the mockup's cluster and resets its scroll` | `7d5121f` | 33, 35 |
| C29 | `feat(debate): entering a post resets the page scroll` | `92e4cc6` | 36 |
| C30 | `feat(debate): author pseudonyms link to their profile` | `0c54240` | 42 |

**Rows landed: 3, 10, 12, 13, 15, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 29, 33, 34, 35, 36, 42.**
**Rows halted: none in phase 3.** ⇒ H3-a…H3-f all clear.

### Decisions made

1. **H3-a was DISCHARGED, not dodged.** The kickoff supplied the SPEC.1 §9
   decision text verbatim; CC applied it at all four operative sites (O-4) and
   authored none of it. `tests/unit/ranking/replies.test.ts` is green
   **unamended**, which is the amendment's own central claim.
2. **H3-e never fired, by design.** Row 27's `ReplyPopup` takes
   `PresentReply | null` — `Extract<DebateReply, {removed:false}>` — so a
   removed reply is unpassable at the type level. Widening `PostPopup`'s union
   is the thing H3-e halts on, and a separate component avoids it entirely.
3. **Four hand-rolled author rows collapsed into one `ArgProfile`** across rows
   12, 26 and 33. That is why row 42 was ONE change reaching five surfaces.
4. **`FocusMarketCard` carries no sparkline** — the locked composition
   (design-language §3.2) struck it, and its "identical everywhere" clause is
   retained and load-bearing.
5. **Row 18/19's rail keeps its `aria-live` readout.** d5's rail announces
   nothing; a literal port would have deleted the position announcement.

### Surprises caught + fixed in-session

- **The side-badge census fired FOUR times in one PR, in both directions.**
  ArgProfile left the base map (row 13 varies the preset by prop), ReplyCard
  dropped one site (row 26), `dialogs.tsx` gained one (row 27) and then lost
  both (row 33). Every move is recorded beside its cause; the non-vacuity floor
  was lowered 13 → 12 **with grounds** because the inventory genuinely shrank.
- **⛔⛔ THE CENSUS COULD NOT SEE ROW 13's WIRING, and that is the sharpest
  finding of the phase.** `wiredDetail` scans `<SideBadge …/>` MARKUP, but
  `ArgProfile` owns the badge and varies it by PROP — so the literal `detail`
  lives on `ArgProfile`'s call site (`chipSize="detail"`), and the filter would
  have returned `[]` and stayed GREEN while a `detail` chip shipped. The census
  now scans BOTH channels. Satisfying the letter of a guard while breaking the
  property it names is not a pass — the same trap this run refused at row 5.
- **`O-7`'s default inverted exactly once** (`reply-card::the-pseudonym-renders-ONCE`).
  Row 42 made the pseudonym a link, so `innerHTML` contains it inside the `href`
  and a correct render counts 2. The count moved to `textContent` — the subject
  there is how many times the reader SEES the name — with the markup half
  asserted separately.
- **Row 35's defect only appears on the SECOND open.** `DialogContent` is
  `overflow-y-auto` and shadcn keeps the node mounted, so a mount-only reset
  would fire once and never again — the shape of the bug rather than its fix.

### Open questions

- **OQ-MD-8 · Two composer strings still say `Đ BET`.** Row 20 relabelled the
  colhead to `Buy`, but `COMPOSER_COPY.header` ("Place your Đ BET") and
  `.submit` ("PLACE Đ BET") live in `composer/copy.ts`, which §11 excludes. So
  the colhead reads `Buy` and opens a composer that still says `Đ BET`. ⇒ One
  commit, with a fence that includes `composer/copy.ts`.
- **OQ-MD-9 · One duplicated pole recipe.** Row 22's card pills re-state
  `ReplySplitBar`'s `TriggerPill` CSS because that component is file-private and
  its file is allow-list-excluded. The SIDE DERIVATION is shared
  (`deriveReplySide` / `isEntryDisabled`), so the two cannot disagree about
  which side a relation produces — only the styling can drift. ⇒ Unifying needs
  `composer/ReplySplitBar.tsx` in the fence.

### Next session starts at

The founder's rulings on **OQ-MD-1 … OQ-MD-9**. The three build-blocking ones
are OQ-MD-1 (row 5, needs a web-authored §9 amendment), OQ-MD-2 (rows 7 + 8,
need one allow-list line — the work is built and was green) and OQ-MD-4 (row 14,
needs OD-1 re-ruled with the removal-oracle cost in the record).

### Context to preserve

- **AGENTS.md §3 and §9 were updated in the close-out commit** (§15.2): the
  `debate/` component list gains five components, and `tests/unit/design/` now
  holds FOUR height chains. Descriptive drift, folded here rather than deferred
  to a SYNC, because §3 explicitly enumerates the tree.
- **CLAUDE.md §1's SPEC.1 version was corrected 1.0.29 → 1.0.31** as a
  same-commit rider on C15, never as a follow-up.

### Time

Phase 3: 2026-08-16 01:28 → 02:20 UTC (C15 `5b09ef2` → C30 `0c54240`).

⚠ These are read off the commit timestamps. An earlier draft of this log carried
estimated wall-clock times that were wrong by hours — corrected here rather than
left to mislead the next session's planning.

---

## ROUND 2 · FOUNDER REFINEMENT PASS — complete, **nine rows, nothing halted**

A second pass after the founder reviewed round 1 on staging. Three web-reviewer
rulings were REVERSED at kickoff (OD-2, D8, C1B), and all four of round 1's
halts are now discharged.

### What landed

| Commit | SHA | Rows |
|---|---|---|
| `feat(debate): /m/[slug] takes the widest existing container preset` | `a096f06` | **R1** (C1B) |
| `feat(debate): the card's aggregate reads bare, and its title answers the pointer` | `2cdc89a` | **R5, R6** |
| `fix(bookmarks): the bookmark affordance is unconditional on every card` | `e5dd4bf` | **R4** |
| `feat(debate): the detail price bar becomes one row and its labels are live` | `d9ffb58` | **R7** (rows 7 + 8) |
| `feat(debate): the collapsed price chart carries a time axis` | `5a9400d` | **R8** (row 5) + SPEC.1 **1.0.32** |
| `feat(debate): the four placeholders ship with byte-carried chrome` | `074f86c` | **R2** |
| `feat(debate): the arena advances itself, and the rail counts down to it` | `a3af859` | **R3** |

**R9 was investigate-only** and is answered below. ⛔ **Nothing was built for it.**

### ✅ ALL FOUR ROUND-1 HALTS DISCHARGED

| Halt | Was blocked on | Discharged by |
|---|---|---|
| **H-C5** (row 5) | a web-authored SPEC.1 §9 amendment | ruled text supplied at kickoff; applied at all four operative sites → `5a9400d` |
| **H-C7** (rows 7 + 8) | ONE line of allow-list | founder extended it by that one file → `d9ffb58` |
| **H-C1B** | a ruling, or a re-measurement once staging had data | BOTH — founder ruled it in, and it was re-measured on staging → `a096f06` |
| **H-C13** (row 14) | OD-1 re-ruled | ⛔ **STILL OUT** — §2 keeps row 14 out as its own task. Not discharged, deliberately. |

### Measurements — taken BEFORE any code was written

⚠ Every one of these is in a real browser against **live staging** (`070c243`) at
`/m/sp-m15-fill`, the founder's own screenshot URL, signed in as `RedFox000`.

- **R3 — the arrows are NOT broken.** Both columns hold 2 posts; both rails
  render; `Previous` was correctly `disabled` at index 0 and `Next` live.
  Clicking `Next` advanced the card, moved the readout `1 / 2` → `2 / 2` and the
  fill 50% → 100%. ⇒ Correctly end-clamped. What was missing is what the BAR was
  for — a static read-through proportion that never moved.
- **R3 — `router.refresh()` reconciles, it does not remount.** 10 RSC responses
  across ~38 s (≥2 poll ticks) with the paged card and its readout unchanged.
  ⚠ **The first attempt was VACUOUS**: `document.hidden` was true, the poll was
  suspended, and nothing fired. A sampler that observes nothing proves nothing.
- **R4 — the bookmark cause is own-suppression.** The page rendered exactly ONE
  bookmark button; the card missing it is `RedFox000`'s own argument.
  `BookmarkToggle.tsx:85` returned `null` on own content (BOOKMARK-ADD-WIRE D4).
- **R1 — the container.** At a 1440 viewport: container 1024 (capped by
  `max-w-5xl`), headzone-left 716, headzone-right 244.

### Decisions made

- **R1 — `wide` is CONSUMED, never re-minted.** `PageContainer.tsx` untouched
  (H1-b holds); `/m/[slug]` is its THIRD consumer after Profile and `/bookmarks`.
  `page-container.test.ts`'s ruled-move enumeration goes `[2, 5]` → `[2, 5, 9]`.
- **R4 — DISABLED on own content, not enabled, and that is FORCED.** `add.ts:62`
  rejects a self-bookmark; an enabled icon would flip optimistically, get
  `{ ok: false }` and silently revert — a control that can never succeed, which
  is worse than the absence the founder objected to. Making it succeed would mean
  a fourth `src/server/**` file, which §2 forbids outright.
- **R3 — the cadence is `POLL_INTERVAL_MS_DEBATE_VIEW`, never d5's 20 s.**
  "Duration" is in the value list. The reuse is argued, not merely convenient:
  each card is shown for exactly one data-refresh window. Stagger is
  `ADVANCE_MS / 2` — a ratio, which is composition.
- **R3 — the arrows stop disabling and the list WRAPS.** End-clamping and
  auto-advance cannot both be right. Accessibility cost is zero: the `disabled`
  state announced "you are at the end", and with wrap there is no end.
- **R3 — ←/→ only.** d5's ↑/↓ stepping is not ported: d5 `preventDefault()`s
  every arrow because its surface does not scroll, and this page does.
- **R8 — the axis ticks are ANCHORED TO SERIES POINTS**, not placed at fixed
  thirds with an interpolated date. The ruling's own constraint is that every
  timestamp rendered is already on `PricePoint.at`; interpolating would mint one
  the series does not contain.
- **R2 — chrome and labels ship, DATA FIELDS STAY EMPTY.** The four labels are
  byte-carried and hexdumped; d5's `.resname`/`.ressrc` demo copy names a market
  this build does not have and would be inventing market content (§3).

### Surprises caught + fixed in-session

- **⚠⚠ R5 LEFT A SPEC CONTRADICTION AND IT WAS CAUGHT ONE COMMIT LATE.** SPEC.1
  §9 F-DEBATE-1 System (`:447`) named the aggregate footer as
  `Support (count) : Đ / Counter (count) : Đ` — the exact form R5 replaced at
  `2cdc89a`. That is the **O-9** defect: the build changed a render a governing
  document describes, and no rider went with it. Fixed as a same-commit rider on
  `5a9400d`, applied at BOTH operative sites (SPEC.1 and **design-language §3.1**)
  per O-4. ⛔ The substance was never touched: still a read-time aggregate over
  reply-bets, still no vote control.
- **The R8 guard would have gone GREEN past a wrong build.** Round 1 flagged it;
  it was real. d5 draws its ticks as DIVS outside the `<svg>` and the guard
  asserted absence of testids inside the component, so a literal port would have
  satisfied the letter while breaking the property. The axis is built INSIDE the
  `<svg>` and the guard now asserts **containment**. ⚠ Non-vacuity of that check
  was PROVEN by a throwaway probe (written, run, deleted): with a d5-shaped tick
  div appended beside the chart, `querySelector` finds it and `svg.contains(el)`
  returns `false`.
- **Two FALSE REDS in the R3 tests, both looking like product defects.** A single
  `act(() => vi.advanceTimersByTime(45_000))` silently under-counts — the timer
  re-arms through React and `act()` flushes effects at its END, so three cadences
  of jump produced ONE advance. It read as "the list does not wrap" and "the
  unpicked column's bar is dead". Neither was true. Recorded in the test file.
- **Biome rejected the first R3 draft's effect deps** (`progressKey` listed but
  never read). ⛔ The rule was NOT disabled — AGENTS.md §11 makes that ask-first.
  Both effects were restructured instead, and both came out better: a
  self-running interval in `scrollers.tsx`, and a `CountdownFill` remounted by
  key in `ScrollRail`.

### R9 — the investigation, answered

**There is NO per-post export.** The only export on the tree is
`src/app/(public)/m/[slug]/export/route.ts` — market-level, ADR-0025. It composes
`loadDebateView` + `loadExportMarketMeta` + `readContextBlock` and hands the WHOLE
`DebateViewModel` to `serializeDebateExport`, which takes no comment scope.
`src/server/debate-export/` exports exactly three functions and none is
comment-addressable; nothing under it mentions `commentId`.

⇒ **A per-card download is NEW FUNCTIONALITY and its own task.** It needs a
comment-scoped serializer, a route, and a masking decision (a removed comment
must not be exportable by direct id). ⛔ Nothing was built.

⚠ Context for whoever picks it up: `BookmarkToggle.tsx`'s `CardActions` docblock
already anticipates it — *"Wiring the ADR-0025 export remains a separate task;
when it lands it arrives as an `<a href download>`, not as a disabled button."*
The per-card download trigger was REMOVED at POLISH.3 PR 2 row 7 (`PD-3-15`).

### Fence extensions — declared, never smuggled

The kickoff pre-authorised ONE (`price-bar-presets.test.tsx`, for R7). Four more
were taken, each named in its own commit body:

| File | Row | Why no in-fence edit reaches it |
|---|---|---|
| `src/components/bookmarks/BookmarkToggle.tsx` | R4 | The bug IS that branch. Blast radius verified: `CardActions` has exactly ONE render consumer in `src/` (`debate/ArgProfile.tsx`) — `/bookmarks` uses `UnbookmarkButton` and Profile ships no cluster at all. |
| `docs/design/design-language.md` | R5 rider | O-4: an amendment applied at one of two operative sites reverses nothing for a reader who reaches the other first. No guard reads the file. |
| `docs/parked.md` | R2 | The kickoff asked for the docket row in terms. |
| `tests/unit/debate/render/auto-advance.test.tsx` (NEW) | R3 | Three of R3's laws are about how the two columns relate; a scroller rendered alone cannot exhibit any of them. |

### Reviewer cascade — NOT run, and why

§5.11 routes `@code-reviewer` on `src/server/**` changes and `@security-auditor`
after it on critical-path logic. ⛔ **Round 2 touches ZERO `src/server/**` files**
— `limits.ts` is READ (`POLL_INTERVAL_MS_DEBATE_VIEW`) and never written. No
§5.11 trigger fires, and the kickoff's §3 MECHANICS names no reviewer. Stated so
the omission reads as scope, not as a skip.

### Open questions

- **OQ-MD2-1 · `HTML-FINISH-MD-PLACEHOLDERS` needs a strip-or-gate ruling before
  DP.2.** Docketed at `docs/parked.md` SEQUENCE #5 with both shapes costed.
  ⚠ Cards 3 and 4 have a THIRD exit: the moment resolver data exists they stop
  being placeholders and become the real cards.
- **OQ-MD2-2 · The R5 spec rider is CC-authored under the founder's R5 ruling.**
  The kickoff supplied ruled text for R8 only. The substance was preserved and
  only the label sentence moved, but the founder should confirm the wording.
- **OQ-MD-9 (carried) · one duplicated pole recipe** — unchanged from round 1.
- **Row 14 stays out** (§2), as does row 32 and rows 30/31.

### Next session starts at

The founder's review of round 2 on staging, and rulings on OQ-MD2-1 and
OQ-MD2-2. ⛔ PR #341 is still a DRAFT and is NOT merged.

### Context to preserve

- **The verify gate needs an env prefix in this worktree.** No `.env.local`,
  `just` sets `dotenv-load := true`, so `next build` dies collecting page data
  for `/admin/markets/media/sign` on `DATABASE_URL is not set`. The gate runs
  with the `tests/_setup/env.ts` PLACEHOLDERS exported inline (they must be SET,
  not connected) plus `ZUGZWANG_ENV=preview`. ⛔ No `.env*` file is read.
- **`just` is on the mise shims path** — a `bash` subshell does not have it
  (round 1 recorded this; round 2 hit it again).
- **The staging error boundary fired once during measurement**, after 15 forced
  polls in 43 s. A reload recovered immediately. Almost certainly self-inflicted
  load — each poll re-runs `loadDebateView`'s 13-14 sequential queries against a
  Supavisor `pool_size 15` — against a fix landing in parallel on
  `fix/db-pool-idle-timeout`. ⛔ NOT a branch defect; that branch was not touched.

### ✅ H-R2-STAGING — RESOLVED IN-SESSION, and the fix is a PUSH-ORDER rule

**Final state: `staging.zugzwangworld.com` serves `f2eb49d`, the branch HEAD.**
`/api/health` → `{"status":"ok","env":"staging","canary":"f2eb49d…","region":"bom1","db":"ok","migrations":"ok"}`.

**What went wrong the first time, and the rule that comes out of it.** The branch
was pushed FIRST, so Vercel built `ref=htmlfinish/market-detail` @ `4cd1c15`; the
`staging` push of the IDENTICAL SHA seconds later produced NO second deployment —
deduplicated on the commit SHA — so no `ref=staging` deployment existed for the
domain to follow, and it kept serving `070c243` for 25+ minutes.

⇒ ⚠⚠ **PUSH `staging` BEFORE THE BRANCH, or push only one of them.** Confirmed by
the fix: the log commit `f2eb49d` reached `staging` at a SHA no branch deployment
had claimed, a `ref=staging` deployment was created, and the domain flipped within
~2 minutes. Round 1 did not hit this because its final SHA reached `staging`
without a same-SHA branch deployment landing first.

⛔ **What was NOT done, deliberately:** forcing an unrelated commit onto `staging`
to break the dedup. That makes `staging` diverge from the branch SHA, which the
next lease and the O-4 restore both rest on.

✅ The O-4 restore point is unaffected: `bc18245786fd04fde0e90f5618f479428586113b`.

### ⛔⛔ H-R2-POOL — STAGING'S DB PATH IS DOWN, AND IT IS NOT THIS BRANCH

**The nine rows COULD NOT be visually verified on staging**, and the reason is
infrastructure, proven rather than assumed.

Every DB-backed route renders the error boundary. From the Vercel runtime logs:

```
GET /m/sp-m15-fill 500
  Error: Failed query: select "id","slug","title","description","status",
                       "media_video_url" from "markets" where slug = $1 …
  [cause]: (EMAXCONNSESSION) max clients reached in session mode
           — max clients are limited to pool_size: 15
  code: 'XX000', severity_local: 'FATAL'
```

**Four independent facts put it outside round 2's diff:**

1. The failing query is **`getMarketBySlug`'s first `select`** — the very first
   statement on the route, in a file this round never touched.
2. The cause is `EMAXCONNSESSION` at the **Supavisor pooler**, a connection-limit
   FATAL, not an application error.
3. **Better Auth's own session read fails identically**, with nothing to do with
   the debate view.
4. ⛔ **Discovery (`/`) fails the same way**, and Discovery has ZERO round-2
   changes. An outage that reaches an untouched route is not this branch's.

⚠ It also fired on `070c243` — the PRE-round-2 build — during the R3 measurement,
after 15 forced polls in 43 s.

⚠⚠ **AND `curl` SAID 200 THREE TIMES WHILE THE PAGE WAS BROKEN.** Next streams:
the HTML shell goes out with a 200 and the RSC render throws afterwards, so the
status code cannot see it. A curl status check is a FALSE RECEIPT for this class
of failure — the browser and the runtime logs are the real gauges. Recorded
because it very nearly ended the session on a wrong all-clear.

**Contributing load, declared:** the R3 measurement forced ~15 polls, and each
poll re-runs `loadDebateView`'s 13-14 sequential queries; the new deployment then
added cold instances. But the ceiling is `pool_size: 15` shared across staging AND
every preview, and Vercel Fluid SUSPENDS instances so `postgres.js` idle timers
never fire to release slots.

⇒ **This is exactly what `fix/db-pool-idle-timeout` is for**, and the kickoff
forbids touching that branch or `src/db/index.ts`. ⛔ Neither was touched.

**What it takes:** land the pool fix, or wake/kill the suspended instances to free
the slots. Then re-verify the nine rows on staging.

### (superseded) H-R2-STAGING — the staging SITE did not pick up the advance

`origin/staging` IS at `4cd1c15` (force-pushed under a verified lease) and
`Staging Migrate` returned success on it. But `staging.zugzwangworld.com` is
still serving `070c243`, measured ~25 min after the push:

```
staging.zugzwangworld.com/api/health   canary 070c243…
experiment-kb7h3go87-….vercel.app      canary 4cd1c15…   ← READY, env staging, db ok
```

⇒ **The build is fine; only the DOMAIN ALIAS did not move.** Cause is a PUSH-ORDER
artifact: the branch was pushed first, so Vercel built `ref=htmlfinish/market-detail`
@ `4cd1c15`, and the `staging` push of the identical SHA seconds later produced no
second deployment — deduplicated on the commit SHA. No `ref=staging` deployment
exists at that SHA, so the domain still follows the `070c243` one.

⛔ Not fixed from the session: no alias/redeploy tool is available and the Vercel
CLI is not installed. ⛔ Forcing a NEW commit onto `staging` would work and was
deliberately NOT done — it makes `staging` diverge from the branch SHA, which the
next lease and the O-4 restore both rest on. Operator's call.

**One step, either:** alias `experiment-kb7h3go87-zugzwang-worlds-projects.vercel.app`
to the staging domain, or redeploy the `staging` branch at `4cd1c15`.

⚠ **NEXT ROUND: push `staging` BEFORE the branch**, or push only one. That
ordering is what caused the dedup.

✅ The O-4 restore point is unaffected: `bc18245786fd04fde0e90f5618f479428586113b`.

### Time

Round 2: 2026-08-16 12:20 → 14:20 UTC (`a096f06` → `4cd1c15`).
