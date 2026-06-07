# ENGINE.11 — Position layer logic (`src/server/positions/`)

> **Status:** drafted — founder-ruled R-1..R-6 (2026-06-07); two architect-delegated calls (D3 belt = **include**; R-6 watermark transition-gating = **omit**) argued below. Ratification = plan-PR merge.
> **Date:** 2026-06-07
> **Author:** Hrishikesh + Claude Code (plan tab)
> **Critical-path?** **YES.** Ships a migration (`drizzle/migrations/` — CLAUDE.md §1 critical path), is bet-path substrate (`positions` is locked 2nd in the §9 W-1 chain), and reads built-sensitive `dharma/`. ⇒ **FULL ritual, no narrowing** at execute: `@test-writer` RED → implement → `@code-reviewer` → **full-scope** `@security-auditor` → `@db-migration-reviewer` (constraints + pg_cron migration) → §5.10 audit. No post-PR soak (standing per-stratum founder ruling — ENGINE.4 OQ-A / ENGINE.5 precedent; re-ratified by this plan's merge).
> **Plan PR / commit:** this file rides **`docs/engine-11-plan`** (docs-only; ENGINE.3/4/5 convention), committed before Phase 2. The **execute** branch is `feat/engine-11-positions`, created only at execute step 1. Phase 2 references this file via `@docs/plans/ENGINE.11.md`.

---

## Tracker context

**Tracker row (verbatim — the tracker is operator-maintained HTML, external to the repo):**
> "Position layer logic. positions table built (in bets.ts; unique user/market/side). Maintained atomically per bet; hot-path read for single-side rule, comment eligibility, In/Flipped/Exited marker. Nightly drift-detection vs ledger replay." — pri **P0**, deps **[ENGINE.5 — done, merged #87/#88]**, est **2d**.

**Dependency status at plan time:** **ENGINE.5 merged** (#87/#88; `9ea737b`) — `src/server/dharma/{canonical,ledger,persist,conservation,tags,errors}.ts` is the **pure-compute / tx-bound-persist** template this module mirrors, and `appendLedgerRow(tx, …)` is the co-tx primitive the W-1 caller composes with. **ENGINE.0 merged** — `bet.placed{shares}` / `bet.sold{sharesSold}` event types + `numericString` (`src/server/events/schemas.ts`). **ENGINE.4 merged** — `transition()` single-gate precedent (`tests/unit/markets/transitions.test.ts`). Built `positions` schema (Bucket C, `bets.ts:71-99`) is the storage substrate.

**Tracker drift flagged (CLAUDE.md §4; source-of-truth precedence is spec > tracker):** the tracker's **"In/Flipped/Exited"** is stale — SPEC.1 v1.9.0 §9:418 + F-DEBATE-2:427-436 dropped **"In"**; the live marker set is **`{Flipped, Exited, none}`** where `none` (no badge) is the default still-on-side state that "In" used to name. This plan follows the spec; `computeMarker` returns `Flipped | Exited | none`.

## Approach (one paragraph)

Build `src/server/positions/` as a **pure core + thin tx-bound persistence layer** mirroring `dharma/` (`server-only`, named exports, module-local error sentinels). The pure core computes a position delta (`previousQuantity + shareDelta`, exact 18-dp via the existing `CpmmDecimal`, **oversell-guarded** to `≥ 0` — the application mirror of a new storage CHECK) and the **emergent** Flipped/Exited marker (a pure read of `side_at_post_time` vs current held side; **no snapshot table** — R-4). A thin persistence helper `upsertPositionDelta(tx, …)` runs inside the **caller's** W-1 transaction (`onConflict` the built `positions_user_market_side_idx`, app-managed `updated_at`, caller owns serialization per ADR-0013) — the **single gate** every position write passes through (binds E.7/9; resolution **never** writes positions). The module also ships the **read predicates** that map exactly to the SPEC.1 §7/§8 pre-conditions (F-BET-1 entry / F-BET-2 same-side / F-BET-10 opposite-rejected / F-COMMENT-5 no-stake-no-voice). Schema work is **constraints-only** (R-3 `quantity ≥ 0` CHECK + R-5 single-side partial unique index `(user_id, market_id) WHERE quantity > 0`) — drizzle-generated from a `bets.ts` edit, PROBE-re-sequenced to execute (ENGINE.5 PROBE-2 pattern). The **nightly drift cron** (R-1/R-2/R-6) ships as **raw SQL** (mirrors `0007`): a `check_nightly_drift()` plpgsql function that runs **D1** (positions vs **events-canonical** replay), **D2** (per-user dharma chain integrity), and a cheap **D3** belt (no `(user,market)` with two `quantity>0` rows), each **order-free** (ADR-0016 forbids relying on UUID order), conditionally `INSERT … cron_alarms` on mismatch; the TS drain stays a **loud carry-forward**.

---

## Folded rulings & delegated calls (index)

- **R-1 — Replay substrate = EVENTS-CANONICAL.** D1 reconciles `positions` against a fold over `bet.placed.shares` / `bet.sold.sharesSold` (the canonical Bucket-A `events` log, ADR-0005 Pattern A) — **never** `bets` rows. **Forward contract minted:** every position mutation pairs **1:1** with a `bet.placed` or `bet.sold` event in the **same** W-1 transaction (binds E.7/8; enforced by the drift cron).
- **R-2 — Drift checks TWO identities.** D1 (positions vs event replay) **and** D2 (per-user dharma chain integrity, `uncollectable` carved out per the ratified ENGINE.5 model). Per-market conservation stays **OUT** (`netAdminPoolInjection` has no producer until pool-seeding — ENGINE.10/HARDEN). **D3 belt = INCLUDE** (argued below).
- **R-3 — Position floor = app + storage.** `upsertPositionDelta` throws `PositionOversellError` on `newQuantity < 0` **and** a migration adds `CHECK (quantity >= 0)`. Mints **`I-NO-OVERSELL-001`** (dharma `balance_after ≥ 0` precedent).
- **R-4 — Marker freeze = EMERGENT.** `computeMarker` is a pure read of `(side_at_post_time, current position)`; **no** snapshot table, **no** stored marker. **Forward contract minted:** positions are written **only** inside W-1 via this module (binds E.7/9; resolution never touches positions) — so the marker is frozen **by construction** post-close. SPEC.1 F-DEBATE-3 wording rider records the choice.
- **R-5 — Single-side = STRUCTURAL.** Additive **partial unique index** `(user_id, market_id) WHERE quantity > 0`; read predicates still assert `≤1` held row (defense in depth). **Flip-ordering caller contract (binds E.7):** the old side must reach **zero before** the opposite-side row goes positive, **within one tx**. SPEC.1 §7-preamble wording rider.
- **R-6 — Drift alerting = SQL only.** `check_nightly_drift()` + nightly `cron.schedule` + conditional `INSERT … cron_alarms` on mismatch (the `0007` pattern). **watermark_state transition-gating = OMIT** (argued below). The TS drain is a **loud carry-forward** (HARDEN-adjacent; must land before staging soak). Operator `psql` manual-check snippet included (§Execute).

**Delegated call 1 — D3 belt: INCLUDE.** R-5's partial unique index makes "two `quantity>0` rows per `(user,market)`" structurally impossible in a correct deployment, so a runtime D3 check is logically redundant *there*. Include it anyway, framed as **defense-in-depth**, exactly mirroring this project's app-check-mirrors-storage-constraint doctrine (ENGINE.5's `DharmaOverdraftError` mirroring the `balance_after ≥ 0` CHECK; R-3's own app+storage dual guard; R-5's own "read predicates still assert ≤1"). Cost is **one extra `GROUP BY … HAVING count(*)>1`** in the nightly function; benefit is a **tripwire** if the partial index is ever dropped by a bad migration or absent on a mis-applied environment. A structural guarantee you can cheaply re-verify nightly is worth re-verifying.

**Delegated call 2 — R-6 watermark transition-gating: OMIT (v1).** `0007` gates its `cron_alarms` INSERT through a `watermark_state` transition to fire **once per episode** — justified there by a **5-minute** cadence (alarm spam). The drift cron runs **nightly** (≤1 alarm/night), so the spam rationale doesn't apply; and drift is a **correctness** signal (positions/ledger corruption) that **should** keep nagging until fixed, unlike a capacity watermark. Omitting transition-gating also keeps the migration minimal (no new `watermark_state` seed rows, no transition CTE). If alarm fatigue ever becomes real (drift left unfixed for many nights), transition-gating is a trivial HARDEN add. **Plain conditional INSERT on any mismatch each night.**

---

## Probe results (re-sequenced / recorded)

- **PROBE-P1 (drizzle-kit constraint generation) — RE-SEQUENCED to execute** (ENGINE.5 PROBE-2 pattern; generation **writes files**, illegal in plan phase). At execute: edit `bets.ts` (add `.check()` + `uniqueIndex().where()` to `positions`), run `just db-generate positions_constraints`, **confirm** it emits `ALTER TABLE … ADD CONSTRAINT … CHECK` + `CREATE UNIQUE INDEX … WHERE quantity > 0` (not a table rewrite); **hand-written raw-SQL fallback** pre-authorized if it mis-generates. `@db-migration-reviewer` gates. **No backfill risk:** `positions` has **zero** production writers (recon R6) — the CHECK/index validate against an empty table.
- **PROBE-P2 (local Postgres) — DOWN** (ENGINE.5 PROBE-3; `:54322` `ECONNREFUSED`). Pure `tests/unit/positions/` + `ZUGZWANG_ENV=preview just verify` run locally; **DB-backed suites are CI-gated** (Postgres-17 service). See §7 RED-limitation.
- **CI pg_cron-strip finding (load-bearing; `.github/workflows/ci.yml:78-98`).** The strip step is **hardcoded to `0007_pg_cron_jobs.sql`** (`sed -i` over that one file). A new migration carrying `SELECT cron.schedule(...)` would **not** be stripped → `pnpm drizzle-kit migrate` fails on vanilla `postgres:17`. **Resolution (execute-phase, in the execute PR — NOT the plan PR):** generalize the strip from the hardcoded filename to a loop over `drizzle/migrations/*pg_cron*.sql`, and name the new migration `<NNNN>_position_drift_pg_cron.sql`. The new migration carries **only** `SELECT cron.schedule(...)` as its pg_cron-coupled line (it does **not** re-`CREATE EXTENSION` — `0007` owns that; the migration runs after `0007` in prod). The `check_nightly_drift()` function + `cron_alarms` INSERT are plain plpgsql (CI-preserved, directly testable via `SELECT check_nightly_drift()`); the `cron.schedule` registration itself is **not** exercised in CI (no pg_cron — the `watermark.test.ts` `ctx.skip()` posture), and no registration test is charted in §7 (A5). Risk 1, §5.

---

## Module & design

### File layout (`src/server/positions/`, greenfield — mirrors `dharma/` / `cpmm/`)

| File | Subject |
|---|---|
| `errors.ts` | `PositionOversellError`, `PositionInputError`, `PositionSingleSideError` (flip-ordering contract violation). Mirrors `dharma/errors.ts`. |
| `compute.ts` | pure core (no IO/clock): `applyPositionDelta({previousQuantity, shareDelta})` → canonical 18-dp `quantity` with oversell guard; `computeMarker({sideAtPostTime, heldSide})` → `Marker` (F-DEBATE-2 truth table). |
| `read.ts` | `getHeldPosition(db|tx, {userId, marketId})` (filter `quantity>0`, **assert ≤1**); eligibility predicates mapping to F-BET-1/2/10 + F-COMMENT-5. |
| `persist.ts` | `upsertPositionDelta(tx, {...})` — the **single gate**; `onConflict` the built `positions_user_market_side_idx`, app-managed `updated_at`, oversell throw mirroring the CHECK; `DbTransaction` first arg, caller owns serialization. |

`import "server-only"` in every file (no DB/secret leak to client); no barrel (consumers import `@/server/positions/<file>`, dharma/cpmm precedent). Decimal math via the existing **`CpmmDecimal`** (`@/server/cpmm/decimal`); strings cross boundaries via the existing **`canonicalize`** (`@/server/dharma/canonical`) / `numericString` — **no float ever crosses a boundary** (CLAUDE.md §2). *(Reuse `dharma/canonical`'s `canonicalize` directly — it is already the shared NUMERIC(38,18) string authority; no lift needed.)*

### Exported API (signatures)

```ts
// errors.ts — module-local sentinels (mirror dharma/errors.ts)
export class PositionOversellError extends Error {}   // newQuantity < 0
export class PositionInputError extends Error {}       // bad numeric string / bad side
export class PositionSingleSideError extends Error {}  // catch-and-translate of SQLSTATE 23505 on positions_one_held_side_idx (NOT an opposite-side SELECT)

// compute.ts — pure (no IO, no clock, no randomness)
export type Marker = "Flipped" | "Exited" | "none";
export function applyPositionDelta(args: {
  previousQuantity: string;   // canonical; "0.000…0" for a new (user,market,side)
  shareDelta: string;         // signed: +s on a buy (cpmm s), −sharesSold on a sell
}): string;                   // canonical newQuantity; newQuantity < 0 → PositionOversellError (R-3 app floor)
export function computeMarker(args: {
  sideAtPostTime: "YES" | "NO";        // comments.side_at_post_time (frozen, INV-3)
  heldSide: "YES" | "NO" | null;       // current held side (null = no position, i.e. Exited)
}): Marker;                            // F-DEBATE-2: heldSide===sideAtPostTime → "none";
                                       //   opposite → "Flipped"; null → "Exited"

// read.ts — bound db or tx; predicates map 1:1 to SPEC.1 §7/§8 pre-conditions
export async function getHeldPosition(
  client: Db | DbTransaction, args: { userId: string; marketId: string },
): Promise<{ side: "YES" | "NO"; quantity: string } | null>;   // quantity>0 filter; asserts ≤1 (defense in depth)
export async function canEnter(client, args): Promise<boolean>;          // F-BET-1: no held position either side
export async function heldSideOrNull(client, args): Promise<"YES"|"NO"|null>; // F-BET-2 / F-BET-10 / F-COMMENT-5 / computeMarker input

// persist.ts — thin persistence, caller's tx (dharma appendLedgerRow precedent)
export async function upsertPositionDelta(
  tx: DbTransaction,            // NOT top-level db (compile-error to pass db) — dharma/persist.ts:54 precedent
  args: {
    userId: string; marketId: string; side: "YES" | "NO";
    shareDelta: string;         // signed; canonicalized internally
    previousQuantity?: string;  // optional: when supplied SKIPS the in-tx read (the dharma A3 chaining shape,
                                //   for >1 mutation on the same (user,market,side) in one tx)
  },
): Promise<{ side: "YES" | "NO"; quantity: string }>;
// reads ONLY the current (user,market,side) quantity (FOR NO KEY UPDATE not taken here — the W-1 pool-row
//   lock already serializes the (user,market); ADR-0013), computes via applyPositionDelta, UPSERTs onConflict
//   positions_user_market_side_idx, sets updated_at = now() explicitly (Drizzle 0.45 won't auto-bump).
//   No opposite-side read: a flip-order violation surfaces as the partial-unique-index 23505, which persist
//   catches and re-throws as PositionSingleSideError (A4); the friendly F-BET-10 opposite_side_held 400 is the
//   handler-layer read predicate's job (heldSideOrNull, E.7/8) — the hot path stays one read.
```

### Single-gate consumer contract (ENGINE.4 `transition()` precedent)

**Every** `positions` write goes through `upsertPositionDelta`. Stated, binding **E.7** (W-1 buy/sell) and **E.9** (resolution must **not** touch positions — R-4). Candidate CI lint **noted, not built**: a grep asserting no `db.insert(positions)` / `db.update(positions)` / `db.delete(positions)` outside `src/server/positions/persist.ts`. This is the load-bearing guard that makes the **emergent marker** (R-4) correct: positions are immutable post-close because (a) W-1 requires `market.state = Open` (SPEC.1 §7 F-BET-1/2/3) and (b) W-3's lock order is `markets → bets → payout_events → resolution_events → dharma_ledger → events` (SPEC.2 §3.2:235) — **positions absent**. ⇒ `computeMarker` recomputes on read but yields a stable (frozen) value forever after close, satisfying F-DEBATE-3 without storage.

### Marker truth table (F-DEBATE-2:427-436) — emergent

| `side_at_post_time` (frozen, INV-3) | current held side | `computeMarker` |
|---|---|---|
| X | X (same) | **`none`** (default; no badge) |
| X | ¬X (opposite) | **`Flipped`** |
| X | null (no position) | **`Exited`** |

The frozen YES/NO badge never changes (INV-3); the marker is the live overlay. (Tracker's "In" = this table's `none` row — dropped name, §Tracker drift.)

### Single-side: partial unique index + flip-ordering contract (R-5)

- **Structural enforcement:** `CREATE UNIQUE INDEX positions_one_held_side_idx ON positions (user_id, market_id) WHERE quantity > 0` — at most one **held** (`quantity>0`) row per `(user,market)`. Drizzle form: `uniqueIndex("positions_one_held_side_idx").on(t.userId, t.marketId).where(sql\`${t.quantity} > 0\`)` — the `bets_idempotency_key_idx` partial-index precedent (`bets.ts:62-64`). Closes the SPEC.1 §7-preamble gap (the spec already says "enforced via the `(user_id, market_id)` position constraint" but the built `UNIQUE(user_id,market_id,side)` permits both sides).
- **Flip-ordering caller contract (binds E.7):** to switch sides (F-BET-3 sell-to-zero then re-enter, §7 preamble), the held side must reach `quantity = 0` **before** the opposite side goes `> 0`, **within one transaction** — else the partial unique index trips mid-tx (`23505`). `upsertPositionDelta` does **not** add an opposite-side SELECT (the hot path stays one read); it **catches the index's `23505` and re-throws `PositionSingleSideError`** (A4). The user-facing F-BET-10 `opposite_side_held` 400 is raised earlier by the handler-layer read predicate (`heldSideOrNull`, E.7/8); the structural index plus this translation are the backstop. v1 has **no same-tx flip** (F-BET-3 sell and the fresh entry are separate user actions / separate transactions), so the contract is a forward guard for any future atomic-flip, not a v1 code path.

### Drift identities — TWO independent derivations + worked example each (L-E5.1)

> **Convention (ENGINE.5 R-CP1 consistency):** `discrepancy = canonicalize(actual − expected)`; **positive ⇒ stored exceeds replay** (over-issuance direction). All math is Postgres `numeric` (exact; no float — CLAUDE.md §2). All three checks are **order-free** — ADR-0016 Driver 7 / §Negative:200 forbids relying on UUID monotonicity, and even `created_at` ties within a tx (`now()` is tx-frozen — `dharma/persist.ts:17-21`), so no `ORDER BY` can give a reliable total order.

**D1 — positions vs events-canonical replay** (per `(user_id, market_id, side)`):

- *Derivation A — cumulative signed-delta sum.* `replayed_qty = Σ bet.placed.shares − Σ bet.sold.sharesSold` over that `(user, market, side)`. Addition commutes ⇒ **order-independent**; no sort needed. `expected = replayed_qty`; `actual = positions.quantity`; drift ⇔ `actual ≠ expected`.
- *Derivation B — projection equivalence (ADR-0005 Pattern A).* `positions` is a Bucket-C **read model** of the Bucket-A `events` log (the source of truth); the deterministic fold `f(events)` over `{placed:+shares, sold:−sharesSold}` must equal the cached projection (`drift = cached − f(events)`). **Honest annotation (A3):** this is a *framing restatement* of A (same arithmetic, same number) — the read-model/source-of-truth lens, **not** an independent oracle. The genuinely independent check lives in the integration charter (§7): a **cpmm-sourced** case folds events whose `shares`/`sharesSold` are *actual* `calculateBuy`/`calculateSell` outputs and cross-asserts the cpmm solvency shape (**INV-C4:** Σ per-side positions == cpmm-derived holdings) against the same data — cpmm's math is the independent oracle, not D1's own algebra.
- *Worked example.* YES position, events: `placed(YES, 80)`, `placed(YES, 40)`, `sold(YES, 30)` ⇒ `expected = 80 + 40 − 30 = 90`. Clean: `positions.quantity = 90` → `ok`. Drift: stored `95` → `discrepancy = +5` (stored exceeds replay). Flip case reconciles **per side**: a YES→NO flipper has a YES row (`quantity 0`) and a NO row (`>0`); each side folds its own `placed/sold` events (events carry `side`).

**D2 — per-user dharma chain integrity** (`uncollectable` carved out — ENGINE.5 model A: `amount ≤ 0`, `balance_after = previous`). **Both derivations run nightly** and alarm independently; the `cron_alarms` payload names which fired (`derivation: 'D2-A' | 'D2-B'`) — a paper derivation bounds nothing at runtime, so A's aggregate cross-check only holds if A actually executes each night (A2).

- *Derivation A — SUM identity (order-free).* `latest_balance == Σ(amount) over balance-moving rows = Σ(all amount) − Σ(uncollectable amount)` (ENGINE.5 balance-derivation, ENGINE.5.md:122). The **`latest_balance`** is extracted order-free as the `balance_after` value whose multiplicity in `produced` exceeds its multiplicity in `implied_prev` by exactly one (`net = +1` — the unconsumed sink). **A fires** if **no unique `net=+1` sink exists** (0 or ≥2 candidates — itself a corruption signal) **or** `latest_balance ≠ Σ(non-uncollectable amount)`.
- *Derivation B — edge-link integrity + genesis cardinality (order-free; both implemented).* Reconstruct each row's `previousBalance`: `implied_prev = (entry_type='uncollectable' ? balance_after : balance_after − amount)`. **B fires** if **(i)** any row has `implied_prev ≠ 0 AND NOT EXISTS(another row d, d.id≠row.id, d.balance_after = implied_prev)` — a **broken link** — **OR (ii)** the user does **not** have **exactly one** genesis row (`count(implied_prev = 0) ≠ 1`). Clause **(ii) is the A1 fix:** without it a **duplicated** genesis (two `implied_prev = 0` rows) slips past clause (i), because `implied_prev ≠ 0` exempts both from the link check. B exploits the `previousBalance` chaining structure without any sort. (`d.id ≠ row.id` so a 0-amount `bet_payout` loss must find a *distinct* same-balance predecessor.)
- *Worked example (clean).* `initial_grant +1000`→1000, `bet_stake −10`→990, `bet_stake −50`→940, `bet_payout +25`→965, `uncollectable −20`→965. **A:** unique sink `965` (`net +1`); `Σ_non-unc = 1000−10−50+25 = 965 = latest` ✓. **B:** implied_prevs `{0, 1000, 990, 940, 965}` — exactly one `0` (genesis) ✓; every other links (`1000`→grant; `990`→r2; `940`→r3; `965(unc)`→r4) ✓.
- *Seeded drifts (BOTH fire each).* **(a) chain-break:** corrupt r3 `940→945` ⇒ B(i): `implied_prev = 945−(−50) = 995` absent from `{1000,990,945,965,965}` → fires; A: no clean `net=+1` / `Σ ≠ latest` → fires. **(b) duplicated-genesis:** add `initial_grant +500`→500 (`implied_prev = 0`) ⇒ B(ii): two `implied_prev = 0` rows → fires; A: two `net=+1` sinks (`965`, `500`) — no unique latest — and `Σ = 1465` matches no candidate → fires.
- *Precise guarantee + residual.* Post-A1, **B** guarantees every non-genesis row links to a real predecessor balance **and** exactly one genesis; **A** guarantees the aggregate `Σ = latest`. Both running nightly (A2), they are a strong **belt**, not a cryptographic proof — a corruption that re-maps balances so every link still resolves **and** preserves the aggregate sum could evade both. Deep verification is reconstructible from the public dataset (SPEC.1 §12.2); acceptable for a nightly tripwire on append-only data with the `balance_after ≥ 0` CHECK already in force.

**D3 — single-side belt (defense-in-depth; delegated call 1 = include).** `SELECT user_id, market_id FROM positions WHERE quantity > 0 GROUP BY 1,2 HAVING count(*) > 1`. Structurally impossible under `positions_one_held_side_idx` — fires only if the index is dropped/absent. One cheap query; an honest tripwire on R-5's own guarantee.

Each mismatch ⇒ `INSERT INTO cron_alarms (alarm_id, payload)` with `alarm_id ∈ {'position_drift','dharma_chain_drift','single_side_violation'}` and a `jsonb` payload (`user_id`, `market_id`/`side` where relevant, `expected`, `actual`, `discrepancy`; for `dharma_chain_drift` also `derivation: 'D2-A' | 'D2-B'` naming which check fired — A2). No `watermark_state` (delegated call 2).

### Migration mechanics

- **Migration A — constraints (drizzle-generated; PROBE-P1 at execute):** from a `bets.ts` `positions` edit — `CHECK (quantity >= 0)` (`positions_quantity_non_negative`) + the R-5 partial unique index. `<NNNN>_positions_constraints.sql`. Additive, reversible (drop constraint/index); no row rewrite (empty table).
- **Migration B — drift cron (hand-written raw SQL; mirrors `0007`):** `<NNNN+1>_position_drift_pg_cron.sql` — `CREATE OR REPLACE FUNCTION check_nightly_drift() RETURNS void` (D1, D2 [both derivations A + B run, each alarming], D3 — conditional `cron_alarms` INSERTs) + `SELECT cron.schedule('nightly-drift', '<cron-expr>', $$SELECT check_nightly_drift()$$)`. **Cadence = placeholder** (e.g. `0 3 * * *`); **final value HARDEN per ADR-0006 §7** (no number-pinning — RAILS). Reuses `cron_alarms` (0007); **no** `CREATE EXTENSION` (0007 owns it; B runs after). `<NNNN>` resolved by `ls drizzle/migrations/` at execute (head is `0009` now ⇒ `0010`/`0011`), **never hard-coded** (A6 discipline).
- **CI strip generalization (execute PR, ci.yml):** §Probe finding — generalize `ci.yml:95-98` to strip `SELECT cron.schedule(` from every `*pg_cron*.sql`, so Migration B applies on vanilla `postgres:17`.

---

## Charter map (tracker row → sections)

| Charter element | Section | Floor / contract |
|---|---|---|
| "Maintained atomically per bet" | `upsertPositionDelta` single-gate + R-1 1:1 event contract | runs inside W-1 (ADR-0013); binds E.7/8 |
| "unique user/market/side" (built) + single-side rule | R-5 partial unique index + predicates | structural single-side; SPEC.1 §7 preamble |
| "comment eligibility" | `read.ts` predicates → F-COMMENT-5 / F-BET-1/2/10 | no-stake-no-voice |
| "In/Flipped/Exited marker" | `computeMarker` (emergent) | F-DEBATE-2; R-4 (no snapshot) |
| "Nightly drift-detection vs ledger replay" | `check_nightly_drift()` D1/D2/D3 | R-1/R-2/R-6 |
| (implicit) oversell floor | `applyPositionDelta` + CHECK | R-3; **I-NO-OVERSELL-001** |

## 1. Thesis invariants touched

| Invariant | Touched? | How preserved | Test assertion |
|---|---|---|---|
| 2.1 Bet↔comment atomicity | **no** | no bet/comment writes; `upsertPositionDelta` runs inside the W-1 tx ENGINE.7 owns, never opens its own | n/a (E.7) |
| 2.2 Dharma non-transferable / no-overdraft | **adjacent** | D2 nightly-checks the dharma chain (read-only); no ledger writes here | `tests/integration/positions.integration.test.ts › drift-fn catches seeded dharma-chain break` |
| 2.3 Side frozen at comment-time | **YES (consumes)** | `computeMarker` **reads** `comments.side_at_post_time`, never writes it; the frozen badge is INV-3, the marker is the live overlay | `tests/unit/positions/compute.test.ts › marker truth table (frozen side unchanged)` |
| 2.4 Resolutions append-only | **no** | resolution (W-3) never writes positions (R-4 single-gate; positions absent from the W-3 lock order) | enforced structurally; covered by E.9 |

**Failure modes (critical-path; mandatory column):**
- **If `I-NO-OVERSELL-001` is missing/wrong:** a sell of more shares than held drives `positions.quantity` negative undetected → a user manufactures phantom shares / negative-position exploits at resolution payout, corrupting the K·n dataset. Guard = `applyPositionDelta` oversell throw **+** the storage `CHECK (quantity ≥ 0)` (ground truth) **+** the invariant spec asserting both.
- **If the D1 drift assertion is missing:** a W-1 handler bug (ENGINE.7/8) that updates `positions` without a paired `bet.placed/sold` event (or with a wrong `shareDelta`) ships silently — the Bucket-C cache diverges from the canonical log and **resolution settles against corrupted positions**. Guard = the nightly D1 replay + the seeded-drift integration test (both directions + clean pass).
- **If `I-SINGLE-SIDE-001` is missing:** a user holds **both** YES and NO simultaneously (the spec-rule the whole §7 single-side argument rests on), arguing both sides of a contested question — the thesis-level corruption SPEC.1 §7 preamble exists to prevent. Guard = the partial unique index (`23505`) + the invariant spec + D3 belt.

## 2. Data model changes

**Constraints-only (RAILS: no new columns).** On `positions` (`src/db/schema/bets.ts:71-99`): (1) `CHECK (quantity >= 0)` → `positions_quantity_non_negative`; (2) partial unique index `positions_one_held_side_idx (user_id, market_id) WHERE quantity > 0`. Drizzle-generated → `<NNNN>_positions_constraints.sql` (PROBE-P1; hand-SQL fallback). Plus the raw-SQL `<NNNN+1>_position_drift_pg_cron.sql` (function + schedule; reuses built `cron_alarms`/`watermark_state` from `0007`). No new table/column; no trigger change (`positions` stays Bucket C). Reversible (drop constraint/index/function; `cron.unschedule`).

## 3. API surface

**None external.** No Server Action, route handler, or HTTP endpoint. Deliverable = in-process `server-only` functions consumed by ENGINE.7/8 (W-1 handlers) and the debate view (DEBATE.*), plus one **async-flow A-1** job (pg_cron `nightly-drift`, SPEC.2 §3.4). No zod request schema; no auth/rate-limit class.

## 4. UI / user flow

**None — backend pure logic + persistence + an async cron.** (The debate-view rendering that *consumes* `computeMarker`/predicates is DEBATE.*, out of scope.)

## 5. Failure modes

- **Risk 1 — CI pg_cron strip is filename-hardcoded** (`ci.yml:78-98` → `0007` only). *Detect:* CI `drizzle-kit migrate` red on the new migration. *Recover:* execute PR generalizes the strip to `*pg_cron*.sql` (§Probe). Pre-empted, not discovered-at-CI.
- **Caller mutates `positions` outside `upsertPositionDelta`** (E.7/9 wiring slip). *Detect:* `@security-auditor` + nightly D1 drift + candidate CI lint. *Recover:* single-gate contract; D1 catches the divergence.
- **Caller skips per-user/per-market serialization** (write-skew on read-then-upsert). *Detect/recover:* the W-1 pool-row `FOR NO KEY UPDATE` lock (ADR-0013) already serializes per `(user,market)`; SERIALIZABLE SSI aborts (`40001`) → retry. Stated as the caller contract (E.7 owns the lock), not solved here.
- **Flip-order violation** (opposite-side buy while held side `>0`). *Detect:* partial unique index `23505` (mid-tx) + `PositionSingleSideError`. *Recover:* the tx aborts; no partial write (INV via SERIALIZABLE).
- **Drift function false-negative on D2** (balance re-map evades edge-link). *Detect:* the A-vs-B SUM cross-check + public-dataset re-derivation. *Recover:* accepted residual for a nightly belt (§D2 residual).

## 6. Edge cases

- **New `(user,market,side)`:** `previousQuantity = "0.000…0"` → first upsert inserts. Named test.
- **Sell exactly to zero:** `newQuantity = 0` → allowed (`≥ 0`), the held side becomes non-held (drops out of the partial unique index → opposite side may now go positive). Named test (drives the flip path).
- **Oversell by 1 ULP:** `newQuantity = −1e-18` → `PositionOversellError` + (forced raw) storage CHECK `23514`. Named test.
- **Marker `none` vs `Exited`:** held same side → `none`; sold-to-zero (`heldSide = null`) → `Exited`; prior comments persist (INV-3). Named test (truth table).
- **Empty-system drift run:** no positions, no bet events → `check_nightly_drift()` inserts **zero** `cron_alarms` (correct-when-empty; the cron is dormant-but-correct until ENGINE.7/8 produce events+positions). Named test.
- **Same-tx multi-mutation on one `(user,market,side)`:** caller passes `previousQuantity` to chain (the dharma A3 shape) — `now()`-tie safe. Named test (forward; v1 has no live caller).

## 7. Test plan (layers; CI-RED limitation)

| Layer | Path | Scenarios | Invariants |
|---|---|---|---|
| Unit (DB-free, **RED-locally**) | `tests/unit/positions/compute.test.ts` | `applyPositionDelta` exact add/sub; oversell → `PositionOversellError`; canonical pad; `computeMarker` full truth table (none/Flipped/Exited) | I-NO-OVERSELL (app half) |
| Integration (DB-backed, **CI-only**) | `tests/integration/positions.integration.test.ts` | upsert conflict path (`positions_user_market_side_idx`); `updated_at` bumps on update; CHECK fires (`23514`) on forced negative; partial-unique fires (`23505`) on a 2nd held side; **`check_nightly_drift()`**: D1 seeded drift both directions + clean pass **+ a cpmm-sourced case** (events folded from *actual* `calculateBuy`/`calculateSell` outputs, cross-asserting the INV-C4 solvency shape — A3); D2 **chain-break** (BOTH D2-A & D2-B fire) **+ duplicated-genesis** (BOTH fire — A1/A2); D3 double-held; empty-system no-alarm | D1/D2/D3 |
| Invariant (DB-backed, **CI-only**) | `tests/invariants/I-NO-OVERSELL-001.positions-quantity-non-negative.spec.ts` | app-guard across a buy/sell sequence (`quantity ≥ 0`) **+** storage CHECK rejects forced negative (`23514`, `positions_quantity_non_negative`) — the I-NO-OVERDRAFT-001 two-`it` shape | oversell floor |
| Invariant (DB-backed, **CI-only**) | `tests/invariants/I-SINGLE-SIDE-001.positions-one-held-side.spec.ts` | partial unique index rejects a 2nd `quantity>0` row per `(user,market)` (`23505`, `positions_one_held_side_idx`); read predicate asserts ≤1 | single-side rule |

- **CI-RED limitation (PROBE-P2):** DB-backed suites **cannot** RED locally (`ECONNREFUSED` is infra, not assertion-red); first true run is **CI on the PR**. Mitigation: CP-1 web line-review of the DB-backed files **+** the DB-free `compute.test.ts` twin (REDs locally, covers the pure oversell + marker logic). `@test-writer` writes all RED-first (§5.6); forbidden from `src/`.
- Naming per SPEC.2 §14.2: slug + seed `001` + canonical slug. (Note: oversell/single-side are SPEC **rules**, not the 4 hard invariants — `I-…` here = invariant-**class** integrity spec, the I-NO-OVERDRAFT-001 precedent for a non-INV-1..4 integrity property.)

## 8. Out of scope

- **ENGINE.7/8** — the W-1 bet/sell **handlers**, the pool-row lock + 40001 retry, idempotency, moderation, the floors (`BET_MIN_STAKE_*`), the **emit sites** for `bet.placed`/`bet.sold`. ENGINE.11 supplies the position module + the contract; 7/8 wire it.
- **ENGINE.9** — resolution/correction/void; explicitly, resolution **does not** write positions (R-4). The dharma D2 carve-out semantics are owned by ENGINE.5/9.
- **ENGINE.10 / HARDEN** — pool seeding ⇒ per-market conservation's `netAdminPoolInjection` (the reason it stays OUT of D2 — R-2); the final nightly cron **cadence** (ADR-0006 §7).
- **The `cron_alarms` drain-and-emit TS handler** — the loud carry-forward (HARDEN-adjacent; must land before staging soak). ENGINE.11 ships only the SQL INSERT side (R-6).
- **DEBATE.*** — the debate-view rendering that consumes `computeMarker`/predicates; F-DEBATE-1/3 render + freeze tests.
- **No number-pinning, no new columns, no new event types, no ranking** (RAILS).

---

## Execute ritual (full, no narrowing)

> **Hard STOPs:** no `positions` columns (constraints only); resolution never writes positions; no number-pinning (cadence/floors stay placeholder/HARDEN); the drift identities are D1/D2(+D3) exactly — never invent a term to reach green; per-market conservation stays OUT; no SPEC/tracker edits beyond the closed rider set.

1. **Sync + branch** (L-E4.2, single commands, ff-only, never reset): `git checkout main` → assert → `git fetch origin` → `git merge --ff-only origin/main` → assert HEAD == `9ea737b…` → `git checkout -b feat/engine-11-positions`.
2. **`@test-writer` RED** (Phase 2 start, §5.6): author the §7 suite. `compute.test.ts` REDs locally; DB-backed suites are CI-RED. Pass `@docs/plans/ENGINE.11.md`. **CP-1:** STOP — paste **all** test files (incl. DB-backed) to web for line review; web **re-derives D1/D2** (L-E5.1 — mismatch = redraft) and confirms the marker truth table + oversell two-`it` shape.
3. **PROBE-P1** (writes files → execute): edit `bets.ts` (`positions` CHECK + partial unique); `just db-generate positions_constraints`; confirm `ADD CONSTRAINT … CHECK` + `CREATE UNIQUE INDEX … WHERE quantity > 0`; else hand-write. Then hand-write Migration B (`check_nightly_drift()` + `cron.schedule`). **Generalize `ci.yml` pg_cron strip** to `*pg_cron*.sql`.
4. **Implement to green** (main session): `errors.ts` → `compute.ts` → `read.ts` → `persist.ts`. `import "server-only"` all. **CP-2:** STOP — paste all `src/` + both migrations + the ci.yml diff for web line review before verify+cascade.
5. **Green + verify** (L-E3.5 exact forms): `pnpm vitest run tests/unit/positions/` (local, green); `ZUGZWANG_ENV=preview just verify`. DB-backed suites run in **CI**.
6. **Riders** (closed set, §Riders): the two migrations + ci.yml strip + the ratified SPEC.1/CLAUDE.md/AGENTS.md riders — all in the execute PR.
7. **Review cascade** (§5.11): `@code-reviewer` → **full-scope `@security-auditor`** (oversell + single-side + drift-fn exploitability + the events-replay correctness) → `@db-migration-reviewer` (constraints + pg_cron migration + CI strip). Pass `@docs/plans/ENGINE.11.md` to each.
8. **§5.10 pre-PR audit (PASS/FAIL/SURPRISE):** CHECK + partial-unique shape (grep); each accepted/rejected path → a green test; D1/D2/D3 functions present + seeded-drift tests both directions; ci.yml strip covers the new migration; single-gate (no stray `positions` writer, grep); diff-stat = closed set; no column adds / no number pins (grep-proven).
9. **PR** (docs/plan PR is separate — this ritual is the **execute** PR) → founder squash-merge → post-merge sync (ff-only) → `git branch -D feat/engine-11-positions`.

**Operator manual drift snippet (ship in the migration header + log):**
```sql
-- Manual nightly-drift check (until the SCAFFOLD.5 cron_alarms drain-and-emit lands):
SELECT alarm_id, payload, emitted_at
FROM cron_alarms
WHERE alarm_id IN ('position_drift','dharma_chain_drift','single_side_violation')
  AND processed_at IS NULL
ORDER BY emitted_at DESC;
```

**Closed execute diff-stat (expected):** `src/server/positions/{errors,compute,read,persist}.ts` · `src/db/schema/bets.ts` (constraints) · `drizzle/migrations/<NNNN>_positions_constraints.sql` · `drizzle/migrations/<NNNN+1>_position_drift_pg_cron.sql` · `.github/workflows/ci.yml` (strip generalization) · `tests/unit/positions/compute.test.ts` · `tests/integration/positions.integration.test.ts` · `tests/invariants/I-NO-OVERSELL-001.*.spec.ts` · `tests/invariants/I-SINGLE-SIDE-001.*.spec.ts` · the doc riders (below) · `docs/logs/ENGINE.11.md` (separate log commit). **Zero** new columns, event types, handlers, or number pins.

Commits authored **`Zugzwang/world <zugzwangworld@proton.me>`**; **no `Co-authored-by` trailer** (AGENTS.md §10). Multi-line via `/tmp/engine-11-msg.txt` (`rm -f` first; a unique tmpfile to avoid cross-session `/tmp` collisions). Tail/grep Write-authored files for stray delimiter tokens before commit.

## Riders (CLOSED set — execute PR)

- **AGENTS.md §6** — "Current head: `0008_comments_bet_id_idx.sql`" → the new head after Migration B (and note `0009_dharma_initial_grant_enum.sql` already advanced it; **this is a drift fix**, recon SURPRISE-5).
- **SPEC.1 §7-preamble** (`:272`) — wording rider (R-5): name the **partial unique index** `(user_id, market_id) WHERE quantity > 0` as the structural enforcer (the prose's "`(user_id, market_id)` position constraint" currently has no matching built constraint).
- **SPEC.1 F-DEBATE-3** (`:438-442`) — wording rider (R-4): resolve "stored at resolution-event-time … or computed once and cached — schema decides" → **emergent** (computed on read; no snapshot; frozen-by-construction because positions are immutable post-close).
- **CLAUDE.md §1** — move `src/server/positions/` from greenfield to **Built, sensitive** at merge (dharma/cpmm precedent).

**OUT-OF-SET — do NOT absorb (parked):** AGENTS.md `EVENT_TYPES` "11 values" → 21 (recon SURPRISE-6; not ENGINE.11's surface — park). SPEC.2 §7.5 "W-3 writes bets"-class phrasing → **ENGINE.9's** amendment list (resolution stratum owns it).

## Carry-forwards minted by this plan

1. **`cron_alarms` drain-and-emit TS handler** (Sentry) → **HARDEN/SCAFFOLD.5** (loud; before staging soak).
2. **Final `nightly-drift` cadence** → **HARDEN** (ADR-0006 §7 number-tuning).
3. **The R-1 1:1 (position mutation ↔ bet.placed/sold) event contract** → honored by **ENGINE.7/8**; drift cron is the enforcement.
4. **Candidate CI lint** "no `positions` writer outside `persist.ts`" → noted-not-built; HARDEN.
5. **Same-tx atomic flip** (`previousQuantity`-chained) — forward path; no v1 caller (E.7+).

## ADRs needed

**None mandatory.** Constraints are R-3/R-5-ratified schema amendments (ride the PR, §5.12). The drift-cron pattern reuses ADR-0006/0007's ratified pg_cron + `cron_alarms` substrate; R-1/R-2/R-4/R-6 are founder-ruled and codified by the SPEC riders above, not a new ADR. (If a shared `dharmaTransaction()`/`betTransaction()` wrapper later standardizes per-user/per-market serialization, that is an **ENGINE.7** ADR.)

## Open questions — RESOLVED (founder-ruled)

- **R-1 replay substrate = events-canonical.** RESOLVED. D1 vs `bet.placed/sold`; 1:1 event contract minted (E.7/8).
- **R-2 two identities (D1 + D2), conservation OUT, D3 optional.** RESOLVED; D3 **included** (delegated call 1).
- **R-3 floor = app + storage CHECK.** RESOLVED; `I-NO-OVERSELL-001` minted.
- **R-4 marker = emergent.** RESOLVED; F-DEBATE-3 rider; freeze-by-construction argued.
- **R-5 single-side = structural partial unique index.** RESOLVED; flip-order contract minted (E.7); §7 rider.
- **R-6 alerting = SQL only; watermark gating optional.** RESOLVED; gating **omitted** (delegated call 2); TS drain carry-forward.

No residual open questions at plan time.

## Self-critique (plan self-review, 2026-06-07)

| # | Severity | Finding | Resolution |
|---|---|---|---|
| 1 | **high** | The **emergent marker** (R-4) is only correct if `positions` are immutable post-close. If any future path (a mis-wired E.9, an admin tool) writes positions after a market leaves `Open`, every frozen marker silently drifts. | Surfaced as the load-bearing dependency: guarded by the **single-gate** contract (every write via `upsertPositionDelta`) **+** W-3's lock order excluding positions (SPEC.2 §3.2:235) **+** the candidate CI lint + the nightly D1 drift. Made explicit in §Single-gate + §1 row 2.4 + the F-DEBATE-3 rider. |
| 2 | **high** | **CI would go red** on Migration B — the pg_cron strip is hardcoded to `0007` (`ci.yml:78-98`). Easy to miss; turns the execute PR red at the migrate step. | Caught at plan time (PROBE finding); execute PR generalizes the strip to `*pg_cron*.sql` (named in §Probe, §5 Risk 1, §Execute step 3, diff-stat). Not a discover-at-CI surprise. |
| 3 | medium | The drift cron is **dormant** at ENGINE.11 merge — no `bet.placed/sold` events or position writers exist until E.7/8. Tests must seed synthetic events+positions. | Accepted: the function is correct-when-empty (named test); integration tests seed both-direction drift. The R-1 contract binds E.7/8 to produce the data the cron then guards. |
| 4 | medium | **D2** is a belt, not a proof — a balance re-map that keeps every link valid **and** preserves the aggregate sum could evade both derivations. | Accepted + documented (§D2 residual): **both D2-A (SUM) and D2-B (edge-link + genesis cardinality) run nightly** (A2), so the aggregate bound is enforced at runtime, not on paper; deep verification is dataset-reconstructible; append-only + `balance_after ≥ 0` CHECK already hold. |
| 5 | low | Oversell / single-side are SPEC **rules**, not the 4 hard invariants — calling the specs `I-…` could imply INV-status. | Framed as invariant-**class** integrity specs (the I-NO-OVERDRAFT-001 precedent for a non-INV property); noted in §7. |
| 6 | low | `getHeldPosition`'s "assert ≤1" is redundant with the partial unique index. | Kept as **defense-in-depth** (R-5's own directive); mirrors D3 and the project's app-mirrors-storage doctrine. |

Checked: R-1..R-6 fold + both delegated calls argued; D1/D2 two-derivations + worked examples (independently cross-checked, both catch seeded drift); order-freeness vs ADR-0016 Driver 7; emergent-freeze vs W-3 lock order + §8 market-open window; constraints-only (no columns); CI pg_cron strip; single-gate; scope discipline (no E.7/8/9 absorption); closed rider set + parked out-of-set; tracker "In" drift surfaced.

## References

- SPEC.1 §7 (`:266-350`, single-side `:272`, F-BET-1/2/3/10), §8 (`:354-404`, F-COMMENT-1/2/3/5), §9 (`:408-449`, F-DEBATE-2 `:427-436`, F-DEBATE-3 `:438-442`, markers `:418`), §11 (`:537-564`), §12.2 (`:578-588`).
- SPEC.2 §3.2 (W-1 `:225`, W-3 lock order `:235`), §3.4 (async A-1), §3.7 (events-row), §5.1 (`positions` row 20 `:498`), §5.2 (Bucket C `:510`).
- cpmm.md §4.4 (buy outputs `s` `:188-193`), §5.1/§5.4 (sell `M`; "position sufficiency enforced against positions inside W-1" `:243-247`).
- ADR-0005 (Pattern A, Bucket A/B/C — D1 substrate), ADR-0006 §7 (cron inventory; cadence→HARDEN), ADR-0013 (W-1 lock order: `pools → positions → …`; SERIALIZABLE + retry), ADR-0016 (Driver 7 / §Negative `:200` — no cross-backend UUID order ⇒ order-free derivations), ADR-0018 (issuance context).
- Built: `src/db/schema/bets.ts:71-121` (`positions`), `src/server/dharma/{persist.ts:54,canonical.ts:25,ledger.ts:41}`, `src/server/events/schemas.ts` (`bet.placed`/`bet.sold` `:204-223`), `drizzle/migrations/0007_pg_cron_jobs.sql` (cron_alarms/watermark_state + pattern), `.github/workflows/ci.yml:78-98` (pg_cron strip), `tests/invariants/I-NO-OVERDRAFT-001.dharma-ledger-monotone.spec.ts` (two-`it` mirror).
- CLAUDE.md §1/§2/§3/§5.6/§5.10/§5.11/§5.12/§5.13; AGENTS.md §6/§9/§10; `docs/plans/ENGINE.5.md` (form + quality bar), `docs/plans/ENGINE.4.md` (`transition()` single-gate), `docs/plans/_template.md`; `docs/workflows/plan-then-execute.md`.
- Evidence: `/tmp/engine-11-recon/ENGINE_11-preflight-recon.md` (recon; **md5 mismatch noted** — the /tmp copy was clobbered between turns, original plan-file copy was intact; recon facts independently re-verified by fresh repo reads this session).

---

*Plan drafted 2026-06-07 — founder-ruled R-1..R-6; delegated calls D3=include / watermark-gating=omit argued. Ratification = plan-PR merge on `docs/engine-11-plan`. Execute happens in a fresh session on `feat/engine-11-positions` (full ritual, CP-1/CP-2 web gates, no post-PR soak).*
