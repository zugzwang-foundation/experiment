# POLISH.5 PR A — HALT RECORD

Three halts, all **RUN-STOP condition 1** (*"Any write outside §5's allow-list becomes necessary"*), all the same shape: **a ratified fence the plan did not census.** Two are RESOLVED; the third is LIVE.

| # | Raised at | Blocks | File needed | Excluded by | State |
|---|---|---|---|---|---|
| **H-1** | A1 | item 2 | `tests/unit/debate/render/side-badge.test.tsx` | allow-list only (§6 blind) | ✅ **RESOLVED** — §5 row 19, ruled 2026-08-14. Shipped in A1 (`697347d`) |
| **H-2** | A5 | items 3 · 4 | `tests/unit/bookmarks/render/side-encoding.test.tsx` | §5 STRUCK; §6 blind | ✅ **RESOLVED** — §5 row 20, ruled 2026-08-14. Built, not yet committed (blocked behind H-3) |
| **H-3** | A5 | items 3 · 4 | `tests/server/bookmarks/masking.test.ts` | §5 STRUCK **and** §6 DENY-LISTED | ⛔ **LIVE** |

**Branch:** `polish/5-pr-a`. **Landed: A1 · A2 · A3 · A4** (items 2 · 5 · 6 · 15). **Built and green except H-3: A5 · A6 · A7 · A8.**

---

## ⚠ POLISH.6 STEP 0 — EXPECTED MOVE, NOT DRIFT

> **POLISH.6 STEP 0 — EXPECTED MOVE, NOT DRIFT:** POLISH.5 PR A added `authorStake` + `priceAtBet` to `side-encoding.test.tsx`'s `liveItem` factory (§5 row 20, ratified 2026-08-14). Ratified propagation of the A5 passthrough. Not a re-key finding.

> **POLISH.6 STEP 0 — EXPECTED MOVE, NOT DRIFT:** POLISH.5 PR A amended three census assertions in `tests/unit/debate/render/side-badge.test.tsx` (§5 row 19, ratified 2026-08-14). Ratified adoption of the `profile` preset. Not a re-key finding.

`side-encoding.test.tsx` is **POLISH.6's allow-list row 5**, so this moves a `.6` WRITE-set path and would be a RUN-STOP at `.6`'s re-key unless pre-declared. `side-badge.test.tsx` is not on `.6`'s list but is the second file this PR touches outside `src/components/profile/`, so it is declared on the same terms. ⚠ **A third path now joins them if H-3 is ruled: `tests/server/bookmarks/masking.test.ts`** — a `.6`-adjacent DB-backed suite. Its declaration is drafted in the ruling section below.

---

## H-1 · RESOLVED — the `profile` preset census

`side-badge.test.tsx` pinned by set-equality that **no call site wires `profile`**. It fired **by design** — *"If a later PR wires one, this reddens and the wiring becomes a DECISION — the same mechanism as `PERMITTED_FILES`."* §5 row 19 split the assertion so **`detail` keeps its zero** for POLISH.3 (R1), moved the names with their assertions (R2), carried the ground in-file (R3). Shipped in A1.

## H-2 · RESOLVED — the passthrough's TYPE reaches a struck file

`BookmarkItem` is `Extract<ProfileArgumentItem, …> & {…}` (`bookmarks/list.ts:43-53`), and `.6`'s test **constructs** a full literal, so A5's two new required fields reach it. §5 row 20 fenced the fix to the `liveItem` factory's two fields — no assertion, not `removedItem` (SC-1 intact), nothing else. **Built; commits with A5 once H-3 clears.**

---

## ⛔ H-3 · LIVE — the passthrough widens a guarded EXPOSURE BOUNDARY

### The condition

`tests/server/bookmarks/masking.test.ts:332` asserts the **exhaustive sorted key set** of the present-post `BookmarkItem`:

```ts
// The EXACT present-post BookmarkItem key set — a whitelist. No Sell mount,
// no owner delta, ever.
expect(Object.keys(item).sort()).toEqual([ …16 keys… ]);
```

A5 adds `authorStake` + `priceAtBet` to the union ⇒ **17 keys vs 16** ⇒ `AssertionError: expected [ 'aggregate', …(17) ] to deeply equal [ 'aggregate', …(15) ]`.

**The file is excluded twice over** — §5's struck table (*"`tests/server/profile/**` · `tests/server/bookmarks/**` | DB-backed. ⚠ **Measured NOT to redden** (§2.14)"*) **and** §6's deny-list by directory (`⛔ tests/server/**`). It is the strongest fence in the plan, and the only halt so far where §6 was not blind.

### ⚠ This one is not bookkeeping — it guards an exposure boundary

H-1 unpinned a design property; H-2 was a fixture literal. **H-3 is a security-shaped whitelist.** Its own words: *"Forced-visitor: EVERY bookmarked item is someone else's content (D-3 others-only), so the DTO carries NO Sell-eligibility field EVER … its keys are EXACTLY the §4.4 union whitelist."* The `§4.4 union IS the exposure boundary`, and the assertion exists so that **any** widening of it is reviewed rather than absorbed.

**The widening is almost certainly intended** — canon `:51` already rules that a bookmarked row shows *"that bookmarked author's figures on their argument"*, `staked`/`current` are already exposed on exactly that ground, and §17 item 7 states `.6` inherits `authorStake`/`priceAtBet` deliberately. ⇒ Two more of the same author's figures is consistent.

⛔ **But that is the reviewer's call, not the executor's, and this is precisely the guard built to force it.** No `Sell`/owner key is added; the belt-and-braces loop (`sell`, `sellable`, `canSell`, `sellEligible`, `sellMount`, `owner`, `isOwner`, `ownedByViewer`, `viewerHolds`) still passes untouched.

### The exact fix

Two entries into the sorted whitelist, in place:

```
"aggregate", "authorPseudonym", "authorStake",   ← ADD
"body", "createdAt", "current", "id", "kind", "marker",
"marketSlug", "marketTitle", "ordinal", "priceAtBet",   ← ADD
"removed", "side", "staked", "teaser", "title",
```

⛔ Nothing else in the file. The belt-and-braces loop and the compile-time `Extract` guard below it are untouched.

### ⚠ THE DRAFTED PLANNING RULE WOULD NOT HAVE CAUGHT THIS ONE

The close-out rule as worded — *"when a plan widens a shared DTO, its allow-list must include every file that **CONSTRUCTS** that DTO"* — catches H-2 (`side-encoding.test.tsx` constructs a literal) and **misses H-3**: `masking.test.ts` never constructs a `BookmarkItem`; it **receives** one from `loadBookmarks` and asserts its shape. Suggested widening, for the close-out author:

> *…must include every file that **constructs, or exhaustively asserts the shape of**, that DTO.*

⚠ **And a mechanical way to find them, since prose will keep missing cases:** `grep -rn 'Object.keys(' tests/ | grep -E 'toEqual|toHaveLength'` returns **18 shape assertions** tree-wide. Run it against the widened type's consumers at plan time; it is what found H-3 in one command after the fact.

### Declaration to carry if H-3 is ruled

> **POLISH.6 STEP 0 — EXPECTED MOVE, NOT DRIFT:** POLISH.5 PR A added `authorStake` + `priceAtBet` to the present-post key whitelist in `tests/server/bookmarks/masking.test.ts` (§5 row 21, ratified 2026-08-14). Ratified propagation of the A5 passthrough; the §4.4 exposure boundary gains two author-figure fields and no Sell/owner field. Not a re-key finding.

---

## State of the built-but-unlanded work

A5 · A6 · A7 · A8 are **complete and green except H-3**, saved at `~/Downloads/POLISH-5-PRA-A5-A8.patch` (388 lines). Full suite at that tree: **325 files passed / 1 skipped / 1 failed**, **2907 passed / 1 failed** — the single failure being H-3. `pnpm tsc --noEmit` **0 errors**. All **seven** `tests/unit/design/` guards **green**.

**Gate C read intact by construction:** `arguments.ts` is **pure addition — 18 lines, ZERO deletions**. No query line at `:145`/`:181`/`:258`/`:267` moved; no removed-variant block touched.

**A8's V-2 proof was run in all three states**, not asserted: RED with no link (owner arm: *"expected null not to be null"*) → GREEN with the `owner` gate → RED again with the gate removed (visitor arm: *"expected `<a aria-label="Bookmarks">` to be null"*). **Both arms have teeth.**

### ✅ One defect caught and fixed in-session

`pct-round-render.test.ts` — one of the seven design guards — went RED at 4 markers vs `EXPECTED_ALLOW_MARKERS = 3`. Cause: **an explanatory comment I wrote in `ArgumentList.tsx` contained the literal string `pctround-allow:`**, which the guard counts as a marker. Per §11 condition 2 (*"a red guard is a finding about the change, never a file to fix"*) the comment was reworded; the guard was not touched. All seven now pass.
