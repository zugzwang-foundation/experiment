# SCALE — record

**Generated** 2026-09-03 from `origin/main` @ `ead741577b89849560ab3d3222a48b2a69bf18b7` · **Regenerate** per `docs/records/README.md`
**Covers** the scale programme: what was measured, what was asserted, and which is which.

## 1 · What this lane is

The scale lane exists to answer one question — how many people can use this at once before it
stops working — and it is the lane where the difference between a **measurement** and an
**assertion** matters most, because both look identical once written into a document.

Four strata have shipped: a connection-pooling migration, a read-path collapse, a signup
deadlock fix, and an idempotency scoping fix. A fifth, the load programme itself, exists only
as an open pull request. There is also a correctness-at-scale test battery that never runs by
default and a set of operational runners that point at the live staging database and are not
tests at all.

⛔ **The one thing this record must not do is reconstruct numbers it cannot see.** The load
programme's report is not in this repository. Its findings are named below and its figures are
not, because a measurement written down from memory is indistinguishable from one that was
taken, and the second kind is the only kind worth having in a lane about capacity.

## 2 · ⚠ `S-n` names two different things, and this record cites `SCALE S-n`

`S-n` is in simultaneous use as **the SCALE stratum prefix** and as **the Surprise-row prefix**
in session logs. Measured: `grep -rn '^\*\*S-[0-9]* ·' docs/logs/` returns **51** occurrences,
and every one is a Surprise row, not a stratum.

⛔ **`S-7` names both** — the cross-user-idempotency stratum (`docs/plans/S-7.md`, ADR-0044)
**and** POLISH-8's surprise row 7 (`docs/logs/POLISH-8.md:110` — *"S-6 · D17 — PASS · S-7 · D20
— PASS · S-8 · D06 — PASS"*).

**This has already cost a session a fact.** `docs/logs/CONTENT-2-TILES.md:57` records it at the
time: *"**S-1 ·** The plan's own **'S-4' citation didn't resolve to anything.** MEDIA-SECOND-ROW's
kickoff cited 'S-4 is actively …'"* — a kickoff citing a stratum, a session reading a surprise
row, and the citation resolving to neither.

This is the same failure `CLAUDE.md` §8 `C-4` names for `GC-n` and `L-n`, one prefix over.
**This record cites strata as `SCALE S-n` and never bare.** It does not resolve the collision;
renumbering a shared identifier space is a founder call. See `docs/STATE.md` §4 · `F-12`.

## 3 · Feature table — the strata, and where each one is

| Stratum | Status | Plan | Log | ADR | Proved by | Open |
|---|---|---|---|---|---|---|
| **SCALE S-1** — transaction pooler `:5432` → `:6543` | SHIPPED, **staging only** | `docs/plans/S-1.md` | `docs/logs/S-1.md`, `S-1-close.md`, `S-1-stage3{,b,c,d}.md` | 0038 P1, 0024 P3 | `scripts/verify-pooler-mode.ts` | Stage 3 open; `prd` untouched by founder ruling |
| **SCALE S-2** | **DOES NOT EXIST** | — | — | — | — | every `S-2` in `docs/` is a Surprise row |
| **SCALE S-3** — Google OAuth signup deadlock | SHIPPED | `docs/plans/S-3.md` | `docs/logs/S-3.md` | **0043** | `tests/integration/oauth-signup-pool-deadlock.integration.test.ts` | — |
| **SCALE S-4** — read-path collapse | SHIPPED, **not formally closed** | ⛔ **no plan on `main`** | `docs/logs/S4-{CLOSE-OUT,FINAL-RECORD,FIXES,PHASE-B,PHASE-C,PHASE-D,PHASE-E,PHASE-E-warm-path,SESSION-SUMMARY}.md` | **0041** | `tests/unit/debate-view/`, `tests/integration/header-portfolio.integration.test.ts` | its own exit metric is unmet — see §5 |
| **SCALE S-5** — the load programme | **NOT ON `main`** | ⛔ none | ⛔ none | 0038 names it as owner | — | **open PR #462**, `ci=FAILURE`, base `staging` |
| **SCALE S-6** | **DOES NOT EXIST** | — | — | — | — | Surprise rows only |
| **SCALE S-7** — user-scoped idempotency + double charge | SHIPPED | `docs/plans/S-7.md` | ⛔ **no log** | **0044** | `tests/invariants/I-IDEM-NOMASK-001…`, `tests/integration/cross-user-idempotency.integration.test.ts` | — |
| **SCALE S-8 / S-9** | **DO NOT EXIST** | — | — | — | — | Surprise rows only |

**Verified as absences with positive controls (OVN-V1):** `ls docs/plans/S-5.md docs/logs/S-5.md`
→ **0 files**, against the control `ls docs/plans/S-3.md` → **1 file**. The pattern finds real
strata; S-5 is not one of them.

### 3.1 · The correctness-at-scale battery

`tests/scale/` — **8 specs** plus `_fixtures/` and `_harness/`, run **only** by
`pnpm test:scale` against `vitest.scale.config.ts`. The default `vitest.config.ts` excludes
`tests/scale/**`, so a bare `vitest run` — local, CI or a subagent's — never picks it up.

| Spec | What it exercises |
|---|---|
| `daily-credit-race.scale.test.ts` | the once-per-UTC-day allowance under concurrency |
| `freeze-under-load.scale.test.ts` | the conclusion freeze while writes are in flight |
| `hot-row-contention.scale.test.ts` | many bets on one pool row |
| `idempotency-dedup.scale.test.ts` | collision storms on the idempotency key |
| `money-math-determinism.scale.test.ts` | identical inputs, identical decimals, under load |
| `reconciliation.scale.test.ts` | the ledger reconciles after a storm |
| `side-bind.scale.test.ts` | INV-3 under concurrent flips |
| `two-spine-interaction.scale.test.ts` | W-1 and W-3 interleaved |

⚠ **This battery is about CORRECTNESS at scale, not CAPACITY.** It answers "does the money stay
right when many things happen at once", never "how many requests per second". Reading a green
scale suite as a capacity result is the mistake this paragraph exists to prevent.

### 3.2 · The staging operational runners — **not tests**

`tests/staging/` holds **three runners** plus `fixtures.ts` and `_lib/` (8 files). ADR-0036
governs them: they are **operational artifacts that borrow the Vitest harness for module
resolution**, they point at the **live staging database**, and the default config excludes
`tests/staging/**` exactly as it excludes `tests/scale/**`.

| Runner | Command | What it does |
|---|---|---|
| `reset.staging.test.ts` | `pnpm staging:reset` | the guarded truncate (ADR-0035), then re-seeds `identity_pool` |
| `generate.staging.test.ts` | `pnpm staging:generate` | the engine-driven fixture generator — **drives the real product functions and writes nothing itself** |
| `gates.staging.test.ts` | `pnpm staging:gates` | six verification gates; emits `docs/polish/staging-coverage.json` and reds if it drifts from the committed copy |

⛔ **Each refuses to start unless a five-guard contract passes** — intent · target · environment
· live connection · post-run verification. The write-capable runners additionally require an
intent token in the environment (`ZUGZWANG_STAGING_RESET_ACK`, `ZUGZWANG_STAGING_WRITE_ACK`,
visible in `package.json:23,25`); the read-only gates deliberately do not.

Eight further guards in `tests/unit/staging/` constrain the runners **without touching a
database**: `runner-isolation`, `runner-gating`, `runner-target`, `write-guard`, `reset-guard`,
`guard-list-parity`, `fixture-table`, and `generator-no-direct-writes` — the last pinning an
**allowlist** of the `@/server/**` entrypoints a runner may import, with
`@/server/events/insert` and `@/server/dharma/persist` pinned as *not* ratified, which is its
own positive control.

⚠ **`pnpm staging:rebuild` does not merely truncate.** It runs reset → seed → generate → gates,
replacing whatever is there. Staging currently holds **1,692 participant comment/bet pairs**
and eight real content markets. There is no restore path.

## 4 · The decisions that shaped it

| Decision | Recorded in | What it changed |
|---|---|---|
| The scale target is 100k | ADR-0038 | gave the lane a number to fail against, and four sizings that hung off a concurrency figure |
| Guarded staging reset | ADR-0035 | a destructive operation acquired a five-guard contract and an intent token |
| Vitest-context operational runners | ADR-0036 | the runners are excluded from every default run, by config rather than by convention |
| Transaction-pooler mode behind a flag, staging only | ADR-0024 P3, ADR-0038 P1 | `prd` stays on `:5432`; `src/db/index.ts:55` refuses `transaction` in prod |
| `cacheComponents` + reserves-keyed caching | ADR-0041 | the S-4 read-path collapse |
| The OAuth signup pool checkout is not nested | ADR-0043 | four concurrent signups no longer deadlock a four-connection pool |
| Idempotency is scoped `(user_id, key)`, not `key` | ADR-0044 | a shared key stopped being a cross-user oracle |

## 5 · Work history, and the two strata whose own records say they are unfinished

| Unit | PR | Merge SHA | Date | What landed |
|---|---|---|---|---|
| SCALE S-1 | #404 | `e37da00` | 2026-08-25 | transaction-pooler migration behind `DB_POOLER_MODE` |
| SCALE S-1 Gate-C follow-ups | #407 | — | 2026-08-25 | the two instruments S-5 needs |
| SCALE S-1 close | #409 | `64e0874` | 2026-08-25 | the close-out log and the §3.3 install step |
| SCALE S-4 | #405, #423, #424, #430 | — | 2026-08-26 → 28 | the read-path collapse and its cache-invalidation fixes |
| SCALE S-3 | #431 | `2f3497d` | 2026-08-28 | the signup deadlock (ADR-0043) |
| SCALE S-7 | #432 | `acb71cb` | 2026-08-28 | user-scoped idempotency (ADR-0044) |
| SYNC-3 | #364, #367 | — | 2026-08-20 | the scale premises — ADR-0038, and the four sizings |

**SCALE S-1 — what the close-out actually claims.** `docs/logs/S-1-close.md:7`, verbatim:

> **The record reads: transaction mode PLUS read-path reduction TOGETHER clear the ceiling.**
> Never *"transaction mode clears the ceiling."* S-1 delivered one of the two.

⚠ **SCALE S-4 is not formally closed and says so.** `docs/logs/S4-FINAL-RECORD.md:8-11`:

> **Status in one line:** all six phases are executed, committed and pushed. **S-4 is not
> formally closed** — the pack's own exit metric (§6.2) requires budget tests on five surfaces
> and two of five exist; the commits are unsigned and will be refused at merge; and Gate C plus
> the review cascade have not run.

Partly overtaken: #405, #423, #424 and #430 merged and ADR-0041 is on `main`, so the commits
landed. **The "two of five budget tests" gap is not visibly discharged anywhere in the tree,
and no S-4 closure record exists.**

⛔ **SCALE S-7 has no session log.** `docs/plans/S-7.md` exists; `docs/logs/` holds nothing for
it. **No repository record — PR #432 merged the work; the lane has no session log.**
⛔ **SCALE S-4 has no plan.** `docs/plans/` holds no `S-4.md`, only the nine `S4-*` logs.

## 6 · The 2026-09-02 load report — **NOT IN THIS REPOSITORY**

⛔ **The load programme's final report is not a repository artifact.** It exists as
`~/Downloads/zz_LOAD-TESTING-FINAL-REPORT_20260902T1802.md` on the operator's machine
(70 lines, md5 `d35063aa61d282d826921fe14f04e0d7`), with a companion
`ZUGZWANG_LOAD-PROGRAMME-STATUS_2026-09-02.pdf`. **Neither md5 matches any of the 1,510 blobs
tracked at `origin/main`.**

**What it would answer, named rather than reconstructed:**

- the requests-per-second at which each read surface begins to fail, per surface;
- the failure *mode* at that point — slow, or lost;
- whether the constraint is the connection ceiling ADR-0038 left at 4, or something else;
- whether any write-load run has happened at all;
- whether the moderation cost cap has ever been exercised.

⛔ **No figure from it is reproduced here.** An absent measurement written as a present one is
worse than no record: it cannot be told from a real one, and the next reader will act on it.
The report also carries its own scope limit, which any future citation must carry with it —
**staging is not production**, and §5.4 of `docs/records/PLATFORM-record.md` measures exactly
how far apart they are today.

⚠ **ADR-0038's watch item W-9 is still written as open and is arguably discharged.**
`docs/adr/0038-scale-target-100k.md:90` — *"`max` stays at 4 until S-5 measures it"* — and
`:135` — *"**S-5 must measure it. Watch item W-9 does not close without it.**"* SCALE S-5 has
run and produced a report; the report is not in the repository and the ADR has not been
amended. See `docs/STATE.md` §4 · `F-13`.

## 7 · Known-open

| Pointer | What |
|---|---|
| `docs/STATE.md` §4 · `F-12` | `S-n` collides across the SCALE strata and the Surprise-row register |
| `docs/STATE.md` §4 · `F-13` | the load report is outside the repository; ADR-0038 W-9 / W-10 remain written as open |
| `docs/STATE.md` §4 · `F-14` | SCALE S-4's own exit metric — two of five budget tests — is unmet and undischarged |
| `docs/STATE.md` §4 · `F-6` | `DB_POOLER_MODE` / `DATABASE_URL_TXN` are staging-only; prod stays on the session pooler |
| **open PR #462** | the whole `docs/scale/` tree, the k6 load stages, the cache-hit instrument and a fourth staging runner. **`ci=FAILURE`, base `staging`** |
| `docs/parked.md` — PERF-2 | read-path volume at realistic scale, owned by SCALE S-5 |
| `docs/parked.md` — STAGING-PARITY Slice A | an `events` partition added without its truncate guard is invisible |
| `docs/parked.md` — STAGING-PARITY Slice B | ADR-0031's `bet_receipts` derivability claim is unverified |
| `docs/parked.md` — STAGING-AUTH-ONE-WAY | a staging session cannot be re-obtained in-session |
