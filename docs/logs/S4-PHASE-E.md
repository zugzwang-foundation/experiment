# S-4 Phase E — Session log

**Task:** S-4 Phase E — poll and budgets.
**State at close:** uncommitted (Phases A–D committed at `6b9b87d`).

---

## What landed

**`docs/logs/S4-PHASE-E-warm-path.md`** — the warm-path characterisation note for S-5/S-8. The
phase's primary deliverable, and the one thing here that changes decisions downstream.

**`tests/server/debate-view/round-trip-budget.test.ts`** (new) — the polled surface's read
budget, pinned in three parts (warm remainder / cached block / viewer context) with **two
positive controls**. Collect-verified locally; it executes in CI, which runs a Postgres-17
service.

**Nothing in `src/` changed.** Phase E is measurement, guards and a finding — see §"could not
fix" below for why the one available code change was declined.

---

## Measured (the numbers the note is built on)

| Path | Statements | Time* |
|---|---|---|
| Anonymous warm tick | **2** | 116.1 ms |
| Signed-in warm tick | **10** | 665.8 ms |
| — layout header (replayed every tick) | 3 | 157.7 ms |
| — viewer context | 5 | 392.0 ms |
| Cached block (cost on a miss) | 12 | — |

\* From a laptop over the public internet to `ap-south-1` — **not** `bom1`. PERF-1 measured the
co-located round trip at 5.34 ms, so these are ~10–15× inflated. **The counts are exact; the
timings are directional.** The note states this at the top because it is the easiest thing here
to misread.

**Against Phase A's 23–29 baseline: ~2.5× fewer statements signed-in, ~12× anonymous.**

The headline for S-8, which is not the headline the phase brief expected: **"the 100th viewer"
is the wrong unit.** `'use cache'` is per-instance and in-memory, so cold misses scale with
*instance count*, not viewer count. At 10 instances the cold-miss overhead is 5% of total
statements; at 50 it is 19%. That crossover — not an opinion about Redis — is what decides
whether a shared cache pays.

---

## Two findings this phase could not fix

### The tick still replays the layout, and cannot stop here

All three routes to "the tick no longer replays the full layout waterfall" are closed:
a dedicated poll endpoint (forbidden — SPEC.2 §4.3's catalogue is closed at eleven, ADR-0034
keeps masking single-sourced, and `poll-contract.test.ts` pins the repo-wide `route.ts`
inventory so a twelfth cannot appear); `use cache: private` (ruled off-limits by the work pack,
open upstream bug); or restructuring the header out of the shared layout (the same
`DebateView` blocker Phase D reported).

What *was* reduced: Phase D's session dedupe already removed one of the two session lookups per
tick. The remaining 3 layout statements are genuinely viewer-scoped.

### `balance` and `cursor` are read twice per signed-in render

A real duplicate, surfaced by the measurement rather than by reading the code:
`dharma/header-balance.ts` (layout) and `debate-view/viewer-context.ts` (page) each read the
same balance row and the same cursor row. **2 duplicated statements per tick**; deduping would
take signed-in from 10 → 8.

**Declined deliberately.** It needs either an edit inside `src/server/dharma/**` — a CLAUDE.md §1
**critical path** *and* outside S-4's fence, i.e. an H1 halt — or reaching across
`viewer-context`'s transaction boundary, where `header-balance.ts` documents its
BALANCE-FIRST/CURSOR-SECOND order as a *correctness* constraint (reversing it turns a one-credit
understatement into a `DAILY_CREDIT_DHARMA` overstatement). **Recommended as its own scoped task
with the dharma ritual.**

---

## Self-check

- [x] **`POLL_INTERVAL_MS_DEBATE_VIEW` is unchanged** — `limits.ts` has zero diff; still 15000
- [ ] **Every surface has a cold-path budget test — 2 of 5.** Discovery (pre-existing) and
      `/m/[slug]` (new). **`/u/[pseudonym]`, `/bookmarks` and `/m/[slug]/export` are NOT
      written.** Not an oversight: local Postgres is unavailable here, so a budget test cannot
      be run before committing to its numbers. Writing three more files of exact-equality
      assertions I could not execute would be asserting counts I had inferred, in a guard whose
      entire value is that its number is measured. The polled surface was prioritised because
      its count carries a 15-second multiplier. **The remaining three need one session with a
      local database.**
- [x] **A future PR re-adding a trip goes red** — exact-equality on a driver-level counter, plus
      an explicit positive control that issues one extra read and asserts the count moves by one
- [x] **The warm-path note answers 2nd / 100th / 1000th** — and corrects the question's framing:
      the governing variable is instance count, not viewer count
- [x] Typecheck clean · Biome clean · 135 tests passing across 13 runnable files

⚠ **The new budget test's three counts (2 / 12 / 5) are traced, not executed.** They match the
Phase A trace and the live measurement above, but the assertions themselves have never run
against a database. **If CI reddens on them, the test is wrong and the numbers need correcting —
not the code.** Flagged so the first CI run is read as verification, not as a regression.

---

## Next session starts at

1. Local Postgres — then run the new budget test and correct its counts if CI/local disagrees,
   and write the remaining three surfaces' budgets in the same session.
2. The Design B / R3 ruling — still outstanding since Phase C, now governs two surfaces.
3. The balance/cursor dedupe as a scoped dharma-path task (§findings).
4. Phase F (close-out), which per the pack must end with "Findings affecting other strata" —
   §"could not fix" and the warm-path note's §5/§6 are that content.
