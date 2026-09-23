# FF-1 · CLOSE-3 — plan

**Task.** Founder refinements from staging (**D-52**): (1) nobody replies to their own post · (2) the
friendly-fire meter withdrawn, the split bar restored · (3) one header height · (4) two-line post-focus
market card question · (5) the Math title — recon only. Plus the carried CLOSE-2 doc fixes.
**Mode.** Single attended-style session, executed without a web round trip. The kickoff prompt
(`~/Downloads/FF-1_CLOSE-3_execute.md`, md5 `e837236e1b6085465d75c481813cc14c`) IS the ratified plan —
founder rulings 2026-09-23 on staging `8564a7b0`. This file is that prompt's slice list, file map, exit
conditions and test budget, written at Phase 1 and committed on `feat/ff-1`.
**ITEM-3 MODE: A** (the prompt's first line) — one header height across the market view and post-focus;
every `[ITEM-3]` line applies with its prefix stripped.
**Harness mode.** Bypass permissions; effort `max` (session-scoped); `ultrathink` on the kickoff. Part A
touches the bet write path (CLAUDE.md §1 area 1): **dynamic workflows FORBIDDEN**, one sequential pass.

## Walls (absolute)

- Never merge; never push `main`; never `vercel promote`; never `doppler run --config prd` or `--config stg`;
  never `staging:rebuild|reset|generate|gates`. The ONE write outside the two feature branches is Part C's
  lease-pinned push to `staging`.
- Local Postgres only (`:54322`) for every test.
- No friendly-fire count, badge, or new friendly-fire surface anywhere — the meter is being REMOVED.
- No prescriptive sentence of the session's own: `docs/specs/*`, `docs/design/design-language.md`,
  `docs/adr/*`, `docs/decisions/*`, `docs/overnight-run.md` change ONLY by the prompt's verbatim blocks.
  Every ANCHOR must match exactly once (bare substring); on 0 or ≥ 2 matches that block STOPS and is
  reported with file · count · 200 bytes of context. `«»` slots are measured, never guessed. INSERT
  BEFORE / AFTER place NEW exactly as written, adding no blank lines.
- No UPDATE or DELETE of any existing row, anywhere. Self-replies already written stay.
- Part D writes nothing — no DB, no repo file, no snapshot.

## Measured before planning (the facts that shape Part A)

1. `D-52` is free on `feat/ff-1`, `origin/main` and `origin/feat/ff-1-ui` (0 hits each).
2. `place.ts` reads the parent inside W-1 **only when `friendlyFire` is set**. The in-transaction check
   needs the parent on every reply, so that read runs whenever `parentCommentId !== null`, with
   `user_id` taken in the same select — no separate statement for it. An unflagged reply's W-1
   transaction therefore issues one statement more than before (this also closes docket row FF-1 L-3).
3. `round-trip-budget.test.ts` measures READ paths only (viewer context pinned at 3 statements with no
   held position); no test pins the W-1 statement count.
4. The route already reads the parent pre-transaction (step 5b) — the front-stop rides that read.
5. `computeReplyAffordance` has no production caller; its only `src/` caller is `readReplyAffordance`,
   itself called only by tests. The UI gates with its own pure `isEntryDisabled`.
6. No DTO carries an own-post flag, and no author user id reaches the client today.
7. The client error union is `STATE_BY_CODE` in `src/components/debate/composer/state-map.ts`.
8. The phone's reply controls are the bottom bar's `Support` / `Counter` actions; its relation tabs
   switch lanes and open nothing.
9. The post-focus market card is `FocusMarketCard`, rendered only by `PostFocusHeader` (`compact`,
   one line today). Discovery's card is `discovery/MarketCard.tsx` and is not touched.

## Part A — `feat/ff-1` (PR #568)

| Slice | What | Files |
|---|---|---|
| Phase 1 | this plan file | `docs/plans/FF-1-CLOSE-3.md` |
| A0 | verify `D-52` free | — |
| A1 (commit 1) | carried CLOSE-2 docs: two INSERT BEFORE blocks + one MOVE | `docs/overnight-run.md` · `docs/design/design-language.md` |
| A2 | D-52 docs, verbatim blocks A2.1–A2.19, versions bumped where named | `docs/decisions/RECORD-v2.10-amendment.md` · `docs/specs/SPEC.1.md` · `docs/specs/SPEC.2.md` · `docs/specs/RANKING.md` · `docs/design/design-language.md` · `docs/adr/0058-friendly-fire-toggle.md` |
| A3 guard | in W-1, after the parent read and its existence/depth checks and BEFORE friendly-fire eligibility: `parent.userId === userId` → 400 `self_reply_forbidden`, nothing written | `src/server/bets/place.ts` · `src/server/comments/reply-validate.ts` (select gains `user_id`) · `src/server/bets/errors.ts` (`SelfReplyForbiddenError`, a `BetProductError` → cached 4xx per ADR-0031) |
| A3 front-stop | the same check on the route's existing pre-tx parent read, before image resolution and moderation | `src/app/api/bets/place/route.ts` |
| A3 client union | `self_reply_forbidden → p3_generic` (the composer's generic error state; the UI never offers the action) | `src/components/debate/composer/state-map.ts` |
| A3 affordance | own post ⇒ both foreclosed whatever is held; `readReplyAffordance` given the parent's author (server-side only) | `src/server/comments/foreclosure.ts` |
| A3 own-post read | the viewer's own post ids on the viewer-scoped read, folded into its EXISTING `users` statement (statement count unchanged — `round-trip-budget.test.ts` untouched); post ids only, never a user id | `src/server/debate-view/viewer-context.ts` · the client type mirror in `src/components/debate/types.ts` if it restates the shape |
| A3 conversions | every test/fixture/harness/script that drives a self-reply through `place()` or the route: incidental → another replier; one that PINS self-exclusion → the legacy row inserted directly (the append-only trigger permits INSERT) | found by the suite + a static sweep of `tests/scale/`, `tests/staging/`, `scripts/` |
| A3 (commit 2) | `feat(comments): nobody replies to their own post; own-post affordance; friendly-fire meter withdrawn in docs (D-52)` | — |

Order inside A3: `@test-writer` writes T1 + T2 RED first (never edits `src/`) → implement → green →
`@code-reviewer` (the `src/server/**` diff) → `@security-auditor` (one question: can an author reply to
their own post by ANY path — route, image path, idempotent replay, direct callers?) → §5.10 self-audit →
full suite, `tsc`, `biome`, `next build` → commit 2 → push → `gh pr checks 568` green. Fixes after a
reviewer ran go on the UNREVIEWED-FIX list.

## Part B — `feat/ff-1-ui` (PR #569)

`git rebase feat/ff-1` onto Part A's head first. No `src/server`, `src/db`, `drizzle/` changes.

| Slice | What | Files |
|---|---|---|
| B1 | meter withdrawn: `FriendlyFireMeterFigure` / `FriendlyFireMeterBar` / `computeFriendlyFireMeter` and the `phone-ff-row` removed; both files back to their `origin/main` layout; `friendlyFireDharma` stays in the DTO, rendered nowhere | `src/components/debate/composer/ReplySplitBar.tsx` · `src/components/debate/composer/split-bar.ts` · `src/components/debate/phone/PhoneDebateView.tsx` |
| B2 | own post: both reply controls disabled in the existing foreclosed treatment, explanation `You can't reply to your own post.` where the foreclosed control carries one; the composer cannot open | `ReplySplitBar.tsx` · `AggregateFooter.tsx` · `PhoneBottomBar.tsx` · the prop path from the viewer read (`DebateView.tsx` · `PhoneDebateView.tsx` · `PostFocusHeader.tsx` · `PostCard.tsx` as measured) · `composer/copy.ts` |
| B3 | post-focus market card question clamped at two lines; Discovery unchanged (markup/screenshot proof) | `src/components/debate/FocusMarketCard.tsx` |
| B4 | one header height at desktop two-lane widths via ONE shared value; the focused post tile anchors its Support/Counter bar to the tile's bottom edge; the market card fills the same height; phone untouched | `HeadZone.tsx` · `MarketHeader.tsx` · `PostFocusHeader.tsx` (as measured) |
| B5 | tests per the budget | the desktop + phone render files |
| B6 / B6-A | screenshots + the lane-measurement table (1440×900, 1920×1080, both views) | `~/Downloads/zz_FF-1_shots_CLOSE-3_<UTC>/` |
| B7 | `tsc`, `biome`, `next build`, full suite; commits `feat(debate-view): friendly-fire meter withdrawn, split bar restored (D-52)` · `feat(debate-view): own-post controls disabled, post-focus layout (D-52)`; push; PR #569 body; `gh pr checks 569` green | — |

## Part C — staging (founder-authorised, exactly once)

Only after #568 and #569 `ci` are green: `git push --force-with-lease=staging:8564a7b0238568cfdb4ca0763f627cde5864feda origin <PR-B head SHA>:refs/heads/staging`.
Lease refused → STOP and report, no retry, no force. Then `staging-migrate.yml` (success, no new migration)
and `/api/health`: status · db · migrations `ok`, `canary` == the pushed full SHA; report the Vercel
deployment id and URL.

## Part D — read-only

The Math market's title and question as served on production and staging (public pages only), the newest
`MKT-MAT-01` spec's title/slug/question, the proposed title per environment (` on Zugzwang` removed once,
or reported), every way an Open market's title could change (file:line), and SPEC.2 §4.2's three F3 rows
verbatim. Writes nothing.

## Test budget — the complete list

- **New:** T1 `tests/server/comments/self-reply.test.ts::author-reply-rejected-no-rows` (via the route; zero
  new rows in comments, bets, dharma_ledger, events; positive control: another user's identical request
  succeeds) · T2 `…::author-reply-rejected-in-transaction` (`place()` directly; same refusal, zero rows;
  mutation proof: remove the in-transaction check → T2 red → restore md5-identical).
- **Extended:** the `computeReplyAffordance` matrix (+2 rows: own post holding the parent's side; own post
  holding the other side); the desktop and phone render files (meter cases REPLACED by one meter-absent
  negative per tier with an `ff-tag` positive control; +1 own-post case per tier with a positive control on
  another's post).
- **Converted:** existing tests and harnesses that create a self-reply.
- Items 3–4: measurement and screenshots in B6, no test files.
- Full suite once at the end of Part A and once at the end of Part B.

## Exit conditions

- Part A: every A1/A2 block applied or STOPPED-and-reported; T1/T2 red-then-green with the mutation proof;
  reviewers run with dispositions logged; self-audit clean; full suite, `tsc`, `biome`, `next build` green;
  commits 1 and 2 pushed; #568 `ci` green; unmerged.
- Part B: meter absent on both tiers (`git diff origin/main` shows no meter hunk); own-post controls disabled
  on every surface named; two-line card; lane geometry equal within 1 px between views at 1440 and 1920;
  screenshots listed with bytes; fixture removed and `git status` clean; suite/`tsc`/`biome`/build green;
  #569 body updated; `ci` green; unmerged.
- Part C: lease honoured, health `ok` ×3 with the canary equal to the pushed SHA — or a STOP report.
- Part D: facts only, nothing written.

## Report

`~/Downloads/zz_FF-1_close3_<UTC>.md`, written incrementally (O-11); the final chat reply ≤ 10 lines —
FILE / LINES / MD5 / STATUS / HEADLINE / UPLOAD: REQUIRED; LINES and MD5 measured as the last action.
