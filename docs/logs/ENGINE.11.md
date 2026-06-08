# ENGINE.11 — session log

> **Stratum:** ENGINE.11 — Position layer logic (`src/server/positions/`); a pure core + thin tx-bound persistence layer over the built `positions` (Bucket C), reusing `CpmmDecimal` + dharma's `canonicalize`. Hot-path single-side rule + comment eligibility + the emergent Flipped/Exited marker; plus the nightly drift cron (D1 positions-vs-events replay, D2 dharma-chain integrity, D3 single-side belt).
> **Entry:** plan session (read-only preflight recon → founder rulings R-1..R-6 + 2 architect-delegated calls → draft → web CP-1 review rounds A1–A7 → WEB GREEN → docs land). Execute session appends below in a fresh CC session.

---

## Plan session — 2026-06-07 → 2026-06-08

**What landed.**
- `docs/plans/ENGINE.11.md` — the founder-ratified implementation plan (R-1..R-6 + delegated calls + A1–A7 folded) — via **PR #89**, squash-merged to `main` at **`10b9aa8da3283c7c4492c914b14fc3fd40517e65`** (`plan: ENGINE.11 — Position layer logic (reviewed) (#89)`), **docs-only, no reviewer cascade** (ENGINE.3/4/5 precedent). **318 lines, md5 `904866e82a19b5ebf80e4ccd7dc8cdf0`** (byte-identical through the squash-merge). Pre-squash branch commit: `9e4d035` (ephemeral).
- No `src/`, test, or schema/migration changes — plan-only. Plan branch `docs/engine-11-plan` merged + deleted; this log ships on `chore/engine-11-log`.

**Decisions made — founder rulings R-1..R-6 (ratified).**
- **R-1** — replay substrate = **EVENTS-CANONICAL**: D1 folds `bet.placed.shares` / `bet.sold.sharesSold` (the canonical Bucket-A `events` log, ADR-0005 Pattern A), **never** `bets` rows. **1:1 position-mutation↔event contract minted** in the same W-1 tx (binds E.7/8).
- **R-2** — drift checks **TWO identities**: D1 (positions vs event replay) + D2 (per-user dharma chain integrity, `uncollectable` carved out per ENGINE.5 model A). Per-market conservation **OUT** (`netAdminPoolInjection` has no producer until pool-seeding — ENGINE.10/HARDEN). D3 belt = include.
- **R-3** — position floor = **app oversell guard + storage `CHECK (quantity >= 0)`**; mints **`I-NO-OVERSELL-001`**.
- **R-4** — marker freeze = **EMERGENT**: `computeMarker` pure, no snapshot table; positions written **only** via this module + resolution never touches them ⇒ frozen **by construction** post-close. F-DEBATE-3 wording rider.
- **R-5** — single-side = **STRUCTURAL** partial unique index `(user_id, market_id) WHERE quantity > 0`; flip-order caller contract (E.7); §7-preamble wording rider.
- **R-6** — drift alerting = **SQL only** (`check_nightly_drift()` + nightly `cron.schedule` + conditional `cron_alarms` INSERT, the `0007` pattern); TS drain = loud carry-forward.

**Decisions made — architect-delegated calls (argued in the plan, accepted).**
- **D3 single-side belt = INCLUDE** — defense-in-depth tripwire on R-5's structural guarantee (one `GROUP BY … HAVING count(*)>1`); mirrors the project's app-check-mirrors-storage-constraint doctrine.
- **R-6 watermark transition-gating = OMIT (v1)** — nightly cadence ⇒ no alarm spam to suppress; drift is a correctness signal that should keep nagging until fixed; keeps the migration minimal. Trivial HARDEN add if fatigue appears.

**Decisions made — web CP-1 review amendments A1–A7 (folded; WEB GREEN at `904866e8`).**
- **A1** — D2-B adds a **genesis-cardinality** clause (exactly one `implied_prev = 0` per user); without it a duplicated genesis slips the link check (`implied_prev ≠ 0` exempts both).
- **A2** — **both** D2-A (SUM identity) **and** D2-B (edge-link) run **nightly**, each alarming; `cron_alarms` payload names `derivation: 'D2-A'|'D2-B'`; duplicated-genesis seeded test added (both fire). A paper bound bounds nothing at runtime.
- **A3** — D1's projection-equivalence derivation annotated as a **restatement** of A (not an independent oracle); the genuine independent check is a **cpmm-sourced** integration case — events folded from *actual* `calculateBuy`/`calculateSell` outputs, cross-asserting the **INV-C4** solvency shape (Σ per-side positions == cpmm-derived holdings).
- **A4** — `PositionSingleSideError` is a **catch-and-translate of `23505`** on `positions_one_held_side_idx`, **not** an opposite-side SELECT; the friendly F-BET-10 `opposite_side_held` 400 is the handler-layer read predicate's job (`heldSideOrNull`, E.7/8) — the hot path stays one read.
- **A5** — PROBE charter coherence: no dangling `cron.schedule`-registration test reference (function is CI-testable via `SELECT check_nightly_drift()`; registration is `ctx.skip`-posture).
- **A6** — "no post-PR soak" attributed to the **standing per-stratum founder ruling** (ENGINE.4 OQ-A / ENGINE.5 precedent), not "CLAUDE.md §5.10 supersedes"; CC-local memory-key citations stripped from the committed doc.
- **A7** — duplicated-genesis worked-example **arithmetic fix**: the two `net=+1` sinks are `965, 500` (not `1000, 500`); `Σ(non-uncollectable) = 1465` (not `1500`). Conclusions unchanged.

**Probes (recorded).**
- **PROBE-P1 (drizzle-kit constraint generation) → RE-SEQUENCED to execute** (it writes files): edit `bets.ts` (`.check()` + `uniqueIndex().where()`), `just db-generate positions_constraints`, confirm `ADD CONSTRAINT … CHECK` + `CREATE UNIQUE INDEX … WHERE quantity > 0`; hand-SQL fallback; `@db-migration-reviewer` gates. No backfill risk (`positions` empty — zero production writers).
- **PROBE-P2 (local Postgres :54322) — DOWN.** DB-backed suites CI-gated; **RED-limitation line** (`compute.test.ts` is the DB-free local-RED twin; first true run of DB-backed suites is CI on the execute PR).
- **CI pg_cron-strip finding (LOAD-BEARING).** `ci.yml:78-98` strips pg_cron only from `0007` (hardcoded `sed`). The execute PR's Migration B (carrying `SELECT cron.schedule(...)`) needs the strip **generalized to `*pg_cron*.sql`** — an **execute-phase ci.yml edit** (outside the plan-PR write set) — else `drizzle-kit migrate` goes red on vanilla `postgres:17`.

**Open questions.** None — R-1..R-6 all ruled; both delegated calls argued + accepted; A1–A7 folded and WEB-GREEN-verified.

**Carry-forwards minted (no `#`, to avoid autolink).** carry-forward 1 (`cron_alarms` drain-and-emit TS handler → HARDEN/SCAFFOLD.5; must land before staging soak); carry-forward 2 (final `nightly-drift` cadence → HARDEN, ADR-0006 §7); carry-forward 3 (R-1 1:1 position↔event contract → honored by ENGINE.7/8; drift cron is the enforcement); carry-forward 4 (candidate CI lint "no `positions` writer outside `persist.ts`" → HARDEN); carry-forward 5 (same-tx atomic flip via `previousQuantity` → E.7+).

**Next session starts at.** **ENGINE.11 EXECUTE in a FRESH CC session + fresh web chat** (§5.8 plan/execute split — never this session). **Step 1** = sync + branch **`feat/engine-11-positions`** off `main` (`10b9aa8`+). **Step 2** = `@test-writer` RED authors the §7 suite (`compute.test.ts` REDs locally; DB-backed suites CI-RED; **CP-1** web line-review — web re-derives D1/D2, L-E5.1). **Step 3** = PROBE-P1 (`just db-generate positions_constraints`; confirm CHECK + partial-unique; hand-SQL fallback) + hand-write Migration B (`check_nightly_drift()` + `cron.schedule`) + **GENERALIZE the `ci.yml` pg_cron strip to `*pg_cron*.sql`**. Pass `@docs/plans/ENGINE.11.md` to the cascade. **FULL ritual, no narrowing:** `@test-writer` RED → implement → `@code-reviewer` → **full-scope `@security-auditor`** → `@db-migration-reviewer` → §5.10 audit; **no soak**.

**Context to preserve.**
- **Canonical ratified-plan SHA:** `10b9aa8da3283c7c4492c914b14fc3fd40517e65` (squash of PR #89); plan md5 `904866e82a19b5ebf80e4ccd7dc8cdf0`.
- **Module surface (planned):** `compute.ts` — `applyPositionDelta({previousQuantity, shareDelta}) → quantity` (oversell → `PositionOversellError`), `computeMarker({sideAtPostTime, heldSide}) → Marker` (`Flipped`|`Exited`|`none`); `read.ts` — `getHeldPosition` (quantity>0, assert ≤1) + `canEnter` / `heldSideOrNull` predicates (F-BET-1/2/10, F-COMMENT-5); `persist.ts` — `upsertPositionDelta(tx, {userId, marketId, side, shareDelta, previousQuantity?})` (**single gate**; onConflict `positions_user_market_side_idx`; app-managed `updated_at`; `PositionSingleSideError` = `23505` translate). Errors `PositionOversellError`/`PositionInputError`/`PositionSingleSideError`. Reuse `CpmmDecimal` + dharma `canonicalize`; `server-only`; no barrel.
- **Drift identities:** **D1** = `positions.quantity` vs `Σ(bet.placed.shares − bet.sold.sharesSold)` per `(user,market,side)`. **D2** per-user chain — **A** (SUM: `latest = Σ non-uncollectable`; `latest` = the `net=+1` produced/implied_prev sink) + **B** (edge-link: every `implied_prev` resolves to a distinct same-user `balance_after`, OR genesis-cardinality `count(implied_prev=0)=1`); **both run nightly**. **D3** belt (no two `quantity>0` rows per `(user,market)`). `discrepancy = canonicalize(actual − expected)`, **positive = stored exceeds replay**. **All order-free** (ADR-0016 Driver 7 — no cross-backend UUID order; `now()`-tie within a tx).
- **Constraints (execute):** `CHECK (quantity >= 0)` = `positions_quantity_non_negative` + partial unique `positions_one_held_side_idx (user_id, market_id) WHERE quantity > 0`. **No new columns** (RAILS). `positions` stays Bucket C; zero production writers ⇒ empty-table validate, no backfill.
- **CI pg_cron strip generalization** (execute-phase `ci.yml` edit, OUTSIDE the plan-PR write set) — Migration B named `<NNNN+1>_position_drift_pg_cron.sql`, carries only `cron.schedule` as its pg_cron-coupled line (no `CREATE EXTENSION` — `0007` owns it); the function is directly CI-testable.
- **Riders (CLOSED set, execute PR):** AGENTS.md §6 migration-head; SPEC.1 §7-preamble (R-5); SPEC.1 F-DEBATE-3 (R-4); CLAUDE.md §1 `positions/` greenfield → built-sensitive. **OUT-OF-SET parked:** AGENTS.md `EVENT_TYPES` 11→21; SPEC.2 §7.5 "W-3 writes bets" → ENGINE.9's amendment list.
- **Tracker drift:** "In/Flipped/Exited" → spec `{Flipped, Exited, none}` ("In" dropped, SPEC.1 §9; `none` = default still-on-side).
- **Execute closed diff-stat:** `src/server/positions/{errors,compute,read,persist}.ts` + `src/db/schema/bets.ts` (constraints) + 2 migrations + `.github/workflows/ci.yml` (strip) + `tests/unit/positions/compute.test.ts` + `tests/integration/positions.integration.test.ts` + `tests/invariants/{I-NO-OVERSELL-001,I-SINGLE-SIDE-001}.*.spec.ts` + the doc riders + `docs/logs/ENGINE.11.md`.
- **Environment quirk:** `/tmp` is clobbered between turns on this machine (the recon `/tmp` copy truncated to 3 bytes between turns while the `~/.claude` plan-file copy stayed intact) — md5-gate `/tmp` artifacts at use-time; the durable copy is the plan file (→ `docs/plans/…` at merge).

**Time.** 2026-06-07 → 2026-06-08 (IST). Plan/review loop across two days: read-only preflight recon under a sync-gate (HEAD `9ea737b`) → founder rulings R-1..R-6 + 2 delegated calls → in-chat draft (318 lines) → web CP-1 round 1 (A1–A6) → round 2 (A7 arithmetic) → **WEB GREEN** at md5 `904866e8` → docs-only PR #89 (pre-squash `9e4d035`) → founder squash-merge (`10b9aa8`) → post-merge ff-only sync (L-E4.2; plan branch deleted; END ON MAIN) → this log (separate `chore/engine-11-log` PR).

---
