# ENGINE.5 — session log

> **Stratum:** ENGINE.5 — Dharma append-only ledger logic (`src/server/dharma/`); a pure core + thin persistence layer over the built `dharma_ledger` (Bucket-A), reusing `CpmmDecimal`. INV-2 (soulbound + no-overdraft) load-bearing.
> **Entry:** plan session (read-only preflight recon → founder OQ batch R-1/R-2/R-3 → draft → web review A1–A8 + D-1–D-4 → two read-only probes → A9 pre-merge micro-amendment → docs land). Execute session appends below in a fresh CC session.

---

## Plan session — 2026-06-07

**What landed.**
- `docs/plans/ENGINE.5.md` — the founder-ratified implementation plan (**Status: reviewed**, A1–A9 folded) — via **PR #85**, squash-merged to `main` at **`c7acc1bd010a376b4c0b53723c1b4bec9777c824`** (`plan: ENGINE.5 — Dharma append-only ledger (reviewed) (#85)`), **docs-only, no reviewer cascade** (#77/#81 precedent). Two branch commits pre-squash: `0530e97` (initial write, +374) and `5784711` (A9 fold, +14/−10). Final on `main`: **378 lines**.
- No `src/`, no test, no schema/migration changes — plan-only. Plan-chat branch `docs/engine-5-plan` merged + deleted; this log ships on `chore/engine-5-log`.

**Decisions made — founder rulings (ratified 2026-06-07).**
- **R-1 (resolves P-2 initial-grant gap).** 10th enum value **`initial_grant`**; the `ALTER TYPE … ADD VALUE` migration + schema enum edit **enter ENGINE.5 execute scope**. Grant row: `user_id`=recipient, `bet_id`=NULL, `amount`=+grant (value-agnostic), `balance_after`=amount — every user's first ledger row.
- **R-2 (resolves P-6 admin-actor gap).** `dharma_ledger` stays **user-only**. `pool_seed`/`pool_unwind` stay in the enum but **DORMANT** in v1 — the write helper accepts the **8 user-side tags** and **rejects the 2 pool tags** with a typed `DharmaPoolTagError`. Admin↔pool flows are recorded as `events` rows (`metadata.user_id`=NULL, `actor_id`='admin-singleton') + `pools` reserve deltas — **no ledger row**. Per-market conservation becomes a cross-table identity; ENGINE.5 **mints the checker + its test**.
- **R-3 (rider vehicle).** The migration + SPEC.1/SPEC.2/CLAUDE.md/AGENTS.md amendment riders ride the **execute PR** as a closed, pre-listed set (full enumerative sweep in the plan's riders appendix, L-E4.1); founder ratifies wording at plan review; final text web-authored at the A-series.

**Decisions made — web directives D-1..D-4.**
- **D-1 (SIMPLIFIED per PROBE-1).** `canonicalize = numericString gate → CpmmDecimal(s).toFixed(18)`. PROBE-1 proved `toFixed(18)` **is** the canonicalizer (`-0`/`0.0` → `"0.000000000000000000"`, `007` → `"7.000000000000000000"`), so the explicit `isZero()` step-4 branch was **considered and dropped** (L-E3.5 record). Vendor contract pinned by `tests/unit/dharma/_probe-decimal-negzero.test.ts` (decimal.js literal **10.6.0**).
- **D-2.** Pure core + thin persistence taking the caller's `tx` handle. Documented caller contract: **SERIALIZABLE + per-user write serialization is the CALLER's obligation** — grant/daily/resolution writes sit **outside** the ADR-0013 pool lock; cpmm no-sub-ULP / near-ceiling note inherited at the seam.
- **D-3.** `I-NO-OVERDRAFT-001` minted here at the layers testable now; the concurrent-bet composition lands at **ENGINE.7**. Test split pinned by PROBE-3.
- **D-4.** Value-agnostic per ADR-0018 — all amounts are caller inputs; **no issuance constants** in the module.

**Decisions made — web review amendments A1–A9 (folded into the ratified plan).**
- **A1** — conservation **(★) EXCLUDES `uncollectable`** (the leakage/forgiveness record, not a flow term). **Independently re-derived both directions** before fold (pool double-entry: IN 115 = OUT 115; Σ balance-moving = 25 = Seed−Unwind; including `uncollectable` → 5 ≠ 25). Corrected (★) = Σ over {`bet_stake`,`bet_payout`,`void_refund`,`correction_reverse`,`correction_apply`} = NetAdminPoolInjection(M). The secondary `Σ(correction_reverse)+Σ(uncollectable) = −Σ(reversed payouts)` identity → ENGINE.9 carry-forward.
- **A2** — (★) RHS defined as **net admin↔pool injection** (v1 legs = seed, unwind) so future correction top-up legs generalize without a break.
- **A3** — `appendLedgerRow` gains optional **`previousBalance`** (skips the in-tx read; **required** when writing >1 row for the same user in one tx — chain via the prior returned `balanceAfter`, since `now()` is tx-frozen ⇒ `created_at` ties; live case = ENGINE.9 reverse+uncollectable pair). Resolves **OQ-2**. Cross-tx BEGIN-vs-commit timestamp inversion noted as residual theoretical risk; ENGINE.11 nightly ledger-replay is the drift detector.
- **A4** — OQ-1/3/4 ruling records (below).
- **A5** — commit identity: author **`Zugzwang/world <zugzwangworld@proton.me>`** (CLAUDE.md §5.13:155 / AGENTS.md §10:227); `Chrollo` is the git username, **not** the commit author; no `Co-authored-by` trailer.
- **A6** — migration filename = the **next sequential number at execute time** (head `0008` ⇒ `0009`), never hard-coded.
- **A7** — self-critique #1 annotated as an **L-E4.1 "caught at web review"** record (model right, identity placement wrong).
- **A8** — `checkMarketConservation` **throws** on tag-contract violations (pool tags → `DharmaPoolTagError`; `initial_grant`/`daily_allowance` → `DharmaInputError`); `ok:false` is reserved for a genuine **numeric mismatch** (pure mismatch report, no reason field).
- **A9 (pre-merge micro-amendment).** `computeLedgerRow` enforces **`amount ≤ 0` for `entryType = uncollectable`** (positive → `DharmaInputError`) — the **only** defense, because `uncollectable` is the one row whose `amount` bypasses balance arithmetic (`balance_after = prev`), so neither `DharmaOverdraftError` nor the storage CHECK can catch a wrong-signed one. Recorded **considered-and-declined**: per-tag sign enforcement for the other 7 accepted tags is **producer-owned** (ENGINE.9/12/signup), not core-enforced — hard-enforcing now would pre-constrain ENGINE.9's correction mechanics. `checkMarketConservation` canonicalizes its inputs defensively (DB-sourced strings not assumed canonical).

**Probes (2026-06-07 — read-only).**
- **PROBE-1 (decimal.js −0 / canonicalization).** `decimal.js 10.6.0`; `new C("-0").toFixed(18)="0.000000000000000000"`, `.toString()="0"`, `.isZero()=true`; `"0.0"→"0.000…0"`; `"007"→"7.000…0"`. ⇒ D-1 simplification (above); explicit branch dropped; pinned by `_probe-decimal-negzero`.
- **PROBE-3 (local Postgres :54322).** **Down** (`pg_isready` no-response rc=2; port closed). Pinned test split: `tests/unit/dharma/` (canonical/_probe-negzero/ledger/conservation) + `ZUGZWANG_ENV=preview just verify` run **locally**; the DB-backed suites (`tests/server/dharma/`, `tests/integration/`, `tests/invariants/I-NO-OVERDRAFT-001`, the existing `tests/db/triggers/dharma-ledger-append-only`) are **CI-gated** (Postgres-17 service; same posture as ENGINE.4). **RED-limitation line:** DB-backed suites **cannot demonstrate RED locally** — `ECONNREFUSED` is an infra failure, not an assertion red; their first true run is CI on the PR. Mitigation: CP-1 web line-review of those files + the DB-free unit twins that DO RED locally.
- **PROBE-2 (drizzle-kit enum-append) → RE-SEQUENCED to execute step 3** (it writes a file). Safe to defer: the hand-written `ALTER TYPE` fallback + the `@db-migration-reviewer` gate are in-plan.

**Open questions.** None — all ruled (P-2/P-6 at R-1/R-2; OQ-1..4 RESOLVED).
- **OQ-1** — `uncollectable` shape → **model A** (`amount ≤ 0`, `balance_after = prev`); ENGINE.9 carry-forward stands.
- **OQ-2** — `appendLedgerRow` balance read → **A3** `previousBalance` overload (required, not sugar).
- **OQ-3** — non-bet per-user serialization → **SERIALIZABLE + ADR-0013 full-jitter retry** (default); `pg_advisory_xact_lock(user_id)` fallback only; ownership ENGINE.7/9/12.
- **OQ-4** — `bet_payout` loser row → helper accepts `0`; produce-or-not → ENGINE.9 (recorded lean = no row for zero-amount settlements; `−S` would double-debit); SPEC.1 §11:544 "0 or −S" queued to ENGINE.9's amendment list.

Carry-forwards minted (no `#`, to avoid autolink): carry-forward 1 (`uncollectable` row production → ENGINE.9); carry-forward 2 (secondary reverse+uncollectable identity → ENGINE.9); carry-forward 3 (correction admin-side counterparty, events-only → ENGINE.9); carry-forward 4 (per-user serialization mechanism → ENGINE.7/9/12); carry-forward 5 (`I-NO-OVERDRAFT-002` concurrent-bets-single-user → ENGINE.7); carry-forward 6 (SPEC.1 §11:544 "0 or −S" loser-row → ENGINE.9 amendment list).

**Next session starts at.** **ENGINE.5 EXECUTE in a FRESH CC session + fresh web chat** (§5.1/§5.8 plan/execute split — never this session). Execute **step 1** = sync + branch **`feat/engine-5-dharma-ledger`** off `main` (`c7acc1b`+); **step 2** = `@test-writer` RED authors the §7 suite (CP-1 web line-review — paste **all** test files incl. the DB-backed ones, which can't RED locally); **step 3** = PROBE-2 (`just db-generate dharma_initial_grant_enum`, confirm `ADD VALUE`). Pass `@docs/plans/ENGINE.5.md` to the cascade subagents. **FULL ritual, no narrowing:** `@test-writer` RED → implement → `@code-reviewer` → **full-scope `@security-auditor`** → `@db-migration-reviewer` → §5.10 audit; **no soak**.

**Context to preserve.**
- **Canonical ratified-plan SHA:** `c7acc1bd010a376b4c0b53723c1b4bec9777c824` (squash of PR #85).
- **Module surface (planned):** `canonicalize` · `computeLedgerRow({previousBalance,amount,entryType}) → {amount,balanceAfter}` (pure; overdraft → `DharmaOverdraftError`; pool tag → `DharmaPoolTagError`; uncollectable `amount ≤ 0` else `DharmaInputError`) · `checkMarketConservation({ledgerFlows, netAdminPoolInjection})` · `appendLedgerRow(tx, {userId, amount, entryType, betId?, previousBalance?})`. `DharmaEntryType` derived from `dharmaEntryTypeEnum.enumValues` (ENGINE.4 `.enumValues` precedent). Files: `canonical/tags/ledger/conservation/persist/errors.ts` under `src/server/dharma/`.
- **Conservation identity (★):** Σ over {`bet_stake`,`bet_payout`,`void_refund`,`correction_reverse`,`correction_apply`} for M's bet-tied rows = NetAdminPoolInjection(M) (v1 = Seed−Unwind); **`uncollectable` excluded**; `daily_allowance`/`initial_grant` (NULL `bet_id`) excluded by the gathering query.
- **Balance derivation (P-5 reconciliation):** canonical balance = **latest `balance_after`** (running total = `prev + amount`, exact 18-dp add/sub); `SUM(amount)` equals it **excluding `uncollectable`**. CHECK `balance_after ≥ 0` (`0001:157`) = the INV-2 storage floor; `DharmaOverdraftError` is its advisory mirror.
- **Tag policy:** 8 accepted (`initial_grant`, `daily_allowance`, `bet_stake` [sells reuse it, sign-distinguished — Note-4], `bet_payout`, `void_refund`, `correction_reverse`, `correction_apply`, `uncollectable`); 2 rejected (`pool_seed`, `pool_unwind`).
- **Decimal authority:** reuse exported `CpmmDecimal` from `cpmm/decimal.ts` (precision 50, ROUND_HALF_EVEN); **do not** install decimal.js (ENGINE.2 did; literal `10.6.0`). `numericString` reused verbatim from `@/server/events/schemas` (signed regex `/^-?\d{1,20}(?:\.\d{1,18})?$/`).
- **Verify form:** `pnpm vitest run tests/unit/dharma/` (local, green) + `ZUGZWANG_ENV=preview just verify`; DB-backed suites are the CI merge gate (PROBE-3).
- **Execute diff-stat closed set:** `src/server/dharma/{errors,canonical,tags,ledger,conservation,persist}.ts` + `src/db/schema/dharma.ts` (enum edit) + `drizzle/migrations/<next>_dharma_initial_grant_enum.sql` + `tests/unit/dharma/{canonical,_probe-decimal-negzero,ledger,conservation}.test.ts` + `tests/server/dharma/non-transferable.test.ts` + `tests/integration/dharma-ledger.integration.test.ts` + `tests/invariants/I-NO-OVERDRAFT-001.dharma-ledger-monotone.spec.ts` + the R-3 rider files. **Zero event/admin-ledger/issuance-constant lines.**

**Time.** 2026-06-07 (IST) — single plan-chat session: read-only preflight recon under a sync-gate STOP (local HEAD on the merged `chore/engine-4-execute-log` branch, not `main`; founder-adjudicated ff-only recovery to `671c484`) → P-flags P-0..P-9 → founder rulings R-1/R-2/R-3 → in-chat draft + web review (A1–A8, D-1–D-4) → A1 bidirectional re-derivation → PROBE-1/PROBE-3 (read-only) + PROBE-2 re-sequence → D-1 simplification + RED-limitation line → docs-only PR #85 (initial `0530e97`, A9 fold `5784711`) → founder squash-merge (`c7acc1b`) → post-merge sync (clean ff-only under L-E4.2; plan branch deleted) → this log.

---
