# FOUND.5 — Manifold reference clone

**Status:** done
**Date completed:** 2026-04-29
**Time spent:** ~3 hours (single chat session, late evening Apr 28 →
00:30 Apr 29)
**PR / commit:** PR #13 (squash commit `0f35ce8`, signed)
**Chat link:** FOUND.5 chat (archived in Foundation Claude project)

---

## What was built

A read-only reference fork of `manifoldmarkets/manifold` at
`zugzwang-foundation/manifold-reference`, pinned to tag
`ref-2026-04-28-found5` (commit `d5b55cf`). Plus
`docs/references/manifold.md` — a per-task index that maps Zugzwang
tracker tasks (SCAFFOLD.2, SPEC.5, ENGINE.2, ENGINE.4, ENGINE.7,
ENGINE.8, ENGINE.9, DEBATE.1–3) to specific Manifold source paths,
with watch-outs for places where direct ports would not match
Zugzwang's design.

---

## Decisions taken

- **Fork-and-tag, not in-repo clone or submodule.** A fork on
  `zugzwang-foundation` plus a permanent tag is enough; no need to
  vendor or submodule Manifold's code into the experiment repo.
  Future tasks that need the code locally clone fresh from the
  pinned tag.

- **Lift-with-attribution path chosen over from-scratch.** Path A
  (clean-room reimplementation from Uniswap / Hanson primary
  sources) was discussed and rejected on cost grounds. Path C
  (lift Manifold's CPMM with MIT notice preserved) is the chosen
  approach for ENGINE.2. CPMM is treated as a commodity primitive;
  Zugzwang's originality lives in mandatory commentary, soulbound
  Dharma, debate view, and side-frozen-at-comment-time.

- **No prior-art doc in this PR.** `prior-art.md` (pointers to
  Hanson, Polymarket, Augur, Gnosis CTF) was scoped, drafted in
  outline, and cut. Future tasks discover those via ad-hoc search
  when needed; pre-building the pointer doc is doc-debt for low
  ROI.

- **Reference doc tone is neutral, not comparison-flavoured.**
  Earlier drafts framed "Manifold does X, we do Y" as an attribution
  and contrast exercise. Final draft is pure pointers — what to
  read at which path for which task — with watch-outs for porting
  hazards. No paired comparisons, no attribution-as-virtue framing,
  no commitments about README/whitepaper crediting. Whoever writes
  those docs decides.

- **Surprise architecture finding: Manifold is on
  Postgres-on-Supabase, not Firestore.** Discovered during Batch 3
  of the path-lookup pass. Manifold has migrated; legacy Firestore
  is now limited to image/file storage and the twitch-bot adapter.
  This means the SPEC.5 ADR's framing shifts — the deviation from
  Manifold is event-sourcing on Postgres (not Postgres itself).
  Documented in the manifold.md watch-outs section.

- **CLAUDE.md §10 license-rationale fix deferred to FOUND.6.**
  CLAUDE.md §10 currently says `License: AGPL-3.0 — matches
  Manifold` which is factually wrong (Manifold is MIT, established
  in FOUND.3). The correct rationale is AGPL §13 closing
  closed-source SaaS forks. FOUND.6 (ADR-0001 — License choice) is
  the dedicated task for that fix; not in scope for FOUND.5's PR.

---

## Deviations from plan

- **No formal Phase 1 plan document.** The workflow doc
  (`docs/workflows/plan-then-execute.md`) prescribes writing
  `docs/plans/FOUND.5.md` in a Phase 1 tab and committing it before
  Phase 2 execution. This task collapsed Phase 1 + Phase 2 into a
  single chat. The 0.5d estimate and the non-critical-path
  classification made the full 2-tab ritual feel like overhead;
  decisions and approach were tracked inline in the chat instead.
  Acceptable for a non-critical-path docs task; not acceptable for
  any future critical-path task.

- **Multiple terminal mishaps along the way.** Multi-line paste
  truncation hit the `git tag` step (signed-tag config triggered
  vim, which got cancelled, which broke the push). Recovery was
  fast but the "one command at a time" rule from the macOS
  paste-buffer note in CLAUDE.md context should have been followed
  from the start. Process learning, not a code issue.

- **CI checks count = 0 on PR #13.** GitHub showed "Checks 0" on
  the merged PR. May indicate FOUND.2's CI wiring doesn't trigger
  for docs-only PRs, or a workflow file is missing. Surfaced for
  FOUND.6 / next maintenance audit; not investigated in this task.

- **Tracker description's reference to "pattern-check before each
  relevant phase" not literally executed in this PR.** The
  per-task index *enables* per-phase pattern-checks (future tasks
  open the index, find the right Manifold paths, read them) but no
  pattern-check pass was run during FOUND.5 itself. This is correct
  scope; flagging here so future-you reading this log doesn't wonder
  why.

---

## Open items / follow-ups

### Blocking future technical work

- **CLAUDE.md §10 license rationale is wrong.** "matches Manifold"
  → "§13 forecloses closed-source SaaS forks." Owner: FOUND.6.
- **Smart-contract licensing decision (LGPL-3.0 vs AGPL-3.0).**
  Carried over from FOUND.3. Must resolve before SPEC.5 / ENGINE.1.
  Owner: FOUND.6 or its own ADR.

### Non-blocking

- **CI checks not running on docs-only PRs (CI gap).** Investigate
  during next maintenance audit or a SCAFFOLD.* task that touches
  CI. Track risk: a code-only PR with bad changes might also
  bypass checks if the gap is on filter logic rather than docs
  filtering.
- **prior-art.md not created.** If a future task surfaces the
  need ("which other prediction-market projects exist that we
  should consult?"), revisit. Likely candidates for that trigger:
  ENGINE.1 (CPMM spec, where citing Hanson's LMSR makes sense),
  ENGINE.5 (Dharma ledger, where Augur's REP is the closest
  analogue).
- **Manifold fork refresh.** The pinned tag is from Apr 28 2026.
  If Manifold ships a notable change before SPEC.5 or ENGINE.2,
  add a second tag (`ref-YYYY-MM-DD-<task>`) — never move the
  existing one. Refresh policy is documented in the
  reference doc.
- **AGENTS.md verification command list aspirational.** `pnpm
  vitest run` errors today because vitest isn't installed yet.
  Same for Playwright. Either AGENTS.md should note "applies once
  tests exist" or the commands should ship as commented-out until
  the corresponding dependency lands. Surface for next maintenance
  audit.

---

## Core file updates needed?

Two real items, neither in scope for this PR:

1. **CLAUDE.md §10 license row** — see above. FOUND.6's territory.
2. **AGENTS.md §2 verification commands** — vitest/playwright
   commands fail today because dependencies aren't installed.
   Either annotate as conditional or defer until the deps land at
   SCAFFOLD.* time. Recommend the maintenance audit address it
   when next triggered.

Neither is severe enough to delay FOUND.5's merge. Both are
recorded above in "Open items / follow-ups."

---

## Context to carry forward

The Manifold reference is in place. Future tasks consult
`docs/references/manifold.md` to find which Manifold paths to read.
The reference is pinned at tag `ref-2026-04-28-found5` (commit
`d5b55cf`); this is the immutable snapshot of "what we looked at."
If a future task wants a fresher snapshot, it adds a new tag with
date + reason — never moves this one.

The biggest implementation surprise was that Manifold has migrated
to Postgres-on-Supabase. This means our DB stack choice (Postgres
17 on Supabase per ADR-0006) is reinforced by Manifold's production
deployment, and the SPEC.5 ADR (event-sourcing) should frame its
deviation as the event-sourced schema specifically, not the DB
choice. Reading Manifold's `backend/supabase/seed.sql` and adjacent
files is now directly useful for SCAFFOLD.2 (Postgres + Drizzle
setup) — the manifold.md index has a row for it.

The next foundation task is **FOUND.6** (ADR-0001 — License
choice). FOUND.6 should also fix the stale "matches Manifold"
rationale in CLAUDE.md §10, and should resolve the deferred
smart-contract licensing decision (LGPL-3.0 vs AGPL-3.0) before
SPEC.5 / ENGINE.1 unlock. After FOUND.6, **FOUND.7** (README) and
**FOUND.8** (ADR-0002 — repo split) close out the foundation
phase. **SPEC.1** opens as the first non-foundation task.

The 2-tab plan-then-execute workflow was skipped for FOUND.5 on
non-critical-path grounds. This is the second time it's been
skipped (FOUND.4 also collapsed phases). Pattern to watch: if
FOUND.6, .7, .8 also skip the workflow, the workflow doc may
need either an explicit "non-critical-path tasks may skip" carve-
out or a clearer threshold for when the 2-tab ritual is mandatory.
Surface for the maintenance audit at FOUND-phase boundary.
