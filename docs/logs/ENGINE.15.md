# ENGINE.15 — PLAN session log

> **Session:** ENGINE.15 plan (S1 sync → S2 recon → S3 rulings → S4 anchor battery → Phase P
> plan commit). Read-only through S4; the only writes are the plan file + this log, each in its
> own docs-only PR. **No code, no rider application** — riders apply at execute, same-commit.
> **Date:** 2026-06-13. **Model:** Claude Fable 5 → Opus 4.8 (1M) mid-session; gated-xhigh.

---

## What landed (files + PRs)

- **`docs/plans/ENGINE.15.md`** — the founder-ratified ENGINE.15 plan v1.0. Phase P docs-only.
  - PR **#120** (`docs/engine-15-plan` → `main`), squash-merged.
  - **Canonical squash SHA on `main`: `d367ef1ff6b4f502567b5876ea84dccddc0d9090`** (branch
    commit `6044d81` was ephemeral).
  - md5 `e71a11152556afad5bcccc12c6c67a86`, 474 lines, 33,932 bytes — **md5-verified IDENTICAL
    at the web gate and again post-merge on `main` (END-ON-MAIN integrity, byte-for-byte through
    the squash).**
  - One-file diff (474 insertions, zero modifications elsewhere); commit signed (SSH ED25519, G),
    author `Zugzwang/world <zugzwangworld@proton.me>`, no co-author trailer.
- **`docs/logs/ENGINE.15.md`** — this log. PR on `chore/engine-15-plan-log` (its own web gate).

**Process note (one line):** the canonical plan body was **operator-relayed** into the CC session
rather than web-pasted directly; integrity was preserved by md5 — `e71a…` verified identical at
the web gate before commit and re-verified on `main` after the squash.

---

## Session narrative (S1–S4 + Phase P)

**S1 — sync gate (PASS).** Main @ `5a58883`, clean tree, local == origin, HEAD descends the
expected base. Dependencies verified against the LIVE repo (not tracker/memory): ENGINE.9
deliverables present (`src/server/resolution/{trigger,settle,correct,void}.ts` + plan/log);
ENGINE.14 deliverables present (`src/server/markets/{create,open,close}.ts`, `closeDueMarkets`
exported at `close.ts:108`, `src/server/admin/actor.ts` + plan/log). PR receipts:
**#114 → `af28566`** (ENGINE.9, MERGED), **#118 → `a29ef7e`** (ENGINE.14, MERGED),
**#119 → `5a58883`** (ENGINE.14 log, MERGED). ENGINE.15 candidate-not-done confirmed (no file,
no history, namespace free). Errata established: ENGINE.9/14 "ENGINE.10" handoff references mean
**this** stratum; the tracker's ENGINE.10 row is the later stress test.

**S2 — recon (PASS).** Greenfield confirmed clean —
`grep -rn "@/server/{markets,resolution,admin}" src/app/` → NONE; nothing to dedupe. Pinned the
surfaces the wiring mirrors: the **A-2 cron precedent** (`r2-orphan-sweep/route.ts` — Bearer +
`timingSafeEqual`, distributed lock, in-body status with HTTP 200 so Vercel's cron alarm only
fires on true crashes; RL/idem exemption documented at :21-24); the **admin auth surface**
(`validateAdminSession` Layer-2 boundary, `proxy.ts` Layer-1 UX redirect, `assertAdminActor`
belt); the **bets wire pattern** (`runBetEndpoint` shared §3.1 stack + `toWireError` envelope
mapping — the convention the admin wire mirrors, minus the bet-only Idempotency-Key/origin
machinery); and the consumed service signatures (clock-as-argument on the lifecycle quartet
per D-14.e; caller-minted `*EventId` params on the resolution quartet).

**S3 — rulings (ratified "best recoms" 2026-06-13).** Founder accepted all six recommendations:
- **R-15.1** minimal functional admin pages only (`/admin/markets` list + `new` + `[marketId]`
  detail with state-appropriate forms); hub dashboard/tabs/visuals → DESIGN/UI lanes; UI.12
  (participant protection) untouched.
- **R-15.2** cron wiring lands complete — `GET /api/cron/close-due-markets` + the second
  `vercel.json` entry (per-minute placeholder; tuning → HARDEN).
- **R-15.3** ONE composed `resolveMarketAction` (trigger → settle, with the stranded-`Resolving`
  resume recovery + partial-failure surfacing); no standalone trigger surface.
- **R-15.4** manual close surface in (recovery lever if cron lags; service already blocks
  pre-deadline closes).
- **R-15.5** wire-error mapping for the wired flows only; full `error-codes.md` catalogue +
  `error_`-prefix sweep stay forward.
- **R-15.6** drift disposal split — riders in this stratum vs re-homed to the post-ENGINE.10
  sweep.

**S4 — anchor battery (PASS, 13/13 reconciled).** Verbatim-anchored every before-text the riders
edit. Loud catches carried into the plan:
- **B-3 — cron rider RETARGET §17.3 → §3.4:279.** The "No other Vercel Cron jobs in v1." sentence
  lives in §3.4 (Pattern A-2), **not** §17.3 (Alarm-6 sub-table). A rider aimed at §17.3 edits the
  wrong section — R-15-C now targets §3.4:279 (+ the §12.6:1168 restatement).
- **B-1 — `*Action`-suffix naming reconciliation.** Services already own the bare names
  (`createMarket`/`closeMarket`/`correctResolution`/`voidMarket`); wire actions take the `Action`
  suffix to avoid export collision (mirroring `adminLoginAction`). Catalogue paths/names truthed
  in R-15-A; `seedPool` ≈ `openMarket` (seed rides `Draft → Open`); standalone `triggerResolution`
  row struck (composed).
- **B-9 — new `tests/server/cron/` route-test convention.** No route-handler test exists anywhere
  in the repo (the r2-orphan-sweep *route* ships untested; only its *service* is covered). The
  cron test mints a new convention rather than copying one — founder-ratified to keep
  (auth-bearing, money-adjacent wire deserves coverage).
- **B-5 — F-RESOLVE-2 "Errors: None" correction.** SPEC.1 §11 F-RESOLVE-2 says "None — append-only
  by construction," but `correctResolution` surfaces `CorrectionOutcomeError`
  (`correction_same_outcome`); R-15-E corrects it.
- **B-6 / B-7 — error-class wire metadata + `ResolutionStateError.observed`.** `markets/errors.ts`
  (all 10) carry NO static wire metadata ("Wire mapping is ENGINE.10's" — this stratum mints it);
  `toActionError` supplies every code except the two `*SerializationExhausted` (which self-
  describe). `ResolutionStateError` exposes readonly `observed`/`expected`/`flow` — D-15.c branches
  the composed-resolve recovery on `err.observed === 'Resolving'` with no pre-read.
- **B-11 — length constants ABSENT → minted.** No `MARKET_TITLE/DESCRIPTION/RESOLUTION_REASON`
  max-char constants exist (only `COMMENT_MAX_LENGTH`); D-15.f mints them in `limits.ts` + a
  SPEC.1 Appendix-B registry row (R-15-G).

**Phase P — plan commit.** Branch `docs/engine-15-plan` off `main`; plan written verbatim +
tail/delimiter-leak-scanned (zero leaks); one-file diff; signed commit; PR #120 opened, web-gated
PASS, squash-merged to `d367ef1`.

---

## Decisions made

- All §Rulings R-15.1..R-15.6 (above) — founder-ratified, binding.
- Plan-level D-15.a..g (subordinate, reviewable at execute S4): thin `"use server"` wrapper
  modules in `src/server/admin/markets/` (never `"use server"` on a service module — SA-M-1);
  shared `src/server/admin/wire.ts` (`requireAdminSession`, `buildAdminMetadata`,
  `canonicalizeAmount18`, `toActionError`); composed-resolve branches on `err.observed`; Server-
  Component pages, zero client JS; form-bound constants minted in `limits.ts`; cron route is the
  A-2 mirror.
- Settled-by-spec rails cited (no rulings needed): no rate-limit / no Idempotency-Key on admin
  flows; all admin mutations are Server Actions behind `Path=/admin`; event ids server-minted only
  (SA-M-1); clock injected at the wire (D-14.e).
- Riders R-15-A..G pinned with grep-verified before-text anchors; **applied at execute,
  same-commit — NOT in this plan PR.**

## Open questions

None blocking. S4 closed B-6 (as-built error codes) and B-7 (`ResolutionStateError.observed`
exposed → no pre-read needed). No items carry into execute.

## Next session starts at (exact next action)

After the web gate on the log PR merges: **open a fresh CC session + fresh web chat** off the
merged plan (`@docs/plans/ENGINE.15.md`) and run the full gated execute ritual **S0–S7**:
S0 sync → S1 RED tests (`@test-writer`, per the charter) → S2 wire implementation to green →
S3 pages + cron → S4 riders (docs same-commit) + self-audit incl. anchor re-grep → S5 reviewers
(`@code-reviewer` → `@security-auditor`, full branch; `@db-migration-reviewer` idle — no
migration) → S6 §5.10 self-audit + the five pre-PR gates + marked-test delta (L-E14.1) → S7 squash
PR (`feat/engine-15-wiring`) + session-log PR (`chore/engine-15-log`) + END-ON-MAIN + PK staging
`~/Desktop/zz-pk-refresh-ENGINE.15/`. `ultrathink`, gated-xhigh, no ultracode (critical path).

## Context to preserve

- **Canonical SHAs:** plan merged at `d367ef1` (#120). Deps: ENGINE.9 `af28566` (#114),
  ENGINE.14 `a29ef7e` (#118) + log `5a58883` (#119).
- **No migration** this stratum — `@db-migration-reviewer` idle at execute; migration head stays
  0015, `EVENT_TYPES` 23.
- **Errata standing:** "ENGINE.10" in ENGINE.9/14 handoff/CF/security registers = **ENGINE.15**.
  Tracker's ENGINE.10 row = the later stress test. Sequence: ENGINE.15 → ENGINE.10 → tracker sweep
  (which mints the missing ENGINE.15 tracker row).
- **Diff budget at execute:** ≈2,000 lines added; ≤200 modified outside NEW files, of which ≤16 in
  `src/server/resolution/` non-test code (the actor-assert belt). Breach → halt, founder gate.
- **Riders are forward work:** R-15-A..D (SPEC.2 → 1.0.5), R-15-E/G (SPEC.1 → 1.0.5), R-15-F
  (AGENTS.md) all land same-commit at execute with the code. The B-3 §17.3→§3.4:279 retarget is
  the highest-risk anchor — do not edit §17.3.
- **Execute carry-forwards consumed:** CF-1 (cron), CF-6/ENGINE.9 actor handoff, SA-I-1, SA-M-1,
  SA-L-1/L-3, CR-3/SA-I-3. **Minted for later:** cron cadence/lock-TTL tuning → HARDEN; hub
  dashboard/visuals → DESIGN/UI; `error-codes.md` + `error_`-prefix sweep → forward; R-15.6 re-
  homed sweep items → post-ENGINE.10 sweep; stale-branch housekeeping → sweep.

## Time

Plan session — 2026-06-13. S1 sync → S2 recon → S3 rulings → S4 anchor battery (13/13) → Phase P
plan commit (PR #120 → `d367ef1`) + this log. Read-only through S4; two docs-only PRs total.

---
---

# ENGINE.15 — EXECUTE session log

> **Session:** ENGINE.15 execute — S0 sync → S1 RED (`@test-writer`) → S2 wire to green → S3 pages
> + cron + `request_id` minting → S4 actor-belt + R-15.6 login + riders (same-commit) → S5
> reviewers (`@code-reviewer` → `@security-auditor`) + security remediation → S6 build-gate +
> fixture audit + pre-PR battery → S7 PRs. Fresh CC session + fresh web chat off the merged plan.
> `ultrathink`, gated-xhigh, **no ultracode** (critical path — the reviewer cascade is the
> sanctioned single-subagent ritual). **Date:** 2026-06-13. **Model:** Claude Opus 4.8 (1M);
> subagents on the documented Opus fallback (the `claude-fable-5` pin was unavailable in this
> environment — CLAUDE.md §6 sanctioned auto-fallback).

---

## (a) Stratum outcome

ENGINE.15 (HTTP / cron / admin wiring) **shipped** via PR **#122**, founder squash-merged to `main`
as **`b8d4ee4`** (3 checks passed, branch auto-deleted). What shipped:

- **Six admin `*Action` wrappers** (`src/server/admin/markets/{create,seed,close,resolve,correct,void}.ts`)
  + the shared **`src/server/admin/wire.ts`** (`requireAdminSession`, `buildAdminMetadata` — the
  7-key §3.7 admin-actor block; `canonicalizeAmount18` — CR-3 exact 18-dp; `toActionError` — the
  §Wire-error map, typed codes only). `resolveMarketAction` is the composed F-ADMIN-3 + F-RESOLVE-1
  surface (trigger → settle, with the stranded-`Resolving` resume — D-15.c).
- **Three admin Server-Component pages** (`src/app/(admin)/admin/markets/{page,new/page,[marketId]/page}.tsx`)
  + **`src/server/admin/page-guards.ts`** (per-page Layer-2 guard + UUID-param validation — the S5
  remediation).
- **`GET /api/cron/close-due-markets`** (the A-2 mirror) + the second `vercel.json` cron entry
  (per-minute placeholder; tuning → HARDEN).
- **The 12-line resolution actor-assert belt** — `assertAdminActor` at the entry of
  `src/server/resolution/{trigger,settle,correct,void}.ts` (CF-6; +3 per file; W-3 `transaction.ts`
  **byte-untouched**).
- **R-15.6 login result-surfacing**; **form-boundary validation** (4 `limits.ts` constants); the
  wire-error mapping.
- **Same-commit riders:** SPEC.1 + SPEC.2 → **1.0.5**; `AGENTS.md` descriptive truth-up.

**No migration** — head stays `0015`, `EVENT_TYPES` 23 (`@db-migration-reviewer` idle). **Diff:**
**+2,827 / −36, 29 files.** Hard sub-limits held: `src/server/resolution/` non-test **12 ≤ 16**;
modified-outside-NEW non-test code **52 ≤ 200**. Top-line **+2,827 vs the ≈2,000 estimate —
founder-ratified** (test volume ≈57% of added lines + the post-plan S5 remediation; not scope
creep — every file traces to the plan or a ratified ruling).

## (b) Plan deviations (web-ratified) — 10 entries

1. **R-15.6 login test is a NEW file** `tests/server/auth/admin-login-result.test.ts` (not an
   extension of `admin-login.test.ts`) — `vi.mock` file-hoist collision with the real
   `adminLoginAction` imported there. [S1]
2–4. **`markets.test.ts` fixture corrections** exposed by the real clock + freeze (masked at S1
   because the stub returned a fixed envelope for all):
   - `WIRE_NOW_DEADLINE` `2027-01-01` → `2026-10-01` (2027 was past the freeze ceiling → happy
     path would reject `deadline_ceiling`).
   - `CLOSE_DEADLINE` `2026-08-01` → `2026-01-01` (future vs the test clock 2026-06-13 → the close
     happy path's "deadline reached" never fired).
   - `CEILING_BREACH` `…23:59:00.001Z` → `2026-11-06T00:00:00.000Z` (`datetimeLocal()`
     minute-truncation lands a sub-minute over-freeze breach back on the allowed inclusive instant).
   [S2]
5. **cron test `CRON_SECRET`** `= undefined` → `delete` (Node coerces `= undefined` to the truthy
   string `"undefined"`, so the route's `if (!secret)` never fired → 401 not 500). [S3]
6. **Freeze-ceiling precision note** added to SPEC.1 §15 F-ADMIN-1 — web-ruled same-commit rider
   addition (the property is CREATED by this stratum's `datetime-local` form boundary). [S4]
7. **§3.4:282 precision fix** — web-ruled same-commit rider addition (the "(b) HTTP-fanout job that
   mutates state outside Postgres" generalization was FALSIFIED by the close-due job, which mutates
   Postgres via the app; rewritten to cover both HTTP-fanout cases). [S4]
8. **§12.6 cross-ref `§3.5 → §3.4`** correction — in-scope R-15-C find. [S4]
9. **SPEC.1 change-log row-order** (`1.0.5` moved below `1.0.4`, restoring ascending order) —
   `@code-reviewer` LOW-1, own doc-fix commit. [S5]
10. **S5 security remediation** — per-page admin auth guard (`requireAdminPage`) + `marketId` UUID
    validation (`requireUuidParam`), web-ruled in-scope fix for the auditor HIGH + MEDIUM. [S5]

## (c) Ratified amendment note

R-15.1's premise — *"admin guarding is already built (proxy.ts Layer 1 + `validateAdminSession`
Layer 2)"* — was **FALSIFIED at S5**. Layer 2 was wired only into the *actions*; the S3 read pages
introduced a read surface Layer 2 never reached. Verified bypass: a forged presence-only cookie
slips past `proxy.ts` (presence-only by design) → the page renders → **leaks Draft markets +
unpublished resolution criteria + pool reserves**. Remediation: a **per-page** `requireAdminPage`
guard doing DB-backed Layer-2 re-validation (NOT a `(admin)` group layout — that would loop the
in-group `/admin/login`). The plan assumption is corrected here, not silently diverged.

## (d) Reviewer outcomes

- **`@code-reviewer`** (full branch) — **0 critical / 0 high / 0 medium / 2 low.** Invariants hold;
  the new `resolution → admin/actor` import is acyclic; the page server-action closures capture
  only serializable values; no scope creep; the three explicit extra checks PASS. LOW-1 (change-log
  order) fixed (deviation 9); LOW-2 (`submitAdminLogin` page-export) = the tracked S6 build gate,
  which then PASSED.
- **`@security-auditor`** (full branch) — **0 critical / 1 HIGH / 1 MEDIUM / 2 low / 1 SURPRISE.**
  HIGH (admin read-page Layer-2 bypass) and MEDIUM (`marketId` → Postgres `22P02` 500) both
  **fixed in-branch** (the S5 remediation). All four explicit extra checks PASS: **SA-M-1** (no
  caller-suppliable event-id on any of the six signatures; resolution ids wire-minted, `create`
  passes none), **cron Bearer** (`constantTimeStringCompare` → `timingSafeEqual`, not `===`),
  **SA-I-1** (every action gates `requireAdminSession` first, zero writes on reject), **SA-L-3**
  (`toActionError` typed codes only; `error_internal`/`admin_actor` Sentry-capture, no `.message`
  passthrough). The 2 LOWs + the SURPRISE are carry-forwards (see (e)).

## (e) Carry-forward register (→ post-ENGINE.10 sweep + HARDEN)

- **`system_state.frozen_at` write-freeze UNENFORCED** in the W-3/W-4 lifecycle/resolution write
  paths (never read before writing) — **pre-existing** (ENGINE.9/14 services), NOT fixable in
  ENGINE.15 (byte-frozen wrappers), **newly reachable by automation via the wired close-due cron**
  (close-only blast radius). A real gap against the §3 conclusion-freeze refusal contract.
  **Founder-prioritized to a dedicated ENGINE.10/HARDEN task.**
- **LOW-1** — spoofable audit `ip`/`request_id` (`wire.ts`; mirrors `login.ts`; candidate SPEC.1
  §16.3 forwarded-header-trust note) → HARDEN.
- **LOW-2** — cron Bearer length-leak via early-return on length mismatch (mirrors `login.ts`) →
  HARDEN.
- **Appendix-A residues** — SPEC.2:2350 `bets/origin-check.ts`, :2359 `…/trigger-resolution.ts`,
  :2457 `ALLOWED_ORIGINS` — pre-existing drift outside the §4 rider scope → post-ENGINE.10
  Appendix sweep.
- **Stale merged plan branches** — `chore/engine-15-plan-log`, `docs/engine-15-plan` (local +
  remote) → sweep, one line.
- **r2-orphan-sweep ROUTE still untested** — the new `tests/server/cron/` convention could backfill
  it → HARDEN/sweep, one line.
- **Cron cadence + lock-TTL numeric tuning + close-lag (R-14.3) measurement** → HARDEN.

## (f) Carry-forwards consumed / discharged

CF-1 (cron wiring), CF-6 + the ENGINE.9 actor-assert handoff (the belt), SA-I-1 (session gate on
every action), SA-M-1 code half (server-mint-only; no caller-supplied id wire-exposed), SA-L-1 +
the `reason` max-lengths, SA-L-3 (typed codes), CR-3/SA-I-3 (18-dp canonicalization), the composed
F-ADMIN-3 endpoint (the ENGINE.9 §3.6 handoff).

## §5.9 standard fields

- **What landed:** PR **#122** → squash **`b8d4ee4`** on `main` (the file set in (a)); this execute
  log via **`chore/engine-15-log`** (its own gate).
- **Decisions made:** the 10 web-ratified deviations (b) + the R-15.1 amendment (c); all reviewer
  dispositions (d).
- **Open questions:** none blocking — the carry-forward register (e) routes everything onward.
- **Next session starts at:** see (g).
- **Context to preserve:** the carry-forward register (e); canonical SHAs — execute `b8d4ee4`
  (#122); plan `d367ef1` (#120) + plan-log `6641eff` (#121); deps ENGINE.9 `af28566` (#114),
  ENGINE.14 `a29ef7e` (#118) + log `5a58883` (#119).
- **Time:** execute session 2026-06-13 — S0 → S7.

## (g) Next stratum

**ENGINE.10** — engine-phase exit (full-invariant stress test; deps E.8/9/12/13) → then the
**post-ENGINE.10 tracker sweep** (mints the missing ENGINE.15 tracker row, carries the
ID-collision errata into the tracker, and processes the carry-forward register above).
