# RECONCILE-1 — session log

**Task:** land the long-lived `staging` lane onto `main`, advance `staging` to
match, verify. One session, autonomous, no operator gates.
**Date:** 2026-08-31 · **PR:** #443 · **Branch:** `feat/reconcile-staging`
**Run report:** `~/Downloads/zz_RECONCILE-1_run_2026-08-31T0701.md` (operator-held;
carries the full ledger, the excluded register texts and the ambiguity register)

---

## What landed

| SHA | What |
|---|---|
| `e8b0455` | `fix(discovery)` — retarget the Discovery hero's env gate at the component the product mounts; delete the retired `PriceSparkline.tsx`. Files: `tests/unit/debate/render/chart-placeholder-gate.test.tsx`, `src/components/discovery/PriceSparkline.tsx` (deleted). |
| `af33a1e` | `chore(merge)` — merge `origin/main` (#439, #441) into the reconciliation. `docs/parked.md` unioned; `docs/polish/POLISH-0_data-manifest.md` resolved to `main`'s version unchanged (CARRIED-1). |

Base of the branch is `05ed7f3`, the unreviewed reconciliation merge authored by
another session, whose audit was this task's primary output.

**Gates:** `just verify` = All checks passed · full suite 4124 passed / 0 failed
(434 files) · CI run `33368893424` = `completed success` on head
`af33a1e5f54f8c8bd2e6b65883ee837f48ecfe72`, zero failed steps · preview READY with
`canary` == the pushed SHA and eight markets rendering.

---

## Decisions made

1. **The merge preserved both lanes.** `UNION = 4154`; the merge passes 4124;
   **31 absent, 0 red**, and all 31 dispositioned as rename, deliberate deletion,
   in-merge reversal, or supersession by component provenance. **Zero casualties**
   at file level once A3 is judged against the merge base.

2. **A3 as briefed has a false-positive mode, and it was corrected rather than
   obeyed.** "Every path on exactly one parent must exist on the merge" also fires
   on a file one lane *deliberately deleted*. Judge against the merge base.

3. **`git show --cc` is the wrong instrument for a merge ledger.** It is blind by
   construction to the resolution that takes one parent's file wholesale — which
   is exactly how a lane disappears without a conflict marker. Eight such files
   existed here and none appeared in the `--cc` ledger; they surfaced only from
   the test-inventory diff. **Build the ledger from the test inventory.**

4. **One genuine defect, and it was GREEN.** The merge kept `main`'s hero
   (`MarketPriceChart`) while restoring `PriceSparkline.tsx`, which `main` deleted
   at CHART-1 (#425). Zero `src/` importers; its only consumer was the env-gate
   test, whose three hero cases passed against a component shipping nowhere under
   a comment reading *"the only cover this mount has"*. Severity MEDIUM — the
   fabricated-data path was reachable only through the unmounted component, so
   nothing invented could reach production. Fixed and proven by revert-to-red in
   both directions.

5. **V-space is refused, not arbitrated (CARRIED-1).** RPLY-CLOSE and
   WARLI-CLOSE-2 both minted a `v1.10` and collided on `V-15`/`V-16`/`V-17`.
   Per RF-2 the merge takes **neither** side: `main`'s file restored byte-for-byte,
   staging's amendment excluded, both texts quoted in the run report. **No number
   was minted** — V-7 reserves that to the founder.

---

## Open questions

- **OWED-1 · the V-space collision needs a founder ruling.** Five founder-ruled
  items are absent from `main` after this merge (three V-rules, the V-12 patch,
  the V-15 reservation); all survive at `26dc484`. ⚠ The structural point is
  larger than the renumber: **both lanes obeyed V-9 and re-read the high-water
  pointer, at their own head, where the other lane was invisible. The register's
  defence against staleness is not a defence against concurrency.**
- **OWED-2 · the `criterion` handoff assertion** is deferred until a criterion
  trigger is re-attached. ⚠ The two surviving cases in
  `debate-view-freeze.test.ts` are **vacuous** until then — nothing calls
  `setCriterionOpen`, so the flag is a constant `false` and its term in `frozen`
  cannot change the predicate. Annotated in place so the cover is not counted.

- **OWED-3 · the criterion's on-page presence is a PRODUCT question this merge
  answered by accident.** ⛔ **This entry corrected a false claim I wrote here
  first**, and `@code-reviewer` caught it: I logged *"no product behaviour is
  lost — the criterion is dormant on all three trees."* **That conflated two
  different things.** The *dialog* is dormant on staging (the `Know more` trigger
  was removed at change set 4 §B) — true. The *criterion block* was **not**:
  on `26dc484`, `/m/[slug]` rendered a `Resolution` overline and the full
  `markets.description` in the DOM behind a one-line visual clamp, reachable by
  find-in-page, screen reader and the ADR-0025 export. Staging's own guard ends
  `expect(container?.innerHTML).toContain("Resolution criterion text.")`; `main`'s
  replacement asserts the opposite — `market-header::G-1-the-criterion-BODY-is-absent-from-the-DOM`.
  ⇒ **Real behaviour IS lost.** `main`'s RESO-3 (2026-08-28) is the later ruling
  and probably governs, but no one has said so on the record, and a merge is not
  the place that call should get made. `ResolutionCriterion.tsx` now has **zero
  importers in `src/` or `tests/`** — the `PriceSparkline` shape one component
  over, and worse, because it has no test either. **It was NOT deleted**: unlike
  `PriceSparkline`, no lane deliberately removed it, so deleting it would be this
  session settling a product question rather than restoring a lane's position.

- **OWED-4 · `HeadZone.tsx:87-106` and `main`'s components now contradict each
  other.** Staging's justification block names three alternatives it "RULED OUT";
  the merged tree does two of them — `MarketHeader.tsx:305` carries
  `overflow-y-auto`, `ResolverCards.tsx:152` carries `min-h-[84px]`. Staging's
  behaviour (no scrollbar inside a band already pinned under the sticky header)
  is lost and **nothing in either suite can see it** — jsdom performs no layout,
  and `main`'s own comment says the height-chain guard cannot reach it. Needs a
  founder ruling on which governs, then an O-5 in-place correction.

- **OWED-5 · `SPEC.1.md` has DUPLICATE version numbers.** Both lanes minted
  `1.0.40` and `1.0.41` independently from `1.0.39`: ONBOARD-CARD /
  ONBOARD-CARD-FIX (2026-08-25) and CHART-1 / CHART-1.A (2026-08-27). The union
  kept all four rows, so the version column is non-monotonic and **18 sites in
  `src/` and `tests/` cite "SPEC.1 1.0.40" for CHART-1** and land on the
  ONBOARD-CARD row instead. Bodies are intact — this is a numbering collision,
  not a content loss. **It is the same failure as OWED-1, in a second register**,
  and renumbering a landed row is the spec owner's call.
- **PR #421** is *not* the pure duplicate the brief expected: its code is in this
  reconciliation, but `docs/logs/PFP-UI-1.md` (82 lines) is not. Closing it would
  discard a session log.

## Next session starts at

Reading OWED-1 and ruling the V-space numbering. Nothing in the code lane is
blocked on it.

## Context to preserve

- **zsh eats `$ref:path`.** `git show $MB:tests/…` triggers the `:t` modifier and
  exits 128; `2>/dev/null` turns that into a silent wrong answer. Always
  `git show "${ref}:${path}"`. This produced one false finding in this run (O-13).
- The `feat/` prefix is load-bearing for a Vercel preview — measured live:
  `feat/reconcile-staging` built, `chore/merge-main-into-staging` CANCELED.
- A fresh worktree has no `.env.local`; `next build` needs the
  `tests/_setup/env.ts` placeholders supplied **inline to the build shell only** —
  exporting them displaces the suite's `??=` defaults.

## Time

Single session, 2026-08-31, ~07:00–08:00 UTC.
