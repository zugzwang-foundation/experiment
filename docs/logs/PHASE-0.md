# PHASE-0 — LOTS-1 pre-merge fixes + single-squash to main

**Session:** 2026-08-21, 22:30 → close (IST). Autonomous; all decisions
pre-ratified at kickoff (R-A single-squash · R-B the 0026 DELETE reject ·
R-C new commits, no rebase · R-D dump the markets first).
**Base:** `lots-1/log` = `8fed482`, `origin/main` = `c69f6dc`.
**Worktree:** `/Users/hrishikesh/code/zugzwang/wt-phase0` — a separate one,
because the primary tree was on the composer lane and two `claude` processes
shared it.
**Full run artifact:** `~/Downloads/zz_PHASE-0_2026-08-21T2230.md` (O-11).

> **This log is not in the kickoff's step list.** It is written because §5.9 is a
> standing rule that the kickoff did not override and the NOT-DOING list does not
> name — *"a session that ends without a log makes the next one start blind."*
> Recorded here as an addition rather than presented as ratified scope.

---

## What landed

Six commits on `lots-1/log`, then one squash to `main` via **PR #380**.

| Commit | What |
|---|---|
| `bf90aa7` | `docs/data/staging-markets-snapshot.{json,md}` — the eight markets, read-only from staging |
| `49db0d9` | migration `0026_lots_no_delete` + `0025` comment corrections + the parity-test fix |
| `741ad75` | the four `src/server` defects: clamp · wire maps · the side predicate · the false backstop comment |
| `aa487ce` | `docs/plans/LOTS-1.md` + SPEC.2 1.0.24 + ADR-0039 corrections + registry counts + the R4 deferral note |
| `62b3cf8` | `ci.yml` — run on every pull request |
| *(this)* | this log |

**Gate:** `just verify` exit 0 · `pnpm vitest run` **379 files / 3508 tests, 0
red, exit 0** · `drizzle-kit check` green. The delta from LOTS-1's 378/3493 is
**+1 file / +15 tests**, and every one of the 15 is individually attributable.

---

## Decisions made

1. **`lots` stays Bucket C, and `EXPECTED_GUARD_CATALOG_ROWS` stays 78.** The R9
   permanence guard is named `lots_no_delete`, **not** `bucket_%`. The reset's
   G-4 catalogue selects `tgname LIKE 'bucket_%'`, so a bucket-prefixed name
   would have enrolled it in the §6 append-only contract and asserted a bucket
   family covering one table — while `lots` rows legitimately change on every
   sell. Verified against the live catalogue (78, unchanged), not assumed.
2. **Row-level `BEFORE DELETE` only, never `BEFORE TRUNCATE`.** Postgres fires no
   row-level trigger on TRUNCATE, so `TRUNCATE bets CASCADE` still empties `lots`
   and the staging-reset path is untouched. Asserted through the REAL
   `truncateTables()` helper, because the claim is about the path the operator
   takes, not one resembling it. Postgres printed its own corroboration during
   the run: `NOTICE: truncate cascades to table "lots"`.
3. **The `§19.3` dataset posture is UNDECIDED, deliberately.** ADR-0039 declines
   the call in terms — *"a SPEC.1 G3 question, not this ADR's"*. `lots` is
   counted in neither the shipped 16 nor the withheld 5, so an unanswered
   question cannot become a settled NO by arithmetic. Appendix B gets a note and
   **no per-column section**: writing one would be indistinguishable from having
   decided.
4. **`allocateProRata` keeps its throw; `planLotSale` clamps.** The pure core's
   guard is a caller-bug assertion and clamping there would erase the signal for
   every caller. The rule is that the persistence layer stops handing it an
   impossible target — not that the target stops being impossible.
5. **Neither lot error mints a new wire code.** `LotOversellError` → the existing
   400 `insufficient_shares`; `LotInputError` → the existing 400
   `error_invalid_request_body`. F-BET-3's reachable set is a spec surface this
   slice already widened once (404 `lot_not_found`), and reusing codes that
   already mean these things keeps the owed rider to the one genuinely new change.
6. **The plan file says it was written afterwards.** A retrospective plan that
   reads as though it predicted everything manufactures a foresight nobody had.

---

## Surprises caught + fixed in-session

1. **The guard-parity test passed for the wrong reason.** Adding 0026's trigger
   should have turned `tests/unit/staging/guard-list-parity.test.ts` RED. It
   stayed green — because `parseDroppedTables` reads migration text *including
   comments*, and 0025 documents its reversal as `-- DROP TABLE IF EXISTS "lots";`.
   So `lots` was in `DROPPED` and every `lots` trigger was silently filtered out
   of `LIVE_TRIGGERS`. **Any** protected table whose migration documents its own
   DOWN would have made itself invisible to the check whose whole job is noticing
   a new protected relation. Fixed: whole-line comment stripping, a
   `bucket_%`-scoped catalogue derivation matching the query it mirrors, an
   explicit pin of the non-catalogue set, and two controls proving the fix does
   work rather than merely passing.
2. **`src/server/` "26 dirs" in AGENTS.md was stale by THREE, not one.** Measured
   **29**. The kickoff's stale-count list did not include this line. The
   enumeration was missing `github/`, `onboarding/` and `lots/`, so the number
   and the list now agree — the only state in which either is worth reading.
3. **The kickoff's staging-reserve premise was stale.** It said all eight pools
   sat at `10000` per the S6 record; **four have since moved under real bets**.
   Both figures are recorded in the snapshot — the seeded one as the restore
   target, the current one as what the market is today — because writing only the
   current would turn a restore into a silent rollback of somebody's position.
4. **The false `I-LOT-SUM-001` backstop claim was in TWO places**, not one:
   `lots/persist.ts` (which the kickoff named) *and* ADR-0039's invariant-impact
   table (which it did not). Corrected in the same commit — O-5.

---

## Open questions

**Q1 · The kickoff quotes ADR-0039 text that is not in the repo.** It cites the
R9 justification as *"strictly stronger than comparing against the previous value
(which storage cannot see)"*. That exact string appears nowhere in `docs/`,
`src/`, `tests/` or `drizzle/`. The **defect is real** and present in different
words (D-1's *"the append-only guarantee it needs is directional monotonicity
(R9), which is a CHECK, not a trigger"*), so it was corrected at the site where
it actually lives — but the quotation mismatch is flagged rather than silently
reconciled, in case the quoted version exists in a draft outside the repo.

> ⛔ **ANSWERED AND FALSIFIED at MERGE-1 — annotated, not rewritten.** The string
> is in the repo, at `src/db/schema/lots.ts:140–142`, and the kickoff quoted it
> accurately. The search that said otherwise was line-scoped, and the sentence
> wraps: `strictly stronger than` ends one comment line, `comparing against the
> previous value` begins the next, so no line-oriented `grep` can match it.
> `rg -U`, or a bare `rg -n "strictly stronger"`, finds it at once.
>
> The consequence is the one O-5 exists to name: the amendment went to ADR-0039
> and the site that actually states the superseded position was left standing —
> **and so was a second copy of it**, at `src/db/schema/lots.ts:30–31`, in the
> very words this Q1 quotes as living "somewhere else". Both are corrected at
> MERGE-1. Two further copies sit in committed migrations (`0025:15–16`,
> `0026:3–4`) where the append-only rule forbids editing; those are reported for
> a ruling rather than touched.
>
> Kept verbatim above because a log records what a session believed at the time.
> The correction attaches to it; it does not replace it.

**Q2 · The UPDATE-monotonicity trigger is docketed, not built** (ratified, R-B).
The CHECKs bound RANGE, not DIRECTION: an UPDATE raising `surviving_shares` 5 → 20
against an original of 20 satisfies every constraint on the table. R9's
monotonicity is application-enforced until that trigger exists.

**Q3 · A live-environment Σ check is owed.** `I-LOT-SUM-001` proves the rule
against seeded rows in a local ephemeral Postgres and observes no live
environment. Drift in staging or production is currently **undetected**. It
belongs with the staging gates, beside conservation and durable-receipt integrity.

**Q4 · The reply-lane ordering ruler (R4's second half) is still deferred** —
founder-owned, blocked on the two S9 questions in `docs/plans/LOTS-1.md` §8. The
consequence is now recorded beside the sort in `src/lib/ranking.ts`: a sold-out
reply keeps its top slot on a stake it no longer holds.

**Q5 · SPEC.1 riders remain owed** and were deliberately not authored: §23's Đa
paragraph, and §7's F-BET-3 shape (newly added to ADR-0039's owed list).

---

## Next session starts at

**The staging rebuild** — now survivable, because
`docs/data/staging-markets-snapshot.{json,md}` exists. Note that
`pnpm staging:reset` truncates `markets`, so the snapshot is the restore source
for the eight questions.

Nothing in PHASE-0 pushed to `staging` and nothing ran a reset (F2/F3).

---

## Context to preserve

- **Comment-only edits to an applied migration are safe, and this was
  re-verified rather than assumed.** `drizzle-orm@0.45.2` gates on
  `Number(lastDbMigration.created_at) < migration.folderMillis`
  (`pg-core/dialect.cjs:64`); the hash is INSERTed and never compared.
  `check-migration-drift.ts` compares journal head + entry count only.
- **`drizzle-kit generate --custom --name=<x>`** is the right way to add a
  hand-written migration: it chains the journal entry and the `meta/` snapshot
  properly instead of leaving them to be hand-edited.
- **CI had never run on this lane at all.** The trigger was
  `branches: [main]` and every slice PR targeted `feat/lots-1`. That is now
  fixed, but it means #380's run was the **first** CI any LOTS-1 code ever saw.
- **`on: pull_request:` default activity types are `opened, synchronize,
  reopened`** — a base-branch change fires `edited`, which is NOT among them. So
  retargeting a PR does not by itself trigger a run; the retarget must be
  followed by a push.
- **Downstream consequence of this merge:** branch protection is
  `strict: true`, so the open composer PRs (#383/#384/#385) are now behind `main`
  and each needs `main` merged in before it can land. Expected, not a defect —
  and untouched here per F4.
