# ENGINE.16 — Plan session log

**Stratum:** ENGINE.16 — Conclusion-Freeze Enforcement (read-guard). Plan session (P0 recon → P2 draft
→ web gate). Docs-only; no `src/`/`drizzle/` writes.

## What landed (files + PR#)

- `docs/plans/ENGINE.16.md` — the ratified plan → **PR #125** (`docs/engine-16-plan`, branch SHA
  `69a6d6f`; canonical SHA = the squash-merge on `main`, pending web gate).
- This log → its own PR (`chore/engine-16-plan-log`).

## Decisions made

- **Three forks ruled "A" (founder, 2026-06-14):** (1) gate scope = **participant-only** (§20.3 keeps
  admin / reads / auth live); (2) mechanism = **DB flag** `system_state.frozen_at IS NOT NULL` (§20.2 —
  no clock operator; D-14.e moot); (3) writer scope = **read-guard only** (pg_cron flip → HARDEN.10).
- **Gated surfaces:** participant bet endpoints via `runBetEndpoint` (→ 410) + the `close-due-markets`
  cron (→ 200 `{status:"frozen"}`). **Ungated:** admin Server Actions, reads, auth, future H2 erasure.
- **Auditor-finding reconciliation:** the ENGINE.15 finding's "gate W-3/W-4 admin paths" was over-scoped
  vs §20.3 (admin ungated by design); the real gap = greenfield `isFrozen()` + the ungated cron.
- **Web gate PASS** with two fixes + a drop, folded into the plan:
  - **FIX-1** — DB-backed freeze tests + the manual smoke reset use **TRUNCATE+reseed**, not `SET
    frozen_at = NULL`. The §6.3 once-only trigger rejects both `timestamp→NULL` and `timestamp→timestamp`
    (`0003:172-173`); triggers are `BEFORE UPDATE`/`BEFORE DELETE` only and **no `BEFORE TRUNCATE`
    trigger exists** (`0003:197-198`), so `TRUNCATE system_state` + re-INSERT `('system', NULL)` resets
    cleanly. Server-layer convention confirmed at `resolution/happy-path.test.ts:189-191`.
  - **FIX-2** — the cron returns **HTTP 200 `{status:"frozen"}`** (the §3.4 A-2 clientless-scheduler
    contract; a 410 would false-alarm Vercel's cron-fail surface), work-skipped. Bet endpoints keep
    410 `error_experiment_concluded` (the §20.2 participant wire envelope).
  - **RIDER-1 DROPPED** — no SPEC.2 rider. §20.2 + §20.3 + §20.4 `:2044-2045` already record the
    contract + the admin/read exemption; a concrete surface-list would go stale. **Pure code-only.**

## Open questions

None blocking. The cron 410-vs-200 surface question raised at plan draft is **resolved** by FIX-2.

## Next session starts at (exact next action)

A **separate, fresh EXECUTE chat** (not this one): RED-first per `docs/plans/ENGINE.16.md` — `@test-writer`
mints the five test files (helper, bet-410, cron-200, resolution-exemption, surface-guard) FAILING
first → implement `src/server/system/is-frozen.ts` + the two wirings (`bets/endpoint.ts` step-1.5 → 410;
`cron/close-due-markets/route.ts` after-auth → 200 `{status:"frozen"}`) → GREEN → `@code-reviewer` →
`@security-auditor`. `@db-migration-reviewer` idle (no migration; head stays `0015`).

## Context to preserve

- **Participant-only scope is the load-bearing ruling** — do NOT gate admin W-3/W-4 (§20.3). Test (e)
  (the surface guard) + test (d) (frozen→admin-resolve-succeeds) protect against over-gating regression.
- **FIX-1 reset = TRUNCATE+reseed** — never `SET frozen_at = NULL` (trigger rejects it).
- **`error_experiment_concluded`** is already in the SPEC.2 §15.4 38-code baseline; `error-codes.md`
  is a forward deliverable, NOT created here.
- Canonical SHAs (backfill post-merge in the plan-close report): plan PR #125; this log PR. Deps:
  ENGINE.15 execute `b8d4ee4` (#122).
- Next stratum after ENGINE.16 execute: **ENGINE.10**.

## Time

Plan session 2026-06-14 — P0 recon → P2 draft → web gate (PASS w/ FIX-1 + FIX-2 + RIDER-1 drop).
