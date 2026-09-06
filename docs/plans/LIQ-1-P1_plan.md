# LIQ-1 Phase 1 — asymmetric open + the backing identity

> **Status:** plan-mode output, awaiting web-Claude sign-off (CLAUDE.md §5.1).
> **Authority:** `docs/adr/0047-asymmetric-open-and-signup-pegged-liquidity.md`
> §Decision Outcome **A · B · E · I** and §Execution (Phase 1 column).
> **Evidence:** `zz_LIQ-RECON-2_measure_2026-09-06T1314.md` §1, §2, §3, §5, §6.
> **Measured against:** `origin/main` @ `20cd322c`; ADR + spec rows committed at `5cc43ccc`.
> **Ships:** 8 September 2026. **Soak:** 7 days on staging before the 15th.

---

## §0 · Preflight — the HALT check, discharged

The brief halts if any RECON-2 §3c site moved since RECON-2's SHA `4133338a`.
**None did.** Every file this plan touches is byte-identical between `4133338a`
and `20cd322c`:

```
src/server/markets/open.ts                        SAME
src/server/events/schemas.ts                      SAME
src/server/cpmm/calculate.ts                      SAME
src/server/discovery/price-series.ts              SAME
src/server/admin/markets/seed.ts                  SAME
src/app/(admin)/admin/markets/[marketId]/page.tsx SAME
src/server/resolution/void.ts                     SAME
src/server/resolution/settle.ts                   SAME
src/server/dharma/conservation.ts                 SAME
```

*(`git show <sha>:<path> | md5 -q`, both sides, nine files.)*

**Phase 1 has NO migration.** Asserted by grep, as the brief requires:

```
$ ls drizzle/migrations/*.sql | tail -1
drizzle/migrations/0026_lots_no_delete.sql        ← head, unchanged by Phase 1
```

Three independent reasons nothing under `drizzle/` or `src/db/schema/` changes:

1. **`pools` already permits asymmetry.** `src/db/schema/markets.ts:63–74` —
   `yesReserves` and `noReserves` are two independent `numeric(38,18) NOT NULL`
   columns with **no CHECK tying them** (RECON-2 §3c: *"the constraint is
   entirely in application code and in the spec, not in the schema"*).
2. **`events.event_type` is `text`, not a pgEnum**, and Phase 1 mints **no new
   event type** — `market.opened` already exists and only its *payload* grows.
   The three `EVENT_TYPES.length` pins stay at **24** in Phase 1; they become 25
   in Phase 2 when `pool.liquidity_added` lands (RECON-2 §9d).
3. **`events.payload` is `jsonb`** — new keys need no DDL.

⇒ **`@db-migration-reviewer` does not run.** (§5, confirmed by the grep above,
not asserted.)

---

## §1 · What Phase 1 is, in one paragraph

`openMarket` stops binding one scalar to both reserve columns and starts writing
two, computed from an opening price and a tank. That is the whole product
change. Everything else in this plan exists because **three functions currently
assume the two columns are equal**, and two of them fail on the first asymmetric
market: `voidMarket` **throws** (its own comment at `void.ts:176–177` predicts
this exactly), `settleMarket` under-reports the residual on a NO outcome by the
discard, and the chart replays from a symmetric seed and draws a wrong line
**silently**. The backing identity is what replaces "the two columns are equal"
as the thing that makes the books close.

**Not Phase 1, and not planned here:** the injector, the policy table, the cron
job, `pool.liquidity_added`, the export rule, `cpmm.md` §7.4/§14, SPEC.1 §10.6.

---

## §2 · The numbers this plan is built on

For D-14's 10% YES open at `tank = 100,000`:

| quantity | value | from |
|---|---|---|
| `openingPriceYes` | `0.10` | D-14 |
| `tank` | `100,000` | ADR §Constants |
| `yesReserves` = `(1 − p) × tank` | **`90,000`** | ADR §B |
| `noReserves` = `p × tank` | **`10,000`** | ADR §B |
| `price_yes` = `no / (yes + no)` | `10,000 / 100,000` = **`0.10`** ✓ | `getPrices`, `calculate.ts:39` |
| `backingMinted` = `max(yes, no)` | **`90,000`** | pair-mint, §3.2 |
| `discardedNo` = `max − min` | **`80,000`** | ADR §Consequences |
| `discardedYes` | **`0`** | — |
| discard fraction `1 − min/max` | **`88.89%`** | matches ADR §Consequences |

**The identity closes at open:**
`Y + H_yes + D_yes = 90,000 + 0 + 0 = 90,000`, and
`N + H_no + D_no = 10,000 + 0 + 80,000 = 90,000`, both equal to the
`90,000` Đ deposited. ✓

⚠ **Note the reserve asymmetry direction.** A *YES* price of 0.10 means the
**YES reserve is the LARGE one** (a side's price is proportional to the
**opposite** reserve — `calculate.ts:36–37`). The long side `L` in ADR §A is
`yes` here, and the discard lands on `no`. Getting this backwards inverts every
market on the platform, so it is pinned by an explicit test (T1b case 1).

---

## §3 · Task graph

```
                        ┌─────────────────────────────────────┐
  TRACK A (no deps)     │ T1  cpmm/calculate.ts  — primitive  │
                        │ T1b tests/unit/cpmm/liquidity.*     │ RED first
                        └──────────────┬──────────────────────┘
                                       │
                        ┌──────────────▼──────────────────────┐
  TRACK B (open path)   │ T2  events/schemas.ts — payload     │ ← the fan-out point
                        └──┬──────────┬──────────┬────────────┘
                           │          │          │
          ┌────────────────▼──┐  ┌────▼───────┐ ┌▼──────────────────┐
          │ T3 markets/open.ts│  │ T6 markets/│ │ T10 discovery/    │
          │    (+T3b tests)   │  │  backing.ts│ │  price-series.ts  │
          └────────┬──────────┘  │  (+T6b)    │ │  (+T10b)   TRACK I│
                   │             └────┬───────┘ └───────────────────┘
          ┌────────▼──────────┐       │
          │ T4 admin/seed.ts  │  ┌────▼──────────────┐
          │    (+T4b tests)   │  │ T7 resolution/    │
          └────────┬──────────┘  │    void.ts (+T7b) │
                   │             ├───────────────────┤   TRACK E
          ┌────────▼──────────┐  │ T8 resolution/    │
          │ T5 admin form.tsx │  │    settle.ts(+T8b)│
          └───────────────────┘  ├───────────────────┤
                                 │ T9 conservation   │
                                 │    callers ×5     │
                                 └───────────────────┘

  T11 docs/specs/cpmm.md §7.1 + §7.3  — same commit as T1+T3 (§5.12)
  T12 full-suite green sweep          — depends on everything
```

**Critical path:** `T1 → T2 → T3 → T4 → T5` and `T2 → T6 → {T7, T8, T9}`.
`T10` is independent of Track E and can run in parallel with it once `T2` lands.

**RED-first order (§5.6).** `T1b`, `T3b`, `T6b`, `T7b`, `T8b`, `T10b` are
`@test-writer` output and must be **red before** their implementation task.
`T4b`, `T5` are wire/UI and follow the existing `pool-seed.test.ts` shape.

---

## §4 · Tasks

### T1 · `src/server/cpmm/calculate.ts` — the reserve-placement primitive (A)

**Lines touched:** insert after `seedPool` at **`:29–33`**; `seedPool` itself is
**kept, not deleted** (see OD-2). New exports land at `:34` onward. No existing
function body changes. Est. **+70 lines**.

**Change.** Two exported functions over one shared core. `openingReserves({
openingPriceYes, tank })` returns `{ reserves, backingMinted, discardedYes,
discardedNo }` and is what B calls at open: it computes `yes = (1−p)·tank`,
`no = p·tank`, mints `max(yes,no)` pairs and discards `max−min` on the short
side. `addLiquidity({ reserves, amount })` is A proper — `L' = L + a`,
`S' = S + a·(S/L)` — and exists in Phase 1 as the **specification and test
oracle** that Phase 2's SQL is differentially fuzzed against; nothing in Phase 1
calls it at runtime, which is deliberate and is why it must be fuzzed now rather
than beside its first caller. Both return the discard as a **residual**
(`discarded := amount − (S' − S)`) rather than as an independently rounded
product, so the backing identity closes **exactly** at 18 dp no matter which way
`S'` rounds. `S'` uses `floor18`, matching the file's standing convention that
rounding dust accrues to the pool and never to a participant
(`calculate.ts:52–53`, INV-C2).

**Test that proves it:** `tests/unit/cpmm/liquidity.property.test.ts` (T1b).

### T1b · `tests/unit/cpmm/liquidity.property.test.ts` — NEW FILE

**Change.** fast-check property suite, fixed `seed` + `numRuns ≥ 10,000` in the
style of the existing `invariants.property.test.ts` (which is the only file in
`tests/unit/cpmm/` that already runs generative properties over reserve pairs —
`_arbitraries.ts` supplies the generators). Five properties:

| # | property | bound |
|---|---|---|
| 1 | **Price invariance.** `\|price(addLiquidity(r,a)) − price(r)\| ≤ 1e-18` | ≥ 10,000 pairs |
| 2 | **The 90:1 case explicitly**, not left to the generator | `(90000, 1000)` + the D-14 `(90000, 10000)` |
| 3 | **Backing closes exactly.** `(S'−S) + discarded == a` at 18 dp | same corpus |
| 4a | **`openingReserves` hits the price on the nose, on a whole-Đ tank.** `getPrices(reserves).yes == openingPriceYes`, exact equality | all `p ∈ (0,1)`, integer `T` |
| 4b | **…and to within one ulp on any tank.** `\|getPrices(reserves).yes − openingPriceYes\| ≤ 1e-18` | all `p ∈ (0,1)`, any 18-dp `T ≥ 1` |
| 5 | **Direction pin.** `openingPriceYes = 0.1` ⇒ `yes > no` | fixed case, not generative |

⚠ Property 1 is `≤ 1e-18` — **one ulp, not a strict inequality, and not exact
equality**. `a·S/L` is generally non-terminating (at the D-14 ratio it is `a/9`),
so a fixed-18-dp output cannot preserve price exactly; and a floored `S′` can move
a half-even-quantized price by exactly one ulp, which a `<` bound would reject.
Corrected at the LIQ-1-P1-EXEC rulings (R4), and the ADR's acceptance row was
corrected to `≤` in the same pass. **A strict bound here fails a CORRECT
implementation**, which is the worst kind of wrong test: the next person to hit it
loosens it, on a money path, without a ruling.

⚠ **Property 4 is TWO arms and the original single row was unsatisfiable.**
`no = floor18(p · T)` is exact only when `p · T` is representable at 18 dp; two
arbitrary 18-dp values multiply to 36 fractional digits and the tail is dropped.
Exact equality therefore holds on a whole-Đ tank — which is the entire product
domain, since every tank in ADR §Constants is a whole number of Đ — and to within
one ulp otherwise, the residue being amplified by `1/T` as `T` falls (hence the
1 Đ floor on the generator). Split by `@test-writer` at execute and ratified as
addendum **D1**; the original row asked for something no correct implementation
could deliver.

**Property 3 is the load-bearing one** — it is what makes the residual-discard
design correct, and it is the property a "round both sides independently"
implementation would fail.

### T2 · `src/server/events/schemas.ts` — the `market.opened` payload

**Lines touched:** **`:205–208`** (the payload object) and the authoring comment
at **`:182–183`**. Est. **+18 lines**.

**Change.** `market.opened` becomes a **`z.union`** of a legacy variant
(`{ marketId, seedAmount }`) and a new variant (`{ marketId, yesReserves,
noReserves, openingPriceYes, backingMinted, discardedYes, discardedNo }`), all
`numericString`. ⛔ **A union, not six added required keys, and this is the
single highest-risk decision in Phase 1 — see OD-1.** Every historical
`market.opened` row on staging and in every fixture carries `seedAmount` alone;
`price-series.ts:199` `.parse()`s that payload on **every Discovery and debate
page load**, so making the new keys required turns twelve staging markets and
roughly twenty test files into hard parse failures at once.

**Test that proves it:** `tests/server/events/insert.test.ts` gains a legacy-row
round-trip and a new-row round-trip; both must parse.

### T3 · `src/server/markets/open.ts` — asymmetric open (B)

**Lines touched:** docblock **`:18–38`**, signature **`:39–51`**, validation
**`:52–58`**, the pools INSERT **`:87–96`**, the event emit **`:113–120`**, the
return **`:122–128`**. Est. **+45 / −12**.

**Change.** `args.seedAmount: string` becomes `args.openingPriceYes: string` +
`args.tank: string`. `SEED_RE`/`ZERO_SEED_RE` keep guarding `tank`; a new
`PRICE_RE` guard rejects any `openingPriceYes` outside the **open** interval
`(0,1)` — `0` and `1` are rejected because either produces a zero reserve, and
`requirePositive` throughout `calculate.ts` would then throw from inside the
transaction rather than at the boundary. The body calls
`openingReserves(...)` from T1, writes the two distinct values to the two
columns, and emits the new payload variant. The docblock's *"symmetric by code
shape — both columns bind the SAME string"* comment and its `cpmm.md §7.1`
citation both **must** be rewritten in this commit: **O-9** — editing prose that
cites a governing document by section number, in a way that changes what the
citation asserts, is a same-commit-rider trigger, and T11 is that rider.

**Test that proves it:** `tests/server/admin/pool-seed.test.ts` (T3b) — it
already asserts the symmetric shape at `:185` with
`expect(payload).toEqual({ marketId, seedAmount: SEED })` and at `:260–267`
("Carry-forward 2 (Y₀ = N₀)"). Those assertions are **inverted, not deleted**,
so a regression to symmetric reserves reddens.

### T4 · `src/server/admin/markets/seed.ts` — `seedPoolAction` takes two values

**Lines touched:** `seedSchema` **`:22–25`**, the parse **`:32–35`**, the call
**`:40–46`**, the return DTO **`:49–52`**, docblock **`:17–21`**. Est. **+14 / −8**.

**Change.** The zod schema takes `openingPriceYes` and `tank` in place of
`seedAmount`; both go through `canonicalizeAmount18` before the service, exactly
as `seedAmount` does today (CR-3/SA-I-3), so an over-precision value still
throws `MarketSeedInvalidError → seed_invalid` at the boundary with no silent
rounding. The `ActionResult` payload reports the two reserves actually written
rather than the input, so the admin sees what landed.

**Test that proves it:** `tests/server/admin/pool-seed.test.ts:316–407` — the
wire-action block; `seedFormData()` at `:357` gains the second field.

### T5 · `src/app/(admin)/admin/markets/[marketId]/page.tsx` — the form

**Lines touched:** **`:99–107`** (the `Draft` branch's `<form action={runSeed}>`).
Est. **+6 / −3**.

**Change.** The single `Seed amount` input becomes two — `openingPriceYes` and
`tank` — matching T4's schema field names. This is the admin surface, not a
participant one; it stays unstyled, consistent with the rest of the page.

**Test that proves it:** none directly (admin form markup carries no design
canon and no component test today); T4b covers the action it posts to. Stated
rather than papered over.

### T6 · `src/server/markets/backing.ts` — the `(D_yes, D_no)` function — NEW FILE

**See §5 for the location decision.** Est. **+55 lines**.

**Change.** `loadMarketDiscards(client, marketId)` returns
`{ yes: string; no: string }` — the cumulative discard per side, summed from
events. In Phase 1 the only source is `market.opened`: a new-variant payload
contributes its `discardedYes`/`discardedNo`, and a **legacy** payload
contributes `("0","0")`, which is exactly right because a symmetric seed
discards nothing. The function is written to **sum**, not to read one row, so
Phase 2 adds `pool.liquidity_added` to the same `WHERE event_type IN (...)`
and no call site changes. It takes an explicit `client` argument (a `db` or a
`tx`) rather than importing `db` itself, because `void.ts` and `settle.ts` both
call it **inside** their W-3 transaction under the pool lock, and a second
connection there would read outside the lock.

**Test that proves it:** `tests/server/markets/backing.test.ts` (T6b) — legacy
row → `(0,0)`; new-variant row → the payload's values; absent row → `(0,0)`;
and a two-row future-shape case that pins the summation rather than the
single-row read.

### T7 · `src/server/resolution/void.ts` — the cross-assert (E)

**Lines touched:** **`:174–200`** — specifically the comment at **`:174–177`**,
`cash` at **`:187`**, `crossCash` at **`:188`**, the throw at **`:189–193`**.
Est. **+12 / −6**.

**Change.** `cash = Y + H_yes + D_yes` and `crossCash = N + H_no + D_no`, with
`(D_yes, D_no)` from T6 read on the same `tx` under the pool lock. The
cross-assert **stays** and stays fatal — it is the only place the books are
checked against themselves — but it now compares the two true backings instead
of two half-identities. ⛔ **This is the function that fails first today**: its
own comment (`:176–177`) says *"assumes the symmetric seed Y₀ = N₀ — an
asymmetric ENGINE.14 seed breaks this loudly, never silently"*, and a
90,000/10,000 market makes `Y + H_yes ≠ N + H_no` by 80,000, so `voidMarket`
throws rather than voids. The comment is rewritten in the same commit: it
currently documents an assumption this task removes.

**Test that proves it:** `tests/server/resolution/void.test.ts` (T7b) gains
*"void of an asymmetric 90,000/10,000 market with positions reconciles"* — the
ADR's `Void, asymmetric` acceptance row. It **must be red before T7**: run it
against `main` and it throws the cross-assert error, which is the proof the test
exercises the defect rather than describing it.

### T8 · `src/server/resolution/settle.ts` — the residual (E)

**Lines touched:** **`:187–195`** (the `poolUnwindAmount` derivation and its
`(♦)` comment) and the docblock's R-9.5/R-9.5e clause at **`:23–31`**.
Est. **+10 / −4**.

**Change.** `poolUnwindAmount = winningReserve + D_winning` rather than the bare
winning-side reserve. The `(♦)` comment claims the reserve *is* the residual
"with zero rounding gap"; that claim is true only when the discard on the
winning side is zero, which is true today and false the moment a market opens
asymmetrically. On D-14's markets the YES reserve is the long one, so `D_yes = 0`
and a **YES** outcome is unchanged — **the NO outcome is where the number moves**,
by exactly `D_no = 80,000`. That is why the acceptance table names the NO branch
specifically and why the test does too.

**Test that proves it:** `tests/server/resolution/happy-path.test.ts` (T8b) gains
a NO-outcome case on an asymmetric market asserting
`residual == N + D_no` and `totalPaidOut + residual == deposited`.

### T9 · The five conservation callers (E)

**Files and lines** (RECON-2 §5c; production callers: **zero**):

| # | file:line | change |
|---|---|---|
| 1 | `tests/staging/gates.staging.test.ts:418–460` | all three branches start from **backing**, not `payload->>'seedAmount'` |
| 2 | `tests/scale/_harness/reconcile.ts:138–150, 340–365` | same, three branches |
| 3 | `tests/scale/hot-row-contention.scale.test.ts:266–269` | `SYNTHETIC_SEED_RESERVES` → synthetic **backing** |
| 4 | `tests/integration/resolution-conservation.integration.test.ts:210, 294, 340, 397` | `SEED` → backing at four sites |
| 5 | `tests/integration/dharma-ledger.integration.test.ts:287` | literal `"15"` — **audit only**, see below |

**Change.** Every derivation currently opens with `seed`, the single scalar off
the payload; it becomes the **seed backing** (`max(yes₀, no₀)` for a new-variant
row, `seedAmount` for a legacy one — which is the same number, since a symmetric
seed's backing *is* `C`). ⚠ Caller 5 passes a hand-written `"15"` against
hand-written flows and derives nothing from any seed; it is **listed to be
audited, not edited**, and if the audit confirms it derives nothing the row
closes with no diff. Saying so here is the point — a task list that silently
drops a site looks identical to one that checked it.

⚠ **Caller 1 is `tests/staging/`** — an ADR-0035/0036 operational runner against
the **live staging database**, not a test. It cannot run in CI and is exercised
only by §7's reseed.

### T10 · `src/server/discovery/price-series.ts` — chart replay (I)

**Lines touched:** **`:203`** (the seed), the docblock at **`:167`** and the
`loadPriceSeries` docblock at **`:268–283`** (which states *"first point exactly
0.5 for a symmetric seed"* at `:271`). Est. **+10 / −3**.

**Change.** `let reserves = seedPool(openedPayload.seedAmount)` becomes a branch
on the payload variant: new-variant rows seed from `{ yes: yesReserves, no:
noReserves }` directly, legacy rows keep `seedPool(seedAmount)`. ⛔ **This is
the site that fails silently** and the reason `I` is in Phase 1 rather than
Phase 2: the F-1 drift check at `:274–278` compares the walk's final reserves to
the live `pools` row and, per its own docblock, *"WARNs
(`discovery_price_series_drift`) and ALWAYS serves the computed series — never
throw/500"*. **A warn, not a gate.** An asymmetric market replayed from a
symmetric seed would draw a wrong price line on every Discovery card and every
debate page, and the only signal would be a log line nobody is watching.

**Test that proves it:** `tests/server/discovery/price-series.test.ts` (T10b) —
the file already builds `{ marketId, seedAmount: SEED_AMOUNT }` payloads at
`:271, 343, 432, 531`; it gains an asymmetric-payload case asserting the first
point is `0.10`, **not** `0.5`, and that the walk's final reserves match the
live pool row exactly (drift = 0, the ADR's `Replay` acceptance row).

### T11 · `docs/specs/cpmm.md` §7.1 + §7.3 — the amendment

Same commit as T1 + T3 (§5.12, and O-9 via `open.ts`'s docblock citation).
**Exact text in §6.** Version **2.1.0 → 3.0.0**: the file's own rule at `:8` is
*"MAJOR on any change to a formula or invariant"*, and `(y0,n0) = (C,C)` is a
formula this task changes.

### T12 · Full-suite sweep

`pnpm vitest run` — the whole suite, not the named gate list. ~165 s locally
against the Postgres on `:54322`. The ADR's *"all seven existing CPMM test files
green"* row is discharged here and named explicitly, because `tests/unit/cpmm/`
is exactly seven files (`ls`: `_arbitraries.ts`, `buy.property`, `calculate`,
`invariants.property`, `sell.property`, `validate`, `vectors`) and six of them
are tests.

---

## §5 · Where `(D_yes, D_no)` lives, and why

### **`src/server/markets/backing.ts`**

**One sentence:** `markets/open.ts` is the only writer of `market.opened` in the
repository, so the function that reads that payload back belongs in the same
directory as the function that wrote it — one directory owning both ends of the
event, rather than a reader stranded in a consumer's tree.

**Measured support for the choice, and against each alternative:**

| candidate | verdict |
|---|---|
| **`src/server/markets/`** ✅ | `resolution/{settle,void}.ts` **already import `@/server/markets`** (measured) — T7/T8 add no new dependency edge. |
| `src/server/cpmm/` | ⛔ `calculate.ts` imports only `./decimal` and `./validate`. It is pure, and its purity is load-bearing: it is Phase 2's differential-fuzz oracle. A DB read there ends that. |
| `src/server/dharma/` | ⛔ `conservation.ts` has **zero** `@/db`/`drizzle-orm` imports (measured: `grep -c` → 0). It would become the only DB-reading file in a deliberately pure module. |
| `src/server/resolution/` | ⛔ Two of the three consumers are resolution; the third (conservation) is not, and would import a resolution module to check an identity that is not about resolution. |
| a column on `pools` | ⛔ **The ADR permits this only with a measured reason** (a query cost inside `settle`/`void` under the pool lock). There is none: the read is `events_aggregate_idx` on `(aggregate_type, aggregate_id)` for a handful of rows — the ADR's own bound is *"at most ~30 rows per market"* — and a column would need a migration, which is the thing §0 establishes Phase 1 does not have. **Events, per the ADR's default.** |

---

## §6 · Exact amended text for `cpmm.md` §7.1 and §7.3

Replacing `docs/specs/cpmm.md:296–312` and `:347–354` verbatim. §7.2 and §7.4
are **untouched in Phase 1** (§7.4 is Phase 2; §7.2's slate paragraph is
narrowed by §7.1's new closing sentence rather than rewritten, and its own
rewrite rides Phase 2 with SPEC.1 §10.6).

### §7.1 — replacement text

```markdown
### 7.1 Seed mechanism

At the `Draft → Open` transition the admin opens the market at a chosen
price by committing a tank of T Đ to the pool — recorded as the
`yesReserves`, `noReserves`, `openingPriceYes`, `backingMinted`,
`discardedYes` and `discardedNo` payload fields on the `market.opened`
events row plus the `pools` reserve initialisation, never a
`dharma_ledger` row (R-2; SPEC.1 §10.1). Given an opening price
p = p_yes ∈ (0,1), the reserves initialise ASYMMETRICALLY:

    (y0, n0) = ((1 − p) · T,  p · T)      ⇒      p_yes = p at seed

since a side's price is proportional to the OPPOSITE reserve (§3.3): a
LOW p_yes means a LARGE yes-reserve. At p = ½ this reduces to the
symmetric (T/2, T/2) and everything below is a no-op — the symmetric seed
is the special case, not the rule.

In pair-mint terms (§3.2) the open mints B = max(y0, n0) share pairs, of
which min(y0, n0) of the short side enter the pool and the remaining
B − min(y0, n0) are DISCARDED — permanently destroyed, held by no one,
in no position. Discards are what let a price be set with no holder for
the excess side, which is the constraint §7.2 describes. They are
LARGE: the discard fraction is 1 − min(p, 1−p) / max(p, 1−p), which is
88.9% at a 10% open.

Because discarded shares leave the pool without entering a position, the
pair-mint accounting of §3.2 is completed by the BACKING IDENTITY, which
holds per side at every instant of a market's life:

    Y + H_yes + D_yes  ==  N + H_no + D_no  ==  total Đ deposited

where Y, N are the reserves, H_x the sum of user-held shares on side x,
and D_x the cumulative discards on side x. D is summed from events —
`market.opened` and, from ADR-0047 Phase 2, `pool.liquidity_added` —
and is the term that makes §8's unwind and void arithmetic close on an
asymmetric market. A symmetric seed has D_yes = D_no = 0, which is why
the identity was invisible before this section was written.

T > 0 and p ∈ (0,1) are parameters of market opening; magnitude and
policy are owned by SPEC.1 §10.5/§16.1 and by ADR-0047. This file fixes
the mechanism: asymmetric initialisation at a chosen price, exactly
once, with the excess discarded. There is still no curve-weight dial —
upstream's `p` parameter (which lets Manifold open at an arbitrary
probability with equal reserves, since equal reserves give prob = p
exactly) remains stripped (§1, §2), and is a different mechanism from
the p above: this p is a target price, not an exponent. The
reserve-placement primitive that computes the pair, and the
price-preserving addition that §7.4 will admit, are one function —
`openingReserves` / `addLiquidity` in `src/server/cpmm/calculate.ts`,
derived from upstream's `addCpmmLiquidityFixedP` under the §2 MIT
attribution.
```

### §7.3 — replacement text

```markdown
### 7.3 Rejected reserve-side alternatives (recorded)

**AMENDED by ADR-0047 (2026-09-06). The first rejection below is
REVERSED; it is kept in place, struck, because the reasoning that
overturned it is the substance of the amendment.**

~~Asymmetric open via one-sided share burn at seed — mint C pairs, burn
x of one side for reserves (C, C − x) — is solvency-safe but rejected:
it sets a price by fiat with no stake and no argument behind it, exactly
what the curation-slate route avoids.~~

**ACCEPTED, and it is now the only open mechanism (§7.1).** The
objection was that a burn sets a price "by fiat with no stake and no
argument behind it". Measured, the alternative it protected does worse
on its own terms: reaching a 10% open by curation slate requires
operator-controlled participant accounts to hold NO positions worth
twice the seed, riding to resolution, each carrying a mandatory argument
under INV-1 that the operator does not hold — arguments by fiat, with
stake, which is strictly further from an honest book than a discard
nobody holds. A discard has no holder, no position, no vote, no payout
and no leaderboard row; it is an accounting fact, disclosed in the
dataset. Setting the price structurally and letting the slate seed
ARGUMENTS ONLY — with stakes too small to move the price — separates the
two things the slate was conflating. See ADR-0047 §Decision Outcome B
and §Consequences.

Reintroducing the upstream `p` weight **remains rejected**, and ADR-0047
re-examined it against a measurement rather than inheriting this
sentence: it rewrites every function in `src/server/cpmm/` around
fractional powers, weakens the exact-arithmetic contract of §10, needs a
column on `pools`, buys no discarded shares — worthless to a mint that
can simply not mint them — and yields a curve that measures equally
lopsided at a 10/90 open (YES:NO impact 14:1 against fixed-p's 12:1).
Upstream itself runs fixed-`p` with discards for its multi-choice
markets. Either revisit is an ADR, not an edit; the `p`-weight revisit
is reasonable at testnet and out of scope for the experiment.
```

---

## §7 · Staging reseed, post-merge — commands

All twelve markets to `90,000 / 10,000` via the ADR-0035 guarded reset.
⚠ **This is the LIVE staging database** (ADR-0035/0036). Run from the primary
tree on merged `main`, never from a worktree, and never with another CC session
on the repo.

```bash
# 0 · PRECONDITION — the merge is on main and staging is running it.
git -C ~/code/zugzwang/experiment fetch origin && \
git -C ~/code/zugzwang/experiment log --oneline -1 origin/main
curl -s https://<staging-host>/api/health | jq -r '.canary, .env, .migrations'
#   canary MUST equal the merge SHA. O-4 is OPEN — read the canary, never assume.

# 1 · Push staging BEFORE any branch (O-10 — Vercel dedups the same SHA
#     across refs; branch-first makes it skip the staging deployment entirely).
git -C ~/code/zugzwang/experiment push origin origin/main:staging

# 2 · Reserves for all twelve markets, in tests/staging/fixtures.ts.
#     seedAmount: "100" | "5000"  →  openingPriceYes: "0.10", tank: "100000".
#     This is a CODE EDIT in the same PR, not a runtime flag — fixtures.ts is
#     the literal fixture table (no RNG) and tests/unit/staging/fixture-table.test.ts
#     pins its consistency, so the edit is gated by a unit test before it ever
#     reaches staging.

# 3 · REBUILD — reset (guarded truncate + identity_pool reseed) → generate
#     (drives the ENGINE: openMarket/place/sell/settle — never hand-written
#     rows, per ADR-0036 primitive 3) → gates (the six verification gates).
pnpm staging:rebuild

#     Equivalently, one stage at a time when a stage fails:
pnpm staging:reset      # ZUGZWANG_STAGING_RESET_ACK=wipe-staging-i-mean-it, then db:seed:staging
pnpm staging:generate   # ZUGZWANG_STAGING_WRITE_ACK=generate-staging-fixtures
pnpm staging:gates      # read-only; no intent token by design

# 4 · VERIFY the open actually landed asymmetric — three independent reads.
psql "$STAGING_POOLER_URL" -c \
  "SELECT m.slug, p.yes_reserves, p.no_reserves,
          round(p.no_reserves/(p.yes_reserves+p.no_reserves), 4) AS price_yes
     FROM pools p JOIN markets m ON m.id = p.market_id
    ORDER BY m.slug;"
#   EXPECT twelve rows, 90000 / 10000, price_yes 0.1000 on every one.

psql "$STAGING_POOLER_URL" -c \
  "SELECT count(*) FILTER (WHERE payload ? 'yesReserves')  AS new_shape,
          count(*) FILTER (WHERE payload ? 'seedAmount')   AS legacy
     FROM events WHERE event_type = 'market.opened';"
#   EXPECT new_shape = 12, legacy = 0 after a full reset.

#   Gate 2 (conservation) is the real arbiter and pnpm staging:gates already
#   ran it; this is the read that says WHY if it went red.

# 5 · The chart — the silent-failure surface. Load a market and confirm the
#     first point is 0.10, not 0.50.
curl -s https://<staging-host>/api/health | jq -r '.canary'   # re-confirm build
#   then open /m/<slug> and read the first price point.

# 6 · SOAK 7 days before 15 September (ADR §Execution).
```

⚠ **`staging:reset` truncates.** ADR-0035's five-guard contract (intent ·
target · environment · live connection · post-run verification) is what stands
between this command and a wrong database; the intent token is not decoration.

---

## §8 · Reviewer cascade

Per §5.11, invoked **explicitly**, each passed `@docs/plans/LIQ-1-P1_plan.md`.
Launch the reviewer-bearing session from a worktree at `origin/main` — agent
definitions load from the session's working directory and are not hot-reloaded.

| order | agent | on what | when |
|---|---|---|---|
| **1** | `@test-writer` | T1b, T3b, T6b, T7b, T8b, T10b — failing tests against §4's test rows, **before** any `src/` edit | Phase 2 start (§5.6) |
| **2** | *(execute)* | §5.10 pre-PR self-audit — item by item against §4, PASS / FAIL / SURPRISE. Not a subagent step. | before `gh pr create` |
| **3** | `@code-reviewer` | the whole `src/server/` diff — `cpmm/calculate.ts`, `markets/{open,backing}.ts`, `events/schemas.ts`, `admin/markets/seed.ts`, `resolution/{void,settle}.ts`, `discovery/price-series.ts` | post-audit |
| **4** | `@security-auditor` | critical-path business logic — `resolution/`, `markets/`, and the admin open path, for INV-1…4 gaps | after 3 |
| **—** | ~~`@db-migration-reviewer`~~ | **DOES NOT RUN.** Phase 1 has no migration — grep-confirmed in §0: head is `0026_lots_no_delete`, `pools` needs no CHECK, `event_type` is `text`, `payload` is `jsonb`. | — |

**Run 3 and 4 sequentially, not concurrently** — concurrent subagent `vitest`
saturates the local Postgres and a generic scope has missed a real fail-open
before. Give each a directed scope, not "review the branch".

---

## §9 · Risks, each with the test that bounds it

| # | risk | why it is real | bounded by |
|---|---|---|---|
| **R1** | **Payload change breaks every historical row.** Six required keys would make `price-series.ts:199` `.parse()` throw on all twelve staging markets and ~20 fixture files. | Measured: `seedAmount` appears in 20+ test files; `pool-seed.test.ts:185` asserts payload **exact equality**. | T2's `z.union` + `insert.test.ts` legacy round-trip. **The legacy case is the load-bearing half** — a union with no legacy test is a union nobody proved. |
| **R2** | **Reserve direction inverted** — writing `yes = p·tank` instead of `(1−p)·tank` opens every market at 90% YES and nothing errors. | A side's price is proportional to the **opposite** reserve (`calculate.ts:36–37`). Both orderings type-check and both produce a valid pool. | T1b property 5 (fixed, non-generative) + §7 step 4's `price_yes = 0.1000` read on all twelve. |
| **R3** | **Chart replays symmetrically and warns instead of failing.** | `price-series.ts:274–278` WARNs on drift and *"ALWAYS serves the computed series"*. Wrong line, no alarm. | T10b's drift-= 0 assertion + §7 step 5's first-point read. |
| **R4** | **`voidMarket` throws on the first asymmetric market.** | `void.ts:189` cross-assert; its own comment predicts it. | T7b, **red before T7** — if it passes against `main`, it is not exercising the defect. |
| **R5** | **Settle silently under-reports on NO.** Not a throw — a wrong number that reconciles nothing. | `settle.ts:189` reads the bare winning reserve; on D-14 markets `D_no = 80,000`. | T8b's NO-outcome case: `residual == N + D_no` **and** `totalPaidOut + residual == deposited`. |
| **R6** | **Rounding breaks the backing identity.** `a·S/L` is non-terminating at the D-14 ratio; independently rounding both sides leaves a residue that never closes. | 18-dp fixed output cannot represent `a/9`. | T1b property 3 — discard as **residual**, `(S'−S) + discarded == a` exactly, over ≥10,000 pairs. |
| **R7** | **A conservation caller is missed** and the identity is computed wrong while returning `ok: true`. | RECON-2 §5e: *"the checker compares two numbers the caller hands it"* — it cannot catch its own bad input. | T9 enumerates all five with file:line; caller 5 is audited-not-edited **on the record**. Staging gate G2.1 is the live arbiter. |
| **R8** | **The spec amendment is skipped or lands in a follow-up.** | §5.12, and O-9: `open.ts`'s docblock cites `cpmm.md §7.1` by number and this task changes what that citation asserts. | T11 in the **same commit** as T1+T3; grep-verified in the §5.10 self-audit. |
| **R9** | **The staging reseed runs against the wrong tree.** O-4 is OPEN — staging is not always on `main`. | The parked SHA has been wrong twice. | §7 step 0 reads `/api/health` `canary` and matches it to the merge SHA **before** the reset, not after. |
| **R10** | **`addLiquidity` ships with no runtime caller** and rots before Phase 2. | Nothing in Phase 1 calls it. | It is the Phase 2 SQL's differential oracle; T1b fuzzes it at ≥10,000 pairs, so it is exercised harder than most shipped code. Named as deliberate, not as an oversight. |

---

## §10 · Open decisions for sign-off

Three, and **OD-1 is the one that changes the shape of the work**.

- **OD-1 · The `market.opened` payload is a `z.union`, not six added keys.**
  Recommended, and §4 T2 is written for it. The ADR says the payload "gains"
  the fields and does not address the ~20 fixture files and twelve live staging
  rows that carry the old shape. The alternative — required keys plus a
  data migration over historical rows — is a migration, which would pull
  `@db-migration-reviewer` in and make §0's central claim false. **If the
  founder prefers the clean break, Phase 1 grows a migration and this plan
  needs a second pass.**
- **OD-2 · `seedPool` is kept, not deleted.** It is used by six of the seven
  `tests/unit/cpmm/` files including the `cpmm.md` §12 worked vectors, which are
  the spec's own examples. Deleting it would rewrite the vector suite in a task
  that has no mandate to.

  ⚠ **Amended at addendum D1: it has ZERO `src/` callers, and the rationale this
  row originally gave is void.** It said `seedPool` "stays as the legacy-payload
  replay path in `price-series.ts`" — but R1 forbids a consumer from knowing which
  payload variant it holds, so `price-series.ts` seeds from `seedReserves` over the
  pair `readOpenedReserves` returns, for legacy and asymmetric rows alike. The two
  rulings' rationales interact and R1 wins: you cannot both branch on the variant in
  `price-series.ts` and forbid consumers from inspecting the shape. The decision to
  keep it is unchanged and still right — the vector suite is the reason — but "kept
  because X" where X no longer holds is how a function becomes dead code two phases
  later without anyone noticing.
- **OD-3 · `cpmm.md` 2.1.0 → 3.0.0 (MAJOR).** The file's own rule at `:8`.
  Flagged because it is the first MAJOR bump this file has taken.

---

## §11 · Estimated CC hours

| task | h | note |
|---|---|---|
| T1 · cpmm primitive | 1.5 | small surface, exact-arithmetic care |
| T1b · fuzz suite | 2.0 | ≥10,000 runs; property 3 is the subtle one |
| T2 · payload union | 1.0 | small diff, large blast radius |
| T3 · `openMarket` | 1.5 | critical path, full ritual |
| T3b · `pool-seed.test.ts` | 1.5 | invert existing symmetric assertions, don't delete |
| T4 · `seedPoolAction` | 0.5 | |
| T4b · wire-action tests | 0.5 | |
| T5 · admin form | 0.25 | |
| T6 · `markets/backing.ts` | 1.5 | new file, tx-scoped client |
| T6b · backing tests | 1.0 | |
| T7 · `void.ts` | 1.5 | critical path |
| T7b · asymmetric void test | 1.5 | must be red first |
| T8 · `settle.ts` | 1.0 | critical path |
| T8b · NO-outcome settle test | 1.25 | |
| T9 · five conservation callers | 2.0 | one is a live-staging runner |
| T10 · `price-series.ts` | 1.0 | |
| T10b · chart replay tests | 1.25 | |
| T11 · `cpmm.md` §7.1/§7.3 | 1.0 | text is drafted in §6 |
| T12 · full suite + fixes | 1.5 | |
| §5.10 pre-PR self-audit | 1.0 | |
| Reviewer cascade (3 → 4) + fixes | 2.5 | sequential |
| **Subtotal** | **27.75** | |
| Contingency ~15% | 4.25 | R1 and R6 are where it goes |
| **TOTAL** | **≈ 32 CC hours** | |

**Excluded** — operator-time, not CC-time: the §7 staging reseed (~1 h wall,
founder-present), the 7-day soak, and Gate C review.

---

*Written in plan-mode. No `src/` file was edited. LIQ-1 Phase 1, against
`origin/main` `20cd322c`, ADR-0047 committed at `5cc43ccc`.*
