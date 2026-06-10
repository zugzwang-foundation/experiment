# ENGINE.12 — session log

> **Stratum:** ENGINE.12 — Daily Credit accrual (lazy): the flat ADR-0018 daily Dharma credit, paid ONCE per UTC day ONLY inside a committed comment-bearing bet, accrued at the `place()` seam. Producer `src/server/dharma/accrual.ts` + the `dharma.credited` emit site + the `users.last_allowance_accrued_at` cursor write + a UNIQUE-partial-expression-index storage backstop + `DAILY_CREDIT_DHARMA` + `I-DAILY-ONCE-001`. Critical-path money code; Ultrathink-mandatory.
> **Entry:** plan session (sync-gated read-only recon → SURFACE → founder rulings R1–R6 + pre-resolved P1–P5 → in-chat draft → web CP review (4 rulings + 3 fixes folded) → WEB GREEN + founder ratification → docs land). Execute session appends below in a fresh CC session + fresh web chat.

---

## Plan session — 2026-06-10

**What landed.**
- `docs/plans/ENGINE.12.md` — the founder-ratified implementation plan (R1–R6 + P1–P5 + R-CP1–4 + F1–F3 folded) — via **PR #102**, squash-merged to `main` at **`ca790ca`** (`ENGINE.12 plan — daily credit accrual (docs-only)`), **docs-only, no reviewer cascade** (ENGINE.7/8 precedent). 416 lines; CI run `27257468866` green; branch commit `a2a4805`; `plan/engine-12` deleted post-merge.
- Base: `origin/main @ c2c7af1` — refreshed mid-session from the kickoff's `1a1cd84` after **PR #101** (the parallel fable5 harness move) merged; zero engine-file overlap (proven at recon S1).
- No `src/`, test, or schema/migration changes — plan-only. This log ships on `chore/engine-12-log`.

**Decisions made — founder rulings R1–R6 (ratified, "best recoms").**
- **R1 — event name: KEEP built `dharma.credited`** (`schemas.ts:83`; payload `:239-245` already carries the `creditedForDate` UTC-day accrual key). SPEC.2 amended to match code — a founder-authorized hierarchy inversion — at `:541` + `:2635` (Appendix **B.12**; the web relay's "B.14" was corrected by CC against the live spec: events appendix = B.13, B.14 = `identity_pool`). Riders ride the execute PR (ENGINE.5 R-3 precedent).
- **R2 — NO `user_events` audit row.** Accrual's complete write set is exactly three: `events(dharma.credited)` + `dharma_ledger(daily_allowance)` + cursor UPDATE — the SPEC.2 `:541` three-part collapse is canonical; riders strike the stale coverage prose at `:477`/`:2635`.
- **R3 — day-guard:** SSI conflict on the cursor IS the mechanism; a UNIQUE partial expression index on `dharma_ledger` is the storage backstop (can only fire on a future logic bug → loud, never double-pays); tx-frozen DB `now()` is the SINGLE day authority (decision read, ledger `created_at`, payload field, index expression — one frozen clock). Discharges `persist.ts:51-56`'s per-user-serialization assignment to ENGINE.12.
- **R4 — the day's credit funds the day's first bet.** `readBalance` → accrue-if-unpaid → friendly pre-check against the POST-credit balance → … → `bet_stake` debit chained off the credit's returned `balanceAfter` (`persist.ts:58-62` — the contract's FIRST live same-user two-row case). Rollback delivers ADR-0018's "paid only on placing a commented bet" by atomicity, not by a check.
- **R5 — accrual lives INSIDE `place()`** (new producer module `src/server/dharma/accrual.ts`); DEBATE.2's reply path inherits it for free via the parameterized write; `sell.ts` untouched (comment-free, never pays).
- **R6 — initial grant OUT of scope.** Recon RC7: zero grant producer anywhere (test fixtures only); no tracker owner. → AUTH-lane tracker row, queued sweep (forwards below).
- *(Raised and withdrawn, pre-kickoff):* a mid-window admin Dharma airdrop / promotion-event lever was raised by the founder and withdrawn in the same exchange — ADR-0018's rejection of bonus/discretionary grants stands as written; nothing reopened.

**Decisions made — pre-resolved web-lane calls P1–P5 (bound in the plan).**
- **P1** — `creditEventId` minted UNCONDITIONALLY at handler entry (the `place/route.ts:64-75` retry-purity block), closed over, USED only when paying; idempotency replay never re-enters the handler → no double-pay path there.
- **P2** — producer obligations absorbed (ENGINE.5 A9/M2, `ledger.ts:38-39`): amount strictly positive (producer-side guard before `appendLedgerRow`); `bet_id = NULL`; per-user serialization = R3; `FLOW_TAGS` gathering-exclusion untouched.
- **P3** — `DAILY_CREDIT_DHARMA = "10"` (decimal string, ranged placeholder) — name ADOPTED from SPEC.1 §16.1; **HARDEN.5** owns the value.
- **P4** — banned users structurally excluded at gate 1 (`endpoint.ts:167-173`, 403 pre-idem) — RECORDED as satisfying the tracker's "banned skip" + SPEC.1 §10.7; no in-callback check.
- **P5** — mint `I-DAILY-ONCE-001` + its invariants spec test (I-NO-OVERDRAFT-001 house pattern).

**Decisions made — web CP review (4 rulings + 3 fixes, folded → WEB GREEN).**
- **R-CP1 (the headline) — D-N1 RATIFIED: cursor-UPDATE-first** → ledger append → event. CC's draft flagged that the racing transaction's FIRST conflicting statement determines the SQLSTATE: cursor-first fires the users-row write-write conflict — deterministically `40001` (retryable → wrapper re-runs → rerun sees the cursor → skips; both bets proceed, the credit pays exactly once); credit-first risks a first-conflict `23505` (NOT in `RETRYABLE_SQLSTATES`) → a hard 5xx on a bet that must succeed. R3's listed order was illustrative; the draft improving the ruling is what the review pass is for. T3 = the empirical tripwire.
- **R-CP2** — **HARDEN.5** (not HARDEN.6) is the value-owner — tracker-verified ("Number-tuning pass … Output: ADR-NUMBERS"); `limits.ts`'s pre-existing HARDEN.6 JSDoc cites = stale → sweep (forwards).
- **R-CP3** — §19.4.1 catch-up rows for ENGINE.7/8's already-emitted types stay OUT: each needs its own STRIP/KEEP privacy ruling on the dataset-release surface; named SYNC-sweep forward; the rider set stays closed.
- **R-CP4** — ADR-0013 gains a §5.12 in-place Patch record as **rider 5**: the canonical lock order extends **`pools → users`** (the first contended non-pool row lock inside W-1); ENGINE.9's outstanding per-user-serialization obligation named as consumer.
- **F1** — T5's crafted-overdraft example was IMPOSSIBLE (post-credit pre-check ⇒ stake ≤ balance ⇒ debit `balance_after ≥ 0` ⇒ the CHECK is unreachable) — the injected post-accrual fault harness is the sole vehicle; the impossibility parenthetical documents why the pre-check is load-bearing.
- **F2** — T3 tightened to exactly-one-TOTAL: one `daily_allowance` row + one `dharma.credited` event across BOTH racing places combined (the loser's event never commits), both bets committed, ≥1 detector-tolerant retry breadcrumb, per-place `bet.placed`/`comment.placed` counts stable.
- **F3** — execute micro-pins: (a) verify `users.updated_at` exists before the cursor UPDATE includes it; (b) migration "0012" = expected-next, re-verify the actual next index at execute; (c) common-path property stated — already-paid days are a PURE READ (no users write, no added lock; ENGINE.10 p95 relevance).

**Recon highlights (Segment 1, load-bearing — full report lives in the session record).**
- `dharma.credited` already registered by ENGINE.0 (`schemas.ts:83`, payload `:239-245`) — schema-only, ZERO emit sites; ENGINE.12 is the assigned producer (ENGINE.5 plan :285). Payload pre-encodes the accrual key → `src/server/events/schemas.ts` is a verified ZERO-edit.
- `users.last_allowance_accrued_at` (the SPEC-named cursor, `auth.ts:47-49`) exists, never written. No day/date column anywhere, no accrual table (`daily_allowance_events` deliberately collapsed, SPEC.2 `:541`), no unique surface on `dharma_ledger`, no day-bucketing helper, no accrual constant in `src/`.
- SPEC.2 event-name drift: `user.daily_allowance_accrued` (`:541`/`:2635`) vs the built name — resolved by R1.
- The pool lock does NOT serialize same-user bets on different markets (`persist.ts:51-56` assigns ENGINE.12 "equivalent per-user serialization") — the exact gap R3 closes.
- Two clocks live on the write path: tx-frozen DB `now()` (ledger rows) vs the handler-entry UUIDv7 ms prefix (`events.created_at`, `insert.ts:58-62`) — resolved: the EVENT-ROW timestamp may diverge; the accrual key never does (`creditedForDate` computes from tx `now()`, never from the event_id).
- Ban enforcement: `users.banned_at` rejected at gate 1 pre-idem (F-BET-7) — a banned user cannot reach the bet write path at all.

**Process verifications & anomalies (recorded).**
- **Model:** `claude-fable-5`, effort xhigh, all segments; no classifier fallback to Opus 4.8 observed. The ultracode toggle was ON at Segment 1 (recon nonetheless ran solo-sequential per the MODE PIN); operator toggled OFF for Segments 2–4 (confirmed in report headers).
- **S1 worktree deviation (benign, proven):** the recon worktree sat on `chore/fable5-upgrade`; merge-base = origin/main tip `1a1cd84` and the branch diff set was disjoint from every recon-read file → all recon cites byte-identical to main. Branches not switched (parallel-lane safety).
- **Mid-session base refresh:** PR #101 merged → base `c2c7af1`; recon validity preserved by the S1 disjointness proof.
- **Relay-loss event (process):** the first Segment-3 relay was never executed — the web lane received the unfolded Segment-2 draft back and detected it via named-artifact tells (status line, STOP footer, the P3 CP-flag, "ADRs needed: None", pre-fix T3/T5 text) BEFORE any gate advanced; the re-issue opened with an idempotency state probe (no branch, no PR → first run; executed clean). The named-artifact verification protocol is what caught it; no repo or decision damage.
- **CI shape note:** `gh run list --branch main` is empty by design (PR-gated CI); main-lineage health is read via the merged PR's run.

**Open questions.** None.

**Forwards & queued notes (minted this session).**
1. **AUTH-lane tracker row (R6):** the initial-grant producer is unowned (recon RC7: fixtures only) — mint/amend a row carrying the `persist.ts:51-56` per-user-serialization warning. → queued tracker sweep.
2. **DEBATE.2 obligation:** the reply route mints `creditEventId` at ITS handler entry when it reuses `place()` (recorded in the plan's carry-forwards).
3. **ENGINE.9 residue:** owes its own per-user serialization for resolution writes; rider 5's ADR-0013 §5.12 Patch record names it as consumer.
4. **§19.4.1 privacy catch-up (R-CP3):** `bet.placed`/`bet.sold`/`comment.placed` STRIP/KEEP rulings → SYNC sweep.
5. **`limits.ts` stale HARDEN.6 JSDoc cites** (value-owner is HARDEN.5) → sweep.
6. **AGENTS.md §9 invariant inventory stale** (pre-existing; deepens by one when I-DAILY-ONCE-001 lands) → SYNC sweep per CLAUDE.md §7.
7. **Tracker reconciliation queue grows:** the ENGINE.12-plan row → DONE joins the pending sweep; the ENGINE.12 row's "first authenticated write" trigger prose = recorded drift, no action (ADR-0018 :85 + SPEC.1 §10.4 bind: only a commented bet pays; a comment-free sell never does).

**Next session starts at.** **ENGINE.12 EXECUTE in a FRESH CC session + fresh web chat** (§5.8 — never this session). Mode pin: `claude-fable-5` / effort xhigh / ultrathink / NOT ultracode; FULL ritual. Step 1 = sync-gate (HEAD `ca790ca`+; `docs/plans/ENGINE.12.md` present on main) → branch `feat/engine-12-daily-credit`. Step 2 = `@test-writer` RED (T1–T8 + T10 + the additive-touch set, against `@docs/plans/ENGINE.12.md`). Step 3 = PROBE (drizzle-kit partial-unique-EXPRESSION index; F3b next-index re-verify; hand-written fallback pre-planned). Then implement `accrual.ts` → `place.ts`/`route.ts` seam → `limits.ts` → schema → riders 1–5 → gates → cascade `@code-reviewer` → `@security-auditor` → **`@db-migration-reviewer` (REJOINS — first since ENGINE.5)** → §5.10 self-audit → log append + PR → squash. **Do NOT start execute in this chat.**

**Context to preserve.**
- **Canonical plan SHA:** `ca790ca` (PR #102; branch commit `a2a4805`).
- **The ruled accrual unit, one line:** in `place()` between `readBalance` and the pre-check — one decision read (cursor + tx `now()`) → if unpaid: cursor UPDATE FIRST → `appendLedgerRow(daily_allowance, betId NULL, chained)` → `insertEvent(dharma.credited, dharma_account)`; the pre-check and the `bet_stake` debit run against / chain off the post-credit balance; an already-paid day is a pure read.
- **Backstop DDL candidate:** `CREATE UNIQUE INDEX dharma_ledger_daily_allowance_day_uq ON dharma_ledger (user_id, ((timezone('UTC', created_at))::date)) WHERE entry_type = 'daily_allowance'` — expression-immutability verified at execute; Bucket A untouched.
- **Environment:** local Postgres `:54322` CI-gated convention; `/tmp` clobbered between turns (md5-gate at use-time).
- **Tracker (operator-maintained — recorded, NOT edited):** ENGINE.12-plan done; ENGINE.12-execute next; ENGINE.10 remains gated on ENGINE.8 + ENGINE.9 + ENGINE.12.

**Time.** 2026-06-10 (IST). Session arc: kickoff → Segment 1 recon (plan-mode, read-only; report with 7 surprises + 7 open questions) → web SURFACE (6 rulings + the pre-resolved set) → founder "best recoms" → Segment 2 in-chat draft (D-N1 flagged by CC) → web CP review (R-CP1–4 + F1–F3) → Segment 3 fold/commit (first relay lost in transit; re-issue with state probe, first-run clean) → PR #102, CI `27257468866` green → founder squash-merge `ca790ca`, branch deleted → this log (`chore/engine-12-log`).

---
