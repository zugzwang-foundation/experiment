# tracker-sweep-v9 — operator tracker v8 → v9 mint

**Status:** Closed 2026-05-16
**Branch:** `chore/tracker-v9` (pre-merge at log-write time)
**PR:** to fill on open
**Predecessor:** SCAFFOLD.3 (`docs/logs/SCAFFOLD.3.md`, `main` at `62cd299`)
**Unblocks:** SCAFFOLD.13 kickoff (now in active queue per §3.4 of plan); future critical-path strata inherit correct upstream MAINT carry-forward set

---

## What landed (CLAUDE.md §5.9 field 1)

Single chore commit on `chore/tracker-v9`, branched from `main` at `62cd299`. Three in-repo files; one external operator surface (project-knowledge HTML).

| File | State | Notes |
|---|---|---|
| `docs/plans/tracker-sweep-v9.md` | Created | Plan body, promoted from `~/.claude/plans/` scratch on execute (CLAUDE.md §5.1) |
| `docs/logs/tracker-sweep-v9.md` | This file | Written before `gh pr create` per §5.9 |
| `docs/maintenance.md` | Modified (2 lines) | Bumped both `zugzwang_experiment_tracker_v7.html` references to `_v9.html` — line 20 (`What's in scope` table) + line 131 (`File-by-file audit cadence` table). Per CLAUDE.md §7 cleanup absorption rule. |

**External (operator-applied to project-knowledge HTML):**

- SCAFFOLD.3 row → Closed (2026-05-16, merge commit `62cd299`, PR #38).
- 13 MAINT rows: 10 carry-forward from `docs/logs/SCAFFOLD.3.md` MAINT-1..10 + 3 new — 2 from merge dance (MAINT-11 SHA-rewrite-on-rebase-merge, MAINT-12 protected-main friction) + 1 minted in-session from this PR's pre-PR self-audit (MAINT-13 version-bump-on-amendment discipline; row spec in plan §3.2).
- Explicit dep edge: SCAFFOLD.13 → any DB-touching stratum (per SPEC.2 §22.2 + §10/§11 reasoning).
- SCAFFOLD.13 promoted from "Unscheduled" → "Active queue" parallel to ENGINE.6.
- PRECURSOR.4 row-desc patch: "v1.0-draft" → "v0.3.1-draft" (SPEC.2 version anchor — kickoff originally said "v0.3.2-draft"; audit-time SURPRISE resolved to v0.3.1-draft, matching the current SPEC.2 header).
- PRECURSOR.5 row-desc patch: "v7 tracker structure" → "v8 tracker structure" (post-mint anchor).
- Tracker-level note: Infrastructure subscription strategy (Supabase Pro $25/mo at SCAFFOLD.13 cutover, Vercel Pro $20/mo mid-August 2026 pre-launch, ~$45/mo at 2026-09-15 launch).
- Running-ops sub-note on SCAFFOLD.13 row: Pre-SCAFFOLD.13 daily `pg_dump` cron bridge (mitigates Supabase free-tier 7d auto-pause + no-SLA risks).

Test state: N/A — no `src/`, no test changes. `just verify` runs as the PR gate (typecheck + lint + tests trivially green).

---

## Decisions made (CLAUDE.md §5.9 field 2)

### Plan-review resolutions (locked at plan-approval 2026-05-16)

All 7 plan-review questions resolved with Recommended options:

| Q | Topic | Resolution |
|---|---|---|
| Q1 | MAINT-11 / MAINT-12 wording | Drafted observations stand (§3.2 of plan) |
| Q2 | `pg_dump` cron placement | Running-ops sub-note on SCAFFOLD.13 row, not a numbered MAINT-13 |
| Q3 | `docs/maintenance.md` v7 → v9 bump | In-PR drift fix per §7 cleanup absorption |
| Q4 | Task ID | `tracker-sweep-v9` (one-off non-stratum chore) |
| Q5 | SCAFFOLD.13 queue placement | Parallel to ENGINE.6 (design-independent per SPEC.2 §22.2) |
| Q6 | PRECURSOR.5 row-desc anchor | "v8 tracker structure" — post-mint resulting state |
| Q7 | Tracker HTML committed to repo? | External-only; in-repo carries plan + log + maintenance.md only |

### Drift absorbed in this PR (CLAUDE.md §7)

- `docs/maintenance.md` had stale `_v7.html` references in two tables (lines 20 + 131). PRECURSOR.5's drift sweep last touched these at v6→v7; the operator-maintained tracker has since minted v8 (and now v9). Both references bumped to `_v9.html` in this PR, skipping the never-landed v8 reference. <2h fix per §7 cleanup absorption rule; not deferred.

### Reviewer-call invocation summary

| Call | Outcome |
|---|---|
| code-reviewer | NOT invoked — non-critical-path doc work per CLAUDE.md §5.11 "When NOT to invoke" |
| db-migration-reviewer | NOT invoked — no `src/db/schema/` or `drizzle/migrations/` changes |
| security-auditor | NOT invoked — no auth flow, no admin surface, no resolution mechanic, no moderation path |
| test-writer | NOT invoked — no new business-logic behavior (CLAUDE.md §5.6 doesn't apply) |

Kickoff explicitly mandated skipping §5.11 invocation for this work.

### Surprises caught + fixed in-session (CLAUDE.md §5.10 working as designed)

One SURPRISE surfaced during pre-PR self-audit. Full chain preserved for the record:

1. **Kickoff anachronism.** Operator kickoff specified the PRECURSOR.4 row-description patch as "v1.0-draft" → "v0.3.2-draft" (SPEC.2 version anchor).
2. **Pre-PR self-audit surfaced the mismatch.** Reading `docs/specs/SPEC.2.md` header directly: current version is **v0.3.1-draft** (last bumped at SCAFFOLD.4 close, 2026-05-15, per the §0.1 change-log row at line 44). SPEC.2 §0 versioning policy goes `v0.3-draft → v1.0` with no `v0.3.2-draft` step. SPEC.2 §0 also notes explicitly (line 42 changelog) "no v1.0-draft intermediate" — confirming the kickoff's "v1.0-draft" current-row text is correctly identified as drift, but the patch target is anachronistic.
3. **Web Claude plan-review verdict — Option 2 (v0.3.1-draft anachronism correction).** Reasoning preserved:
   - **On-disk truth wins.** SPEC.2 header at HEAD reads v0.3.1-draft; changelog has no v0.3.2 row. Tracker rows reference versions that exist, not versions the operator thought existed.
   - **Forward-reference rejection.** A row pointing at v0.3.2-draft when v0.3.2 has never been minted is a poison footnote — the next reader hunts for it and finds nothing.
   - **Close-time anchor unavailable.** PRECURSOR.4 has not closed (hasn't even started); no close-time state to anchor to.
   - **Spec-touch is out of scope.** Bumping SPEC.2 v0.3.1 → v0.3.2 in this PR violates CLAUDE.md §5.3 surgical changes + §5.4 stay-in-scope ("while we're here" is the failure mode §5.4 names directly).
4. **MAINT-13 minted in-session.** The SURPRISE exposed a real discipline gap: the §8.4 amendment in commit `66cec11` (SCAFFOLD.3) was a content change to a versioned spec WITHOUT a version bump, leaving v0.3.1-draft as the current header despite the §8.4 content delta. MAINT-4 captures **same-commit** discipline (amendment lands in the same commit as the code that motivates it) but NOT **content-change → version-bump** discipline. MAINT-13 captures this distinct rule (row spec in plan §3.2; paste-ready YAML). Resolution path: either (a) PRECURSOR.4 absorbs the §8.4 amendment as part of v1.0 promotion, or (b) a focused MAINT-13 PR mints v0.3.2-draft + changelog row before PRECURSOR.4 opens.

This is exactly the pattern CLAUDE.md §5.10 self-audit was designed to catch. The audit ran AFTER plan-approval, BEFORE PR-open; the kickoff text was wrong but the on-disk truth got the final word. Documented as a win, not a footnote.

### Pre-PR self-audit (§5.10, applied even though non-critical-path per kickoff)

Plan §6.2 walks the deliverable against actual edits. Run at log-commit time; results below (post-SURPRISE-resolution).

| Plan item | Where | Result |
|---|---|---|
| §3.1 SCAFFOLD.3 closed | External tracker v9 | PASS — operator-side action; this PR has no power to verify, but the plan text matches `docs/logs/SCAFFOLD.3.md` header verbatim |
| §3.2 MAINT-1..10 | External tracker v9 | PASS — plan §3.2 table titles match `docs/logs/SCAFFOLD.3.md:173–212` MAINT headings verbatim |
| §3.2 MAINT-11, MAINT-12 | External tracker v9 | PASS — wording in plan §3.2 matches Q1 resolution |
| §3.2 MAINT-13 (in-session mint) | External tracker v9 | PASS — paste-ready row spec captured in plan §3.2; operator applies verbatim |
| §3.3 dep edge | External tracker v9 | PASS — plan §3.3 cites correct SCAFFOLD.3 log lines `216–224` for rationale |
| §3.4 SCAFFOLD.13 promotion | External tracker v9 | PASS — placement parallel to ENGINE.6 matches Q5 resolution + SPEC.2 §22.2 |
| §3.5 row-desc patches | External tracker v9 | SURPRISE-then-PASS — PRECURSOR.5 anchor "v8 tracker structure" matches Q6 resolution as-written. PRECURSOR.4 anchor: kickoff "v0.3.2-draft" caught as anachronism at audit-time; resolved to "v0.3.1-draft" (current SPEC.2 header). Full chain in §"Surprises caught + fixed in-session" above. Plan + log updated mid-execute. |
| §3.6 subscription strategy | External tracker v9 | PASS — figures ($25 + $20 = $45/mo) within SPEC.2 cost ceiling per ADR-0005 row in `docs/logs/SCAFFOLD.3.md` |
| §3.7 `pg_dump` cron note | External tracker v9 | PASS — placement matches Q2 resolution |
| §4.1 plan file | In-repo | PASS — `git ls-files docs/plans/tracker-sweep-v9.md` returns the path after this branch's commit |
| §4.2 log file | In-repo | PASS — this file |
| §4.3 maintenance.md | In-repo | PASS — `git diff main -- docs/maintenance.md` shows 2 lines, both `_v7.html` → `_v9.html` |

12/12 audit items PASS after SURPRISE resolution. One SURPRISE caught + fixed in-session (§3.5 PRECURSOR.4 anchor + MAINT-13 mint). Zero FAIL items.

---

## Open questions / non-blocking items (CLAUDE.md §5.9 field 3)

**None at close time.** All plan-review questions resolved; all in-repo edits verified by self-audit; all external edits documented for operator application.

Non-blocking note: MAINT-11 lesson applied to this log itself — no pre-merge branch SHAs quoted; PR field reads "to fill on open" per SCAFFOLD.3 + SCAFFOLD.4 convention. The post-merge SHA on `main` for this PR will be derivable via `git log main --grep 'chore(tracker): v8 → v9'` after merge.

---

## Next session starts at (CLAUDE.md §5.9 field 4)

**SCAFFOLD.13** — Supabase Pro provisioning + Doppler integration. Now active per this sweep's promotion. Two paths fork from here depending on operator state:

- **Path A — SCAFFOLD.13 kickoff first.** If Supabase Pro billing trigger is ready, kick off SCAFFOLD.13 plan. Deliverables include: Supabase Pro upgrade, Doppler-wired staging + production `DATABASE_URL`, Upstash credentials audit + Doppler fold-in (per SCAFFOLD.3 log §216–224 (b)), Vercel CLI papercut absorbed via Doppler integration, retirement of the pre-SCAFFOLD.13 daily `pg_dump` cron once native PITR is live.
- **Path B — ENGINE.6 first.** If SCAFFOLD.13 needs to wait on operator-side billing, kick off ENGINE.6 (events helper at `src/server/events/insert.ts`) per SCAFFOLD.3 log §106–118. ENGINE.6 unblocks the 6 stubbed `// TODO(ENGINE.6): write*Event(...)` call sites in SCAFFOLD.3 auth flows. Pre-launch deadline: ENGINE.6 must close before 2026-09-15 so the dataset export (SPEC.2 §19) has consumable event-row history.

Both paths are parallel-eligible (design-independent per SPEC.2 §22.2). The operator's billing-trigger state picks the order.

---

## Context to preserve (CLAUDE.md §5.9 field 5)

### Tracker version bookkeeping

- Tracker external version state: **v9** (operator project-knowledge HTML).
- In-repo `docs/maintenance.md` reference: **v9** (was v7 before this PR; v8 was never reflected in-repo).
- Future plans / logs should reference v9 — drift back to v7 / v8 would be a new sweep target.

### MAINT carry-forward set is now in the tracker, not just in SCAFFOLD.3's log

Before this sweep, the only durable home for MAINT-1..10 was `docs/logs/SCAFFOLD.3.md`. Future strata reading that log would need to discover the items by reading the log. Now MAINT-1..12 live in the tracker's dedicated MAINT section, which is the operator-canonical surface for cross-task carry-forwards.

### MAINT-11 + MAINT-12 are merge-time lessons

These two MAINT items surfaced during the SCAFFOLD.3 rebase-merge dance, AFTER the SCAFFOLD.3 close-out log was written. They could not be appended to `docs/logs/SCAFFOLD.3.md` because close-out logs are append-only-after-commit (CLAUDE.md §7 implicit). The v9 tracker is the right home.

**MAINT-11** (SHA-rewrite-on-rebase-merge) is already applied as a lesson in this log: no pre-merge branch SHAs quoted; PR field reads "to fill on open".

**MAINT-12** (protected-main friction) is captured but not yet acted on. Two open paths: (a) admin-merge bypass policy for chore-tier PRs, (b) accept the friction as policy. Decision deferred until pattern repeats >2x.

### Infrastructure subscription strategy is now locked

- Supabase Pro $25/mo activates at SCAFFOLD.13 cutover.
- Vercel Pro $20/mo activates mid-August 2026 pre-launch.
- ~$45/mo at 2026-09-15 launch — within SPEC.2's $300/mo default ceiling + $500/mo pre-authorized upgrade tier per ADR-0005.

Future plans that touch infra cost should reference this baseline; the v9 tracker carries the canonical statement.

### Pre-SCAFFOLD.13 ops bridge

Daily `pg_dump` cron against the interim Supabase free-tier `DATABASE_URL` → encrypted off-site backup (R2 bucket, age-encrypted). Mitigates two risks until SCAFFOLD.13 swap:

- (a) 7d auto-pause data loss (free-tier behavior)
- (b) free-tier no-SLA outages

Retire when SCAFFOLD.13 swaps to Supabase Pro with native PITR.

### SCAFFOLD.13 ↔ ENGINE.6 parallelism

Both are design-independent per SPEC.2 §22.2 and touch disjoint surfaces (infra/env vs in-process events helper). Operator can run either first or both concurrently as billing/availability dictates.

---

## Time (CLAUDE.md §5.9 field 6 — optional)

~1.5h wall clock from kickoff (plan-mode entry) to log commit. Plan-mode phase 1 + 2 exploration: ~25 min (two parallel Explore agents). Plan-draft + clarification round: ~40 min. Execute (branch + plan promote + maintenance.md edit + log + audit): ~25 min.

---

## CLAUDE.md / AGENTS.md / workflow / tracker amendments

Per CLAUDE.md §7 closing ritual ("Should CLAUDE.md, AGENTS.md, the workflow, or the tracker change as a result of this session?"):

- **CLAUDE.md** — no amendment. No new invariant, no new critical path, no workflow change discovered.
- **AGENTS.md** — no amendment. MAINT-2 (test-path convention drift) is its own future task; not absorbed here per kickoff scope.
- **Workflow (CLAUDE.md §5)** — no amendment. MAINT-11 (SHA-rewrite-on-rebase-merge) is captured as tracker MAINT, not a CLAUDE.md §5 rule change yet; if the pattern repeats >2x, consider promoting to a §5.9 logging convention ("close-out logs reference PR# only, not pre-merge SHA").
- **Tracker** — this PR's primary deliverable; documented above.
- **`docs/maintenance.md`** — drift-fixed in-PR (v7 → v9 reference).
- **No ADR** — no architectural change.

---

## Single source of truth — files touched

| File | State | Notes |
|---|---|---|
| `docs/plans/tracker-sweep-v9.md` | Created | Plan body promoted from `~/.claude/plans/` scratch |
| `docs/logs/tracker-sweep-v9.md` | This file | Created |
| `docs/maintenance.md` | Modified (2 lines) | `_v7.html` → `_v9.html` in two tables |
| `zugzwang_experiment_tracker_v9.html` | Operator action | External project-knowledge HTML; edit list in plan §3 |
