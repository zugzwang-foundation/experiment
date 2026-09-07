# LIQ-1 Phase 2 — execute log

**Task:** LIQ-1-P2-EXEC · ADR-0047 Phase 2, the signup-pegged injector
**Session:** 2026-09-07, one session (the plan budgeted two)
**Worktree:** `/Users/hrishikesh/code/zugzwang/liq-p2` · branch `liq-1/phase-2`
**Base:** `origin/main` @ `84d57563` (after FIX-1 #494)
**Report:** `~/Downloads/zz_LIQ-1-P2_exec_2026-09-07T0920.md`

---

## What landed

| commit | subject |
|---|---|
| `1725306f` | `docs(plan): LIQ-1 Phase 2 — signup-pegged injector` *(cherry-picked — the plan file, which lived on an unmerged branch)* |
| `24a6d6b8` | `docs(plan,adr): LIQ-1-P2 — seven rulings; §4 FUNCTION pattern; Gate C wording` |
| `0802b36d` | `feat(events): the injection gets a name, a shape, and a place in the dataset` |
| `a6142218` | `fix(cpmm): addLiquidity quotient at p=120 — oracle matches exact SQL` |
| `8aaf4168` | `feat(db): migration 0027 — the injector, and the guards that come with it` |
| `465c1005` | `test(db): pin the injector against the database, not against the design` |
| `4c6be1ba` | `feat(markets): teach the money path and the chart that depth can grow` |
| `38aff3c5` | `feat(markets): nothing new opens after the freeze` |
| `0135ec62` | `feat(config): a single bet is a contribution, not an event` |
| `938f8c29` | `docs: the specs stop describing a system with three doors` |
| `53ee3083` | `fix(db): migration 0028 — a ceiling on the number the safety argument rests on` *(reviewer round 1)* |
| `26d820f8` | `fix(markets): the freeze gate was reading whichever row it found first` *(reviewer round 2)* |
| `4cec6f47` | `fix(db): migration 0029 — the ceiling I set was above the value that breaks it` *(reviewer round 3)* |

**PR:** [#496](https://github.com/zugzwang-foundation/experiment/pull/496) — **DRAFT**, deliberately.
Gate C on a migration is the founder's. #492 (the plan-only PR) closed as superseded.
**Canonical SHA:** the squash-merge SHA on `main`, once Gate C passes — branch SHAs are ephemeral.

**Final gate:** `473 files, 4778 tests, 0 failures` · `just verify` all three legs exit 0
(tsc, biome, `next build`) · `db:check-drift` IN SYNC (30 applied) · `drizzle-kit check` clean.
**Diff artifact:** `~/Downloads/zz_LIQ-1-P2_diff_2026-09-07T1815.patch` — 20,295 lines, md5 `690c8ba8693d6acd40d8d8e3fbeaa718`.

Every one of T1–T14 landed. Migration head is now **`0029_liquidity_policy_ceilings_tightened`**.
Spec versions: `cpmm.md` **4.0.0**, `SPEC.1` **2.0.1**, `SPEC.2` **1.0.31**.

---

## Decisions made

**All ten rulings applied as given.** The three that changed the shape of the work:

- **R8 — a `FUNCTION`, not a `PROCEDURE`.** One transaction per sweep, a subtransaction
  per market, no `COMMIT` in the body. The plan had reasoned its way to the opposite for a
  real reason (a per-market COMMIT holds one pool lock instead of eight), so the cost is
  stated in the migration itself rather than buried, and bounded by a test. What it buys
  back is larger: no `SET LOCAL` reset to remember, no half-swept transaction, and the
  version-sensitive `COMMIT`-inside-`EXCEPTION` interaction cannot arise at all. **The
  advisory lock became transaction-scoped as a consequence** — it now releases on error
  too, which matters on exactly the path the ADR Runbook prescribes.
- **R4 — the policy ships disabled.** Migrations reach production before the code that can
  read what they write. Arming is one INSERT. The heartbeat was decoupled from it: it
  records that the JOB ran, never that it injected, because a system quiet on purpose and
  a system that has died must not look the same.
- **R5 — `BET_MAX_STAKE` 10000 → 250.** Depth and the largest single bite out of it are
  one question asked twice.

**Two decisions taken at execute, beyond the rulings:**

- **The R-1 contention assertion was split** rather than asserted-and-flaky. See below.
- **`liquidity_heartbeat` IS a SPEC.2 §5.1 row.** The plan said otherwise on a misreading
  of which inventory §19.3 excludes the pg_cron tables from.

---

## Surprises caught + fixed in-session

**Three defects in the ratified plan, each found by a test rather than by reading:**

1. ⛔ **T8's SQL summed keys the payload does not carry.** The plan reads
   `payload->>'discardedYes'` / `'discardedNo'`; ADR §F carries **`discardedSide` +
   `discardedShares`**, because an injection discards on exactly one side where an open
   discards on both. The plan's form would have returned **0 forever** — no error, green
   tests, every settlement short by the whole injected discard on a terminal append-only
   row. Found by the T8 fixture, which `@test-writer` wrote from the ADR rather than from
   the plan.
2. ⛔ **Plan §5's negative control cannot fail as specified.** `trunc(a*s/l, 18)` against
   the exact floor: **0 mismatches at 18-dp literals** — the faithful shape, since the
   reserve columns are `numeric(38,18)` — and 884 at natural scale. A control that always
   passes certifies nothing. It runs at natural scale instead.
3. ⚠ **Plan §9 R-1's "zero bet failures" is not true as written.** Measured with a
   control: **0 failures without the injector, 1 in 48 with one fired simultaneously with
   every bet.** Not caused by R8 — at one market both shapes hold the row the same span,
   and the cause is simply that a second writer now exists. Production exposure is far
   below that rate, which is conditional on a collision the 60-second schedule makes rare.
   The case is split: the production cadence asserts zero failures; the adversarial arm
   asserts what is stable and matters — **a losing bet leaves nothing behind**.

**Three more, in the tree rather than the plan:**

4. **T1's first fix moved the defect instead of removing it.** Widening only the DIVISION
   produced a result one ulp HIGH where the old code was one ulp LOW. The fuzz found it at
   1,755 cases and shrank to `L == 2S`; a fixed vector never would have, because the two
   regimes do not overlap. The whole bracket is now inside the wide constructor.
5. **A source-scan guard caught the comment explaining the absence it guards.**
   `is-frozen-surface.test.ts` matched raw text, and the docblock saying *`isFrozen()` must
   NOT be used here* counts as a use. Sixth instance in this repo of that shape; fixed at
   the root by stripping comments, and `open.ts` moved to a new
   `GATED_WITHOUT_THE_HELPER` list that asserts **both** halves.
6. **My own k-door source scan asserted a writer list I wrote from memory.** It named two
   files including one that does not write `pools`. The scan corrected it to three —
   `open.ts`, `bets/place.ts`, `bets/sell.ts` — which is the better answer: three source
   writers plus the migration is exactly §7.4's four doors, nothing left over.

**And three more from the reviewer cascade, every one a defect I had shipped:**

7. ⛔ **The freeze gate read `system_state` without `WHERE id = 'system'`, and failed
   OPEN.** Both its siblings filter; this was the cheapest possible divergence from two
   working precedents, on the one surface CLAUDE.md §3 names by name. `system_state` is a
   singleton by CONVENTION — the Bucket-B guards reject UPDATE/DELETE/TRUNCATE but **not
   INSERT** — and flipping the freeze is an UPDATE, which writes a new tuple, so an
   unqualified `LIMIT 1` can return the other row. **No existing test could see it**: they
   all truncate and re-seed exactly one row. Proven by restoring the defect.
8. **`MarketFrozenError` had no arm in `toActionError`** → `error_internal` plus the Sentry
   capture reserved for wire bugs. `wire.ts` documents that exact failure one error class
   over. **A plan that mints an error type and does not name the wire map produces this
   every time.**
9. ⛔ **The market status was read outside the row lock and never re-checked**, so an
   injection could land on a market mid-settlement — backing the terminal, append-only
   payout row does not account for, with no edge out of `Resolved`. My own
   `only-Open-markets-are-touched` tested the CURSOR FILTER, not the TRANSITION, which is
   exactly why it passed.

**And two more from the security audit, the first of which overturned my own round-1 fix:**

10. ⛔ **The `lock_timeout_ms` ceiling I set at 250 was ABOVE the value that breaks the
    money path.** I took the migration reviewer's suggested number without doing the
    arithmetic against the measured market count. The auditor did it: at 8 markets with 7
    pool rows held, 250 ms gives a 1,776 ms sweep and a bet-shaped statement dies at
    1,004 ms with a `57014` the bet path does not retry. **A ceiling that blesses the
    failure it was added to prevent is worse than none, because it reads as a guard.** And
    the shipped 100 ms leaves only ~55 ms of margin at staging's ten markets —
    participant-reachable. `0029` tightens it to 100 **and** adds a total-sweep budget,
    which is the half that holds at any market count.
11. ⛔ **`0028` ceilinged the two RECOVERABLE parameters and left the IRREVERSIBLE ones
    open.** `floor = 99999999999999999999` was accepted; one tick turns a 100,000 tank into
    1e20 on every market, and **there is no drain path** — `pools` has no reduce-liquidity
    writer, `events` is Bucket A, `k` only grows. Realistically the three-extra-zeros typo.
    `0029` bounds `floor` and `coefficient`.

**And two Phase-1 debts the census found**, recorded as debts rather than as this phase's
changes: SPEC.1 §15 F-ADMIN-2's System bullet and its Carry-forward-2 **invariant** both
still described symmetric seeding, which shipped code contradicted a phase ago. On a
spec↔code conflict the spec wins, so a later session would have "corrected" `open.ts`
back.

---

## Open questions

- **The R-1 rate is a founder call.** Options are (a) accept it given the production
  cadence — what shipped; (b) raise the bet path's retry budget; (c) `NOWAIT` on the
  injector's pool lock, which the plan rejects because a bet in flight is the normal case.
- ~~**Migration `0027` has no `ON CONFLICT` on its `events` INSERT.**~~ ✅ **ANSWERED by
  `@db-migration-reviewer`, and more strongly than it was asked:** adding it would be a
  **defect**, not a match. `insertEvent` needs `DO NOTHING` because the W-1 wrapper
  re-runs its callback on a `40001` retry with the *same* caller-minted `event_id`; the
  injector mints a fresh one per row inside a transaction that commits or rolls back
  whole, so the only route to a conflict is a genuine UUIDv7 collision. And `DO NOTHING`
  would **silently decouple the `UPDATE pools` from its event row** — reserves moving with
  no named door, breaking `k-door::every-reserve-write-has-exactly-one-event-row`,
  `replayReserveSeries` and `sumInjectionDiscards` at once. Kept as-is.
- **`liquidity_undershoot` is one GLOBAL watermark**, so a second market going under
  target is silent until the first clears — and the endgame window makes that routine
  rather than exceptional. Recorded in the ADR §Runbook; per-market keying is a future
  decision, not this PR's.
- **L-11, carried forward:** each market opens a subtransaction, and above **64** in one
  transaction PostgreSQL overflows the PGPROC subxid cache and forces `pg_subtrans`
  lookups on every concurrent reader. At 8–14 markets this is far away, but it is a
  second, *sharper* cliff than R-11's linear one and no document named it before now.
- **`reply-is-a-bet-replier-side-not-parent` flakes under full-suite load** (34 s against
  a 10 s timeout; 1.02 s in isolation). Untouched by this branch. Not investigated.
- **The `a` argument's display scale is never exercised at anything but 18 dp** —
  `@test-writer`'s own note. `div()` measures scale-independent, so it is a coverage gap
  rather than a defect.
- ⛔ **`docs/parked.md` LIQ-1 L-10 — ADR-0019's own tripwire may have fired, and it is NOT
  ESTABLISHED.** On the local Supabase stack `anon` holds full DML on `pools`, `events`,
  `dharma_ledger` and `users` with RLS off, plus `EXECUTE` on `run_liquidity_injection`.
  ADR-0019 rules RLS out of scope on the premise that no third party holds a database
  connection, and names a public Data API as the condition that reverses it — and Supabase
  enables that API by default. **The hosted projects were not measured** (no credentials in
  a review session; `.env*` is a hard Never), so this is a question with a command attached,
  not a finding. If it is on, the consequence PRE-DATES LIQ-1; what LIQ-1 adds is remote
  reachability for the irreversible-depth typo. **Check before 15 Sep.**
- **`system_state` has no singleton constraint** (LIQ-1 L-8). This PR fixed the reader half;
  the writer half is what makes a reader fix necessary at all.

---

## Next session starts at

**Gate C on the PR, then the §8 staging soak — in that order, and the soak is post-merge.**

The exact next action after merge: **push `staging` BEFORE the branch** (`O-10` — Vercel
dedups the same SHA across refs), let `staging-migrate.yml` and `/api/health` go green,
then `pnpm staging:rebuild`, then **arm it**:

```sql
INSERT INTO liquidity_policy
  (version, coefficient, floor, trigger_ratio, guard_low, guard_high,
   endgame_hours, lock_timeout_ms, enabled, effective_from)
VALUES (2, 500, 100000, 0.80, 0.02, 0.95, 72, 100, true, now());
```

…and **verify a `liquidity_heartbeat` row within 120 s**. Until that INSERT runs, the
injector is a no-op and `liquidity_silence` is not evaluated — which is the deliberate
gap the 120-second check closes.

---

## Context to preserve

- **Staging measured at preflight:** `/api/health` canary `84d57563…` == `origin/main`,
  `region bom1`, 14 pools, PostgreSQL 17.6, pg_cron 1.6.4. ⚠ **`cron.job` holds jobid 1
  and 3 — jobid 2 is missing**, which is direct evidence that a registration there failed
  once and nothing reported it. That is the argument for `liquidity_silence`, measured on
  the environment it will run on.
- **`k` on staging:** 14 pools, 13 with `k > k_at_open`, one exactly at it (never bet),
  none below, **none without a genesis row**. The ADR said "all twelve … `k > seed²`".
- **Local supabase HAS pg_cron and CI does not.** Applying `0027` locally registers a job
  that writes a heartbeat every minute, which makes heartbeat-counting tests flaky. Both
  jobs were **unscheduled locally** after applying, so local mirrors CI's substrate. A
  fresh clone that applies `0027` must do the same.
- **`liquidity_policy` is a TRUNCATE exclusion on staging with its guard ARMED**, and
  `liquidity_heartbeat` is in `NOT_TRUNCATED_UNRATIFIED`. Two tables, one migration, two
  different lists, on purpose.

---

## Time

One session, 2026-09-07, ~09:20Z → close. The plan estimated **≈ 28 h across two
sessions**; it ran in one. The estimate was not wrong about the work — the census and the
migration were both as large as it said — but `@test-writer` running in parallel with the
migration build (a §7 row-1 deviation, measured harmless) removed the longest serial leg.
