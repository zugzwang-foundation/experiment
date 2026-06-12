# ENGINE.9 — execute session log

> **Task:** the resolution stratum — `src/server/resolution/` (greenfield): F-ADMIN-3
> trigger, F-RESOLVE-1 settle, F-RESOLVE-2 correct, F-RESOLVE-3 void, the W-3 wrapper,
> the pure prorate basis, migrations 0014/0015, riders R-A..R-K, ADR-0013 §5.12 P2,
> `I-RESOLVE-ONCE-001`. Single source: `docs/plans/ENGINE.9.md` (founder-ratified
> 2026-06-11; rulings R-9.1..R-9.8 + R-9.5e + E-1 binding — none reopened).
> **Status:** MERGED — PR #114, squash SHA on `main` = **`af2856603f87d2a4dcb1594ae897879b83cad38a`**
> (canonical reference SHA; branch SHAs below are ephemeral and the branch is deleted
> both sides).
> **Mode pin:** Claude Code on `claude-fable-5` (exact id `claude-fable-5[1m]`), CC
> 2.1.170; effort **max** (operator-typed `/effort max`, session-only — the ENGINE.7
> money-code precedent over the gated-xhigh default); ultracode **OFF** (critical
> path); subagents `@test-writer` / `@db-migration-reviewer` / `@code-reviewer` /
> `@security-auditor` pinned `claude-fable-5` / `xhigh`, all four engaged at their
> ritual slots. One execute session paired with one web gate chat (§5.8).

---

## What landed (files + PR)

**PR #114** (squash → `af28566`), 36 files, +11.6k/−38 net of the six branch commits:

- `src/server/resolution/` (7 NEW): `transaction.ts` (W-3 wrapper — markets→pools
  locks, SERIALIZABLE, full-jitter 40001/40P01 retry, OQ-1 parameterised
  statement_timeout 1000/5000), `errors.ts`, `basis.ts` (prorate + applySideBasis +
  refundBasis + producer sign guards), `trigger.ts`, `settle.ts`, `correct.ts`,
  `void.ts`.
- `src/server/dharma/conservation.ts` (EDIT, additive): `checkCorrectedMarketConservation`
  — identity (ii); shipped (★) body byte-untouched.
- `src/server/events/schemas.ts` (EDIT): `EVENT_TYPES` 22 → 23 (`market.resolving`);
  `poolUnwindAmount: numericString` on `market.resolved`/`market.voided` (R-9.5e).
- `src/db/schema/events.ts` (EDIT) + `drizzle/migrations/0014_resolution_constraints.sql`
  (NEW): `reason` NOT NULL (R-9.1), kind↔outcome + corrects-link CHECKs (R-9.3),
  per-type sign CHECK (C-6), terminal-once partial unique index
  `resolution_events_terminal_market_uq` (OQ-7).
- `drizzle/migrations/0015_nightly_drift_zero_terminal_fix.sql` (NEW): full
  `CREATE OR REPLACE check_nightly_drift()` — D-1 both halves (D2-B `(Z−L) NOT IN
  (0,1)`; D2-A zero-sink branch with the F-4 COALESCE); D1/D3/edge-link clause (i)
  byte-identical to 0011 (diff-verified); residual blind spots documented in-header.
- Tests (13): the full §Test plan charter — U1–U3, S1–S6, V1
  (`I-RESOLVE-ONCE-001.market-terminates-once.spec.ts`), I1–I2, E1 — minted RED-first
  by `@test-writer` at `38bcdce`, flipped green by S2/S3 without narrowing; plus the
  authorized 5-line `reason: "initial"` fixture fix in 3 pre-existing append-only
  specs.
- Docs: SPEC.1 → 1.0.3 (riders R-A..R-E + R-J + the S6 Response rename + §20 row);
  SPEC.2 → 1.0.3 (riders R-F..R-K + §0.1 row); ADR-0013 §5.12 **P2 patch record**
  (W-3 consumes the reserved `markets → …` slot; global order markets → pools →
  positions → dharma_ledger → events; P1 `pools → users` suffix preserved; W-1
  zero-line diff); CLAUDE.md §1/§2 + AGENTS.md §3/§6/§9 touch-ups.

**Branch commit chain (ephemeral):** `38bcdce` S1 RED suite → `e8a955c` S2 migrations
→ `9b38ae3` S3 implementation (S4 folded) → `10831b5` fixture fix → `f272a8f` S5
riders → `837fdd6` S6 rename fix.

## S0 → S7 narrative (per-gate outcomes; web-gate facts attributed)

- **S0 — sync gate (zero writes): 8/8 PASS.** Main clean at `4206eb0`, BASE-OK, plan
  on main, `src/server/resolution/` zero-history greenfield on every ref,
  EVENT_TYPES 22 live + `.toBe(22)` pin intact, migration head 0013, Postgres :54322
  up, branch name free both sides. Gate opened by web after verification.
- **S1 — RED suite.** `@test-writer` minted 12 new test files + the E1 edit (4,036
  inserted lines): 13 files / 48 collected → 17 right-reason RED + 31 GREEN, with 58
  tests carried in 9 collection-RED greenfield files. All fixture arithmetic
  hand-derived and re-verified in the main loop; one agent prose tally slip (9
  collection-RED files, not 7) corrected from its own table. **Web gate:** every
  fixture value independently re-derived from the CPMM formulas (k = 10⁴ preserved
  per leg; the sell quadratic P = 50 exact; the 1/7-family floors at 18 dp; the
  remainder provably on the max-UUID row) and the I2 Z/L/sink truth table rebuilt
  from the raw row sequences — matched cell-for-cell.
- **S2 — schema + migrations 0014/0015.** F-2a re-verified (head 0013); 0014
  generated (5 clauses, clause-identical to the plan's verbatim SQL); 0015
  hand-written (4-hunk diff vs 0011, mechanical); both applied to :54322; flip table
  exactly as predicted (V1 2→GREEN, I2 3→GREEN, controls stayed GREEN; 12 RED / 36
  GREEN). `@db-migration-reviewer`: PASS ×4, zero FAIL, two benign SURPRISEs
  (0015_snapshot.json required artifact — committed; plan-prose CHECK-count slip —
  PR-body note). **Web gate:** D2-B (`Z−L = 1−[terminal at 0]`) and the D2-A multiset
  identity re-derived independently; 0014 verified clause-by-clause against the
  plan's verbatim SQL; reviewer SURPRISE-2 ruled "verbatim SQL governs, plan not
  amended".
- **S3 (+S4 folded) — implementation to green.** Main-loop implementation (no
  subagent — tightly-coupled per §5.11). The §19.4.1 same-commit foot-rule forced the
  S4 fold: `insertEvent`'s Zod registry rejects unregistered types/fields, so emit
  sites cannot split from registration. Charter went 106/106 green (the 6 DB-backed
  flow suites first-run green); full suite 762/5 — the 5 fails being the S2
  `reason NOT NULL` ripple into 3 pre-existing fixture files, surfaced as SURPRISE
  and NOT absorbed (outside the authorized edit set). **Web gate:** conservation
  identities verified exact to 18 dp against the S1 derivations; the S4 fold ratified
  as structurally forced; the fixture fix authorized as its own pre-S5 commit;
  zero-leg evidence demanded and resolved (3 zero legs in-event — see prose-slip
  record).
- **Step A + S5 — fixture fix, then riders.** Fix commit `10831b5` (+5 lines, zero
  assertion changes) → all three gates green for the first time (vitest 767/0/2/5,
  tsc clean, `just verify` green) → branch pushed. S5 landed riders R-A..R-K +
  ADR-0013 P2 + CLAUDE/AGENTS touch-ups, docs-only (`f272a8f`). **Web gate:** every
  rider before-text anchor grep-verified against the PK doc mirror; SPEC.2's 1.0.2
  changelog confirmed R-I discharges the deferred §19.4.1 obligation; the plan
  References' "SPEC.1 v1.9.0-draft" found stale vs the live 1.0.2; the SPEC.1
  §20/1.0.3 pairing ratified (PR-body note 5); PK's ADR-0013 mirror noted pre-P1
  (mirror lag, not repo drift).
- **S6 — pre-PR stop, tripwire halt, resume.** §5.10 self-audit 25 PASS / 0 FAIL.
  `@code-reviewer` on the full branch: zero CRITICAL/HIGH, one MEDIUM
  (`voidEventId` name collision — a plan §W-3d naming defect, faithfully
  implemented), four LOWs → **hard-discipline tripwire fired: halted at Step 2**, no
  fixes, report shipped with the proposed diff. **Web gate ruled the halt correct;
  MEDIUM-1 → disposition (a) RENAME** (`voidResolutionEventId` — an ENGINE.10 wiring
  hazard on a greenfield wire surface; settle/correct symmetry), **LOW-1 + LOW-3
  authorized in the same fix commit, LOW-2 → HARDEN carry-forward.** Resume: fix
  commit `837fdd6` (rename + load-bearing semantic test pins + SPEC.1 Response line
  + LOW-1 prorate per-row ≥ 0 assert + LOW-3 AGENTS.md alphabetical order);
  `@code-reviewer` delta **APPROVE** (zero findings); `@security-auditor` on the full
  branch **APPROVE** (zero CRITICAL/HIGH/MEDIUM; two LOWs + two INFOs explicitly
  requiring no file change — **web ruled them ENGINE.10 handoffs, approved tree not
  reopened**); gate battery all green: `just verify` ✓ · invariants 9 files/20 ·
  integration 11/103 · test-db 24/83 · full vitest **767 passed / 2 skipped / 5 todo
  (774), zero failures** (L-E13).
- **S7.1 — PR #114 opened** (squash posture; body = Summary / Evidence / Notes 1–7 /
  Carry-forwards / Commit chain; W-1 zero-diff stated; no generated-with footer per
  the Foundation identity discipline). CI: Vercel pass, `ci` pending at report time —
  went green; **operator merged**. **S7.2 — this log** (own docs-only PR).

## Decisions made (this session — all gate-ruled, none unilateral)

- S4 folded into S3's commit (foot-rule, pre-authorized; structurally forced).
- S2 fixture ripple = SURPRISE, not absorbed; fixed only after explicit gate
  authorization, as its own commit BEFORE S5 (gate re-sequenced it).
- S6 tripwire: halt at the first change-requiring finding; web ruled MEDIUM-1 (a)
  rename, LOW-1/LOW-3 in the fix commit, LOW-2 deferred.
- Security LOW/INFO items: ENGINE.10 handoffs (actor-identity assertion at call
  sites; `reason` max-length at the form boundary; cumulative-uncollectable
  gathering), approved tree not reopened.
- SPEC.1 §20/1.0.3 pairing row added per convention, flagged not absorbed — ratified.

## PR-body notes (1–7, verbatim from the S6 report / PR #114)

1. Plan-prose CHECK-count slip — the verbatim 0014 SQL governs (3 CHECKs total: 2
   `resolution_events` + 1 `payout_events`); plan not amended.
2. S2 `reason SET NOT NULL` ripple into 3 pre-existing fixture files — fixed in
   authorized commit `10831b5` (+5 `reason: "initial"` lines, zero assertion
   changes).
3. S4 folded into S3's commit (`9b38ae3`) per the §19.4.1 same-commit foot-rule —
   structurally forced by the `insertEvent` Zod registry.
4. Zero-leg prose correction: the correction event writes 6 legs, 3 of them zero;
   "four" was the market-wide count incl. the settle's loser row. Test assertions
   were always exact.
5. SPEC.1 §20 row + 1.0.3 bump added per the established pairing convention (beyond
   the plan's literal R-A..R-E listing).
6. The plan's References cite "SPEC.1 v1.9.0-draft" — stale citation; the live file
   was 1.0.2 (now 1.0.3). Plan not amended.
7. Reviewer MEDIUM-1: plan §W-3d named both the input arg and the response field
   `voidEventId` (two different ids). Gate ruling: disposition (a) rename — response
   field → `voidResolutionEventId`, semantics pinned in tests, SPEC.1 §11 Response
   line updated; plan not amended. Fixed in commit `837fdd6` together with
   authorized LOW-1 (prorate per-row ≥ 0 assert) + LOW-3 (AGENTS.md alphabetical
   order).

## Carry-forward register

| # | Carry-forward | Owner |
|---|---|---|
| 1 | Production conservation-gathering scoping — sell-proceeds ledger rows are `bet_id` NULL, so per-market gathering needs the `bet.sold` payload or a (user, market) join; must sum cumulative `uncollectable` rows + recorded reverse legs across N-deep chains (reinforced by security INFO-1) | ENGINE.10 / HARDEN (ex-OQ-6) |
| 2 | Symmetric-seed assumption (`Y₀ = N₀`) in void's cash cross-assert — ENGINE.14 must preserve it or revisit; breaks loud, never silent | ENGINE.14 |
| 3 | Order-free drift verification cannot see balance-neutral cycles or fabricated-genesis-at-terminal-zero histories (0015 migration comment) | HARDEN observability candidate |
| 4 | W-3 statement-timeout values (1000/5000) re-tune alongside W-1's; void-on-Open exhaustion soft-DoS (security INFO-2) folds in | HARDEN (ADR-0013 posture) |
| 5 | **NEW (S6 LOW-2):** sign validation (≥ 0) on `checkCorrectedMarketConservation`'s `reverseRecordedTotal`/`applyRecordedTotal`/`uncollectableTotal` operands — a sign-flipped operand silently flips identity (ii) instead of throwing | HARDEN (gathering-query stratum) |
| — | ENGINE.10 security-handoff notes (riding the register, not new carry-forwards): assert `actor_id === 'admin-singleton'` / `user_id === null` at the resolution call sites; `reason` max-length bound at the admin form boundary | ENGINE.10 |

## Prose-slip record (reports, never artifacts — all caught and corrected in-session)

1. **S3 report:** "six payout legs incl. four zero legs" — the correction event
   writes **3** zero legs (L-reverse, R-apply, P-apply); "four" was the market-wide
   count including the settle's loser row. Resolved at S5 with live row evidence;
   test assertions were always exact.
2. **Security-auditor header:** "Diff scoped … (7 commits)" — 6 actual branch
   commits; the miscount originated in my R3 briefing prompt and propagated to the
   verdict header. Findings unaffected.
3. **Code-reviewer delta §6:** cited LOW-2's surface as
   `src/server/resolution/conservation.ts` — the actual path is
   `src/server/dharma/conservation.ts` (the original review had it right). Untouched
   either way.

## Drafted learnings (L-E9.x — for web review at this PR's gate)

- **L-E9.1 (foot-rule fold is structural, plan for it).** The §19.4.1 same-commit
  rule is mechanically enforced by the `insertEvent` Zod registry — an emit site and
  its schema registration cannot be split across commits even in principle. Plans
  that step-split "flows" from "schemas.ts edit" (S3 vs S4 here) should pre-declare
  the fold instead of relying on a gate pre-authorization mid-execute.
- **L-E9.2 (NOT-NULL migrations ripple into minimal fixtures).** A hardening
  migration on an existing column breaks every pre-existing test fixture that
  INSERTs minimal rows into that table — at tsc AND at runtime, in suites the
  migration stratum's flip-table scope didn't name. The S2 "re-run ONLY the DB-gated
  suites" scope missed the three append-only specs; caught only at S3's tsc. Rule:
  a column-hardening migration's verification scope = every suite that INSERTs into
  the altered table (grep, don't enumerate from memory).
- **L-E9.3 (pin return-shape semantics in the RED suite, not `toBeDefined()`).** The
  `voidEventId` arg/response collision survived plan review, test-writing, and
  implementation because the RED suite pinned the field only as `toBeDefined()`.
  Wire-surface response fields should be pinned semantically from RED (=== the row
  they name, ≠ adjacent ids) — that pin would have surfaced the plan's naming defect
  at S1 instead of at the S6 reviewer cascade.
- **L-E9.4 (regenerate report numbers from commands, not recall).** Three
  independent prose slips (zero-leg count, commit count, a module path) each
  survived an otherwise-exact report while every command-generated number was right.
  Counts and paths in gate reports should be emitted by the same command evidence
  that backs them, never restated from memory.

## Open questions

None for ENGINE.9 (OQ-1..OQ-5 + OQ-7 ratified and consumed; OQ-6 → carry-forward 1).
Pending elsewhere: the tracker sweep (below).

## Next session starts at

The **tracker sweep** (its own chat, sweep-owned per R-9.7): ENGINE.9 → DONE rows +
the **ENGINE.14 mint** (F-ADMIN-1 create, F-ADMIN-2 seed/open + dormant `pool_seed`
activation, the close transition, the three remaining `market.*` emits + STRIP rows;
ENGINE.10 + UI.6 gain ENGINE.14 as a dep). The sweep is due. After it, the tracker names the next
stratum — ENGINE.14 now precedes ENGINE.10 on the dep graph (R-9.7), so expect
ENGINE.14 (market lifecycle writes) before ENGINE.10 (admin HTTP surface — composed
trigger→settle endpoint, resolution error envelopes, the three security-handoff
items above) unless the sweep re-sequences. The close-out staging step
(END-ON-MAIN + `~/Desktop/zz-pk-refresh-ENGINE.9/` with `-plan`/`-log` dest
suffixes, md5-verified) is its own gated step after THIS log PR merges.

## Context to preserve

- Canonical SHA `af28566` (PR #114 squash). Branch deleted both sides.
- Local :54322 carries 0014/0015 applied (`__drizzle_migrations` = 16); the V1/I2
  suites depend on them.
- `markets.status` writes now exist (first in the codebase — trigger/settle/void);
  ENGINE.14 adds the lifecycle half (create/open/close) and must preserve the
  symmetric seed (carry-forward 2).
- The W-3 wrapper deliberately DUPLICATES W-1's retry helpers (C-3) — do not
  "deduplicate" them in later strata; W-1 untouched is a standing constraint.
- `resolution_events.reason` is NOT NULL — any future fixture inserting that table
  must supply it (the L-E9.2 class).
- Effort pin `/effort max` was session-only; next session reverts to gated-xhigh
  default unless re-pinned.

## Time

One execute session, 2026-06-12 (S0 sync gate → S7.2 log), paired with one web gate
chat. Strata: S0 gate · S1 RED · S2 migrations · S3+S4 implementation · Step A
fixture fix · S5 riders · S6 audit/reviewers/battery (incl. tripwire halt + resume)
· S7.1 PR · S7.2 log.
