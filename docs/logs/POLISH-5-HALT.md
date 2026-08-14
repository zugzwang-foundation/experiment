# POLISH.5 PR A — ⛔ RUN-STOP 1 · ITEM 2

**Grade: ⛔ RUN-STOP** (plan §11 condition 1 — *"Any write outside §5's allow-list becomes necessary"*), **compounded by condition 6** (*"A commit boundary would land RED"*).
**Raised at:** commit **A1**, item 2 (`P5-D03`), the first commit of PR A.
**Branch:** `polish/5-pr-a` at `c8ba802` — **no code committed, no PR opened.**
**Ground:** `origin/main` = `c8ba8026079721acaf0f47558330b3e5b614417b` (#330 merged 2026-08-14T08:16:25Z).

---

## 1 · The condition, named

**Item 2 cannot ship without editing `tests/unit/debate/render/side-badge.test.tsx`, which is on no §5 allow-list row.**

That file is a **source-scanning census** over the whole `src` tree. Item 2 wires `size="profile"` at `ArgumentList.tsx:49` and `:59`; the census pins, by set-equality, that **no call site wires `profile`**. Three of its assertions redden:

| Test | Line | Why item 2 breaks it |
|---|---|---|
| `no-call-site-wires-detail-or-profile` | `side-badge.test.tsx:424` | Filters sites on `/size\s*=\s*["{]?\s*["']?(?:detail\|profile)/` and asserts `[]`. Item 2 IS the wiring |
| `exactly-twelve-sites-pass-no-size-and-ride-CHIP-base` | `:115` | Set-equality map includes `"src/components/profile/ArgumentList.tsx": 2` in the **unsized** set. Item 2 moves both → `base` becomes 10 |
| `the-only-sized-site-is-the-discovery-hero` | `:134` | Asserts the **sized** set is exactly `{HeroPanels.tsx: 1}`. Item 2 adds `ArgumentList.tsx: 2` |

## 2 · ⚠ The guard was DESIGNED to fire here. It is working, not broken.

`side-badge.test.tsx`, in its own words, at the failing assertion:

> ```
> it("no-call-site-wires-detail-or-profile", () => {
>     // D5, asserted rather than trusted. The seam lands here; the adoption is
>     // POLISH.3's and POLISH.5's. If a later PR wires one, this reddens and the
>     // wiring becomes a DECISION — the same mechanism as `PERMITTED_FILES`.
> ```

**This is the `PERMITTED_FILES` pattern deliberately applied to the `profile` preset.** DISCOVERY-COMPLETE C3 shipped the seam and pinned the zero so that POLISH.5's adoption would have to be ratified rather than absorbed. ⇒ **The redness is the mechanism succeeding.** It is not a defect to fix, and per §11 condition 2's principle — *"a red guard is a finding about the change, never a file to fix"* — I did not touch it.

## 3 · Where the plan missed it

The plan **measured the zero and did not notice it was pinned**.

- **§8's census, item 2 row** names only `argument-list-side.test.tsx:93-97`, `:104-108` and rules the item **"GREEN."** `side-badge.test.tsx` is absent from §8 entirely.
- **§2.9** got within one sentence of it: *"`detail` and `profile` have ZERO call sites by design (D5) … Their only coverage is therefore the direct render tests, at both poles."* It read the file as **coverage of the preset**, not as a **census pinning the zero**.
- **§5's struck row** for `badges.tsx` says *"`CHIP.profile` … already exist**s**. Items 2 and 3 **consume**; neither touches the primitive."* True of the primitive — but the *census* is a third thing, neither primitive nor profile-suite.
- **§10 `P-2`'s CITE set** lists `tests/unit/design/` but **not** `tests/unit/debate/render/`, so the file was outside both the write set and the cite set.

⚠ **This is a `V-2`-shaped miss:** the plan verified that item 2's *own* suite stays green and did not ask which *other* suite asserts the property item 2 changes.

## 4 · Blast radius — measured, not reasoned

**Item 2 alone.** Proven three ways:

1. **Census green at `c8ba802` with A1 reverted** — `pnpm vitest run tests/unit/debate/render/side-badge.test.tsx` → **19/19 passed, exit 0.**
2. **The classifier regexes do not see item 3.** Probed directly: `<SideBadge side={…} price={…} />` → `sized: false`, `wires detail|profile: false`. Item 3 passes `price=`, never `size=`.
3. **Full unit-suite probe with ALL SEVEN items' production edits applied at once** (1641 tests) — the only non-allow-listed file that reddens is `side-badge.test.tsx`:

| File | Failures | On §5's allow-list? |
|---|---|---|
| `tests/unit/debate/render/side-badge.test.tsx` | **3** | ❌ **NO — this is the RUN-STOP** |
| `tests/unit/profile/render/argument-list-side.test.tsx` | 5 | ✅ **row 15 (PR A)** — expected |
| `tests/unit/profile/render/surface.test.tsx` | 2 | ✅ **row 14 (PR A)** — expected |

Both allow-listed files fail for **one shared, benign cause**: `TypeError: Cannot read properties of undefined (reading 'includes')` — the fixtures do not yet carry A5's new `authorStake`/`priceAtBet`, so `formatDharma(undefined)` throws. **That is the fixture work A4/A6/A7 already own.** It is *not* item 17: `owner-vs-visitor-body-identical` fails from the same fixture gap, and the pre-flight's finding that `arena()` (`:343-361`) never mounts `IdentityCard` **stands**.

⇒ **Items 3 · 4 · 5 · 6 · 15 · 17 are clear of every censusless test in the suite.** The probe was reverted in full; the tree is byte-identical to `origin/main` and `arguments.ts` hashes `6e1c9c491ddd57b122db03dd740ba0e0`.

## 5 · What a ruling would need to say

⛔ **Not mine to make** — §5 is ratified and this is a founder call. The shape of it:

- **(a) Amend §5** with an eighteenth row: `tests/unit/debate/render/side-badge.test.tsx`, **PR A**, item 2, **symbol-fenced** to the three census assertions — the `countByFile` map (`ArgumentList.tsx` moves from the unsized map to the sized one) and the `no-call-site-wires-detail-or-profile` expectation. ⛔ Nothing else in the file; the four `zero delta` render assertions and `census-is-alive` stay untouched. **A1 then also carries the census update, one commit.**
- **(b) Or drop item 2 from PR A** and route it wherever the census amendment is ratified.

⚠ **If (a):** the file is `tests/unit/debate/**`, which §6's belt does **not** deny-list — so, exactly like `IdentityCard.tsx` before v2.3, it is excluded by the allow-list alone. Worth naming in §6's *"the belt cannot see"* list.

⚠ **And note the ordering consequence:** the census asserts a property of `src/` **as a whole**, so it reddens the moment the *first* `size="profile"` lands and stays red until the map is updated. There is no commit split that avoids it — which is why the amendment must ride A1 itself, not a later commit.

## 6 · State

**Nothing shipped.** Branch `polish/5-pr-a` created at `c8ba802` and holds only this record. No push, no PR, no `POLISH-5-PRA-DIFF.md`. `git diff origin/main -- src/ tests/` is **empty**.

Gate legs at this head: 1 ✅ · 2 ✅ · 3 ✅ · 4 ✅ · 5 ⚠ *(md5 `2b0ecfd405b56a82bd27cb903fecd628` ≠ the kickoff's `e262b491…` — commit 0's own ratified `HM-4` discharge, three hunks allocating `O-5…O-8`; all seven PR-A-governing sections verified byte-identical)* · 6 ✅. `P-2` re-measure: WRITE set touched `design-canon.md` only (two `C-` rows appended at `@@ -256`, §3 untouched, `12. **Side chip**` still `:68`); CITE set touched `docs/parked.md` only (`:1061` unmoved). **Every PR-A file and citation: diff empty.**
