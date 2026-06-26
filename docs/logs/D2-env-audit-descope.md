# D2 env-audit descope — session log

**Stratum:** D2 follow-up (Option A descope) · **Branch:** `fix/d2-env-audit-descope` · **State:** PR-ready (awaiting operator merge + checklist) · **Base:** `main` @ `d4a07e2` (#167) · **Date:** 2026-06-26

## What landed (files + PR#)
PR: `fix/d2-env-audit-descope` → `main` (number assigned at open; canonical SHA = the squash-merge SHA on `main`).
- **Descope (commit 1):**
  - `scripts/ci-env-parity.ts` — pure `auditEnvParity` drops the `syncs` input + `unhealthySyncs`/`duplicateSyncs` outputs (and `EnvSync`/`SyncStatus`/the two sync finding types); keeps `orphans` + `missingRequired` (+ the required-excluded-from-orphans dedup). I/O removes `loadDopplerSyncs`/`deriveSyncScope`/`deriveSyncStatus` + the single cross-config `DOPPLER_AUDIT_TOKEN` loop; reads **prd + stg with two config-scoped read-only tokens** (`DOPPLER_AUDIT_TOKEN_PRD` + `DOPPLER_TOKEN_STG`), each paired with its config. 447 → ~280 lines. No secret values logged; fail-closed preserved.
  - `tests/unit/ci-env-parity.test.ts` — dropped the (c)/(d) cases; **9 GREEN** (was 13). RED→GREEN demonstrated (old test vs new contract = 7 failed, then trimmed → green).
  - `.github/workflows/env-audit.yml` — secret swap: drop `DOPPLER_AUDIT_TOKEN`, add `DOPPLER_AUDIT_TOKEN_PRD`, keep `DOPPLER_TOKEN_STG` + `VERCEL_API_TOKEN` + the 3 vars (`VERCEL_PROJECT_ID`, `VERCEL_TEAM_ID`, `DOPPLER_PROJECT`).
  - `docs/plans/D2.md` — OD-1 line patched + **Patch P2** block (same commit).
  - `docs/adr/0024-…md` — in-place **Patch P2** note (sync-health deferred; two config-scoped tokens; superseding the Patch P1 `DOPPLER_AUDIT_TOKEN`).
- **Session log (commit 2):** this file.

## Decisions made
- **Option A** executed as ratified: keep (a) orphans + (b) missing-required; drop (c) sync-not-`In-Sync` + (d) duplicate-sync — undeliverable, since listing Doppler↔Vercel syncs needs an account-level **Service Account** (Doppler Team/Enterprise-only) and the operator has no Team plan.
- **Two config-scoped tokens**, each paired with its config (stg-token→stg, prd-token→prd); `DOPPLER_PROJECT` var **kept** and passed explicitly (minimal, robust — `loadDopplerKeys` signature unchanged). Flagged: the kickoff's "3 **Vercel** ID vars" = the 3 #167 vars including `DOPPLER_PROJECT` (a Doppler var); all 3 kept.
- `@code-reviewer` (MANDATORY): **clean on all 4 priorities** — no value logging, both tokens header-only + uncrossed pairing, fail-closed, no dangling refs. **Zero findings** at any severity.

## Open questions
- None. Sync-health re-enters scope only if the operator adopts a Doppler Team plan (recorded in ADR-0024 Patch P2).

## Next session starts at (exact next action)
- **Operator PR checklist:** (1) create a read-only **prd** config Doppler Service Token → secret `DOPPLER_AUDIT_TOKEN_PRD`; (2) delete the now-unused `DOPPLER_AUDIT_TOKEN` secret; (3) merge; (4) re-run `env-audit` via `workflow_dispatch` → confirm zero findings. Then **D3** (staging branch + branchMatcher repoint + auto-assign-domains) un-inerts `staging-migrate.yml`.

## Context to preserve
- env-audit now needs **two** Doppler secrets (`DOPPLER_TOKEN_STG`, `DOPPLER_AUDIT_TOKEN_PRD`) — both config-scoped read-only; **no** Service Account / Team plan required. Vercel side unchanged.
- `ci.yml` C1/C2 (`drizzle-kit check` + `db:check-drift`) + `staging-migrate.yml` were **untouched** (kickoff DO-NOT). `vercel-env-audit.ts` (operator tool) untouched.
- Gates: `ZUGZWANG_ENV=preview just verify` ✓; full `pnpm vitest run` = **1037 passed** / 2 skip / 5 todo ✓ (1041 − 4 dropped sync tests); `env-audit.yml` YAML parses ✓.
- (Carryover from #167, still open) AGENTS.md §6 migration-head is stale (says `0016`; real head `0018`) — flagged in `claude-progress.md` for the next SYNC sweep, NOT this PR.

## Time
- Single session, 2026-06-26.
