# POLISH.5 PR A — HALT RECORD

**All three halts are RESOLVED. PR A is complete: A1 … A8, items 2 · 3 · 4 · 5 · 6 · 15 · 17.**

Three halts, all **RUN-STOP condition 1** (*"Any write outside §5's allow-list becomes necessary"*), all the same shape: **a ratified fence the plan did not census.** Each was ruled rather than absorbed, and each ruling is carried verbatim in the commit that spends it.

| # | Raised at | File needed | Excluded by | Ruling | State |
|---|---|---|---|---|---|
| **H-1** | A1 | `tests/unit/debate/render/side-badge.test.tsx` | allow-list only (§6 blind) | **§5 row 19**, 2026-08-14 | ✅ shipped in A1 |
| **H-2** | A5 | `tests/unit/bookmarks/render/side-encoding.test.tsx` | §5 STRUCK; §6 blind | **§5 row 20**, 2026-08-14 | ✅ shipped in A5 |
| **H-3** | A5 | `tests/server/bookmarks/masking.test.ts` | §5 STRUCK **and** §6 DENY-LISTED | **§5 row 21**, 2026-08-14 | ✅ shipped in A5 |

⚠ **Rows 19 · 20 · 21 exist only in this record, in the commit messages that spend them, and in PR #331's body.** `docs/plans/**` is deny-listed at §6, so `docs/plans/POLISH-5.md`'s §5 table still ends at row 18. **The close-out must land all three**, or a reviewer reading the plan fresh after merge finds three rows cited by commits and defined nowhere — the register-collision shape CLAUDE.md §8 exists to end.

---

## The pattern, stated once

All three are one failure mode: **a plan that widens a shared DTO enumerated the files that CONSUME it and missed the files that CONSTRUCT or ASSERT it.**

- §8.2's zero-delta table measured `src/server/bookmarks/list.ts` and cleared it correctly — it imports the builders and receives the new fields for free.
- It could not see `side-encoding.test.tsx`, which **constructs** a `BookmarkItem` literal, or `masking.test.ts`, which **exhaustively asserts** its key set.

**Adopted for close-out** (⛔ not written here — `POLISH-SURFACE-TEMPLATE.md` + `parked.md` own it):

> *When a plan widens a shared DTO, its allow-list must include every file that **constructs, or exhaustively asserts the shape of**, that DTO — not only those that consume it.*

And the mechanical finder, as a **pre-flight step**, not a lesson:

```
grep -rn 'Object.keys(' tests/ | grep -E 'toEqual|toHaveLength'
```

18 shape assertions tree-wide; it located H-3 in one command after three rounds of prose had missed it.

---

## H-3 · the security review, recorded

`masking.test.ts:332` asserts the exhaustive sorted key set of the present-post `BookmarkItem`. A5 widens that union, so the whitelist moved.

**Arithmetic, measured at source and CORRECTED.** An earlier draft of this record said *"16 → 17"*. That was **wrong** — a misread of vitest's `…(N)` notation, which counts entries **after** the first, so `…(17)` is 18 and `…(15)` is 16. Counted directly:

| | count |
|---|---|
| BEFORE | **16** |
| ADDED | `authorStake`, `priceAtBet` — **2** |
| AFTER | **18** |
| delta == entries added | ✅ |

Both fields do reach the present-post variant. The review stands on the corrected number.

**Founder finding, 2026-08-14, verbatim:**

> "Reviewed 2026-08-14 under the guard's own terms. authorStake and priceAtBet are properties of the AUTHOR'S bet frozen at post time (pb.stake, pb.price_at_bet), not of the viewer's position — viewer-independent by construction, which is the property forced-visitor mode requires. Neither is Sell-eligibility; /bookmarks never mounts SellModule (F-BM-3). Ratified upstream at ADR-0032 D-4 and canon ruling 1, and REQUIRED downstream by PD-6-01. SC-1 intact: live variants only. The no-Sell-key loop is untouched and still enforcing."

`@code-reviewer` independently corroborated this four ways: the `JOIN LATERAL` keys the bet to the **comment**, so it is the comment author's own bet; `loadBookmarks`' post query carries no viewer predicate on that path; `price_at_bet` stores `pEff` of the **bought** side (`bets/place.ts:162` → `cpmm/calculate.ts:97`); and both figures already render publicly on shipped surfaces (`HeroPanels.tsx:169`/`:176`, `ArgProfile.tsx:67`) — so this is not a new exposure class.

---

## POLISH.6 STEP 0 — EXPECTED MOVE, NOT DRIFT

> **POLISH.6 STEP 0 — EXPECTED MOVE, NOT DRIFT:** POLISH.5 PR A added `authorStake` + `priceAtBet` to `side-encoding.test.tsx`'s `liveItem` factory (§5 row 20, ratified 2026-08-14). Ratified propagation of the A5 passthrough. Not a re-key finding.

> **POLISH.6 STEP 0 — EXPECTED MOVE, NOT DRIFT:** POLISH.5 PR A amended three census assertions in `tests/unit/debate/render/side-badge.test.tsx` (§5 row 19, ratified 2026-08-14). Ratified adoption of the `profile` preset. Not a re-key finding.

`side-encoding.test.tsx` is POLISH.6's allow-list **row 5** — a WRITE-set path, so this declaration is mandatory. `side-badge.test.tsx` is not on `.6`'s list but is declared on the same terms.

**Third file — MEASURED, not assumed.** `tests/server/bookmarks/masking.test.ts` is on **NEITHER** POLISH.6's write set (v1_3 §7's seven rows) **nor** its cite set; it appears nowhere in that plan. **No declaration is owed.** One is carried anyway, as a courtesy re-measure trigger:

> **POLISH.6 STEP 0 — EXPECTED MOVE, NOT DRIFT:** POLISH.5 PR A added `authorStake` + `priceAtBet` to the present-post key whitelist in `tests/server/bookmarks/masking.test.ts` (§5 row 21, ratified 2026-08-14). The §4.4 exposure boundary gains two author-figure fields and no Sell/owner field. Not a re-key finding.

⚠ **And one interaction handled rather than discovered:** POLISH.6 STEP 0.2 runs `grep -rniw "value" tests/server/bookmarks tests/unit/bookmarks` and pins the result at **2 hits**. The row-21 comment is deliberately worded **without** the whole word *"value"*. Re-measured after the edit: **still 2.**

⚠ **Version note:** the ruling cited POLISH.6 **v1.4** §7; the latest copy available here is **v1_3**. Its §7 does carry seven rows with `side-encoding.test.tsx` at row 5, matching the ruling, so the numbering is stable across that gap — but the measurement above is against v1_3 and should be re-confirmed if v1.4 moved the list.

---

## Open findings surfaced, NOT absorbed

From `@code-reviewer` on A5 (verdict: **zero CRITICAL, zero HIGH** — §11 condition 11 does not fire):

- **MEDIUM · `tests/server/profile/masking.test.ts:233-248` — the REMOVED-variant runtime belt was not widened.** It is a non-exhaustive `"key" in obj` whitelist naming `title`/`teaser`/`body`/`marker`(/`stake`/`repliedToTitle`); it does not name `authorStake` or `priceAtBet`. Consequence, precisely: **after A5, no test fails if a builder's removed branch emits `priceAtBet`.** The designated §11-condition-7 tripwire (`argument-list-side.test.tsx:121-135`) is a render test over a hand-written fixture — it proves the component does not render a price on a removed item; it cannot see the server builder producing one. ⛔ **Not fixed here:** `tests/server/**` is §6 deny-listed and closing it needs a fourth ruling. Same class as H-3, and the finder above would have caught it.
- **MEDIUM · `src/server/profile/arguments.ts:30-36` — *"a leak is a COMPILE error"* over-claims.** TypeScript's excess-property check fires only on a **fresh object literal** in the return position. The reviewer probed three leak forms: the direct literal (what both builders use) errors; an intermediate `const` and a spread **do not**. The guarantee is real for the code as shipped and **form-dependent** — a routine refactor to either other form voids it silently, and per the MEDIUM above nothing downstream would notice. ⛔ **Not fixed here:** pre-existing text, not required for A5's correctness, and editing it would be absorbing a finding.
- **LOW · `src/lib/ranking.ts:45`/`:62` still call `price_at_bet` "the market YES-probability"** — this is `OD-8`, which the plan routed to commit 0 and **commit 0 did not close** (`git log` shows the file last moved at #180). A5's new docblock now states the opposite of its own source type's docblock, and A5 is right. Correctly not fixed here (`src/lib/**` is §6 deny-listed); PR C's directed `@security-auditor` question is about exactly this docblock.

## Defects caught and fixed in-session

- **`pct-round-render.test.ts` went RED** at 4 markers vs `EXPECTED_ALLOW_MARKERS = 3` — because an explanatory comment **I** wrote in `ArgumentList.tsx` contained the literal string `pctround-allow:`. Per §11 condition 2 (*"a red guard is a finding about the change, never a file to fix"*) the comment was reworded; the guard was untouched.
- **A5's own new comments cited `:216`/`:217`/`:224`**, which the union addition above them had already displaced to `:226`/`:227`/`:234` — stale *inside the commit that wrote them*, which is `O-8` minted at this branch's own base. Re-cited by symbol.
- **A5's comment mis-attributed the canonical form** to those substrate lines, which are raw passthrough; 18-dp comes from the **column type** (`numeric(38,18)`). `O-3`: a true conclusion with a wrong stated cause is a defect.
