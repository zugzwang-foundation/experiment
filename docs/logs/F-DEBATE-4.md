# F-DEBATE-4 (B3) — session log

> **Date:** 2026-07-31 (UTC; 2026-08-01 IST) · unattended overnight run, single session (PLAN + EXECUTE)
> **Ground:** `origin/main` @ `54b0b2a` · worktree `~/code/zugzwang/wt-pctround` · branch `feat/f-debate-4`
> **Recon:** a separate read-only session; report at `~/Desktop/zz-recon-F-DEBATE-4/RECON.md` (F1–F16)

---

## What landed

**PR #279 — `feat/f-debate-4`** (6 commits, all SSH-signed, left **unmerged**):

| Commit | What |
|---|---|
| `9c40314` | `docs/plans/F-DEBATE-4.md` — the plan, first commit on the branch, before any code |
| `887da63` | the five acceptance rows, **RED** |
| `80bdc5d` | the build + same-commit riders + the flow file |
| `76963d5` | `@code-reviewer` remediation |
| `83cc485` | the unthrottled-resume residual from review round 2 |
| `ccb9717` | `@security-auditor` remediation — the two load-bearing property pins |

**Source (4 files):**

- `src/components/debate/DebatePoll.tsx` **(new)** — a `"use client"` leaf rendering `null`, owning one `setInterval` calling `router.refresh()`, which re-invokes the **existing** `/m/[slug]` server read path. Two effects: a `visibilitychange` mirror (the repo's **first** visibility handling) and the poll itself, with a `wasSuspended` arm-flag and a `stopped` latch.
- `src/components/debate/DebateView.tsx` — one import, one element, one comment. `composerOpen` derived from `openSide`/`openReply`, state the host already held.
- `src/server/config/limits.ts` — `POLL_INTERVAL_MS_DEBATE_VIEW = 15000`, a **provisional** pin, tune still deferred to HARDEN.6.
- `src/app/(public)/m/[slug]/page.tsx` — explicit `export const dynamic = "force-dynamic"`.

**Tests (3 files, +27 cases):** `tests/unit/debate/render/poll.test.tsx` (new, 12), `tests/server/debate-view/poll-contract.test.ts` (new, 14), and one added case in the existing `load-debate-view.integration.test.ts` masking block.

**Docs (5 files):** SPEC.1 → **1.0.25**, SPEC.2 → **1.0.22**, `docs/specs/flows/F-DEBATE-4.md` (the **first flow file in the repo to carry substance**), CLAUDE.md §6, AGENTS.md §9.

**PR #280 — `chore/f-debate-4-log`** — this log.

---

## Decisions made

1. **The mechanism is `router.refresh()` on a client interval, not an endpoint.** The whole task turns on this. A dedicated read endpoint would fork removal-masking — keyed *solely* on `loadRemovedSet` inside `loadDebateView` (ADR-0021; ADR-0034 D-4) — into a second implementation, and two masking implementations are two places for masking to diverge. `loadDebateView` carries a **zero-line diff**; no field entered any DTO.
2. **Suspension keyed on composer-OPEN, not composer-dirty.** Recon measured that a refresh costs the composer *nothing* — text, controlled state, focus, caret and scroll all survive, and the component never remounts. But a refresh whose server render **throws** destroys the entire client tree and the unsaved argument with it, arriving as an HTTP 200 with a poisoned payload that `router.refresh()` gives no way to detect or back off from. An open-but-empty composer sits in that blast radius identically to a dirty one, so the reader's *intent to compose* is the gate.
3. **The stop is latched, not merely conditional.** `stopped` is write-once, so "stopped permanently" does not rest on the market state machine never returning to `Open`.
4. **The poll carries no notion of the global conclusion freeze.** `system_state.frozen_at` reaches no client component; `FREEZE_INSTANT_UTC` against an untrusted client clock is a guess about a database state flip. `market.status` is real, already on the model, and free.
5. **The masking acceptance row is a structural guard, and its test file says so.** There is no new masking code, so a behavioural test would prove nothing. It proves the structural premise instead — exactly one debate read path exists, the poll rides it — and its docblock now enumerates what it does *not* catch.
6. **The CLAUDE.md §6 sentence supersedes rather than stacks.** `origin/main` already carried a MODEL-REPIN sentence covering only the *mid-session-edit* half of the rule. The kickoff's sentence adds the load-bearing *working-directory* half. Two overlapping sentences would violate CLAUDE.md §7's prune-on-supersession discipline, so the new text replaces the old and keeps its provenance parenthetical.

---

## Surprises caught + fixed in-session

**1. `@code-reviewer` HIGH-2 — the plan and the flow file described a UI that does not exist.** Both said a poll can "reorder the column a reader is mid-sentence in". There is no column to reorder. `PostScroller` is a **one-card pager keyed by array position** (`useState(0)` → `posts[clamped]`, `scrollers.tsx:79-84`), and `index` survives a poll because the element sits at a stable tree position. So a re-ranked Top order does not reorder a list — it **silently replaces the entire visible argument**, with the `N / M` label unchanged and no visual cue whatsoever. Verified by direct read before acting. The flow file's accepted-behaviour section was rewritten from scratch and the plan's out-of-scope bullet with it; the behavioural fix is docketed to POLISH.3. **This is the most valuable thing the cascade produced** — the ratified accept-and-document ruling had been made against an inaccurate description of the surface.

**2. `@code-reviewer` MEDIUM-5 — the "no aria-live on the polled region" premise was false.** `scrollers.tsx:41` already carries `aria-live="polite"` on the pager counter, inside the polled tree. The decision not to *add* aria-live stands; the claim that none existed did not. Docblock corrected, treatment docketed.

**3. Three further accepted behaviours the review surfaced**, now named in the flow file rather than discovered by a participant in September: the post pop-up and image lightbox are **frozen snapshots** (`popupPost` holds an object, unlike `selectedPost`, which re-derives via `posts.find` and therefore re-masks correctly), so an open pop-up keeps rendering a post removed between ticks; a successful bet costs **two** RSC renders, because `BetComposer` refreshes and then closes, and closing un-suspends the poll into its resume refresh; and `BetComposer`'s `p3_protective_landing` branch refreshes **while the composer is still open**, so the blast-radius argument behind the suspension rule is a strong default rather than an absolute.

**4. SPEC.2's §0 status banner would have re-created the exact drift its own 1.0.21 row records repairing.** The rider enumerates two banner edits, neither of them the banner's own version token. Applying only those would have left the banner at 1.0.21 against §0 metadata at 1.0.22. Bumped, and recorded as an unratified choice.

**5. Docketed correction (a) had already been applied.** Skipped per the rider's own item 8, which anticipates exactly this. `@code-reviewer` asked that the docket's **desired end state** be recorded verbatim rather than just the conclusion, so that the next reader can audit it — quoted here in full:

> **(a) §20, the 1.0.24 row, sixth (ADR) cell.**
> PRECONDITION: it currently repeats the sentence "No test in the suite exercised a tie."
> IF SO, replace that cell with:  —
> (Every other un-ADR'd row in §20 carries — in this cell.)

The desired end state is therefore an em dash, and the cell **already reads `— |`** on `origin/main` and in the final tree. The sentence appears exactly once in the whole document, in the fifth (Rationale) cell of that row, where it belongs. The precondition does not hold, and performing the edit would have been a no-op — so nothing is left undone, and the §20 1.0.25 row's conditional clause ("ride this commit **where their anchors still hold**") is satisfied.

---

## The RED proof (STEP 5)

Captured against a tree with the implementation removed (`git stash push -- src/` plus `DebatePoll.tsx` moved aside), using the **final** test files.

```
 FAIL  tests/unit/debate/render/poll.test.tsx [ tests/unit/debate/render/poll.test.tsx ]
Error: Failed to resolve import "@/components/debate/DebatePoll" from "tests/unit/debate/render/poll.test.tsx". Does the file exist?
  Plugin: vite:import-analysis
  23 |  const __vi_import_3__ = await import("@/components/debate/DebatePoll");
     |                                       ^
```

```
 FAIL  poll-contract.test.ts > debate-view::poll-preserves-removal-masking > the poll module exists and refreshes by re-invoking the server read
AssertionError: expected null not to be null
 FAIL  poll-contract.test.ts > debate-view::poll-preserves-removal-masking > the poll issues no client-side data fetch of its own
AssertionError: expected null not to be null
 FAIL  poll-contract.test.ts > debate-view::poll-preserves-removal-masking > keeps masking single-sourced on loadRemovedSet (ADR-0034 D-4)
AssertionError: expected null not to be null
 FAIL  poll-contract.test.ts > debate-view::poll-stops-when-market-leaves-open > takes its stop signal from market.status, threaded through the host
AssertionError: expected '"use client";\n\nimport { type ReactN…' to match /<DebatePoll[\s\S]*?marketOpen=\{marke…/
 FAIL  poll-contract.test.ts > debate-view::poll-stops-when-market-leaves-open > carries NO notion of the global conclusion freeze (RULING D)
AssertionError: expected null not to be null
 FAIL  poll-contract.test.ts > debate-view::poll-stops-when-market-leaves-open > the polled route is explicitly dynamic, not dynamic by accident (RULING F)
AssertionError: expected 'import { headers } from "next/headers…' to match /export const dynamic = "force-dynamic…/

 Test Files  2 failed (2)
      Tests  6 failed | 5 passed (11)
```

The five passing rows are the **documented contract pins** — they pass at HEAD by design and exist to turn RED if a future lighter poll path forks the read.

**Sequence, stated exactly:** tests were written and committed RED first (`887da63`); the structural file's assertions were then switched to comment-stripped source during implementation, because a negative source-grep that also matches its own documentation is a bad guard; the RED above is the **re-capture with the final files**, which is what counts.

---

## Verification

| Gate | Result |
|---|---|
| `pnpm vitest run` (full, isolated) | **286 files passed / 1 skipped · 2086 passed / 1 skipped / 4 todo · exit 0** — baseline 284 / 2059 |
| `pnpm tsc --noEmit` | exit 0 |
| `pnpm biome check .` | exit 0 (1 pre-existing warning in `tests/server/bookmarks/masking.test.ts`, untouched) |
| `next build` | exit 0; `/m/[slug]` classified `ƒ (Dynamic)` |

**Test delta accounted exactly: +2 files, +27 cases** — 12 in `poll.test.tsx`, 14 in `poll-contract.test.ts`, 1 in `load-debate-view.integration.test.ts`. (Round 1 landed 13 + 11 + 1 = 25; remediation dropped the value-pin and added the route-inventory test, then the security pass added the write-free and session-refresh guards.)

**Structural proofs:** `loadDebateView` diff **0 lines** · `BetComposer` diff **0 lines** · no new file under `src/app/api/` · no new `route.ts` anywhere · no field added to `DebatePost` / `DebateReply` / `DebateViewModel` / `ViewerMarketContext` / `MarketSummary` (0 lines across all DTO-bearing modules) · no inlined `15000` in `src/` outside the constant's own definition and JSDoc · all 5 flow-file Acceptance names present verbatim in SPEC.1 §17 (SPEC.2 §13.5).

---

## Unratified choices

Judgement calls the rulings did not cover, each made toward the option most consistent with them.

**1. Proceeded despite the STEP 0.2 agent-pin check FAILING.** This session's launch directory is the **primary worktree** (`~/code/zugzwang/experiment`, on `chore/commit-cd-a`), whose `.claude/agents/*.md` pin `claude-opus-4-8`; `origin/main` pins `claude-opus-5`. A CLI session cannot relaunch itself into another directory, so the check could not be made to pass from inside the session. **Options:** (a) stop the whole overnight run; (b) proceed with an explicit per-call `model` override. **Chose (b)** — the seven HALT conditions do not cover it, MODE says "handle all hurdles", RULING H already contemplates a reviewer that cannot start, and the override delivers exactly what the repin intended. Both reviewers were invoked with `model: "opus"` and both ran on `claude-opus-5`, confirmed in the transcript. Every command targeted the worktree explicitly; the primary tree was never written to. **This is the one thing to check first in the morning.**

**2. Split the stop rule's test placement.** SPEC.1 1.0.25's Acceptance bullet classifies the stop rule as a *read-path* test, but the stop *effect* is client-side. Honoured both by splitting honestly: the read-path file pins the signal's **provenance** (`market.status` is the sole input; no freeze signal anywhere in the poll) and carries the §17 row; the client-render file exercises the interval actually stopping, under its own supporting name. Each §17 name appears exactly once.

**3. The CLAUDE.md §6 sentence replaces rather than sits beside the existing MODEL-REPIN sentence.** The rider says "add … as a new sentence"; the existing sentence states a strict subset of the new one. Stacking both would violate CLAUDE.md §7's prune-on-supersession rule. Kept the rider text verbatim and appended a provenance parenthetical.

**4. Bumped SPEC.2's §0 status-banner version 1.0.21 → 1.0.22**, beyond the rider's two enumerated banner edits. See Surprise 4.

**5. Added an AGENTS.md §9 Component/render bullet.** STEP 8.4 said surface it, fix only if it rides cleanly. It rides cleanly: this PR adds a `*.test.tsx` under exactly that harness. See the closing ritual below.

**6. Encoded "never restarted" as a `stopped` latch** rather than relying on the market state machine never returning to `Open` — three lines, and it removes a cross-module assumption from a client component.

**7. Declined `@code-reviewer` HIGH-3.** It asked me to either perform the §20 1.0.24 ADR-cell correction or strike the clause asserting it. Neither: the correction's target state already holds (Surprise 5), so performing it is a no-op, and striking the clause means editing verbatim web-authored rider text — HALT condition 4 for this session. Reported instead, in the PR body and here.

---

## Reviewer cascade — as actually run

Sequential, per RULING H and the "one reviewer touching the DB at a time" rule. Both invoked with an explicit `model: "opus"` override (see Unratified choice 1) and both **confirmed running on `claude-opus-5`** in the transcript.

| Reviewer | Round | Verdict |
|---|---|---|
| `@code-reviewer` | 1 | 1 CRITICAL · 2 HIGH · 7 MEDIUM · 6 LOW |
| `@code-reviewer` | 2 (after one remediation pass) | **CLEAN — no CRITICAL, no HIGH** |
| `@security-auditor` | 1 | **No CRITICAL, no HIGH in scope** · 2 MEDIUM · 5 LOW · 1 SURPRISE (pre-existing HIGH) |

Round 1's CRITICAL was **provenance, not correctness**: the CLAUDE.md §6 sentence is ratified verbatim by the execute kickoff, but the plan never listed it, so the reviewer could not trace it. Fixed by recording all four contract-file edits in plan §8. Round 1's two HIGHs produced Surprise 1 (the pager) and the §20 clause I declined; every MEDIUM and LOW was either applied or declined with a stated reason. Round 2 re-verified each artifact rather than taking the disposition on trust, and **withdrew the declined HIGH** after re-reading the rider's conditional clause.

Directed sub-questions the cascade answered separately, per ADR-0034's anti-decay clause:

- **`DebateViewModel` gained no viewer-scoped field** — 0-line diff across `load-debate-view.ts`, `types.ts`, `viewer-context.ts`, `get-by-slug.ts`.
- **`loadDebateView`'s signature is unchanged** — verified textually and pinned by a test.
- **The poll's state machine** — initial-mount guard, StrictMode double-mount, the `stopped` latch, the dependency array, and listener removal all verified correct, the router's referential stability checked against the real Next 16.2.4 implementation rather than the test's mock.

**What `@security-auditor` established that is worth keeping.** Masking under repetition is not merely safe, it is a **net improvement**: `loadRemovedSet` runs at statement 6 against a strictly newer READ COMMITTED snapshot than the content read at statement 1, so no ordering exists in which a body is read after the mask; `mod_actions` is Bucket A, so `removedSet` is **monotone** and repetition is idempotent; and pre-poll a reader's payload was frozen at page load *forever*, so the un-popped staleness window shrank from unbounded to ≤15 s. Two of its findings are genuinely new and are docketed below (M-1, M-2). Two cheap test-only guards it suggested were taken in-session (**F-DEBATE-4 L-5, L-2** — task-scoped: these are this audit's LOW findings, not V-space verification lessons and not `POLISH-register-ADDITIONS.md`'s L-space): the polled read path is now pinned write-free — `viewer-context.ts` already documents that the tempting reuse would turn attendance into Daily-Credit issuance, ADR-0018's rejected Option 4, and at 4×/min that is not a slow leak — and `disableSessionRefresh: true` is pinned, because with it flipped every open tab would become a session that never expires while the tab lives. It also verified empirically, against `.next/static/`, that tree-shaking keeps the rate-limit thresholds and the moderation-vendor pin out of the client bundle despite `DebatePoll` importing `@/server/config/limits`.

---

## Docketed — recorded, deliberately NOT built (POLISH.3 unless the item names another owner)

1. **`/m/[slug]` has no `error.tsx`** and is the only major `(public)` route without one. It would not save the composer — a segment boundary still replaces the subtree — but it would replace Next's raw `ERROR 4091419771` page with something branded. **This build is what makes it urgent.**
2. **The pager silently swaps the argument under a reader** (Surprise 1). Fix: hold the pager position as a comment id and derive the index.
3. **The pager counter's `aria-live`** now announces on ranking churn without user action (Surprise 2).
4. **The post pop-up / image lightbox are frozen snapshots** and keep rendering content removed between ticks (Surprise 3). Fix: `popupPostId` + `posts.find`.
5. **`priceChart` is the one non-fatal read** in `loadDebateView`; under 4×/min polling a flaky reserve replay makes the chart appear and vanish with no explanation.
6. **Two RSC renders per successful bet** (Surprise 3); the per-tick cost recorded in SPEC.1 §16.1 is understated by 2× on the bet path. The resume-refresh is also unthrottled and reader-triggerable (roughly F5-equivalent, so bounded).
7. **A removed image stays fetchable for up to an hour** — `@security-auditor` M-1, and the sharpest item on this list. `mintImageUrls` mints a presigned R2 GET with `READ_URL_TTL_SECONDS = 3600`; masking is instantly correct on the next payload, but an already-minted URL is a **bearer credential R2 cannot revoke**. The poll turns "a reader had to be lucky enough to have loaded within the hour" into "any viewer with a tab open holds a credential minted ≤15 s before the removal". Image-category false negatives are the one class ADR-0021 leaves to reactive removal alone. Fix: shorten the render-side TTL toward the poll interval, or proxy image reads through a `removedSet` re-check.
8. **The per-tick cost is O(market), not constant** — `@security-auditor` M-2. `listMarketComments` has no `LIMIT` ("load-all v1", D11) and the price replay walks every bet event, so three of the 12–14 round-trips scale with the market. **HARDEN.6 must size against `ticks × tabs × round-trips × O(market)`**, not the constant the spec currently states. Also wants a cap or keyset on `listMarketComments` before go-live.
9. **After the conclusion freeze the poll never stops** — `closeDueMarkets` returns early once `frozen_at` is set, so markets `Open` at the freeze instant stay `Open`, and every tab keeps polling immutable data forever. Not a freeze bypass; the stop rule simply does not fire when it would be most valuable.
10. **Smaller, from the audit:** no explicit `Cache-Control: no-store` on the page, unlike both its siblings, which comment that a cache is a window in which just-removed content could keep serving (**F-DEBATE-4 L-1**); and `safeCaptureMessage`/`safeCaptureException` on the polled path are neither deduped nor sampled, so a deterministic failure emits `images × 4/min × tabs` Sentry events and can mask a real alert (**F-DEBATE-4 L-3**).

**Also surfaced once, not fixed (out of scope), and written to `claude-progress.md`:**

- **`/m/[slug]` carries NO rate limit** — `@security-auditor` **SURPRISE S-1, pre-existing HIGH**. `proxy.ts` matches `/admin/:path*` only, so neither the page nor its RSC route reaches `src/server/middleware/rate-limit.ts`, and each request costs 12–14 sequential session-pooler round-trips. **This PR does not make it exploitable; it makes it urgent**, by raising the honest-user baseline. The auditor's blunt summary of the abuse question is worth quoting: visibility suspension *"reduces only the honest-user load; it reduces the attack surface by exactly zero"* — an attacker never executes `DebatePoll` at all. Wants a HARDEN.2 row.
- **SPEC.2 §4.3 catalogue drift** — eleven catalogued rows, thirteen `route.ts` on disk (`api/visits`, `api/cron/alarms-drain`, `m/[slug]/quote` built-but-uncatalogued; `api/dataset/manifest` catalogued-but-pending-build; 13 − 3 + 1 = 11). Pre-existing, now pinned by the route-inventory test so it cannot grow silently.

---

## Closing ritual — should the contracts change?

**Yes, and both edits ride this PR** (never a follow-up):

- **CLAUDE.md §6** — the working-directory half of the agent-definition rule. Trigger: this session hit it at STEP 0.2. Ratified in the kickoff.
- **AGENTS.md §9** — the jsdom + `@testing-library/react` component harness, and **the absence of `jest-dom`**. Trigger: the harness has existed since UI.0 and §9 never named it, so successive plans kept inheriting a false "the UI cannot be tested" premise. This task wrote a component test; documenting the harness it used is the cheapest possible moment.

**Workflow:** no change. **Tracker:** B3 → done, pending merge. The docket above carries **ten** items, of which **nine are POLISH.3 inputs** (1–7, 9, 10); **item 8 is HARDEN.6's** — G-3 promoted it in-spec from an observation to a named *prerequisite* for the number-tuning pass. The two *Also surfaced* items belong elsewhere again: the missing rate limit on `/m/[slug]` is **HARDEN.2**, and the SPEC.2 §4.3 catalogue reconciliation is **G-8**. *(This sentence read "six inputs" until Gate C — the count was written before `@security-auditor` added items 7–10 and was never updated. The flow file's **six** accepted behaviours is a separate and correct count: it records only what is visible inside the flow contract, so it excludes the missing `error.tsx`, the `priceChart` flicker, the absent `Cache-Control` and the Sentry amplification.)* The tracker is operator-maintained and external — nothing committed here.

---

## Open questions

None blocking. The six docketed items above are the queue.

---

## Next session starts at

**Merge order: `feat/f-debate-4` first, then `chore/f-debate-4-log`.** The log PR's body cites the feature PR number; merging the log first would leave a dangling cite.

After merge: `git checkout main && git pull`, then verify `git diff <feature-merge-SHA> origin/main` is empty and grep `POLL_INTERVAL_MS_DEBATE_VIEW` on `main` before flipping the tracker row (post-merge tree-content proof).

**Then POLISH.3**, whose input list this session tripled.

---

## Context to preserve

- The **agent-pin hazard is not fixed by this PR's CLAUDE.md sentence alone** — the sentence documents it. Any future reviewer-bearing session must be launched from a worktree at `origin/main`, or must pass a matching `model` override on every `Agent` call.
- `POLL_INTERVAL_MS_DEBATE_VIEW` is **provisional**. HARDEN.6 owns the tune, and it is genuinely a one-line change: nothing else in `src/` or `tests/` pins the value.
- The quantity HARDEN.6 must size against is **ticks × concurrent tabs × round-trips**, not the interval alone. One tick is 12–14 sequential DB round-trips per open tab including two session reads, because the refresh re-executes the layout as well as the page. Visibility suspension is the larger lever.
- The recon report at `~/Desktop/zz-recon-F-DEBATE-4/RECON.md` is the empirical record behind every ruling here and is worth keeping — in particular F3 (a throwing poll render destroys the client tree and arrives as HTTP 200) and F16 (refreshes coalesce).

## Time

Single unattended session, ~2h wall clock: setup + baseline ~15 min · read (recon + specs + ADRs) ~25 min · plan ~10 min · RED + implement ~30 min · riders + flow file ~20 min · verify ~15 min · reviewer cascade + remediation ~25 min · close-out ~10 min.
