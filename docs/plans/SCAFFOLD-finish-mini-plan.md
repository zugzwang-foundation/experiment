# SCAFFOLD-finish mini-plan

**Date:** 2026-05-26
**Author:** Hrishikesh + web Claude
**Scope:** Close the SCAFFOLD phase. Remaining 7 tasks (SCAFFOLD.11 moved
to UI phase per operator decision 2026-05-26) bundled into 3 execute
chats per Option A.
**Predecessor:** SCAFFOLD.15 (PR #50), SCAFFOLD.16 (PR #52), SCAFFOLD.17
(PR #51) all merged.

---

## Scope decision

**SCAFFOLD.11 (/me page) moved to UI phase.** Rationale: the task is
explicitly a smoke test designed to ship on placeholder styling, with
UI.5 designated as the real styled `/me` page. Doing both is double-work.
Folding it into the UI phase saves ~0.5d and avoids placeholder churn.

**SCAFFOLD-phase exit criterion redefined** (per Option α at planning
chat): Bundles 1–3 merged + v11 tracker sweep complete. No user-visible
smoke test until UI.5. Substrate is verified by per-task acceptance
criteria + GitHub Actions CI gating PRs from Bundle 2 onward.

**Net SCAFFOLD-phase remaining:** 7 tasks, ~5 dev-days, 3 execute chats.

---

## Bundle 1 — Observability stack (SCAFFOLD.5 + .6 + .7)

**Tasks:**

| ID | Title | Est | Pri | Surface |
|---|---|---|---|---|
| SCAFFOLD.5 | Sentry wired (client + server + source maps + release tagging) | 0.5d | P1 | `@sentry/nextjs` SDK init + Vercel env vars + sourcemap upload script + Sentry org/project provisioning |
| SCAFFOLD.6 | PostHog wired (analytics + flags + `useFlag` hook) | 0.5d | P1 | `posthog-js` + `posthog-node` SDK init + `useFlag(name, defaultValue): boolean` hook per AGENTS.md §7 |
| SCAFFOLD.7 | Vercel runtime logs (structured request logging, no body) | 0.5d | P1 | Handler-stack logging step at simplest insertion point; fields per SPEC.1 §16.3; Axiom DROPPED per ADR-0007 amendment |

**Approach:** no brief-drafting, no plan-mode chat. Single CC
execute-chat with inline scope statement citing relevant ADR sections.
Three small vendor SDK wirings against existing config skeletons.

**ADR consumption:**
- ADR-0007 (observability) — substance lives in SPEC.2 §0.1 ADR-0007
  entry; file backfill queued maintenance. SCAFFOLD.5/6/7 wire what
  SPEC.2 §0.1 ratifies.
- AGENTS.md §7 for PostHog `useFlag` discipline (explicit `defaultValue`
  per call site; wrapper is the runtime contract).
- SPEC.1 §16.3 for structured-logging field set (no body, no headers, no
  PII).
- ADR-0007 amendment in SPEC.2 §0.1 for Axiom drop (Vercel runtime logs
  replace).

**PR shape:** single PR with three commits.

**Operator-side prerequisites** (already complete as of 2026-05-26):
- Sentry Vercel Marketplace integration installed; env vars
  auto-provisioned to Production+Preview scope.
- PostHog account on US Cloud; `NEXT_PUBLIC_POSTHOG_KEY` +
  `NEXT_PUBLIC_POSTHOG_HOST` in Doppler→Vercel sync.

**Tests:** smoke tests only. Sentry init succeeds without throwing;
PostHog init succeeds; structured-logger step emits a row with correct
fields on a synthetic request. No business-logic tests.

**Critical-path:** no per CLAUDE.md §1.

**Exit criterion:**
- Errors thrown in dev surface in Sentry within 30s.
- PostHog test event emits and shows in PostHog UI.
- A handled request emits a structured log row in Vercel runtime logs
  with the SPEC.1 §16.3 fields.
- PR merged + Bundle 1 close-out log committed.

**Time estimate:** ~1.5d CC time + ~2h operator review. Single chat.

---

## Bundle 2 — CI + Backups (SCAFFOLD.18 + .19)

**Tasks:**

| ID | Title | Est | Pri | Surface |
|---|---|---|---|---|
| SCAFFOLD.18 | GitHub Actions CI (lint + typecheck + test on PR) | 0.5d | P0 | Single `.github/workflows/ci.yml`: pnpm install → biome check → tsc --noEmit → vitest run |
| SCAFFOLD.19 | Supabase PITR + daily backups | 0.5d | P0 | Supabase dashboard config (PITR 7d default, bump to 30d if affordable); HARDEN.9 covers restore drill |

**Sequencing note:** Bundle 2 should ship BEFORE Bundle 3 so the
SCAFFOLD.8 staging-env PR gets CI gating immediately.

---

## Bundle 3 — Staging + Load harness (SCAFFOLD.8 + .9)

**Tasks:**

| ID | Title | Est | Pri | Surface |
|---|---|---|---|---|
| SCAFFOLD.8 | Staging + preview-per-PR (staging.zugzwangworld.com + scoped env vars) | 1d | P0 | Doppler scope reorg (prod/staging/preview); Vercel env wiring; DNS for `staging.zugzwangworld.com` subdomain |
| SCAFFOLD.9 | k6 load test harness (100/1k/5k concurrent against staging) | 1d | P1 | Net-new `loadtest/` directory; k6 scenarios for participant signup, bet placement, comment posting; parameterized concurrency |

**Approach:** light brief required; plan-mode chat warranted.

---

## Wrap-up — v11 tracker sweep

Mark SCAFFOLD.5/.6/.7/.8/.9/.18/.19 done. Move SCAFFOLD.11 to UI phase
or annotate as "absorbed by UI.5." Update status block + Active focus
prose.

---

## Execution sequence (sequential, not parallel)

| Order | Chat type | Bundle | Est wall-clock |
|---|---|---|---|
| 1 | Execute-chat | Bundle 1 (SCAFFOLD.5+.6+.7 observability) | ~2-3h |
| 2 | Execute-chat | Bundle 2 (SCAFFOLD.18+.19 CI + backups) | ~1-2h |
| 3 | Brief-drafting chat | Bundle 3 brief | ~1.5h |
| 4 | Plan-mode review chat | Bundle 3 plan-mode | ~1h |
| 5 | Execute-chat | Bundle 3 (SCAFFOLD.8+.9 staging + load) | ~3-4h |
| 6 | Tracker sweep chat | v10 → v11 | ~1h |

---

## Things explicitly NOT in this mini-plan

- SCAFFOLD.11 /me page — moved to UI phase, absorbed by UI.5.
- PRECURSOR.4 (fresh-session lock review) — separate stratum.
- PRECURSOR.5 (CLAUDE.md + AGENTS.md sweep) — separate stratum,
  scheduled post-ADR-completion.
- Any ENGINE / DEBATE / VISUAL DESIGN / UI / HARDEN / LAUNCH /
  LIVE / CONCLUDE work — post-SCAFFOLD-phase per phase ordering.
- MAINT.* backlog absorption — deferred per user memory.
- Doppler integration itself — already done in SCAFFOLD.13.
- AVIF support flag — parked at SCAFFOLD.15.

---

## Sign-off

Mini-plan ratified for project knowledge ingestion. Bundles execute in
order.

— Hrishikesh + web Claude, 2026-05-26
