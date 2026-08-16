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
