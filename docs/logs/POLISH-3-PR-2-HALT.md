# POLISH.3 · PR 2 — HALT RECORD

**Run:** overnight, unattended, 2026-08-15 · **Branch:** `polish/3-pr2-cards`
**Branch point:** `origin/main` = `ea1795e` · **Plan:** `docs/plans/POLISH-3-PR-2.md` v1.4 (md5 `e9e8e08b6491c3eae861d8d800d2f331`, 867 lines, 22 sections)
**Halted at:** **C2** · commit `008e3bb` · **C3–C12 DID NOT RUN** · **C13 was never in scope** (attended-only)

---

## ✅ 0 · RESOLVED — founder ruling **R-3**, 2026-08-16

**The halt was accepted as correctly called**, on the reviewer's ground: *from the diff alone, an unattended agent adding its own file to a closed inventory to green its own change is indistinguishable from the anti-pattern the guard forbids.*

> **R-3 · CLOSED-INVENTORY ADDITIONS.** A ratified plan may add **its own subject** to a closed design-guard inventory when all three hold: **(1)** the guard's OFFENDER PREDICATE passes — the code is correct and only the census is stale; **(2)** the addition is NAMED in the plan's item table; **(3)** it lands in the SAME COMMIT as the code that makes it necessary.
> ⛔ **The plan widens the CENSUS, never the PREDICATE.** An addition failing any of the three is still a HALT.

**Applied to both collisions, once:**

| Guard | Change | Condition (1) |
|---|---|---|
| `side-pole-binding.test.ts` | `AggregateFooter.tsx` added at **index 0** | ✅ all three offender-predicate tests passed at the halt |
| `pct-round-render.test.ts` | `EXPECTED_ALLOW_MARKERS` **3 → 5** | ✅ verified separately at C12 *before* the count moved — see §12 |

**C2 was AMENDED** (not followed by a census commit) so both halves land in one diff — `008e3bb` → **`53f503f`**. The run resumed at C3 and **C1…C12 are complete**. §12 below records the outcome.

⚠ **Two corrections to this record's own forecasts came out of the resumed run** — §12.

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

> ⛔ **MECHANICAL CORRECTION — THE ENTRY GOES AT INDEX 0, NOT APPENDED.**
> `inventory` is `[...new Set(...)].sort()` (`:379-381`), and `"A"` (0x41) sorts
> before `"b"` (0x62), so `AggregateFooter.tsx` precedes `badges.tsx`.
> **An appended entry leaves the test RED.** *(Caught by `@code-reviewer`.)*

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
| — `e12a015` | this halt record |
| — `422fb8b` | post-halt remediation: `@code-reviewer` HIGH-1 + MEDIUM-3, absorbed in-session (§10). **Does not advance the run** |
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

## 10 · `@code-reviewer`'s pass — verdict and findings

Run after the halt, on the full branch diff, with the plan and this record as context. **`@security-auditor` did NOT run** — it is C13's, and C13 did not run.

⚠ The reviewer **did not execute the suite**: another session's `pnpm vitest run` was live in `/Users/hrishikesh/code/zz-hf-bookmarks`, and §14.3 forbids a concurrent runner. It verified statically plus `tsc --noEmit` (exit 0) and `biome check` (exit 0). *(Re-checked here with PID resolution before the remediation run below; it had finished. No other session's process was signalled.)*

### ✅ Verdict on the halt: **CALLED CORRECTLY. Do not absorb.**

Three grounds, the third of which is new evidence:

1. `side-pole-binding.test.ts:283` states the mechanism as a rule about **who may act**: *"Each such addition must be a DECISION, made by adding the file here explicitly — never by relaxing the predicate."* **A decision is not an unattended executor's to take.**
2. From the diff alone, *"unattended agent adds its own file to a closed inventory to green its own change"* is **behaviourally indistinguishable** from the anti-pattern the guard exists to forbid. The distinction lives entirely in an argument about pole semantics read against the read model — a review judgement.
3. **The same collision is waiting at C12** (below). Ruling on C2 alone and resuming would hit an identical wall eight commits later. **The halt bought the chance to rule once, generally.**

**CRITICAL: none.** No invariant surface, no refusal trigger, no `src/server/`, no schema, no migration, no auth path. **§5.14 SC-1 does not fire** — the diff adds no read over `comments.body`.

### ⛔ HIGH-2 · **A SECOND COLLISION OF THE SAME GENUS IS WAITING AT C12, AND IT HAS NO FENCE-CLEAN ESCAPE**

`tests/unit/design/pct-round-render.test.ts:52` pins `EXPECTED_ALLOW_MARKERS = 3` and asserts `toHaveLength(EXPECTED_ALLOW_MARKERS)` at `:101` — an **exact count, not a floor**. The three live markers are `badges.tsx:149`, `chart/MarketPriceChartCard.tsx:21`, `:24`.

C1's landed guard (`chart-overlay-a11y.test.tsx:96-100`) requires the overlay summary to render `40%` / `73%` via `formatPercentUnpaired` — correctly, since these are single-side historical values and the paired formatter would derive `100 − x`. Any such call in `MarketPriceChartOverlay.tsx` needs a `pctround-allow:` marker ⇒ **markers becomes 4 ⇒ RED**.

**Every escape is blocked:**

| Escape | Why it fails |
|---|---|
| Compute in `MarketPriceChartCard.tsx`, pass down | That file is **not on §8's allow-list** ⇒ `H-FENCE` **RUN-STOP** — worse than a guard red |
| Pass the summary from the parent | The parent is `MarketPriceChartHost`, a **§11 no-edit symbol** |
| Use the paired formatter | A semantic defect the guard's own comment at `:42-51` argues against |

⇒ **This is the THIRD instance of the genus** (`GC-3`, `GC-12`, the C2 halt). **Recommendation: rule the GENERAL form now** — *a correct new site enters a closed inventory/count as a ruled entry, and the plan's allow-list gains the guard file* — and apply it to **both** `side-pole-binding.test.ts` **and** `pct-round-render.test.ts` in one pass, rather than halting again at C12.

### ✅ HIGH-1 and MEDIUM-3 — FOUND, CONFIRMED, FIXED IN-SESSION at `422fb8b`

- **HIGH-1 · `dharma-spacing.test.tsx` selected the wrong element.** `.font-mono` returned the **SideBadge** (`CHIP.base` carries `font-mono`, `badges.tsx:61`; the badge precedes the stake at `ReplyCard.tsx:49`→`:54` and `ArgProfile.tsx:62`→`:67`), so **sites 2 and 3 could never have gone green — not at C1, not after C10.** §18's closure of `PD-3-07` rests on this guard, so this was `GC-3` reproduced inside `GC-3`'s own remedy. Fixed to `.font-mono:not([data-slot="badge"])`; the failure message moved from `expected 'YES' to contain 'Đ 5,000'` to `expected 'Đ5,000' to contain 'Đ 5,000'` — red for the right reason.
- **MEDIUM-3 · the split-bar track was invisible on a NO post.** `--color-yes` `#181818` on `bg-card` → `--color-n0` `#212121` ≈ **1.09:1**; and on a zero-reply post the bar read as "100 % Counter". The mockup's `.bar` is an **outline** (`d5:510 border:1px solid var(--ink)`) and the port dropped it. Fixed with `[border:var(--hairline)]`. All four pole assertions remain green.

### Recorded, NOT fixed — owners named

- **MEDIUM-4 · `O-5`, in the committed plan.** `docs/plans/POLISH-3-PR-2.md:310` (§7) and `:564` (§12's `H-GREEN` schedule) still say **four** rows for `post-popup.test.tsx`. `GC-12` ruled **five**. §12 is the table an executor grades partial greens against. ⚠ **Deliberately NOT amended here:** the committed plan is the ratified v1.4 *verbatim* and its md5 is stamped in C0's body — editing it would invalidate that stamp. **Owner: the founder's next plan revision.**
- **LOW-5 · T3 typography.** No `border-top:var(--hairline)` (`d5:583`); side figures `text-xs` vs `.sb2` `10px/700/n4` (`d5:595`); lowercase `staked` vs `.sb2.mid` uppercase + `.1em` (`d5:620`). All three inherited verbatim from the shipped `ReplySplitBar`, so C2 is **consistent** rather than **faithful**. T3 is a fidelity row — **one founder line owed** on whether it owes `d5`-exact typography or sibling consistency. *(Layout IS faithful: `shrink-0` / `min-w-0 flex-1` match `.sidewrap` / `.midwrap` at `d5:585,588`.)*
- **LOW-6 · a C4 note.** `comment-image.test.tsx:77` pins `w-full` on the `<img>`, but the parent `<button>` is `block w-fit` (`CommentImage.tsx:23`). Inside a shrink-to-fit box the percentage resolves against the image's intrinsic width, so the guard would pass on a render that does not achieve `H-T2`'s ruled 100 % width. **C4 will need to touch the button too** — fence-clean (§8 row 7), but the guard as landed will not say so.
- **LOW-7 · `§20` step 7.** Confirms §8 of this record: the `PostCard.tsx` re-key must move to **before C8**, not only before C9.

### Confirmations requested and given

- **Pole correctness — VERIFIED against the read model.** `ranking-substrate.ts:75-83` defines the aggregate as `support = rc.side_at_post_time = p.side_at_post_time`, `counter = <>` — Support is the post's own side, Counter the opposite. `supportPole`/`counterPole` match exactly, at **both** `PostCard` call sites, and `sideAtPostTime` is the correct INV-3-frozen basis on the removed variant too. The code is the **exact shape** `PERMITTED_FILES`' seventh entry documents as the ruled remedy — not the hole.
- **`composer/split-bar.ts` reuse — sound, client-safe.** Full chain audited; `grep -rn "server-only" src/components/debate/` returns **prose only, zero imports**. Exact decimal throughout, no JS float touches a Đ value, `displaySplitTotal` adds before it groups (SPEC.1 §10.8). No `composer/**` file written, so §10 holds.
- **The eight guards — composition constraint and `O-7` honoured.** No count, no whole-subtree snapshot, no composed-root equality. `post-popup` correctly uses `baseElement` (portal); `chart-overlay-a11y` correctly uses `container` (plain fixed `<div>`, not a portal). The one whole-root `innerHTML` use is the plan-prescribed ABSENCE form over unique fixture strings, immune to C10/C11. `chart-overlay-a11y`'s `@/server/**` imports are `import type` only — erased at compile.
- **No second design-guard reddening at C3–C11.** The next one is at **C12** (HIGH-2).

---

## 11 · Next action

1. **Founder/web rules on §6 — and rule the GENERAL form, not just this instance.** The recommended shape, covering both known collisions in one pass:

   > *A **correct** new site that trips a closed inventory or an exact count in `tests/unit/design/**` enters that inventory as a **ruled entry**, in the same commit as the code — the predicate is never relaxed — and the plan's §8 allow-list gains the guard file so the entry is fence-clean.*

   Applied now, that clears **both** `side-pole-binding.test.ts` (C2, live) and `pct-round-render.test.ts` (C12, forecast — §10 HIGH-2), instead of halting a second time eight commits later with no fence-clean escape.

2. If **Option A**: add `tests/unit/design/side-pole-binding.test.ts` to §8's allow-list, then insert `"src/components/debate/AggregateFooter.tsx"` **at index 0** (⛔ not appended — see §6's mechanical correction) with a decision comment, re-run the C2 gate, and continue at **C3**.
3. Apply §20 step 7's **added** checkpoint: re-key `PostCard.tsx` before **C8** as well as before C9 (§8).
4. Amend the plan's §7 `:310` and §12 `:564` to `GC-12`'s **five** rows (`O-5`, §10 MEDIUM-4). Owner: the next plan revision — deliberately not done here, because the committed plan is the ratified v1.4 verbatim and its md5 is stamped in C0's body.
5. Answer the **LOW-5** fidelity question: does T3 owe `d5`-exact typography, or consistency with the shipped `ReplySplitBar` it currently mirrors?
6. Carry the **LOW-6** note into C4: `CommentImage`'s parent `<button>` is `w-fit`, so `H-T2`'s ruled 100 % width needs that element too.
7. `C13` remains **attended-only** and out of scope for any unattended continuation.

**Nothing was pushed to `main`. No PR was opened. No merge occurred.**

---

## 12 · Outcome of the resumed run (2026-08-16) — and two corrections to this record

**C1…C12 complete.** C13 (`RR-3`) did not run and remains attended-only.

### ✅ R-3 condition (1), verified separately at C12 — the check that mattered

R-3 is a rule, not a pre-clearance, so `pct-round-render` was run with the **new code and the OLD count** before the count moved:

```
✓ scans a non-empty file set (guard is alive)
× uses formatPercentUnpaired only at the exact allowlisted single-side readouts
    → expected [ …(5) ] to have a length of 3 but got 5
      AT :101   expect(markers).toHaveLength(EXPECTED_ALLOW_MARKERS)
✓ computes no percent by float multiplication on a price
```

The failing assertion is **`:101`, the CENSUS**. The assertion immediately above — **`:100` `expect(offenders).toEqual([])`, THE OFFENDER PREDICATE — passed** (vitest stops at the first failing assertion, so reaching `:101` proves `:100` held). ⇒ **Condition (1) HOLDS.** Had `offenders` been non-empty, R-3 would not have applied and C12 would have been a second halt.

### ⚠ CORRECTION 1 — the C12 count is **5**, not 4

§10 HIGH-2 forecast `EXPECTED_ALLOW_MARKERS` 3 → **4**. It is 3 → **5**. The summary names **two** figures (opening *and* current), so it needs **two** `pctround-allow:` markers — exactly as `MarketPriceChartCard.tsx` carries two for its two. The forecast assumed a single call site.

### ⚠ CORRECTION 2 — §8's new checkpoint was **load-bearing, not ceremonial**

§8 recorded that `PostCard.tsx` needs a re-key before **C8** as well as before C9. Measured at C8, the drift was **+5** and the plan's row-1 fence `:111-119` had come to span **from row 3's `aria-label` into the middle of row 1's block** — a fragment cutting across two buttons. **Deleting it blind would have destroyed the control C9 rewrites and left row 1 malformed.** The deletion was done by SYMBOL instead. This is `O-8` firing inside a single PR, measured rather than argued.

**The complete pair set is FIVE**, re-derived rather than taken: `PostCard.tsx` is written by C2, C8, C9 → **(C2,C8) · (C2,C9) · (C8,C9)**; `dialogs.tsx` by C5, C6 → **(C5,C6)**; `AggregateFooter.tsx` by C2 with C10 fenced to it → **(C2,C10)**. **The fifth is (C2,C9)** — the before-C9 checkpoint existed for C8's deletion alone, but `PostCard.tsx` now has *two* earlier writers.

⚠ **A sixth writer relationship exists and GC-7's rule as written covers it:** the post-halt remediation commit also writes `AggregateFooter.tsx` and `dharma-spacing.test.tsx`. The before-C10 re-key therefore accounts for **two** earlier writers, not one — and it had to: sites 4–5 moved `:14`/`:19` → `:78`/`:118`.

### ✅ GC-10 verified

`AggregateFooter`'s support/counter spans carry `Đ{" "}` — **PRESENT**, zero unspaced occurrences. Recorded "verified, discharged at C2"; `git diff --name-only` for C10 lists only `ReplyCard.tsx` and `ArgProfile.tsx`, so **no no-op edit was written and reported as work**.

### ✅ HIGH-1's fix is what made C10's green real

With the original `.font-mono` selector the assertion would **still** have read the SideBadge's `"YES"` and stayed red *after* the source was correctly spaced — leaving the PR carrying a permanently-red guard over a defect it had actually fixed, with §18's closure of `PD-3-07` resting on it.

### Guards, against §12's schedule

| Guard | Green at | §12 says | Verdict |
|---|---|---|---|
| `aggregate-footer` | C2 | C2, single-commit | ✅ |
| `comment-image` | C4 | C4, single-commit | ✅ |
| `post-popup` | rows 9+14 C5 → rows 10-12 C6 | GC-12's corrected 1-commit window | ✅ |
| `reply-preview` | C7 | C7, single-commit | ✅ |
| `post-card` | rows 1-2 C8 → row 3 C9 | 1-commit window | ✅ |
| `dharma-spacing` | sites 4-5 C2 → sites 2-3 C10 | 8-commit window, the longest | ✅ |
| `chart-overlay-a11y` | C12 | C12, single-commit | ✅ |
| `reply-split-bar` | — | C13 | ⛔ **still RED, expected** |

**No unscheduled green anywhere. `H-GREEN` never fired.** All 8 design guards green.

---

## 13 · `@code-reviewer`'s second pass (post-C12) — verdict and disposition

Full context read, full branch diff walked file by file, gates re-measured independently: `tests/unit/debate/ tests/unit/design/` → **28 passed / 1 failed (29)**, the single failure being the by-design C13 pole pair; `tsc --noEmit` exit 0; `biome check .` exit 0.

**CRITICAL: none. HIGH: none.**

### ✅ The headline check — no guard was made to pass by weakening it

Every guard the branch edits was compared against its `origin/main` state and found **census-only**:

| Guard | Verdict |
|---|---|
| `side-pole-binding.test.ts` | predicate, both `>=` floors, `offenders.toEqual([])`, scanner — **byte-identical**. Index-0 placement independently confirmed necessary |
| `pct-round-render.test.ts` | `UNPAIRED_CALL`, `ALLOW_MARKER`, `FLOAT_PERCENT`, `SCAN_DIRS`, liveness floor, `offenders.toEqual([])` — **untouched**. Marker arithmetic re-derived: card 2 + badges 1 + overlay 2 = **5** |
| `side-badge.test.tsx` | inside its own stated fence; `>=13` floor, sized test and `detail-stays-unwired…` untouched; census re-run → 14 sites, 9 unsized, **zero `detail`** |
| `comment-image.test.tsx` | **strictly tightened** — and the old form would have *passed* on `max-w-full` as a substring, so it did not flip red→green |
| `bookmark-toggle.test.tsx` | proper inversions, no test weakened |
| `dharma-spacing.test.tsx` | HIGH-1 fix confirmed correct and unambiguous |
| `market-header.test.tsx` | additive only |

MEDIUM-3's fix also verified: the hairline is on the track and all four pole assertions still pass.

### Fixed in-session (post-review remediation commit)

- **MEDIUM-1 · an `O-5` miss inside the file C8 edited.** `PostCard.tsx`'s own docstring still described "the disabled write triggers (Đ BET / Support-Counter)" that C8 deleted. C11's prose sweep reached three docstrings and missed this one. Fence-clean (§8 row 1) — corrected.
- **LOW · two comments stated a WRONG CSS mechanism** (`CommentImage.tsx`, `dialogs.tsx`). They claimed `width:100%` + a binding `max-height` breaks a replaced element's aspect. It does not — CSS 2.1 §10.4 recomputes the used width from the intrinsic ratio. **The choices were right and their stated causes were not**, which is `O-3` exactly. Corrected, with the real reasons given (`max-w-full` avoids upscaling a sub-160px image and avoids a circular percentage inside the `w-fit` parent; `object-contain` in the pop-up is defensive, not load-bearing).
- **LOW · `CommentImage`'s docstring** said "Capped at `--imgmax`" without naming the axis, which is now the entire substance of row T2. Corrected.

### ⚠ RECORDED, NOT FIXED — needs a founder line

- **MEDIUM-2 · C7 introduces a remount at the expand/collapse boundary.** Position 0 of `ReplyPreview`'s container changes type across the toggle (collapsed = a mapped array; expanded = an explicit fragment of two unkeyed `<ul>`s), so React cannot match the keyed `ReplyCard`s and **every reply card remounts on expand**. `BookmarkToggle` seeds its `useState` at mount from the page-load prop, so **a bookmark placed on a default-slot reply reads as unsaved after expanding**. Data is unaffected (`add.ts` is `onConflictDoNothing` → `{ok:true}`) and one click restores it.
  ⚠ The component's docstring already ratifies this divergence **class** for v1 (paging triggers no server render, D5) — but **this is a new instance and the plan does not name it**. Two options: (a) record it as a ruled consequence, or (b) render both branches through a `<ul>` so position 0 keeps its type.
  ⛔ **Deliberately not fixed unattended**: it is a structural change to a component whose row is already satisfied, arriving after the full suite had passed, and it touches bookmark-state perception, which is UI-A6 / ADR-0032's lane.
  ✅ Confirmed NOT broken: the `<li key={reply.id}>` placement is correct, and `CardActions`' `key={commentId}` remount law is intact.
- **MEDIUM-3 · `docs/design/design-canon.md:67` and `:110`** still describe the card cluster as "bookmark/download". That is `O-5`'s harm precisely — a future reader restores the trigger from canon. ⛔ **Not fixable in-fence**: §8 lists `Docs: ⛔ none`. **Needs a docket row, owner POLISH.3 close-out.**

### Recorded — no action

- `PostCard.tsx`'s `text-n5 hover:text-ink` is redundant: `buttonVariants`' `ghost` already emits both, and the prior control was also `ghost`. Explicit is defensible, but row 3's real proof is the `Read more` copy and the no-`<svg>` assertion, not the token classes.
- `MarketPriceChartOverlay`'s `series[0]` / `series[length-1]` are unchecked index reads, safe only because `MarketPriceChartHost` returns `null` on an empty series. Mirrors `MarketPriceChartCard` exactly — a standing shape, not a regression.
- `MarketHeader`'s `mt-[5px]` adopts one `.crittext` property while its `font-size`/`color` are not adopted — **fold into LOW-5's single founder line**, not a separate question.
- `PostCard.tsx:141`'s `aria-label="Open this debate"` over visible "Open debate" is the same WCAG 2.5.3 shape C9's comment argues against. Pre-existing, outside row 3 — flagged only so C9's argument is not read as repo-wide-true.
- **Plan/file-set divergence**: the PR edits two `tests/unit/design/` guards that the committed plan's §8 does not list. Authorised by **R-3**, which names both; the plan is deliberately left at ratified v1.4 verbatim. **Not scope creep — but the PR body should say so in one line.**

### Confirmations on C3–C12

C3's recipe is `.overline`'s and only `.overline`'s (the three sibling rules carry three different size/tracking pairs and none of them landed). C4's "bounded" reading confirmed as the only one consistent with "no fixed box ⇒ object-fit does not arise". **C5's override wins deterministically** — and for a reason worth keeping: `ui/dialog.tsx`'s base is *unprefixed* `max-w-lg`, not shadcn's usual `sm:max-w-lg`; a `sm:`-prefixed base would not dedupe and would win at ≥640px. C6's re-key stayed in-fence with `detail` still at zero, and the new `<span>` children are valid inside `DialogDescription`'s `<p>`. **C10's space genuinely renders at both sites** — Babel strips leading whitespace on continuation lines but not trailing whitespace on the last, so the text node really is `"Đ "`. C11 leaves no in-code site asserting the superseded position. C12 widened the census only, and both new call sites genuinely qualify for the single-side hatch.

**Nothing in C3–C12 will redden a currently-green guard** — measured, not inferred. `no-raw-hex-view-layer` stays green because the four hex values the diff adds are all inside comments and that guard strips comments before matching.
