# POLISH.3 · PR 2 — session log

**Sessions:** 2026-08-15 (unattended, halted at C2) + 2026-08-16 (unattended, resumed C3→C12) + 2026-08-16 (**ATTENDED — C13 + Gate C riders**)
**Branch:** `polish/3-pr2-cards` (pushed; **no PR, no merge**) · **Branch point:** `origin/main` = `ea1795e`
**Plan:** `docs/plans/POLISH-3-PR-2.md` v1.4

> ⛔ **This log does NOT restate `docs/logs/POLISH-3-PR-2-HALT.md`.** That record carries the halt, the evidence, `R-3`, the reviewer's findings and the resumed run's outcome (its §0 and §12). Duplicating it here would create two artifacts that can drift — the defect this surface keeps minting rules against (`O-5`).

---

## What landed (files + PR#)

**No PR opened.** ✅ **`C0…C13` COMPLETE — every row in the plan is landed.**

| SHA | Commit |
|---|---|
| `4d9ba0f` | **C0** — the ratified plan, verbatim (committed blob md5 = the source's) |
| `13fcf48` | **C1** — eight greenfield guards, **all eight RED on first run** |
| `53f503f` | **C2** — T3 split bar + the `R-3` census entry, **amended** so both halves land in one diff |
| `188b71f` | the halt record |
| `873360c` | post-halt remediation — `@code-reviewer` HIGH-1 + MEDIUM-3 |
| `4f1dddc` | **C3** — T1 `RESOLUTION` overline + hairline container |
| `c2c5e2d` | **C4** — T2, the `--imgmax` bound moves to the height axis |
| `8dd84c4` | **C5** — pop-up geometry 720px/90vh + the image height bound (rows 14, 9) |
| `da2d5a2` | **C6** — pop-up omissions, stake, `SideBadge` + census re-key 8→9 (rows 10-12) |
| `df1629d` | **C7** — the side-aware reply expansion (row 13) |
| `d187dc2` | **C8** — the two disabled card controls removed (rows 1, 2) |
| `f9094e6` | **C9** — `Read more` + the CD-A token port (row 3) |
| `e6ba033` | **C10** — spaced `Đ` sites 2-3; sites 4-5 **VERIFIED**, not edited (rows 4, 5) |
| `2998ff0` | **C11** — the `Download` trigger removed + the `O-5` prose sweep (row 7) |
| `a133c47` | **C12** — the expanded chart's accessible summary + `R-3` on `pct-round-render` (row 8) |
| `bc8532e` | post-review remediation — `@code-reviewer` MEDIUM-1 + two `O-3` comments |
| `9f86076` | **C13** — `RR-3`, the split bar's poles name the SIDE (row 15) · **ATTENDED** |
| `5c389f0` | Gate C riders — `GC-14`, the plan's own `O-5`, the remount record |
| `a34dd43` | post-review — the mockup claim was FALSE, plus the `O-5` and `O-8` sweeps |
| `375dc2e` | C13's track gets the edge — `@security-auditor` MEDIUM |
| `a072721` | log — C13's two reviewer passes |
| *(this commit)* | **post-reboot resume** — the second reviewer pass's citation FAILs, the true tip receipt, and the `events`-residue defect |

## Decisions made

1. **Halted at C2 rather than absorbing a design-guard red** — confirmed correct by `@code-reviewer` and by the founder (`R-3`).
2. **C2 was AMENDED, not followed by a census commit**, so `R-3` condition (3) is satisfied by the diff itself.
3. **`R-3` condition (1) is checked, never assumed.** At C12 the guard was run with the new code and the OLD count; the failure landed on the census assertion with the offender predicate passing on the line above. Had offenders been non-empty, C12 would have been a second halt.
4. **Reused `computeSplitBar` / `displaySplitTotal`** (read-only import from the deny-listed `composer/**`) rather than writing a second split-bar implementation.
5. **Fixed HIGH-1 and MEDIUM-3 in-session** (§5.10 FAIL → fix before continuing; same-commit doctrine).
6. ~~**Did NOT amend the committed plan** for `GC-12`'s five-row correction~~ — **REVERSED at `5c389f0`, and the reversal is the decision worth keeping.** The ground for deferring (the file must stay byte-identical to ratified v1.4 because C0's body stamps its md5) confused a **receipt** with a **lock**: C0's stamp records what landed *at C0*, that blob is fixed in history, and a later amending commit is ordinary history, not a falsified receipt. Deferring bought nothing and shipped `O-5`'s harm onto `main` — §12's schedule is the table an executor grades partial greens against, and it would have said FOUR, grading row 9's green at C5 as UNSCHEDULED, which is a HALT condition. Both sites (§7 `:310`, §12 `:564`) now read FIVE.
7. **`role="group"` → labelled `<ul>/<li>`** at C7 after Biome's `useSemanticElements` rejected it. The rule was right; disabling it would have been an AGENTS.md §11 ask-first.
8. **Discarded C11's first suite run** — another session's runner was live. Waited ~705 s, re-measured clean, committed on that.

## ⚠ A FLAKE SIGHTING, RECORDED SO THE SECOND ONE IS RECOGNISABLE

**The C13 full-suite run came back RED on a test this PR cannot touch**, and it
is written down rather than discarded because `docs/parked.md:1203-1207` rules
exactly this case: *"the honest reading is 'flake again', and that is exactly how
a real INV-class defect gets waved through. The failure mode is not a red test;
it is a future red test that nobody believes"* — and *"two sightings retire the
flake reading."* **This is SIGHTING ONE.**

```
FAIL tests/server/bets/atomicity.test.ts
     > bet-place::every-persisted-comment-has-a-bet-referencing-it   (:363)
     AssertionError: expected 500 to be 200
```

⚠ It is an **INV-1 critical-path test**, which is why it was diagnosed rather
than re-run and forgotten. The evidence that it is contention, not regression:

1. **The PR touches ZERO `src/server/`, `src/db/` or `drizzle/` files** —
   measured on the branch diff, not assumed.
2. **It passes 3/3 in isolation**, including that exact test.
3. **10.9 s under full-suite load vs 4.3 s isolated** — heavy DB contention.
4. The route has a **documented honest-500 path** for an exhausted or
   unretryable DB error (`api/bets/place/route.ts:193`, `bets/endpoint.ts:361`),
   so a serialization failure surfacing as a 500 is designed behaviour.
5. The class is already on record: `AUDIT-FIX-A22.md:65` names "the B5-noted
   local-PG flake class", and `AUDIT-FIX-B5.md:47` records local Postgres
   saturation producing random failures.
6. **The immediately following full run was FULLY GREEN** (below).

⇒ **If `bet-place::every-persisted-comment-has-a-bet-referencing-it` is seen red
a second time, the flake reading is retired and it is a defect.** That is the
whole reason this paragraph exists.

## The local gate — full `pnpm vitest run` (§14)

⛔ **THIS SECTION'S ORIGINAL RECEIPT WAS STALE BY TWO COMMITS, AND THE HEADING SAID "FINAL".** `git log -S"FULL2_EXIT=0"` places it at **`a34dd43`** — after which **`375dc2e` changed `ReplySplitBar.tsx` (+21) AND both guard files** (`reply-split-bar` +17, `aggregate-footer` +14). A green measured before the last code commit is not a receipt for the tip; the heading claiming finality is what made it read as one. Retained below as history, superseded by the two runs beneath it.

```
(a34dd43, superseded)  Test Files  336 passed | 1 skipped (337)
                            Tests  2983 passed | 1 skipped | 4 todo (2988)
                       FULL2_EXIT=0
```

### The tip's own two runs (post-reboot, `a072721`)

```
run 1   Test Files  1 failed | 335 passed | 1 skipped (337)
             Tests  1 failed | 2984 passed | 1 skipped | 4 todo (2990)
        FULL_EXIT=1        ← tests/server/bets/events-idempotency.test.ts:259

run 2   Test Files  336 passed | 1 skipped (337)
             Tests  2985 passed | 1 skipped | 4 todo (2990)
        FULL2_EXIT=0
```

⛔ **RUN 2's GREEN IS NOT THE RECEIPT, AND RECORDING IT AS ONE WOULD BE THE RE-ROLL THIS LOG ALREADY RULED AGAINST.** Same tip, same file set, opposite results — because **vitest's file order is non-deterministic between runs** (measured: runs 1 and 2 executed in completely different orders). The red is a real defect with a randomly-scheduled trigger, not a correct test failing randomly. Diagnosis below.

### The full ledger — SEVEN whole-suite runs, and the runtime column is the tell

| # | When | Result | Duration | Note |
|---|---|---|---|---|
| 1 | pre-`R-4·events` | ⛔ RED ×1 | 174 s | `events-idempotency` — the real defect |
| 2 | pre-`R-4·events` | ✅ green | 232 s | lucky ordering; proves nothing |
| 3 | post-fix | ✅ green | **355 s** | ⚠ adjacency NOT exercised |
| 4 | post-fix | ⛔ RED ×1 | **504 s** | `profile/tiles` — environmental |
| 5 | post-fix | ⛔ RED ×2 | **727 s** | `debate-export` + `page-wiring` — environmental |
| 6 | **post-`VACUUM FULL`** | ✅ green | **409 s** | ⚠ adjacency NOT exercised |
| 7 | **post-`VACUUM FULL`** | ✅ green | **529 s** | ⚠ adjacency NOT exercised |

✅ **THE BAR IS MET: runs 6 and 7 are two CONSECUTIVE green whole-suite runs on the remediated environment** — `336 passed | 1 skipped (337)`, `2985 passed`, exits read from the log.

⚠ **BUT THE REMEDIATION IS PARTIAL, AND RUN 7 SAYS SO: 409 s → 529 s.** The bloat is already re-accumulating, because `VACUUM FULL` cannot reclaim what the replication slot pins and the slot is still active. ⇒ **Expect these reds to return.** The durable fix is to stop `supabase_realtime_experiment`, advance or drop the slot, then `VACUUM FULL` again — **not done, founder's call, shared local infra.**

⛔ **THE DURATION COLUMN IS THE DIAGNOSIS.** 355 → 504 → 727 on an unchanged tip is not test flakiness, it is an environment degrading under the suite's own catalog churn; and 727 → **409** immediately after `VACUUM FULL` is the same finding read backwards. **A pass/fail column alone would have hidden it** — three runs of "sometimes red" reads as flake, while the runtimes read as a cause.

⚠ **NO RUN OF THE SEVEN HAPPENED TO SCHEDULE `csam-seam` IMMEDIATELY BEFORE `events-idempotency`.** Every green above is therefore silent on `R-4·events`. The deliberate two-invocation control is the ONLY evidence for that fix, exactly as the ruling anticipated — recorded here so a later reader does not mistake seven runs for seven confirmations.

⚠ **Environment, recorded because it is invisible afterwards:** the reboot took Docker down with it. The stack was restarted and **verified migrated before any gate ran** — 25 rows in `drizzle.__drizzle_migrations` (= `0000`–`0024`), `uuidv7()` present, 38 base tables. Without that check the suite would have produced a whole-DB false RED.

⚠ `FULL_EXIT` is read from the log, not from the shell's reported status: the run was `pnpm vitest run > log; echo FULL_EXIT=$? >> log`, and the harness reports the **trailing `echo`'s** exit, which is always 0. Gate commands never let another command own the exit (§14).

## The two reviewer passes on C13 (attended)

**`@code-reviewer`** — CRITICAL none · HIGH none on the code, but **HIGH-2 caught a false citation that would have licensed a revert**: C13 claimed "the mockup was never wrong". Re-measured independently and it is wrong — `d5:1247`/`:1249` are the Support/Counter BUTTONS, the bar at `:1248` carries NO side class, `.barrow .bar`/`.bar .fill` are a fixed `--n0`/`--ink` (`:510-512`), `.bar .fill.right` (`:513`) is never applied, `:1591-1592` set only the buttons' classNames, and the annotated post is `side:'no'` with `sPct:69`. ⇒ **d5's bar is itself a Route-3 instance**; C13 is a DELIBERATE DIVERGENCE, not a return. Corrected at `a34dd43`. ⚠ The plan's §7 V-2 (`:395`) carries the same overreach in its closing sentence and is **surfaced, not overridden**.

Also fixed there: **O-5 was not closed** (three in-fence sites still called the inversion live — GC-14's genus recurring one commit later), and **O-8's fourth canonical instance** — C13's own +21-line comment moved `TriggerPill`'s pole const and then cited the old coordinates, *invalidating its own citation by being inserted*. All in-fence coordinates re-fenced by symbol.

**`@security-auditor`** (C13 only, scoped to the `composer/**` exception) — CRITICAL none · HIGH none. **The fence held behaviourally, verified by hash**: `TriggerPill` byte-identical to `origin/main`, the whole delta two `className` attributes, no prop/branch/data-path/write/import. **The pole encoding was verified against the SERVER's partition** (`ranking-substrate.ts:75-86` — support = same side, counter = opposite), not merely the UI convention. **INV-3's striking confirmed sound** — the write-time derivation is server-side and storage-enforced, unreachable from a className.

Its **MEDIUM was a real miss of mine**: C13's corrected track had **no edge**, so on a NO post it sat at ~1.10:1 against its own card and vanished — trading an inversion for an erasure on the very post side the row fixes. My C13 body had dismissed the earlier `MEDIUM-3` as *"different bar, different commit"* — a **file** boundary where it was a **defect class**. Fixed at `375dc2e`, and **pinned in both guards**, which were positive-only and would have stayed green if either hairline were deleted.

## ⛔ THE `events`-RESIDUE DEFECT — pre-existing on `main`, surfaced not absorbed

**`tests/server/bets/events-idempotency.test.ts:259` — `AssertionError: expected 5 to be 3`.** Proven end to end rather than inferred:

1. That assertion counts the **whole `events` table, unfiltered** — `.from(events)` with no `.where()` (`:257-258`) — and the file truncates in `afterEach`, **not** `beforeEach`. It is therefore only correct if `events` is empty when the file starts, i.e. it depends on whichever file ran before it.
2. `tests/server/moderation/csam-seam.test.ts` ran immediately before it in run 1 (`fileParallelism: false`, so log order *is* execution order). Its 2 tests each call `recordGateBlock`, which writes a `moderation.blocked` row (`src/server/moderation/consequences.ts:164`, AUDIT-FIX-B5). Its `afterEach` truncates `["mod_actions","markets","users"]` — **`events` is missing** (`csam-seam.test.ts:50`).
3. **Measured:** `csam-seam` alone against an empty table leaves **exactly 2 rows**, both `moderation.blocked`/`mod_action`.
4. **Reproduced in isolation:** with those 2 rows present, the file fails alone with the identical `expected 5 to be 3`. 3 + 2 = 5. **Deterministic once the pairing occurs.**
5. **Control:** with `events` empty, the same file passes 2/2. And in run 2 the preceding file was `sell-oversell.test.ts` (which *does* truncate `events`) — green.

**Blast radius is one file, and the convention proves the intent.** Of the **10** test files that call `recordGateBlock`, **exactly one omits `"events"`** from its truncate list: `csam-seam.test.ts`. The other nine include it. And of the three unfiltered `.from(events)` reads in the repo, the other two (`viewer-context.integration`, `market-quote.integration`) are **before/after deltas** and are structurally immune. One leaking outlier meeting the one absolute whole-table count.

**PR 2 cannot have caused it.** `git diff --stat origin/main..HEAD -- src/server/ src/db/ drizzle/ tests/server/ tests/integration/ tests/invariants/ tests/db/` is **EMPTY**; both implicated files and `consequences.ts` are byte-identical to `origin/main`.

⛔ **NOT FIXED — the one-line fix (`"events"` into `csam-seam.test.ts:50`) is OUT of §8's allow-list, where an unlisted edit is a RUN-STOP.** Filed to `claude-progress.md` and raised for a founder ruling. Option (b), scoping `events-idempotency.test.ts:258` with a `.where()`, removes the whole-table dependency rather than just this instance — but is a larger edit to a critical-path test.

⚠ **This also bears on the FLAKE SIGHTING recorded above.** That one was `atomicity.test.ts` with a 500-vs-200 signature, so it is not the same test and I am not claiming it is the same cause. But "a preceding file left state behind" is now a *demonstrated* mechanism in this suite, and it is a cheaper explanation than contention. The standing rule stands: a second `bet-place::every-persisted-comment-has-a-bet-referencing-it` red retires the flake reading.

## `R-4·events` — RULED (option a), FIXED, and the control that proves it

Founder ruling: add `"events"` to `csam-seam.test.ts`'s `afterEach` truncate list. **One string**, placed directly after `"mod_actions"` — the ordering all nine sibling `recordGateBlock` suites use. §8's allow-list gains `tests/server/moderation/csam-seam.test.ts` **for this addition only**, the same shape as `R-3`.

**Scope condition held.** The diff touches the truncate list only — grepped for `expect|toBe|toEqual|toHaveBeen|it(|describe(`, no hits.

**Positive control — the exact failing sequence, forced deterministically:**

| Step | Before | After |
|---|---|---|
| `events` at start | 0 | 0 |
| `vitest run csam-seam` → rows left | **2** | **0** ✅ |
| `vitest run events-idempotency` immediately after, no truncation between | **`expected 5 to be 3`** | **2/2, exit 0** ✅ |

⛔ **AND THE TEST WAS NOT WEAKENED, WHICH IS THE CHECKABLE PART:** `git diff origin/main..HEAD -- tests/server/bets/events-idempotency.test.ts` is **EMPTY**. It is byte-identical to `main` — still an unfiltered whole-table count, still `toBe(3)`. Nothing was made to pass by changing what it measures.

⚠ **A paired single-invocation run is NOT a control and is not cited as one.** `vitest run csam-seam events-idempotency` scheduled `events-idempotency` FIRST, so it never exercised the adjacency. It passed and proves nothing.

## ⚠ THE `tiles` RED — UNREPRODUCED, and graded that way on purpose

Full run 4 came back RED on `tests/server/profile/tiles.test.ts > derivations`:

```
PostgresError 23503 — insert or update on table "dharma_ledger" violates foreign key
constraint "dharma_ledger_user_id_users_id_fk"
detail: Key (user_id)=(01a0061a-…) is not present in table "users".
```

A `users` row committed by `seedUser` (`:160`) was **absent** by the ledger insert (`:168`). With `testClient { max: 1 }` there is no second connection to blame, so something removed it.

**What I measured, and what I could NOT establish:**

- ✅ `tiles.test.ts` passes **3/3 in isolation**.
- ✅ The exact run-4 adjacency (`tests/unit/comments/foreclosure.test.ts` → `tiles.test.ts`) **passes 2/2 when forced** — so the obvious hypothesis is **NOT confirmed**.
- ✅ `foreclosure.test.ts`'s teardown is `TRUNCATE positions, markets, users CASCADE`, and `truncateTables` is always CASCADE in one implicit transaction — a late-landing teardown *would* explain it. **Plausible, unproven.**
- ✅ `tiles.test.ts` has **no `beforeEach` truncate** — only `afterEach` (`:147`). It is uniquely exposed to any late-landing teardown, and that is a real fragility whether or not it caused this.
- ✅ PR 2 touches **zero** files under `src/server/profile/`, `tests/server/profile/` or `tests/unit/comments/`.

### ⇒ ROOT CAUSE FOUND, and it is the ENVIRONMENT — `pg_class` bloat pinned by a replication slot

Two further full runs made the pattern legible. **Runtimes climbed monotonically on an unchanged tip: 355 s → 504 s → 727 s.** Run 5 failed **two** files, both at fixture-seed time, both `23503` on a `users` FK — `integration/debate-export` (`seedNode`) and `discovery/page-wiring` (`seedCommentWithBet`). Three runs, three different files, one signature.

**Measured on the live database:**

```
pg_class     943 live / 564,181 dead / 317 MB      ← for 943 rows
pg_trigger   320 live / 194,925 dead /  68 MB
```

**The harness generates the churn.** `truncateTables` issues **13 × `ALTER TABLE … DISABLE TRIGGER` + `TRUNCATE … CASCADE` + 13 × `ENABLE TRIGGER` per call**, every `afterEach`, thousands of times — each rewriting `pg_class`/`pg_trigger` rows.

**Autovacuum cannot reclaim any of it.** A logical replication slot — `cainophile_xtgm8wby`, `pgoutput`, Supabase **Realtime's** — holds `catalog_xmin` **32,372 transactions behind**. While it does, catalog dead tuples are unreclaimable: 93 autovacuum runs, zero progress. Bloated catalogs slow every FK check and plan, which **widens the window on a latent cross-file teardown race** — which is exactly why the FK reds land in whichever file happens to be adjacent and move around between runs.

**Remediation taken:** `VACUUM (FULL, ANALYZE)` on `pg_class` / `pg_trigger` / `pg_attribute` / `pg_depend` / `pg_type` — 317 MB → **145 MB**, 68 MB → **35 MB**. ⚠ It cannot finish while the slot pins `catalog_xmin`, and the slot is `active`, so `pg_replication_slot_advance()` errors. **Fully clearing it needs `supabase_realtime_experiment` stopped first — NOT done: that is shared local infrastructure other worktrees use, and it is the founder's call.**

⛔ **NONE OF THE THREE REDS IS A BRANCH DEFECT.** PR 2 touches zero files under `src/server/`, `src/db/`, `drizzle/`, `tests/server/profile/`, `tests/integration/` or `tests/unit/comments/`. ⚠ And the *earlier* framing of this as an unreproducible flake was itself the trap: it survived six targeted attempts because **the trigger was never in the test files at all**. `AUDIT-FIX-A22:65`'s "local-PG flake class" now has a measured mechanism instead of a shrug.

⛔ **`R-4·events` IS UNAFFECTED AND STILL STANDS.** That one reproduced deterministically against a *clean* database — seed the 2 rows, get `expected 5 to be 3`; empty the table, get 2/2. It is a genuine omission fixed at source, and it must not be relabelled environmental now that an environmental cause exists for the others. **Two different failures, two different standards of proof, kept apart deliberately.**

⚠ **It is a DIFFERENT test from the `atomicity.test.ts` sighting**, so it does not trigger that rule's "second red retires the flake reading" — that rule stays scoped to its own test and stays live.

**Docketed:** `tests/unit/comments/foreclosure.test.ts` is a **DB-touching test living under `tests/unit/`**, which AGENTS.md §9 defines as *"Unit (no IO)"*. Only two files in `tests/unit/` do this. Independent of this red, it is a convention violation in the directory a developer assumes is safe to run without a database.

## The THIRD reviewer pass — post-reboot, on `375dc2e` (which the first pass never saw)

The two passes recorded above ran on content **before `375dc2e`**, which is itself the remediation of the `@security-auditor` MEDIUM. Both were re-run on the tip.

**`@security-auditor`** — CRITICAL none · HIGH none · MEDIUM none. `H-COMPOSER` does **not** fire, proven mechanically: with comments stripped and whitespace normalised, the entire non-comment delta vs `origin/main` is **two `className` attributes**. `TriggerPill` byte-identical by sha256. INV-3 unreachable — the reply's side is written at `src/server/bets/place.ts:145` from a zod-validated wire field inside the W-1 tx, and **Support/Counter is never stored**, so no client value can desync it. SC-1 clean **by construction**: `ReplyAggregate` is four scalars and the removed variant of `DebatePost` carries no body field at all.

**`@code-reviewer`** — CRITICAL none, and the pole encoding, the fence and the hairline all verified correct. **HIGH-1: both rule citations backing the divergence note were wrong**, and I re-measured them myself before acting:
- `design-language.md:268` is a **changelog entry**. The normative locked binding is **§1 "Binding resolved"** (`:62`); `:269` merely *records* the axis correction.
- The poles sentence is **`AGENTS.md` §8** (`:222`), not `CLAUDE.md` §8 — which is O-space (`CLAUDE.md:237`).

⇒ Graded HIGH by the note's own standard: it exists to stop a later fidelity pass reverting the fix off `d5:1248`, and a note whose two pointers do not resolve leaves the reader with `d5:1248` alone. **Fixed in-fence at both code sites** (`ReplySplitBar.tsx`, `reply-split-bar.test.tsx`), cited by SYMBOL per `O-8`, with the wrong pair named so it is not restored. The plan's copy (§9 A4, `:489`) is **surfaced, not overridden**.

**MEDIUM-1, also fixed:** the comment cited `d5:511` for `border:1px solid var(--ink)`; it is on **`:510`** — and the sibling `AggregateFooter.tsx:95`, written in this same PR, already cited `:510` correctly. Two comments in one PR disagreeing on one coordinate.

## Open questions

- **LOW-5 (`@code-reviewer`)** — does **T3** owe `d5`-exact typography, or consistency with the shipped `ReplySplitBar` it currently mirrors? Three divergences named in the halt record §10.
- **C5's one unruled parameter** — the pop-up image's `max-h-[60vh]`. The plan rules that a height bound must exist; it names no value. Chosen so the image renders whole inside the 90vh dialog without pushing the body out of view.
- ~~**`O-5` on the committed plan**~~ — **CLOSED at `5c389f0`.** Both sites now read FIVE.
- **`ProfileGraphOverlay`** has no accessible summary either (same root cause as `PD-3-04`) — recorded at C12, out of fence, POLISH.5's.
- ⛔ **THE `events`-RESIDUE DEFECT — needs a founder ruling, the fix is out of fence.** See the section below. Unruled, this PR's CI is a coin-flip on vitest's file order.
- **The plan's §9 A4 (`:489`) still carries the wrong citation pair** (`design-language.md:268` / `CLAUDE.md §8`) corrected in the code this session. Surfaced, not overridden — the plan is the contract.
- **The plan's §6 row 15 (`:278`) and §10's named exception (`:504`) still fence `ReplySplitBar.tsx:64,67`.** The spans are now `:120` / `:123-126`. `H-REKEY` makes a drifted anchor update-and-continue, not a halt — but this is `O-8` firing on the plan's own fence, in a row whose §8 entry literally reads *"Symbol-fenced to `:64,67`"*, which claims symbol-fencing while naming lines.

## Next session starts at

**The founder's Gate C read on the completed PR.** Every row is landed and `just verify` is exit 0.

⛔ **ONE RULING IS OWED BEFORE THE PR OPENS: the `events`-residue defect above.** It is pre-existing on `main` and out of §8's fence, so it was not fixed. Unruled, this PR's CI is a coin-flip on vitest's non-deterministic file order — and a green run is not evidence it is closed.

⚠ **"The branch is green" is no longer a statement this log will make without qualification.** The tip measured RED then GREEN on two consecutive whole-suite runs with nothing changed between them.

⚠ **`R-4` NAMES TWO DIFFERENT THINGS IN THIS TASK, AND THAT IS THE `GC-n` GENUS ONE PREFIX OVER (`CLAUDE.md` §8).** Gate C read 1's rider `R-4` is the **canon sweep**; Gate C read 2's ruling `R-4` is the **`events`-residue fix**. Both are cited in this log and in two different commit bodies. **Disambiguated here as `R-4·canon` and `R-4·events`** pending web's numbering — surfaced, not unilaterally renumbered, because a register that renumbers itself locally is how the collision started.

Docket rows **drafted and handed to web, deliberately uncommitted** (`docs/design/**` and the docket are off §8):
1. **The canon SWEEP** (`R-4·canon` / `GC-15`) — not two coordinates. ⚠ **Measured this session: 48 `download` hits across `docs/design/**`, and they are NOT one class.** `design-canon.md` `:49`/`:67`/`:110`/`:125`/`:173` and the values-log `:194` are the removed bookmark/download cluster; the **`DESIGN_W2_13` set (mockup + CLOSE-OUT) is the share-card download, a LIVE feature**, as is `design-handoff.md:143`'s Wave-2 row. ⛔ **A blanket sweep would delete a real one.** The row carries this distinction, not just the coordinates: grep every surface form, then disposition each hit by which feature it names.
2. **`MEDIUM-2`'s real cause** — `BookmarkToggle` seeds `useState` at mount, so ANY remount loses optimistic state. Owner: ADR-0032 / UI-A6's lane.
3. **`LOW-5`'s three T3 typography divergences** — consistency won now, fidelity docketed.
4. **`R-4·events` option (b), the durable half** — scope `events-idempotency.test.ts:258` with a `.where()` on the fixture's own aggregate ids, removing the whole-table dependency itself rather than the one instance of it. Deliberately **not** taken under the ruling: it is a larger edit to a critical-path INVARIANT test. **Owner: the next task touching `tests/server/bets/`.**

## Context to preserve

- **Worktree:** `/Users/hrishikesh/code/zugzwang/wt-p3-c13` ⚠ **(this log said `wt-p3-pr2b` until the post-reboot resume — the unpushed commits were never in that tree).** No `.env.local`; `ZUGZWANG_ENV=preview` **plus the full `tests/_setup/env.ts` placeholder set** is required or `next build` fails — and the first failure is **`DATABASE_URL is not set`**, not the `"unknown"` env message, which is the one this line used to name. ⛔ Never read or copy a real `.env*`.
- ⚠ **After a reboot, Docker is DOWN and so is local Postgres.** `next build` does not need it, but every DB-backed suite does, and a bare run yields a whole-suite false RED. Start Docker Desktop (the Supabase stack auto-restarts), then **verify migrated before gating**: `select count(*) from drizzle.__drizzle_migrations` = 25 at `0024`.
- **The §20 step-7 pair set is FIVE, not three** — `(C2,C8) · (C2,C9) · (C8,C9) · (C5,C6) · (C2,C10)`. The before-C8 checkpoint was **load-bearing**: the plan's row-1 fence had drifted to span two different buttons.
- **A sixth writer relationship** the plan's own rule covers: the remediation commit also writes `AggregateFooter.tsx` and `dharma-spacing.test.tsx`, so the before-C10 re-key accounts for two earlier writers.
- ~~**`GC-12` is applied in code but not in the plan**~~ — **applied in BOTH since `5c389f0`.** `post-popup.test.tsx` covers rows 9, 10, 11, 12, 14.
- **`R-3` widened exactly two design guards** — `side-pole-binding.test.ts` (index 0) and `pct-round-render.test.ts` (3 → **5**, not 4). Any *other* design-guard reddening is still a HALT.
- ⛔ **THE FLAKE RULE SURVIVES THIS PR, AND IT IS CARRIED HERE SO IT DOES.** `tests/server/bets/atomicity.test.ts > bet-place::every-persisted-comment-has-a-bet-referencing-it` is **SIGHTING ONE** (§ above). **A second red retires the flake reading and it is a defect.** ⚠ Sharpened by `R-4·events`: "a preceding file left state behind" is now a **demonstrated** mechanism in this suite, not a hypothesis — and it is cheaper than contention. Check the *previous file's* truncate list before reaching for a timing explanation.
- **`R-4·events` closed the one leak; it did not close the CLASS.** `events-idempotency.test.ts:258` still counts the whole table unfiltered, so the next file that writes `events` without truncating them re-opens exactly this failure. Docket row 4 is the structural fix.
- Diff deliverables: `~/Downloads/POLISH-3-PR-2-DIFF.md` (halted run), `-DIFF-2.md` (C1…C12), `-DIFF-3.md` (this tip).
- **The census is unmoved by the three open out-of-track PRs.** `#338` (`htmlfinish/bookmarks-parity`) and `#337` (`htmlfinish/profile-parity`) touch **zero** §8 allow-list paths, and both measure **13 `<SideBadge>` / 8 unsized** — identical to `origin/main`. This branch's 14 / 9 is C6's re-key and nothing else. ⚠ But `#338` **edits `docs/design/design-canon.md`**, which is exactly `R-4`'s canon-sweep target (`:67`, `:110`) — if it lands first, the drafted docket row's coordinates drift and must be re-measured, not carried.
- **`R-4`'s sweep is far wider than the drafted row's three coordinates: 48 hits for `download` across `docs/design/**`.** They are not one class — `design-canon.md` `:49/:67/:110/:125/:173` and the values-log `:194` are the removed cluster icon, while the `DESIGN_W2_13` close-out and its mockup are the *share-card download*, a different live feature. Every hit needs dispositioning; a blanket sweep would delete a real one.

## Time

Two unattended sessions, 2026-08-15 and 2026-08-16. **No wall-clock projection is offered** (§14.2) — the suite has measured 320 s → 3054 s → 185 s on this machine and a projection from the trend was made once and withdrawn. One measured datum only: the wait for another session's runner to clear was ~705 s.
