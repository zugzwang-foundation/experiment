# ENGINE.16 — Execute session log

**Stratum:** ENGINE.16 — Conclusion-Freeze Enforcement (read-guard). Execute session (S0 recon → S6
smoke → S7 PRs), gated stratum-by-stratum by the web Claude chat. **Pure code-only deliverable** — no
SPEC edit, no ADR, no migration.

## Objective + outcome

Build the SPEC.2 §20 conclusion-freeze gate as a **read-guard only**: the `isFrozen()` helper plus its
wiring onto the two state-mutating surfaces that exist today. **Shipped** — `isFrozen()` + the bet-endpoint
410 gate + the close-due cron 200 `{status:"frozen"}` gate, with admin paths left ungated (§20.3). The
`frozen_at` flip writer (pg_cron) stays HARDEN.10.

## What landed (files + PR#)

8 files / 704 insertions → **PR #127** (`feat/engine-16-freeze-gate`). RED checkpoint `486bdb5`
(tests-first) → impl `8039667`.

- **`src/server/system/is-frozen.ts`** (new, 20 LOC) — `isFrozen()`: a plain, non-locking
  `db.query.systemState.findFirst` on the `'system'` singleton (`frozen_at IS NOT NULL`), run outside
  any `db.transaction`.
- **`src/server/bets/endpoint.ts`** (+10) — step-1.5 gate after the onboarding-403 block, before the
  Idempotency-Key validate → **410 `error_experiment_concluded`** (file's own `jsonResponse(requestId,
  status, body)` / `envelope(code, message)`). Covers `/place` + `/sell` (shared prefix).
- **`src/app/api/cron/close-due-markets/route.ts`** (+9) — gate after the Bearer/`CRON_SECRET` auth,
  before lock acquisition → **200 `{status:"frozen"}`** (file's own `jsonResponse(body, init)`; the §3.4
  A-2 contract).
- **5 test files** — `system/is-frozen.test.ts` (helper, DB), `system/is-frozen-surface.test.ts`
  (source-grep §20.3 guard), `bets/freeze.test.ts` (410, mocked wire), `cron/close-due-markets.test.ts`
  (extended: 200 `{frozen}`), `resolution/freeze-exemption.test.ts` (admin exemption, DB).
- This log → its own PR (`chore/engine-16-log`).

## S0–S6 trace

- **S0 — recon (read-only):** clean. Greenfield confirmed (no `src/server/system/`, no `isFrozen`, no
  `error_experiment_concluded` in `src`/`tests`); migration head `0015`; `EVENT_TYPES` = 23. Critical
  dependency verified: the `system_state` Bucket-B triggers are `BEFORE UPDATE` + `BEFORE DELETE` only —
  **no `BEFORE TRUNCATE`** anywhere — so FIX-1's TRUNCATE+reseed reset holds; row seeded `('system',
  NULL)`. Both insertion anchors + both response-helper signatures confirmed on disk.
- **S1 — RED-first (`@test-writer`):** 5 files, 8 honest REDs — failing on **assertion or runtime-throw,
  never on collection** (the greenfield helper reached only via `vi.mock` factory / dynamic `import()` /
  `readFileSync`, so every file collected). 23 GREEN (controls + exemption + absent-from-ungated + the 7
  preserved ENGINE.15 cron scenarios). Committed `486bdb5`.
- **S2 — implement to GREEN:** the helper + 2 wirings, **39 LOC** across exactly 3 src files → 31/31
  green. Committed `8039667`. (Budget gate tripped at first attempt; resolved by R1 — see below.)
- **S3 — cross-suite floor:** invariants **20/20**, integration **103/103**, full suite **873 passed / 0
  fail** (113 files; 2 skipped + 5 todo, all pre-existing in untouched files). `EVENT_TYPES` inventory pin
  green at 23; `validation.test.ts` green (now runs the inert real `isFrozen()` at step 1.5, no
  regression).
- **S4 — §5.10 self-audit:** 13/13 CONFORMS, zero DEVIATES — helper verbatim, gate placement, response-
  shape conformance, and the full negative space (no migration / schema / event-type / spec / admin-gating
  / lock-order inclusion).
- **S5 — reviewer cascade:** `@code-reviewer` PASS (no findings at any severity). `@security-auditor`
  PASS on all three required rulings — **(i)** no §20.3 over-gating, **(ii)** no lock-order inclusion,
  **(iii)** fail-**closed** verified: an `isFrozen()` throw escapes to a framework 500 above every write-
  enabling step (bet path: before idempotency/rate-limit/tx; cron: before lock/sweep), with no fail-open
  swallow. `@db-migration-reviewer` idle (no migration).
- **S6 — gates + `just verify` + manual smoke:** five critical-path ritual gates green; `ZUGZWANG_ENV=
  preview just verify` green (tsc → biome 253 files → next build). Manual freeze smoke on a **real
  committed flag** against the local throwaway DB, via the established real-handler-against-local-DB vitest
  harness (real `isFrozen` + real `@/db` + real flipped flag + real write spine; only external boundaries
  — Better Auth session, Upstash, OpenAI, Sentry — stubbed): flip → 1 row; place → **410 + zero new rows**;
  sell → 410; cron → **200 `{frozen}` + 0 lock/sweep calls**; admin resolve/correct/void **succeed**;
  reset (TRUNCATE+reseed); post-reset place → **200, real bet lands** (+1 bet/comment/position, +1 dharma
  debit, +2 events). Harness deleted; tree + DB clean.

## Decisions & deviations

- **R1 — helper docstring trimmed to land within the diff budget.** First S2 attempt was 43 insertions
  (> the 40 breach line); the overage was entirely the plan's *verbatim* Mechanism snippets, whose
  doc-comments summed to more than the plan's own File-plan table estimated (~33). Founder-approved fix:
  trim the `is-frozen.ts` docstring 10→4 lines (24→20 LOC, total 43→39). The **query body is the plan
  verbatim**. The trim also resolved the non-locking source-grep false-positive (below). Comment-only;
  no logic change.
- **Accepted missing-row fail-OPEN *read*.** `isFrozen()` returns `false` if the `'system'` row is ever
  absent (`row?.frozenAt != null` on `undefined`). Consciously accepted, **not a defect**: the row is
  seeded at SCAFFOLD.2, DELETE-protected (`0003:198`) and id/created_at-immutable (`0003:176-178`),
  removable only by `TRUNCATE`/DDL — out of the participant/admin threat model. Matches the byte-for-byte
  ratified helper. (Distinct from the *throw* path, which is fail-closed — S5 (iii).)
- **S1 deviations (faithful-to-intent, not improvised):** (a) the freeze tests drive `placePOST`/`sellPOST`
  (mirrors `validation.test.ts`, the named reference) rather than `runBetEndpoint` raw; (b) the no-DB wire
  file adds `@/db` + `@/server/bets/transaction` mocks beyond `validation.test.ts`'s set (it is the
  charter's no-DB file); (c) the cron (b) RED reads `'error'` not `'ok'` (the un-gated route reached the
  sweep, whose reset mock returns `undefined` → the route's catch maps to `{status:"error"}`; the
  assertion still fails on `frozen`).
- **S6 step-4-by-reference.** The admin resolve/correct/void exemption is proven by the DB-backed
  `freeze-exemption.test.ts` (real settle/correct/void under a committed `frozen_at`), not an inline smoke
  step. Justified: admin paths never read the flag — the exemption is **structural and flag-state
  independent**, so the DB-backed test is the faithful, deterministic proof.

## Surprises caught + fixed in-session (§5.10)

One chain, both prongs sharing a root cause (the `is-frozen.ts` docstring), surfaced at the S2 budget gate
and resolved by R1 under founder ruling — neither papered over:

1. **Diff-budget breach (43 > 40).** Surfaced, held the commit, flagged to the founder gate rather than
   self-trimming or pushing past. Root cause: the plan's File-plan table undercounted its own verbatim
   Mechanism snippets.
2. **Non-locking source-grep false-positive.** The S1 `query-is-non-locking` test greps the helper source
   for `/\.for\s*\(/`; the plan's verbatim docstring literally contained "never `.for(...)`", so the
   comment tripped its own grep (the query is genuinely non-locking). Resolved jointly with #1 by the R1
   docstring reword ("no row-lock builder"), which dropped the `.for(` token → 31/31 green.

## Pinned-by-spec recap

**NO migration** (head stays `0015`) · **NO new event type** (`EVENT_TYPES` stays 23) · **NO new ADR**
(implements §20.2/§20.3/§20.4 as-written) · **NO SPEC edit** (RIDER-1 dropped at the plan gate).
`error_experiment_concluded` is the spec'd SPEC.2 §15.4 baseline 410 code, used as a literal string;
`docs/specs/error-codes.md` is a forward deliverable and was **not** created.

## Open questions

None blocking.

## Next session starts at (exact next action)

**ENGINE.10** — the engine-phase exit (full-invariant stress test) — in a fresh chat + web chat. After
the code PR #127 + this log PR squash-merge, backfill canonical SHAs in the close report.

## Context to preserve

- **SHAs/PRs:** RED `486bdb5`, impl `8039667`, code **PR #127**, log PR (`chore/engine-16-log`). Canonical
  SHAs = the squash-merges on `main` (backfill post-merge). Deps: plan PR #125 (`docs/plans/ENGINE.16.md`),
  plan-log #126, ENGINE.15 execute `b8d4ee4` (#122).
- **Participant-only scope is load-bearing** — admin W-3/W-4 stay ungated (§20.3). The surface guard (e) +
  the exemption guard (d) protect against over-gating regression.
- **FIX-1 reset = TRUNCATE+reseed**, never `SET frozen_at = NULL` (the once-only trigger rejects it).
- **Standing tracker errata** (mint at the post-ENGINE.10 sweep, per the operator-maintained external
  tracker): no ENGINE.16 row yet, the ENGINE.15 row is also still missing, and the ID-order note
  (ENGINE.16 executed before ENGINE.10).

## Carry-forwards (→ HARDEN)

- **`frozen_at` flip writer** (pg_cron `…_freeze_cron.sql` / manual `psql`) → **HARDEN.10** (§20.4).
- **CI-lint enforcing `isFrozen()` presence** on every state-mutating handler → **HARDEN.\*** (§20.4
  `:2041`); also catches future `src/server/comments/` participant Server Actions.
- **23:59 race** between the flip cron and the close-due cron → **HARDEN.10 + operational** (deadline
  ceiling + the state machine make it benign; document it).
- **Comment-brittle source-grep tests** — the (e) surface guard and the (helper) non-locking test grep
  raw source, so a comment can trip them (the S1 false-positive). HARDEN-grade improvement: a behavioral
  `.toSQL()` assertion (no `for update`/`for share` in the emitted SQL) instead of a text grep.

## Time

Execute session 2026-06-14 → 2026-06-15, across the S0–S7 web-gate cycle (S0 recon → S1 RED → S2 GREEN →
S3 cross-suite → S4 audit → S5 reviewers → S6 smoke → S7 PRs).
