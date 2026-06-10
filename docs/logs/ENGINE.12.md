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

## Execute session — 2026-06-10

**What landed.** ENGINE.12 execute, squash-merged to `main` as **`af61ce5`** (PR **#104**, CI run `27270073245` green, 1m55s + Vercel pass). The 5-commit branch story (branch SHAs ephemeral, recorded for the audit trail): `3cbfaf8` RED set (T1–T8 + T10 + RC9 additive touches; 9 test files) → `55d6722` 0012 backstop index (PROBE: drizzle-kit CAN express the partial UNIQUE expression index — generated path, hand-written fallback unused; F3a `users.updated_at` exists, F3b true-next = 0012) → `7f1c9d9` implementation + riders 1–5 (`accrual.ts` producer, R4 `place()` seam, P1 mint-site, `DAILY_CREDIT_DHARMA`, SPEC.2 :541/:477/B.12/§19.4.1 + ADR-0013 §5.12 Patch record `pools → users`) → `c422f9c` decoder fix (S1) → `5304016` gate-adjudicated test fixes (W-RULE-2/3, S4/S5).

**Mode pins.** `claude-fable-5` (exact ID `claude-fable-5[1m]`), ultrathink every turn, ultracode OFF after the operator reset cleared a harness-injected session flag (turn-1 injection only; verified by absence thereafter; the TUI status-line label adjudicated cosmetic/stale). Zero Fable→Opus fallbacks across the whole session. Effort not in-context-readable; operator-side `xhigh` uncontradicted.

**Decisions made / rulings consumed.**
- Web RED green-light: R-RED-1 (T8b scope guard ratified), R-RED-2 (T3 rendezvous latch = scheduling device, not a fault vehicle; F1 governs fault injectors only), R-RED-3 (`DharmaInputError` is module-local at `@/server/dharma/errors`).
- **W-RULE-1** (blocking, pre-PR): §5.7 critical-path gates must run locally before the PR — local Postgres was down all session and CI is PR-gated, so "ride CI" mischaracterized the gate. Docker Desktop + `supabase start` brought `:54322` up in-session (no operator action; note: `/usr/local/bin/docker` is a broken symlink to a stale `/Volumes/Docker` mount — the live CLI is the app bundle's).
- **W-RULE-2** (S4 fix): T8/T8b RED-set fixture used bare `+00`-offset T-form literals — Invalid Date in V8 → postgres-js bind-serializer `RangeError` before any SQL. Format-only fix to `+00:00`; `+05:30` case kept; constraint name/23505 matcher/scope assertions byte-identical.
- **W-RULE-3** (S5 fix, authorized beyond-plan touch): pre-existing ENGINE.5 fixture (`dharma-ledger.integration.test.ts`) wrote two same-user same-UTC-day `daily_allowance` rows — illegal by design post-0012; the +25 row's `entry_type` → `bet_payout` (canonical positive tag, no bespoke core guard, in-file precedent), zero assertion lines touched. The backstop firing here (23505, right constraint, right key) was the invariant's first empirical proof.

**SURPRISE trail (S1–S5).** S1 — `sql<Date>` tx-clock fragment had NO runtime decoder (drizzle/postgres-js parses timestamptz transparently): every place would have 500'd unretryably; invisible to tsc/T10/local-DB-down; caught by `@code-reviewer` (CRITICAL), fixed `c422f9c` via `.mapWith(users.lastAllowanceAccruedAt)` (borrows the cursor column's own decoder — congruent operands, single-clock at runtime), security-covered, re-gated. S2 — W-RULE-1 above (gates initially unexecuted anywhere). S3 — administrative: `@db-migration-reviewer`'s commit-inventory delta (c422f9c postdated its kickoff; it IS the S1 fix). S4/S5 — the two gate-adjudicated test-file defects above.

**Gates (final, local Postgres `:54322`, post-0012 apply).** 0012 apply `[✓]`; catalog proof: `CREATE UNIQUE INDEX dharma_ledger_daily_allowance_day_uq ON public.dharma_ledger USING btree (user_id, ((timezone('UTC'::text, created_at))::date)) WHERE (entry_type = 'daily_allowance'::dharma_entry_type)` — PG-17 accepted = expression immutability proven; CI's postgres:17 migrate on PR #104 is the second, independent apply proof. Tallies: invariants **15/15** (I-DAILY-ONCE-001 rejection fires live) · integration **92/92** · test-db **78/78** · bets suites **36/36** (T1–T5 incl. THE RACE T3, T6, T7, six RC9) · unit **284/284** (T10) · full vitest **665/0** · `ZUGZWANG_ENV=preview just verify` pass.

**Cascade.** `@code-reviewer` (1 CRITICAL→fixed; P1 mint-site PASS, seam/cycle PASS, invariants PASS) → `@security-auditor` (zero blocking; five money surfaces SOUND; one LOW: mid-flight ban pays one credit — admin-gated, within spec per P4/SPEC.1 §10.7/SPEC.2 §8.6) → `@db-migration-reviewer` (all PASS; snapshot round-trip empirically no-drift) → §5.10 self-audit CLEAN (amended to CLEAN-PENDING-§5.7 by W-RULE-1, then discharged by the local gate run).

**Open questions.** None blocking. The mid-flight-ban LOW is recorded as within-spec (no action). AGENTS.md §9's invariant-inventory line remains stale (now 5 specs on disk) — owned by the periodic SYNC sweep, per plan.

**Carry-forwards (minted/affirmed for successors).**
- **DEBATE.2:** the reply route MUST mint `creditEventId` at ITS handler entry when it reuses `place()` (one line; `PlaceParams.creditEventId` is now required).
- **ENGINE.9:** still owes its own per-user serialization for resolution writes — named as consumer in the ADR-0013 §5.12 Patch record (`pools → users` canonical order).
- **§19.4.1 catch-up rows** for `bet.placed`/`bet.sold`/`comment.placed` (pre-existing ENGINE.7/8 gap) — SYNC-sweep forward (R-CP3).
- **R6 — AUTH-lane tracker row:** mint/amend a row for the **initial-grant producer**, carrying `persist.ts` D-2's per-user-serialization warning (the grant writes sit outside the pool lock).
- **Maintenance sweep:** `.env.local` lacks `DATABASE_URL` — the committed `tests/_setup/env.ts` default (`postgresql://postgres:postgres@localhost:54322/postgres`) was passed inline for the local migrate; environment-hygiene note (also: the broken `/usr/local/bin/docker` symlink).

**Tracker (operator-maintained — recorded, NOT edited).** ENGINE.12-plan → DONE and ENGINE.12-execute → DONE, both queued for the reconciliation sweep (threshold met — the sweep is its own small chat, not this session). ENGINE.10's gate now has only ENGINE.9 outstanding.

**Next session starts at.** The tracker reconciliation sweep (own chat), or ENGINE.9 per the tracker's sequencing — operator's call.

**Context to preserve.** Canonical execute SHA: `af61ce5` (#104). The accrual unit's load-bearing one-liner for successors: decision read = ONE statement (cursor + `now()` via `.mapWith` — the decoder is load-bearing, see S1); cursor-first write order (D-N1) makes the same-user race a retryable 40001, never the index's 23505; the paid day is a pure read. Local DB now RUNS on this machine (`supabase start`; Docker Desktop via `open -a Docker`).

**Time.** 2026-06-10 (IST). Session arc: sync-gate → post-switch mode reset → `@test-writer` RED (scratchpad #1 → web GREEN + 2 pins) → RED commit → PROBE (generated 0012) → implement + riders → gates (unit-proxy) → cascade (S1 CRITICAL→fix) → scratchpad #2 → web CODE-GREEN + W-RULE-1 → local Postgres up in-session → real gates (S4/S5 surfaced, adjudicated W-RULE-2/3, fixed, 665/0) → PR #104 → operator byte-check (artifacts a–f) → squash `af61ce5` → this log.
