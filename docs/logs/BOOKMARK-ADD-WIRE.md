# BOOKMARK-ADD-WIRE (B1) — session log

| | |
|---|---|
| **Task** | `BOOKMARK-ADD-WIRE` ("B1") — wire the bookmark add path on the debate view |
| **Plan** | `docs/plans/BOOKMARK-ADD-WIRE.md` (committed this session at `3287b6b`) |
| **Branch** | `feat/bookmark-add-wire`, worktree `/private/tmp/zz-bookmark-add-wire` |
| **Ground** | `origin/main` @ `b6495af` (PR #272, ADR-0034). `git merge-base --is-ancestor b6495af origin/main` → exit 0 |
| **Session** | Two passes, 2026-07-30. **Pass 1:** unattended overnight execute → **HALTED at H6**. **Pass 2:** operator-directed Gate-C remediation (R1–R7) → complete |
| **State** | Slices 0, 1, 2, 3, 5 landed green; the HIGH remediated. DRAFT PR #273 open, nothing merged, no branch deleted |

---

## Pass 2 — Gate-C remediation (R1–R7)

The operator ratified the HIGH and the fix placement (`key` on the toggle **inside**
`CardActions`, not on `<PostCard>` in `scrollers.tsx` — it remounts only the stateful leaf
and leaves scroll position, image loads and animation state alone), then authorised Slices
3 and 5. The halt doctrine H1–H10 stayed in force; nothing else halted.

### R1 · Hook enumeration — is the narrow fix sufficient?

**Answer: YES.** The `PostCard` + `PostFocusHeader` subtree contains exactly **three** hooks,
across every component and every `ui/` primitive:

| # | Site | Initial value | Post-dependent? |
|---|---|---|---|
| 1 | `BookmarkToggle.tsx:66` — `useState(() => bookmarks?.saved.has(commentId) ?? false)` | derived from `commentId` | **YES — this is HIGH-1** |
| 2 | `BookmarkToggle.tsx:69` — `useTransition()` | none | no |
| 3 | `ReplyPreview.tsx:20` — `useState(false)` for `expanded` | the literal `false` | **no** |

Everything else is stateless: `PostCard`, `PostFocusHeader`, `ArgProfile`, `ReplyCard`,
`badges`, `CommentImage`, `placeholders`, `AggregateFooter`, `format`,
`composer/ReplySplitBar`, and the `ui/` primitives `button` / `card` / `badge` / `avatar`.
`ui/avatar` wraps radix, whose `AvatarImage` does hold internal image-loading state — but
radix keys it off `src` via an effect dependency, so it re-derives on a reused instance
rather than persisting a stale value. `@code-reviewer` independently reproduced this
enumeration and agreed it is complete.

**Related finding, reported and deliberately NOT fixed.** `ReplyPreview`'s `expanded` does
not meet R1's halt criterion (its initial value is a constant), but the same un-keyed
reconciliation makes the flag *persist* across a post change: expand post #1's replies, page
to post #2 → #2 renders expanded. It is **pre-existing on `origin/main`** — `ReplyPreview.tsx`
is 0-diff from `b6495af`, and `git show b6495af:src/components/debate/scrollers.tsx` already
renders `<PostCard>` un-keyed — and it is cosmetic (post #2 shows *its own* replies, in the
wrong layout; no wrong data, no wrong server call). `@code-reviewer` verdict: out of scope,
not this PR's to own, not a halt. **Docketed** for a future keying pass (reset `expanded` on
a `replies`-prop change, or key `ReplyPreview` by the post id). Widening the fix was not
authorised and was not done.

### R2 · RED → GREEN → mutation

Two cases were written **before** the fix, both placed where the fix actually applies (a
bare `<BookmarkToggle>` rerender has no keyed parent above it and would stay red after the
fix, proving nothing):

- `card-actions::rerender-with-new-comment-reflects-new-saved-state`
- `post-scroller::paging-to-an-unsaved-post-drops-the-filled-icon` — the real user path,
  driving the actual `ScrollerNav` "Next post" control.

| Stage | Result |
|---|---|
| **RED** (pre-fix HEAD `44502a0`) | `Tests 2 failed \| 15 passed (17)`. Both failed with `Unable to find an accessible element with the role "button" and name "Bookmark"`, and the printed DOM showed the stale `aria-label="Remove bookmark"` / `aria-pressed="true"` — the defect itself, not a typo |
| **GREEN** (post-fix) | `Tests 17 passed (17)` |
| **MUTATION** (key removed again) | `Tests 2 failed \| 15 passed (17)` — exactly the two new cases |
| **RESTORED** | `Tests 17 passed (17)`; source md5 identical before and after |

### R3 · The fix

One line, `bc84851`. `key={commentId}` on the `<BookmarkToggle>` rendered inside
`CardActions`, plus the comment explaining why it is load-bearing. Optimistic state was
**not** lifted to `DebateView` — D5 stands.

### R4 · `@code-reviewer` re-review

**No CRITICAL / HIGH / MEDIUM.** Q1 (does the test bind): yes — the key is the *sole*
remount trigger in the `PostScroller → PostCard → ArgProfile → CardActions → BookmarkToggle`
chain (every intermediate site is un-keyed and `bookmarks` is a stable reference), the
`PostScroller` case drives the production interaction rather than faking a remount, and both
assertions require the fresh state so stale state can satisfy neither. Q2: enumeration
complete and correct; narrow fix sufficient; `ReplyPreview` out of scope.

Two LOW notes, neither actionable here:
- **L1** — the `ReplyPreview` `expanded` persistence above (pre-existing, docketed).
- **L2** — an accepted D5 consequence now made explicit: because the key remounts the toggle
  on paging, a bookmark toggled *this session* loses its optimistic icon on a paging
  round-trip (post #1 → Next → Prev re-seeds from the frozen server snapshot). Re-clicking
  fires an **idempotent** add bounded by `UNIQUE(user_id, comment_id)`, and it self-heals on
  the next server render. This is strictly better than the pre-fix behaviour, which fired a
  phantom `removeBookmarkAction` against a never-existent row. The only remedy is lifting
  optimistic state to `DebateView`, which is explicitly fenced off — recorded, not fixed.

### C-1 · Citation correction (Gate C, operator-authored)

SPEC.2 cited **ADR-0034 D-4** for own-argument suppression in two places. That citation is
wrong, and the error originated in the web-authored §4.2 replacement text this session was
told to paste verbatim — pasting it unchanged was correct; correcting it is a separate,
legible commit (`68f9408`), **no version bump**, so 1.0.21 is fixed in place before merge.

Verified before editing (verify-don't-trust, and the kickoff made this a HALT condition):

- **ADR-0034 D-4** is *"ID-only, and never a masking input"* — identifiers only, never
  consulted as a masking input. It says nothing about own-suppression. `grep -c -i
  "own-argument|own argument|self-bookmark|others-only" docs/adr/0034-*.md` → **0**.
- **ADR-0032 D-3** *is* *"Others-only guard (self-bookmark prohibition)"* — app-layer, with
  the UI hiding the affordance as the primary arm and `addBookmarkAction`'s
  `viewer === author` rejection as defense-in-depth. The replacement citation is correct, so
  no halt.

Both loci corrected verbatim from the operator's text; repo-wide `grep "ADR-0034 D-4"` → **0**.

### C-3 · `@security-auditor` on Slice 3 — masking-directed

Not in the plan's cascade (an operator omission, corrected at Gate C). Slice 3 is the only
place in this PR where a safety-critical guarantee rests on branch placement plus one test
rather than on the type system.

**Verdict: no CRITICAL / HIGH / MEDIUM.** All five directed points answered separately:

- **(a) Can an affordance reach a removed REPLY by any path?** No. `ReplyCard` has exactly
  two render sites (`scrollers.tsx:130`, `ReplyPreview.tsx:38`) and the cluster is
  constructed at exactly one place (`ReplyCard.tsx:57`), inside the non-removed branch. The
  three reply groups are irrelevant: `buildReplyGroups` masks removed replies into the
  `{removed:true}` variant across **support, counter and twoSlot** alike, before
  `ReplyGroups` is built, and it is re-checked at the leaf.
- **(b) Does the guard test bind?** Confirmed **by independent mutation**, not by reading
  this log: injecting `<CardActions>` into the removed branch failed **exactly one** test —
  `reply-card::removed-reply-renders-no-cluster` — with the other 22 passing; restored
  byte-identically (md5 `76fa44ac550e3f77e5391ea5564c99a9` before and after, `git status`
  clean). It is the **sole** guard suite-wide. The `querySelectorAll("button").length === 0`
  assertion is the strong one, because `CardActions` renders the Download `<button>`
  unconditionally even when the bookmark is own-suppressed to `null`.
- **(c) Does removal cascade to a removed post's live replies?** No, and it should not.
  `loadRemovedSet` keys on each comment's **own** id; `buildReply` masks iff
  `removedSet.has(sub.id)`. Parent removal is never an input anywhere in the reply-building
  path. This is ADR-0021's thread-integrity posture — the parent renders a placeholder, the
  thread stays intact — so an affordance on a live reply under a removed post is intended,
  not an inherited leak.
- **(d) Does Q-B return replies?** **Yes.** `comments` is one self-referencing table
  (`parent_comment_id` NULL for posts, set for replies), and Q-B filters on `user_id` AND
  `market_id` **only** — no `parent_comment_id IS NULL` or equivalent. Own-suppression covers
  replies end-to-end, test-locked by
  `reply-card::own-reply-renders-no-bookmark-but-keeps-download`. The warned-of defect (an
  active icon on the viewer's own reply, which the write path would then reject with
  `self_bookmark_forbidden`) does not materialise.
- **(e) Can either id set influence CONTENT?** No. Each set has exactly one consumer
  (`DebateView.tsx:115` / `:116`), feeding two sites in `BookmarkToggle` — the fill seed and
  the `own.has → null` icon suppression. No content branch reads `bookmarks`. Worst case for
  a corrupted set is a wrong icon, never a rendered or withheld argument. ADR-0034 D-4 holds.

Two LOW notes, both carried:
- **The reply removed-branch has no type-level lock** — a standing hazard for the *next*
  caller, not this tree.
- **The `querySelectorAll("button")` backstop is element-shaped.** Airtight today because
  every affordance is a `<button>`. When the ADR-0025 export button is wired — naturally an
  `<a href download>` — a cluster leaked into a removed branch with an own-suppressed
  bookmark could render **zero** `<button>` elements and evade the length-0 assertion, and
  the two `queryByRole` name-checks would miss a relabelled control. **Docketed to the
  download-wiring task: re-assert the guard with an element-agnostic selector.**

### R7 · AGENTS.md §9

Docketed, not changed. AGENTS.md §9 reads as "no component-test harness exists", which is
false on disk (see the Pass-1 surprise below). **No line of AGENTS.md was touched.**

---

## HALT (Pass 1) — the reason, stated first

**The run halted on kickoff condition H6: "Any reviewer returning CRITICAL or HIGH."**

`@code-reviewer` returned **one HIGH** on Slice 2. It is a genuine defect in code this
session wrote, it is not covered by the plan's accepted carry, and I stopped rather than
improvise past the halt. **I did not apply the fix** — the halt doctrine's prescribed
procedure is commit-what-is-green → push → DRAFT PR → log → stop, and it does not
authorise working past the finding. The fix is one line, specified below, for the
operator to rule on at Gate C.

### HIGH-1 · Stale bookmark-icon state across `PostScroller` paging

> **STATUS: REMEDIATED in Pass 2** (`bc84851`), test-locked RED→GREEN→mutation. The
> account below is the Pass-1 record, kept verbatim as the root-cause analysis.

- **Where:** `src/components/debate/scrollers.tsx:87` (`<PostCard>` rendered with **no
  `key`**) × `src/components/bookmarks/BookmarkToggle.tsx:66`
  (`useState(() => bookmarks?.saved.has(commentId) ?? false)` — a lazy initialiser that
  runs **only at mount**).
- **Mechanism** (verified independently, not taken on the reviewer's word): `PostScroller`
  pages posts by mutating its own `index` state, re-rendering the *same* `<PostCard>`
  element at the same tree position with a new `post` prop and no `key`. React reconciles
  that to the same instance, so `PostCard → ArgProfile → CardActions → BookmarkToggle`
  **update in place rather than remount**. The `saved` initialiser therefore never re-runs
  for the newly-displayed comment, and the icon keeps the previous post's fill.
- **Failure:** a signed-in viewer has bookmarked post #1 but not post #2, same side. #1
  renders filled (correct). "Next post" → #2 renders **filled** (a lie). Clicking it fires
  `removeBookmarkAction(#2)` — a no-op DELETE against a row that never existed. The
  reverse case fires a no-op add. Signed-out and own-suppression are unaffected (both read
  the live prop); only the saved/unsaved fill on *other users'* posts is wrong.
- **Why this is NOT the accepted carry:** plan edge case 6 / self-critique #2 accept
  divergence between *two mounted instances of the same comment*. This is *one instance
  showing a different comment's state*, and it does **not** self-heal — paging triggers no
  server render (there is deliberately no `router.refresh()`, D5), so the stale fill
  persists until a full page reload. The plan under-scoped this as "a rare
  simultaneous-mount case" and did not account for scroller paging, which is the mainline
  interaction on any 2+-post side.
- **Aggravator:** a `useTransition` request still in flight when the user pages will run
  its revert `setSaved(!next)` against the now-different comment.
- **Minimal fix (applied in Pass 2 as `bc84851`):** key the toggle by its target in
  `CardActions` — `<BookmarkToggle key={commentId} … />` at `BookmarkToggle.tsx:144`.
  This also pre-empts the identical latent bug when Slice 3 pages the cluster in
  `ReplyScroller`. Alternative: `key={post.id}` on `<PostCard>` at `scrollers.tsx:87`.
- **Test gap it rode through:** all 15 render cases fresh-`render()` a toggle; none
  `rerender()`s a mounted toggle with a changed `commentId`. The suite is 15/15 green with
  the defect present. A regression case for the paging path is owed with the fix.

**Nothing else halted.** H1–H5 and H7–H10 were never approached: no DDL/migration want,
`load-debate-view.ts` zero-diff, `add.ts`/`remove.ts` untouched, masking inheritance
confirmed, no stake/side/rank/Dharma surface, no `src/**/profile/**` reference, no
`--no-verify`, no touch of the primary tree or another session's DB.

---

## What landed

| Commit | Subject | Files |
|---|---|---|
| `3287b6b` | `chore(plans): BOOKMARK-ADD-WIRE — ratified build plan (B1)` | `docs/plans/BOOKMARK-ADD-WIRE.md` (+401) |
| `30ceaad` | `feat(debate): BOOKMARK-ADD-WIRE slice 1 — viewer-scoped bookmarked/own comment ids (ADR-0034)` | `src/server/debate-view/viewer-context.ts` (+70) · `tests/integration/viewer-context.integration.test.ts` (+316) · 2 DTO fixtures (+4 each) |
| `44502a0` | `feat(debate): BOOKMARK-ADD-WIRE slice 2 — live bookmark toggle on post cards` | `src/components/bookmarks/BookmarkToggle.tsx` (new, +156) · `UnbookmarkButton.tsx` · `ArgProfile.tsx` · `PostCard.tsx` · `PostFocusHeader.tsx` · `scrollers.tsx` · `DebateView.tsx` · `tests/unit/debate/render/bookmark-toggle.test.tsx` (new, +336) |

| `878e502` | `chore(debate): log session — BOOKMARK-ADD-WIRE slices 0-2, halted at H6` | `docs/logs/BOOKMARK-ADD-WIRE.md` |
| `bc84851` | `fix(bookmarks): remount the toggle on comment change (Gate C remediation)` | `BookmarkToggle.tsx` (the key) · the 2 RED-first cases |
| `9016e1f` | `feat(debate): BOOKMARK-ADD-WIRE slice 3 — full cluster on reply cards` | `ReplyCard.tsx` · `ReplyPreview.tsx` · `scrollers.tsx` · `PostCard.tsx` · `DebateView.tsx` · +6 render cases |
| `8c5c8c0` | `docs(spec): SPEC.2 1.0.21 — BOOKMARK-ADD-WIRE riders (six amendments)` | `docs/specs/SPEC.2.md` |

All seven commits SSH-signed (`%G?` = `G`, GitHub-verified), author **and** committer
`Zugzwang/world <zugzwangworld@proton.me>`, subject-only messages, no `Co-authored-by`.

**Slice 0** (re-ground, no code): baseline full suite green at **280 files / 1997 tests**
(1 skipped, 4 todo), exit 0.

**Slice 1** — `ViewerMarketContext` gains `bookmarkedCommentIds` + `ownCommentIds`, two
additive ID-only SELECTs (Q-A joins `bookmarks`→`comments` for the market filter and
projects only `bookmarks.comment_id`; Q-B projects `comments.id` on `(user_id, market_id)`)
inside the **existing** read-only transaction. Statement count 3–4 → 5–6. Arrays, not
`Set`s (a `Set` does not survive the RSC→client boundary). `loadDebateView` untouched, per
ADR-0034. Tests-first via `@test-writer`: RED proven (7 new failing, 6 pre-existing passing;
`tsc` erroring only on the two missing DTO properties), then green.

**Slice 2** — `BookmarkToggle` owns the whole icon matrix as a single source; `ArgProfile`,
`PostCard`, `PostFocusHeader`, `PostScroller`, `DebateView` thread one `bookmarks` prop;
`DebateView` derives the two Sets once. **C4** applied: `UnbookmarkButton` now branches on
the typed `{ ok }` instead of discarding it.

## Slices — final state

- **Slice 3 (replies)** — **LANDED in Pass 2** (`9016e1f`). The reply card now carries the FULL
  cluster per C3, rendered from the SAME `CardActions` as `ArgProfile`; `bookmarks` threaded
  through `ReplyPreview`, `ReplyScroller` and BOTH `PostCard` call sites. `@code-reviewer`:
  **no findings at any severity**, all eight directed points pass.
- **Slice 4 (Profile arm)** — **deferred by ratified correction C2**, pending the W2.7 /
  canon §3.11 design ruling. Nothing under `src/components/profile/**` or
  `src/server/profile/**` was created; no `ArgumentList` primitive extracted. Severability
  verified by build, not just by import-graph reading: `git diff b6495af..HEAD -- src/ |
  grep -c "components/profile\|server/profile"` → **0**.
- **Slice 5 (SPEC.2 amendments)** — **LANDED in Pass 2** (`8c5c8c0`), correctly *after*
  Slice 3: the web-authored §4.2 text asserts the icon is wired on reply cards, which only
  became true once Slice 3 landed. Withholding it in Pass 1 was the right call, not an
  omission. SPEC.2 → **1.0.21**.

## Decisions made

1. **The plan file was committed into the repo** (`docs/plans/BOOKMARK-ADD-WIRE.md`). It
   existed only at `~/.claude/plans/`; CLAUDE.md §5.1 requires it in-repo, and the reviewer
   cascade is passed `@docs/plans/…`. Copied byte-identical (md5 verified), then annotated
   with the ratified corrections C1–C7 **relayed verbatim** from the kickoff — no
   web-owned decision text was authored — plus the STEP 0f re-verification table.
2. **`CardActions` co-located in `BookmarkToggle.tsx`** rather than duplicated or given its
   own file. C3 requires the reply card to match `ArgProfile` **byte-for-byte**; one shared
   component is the only way to guarantee that structurally, and co-locating keeps the
   plan's "one new file total". `@code-reviewer` rated this MEDIUM-2: right call for this
   PR, but the cluster's semantic home is `components/debate/` once the ADR-0025 download
   trigger is actually wired. Recorded as a follow-up, not fixed here.
3. **Render tests were written** for Slices 2 — see the corrected premise below.
4. **`{ ok }` branch shape for C4:** gate `router.refresh()` on `result.ok`.
   `removeBookmarkAction` returns `{ok:false}` only on the unauthenticated early-return,
   *before* any DELETE, so on failure the row genuinely still exists and leaving it rendered
   with its filled icon is truthful. Reviewer verified no `/bookmarks` regression: the old
   code always refreshed, which on an expired session redirected to `/sign-in` while the
   item was never removed.
5. **Slice 5 withheld** (above) — a scope call, not an omission.

## Surprises caught + fixed in-session

**The plan's §7 coverage-gap premise is factually wrong on disk.** Plan §7 and
self-critique #3 both assert "AGENTS.md §9 documents no component-test harness… UI
behaviour is covered by manual review", ranking that the third-largest risk. STEP 0f found
`@testing-library/react` 16.3.2 and `jsdom` 29.1.1 as committed devDependencies with 20+
`*.test.tsx` files using them under a per-file `// @vitest-environment jsdom` docblock
(e.g. `tests/unit/debate/render/price-chart.test.tsx`). The kickoff said *report the
answer, do not install one* — nothing was installed; the existing harness was used. So the
riskiest new logic is covered rather than deferred: 15 render cases in
`tests/unit/debate/render/bookmark-toggle.test.tsx`, including the two items
`@security-auditor` handed forward (own-suppression precedence; the removed-post matrix).
**AGENTS.md §9 is stale on this point** — recorded, not fixed (out of scope).

**The render tests were mutation-probed rather than assumed binding.** (a) Replacing the
`{ ok }` branch with `void result` failed **only** `returned-failure-reverts-silently`;
(b) weakening the own-check to `own.has(id) && !saved` failed **only** `own-outranks-saved`.
Source restored from backup and md5-verified after each probe. `@code-reviewer`
independently confirmed both probes — and correctly identified that no probe covered the
paging path, which is exactly where HIGH-1 lives.

**No jest-dom in this repo.** The render tests were first written with `toBeDisabled()` /
`toHaveAttribute()`; `@testing-library/jest-dom` is not a dependency. Converted to plain
DOM assertions, matching the house pattern.

**Two out-of-plan fixture edits were compile-forced.** Adding two *required* fields to
`ViewerMarketContext` breaks every existing literal:
`tests/unit/composer/render/_harness.tsx` and `tests/unit/debate/w210c-links.test.tsx`
(+4 lines each). Not in the plan's Slice-1 file list. `@code-reviewer` assessed this as
CLAUDE.md §5.3 "clean up orphans your change created", not §5.4 scope creep.

## Reviewer cascade — as actually run

Sequential, one reviewer touching the DB at a time. Each was passed
`@docs/plans/BOOKMARK-ADD-WIRE.md` plus its directed per-point scope.

| Reviewer | Slice | Verdict |
|---|---|---|
| `@test-writer` | 1, at start | RED proven: 7 new failing / 6 pre-existing passing; `tsc` erroring only on the two missing DTO properties. Never edited `src/`. |
| `@code-reviewer` | 1 | **No CRITICAL/HIGH/MEDIUM.** 2 LOW (a test-fixture `?? ""` fallback matching the file's existing style; the plan's non-exhaustive file list). Explicitly concluded **no DDL is required** — H1 not triggered. |
| `@security-auditor` | 1 | **Zero findings at every severity.** All six directed points (a)–(f) verified and stated individually. |
| `@code-reviewer` | 2 | **1 HIGH** (HIGH-1 above → H6 halt), 1 MEDIUM (`CardActions` home), 2 LOW (a11y double-signal: name *and* `aria-pressed` both change; `type="button"` omitted on the two disabled buttons, matching the shipped precedent). Points 1–6, 8, 10 PASS; point 7 FAIL. |
| `@db-migration-reviewer` | — | **NOT INVOKED — reasoned waiver**, zero `src/db/schema/**` and zero `drizzle/migrations/**` diff. Waiver is void if DDL ever appears; none did. |
| `@code-reviewer` | 2, re-review after the fix | **No CRITICAL/HIGH/MEDIUM.** Both directed questions answered; 2 LOW (L1/L2 above), neither actionable. |
| `@code-reviewer` | 3 | **No findings at any severity.** All eight directed points pass, including C3 byte-for-byte and the removed-reply masking lock. |
| `@security-auditor` | 3 (masking-directed, added at Gate C) | **No CRITICAL/HIGH/MEDIUM.** All five directed points answered separately; the removed-reply guard confirmed binding by independent mutation. 2 LOW, both carried. |
| `@security-auditor` | 2 | **NOT RUN** — the plan makes it mandatory on **Slice 1 only** (run, zero findings). Slice 2's obligations are discharged and test-locked instead. Flagged so the omission is visibly deliberate. |

### `@security-auditor` forward obligations (Slice 1 → Slices 2/3)

1. **(Slice 3)** The reply add-affordance has **no type-level lock** — unlike the post icon
   (protected by `ArgProfile`'s required `author`/`marker`), an icon placed in
   `ReplyCard`'s removed branch (`:14-21`) **would compile**. It must go strictly in the
   `:22-36` non-removed branch, with a render test asserting no bookmark control on a
   removed reply. **DISCHARGED in Slice 3** — the cluster sits strictly in `ReplyCard`'s
   non-removed branch; `reply-card::removed-reply-renders-no-cluster` is the guard, and
   moving `<CardActions>` into the removed branch fails exactly that case. **Re-confirmed at
   Gate C** by `@security-auditor`'s own independent mutation probe (restored byte-identically,
   md5 verified). The auditor carries it forward as a *pattern* obligation: any future surface
   rendering a reply cluster must repeat both halves, because the compiler will not catch a
   removed-branch cluster.
2. **(Slice 2/3)** The own-check must consume `ownCommentIds` (ids), never `ownPseudonym`,
   and must run **before** the saved-check. **Done in Slice 2**, test-locked by
   `bookmark-toggle::own-outranks-saved`.
3. **(Slice 2/3)** The client `.has(id)` lookups gate **icon state only**, never content
   visibility. **DISCHARGED and re-verified at Gate C** — the C-3 masking audit traced every
   consumer: each set has exactly one reader (`DebateView.tsx:115`/`:116`) feeding two sites
   in `BookmarkToggle` (the fill seed and the `own.has → null` icon suppression); no content
   branch reads `bookmarks`. Worst case for a corrupted set is a wrong icon, never a rendered
   or withheld argument. ADR-0034 D-4 holds.
4. **(Slice 2)** Restate the "B1 widens a pre-existing gap" note in the PR body (C5).
   **Done** — it is in the PR body.

## Gates

| Gate | Result |
|---|---|
| Baseline full suite (0g) | **280 files / 1997 tests** passed, 1 skipped, 4 todo — exit 0 |
| Full suite at the Pass-1 halt | **281 files / 2019 tests** passed — exit 0 |
| **Full suite, final (Pass 2)** | **281 files / 2027 tests** passed, 1 skipped, 4 todo — exit 0 (**+30 tests vs the 1997 baseline**: 7 integration + 23 render) |
| `ZUGZWANG_ENV=preview just verify` | exit 0 (typecheck → biome → next build) |
| `pnpm exec tsc --noEmit` | exit 0, unpiped |
| `pnpm exec biome check .` | exit 0; 1 **pre-existing** warning in `tests/server/moderation/moderation-blocked-event.test.ts` (unused import, present on `origin/main`, untouched — left per §5.3) |
| Zero-diff belt | `load-debate-view.ts` **0** diff lines · `add.ts` **0** · `remove.ts` **0** |
| Schema / migration diff | **0 files**; migration head still `0024_bookmarks.sql`; `EVENT_TYPES` still **24** |

**Build-env note:** a fresh worktree has no `.env.local` (gitignored, never copied), so
`next build` fails on `DATABASE_URL`. `just verify` was run with the
`tests/_setup/env.ts` placeholder env — vars **set**, not connected. No real `.env*` was
read at any point.

## Open questions

- **OQ-1 (Profile arm)** — open; Slice 4 deferred per C2 pending the W2.7 / canon §3.11
  design ruling.
- **OQ-2 / OQ-4 / OQ-5** (rate limit / ban gate / freeze gate) — **carried per C5**, none
  added. `@security-auditor`'s independent read: OQ-2 bounded by `UNIQUE(user_id,
  comment_id)` and dataset exclusion — write-amplification, not correctness; OQ-4 lowest
  risk (a bookmark is not voice, consistent with ADR-0021); **OQ-5 weighted highest** — the
  cleanest end-state is `add.ts` honouring `isFrozen()`, raised not absorbed. It confirmed
  B1 **widens** a pre-existing gap rather than creating one, since `removeBookmarkAction`
  already has a live unmetered production caller.
- **OQ-3** — settled by C6: silent revert, no toast, no invented copy.
- **OQ-6** — settled by C4: applied.
- **ADR-0033** is folded into neither SPEC.1 nor SPEC.2. Noted per the kickoff; **not
  chased**. It matters to Slice 5: the §22 count reconciliation cannot be made internally
  consistent without deciding how to treat an on-disk-but-unindexed ADR. Intended handling
  was to index **0034 only** and add an explicit named-carry sentence for 0033 rather than
  author its row — for the operator to confirm when Slice 5 runs.

## Next session starts at

**Every slice this task planned is landed and green; the HIGH is remediated.** PR #273 is
DRAFT and awaits the operator's Gate-C read of the diff. Next actions, in order:

1. Operator reviews PR #273 and marks it ready / merges (squash). **CC must not** — the
   kickoff forbids merging, marking ready, and branch deletion.
2. After merge, `TESTING.0` unblocks: ADR-0032 / UI-A6 §11 made B1 a hard pre-testing gate,
   and the bookmark feature is now end-to-end usable.
3. **Slice 4 (Profile arm) remains deferred** pending the W2.7 / canon §3.11 design ruling
   (OQ-1). Severability is proved by build, so it can be cut as its own task with no rework.

**Docketed, deliberately not done here:** the `ReplyPreview` `expanded` paging leak (R1/L1);
the `CardActions` relocation to `components/debate/` once the ADR-0025 download trigger is
wired (Slice-2 MEDIUM-2); AGENTS.md §9's stale "no component-test harness" claim (R7);
ADR-0033's content fold into the SPEC bodies (index row only, ruling G1); OQ-2/4/5 —
`add.ts` honouring `isFrozen()` is the one `@security-auditor` weighted highest.

## Context to preserve

- **`ReplyPreview` is rendered twice in `PostCard`** — `:45` (removed-post branch) and
  `:118` (present branch). A removed post keeps its live replies, so **both** need the
  `bookmarks` prop. Slice 3 therefore also touches `PostCard.tsx`, which the plan's Slice-3
  file list omits.
- **`ReplyScroller` will hit the identical un-keyed paging defect** as `PostScroller` —
  fixing HIGH-1 inside `CardActions` (rather than at the `PostCard` call site) pre-empts it.
- The SPEC.2 §4.2 cell at `:412` **still opens with "No A6 surface —"** (re-verified this
  session), so the Slice-5 HALT condition on that locus has not fired.
- SPEC.2 banner `:3` reads `1.0.19` while §0 metadata `:14` reads `1.0.20` — the
  pre-existing drift the sixth amendment reconciles.
- Subagent model pin: all four `.claude/agents/*.md` read `claude-opus-4-8`. The session
  model was **Opus 5 (`claude-opus-5[1m]`)**, not the CLAUDE.md §6 pin — `/model` is an
  operator action and cannot be invoked from inside the session. The pinned agents resolved
  and ran normally (27, 14, 27, 26 tool_uses), so no Agent-call model override was needed.
- The local test DB (`postgresql://postgres:postgres@localhost:54322/postgres`, head 0024)
  was verified sole-use via `pg_stat_activity` before the baseline; reviewers ran strictly
  sequentially. No hook-timeout flakiness occurred.

## Time

Two passes on 2026-07-30. Pass 1 (unattended): ~18:05–19:35 local, halted at H6. Pass 2
(operator-directed Gate-C remediation R1–R7): ~19:50–21:20 local. Nothing merged; no branch
deleted; PR #273 still DRAFT.
