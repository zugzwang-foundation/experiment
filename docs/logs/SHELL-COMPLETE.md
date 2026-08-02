# SHELL-COMPLETE — session log

> **Date:** 2026-08-02 · the FINISH session. Earlier sessions on this branch were lost; this one was re-entered from a self-contained kickoff and assumed no prior context.
> **Ground:** `origin/main` @ `8e84edc` · primary worktree `~/code/zugzwang/experiment` · branch `feat/shell-complete`
> **Plan:** `docs/plans/SHELL-COMPLETE.md`, PR #281, ratified 2026-08-01 · superseded in part by r5 in this session
> **Spec gate:** SPEC.1 **1.0.26** (PR #282, `8e84edc`) — the page-level footer withdrawn. It merged BEFORE this PR opened, which was the stated precondition.

---

## A note on SHAs in this log

The merge is **squash-to-main**, so **no SHA below ever reaches `main`.** Every one is a branch-local working SHA, and the branch was **rebased onto `8e84edc` during this session**, which rewrote all five pre-existing ones. Both spellings are given so the pre-rebase commits can still be found in a reflog or an earlier transcript. **The durable reference is the squash-merge SHA on `main`, recorded at close-out — not here.**

---

## What landed

**PR — `feat/shell-complete`** (6 commits, all SSH-signed, opened at the end of this session; **number recorded at close-out**):

| Working SHA | Pre-rebase | What |
|---|---|---|
| `4560778` | `51d60e5` | **S1 · B10** — branded `not-found` ×2 + `global-error` |
| `6a0f16d` | `8a8b6e2` | **S2 · B4** — site footer with AGPL source link · **superseded by its own revert below** |
| `b8abc91` | `45146d1` | **S3 · BALANCE** — signed-in Dharma balance in the header |
| `e86e961` | `e085d29` | **Revert of S2** — founder ruling, the footer withdrawn |
| `84dc34e` | `a08f1ff` | three guard gaps closed |
| `221960b` | — | **r5** — plan supersession (this session) |

S2 and its revert are both kept in history rather than squashed away: the revert commit is where the founder ruling and its full blast radius are recorded, and it is only legible beside the commit it undoes.

**Net effect against `origin/main` — 13 files, +916 / −6.** Nothing from S2 survives in the tree.

**Source (5 files, 4 new):**

- `src/app/not-found.tsx` **(new)** — the ROOT 404, deliberately **neutral, no `GlobalHeader`**. ADR-0023's Option-2 verdict rejected root-mounted participant chrome because the root layout is shared with `(admin)`, which has no layout at any depth; a header here would leak participant chrome onto the two admin `notFound()` throws. Wordmark is plain text, not `BrandCluster` — that component is a client boundary carrying the countdown.
- `src/app/(public)/not-found.tsx` **(new)** — the BRANDED 404, inheriting `GlobalHeader` from the route-group layout. Catches the three participant page throws, including ADR-0023's ratified "unknown or `Draft` slug → `notFound()`".
- `src/app/global-error.tsx` **(new, `"use client"`)** — the last-resort boundary. It replaces the root layout and so inherits nothing: own `<html>`/`<body>`, re-instantiated `Geist`/`Geist_Mono`, explicit `import "./globals.css"`. It imports nothing server-bound and nothing that can throw.
- `src/components/shell/BalanceCluster.tsx` **(new)** — `Đ` · `Balance` · the figure, via `formatDharma` (the shared 0-dp renderer). Renders `null` on `null`.
- `src/server/dharma/header-balance.ts` **(new)** — the ONE new file under `src/server/`, and it edits none. Two statements, no transaction.
- `src/app/(public)/layout.tsx` · `src/components/shell/GlobalHeader.tsx` — the wiring.

**Tests (5 files, 3 new, +17 cases):** `tests/integration/header-balance.integration.test.ts` (new, 7) · `tests/unit/shell/not-found.test.tsx` (new, 4) · `tests/unit/shell/balance-cluster.test.tsx` (new, 4) · `tests/unit/shell/global-error.test.tsx` (new, 2) · plus two guard-file edits carrying no new case.

**Docs:** `docs/plans/SHELL-COMPLETE.md` r5 · this log.

---

## The test number

```
 Test Files  290 passed | 1 skipped (291)
      Tests  2103 passed | 1 skipped | 4 todo (2108)
   Duration  1276.14s
   exit 0
```

`pnpm vitest run`, run **alone** — Postgres verified up on `:54322` and no second runner in `ps` before starting, per the kickoff's isolation requirement.

**The delta accounts exactly.** The F-DEBATE-4 baseline was 286 files / 2086 passed; the three doc-only PRs merged since (#280, #281, #282) add no tests. 286 + 4 = **290**. 2086 + 17 = **2103** (7 + 4 + 2 + 4). Skipped and todo are unchanged at 1 / 1 / 4. There is no unexplained movement in either direction.

### Why the previously-reported number was worthless

A prior run on this branch reported **94 failed across 55 files**. It was a **false red, and a harness artifact rather than a code signal.** Two Claude Code sessions shared this working tree and therefore the single local Postgres. `truncateTables` disables the **entire** Bucket-A append-only guard set per call, so a second runner truncating between the first runner's arrange and assert steps pulls fixtures out from under it — and the damage lands wherever the two interleave, not where the code changed.

The tell was in the shape, not the count: 55 files is roughly a fifth of the suite, and this branch's diff is **13 files** that touch no shared fixture, no migration and no Bucket-A table. There is no mechanism by which a `not-found.tsx`, a `BalanceCluster` and one new read module fail 55 unrelated suites. The number was discarded rather than debugged, and the clean-room re-run above is the one on the record.

**The generalisable rule, already in the contract:** never believe a red without first checking `ps` for a second `vitest`. This is the second time it has cost a session.

---

## Decisions made

**1. B4 is WITHDRAWN, not deferred.** The founder ruling is that the product ships **no page-level footer on any surface** — not reduced, not AGPL-only, none. So the treatment is a revert plus a spec amendment, not a backlog row. SPEC.1 1.0.26 amends §16.5, §18 and §21.6; the AGPL-3.0 §13 obligation survives and relocates to the Terms of Service body at LEGAL.1, and the DPDPA grievance contact to the Privacy Policy. ADR-0001 needs no patch record — it mandates the **offer**, and never named the footer as the mechanism.

**2. The revert kept the footer test and inverted its meaning.** The `SiteFooter` assertion in `not-found.test.tsx` was descriptive when S2 shipped; it is now a **regression guard against the footer returning**, and it was widened from the root layout to **all three** layouts — because B4 had mounted the footer in *both* group layouts, so a root-only assertion would miss precisely the regression it exists to catch. It also asserts no bare `<footer>` element, so a hand-rolled replacement is caught too. This is the cheapest possible enforcement of a founder ruling: it costs nothing and it fails loudly.

**3. S4 (B8, the freeze banner) is FORKED, not dropped.** It was always gated on a SPEC.1 §21.7 rider that has not landed; the plan's own §6 anticipated exactly this and instructed shipping S1–S3 rather than stalling three ready slices on one spec commit. Q4 was revised in the same breath (r5): the trigger is no longer the constant alone but **constant gates, database confirms** — `FREEZE_INSTANT_UTC` as a cheap short-circuit, `system_state.frozen_at` as the truth claim, `isFrozen()` wrapped so a layout can never throw. That reconciles the banner with SPEC.1 §9's own statement that a clock comparison is *a guess about a database state flip, not a signal*, while still paying zero reads for the entire pre-launch and live window.

**4. The header figure is SPENDABLE, labelled `Balance`.** `computeSpendableToday` adds the Daily Credit on a day the user has not been paid, because the place path pays that credit **before** the affordability check. With the Đ 50 reply floor, a participant holding Đ 45 raw who has not bet today can spend Đ 55 — a raw-balance header would tell them they are dead-ended when they are not, and would create the worse inversion where the composer accepts a bet larger than the header implies. The accepted cross-surface property is **stated, not discovered**: the profile tile renders the RAW balance, so the same user sees Đ N on their profile and Đ N+10 in the header on any unclaimed day. Both are true and they measure different things; the distinct labels (`Wallet value` / `Balance`) carry it.

**5. The ledger select is replicated, not routed through `readBalance`.** `readBalance` takes a `DbTransaction` deliberately — a compile-time guard on read-then-append atomicity for every caller — and widening it to `DbClient` would erode that guard everywhere to serve one display read. Wrapping this in a transaction would spend a `BEGIN`/`COMMIT` on every render of every layout-bearing route to read one indexed row. `tiles.ts` already ruled this exact duplication acceptable for this exact case. The invariant ADR-0029 protects is the `ORDER BY seq DESC LIMIT 1` **total order**, not function identity — and T5a pins the replica against `loadProfileTiles`, which is the only layer where that drift can appear.

**6. The header DOM order followed the mockup over the plan's line reference, 3-to-1.** Plan Q6c is self-contradictory: one sentence says "insert between `:51` and `:52`" (which lands *after* `IdentityCluster`) and the same sentence states the final order as `[BalanceCluster] [IdentityCluster] │ [VisitorCounter]`, with the next paragraph arguing cluster-before-chip. The locked W2.4/.5/.14 mockup settles it, and its own annotation states the mechanism: *"§21.1 — visitor count held off the Đ cluster BY THE IDENTITY CHIP + DIVIDER"*. Cluster-before-chip is therefore load-bearing for the very anti-conflation guard SG8 protects, so the line reference was treated as an off-by-one. T4 now pins the **full** order rather than the divider relation alone — the plan's own T4 wording still passes in the wrong arrangement.

**7. The Q4 code block was committed inside a fence; the r5 SHA cite was not corrected.** Both are recorded in `221960b`'s message and repeated under *Delivery failures* below.

---

## Surprises caught + fixed in-session

The whole of commit `84dc34e` is one finding: **three guards that could not catch what they claimed to.** None was a live violation — the code is clean today. Each was verified RED-then-GREEN, and for the first two the RED was **attributed, not merely observed**: with the OLD guards restored and both violations still injected, all 16 design tests **passed**. That is the proof the gaps were real.

**1. `no-raw-dharma-render` did not know the word `spendable`.** `MONEY_IDS` already carried `spendableToday`, which does not match `spendable`. The new prop threads a raw `NUMERIC(38,18)` string through `(public)/layout.tsx` → `GlobalHeader` → `BalanceCluster`, so an unwrapped `{spendable}` would have put `610.400000000000000000` in the global header **on all seven participant routes** with nothing to catch it. Checked for false positives before adding: the only other occurrences are in `composer/copy.ts` (wrapped in `formatDharmaGrouped(` — the paren breaks the regex run) and `BetComposer.tsx` (an object-literal property, where the `:` breaks the character class).

**2. `no-raw-hex-view-layer` did not scan either root-level boundary.** `src/app/not-found.tsx` and `src/app/global-error.tsx` sit at `src/app/`, outside both scanned dirs. `SCAN_FILES` exists for exactly this case — `(auth)/layout.tsx` was enrolled by hand for the same reason. `global-error.tsx` matters most: it replaces the root layout and hand-rolls its own `<html>`/`<body>`, which is where a smuggled literal would hide.

**3. T5a's fixture could not fail — the sharpest of the three.** `header-balance.ts` was always correct; the **test** was vacuous. Rows appended in separate statements get strictly increasing `created_at`, so `seq DESC` and `created_at DESC` selected the same row and the assertion held under either. Swapping the production `ORDER BY` to `created_at` — **the exact AUDIT-FIX-B2 drift this test is the sole guard against** — left the whole suite green. The chain-later rows are now backdated so the two orderings disagree. `created_at` is set from a **SQL expression, never a JS `Date`**, and the test says why in a comment: postgres-js floors a bound `timestamptz` parameter, so a `Date` would collapse the sub-second offsets, let the orderings agree again, and silently restore the dead guard.

Also worth keeping from S3: **the `.mapWith()` on the `now()` fragment was verified as a real guard, not a ritual.** Swapping it for the `sql<Date>` form **typechecks clean** (`tsc` exit 0) and fails 5 of the 7 integration tests. Only a real-DB run catches it.

---

## Delivery failures at message boundaries

Recorded because they are now a pattern, not an incident.

**1. The prior sessions' context was lost entirely.** This session was re-entered from a kickoff written to be self-contained precisely because nothing could be assumed. It worked — but only because the *commit messages on this branch are unusually complete*. Every ruling above was reconstructed from `git log`, not from a transcript. **The commit message was the only surviving record**, which is an argument for continuing to write them at this weight.

**2. A session was killed uncleanly and left no scratch record.** `claude-progress.md` is still the UI-6 close-out from 23 Jul — untouched. The convention is to write mid-task findings there; a session that dies before its close-out writes nothing at all, so the file is silent in exactly the case it was meant to cover. It cannot be relied on as a crash-recovery channel.

**3. The kickoff referenced an "r3/r4 blockquote"; the committed file carries only r3.** `r4` appears nowhere in it. The Q4 replacement text is itself labelled `*(r4)*`, so r4 evidently revised Q4 without ever committing a blockquote of its own. Placement was unambiguous, so this did not block — recorded because the same class of drift *would* block if it landed on a load-bearing definition.

**4. The Q4 replacement's three code lines arrived without their code fence.** They are committed inside a ` ```ts ` fence: characters verbatim, fence restored. Unfenced, GitHub strips `<banner/>` as an unknown HTML element and the line renders as `return ;` — a **silent corruption of the single line that states the decision**. Every other plan in `docs/plans/` fences its code; this file had no fenced block at all before now. Called out rather than absorbed, because it is an edit to web-authored text however mechanical.

**5. The r5 text cites the founder-ruling revert as `e085d29`, which no longer exists on this branch.** The rebase onto `8e84edc` rewrote it to `e86e961`. **Left exactly as written** — it is web-authored, and both spellings are ephemeral branch SHAs a squash merge discards regardless. Flagged once here and in the commit message rather than silently corrected.

---

## Verification

| Gate | Result |
|---|---|
| `pnpm vitest run` (full, isolated) | **290 files passed / 1 skipped · 2103 passed / 1 skipped / 4 todo · exit 0** |
| Rebase onto `origin/main` @ `8e84edc` | clean, **no conflict**; all five commits re-signed `G`; post-rebase diff byte-identical (13 files, +916 / −6) |
| Working tree at STEP 0 | `git status --porcelain` **empty** — no residue from the killed session |
| Concurrent-session check | one `claude` PID, this session's own; no second `vitest` |
| `@code-reviewer` | see below |

*(`just verify` is not re-run here: `next build` was green on the pre-rebase tree and the rebase changed no source byte — the post-rebase diff is identical. `ZUGZWANG_ENV=preview` remains required for a bare `just verify`.)*

---

## Reviewer cascade

`@code-reviewer` over the full branch diff, run **strictly after** the suite finished — it has Bash and may run tests, and a concurrent DB-touching reviewer is exactly what manufactured the false red above.

**`@security-auditor` was NOT run, by ratified scope.** The plan's §10 Ritual-class row states it explicitly: *"No `@security-auditor` — not a CLAUDE.md §1 critical path … the one server read added is a display-grade read of an existing indexed row, no write, no engine contact."* The kickoff named only `@code-reviewer`, consistent with that. Recorded so the omission reads as a decision rather than a lapse. `@db-migration-reviewer` is inapplicable — no schema or migration file is touched.

Findings and their disposition are in the PR body.

---

## Open questions

**1. The SPEC.1 §21.7 rider for S4 (B8) is unwritten.** It is the sole gate on the forked freeze-banner task. Q4 as revised (r5) is what that rider must ratify — specifically the `isFrozen()` confirm and its fail-safe `catch`.

**2. POLISH.1 inherits V7, the wrapper `flex-1`.** It went out with the revert and has no rationale without a footer. Nothing is broken today; it is recorded so it is not re-derived from scratch.

**3. `HEADER-PORTFOLIO` remains forked.** The header's Portfolio slot renders **nothing** — no placeholder, no dash, deliberately. `IdentityCluster.tsx` has documented its own missing half since UI.A1; S3 discharged the Balance half of OQ-2 and left Portfolio open (N+1 reads, the `loadProfilePositions` spine, the FI-2 basis law).

---

## Next session starts at

**Gate C: the web diff-read, before merge.** The PR is open and must NOT be merged from here.

After Gate C clears and the squash merge lands:

1. `git checkout main && git pull` — **assert `HEAD` is `main` before any `reset --hard`.**
2. Prove the right tree landed: `git diff <squash-merge-SHA> origin/main` must be **empty**, and grep `getHeaderBalance` on `main`.
3. Record the squash SHA into this log and the plan's `| **PR** |` row — it is the only durable reference either document will ever carry.
4. Check whether the merged branch auto-deleted (`git ls-remote`); delete manually if it survived.

**Then the forked S4 task**, which starts by writing the §21.7 rider — not by writing `FreezeBanner.tsx`.

---

## Context to preserve

- **`docs/plans/SHELL-COMPLETE.md` is CLOSED.** r5 says so in the file itself. S4's ratified decisions (Q4 as revised, Q4b, Q5) carry to the forked task; nothing else builds from it. Every footer reference in the body is void and marked so at the top — do not read §4/§5/§6/§7 without reading r5 first.
- **The header reads spendable; the profile tile reads raw.** They diverge by one Daily Credit on any unclaimed day, by design. Anyone "fixing" the inconsistency should read decision 4 first.
- **T5a is the only guard on the replicated ADR-0029 read**, and it was vacuous until this session. If it is ever simplified — particularly if the backdated `created_at` SQL expressions are turned back into JS `Date`s — it silently stops guarding anything.
- **`.mapWith()` on a bare `sql` fragment is not optional and `tsc` will not tell you.** Two files now depend on it; the failure is a wire string where a `Date` is expected.
- **The two-sessions-one-Postgres false red is reproducible and expensive.** `truncateTables` disables the whole Bucket-A guard set per call. Check `ps` before believing any red.
- **The root and `(public)` 404s are deliberately different surfaces**, and the difference is an ADR-0023 Option-2 requirement, not a styling choice. A `GlobalHeader` added to the root variant leaks participant chrome onto the admin `notFound()` throws.

## Time

Single session, ~1h wall clock: ground checks + branch/diff read ~10 min · full isolated suite **21 min** (1276 s, the dominant cost) · rebase ~2 min · plan r5 ~8 min · this log ~10 min · reviewer cascade + PR ~15 min.
