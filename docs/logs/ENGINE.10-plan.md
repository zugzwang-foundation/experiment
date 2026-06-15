# ENGINE.10 — Plan session log

**Stratum:** ENGINE.10 — Correctness-at-Scale Exit Gate (reconciliation/stress harness). Plan session
(P0 recon → scope rulings → P2 draft → web gate → commit/PR). Docs-only; no `src/`/`drizzle/` writes.
ENGINE.10 is the **ENGINE-phase EXIT** stratum.

## What landed (files + PR#)

- `docs/plans/ENGINE.10.md` — the ratified plan + the same-commit SPEC.2 §3 rider → **PR #129**
  (`docs/engine-10-plan`, branch SHA `90c695b`; canonical SHA = the squash-merge on `main`, pending web
  gate + operator merge).
- `docs/specs/SPEC.2.md` — §3 rider (in PR #129, same commit): `:241`/`:300`/`:332` realigned + §0
  `1.0.5 → 1.0.6` + new change-log row (2026-06-15).
- This log → its own PR (`chore/engine-10-plan-log`).

## Decisions made

- **Scope (operator-ruled 2026-06-15 — Option C):** ENGINE.10 = a **deterministic, CI-able,
  vitest-level correctness-at-scale harness on local Postgres (`:54322`)** — the **hard exit gate**.
  "Concurrency" = **engineered collision** (force many writers onto the 8 hot pool rows to drive the
  worst-case SERIALIZABLE retry path), **not** 5k literal connections. **Perf recorded, NOT gated**; the
  hard `p95 < 500ms @ 5k VUs` gate is **deferred to the immediate-next k6/staging stratum**.
- **Stress axis (corrected):** the experiment has **8 FIXED markets**, not 100 — every market is a hot
  pool row, so contention concentrates. 100 markets = optional later scale-out.
- **Q1 ruled:** exercise the **WHOLE as-built engine** (lifecycle 14, HTTP/cron/admin 15,
  conclusion-freeze 16), not just grant→bet→resolve.
- **k6 sequencing = C-keep:** the k6/staging 5k load test is the **immediate-next P0** after ENGINE.10
  (mix ~90% audience / ~10% bettors + an adversarial high-writer scenario; the hard p95 gate lands
  there). Operator-accepted tradeoff: ENGINE exits with correctness gated, latency test next.
- **Web gate PASS (2026-06-15)** — three Q-rulings + four amendments folded into the plan:
  - **Q-1** fence-first: INV-3 side-bind via concurrent post-bets + sell/re-enter flips through
    `place()`/`sell()`; reply-as-bet **LOAD** (50Đ floor + Support/Counter aggregates) **defers to the
    post-DEBATE.2 k6 stratum, NOT ENGINE.10**; **never** call `place()` with a non-null
    `parentCommentId`. Side-bind *correctness* covered now; reply *load* not.
  - **Q-2** separate **`test:scale`** script as its own CI step (default `vitest run` stays fast);
    **both** green = the exit gate (`test:scale` is a **named required** gate component). CI trigger
    default ≥ engine-path-touching PRs.
  - **Q-3** the DB unique backstop (`bets.idempotency_key`) is the **mandatory** hard assertion; the
    endpoint Redis SETNX path is asserted **only when a test Upstash is configured** (gracefully
    skipped + logged otherwise). The hard gate must **not** depend on local Upstash.
  - **Amendment E** — §7 global conservation = **two independent derivations** (per-market-checker reuse
    = #1; an independent global re-derivation = #2 + safeguard) cross-checked equal; a subtly-wrong
    formula must not pass the headline gate.
  - **Amendment F** — the two-spine bet-during-resolution race is **induced** (W-3 fired while a W-1 bet
    is mid-flight at the unlocked `markets.status` read window, `bets/transaction.ts:78–82`) and asserted
    as an explicit XOR hard assertion (commit-before-flip XOR rejected-on-retry; never both/torn). A
    happy-path resolution check does NOT substitute.
  - **Amendment D** — sells are not `bets` rows (`bets.comment_id` NOT NULL + sell is the only
    comment-free action); INV-1 count-parity scoped to commented POSTS; sell Dharma via the ledger.
- **SPEC.2 §3 rider (web-authored wording, applied verbatim):** the stale ENGINE.10 forward-refs point
  at resolution build/composition/wire — landed at ENGINE.9 + ENGINE.15. Realigned `:241`/`:300`/`:332`
  to the §9 gating map (`:2247`, which already names ENGINE.10 "full-invariant stress test"). §0 patch
  bump + new change-log row. The historical v1.0.3 row and the §9 anchor were left unchanged.

## Surprises caught + fixed in-session

- **Q-1 conflict (recon + draft self-critique, ratified at web):** the ratified axis table listed
  reply-as-bet (axes 4/6) as E10, but the INV fence forecloses DEBATE.2 and `place()` runs only the
  top-level branch (`place.ts:25,48–49` — `parentCommentId` is a parameter ENGINE.8 always passes
  `null`; the reply branch is DEBATE.2). Surfaced rather than silently "covered"; web ruled fence-first.
- **Amendment D verified against code, not just asserted:** `sell.ts:36–38,71–76` confirms a sell writes
  no `bets`/`comments` row and moves Dharma via a `bet_stake`-POSITIVE ledger row with `bet_id` NULL.
- **Sell per-market attribution subtlety (recorded for execute):** a sell's `dharma_ledger` row carries
  neither `bet_id` nor `market_id`, so per-market conservation must attribute sells via the `bet.sold`
  event's `payload.marketId`; the global identity (Amendment E) is the attribution-independent backstop.
- **SPEC.2 rider line-number drift handled:** recon-era line numbers (`241`/`300`/`332`) were matched on
  the verbatim current text (all unique) before editing, not on the numbers.

## Open questions

Q-1/Q-2/Q-3 **resolved** at the web gate. Remaining residuals are Phase-2 mechanics, none blocking:
exact `test:scale` CI trigger filter (R-1), the per-market sell-attribution query shape (R-2), and
collision-degree/write-count tuning to the CI-time budget (R-3). See `docs/plans/ENGINE.10.md` §Open
questions.

## Next session starts at (exact next action)

A **separate, fresh EXECUTE chat** (not this one): RED-first per `docs/plans/ENGINE.10.md` §7 —
`@test-writer` mints the `tests/scale/` battery (collision driver + reconciler with **two derivations**
+ the per-axis `*.scale.test.ts` files) FAILING first → build the harness → GREEN on local Postgres
(`open -a Docker` + `supabase start`) with **both** `pnpm vitest run` **and** the new `pnpm test:scale`
green → `just verify`. No `src/`, no migration; `@code-reviewer` / `@db-migration-reviewer` idle.
**Prereq:** PR #129 (+ this log PR) merged on `main` first.

## Context to preserve

- **The INV fence is load-bearing:** drive INV-1 via `place()`/`sell()`, never a comment/reply endpoint,
  never a non-null `parentCommentId` (that pre-tests DEBATE.2). Reply-bet *load* is post-DEBATE.2 k6.
- **Two derivations of the global identity (Amendment E)** is the headline safeguard — not a scale-up of
  the per-market checker.
- **Induce the two-spine race (Amendment F)** — a happy-path resolution does not prove it.
- **No `src/` change** — the global-conservation reconciler lives in `tests/scale/_harness/`, not `src/`.
- **Synthetic fixtures only** — placeholder market content, never real questions/criteria/dates (§3).
- **On green:** the post-ENGINE.10 sweep mints the **k6/staging 5k stratum (next P0)** + the **ENGINE.15
  + ENGINE.16 tracker rows** + the **ID-order errata** (ENGINE.16 ran before ENGINE.10).
- Canonical SHAs (backfill post-merge): plan PR #129; this log PR. Deps on-disk + CI-green: ENGINE.8
  `66fa532` (#99), ENGINE.9 `af28566` (#114), ENGINE.11 `deb0c76` (#91), ENGINE.12 `af61ce5` (#104),
  ENGINE.13 `76877e6` (#110), ENGINE.14 `a29ef7e` (#118), ENGINE.15 `b8d4ee4` (#122), ENGINE.16
  `f7d1ab2` (#127). HEAD `5c624c4`, migration head `0015`, `EVENT_TYPES` 23.

## Time

Plan session 2026-06-15 — P0 recon (2026-06-14/15) → scope rulings (Q1/Q2/Q3 + 8-market correction +
C-keep) → P2 draft → web gate (PASS w/ amendments D/E/F + the SPEC.2 §3 rider) → commit/PR.
