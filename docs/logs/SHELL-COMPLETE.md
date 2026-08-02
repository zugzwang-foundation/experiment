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

**PR #283 — `feat/shell-complete`** (9 commits, all SSH-signed). The **squash-merge SHA is still to be recorded at close-out** — it does not exist yet:

| Working SHA | Pre-rebase | What |
|---|---|---|
| `4560778` | `51d60e5` | **S1 · B10** — branded `not-found` ×2 + `global-error` |
| `6a0f16d` | `8a8b6e2` | **S2 · B4** — site footer with AGPL source link · **superseded by its own revert below** |
| `b8abc91` | `45146d1` | **S3 · BALANCE** — signed-in Dharma balance in the header |
| `e86e961` | `e085d29` | **Revert of S2** — founder ruling, the footer withdrawn |
| `84dc34e` | `a08f1ff` | three guard gaps closed |
| `221960b` | — | **r5** — plan supersession (this session) |
| `23e073f` | — | this log, first cut — written **before** the reviewer ran, per the kickoff's step order |
| `3b7db8d` | — | **`@code-reviewer` remediation** — the layout-read fail-safe (HIGH-1) + two comment corrections |
| *(last)* | — | this log, completed with the cascade result and the final suite number |

S2 and its revert are both kept in history rather than squashed away: the revert commit is where the founder ruling and its full blast radius are recorded, and it is only legible beside the commit it undoes.

**Net effect against `origin/main` — 13 files.** Nothing from S2 survives in the tree. (The pre-review diff was +916 / −6; the remediation commit adds to three of the same 13 files and mints no new one.)

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

The **final** number, on the tree that opens the PR:

```
 Test Files  290 passed | 1 skipped (291)
      Tests  2107 passed | 1 skipped | 4 todo (2112)
   Duration  191.99s
   exit 0
```

`pnpm vitest run`, run **alone** — Postgres verified up on `:54322` and no second runner in `ps` before starting, per the kickoff's isolation requirement. The suite was run in full **three times**: once at STEP 1 before the rebase (`2103 passed`, exit 0), once after the `@code-reviewer` remediation touched `src/server/dharma/` (aborted by a machine stall — below), and once clean.

**The delta accounts exactly, twice over.** The F-DEBATE-4 baseline was 286 files / 2086 passed; the three doc-only PRs merged since (#280, #281, #282) add no tests. 286 + 4 = **290** files. 2086 + 17 = **2103** at STEP 1 (7 + 4 + 2 + 4), then + 4 T9 cases = **2107**. Skipped and todo are unchanged at 1 / 1 / 4 throughout. There is no unexplained movement in either direction.

### Why the previously-reported number was worthless

A prior run on this branch reported **94 failed across 55 files**. It was a **false red, and a harness artifact rather than a code signal.** Two Claude Code sessions shared this working tree and therefore the single local Postgres. `truncateTables` disables the **entire** Bucket-A append-only guard set per call, so a second runner truncating between the first runner's arrange and assert steps pulls fixtures out from under it — and the damage lands wherever the two interleave, not where the code changed.

The tell was in the shape, not the count: 55 files is roughly a fifth of the suite, and this branch's diff is **13 files** that touch no shared fixture, no migration and no Bucket-A table. There is no mechanism by which a `not-found.tsx`, a `BalanceCluster` and one new read module fail 55 unrelated suites. The number was discarded rather than debugged, and the clean-room re-run above is the one on the record.

**The generalisable rule, already in the contract:** never believe a red without first checking `ps` for a second `vitest`. This is the second time it has cost a session.

### And then it happened again, differently — the duration tell

The post-remediation full run came back `1 failed | 289 passed`. The failure was `Hook timed out in 10000ms` in a `truncateTables` `afterEach` in `market-quote.integration.test.ts` — a file this diff cannot reach. **What settled it was not the error text but the clock:**

| | STEP 1 run | post-fix run | clean re-run |
|---|---|---|---|
| `market-quote.integration.test.ts` | ✓ 17 tests, **25.2 s** | ❯ 1 failed, **808.9 s** | ✓ 17 tests, **1.5 s** |
| whole-run `prepare` | 6.50 s | **208.32 s** | 6.20 s |
| whole-run `Duration` | 1276 s | 1387 s | **192 s** |

Per-file and process-wide latency inflated by the *same* ~32×, and `prepare` — which runs before a single test executes — inflated with them. No test-level defect does that; only the machine does. Re-run alone the file passed 17/17 in **1245 ms**, and the clean full run finished in **192 s**, roughly a sixth of the earlier passing run.

**The reachability argument was made independently of the timing**, because timing alone is suggestive rather than conclusive: `header-balance.ts` has exactly one production caller (`(public)/layout.tsx`, which no integration test imports), the layout edit is a comment, and the `vi.mock` added to `header-balance.integration.test.ts` is file-scoped under vitest's isolated pool. `market-quote` exercises `loadDebateView`/pricing and shares no module with any of it.

**The lesson is narrower and more useful than "check `ps`":** a hook timeout is a *latency* symptom, so read the durations before reading the assertion. Two failures on this task looked like code and were both the machine — once from a second runner, once from load with no second runner at all. A green suite whose wall clock is 6× the norm is already telling you something.

---

## Decisions made

**1. B4 is WITHDRAWN, not deferred.** The founder ruling is that the product ships **no page-level footer on any surface** — not reduced, not AGPL-only, none. So the treatment is a revert plus a spec amendment, not a backlog row. SPEC.1 1.0.26 amends §16.5, §18 and §21.6; the AGPL-3.0 §13 obligation survives and relocates to the Terms of Service body at LEGAL.1, and the DPDPA grievance contact to the Privacy Policy. ADR-0001 needs no patch record — it mandates the **offer**, and never named the footer as the mechanism.

**2. The revert kept the footer test and inverted its meaning.** The `SiteFooter` assertion in `not-found.test.tsx` was descriptive when S2 shipped; it is now a **regression guard against the footer returning**, and it was widened from the root layout to **all three** layouts — because B4 had mounted the footer in *both* group layouts, so a root-only assertion would miss precisely the regression it exists to catch. It also asserts no bare `<footer>` element, so a hand-rolled replacement is caught too. This is the cheapest possible enforcement of a founder ruling: it costs nothing and it fails loudly.

**3. S4 (B8, the freeze banner) is FORKED, not dropped.** It was always gated on a SPEC.1 §21.7 rider that has not landed; the plan's own §6 anticipated exactly this and instructed shipping S1–S3 rather than stalling three ready slices on one spec commit. Q4 was revised in the same breath (r5): the trigger is no longer the constant alone but **constant gates, database confirms** — `FREEZE_INSTANT_UTC` as a cheap short-circuit, `system_state.frozen_at` as the truth claim, `isFrozen()` wrapped so a layout can never throw. That reconciles the banner with SPEC.1 §9's own statement that a clock comparison is *a guess about a database state flip, not a signal*, while still paying zero reads for the entire pre-launch and live window.

**4. The header figure is SPENDABLE, labelled `Balance`.** `computeSpendableToday` adds the Daily Credit on a day the user has not been paid, because the place path pays that credit **before** the affordability check. With the Đ 50 reply floor, a participant holding Đ 45 raw who has not bet today can spend Đ 55 — a raw-balance header would tell them they are dead-ended when they are not, and would create the worse inversion where the composer accepts a bet larger than the header implies. The accepted cross-surface property is **stated, not discovered**: the profile tile renders the RAW balance, so the same user sees Đ N on their profile and Đ N+10 in the header on any unclaimed day. Both are true and they measure different things; the distinct labels (`Wallet value` / `Balance`) carry it.

**5. The ledger select is replicated, not routed through `readBalance`.** `readBalance` takes a `DbTransaction` deliberately — a compile-time guard on read-then-append atomicity for every caller — and widening it to `DbClient` would erode that guard everywhere to serve one display read. Wrapping this in a transaction would spend a `BEGIN`/`COMMIT` on every render of every layout-bearing route to read one indexed row. `tiles.ts` already ruled this exact duplication acceptable for this exact case. The invariant ADR-0029 protects is the `ORDER BY seq DESC LIMIT 1` **total order**, not function identity — and T5a pins the replica against `loadProfileTiles`, which is the only layer where that drift can appear.

**6. The header DOM order followed the mockup over the plan's line reference, 3-to-1 — and Gate C ratified it.** Plan Q6c reads as self-contradictory: one sentence says "insert between `:51` and `:52`" (which lands *after* `IdentityCluster`) and the same sentence states the final order as `[BalanceCluster] [IdentityCluster] │ [VisitorCounter]`, with the next paragraph arguing cluster-before-chip. The locked W2.4/.5/.14 mockup settles it, and its own annotation states the mechanism: *"§21.1 — visitor count held off the Đ cluster BY THE IDENTITY CHIP + DIVIDER"*. Cluster-before-chip is therefore load-bearing for the very anti-conflation guard SG8 protects, so the line reference was treated as an off-by-one. T4 now pins the **full** order rather than the divider relation alone — the plan's own T4 wording still passes in the wrong arrangement.

> **Gate C ruling.** Correct as shipped. Q6c's **substance is the authority**; the `:51`/`:52` reference was pre-edit numbering that **went stale while the plan was being written**, not a competing instruction — so this is a **plan-text deviation, never a code defect**. T4 asserting the ordering is the part that matters.

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

**4. The Q4 replacement's three code lines arrived without their code fence.** They are committed inside a ` ```ts ` fence: characters verbatim, fence restored. Unfenced, GitHub strips `<banner/>` as an unknown HTML element and the line renders as `return ;` — a **silent corruption of the single line that states the decision**, in the document slice 4 will build from. Every other plan in `docs/plans/` fences its code; this file had no fenced block at all before now. Called out rather than absorbed, because it is an edit to web-authored text however mechanical. **Gate C: accepted, the fence stays — the omission was upstream.**

**5. The r5 text cites the founder-ruling revert as `e085d29`, which no longer exists on this branch.** The rebase onto `8e84edc` rewrote it to `e86e961`. **Left exactly as written** — it is web-authored, and both spellings are ephemeral branch SHAs a squash merge discards regardless. Flagged once here and in the commit message rather than silently corrected. **Gate C: leave it; flagging rather than editing web-authored text was the right call, and it is corrected at close-out with the squash SHA — the only durable one.**

---

## Verification

| Gate | Result |
|---|---|
| `pnpm vitest run` (full, isolated, final tree) | **290 files passed / 1 skipped · 2107 passed / 1 skipped / 4 todo · exit 0** |
| `pnpm tsc --noEmit` | exit 0 |
| `pnpm biome check src/ tests/` | clean — the single warning is an unused `eq` import in `tests/server/moderation/moderation-blocked-event.test.ts`, **not in this branch's diff** |
| Rebase onto `origin/main` @ `8e84edc` | clean, **no conflict**; all five commits re-signed `G`; post-rebase diff byte-identical |
| T9 RED, attributed | catch removed + final tests → exactly 3 of 11 fail, other 8 hold |
| Working tree at STEP 0 | `git status --porcelain` **empty** — no residue from the killed session |
| Concurrent-session check | one `claude` PID, this session's own; no second `vitest` |
| `@code-reviewer` | 0 CRITICAL · 1 HIGH · 3 MEDIUM · 6 LOW — see below |

*(`just verify` is not re-run at the end: `next build` was green on the pre-rebase tree, the rebase changed no source byte, and the remediation touches one server module plus two comments — `tsc` and `biome` are the parts of that gate the change can move, and both are run above. `ZUGZWANG_ENV=preview` remains required for a bare `just verify`.)*

---

## Reviewer cascade

`@code-reviewer` over the full branch diff, run **strictly after** the suite finished, and instructed **not to run the suite itself** — it has Bash, and a concurrent DB-touching reviewer is exactly what manufactured the false red above. It ran `tsc` and `biome` instead, which need no database.

**Verdict: 0 CRITICAL · 1 HIGH · 3 MEDIUM · 6 LOW.** The four invariants are untouched, no refusal trigger is crossed, the revert is clean.

**`@security-auditor` was NOT run, by ratified scope.** The plan's §10 Ritual-class row states it explicitly: *"No `@security-auditor` — not a CLAUDE.md §1 critical path … the one server read added is a display-grade read of an existing indexed row, no write, no engine contact."* The kickoff named only `@code-reviewer`, consistent with that. Recorded so the omission reads as a decision rather than a lapse. `@db-migration-reviewer` is inapplicable — no schema or migration file is touched.

### Fixed in-session (`3b7db8d`)

**HIGH-1 — the layout read could take down every participant route.** The module's two `return null`s covered only missing rows; a thrown `postgres` error propagated straight out of `PublicLayout`. There is no `(public)/error.tsx`, and a same-segment `error.tsx` cannot catch its own layout's throw anyway, so it landed on `global-error.tsx` — all four `(public)` pages plus the branded 404 replaced with "Something broke." for a value that is pure chrome. **The module already claimed this behaviour** at its `users`-row branch (*"degrading to render nothing is strictly better than 500-ing every page"*) and implemented it for the unreachable failure mode rather than the likely one. And **r5's Q4, committed one commit earlier in this same session, ratifies the shape**: *"A layout that throws breaks every route it wraps … any error returns `null`."* Wrapped; any throw returns `null`.

*This is the finding worth keeping.* It is the exact failure the plan reasoned about for `FreezeBanner` — a component that was never built — while the read that actually shipped into the same layout went unguarded. The doctrine was written and then not applied to the code beside it.

**MEDIUM-1 — the statement order is a correctness constraint and nothing said so.** Balance first, cursor second: an accrual committing between the two snapshots can only UNDERSTATE by one credit. Reverse them and it OVERSTATES by exactly `DAILY_CREDIT_DHARMA` — the header promising capacity the composer will reject, which is the inversion the file's own docblock says it exists to prevent. A transaction would not substitute (READ COMMITTED is still two snapshots; `loadViewerMarketContext` has the same property inside one). Comment only.

**MEDIUM-2 — the read-cost comment was wrong.** It budgeted "twice per request". But `router.refresh()` re-executes the **layout** as well as the page, so on `/m/[slug]` a signed-in viewer holding the tab open costs 2 reads / 15 s / tab. **Verified against `docs/logs/F-DEBATE-4.md:213`, which measured it and says so in those words** — not taken from the review on trust.

### One judgment beyond the review

**Gate C: ratified — it stays.** The reviewer's fix was a bare `try/catch → null`. The catch **also reports**, via `safeCaptureException`. A chrome figure silently vanishing for every signed-in participant is precisely the outage that should not be invisible, and the wrapper is itself fail-open (SPEC.2 §17.5), so observing a failure cannot cause one. It is **not deduped or sampled**: `DebatePoll` re-runs this layout every 15 s per open `/m/[slug]` tab, so a deterministic DB failure emits at 4/min/tab — the same amplification shape as F-DEBATE-4 docket item 10, and it belongs to that HARDEN pass. Named in the code and recorded here as a choice, not an omission.

### The RED, attributed

T9's four cases were proved against a tree with the catch removed and the **final** test files in place — exactly 3 of 11 fail, the other 8 hold:

```
AssertionError: promise rejected "Error: simulated postgres failure" instead of resolving
 ❯ tests/integration/header-balance.integration.test.ts:289:3
```

The **second** case is the load-bearing one: a `try` around only the first statement passes case 1 and still takes the app down. The **fourth** is a negative — the ordinary no-ledger-row `null` must NOT report, or every pre-grant page load emits a Sentry event; it passes with and without the fix, by design.

### Recorded, deliberately NOT fixed

Each is judgment-shaped or out of scope. Nothing here is a defect in shipped behaviour.

1. **MEDIUM-3 — header and composer can disagree within one painted frame.** The layout's read and `loadViewerMarketContext`'s happen at different instants; if the credit accrues between them the header shows `B` and the composer `B+10`. Transient, display-only, self-healing on the next render. Recorded so it is never mistaken for a ledger defect.
2. **LOW-1 — `IdentityCluster.tsx:13–15`'s comment is now false.** It says the chip "stands alone in the signed-in right zone"; the Balance half now ships. Plan §4 names that file **explicitly untouched**, so correcting it is a scope decision for Gate C, not something to absorb silently.
3. **LOW-2 — `spendable` shipped optional (`spendable?:`), Q6b specified required.** Deliberate: it is what lets the `(auth)` layout mount the header without a balance fetch. The cost is a lost compile-time forcing function — a future group layout renders no balance instead of failing to typecheck. The reviewer explicitly did not ask for a change.
4. **LOW-3 — the DOM-order deviation. RULED AT GATE C: not a bug, and not a code deviation at all — a *plan-text* deviation.** Q6c's **substance is the authority**: `BalanceCluster` before the divider, `VisitorCounter` after, order `[BalanceCluster] [IdentityCluster] │ [VisitorCounter]`. The `:51`/`:52` line reference was **pre-edit numbering that went stale while the plan was being written** — it was never a competing instruction. The code followed the substance and is correct as shipped; nothing changes. **T4 asserts the ordering, which is the thing that matters.** Recorded here so the contradiction in the closed plan does not read as an unresolved question to whoever opens it next.
5. **LOW-4 — the footer regression guard is narrower than the ruling.** It greps three layout files for `SiteFooter` and `<footer`. A footer re-added under another component name, or mounted in a page or nested layout, is not caught — so *"a hand-rolled replacement is caught too"* holds only within those three files. A `no-page-footer.test.ts` globbing `src/app/**/layout.tsx` would be the real enforcement.
6. **LOW-5 — test-fixture nits.** `const userId = user?.id ?? ""` turns a fixture failure into a confusing downstream assertion; the backdated rows are deliberately chain-inconsistent (`amount: "0"` with a changing `balance_after`) and must never be reused as a ledger-chain fixture.
7. **LOW-6 — `SCAN_FILES` still omits `src/app/layout.tsx`**, the file whose `<html>`/`<body>` shell `global-error.tsx` mirrors. **Pre-existing**, made more visible by this edit; left per §5.3.
8. **§7 soft deviation** — the plan says *"existing suites pass untouched"* and `84dc34e` edits two existing guard files. Both **widen** coverage; the reviewer read this as correctly handled. Flagged for Gate C rather than passed over.

**Independently confirmed by the review, worth keeping:** the `"use client"` directive in `global-error.tsx` is **not** defeated by the SPDX comment above it — verified against the build output (`registerClientReference` for that module in `.next/server/chunks/ssr/`), not argued. It is the only file in `src/` with a comment above the directive, so no precedent existed. Also: the `MONEY_IDS` regex was replayed against all 112 scanned files with and without the new `spendable` entry — offender list `[]` both ways, so **zero false positives** were introduced.

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
3. Record the squash SHA into this log and the plan's `| **PR** |` row — it is the only durable reference either document will ever carry. (PR #283 is already recorded above; the SHA is what is missing.)
4. Check whether the merged branch auto-deleted (`git ls-remote`); delete manually if it survived.

**Then the forked S4 task**, which starts by writing the §21.7 rider — not by writing `FreezeBanner.tsx`.

*Gate C was read and approved before merge. Its four rulings are recorded inline above: LOW-3 is a plan-text deviation and not a code defect · the restored ` ```ts ` fence stays · `safeCaptureException` stays · r5's stale `e085d29` cite is left as written and corrected at close-out.*

---

## Context to preserve

- **`docs/plans/SHELL-COMPLETE.md` is CLOSED.** r5 says so in the file itself. S4's ratified decisions (Q4 as revised, Q4b, Q5) carry to the forked task; nothing else builds from it. Every footer reference in the body is void and marked so at the top — do not read §4/§5/§6/§7 without reading r5 first.
- **The header reads spendable; the profile tile reads raw.** They diverge by one Daily Credit on any unclaimed day, by design. Anyone "fixing" the inconsistency should read decision 4 first.
- **T5a is the only guard on the replicated ADR-0029 read**, and it was vacuous until this session. If it is ever simplified — particularly if the backdated `created_at` SQL expressions are turned back into JS `Date`s — it silently stops guarding anything.
- **`.mapWith()` on a bare `sql` fragment is not optional and `tsc` will not tell you.** Two files now depend on it; the failure is a wire string where a `Date` is expected.
- **The two-sessions-one-Postgres false red is reproducible and expensive.** `truncateTables` disables the whole Bucket-A guard set per call. Check `ps` before believing any red.
- **Read the durations before the assertion.** Both false reds on this task were latency, not logic, and only one had a second runner to find. A `Hook timed out` is a *latency* symptom by construction; a file that took 809 s where it takes 25 s, in a run whose `prepare` alone took 208 s, has already told you the answer. A full run here is **~3 minutes** on an unloaded machine — the 21-minute runs earlier in this session were themselves the warning.
- **The root and `(public)` 404s are deliberately different surfaces**, and the difference is an ADR-0023 Option-2 requirement, not a styling choice. A `GlobalHeader` added to the root variant leaks participant chrome onto the admin `notFound()` throws.
- **Anything awaited in `(public)/layout.tsx` must be fail-safe, and this is now the second file to prove it.** A throw there has no route-level boundary above it — `global-error.tsx` is the only catcher, so one failed read replaces every participant route. `getHeaderBalance` is wrapped; the pre-existing `auth.api.getSession` call beside it is **not**, and that is a deliberate difference (a session read arguably *should* fail loudly). Any future layout-level read inherits this question and should answer it explicitly.
- **The statement order inside `getHeaderBalance` is a correctness constraint**, not a style preference, and reversing it inverts an understatement into an overstatement of one Daily Credit. It is now commented; do not reorder on aesthetic grounds.

## Time

Single session, ~2h wall clock. Dominated by the suite, run in full three times — 1276 s + 1387 s + 192 s ≈ 48 min of the total, and the first two figures are inflated by the machine stall described above, not by the suite. Ground checks + branch/diff read ~10 min · rebase ~2 min · plan r5 ~8 min · log ~15 min · reviewer cascade ~10 min · remediation + attributed RED ~15 min · close-out + PR ~10 min.
