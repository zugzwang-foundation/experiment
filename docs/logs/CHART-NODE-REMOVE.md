# CHART-NODE-REMOVE — session log

**Task:** CHART-NODE-REMOVE · the post nodes come off every surface
**Branch:** `feat/chart-node-remove` · **PR:** #457 (MERGED) · **Base:** `974ed10`
**Canonical SHA:** `4c041633fc98cf4705c2dbef54e980acf016e63d` — the squash-merge on `main`
**Merged:** 2026-09-01T20:02:58Z · **Mode:** autonomous run, founder-ruled scope

---

## ⚠ THIS LOG IS A RECONSTRUCTION, WRITTEN AFTER THE FACT

**It was not written from the session.** It was assembled at NIGHT-1 on 2026-09-02
from the merged PR body, the squash commit body on `main`, and `git show` on that
commit.

⚠ **This is the thinnest-sourced of the three, and the reason is specific: there is
no run report on disk for it.** `~/Downloads` holds run reports for CHART-4 through
CHART-8 and for WARLI-FIT; there is none for CHART-NODE-REMOVE, and no
`docs/plans/` entry either — its squash touches zero files under `docs/plans/`.

**What it does have, and this is worth correcting a common assumption about it:**
the rationale here is **read, not inferred**. The squash commit body is seven
paragraphs of reasoning, and the PR body carries a followed/stopped chain table
with an establishing grep for every link. Almost everything below is quoted or
directly derived from those two.

**What a contemporaneous log would have carried and this one cannot:**

- **The founder ruling's own wording and when it arrived.** The commit says
  "Founder ruling" and nothing else about it. Whether the scope was fixed before
  work began or narrowed during it is unrecoverable.
- **The reviewer cascade.** No reviewer findings are recorded anywhere reachable.
  Whether the cascade ran and found nothing, or did not run, **cannot be
  distinguished from the repository** — and those are very different facts.
- **The plan.** There is no `docs/plans/CHART-NODE-REMOVE.md`. Whether the work was
  planned and the plan not committed, or executed directly under a founder ruling
  as trivial-by-§5.1, is unrecoverable.
- **Working time and open questions at the moment of stopping.**

---

## What landed

14 files, **+187 / −1161**. The removal reaches four layers:

| layer | what went |
|---|---|
| render | the node block and the `nodes?: ChartNode[]` prop (`MarketPriceChart.tsx`, `MarketHeader.tsx`, `MarketPriceChartHost.tsx`, `MarketPriceChartOverlay.tsx`) |
| view model | `priceChart.nodes` — the field is off the model, which is now `{ series } \| null` |
| selection | `ChartNode`, `selectChartNodes`, and `reservesAt` (`price-chart.ts` −134, `load-debate-view.ts` −31) |
| tests | `chart-nodes.integration.test.ts` (−626) and `select-nodes.test.ts` (−231), replaced by one guard |

**Verified during this reconstruction at `origin/main`:**
`grep -rn "selectChartNodes" src tests` returns **2 hits, both docblock prose
recording the removal** — `price-chart.ts:17` and `MarketPriceChart.tsx:480`. Zero
call sites. Positive control: the same grep for `topOrder` returns 10 files, so the
pattern finds live code.

**Gates recorded in the PR body:** `pnpm tsc --noEmit` exit 0 · `biome check .` 870
files, no fixes · token census 8/8 · full suite **4363 passed / 1 skipped / 4 todo,
446 files, 191.87 s, 0 FAIL on the first run** · `pnpm build` exit 0, 26/26 static
pages.

## Decisions made

1. **The chain was followed past the render, and where it stops is stated rather
   than assumed.** A render-layer delete would have left `selectChartNodes` walking
   the whole ranked substrate and calling `getPrices` once per bucket on every
   market-detail read — *"dead compute wearing a fix's clothes, invisible because
   nothing renders it."* So the selector goes, and `reservesAt` with it, its only
   caller being that selector.

2. ⭐ **The round-trip pins did NOT move, and that is the honest headline.**
   `2 → 2` warm, `12 → 12` on a cache miss, with `round-trip-budget.test.ts`
   untouched by the branch — so the green is a measurement, not an accommodation.
   `deriveMarketPriceChart` took `postSubstrate` and `removedSet` as *already-loaded
   arguments*; dropping them stops a function asking, not a query running.
   **The saving is CPU inside an already-paid read, not a round trip** — and the
   commit says so explicitly, because *"a removal that claims a round trip it did
   not take is worse than one that claims nothing."*

3. **The chain stops at `postSubstrate` and `removedSet`, and they stay.** Both are
   still loaded a few lines earlier for the Top list, the badges and comment-body
   masking. The masking belt that filtered the substrate to posts present in the
   comments read goes with the argument — it existed so a post racing in after the
   comments snapshot could not be emitted as an unmasked node, and with no nodes
   there is nothing for it to protect.

4. **One guard replaces three deleted cases, keyed on the RIM rather than the
   testid.** The terminal marks are rimless by ruling (`C-CHART-2` clause 1), so
   *"no circle carries a `--color-ground` rim"* separates exactly the thing removed
   from the thing kept. **A ban on `graph-node-` would pass against a node re-added
   under any other name.** Its positive control runs first: the same query must
   still find the four terminal circles, so a zero is a real zero and not an empty
   selector.

5. **The guard was verified by reverting — twice, because the first reversion proved
   the wrong assertion.** Restoring a rimmed circle fired the *count* assertion and
   the rim assertion never spoke; re-rimming an existing dot fired the named guard
   itself. That second run is the one that establishes the guard.

6. **The INV-3 closed inventory shrank, and that was proved rather than assumed.**
   `MarketPriceChart.tsx` was on the list of files permitted to key a colour off a
   side value, purely because of the node's fill. Zero side-keyed colour
   expressions remain in the file, while the same pattern still fires on
   `badges.tsx`. **Predicate, floors and `offenders.toEqual([])` untouched.**

## Open questions

**Owed to the web lane, not authored here** — SPEC.1 §9 *Post nodes*, its §17
acceptance rows (`price-chart-nodes-top-per-utc-day-per-side`,
`-nodes-exclude-content-removed`, `-node-side-frozen`, `-collapsed-no-nodes`) and
canon `C-CHART-1` clause 2 **all still describe an element that no longer ships**.
This is prescriptive text and a run does not author it (doctrine §10).

⚠ **Whether the reviewer cascade ran is not recoverable.** See the reconstruction
notice above. If it did not, this is a `src/server/` diff that went to `main`
without `@code-reviewer` under CLAUDE.md §5.11.

## Next session starts at

**Amend SPEC.1 §9, its four §17 rows, and canon `C-CHART-1` clause 2** to stop
describing the post nodes. That is the whole of what is owed, it is web-lane work,
and it is the only thing standing between this removal and being complete.

## Context to preserve

- **`PostSubstrate` did NOT go away** and is very much alive — the Top list, the
  badges and the profile all read it. Only the chart's *node selector* went. A
  future reader seeing `selectChartNodes` in a docblock should not conclude the
  substrate was removed.
- **This commit is `origin/main` as at NIGHT-1**, and it is the commit that makes
  PR #394's conflict a modify/delete: #394 modifies `select-nodes.test.ts`, which
  this removed. That conflict is unresolved by design — see
  `zz_NIGHT-1_run_2026-09-01T2038.md` §4 for both sides.
- **The two surviving `selectChartNodes` strings are comments.** Any source-scan
  guard written as a bare-word search for that symbol will match its own removal
  notice and report a false positive — the documented shape in AGENTS.md §9.

## Time

Commit authored 2026-09-02T01:32:58+05:30; PR #457 merged 2026-09-01T20:02:58Z.
Working time is not recoverable from the repository.
