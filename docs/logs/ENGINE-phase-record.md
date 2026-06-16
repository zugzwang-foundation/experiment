# ENGINE Phase — Consolidated Record

> **Doc:** `docs/logs/ENGINE-phase-record.md`
> **Status:** ENGINE phase **CLOSED** — all strata `.0`–`.16` DONE and green on `main`.
> **Authored:** 2026-06-15 (web, at the ENGINE.10 close), from the read-only engine-close recon + orchestration context. CC-committed, PK-mirrored.
> **Purpose.** One commit-referenced index for the whole ENGINE phase. **GitHub retains the full per-stratum plan + log set forever** (17 plans + 23 logs under `docs/plans/` + `docs/logs/`); this record is the standing index that replaces the ~35 scattered ENGINE plan/log/close-out files in the PK mirror. It also **subsumes the post-phase reconciliation sweep** (§3) — there is no separate sweep-log file.

---

## 1. Status at close

- **ENGINE phase CLOSED.** All strata `.0`–`.16` are DONE and green on `main`.
- `main` HEAD == `origin/main` == **`e715882`** · migration head **`0015`** · `EVENT_TYPES` **`23`**.
- Reconciled against the live repo by the read-only engine-close recon (2026-06-15): all 17 stratum merge SHAs verified; the two previously-unverified rows (`.9`, `.13`) confirmed.
- **The frontier is now DEBATE.** The bet write path is built; the comment/reply/moderation/ranking half is greenfield. Critical path runs **engine → DEBATE → UI → LAUNCH** (no longer engine-gated).

---

## 2. Per-stratum record (canonical SHA spine + key decisions)

Hierarchy reminder: SPEC.1 / SPEC.2 > ADRs > tracker. Full detail per stratum lives in the repo logs (§7).

| Stratum | Merge SHA · PR | Primary deliverable(s) | Key decision / note |
|---|---|---|---|
| **ENGINE.0** | `4dc16d7` · #69 | `src/server/events/schemas.ts` (event vocab + 10 schemas, `numericString`) | Event-sourcing vocabulary foundation. ADR-0005 **Pattern A** — synchronous, same-transaction appends; **no async projector workers**. (Vocab grew to 23 EVENT_TYPES across the phase.) |
| **ENGINE.1** | `e7362fc` · #71 (log #72) | `docs/specs/cpmm.md` v1.0.0 + third-party notices; SPEC.1 1.0.2 glossary fix | CPMM math spec. **`NUMERIC(38,18)` exact decimal**; **resolved the ADR-0008 §8 decimal-library choice → `decimal.js` (^10.6)** (cross-cutting with ENGINE.5). Fee-less single-MM. Manifold `calculate-cpmm` lineage lifted MIT→AGPL, notice preserved verbatim. |
| **ENGINE.2** | `2a8d888` · #75 | `src/server/cpmm/` (pure module) | CPMM TypeScript module — pure, no framework/DB. Spec-gated on cpmm.md. |
| **ENGINE.3** | `d8e9159` · #79 | `tests/unit/cpmm/*.property` | fast-check property tests: constant product holds, probabilities sum to 1, no negative balances, idempotency on duplicate events. |
| **ENGINE.4** | `c976222` · #83 | `src/server/markets/transitions` | Market state machine — 7 states (Draft→Open→Closed→Resolving→Resolved / Voided / Frozen); pure transition functions; illegal transitions as negative tests. |
| **ENGINE.5** | `da4618d` · #87 | `src/server/dharma/` (append-only ledger) | Dharma ledger — tagged from the fixed flow-tag enum; `CHECK balance_after ≥ 0` = INV-2 storage floor; balance-as-view; per-market conservation. **Mints I-NO-OVERDRAFT-001.** |
| **ENGINE.6** | `42baa8b` · #49 | `src/server/events/` (`insertEvent` primitive) | `insertEvent(tx, …)` events-write primitive (ADR-0005 Pattern A) — synchronous same-tx appends, idempotent by `event_id`, multi-site emission wiring. (Tracker desc "projector workers" was stale — corrected.) |
| **ENGINE.7** | `37dae5a` · #95 | `src/server/bets/transaction.ts` (W-1 wrapper) | **W-1 bet-tx wrapper** (ADR-0013): SERIALIZABLE + `SELECT … FOR NO KEY UPDATE` pool lock, canonical lock order, full-jitter retry on `40001`/`40P01` (re-runs the whole tx body). **Moderation runs OUTSIDE this tx** (ADR-0014). **Mints I-ATOMICITY-001.** |
| **ENGINE.8** | `66fa532` · #99 | `src/server/bets/{place,sell}` | Bet flow API — F-BET-1…10, no cancellation, idempotency keys (ADR-0015), all state via W-1. **Two-floor minimum-bet enforcement (ADR-0018):** post floor (ranged) + reply floor (50 Đ). Single-side rule (F-BET-10) → `opposite_side_held`. **Mints I-SIDE-BIND-001.** |
| **ENGINE.9** | `af28566` · #114 | `src/server/resolution/{settle,correct,void,trigger,basis,transaction,errors}` + F-ADMIN-3 trigger + migrations 0014/0015 | **Resolution / correction / void** (W-3 wrapper — ADR-0013 P2, `markets`-first lock). **F-RESOLVE-1:** losers settle shares to **0** (`bet_payout`, `dharma_delta = 0` — stake already debited at bet time; the −S form was struck to avoid double-debit). **F-RESOLVE-2:** correction floor-at-zero via per-user `−min(R,B)` + uncollectable-remainder ledger entry. **F-RESOLVE-3:** void refunds `f × stake` (strictly positive; pool cash conserved; no floor needed). |
| **ENGINE.11** | `deb0c76` · #91 | `src/server/positions/` (compute · persist · read · drift cron) | Position layer — maintained atomically per bet; hot-path read for the single-side rule + the In/Flipped/Exited marker. Nightly drift-detection vs ledger replay. |
| **ENGINE.12** | `af61ce5` · #104 | `src/server/dharma/` daily-credit lazy accrual + migration 0012 | Lazy daily-credit accrual — flat credit **once per UTC day, only on placing a commented bet** (no credit for logins/reads/sells; SPEC.1 §10.4). Cursor-UPDATE-first write order (retryable `40001` over non-retryable `23505`); the credit funds the bet that triggers it. **Mints I-DAILY-ONCE-001.** Established the ADR-0013 P1 `pools → users` lock suffix. |
| **ENGINE.13** | `76877e6` · #110 | `src/server/dharma/grant.ts` + migration 0013 | Initial Dharma grant (~1,000 Đ ranged) — one-time ledger row at account creation (Better Auth signup path). Same `previousBalance`-chaining discipline as accrual (signup-then-immediate-bet concurrency). **Idempotent — one grant per user, ever (I-GRANT-ONCE-001).** |
| **ENGINE.14** | `a29ef7e` · #118 | `src/server/markets/{transaction,create,open,close}` + `src/server/admin/actor.ts` | Market lifecycle writes — admin create · seed/open · clock-driven Open→Closed; `market.*` emits. **W-4 wrapper** joins W-3 in the `markets`-first lock slot (ADR-0013 P3). |
| **ENGINE.15** | `b8d4ee4` · #122 (#123/#124) | `src/app/(admin)/admin/markets` + `api/cron/close-due-markets` + resolution actor belt | HTTP / cron / admin wiring stratum. **In-stratum HIGH security fix:** admin read pages had no real Layer-2 auth (fixed in-stratum). **Surfaced the `frozen_at` write-freeze gap → minted ENGINE.16.** |
| **ENGINE.16** | `f7d1ab2` · #127 (plan #125/#126, log #128) | `src/server/system/is-frozen.ts` | Conclusion-freeze write-seal — participant writes → **410** (`error_experiment_concluded`), reads → **200**, cron → **200 no-op**. Gated at the **handler layer** (place/sell via `runBetEndpoint`), **not** inside the W-1/W-3/W-4 tx wrappers (the guard is non-locking by design). **Resolution + market-admin paths intentionally exempt (§20.3** — conclusion/last-mile work runs post-freeze); a regression guard locks the exemption. |
| **ENGINE.10** | `239ecb9` · #131 (plan #129/#130, log #132) | `tests/scale/` (correctness-at-scale harness) | **ENGINE-phase EXIT gate** — see §2.1. Test-harness-only (no `src/`, no schema, no new ADR); one same-commit SPEC.2 §3 rider (→ v1.0.6). |

### 2.1 ENGINE.10 — the exit gate (detail)

ENGINE.10 load-tests a system already *proven correct* — never the reverse. Ratified scope (**Option C**, NOT the old "10k bets / 100 markets / p95<500ms" framing):

- **8 synthetic markets** (each a hot pool row), driven through the *real* engine entry points (`runBetEndpoint`→`place`/`sell`, `runResolutionTransaction`→`settle`/`correct`/`void`, the close-due cron, ENGINE.16's freeze gate).
- **Engineered collision** (D≈32–64, **not** 5k literal connections — that's the deferred k6 job) to drive the worst-case SERIALIZABLE retry path; nondeterministic interleaving, **deterministic asserted end-state** (CI-able).
- All four invariants asserted at scale (INV-1/2/3/4); idempotency dedup; clawback floors-at-zero; ledger chain intact.
- **Amendment E — global conservation by TWO independent derivations** + cross-check (per-market checker reuse = #1; an independent global re-derivation = #2). **The conservation-formula catch — it caught a real bug:** during the execute run the two derivations **diverged (d1 ≠ d2) and the gate fired RED** — a genuine CPMM arithmetic error in the global conservation formula. It was corrected to the **pool-cash measure**, after which the derivations agreed. That divergence-then-fix is the evidence the checker is **non-vacuous** — it provably catches a real Dharma leak rather than tautologically passing (ENGINE.10 execute log).
- **Amendment F — the two-spine race is INDUCED, not happy-pathed:** fire W-3 while a W-1 bet is mid-flight at the unlocked `markets.status` read window; assert the **XOR** (commit-before-flip ⇒ in the payout set; rejected-on-SSI-retry ⇒ not; **never both, never torn**).
- **Amendment D — sells are NOT `bets` rows** (`bets.comment_id` NOT NULL + selling is the only comment-free action, confirmed `sell.ts:36–38,71–76`); INV-1 count-parity is scoped to commented **posts**; sell-driven Dharma flows via the **ledger** (`bet_id` NULL), with the `bet.sold` event for per-market attribution. *(This closes the comment_id-vs-sell seam — no comment is needed because no bet row is written.)*
- **Perf RECORDED, not gated** — the hard `p95<500ms @ 5k VUs` latency gate is deferred to the next-P0 k6/staging stratum (see §3 / §5).
- **INV fence held:** driven via `place()` top-level only (`parentCommentId: null`); the reply-as-bet **load** half (50 Đ floor + Support/Counter aggregates) defers to the post-DEBATE.2 k6 stratum.

---

## 3. The closing reconciliation sweep (2026-06-15) — folded in here, no separate file

At the ENGINE.10 close, the post-phase sweep ran and produced the v13 tracker:

- **Three tracker rows minted DONE:** ENGINE.14 (lifecycle), ENGINE.15 (wiring), ENGINE.16 (freeze) — none had a tracker row before.
- **ENGINE.10 scope correction:** the stale "10k bets / 100 markets / p95<500ms @ 50/sec" row replaced by the ratified Option-C scope (above), deps → 8/9/11/12/13/14/15/16.
- **ID-ORDER ERRATA:** ENGINE.16 executed **before** ENGINE.10 (out-of-order minting). The phase is complete regardless; the errata is recorded so the SHA order isn't mistaken for a build order.
- **Carry-forward correction (important):** the three "open spec gaps" memory/kickoff carried are **CLOSED** — see §5.
- **A-lite probe minted (HARDEN.2-PRE)** as the next-P0 (off the critical path), plus the **founder latency ruling** (throughput-at-relaxed-latency replaces the p95<500ms gate; N deferred).

---

## 4. Invariants proven + test floor

**Invariants (all asserted under engineered-collision concurrency at ENGINE.10):**

- **INV-1** bet↔comment atomicity — `I-ATOMICITY-001` (ENGINE.7). Built half: `bets.comment_id NOT NULL`.
- **INV-2** no-overdraft — `I-NO-OVERDRAFT-001` (ENGINE.5). Storage floor: `CHECK balance_after ≥ 0`.
- **INV-3** side-bind — `I-SIDE-BIND-001` (ENGINE.8). `side_at_post_time` frozen by BEFORE-UPDATE trigger.
- **INV-4** append-only resolutions — `I-APPEND-ONLY-001` (ENGINE.0/triggers).
- Plus `I-DAILY-ONCE-001` (ENGINE.12) and `I-GRANT-ONCE-001` (ENGINE.13).

**Test floor (live, recon-verified 2026-06-15):** **99 `*.test.ts` files (121 including `*.spec.ts`)** — and this count is **inclusive of the 8 `tests/scale/` correctness-at-scale files** (the scale harness is part of the suite, not additive on top). The suite spans the invariant, integration, and CPMM/resolution property layers; the ENGINE.10 plan recon estimated ~873 runtime cases across them. The scale battery runs as its own `pnpm test:scale` CI step, and the ENGINE.10 exit gate requires the default suite **and** `test:scale` green.

---

## 5. Standing carry-forwards into later phases

**Closed — no longer carry-forwards** (recon-confirmed on `main`):

- **F-RESOLVE-1** loser-settlement fork — CLOSED at ENGINE.9 (the 0-form; −S struck).
- **"Void floor-at-zero"** — was **mis-filed**. F-RESOLVE-3 (void) refunds a strictly-positive `f × stake`, so no floor is possible or needed; the real floor-at-zero is **F-RESOLVE-2** (correction), which is CLOSED.
- **`frozen_at` write-freeze** — CLOSED for participant writes at ENGINE.16. The resolution + market-admin exemption is **intentional** (§20.3); the earlier "W-3/W-4 freeze gap" flag was over-broad.

**Genuine standing items into DEBATE / HARDEN / LAUNCH:**

- **A-lite / load-test gate — OPEN.** Throughput-at-relaxed-latency replaces p95<500ms (~2–3s user-visible write OK; throughput is the target); **target N is TBD** (5k / 50k / find-the-ceiling), pinned at the A-lite chat (HARDEN.2-PRE). Mechanism note: a 2–3s **in-transaction** lock-hold cuts volume — the relaxed budget must be user-visible, not in-tx.
- **`friendly_fire_events` physical drop — DEBATE.9.** The table + append-only trigger are built but orphaned by the ADR-0017 reply-as-bet model; **intentionally still present**, dropped (with the vestigial `stake_at_post_time` column + stale index) at DEBATE.9.
- **Reply-as-bet LOAD half — deferred to the post-DEBATE.2 k6 stratum** (ENGINE.10 Q-1). The side-bind *correctness* half is covered; the reply-posting *load* half (50 Đ floor + aggregates) is not yet.
- **Single-side × Counter foreclosure (engine→debate seam).** F-BET-10 forecloses the opposite Support/Counter affordance based on the viewer's held side; ruling (1a): **disable-and-explain** the foreclosed side (DEBATE.2 write-path enforcement + the read/UI surface; new item on the DESIGN.5 lock checklist).
- **Number-tuning pass — HARDEN.5 (~2026-09-01).** Pins all ranged economy values (post floor, grant ~1,000, daily ~10) + rate-limit + moderation thresholds.
- **PhotoDNA CSAM onboarding — deferred/parked.** DEBATE.7 wires OpenAI `omni-moderation-latest` (multimodal) only for v1; PhotoDNA hash-match is an operator pre-launch gate.
- **PARKED (Testnet/Mainnet scope, not tracker rows — see `parked.md`):** 50k literal-scale work and the per-user cooldown lever (carries an ADR-level / thesis caveat).

---

## 6. Cross-cutting decisions (the ADRs that govern the engine)

- **ADR-0005** — Postgres event sourcing; Pattern A (synchronous same-tx read-model writes; no async projectors); append-only triggers.
- **ADR-0013** — bet-tx concurrency: SERIALIZABLE, `FOR NO KEY UPDATE` pool lock, canonical lock order `markets → pools → positions → dharma_ledger → events` (P1 `pools → users` suffix; P2 W-3 `markets`-first; P3 W-4 `markets`-first), full-jitter retry, idempotency-first ordering, moderation outside the tx.
- **ADR-0014** — pre-commit moderation: moderation runs **entirely before** the bet+comment tx opens; on a Track A/B verdict the wrapper **never opens** (F-MOD-4 preserved structurally); OpenAI `omni-moderation-latest` + PhotoDNA; 10s Redis SETNX intent-reservation; fail-closed.
- **ADR-0015** — rate-limit / idempotency: Upstash sliding-window + Stripe-style idempotency cache; DB unique backstop (`bets.idempotency_key`) as the deterministic floor.
- **ADR-0016** — UUIDv7 IDs (gives reply "earlier-wins" tie-break for free).
- **ADR-0017** — ranking: multi-lane Top composite + filter modes; reply ranking stake-descending within side (depth=1); read-time computed (no projection table); friendly-fire removed; carries no anti-capital logic (K·n>C upheld by mandatory commentary in the open).
- **ADR-0018** — Dharma issuance + two bet floors (reply floor 50 > post floor; reversal deliberate); flat daily credit paid only on a commented bet; equal initial grant.

---

## 7. Appendix — what the repo retains (safe to prune the PK mirror)

GitHub keeps the full per-stratum set; this record is the index. Repo inventory (recon-listed):

- **`docs/plans/`** — 17 ENGINE plan files (`ENGINE.N.md`; no `.1` plan — `.1` was the spec-landing session).
- **`docs/logs/`** — 23 ENGINE log files, including the `-plan` / `-execute` / `-build-gate` suffix-split variants for `.9`, `.10`, `.14`, `.16`.
- **Naming:** repo uses `ENGINE.N.md` (dot); the PK mirror used `ENGINE_N` (underscore) — the only naming divergence.

When the PK ENGINE files are pruned, **every original remains in GitHub** at the paths above. This record captures the synthesis (SHAs, decisions, carry-forwards, invariants) that the scattered files held collectively.
