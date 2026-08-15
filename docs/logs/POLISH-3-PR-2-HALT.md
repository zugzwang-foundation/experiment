# POLISH.3 · PR 2 — HALT RECORD

**Run:** overnight, unattended, 2026-08-15 · **Branch:** `polish/3-pr2-cards`
**Branch point:** `origin/main` = `ea1795e` · **Plan:** `docs/plans/POLISH-3-PR-2.md` v1.4 (md5 `e9e8e08b6491c3eae861d8d800d2f331`, 867 lines, 22 sections)
**Halted at:** **C2** · commit `008e3bb` · **C3–C12 DID NOT RUN** · **C13 was never in scope** (attended-only)

---

## 1 · The condition

> **`+ any tests/unit/design/** guard reddening.`**
> ⛔ *A red guard is a FINDING ABOUT THE CHANGE, never a file to fix.* — run kickoff, §4 halt set

**`tests/unit/design/side-pole-binding.test.ts` reddened at C2.**

It is the halt-set clause, not `H-HEX` (`no-raw-hex-view-layer` stayed green) and not `H-FENCE` (no off-allow-list file was edited). The nearest graded halt is **`H-FENCE`'s ground**: clearing this requires writing a file that is **not on §8's allow-list**, and §8 states that for PR 2's card work *"the allow-list IS the whole belt."*

---

## 2 · The evidence

```
pnpm vitest run tests/unit/debate/render/ tests/unit/design/     → exit 1
tests/unit/design/side-pole-binding.test.ts   (4 tests | 1 failed)
```

**The one failing assertion — `tests/unit/design/side-pole-binding.test.ts:382`:**

```
FAIL  side-pole-binding::closed-inventory-of-side-keyed-colour-sites
AssertionError: expected [ …(8) ] to deeply equal [ …(7) ]

+   "src/components/debate/AggregateFooter.tsx"
    "src/components/debate/badges.tsx"
    "src/components/debate/chart/MarketPriceChart.tsx"
    "src/components/debate/composer/PositionStrip.tsx"
    "src/components/debate/composer/ReplySplitBar.tsx"
    "src/components/discovery/HeroPanels.tsx"
    …

 ❯ tests/unit/design/side-pole-binding.test.ts:382:21
    380|    ...new Set(sideKeyedColour.map((hit) => hit.file)),
    381|   ].sort();
    382|   expect(inventory).toEqual(PERMITTED_FILES);
```

### ⚠ The guard is NOT rejecting the pole logic

`side-pole-binding.test.ts` has four tests. **The three OFFENDER-predicate tests all PASS** — the poles written at C2 resolve a side value to pole-family tokens, which is exactly what the guard requires. The single failure is the **closed inventory** (`PERMITTED_FILES`, `:309-331`): a *new* side-keyed colour **site** has appeared against a list pinned at seven files.

**The code that trips it** — `src/components/debate/AggregateFooter.tsx (AggregateFooter → the pole constants)`:

```ts
const supportPole = postSide === "YES" ? "bg-yes" : "bg-no";
const counterPole = postSide === "YES" ? "bg-no" : "bg-yes";
```

---

## 3 · Why this code is believed correct, and why building T3 any other way is worse

Row T3 requires a **side-coded, not relation-coded** bar (plan §7: *"four assertions on T3, not two"*). Support inherits the post's side; Counter takes the opposite. A bar with **fixed** poles renders the NO-side share in the YES pole on every NO post.

That failure mode is **documented inside the guard itself** as the case it *cannot* catch:

> *"Route 3 — A FIXED pole colour on a PER-SIDE element. No side value appears in the expression at all; the pole is hard-coded while the QUANTITY it measures flips meaning with the side. Nothing here can match it … V17's Support/Counter split bar lived in exactly this hole for the length of this PR … and this file stayed green throughout."*
> — `tests/unit/design/side-pole-binding.test.ts` docstring

⇒ The three alternatives were considered and all are worse:

| Alternative | Verdict |
|---|---|
| **Fixed poles** (no side value) | ⛔ Reproduces Route 3 — the exact defect. Fails `aggregate-footer.test.tsx` assertion 3. **Would leave `side-pole-binding` green while shipping the bug**, which is the worst possible outcome. |
| **Pass pole class strings down from `PostCard`** | Moves the same side-keyed expression into `PostCard.tsx`, which is **also absent** from `PERMITTED_FILES`. Same halt, worse design. |
| **Evade the matcher** (e.g. a `POLE[postSide]` lookup) | ⛔ Deliberately defeating a design guard. Not considered further. |

---

## 4 · ⚠ THE GUARD'S OWN FILE DOCUMENTS THE REMEDY — TWICE

This is why the halt is a **one-line ruling**, not a redesign. `PERMITTED_FILES` records the mechanism at its two most recent entries:

**7th entry (`HeroPanels.tsx`), `:314-323` — added for THE IDENTICAL CODE SHAPE:**

> *"SEVENTH ENTRY, added deliberately at the V17 fix — the guard's own documented mechanism, exercised rather than worked around … the fix made the segments side-keyed:*
> `supportPole = side === "YES" ? "bg-yes" : "bg-no"`
> `counterPole = side === "YES" ? "bg-no"  : "bg-yes"`
> *which is correct AND newly visible to this guard, so **the file enters the inventory**. The predicate was NOT relaxed to avoid the churn — relaxing it is the one thing this file must never do to stay green."*

**8th entry (`ui/thumb-glyph.tsx`), `:326-331`:**

> *"Added as a **DECISION**, in the same commit as the lift; the predicate was not touched."*

⇒ **A new correct side-keyed site ENTERS THE INVENTORY as a ruled decision.** That is the same shape §7 already describes for the `SideBadge` census — *"the census fired and the adoption was RULED, not absorbed, both times. That is the guard working."*

---

## 5 · What the plan missed, stated precisely

PR 2 **anticipated one census collision and allow-listed it**: `tests/unit/debate/render/side-badge.test.tsx` is §8 row 20, and §9 C6 carries its re-key (8 base sites → 9).

It did **not** anticipate this one.

| Check | Result |
|---|---|
| Does the ratified plan mention `side-pole-binding` anywhere? | **No** — `grep -c 'side-pole-binding' docs/plans/POLISH-3-PR-2.md` → **0** |
| Is `tests/unit/design/side-pole-binding.test.ts` on §8's allow-list? | **No.** §8's only `tests/unit/design` reference is `no-raw-hex-view-layer.test.ts` (§7's "must stay green" row), and it is not an allow-list row |
| Is the file otherwise reachable? | **No.** §8: *"the allow-list IS the whole belt"* |

⚠ **The genus is `GC-3`'s and `GC-12`'s, a third time:** a ratified artifact reaches a site its named guard set does not cover. Here it is inverted — the *guard* covers the site and the *allow-list* does not reach the guard.

---

## 6 · The ruling requested — two options, with a recommendation

### ✅ **Option A (RECOMMENDED) — add the 9th inventory entry**

Add `tests/unit/design/side-pole-binding.test.ts` to §8's allow-list, and in it add one entry plus a decision comment, in the same commit as C2:

```
"src/components/debate/AggregateFooter.tsx",
// NINTH ENTRY — POLISH.3 PR 2 row T3. The market-view aggregate footer became
// the split bar and its segments are side-keyed for the same reason the
// seventh entry's were …
```

- **Precedent: exact, and twice.** Entries 7 and 8 were both added this way.
- **The predicate is not touched** — the one thing the file says it must never do.
- **Cost:** one line + a comment. **Widens the allow-list by one test file.**

### Option B — export a `sidePole(side)` helper from `badges.tsx`

`badges.tsx` is already permitted, so moving the expression there leaves the inventory at seven.

- ⚠ **Weaker, and the guard says why.** Its **Route 1** is *"SEMANTIC INDIRECTION — the call site names no colour, so the inversion is invisible where it is written."* A helper returning a pole token is not Route 1 exactly, but it moves the pole decision away from the call site, which is the direction the guard was built to distrust.
- Also widens `badges.tsx`, which carries `SideBadge` — a component this PR is otherwise careful not to disturb (row 12 pins it UNSIZED).

⇒ **Recommend A.**

---

## 7 · Run state at the halt

| Commit | State |
|---|---|
| **C0** `4d9ba0f` | ✅ ratified plan landed; committed blob md5 identical to the ratified file. **GC-13 discharged** |
| **C1** `13fcf48` | ✅ eight greenfield guards, **all eight RED on first run** — `H-GREEN (a)` does not fire |
| **C2** `008e3bb` | ⛔ **HALTED, NOT CLEARED.** Committed as evidence so the ruling can be made against the diff |
| C3–C12 | ⛔ **DID NOT RUN** |
| C13 | ⛔ attended-only; never in tonight's scope |

**What C2 did prove, and it should not be lost in the halt:**

- **`aggregate-footer.test.tsx` → GREEN at C2**, all five, including assertion 3 (NO post → support fill takes the NO pole) — the assertion a fixed-pole bar fails.
- **`dharma-spacing.test.tsx` sites 4–5 → GREEN at C2**, sites 2–3 still RED. **`GC-10` confirmed by measurement**, exactly as predicted: C2 discharges rows 4–6's sites 4–5 eight commits before C10, and C10's `AggregateFooter` arm is now a verification. §12's `H-GREEN (b)` scheduled window — **EXPECTED, not a halt.**
- `ZUGZWANG_ENV=preview just verify` → **exit 0** at C1 and C2.

---

## 8 · Second finding, recorded — NOT a halt

**C2 writes `PostCard.tsx`** (two prop passes: `postSide={post.sideAtPostTime}` at both `AggregateFooter` call sites). §9 `GC-7`'s *"complete set"* of same-file pairs is **C2→C10, C5→C6, C8→C9**. C2→C8 and C2→C9 are a **fourth and fifth pair the plan does not list**, so §20 step 7's checkpoint list is incomplete: `PostCard.tsx` needs a re-key **before C8** as well as before C9.

`H-REKEY` does **not** fire — nothing is ABSENT / RENAMED / DUPLICATED. This is *update-and-continue*, recorded here so it survives the halt.

The prop pass is structurally unavoidable: `ReplyAggregate` carries counts and Dharma only, so the bar cannot know its own poles without the post's side, and `PostCard` is `AggregateFooter`'s **only** consumer (both call sites, `:54` and `:131`).

---

## 9 · Third finding, recorded — NOT a halt

**§0's own admit-check is incomplete in its numeric half, a fourth time.** Run against the landed file, `SlotHeader` appears in **§0 · §1 · §2 · §4 · §11 · §13 · §16 · §17 · §20**. §0 enumerates seven of those nine — **§13 and §20 are omitted** — and states §1 carries *"exactly one hit"* where it carries **two** (`:117` prose, `:122` inside the `git diff --numstat` block).

⚠ **The plan is NOT falsified.** Its load-bearing claim is *"zero hits in §6, §8 or §9"*, and that **holds** — verified, zero. Every hit is an exclusion, a precondition or a citation, exactly as claimed. This is §0's own documented failure mode — *the numeric half wrong, the section-distribution half right* — recurring in the one place §0 says it always recurs.

---

## 10 · Next action

1. **Founder/web rules on §6** — Option A or Option B.
2. If **A**: add `tests/unit/design/side-pole-binding.test.ts` to §8's allow-list, amend C2 (or land a C2a) with the ninth entry + decision comment, re-run the C2 gate, then continue at **C3**.
3. Apply §20 step 7's **added** checkpoint: re-key `PostCard.tsx` before **C8** (§8 above).
4. `C13` remains **attended-only** and out of scope for any unattended continuation.

**Nothing was pushed to `main`. No PR was opened. No merge occurred.**
