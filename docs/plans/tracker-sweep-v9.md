# Tracker sweep v8 → v9

| Field | Value |
|---|---|
| **Status** | Approved 2026-05-16 (executing) |
| **Date** | 2026-05-16 |
| **Author** | Hrishikesh (with Claude Code, Opus 4.7 1M) |
| **Critical-path?** | No — tracker is operator-maintained external HTML; no `src/` touches; CLAUDE.md §1 critical paths untouched |
| **Reviewer-call invocation** | Skipped per kickoff — non-critical-path, no `src/server/` or `src/db/schema/` touches |
| **Pre-PR self-audit (§5.10)** | Applies — kickoff explicit; walk plan against actual edits before `gh pr create` |
| **Plan PR / commit** | TBD (this branch) |

---

## 1. Context

The Zugzwang experiment uses an operator-maintained HTML tracker (`zugzwang_experiment_tracker_vN.html`) that lives in Hrishikesh's web-Claude project knowledge, NOT in this repo. The most recent in-repo reference (`docs/maintenance.md`) is to **v7**; the operator-maintained external version has since bumped to **v8**. This sweep absorbs SCAFFOLD.3's closure (merged at `62cd299` on 2026-05-16, PR #38) plus a batch of MAINT-row carry-forwards into a new external **v9** state, and lands the in-repo plan + log + drift-correction in the same PR.

This is a doc-only / operational-state sweep. No invariants touched, no schema, no migrations, no `src/`. Refusal triggers (CLAUDE.md §3) and the four invariants (§2) are not in scope.

**Predecessor**: SCAFFOLD.3 closed at `62cd299`.
**Unblocks**: SCAFFOLD.13 promotion (Supabase free-tier 7d auto-pause urgency); future critical-path strata get correct upstream MAINT context.

## 2. Deliverables

### 2.1 External (operator applies to project-knowledge HTML)
- `zugzwang_experiment_tracker_v9.html` — the v8 → v9 edit set in §3 below.

### 2.2 In-repo (this branch's commits)
1. `docs/plans/tracker-sweep-v9.md` — this plan.
2. `docs/logs/tracker-sweep-v9.md` — close-out log written before PR opens, six-section format per AGENTS.md / CLAUDE.md §5.9.
3. `docs/maintenance.md` — bump `zugzwang_experiment_tracker_v7.html` reference → `zugzwang_experiment_tracker_v9.html` (drift absorption per CLAUDE.md §7).

That's it. No `src/`, no schema, no migrations, no ADR (no architectural change).

## 3. The v8 → v9 edit set

### 3.1 SCAFFOLD.3 row → closed

- Status field: **Closed**
- Closed-on: **2026-05-16**
- Merge commit: **`62cd299`** (post-rebase-merge SHA on `main`)
- PR: **#38**
- Title slug (if tracker carries it): keep existing — feat(scaffold-3): auth wiring — 6 flows + session-deferral hook + admin two-layer middleware + dev-seed

### 3.2 MAINT rows — 10 carry-forward + 3 new (2 merge-time + 1 audit-time)

The SCAFFOLD.3 close-out log (`docs/logs/SCAFFOLD.3.md`) carries MAINT-1 through MAINT-10. Verbatim titles + one-line summaries:

| # | Title | One-line |
|---|---|---|
| MAINT-1 | SCAFFOLD.2 schema doc: `sessions.expiresAt` nullable misread | Corrected to NOT NULL; doc was wrong, code was right |
| MAINT-2 | AGENTS.md test-path convention contradicts SPEC.1 / SPEC.2 | SPEC wins; AGENTS.md patch deferred to its own task |
| MAINT-3 | Q6 two-tx semantics confirmed | Stale-30d sweep is locked recovery, not OTP-flow path |
| MAINT-4 | SPEC.2 §8.4 amendment landed within-PR not within-commit | Procedural slip; future amendments land in same commit as code |
| MAINT-5 | `proxy.ts` only protects `/admin/*` this iteration | Participant-route gating pending |
| MAINT-6 | Session-gate ships inline via `databaseHooks` | Not as Better Auth plugin; decision logged |
| MAINT-7 | `_probe-*` naming convention for library-contract regression-guard tests | Convention codified |
| MAINT-8 | LOW-1 admin cookie UUID validation deferred to HARDEN.* | Non-blocking |
| MAINT-9 | LOW-2 sign-in form content-type deferred to DESIGN.* | Non-blocking |
| MAINT-10 | `DATABASE_URL` absent in Vercel until SCAFFOLD.3 build | Interim Supabase Session pooler wired; SCAFFOLD.13 to swap |

Two NEW MAINT rows from the merge dance (not in the close-out log because they surfaced AFTER the log was written, during the rebase-merge to `main`):

| # | Title | One-line |
|---|---|---|
| MAINT-11 | SHA-rewrite-on-rebase-merge | Rebase-merge rewrites commit SHAs; close-out logs that quote a pre-merge SHA become stale at merge time. Process fix: capture merge-commit SHA POST-merge (or reference PR# only). |
| MAINT-12 | Protected-main friction | Protected-main rules (required CI green, no force-push, no merge commits) add ~5min friction even for doc-only PRs. Capture as known operational cost; consider admin-merge bypass for trivial chores or accept as policy. |

One NEW MAINT row minted in-session from this PR's pre-PR self-audit (CLAUDE.md §5.10 working as designed — see log §"Surprises caught + fixed in-session"):

| # | Title | One-line |
|---|---|---|
| MAINT-13 | Version-bump-on-amendment discipline for versioned specs | Content amendments to versioned specs (SPEC.1, SPEC.2, ADRs) must bump the draft version + add a changelog row in the same commit. SCAFFOLD.3 §8.4 amendment (commit `66cec11`) landed without a version bump, leaving v0.3.1-draft as the current header despite a content change. Distinct from MAINT-4 (same-commit discipline) — this is content-change → version-bump discipline. |

**External-tracker row spec (operator-canonical structured format, paste-ready):**

```yaml
id: "MAINT.13"
phase: 11
pri: "P1"
deps: []
est: "absorbed by PRECURSOR.4 or focused PR"
title: "Version-bump-on-amendment discipline for versioned specs"
desc: "Content amendments to versioned specs (SPEC.1, SPEC.2, ADRs) must
      bump the draft version + add a changelog row in the same commit.
      SCAFFOLD.3 §8.4 amendment (commit 66cec11) landed without a version
      bump, leaving v0.3.1-draft as the current header despite a content
      change. Resolution path: either (a) PRECURSOR.4 absorbs the §8.4
      amendment as part of v1.0 promotion, or (b) a focused MAINT-13 PR
      mints v0.3.2-draft + changelog row before PRECURSOR.4 opens.
      Discipline rule going forward: writer-step plan reviews verify
      version-bump-on-amendment as a self-audit item. Distinct from MAINT-4
      (same-commit discipline) — this is content-change → version-bump
      discipline."
```

### 3.3 Dep edge: SCAFFOLD.13 → any DB-touching stratum

Add explicit dependency arrow on the tracker: **SCAFFOLD.13 (infra / DB URL provisioning + Doppler) blocks any stratum that touches `src/db/schema/`, `src/server/<domain>/`, or `drizzle/migrations/`** beyond the current interim Supabase free-tier wiring.

Rationale per SCAFFOLD.3 log (`docs/logs/SCAFFOLD.3.md:216–224`): the interim free-tier `DATABASE_URL` is unstable (7d auto-pause, no SLA, single-region only); any stratum that would run schema work against staging or production needs SCAFFOLD.13's Doppler-wired permanent URLs first.

Affected downstream strata (per repo-wide stratum enumeration): SCAFFOLD.5, SCAFFOLD.6, SCAFFOLD.15, SCAFFOLD.16, SCAFFOLD.17, SCAFFOLD.18, SCAFFOLD.19, ENGINE.* (most), HARDEN.* (most). The dep edge should target the stratum-level dependency graph, not each row individually.

### 3.4 SCAFFOLD.13 promotion: unscheduled → active queue

- Move SCAFFOLD.13 row from "Unscheduled" / "Backlog" section into the **active queue** alongside ENGINE.6 (the SCAFFOLD.3 close-out "Next session starts at" item) and any other currently-active strata.
- Add an **urgency note** on the row: *"Supabase free-tier auto-pauses after 7d idle; interim `DATABASE_URL` (wired SCAFFOLD.3) needs Doppler swap before pause. Daily `pg_dump` cron (see §3.7) is the bridge."*
- Per SPEC.2 §22.2 ("design-independent parallel-execution clearance"), SCAFFOLD.13 can run in parallel with ENGINE.6 — they touch disjoint surfaces.

### 3.5 Row-description patches

Two stale row descriptions:

| Row | Current (v8) — drift | Patch to (v9) |
|---|---|---|
| PRECURSOR.4 | "…against SPEC.2 v1.0-draft…" (or similar 1.0-draft reference; impossible — SPEC.2 §0 reconciliation rules out a v1.0-draft intermediate per the 3-F close note in `docs/specs/SPEC.2.md:42`) | "…against SPEC.2 v0.3.1-draft…" — matches the current SPEC.2 header (last bumped at SCAFFOLD.4 close, 2026-05-15). Kickoff originally said "v0.3.2-draft"; clarified at audit-time as anachronism (no v0.3.2-draft step in SPEC.2's changelog). |
| PRECURSOR.5 | "…tracker v7 structure…" | "…tracker v8 structure…" — PRECURSOR.5's drift sweep was the last edit before tracker minted to v8; row description should anchor to the resulting state, not the input version |

### 3.6 Infrastructure subscription strategy — tracker-level note

Add a top-level or §-level note to the tracker capturing the agreed subscription ramp:

> **Infrastructure subscription strategy** (locked at SCAFFOLD.3 close):
> - **Supabase Pro ($25/mo)** activates at SCAFFOLD.13 cutover (~2026-05–06 window). Swaps free-tier interim wiring for permanent Doppler-managed staging + production URLs. Eliminates 7d auto-pause risk; enables 7-day PITR baseline (14d upgrade pre-authorized per SPEC.2 / ADR-0005).
> - **Vercel Pro ($20/mo)** activates mid-August 2026 pre-launch. Required for production-tier function timeouts, observability retention, and team-seat allocations.
> - **Total monthly cost at 2026-09-15 launch**: ~$45/mo (Supabase $25 + Vercel $20). Within the SPEC.2 §X $300/mo default ceiling + $500/mo pre-authorized upgrade tier.

### 3.7 Pre-SCAFFOLD.13 daily `pg_dump` backup cron — MAINT-adjacent note

Per kickoff: "MAINT-adjacent" — render this as a **running ops note on SCAFFOLD.13's row** (not a numbered MAINT-13 row), co-located with the §3.4 urgency note.

> **Pre-SCAFFOLD.13 ops bridge**: Daily `pg_dump` cron against the interim Supabase free-tier `DATABASE_URL` → encrypted off-site backup (e.g., R2 bucket, age-encrypted). Mitigates two risks: (a) 7d auto-pause data loss; (b) free-tier no-SLA outages. Retire when SCAFFOLD.13 swaps to Supabase Pro with native PITR.

## 4. In-repo edits — details

### 4.1 `docs/plans/tracker-sweep-v9.md`

This file.

### 4.2 `docs/logs/tracker-sweep-v9.md`

Six sections per CLAUDE.md §5.9, written BEFORE `gh pr create`:

1. **What landed** — files changed (this plan + log + maintenance.md), PR# (TBD), commit count.
2. **Decisions made** — MAINT-11 / MAINT-12 wording finalized per Q1 resolution; subscription strategy locked; SCAFFOLD.13 placed parallel to ENGINE.6.
3. **Open questions** — any residual from plan-review.
4. **Next session starts at** — most likely SCAFFOLD.13 kickoff (Supabase Pro provisioning + Doppler wiring), or ENGINE.6 (events helper) if SCAFFOLD.13 awaits Hrishikesh's billing trigger.
5. **Context to preserve** — tracker v9 minted; v7→v9 in-repo reference bumped; future plans should reference v9 not v7.
6. **Time** — optional.

### 4.3 `docs/maintenance.md`

Single-line edit (applied to both the `What's in scope` table at line 20 and the `File-by-file audit cadence` table at line 131):

```diff
- `zugzwang_experiment_tracker_v7.html` | Task completion (continuous); occasional reorgs
+ `zugzwang_experiment_tracker_v9.html` | Task completion (continuous); occasional reorgs
```

Per CLAUDE.md §7 cleanup absorption rule — drift fix <2h, absorbed in the stratum that surfaces it (this sweep).

## 5. Branch + PR mechanics

- **Branch**: `chore/tracker-v9` from `main` at `62cd299`.
- **Commit convention**: `chore(tracker): v8 → v9 sweep — SCAFFOLD.3 close + 13 MAINT rows + SCAFFOLD.13 promotion` (single commit covering plan + log + maintenance.md drift fix; MAINT-13 minted in-session per pre-PR audit SURPRISE).
- **PR title**: same as commit; `--fill` from gh.
- **PR body**: summary + test plan checklist (trivial: `just verify` + walk-plan audit).
- **Merge method**: rebase-merge to `main` (matches SCAFFOLD.3, per protected-main + no-merge-commits policy). Capture POST-merge SHA in any future reference (MAINT-11 lesson applied).

## 6. Verification

### 6.1 `just verify`
Lint + typecheck + tests. No `src/` changes → expected trivially green. Run before PR opens.

### 6.2 Pre-PR self-audit (§5.10, applied even though non-critical-path per kickoff)

Walk this plan section-by-section against actual edits before `gh pr create`:

| Plan item | Where it lands | Verify |
|---|---|---|
| §3.1 SCAFFOLD.3 closed | External tracker v9 | Operator reports applied |
| §3.2 MAINT-1..10 | External tracker v9 | Operator reports applied; titles match SCAFFOLD.3 log verbatim |
| §3.2 MAINT-11, MAINT-12 | External tracker v9 | Wording matches Q1 resolution |
| §3.2 MAINT-13 | External tracker v9 | Paste-ready row spec captured in plan §3.2; operator applies verbatim (minted in-session from §5.10 audit SURPRISE) |
| §3.3 dep edge | External tracker v9 (dep graph) | Operator reports applied |
| §3.4 SCAFFOLD.13 promotion | External tracker v9 (queue + urgency note) | Operator reports applied |
| §3.5 row-desc patches | External tracker v9 | Both patches applied verbatim |
| §3.6 subscription strategy | External tracker v9 (top-level note) | Operator reports applied |
| §3.7 pg_dump cron note | External tracker v9 (SCAFFOLD.13 row, running-ops sub-note) | Operator reports applied |
| §4.1 plan file | In-repo | `git ls-files docs/plans/tracker-sweep-v9.md` |
| §4.2 log file | In-repo | `git ls-files docs/logs/tracker-sweep-v9.md` |
| §4.3 maintenance.md | In-repo | `git diff main -- docs/maintenance.md` shows v7→v9 (both rows) |

PASS / FAIL / SURPRISE per row. PR opens only on all-PASS.

### 6.3 No reviewer-call invocation
Per §5.11: skip for non-critical-path doc work. (Kickoff confirms.)

## 7. Out of scope

- SCAFFOLD.13 plan + code (this sweep promotes the row; SCAFFOLD.13 itself is a separate task).
- AGENTS.md test-path convention amendment (MAINT-2 — its own task; cosmetic).
- Any `src/`, schema, migration, or ADR work.
- Any retroactive edits to docs/logs/SCAFFOLD.3.md (close-out logs are append-only; MAINT-11 / MAINT-12 mint in the v9 tracker, not retroactively in the SCAFFOLD.3 log).

## 8. Plan-review resolutions (locked 2026-05-16)

| Q | Topic | Resolution |
|---|---|---|
| Q1 | MAINT-11 / MAINT-12 wording | **Drafted observations** stand as written in §3.2 — MAINT-11 frames the SHA-staleness mechanism + process fix; MAINT-12 frames the protected-main friction + acceptance/admin-merge alternative. |
| Q2 | Pre-SCAFFOLD.13 `pg_dump` cron placement | **Running-ops sub-note on SCAFFOLD.13's row**, co-located with §3.4 urgency text. Not a numbered MAINT-13. |
| Q3 | `docs/maintenance.md` v7 → v9 bump | **In-PR drift fix** per CLAUDE.md §7 cleanup absorption rule. |
| Q4 | Task ID | **`tracker-sweep-v9`** confirmed (matches kickoff verbatim; one-off non-stratum chore). |
| Q5 | SCAFFOLD.13 queue placement | **Parallel to ENGINE.6** per SPEC.2 §22.2 design-independence. Disjoint surfaces. |
| Q6 | PRECURSOR.5 row-desc anchor | **"v8 tracker structure"** — anchors to the post-mint resulting state PRECURSOR.5 produced (not v6 input, not v9 current). |
| Q7 | Tracker HTML committed to repo? | **External-only**, in-repo unchanged. PR carries plan + log + 1-line `maintenance.md` drift fix only. |

No residual open items at execute-start.

---

*Plan approved 2026-05-16. Promoted from `~/.claude/plans/vtracker-sweep-v8-delightful-marshmallow.md` scratch to `docs/plans/tracker-sweep-v9.md` on execute. Maintained per `docs/maintenance.md`.*
