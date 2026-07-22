# UI.13 — Visitor counter — execute close-out

**PR #264** (DRAFT — founder merges) · branch `feat/ui-13-visitor-counter` · base `main` @ `74b6eab` (merge-base `0587ca2`) · squash SHA TBD at merge.

## What landed (files + PR#)
11 files, +569 / −7, four commits:
- `7517429` plan (`docs/plans/UI-13.md`)
- `3cd0da5` server + SPEC.1 §21.1 rider + `isbot@5.2.1` — `src/server/visitors/counter.ts`, `src/app/api/visits/route.ts`, `tests/server/visitors/{counter,route}.test.ts`, `docs/specs/SPEC.1.md`, `package.json`, `pnpm-lock.yaml`
- `330b307` view — `src/components/shell/VisitorCounter.tsx`, `src/components/shell/GlobalHeader.tsx` (additive), `tests/unit/shell/visitor-counter.test.tsx`
- `e8eb82d` L1 fold — throw-path coverage on `route.test.ts`

Mechanism: one Upstash key `visits:total:${ZUGZWANG_ENV}` (INCR). `POST /api/visits` = isbot → module-local 60/min per-IP cap → INCR; bot/cap/Redis-down all HTTP 200, never 429/5xx. Client leaf refreshes on navigation (no poll), ref-guarded against strict-mode double-count. SPEC.1 §0 **1.0.20 → 1.0.21**.

## Decisions made
- **Key format:** honored the founder-pinned env-**last** `visits:total:${env}` (deliberately unlike `getRedisKey`'s env-first) with inline fail-loud validation; rate-limit prefix stays env-first (disjoint keyspace).
- **Cap constant:** module-local in the route (NOT `config/limits.ts`, NOT a §11 row) — the §21.1 scoped carve-out.
- **P5 fallback = dash** ("— visitors"), per the W2.11 state-kit mockup; loading also dash + `aria-busy` (distinct `data-state`).
- **No rebase:** branch based on `0587ca2`; `origin/main` advanced to `74b6eab` (UI-6 #263 merged mid-run). Disjoint (admin/moderation vs visitors/header) → GitHub renders the clean 11-file three-dot diff, `MERGEABLE`. Rebase deferred to the founder (optional, conflict-free).
- **Screenshot:** faithful static harness (exact token hex) → headless Chrome, since a literal Next screenshot needs a running server + faked auth + live Redis (impractical unattended).
- **Comment orphan fix** in `GlobalHeader.tsx`: one clause updated (the code falsifies the old "visitor is a ratified omission" note) — §5.3 orphan cleanup, disclosed in the plan.

## Surprises caught + handled (wins)
- **Parallel session on the shared working tree.** A concurrent lane committed+pushed the UI-6 masking fix (`d28a95b`) during turn 1, then created an untracked test file, then its PR **merged as #263** (`origin/main` → `74b6eab`) and its branch auto-deleted. Handled: branched off `origin/main` (clean), staged only explicit paths, asserted branch + staged-set before every commit, unique `/tmp/ui13-commit-msg.txt`, monitored HEAD/reflog. **Zero contamination** — my branch carries only my 4 commits; the foreign untracked file was never staged. Collision-detection check passed at every gate.
- **Base drift** surfaced by `@code-reviewer` (two-dot diff polluted; three-dot clean) — reconciled, PR renders clean.

## Open questions
- **Founder's muted-register veto** — the one deferred aesthetic call. Screenshot attached to the PR (`scratchpad/ui13-header.png`); founder rules on the muted grey (`text-muted-foreground`/n5) weight.
- Rebase onto current `main` before flipping to ready? (optional; zero conflicts.)

## Next session starts at
Founder reviews the screenshot + PR #264 → merges (or requests a muted-register tweak). If merged: check whether a tracker sweep owes a UI.13 row (UI.13 had no pre-existing tracker row, cf. the ENGINE.15/16 precedent).

## Context to preserve
Base `0587ca2` (pre-#263); PR #264 draft, MERGEABLE. Screenshot is a static reproduction, not a live capture. `isbot@5.2.1` is the sole new dep. §21.1 rider is verbatim web-authored text — do not redraft. Squash SHA becomes canonical at merge.

## Time
2026-07-23, single unattended session (recon → plan → build → review → draft PR).
