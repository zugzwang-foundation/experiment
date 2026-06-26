# D2 env-audit Sentry-exclusion — session log

**Stratum:** D2 follow-up (env-audit Sentry intentional-manual membership) · **Branch:** `fix/d2-env-audit-sentry-exclusion` · **State:** PR-ready (awaiting operator merge + checklist) · **Base:** `main` @ `9bbf785` (#168) · **Date:** 2026-06-26

## What landed (files + PR#)
PR: `fix/d2-env-audit-sentry-exclusion` → `main` (number assigned at open; canonical SHA = the squash-merge SHA on `main`).
- **Fix (commit `5ba5f09`):**
  - `scripts/ci-env-parity.ts` — add 3 exact keys to `INTENTIONAL_MANUAL` (`SENTRY_VERCEL_LOG_DRAIN_URL`, `SENTRY_OTLP_TRACES_URL`, `SENTRY_PUBLIC_KEY`); comment notes the Sentry↔Vercel-integration origin + the extend-both-lists rule. Orphan-only; `missingRequired` untouched.
  - `scripts/vercel-env-audit.ts` (operator tool, canonical inventory) — same 3 keys, **byte-identical** Set block; 2026-06-26 comment amendment (inventory count 5→8).
  - `tests/unit/ci-env-parity.test.ts` — mirror set extended + new RED-first regression case (3 integration keys in Production+Preview, no Doppler source → NOT flagged). **10 GREEN** (was 9). The `ORPHAN_KEY` / `STAGING_ONLY_KEY` non-excluded cases kept (proves not-too-broad).
- **Session log (commit 2):** this file.

## Decisions made
- The 3 keys are legitimate Sentry↔Vercel marketplace-integration-provisioned, Vercel-direct, **no Doppler source by design** — operator-confirmed (integration connected, `.env.local` Quickstart lists all three). This is **NEW membership, not a restore**.
- **Exact-name** membership (never a `SENTRY_*` prefix) per the security-auditor L5 design at `vercel-env-audit.ts`; the exclusion applies to **orphan detection only** — a required key stays required.
- **No ADR change** (restores #167's intended audit behavior; not a decision change). `docs/plans/D2.md` §3-Change-3 note ("minus the Sentry intentional-manual allow-list") carries **no enumeration/count**, so it stays accurate → no doc edit.
- `@code-reviewer` (MANDATORY, `model: opus`): **clean** — no CRITICAL/HIGH/MEDIUM; all 5 focus points PASS (exact-membership not broad, orphan-only, no value logging, fail-closed, semantics intact). 1 LOW cosmetic (literal "8 entries" count in `vercel-env-audit.ts` — kept; matches the file's prior `5 entries` style).

## Surprises caught + fixed in-session
- **Kickoff premise was FALSE** ("#168 dropped the exclusion"). Re-read of `main` @ `9bbf785` **before any edit** found the exclusion mechanism fully intact (`intentionalManual.has` at the orphan loop + two passing tests; the descope removed only `unhealthySyncs`/`duplicateSyncs`). Surfaced + STOPPED; root-cause correction accepted by operator.
- **The 6 failing keys DIVERGED from the allow-list** (3 distinct names, zero overlap with the 5-key set; absent everywhere in the repo). Tripped the kickoff's explicit STOP-on-divergence — surfaced as an operator membership decision (Path 1, evidence-confirmed) rather than inventing membership / broadening.

## Open questions
- None. Any future Sentry-integration-provisioned key must be added to **all three** lists together (the inline comments now say so).

## Next session starts at (exact next action)
- **Operator PR checklist:** (1) merge; (2) re-run `env-audit` via `workflow_dispatch` → expect **ZERO findings** (the 6 Sentry findings cleared; any genuine future orphan still flagged). Then **D3** (un-inert `staging-migrate.yml`).

## Context to preserve
- `INTENTIONAL_MANUAL` is now **8 keys**, byte-identical across `scripts/ci-env-parity.ts` + `scripts/vercel-env-audit.ts` + `tests/unit/ci-env-parity.test.ts`. Extend all three together, exact names only.
- **Untouched** (kickoff DO-NOT): `env-audit.yml` / `ci.yml` C1-C2 / `staging-migrate.yml` / sync code / `missingRequired` logic / prod / GHA secrets / ADR-0024.
- Gates: full `pnpm vitest run` = **1038 passed** / 2 skip / 5 todo ✓; `ZUGZWANG_ENV=preview just verify` clean ✓; exactly 3 files changed.
- (Carryover from #167/#168, still open) AGENTS.md §6 migration-head is stale (says `0016`; real head `0018`) — flagged in `claude-progress.md` for the next SYNC sweep, NOT this PR.

## Time
- Single session, 2026-06-26.
