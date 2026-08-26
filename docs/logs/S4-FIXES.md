# S4-FIXES — session log

**Task:** S4-FIXES — land the S-4 F1–F8 invalidation fixes as a follow-up PR off current `main`.
**Branch:** `fix/s4-cache-invalidation` · **PR:** [#423](https://github.com/zugzwang-foundation/experiment/pull/423) (open, not merged)
**Base:** `origin/main` @ `5463f61aa34cd059ef8c441019cb83251be352b9`
**Ground:** `Ritam` @ `94d1897e0a236140ef765084181859a9f9a1562e` — the pre-squash lineage, preserved untouched.

---

## What landed

**PR #423**, one commit `bf831be`, 21 paths, 477 insertions / 53 deletions. Signed (`G`), author and committer `Zugzwang/world <zugzwangworld@proton.me>`, no `Co-authored-by`.

| | Fix | Files |
|---|---|---|
| **F1** | `revalidateTag(tag, "max")` → `updateTag(tag)` on the content-removal path — the CRITICAL | `src/server/admin/moderation/act.ts` |
| **F2** | `revalidateTag("discovery", "max")` → `revalidateTag("discovery", { expire: 0 })` | `src/server/markets/open.ts` |
| **F3** | Same; forced here — `closeDueMarkets` is called from a Route Handler, where `updateTag` throws | `src/server/markets/close.ts` |
| **F4** | New `revalidateTag("discovery", { expire: 0 })` after `voidMarket`; `Open → Voided` never passes through `closeMarket`'s bust | `src/server/admin/markets/void.ts` |
| **F5** | `/m/[slug]` overrides `pricing`/`unitToWin` with the live read that keyed the cache; `getMarketPricingAndReserves` returns `unitToWin` from the same pool read | `src/app/(public)/m/[slug]/page.tsx`, `src/server/debate-view/market-pricing.ts` |
| **F6** | `READ_URL_TTL_SECONDS` 3600 → 7200 — a presigned TTL equal to `cacheLife("minutes").expire` ships already-expired image URLs, silently | `src/server/discovery/media.ts`, `hero.ts`, `src/server/debate-view/load-debate-view.ts` |
| **F7** | ADR-0041 minted, same commit as the code it governs; **+ `## Open questions` / OQ-1** | `docs/adr/0041-cache-components-and-reserves-keyed-participant-caching.md` |
| **F8** | SPEC.2 §4.3 same-commit rider, 1.0.25 → **1.0.26** | `docs/specs/SPEC.2.md` |

Plus the R2/R3 wording corrections at five sites and the rewritten `cached-view-contract.test.ts`.

**Gates on the new base:** `tsc` 0 · `biome` 0 · `next build` 0 · `pnpm vitest run` **0 failed** (`388 passed | 1 skipped (389)` files, `3560 passed | 1 skipped | 4 todo (3565)` tests) · ADR ceiling `0041` free · handler probe as expected.

---

## Decisions made

### 1 · The INFO-1 divergence — one file is RECONSTRUCTED, not copied

**This is the finding of the session and the reason a Step-2 halt existed at all.**

Step 2 diffed all 19 fix-set paths between `94d1897` and `origin/main`. Seventeen were identical, one (the untracked ADR) absent from both, and **one differed**: `tests/unit/discovery/render/page-states.test.tsx`.

**Cause, established rather than assumed: the squash was faithful; the branch was stale.** `main`'s history runs `c49338d` (PFP-Migration #415) → `b0b5919` (INFO-1 #416) → `5463f61` (Ritam-s4 #405). `Ritam` last merged `main` at `c49338d`, so it **never carried INFO-1**. GitHub squash-merged #405 against a base that did, and the three-way merge correctly produced a `5463f61` carrying both deltas. Corroborating: `tests/unit/_support/dom-html.ts` — which exports the `normalizeRadixIds` INFO-1 added — exists on `origin/main` and existed nowhere in the `Ritam` worktree.

**Why a blind copy would have been silent, not loud.** The two deltas sit in non-overlapping hunks: S-4's at `@@ -167` / `@@ -293` (two `unitToWin` mock fields), INFO-1's at `@@ -6` (the import) and `@@ -395` (the byte-identity assertion). Copying the older working-tree copy over `main`'s version would have compiled, very likely passed, reverted INFO-1's fix, and orphaned `dom-html.ts` — **with nothing in a diff review to catch it**, because a reverted file reads as a restored one.

**Decision (founder R1):** start from `origin/main`'s version and apply only this task's own delta on top. `git apply` landed both hunks cleanly at offset +2 — the offset INFO-1's two-line import block introduces. Verified after: the file's diff vs `origin/main` contains **only** the two `unitToWin` hunks, which is itself the proof that INFO-1's import and assertion survived; `normalizeRadixIds` at `:9`/`:409`/`:410`, `unitToWin` at `:175`/`:302`, and `render::anon-and-logged-in-body-identical` passes.

**The durable lesson:** a stale branch plus a faithful squash produces a base that is *ahead of your working copy in files you were about to overwrite*. Carrying files across branches is only safe where the two bases agree — check, per path, before copying.

### 2 · The stash deviation — the ruled checkout would have aborted

The ruling specified `git checkout -b fix/s4-cache-invalidation origin/main`. From the dirty tree that **aborts**: `page-states.test.tsx` was both locally modified and different between `94d1897` and `origin/main`, and git refuses to overwrite local changes, failing the whole checkout atomically.

**Taken instead:** `git stash push -u -m "S4-FIXES: fix set preserved before branch cut"` → `stash@{0}`, creating a **second** copy of the fix set beside the `~/Desktop/s4-fixes-backup` copy made in Step 1, then cutting the branch from a clean tree. Nothing was dropped; `stash@{1}` (the pre-existing EXTAUDIT-06 entry) is untouched.

**`Ritam` stays as ruled** — ref still `94d1897`, not deleted, not reset, not rebased. Its *working tree* is now clean, which is unavoidable: the working tree is shared across the repo and cannot sit on two branches at once. The fix set therefore exists in three places — the Desktop backup, `stash@{0}`, and the pushed branch. Step 1's preservation pass, which felt redundant when ruled, is what made this safe to do at all.

### 3 · The upstream foot-gun — `checkout -b … origin/main` tracks `main`

`git checkout -b fix/s4-cache-invalidation origin/main` **auto-set the new branch's upstream to `origin/main`**. A bare `git push` from that branch targets `main` directly.

Ran `git branch --unset-upstream` immediately, before any other command.

**Recording it because there is no backstop.** CLAUDE.md §5.13's measurement stands: `main` is unprotected, no ruleset, no required check — a direct push to `main` would succeed. `lefthook`'s `no-force-push-protected` guards only *non-fast-forward* pushes; this would have been a clean fast-forward and would have sailed through. The only thing between that command and an unreviewed push to `main` was noticing the tracking line in the checkout output. **Any future `checkout -b <new> origin/main` in this repo should be followed by `--unset-upstream` or an explicit `push -u origin <branch>`.**

### 4 · Wording corrected at five sites, not four (O-5)

`"provably unchanged"` → `"provably equal to a previously observed value"`. The brief named four sites; a repo-wide grep found a fifth live code site, `src/app/(public)/page.tsx:81`, ruled in as R2. `src/server/discovery/list.ts` was a 20th path not in the fix set, ruled in as R3. Historical logs keep the old wording (R4) — **0 files modified under `docs/logs/`** by that pass. Residual sweep over `src/`, `docs/adr/`, `docs/specs/`: zero occurrences.

### 5 · The count delta was established, not waved through

Baseline `386 (387)` files / `3546 (3551)` tests predated INFO-1. Measured `388 (389)` / `3560 (3565)`. The +2 files / +14 tests are fully attributable to INFO-1: `glossary.test.ts` (4) + `info-tip.test.tsx` (9) + one test added to `dharma-cluster.test.tsx` = 14; its third new file `_support/dom-html.ts` is a helper with no `.test.` in the name, so 3 added files yield +2 *collected* files. Skips (1) and todos (4) unchanged.

---

## Open questions

- 🔶 **OQ-1 / ABA — the one that matters.** ADR-0041 D-2 claimed the reserves-key proves the pool **has not moved**; it proves only that the live reserves are **equal to a previously observed value**. The CPMM is fee-less, so a buy and a sell-back of the same shares restore the exact prior 18-dp pair and the key matches an entry generated before those bets. Priced fields survive (pure functions of the key); **comments, ranking and totals do not** — every bet rides a comment (INV-1). Bounded to one `cacheLife` lifetime, requires an exact same-market round trip, and content removal still busts `market:<id>` independently, so it is a **freshness hole, not a masking hole**. Two candidate fixes recorded in the ADR, neither chosen: a **monotonic key discriminator**, or **busting `market:<id>` on every bet and sell** (touches `src/server/bets/`, §1 critical path, full ritual). **Ruled a separate task; not attempted here.**
- **Known-not-done, carried forward:** budget tests **2 of 5** · Suspense hoist · redirect regression.
- **No §5.11 reviewer cascade run.** Not on the §1 critical-path list, and ADR-0041 records these fixes as already having passed `@code-reviewer` + `@security-auditor` at Gate C. Surfaced rather than added unasked.

---

## Next session starts at

**Read the CI verdict for PR #423's current head by run id matched to `headRefOid`** (`gh run view <id> --json status,conclusion,jobs` — not `gh pr checks`), then hold for the founder's merge ruling. **Do not merge.** The PR body carries the gate, per §5.13.2.

After merge, the next actionable item is **OQ-1 / ABA**, which needs a ruling between the two candidate fixes before any code is written.

---

## Context to preserve

- **`Ritam` @ `94d1897` is the only copy of the pre-squash lineage.** Do not delete, reset or rebase it.
- **Three copies of the fix set exist:** `~/Desktop/s4-fixes-backup` (19 files + `FILES.txt` + `MD5.txt`), `stash@{0}`, and this branch. The first two are safe to retire once #423 merges.
- **`origin/main` @ `5463f61` still carries the CRITICAL** (`act.ts:137`, `revalidateTag(..., "max")`) until #423 merges.
- **The probe is reproducible and worth keeping in mind:** driving `next/dist/server/lib/cache-handlers/default.js` directly, three forms, one tag each (the tags manifest is a module-global `Map`), with a **≥10 ms gap** between `set` and invalidation. The gap is load-bearing — `areTagsExpired` requires `expiredAt > timestamp`, so a same-millisecond invalidation returns a **false HIT** and a probe written without it certifies the defect as fixed. The pre-read positive control is equally load-bearing: an entry never stored also "misses".
- **`"max"` → `{expire: 31536000}`** is not folklore: `revalidation-utils.js` builds `durations = { expire: cacheLife.expire }`; `config-shared.js:179-183` sets `max.expire = 60*60*24*365`.
- **CI cancels in flight.** `ci.yml:33-35` — `concurrency: ${{ github.workflow }}-${{ github.ref }}` with `cancel-in-progress: true`. Pushing to an open PR **cancels its running check**, and a cancelled run is **NOT ESTABLISHED** (O-13), never a pass. Let a run finish before pushing again if its verdict is needed.

---

## Time

2026-08-26 ~23:25 → 2026-08-27 ~00:35 UTC+05:30. One session, no `/clear` mid-task.
