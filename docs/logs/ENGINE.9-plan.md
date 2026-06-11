# ENGINE.9 — plan-session log

> **Stratum:** ENGINE.9 — Resolution trio (settle / correct / void) + F-ADMIN-3 trigger:
> `src/server/resolution/` greenfield (W-3 sibling wrapper, four flows, pro-rata basis),
> `market.resolving` mint + 2× `poolUnwindAmount` payload fields, migrations 0014
> (constraints + terminal-once index) and 0015 (nightly-drift zero-terminal fix),
> `I-RESOLVE-ONCE-001`, conservation correction-variant, riders R-A..R-K, ENGINE.14
> boundary per R-9.7. Critical-path money + events + schema; Ultrathink-mandatory.
> **Entry:** plan session only (S1 sync-gate → S2 recon → S3 in-chat draft → round-1
> review → round-2 review + founder ratification → Phase P plan PR). Execute runs in a
> fresh CC session + fresh web chat (§5.8) and logs separately.

---

## Plan session — 2026-06-11

**What landed.**
- `docs/plans/ENGINE.9.md` — the founder-ratified implementation plan (R-9.1..R-9.8 +
  R-9.5e + E-1 + C-1..C-7 + OQ-1..OQ-5/OQ-7 ratifications + review defects D-1 (incl.
  the D2-A extension) / D-2 / D-3 + micro-folds F-1..F-4 folded) — via **PR #112**,
  squash-merged to `main` at **`6e0e55b`** (`ENGINE.9 plan — resolution trio +
  F-ADMIN-3 trigger (docs-only) (#112)`), **docs-only, no reviewer cascade** (plan-PR
  precedent). 941 lines; branch `plan/engine-9`, commit `fbb2520`; one-file diff
  941+/0−; operator merged after CI green + web-lane verbatim diff-verification of all
  four folds (PASS — the carry-forward (3) consistency touch accepted).
- Base: `main @ 28a8305` (S1 sync-gate 7/7 PASS). No `src/`, test, or schema/migration
  changes — plan-only. This log ships on `chore/engine-9-plan-log`.

**Mode pins per phase (stated in every report header; zero Fable→Opus fallbacks).**
- S1/S2 — Phase R recon: `claude-fable-5` (CC ≥ 2.1.170), effort gated-xhigh (max
  on-demand only), ultrathink ON, ultracode OFF, NORMAL mode, ZERO repo writes (S1's
  single permitted state change: `git pull` on main — a no-op). Recon ran
  solo-sequential per the mode pin + standing feedback despite the session-level
  ultracode flag.
- S3 / round-1 fold / round-2 fold — Phase D: CC plan mode ON, zero repo writes;
  deliverable = full draft text in-chat for web-lane line review.
- Phase P: NORMAL mode, named write set only (plan file → PR #112; this log →
  `chore/engine-9-plan-log`).

**Rulings provenance (founder-ratified 2026-06-11; binding, encoded verbatim in the
plan's §Rulings).** R-9.1 (reason NOT NULL all kinds — SPEC.2 B.9 drift exactly
backwards) · R-9.2 (losers: 0-amount payout row, NO ledger row; −S form struck;
winners gross) · R-9.3 (correction never → VOID; void pre-resolution only;
correction-of-correction structurally possible; freeze is the correction deadline) ·
R-9.4 (deadline ceiling, no buffer; in-flight window discharged structurally) · R-9.5
(unwind exits circulation; no admin balance) + R-9.5e (encoding: `poolUnwindAmount`
payload field on the terminal emit, no `pool_unwind` event type) · R-9.6 (no cascade
unwind; floor-at-zero + uncollectable model A; loss visible never silent) · R-9.7
(scope split; ENGINE.14 minted for lifecycle writes — sweep-owned) · R-9.8 (pro-rata
settlement basis after sells; corrections reverse RECORDED rows) · E-1 (web-lane
editorial: §6.1 prose loses to the shipped 409 `market_resolving` mapping). Round-1
added OQ ratifications: OQ-1 (statement_timeout parameterised 1_000/5_000) · OQ-2
(correction projects `markets.resolution_outcome`) · OQ-3 (same-as-tip rejected) ·
OQ-4 (`admin_events` wording → events-row form) · OQ-5 (0015 RIDES, same-commit
doctrine) · OQ-6 (record-only carry-forward) · OQ-7 (broader terminal-once index
`WHERE event_kind IN ('resolve','void')` + `I-RESOLVE-ONCE-001`).

**Session arc.**
1. **S1 sync-gate (7/7 PASS @ `28a8305`).** Clean main, BASE-OK; `src/server/
   resolution/` greenfield on every ref; exactly six `market.*` strings registered,
   NO trigger/"resolving" string (settled F-ADMIN-3's emit question by absence);
   EVENT_TYPES inventory exact-pin `.toBe(22)` = live 22; `resolution_events.reason`
   nullable-for-all on disk (looser than both R-9.1's target and SPEC.2 B.9's
   backwards text); `payout_events.amount` numeric(38,18) NOT NULL with NO sign
   CHECK; 0011's D1/D2 carry no term requiring a loser ledger row (R-9.2 consistent —
   the D2-B `d.id <> l.id` comment tolerates, never assumes); local Postgres `:54322`
   up. S1 flags later consumed: the exact inventory pin (→ same-commit 23), the
   missing sign CHECK (→ 0014), reason nullability (→ 0014).
2. **S2 recon (8/8).** ENGINE.4 transitions pure + unpersisted — discriminated-result
   API, `Resolving → Voided` NOT an edge, zero `markets.status` writers and zero
   `market.*` emit sites repo-wide (ENGINE.9 = first writers); `admin.*` payloads
   session-scoped (can't carry the trigger); ENGINE.5 ledger contracts (the
   `previousBalance` chaining contract names ENGINE.9's reverse+uncollectable pair;
   the `:51-56` per-user serialization warning; uncollectable model A guard the ONLY
   defense); W-1 wrapper facts (flow-agnostic spine, bet-branded gate/errors, the
   reserved W-3 `markets → …` lock slot at `transaction.ts:79-82`); conservation (★)
   argument-fed, NO shipped gathering query; sells decrement positions only (per-bet
   basis undefined on disk); spec pins (SPEC.1 §11/§12.1/§10.3/§6.2, SPEC.2 §3.6/B.8/
   B.9/§19.4.1 — zero market.* STRIP rows, three deferred to ENGINE.9); comment
   locking emergent (coarse gate + Bucket-A). **SURPRISEs 1–5:** (1) per-bet
   settlement basis undefined after sells → closed by R-9.8; (2) no `pool_unwind`
   event type / payload key → closed by R-9.5e; (3) `Resolving → Voided` absent →
   ratified intended (R-9.3); (4) §6.1 vs shipped §15 status→code mapping → ruled
   E-1; (5) R-9.6 gathering dependencies (uncollectable anchor, no gathering query) →
   C-4 anchor + carry-forward.
3. **S3 draft (plan mode).** Full draft in-chat: wrapper, four flows, prorate basis,
   sign table, conservation identities (♦)/(i)/(ii)/(iii) with worked checks, events
   vocabulary, 0014, file plan, riders, invariants table, test plan. Draft SURPRISEs:
   the 0011 D2-B genesis false-positive that R-9.6's floor-to-exact-zero makes
   systematic (→ 0015, OQ-5) and the statement_timeout fan-out hazard (→ OQ-1).
   OQ-1..OQ-7 surfaced for ratification.
4. **Round-1 review (web lane, independent hand re-derivations).** Identities
   verified exact; ONE DEFECT **D-1**: my proposed 0015 clause `Z − L <> 1` is wrong —
   in a valid chain `Z − L = 1 − [terminal at 0]`, legitimate values {0, 1}; the
   proposal false-alarms the just-floored parked-at-zero user. Founder ratified
   OQ-1..OQ-5 (OQ-5 as RIDE), OQ-6 record-only, OQ-7 in broader form. **Truncation
   note:** the round-1 relay cut off mid-sentence at M-1; the lost tail carried
   M-1..M-3. M-1 (execute-ritual step-1 staleness) was folded per inferable intent
   and later confirmed; M-2 was re-relayed in round 2 as fold F-3; M-3 was never
   re-relayed to this lane — ratification proceeded on F-1..F-4, so M-3 is presumed
   absorbed/dropped by the web lane (recorded here for the audit trail).
5. **Round-2 fold + review.** Folding D-1, this lane's re-derivation found the defect
   WIDER than stated: shipped **D2-A** (`sink_count <> 1`) also false-alarms every
   terminal-at-zero chain (the genesis consumption absorbs the terminal zero; no
   net=+1 sink; Σ non-unc = 0) — including round-1's own discriminating fixture (b),
   which is clean under shipped D2-B but NOT under shipped D2-A. Surfaced as
   SURPRISE-1 with the multiset algebra; **web lane independently verified against
   the merged ENGINE.11 log and RETRACTED round-1's "clean under shipped 0011"
   parenthetical** — the both-halves 0015 stands. Round-2 also returned defects D-2
   (blind-spot (1) reframed: fabricated-genesis-at-terminal-zero is
   multiset-invisible by construction — fold F-1) and D-3 (matrix cell: round-1
   formula PASSES case (c), `Z − L = 1` — fold F-2; re-verified before applying),
   plus F-3 (M-2 re-relay: the S4 no-recomputation fixture must be SYNTHETIC — a real
   sell between resolve and correct is product-impossible) and F-4 (COALESCE on the
   zero-sink branch).
6. **Founder ratification** conditional on F-1..F-4 → **Phase P:** folds applied to
   the final text; `plan/engine-9` (name verified free both sides); commit `fbb2520`
   (house identity, `/tmp/engine9-plan-commit-msg.txt`, no co-author trailer); file
   tail verified post-Write (941 lines, zero stray delimiter tokens); PR #112 with
   the two-line provenance body; ★ STOP honored — fold diffs reported verbatim; web
   lane diff-verified PASS; operator squash-merged → `6e0e55b`.

**Defect ledger (full chain, surprises-as-wins).**
- **D-1 (round-1, web lane):** 0015 D2-B formula `Z − L <> 1` defective — corrected to
  `(Z − L) NOT IN (0, 1)`.
- **D-1 extension (round-2, this lane; web-verified + round-1 parenthetical
  retracted):** shipped D2-A false-alarms terminal-at-zero chains; 0015 must correct
  BOTH halves — D2-A's valid forms become `(sink_count = 1 AND sink = Σ) OR
  (sink_count = 0 AND COALESCE(Σ, 0) = 0)`. Pre-existing latent on `main`
  (spend-to-exactly-zero), made systematic by R-9.6's floor; rides ENGINE.9 under the
  same-commit doctrine.
- **D-2 (round-2 → F-1):** residual blind-spot (1) reframed — fabricated genesis at a
  terminal-zero chain is multiset-identical to legitimate history; invisible to EVERY
  order-free check by construction (same fundamental limit as balance-neutral cycles).
- **D-3 (round-2 → F-2):** fix-validation matrix cell (c)/round-1 corrected to
  "clean" (this lane's matrix error).
- **F-4 (nit):** zero-sink branch must not rely on NULL propagation.

**Open questions.** None — all OQs ratified or converted to carry-forwards (plan
§Carry-forwards: gathering scoping ex-OQ-6; symmetric-seed assumption → ENGINE.14;
order-free verification residuals; W-3 timeout values → HARDEN).

**Process verifications & anomalies (recorded).**
- Hygiene clean: branch names verified free pre-`checkout -b` (both branches);
  plan-file tail verified post-Write; unique `/tmp/engine9-plan-*` message files;
  END-ON-MAIN pattern with branch-assert before any reset; ★ STOPs honored at every
  operator gate.
- Anomaly 1: the round-1 kickoff truncation (M-1 tail + M-2 + M-3 lost) — handled per
  the truncation note above; flagged in the round-1 SURPRISE section at the time.
- Anomaly 2: round-1's "clean under shipped 0011" parenthetical for fixture (b) —
  pushed back with algebra rather than folded as stated (CLAUDE.md §4); verified and
  retracted in round 2. The discriminating fixture set (a)/(b)/(c) + positive
  controls is pinned in the plan's I2.

**Next session starts at.** **This chat, Phase P step 3, AFTER this log PR merges:**
END-ON-MAIN (checkout main → pull → confirm clean + HEAD) → stage PK refresh
(`~/Desktop/zz-pk-refresh-ENGINE.9-plan/`: plan + this log FROM origin/main,
md5-verified) → stage the execute-kickoff document on Desktop (NOT committed):
fresh-pair kickoff referencing `@docs/plans/ENGINE.9.md`, mode pin (gated max-effort
candidate — web lane sets the final pin in the execute chat), branch
`feat/engine-9-resolution`, the plan §Execute ritual order verbatim, the NOT-doing
list from §Out of scope → final ★ STOP report. **ENGINE.9 EXECUTE then opens in a
FRESH CC session + fresh web chat — never this one.** Execute step 1 =
`@test-writer` RED suite against the plan's §Test plan (the plan is already on main;
M-1); migration indexes 0014/0015 re-verified at execute (F-2a; head today = 0013).

**Context to preserve.**
- **Canonical plan SHA:** `6e0e55b` (PR #112; branch commit `fbb2520`; 941 lines).
- **The stratum, one line:** W-3 wrapper locks `markets → pools` (consuming
  `transaction.ts:79-82`'s reserved slot; P2 patch record on ADR-0013) → per-flow
  state gate on the LOCKED row → fan-out per R-9.2/R-9.8 (prorate, exact-sum
  last-row remainder) → chained ledger writes (`previousBalance` contract;
  reverse+uncollectable pair per user, earliest-affected-bet anchor) → markets
  projection → ONE terminal emit carrying `poolUnwindAmount` (R-9.5e).
- **0015, one line:** `CREATE OR REPLACE check_nightly_drift()` — D2-B `(Z − L) NOT
  IN (0, 1)`; D2-A valid ⇔ `(sink_count = 1 ∧ sink = Σ) ∨ (sink_count = 0 ∧
  COALESCE(Σ,0) = 0)`; D1/D3 untouched; residual blind spots documented in-file.
- **Environment:** local Postgres `:54322` up (supabase running); CI PR-gated only;
  `/tmp` clobbered between turns (md5-gate at use-time); migration head on disk
  `0013_initial_grant_user_unique.sql` (AGENTS.md's "0012" is recorded stale — fixed
  by the execute file plan).
- **Tracker (operator-maintained — recorded, NOT edited):** ENGINE.9-plan → DONE
  joins the reconciliation queue; ENGINE.14 mint is sweep work (R-9.7).

**Time.** 2026-06-11 (IST). Session arc: S1 sync-gate (7/7 @ `28a8305`) → S2 recon
(8/8; SURPRISEs 1–5) → S3 in-chat draft (OQ-1..OQ-7) → round-1 (D-1; OQ
ratifications; M-1..M-3 truncation) → round-2 fold (D-1 D2-A extension SURPRISE-1;
D-2/D-3; F-3/F-4) → web verification + retraction → founder ratification on F-1..F-4
→ Phase P: `plan/engine-9` `fbb2520` → PR #112 → fold-diff verification PASS →
squash-merge `6e0e55b` → this log (`chore/engine-9-plan-log`).
