# LIQ-1 Phase 2 — the signup-pegged injector

> **Plan mode.** Written under `LIQ-1-P2-PLAN`. No `src/`, `drizzle/` or
> `docs/specs/` file was edited producing it. Every number below was measured;
> §7 and §9 carry the commands.

---

## §0 Ground state, base, and the HALT check

| | |
|---|---|
| **Worktree** | `/Users/hrishikesh/code/zugzwang/liq-p2plan`, branch `docs/liq-1-p2-plan` |
| **Cut from** | `liq-1/phase-1` @ **`3888ee90d727c624724a4a70282308466874c6fa`** |
| **PR #491** | OPEN · not draft · MERGEABLE · base `main` · `headRefOid` = `3888ee90` — **matches** |
| **`origin/main` at read time** | `0bf84b055095b6e16b777bc1cbc434d4906174a1` |
| **This plan's target base** | **`main` after #491 merges.** Every `file:line` below is against `3888ee90`; the squash SHA will differ and line numbers may shift. Fences are by SYMBOL (`O-8`), and line numbers are evidence, not anchors. |
| **Migration head (measured)** | `0026_lots_no_delete`; `_journal.json` last `idx` 26 ⇒ **next free `0027`** |
| **ADR ceiling (measured, `ls docs/adr/`)** | `0047` ⇒ next free `0048`. **No new ADR** — ADR-0047 governs; §5.12 riders are spec amendments |
| **Spec versions (measured, each file's own §0)** | `cpmm.md` **3.0.0** · `SPEC.1` **1.0.49** · `SPEC.2` **1.0.29** |

### HALT check — the five §0 files, hashed at the recorded HEAD

```
6056d0bd0914442ea193d0dab9976053  src/server/markets/backing.ts
5baa9a552eb7c8b66e51a0d2f52ff54d  src/server/resolution/settle.ts
32520df53382a128b3e28143d3c38007  src/server/resolution/void.ts
40d022cdd144045031fd0228b86a3f62  src/server/discovery/price-series.ts
3431582d6391770c1bf2f30d1f5b6d39  src/server/events/schemas.ts
```

Re-hash all five at execute. **Any difference means #491 changed under review and
this plan must be rebuilt**, because §2's task graph is written against these
exact bodies.

### ✅ VERIFIED AT EXECUTE — 2026-09-07, `LIQ-1-P2-EXEC`

| gate | measured |
|---|---|
| Base | `origin/main` @ **`84d57563cd079a458fe443e422effabd62e6eb95`**, worktree `/Users/hrishikesh/code/zugzwang/liq-p2`, branch `liq-1/phase-2` |
| FIX-1 (#494 `18cd027f`) | merged — `git merge-base --is-ancestor` passes |
| Deadline clamp | present: `fixtures.ts` `DEADLINE_CEILING_MARGIN_MS` + `resolutionDeadlineFor` |
| The five hashes | **all five identical** to the table above |
| Staging `/api/health` | `canary` = `84d57563…` — **equals `origin/main`**; `env staging`, `region bom1`, `db ok`, `migrations ok` |
| Staging `count(*) FROM pools` | **14** |
| Staging substrate | PostgreSQL **17.6**, pg_cron **1.6.4**; `cron.job` holds jobid **1** and **3** — jobid 2 is missing, direct evidence for R-2 that a registration already failed here once and nothing reported it |
| Staging `k` | 14 pools · 13 with `k > k_at_open` · 1 exactly at it (never bet) · 0 below · 0 without a genesis row |

⛔ **ONE DRIFT, AND IT MOVES §6. `SPEC.1` IS NOT `1.0.49`; IT IS `2.0.0`.**
`0bf84b05` rebaselined it per D-29 *after* this plan was written. Consequences, each
re-measured at HEAD rather than inherited:

- **The version bump is `2.0.0 → 2.0.1`**, not `1.0.49 → 1.0.50` (**R3**: patch-bump
  whatever §0 measures; never write `1.0.50`).
- **§17 NO LONGER EXISTS.** §0 reads *"§17–§19 and §21–§23 are intentionally absent
  (D-29); numbering is retained for cross-reference stability."* Row **B-8** asked for
  two rows in §17's spec-rule table. **B-8 is VOID as written** — see its row.
- **The Non-goals bullet relocated.** It is no longer §11; the 2.0.0 change log records
  *"five prescriptive sentences relocated (§3.2 NG6–NG15…)"*. Row **B-6**'s site is
  **§3.2 `NG13`**.
- **Every SPEC.1 line number in §6 is stale.** Re-measured, by symbol: §10.5 · §10.6 ·
  §15 `F-ADMIN-2` · §16.1 (the `POOL_SEED_PER_MARKET` row) · Appendix B (the
  `POOL_SEED_PER_MARKET_DEFAULT = TBD` line) · §20 Change Log. All six exist and carry
  the quoted text; only their coordinates moved.

`cpmm.md` **3.0.0** and `SPEC.2` **1.0.29** are unchanged and match the plan.

⚠ **The kickoff named `src/server/markets/price-series.ts`. No such file exists.**
The file is `src/server/discovery/price-series.ts` — the one #491 changed and the
one ADR §I describes. Hashed above under its real path. Not a halt: one file of
that name exists and it is the file under review.

---

## §1 What this plan does NOT do

Stated first so a reader does not go looking.

- **No new ADR.** ADR-0047 is accepted and governs both phases.
- **No change to the bet transaction.** Driver 4. `place.ts`, `sell.ts` and
  `bets/transaction.ts` are untouched. The injector is a *second* `pools` writer
  that takes the same lock in the same order.
- **No `dharma_ledger` row for any injection.** R-2. `pool_seed` / `pool_unwind`
  stay dormant.
- **No `pools` column.** ADR §E permits proposing one "only with a measured
  reason (a query cost inside `settle`/`void` under the pool lock)". §9 R-6
  measures the cost and finds none. Events it is.
- **No velocity guard.** RECON-2 §10.6 measured it anti-correlated with the
  trigger.
- ⚠ **`BET_MAX_STAKE` IS CHANGED HERE — this bullet is REVERSED by ruling R5.** It
  read *"NOT changed here … a founder call, not a plan call"*; the founder has since
  made that call and the answer is **land it in Phase 2**. `limits.ts` moves
  `"10000" → "250"` in its own commit (**T14**), the Appendix B row is pinned rather
  than withheld (**R6**), and fixtures staking above 250 are adjusted — **never the
  assertions**. Corrected in place rather than appended, because a reader reaching this
  list first would otherwise go looking for a change the plan told them was absent
  (`O-5`).

---

## §2 Task graph

Dependencies are hard unless marked *soft*. Commit grouping follows the LIQ-1-P1
decision: **the smallest unit that compiles**, not one commit per task.

```
        ┌── T1  addLiquidity exactness  (OD-1)
        │        │
        │        └──────────────┐
  T2  EVENT_TYPES + payload     │
   + .strict() + 3 count pins   │
        │                       │
  T3  liquidity_policy schema   │
        │                       │
        ├── T4  migration 0027 ─┴── T5  differential fuzz (SQL <-> TS)
        │        │
        │        ├── T6  staging guard interlock
        │        └── T7  heartbeat + alarms
        │
  T8  backing.ts SECOND query ──┬── T9  conservation callers (5 sites)
                                └── T10 price-series injection replay
  T11 openMarket freeze gate (L-4)          [independent]
  T12 @deprecated computeResolvedUnwind     [independent, soft on T1]
  T13 SPEC amendments — the §6 census       [rides its code commit, §5.12]
  T14 BET_MAX_STAKE 10000 -> 250  (R5)      [independent]
```

| Commit | Tasks | Why grouped |
|---|---|---|
| **C1** | T1 + its cpmm.md §7.1/§13 rider | One function body + the spec sentence it changes (`O-9`). ⚠ **R1 fixes the message: `fix(cpmm): addLiquidity quotient at p=120 — oracle matches exact SQL`.** The rider still rides it — a ruling that names a commit is naming the unit, not excluding the same-commit spec edit §5.12 requires |
| **C2** | T2 + T3 **+ census row C-5** | The payload schema and the table it references type-check together. ⚠ **R10 pulls C-5 forward into this commit**: SPEC.2 §19.4.1's SHIP row for `pool.liquidity_added` lands in the same commit as the event type, or PR #435's export build throws on an undeclared type |
| **C3** | T4 + T6 + T7 | The migration and the two catalogues that break the moment it applies |
| **C4** | T5 | Needs C3 applied to a live local Postgres |
| **C5** | T8 + T9 + T10 | `requireMarketDiscards` widens; conservation and replay consume it |
| **C6** | T11 + T12 | Two small independent surfaces |
| **C7** | T13 remainder + `docs/logs/LIQ-1-P2.md` | Spec sites with no code partner |
| **C8** | T14 + its Appendix B row | **R5**: `BET_MAX_STAKE` is its own commit. A 40× cut on the participant bet path shares a commit with nothing |

---

## §3 Per task: file, change, proving test

### T1 · `addLiquidity` must be EXACT, not precision-50 — **OD-1**

**File:** `src/server/cpmm/calculate.ts`, symbol `addLiquidity` (currently
`:139–175`).

**Change.** The shipped body computes `a·S/L` on `CpmmDecimal` (precision 50) and
then `floor18`s it. **Measured: that is one ulp low on a reachable input class**
(§9 M-1). Where the exact quotient lands on an 18-dp boundary *and* `a·S` needs
more than 50 significant digits, decimal.js rounds the product first, the quotient
reads `…09799999999999999999999` instead of `…098`, and `floor18` drops a whole
ulp. Measured rate at `S == L`: **0.000% below 1e7 reserves, 6.2–6.9% at and above
1e8**; **0 of 50,000 at the D-14 90:1 skew.**

Replace the quotient with one taken on a locally cloned constructor at
`precision: 120`, quantized down to 60 dp before re-entering the 18-dp path:

```
S' = floor18( S + HI(a)·HI(S) / HI(L) )     HI = CpmmDecimal.clone({ precision: 120 })
```

**Why 120 is provably enough, not merely large.** The exact quotient is rational
with denominator `L`, an integer once scaled by 10^18 and bounded by
`NUMERIC(38,18)` at 10^38. Its distance from any 18-dp boundary is therefore
either exactly zero or at least `1e-56`. A 120-significant-digit rounding of a
quantity below `1e20` perturbs by at most `1e-100`. **`1e-100 < 1e-56`, so the
rounding cannot cross a boundary** — floor18 is the exact floor for every input
the column can hold.

**Everything else in the function is unchanged**, including the residual
(`discarded := a − (S′ − S)`), which is what keeps the backing identity exact
whichever way `S′` lands.

**Proving test** — `tests/unit/cpmm/liquidity.property.test.ts`, RED first:

1. `liquidity::exact-at-symmetric-reserves-above-1e8` — a fixed vector taken
   from the measured failure set: `yes = no = "412210715.000275296202860772"`,
   `a = "259972213.000482476402074098"`. Asserts `no' == "672182928.000757772604934869" + 1e-18`
   i.e. exactly `S + a`, and `discardedNo == 0`. **Reds on today's body.**
2. `liquidity::floor-is-exact-across-magnitudes` — fast-check over
   `[1e2, 1e18]` with the three adversarial families forced (`S == L`,
   `L == 2S`, 90:1), comparing against an independent BigInt reference computed
   in the test. ≥ 10,000 cases.

⚠ The existing `liquidity.property.test.ts` suite must stay green unchanged —
this is a correction inside the same formula, not a new contract.

**Rider (same commit, §5.12 + `O-9`).** `cpmm.md` §7.1's `addLiquidity` paragraph
and §13's module-API comment both describe the computation; both name a §.
Amendment text in §6 row **A-1**.

**OD-1 — RULED (R1): fix it.** *"Quotient on a locally-cloned `precision: 120`
`CpmmDecimal` constructor, then `floor18`."* Its own commit, message verbatim:
`fix(cpmm): addLiquidity quotient at p=120 — oracle matches exact SQL`. The
`cpmm.md` A-1/A-8 riders ride that commit (§5.12).

---

### T2 · `pool.liquidity_added` — the event type, and the FIVE same-commit edits

**Files:**

| file | symbol | change |
|---|---|---|
| `src/server/events/schemas.ts` | `EVENT_TYPES` | append `"pool.liquidity_added"` — 24 → **25** |
| `src/server/events/schemas.ts` | `eventPayloadSchemas` | new `z.object` (fields below) |
| `src/server/events/schemas.ts` | `"market.opened"` union | `.strict()` on **both** arms (Small) |
| `tests/server/events/insert.test.ts` | `:626–658` enumeration + `:659` | add the member; `.toBe(24)` → `25` |
| `tests/server/admin/markets-media.test.ts` | `:321` | `.toBe(24)` → `25` |
| `tests/server/admin/moderation/act.test.ts` | `:513` | `.toBe(24)` → `25` |

⚠ **THREE count pins, not two** (RECON-2 §9d). The fourth hit,
`audit-search-surface.component.test.tsx:211`, is `toBeGreaterThan(0)` — an N1
positive control, **not** a count pin; do not touch it.

**Payload** (ADR §F), all money/share/price fields `numericString`:

```
marketId · policyVersion · target · tankBefore · tankAfter
reservesBefore { yes, no } · reservesAfter { yes, no }
backingMinted · discardedSide · discardedShares
priceYesBefore · priceYesAfter
```

`discardedSide` is `z.enum(["YES","NO"])`. `aggregate_type` is `"market"`,
`aggregate_id` the market id — **no new `aggregate_type`**, so the closed
9-value `AggregateType` set in `insert.ts` is untouched.

⚠ **`.strict()` on the union arms is load-bearing, not tidiness.** The arms are
disjoint on `seedAmount` XOR `yesReserves`, but `z.object` *strips* rather than
rejects, so a legacy-shaped payload carrying stray asymmetric keys parses as the
legacy arm and silently reads back a symmetric seed on a money path. `.strict()`
is measured-safe against the `satisfies` bound — `schemas.ts:136` records that
`.strict()` satisfies it as-is.

**Proving tests.**
- `tests/server/events/insert.test.ts` — the extended enumeration + the three
  pins (these red immediately on the `EVENT_TYPES` append; that is the intended
  ordering).
- `tests/unit/events/opened-payload-strict.test.ts` (new) — a legacy payload
  with an extra `yesReserves` key **throws**, and each clean arm parses. RED
  before `.strict()`.

---

### T3 · `liquidity_policy` — the Drizzle declaration

**File:** `src/db/schema/liquidity.ts` (**new**), exported from
`src/db/schema/index.ts`. A new file rather than a row in `markets.ts`, because
the table is not market-scoped — one row governs every market — and because a
new *file* is how this repo allocates a schema unit (`O-15`: allocate by
filename).

**Bucket A — append-only.** Columns per ADR §G:

| column | type | notes |
|---|---|---|
| `id` | `uuid PK DEFAULT uuidv7()` | AGENTS.md §6 |
| `version` | `integer NOT NULL` | monotone; `UNIQUE` |
| `coefficient` | `numeric(38,18) NOT NULL` | Đ per signup |
| `floor` | `numeric(38,18) NOT NULL` | Đ |
| `trigger_ratio` | `numeric(38,18) NOT NULL` | |
| `guard_low` / `guard_high` | `numeric(38,18) NOT NULL` | |
| `endgame_hours` | `integer NOT NULL` | |
| `lock_timeout_ms` | `integer NOT NULL` | |
| `enabled` | `boolean NOT NULL` | see **OD-4** |
| `effective_from` | `timestamptz NOT NULL DEFAULT now()` | |
| `created_at` | `timestamptz NOT NULL DEFAULT now()` | |

`floor` is a reserved word in some dialects but not in Postgres as a column
identifier; Drizzle quotes identifiers, and the migration will too. ⚠ It IS a
function name — every reference in the injector body must be qualified
(`p.floor`, never a bare `floor`), or the parser resolves the function.

**Index:** `liquidity_policy_effective_idx` on `(effective_from DESC, version DESC)`
— the newest-wins read is the only query.

**Proving test:** `tests/db/triggers/liquidity-policy-append-only.spec.ts` (T6).

---

### T4 · Migration `0027` — the whole runtime

**Filename: `0027_liquidity_injector_pg_cron.sql`.**

⚠ **It MUST match `*pg_cron*` because it carries a `cron.schedule` line**
(RECON-2 §8c rule 3, inverted from the `0015` case). CI's strip is a `sed` range
over `drizzle/migrations/*pg_cron*.sql`:

```
sed -i -e '/^CREATE EXTENSION IF NOT EXISTS pg_cron/d' \
       -e '/^SELECT cron\.schedule(/,/^);$/d' "$f"
```

Both patterns are `^`-anchored and the terminator is exactly `^);$`. So the
registration block **must start at column 0** and **close with a line that is
exactly `);`** — no indentation, no trailing comment. Everything else in the file
is preserved and applied by CI, which is what makes the function directly testable
there (`0011`'s precedent).

**No `CREATE EXTENSION`.** `0007` owns pg_cron; `0011:22` says so explicitly, and
LIQ-1 **L-3** records that `0007`'s `WITH SCHEMA extensions` clause is already
wrong-but-inert. Do not repeat it.

The file, in order:

**(a) `liquidity_policy` + its three Bucket-A guards.** DDL per T3, then the
three shared trigger functions the existing guards use — `bucket_a_no_update`,
`bucket_a_no_delete`, `bucket_a_no_truncate` — attached by name, reusing the
functions `0003`/`0021` already ship. **Three catalogue rows.**

**(b) `liquidity_heartbeat`** — an OPERATIONAL table, deliberately **outside**
the bucket families, following `watermark_state` / `cron_alarms` (`0007`), which
carry no guards and are excluded from the dataset inventory entirely
(SPEC.2 §19.3). Columns: `id bigserial PK`, `ran_at timestamptz NOT NULL DEFAULT now()`,
`markets_considered integer NOT NULL`, `markets_injected integer NOT NULL`,
`policy_version integer NULL`, `run_id uuid NOT NULL`. Index on `(ran_at DESC)`.

⚠ It must NOT be `bucket_%`-named or the G-4 catalogue count moves and the
staging reset tries to disable a guard on a table it never truncates.

**(c) `zz_add_liquidity(yes, no, amount)`** — the ADR §A primitive in SQL,
`RETURNS TABLE(yes, no, backing, d_yes, d_no)`, `LANGUAGE plpgsql IMMUTABLE`.
The one line that matters, **measured** (§9 M-2):

```sql
s_prime := s + div(p_amount * s * 1000000000000000000::numeric, l)
               * 0.000000000000000001::numeric;
```

Three measured facts behind that line, each of which a plausible alternative gets
wrong:

1. **`trunc(a*s/l, 18)` is NOT safe.** `scale()` of a numeric division is
   dividend-dependent: measured `scale(1/3) = 20`,
   `scale((1.5*2.5)/7.000000000000000000) = 20`, `scale((a*s)/l) = 36`. The guard
   digits are an accident of the operands, not a guarantee.
2. **`div()` truncates toward zero** (measured `div(7,2)=3`, `div(-7,2)=-3`).
   All three operands are positive by the CHECKs below, so truncation is floor.
   A `CHECK (p_amount > 0 AND p_yes > 0 AND p_no > 0)` at the top of the body is
   what keeps that true; **it is a correctness precondition, not validation.**
3. **Every intermediate must be unconstrained `numeric`.** `a*s*1e18` reaches
   `1e58` at the column ceiling — measured, no overflow — but a
   `numeric(38,18)` cast anywhere in the chain raises `numeric field overflow` at
   `10^20`. Cast only on the final assignment into `pools`.

`floor18(S + x) == S + floor18(x)` holds because `S` is an exact multiple of
`1e-18` (the column is `NUMERIC(38,18)`), which is what licenses splitting the
floor across the sum.

**(d) `run_liquidity_injection()` — a `FUNCTION`, not a procedure (⚠ REVERSED by
ruling R8).** The eleven steps of ADR §D, per market, in **one transaction for the
whole sweep**, with a subtransaction per market:

```
  advisory: pg_try_advisory_xact_lock(<key>)  -- overlap guard; RETURN if not acquired
  read policy once  (newest effective_from <= now(), version DESC)
  if no policy OR not p.enabled OR system_state.frozen_at IS NOT NULL:
      INSERT liquidity_heartbeat (considered 0, injected 0) ; RETURN   -- R4
  SET LOCAL lock_timeout = p.lock_timeout_ms       -- ONCE, at the top (R8)
  target := max(p.floor, p.coefficient * (SELECT count(*) FROM users))   -- ONCE per tick
  FOR each market in status 'Open':
      skip if now() + endgame_hours >= market.resolution_deadline
      BEGIN  -- subtransaction; two EXCEPTION arms (R8)
      lock markets row, then pools row      -- markets -> pools, ADR-0013 P2/P3
      tank := yes + no ;  skip if tank >= p.trigger_ratio * target
      price := no / tank ; skip if price > p.guard_high or price < p.guard_low
      a := L * (target / tank - 1)          -- SIM-2 §0a, derived and checked
      apply zz_add_liquidity
      UPDATE pools
      INSERT events (pool.liquidity_added)
      EXCEPTION
          WHEN lock_not_available -> skip this market, note nothing
          WHEN OTHERS             -> INSERT cron_alarms, skip this market
      END                                   -- no COMMIT: R8, one tx per SWEEP
  INSERT liquidity_heartbeat                -- on EVERY tick, R4
                                            -- no unlock: xact-scoped, R8
```

Five decisions inside that, each with its reason:

- ⚠ **A `FUNCTION` called with `SELECT f()`, not a `PROCEDURE` called with `CALL`
  — RULED (R8), and this bullet previously argued the opposite.** The `0007`/`0011`
  precedent is `SELECT f()`, and matching it is the ruling's stated ground. The
  consequence is real and is stated rather than buried: **the whole sweep is one
  transaction**, so a pool row locked at market 1 stays locked until the sweep ends,
  where the procedure shape would have released it at that market's COMMIT. Bounded,
  measured, and bounded again by a test: `lock_timeout` is 100 ms and the loop is
  eight markets, so the worst-case hold is ~0.8 s against the bet path's 1,000 ms
  `statement_timeout` and its 4-attempt `[50,100,200]` backoff. **R-1's contention
  test is what makes that a measurement instead of an argument, and R8 makes it the
  load-bearing test of this task.** What the ruling buys back is worth the trade: no
  `COMMIT` in the body means no `SET LOCAL` reset (see below), no half-swept
  transaction visible to a reader, and an `EXCEPTION` handler whose interaction with
  `COMMIT` no longer has to be reasoned about at all.
- **`SET LOCAL lock_timeout` is issued ONCE, at the top.** With no `COMMIT` in the
  body there is nothing to reset it. **Measured against PostgreSQL 17.6 at execute:**
  after a per-market subtransaction rolls back, `current_setting('lock_timeout')`
  still reads the value set at the top (`137ms` in the probe). A `SET LOCAL` issued
  outside a subtransaction is not undone by that subtransaction's rollback.
- **A per-market `BEGIN … EXCEPTION … END` subtransaction, two arms.**
  `WHEN lock_not_available THEN NULL` — a bet holds the row; the trigger is still
  true and the next tick is 60 s away, so a skipped market self-heals and there is
  nothing to retry inside the tick. `WHEN OTHERS THEN` record `SQLSTATE` + `SQLERRM`
  + the market id to `cron_alarms` and move on, so one bad market cannot cost the
  sweep. **Measured at execute:** with market 3 raising `22012`, markets 1 and 4
  still wrote, market 3's write rolled back, and the handler's own `INSERT` survived
  — `considered=4 injected=2 rows={1,4} alarms={market-3:22012}`.
- ⚠ **The advisory lock becomes `pg_try_advisory_xact_lock`** (R-7 is amended to
  match). The session-level form was chosen *because* the procedure COMMITted
  per market; R8 removes that premise. The transaction-scoped form releases on
  **error** as well as on commit, which matters on exactly the path the ADR's own
  Runbook prescribes: *"`liquidity_silence` fires → call the injector by hand."* A
  hand-run from psql that throws would leak a session-level lock into the operator's
  own session and block every subsequent scheduled tick, silently.
- **`markets` first, then `pools`.** ADR-0013 P2/P3. A `pools → markets` edge
  would cycle against W-3/W-4. ⚠ ADR-0013 §2's written chain still names
  `friendly_fire_events`, dropped at `0018` — **LIQ-1 L-2**, open, and not this
  task's to fix; the order that runs has four links.
- **`SET LOCAL lock_timeout`, never `NOWAIT`.** A bet holding the row is the
  normal case, not an error; `lock_timeout` waits the configured 100 ms and then
  gives up for this tick. The next tick is 60 s away and the trigger is still
  true, so a skipped market self-heals. `NOWAIT` would surrender to any bet
  in flight.
- **The target is computed ONCE per tick**, before the market loop. ADR §C:
  *"Uniform across every `Open` market."* Computing it per market would take
  eight `count(*)`s and could straddle a signup, giving two markets different
  targets in one sweep.

**(e) The `events` insert must reproduce `insertEvent`'s contract.** Measured:

- `event_id := public.uuidv7()` (the userspace function, `0000`).
- `created_at` is **derived from the event id's first 48 bits**, not `now()` —
  `insert.ts`'s `uuidv7ToCreatedAt`, and two tests assert the property
  (`I-APPEND-ONLY-001:166`, `bets/concurrency.test.ts:444`). In SQL, measured
  round-tripping to within 10 ms of `clock_timestamp()`:
  ```sql
  to_timestamp((('x'||substr(replace(v_id::text,'-',''),1,12))::bit(48)::bigint)/1000.0)
  ```
- `payload_version := 1` (measured: `insert.ts:165` is `input.payloadVersion ?? 1`).
- `metadata` is the seven-field set, following the `sweep-orphans.ts` system-actor
  precedent: `request_id` = the tick's `run_id` (so every row of one sweep shares
  it — the arbiter LIQ-1 L-1 names), `flow_id` = `"F-CRON-LIQUIDITY-INJECT"`,
  `user_id` = null, `actor_id` = `"system"`, `idempotency_key` = null,
  `ip` = `"pg_cron"`, `user_agent` = `"pg_cron"`.

**(f) The initial `liquidity_policy` row.** ADR §G values —
`coefficient 500`, `floor 100000`, `trigger_ratio 0.80`, `guard_low 0.02`,
`guard_high 0.95`, `endgame_hours 72`, `lock_timeout_ms 100`, `version 1`,
`effective_from now()` — **and `enabled = false`. See OD-4.**

**(g) The registration**, at column 0, closing on a bare `);`:

```sql
SELECT cron.schedule(
	'liquidity-injector',
	'* * * * *',
	$$SELECT run_liquidity_injection()$$
);
```

⚠ **pg_cron's minimum cron granularity is one minute, which IS the ADR's 60 s
`INTERVAL`** — `'* * * * *'`, not a seconds-syntax schedule. Do not reach for
pg_cron's `'60 seconds'` interval form; the two live jobs both use 5-field cron
and that is the pattern the environments are known to run.

**Migration sequencing obligations (ADR-0022 / ADR-0024).**

| rule | how this migration satisfies it |
|---|---|
| **Expand/contract** | Purely additive: two new tables, two new routines, one new row. No `ALTER` on any live table. No destructive statement anywhere. |
| **Migrate-before-serve** | The migration applies to prod BEFORE the new code is promoted. **This is exactly why the seeded policy row is `enabled = false`** — see OD-4. |
| **Rehearse on staging first** | Push `staging` before the branch (`O-10`), let `staging-migrate.yml` + `/api/health` go green, then §7. |
| **Per-migration-transaction `db:migrate:prod`** | Nothing here needs to straddle transactions. `CREATE TABLE` / `CREATE FUNCTION` / `CREATE TRIGGER` / one INSERT are all transactional. |
| **`/api/health` drift field** | Reports `migrations: "drift"` between apply and promote. **Expected, not an alarm** — the same shape the staging-migrate memory records. |
| **`db:check-drift`** | The new Drizzle declaration (T3) and the hand-written DDL must agree. The `events`-style `tablesFilter` exclusion does **not** apply — `liquidity_policy` is a normal drizzle-visible table, so generate it with `just db-generate liquidity_injector_pg_cron` and hand-edit the file to add (b)–(g). ⚠ `liquidity_heartbeat` is NOT declared in Drizzle (it is operational, like `watermark_state` / `cron_alarms`, neither of which is), so **it must be added to `tablesFilter` as `"!liquidity_heartbeat"`** or `db:check-drift` reports a table drizzle does not know. Measure `drizzle.config.ts` before assuming the filter's current contents. |

---

### T5 · The SQL ↔ TypeScript differential test — exact shape

**File:** `tests/db/cpmm/liquidity-differential.spec.ts` (new; `tests/db/`
because it needs the real Postgres, and `just test-db` already runs that tree).

**Shape** — this is the design, measured working in plan mode against the local
Postgres at `:54322`:

1. **Generate** `N ≥ 10,000` triples `(yes, no, amount)` from a **seeded** PRNG
   (a literal seed in the file — a differential that cannot be replayed is not a
   differential). Six magnitude bands `1e3 … 1e15`, cycled, plus five forced
   families interleaved by index so every run contains all of them:
   `k%7` → the D-14 shape `(90000, 10000)` · `k%11` → `no = yes` (**the family
   that found M-1**) · `k%13` → `no = 1e-18` (extreme skew) · `k%17` →
   `a = 1e-18` (one-ulp amount) · `k%19` → 90:1.
2. **One round trip, not N.** Build a single `VALUES` list and run
   `SELECT … FROM (VALUES …) v(i,y,n,a), LATERAL zz_add_liquidity(v.y,v.n,v.a) r
   ORDER BY v.i`. ⚠ Measured: passing 12,000 rows as a `psql -c` argument
   fails with `E2BIG`; in Vitest the driver sends it over the wire, so this is a
   note for anyone reproducing by hand, not for the test.
3. **Compare with `Decimal.eq`, never string equality.** Measured: the SQL side
   returns `0` where TS returns `0.000000000000000000`. Same value, different
   scale. A string compare would report a mismatch on every zero-discard row.
4. **Assert four fields per row** — `yes`, `no`, `discardedYes`, `discardedNo`.
5. **Two invariants asserted on the SQL output alone**, so the test still says
   something if the oracle itself is wrong:
   - `(yes' + d_yes) − (no' + d_no) == yes − no` — the backing delta, exactly.
     Measured 12,000/12,000 on the candidate body.
   - `|p_yes' − p_yes| ≤ 1e-18`. Measured max `1.22e-20` over 12,000.
6. **A negative control that must RED.** A second, deliberately-wrong SQL
   expression (`trunc(a*s/l, 18)` — the plausible one this plan rejects in T4)
   is run over the same vectors in one `it.fails`-style case, proving the
   harness can see a one-ulp difference. **Without it, a differential that
   compares a function against itself passes while proving nothing** — the
   `feedback_a_fix_whose_test_cannot_fail` shape.

**Ordering:** T5 must be written and RED before T1 lands, or it goes green against
an oracle that is wrong. Concretely: run it once with T4's SQL and today's
`addLiquidity` and confirm it reds on the `k%11` family; then land T1; then
confirm green.

---

### T6 · The staging guard interlock — three catalogues move together

⚠ **This is the interlock that breaks every teardown if it is missed.** A new
Bucket-A table adds three `bucket_%` triggers, and
`tests/unit/staging/guard-list-parity.test.ts` **derives** the expected count by
parsing every migration — so it reds the moment `0027` lands, before any DB runs.

| file | symbol | change |
|---|---|---|
| `tests/staging/_lib/guards.ts` | `EXPECTED_GUARD_CATALOG_ROWS` | **78 → 81** (`23 → 24` Bucket-A relations × 3 families + 3 × 3 Bucket-B) |
| `tests/staging/_lib/guards.ts` | `TRUNCATE_EXCLUSIONS` | **`+ "liquidity_policy"`** |
| `tests/staging/_lib/guards.ts` | `DISABLED_TRUNCATE_GUARDS` | **unchanged** — see below |
| `tests/staging/_lib/guards.ts` | `TRUNCATE_TABLES` | **unchanged** |
| `tests/db/triggers/` | new spec | `liquidity-policy-append-only.spec.ts` — UPDATE / DELETE / TRUNCATE all rejected |

**`liquidity_policy` joins `system_state` as a truncate EXCLUSION, and the
argument is `system_state`'s own, verbatim in shape.** Its seed row is written by
migration `0027`, which drizzle will believe applied and never re-run;
`db:seed:staging` seeds only `identity_pool`. So a reset that truncated it would
delete the policy permanently, and the injector's `exit if not enabled` would then
read *no row* — **failing silently closed forever** with nothing reporting it.
Leaving its `bucket_a_no_truncate` guard **enabled** turns the omission into an
active defence: a future edit that adds it to the truncate set aborts the whole
batch instead of quietly wiping it. That is exactly the `guards.ts` docblock's
argument for `system_state`, one table over.

`liquidity_heartbeat` appears in **none** of the four lists, by the
`watermark_state` / `cron_alarms` precedent, and the parity test's *"guards
outside the `bucket_%` catalog are named, not forgotten"* case is unaffected
because the heartbeat table carries **no trigger at all** (`lots_no_delete`
remains the only entry).

---

### T7 · Heartbeat and the two alarms (ADR §H)

**Where:** inside `0027`, as a second plpgsql function
`check_liquidity_alarms()`, registered on its own `cron.schedule` — **or**
appended to `0011`'s `check_nightly_drift()` body? **No: a new function.** The
`0015` precedent replaces a whole function body when *correcting* it; adding an
unrelated identity to a nightly job would couple a 60-second concern to a daily
one.

Two alarms, both through the existing `cron_alarms` queue that the
`/api/cron/alarms-drain` handler already drains (`0007` + RECON-2 §8d — the
three-arm pattern; this task uses all three arms and mints no new one):

| `alarm_id` | condition | shape |
|---|---|---|
| `liquidity_silence` | no `liquidity_heartbeat` row in 15 minutes, **and only while the newest `liquidity_policy` row has `enabled = true`** (R4) | edge-triggered via a `watermark_state` row, `0007`'s `IS DISTINCT FROM` pattern — fires once per episode, not once per tick |
| `liquidity_undershoot` | any `Open` market with `tank < 0.60 × target` continuously for 60 minutes | derived from `liquidity_heartbeat` + the live pool rows |

⚠ **R4 splits two things this section conflated: the heartbeat and the injection.**
The heartbeat is written on **every tick that runs** — including the disabled, frozen
and no-policy paths — because it is evidence the *job* ran, never evidence it
injected. The silence alarm then evaluates **only while the newest policy is
`enabled = true`**, so the deliberate window between the migration applying and the
arming INSERT (OD-4) does not alarm. ⚠ **State the cost**: a registration that failed
*before* arming is not caught by the alarm. The Runbook's *"verify a heartbeat within
120 s of the arming INSERT"* is what closes that gap, and it is the reason that line
is in the Runbook rather than being decoration.

**`liquidity_silence` is the one that matters** (ADR §H): a stopped job produces
no error, so the absence of a heartbeat is the only signal that exists. It must
therefore be checked by a **different** job than the one that writes it — put it
on the existing `nightly-drift` cadence? **No — 15 minutes needs a 15-minute
check.** Register it as `'*/5 * * * *'`, matching `identity-pool-watermark`'s
proven cadence.

⚠ **Integer arithmetic for the thresholds**, per `0007`'s own header comment
(`unassigned * 20 < total`, deliberately avoiding floating point). Here:
`tank * 5 < target * 3` for the 60% test, never `0.6 *`.

**Proving tests** (`tests/db/`, real Postgres):
- `liquidity-alarms.spec.ts` — silence fires after a synthetic 16-minute gap and
  **fires exactly once** across three consecutive ticks (the edge trigger);
  undershoot fires on a seeded under-target market and **not** on a market inside
  the guard band; recovery updates state and emits nothing.
- A **positive control**: a healthy heartbeat emits zero rows.

---

### T8 · `backing.ts` — the SECOND query. ⛔ Do NOT widen `readGenesisRow`

**File:** `src/server/markets/backing.ts`.

The file's own ⚠ block is the specification: *"Injections ARE many and DO sum —
in their own query, added alongside this one."* The LIQ-1-P1 `@code-reviewer`
HIGH-1 defect was a **summed genesis read**: `I-GENESIS-001` is a `NOT EXISTS`
predicate with no unique index behind it, so summing lets a duplicate genesis row
double `D` on a terminal, append-only row.

**Change:**

- **New private** `sumInjectionDiscards(client, marketId)` — one aggregate:
  `SELECT COALESCE(SUM((payload->>'discardedYes')::numeric),0),
   COALESCE(SUM((payload->>'discardedNo')::numeric),0)
   FROM events
   WHERE aggregate_type='market' AND aggregate_id=$1
     AND event_type='pool.liquidity_added'`.
  No `LIMIT`, no `ORDER BY` — summing is order-free, which is the whole reason it
  is a *different* query from the genesis read.
- **`requireMarketDiscards` composes both** and returns `genesis + injections`.
  **Its two call sites — `settle.ts` and `void.ts` — do not change at all**,
  which is the point: the money path keeps one discard reader.
- `readGenesisRow` is **untouched** — same three predicates, `LIMIT 1`, same
  `(created_at, event_id)` tiebreak, still byte-identical to
  `replayReserveSeries`'s.
- Its ⚠ PHASE-2-OWES block is rewritten to record that the debt is **paid**, and
  the HIGH-1 cost measurement (15.2 ms at 200,000 `bet.sold` rows, ~330× margin)
  is **re-stated for the new query too** — see §9 R-6.

**Proving tests** — `tests/server/markets/backing.test.ts`:
1. `backing::injections-sum-genesis-does-not` — two `market.opened` rows
   (fixture-forced) + three `pool.liquidity_added` rows; asserts `D` counts the
   genesis **once** and all three injections. **This is the HIGH-1 regression
   guard and it must red on a single-query implementation.**
2. `backing::zero-injections-is-genesis-alone` — no injection rows, `D` unchanged
   from Phase 1's answer (a pinned vector).
3. `backing::injection-discards-are-side-scoped` — YES-long and NO-long
   injections on the same market accumulate on the right sides.

---

### T9 · Conservation callers — five sites, one new term

RECON-2 §5c: **zero production callers.** All five are tests and gates, and all
three derivation branches start from the single `market.opened` seed. With
injections present each is wrong by the whole injected backing.

New identity: `netAdminPoolInjection = openingBacking + Σ backingMinted − unwind`.

| # | file:line (at `3888ee90`) | change |
|---|---|---|
| 1 | `tests/staging/gates.staging.test.ts` (G2.1, `:500`, corrected `:492`) | add `Σ (payload->>'backingMinted')::numeric` over `pool.liquidity_added` to each of the three branches |
| 2 | `tests/scale/_harness/reconcile.ts` `:150` / `:138` / `:340–365` | same term; the synthetic pools emit no injections, so it is `+ 0` today — **add it anyway**, because a harness that cannot express the term cannot catch its absence |
| 3 | `tests/scale/hot-row-contention.scale.test.ts` `:269` | same |
| 4 | `tests/integration/resolution-conservation.integration.test.ts` `:215, :338, :395` | same, plus **one new case with injections present** |
| 5 | `tests/integration/dharma-ledger.integration.test.ts` `:285` | same |

⚠ **The `Open`/`Closed`/`Resolving` branch uses pool CASH, not the reserve sum**
— `injection = seed − (Y + Σ YES positions)`. That is a measured property
(`feedback` register: a constant-product buy barely moves `Y + N`, so the
reserve-sum delta is not the Dharma the pool absorbed). With injections the
equation becomes `openingBacking + Σ backingMinted − cash`. **Do not "simplify"
it to a reserve-sum difference**; that has bitten this repo before.

**Proving test:** case 4's new scenario — open asymmetric, N buys, **M
injections**, then settle on each outcome; all five callers reconcile exactly.

---

### T10 · `price-series.ts` — injection replay, exact, no recomputation

**File:** `src/server/discovery/price-series.ts`, symbol `replayReserveSeries`.

**Change.** `pool.liquidity_added` rides the **market** aggregate — the same
branch `bet.sold` uses — so the `soldBranch` predicate widens from
`eq(events.eventType, "bet.sold")` to
`inArray(events.eventType, ["bet.sold", "pool.liquidity_added"])`. The walk's
`for` loop gains a third arm:

```ts
} else if (ev.eventType === "pool.liquidity_added") {
    const p = eventPayloadSchemas["pool.liquidity_added"].parse(ev.payload);
    reserves = seedReserves(p.reservesAfter.yes, p.reservesAfter.no);
}
```

⚠ **Set, never recompute** (ADR §I). Re-running `addLiquidity` here would make the
chart a second implementation of the primitive and give it its own rounding — the
exact drift `readOpenedReserves`'s ⛔ block exists to prevent, one function over.
`reservesAfter` is what the pool actually holds; the chart's job is to say so.

**F-1 stays a WARN.** A concurrent injection between the events scan and the pool
read is now a *second* legal race alongside a concurrent bet. Do not tighten it.

**Proving tests:**
- `tests/server/discovery/price-series.test.ts` —
  `price-series::injection-preserves-price` (a walk over open → buy → inject →
  buy; the price at the injection step equals the price before it, to ≤ 1e-18) and
  `price-series::replay-matches-pool-after-injection` (final replayed reserves ==
  the live `pools` row, drift zero).
- ⚠ **Both must MOUNT the walk, not scan the source.** The
  `feedback_source_scan_position_is_a_proxy` register entry: a mount-position
  guard has passed the exact defect it named, twice.

---

### T11 · `openMarket` freeze gate — `docs/parked.md` LIQ-1 **L-4**, ruled

**File:** `src/server/markets/open.ts`, symbol `openMarket`.

**Change.** Refuse when `system_state.frozen_at IS NOT NULL`. Placement: **inside**
the W-4 transaction, reading `system_state` — *not* via `isFrozen()`.

⚠ **`isFrozen()` must not be called here, and its own docblock says why**:
*"a plain, NON-LOCKING read … must NOT enter the W-1/W-3/W-4 lock order."* It
opens its own connection off the top-level `db`, so calling it inside the W-4
transaction reads outside the lock — the same objection
`requireMarketDiscards` records for taking an explicit client. Read
`system_state` on `tx` instead, after the markets lock, and throw a new
`MarketFrozenError` from `src/server/markets/errors.ts`.

**Scope is `openMarket` ONLY.** L-4 observes that `createMarket`, `closeMarket`
and the resolution flows are also ungated; resolution's exemption is **deliberate
and tested** (`tests/server/resolution/freeze-exemption.test.ts` — a market in
flight must be able to finish), and `createMarket` / `closeMarket` were not ruled.
The parked row's owner column says *"LIQ-1 Phase 2 — lands with it"* for L-4 and
nothing else. **Do not widen it.**

**Proving test:** `tests/server/markets/freeze-gate.test.ts` — with `frozen_at`
set, `openMarket` throws and **writes nothing** (no `pools` row, no status flip,
no event); with it null, the market opens. Plus a **negative control**: the
existing `freeze-exemption.test.ts` still passes, proving resolution's exemption
was not caught by this change.

**Same-commit rider:** flip LIQ-1 L-4's Status in `docs/parked.md` from OPEN to
**PAID**, naming the PR. L-1/L-2/L-3 stay OPEN, untouched.

---

### T12 · `computeResolvedUnwind` — `@deprecated`

**File:** `src/server/cpmm/calculate.ts`, symbol `computeResolvedUnwind`.

Add a `@deprecated` JSDoc tag above the existing ⛔ block (which already says
everything; the tag makes an editor say it at the call site). **Do not delete the
function** — `cpmm.md` §13 names it in the module contract and three
`tests/unit/cpmm/` files pin it, including the §12 fixed vectors.

**Rider:** `cpmm.md` §13's entry gains the word *deprecated* (§6 row **A-3**).

**Proving test:** none needed — a JSDoc tag has no runtime behaviour, and the
existing pins already assert what the function does. Stating that explicitly so
the reviewer does not read a missing test as an omission.

---

### T14 · `BET_MAX_STAKE` — `"10000"` → `"250"` — **OD-5, ruled by R5**

**File:** `src/server/config/limits.ts`, symbol `BET_MAX_STAKE` (measured at HEAD:
`"10000"`, beside `BET_MIN_STAKE_POST = "10"` and `BET_MIN_STAKE_REPLY = "50"`).

**Change.** One string literal. **Its own commit** (`C8`) — a 40× cut on the
participant bet path shares a commit with nothing, so that a revert is one revert.

⚠ **The fixture sweep is the actual work, and its direction is ruled.** `grep -rn`
`tests/` for stakes above 250 and **adjust the FIXTURES, never the assertions**. The
distinction is the whole instruction: a test that stakes 5,000 Đ and asserts a
resulting price is asserting the *CPMM*, and it stays true at 250 with the expected
value recomputed; a test that stakes 5,000 Đ and asserts *it is accepted* is
asserting the *ceiling*, and it must now assert rejection. **Capping an assertion to
make it pass converts a ceiling test into a tautology** — the
`feedback_a_fix_whose_test_cannot_fail` shape, one register over. Where a fixture's
stake is load-bearing for a *scale* or *conservation* magnitude rather than for the
bet path, say so in the diff rather than silently rescaling it.

**Proving tests.**
1. `tests/unit/bets/floors.test.ts` (or the ceiling's existing home — measure it) —
   a stake of `"250"` is accepted and `"250.000000000000000001"` is rejected. **The
   boundary is the test**; a 251-vs-249 pair proves nothing about where the edge sits.
2. The existing floor tests stay green unchanged — this moves the ceiling, not the
   floors, and a floor test that moves is a signal the sweep went too wide.

**Rider (same commit):** SPEC.1 Appendix B's `BET_MAX_STAKE` row is **pinned at 250**,
not left `TBD` — §6 row **B-7**, as amended by **R6**.


---

## §4 The migration, in full

**`drizzle/migrations/0027_liquidity_injector_pg_cron.sql`**

Generate the skeleton with `just db-generate liquidity_injector_pg_cron` so the
`_journal.json` entry and the `liquidity_policy` DDL come from drizzle-kit, then
hand-append (b)–(g). ⚠ **Rename the generated file** if drizzle-kit's slug does
not contain `pg_cron` — the CI strip matches on the filename, and this file
carries `cron.schedule`.

### (a) `liquidity_policy` + the three Bucket-A guards

```sql
CREATE TABLE "liquidity_policy" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"version" integer NOT NULL,
	"coefficient" numeric(38, 18) NOT NULL,
	"floor" numeric(38, 18) NOT NULL,
	"trigger_ratio" numeric(38, 18) NOT NULL,
	"guard_low" numeric(38, 18) NOT NULL,
	"guard_high" numeric(38, 18) NOT NULL,
	"endgame_hours" integer NOT NULL,
	"lock_timeout_ms" integer NOT NULL,
	"enabled" boolean NOT NULL,
	"effective_from" timestamptz DEFAULT now() NOT NULL,
	"created_at" timestamptz DEFAULT now() NOT NULL,
	CONSTRAINT "liquidity_policy_version_unique" UNIQUE("version"),
	CONSTRAINT "liquidity_policy_bounds" CHECK (
		"coefficient" > 0 AND "floor" > 0
		AND "trigger_ratio" > 0 AND "trigger_ratio" <= 1
		AND "guard_low" > 0 AND "guard_high" < 1 AND "guard_low" < "guard_high"
		AND "endgame_hours" >= 0 AND "lock_timeout_ms" > 0
	)
);
--> statement-breakpoint
CREATE INDEX "liquidity_policy_effective_idx"
	ON "liquidity_policy" ("effective_from" DESC, "version" DESC);
--> statement-breakpoint

-- Bucket A. Reuses the shared functions 0003 (row-level) + 0021 (statement-level)
-- already ship; no new function is defined here.
CREATE TRIGGER bucket_a_no_update BEFORE UPDATE ON "liquidity_policy"
	FOR EACH ROW EXECUTE FUNCTION enforce_bucket_a_no_update();
--> statement-breakpoint
CREATE TRIGGER bucket_a_no_delete BEFORE DELETE ON "liquidity_policy"
	FOR EACH ROW EXECUTE FUNCTION enforce_bucket_a_no_delete();
--> statement-breakpoint
CREATE TRIGGER bucket_a_no_truncate BEFORE TRUNCATE ON "liquidity_policy"
	FOR EACH STATEMENT EXECUTE FUNCTION enforce_bucket_a_no_truncate();
--> statement-breakpoint
```

⚠ **Read `0003` and `0021` at HEAD for the exact function names before writing
this.** The three above are the names `guards.ts`'s `NEVER_DISABLED_GUARD_NAMES`
and `DISABLED_TRUNCATE_GUARDS` use for the *triggers*; the *functions* they call
must be copied from an existing Bucket-A table's `CREATE TRIGGER` in those two
migrations, verbatim. Guessing them is how this lands green and unguarded.

### (b) `liquidity_heartbeat` — operational, deliberately unguarded

```sql
CREATE TABLE IF NOT EXISTS liquidity_heartbeat (
	id bigserial PRIMARY KEY,
	run_id uuid NOT NULL,
	ran_at timestamptz NOT NULL DEFAULT now(),
	policy_version integer NULL,
	markets_considered integer NOT NULL,
	markets_injected integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS liquidity_heartbeat_ran_at_idx
	ON liquidity_heartbeat (ran_at DESC);
--> statement-breakpoint
```

No `bucket_%` trigger, by design — the `watermark_state` / `cron_alarms`
precedent (`0007`). Adding one would move `EXPECTED_GUARD_CATALOG_ROWS` and put
a table the reset never truncates into the disable list.

### (c) `zz_add_liquidity` — ADR §A in SQL

```sql
CREATE OR REPLACE FUNCTION zz_add_liquidity(
	p_yes numeric, p_no numeric, p_amount numeric
) RETURNS TABLE(yes numeric, no numeric, backing numeric, d_yes numeric, d_no numeric)
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
	yes_is_long boolean;
	l numeric; s numeric; l_prime numeric; s_prime numeric; discarded numeric;
BEGIN
	-- Preconditions, not validation: div() truncates TOWARD ZERO, so "truncate
	-- == floor" holds only while every operand is positive.
	IF p_yes <= 0 OR p_no <= 0 OR p_amount <= 0 THEN
		RAISE EXCEPTION 'zz_add_liquidity: non-positive input (% , % , %)',
			p_yes, p_no, p_amount;
	END IF;

	yes_is_long := p_yes >= p_no;   -- ties to yes; at S/L = 1 both branches agree
	l := CASE WHEN yes_is_long THEN p_yes ELSE p_no END;
	s := CASE WHEN yes_is_long THEN p_no  ELSE p_yes END;

	l_prime := l + p_amount;

	-- floor18(s + a*s/l) == s + floor18(a*s/l), because s is an exact multiple
	-- of 1e-18 (NUMERIC(38,18)). div() is EXACT integer division: no result
	-- scale is selected, so nothing depends on PostgreSQL's select_div_scale.
	-- Every intermediate is UNCONSTRAINED numeric — a*s*1e18 reaches 1e58 at the
	-- column ceiling, and a numeric(38,18) cast here raises at 10^20.
	s_prime := s + div(p_amount * s * 1000000000000000000::numeric, l)
	               * 0.000000000000000001::numeric;

	-- The discard is a RESIDUAL, never an independently rounded product. That is
	-- what makes (s' - s) + discarded == a EXACT, which is what the backing
	-- identity rests on (cpmm.md §7.1).
	discarded := p_amount - (s_prime - s);

	RETURN QUERY SELECT
		CASE WHEN yes_is_long THEN l_prime ELSE s_prime END,
		CASE WHEN yes_is_long THEN s_prime ELSE l_prime END,
		p_amount,
		CASE WHEN yes_is_long THEN 0::numeric ELSE discarded END,
		CASE WHEN yes_is_long THEN discarded ELSE 0::numeric END;
END; $$;
--> statement-breakpoint
```

### (d) `run_liquidity_injection` — the eleven steps

```sql
CREATE OR REPLACE FUNCTION run_liquidity_injection()
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
	p                liquidity_policy%ROWTYPE;
	v_run_id         uuid := gen_random_uuid();
	v_policy_version integer;
	v_users          bigint;
	v_target         numeric;
	v_considered     integer := 0;
	v_injected       integer := 0;
	m                record;
	pool_row         record;
	v_tank           numeric; v_price numeric; v_a numeric;
	r                record;
	v_event_id       uuid; v_created_at timestamptz;
BEGIN
	-- OVERLAP GUARD, transaction-scoped. The whole sweep is ONE transaction (R8),
	-- so this releases on commit AND on error -- which is what a session-level
	-- lock would not do on the Runbook's own recovery path ("liquidity_silence
	-- fires -> call the injector by hand"): a hand-run that threw would leak the
	-- lock into the operator's psql session and silently block every later tick.
	IF NOT pg_try_advisory_xact_lock(hashtext('zugzwang.liquidity_injector')) THEN
		RETURN;
	END IF;

	-- Newest effective policy wins. version DESC breaks a same-instant tie.
	SELECT * INTO p FROM liquidity_policy
	WHERE effective_from <= now()
	ORDER BY effective_from DESC, version DESC LIMIT 1;

	v_policy_version := p.version;   -- NULL when there is no policy row at all

	-- The heartbeat is evidence the JOB RAN, never evidence it injected. It is
	-- written on every tick that reaches here -- disabled, frozen and no-policy
	-- included (R4) -- because conflating "quiet" with "stopped" is exactly what
	-- makes a dead cron invisible. `liquidity_silence` is the half that knows
	-- about `enabled`; see check_liquidity_alarms().
	IF NOT FOUND OR NOT p.enabled
	   OR EXISTS (SELECT 1 FROM system_state WHERE frozen_at IS NOT NULL) THEN
		INSERT INTO liquidity_heartbeat
			(run_id, policy_version, markets_considered, markets_injected)
		VALUES (v_run_id, v_policy_version, 0, 0);
		RETURN;
	END IF;

	-- ONCE, at the top. There is no COMMIT in this body to reset it, and a
	-- per-market subtransaction rollback does not clear it either (measured:
	-- current_setting('lock_timeout') still reads the top-level value after a
	-- rolled-back subtransaction).
	EXECUTE format('SET LOCAL lock_timeout = %s', p.lock_timeout_ms);

	-- ONE count per tick, not one per market: the target is uniform across every
	-- Open market (ADR §C), and eight counts could straddle a signup and hand two
	-- markets different targets in one sweep. Measured Seq Scan, 8.1 ms at 100k.
	SELECT count(*) INTO v_users FROM users;
	v_target := GREATEST(p.floor, p.coefficient * v_users);

	FOR m IN
		SELECT id, resolution_deadline FROM markets WHERE status = 'Open'
		ORDER BY id
	LOOP
		v_considered := v_considered + 1;

		-- ENDGAME: leave the closing window alone. Skipped before the
		-- subtransaction is entered, so it costs no lock and no savepoint.
		CONTINUE WHEN now() + make_interval(hours => p.endgame_hours)
		              >= m.resolution_deadline;

		BEGIN
			-- markets -> pools, the canonical order (ADR-0013 P2/P3). A
			-- pools -> markets edge would cycle against W-3/W-4.
			PERFORM 1 FROM markets WHERE id = m.id FOR NO KEY UPDATE;

			SELECT yes_reserves AS yes, no_reserves AS no
			INTO pool_row FROM pools WHERE market_id = m.id FOR NO KEY UPDATE;

			IF FOUND THEN
				v_tank  := pool_row.yes + pool_row.no;
				v_price := pool_row.no / v_tank;         -- p_yes = n / (y + n)

				IF v_tank < p.trigger_ratio * v_target
				   AND v_price <= p.guard_high
				   AND v_price >= p.guard_low THEN

					-- a = L * (target/tank - 1)   (SIM-2 §0a, derived from
					-- tank' = tank + a*(L+S)/L and solved for tank' = target)
					v_a := GREATEST(pool_row.yes, pool_row.no)
					       * (v_target / v_tank - 1);

					IF v_a > 0 THEN
						SELECT * INTO r
						FROM zz_add_liquidity(pool_row.yes, pool_row.no, v_a);

						UPDATE pools
						SET yes_reserves = r.yes::numeric(38,18),
						    no_reserves  = r.no::numeric(38,18)
						WHERE market_id = m.id;

						-- created_at is DERIVED from the event id's first 48 bits,
						-- exactly as insert.ts's uuidv7ToCreatedAt does; two tests
						-- assert the property, and `events` is RANGE-partitioned on
						-- this column.
						v_event_id   := public.uuidv7();
						v_created_at := to_timestamp(
							(('x' || substr(replace(v_event_id::text, '-', ''), 1, 12))
							 ::bit(48)::bigint) / 1000.0);

						INSERT INTO events
							(event_id, event_type, aggregate_type, aggregate_id,
							 payload, payload_version, metadata, created_at)
						VALUES (v_event_id, 'pool.liquidity_added', 'market', m.id,
							jsonb_build_object(
								'marketId',        m.id,
								'policyVersion',   p.version,
								'target',          v_target::numeric(38,18)::text,
								'tankBefore',      v_tank::numeric(38,18)::text,
								'tankAfter',       (r.yes + r.no)::numeric(38,18)::text,
								'reservesBefore',  jsonb_build_object(
									'yes', pool_row.yes::text, 'no', pool_row.no::text),
								'reservesAfter',   jsonb_build_object(
									'yes', r.yes::numeric(38,18)::text,
									'no',  r.no::numeric(38,18)::text),
								'backingMinted',   r.backing::numeric(38,18)::text,
								'discardedSide',   CASE WHEN r.d_yes > 0 THEN 'YES' ELSE 'NO' END,
								'discardedShares', GREATEST(r.d_yes, r.d_no)::numeric(38,18)::text,
								'priceYesBefore',  v_price::numeric(38,18)::text,
								'priceYesAfter',   (r.no / (r.yes + r.no))::numeric(38,18)::text
							),
							1,
							jsonb_build_object(
								'request_id', v_run_id::text,
								'flow_id', 'F-CRON-LIQUIDITY-INJECT',
								'user_id', NULL,
								'actor_id', 'system',
								'idempotency_key', NULL,
								'ip', 'pg_cron',
								'user_agent', 'pg_cron'
							),
							v_created_at);

						-- LAST statement in the block: a plpgsql variable is NOT
						-- rolled back with the subtransaction, so incrementing
						-- before the writes could over-report an injection that
						-- never landed.
						v_injected := v_injected + 1;
					END IF;
				END IF;
			END IF;
		EXCEPTION
			-- 55P03. A bet holds the row -- the normal case, not an error. The
			-- trigger is still true and the next tick is 60 s away, so a skipped
			-- market self-heals; there is nothing to retry inside the tick.
			WHEN lock_not_available THEN
				NULL;
			-- Anything else is news. Record it and keep sweeping: one bad market
			-- must not cost the other seven, and a swallowed error with no row
			-- behind it is the failure this whole task exists to make visible.
			WHEN OTHERS THEN
				INSERT INTO cron_alarms (alarm_id, payload) VALUES (
					'liquidity_injection_error',
					jsonb_build_object(
						'run_id', v_run_id::text,
						'market_id', m.id::text,
						'sqlstate', SQLSTATE,
						'message', SQLERRM));
		END;
	END LOOP;

	INSERT INTO liquidity_heartbeat
		(run_id, policy_version, markets_considered, markets_injected)
	VALUES (v_run_id, v_policy_version, v_considered, v_injected);
END; $$;
--> statement-breakpoint
```

✅ **DISCHARGED, AND THE HAZARD IS GONE RATHER THAN MEASURED.** This paragraph asked
for `CONTINUE WHEN` and `EXCEPTION`-blocks-with-`COMMIT` to be verified against
PostgreSQL 17.6 before the shape was trusted, and named a fallback if they would not
compile. **Ruling R8 removes the second construct entirely** — there is no `COMMIT`
in the body — so the version-sensitive interaction it warned about cannot arise.
The remaining construct was compiled and run at execute against `:54322`
(PostgreSQL 17.6), together with the whole three-routine file:

```
CREATE TABLE ×2 · CREATE FUNCTION ×3 · COMPILED OK          (compile probe)
considered=4 injected=2 lock_timeout_after=137ms            (behaviour probe)
rows written {1,4}   alarms {market-3:22012}
```

`CONTINUE WHEN` skips a market without entering its subtransaction; a raise inside
market 3's subtransaction rolled back that market alone and markets 1 and 4 still
wrote; the `WHEN OTHERS` handler's own `INSERT` survived the rollback it followed;
and `SET LOCAL`, issued once above the loop, still read `137ms` afterwards. **The
fallback routine is not needed and is not written.**

### (d2) `check_liquidity_alarms` — the two alarms (T7)

⚠ **Minted at execute.** §4 is titled *the migration, in full* and did not carry this
routine, though T7 specifies it and `(f)` registers it. Compiled with the rest against
PostgreSQL 17.6.

```sql
CREATE OR REPLACE FUNCTION check_liquidity_alarms()
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
	v_enabled boolean;
	v_target  numeric;
BEGIN
	-- R4: the silence alarm evaluates ONLY while the newest policy is enabled, so
	-- the deliberate window between the migration applying and the arming INSERT
	-- does not alarm. The cost -- a registration that failed BEFORE arming is not
	-- caught here -- is closed by the Runbook's 120 s heartbeat check.
	SELECT enabled,
	       GREATEST(floor, coefficient * (SELECT count(*) FROM users))
	INTO v_enabled, v_target
	FROM liquidity_policy
	WHERE effective_from <= now()
	ORDER BY effective_from DESC, version DESC LIMIT 1;

	IF NOT FOUND OR NOT v_enabled THEN
		RETURN;
	END IF;

	-- SILENCE. Edge-triggered through watermark_state, 0007's IS DISTINCT FROM
	-- pattern: fires once per episode, not once every five minutes.
	WITH new_state AS (
		SELECT CASE WHEN EXISTS (
			SELECT 1 FROM liquidity_heartbeat
			WHERE ran_at > now() - interval '15 minutes'
		) THEN 'above' ELSE 'below' END AS s
	),
	upsert AS (
		INSERT INTO watermark_state (metric, state)
		SELECT 'liquidity_silence', ns.s FROM new_state ns
		ON CONFLICT (metric) DO UPDATE
			SET state = EXCLUDED.state, since = now()
			WHERE watermark_state.state IS DISTINCT FROM EXCLUDED.state
		RETURNING state
	)
	INSERT INTO cron_alarms (alarm_id, payload)
	SELECT 'liquidity_silence',
	       jsonb_build_object('state', u.state, 'window_minutes', 15)
	FROM upsert u WHERE u.state = 'below';

	-- UNDERSHOOT. Integer arithmetic for the 60% threshold, per 0007's own header
	-- comment (`unassigned * 20 < total`): tank*5 < target*3, never 0.6 *.
	WITH under AS (
		SELECT m.id
		FROM markets m JOIN pools po ON po.market_id = m.id
		WHERE m.status = 'Open'
		  AND (po.yes_reserves + po.no_reserves) * 5 < v_target * 3
	),
	new_state AS (
		SELECT CASE WHEN EXISTS (SELECT 1 FROM under) THEN 'below' ELSE 'above' END AS s
	),
	upsert AS (
		INSERT INTO watermark_state (metric, state)
		SELECT 'liquidity_undershoot', ns.s FROM new_state ns
		ON CONFLICT (metric) DO UPDATE
			SET state = EXCLUDED.state, since = now()
			WHERE watermark_state.state IS DISTINCT FROM EXCLUDED.state
		RETURNING state, since
	)
	INSERT INTO cron_alarms (alarm_id, payload)
	SELECT 'liquidity_undershoot',
	       jsonb_build_object('state', u.state,
	                          'markets', (SELECT count(*) FROM under),
	                          'target', v_target::text)
	FROM upsert u WHERE u.state = 'below';
END; $$;
--> statement-breakpoint
```

⚠ **The 60-minute half of `liquidity_undershoot` is NOT in this body, and that is
deliberate**: `watermark_state.since` already records when the episode began, so the
duration test belongs to the drain handler reading the alarm, not to a function that
runs every five minutes and would otherwise have to re-derive it. **T7's test must
assert `since` moves on the transition and does not move on a repeat tick** — that is
the only thing making the 60-minute claim checkable.

### (e) The initial policy row — `enabled = false`, see **OD-4**

```sql
INSERT INTO liquidity_policy
	(version, coefficient, floor, trigger_ratio, guard_low, guard_high,
	 endgame_hours, lock_timeout_ms, enabled, effective_from)
VALUES (1, 500, 100000, 0.80, 0.02, 0.95, 72, 100, false, now())
ON CONFLICT (version) DO NOTHING;
--> statement-breakpoint
```

### (f) The two registrations — column 0, closing on a bare `);`

```sql
-- pg_cron registration follows (stripped by CI on vanilla postgres:17 —
-- ci.yml *pg_cron* strip). Cadence is the ADR-0047 INTERVAL, not a placeholder.
--> statement-breakpoint
SELECT cron.schedule(
	'liquidity-injector',
	'* * * * *',
	$$SELECT run_liquidity_injection()$$
);
--> statement-breakpoint
SELECT cron.schedule(
	'liquidity-alarms',
	'*/5 * * * *',
	$$SELECT check_liquidity_alarms()$$
);
```

⚠ `'* * * * *'` is one minute — pg_cron's finest cron granularity, and exactly the
ADR's 60 s `INTERVAL`. Both live jobs use 5-field cron; do not reach for pg_cron's
interval syntax.

### (g) Drift-guard and sequencing checklist for the execute session

1. `drizzle.config.ts` → add `"!liquidity_heartbeat"` to `tablesFilter`
   (**measure the current contents first** — today it is `["!events"]`).
2. `just db-generate liquidity_injector_pg_cron`, then hand-append (b)–(g);
   never edit a committed migration afterwards.
3. `pnpm vitest run tests/db tests/invariants` locally against `:54322`.
4. `db:check-drift` must be clean.
5. Push **`staging` before the branch** (`O-10`), let `staging-migrate.yml` and
   `/api/health` go green.
6. Prod: migration applies, `/api/health` reports `migrations: "drift"` — **that
   is expected between apply and promote**, not an alarm.
7. Promote. Then, and only then, the policy INSERT that sets `enabled = true`.

---

## §5 The differential test — exact shape

Design fixed at T5; restated here as the single place a reviewer checks it.

| | |
|---|---|
| **File** | `tests/db/cpmm/liquidity-differential.spec.ts` |
| **Why `tests/db/`** | it needs the real `zz_add_liquidity`; `just test-db` already runs that tree, and `tests/unit/` has no database |
| **N** | ≥ 10,000 (ADR §Acceptance). Measured runtime for 12,000 in one round trip: sub-second |
| **PRNG** | seeded, literal in the file. An unreproducible differential is not a differential |
| **Bands** | `1e3, 1e5, 1e7, 1e9, 1e12, 1e15`, cycled by index |
| **Forced families** | `k%7` D-14 `(90000,10000)` · `k%11` **`no = yes`** · `k%13` `no = 1e-18` · `k%17` `a = 1e-18` · `k%19` 90:1 |
| **Transport** | ONE query: `SELECT … FROM (VALUES …) v(i,y,n,a), LATERAL zz_add_liquidity(v.y,v.n,v.a) r ORDER BY v.i` |
| **Comparison** | `Decimal.eq`, never string equality — measured: SQL returns `0`, TS returns `0.000000000000000000` |
| **Asserted per row** | `yes`, `no`, `discardedYes`, `discardedNo` |
| **Asserted on SQL alone** | `(yes'+d_yes) − (no'+d_no) == yes − no` exactly (measured 12,000/12,000); `|Δp_yes| ≤ 1e-18` (measured max `1.22e-20`) |
| **Negative control** | the same vectors through `trunc(a*s/l, 18)` — the plausible-but-wrong form — must produce ≥ 1 mismatch, proving the harness can see one ulp |
| **Ordering** | write it RED **before** T1. Against today's `addLiquidity` it must red on the `k%11` family. Then land T1; then green |

⚠ **The `k%11` family is not decoration.** It is the family that found M-1, and a
fuzz without it agrees on 12,000/12,000 while a real one-ulp divergence sits in
the code.


---

## §6 The grep census — every site, and its amendment

> ⛔ **THE METHOD IS DIFFERENT THIS TIME, AND THIS SECTION IS WHY.** Phase 1's
> plan scoped `cpmm.md` §7.1 and §7.3 by section number; the cascade then found
> seven more sites over three passes, each a sentence asserting the superseded
> position, each recorded as a plan gap. `cpmm.md` 3.0.0's own changelog says it:
> *"The plan's T11 only ever scoped §7.1 and §7.3, so §8/§11 were a plan gap
> rather than an execution slip."* **This census is scoped by PREDICATE, not by
> section.** The list is the deliverable; missing one is the defect.

### The six predicates swept

1. reserves change through exactly three doors / seed, buy, sell only
2. no mid-market liquidity / no liquidity operations
3. `k` is constant / the product is preserved across a market's life
4. `POOL_SEED_PER_MARKET_DEFAULT` (and its `_DEFAULT`-less sibling)
5. *"exactly once"* in the context of seeding
6. the residual is reserves-only / auditable from reserves alone

**Surfaces swept:** `docs/specs/cpmm.md` · `docs/specs/SPEC.1.md` ·
`docs/specs/SPEC.2.md` · `docs/adr/` · `docs/handover/` · `CLAUDE.md` ·
`AGENTS.md` · `src/` · `tests/`. Commands in §12.

### A · `docs/specs/cpmm.md` — version **3.0.0 → 4.0.0**

MAJOR per its own §0 policy (*"MAJOR on any change to a formula or invariant"*):
§7.4 changes an invariant statement.

| # | site | asserts | amendment |
|---|---|---|---|
| **A-1** | **§7.1**, the `addLiquidity` paragraph | describes the quotient at the module's precision | **T1 rider.** Add: *"The quotient `a·S/L` is taken at 120 significant digits before `floor18`, not at the module's 50. Measured: at 50 the value is one ulp low wherever the exact quotient lands on an 18-dp boundary and `a·S` needs more than 50 digits — 0% below 1e7 reserves, ~6.5% at and above 1e8, 0 of 50,000 at a 90:1 skew. 120 is provably enough rather than merely large: the quotient is rational with denominator `L ≤ 1e38`, so its distance from an 18-dp boundary is zero or ≥ 1e-56, and a 120-digit rounding perturbs by ≤ 1e-100."* |
| **A-2** | **§7.4** `:456–466` — *"No liquidity operations exist … Reserves change through exactly three doors: §4 buy, §5 sell, §8 terminal unwind."* | **predicates 1 + 2.** The load-bearing sentence. | **REWRITE THE WHOLE SECTION.** Retitle **§7.4 The four doors**. Text: *"Reserves change through exactly FOUR doors: §4 buy, §5 sell, §7.5 liquidity injection, §8 terminal unwind. The fourth is ADR-0047's signup-pegged injector: a `pg_cron` job sizes each `Open` market's depth to `max(FLOOR, COEFF × signups)` and applies §7.5's price-preserving placement, recording every application as a `pool.liquidity_added` events row. It is price-neutral by construction and it is the ONLY writer of `pools` outside the bet transaction and the terminal unwind. There is still no user-facing add- or remove-liquidity operation and no external liquidity provider; upstream's liquidity functions remain stripped (§2). ⚠ The three-door sentence this replaces was true for the life of the module and is the sentence ADR-0047 reverses; SPEC.1 §10.6 is struck in the same commit."* |
| **A-3** | **§7.5 — NEW** | — | **Mint it.** The reserve-placement primitive: `L' = L + a`, `S' = floor18(S + a·S/L)`, `discarded = a − (S′ − S)` as a residual; both implementations (`calculate.ts` = spec + oracle, migration `0027`'s `zz_add_liquidity` = runtime) and the differential fuzz that pins them; the target rule `max(FLOOR, COEFF × count(*) FROM users)`; the trigger, guard band, endgame skip and lock timeout as `liquidity_policy` columns, not constants. Cross-reference ADR-0047 §A/§C/§D/§G. |
| **A-4** | **§1** `:46–48` — *"the admin seeds the pool once at `Draft → Open` and there are no external liquidity providers and no mid-market adjustments (SPEC.1 §10.5, §10.6)"* | **predicates 2 + 5.** ⚠ **A §1 SCOPE SENTENCE, nowhere near §7.4** — exactly the class Phase 1's section-scoped plan missed. | Amend to: *"…the admin opens the pool at `Draft → Open` and there are no external liquidity providers and no user-facing liquidity operations; the system's own signup-pegged injector is the one exception and is described at §7.4/§7.5 (ADR-0047)."* Strike the `SPEC.1 §10.6` citation — that section no longer exists after row B-1. |
| **A-5** | **§14** `:840–853` — *"mid-market liquidity operations (SPEC.1 §10.6)"* in the non-goals list | **predicate 2.** | **Strike the clause**, replacing it in place (`O-5`: an amendments block is a record of the change, never the delivery of it) with: *"— mid-market liquidity operations are NO LONGER a non-goal; ADR-0047 makes the signup-pegged injector the fourth door (§7.4, §7.5). USER-PROVIDED liquidity and limit orders remain non-goals, by ruling."* ⚠ The neighbouring *"asymmetric seeds are NO LONGER a non-goal"* clause is Phase 1's and shows the exact form to copy. |
| **A-6** | **§12 E5** `:757–773` | closes *"The §8.1 residual identity, demonstrated on both branches"* on a symmetric seed; its own text says **an asymmetric worked example is owed and belongs with Phase 2** | **Mint E6.** A 90,000/10,000 open (B = 90,000, T = 100,000, `D_no = 80,000`), one 100 Đ YES buy, **one injection** bringing the tank to a stated target, then both outcomes. Show `D = B + Σstakes − Σproceeds`, `unwind = w + D_W` on each branch, and the backing identity closing per side with the injection's discard included. ⚠ **E1–E5 stay untouched** — they are ENGINE.3's fixed vectors and `tests/unit/cpmm/vectors.test.ts` pins them; E6 is additive and gets its own vector test. |
| **A-7** | **§13** module-API contract, the `computeResolvedUnwind` entry `:821–829` | names the function without a deprecation marker | **T12 rider.** Add `**deprecated**` to the entry and one line: *"superseded as the resolved unwind by ADR-0047 §E; kept because §12's vectors pin it. Reaching for it by name under-pays every asymmetric winning side by its discard."* |
| **A-8** | **§13** module-API contract, `addLiquidity` entry `:806` | describes the computation | **T1 rider**, mirroring A-1 in one sentence. |
| **A-9** | **§3.1** `:38` — *"Reserves are immutable from the `Open → Closed` transition onward"* | reads like predicate 1 | ⚠ **NO AMENDMENT — IT IS STILL TRUE**, and the plan says so explicitly so a later reader does not "fix" it. The injector fires only on markets in status `Open` (`0027` step 6), so `Open → Closed` remains the instant after which reserves stop moving. **Add a parenthetical only**: *"(the §7.5 injector also stops at `Open → Closed`; it selects on `status = 'Open'`)"* — cheap, and it converts a sentence that invites a wrong edit into one that forecloses it. |
| **A-10** | **§7.2** `:357–359` — *"asymmetric initialisation at a chosen price, exactly once, with the excess discarded"* | **predicate 5**, narrowly | Append one clause: *"— 'once' scopes the INITIALISATION, not the reserves: §7.4's fourth door moves them again while the market is `Open`."* |
| **A-11** | **§15** change log | — | New `4.0.0` row recording A-1…A-10 and naming ADR-0047 Phase 2 + this plan. |

### B · `docs/specs/SPEC.1.md` — version **2.0.0 → 2.0.1**

⛔ **THIS SECTION WAS WRITTEN AGAINST `1.0.49` AND SPEC.1 IS NOW `2.0.0`.** `0bf84b05`
rebaselined it per D-29 between plan and execute. **Ruling R3 governs: patch-bump
whatever §0 measures, and never write `1.0.50`.** Measured at execute: §0 reads
`2.0.0` ⇒ **`2.0.1`**. The patch grade is unchanged and its reason is unchanged —
§10.6 is a product policy, not one of INV-1..4 — so **OD-3 is ruled, not reopened**.

**Three of the rows below moved, and one died. Re-measured at HEAD, by symbol:**

| row | plan said | measured at HEAD |
|---|---|---|
| B-1 | §10.6 `:602–604` | **§10.6 `No mid-market liquidity adjustments`** — present, text verbatim |
| B-2 | §10.5 `:600` | **§10.5 `Pool seeding rule`** — present, the K_eff sentence verbatim |
| B-3 / B-4 | §15 F-ADMIN-2 `:1085` / `:1088` | **§15 `F-ADMIN-2 — Pool seed (Hub: Markets tab)`** — present, both the `y₀ = n₀ = seedAmount` sentence and the Carry-forward-2 invariant verbatim. *(This pair is what the kickoff calls **M-5**.)* |
| B-5 | §16.1 `:1166` | **§16.1 `Constants and Limits`**, the `POOL_SEED_PER_MARKET` row — present |
| B-6 | **§11 Non-goals `:1511`** | ⚠ **RELOCATED. It is §3.2 `NG13`** — *"No mid-market liquidity adjustments. Pool seed is fixed at creation (§10.6)."* §11 is now `Resolution`. The 2.0.0 change log records the move: *"five prescriptive sentences relocated (§3.2 NG6–NG15…)"* |
| B-7 | Appendix B `:1983` | **Appendix B `— Constants scaffold for the number-tuning pass`**, the `POOL_SEED_PER_MARKET_DEFAULT = TBD` line — present |
| B-8 | **§17 spec-rule table** | ⛔ **GONE. §17 DOES NOT EXIST.** §0: *"§17–§19 and §21–§23 are intentionally absent (D-29); numbering is retained for cross-reference stability."* See B-8's own row |
| B-9 | §0 + change log | **§0** + **§20 `Change Log`** — present |

⚠ **Every line number in the rows below is against `1.0.49` and is now evidence, not
an anchor** (`O-8`). The quoted sentences are the anchors and all of them survived the
rebaseline unchanged — which is the useful finding: 2.0.0 removed sections, it did not
rewrite the ones this census targets.

| # | site | asserts | amendment |
|---|---|---|---|
| **B-1** | **§10.6** `:602–604`, the whole section — *"No mid-market liquidity adjustments … Mid-market injections re-price existing positions retroactively and break audit-trail and CPMM-math integrity. Not v1."* | **predicates 1 + 2.** The prohibition. | **STRUCK AND REPLACED IN PLACE** (`O-5`) — retitled **§10.6 Signup-pegged liquidity injection**, carrying the three-grounds finding from RECON-2 §11a **as measured, not as the ADR paraphrases it**: <br>• *"re-prices existing positions retroactively"* — **FALSE against a fixed-`p` placement.** Measured: `p_yes` is `0.100000000000000000` before and after a 500 Đ injection, exact; and across ≥ 10,000 fuzzed pairs the price moves by at most one ulp, measured max `1.22e-20`. The ground holds against the *naive equal-add* injection, which moved the price up to 12.5 points, and that is the version this section was written against. <br>• *"break audit-trail integrity"* — **STOOD, and was the real objection.** All three `netAdminPoolInjection` derivations began from the single `market.opened` seed and nothing recorded a refill. ADR-0047 §E/§F is its fix: every application is a `pool.liquidity_added` events row carrying `backingMinted` and the discard, every parameter change is a `liquidity_policy` row, and both ship in the dataset. <br>• *"break CPMM-math integrity"* — **PARTLY, and now scoped.** The repo has never asserted `k` constant; INV-C2 is `k′ ≥ k`, and all twelve staging pools already measure `k > seed²`. What was true is that no test shape existed for a fourth door; ADR-0047's acceptance battery is that shape. <br>⚠ **The fourth argument is at §10.5, not here, and is answered separately — see B-2.** |
| **B-2** | **§10.5** `:600` — *"Infinite liquidity flattens the price entirely and kills the K_eff signal — explicitly rejected."* | the K_eff argument | ⚠ **This is NOT one of §10.6's three grounds**, and ADR-0047 §Consequences treats it as if it were, folding it into the third. It is a separate sentence in a separate section. **Amend in place**: *"Infinite liquidity flattens the price entirely and kills the K_eff signal — explicitly rejected, and the §10.6 injector is not it. The injector pegs depth to circulation rather than removing the bound: an 8× change in signup rate moves the closing price by 1.75 points with it and by 20.7 points without (measured). What flattens the K_eff signal as turnout grows is a FIXED seed — `flow ÷ depth` climbing until the closing price measures the crowd's size rather than the question (0.787 at 5,000 signups/hour, 0.994 at 40,000, same market)."* Also strike *"mid-market adjustments"* from §10.5's cross-reference if present. |
| **B-3** | **§15 F-ADMIN-2** `:1085` — *"the `pools` row is inserted with symmetric reserves `y₀ = n₀ = seedAmount` … the seed is recorded as the `seedAmount` payload field"* | **predicate 5 + a PHASE-1 GAP** | ⛔ **THIS IS STALE AGAINST SHIPPED PHASE-1 CODE AND IS NOT A PHASE-2 CHANGE — IT IS A PHASE-1 DEBT THIS CENSUS FOUND.** `openMarket` writes two distinct reserves and emits `yesReserves`/`noReserves`/`openingPriceYes`/`backingMinted`/`discardedYes`/`discardedNo`; there is no `seedAmount` on an asymmetric payload. Phase 1 amended `cpmm.md` and `SPEC.2` and **touched SPEC.1 not at all**. On a spec↔code conflict the spec wins, so a later session would "correct" `open.ts` back — the exact failure `cpmm.md` 3.0.0 paid for at §8.1/INV-C4, one document over. **Rewrite**: admin enters **opening price and tank**; the row is inserted with the two reserves `openingReserves` computes; the payload carries the six ADR-0047 §B fields; the legacy `seedAmount` shape is the historical arm of the `market.opened` union. |
| **B-4** | **§15 F-ADMIN-2 Invariants** `:1088` — *"Carry-forward 2 (`Y₀ = N₀`): the seed is symmetric by construction — one production `pools` INSERT site, both reserve columns bound from the same string; void's cash cross-assert depends on it."* | **the same gap, stated as an INVARIANT** | ⛔ **Worse than B-3, because it is filed as an invariant.** `open.ts:65` says carry-forward 2 is *"GONE BY DESIGN"*, and `tests/server/admin/pool-seed.test.ts:71` and `:400` both record the inversion. **Replace**: *"Carry-forward 2 (`Y₀ = N₀`) is RETIRED by ADR-0047 §B. There is still exactly one production `pools` INSERT site, and it now binds two distinct values. `void.ts`'s cash cross-assert no longer depends on symmetry — it depends on the backing identity `Y + H_yes + D_yes == N + H_no + D_no`, with `D` read from `markets/backing.ts` (Phase 1) and, from Phase 2, summed over the market's `pool.liquidity_added` rows as well."* |
| **B-5** | **§16.1** `:1166` — the `POOL_SEED_PER_MARKET` row | **predicate 4** | **Replace the row.** *"`POOL_SEED_PER_MARKET` — RETIRED by ADR-0047 §B. A market opens with an opening price and a tank, both per-call arguments to `openMarket`; there is no default seed magnitude and there never was one in `src/`."* Add two rows in its place: `MARKET_OPENING_PRICE_YES` and `MARKET_OPENING_TANK` (per-call, pinned at 0.10 / 100,000 for all eight by D-14 + ADR-0047). ⚠ **Do NOT add the injector's parameters here.** `FLOOR`, `COEFF`, `TRIGGER`, `GUARD_LOW`/`GUARD_HIGH`, `ENDGAME_HOURS`, `LOCK_TIMEOUT_MS` live in `liquidity_policy` and are tuned by INSERT, never by deploy — that is the whole point of §G, and listing them as number-tuning constants would say the opposite. State that explicitly in the section, in one line. |
| **B-6** | ⚠ **§3.2 `NG13`** (re-measured; the plan said §11 `:1511`, which is now `Resolution`) — *"**NG13.** No mid-market liquidity adjustments. Pool seed is fixed at creation (§10.6)."* | **predicates 1 + 2** | **Strike the bullet and replace in place**: *"**User-provided liquidity and limit orders.** No participant may add or remove pool depth, and there is no order book (per `B6`, and out of scope by ruling). The system's own signup-pegged injector is not a user surface — §10.6."* |
| **B-7** | **Appendix B** `:1983` — `POOL_SEED_PER_MARKET_DEFAULT = TBD` | **predicate 4** | Replace with: `# POOL_SEED_PER_MARKET_DEFAULT — RETIRED by ADR-0047 §B (never existed in src/)` plus `MARKET_OPENING_PRICE_YES = 0.10  # ADR-0047, D-14, all eight` and `MARKET_OPENING_TANK = 100000  # ADR-0047 §B` . ⚠ **REVERSED BY R6: `BET_MAX_STAKE` is PINNED here at `250`, not left `TBD`.** OD-5 is ruled (R5) and the constant lands in this PR at T14. ⚠ **RULED BY R6, and the count question is closed.** Appendix B carries **six** rows after this pass: `POOL_SEED_PER_MARKET_DEFAULT` **retired** · `MARKET_OPENING_PRICE_YES = 0.10` · `MARKET_OPENING_TANK = 100000` · **`FLOOR`** and **`COEFF`** minted *as pointers* — each row names `liquidity_policy` as its source of truth and carries no number, because a value written here would be a second home for a figure that is tuned by INSERT (`O-15`: the number is the part that rots) · `BET_MAX_STAKE = 250` **pinned**. This supersedes the paragraph below, which is kept because its reasoning is still the reason the two new rows carry no values. **The original objection, preserved:** ADR-0047's own table says `BET_MAX_STAKE` is *"the ONE Appendix B constant this ADR pins"*, and the injector parameters are explicitly policy-table values. Measured content of Appendix B touched by ADR-0047: **two** (`POOL_SEED_PER_MARKET_DEFAULT` retired, `BET_MAX_STAKE` pinned — the latter withheld under OD-5), plus **two minted** (`MARKET_OPENING_PRICE_YES`, `MARKET_OPENING_TANK`). If "four" means those four rows, this row delivers it; if it means something else, **OD-6**. |
| **B-8** | ⛔ **VOID — SPEC.1 §17 NO LONGER EXISTS** | — | The row asked for two rows in §17's spec-rule table. **D-29 removed §17 entirely at 2.0.0** and §0 says numbering is retained only for cross-reference stability. ⚠ **There is nowhere in SPEC.1 to add a spec rule, so nothing is invented to fill the gap** — writing a §17 back would be this session minting a spec section on its own authority. The two rules the row wanted are **not lost**: they land as `cpmm.md` §7.5's own contract (row **A-3**) and as the two named tests that pin them, which is where every other `cpmm::` rule this task touches already lives. **Recorded, not silently dropped** — a census row that vanishes without a sentence is indistinguishable from one that was missed. If the founder wants a SPEC.1-level rule register restored, that is a D-record decision, not a rider. |
| **B-9** | **§0 + §20 Change Log** | — | Version → **2.0.1** (R3 — measured, not the plan's `1.0.50`), last-updated → the merge date; one change-log row naming B-1…B-8, **and naming B-3/B-4 as a Phase-1 debt this pass found rather than a Phase-2 change** — that distinction is what stops the next reader concluding Phase 1 shipped wrong code. |

### C · `docs/specs/SPEC.2.md` — version **1.0.29 → 1.0.30**

| # | site | change |
|---|---|---|
| **C-1** | **§5.1** table inventory | New row `liquidity_policy` — **Bucket A**, new `liquidity` domain, no `user_id`, `UNIQUE(version)`, one index, three append-only triggers. Counts move: tables **25 → 26**, Bucket A **10 → 11**, protected set **13 → 14**, domains **+1**. ⚠ **Measure every one of those four counts in the file before editing** — SPEC.2's own §0 records three successive count annotations going stale by one. `liquidity_heartbeat` is **NOT** added: it is operational, like `watermark_state` / `cron_alarms`, which §19.3 says are excluded from the inventory entirely. |
| **C-2** | **§5.2** Bucket-A summary | `+ liquidity_policy` |
| **C-3** | **§6** append-only contract | Protected relation count and the trigger totals move; the **forward obligation** sentence (ADR-0030) is the one that predicted this. State the new `EXPECTED_GUARD_CATALOG_ROWS` = **81** so the doc and `guards.ts` agree. |
| **C-4** | **§19.3** dataset inventory ✅ **OD-7 CONFIRMED (R7)** | New row: `liquidity_policy` · A · **YES** · *"the injector's parameter history; ADR-0047 §G says it ships. Without it a reader cannot reproduce any injection — the target rule is not derivable from the events alone. No PII, no `user_id`."* Counts: dataset-relevant **22 → 23**, shipped **16 → 17**. Excluded-entirely gains `liquidity_heartbeat` (**4 → 5**). |
| **C-5** | **§19.4.1** per-payload STRIP | ⛔ **REQUIRED, or PR #435's export throws — and R10 fixes WHICH COMMIT it rides: the same one as the event type (`C2`), matching Phase 1's ADR §F note.** New row: `pool.liquidity_added` · **— (none)** · *"No PII-class key. All keys SHIP: the reserves and target are public CPMM state, and `backingMinted` + `discardedShares` are load-bearing for the reader in exactly the way `market.opened`'s discards are — without them the per-side share counts do not close and the backing identity cannot be verified from the export. `policyVersion` joins the `liquidity_policy` row that produced the injection."* Plus the matching `PAYLOAD_SHIP_KEYS` entry when #435 rebases — **that is #435's obligation, named here, not this PR's edit**, since `src/server/export/` is absent from `main`. |
| **C-6** | **Appendix B** per-column classification | New `B.x liquidity_policy` block — every column SHIP, no PII. Coverage count +1. |
| **C-7** | **§22.1 ADR index** | ADR-0047's row exists (added at 1.0.28, index-only). Amend it to record that Phase 2 landed. ⚠ **Do not re-derive the ADR counts** — §22.1's standing annotation says the index is rows behind disk and that folding the backlog is a SYNC sweep, not a rider. Leave the counts alone; that instruction is itself the amendment. |
| **C-8** | **§0 + change log** | → 1.0.30, one row naming C-1…C-7. |

### D · `docs/handover/project-kit/CONSTANTS.md`

| # | site | change |
|---|---|---|
| **D-1** | `:48` — the `POOL_SEED_PER_MARKET_DEFAULT` row | **predicate 4, and a surface neither the ADR nor the kickoff names.** Replace with two rows (opening price / tank, per-call) and one for the `liquidity_policy` parameters pointing at the TABLE rather than at `limits.ts` — the first entry in this file whose home is a database row, which is worth one sentence of explanation in place. |

### E · `docs/adr/` — **NO AMENDMENT**

ADR substance is immutable once accepted (SPEC.2 §22.4). Swept and clear:
`0009` matched on *"asymmetric by construction"* about friendly-fire — unrelated.
ADR-0047 itself carries the three-door sentence as *context*, correctly quoting
what it reverses. **ADR-0013 §2's stale lock order is LIQ-1 L-2, still OPEN, and
is not this task's** — it wants a Patch record or a superseding ADR.

### F · `CLAUDE.md` / `AGENTS.md` — **NO AMENDMENT REQUIRED, one OPTIONAL**

Swept: the only matches were `CLAUDE.md` §8's register prose (*"stale by exactly
three"*) and `AGENTS.md`'s unrelated lines. Neither asserts any of the six
predicates.

**Optional, and the closing-ritual answer:** `AGENTS.md` §6's Bucket-A list names
ten tables and `CLAUDE.md` §2 names the same ten. `liquidity_policy` makes eleven.
Both are descriptive counts of a set this PR changes, so **amending them is the
§7-closing-ritual answer for this session and it should ride this PR, not a
follow-up.** Also `AGENTS.md` §6's migration-head line (`0026_lots_no_delete`)
gains `0027`.

### G · `src/` and `tests/` — clear, and here is why that is not an omission

Phase 1 already amended every `src/` site: `calculate.ts:31/304`,
`open.ts:50/59/65`, `backing.ts:50`, `price-series.ts:168/206/282`,
`schemas.ts:204/229`, `settle.ts:198`, `void.ts:180`. Three test sites record the
inversion deliberately and stay: `pool-seed.test.ts:71/78/400`,
`void.test.ts:459`. One test constant reads *"symmetric Y₀ = N₀"* —
`tests/scale/_fixtures/markets.ts:14` — and is **correct**: it describes the
synthetic scale pools, which are symmetric on purpose, and the constant beside it
(`SYNTHETIC_SEED_BACKING`) already carries the asymmetric argument in full.


---

## §7 Reviewer cascade

**This phase HAS a migration, so `@db-migration-reviewer` runs — it did not in
Phase 1** (LIQ-1-P1's log: *"there is no migration … so `@db-migration-reviewer`
correctly did not run"*).

Order, sequential, never concurrent (a concurrent subagent `vitest` saturates the
local Postgres and produces false REDs):

| # | agent | when | scope to pass explicitly |
|---|---|---|---|
| 1 | `@test-writer` | **Phase 2 start**, before any `src/` edit | `@docs/plans/LIQ-1-P2_plan.md` §3 T1/T5/T8/T10/T11 test names. Tests-first for: `addLiquidity` exactness, the SQL↔TS differential, the second-query discard sum, injection replay, the freeze gate. **Forbidden from editing `src/`.** |
| 2 | `@db-migration-reviewer` | **after the §5.10 self-audit, first of the review agents** | `@docs/plans/LIQ-1-P2_plan.md` §4 in full + `src/db/schema/liquidity.ts` + `drizzle/migrations/0027_*.sql`. Ask specifically for: Bucket-A classification and all three trigger names against `0003`/`0021`; the `UNIQUE(version)` + CHECK set; `tablesFilter` vs `liquidity_heartbeat`; the `*pg_cron*` filename rule and the two `^`-anchored strip patterns; the `events` insert's column set against `insert.ts`. |
| 3 | `@code-reviewer` | after 2 | the `src/server/` diff — `backing.ts`, `price-series.ts`, `open.ts`, `calculate.ts`, `events/schemas.ts`. **Name HIGH-1 explicitly**: *"confirm the genesis read is still `LIMIT 1` and the injection sum is a separate query."* |
| 4 | `@security-auditor` | after 3 | critical-path business logic: the injector as a second `pools` writer, the freeze gate, the lock order, the advisory-lock overlap guard, INV-1..4. |

**Two things the cascade must be told, or it re-derives them wrongly:**

- The subagent pins load from **the session's working directory at launch** and
  are not hot-reloaded. Launch the execute session from a worktree at
  `origin/main` (post-#491) or the reviewers run pre-repin models.
- `@code-reviewer` found a defect in the previous round's fix **three times** in
  Phase 1. Budget for three rounds, not one.

Between rounds, and as the final pre-PR gate: **`pnpm vitest run`** (the whole
suite, ~165 s locally against `:54322`), not the named gate list — the named list
misses cross-suite floors, and this PR moves three of them.

---

## §8 Staging soak — commands, not prose

**Post-merge only.** Three days (ADR §Execution). Run in order.

### 8.0 Before anything: prove what staging is running (`O-4` is OPEN)

```bash
curl -s https://<staging-host>/api/health | jq '{env, canary, migrations}'
git branch --contains <canary-sha> | grep -E '^\*?\s*(main|staging)$'
```

⛔ **Do not proceed on a `canary` you have not matched to a SHA on `main`.**
`O-4` says staging reflects `main` by mechanism; the parked exception says the
mechanism has been wrong twice. `env` reads `staging`; `migrations` will read
`drift` between the migration and the promote and that is expected.

### 8.1 Push order — `staging` BEFORE the branch (`O-10`)

```bash
git push origin <merge-sha>:staging          # FIRST
git push origin <merge-sha>:refs/heads/<branch>   # only after Staging Migrate is green
gh run list --workflow=staging-migrate.yml --limit 1 --json databaseId,status,conclusion
gh run view <id> --json status,conclusion,jobs   # the verdict; gh pr checks lags
```

Vercel dedups the same SHA across refs. Branch-first makes it skip the staging
deployment entirely and the domain serves the old SHA while Staging Migrate
reports green. There is no alias or redeploy escape hatch.

### 8.2 Rebuild fixtures, then confirm the cron registered

```bash
pnpm staging:rebuild        # reset -> seed -> generate -> gates
doppler run --project zugzwang-experiment --config stg --command '
  psql "$DATABASE_URL_STAGING" \
    -c "SELECT jobid, jobname, schedule, active FROM cron.job ORDER BY jobid;" \
    -c "SELECT version, enabled, coefficient, floor, effective_from FROM liquidity_policy ORDER BY version DESC LIMIT 3;"'
```

**GREEN =** `liquidity-injector` and `liquidity-alarms` both present and
`active = t`; `liquidity_policy` has exactly one row, `enabled = false`.

### 8.3 Arm it — the INSERT that turns it on

```bash
doppler run --project zugzwang-experiment --config stg --command '
  psql "$DATABASE_URL_STAGING" -c "
    INSERT INTO liquidity_policy (version, coefficient, floor, trigger_ratio,
      guard_low, guard_high, endgame_hours, lock_timeout_ms, enabled, effective_from)
    VALUES (2, 500, 100000, 0.80, 0.02, 0.95, 72, 100, true, now());"'
```

⚠ **A new row, never an UPDATE.** The table is Bucket A and the trigger will
reject an UPDATE — which is the mechanism, not an obstacle.

### 8.4 The three-day watch — one command, run daily

```bash
doppler run --project zugzwang-experiment --config stg --command '
  psql "$DATABASE_URL_STAGING" \
   -c "SELECT max(ran_at) AS last_beat, now() - max(ran_at) AS age,
              count(*) FILTER (WHERE ran_at > now() - interval '\''1 hour'\'') AS beats_last_hour,
              sum(markets_injected) AS injections_total
       FROM liquidity_heartbeat;" \
   -c "SELECT alarm_id, count(*), max(emitted_at) FROM cron_alarms
       WHERE alarm_id LIKE '\''liquidity%'\'' GROUP BY 1;" \
   -c "SELECT m.slug, p.yes_reserves, p.no_reserves,
              (p.yes_reserves + p.no_reserves) AS tank,
              round(p.no_reserves / (p.yes_reserves + p.no_reserves), 6) AS p_yes
       FROM markets m JOIN pools p ON p.market_id = m.id
       WHERE m.status = '\''Open'\'' ORDER BY m.slug;" \
   -c "SELECT count(*) AS injections, sum((payload->>'\''backingMinted'\'')::numeric) AS backing,
              sum((payload->>'\''discardedShares'\'')::numeric) AS discarded
       FROM events WHERE event_type = '\''pool.liquidity_added'\'';"'
```

**GREEN, all five, every day:**

| # | check | green |
|---|---|---|
| 1 | heartbeat age | **< 2 minutes.** A stopped job produces no error; this is the only signal |
| 2 | beats last hour | **≥ 55** (60 expected; a missed minute is a Supavisor blip, not a defect) |
| 3 | `liquidity_silence` alarms | **0** |
| 4 | `p_yes` per market | **moved by ≤ 1e-18 across every injection.** Compare `priceYesBefore` / `priceYesAfter` on the events rows; ANY larger move is a **STOP** |
| 5 | conservation | `pnpm staging:gates` **exits 0** and `docs/polish/staging-coverage.json` has not drifted |

Plus, once, on day 1 and day 3 — the replay must match the live row:

```bash
# drift is a WARN, not a throw, so it must be looked for deliberately
doppler run --project zugzwang-experiment --config stg --command '
  psql "$DATABASE_URL_STAGING" -c "
    SELECT m.slug, count(e.*) AS injections
    FROM markets m LEFT JOIN events e
      ON e.aggregate_id = m.id AND e.event_type = '\''pool.liquidity_added'\''
    WHERE m.status = '\''Open'\'' GROUP BY 1 ORDER BY 1;"'
```
then open two market pages and confirm the chart renders a line with no visible
step at an injection instant. **A price step at an injection is the one visual
symptom of a broken replay**, and the F-1 check will not tell you — it WARNs.

⚠ **Staging is under ACTIVE PARTICIPANT WRITE.** Do not pin any check to an exact
activity figure; the checks above are all shapes and bounds for that reason.

### 8.5 STOP conditions — any one halts the soak and the promote

1. `liquidity_silence` fires.
2. Any `|priceYesAfter − priceYesBefore| > 1e-18`.
3. `pnpm staging:gates` non-zero.
4. Any bet 500s, or `bet_handler_internal_error` alarms rise.
5. Any `pool.liquidity_added` row whose `reservesAfter` does not equal the live
   pool row at that instant in the replay.

---

## §9 Risks — each bounded by a NAMED test

| # | risk | bound by | why that test is the bound |
|---|---|---|---|
| **R-1** | **The injector collides with a bet mid-transaction.** Both take `pools FOR NO KEY UPDATE`; the bet path has 4 attempts on `40001/40P01` (`BACKOFF_BASES_MS = [50,100,200]`) and a 1,000 ms `statement_timeout`. | `tests/db/liquidity-contention.spec.ts::injector-and-bets-share-the-pool-row` — N concurrent bets against a market while the injector procedure runs in a loop; asserts **zero bet failures**, every bet within the existing retry budget, and **no deadlock**. Plus the existing `tests/scale/hot-row-contention.scale.test.ts` re-run with the injector armed. | The injector's own exposure is bounded by `lock_timeout = 100 ms` and one transaction per market (§4d), so it yields to the bet, not the reverse. The test proves the direction; without it the design is an argument. |
| **R-2** | **The cron stops silently.** A stopped pg_cron job produces no error, no log, no alarm. Measured precedent: `jobid` differs between environments (3 vs 2), meaning a registration attempt already failed once and nobody noticed. | `tests/db/liquidity-alarms.spec.ts::silence-fires-once-per-episode` + soak check 1 (heartbeat age < 2 min) + soak check 3 (zero silence alarms). | The heartbeat row is the *only* positive evidence the job ran. The test proves the alarm fires and fires **once**; the soak proves the heartbeat exists in production shape. |
| **R-3** | **The policy row is malformed** — a `guard_low > guard_high`, a zero coefficient, a negative floor. One INSERT and every market either stops injecting or injects unboundedly, with no deploy and no review. | The `liquidity_policy_bounds` CHECK (§4a) + `tests/db/triggers/liquidity-policy-append-only.spec.ts::rejects-out-of-range-policy`. | ⛔ **A CHECK is the only control here, and that is deliberate.** Tuning is an operator INSERT by design (ADR §G), so there is no code path to review it. The constraint is the review. |
| **R-4** | **`count(*) FROM users` cost at 100k.** | **Measured, not deferred: Seq Scan, 8.1 ms, 736 buffers at 100,000 rows** (§12). 0.013% of a 60 s interval. Bounded by `tests/db/liquidity-injector.spec.ts::target-computed-once-per-tick`, which asserts exactly one count per sweep. | ⚠ The ADR guessed *"it is an index-only scan; probably not"* — it is a **Seq Scan**. Right conclusion, wrong premise (`O-13`). **No `reltuples`**: it is ANALYZE-lagged and would make the target irreproducible for an auditor (Driver 6). |
| **R-5** | **A market reaches the guard band on day one.** `p_yes` opens at 0.10, `GUARD_LOW` is 0.02. Eight points of NO-ward movement stops that market's injector — silently, since a guard skip is indistinguishable from a satisfied trigger. | `tests/db/liquidity-injector.spec.ts::guard-band-skips-and-does-not-inject` (both edges) + the `liquidity_undershoot` alarm (T7) + soak check 4. | **The undershoot alarm is the bound, not the test.** ADR §Runbook: *"A market is stuck at a guard or the lock. Look; it is information."* The test proves the skip; the alarm is what makes the skip visible. |
| **R-6** | **`requireMarketDiscards` gets a second query on the settlement path**, inside a 5 s `statement_timeout` whose `57014` is NOT retryable, and `Resolving → Resolved` is the only edge out — a timeout is an unsettleable market. | `tests/server/markets/backing.test.ts::injections-sum-genesis-does-not` + an EXPLAIN measurement recorded in the execute report. | The genesis read's own measurement is the precedent: **15.2 ms at 200,000 `bet.sold` rows against a 5,000 ms budget, ~330×**. The new query filters `pool.liquidity_added` over the same `(market, marketId)` range with the same missing `event_type` index, so it inherits the same shape — but at **~30 rows per market**, three orders of magnitude below the genesis probe's worst case. **Re-measure at execute and record the number**; do not inherit this paragraph's confidence. |
| **R-7** | **Two injector runs overlap.** pg_cron will not start a second run of the same job while one is running, but a hand-run (`liquidity_silence` fires → the Runbook says call it by hand) can race the scheduled one. | `tests/db/liquidity-injector.spec.ts::overlapping-runs-one-works-one-exits` — two concurrent `SELECT run_liquidity_injection()` calls; exactly one injects, the other returns immediately. ADR §Acceptance "Overlap". | ⚠ **REVERSED BY R8: `pg_try_advisory_xact_lock`, not `pg_try_advisory_lock`.** This cell argued session-scope *because* the procedure COMMITted per market and a transaction-scoped lock would be released by the first COMMIT. **R8 removes every COMMIT, so that premise is gone** — and transaction-scope is now strictly better, because it releases on **error** too. The path that makes the difference is the ADR Runbook's own: *"`liquidity_silence` fires → call the injector by hand."* A hand-run from psql that threw would leak a session-level lock into the operator's session and block every scheduled tick afterwards, with no error and no alarm — a recovery step that causes the outage it was reaching for. |
| **R-8** | **The migration applies before the code is promoted** (ADR-0024 migrate-before-serve), so the injector could write `pool.liquidity_added` rows while the OLD code is serving — which would under-report `settleMarket`'s residual by the injected discard and drift every chart. | **`enabled = false` in the seeded row (OD-4)**, plus `tests/db/liquidity-injector.spec.ts::disabled-policy-is-a-no-op`. | The window is minutes, but it is a live-money window and the fix costs one operator INSERT. **This is the single most consequential deviation from the ADR text in this plan.** |
| **R-9** | ⚠ **RETIRED AS A MECHANISM BY R8; THE TEST STAYS.** The risk was that `SET LOCAL lock_timeout` stops applying after the first COMMIT, so market 2 onward blocks forever. **There is no COMMIT in the body any more**, and the surviving question — whether a rolled-back subtransaction clears it — was measured at execute: it does not (`lock_timeout_after=137ms` after market 3 rolled back). | `tests/db/liquidity-injector.spec.ts::lock-timeout-applies-to-every-market` — hold a pool lock in a second session, assert the sweep skips that market and **still processes the ones after it**. | **Keep the test even though its mechanism is retired.** What it really asserts is *the sweep survives a contended market*, which R8 re-routes through the `lock_not_available` EXCEPTION arm rather than through `SET LOCAL` — same failure, same invisibility (the heartbeat is late rather than absent and nothing errors), different plumbing. A test written against a mechanism outlives the mechanism when it was written against the behaviour. |
| **R-11** | ⚠ **NEW, AND CREATED BY R8.** One transaction for the whole sweep means a pool row locked at market 1 stays locked until the sweep ends — where the procedure shape released it at that market's COMMIT. A bet on an early market can therefore wait for markets it has nothing to do with. | `tests/db/liquidity-contention.spec.ts::injector-and-bets-share-the-pool-row` (R-1's test, now load-bearing for this row too) — **assert the observed bet wait, not only that no bet failed**, and record the number. Plus `tests/db/liquidity-injector.spec.ts::sweep-duration-bounded`. | Bounded by arithmetic before it is bounded by a test: `lock_timeout` is 100 ms and there are eight `Open` markets, so the worst case is ~0.8 s against the bet path's 1,000 ms `statement_timeout` and its 4-attempt `[50,100,200]` backoff. **That is a margin, not a guarantee** — it assumes eight markets and it degrades linearly as markets are added. If the market count ever rises, this row is the one that moves first. |
| **R-10** | **The SQL and TS primitives drift after Phase 2** — a later edit to one and not the other. | `tests/db/cpmm/liquidity-differential.spec.ts` (§5), which runs in `just test-db` and in CI. | It is the ADR §A contract (*"two implementations, one definition"*) made mechanical. Its **negative control** (§5) is what stops it degenerating into a function compared against itself. |

---

## §10 Estimated CC hours

Measured against Phase 1's actuals: 21 commits, ten `src/` files, no migration,
**one session 2026-09-06T10:09Z → 2026-09-07T01:30Z ≈ 15.5 h**, with
`@code-reviewer` running three times.

| task | h | note |
|---|---|---|
| T1 `addLiquidity` exactness + RED-first vectors | 1.5 | body is small; the RED-first ordering and the provable-margin docblock are the work |
| T2 event type + payload + `.strict()` + 3 pins | 1.0 | five same-commit edits, all mechanical, all pre-measured |
| T3 `liquidity_policy` Drizzle declaration | 0.5 | |
| T4 migration `0027` | **4.0** | the largest single unit: 2 tables, 2 routines, 3 triggers, 2 registrations, the `CONTINUE WHEN`/`COMMIT`-in-`EXCEPTION` measurement, and the `tablesFilter` interaction |
| T5 differential fuzz + its negative control | 2.0 | design is fixed (§5); the negative control is half of it |
| T6 staging guard interlock | 1.0 | three constants + one trigger spec; the parity test tells you when it is right |
| T7 heartbeat + two alarms | 2.0 | edge-triggered state rows, integer thresholds, positive control |
| T8 `backing.ts` second query | 1.5 | plus the EXPLAIN re-measurement (R-6) |
| T9 conservation callers ×5 | 2.0 | five files, three derivation branches, one new integration scenario |
| T10 `price-series.ts` injection replay | 1.5 | mount-not-scan tests |
| T11 `openMarket` freeze gate (L-4) | 1.0 | plus the `freeze-exemption` negative control |
| T12 `@deprecated` | 0.25 | |
| T13 spec amendments — the §6 census (33 rows) | **4.0** | 11 `cpmm.md` + 9 `SPEC.1` + 8 `SPEC.2` + 1 `CONSTANTS.md` + the optional `AGENTS.md`/`CLAUDE.md` pair |
| §5.10 pre-PR self-audit | 1.5 | schema · server · migration, item by item |
| Reviewer cascade, **three rounds** | 3.5 | Phase 1's measured shape, not one round |
| `docs/logs/LIQ-1-P2.md` + PR | 0.75 | |
| **Total** | **≈ 28 h** | |

**Two sessions, not one**, split at the C4/C5 boundary (after the differential is
green): the migration and the primitive are one intellectual unit, the money path
and the specs are another, and `/clear` between strata is §5.8. Phase 1 ran 15.5 h
in one session with no migration; this has one, plus a 33-row census.

⚠ **The estimate excludes the three-day soak** (§8), which is elapsed time, not
CC time.

---

## §11 Open decisions — **ALL SEVEN RULED**, 2026-09-07

⚠ **This section is no longer a request; it is a record.** The founder ruled every row
at the Phase-2 kickoff (R1–R10). Each decision is also written into the section it
governs — an amendments table is a record of a change, never the delivery of it
(`O-5`) — so this table's job is to say *what was decided and where it now lives*, not
to be the place a reader learns it.

| # | decision | **RULING** | applied at |
|---|---|---|---|
| **OD-1** | `addLiquidity` is one ulp low at `S == L` with reserves ≥ 1e8. Fix it, in a Phase-1 file? | **R1 · FIX IT.** Quotient on a locally-cloned `precision: 120` `CpmmDecimal`, then `floor18`. Own commit: `fix(cpmm): addLiquidity quotient at p=120 — oracle matches exact SQL` | §3 T1 · §2 C1 |
| **OD-2** | ADR §Acceptance's *"`k′ > k` only on inject"* is false — `floor18` dust raises `k` on buys too | **R2 · RESTATE THE ROW.** *"`k` changes only through a named door — every reserve write has exactly one event row; between consecutive events `k` is unchanged; buy/sell `k′ ≥ k`; inject `k′ > k` by the computed amount; open sets `k`."* Test per the OD-2 shape | ADR §Acceptance (edited in place) · §3 test plan |
| **OD-3** | SPEC.1 bump: patch or major? | **R3 · PATCH, ON WHAT §0 MEASURES.** Never write `1.0.50`; if §0 reads `2.x`, bump `2.x.(n+1)`. ⚠ Measured at execute: §0 reads **2.0.0** ⇒ **2.0.1**. The ruling anticipated exactly the drift that had already happened | §6 row B / B-9 |
| **OD-4** | ADR §G seeds `enabled = true`; this plan seeds `false` | **R4 · SEED `false`.** Heartbeat on **every** run regardless of `enabled`; `liquidity_silence` evaluates only while the newest policy is `enabled = true`. ADR §G + §Runbook gain: *"arm after promote: INSERT … enabled = true; verify heartbeat within 120 s"* | §4(d) · §4(d2) · §3 T7 · ADR §G/§H/§Runbook |
| **OD-5** | `BET_MAX_STAKE`: ADR pins 250, `limits.ts` ships `"10000"`, the plan withheld it | **R5 · LAND IT IN PHASE 2.** `limits.ts` → `"250"`, own commit. `grep -rn tests/` for stakes > 250 and adjust the **fixtures**, never the assertions | §3 T14 · §2 C8 · §1 (bullet reversed) |
| **OD-6** | *"the four constants pinned by ADR-0047"* vs the ADR's *"the ONE"* | **R6 · SIX ROWS IN APPENDIX B.** Retire `POOL_SEED_PER_MARKET_DEFAULT`; mint `MARKET_OPENING_PRICE_YES`, `MARKET_OPENING_TANK`, and **`FLOOR` + `COEFF` as POINTERS at `liquidity_policy`**; pin `BET_MAX_STAKE = 250`. B-7's *"withheld"* becomes *"pinned"* | §6 row B-7 |
| **OD-7** | Does `liquidity_policy` ship in the public dataset? | **R7 · CONFIRMED.** SPEC.2 §19 carries a row for it | §6 row C-4 |

**Three further rulings arrived with them and are not open decisions**, recorded here
so the set is one list rather than two:

| # | ruling | applied at |
|---|---|---|
| **R8** | The injector is a **`FUNCTION`**, `SELECT`-invoked from `cron.schedule()`, matching `0007` and `0011`. Per-market `BEGIN … EXCEPTION WHEN lock_not_available THEN <skip> WHEN OTHERS THEN <record to cron_alarms, skip> END` — a subtransaction per market. **No `COMMIT` in the body.** `SET LOCAL lock_timeout` once at the top. Compile before writing the migration | §3 T4 · §4(d) · §9 R-7/R-9/R-11 · §12 |
| **R9** | ADR §Execution: Gate C is *the orchestrator's diff read*. ADR §Open Q closed with the measured `count(*)` (Seq Scan, 8.1 ms / 100k). ADR §Consequences: the staging pool count is **14** | ADR (edited in place) + Patch record P1 |
| **R10** | Phase 1's ADR §F note stands — the `pool.liquidity_added` SHIP row is SPEC.2 §19.4.1, **same commit as the event type** | §6 row C-5 · §2 C2 |

⚠ **One observation on R9's own numbering, recorded and not acted on.** The ruling
labels the closed item *"§Open Q3"* while its content — *"count(\*) is a Seq Scan at
8.1 ms / 100k rows"* — is unambiguously the ADR's **second** bullet; Q3 is the
migration-name question. The ruling's example arbitrates over its label, so the
`count(*)` bullet is the one closed with that measurement. **All three bullets are
closed**, because plan-mode answered all three and a section that still calls a
shipped decision *open* is a doc that will be believed. Flagged rather than resolved
silently.

---

## §12 Measurement appendix — every command behind §2's numbers

Run in plan mode, read-only except two named scratch objects, both dropped.

```bash
# ground state
git rev-parse HEAD                                   # 3888ee90…
gh pr view 491 --json state,isDraft,headRefOid,mergeable,baseRefName
md5 -q src/server/markets/backing.ts …               # the five §0 hashes

# ceilings — READ, never counted (O-2)
ls docs/adr/ | grep -E '^00' | sort | tail -3        # 0047
ls drizzle/migrations/*.sql | sort | tail -3         # 0026_lots_no_delete
tail -9 drizzle/migrations/meta/_journal.json        # idx 26

# M-1: the oracle's one-ulp error (decimal.js precision-50 vs exact BigInt)
#   8 crafted boundary cases + 60,000 random pairs: 0 disagreements
#   then the SQL differential at 12,000 pairs incl. the S==L family: 23
#   then the S==L family alone, 20,000 per band:
#     <=1e7 0.000% | 1e8 6.225% | 1e9 6.850% | 1e10 6.675% | 1e12 6.485% | 1e15 6.695%
#   90:1 skew, 50,000 trials: 0
#   proposed precision-120 fix, 100,000 trials across four bands: 0 wrong

# M-2: PostgreSQL numeric division semantics
psql … -c "SELECT scale(1::numeric/3::numeric),
                  scale((1.5*2.5)/7.000000000000000000::numeric),
                  scale((a*s)/l) FROM …"             # 20, 20, 36 — NOT stable
psql … -c "SELECT div(7::numeric,2::numeric), div(-7::numeric,2::numeric)"   # 3, -3
psql … -c "SELECT trunc(a*s/l,18)
                = div(a*s*1000000000000000000::numeric, l)
                  * 0.000000000000000001::numeric"   # t
psql … -c "SELECT div(1e20*1e20*1e18, 1) IS NOT NULL"  # t — no overflow at 1e58

# M-3: count(*) at 100k  (scratch table zz_probe_users, DROPPED)
EXPLAIN (ANALYZE, BUFFERS) SELECT count(*) FROM zz_probe_users;
#   Aggregate … actual time=8.075..8.075 · Seq Scan rows=100000 · shared hit=736
EXPLAIN (ANALYZE) SELECT reltuples FROM pg_class WHERE oid='…'::regclass;
#   Index Scan … 0.036 ms — but ANALYZE-lagged, so rejected

# uuidv7 -> created_at extraction, round-tripped against clock_timestamp()
psql … -c "SELECT to_timestamp((('x'||substr(replace(id::text,'-',''),1,12))
                                ::bit(48)::bigint)/1000.0) …"   # within 10 ms: t

# scratch objects, both dropped at close
DROP FUNCTION zz_probe_add_liquidity(numeric,numeric,numeric);
DROP TABLE zz_probe_users;
```

**Declared deviation from read-only:** two scratch database objects were created
in the **local** Postgres at `127.0.0.1:54322` and dropped. No staging or
production database was contacted. No repository file outside
`docs/plans/LIQ-1-P2_plan.md` was written.

**NOT ESTABLISHED (`O-13`), with what would read it:**

- ✅ **ESTABLISHED, and the question dissolved rather than being answered.** Whether
  `CONTINUE WHEN` and a `COMMIT` inside a `BEGIN … EXCEPTION` block compile together
  in a PL/pgSQL **procedure** on 17.6. **R8 removes the `COMMIT`**, so the pairing
  cannot arise. What remained was compiled and run at execute against `:54322`
  (17.6): three routines `COMPILED OK`, and the behaviour probe returned
  `considered=4 injected=2 rows={1,4} alarms={market-3:22012}
  lock_timeout_after=137ms`. The §4d fallback routine is not needed.
- ✅ **MOOT.** Whether pg_cron 1.6.4 accepts `CALL` on **Supabase's** build. **R8
  registers `SELECT run_liquidity_injection()`**, which is what both live jobs
  already use — so the plan no longer depends on the answer. Recorded rather than
  deleted: the question was sound, and a later session reaching for `CALL` should
  find that it is still unmeasured on that build.
- The exact trigger-function names in `0003`/`0021`. §4a uses the names
  `guards.ts` records for the **triggers**; the **functions** must be copied from
  an existing Bucket-A `CREATE TRIGGER` at HEAD.
