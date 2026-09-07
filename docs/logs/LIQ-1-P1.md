# LIQ-1 Phase 1 — session log

**Task:** LIQ-1-P1-EXEC — execute Phase 1 of ADR-0047 (asymmetric open, backing
identity, two-reserve chart replay), with the eight §R rulings and the D1–D3
addendum applied. Gated, critical path.
**Branch:** `liq-1/phase-1`, from `docs/adr-0047` @ the amended `0f7e9fd4`.
**Baseline:** `origin/main` `20cd322c`.

---

## What landed

Twenty-one commits. `src/` is ten files; there is **no migration** — `pools`
already permits asymmetry, `event_type` is `text`, `payload` is `jsonb`, so
`@db-migration-reviewer` correctly did not run.

| area | files |
|---|---|
| the primitive | `cpmm/calculate.ts` — `openingReserves`, `addLiquidity`, `seedReserves`; `seedPool` KEPT (OD-2) |
| the payload | `events/schemas.ts` — `market.opened` becomes a `z.union`; the `satisfies` bound widened then narrowed to `ZodObject \| ZodUnion<[ZodObject, …]>` |
| the reader | `markets/backing.ts` (NEW) — `readOpenedReserves`, `openingBacking`, `requireMarketDiscards` |
| the open | `markets/open.ts`, `admin/markets/seed.ts`, `admin/wire.ts`, the admin form |
| the money path | `resolution/void.ts` (cross-assert gains `D`), `resolution/settle.ts` (residual = `w + D_W`) |
| the chart | `discovery/price-series.ts` — seeds from the genesis reserves |
| specs | `cpmm.md` 2.1.0 → **3.0.0** (§1, §3.2, §7.1, §7.2, §7.3, §7.4, §8.1, §8.2, §8.4, §11, §12, §13, §14); `SPEC.2` 1.0.28 → **1.0.29** (§19.4.1); ADR-0047 drift + §F |

**Tests: 463 → 465 files, 4626 → 4661 tests.** Zero failures. `pnpm test:scale`
16 passed. `tsc --noEmit` 0. `biome check` exit 0 at the `origin/main` baseline.

---

## Decisions made

1. **Commit grouping is by smallest compiling unit, not one-per-task.** T3's
   signature change breaks T4, T5 and five test callers in one keystroke; T11 and
   R7 ride the mechanism commit because `open.ts`'s docblock cites `cpmm.md §7.1`
   by number (§5.12, O-9).
2. **`no = floor18(p·T)`, `yes = T − no`.** Flooring the NUMERATOR with an exact
   denominator is what lands the price on `p` AND keeps `yes + no == T` exact.
   Dust to the pool, never a participant (INV-C2).
3. **The `satisfies` bound is `ZodObject | ZodUnion<[ZodObject, …]>`, not
   `ZodTypeAny`.** `ZodTypeAny` admits a `z.string()`, which would break
   `insert.ts`'s jsonb write. D2 landed clean on the first attempt.
4. **Settle and void fail CLOSED on a missing or unreadable genesis row.** A
   wrong `poolUnwindAmount` on a terminal INV-4 row cannot be corrected; an
   unsettleable market can be. The tolerant read was deleted, not kept beside it.
5. **The fixtures were made faithful rather than the read loosened.** 33 tests
   across 11 files built markets that are `Open`/`Resolving` with no
   `market.opened` — a state `openMarket` cannot produce.
6. **HIGH-1 (genesis-probe scan cost): measured, no fix.** 15.2 ms at 200,000
   `bet.sold` rows on one market against a 5 s budget — a ~330× margin. Recorded
   with its threshold and a re-measure trigger.

---

## Surprises caught + fixed in-session

- **The `satisfies` clause blocks a union** — `TS2740`, unmentioned anywhere in
  the plan. Measured by applying the union alone before touching the clause.
- **`seedPool` has zero `src/` callers**, so OD-2's stated rationale is void
  (R1 removed the legacy replay path). The decision survives on the §12 vectors.
- **Staging gate 2 would have gone GREEN having checked nothing** — an asymmetric
  payload has no `seedAmount`, the SQL arrow returned NULL, and NULL is how that
  loop recognises a Draft market and skips it.
- **The staging wipe would have left eight markets permanently unterminable** —
  it truncates `events` while preserving `markets`/`pools`.
- **`cpmm.md` needed THREE sweeps.** The plan's T11 scoped §7.1 + §7.3; the claim
  it amends lives in six sections. Recorded as a plan gap each time.
- **The plan carried an unsatisfiable property** (T1b p4) and a bound R4 had
  already overturned (p1). Both amended at D1.
- **My own mutation check was incomplete** — it proved the T6b inversion reds on
  a regression to summing, not on a dropped `orderBy`. The reviewer caught it.

---

## Open questions

- **`openMarket` is not freeze-gated** — `docs/parked.md` **LIQ-1 L-4**, ruled,
  owner Phase 2.
- **A correction records no residual.** `market.corrected` carries no
  `poolUnwindAmount`; after a flip the only recorded residual is the stale one on
  `market.resolved`, which INV-4 forbids correcting. Pre-existing; this branch
  widens it by up to `D_W` (80,000 Đ on a D-14 market). Own task.
- **`tests/staging/fixtures.ts`** carries two stale magnitude rationales — gate
  5's G5.6 carrier claim now rests on different arithmetic than the sentence
  beside it.
- **D4 was referenced three times and never defined** (addendum §4.7, the resume
  brief, and the close brief). Nothing was invented for it.

---

## Next session starts at

**Gate C review of the PR**, then — post-merge only — plan §7's staging reseed:
push `staging` BEFORE the branch (O-10), read `/api/health` `canary` and match it
to the merge SHA (O-4 is OPEN), then `pnpm staging:rebuild`, then the 7-day soak
before 15 September. ⛔ **Not reseeded in this session, by instruction.**

⇒ **DISCHARGED 2026-09-07 (LIQ-1-FIX-1).** The reseed could not run as written:
`LONG_DEADLINE_MS` is 60 days and 60 days now lands past the conclusion freeze,
so `createMarket` rejected the first market with `MarketDeadlineCeilingError`.
Fixed by clamping fixture deadlines at their source (#494, merge `18cd027f`),
then reseeded — `pools` = 14, all fourteen opened at 90,000 / 10,000, chart
first point 0.10. **Soak day 0 is 2026-09-07.** One gate is red and is NOT this
fix: gate 4's coverage manifest (`docs/polish/staging-coverage.json`) is stale —
it still carries `bookmarks` entries ADR-0040 deleted, and the ten participant
pseudonyms moved when the PFP tuple ordering changed. Founder ruling owed on
whether that drift is deliberate; the regenerated file is written on disk by the
gate itself.

## Context to preserve

- `tests/staging/fixtures.ts` now opens all fifteen market fixtures at
  `openingPriceYes 0.10 / tank 100000`. A symmetric fixture set would leave every
  asymmetric path unexercised through a soak meant to exercise exactly those.
  ⚠ **Fifteen fixtures, FOURTEEN pools** — M1 alone stays `Draft` and never gets
  one, so any reseed check that expects twelve, or that counts markets and pools
  as the same number, is reading the wrong figure. Measured on the 2026-09-07
  reseed (plan §7, run after the deadline-clamp fix #494): `markets` = 15,
  `pools` = 14, `market.opened` rows = 14.
- `requireMarketDiscards` is the ONLY discard read on the money path. Phase 2's
  `pool.liquidity_added` rows sum in a SECOND query — genesis is once per market,
  injections are many, and one query cannot hold both properties. The plan is
  amended to say so.
- `@code-reviewer` ran three times and found a defect in the previous round's fix
  each time. The cascade earned its place here.

## Time

2026-09-06T10:09Z → 2026-09-07T01:30Z, one session, one network drop at
20:57 IST (nothing lost; the branch was committed, one file was on disk).
