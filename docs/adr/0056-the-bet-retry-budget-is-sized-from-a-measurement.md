# ADR-0056 — The Bet Retry Budget Is Sized From a Measurement

| | |
|---|---|
| **Status** | accepted |
| **Date** | 2026-09-17 |
| **Deciders** | Hrishikesh M. H. |
| **Tracker task** | HARDEN — production load-test remediation, the write path |
| **Frame document** | SPEC.2 §9 (W-1 retry policy) · ADR-0013 (the retry spine) · ADR-0038 decision 2 (sizing from measurement) |
| **Supersedes** | — |
| **Superseded-by** | — |
| **Amends** | ADR-0013 — the W-1 backoff bases only (`[50, 100, 200]` → `[50, 100, 200, 400, 800]`). The isolation level, the lock order, the retryable SQLSTATE set, the full-jitter formula and the fail-closed exhaustion error are all unchanged, and W-3 / W-4 keep the original bases |
| **Amended-by** | — |

---

## Context and Problem Statement

Every post on Zugzwang is a bet (INV-1), so it runs through W-1: `SERIALIZABLE` plus
`SELECT … FOR NO KEY UPDATE` on that market's pool row. Concurrent writers to the **same
market** therefore serialise on one row. Losers retry with full jitter on bases
`[50, 100, 200]` — a budget of 4 attempts — and then get
`error_bet_serialization_exhausted`.

The load-test programme needed to answer whether the product could carry ~5,000 concurrent
participants *and their activity*. Reads had been addressed (PRs #526/#551/#552/#554), and
the answer for writes rested on **one number: a 25-way burst that had refused some writers.**

⚠ **That number was unreliable and was treated as though it were not.** It came from a
single burst that ran while production was being redeployed, and it was used to estimate a
~25-writer ceiling — which in turn drove the capacity advice given to the founder.

**ADR-0038 decision 2 is explicit:** *"Sizing is decided from measurement, never from
estimate."* In the same session, a sibling recommendation to change `max` in
`src/db/index.ts` from 4 to 2 was **withdrawn** on exactly that rule, after the arithmetic
behind it turned out to describe a pooler mode production had already left. This ADR exists
because the same discipline was then applied *before* moving this number rather than after.

This ADR does **not** decide:

- W-3 (resolution) or W-4 (market lifecycle) budgets — see §Decision Outcome 3.
- Isolation level, lock order, or the retryable SQLSTATE set (ADR-0013, unamended).
- Whether to shorten time under the lock, or to queue writes per market — both remain open
  and are the next levers if the budget proves insufficient.
- The Supabase compute tier, still the binding constraint on connections.

## Decision Drivers

1. **A refusal on the money path is the worst possible moment to say no** — it lands exactly
   when a market is interesting enough that many people want to post at once.
2. **Sizing must come from measurement** (ADR-0038 decision 2), and this project had just
   demonstrated the cost of ignoring that.
3. **Correctness is not negotiable.** Whatever changes, `SERIALIZABLE`, the lock order and
   INV-1 do not.
4. **Latency is an acceptable currency; refusals are not.** A participant waiting 600 ms is
   served. A participant refused has to decide whether to try again.
5. **An unmeasured budget must not be widened just to look consistent** with its siblings.

## Considered Options

1. **Widen the W-1 budget to 6 attempts, from a measurement** ← chosen
2. **Leave it at 4 and accept the refusals** — defensible, and what the previous ADR implied,
   but the measurement shows the refusals are avoidable at a cost of a few hundred
   milliseconds in the worst case.
3. **Widen all three wrappers together** — tidier, and rejected: W-3/W-4 are admin-triggered
   single-writer paths that were not measured. This is option 2's mistake with the sign
   reversed.
4. **Shorten time under the lock instead** — raises the real ceiling rather than outlasting
   the queue, and is the better fix in the long run. Rejected *for now* as strictly more
   invasive on the critical path than a backoff change, and not yet justified by a
   measurement showing the budget is insufficient. Remains the next lever.
5. **Queue writes per market** — nobody is refused, everybody waits. A real architectural
   change; deferred until the measurement says 1 is not enough.

## Decision Outcome

**Chosen: Option 1.** `BACKOFF_BASES_MS` in `src/server/bets/transaction.ts` becomes
`[50, 100, 200, 400, 800]` — 1 initial attempt plus 5 retries, **6 attempts**.

### 1 · The measurement this is sized from

`tests/scale/write-ceiling-sweep.scale.test.ts` — a barrier-released storm of N concurrent
`place()` calls onto **one** pool row (the contended case; the pre-existing storm spreads
across eight markets, which is the benign one), against a real local Postgres 15:

| concurrent writers | refused @ 4 attempts | refused @ 6 attempts |
|---|---|---|
| 8 · 16 · 24 · 32 | 0 % | 0 % |
| 48 | **10.4 %** | **0 %** |
| 64 | **10.9 %** | **0 %** |

Two things follow, and the second is the one that mattered:

- **The prior ~25 estimate was wrong, and in the safe direction to be wrong about only by
  luck.** Nothing is refused below 32.
- ⛔ **The refusal was never the database failing.** Postgres served the queue throughout;
  writers were abandoning their place in it while their turn was still coming. So the
  refusal is a property of the *budget*, which is why widening it removes the refusals
  outright rather than trading them for errors elsewhere.

**The price is latency, and it is bounded:** the 64-way storm went from ~356 ms to **595 ms–1.0 s**
end to end across repeated runs. ⚠ The range is quoted rather than the best run — a single
favourable figure here would be the same species of error as the ~25 estimate this ADR
exists to correct. So: roughly a second in the worst observed case for the most extreme
storm, and nobody is told to try again.

### 2 · What this does not claim

⚠ **The measurement is local Postgres, not Supabase.** Production holds this lock across a
network round trip, so every attempt is longer, contention is worse, and the absolute
figures above will not reproduce. **What transfers is the shape** — a graceful ~10 %
refusal rather than a cliff, with the budget as the lever that moves it. The multi-machine
run against production is what would replace this table, and until it happens this ADR's
numbers describe a laptop.

### 3 · ⛔ The three wrappers no longer agree, on purpose

`resolution/transaction.ts` (W-3) and `markets/transaction.ts` (W-4) keep `[50, 100, 200]`.
SPEC.2 §9 described all three as one shared shape; that is now false and is amended in the
same commit.

The divergence is the ruling, not drift. W-3 and W-4 are **admin-triggered and
single-writer** — no crowd contends for them — and **neither was measured**. Widening them
to restore symmetry would be sizing from estimate, which is the precise failure driver 2
names and which this project has already paid for once.
`tests/unit/bets/retry-budget.test.ts` pins the divergence in both directions, so a future
reader who "restores consistency" reddens a test that explains why they should not.

### 4 · Why a ratified parameter could move at all

ADR-0013 calls these *"DECISION PARAMETERS, NOT tunables."* That framing is kept: this is
not a tunable, and nothing here invites future edits. It moved once, by a new ADR, on a
measurement — which is the documented way a ratified parameter is allowed to move, and is
the opposite of treating it as configuration.

## Consequences

**Good.** Refusals disappear up to at least 64 concurrent writers on one market locally. The
~5,000-participant target (≈ 50 concurrent posters on a hot market at a 1 % posting rate)
moves from borderline to inside the measured envelope. The failure mode that remains is
waiting, not rejection.

**Bad, and accepted.** A pathological storm now occupies a connection for longer before it
gives up — worst case roughly 1.55 s of backoff versus 350 ms — so under genuine overload
the pool drains slightly faster than before. Bounded, and the lesser of the two harms.

**Neutral.** Exhaustion still raises `BetSerializationExhaustedError` → 503 + `Retry-After: 1`
with the `bet_serialization_exhausted` Sentry message, unchanged.

## Verification

- `tests/server/bets/concurrency.test.ts` — the behavioural pin: a callback that always
  throws 40001 now runs **6** attempts and still ends in `BetSerializationExhaustedError`
  with one `captureMessage`.
- `tests/unit/bets/retry-budget.test.ts` — **new.** Pins W-1's bases, pins W-3/W-4 as
  *unchanged*, pins the bases as strictly increasing (full jitter draws from `[0, base)`, so
  a non-increasing base silently wastes an attempt), and pins W-1 as never less patient than
  its siblings.
- `tests/scale/write-ceiling-sweep.scale.test.ts` — **committed**, so the table in §1 is
  reproducible rather than quoted. Re-run it before this number moves again.

⚠ **Not verified against production.** See §2. The claim that this clears ~5,000 concurrent
participants is an extrapolation from a laptop, and should be read as such until the
multi-machine run lands (`O-13`).

## Links

- ADR-0013 — the W-1 retry spine; amended in the bases only.
- ADR-0038 decision 2 — sizing from measurement; the rule this ADR follows.
- SPEC.2 §9 — amended in this commit.

---

*ADR-0056 widens the W-1 full-jitter retry budget from four attempts to six, on a measured
collision sweep showing that refusals at 48–64 concurrent writers were the retry budget
expiring rather than the database failing. The decision body and any constraints minted in
§Decision Outcome are immutable; superseding requires a new ADR with a same-commit SPEC.2
update per the SPEC.2 §0 versioning policy.*
