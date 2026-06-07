# ENGINE.5 — Dharma append-only ledger logic (`src/server/dharma/`)

> **Status:** reviewed — founder-ratified R-1/R-2/R-3 (2026-06-07); web amendments A1–A8 folded; web directives D-1 (simplified)/D-2/D-3/D-4; PROBE-1/PROBE-3 folded, PROBE-2 re-sequenced to execute. Ratification = plan-PR merge.
> **Date:** 2026-06-07
> **Author:** Hrishikesh + Claude Code (plan tab)
> **Critical-path?** **YES.** `src/server/dharma/` is a CLAUDE.md §1 greenfield critical path; INV-2 (soulbound + no-overdraft) is thesis-load-bearing; Dharma-accounting money math (§5.6). ⇒ **FULL ritual, no narrowing:** `@test-writer` RED → implement → `@code-reviewer` → **full-scope** `@security-auditor` → `@db-migration-reviewer` (enum migration) → §5.10 audit. No post-PR soak (CLAUDE.md §5.10 supersedes `plan-then-execute.md`'s 24h).
> **Plan PR / commit:** this file rides **`docs/engine-5-plan`** (docs-only; ENGINE.3/4 convention), committed before Phase 2. The **execute** branch is `feat/engine-5-dharma-ledger`, created only at execute step 1. Phase 2 references this file via `@docs/plans/ENGINE.5.md`.

---

## Tracker context

**Tracker row is external** (operator HTML in web-Claude knowledge; memory `project_tracker_external`) — not in-repo, so scope is reconstructed from in-repo forward-refs; the founder pastes the verbatim ENGINE.5 row at review if exact wording binds.

Reconstructed scope, from forward-refs:
- ADR-0008:104 / ADR-0016:29 — "Decimal-arithmetic library for Dharma balances → … **ENGINE.5**."
- cpmm.md §10.1:465 / §13:639 — decimal pin + `CpmmDecimal` "exported for **ENGINE.5** reuse"; "binds ENGINE.2 + ENGINE.5."
- ADR-0018:36,119 — "issuance ledger mechanics — how grants/credits are written … the engine work in `src/server/dharma` (absent, **forward**)."
- CLAUDE.md §1 — `dharma/` greenfield critical-path.

**Dependency status at plan time:** **ENGINE.0 done** (`numericString` + event vocabulary, `src/server/events/schemas.ts`). **ENGINE.1/2/3 merged** (`CpmmDecimal` + quantizers, `src/server/cpmm/decimal.ts`). **ENGINE.4 merged** (`671c484`; the `.enumValues`-derived-union idiom this module reuses). Built `dharma_ledger` schema + Bucket-A triggers are the storage substrate.

---

## Approach (one paragraph)

Build `src/server/dharma/` as a **pure core + thin persistence layer** mirroring the `cpmm/` idiom (`server-only`, named exports, module-local error sentinels). The pure core **canonicalizes** every decimal-string quantity (reuse `numericString` verbatim → `CpmmDecimal(s).toFixed(18)`), computes `balance_after = previous_balance + amount` as an **exact 18-dp add/sub** (no rounding — cpmm.md §10.3 "exact add/sub" pattern), enforces the **no-overdraft** floor (`balance_after ≥ 0` → typed error, the application mirror of the storage CHECK), and applies the **tag policy** (8 user-side tags accepted; `pool_seed`/`pool_unwind` rejected with a typed error — R-2). A thin persistence helper takes the **caller's `tx` handle**, reads the user's latest `balance_after` inside that tx (or accepts a chained `previousBalance`), calls the core, and INSERTs — with a documented caller contract that **per-user write serialization is the caller's obligation** (grant/daily/resolution writes sit outside the ADR-0013 pool lock; D-2). The module also **mints the per-market conservation checker** (cross-table flow identity over the 5 bet-tied flow tags vs the market's net admin↔pool injection — R-2/A1/A2) and the `I-NO-OVERDRAFT-001` integration seed at the layers testable now (D-3). The only schema work is the **R-1 enum amendment** (`initial_grant`, the 10th value) shipped as a drizzle-generated `ALTER TYPE … ADD VALUE` migration, riding the execute PR with a closed, pre-listed rider set (R-3). **Value-agnostic** throughout (D-4): every amount is a caller input; no issuance constants live in the module.

---

## Folded rulings & directives (index)

- **R-1** — 10th enum value `initial_grant`; migration+schema edit enters ENGINE.5 scope. Grant row: `user_id`=recipient, `bet_id`=NULL, `amount`=+grant (value-agnostic), `balance_after`=amount (every user's first ledger row).
- **R-2** — `dharma_ledger` stays user-only. `pool_seed`/`pool_unwind` stay in the enum, **DORMANT** in v1: helper accepts the 8 user-side tags, **rejects the 2 pool tags with a typed error**. Admin↔pool flows = `events` rows (`metadata.user_id`=NULL, `actor_id`='admin-singleton') + `pools` reserve deltas — **no ledger row**. Per-market conservation = cross-table identity; ENGINE.5 mints checker + test.
- **R-3** — migration + SPEC.1/SPEC.2 riders ride the execute PR as a closed pre-listed set; plan carries candidate rider wording (full enumerative sweep, L-E4.1); founder ratifies wording at review; final text web-authored A-series.
- **D-1 (simplified, PROBE-1)** — `canonicalize = numericString gate → CpmmDecimal(s).toFixed(18)`; the explicit −0 step-4 branch is **dropped** (toFixed(18) already normalizes at decimal.js 10.6.0); vendor contract pinned by `_probe-decimal-negzero`.
- **D-2** — pure core + thin persistence on the caller's tx handle; caller owns SERIALIZABLE + per-user serialization (grant/daily/resolution writes sit outside the ADR-0013 pool lock); inherit cpmm no-sub-ULP/near-ceiling note at the seam.
- **D-3** — `I-NO-OVERDRAFT-001` minted here at testable layers; concurrent-bet composition at ENGINE.7. Test split pinned by PROBE-3.
- **D-4** — value-agnostic; no issuance constants in the module.
- **A1** — conservation (★) **excludes `uncollectable`** (re-derived below). **A2** — (★) RHS = net admin↔pool injection. **A3** — `appendLedgerRow` gains optional `previousBalance` (resolves OQ-2). **A4** — OQ-1/3/4 ruling records (below). **A5** — commit identity citation. **A6** — migration filename = next sequential at execute. **A7** — self-critique #1 L-E4.1 annotation. **A8** — checker throws on tag-contract violations; `ok:false` only on numeric mismatch.

---

## Probe results

**PROBE-1 (decimal.js −0 / canonicalization — read-only, 2026-06-07):**

```
decimal.js version: 10.6.0
new C("-0").toFixed(18)  = "0.000000000000000000"
new C("-0").toString()   = "0"
new C("-0").isZero()     = true
new C("0.0").toFixed(18) = "0.000000000000000000"
new C("007").toFixed(18) = "7.000000000000000000"
```

`C = Decimal.clone({ precision: 50, rounding: ROUND_HALF_EVEN })` (the cpmm config). Conclusion: `toFixed(18)` is the full canonicalizer — it normalizes `-0`/`0.0` to unsigned zero and collapses leading zeros. The explicit `isZero()→"0.000…0"` step-4 branch is a **no-op at 10.6.0** and is **dropped** (D-1 ratified; L-E3.5 record — the branch was considered and removed on this evidence). The vendor behavior is pinned by `tests/unit/dharma/_probe-decimal-negzero.test.ts`; a future decimal.js bump that regresses `-0` handling goes red.

**PROBE-3 (local Postgres on :54322 — read-only, 2026-06-07):**

```
pg_isready -h localhost -p 54322  →  localhost:54322 - no response   (rc=2)
raw TCP probe :54322              →  port 54322 CLOSED/unreachable
pg_isready binary                 →  /opt/homebrew/bin/pg_isready (installed)
```

Local Postgres is **down**. Pinned test split (memory `project_whole_suite_needs_local_postgres`; L-E3.5; same posture as ENGINE.4): the pure `tests/unit/dharma/` suite + `ZUGZWANG_ENV=preview just verify` run locally; the DB-backed suites are **CI-gated** (Postgres-17 service). See §7 + the RED-limitation line.

**PROBE-2 (drizzle-kit enum-append generation) — RE-SEQUENCED to execute step 3.** Generation writes files, so it cannot run in the plan phase. Safe to defer: the hand-written `ALTER TYPE … ADD VALUE` fallback + the `@db-migration-reviewer` gate are already in-plan. The verification (drizzle-kit emits `ADD VALUE`, not a type drop/recreate) happens at execute against the generated migration.

---

## Module & design

### File layout (`src/server/dharma/`, greenfield — mirrors `cpmm/`)

| File | Subject |
|---|---|
| `canonical.ts` | `canonicalize(value)` — `numericString` gate → `CpmmDecimal(value).toFixed(18)`. The single string-form authority. |
| `tags.ts` | `DharmaEntryType` (derived from `dharmaEntryTypeEnum.enumValues`), `LEDGER_WRITABLE_TAGS` (8), `POOL_DORMANT_TAGS` (`pool_seed`,`pool_unwind`), `FLOW_TAGS` (the 5 conservation tags). |
| `ledger.ts` | pure core: `computeLedgerRow({previousBalance, amount, entryType})` → `{amount, balanceAfter}`; overdraft + tag-policy + `uncollectable` special-case. |
| `conservation.ts` | `checkMarketConservation(...)` — the R-2 cross-table flow identity (pure). |
| `persist.ts` | `appendLedgerRow(tx, {...})` — thin persistence on the caller's tx handle. |
| `errors.ts` | module-local sentinels: `DharmaInputError`, `DharmaOverdraftError`, `DharmaPoolTagError` (mirror `cpmm/errors.ts`). |

`import "server-only"` in every file; no Manifold header (original module). No barrel (cpmm has none; consumers import from `@/server/dharma/<file>`).

### Tag policy table (8 accepted / 2 rejected — R-2; incl. Note-4)

`DharmaEntryType` derived from the built pgEnum (ENGINE.4 `.enumValues` precedent), **after R-1** the 10-set:

| Tag | Helper | `bet_id` | `amount` sign | Notes |
|---|---|---|---|---|
| `initial_grant` | **accept** | NULL | + | R-1; first row, `balance_after = amount` (prev=0) |
| `daily_allowance` | **accept** | NULL | + | Daily Credit; cursor `users.last_allowance_accrued_at`; emission policy = ENGINE.12 |
| `bet_stake` | **accept** | bet.id | − (buy) / **+ (sell)** | **Note-4**: sells reuse `bet_stake`, **sign-distinguished** (no `bet_unwind` value built; SPEC.1 §7:297 "schema decides" → built enum decides) |
| `bet_payout` | **accept** | bet.id | + (win) / 0 (loss) | resolution settlement; **also** a `payout_events` row (ENGINE.9, dual-write) |
| `void_refund` | **accept** | bet.id | + | stake reversal on void |
| `correction_reverse` | **accept** | bet.id | − | floored at zero; remainder → `uncollectable` |
| `correction_apply` | **accept** | bet.id | + | corrected payout |
| `uncollectable` | **accept** | bet.id | − (forgiven remainder) | **special case** (OQ-1 model A) — `balance_after` = prev (unchanged) |
| `pool_seed` | **REJECT** (`DharmaPoolTagError`) | — | — | R-2 dormant; admin↔pool = events + pool reserves |
| `pool_unwind` | **REJECT** (`DharmaPoolTagError`) | — | — | R-2 dormant |

### Canonicalization spec (D-1 simplified) + PROBE-1 record

```
canonicalize(value: string): string
  1. numericString.safeParse(value)   — reuse VERBATIM from @/server/events/schemas; fail → DharmaInputError
  2. return new CpmmDecimal(value).toFixed(18)   — exact/pad-only (input ≤18 frac digits ⇒ no rounding);
                                                   already normalizes -0 / 0.0 / leading zeros (PROBE-1)
```
- **Why canonicalize:** `numericString` admits `-0`, `0`, `0.0`, `007`, `00.5` (distinct strings, one value). Stored `amount`/`balance_after`, equality, and any idempotency key **use canonical form only**.
- **PROBE-1 record (L-E3.5):** an explicit `isZero()→"0.000…0"` step-4 branch was drafted (web D-1), then **dropped** — PROBE-1 proved `CpmmDecimal(s).toFixed(18)` already emits canonical unsigned zero. The contract is pinned by `_probe-decimal-negzero` (decimal.js literal 10.6.0).

### Balance derivation (P-5 reconciliation) + CHECK as INV-2 storage floor

Two spec texts on "current balance" reconcile once `uncollectable` is pinned (OQ-1 model A):
- **Canonical balance = latest `balance_after`** (running total) — source of truth.
- 7 balance-moving tags: `balance_after = previous_balance + amount` (exact 18-dp add/sub) — ENGINE.5's application-layer running-total guarantee.
- **`uncollectable` exception**: `amount` ≤ 0 (forgiven remainder) but `balance_after = previous_balance` (**unchanged** — user at floor; Dharma is gone). The single row where `amount ≠ balance_after − prev`.
- ⇒ `latest balance_after = SUM(amount over balance-moving rows) = SUM(all amount) − SUM(uncollectable amount)`. SPEC.2 §14.1's `SUM`-form equals the balance **only excluding `uncollectable`** — a SPEC.2 rider (appendix).
- **CHECK `balance_after ≥ 0`** (`0001:157`, the lone storage CHECK) is the **per-row INV-2 storage floor**; `DharmaOverdraftError` is its advisory mirror (§14.1 mech iii→iv).

### Per-market conservation identity (★) — A1/A2/A8

**Independent re-derivation (A1 bidirectional check, 2026-06-07).** Worked example: seed 100; `bet_stake` −10; wrong `bet_payout` +25; `correction_reverse` −5 (floored, balance→0); `uncollectable` −20 (balance unchanged); `correction_apply` +15; physical unwind 75.

*Pool reservoir double-entry (nets to 0):* IN = seed 100 + stake 10 + collected reverse 5 = **115**; OUT = wrong payout 25 + corrected apply 15 + unwind 75 = **115** → balanced. `uncollectable` is **not** a pool flow — the 20 never returned; it is already embedded in the un-reversed portion of the wrong +25 payout.

*Identity:* Σ(balance-moving) = (−10)+(+25)+(−5)+(+15) = **25** = Seed − Unwind = 100 − 75 = **25** ✓. Including `uncollectable`: 25 + (−20) = **5 ≠ 25** ✗ — confirms exclusion (including it double-counts the gap already carried by the wrong payout). My earlier draft included `uncollectable` and was wrong; corrected below.

> **(★)  Σ amount over {`bet_stake`, `bet_payout`, `void_refund`, `correction_reverse`, `correction_apply`} (M's bet-tied rows)  =  NetAdminPoolInjection(M)**
> where **NetAdminPoolInjection(M)** = Seed(M) − Unwind(M) in v1 (legs: seed in, unwind out); RHS framed as *net admin↔pool injection* so future correction **top-up legs** add terms without breaking the identity (A2). **`uncollectable` is EXCLUDED** — an audit/forgiveness record (`amount` ≤ 0, `balance_after` = prev), outside the flow identity.

**Secondary identity → ENGINE.9 carry-forward** (verified: `Σ(correction_reverse)` + `Σ(uncollectable)` = −5 + −20 = −25 = −Σ(reversed payouts) = −(+25) ✓): the reverse+uncollectable pair fully accounts for unwinding a wrong payout — correction-path mechanics, **owned by ENGINE.9**, out of ENGINE.5's flow checker.

**`uncollectable`'s place:** **excluded** from (★); it is the forgiveness/audit record, not a flow term.

### Exported API signatures

```ts
// canonical.ts
export function canonicalize(value: string): string;

// tags.ts
export type DharmaEntryType = (typeof dharmaEntryTypeEnum.enumValues)[number]; // from @/db/schema/dharma
export const LEDGER_WRITABLE_TAGS: readonly DharmaEntryType[];                  // 8 user-side
export const POOL_DORMANT_TAGS = ["pool_seed", "pool_unwind"] as const;
export const FLOW_TAGS: readonly DharmaEntryType[];                             // the 5 conservation tags

// ledger.ts — pure core (no IO, no clock)
export type LedgerComputation = { amount: string; balanceAfter: string };      // canonical 18-dp
export function computeLedgerRow(args: {
  previousBalance: string;            // canonical; "0.000…0" for a user's first row
  amount: string;                     // signed; canonicalized internally
  entryType: DharmaEntryType;
}): LedgerComputation;
// throws DharmaPoolTagError (pool tag), DharmaInputError (bad string),
// DharmaOverdraftError (balanceAfter < 0 for a balance-moving tag);
// uncollectable ⇒ balanceAfter = previousBalance (OQ-1 model A).

// conservation.ts — pure (A1/A2/A8)
export type ConservationResult =
  | { ok: true }
  | { ok: false; expected: string; actual: string; discrepancy: string };      // pure mismatch report, no reason field
export function checkMarketConservation(args: {
  ledgerFlows: readonly { amount: string; entryType: DharmaEntryType }[];       // M's bet-tied rows
  netAdminPoolInjection: string;      // A2: v1 = canonicalize(seed − unwind); generalizes to + top-up legs
}): ConservationResult;
// actual = Σ amount WHERE entryType ∈ FLOW_TAGS (the 5);  uncollectable present-but-IGNORED;
// pool_seed/pool_unwind in input → throw DharmaPoolTagError (A8, same sentinel as write path);
// initial_grant/daily_allowance in input → throw DharmaInputError (bet_id-NULL rows the gathering query MUST exclude);
// ok ⇔ exact canonical-decimal equality(actual, netAdminPoolInjection).

// persist.ts — thin persistence, caller's tx (A3)
export function appendLedgerRow(
  tx: DbTransaction,                   // @/db DbTransaction — NOT top-level db (events/insert.ts V3 precedent)
  args: {
    userId: string; amount: string; entryType: DharmaEntryType; betId?: string | null;
    previousBalance?: string;          // optional: when supplied, SKIPS the in-tx latest-balance read.
                                       // REQUIRED for >1 row for the same user in one tx — caller MUST chain
                                       // via the prior call's returned balanceAfter (now() is tx-frozen ⇒
                                       // created_at ties; live case: ENGINE.9 reverse+uncollectable pair).
  },
): Promise<{ id: string; balanceAfter: string }>;
// Single append (previousBalance omitted): reads latest via
//   SELECT balance_after … WHERE user_id=$1 ORDER BY created_at DESC, id DESC LIMIT 1   (→ "0…0" if none).
// id PK via DB DEFAULT uuidv7() (ADR-0016 — no app-side id).
```

### Caller-contract section (D-2)

- **`appendLedgerRow` takes a bound `tx` handle** (mirrors `insertEvent(tx, …)` V3, `events/insert.ts:95`). Compile-error to pass top-level `db`.
- **Per-user write serialization is the CALLER's obligation.** Read-latest-then-insert is a write-skew shape: two concurrent appends for one user both reading row N and inserting N+1 is a serialization anomaly. Under **SERIALIZABLE**, Postgres SSI detects the predicate rw-conflict and aborts one (`40001`) → the caller **retries** (ADR-0013 full-jitter ladder). Bet writes additionally hold the pool `FOR NO KEY UPDATE` lock (per-market). **Grant / daily-credit / resolution writes sit OUTSIDE the ADR-0013 pool lock** — their callers (auth/onboarding, ENGINE.12, ENGINE.9) supply equivalent per-user serialization. **OQ-3 pinned default: SERIALIZABLE + ADR-0013 full-jitter retry; `pg_advisory_xact_lock(user_id)` is the fallback only; ownership ENGINE.7/9/12.**
- **Residual theoretical risk (A3):** cross-tx BEGIN-vs-commit timestamp inversion (`now()` = tx-start; a later-committing tx can carry an earlier `created_at`) — foreclosed by the caller's per-user serialization and **detected by ENGINE.11 nightly ledger-replay drift detection**.
- **No-sub-ULP / near-ceiling note inherited at the seam** (cpmm.md §10.2:480-482, §10.5): balances stay well inside NUMERIC(38,18) (≤20 integer digits); over-issuance is bounded (~1,510 Dharma/user max — ADR-0018:84-85), nowhere near 10²⁰. ENGINE.5 reads no clock, env, or randomness (cpmm.md §13:646 parity).

### Migration mechanics (R-1) + filename (A6) + PROBE-2 re-sequence

- Edit the `dharmaEntryTypeEnum` array in `src/db/schema/dharma.ts:18-28` to append `"initial_grant"` (10th), then `just db-generate dharma_initial_grant_enum` → expected `<NNNN>_dharma_initial_grant_enum.sql` containing `ALTER TYPE "public"."dharma_entry_type" ADD VALUE 'initial_grant';`.
- **`<NNNN>` = the next sequential number at execute time (A6)** — head is currently `0008` (⇒ `0009` at this writing) but resolved by `ls drizzle/migrations/` at execute, **never hard-coded**.
- **PG17:** `ALTER TYPE … ADD VALUE` is **additive, non-destructive** (no row rewrite; Bucket-A triggers irrelevant). PG12+ permits it in a tx block; the new value can't be *used* in the adding tx — fine (grants written by later txns). Effectively **irreversible** (PG can't drop an enum value without a type recreate) — acceptable as additive; down-migration is a no-op/comment.
- **PROBE-2 at execute step 3:** confirm drizzle-kit emits `ADD VALUE` (append at end; enum order is set-semantic, not load-bearing), **not** a type drop/recreate. If it mis-generates, hand-write the raw `ALTER TYPE` migration (AGENTS.md §6 mixed-origin set). `@db-migration-reviewer` gates it.

---

## Charter map (tracker row → sections)

| Charter element | Section | Invariant / floor |
|---|---|---|
| Append-only Dharma ledger logic | core `ledger.ts` + `persist.ts` | INV-2; Bucket-A append-only (built triggers, no module change) |
| No overdraft | `computeLedgerRow` overdraft branch | **CHECK `balance_after ≥ 0` = INV-2 storage floor**; `DharmaOverdraftError` advisory mirror |
| Non-transferable | tag policy (8 accept / 2 reject); no transfer surface | INV-2; CLAUDE.md §3 refusal (no `dharma_transfer`) |
| Balance derivation | "Balance derivation" subsection | **P-5 reconciliation** — latest `balance_after` canonical; `uncollectable` excluded from SUM-form |
| `initial_grant` (R-1) | enum migration + grant-row test | first-row shape |
| Conservation (R-2/A1/A2) | `conservation.ts` + (★) | cross-table flow identity; `uncollectable` excluded |
| Decimal authority (binds ENGINE.5) | `canonicalize` reusing `CpmmDecimal` | cpmm.md §10 pin; exact 18-dp add/sub |

## 1. Thesis invariants touched

| Invariant | Touched? | How preserved | Test assertion |
|---|---|---|---|
| 2.1 Bet↔comment atomicity | **no** | no bet/comment writes (ledger insert only; the atomic bet+comment tx is ENGINE.7) | n/a |
| 2.2 Dharma non-transferable / no-overdraft | **YES** | (i) no transfer surface (CLAUDE.md §3); (ii) tag policy rejects pool tags + admits only the 8 user-side tags; (iii) `balance_after ≥ 0` core check mirrored by the storage CHECK; (iv) Bucket-A append-only (built triggers) | `tests/unit/dharma/ledger.test.ts › overdraft → DharmaOverdraftError`; `… › rejects pool_seed/pool_unwind`; `tests/server/dharma/non-transferable.test.ts`; **`tests/invariants/I-NO-OVERDRAFT-001.dharma-ledger-monotone.spec.ts`** |
| 2.3 Side frozen at comment-time | **no** | no comment surface | n/a |
| 2.4 Resolutions append-only | **adjacent** | `bet_payout`/`void_refund`/`correction_*` rows are append-only Bucket-A; ENGINE.5 writes the ledger side, ENGINE.9 owns `resolution_events`/`payout_events` | covered by `dharma-ledger-append-only.spec.ts` (exists) |

**Failure mode if INV-2 assertions missing:** a stake/payout that drives a balance negative (overdraft) or a user↔user flow (transfer) ships undetected → reputation laundering / Sybil value extraction (SPEC.1 §5:163), invalidating the K·n experiment. The overdraft core-check + the storage CHECK + the integration seed are the guard.

## 2. Data model changes

**One additive enum amendment (R-1):** `dharma_entry_type` gains `initial_grant` (9→10). Migration `<NNNN>_dharma_initial_grant_enum.sql` (drizzle-generated `ALTER TYPE … ADD VALUE`; PROBE-2 at execute). Schema edit: `src/db/schema/dharma.ts:18-28`. No new table/column/index; no trigger change (Bucket-A unchanged). Irreversible-but-additive (justified above).

## 3. API surface

**None external.** No Server Action, route handler, or HTTP endpoint. Deliverable = in-process pure functions + a tx-bound persistence helper consumed by ENGINE.7/9/12 and the signup flow. No zod request schema (inputs typed); no auth/rate-limit class.

## 4. UI / user flow

**None — backend pure logic + persistence.**

## 5. Failure modes

- **Caller skips per-user serialization** (D-2). Two concurrent appends compute `balance_after` from a stale latest row → divergent running total. **Recover:** documented caller contract + SERIALIZABLE-SSI abort (`40001`)/retry (OQ-3), or per-user advisory lock; `@security-auditor` reviews ENGINE.7/9/12 wiring; ENGINE.11 nightly drift detection. Stated, not solved here.
- **Pool tag reaches the helper / checker.** **Recover:** `DharmaPoolTagError` (typed; R-2/A8). Surfaced; conservation checker also throws on a stray pool tag in its input.
- **Non-canonical string stored** (e.g. `-0`). **Recover:** `canonicalize` at the boundary; `_probe-decimal-negzero` locks the vendor behavior.
- **Overdraft** (`balance_after < 0`). **Recover:** `DharmaOverdraftError` (core) + storage CHECK (ground truth) → handler 500 per SPEC.2 §6.4 if the advisory check is bypassed.

## 6. Edge cases

- **User's first row** = `initial_grant`, `previousBalance="0.000…0"` → `balance_after = amount` (R-1). Named test.
- **Exact-zero amounts:** `bet_payout` loss = `0` → `balance_after = previousBalance` (no-op move; allowed — OQ-4 accepts 0).
- **Sell vs buy** same tag `bet_stake`, sign-distinguished (Note-4): buy `−S`, sell `+proceeds`. Named test.
- **`uncollectable`**: `balance_after = previousBalance` (unchanged), `amount` ≤ 0. The one row breaking the running-total identity (by design). Named test.
- **`−0` / `0.0` / `007`** all canonicalize (PROBE-1): `-0`/`0.0`→`0.000000000000000000`, `007`→`7.000000000000000000`. Named test (`_probe-decimal-negzero`).
- **Near-ceiling magnitude** (≥10²⁰): out of the documented domain; not defended (cpmm.md §10.5 parity) — a caller-contract violation, not a product path.

## 7. Test plan (D-3; layers; RED-limitation line)

| Layer | Path | Scenarios | Invariants |
|---|---|---|---|
| Unit (DB-free, **RED-locally**) | `tests/unit/dharma/canonical.test.ts` | −0/0.0/007/signed/≤18dp pad; invalid → `DharmaInputError` | — |
| Unit (**RED-locally**) | `tests/unit/dharma/_probe-decimal-negzero.test.ts` | `canonicalize("-0") === canonicalize("0.0") === "0.000000000000000000"`; `canonicalize("007") === "7.000000000000000000"` (vendor-pin, decimal.js 10.6.0) | — |
| Unit (**RED-locally**) | `tests/unit/dharma/ledger.test.ts` | `balance_after = prev+amount` exact; overdraft → `DharmaOverdraftError`; 8-accept/2-reject tag table; sell-sign; `uncollectable` special-case; first-row grant shape | **INV-2** |
| Unit (**RED-locally**) | `tests/unit/dharma/conservation.test.ts` | (★) happy path; **uncollectable-EXCLUSION** case (worked example: {−10,+25,−5,−20(unc),+15}, injection 25 → `ok:true`, −20 ignored); numeric mismatch → `ok:false`+`discrepancy`; **stray `pool_seed`/`pool_unwind` → throws `DharmaPoolTagError`** (A8); stray `initial_grant`/`daily_allowance` → throws `DharmaInputError` | conservation |
| Server (DB-backed, **CI-only**) | `tests/server/dharma/non-transferable.test.ts` | SPEC.1 §5:159 — rejects pool tags; tag required on every row | **INV-2** |
| Integration (DB-backed, **CI-only**) | `tests/integration/dharma-ledger.integration.test.ts` | persistence running-total across a sequence; first-row grant; **multi-row-same-user-one-tx chaining** via `previousBalance` (ENGINE.9 reverse+uncollectable shape); DB-backed conservation reconciliation | INV-2 |
| Invariant (DB-backed, **CI-only**) | **`tests/invariants/I-NO-OVERDRAFT-001.dharma-ledger-monotone.spec.ts`** | `balance_after ≥ 0` across a write sequence; storage CHECK fires on a forced negative. **Concurrent-bet composition → ENGINE.7** (§14.2:1373, deferred) | **INV-2** |

- Naming per SPEC.2 §14.2:1375 — INV-2 slug `NO-OVERDRAFT`, seed `001`, canonical slug `dharma-ledger-monotone`.
- **RED-limitation line (PROBE-3):** the DB-backed suites (integration, invariants, db/triggers, server-if-DB-backed) **cannot demonstrate RED locally** — `ECONNREFUSED` on `:54322` is an **infra failure, not an assertion red**; their first true run is **CI on the PR**. **Mitigation:** CP-1 web line-review of those test files **plus** the DB-free unit twins (canonical/ledger/conservation), which **do** run RED locally and cover the same logic. Pure suites follow §5.6 RED normally (RED locally before implement).
- `@test-writer` writes all the above **RED first** (§5.6); forbidden from `src/`.

## 8. Out of scope

- **ENGINE.7** — bet tx wrapper, idempotency, the concurrent-overdraft composition test, the pool `FOR NO KEY UPDATE` lock.
- **ENGINE.9** — resolution/correction/void fan-out, `resolution_events`/`payout_events` writes, **production of `uncollectable`/`bet_payout`** rows (ENGINE.5 only accepts the tags + asserts conservation); the secondary reverse+uncollectable identity; the SPEC.1 §11:544 "0 or −S" loser-row decision.
- **ENGINE.11** — `positions` materialization + nightly position-vs-ledger drift cron (the drift detector named in the caller contract).
- **ENGINE.12** — Daily-Credit **accrual policy** (when/whether to write `daily_allowance`, the `last_allowance_accrued_at` cursor logic). ENGINE.5 supplies the value-agnostic write helper only.
- **Signup-time emission wiring** of the `initial_grant` row (auth/onboarding stratum) — ENGINE.5 supplies the helper + tag + migration + row-shape test, not the signup call site.
- **Any `events` emission** — `dharma.credited` (and admin-actor pool events) are emitted by the consuming tx (ENGINE.9/12), not this module (ENGINE.0 vocabulary read-only).
- **No issuance constants** (D-4) — magnitudes are caller inputs (ADR-0018 ranged).
- **No admin-side ledger row** (R-2) — pool flows are events + reserves.

---

## Execute ritual (full, no narrowing — R-3)

> **Hard STOPs:** no event emission; no admin-side ledger row; no issuance constants; no SPEC/tracker edits beyond the closed rider set; the conservation identity is (★) exactly — never invent a term to reach green; `uncollectable` stays excluded from (★).

1. **Sync + branch** (L-E4.2 discipline, single commands): `git checkout main` → assert → `git fetch origin` → `git merge --ff-only origin/main` (never reset) → `git checkout -b feat/engine-5-dharma-ledger` (the **execute** branch).
2. **`@test-writer` RED** (Phase 2 start, §5.6): author the §7 suite. Pure unit twins fail RED locally; DB-backed suites are CI-RED (RED-limitation line). Pass `@docs/plans/ENGINE.5.md`. **CP-1:** STOP — paste **all** test files (incl. the DB-backed ones, since they can't RED locally) to web for line review; confirm the 8/2 tag split + (★) excludes `uncollectable` + the A8 throw posture + the uncollectable special-case.
3. **PROBE-2** (now, since it writes a file): edit `dharma.ts` enum; `just db-generate dharma_initial_grant_enum`; confirm `ALTER TYPE … ADD VALUE` (not drop/recreate); else hand-write the raw migration.
4. **Implement to green** (main session): `errors.ts` → `canonical.ts` → `tags.ts` → `ledger.ts` → `conservation.ts` → `persist.ts`. `import "server-only"` all. **CP-2:** STOP — paste all `src/` + the migration for web line review before verify+cascade.
5. **Green + verify** (L-E3.5 exact forms): `pnpm vitest run tests/unit/dharma/` (local, green); `ZUGZWANG_ENV=preview just verify` (typecheck→biome→build). DB-backed suites run in **CI** (local Postgres down — PROBE-3).
6. **Riders** (R-3 closed set, appendix): the migration + the ratified SPEC.1/SPEC.2 amendment riders + CLAUDE.md §1 dharma greenfield→built-sensitive + AGENTS.md lines — all in the execute PR.
7. **Review cascade** (§5.11): `@code-reviewer` → **full-scope `@security-auditor`** (no narrowing — INV-2 + transfer-surface + overdraft + tag-policy exploitability) → `@db-migration-reviewer` (enum migration). Pass `@docs/plans/ENGINE.5.md` to each.
8. **§5.10 pre-PR audit (PASS/FAIL/SURPRISE):** enum migration shape; every accepted/rejected tag mapped to a green test; (★) checker (uncollectable excluded) + test present; canonical-form on all stored strings; overdraft path; diff-stat = closed set; no event/admin-ledger/issuance-constant lines (grep-proven).
9. **PR** → founder squash-merge → post-merge sync (ff-only, L-E4.2) → `git branch -D feat/engine-5-dharma-ledger`.

**Closed execute diff-stat (expected):**
`src/server/dharma/{errors,canonical,tags,ledger,conservation,persist}.ts` · `src/db/schema/dharma.ts` (enum edit) · `drizzle/migrations/<NNNN>_dharma_initial_grant_enum.sql` · `tests/unit/dharma/{canonical,_probe-decimal-negzero,ledger,conservation}.test.ts` · `tests/server/dharma/non-transferable.test.ts` · `tests/integration/dharma-ledger.integration.test.ts` · `tests/invariants/I-NO-OVERDRAFT-001.dharma-ledger-monotone.spec.ts` · the rider files (appendix) · `docs/logs/ENGINE.5.md` (separate log commit). **Zero** event/handler/admin-ledger lines.

Commits authored **`Zugzwang/world <zugzwangworld@proton.me>`** (CLAUDE.md §5.13:155 / AGENTS.md §10:227; `Chrollo` is the git username, **not** the commit author); **no `Co-authored-by` trailer** (AGENTS.md §10:228). Multi-line via `/tmp/engine-5-msg.txt` (`rm -f` first). Tail/grep Write-authored files for stray delimiter tokens before commit (memory `feedback_verify_generated_file_tails`).

---

## Riders appendix (R-3 — candidate wording; full enumerative sweep, L-E4.1)

> Founder ratifies wording at review; final text web-authored A-series. Every SPEC line that enumerates the 9-set or asserts admin-in-ledger:

**SPEC.1:**
- §5 INV-2:158 — enum list → **add `initial_grant`** (→10-set). Confirm "No admin override that moves Dharma between accounts except via a resolution event" reads consistently with R-2.
- §2 glossary:56-57 — `pool_seed`/`pool_unwind` mapped to `dharma_ledger.entry_type` → **qualify**: "enum value reserved; v1 records the flow via `events` + `pools` reserve deltas, not a `dharma_ledger` row (R-2)."
- §10.1:464 — admin "exists only as an actor identifier in the Dharma ledger" → **reword**: "…an actor identifier in the **events log** (`metadata.actor_id='admin-singleton'`); admin has no `dharma_ledger` row (R-2)."
- §10.2:469 — conservation source list already names "initial grants" (R-1 consistent); note "admin seed" is an events/pool fact.
- §16.4:990 — `dharma_ledger` "Every Dharma flow with tag from fixed enum" → **qualify** "every **user-side** Dharma flow."

**SPEC.2:**
- B.7:2566 — `entry_type` examples → **add `initial_grant`**; note built type is **pgEnum** (Appendix says `text`); strike "admin-issued rows" from the `bet_id` note (`bet_id` NULL for `daily_allowance`/`initial_grant`).
- §3.6:296 — "writes a single `pool_unwind` `dharma_ledger` row to the admin actor" → **reword**: pool_unwind is an `events` row + pool reserve drain in v1, **not** a `dharma_ledger` row (R-2). (Void `void_refund` rows **stay** user-side ledger rows.)
- §14.1:1359 — INV-2 mech "balance is `SUM(credits)−SUM(debits)` derived" → **qualify**: "latest `balance_after` (running total) is canonical; `SUM(amount)` equals it **excluding `uncollectable`** rows."

**CLAUDE.md §1:** move `dharma/` from the greenfield list to **Built, sensitive** at merge (ENGINE.2/cpmm precedent).
**AGENTS.md:** §6 enum note "dharma_entry_type … 9 values" → **10** (+`initial_grant`); §9 test tree gains `tests/unit/dharma/` + `tests/server/dharma/`.

## Carry-forwards minted by this plan

1. **`uncollectable` row PRODUCTION** (correction clawback floored at zero) → **ENGINE.9**; ENGINE.5 ships model A (amount ≤ 0, `balance_after` = prev) + the conservation exclusion.
2. **Secondary identity** `Σ(correction_reverse)+Σ(uncollectable) = −Σ(reversed payouts)` → **ENGINE.9** (correction-path).
3. **Correction admin-side counterparty** (events-only, no admin ledger row) → **ENGINE.9**.
4. **Per-user serialization mechanism** for non-bet ledger writes (SERIALIZABLE+retry default; advisory-lock fallback — OQ-3) → **ENGINE.7/9/12** caller wrappers.
5. **`I-NO-OVERDRAFT-002` concurrent-bets-single-user** composition → **ENGINE.7** (§14.2:1380).
6. **SPEC.1 §11:544 "0 or −S" loser-row** decision (recorded lean: no row for zero-amount settlements; `−S` would double-debit) → **ENGINE.9** amendment list (OQ-4).

## ADRs needed

**None mandatory.** The enum addition is an R-1-ratified schema amendment (rides the PR, §5.12 same-commit). If the per-user-serialization mechanism is standardized into a shared `dharmaTransaction()` wrapper, **that** is an ENGINE.7/9 ADR, not this one. The R-2 "ledger user-only / pool flows as events" posture is founder-ruled; durable codification is the one-line SPEC.2 amendment (appendix), not an ADR.

## Open questions — RESOLVED records (A4; P-2/P-6 ruled at R-1/R-2)

- **OQ-1 — `uncollectable` shape. RESOLVED: model A** (amount ≤ 0, `balance_after` = prev); ENGINE.9 carry-forward stands.
- **OQ-2 — `appendLedgerRow` balance read. RESOLVED by A3:** optional `previousBalance` overload (required, not sugar); multi-row-same-user-tx must chain explicitly.
- **OQ-3 — non-bet per-user serialization. RESOLVED: SERIALIZABLE + ADR-0013 full-jitter retry** (default); `pg_advisory_xact_lock(user_id)` fallback only; ownership ENGINE.7/9/12.
- **OQ-4 — `bet_payout` loser row. RESOLVED:** helper accepts `0`; produce-or-not → ENGINE.9 (recorded lean = no row for zero-amount settlements); SPEC.1 §11:544 "0 or −S" queued to ENGINE.9's amendment list (`−S` would double-debit).

No residual open questions at plan time.

## Self-critique (plan self-review, 2026-06-07)

| # | Severity | Finding | Resolution |
|---|---|---|---|
| 1 | **high** | **(L-E4.1 annotation — caught at web review A1):** the `uncollectable` **model** was right (model A — amount ≤ 0, `balance_after` = prev), but its **conservation-identity placement was wrong** — the draft included `uncollectable` in Σ(★); the corrected identity **excludes** it. Caught by the web's worked-example check, **reproduced independently** here before fold (the pool-double-entry re-derivation). | Folded: (★) excludes `uncollectable`; secondary reverse+uncollectable identity → ENGINE.9 carry-forward; `conservation.ts` + tests amended; A8 throw-posture added. Model A unchanged. |
| 2 | medium | The conservation checker is **fully** exercised only once corrections/uncollectable exist (ENGINE.9). ENGINE.5's test asserts happy-path + a synthetic uncollectable-exclusion case. | Accepted: ENGINE.5 mints the pure checker + unit test (R-2); DB-backed reconciliation is CI-gated; correction-path integration rides ENGINE.9. |
| 3 | medium | DB-backed suites can't RED locally (ECONNREFUSED ≠ assertion red). | Mitigated by the RED-limitation line: CP-1 web line-review + DB-free unit twins that RED locally cover the same logic; first true run is CI. |
| 4 | low | First-in-module-twin `.enumValues` derivation repeats ENGINE.4's pattern. | Defended (single-source-of-truth; ENGINE.4 precedent `671c484`); DB-free testable. |
| 5 | low | PROBE-2 (drizzle-kit `ADD VALUE`) could mis-generate. | Mitigated: hand-written raw-SQL fallback (AGENTS.md §6); `@db-migration-reviewer` gate. |

Checked: INV-2 coverage (overdraft + transfer-surface + tag-policy + append-only), R-1/R-2/R-3 + D-1–D-4 + A1–A8 fold, P-5 reconciliation, (★) derivation + uncollectable exclusion (independently reproduced), scope discipline (no event/admin-ledger/issuance-constant), value-agnosticism, the closed rider sweep, full-ritual (no narrowing), the probe folds + RED-limitation line.

## References

- SPEC.1 §5 INV-2 (`:154-164`), §10 economy (`:453-533`, esp. §10.2 `:467-471`, §10.4 `:486-494`, §10.7 `:511`), §11 F-RESOLVE (`:537-562`, esp. `:544`), §16.1 (`:930,932`), §16.4 (`:990`).
- SPEC.2 §3.6 (`:296-300`), §3.7 (`:304-322`), §6 (`:562-691`), §14.1 (`:1359`), §14.2 (`:1365-1380`), B.7 (`:2559-2571`), B.8 (`:2573-2584`).
- ADR-0018 (issuance, value-agnostic), ADR-0013 (seam only — `:394` per-flow tagging is caller's; lock order), ADR-0016 (`:29` decimal-lib→ENGINE.5; UUIDv7 PK; `:200` no cross-backend monotonicity), ADR-0005 (Pattern A, Bucket-A, append-only).
- cpmm.md §10 (`:460-526`), §13 (`:608-646`) — `CpmmDecimal` + quantizers + caller contract.
- Built: `src/db/schema/dharma.ts:18-69`, `auth.ts:31-69`, `0001:4,149-158,216-223`, `0003:44-45`; `src/server/cpmm/{decimal,validate,errors}.ts`; `src/server/events/schemas.ts:23-28`, `insert.ts:95`.
- CLAUDE.md §1/§2/§3/§5.6/§5.10/§5.11/§5.12/§5.13; AGENTS.md §6/§9/§10; `docs/plans/ENGINE.4.md` (form); `docs/plans/_template.md`.
- Probes: PROBE-1 (decimal.js 10.6.0 −0/canonicalization), PROBE-3 (local Postgres :54322 down) — both 2026-06-07, raw outputs above.

---

*Plan reviewed 2026-06-07 — founder-ratified R-1/R-2/R-3; web A1–A8 + D-1(simplified)/D-2/D-3/D-4; PROBE-1/PROBE-3 folded, PROBE-2 re-sequenced. Ratification = plan-PR merge. Execute happens in a fresh session on `feat/engine-5-dharma-ledger`.*
